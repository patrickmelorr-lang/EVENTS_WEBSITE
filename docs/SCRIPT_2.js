// ==============================================
// FRONTEND - GESTIÓN Y CRONOGRAMA DE EVENTOS v2.0
// ==============================================

// 1) CONFIGURACIÓN - Pega aquí tu URL del Web App desplegado (termina en /exec)
const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzkgvb4eU0vc5TRop8eHPdsmFXmdd9WoeeEVpkkW6lESOfxQQQpc8-D0uDbZY0xt61s/exec";

// Servicios base
const DEFAULT_SERVICIOS = [
  { id: "LOCAL", nombre: "LOCAL", tipo: "simple", icon: "fa-shop" },
  { id: "REFRIGERADORA", nombre: "REFRIGERADORA", tipo: "simple", icon: "fa-snowflake" },
  { id: "COCINA", nombre: "COCINA", tipo: "simple", icon: "fa-kitchen-set" },
  { id: "SILLAS", nombre: "SILLAS", tipo: "cantidad", icon: "fa-chair" },
  { id: "MESAS_VERDES", nombre: "MESAS VERDES", tipo: "cantidad", icon: "fa-table" },
  { id: "MESAS_BLANCAS", nombre: "MESAS BLANCAS", tipo: "cantidad", icon: "fa-table" },
];

let servicios = [...DEFAULT_SERVICIOS];
let eventos = [];
let pagos = [];
let lastSaved = null;
let charts = { ingresosMensuales: null, categoriaDona: null };
let currentCalendarMonth = null;
let currentCalendarYear = null;
let selectedEventId = null;

// ==============================================
// INIT
// ==============================================
document.addEventListener("DOMContentLoaded", () => {
  setupThemeToggle();
  setupNavigation();
  setupMasksAndPickers();
  setupCategoriaOtro();
  renderServicios();
  setupButtons();
  cargarAnios();
  cargarCategoriasEnFiltro();
  setupCalendario();
  setupPagosYMejoras();
  
  // Fecha actual para calendario
  const hoy = new Date();
  currentCalendarMonth = hoy.getMonth() + 1;
  currentCalendarYear = hoy.getFullYear();

  cargarEventosYActualizarTodo();
});

// ==============================================
// THEME TOGGLE
// ==============================================
function setupThemeToggle() {
  const toggle = document.getElementById("themeToggle");
  const themeText = document.getElementById("themeText");
  const body = document.body;

  toggle.addEventListener("click", () => {
    const currentTheme = body.getAttribute("data-theme");
    const newTheme = currentTheme === "dark" ? "light" : "dark";
    body.setAttribute("data-theme", newTheme);
    
    if (newTheme === "light") {
      toggle.querySelector("i").className = "fa-solid fa-sun";
      themeText.textContent = "Claro";
    } else {
      toggle.querySelector("i").className = "fa-solid fa-moon";
      themeText.textContent = "Oscuro";
    }

    // Recargar gráficos si es necesario
    if (charts.ingresosMensuales || charts.categoriaDona) {
      actualizarDashboard();
    }
  });
}

// ==============================================
// NAVIGATION
// ==============================================
function setupNavigation() {
  const navLinks = document.querySelectorAll(".sidebar-nav a");
  const sections = document.querySelectorAll(".main-content .content-section");

  navLinks.forEach(link => {
    link.addEventListener("click", (e) => {
      e.preventDefault();
      const target = link.getAttribute("data-section");

      navLinks.forEach(l => l.classList.remove("active"));
      link.classList.add("active");

      sections.forEach(sec => sec.classList.toggle("active", sec.id === target));

      if (target === "dashboard") {
        actualizarDashboard();
      }
      if (target === "historial") {
        renderHistorial();
      }
      if (target === "calendario") {
        renderCalendario();
      }
    });
  });
}

// ==============================================
// MASKS / PICKERS
// ==============================================
function setupMasksAndPickers() {
  // DNI 8 dígitos
  const dni = document.getElementById("i_dni");
  dni.addEventListener("input", () => {
    dni.value = onlyDigits(dni.value).slice(0, 8);
  });

  // Celular
  const cel = document.getElementById("i_celular");
  cel.addEventListener("input", () => {
    cel.value = onlyDigits(cel.value).slice(0, 9);
  });

  // Garantía y Adelanto
  const gprecio = document.getElementById("g_precio");
  gprecio.addEventListener("input", () => {
    gprecio.value = normalizeDecimal(gprecio.value);
    recalcularTotal();
  });

  const adelanto = document.getElementById("adelanto_precio");
  adelanto.addEventListener("input", () => {
    adelanto.value = normalizeDecimal(adelanto.value);
  });

  // Fechas dd/mm/yyyy + datepicker
  wireDateField("e_fecha_text", "e_fecha_picker", "e_fecha_btn");
  wireDateField("e_entrega_fecha_text", "e_entrega_fecha_picker", "e_entrega_fecha_btn");
  wireDateField("e_fin_fecha_text", "e_fin_fecha_picker", "e_fin_fecha_btn");

  document.getElementById("e_entrega_hora").addEventListener("change", () => {});
  document.getElementById("e_fin_hora").addEventListener("change", () => {});
}

function wireDateField(textId, pickerId, btnId) {
  const text = document.getElementById(textId);
  const picker = document.getElementById(pickerId);
  const btn = document.getElementById(btnId);

  text.addEventListener("input", () => {
    const digits = onlyDigits(text.value).slice(0, 8);
    let out = digits;
    if (digits.length > 2) out = digits.slice(0, 2) + "/" + digits.slice(2);
    if (digits.length > 4) out = out.slice(0, 5) + "/" + digits.slice(4);
    text.value = out.slice(0, 10);
  });

  btn.addEventListener("click", () => {
    try {
      picker.showPicker();
    } catch {
      picker.focus();
      picker.click();
    }
  });

  picker.addEventListener("change", () => {
    if (!picker.value) return;
    text.value = isoToDmy(picker.value);
  });
}

