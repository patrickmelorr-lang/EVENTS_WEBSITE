// ==============================================
// BACKEND (Google Apps Script) - SG_2.js v2.0
// Gestión y Cronograma de Eventos (Google Sheets)
// ==============================================

// ID DE TU HOJA DE CÁLCULO (REEMPLAZAR)
const SPREADSHEET_ID = "1kE95ncGe7X98cy5X1xovHeH72Tsh6O2naz7y-B81KmU";

// Hojas
const HOJA_EVENTOS = "EVENTOS";
const HOJA_SERVICIOS = "SERVICIOS_CATALOGO";
const HOJA_PAGOS = "PAGOS_MENSUALES";

// Encabezados
const EVENTOS_HEADERS = [
  "id",
  "nombre",
  "celular",
  "dni",
  "categoria",
  "fecha_evento",
  "entrega_fecha",
  "entrega_hora",
  "fin_fecha",
  "fin_hora",
  "servicios_json",
  "total_alquiler",
  "adelanto_precio",
  "garantia_precio",
  "garantia_dias",
  "fecha_registro"
];

const SERVICIOS_HEADERS = [
  "id",
  "nombre",
  "tipo",
  "activo",
  "fecha_registro"
];

const PAGOS_HEADERS = [
  "id",
  "mes",
  "anio",
  "luz",
  "agua",
  "limpieza",
  "seguridad",
  "extras",
  "total_servicios",
  "mejoras_costo",
  "mejoras_desc",
  "arreglos_costo",
  "arreglos_desc",
  "total_mejoras",
  "total_arreglos",
  "fecha_registro"
];

const SERVICIOS_DEFAULT = [
  { nombre: "LOCAL", tipo: "simple" },
  { nombre: "REFRIGERADORA", tipo: "simple" },
  { nombre: "COCINA", tipo: "simple" },
  { nombre: "SILLAS", tipo: "cantidad" },
  { nombre: "MESAS VERDES", tipo: "cantidad" },
  { nombre: "MESAS BLANCAS", tipo: "cantidad" }
];

// ==============================================
// Helpers
// ==============================================
function getSpreadsheet() {
  return SpreadsheetApp.openById(SPREADSHEET_ID);
}

function generateId() {
  return Utilities.getUuid();
}

function getOrCreateSheet(name, headers) {
  const ss = getSpreadsheet();
  let sheet = ss.getSheetByName(name);

  if (!sheet) {
    sheet = ss.insertSheet(name);
    if (headers && headers.length) {
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      sheet.getRange(1, 1, 1, headers.length)
        .setFontWeight("bold")
        .setBackground("#111827")
        .setFontColor("#ffffff");
    }
  }
  return sheet;
}

function parseDMY(dmy) {
  if (!dmy || !/^\d{2}\/\d{2}\/\d{4}$/.test(dmy)) return null;
  const parts = dmy.split("/").map(Number);
  const dd = parts[0], mm = parts[1], yyyy = parts[2];
  const d = new Date(yyyy, mm - 1, dd);
  if (!isFinite(d.getTime())) return null;
  if (d.getFullYear() !== yyyy || (d.getMonth()+1) !== mm || d.getDate() !== dd) return null;
  return d;
}

function safeNumber(x) {
  const v = parseFloat(String(x || "0").replace(",", "."));
  return isFinite(v) ? v : 0;
}