function isoToDmy(iso) {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

// ==============================================
// CATEGORÍA OTRO
// ==============================================
function setupCategoriaOtro() {
  const cat = document.getElementById("e_categoria");
  const group = document.getElementById("categoriaOtroGroup");
  const other = document.getElementById("e_categoria_otro");

  cat.addEventListener("change", () => {
    const isOtro = cat.value === "OTRO";
    group.style.display = isOtro ? "block" : "none";
    other.required = isOtro;
    if (!isOtro) other.value = "";
  });

  other.addEventListener("input", () => {
    other.value = other.value.replace(/\s+/g, " ").trimStart();
  });
}

// ==============================================
// SERVICIOS UI
// ==============================================
function renderServicios() {
  const container = document.getElementById("serviciosContainer");
  container.innerHTML = "";

  servicios.forEach(s => {
    const card = document.createElement("div");
    card.className = "service-card";
    card.dataset.serviceId = s.id;

    card.innerHTML = `
      <div class="service-head">
        <div class="service-name">
          <i class="fa-solid ${s.icon || "fa-tag"}"></i>
          <span>${escapeHtml(s.nombre)}</span>
        </div>
      </div>

      <div class="service-body active" id="body_${s.id}">
        ${s.tipo === "simple" ? `
          <div class="form-group">
            <label>Precio (S/.)</label>
            <input type="text" inputmode="decimal" id="precio_${s.id}" placeholder="0.00" />
            <div class="field-help">Dejar en blanco si no se usa este servicio.</div>
          </div>
        ` : `
          <div class="inline-vertical">
            <div class="form-group">
              <label>Unidades</label>
              <input type="text" inputmode="numeric" id="uni_${s.id}" placeholder="0" class="input-small" />
            </div>
            <div class="form-group">
              <label>C/U (S/.)</label>
              <input type="text" inputmode="decimal" id="cpu_${s.id}" placeholder="0.00" class="input-small" />
            </div>
            <div class="form-group">
              <label>Total (S/.)</label>
              <input type="text" id="tot_${s.id}" class="readonly input-small" placeholder="0.00" disabled />
            </div>
          </div>
          <div class="field-help">Total = Unidades × Costo por unidad. Dejar en blanco si no se usa.</div>
        `}
      </div>
    `;

    container.appendChild(card);

    if (s.tipo === "simple") {
      const inp = card.querySelector(`#precio_${cssId(s.id)}`);
      inp.addEventListener("input", () => {
        inp.value = normalizeDecimal(inp.value);
        recalcularTotal();
      });
      inp.addEventListener("focus", () => {
        if (inp.value === "") inp.value = "0";
      });
    } else {
      const uni = card.querySelector(`#uni_${cssId(s.id)}`);
      const cpu = card.querySelector(`#cpu_${cssId(s.id)}`);
      const tot = card.querySelector(`#tot_${cssId(s.id)}`);

      uni.addEventListener("input", () => {
        uni.value = onlyDigits(uni.value).slice(0, 3);
        computeLineTotal(uni, cpu, tot);
        recalcularTotal();
      });
      uni.addEventListener("focus", () => {
        if (uni.value === "") uni.value = "0";
      });

      cpu.addEventListener("input", () => {
        cpu.value = normalizeDecimal(cpu.value);
        computeLineTotal(uni, cpu, tot);
        recalcularTotal();
      });
      cpu.addEventListener("focus", () => {
        if (cpu.value === "") cpu.value = "0";
      });
    }
  });

  recalcularTotal();
}

function computeLineTotal(uniEl, cpuEl, totEl) {
  const u = parseFloat(uniEl.value || "0");
  const c = parseFloat((cpuEl.value || "0").replace(",", "."));
  const total = u * c;
  totEl.value = isFinite(total) ? total.toFixed(2) : "0.00";
}




  servicios.forEach(s => {
    const chk = document.getElementById(`chk_${s.id}`);
    if (!chk) return;
    if (!chk.checked) {
      chk.disabled = incompleteSelected;
    } else {
      chk.disabled = false;
    }
  });


// ==============================================
// BUTTONS / ACTIONS
// ==============================================
function setupButtons() {
  // Agregar servicio custom
  document.getElementById("agregarServicioBtn").addEventListener("click", () => {
    const input = document.getElementById("nuevoServicioNombre");
    const name = (input.value || "").replace(/\s+/g, " ").trim();
    if (!name) {
      toast("statusRegistrar", "warning", "Ingrese el nombre del servicio a agregar.");
      return;
    }

    const id = "CUSTOM_" + name.toUpperCase().replace(/[^A-Z0-9]+/g, "_").slice(0, 24) + "_" + Math.floor(Math.random()*999);

    servicios.push({ id, nombre: name.toUpperCase(), tipo: "simple", icon: "fa-tag" });
    input.value = "";
    renderServicios();
    toast("statusRegistrar", "success", `Servicio agregado: ${name.toUpperCase()}`);
  });

  // Guardar evento
  document.getElementById("guardarEventoBtn").addEventListener("click", async () => {
    document.getElementById("descargarContratoBtn").disabled = true;
    lastSaved = null;

    const validation = validarFormularioCompleto();
    if (!validation.ok) {
      toast("statusRegistrar", "error", validation.message);
      return;
    }

    const payload = construirPayloadEvento();
    toast("statusRegistrar", "info", "Guardando en Google Sheets...");

    try {
      const res = await apiJsonp("registrarEvento", payload);
      if (res.status === "success") {
        lastSaved = { ...payload, id: res.id, fecha_registro: res.fecha_registro };
        toast("statusRegistrar", "success", "Guardado correctamente. Ya puede descargar el contrato.");
        document.getElementById("descargarContratoBtn").disabled = false;
        await cargarEventosYActualizarTodo();
      } else {
        toast("statusRegistrar", "error", res.message || "No se pudo guardar.");
      }
    } catch (err) {
      toast("statusRegistrar", "error", `Error de conexión: ${err.message}`);
    }
  });



  // Descargar contrato
  document.getElementById("descargarContratoBtn").addEventListener("click", () => {
    const validation = validarFormularioCompleto();
    if (!validation.ok) {
      toast("statusRegistrar", "error", validation.message);
      return;
    }
    if (!lastSaved) {
      toast("statusRegistrar", "warning", "Primero guarde el evento antes de descargar el contrato.");
      return;
    }
    generarPDFContrato(lastSaved);
  });

  // Historial filtros
  document.getElementById("aplicarFiltrosBtn").addEventListener("click", () => renderHistorial());
  document.getElementById("limpiarFiltrosBtn").addEventListener("click", () => {
    document.getElementById("filtroCategoria").value = "";
    document.getElementById("filtroMes").value = "";
    document.getElementById("filtroAnio").value = "";
    renderHistorial();
  });
  document.getElementById("exportarBtn").addEventListener("click", () => exportarHistorialCSV());

  // Config
  document.getElementById("btnProbarConexion").addEventListener("click", async () => {
    toast("statusConfig", "info", "Probando conexión...");
    try {
      const res = await apiJsonp("getServicios", {});
      if (res.status === "success") {
        toast("statusConfig", "success", "Conexión OK. Servicios obtenidos correctamente.");
      } else {
        toast("statusConfig", "error", res.message || "Conexión fallida.");
      }
    } catch (err) {
      toast("statusConfig", "error", `Error: ${err.message}`);
    }
  });

  document.getElementById("btnInitDB").addEventListener("click", async () => {
    toast("statusConfig", "info", "Inicializando base de datos...");
    try {
      const res = await apiJsonp("iniciarBaseDatos", {});
      if (res.status === "success") {
        toast("statusConfig", "success", res.message || "Base iniciada.");
        await cargarEventosYActualizarTodo();
      } else {
        toast("statusConfig", "error", res.message || "No se pudo iniciar.");
      }
    } catch (err) {
      toast("statusConfig", "error", `Error: ${err.message}`);
    }
  });

  // Modal cerrar
  // Modal cerrar
  document.getElementById("modalCloseBtn").addEventListener("click", () => cerrarModal());
  document.getElementById("modalCerrarBtn").addEventListener("click", () => cerrarModal());
  
  // Cerrar modal con click fuera del contenido
  document.getElementById("modalEventoDetalle").addEventListener("click", (e) => {
    if (e.target.id === "modalEventoDetalle") {
      cerrarModal();
    }
  });

  // Cerrar modal con tecla ESC
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      cerrarModal();
    }
  });

  // Toggle estado en modal
  document.getElementById("modalToggleEstadoBtn").addEventListener("click", () => {
    if (!selectedEventId) return;
    toggleEstadoEvento(selectedEventId);
  });
}

// ==============================================
// VALIDACIÓN + PAYLOAD
// ==============================================
function validarFormularioCompleto() {
  const nombre = (document.getElementById("i_nombre").value || "").trim();
  const celular = onlyDigits(document.getElementById("i_celular").value || "");
  const dni = onlyDigits(document.getElementById("i_dni").value || "");
  const categoria = document.getElementById("e_categoria").value || "";
  const categoriaOtro = (document.getElementById("e_categoria_otro").value || "").trim();

  const fechaEvento = (document.getElementById("e_fecha_text").value || "").trim();
  const entregaFecha = (document.getElementById("e_entrega_fecha_text").value || "").trim();
  const entregaHora = document.getElementById("e_entrega_hora").value || "";
  const finFecha = (document.getElementById("e_fin_fecha_text").value || "").trim();
  const finHora = document.getElementById("e_fin_hora").value || "";

  const garantiaPrecio = (document.getElementById("g_precio").value || "").trim();
  const garantiaDias = document.getElementById("g_dias").value;
  const adelantoPrecio = (document.getElementById("adelanto_precio").value || "").trim();

  if (!nombre) return { ok: false, message: "Ingrese nombres y apellidos completos." };
  if (!celular) return { ok: false, message: "Ingrese celular." };
  if (!/^\d+$/.test(celular)) return { ok: false, message: "Celular: solo dígitos." };

  if (!dni) return { ok: false, message: "Ingrese DNI." };
  if (dni.length !== 8) return { ok: false, message: "DNI: debe tener exactamente 8 dígitos." };

  if (!categoria) return { ok: false, message: "Seleccione categoría del evento." };
  if (categoria === "OTRO" && !categoriaOtro) return { ok: false, message: "Si categoría es OTRO, debe escribir el nombre del evento." };

  if (!isValidDMY(fechaEvento)) return { ok: false, message: "Fecha del evento inválida. Use dd/mm/aaaa." };
  if (!isValidDMY(entregaFecha)) return { ok: false, message: "Fecha de entrega inválida. Use dd/mm/aaaa." };
  if (!entregaHora) return { ok: false, message: "Ingrese hora de entrega." };
  if (!isValidDMY(finFecha)) return { ok: false, message: "Fecha de finalización inválida. Use dd/mm/aaaa." };
  if (!finHora) return { ok: false, message: "Ingrese hora de finalización." };

  const selected = getServiciosSeleccionados();
  if (selected.length === 0) return { ok: false, message: "Debe seleccionar al menos 1 servicio a alquilar." };

  const incompletos = selected.filter(s => s.incompleto);
  if (incompletos.length > 0) {
    return { ok: false, message: `Complete el costo/unidades del servicio: ${incompletos[0].nombre}.` };
  }

  if (!adelantoPrecio || adelantoPrecio === "") return { ok: false, message: "Ingrese el monto de adelanto." };
  if (!isFinite(parseFloat(adelantoPrecio.replace(",", ".")))) return { ok: false, message: "Adelanto inválido." };

  if (garantiaPrecio === "") return { ok: false, message: "Ingrese depósito de garantía (puede ser 0)." };
  if (!isFinite(parseFloat(garantiaPrecio.replace(",", ".")))) return { ok: false, message: "Depósito de garantía inválido." };
  if (!["0","1","2","3"].includes(String(garantiaDias))) return { ok: false, message: "Seleccione días de devolución." };

  const total = calcularTotal();
  if (!isFinite(total)) return { ok: false, message: "Total inválido. Revise costos." };

  return { ok: true, message: "OK" };
}

function construirPayloadEvento() {
  const categoria = document.getElementById("e_categoria").value;
  const categoriaOtro = (document.getElementById("e_categoria_otro").value || "").trim();
  const categoriaFinal = (categoria === "OTRO" ? categoriaOtro : categoria);

  const selected = getServiciosSeleccionados().map(s => ({
    id: s.id,
    nombre: s.nombre,
    tipo: s.tipo,
    precio: s.precio,
    unidades: s.unidades,
    costo_unidad: s.costo_unidad,
    total: s.total
  }));

  const total = calcularTotal();

  return {
    nombre: (document.getElementById("i_nombre").value || "").trim(),
    celular: onlyDigits(document.getElementById("i_celular").value || ""),
    dni: onlyDigits(document.getElementById("i_dni").value || ""),
    categoria: categoriaFinal,
    fecha_evento: (document.getElementById("e_fecha_text").value || "").trim(),
    entrega_fecha: (document.getElementById("e_entrega_fecha_text").value || "").trim(),
    entrega_hora: document.getElementById("e_entrega_hora").value || "",
    fin_fecha: (document.getElementById("e_fin_fecha_text").value || "").trim(),
    fin_hora: document.getElementById("e_fin_hora").value || "",
    servicios_json: JSON.stringify(selected),
    total_alquiler: total.toFixed(2),
    adelanto_precio: normalizeDecimal(document.getElementById("adelanto_precio").value || "0"),
    garantia_precio: normalizeDecimal(document.getElementById("g_precio").value || "0"),
    garantia_dias: String(document.getElementById("g_dias").value || "0")
  };
}

// Continúa en Parte 2...
// ==============================================
// SCRIPT_2.JS - PARTE 2
// ==============================================

// ==============================================
// SERVICIOS - CÁLCULO
// ==============================================
function getServiciosSeleccionados() {
  const out = [];

  servicios.forEach(s => {
    if (s.tipo === "simple") {
      const pEl = document.getElementById(`precio_${s.id}`);
      const pRaw = (pEl?.value || "").trim();
      
      // Solo incluir si tiene valor y no es 0
      if (pRaw && pRaw !== "0" && pRaw !== "0.00") {
        const p = parseFloat(pRaw.replace(",", "."));
        out.push({
          id: s.id,
          nombre: s.nombre,
          tipo: s.tipo,
          precio: isFinite(p) ? p : 0,
          unidades: "",
          costo_unidad: "",
          total: isFinite(p) ? p : 0,
          incompleto: false
        });
      }
    } else {
      const uEl = document.getElementById(`uni_${s.id}`);
      const cEl = document.getElementById(`cpu_${s.id}`);
      const tEl = document.getElementById(`tot_${s.id}`);

      const uRaw = (uEl?.value || "").trim();
      const cRaw = (cEl?.value || "").trim();

      // Solo incluir si ambos tienen valor y no son 0
      if (uRaw && uRaw !== "0" && cRaw && cRaw !== "0" && cRaw !== "0.00") {
        const u = parseFloat(uRaw || "0");
        const c = parseFloat((cRaw || "0").replace(",", "."));
        const t = parseFloat((tEl?.value || "0").replace(",", "."));

        out.push({
          id: s.id,
          nombre: s.nombre,
          tipo: s.tipo,
          precio: "",
          unidades: isFinite(u) ? u : 0,
          costo_unidad: isFinite(c) ? c : 0,
          total: isFinite(t) ? t : 0,
          incompleto: false
        });
      }
    }
  });

  return out;
}

function calcularTotal() {
  const selected = getServiciosSeleccionados();
  return selected.reduce((sum, s) => sum + (parseFloat(s.total) || 0), 0);
}

function recalcularTotal() {
  const total = calcularTotal();
  document.getElementById("totalAlquiler").textContent = `S/ ${total.toFixed(2)}`;
}

function cargarCategoriasEnFiltro() {
  const filtro = document.getElementById("filtroCategoria");
  const categorias = [
    "CUMPLEAÑOS","BABY SHOWER","GRADUACIÓN","ARTISTICO","SOCIAL",
    "CORPORATIVO","ANNIVERSARIO","DEPORTIVO"
  ];
  categorias.forEach(c => {
    const opt = new Option(c, c);
    filtro.add(opt);
  });
}