function outputResponse(result, callbackName) {
  if (callbackName) {
    const payload = `${callbackName}(${JSON.stringify(result)});`;
    return ContentService
      .createTextOutput(payload)
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService
    .createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

// ==============================================
// doGet - JSONP friendly
// ==============================================
function doGet(e) {
  const action = (e && e.parameter && e.parameter.action) ? e.parameter.action : "";
  const callback = (e && e.parameter) ? e.parameter.callback : "";

  try {
    let result;
    switch (action) {
      case "iniciarBaseDatos":
        result = iniciarBaseDatos();
        break;

      case "getEventos":
        result = getEventos();
        break;

      case "getServicios":
        result = getServiciosCatalogo();
        break;

      case "getPagos":
        result = getPagos();
        break;

      case "registrarEvento":
        result = registrarEvento(e.parameter);
        break;

      case "registrarPago":
        result = registrarPago(e.parameter);
        break;

      case "eliminarEvento":
        result = eliminarEvento(e.parameter);
        break;

      default:
        result = { status: "error", message: "Acción no válida" };
    }
    return outputResponse(result, callback);

  } catch (err) {
    return outputResponse({ status: "error", message: String(err) }, callback);
  }
}

// ==============================================
// INIT DB
// ==============================================
function iniciarBaseDatos() {
  try {
    getOrCreateSheet(HOJA_EVENTOS, EVENTOS_HEADERS);
    getOrCreateSheet(HOJA_SERVICIOS, SERVICIOS_HEADERS);
    getOrCreateSheet(HOJA_PAGOS, PAGOS_HEADERS);

    // Servicios default si no existen
    const sheetServ = getOrCreateSheet(HOJA_SERVICIOS, SERVICIOS_HEADERS);
    const data = sheetServ.getDataRange().getValues();

    if (data.length <= 1) {
      SERVICIOS_DEFAULT.forEach(s => {
        sheetServ.appendRow([
          generateId(),
          s.nombre,
          s.tipo,
          true,
          new Date()
        ]);
      });
    }

    return { status: "success", message: "Base de datos iniciada correctamente" };
  } catch (err) {
    return { status: "error", message: String(err) };
  }
}

// ==============================================
// GET SERVICIOS
// ==============================================
function getServiciosCatalogo() {
  const sheet = getOrCreateSheet(HOJA_SERVICIOS, SERVICIOS_HEADERS);
  const values = sheet.getDataRange().getValues();

  if (values.length <= 1) {
    iniciarBaseDatos();
    return getServiciosCatalogo();
  }

  const headers = values[0];
  const out = [];

  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    const obj = {};
    headers.forEach((h, idx) => obj[h] = row[idx]);
    out.push(obj);
  }

  return { status: "success", data: out };
}

// ==============================================
// GET EVENTOS
// ==============================================
function getEventos() {
  const sheet = getOrCreateSheet(HOJA_EVENTOS, EVENTOS_HEADERS);
  const values = sheet.getDataRange().getValues();

  if (values.length <= 1) return { status: "success", data: [] };

  const headers = values[0];
  const out = [];

  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    const obj = {};
    headers.forEach((h, idx) => {
      if (["fecha_evento","entrega_fecha","fin_fecha"].includes(h) && row[idx] instanceof Date) {
        obj[h] = Utilities.formatDate(row[idx], Session.getScriptTimeZone(), "dd/MM/yyyy");
      } else if (h === "fecha_registro" && row[idx] instanceof Date) {
        obj[h] = Utilities.formatDate(row[idx], Session.getScriptTimeZone(), "dd/MM/yyyy HH:mm");
      } else {
        obj[h] = row[idx];
      }
    });
    out.push(obj);
  }

  return { status: "success", data: out };
}

// ==============================================
// GET PAGOS
// ==============================================
function getPagos() {
  const sheet = getOrCreateSheet(HOJA_PAGOS, PAGOS_HEADERS);
  const values = sheet.getDataRange().getValues();

  if (values.length <= 1) return { status: "success", data: [] };

  const headers = values[0];
  const out = [];

  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    const obj = {};
    headers.forEach((h, idx) => {
      if (h === "fecha_registro" && row[idx] instanceof Date) {
        obj[h] = Utilities.formatDate(row[idx], Session.getScriptTimeZone(), "dd/MM/yyyy HH:mm");
      } else {
        obj[h] = row[idx];
      }
    });
    out.push(obj);
  }

  return { status: "success", data: out };
}