// ==============================================
// DATA LOAD
// ==============================================
async function cargarEventosYActualizarTodo() {
  toast("statusDashboard", "info", "Cargando eventos...");
  toast("statusHistorial", "info", "Cargando eventos...");

  try {
    const res = await apiJsonp("getEventos", {});
    if (res.status === "success") {
      eventos = res.data || [];
      toast("statusDashboard", "success", `Eventos cargados: ${eventos.length}`);
      toast("statusHistorial", "success", `Eventos cargados: ${eventos.length}`);
      
      // Cargar pagos
      await cargarPagos();
      
      actualizarDashboard();
      renderHistorial();
      renderCalendario();
      return;
    }
    toast("statusDashboard", "error", res.message || "No se pudo cargar.");
    toast("statusHistorial", "error", res.message || "No se pudo cargar.");
  } catch (err) {
    toast("statusDashboard", "error", `Error: ${err.message}`);
    toast("statusHistorial", "error", `Error: ${err.message}`);
  }
}

async function cargarPagos() {
  try {
    const res = await apiJsonp("getPagos", {});
    if (res.status === "success") {
      pagos = res.data || [];
    }
  } catch (err) {
    console.error("Error al cargar pagos:", err);
  }
}

// ==============================================
// DASHBOARD
// ==============================================
function actualizarDashboard() {
  const anioSelect = document.getElementById("dashboardAnioSelect");
  const anioSeleccionado = anioSelect.value ? parseInt(anioSelect.value) : new Date().getFullYear();

  // Filtrar eventos del año seleccionado
  const eventosFiltrados = eventos.filter(e => {
    const d = dmyToDate(e.fecha_evento);
    return d && d.getFullYear() === anioSeleccionado;
  });

  // Filtrar solo eventos finalizados para ingresos reales
  const hoy = stripTime(new Date());
  const eventosFinalizados = eventosFiltrados.filter(e => {
    const d = dmyToDate(e.fecha_evento);
    return d && d <= hoy;
  });

  renderChartIngresosMensuales(eventosFiltrados, anioSeleccionado);
  renderChartCategoriaDona(eventosFiltrados);
  renderFlujoCaja(eventosFinalizados, anioSeleccionado);
  renderIngresosListado(eventosFiltrados);
  renderEgresosListado(anioSeleccionado);
}

function renderChartIngresosMensuales(eventosFiltrados, anio) {
  const ctx = document.getElementById("chartIngresosMensuales").getContext("2d");

  // Agrupar por mes
  const dataMeses = Array(12).fill(0).map(() => ({ ingresos: 0, eventos: 0 }));
  
  eventosFiltrados.forEach(e => {
    const d = dmyToDate(e.fecha_evento);
    if (!d) return;
    const mes = d.getMonth();
    dataMeses[mes].ingresos += parseFloat(e.total_alquiler) || 0;
    dataMeses[mes].eventos += 1;
  });

  const labels = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
  const ingresos = dataMeses.map(m => m.ingresos);
  const numEventos = dataMeses.map(m => m.eventos);

  if (charts.ingresosMensuales) charts.ingresosMensuales.destroy();
  
  charts.ingresosMensuales = new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: [{
        label: "Ingresos (S/.)",
        data: ingresos,
        backgroundColor: "rgba(90,215,255,0.7)",
        borderColor: "rgba(90,215,255,1)",
        borderWidth: 1
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        title: { display: true, text: `Ingresos Mensuales - ${anio}` },
        tooltip: {
          callbacks: {
            afterLabel: function(context) {
              const index = context.dataIndex;
              return `Eventos: ${numEventos[index]}`;
            }
          }
        }
      },
      scales: {
        y: { 
          beginAtZero: true,
          title: { display: true, text: "Soles (S/.)" }
        }
      }
    }
  });
}

function renderChartCategoriaDona(eventosFiltrados) {
  const ctx = document.getElementById("chartCategoriaDona").getContext("2d");

  const map = {};
  eventosFiltrados.forEach(e => {
    const c = (e.categoria || "SIN CATEGORÍA").toUpperCase();
    map[c] = (map[c] || 0) + 1;
  });

  const labels = Object.keys(map);
  const values = Object.values(map);

  // Calcular porcentajes
  const total = values.reduce((a, b) => a + b, 0);
  const percentages = values.map(v => total > 0 ? ((v / total) * 100).toFixed(1) : 0);

  if (charts.categoriaDona) charts.categoriaDona.destroy();
  
  charts.categoriaDona = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: labels.map((l, i) => `${l} (${percentages[i]}%)`),
      datasets: [{
        data: values,
        backgroundColor: [
          "rgba(124,92,255,0.8)",
          "rgba(90,215,255,0.8)",
          "rgba(62,224,143,0.8)",
          "rgba(255,176,32,0.8)",
          "rgba(255,92,122,0.8)",
          "rgba(168,85,247,0.8)",
          "rgba(34,197,94,0.8)",
          "rgba(251,191,36,0.8)"
        ]
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        title: { display: true, text: "Distribución por Categoría (%)" },
        legend: { position: "bottom" }
      }
    }
  });
}

function renderFlujoCaja(eventosFinalizados, anio) {
  const totalIngresos = eventosFinalizados.reduce((sum, e) => sum + (parseFloat(e.total_alquiler) || 0), 0);
  
  // Calcular egresos del año
  const pagosFiltrados = pagos.filter(p => parseInt(p.anio) === anio);
  const totalEgresos = pagosFiltrados.reduce((sum, p) => {
    const servicios = parseFloat(p.total_servicios) || 0;
    const mejoras = parseFloat(p.total_mejoras) || 0;
    const arreglos = parseFloat(p.total_arreglos) || 0;
    return sum + servicios + mejoras + arreglos;
  }, 0);

  const saldo = totalIngresos - totalEgresos;

  document.getElementById("flujoCajaIngresos").textContent = `S/ ${totalIngresos.toFixed(2)}`;
  document.getElementById("flujoCajaEgresos").textContent = `S/ ${totalEgresos.toFixed(2)}`;
  document.getElementById("flujoCajaSaldo").textContent = `S/ ${saldo.toFixed(2)}`;
}

function renderIngresosListado(eventosFiltrados) {
  const container = document.getElementById("ingresosListado");
  
  const dataMeses = Array(12).fill(0);
  eventosFiltrados.forEach(e => {
    const d = dmyToDate(e.fecha_evento);
    if (!d) return;
    const mes = d.getMonth();
    dataMeses[mes] += parseFloat(e.total_alquiler) || 0;
  });

  const meses = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
  
  container.innerHTML = dataMeses.map((val, i) => `
    <div class="monthly-item">
      <span>${meses[i]}</span>
      <span>S/ ${val.toFixed(2)}</span>
    </div>
  `).join("");
}

function renderEgresosListado(anio) {
  const container = document.getElementById("egresosListado");
  
  const dataMeses = Array(12).fill(0);
  const pagosFiltrados = pagos.filter(p => parseInt(p.anio) === anio);
  
  pagosFiltrados.forEach(p => {
    const mes = parseInt(p.mes) - 1;
    if (mes >= 0 && mes < 12) {
      const total = (parseFloat(p.total_servicios) || 0) + 
                    (parseFloat(p.total_mejoras) || 0) + 
                    (parseFloat(p.total_arreglos) || 0);
      dataMeses[mes] += total;
    }
  });

  const meses = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
  
  container.innerHTML = dataMeses.map((val, i) => `
    <div class="monthly-item">
      <span>${meses[i]}</span>
      <span>S/ ${val.toFixed(2)}</span>
    </div>
  `).join("");
}

// ==============================================
// CALENDARIO
// ==============================================
function setupCalendario() {
  const mesSelect = document.getElementById("calMesSelect");
  const anioSelect = document.getElementById("calAnioSelect");
  const prevBtn = document.getElementById("calPrevBtn");
  const nextBtn = document.getElementById("calNextBtn");

  // Llenar años
  const anioActual = new Date().getFullYear();
  for (let y = 2020; y <= anioActual + 3; y++) {
    anioSelect.add(new Option(String(y), String(y)));
  }
  anioSelect.value = String(currentCalendarYear);

  mesSelect.addEventListener("change", () => {
    if (mesSelect.value) {
      currentCalendarMonth = parseInt(mesSelect.value);
    } else {
      currentCalendarMonth = null;
    }
    renderCalendario();
  });

  anioSelect.addEventListener("change", () => {
    currentCalendarYear = parseInt(anioSelect.value);
    renderCalendario();
  });

  prevBtn.addEventListener("click", () => {
    if (currentCalendarMonth) {
      currentCalendarMonth--;
      if (currentCalendarMonth < 1) {
        currentCalendarMonth = 12;
        currentCalendarYear--;
      }
      mesSelect.value = String(currentCalendarMonth);
      anioSelect.value = String(currentCalendarYear);
    }
    renderCalendario();
  });

  nextBtn.addEventListener("click", () => {
    if (currentCalendarMonth) {
      currentCalendarMonth++;
      if (currentCalendarMonth > 12) {
        currentCalendarMonth = 1;
        currentCalendarYear++;
      }
      mesSelect.value = String(currentCalendarMonth);
      anioSelect.value = String(currentCalendarYear);
    }
    renderCalendario();
  });
}