// ==============================================
// REGISTRAR EVENTO
// ==============================================
function registrarEvento(p) {
  const nombre = String(p.nombre || "").trim();
  const celular = String(p.celular || "").replace(/\D+/g, "");
  const dni = String(p.dni || "").replace(/\D+/g, "");
  const categoria = String(p.categoria || "").trim();

  const fecha_evento_txt = String(p.fecha_evento || "").trim();
  const entrega_fecha_txt = String(p.entrega_fecha || "").trim();
  const entrega_hora = String(p.entrega_hora || "").trim();
  const fin_fecha_txt = String(p.fin_fecha || "").trim();
  const fin_hora = String(p.fin_hora || "").trim();

  const servicios_json = String(p.servicios_json || "[]");
  const adelanto_precio = safeNumber(p.adelanto_precio);
  const garantia_precio = safeNumber(p.garantia_precio);
  const garantia_dias = String(p.garantia_dias || "0");

  if (!nombre) return { status: "error", message: "Nombre requerido" };
  if (!celular) return { status: "error", message: "Celular requerido" };
  if (!dni || dni.length !== 8) return { status: "error", message: "DNI inválido (8 dígitos)" };
  if (!categoria) return { status: "error", message: "Categoría requerida" };

  const fecha_evento = parseDMY(fecha_evento_txt);
  const entrega_fecha = parseDMY(entrega_fecha_txt);
  const fin_fecha = parseDMY(fin_fecha_txt);

  if (!fecha_evento) return { status: "error", message: "Fecha de evento inválida" };
  if (!entrega_fecha) return { status: "error", message: "Fecha de entrega inválida" };
  if (!fin_fecha) return { status: "error", message: "Fecha de finalización inválida" };
  if (!entrega_hora) return { status: "error", message: "Hora de entrega requerida" };
  if (!fin_hora) return { status: "error", message: "Hora de finalización requerida" };

  let serviciosArr = [];
  try {
    serviciosArr = JSON.parse(servicios_json);
    if (!Array.isArray(serviciosArr)) serviciosArr = [];
  } catch {
    serviciosArr = [];
  }
  if (serviciosArr.length === 0) return { status: "error", message: "Debe registrar al menos 1 servicio" };

  let total = 0;
  serviciosArr.forEach(s => {
    const t = safeNumber(s.total);
    total += t;
  });

  const total_alquiler = safeNumber(p.total_alquiler);
  const total_final = (Math.abs(total - total_alquiler) > 0.01) ? total : total_alquiler;

  const sheet = getOrCreateSheet(HOJA_EVENTOS, EVENTOS_HEADERS);
  const id = generateId();
  const now = new Date();

  const newRow = [
    id,
    nombre,
    celular,
    dni,
    categoria,
    fecha_evento,
    entrega_fecha,
    entrega_hora,
    fin_fecha,
    fin_hora,
    servicios_json,
    total_final,
    adelanto_precio,
    garantia_precio,
    garantia_dias,
    now
  ];

  sheet.appendRow(newRow);

  const lastRow = sheet.getLastRow();
  sheet.getRange(lastRow, EVENTOS_HEADERS.indexOf("fecha_evento")+1).setNumberFormat("dd/mm/yyyy");
  sheet.getRange(lastRow, EVENTOS_HEADERS.indexOf("entrega_fecha")+1).setNumberFormat("dd/mm/yyyy");
  sheet.getRange(lastRow, EVENTOS_HEADERS.indexOf("fin_fecha")+1).setNumberFormat("dd/mm/yyyy");
  sheet.getRange(lastRow, EVENTOS_HEADERS.indexOf("total_alquiler")+1).setNumberFormat('"S/ "#,##0.00');
  sheet.getRange(lastRow, EVENTOS_HEADERS.indexOf("adelanto_precio")+1).setNumberFormat('"S/ "#,##0.00');
  sheet.getRange(lastRow, EVENTOS_HEADERS.indexOf("garantia_precio")+1).setNumberFormat('"S/ "#,##0.00');
  sheet.getRange(lastRow, EVENTOS_HEADERS.indexOf("fecha_registro")+1).setNumberFormat("dd/mm/yyyy hh:mm");

  return {
    status: "success",
    message: "Evento registrado correctamente",
    id: id,
    fecha_registro: Utilities.formatDate(now, Session.getScriptTimeZone(), "dd/MM/yyyy HH:mm")
  };
}

// ==============================================
// REGISTRAR PAGO
// ==============================================
function registrarPago(p) {
  const mes = String(p.mes || "");
  const anio = String(p.anio || "");
  
  if (!mes || !anio) return { status: "error", message: "Mes y año requeridos" };

  const luz = safeNumber(p.luz);
  const agua = safeNumber(p.agua);
  const limpieza = safeNumber(p.limpieza);
  const seguridad = safeNumber(p.seguridad);
  const extras = safeNumber(p.extras);
  const total_servicios = safeNumber(p.total_servicios);
  
  const mejoras_costo = safeNumber(p.mejoras_costo);
  const mejoras_desc = String(p.mejoras_desc || "").trim();
  
  const arreglos_costo = safeNumber(p.arreglos_costo);
  const arreglos_desc = String(p.arreglos_desc || "").trim();
  
  const total_mejoras = safeNumber(p.total_mejoras);
  const total_arreglos = safeNumber(p.total_arreglos);

  const sheet = getOrCreateSheet(HOJA_PAGOS, PAGOS_HEADERS);
  const id = generateId();
  const now = new Date();

  const newRow = [
    id,
    mes,
    anio,
    luz,
    agua,
    limpieza,
    seguridad,
    extras,
    total_servicios,
    mejoras_costo,
    mejoras_desc,
    arreglos_costo,
    arreglos_desc,
    total_mejoras,
    total_arreglos,
    now
  ];

  sheet.appendRow(newRow);

  const lastRow = sheet.getLastRow();
  for (let col = 4; col <= 10; col++) {
    sheet.getRange(lastRow, col).setNumberFormat('"S/ "#,##0.00');
  }
  for (let col = 14; col <= 15; col++) {
    sheet.getRange(lastRow, col).setNumberFormat('"S/ "#,##0.00');
  }
  sheet.getRange(lastRow, PAGOS_HEADERS.indexOf("fecha_registro")+1).setNumberFormat("dd/mm/yyyy hh:mm");

  return {
    status: "success",
    message: "Pago registrado correctamente",
    id: id
  };
}

// ==============================================
// ELIMINAR EVENTO
// ==============================================
function eliminarEvento(p) {
  const id = String(p.id || "").trim();
  if (!id) return { status: "error", message: "ID requerido" };

  const sheet = getOrCreateSheet(HOJA_EVENTOS, EVENTOS_HEADERS);
  const values = sheet.getDataRange().getValues();

  for (let i = 1; i < values.length; i++) {
    if (values[i][0] === id) {
      sheet.deleteRow(i + 1);
      return { status: "success", message: "Evento eliminado correctamente" };
    }
  }

  return { status: "error", message: "Evento no encontrado" };
}