function renderCalendario() {
  const container = document.getElementById("calendarsContainer");
  const currentText = document.getElementById("calendarCurrent");
  
  if (currentCalendarMonth) {
    const meses = ["","Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
    currentText.textContent = `${meses[currentCalendarMonth]} ${currentCalendarYear}`;
    container.className = "calendars-grid single";
    container.innerHTML = renderMonthCalendar(currentCalendarMonth, currentCalendarYear);
  } else {
    currentText.textContent = "Todos los meses";
    container.className = "calendars-grid";
    let html = "";
    for (let m = 1; m <= 12; m++) {
      html += renderMonthCalendar(m, currentCalendarYear);
    }
    container.innerHTML = html;
  }

  attachCalendarEventListeners();
}

function renderMonthCalendar(mes, anio) {
  const meses = ["","Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
  const primerDia = new Date(anio, mes - 1, 1);
  const ultimoDia = new Date(anio, mes, 0);
  const diasEnMes = ultimoDia.getDate();
  const diaSemanaInicio = primerDia.getDay(); // 0 = domingo

  const hoy = stripTime(new Date());

  // Encontrar eventos de este mes
  const eventosDelMes = eventos.filter(e => {
    const d = dmyToDate(e.fecha_evento);
    return d && d.getMonth() === mes - 1 && d.getFullYear() === anio;
  });

  let html = `
    <div class="month-calendar">
      <div class="month-title">${meses[mes]} ${anio}</div>
      <div class="calendar-grid">
        <div class="calendar-day-header">D</div>
        <div class="calendar-day-header">L</div>
        <div class="calendar-day-header">M</div>
        <div class="calendar-day-header">M</div>
        <div class="calendar-day-header">J</div>
        <div class="calendar-day-header">V</div>
        <div class="calendar-day-header">S</div>
  `;

  // Días vacíos antes del primer día
  for (let i = 0; i < diaSemanaInicio; i++) {
    html += `<div class="calendar-day empty"></div>`;
  }

  // Días del mes
  for (let dia = 1; dia <= diasEnMes; dia++) {
    const fechaActual = new Date(anio, mes - 1, dia);
    const isToday = fechaActual.getTime() === hoy.getTime();
    
    const eventosDelDia = eventosDelMes.filter(e => {
      const d = dmyToDate(e.fecha_evento);
      return d && d.getDate() === dia;
    });

    let classes = "calendar-day";
    if (isToday) classes += " today";

    if (eventosDelDia.length > 0) {
      const evento = eventosDelDia[0];
      const esFinalizado = fechaActual < hoy;
      classes += esFinalizado ? " finalizado" : " event";
      
      html += `
        <div class="${classes}" data-event-id="${evento.id}" data-date="${anio}-${mes}-${dia}">
          <div>${dia}</div>
          <div class="event-label">${escapeHtml(evento.categoria)}</div>
        </div>
      `;
    } else {
      html += `<div class="${classes}">${dia}</div>`;
    }
  }

  html += `</div></div>`;
  return html;
}

function attachCalendarEventListeners() {
  document.querySelectorAll(".calendar-day[data-event-id]").forEach(el => {
    el.addEventListener("click", () => {
      const eventId = el.dataset.eventId;
      mostrarDetalleEvento(eventId);
    });
  });
}

function mostrarDetalleEvento(eventId) {
  const evento = eventos.find(e => e.id === eventId);
  if (!evento) return;

  selectedEventId = eventId;

  document.getElementById("modalNombre").textContent = evento.nombre || "—";
  document.getElementById("modalCelular").textContent = evento.celular || "—";
  document.getElementById("modalCategoria").textContent = evento.categoria || "—";
  
  // Formatear hora de entrega
  let entregaHora = "—";
  if (evento.entrega_hora) {
    if (/^\d{1,2}:\d{2}$/.test(evento.entrega_hora)) {
      entregaHora = evento.entrega_hora;
    } else if (evento.entrega_hora.includes('T') && evento.entrega_hora.includes('Z')) {
      try {
        const fecha = new Date(evento.entrega_hora);
        const h = String(fecha.getUTCHours()).padStart(2, '0');
        const m = String(fecha.getUTCMinutes()).padStart(2, '0');
        entregaHora = `${h}:${m}`;
      } catch (e) {
        entregaHora = evento.entrega_hora;
      }
    } else {
      entregaHora = evento.entrega_hora;
    }
  }
  document.getElementById("modalEntregaHora").textContent = entregaHora;
  
  // Formatear hora de finalización
  let finHora = "—";
  if (evento.fin_hora) {
    if (/^\d{1,2}:\d{2}$/.test(evento.fin_hora)) {
      finHora = evento.fin_hora;
    } else if (evento.fin_hora.includes('T') && evento.fin_hora.includes('Z')) {
      try {
        const fecha = new Date(evento.fin_hora);
        const h = String(fecha.getUTCHours()).padStart(2, '0');
        const m = String(fecha.getUTCMinutes()).padStart(2, '0');
        finHora = `${h}:${m}`;
      } catch (e) {
        finHora = evento.fin_hora;
      }
    } else {
      finHora = evento.fin_hora;
    }
  }
  document.getElementById("modalFinHora").textContent = finHora;
  
  const finDia = evento.fin_fecha ? evento.fin_fecha.split("/").slice(0, 2).join("/") : "—";
  document.getElementById("modalFinDia").textContent = finDia;

  document.getElementById("modalEventoDetalle").classList.add("active");
}
function cerrarModal() {
  document.getElementById("modalEventoDetalle").classList.remove("active");
  selectedEventId = null;
}

async function toggleEstadoEvento(eventId) {
  // Esta función cambiaría el estado manualmente
  // Por simplicidad, aquí solo recargamos eventos
  toast("statusCalendario", "info", "Actualizando estado...");
  await cargarEventosYActualizarTodo();
  cerrarModal();
  toast("statusCalendario", "success", "Estado actualizado");
}

// Continúa en Parte 3...
// ==============================================
// SCRIPT_2.JS - PARTE 3 (FINAL)
// ==============================================

// ==============================================
// HISTORIAL
// ==============================================
function cargarAnios() {
  const anioActual = new Date().getFullYear();
  const filtroAnio = document.getElementById("filtroAnio");
  const dashAnio = document.getElementById("dashboardAnioSelect");
  const pagoAnio = document.getElementById("pago_anio");

  for (let y = 2020; y <= anioActual + 2; y++) {
    filtroAnio.add(new Option(String(y), String(y)));
    dashAnio.add(new Option(String(y), String(y)));
    pagoAnio.add(new Option(String(y), String(y)));
  }
  
  dashAnio.value = String(anioActual);
  pagoAnio.value = String(anioActual);
}

function renderHistorial() {
  const cat = document.getElementById("filtroCategoria").value;
  const mes = document.getElementById("filtroMes").value;
  const anio = document.getElementById("filtroAnio").value;

  let filtrados = [...eventos];

  if (cat) filtrados = filtrados.filter(e => (e.categoria || "").toUpperCase() === cat.toUpperCase());

  if (mes || anio) {
    filtrados = filtrados.filter(e => {
      const d = dmyToDate(e.fecha_evento);
      if (!d) return false;
      if (mes && (d.getMonth()+1) !== Number(mes)) return false;
      if (anio && d.getFullYear() !== Number(anio)) return false;
      return true;
    });
  }

  filtrados.sort((a,b) => (dmyToDate(b.fecha_evento) || 0) - (dmyToDate(a.fecha_evento) || 0));

  const tbody = document.getElementById("historialTableBody");

  if (filtrados.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8">No hay eventos con los filtros seleccionados.</td></tr>`;
  } else {
    tbody.innerHTML = filtrados.map(e => `
      <tr>
        <td>${escapeHtml(e.id || "").slice(0,8)}...</td>
        <td>${escapeHtml(e.nombre || "")}</td>
        <td>${escapeHtml(e.dni || "")}</td>
        <td>${escapeHtml(e.categoria || "")}</td>
        <td>${escapeHtml(e.fecha_evento || "")}</td>
        <td><b>S/ ${(parseFloat(e.total_alquiler)||0).toFixed(2)}</b></td>
        <td>${escapeHtml(e.fecha_registro || "")}</td>
        <td>
          <button class="btn ghost-btn" style="padding: 6px 10px; font-size: .85rem;" onclick="editarEvento('${e.id}')">
            <i class="fa-solid fa-edit"></i>
          </button>
          <button class="btn ghost-btn" style="padding: 6px 10px; font-size: .85rem;" onclick="eliminarEvento('${e.id}')">
            <i class="fa-solid fa-trash"></i>
          </button>
        </td>
      </tr>
    `).join("");
  }

  const totalMonto = filtrados.reduce((sum, e) => sum + (parseFloat(e.total_alquiler) || 0), 0);
  document.getElementById("totalEventosFiltrado").textContent = String(filtrados.length);
  document.getElementById("montoEventosFiltrado").textContent = `S/ ${totalMonto.toFixed(2)}`;
}

function exportarHistorialCSV() {
  const cat = document.getElementById("filtroCategoria").value;
  const mes = document.getElementById("filtroMes").value;
  const anio = document.getElementById("filtroAnio").value;

  let filtrados = [...eventos];
  if (cat) filtrados = filtrados.filter(e => (e.categoria || "").toUpperCase() === cat.toUpperCase());

  if (mes || anio) {
    filtrados = filtrados.filter(e => {
      const d = dmyToDate(e.fecha_evento);
      if (!d) return false;
      if (mes && (d.getMonth()+1) !== Number(mes)) return false;
      if (anio && d.getFullYear() !== Number(anio)) return false;
      return true;
    });
  }

  const headers = ["id","nombre","celular","dni","categoria","fecha_evento","entrega_fecha","entrega_hora","fin_fecha","fin_hora","total_alquiler","adelanto","garantia_precio","garantia_dias","fecha_registro"];
  const rows = filtrados.map(e => headers.map(h => csvEscape(e[h] ?? "")).join(","));
  const csv = [headers.join(","), ...rows].join("\n");

  downloadText(csv, "historial_eventos.csv", "text/csv;charset=utf-8;");
}

function csvEscape(v) {
  const s = String(v).replace(/"/g, '""');
  return `"${s}"`;
}

function downloadText(text, filename, mime) {
  const blob = new Blob([text], { type: mime });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

// Funciones globales para botones de historial
window.editarEvento = function(eventId) {
  toast("statusHistorial", "info", "Función de edición en desarrollo.");
  // Aquí podrías implementar lógica para editar
};

window.eliminarEvento = async function(eventId) {
  if (!confirm("¿Está seguro de eliminar este evento?")) return;
  
  toast("statusHistorial", "info", "Eliminando evento...");
  try {
    const res = await apiJsonp("eliminarEvento", { id: eventId });
    if (res.status === "success") {
      toast("statusHistorial", "success", "Evento eliminado correctamente.");
      await cargarEventosYActualizarTodo();
    } else {
      toast("statusHistorial", "error", res.message || "No se pudo eliminar.");
    }
  } catch (err) {
    toast("statusHistorial", "error", `Error: ${err.message}`);
  }
};

// ==============================================
// PAGOS Y MEJORAS
// ==============================================
function setupPagosYMejoras() {
  // Inputs de servicios
  const inputs = ["pago_luz", "pago_agua", "pago_limpieza", "pago_seguridad"];
  inputs.forEach(id => {
    const el = document.getElementById(id);
    el.addEventListener("input", () => {
      el.value = normalizeDecimal(el.value);
      calcularTotalesPagos();
    });
  });

  // Mejoras y arreglos
  document.getElementById("mejoras_costo").addEventListener("input", (e) => {
    e.target.value = normalizeDecimal(e.target.value);
    calcularTotalesPagos();
  });
  
  document.getElementById("arreglos_costo").addEventListener("input", (e) => {
    e.target.value = normalizeDecimal(e.target.value);
    calcularTotalesPagos();
  });

  // Agregar servicio extra
  document.getElementById("agregarServicioPagoBtn").addEventListener("click", () => {
    const nombre = document.getElementById("nuevoServicioPagoNombre").value.trim();
    const precio = document.getElementById("nuevoServicioPagoPrecio").value.trim();
    
    if (!nombre || !precio) {
      toast("statusPagos", "warning", "Complete nombre y precio del servicio.");
      return;
    }

    const container = document.getElementById("serviciosExtrasContainer");
    const div = document.createElement("div");
    div.className = "form-grid";
    div.style.marginTop = "10px";
    div.innerHTML = `
      <div class="form-group">
        <label>${escapeHtml(nombre)} (S/.)</label>
        <input type="text" class="pago-extra" inputmode="decimal" value="${escapeHtml(precio)}">
      </div>
    `;
    container.appendChild(div);

    const input = div.querySelector(".pago-extra");
    input.addEventListener("input", () => {
      input.value = normalizeDecimal(input.value);
      calcularTotalesPagos();
    });

    document.getElementById("nuevoServicioPagoNombre").value = "";
    document.getElementById("nuevoServicioPagoPrecio").value = "";
    
    calcularTotalesPagos();
  });

  // Guardar pago
  document.getElementById("guardarPagoBtn").addEventListener("click", async () => {
    const mes = document.getElementById("pago_mes").value;
    const anio = document.getElementById("pago_anio").value;

    if (!mes || !anio) {
      toast("statusPagos", "error", "Seleccione mes y año.");
      return;
    }

    const luz = parseFloat(document.getElementById("pago_luz").value.replace(",", ".") || "0");
    const agua = parseFloat(document.getElementById("pago_agua").value.replace(",", ".") || "0");
    const limpieza = parseFloat(document.getElementById("pago_limpieza").value.replace(",", ".") || "0");
    const seguridad = parseFloat(document.getElementById("pago_seguridad").value.replace(",", ".") || "0");

    // Servicios extras
    let extrasTotal = 0;
    document.querySelectorAll(".pago-extra").forEach(el => {
      extrasTotal += parseFloat(el.value.replace(",", ".") || "0");
    });

    const totalServicios = luz + agua + limpieza + seguridad + extrasTotal;

    const mejoras = parseFloat(document.getElementById("mejoras_costo").value.replace(",", ".") || "0");
    const mejorasDesc = document.getElementById("mejoras_desc").value.trim();
    
    const arreglos = parseFloat(document.getElementById("arreglos_costo").value.replace(",", ".") || "0");
    const arreglosDesc = document.getElementById("arreglos_desc").value.trim();

    const payload = {
      mes,
      anio,
      luz: luz.toFixed(2),
      agua: agua.toFixed(2),
      limpieza: limpieza.toFixed(2),
      seguridad: seguridad.toFixed(2),
      extras: extrasTotal.toFixed(2),
      total_servicios: totalServicios.toFixed(2),
      mejoras_costo: mejoras.toFixed(2),
      mejoras_desc: mejorasDesc,
      arreglos_costo: arreglos.toFixed(2),
      arreglos_desc: arreglosDesc,
      total_mejoras: mejoras.toFixed(2),
      total_arreglos: arreglos.toFixed(2)
    };

    toast("statusPagos", "info", "Guardando registro de pago...");

    try {
      const res = await apiJsonp("registrarPago", payload);
      if (res.status === "success") {
        toast("statusPagos", "success", "Pago registrado correctamente.");
        await cargarPagos();
        limpiarFormularioPagos();
      } else {
        toast("statusPagos", "error", res.message || "No se pudo guardar.");
      }
    } catch (err) {
      toast("statusPagos", "error", `Error: ${err.message}`);
    }
  });
}

function calcularTotalesPagos() {
  const luz = parseFloat(document.getElementById("pago_luz").value.replace(",", ".") || "0");
  const agua = parseFloat(document.getElementById("pago_agua").value.replace(",", ".") || "0");
  const limpieza = parseFloat(document.getElementById("pago_limpieza").value.replace(",", ".") || "0");
  const seguridad = parseFloat(document.getElementById("pago_seguridad").value.replace(",", ".") || "0");

  let extrasTotal = 0;
  document.querySelectorAll(".pago-extra").forEach(el => {
    extrasTotal += parseFloat(el.value.replace(",", ".") || "0");
  });

  const totalServicios = luz + agua + limpieza + seguridad + extrasTotal;

  const mejoras = parseFloat(document.getElementById("mejoras_costo").value.replace(",", ".") || "0");
  const arreglos = parseFloat(document.getElementById("arreglos_costo").value.replace(",", ".") || "0");

  const totalEgresos = totalServicios + mejoras + arreglos;

  document.getElementById("totalServicios").textContent = `S/ ${totalServicios.toFixed(2)}`;
  document.getElementById("totalMejoras").textContent = `S/ ${mejoras.toFixed(2)}`;
  document.getElementById("totalArreglos").textContent = `S/ ${arreglos.toFixed(2)}`;
  document.getElementById("totalEgresos").textContent = `S/ ${totalEgresos.toFixed(2)}`;
}

function limpiarFormularioPagos() {
  document.getElementById("pago_luz").value = "";
  document.getElementById("pago_agua").value = "";
  document.getElementById("pago_limpieza").value = "";
  document.getElementById("pago_seguridad").value = "";
  document.getElementById("mejoras_costo").value = "";
  document.getElementById("mejoras_desc").value = "";
  document.getElementById("arreglos_costo").value = "";
  document.getElementById("arreglos_desc").value = "";
  document.getElementById("serviciosExtrasContainer").innerHTML = "";
  calcularTotalesPagos();
}



// ==============================================
// PDF CONTRATO
// ==============================================
function generarPDFContrato(data) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: "pt", format: "a4" });

  const lines = buildContratoLines(data);

  const margin = 48;
  const maxWidth = 595 - margin*2;
  let y = 60;

  doc.setFont("times", "normal");
  doc.setFontSize(12);

  lines.forEach(par => {
    const wrapped = doc.splitTextToSize(par, maxWidth);
    wrapped.forEach(line => {
      if (y > 780) {
        doc.addPage();
        y = 60;
      }
      doc.text(line, margin, y);
      y += 16;
    });
    y += 10;
  });

  const safeName = (data.nombre || "ARRENDATARIO").toUpperCase().replace(/[^A-Z0-9]+/g, "_").slice(0, 30);
  const fecha = (data.fecha_evento || "00_00_0000").replace(/\//g, "_");
  doc.save(`CONTRATO_SALON_${fecha}_${safeName}.pdf`);
}

function buildContratoLines(d) {
  const arrendador = "AMALIA ARROYO REYES DE RAMOS";
  const arrendatario = (d.nombre || "").toUpperCase();

  const fechaEventoLarga = fechaLarga(d.fecha_evento);
  const entregaLarga = `${d.entrega_hora} del ${fechaLarga(d.entrega_fecha)}`;
  const finLarga = `${d.fin_hora} del ${fechaLarga(d.fin_fecha)}`;

  const total = (parseFloat(d.total_alquiler) || 0).toFixed(2);
  const totalLetras = numeroALetras(parseFloat(total));
  
  const adelanto = (parseFloat((d.adelanto_precio || "0").replace(",", ".")) || 0).toFixed(2);
  const adelantoLetras = numeroALetras(parseFloat(adelanto));
  
  const garantia = (parseFloat((d.garantia_precio || "0").replace(",", ".")) || 0).toFixed(2);
  const diasDev = String(d.garantia_dias || "0");

  const areas = construirAreasIncluidas(d.servicios_json);

  const hoy = new Date();
  const hoyDmy = `${String(hoy.getDate()).padStart(2,"0")}/${String(hoy.getMonth()+1).padStart(2,"0")}/${hoy.getFullYear()}`;
  const hoyLarga = fechaLarga(hoyDmy);

  return [
    "CONTRATO DE ARRENDAMIENTO DEL SALÓN",
    "",
    `ARRENDADOR: ${arrendador}`,
    `ARRENDATARIO: ${arrendatario}`,
    "",
    "Ambas partes acuerdan lo siguiente:",
    `1. OBJETO Y FECHA. El Arrendador cede al Arrendatario el salón para el evento ${d.categoria}, el día ${d.fecha_evento} (${fechaEventoLarga}).`,
    `2. HORARIO. El uso se autoriza desde las ${entregaLarga} hasta las ${finLarga}.`,
    `3. ÁREAS INCLUIDAS. El servicio incluye el uso del salón principal, baños${areas ? ", " + areas : ""}, cuya limpieza y cuidado final es responsabilidad del Arrendatario.`,
    `4. TARIFA. El costo total por el alquiler y uso de las instalaciones asciende a la suma de S/ ${total} (${totalLetras} soles). Para la confirmación definitiva de la reserva, se deberá abonar un adelanto no reembolsable de S/ ${adelanto} (${adelantoLetras} soles). El saldo restante deberá ser cancelado íntegramente antes de la finalización del evento.`,
    `5. DEPÓSITO DE GARANTÍA. Se requiere un depósito reembolsable de S/ ${garantia}. Será devuelto dentro de los ${diasDev} día/s hábil/es posteriores al evento, previa verificación de que no existen daños en el inmueble, mobiliario o instalaciones. Cualquier costo de reparación será deducido de este depósito.`,
    "6. RESPONSABILIDAD. El Arrendatario es responsable total por cualquier daño ocasionado al salón o sus áreas por él, sus proveedores o invitados, y se obliga a cubrir los costos de reparación inmediatamente.",
    "7. DOMICILIO. Para todo efecto legal, se fija como domicilio la ciudad de Comas, Lima, Perú.",
    "Se firman dos copias iguales, una para cada parte.",
    "",
    "________________________________________",
    "FIRMAS",
    "",
    "ARRENDADOR",
    "Nombre: _________________________",
    "DNI: _________________________",
    "Firma: _________________________",
    "",
    "ARRENDATARIO",
    "Nombre: _________________________",
    "DNI: _________________________",
    "Firma: _________________________",
    "",
    `Fecha: ${hoyDmy} (${hoyLarga})`,
  ];
}

function construirAreasIncluidas(serviciosJson) {
  let arr = [];
  try { arr = JSON.parse(serviciosJson || "[]"); } catch { arr = []; }

  const findBy = (name) => arr.find(x => (x.nombre || "").toUpperCase() === name);

  const items = [];

  const sillas = findBy("SILLAS");
  if (sillas && isFinite(parseFloat(sillas.unidades))) items.push(`${parseFloat(sillas.unidades)} sillas`);

  const mv = findBy("MESAS VERDES");
  if (mv && isFinite(parseFloat(mv.unidades))) items.push(`${parseFloat(mv.unidades)} mesas verdes`);

  const mb = findBy("MESAS BLANCAS");
  if (mb && isFinite(parseFloat(mb.unidades))) items.push(`${parseFloat(mb.unidades)} mesas blancas`);

  const cocina = findBy("COCINA");
  if (cocina) items.push("cocina");

  return items.join(", ");
}

function numeroALetras(num) {
  // Función básica para convertir números a letras (soles)
  if (num === 0) return "cero";
  
  const unidades = ["","uno","dos","tres","cuatro","cinco","seis","siete","ocho","nueve"];
  const decenas = ["","diez","veinte","treinta","cuarenta","cincuenta","sesenta","setenta","ochenta","noventa"];
  const especiales = ["diez","once","doce","trece","catorce","quince","dieciséis","diecisiete","dieciocho","diecinueve"];
  const centenas = ["","ciento","doscientos","trescientos","cuatrocientos","quinientos","seiscientos","setecientos","ochocientos","novecientos"];

  const entero = Math.floor(num);
  
  if (entero < 10) return unidades[entero];
  if (entero < 20) return especiales[entero - 10];
  if (entero < 100) {
    const d = Math.floor(entero / 10);
    const u = entero % 10;
    return decenas[d] + (u ? " y " + unidades[u] : "");
  }
  if (entero < 1000) {
    const c = Math.floor(entero / 100);
    const resto = entero % 100;
    return (entero === 100 ? "cien" : centenas[c]) + (resto ? " " + numeroALetras(resto) : "");
  }
  
  return String(entero); // Para números mayores, devolver el número
}

// ==============================================
// API JSONP
// ==============================================
function apiJsonp(action, params) {
  if (!SCRIPT_URL || SCRIPT_URL.includes("TU_WEB_APP_URL_AQUI")) {
    return Promise.reject(new Error("Configure SCRIPT_URL en SCRIPT_2.js (URL del Web App)."));
  }

  const cb = "cb_" + Math.random().toString(36).slice(2);
  const base = SCRIPT_URL.includes("?") ? SCRIPT_URL + "&" : SCRIPT_URL + "?";

  const query = new URLSearchParams({ action, callback: cb, ...params });
  const url = base + query.toString();

  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = url;

    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error("Timeout al conectar con Apps Script."));
    }, 15000);

    window[cb] = (data) => {
      cleanup();
      resolve(data);
    };

    script.onerror = () => {
      cleanup();
      reject(new Error("No se pudo cargar el endpoint (verifique URL / permisos)."));
    };

    function cleanup() {
      clearTimeout(timeout);
      if (script && script.parentNode) script.parentNode.removeChild(script);
      try { delete window[cb]; } catch { window[cb] = undefined; }
    }

    document.body.appendChild(script);
  });
}

// ==============================================
// HELPERS
// ==============================================
function toast(elId, type, msg) {
  const el = document.getElementById(elId);
  if (!el) return;
  el.className = `status-message ${type}`;
  el.style.display = "block";
  el.innerHTML = `<i class="fa-solid ${iconFor(type)}"></i> ${escapeHtml(msg)}`;

  if (type !== "error") {
    setTimeout(() => { el.style.display = "none"; }, 4500);
  }
}

function iconFor(type) {
  switch(type) {
    case "success": return "fa-circle-check";
    case "warning": return "fa-triangle-exclamation";
    case "error": return "fa-circle-xmark";
    default: return "fa-circle-info";
  }
}

function onlyDigits(s) { return String(s || "").replace(/\D+/g, ""); }

function normalizeDecimal(s) {
  s = String(s || "").replace(",", ".").replace(/[^0-9.]/g, "");
  const parts = s.split(".");
  if (parts.length <= 2) return s;
  return parts[0] + "." + parts.slice(1).join("");
}

function isValidDMY(dmy) {
  if (!/^\d{2}\/\d{2}\/\d{4}$/.test(dmy)) return false;
  const d = dmyToDate(dmy);
  if (!d) return false;
  const [dd, mm, yyyy] = dmy.split("/").map(Number);
  return d.getFullYear() === yyyy && (d.getMonth()+1) === mm && d.getDate() === dd;
}

function dmyToDate(dmy) {
  if (!dmy || !/^\d{2}\/\d{2}\/\d{4}$/.test(dmy)) return null;
  const [dd, mm, yyyy] = dmy.split("/").map(Number);
  const d = new Date(yyyy, mm-1, dd);
  if (!isFinite(d.getTime())) return null;
  return d;
}

function stripTime(d) {
  const x = new Date(d);
  x.setHours(0,0,0,0);
  return x;
}

function fechaLarga(dmy) {
  const d = dmyToDate(dmy);
  if (!d) return dmy;
  const meses = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];
  return `${d.getDate()} de ${meses[d.getMonth()]} de ${d.getFullYear()}`;
}

function escapeHtml(str) {
  return String(str ?? "")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

function cssId(id) {
  return String(id).replace(/[^A-Za-z0-9_]/g, "_");
}