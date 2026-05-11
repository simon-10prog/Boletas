const SHEET_RAFFLES = "Rifas";
const SHEET_TICKETS = "Boletas";
const SHEET_SALES = "Ventas";

function doPost(e) {
  const body = JSON.parse(e.postData.contents || "{}");
  const action = body.action;

  try {
    let data;
    if (action === "listarRifas") data = listarRifas();
    if (action === "crearRifa") data = crearRifa(body);
    if (action === "obtenerBoletas") data = obtenerBoletas(body.rifaId);
    if (action === "venderBoleta") data = venderBoleta(body);
    if (action === "liberarBoleta") data = liberarBoleta(body);
    return jsonResponse({ ok: true, ...data });
  } catch (error) {
    return jsonResponse({ ok: false, error: error.message });
  }
}

function listarRifas() {
  const sheet = SpreadsheetApp.getActive().getSheetByName(SHEET_RAFFLES);
  const rows = valuesToObjects(sheet.getDataRange().getValues());
  return { raffles: rows };
}

function crearRifa(body) {
  const ss = SpreadsheetApp.getActive();
  const rafflesSheet = ss.getSheetByName(SHEET_RAFFLES);
  const ticketsSheet = ss.getSheetByName(SHEET_TICKETS);
  const rifaId = nextRaffleId(rafflesSheet);
  const now = new Date().toISOString();

  rafflesSheet.appendRow([rifaId, body.name, body.prize, body.drawDate, body.ticketPrice, "activa", now]);

  for (var i = 0; i < 100; i += 1) {
    ticketsSheet.appendRow([rifaId, Utilities.formatString("%02d", i), "libre", "", "", "", ""]);
  }

  return { rifaId: rifaId };
}

function obtenerBoletas(rifaId) {
  const sheet = SpreadsheetApp.getActive().getSheetByName(SHEET_TICKETS);
  const rows = valuesToObjects(sheet.getDataRange().getValues()).filter(function(row) {
    return row.rifa_id === rifaId;
  });
  return { tickets: rows };
}

function venderBoleta(body) {
  const lock = LockService.getScriptLock();
  lock.waitLock(5000);

  try {
    const ss = SpreadsheetApp.getActive();
    const ticketsSheet = ss.getSheetByName(SHEET_TICKETS);
    const salesSheet = ss.getSheetByName(SHEET_SALES);
    const data = ticketsSheet.getDataRange().getValues();
    const headers = data[0];
    const rows = data.slice(1);
    const rifaIndex = headers.indexOf("rifa_id");
    const numberIndex = headers.indexOf("numero");
    const statusIndex = headers.indexOf("estado");
    const buyerIndex = headers.indexOf("comprador");
    const phoneIndex = headers.indexOf("telefono");
    const soldAtIndex = headers.indexOf("vendido_en");
    const paidIndex = headers.indexOf("valor_pagado");

    for (var i = 0; i < rows.length; i += 1) {
      const row = rows[i];
      if (row[rifaIndex] === body.rifaId && row[numberIndex] === body.number) {
        if (row[statusIndex] === "vendido") throw new Error("La boleta ya fue vendida.");

        const sheetRow = i + 2;
        const now = new Date().toISOString();
        ticketsSheet.getRange(sheetRow, statusIndex + 1).setValue("vendido");
        ticketsSheet.getRange(sheetRow, buyerIndex + 1).setValue(body.buyer);
        ticketsSheet.getRange(sheetRow, phoneIndex + 1).setValue(body.phone || "");
        ticketsSheet.getRange(sheetRow, soldAtIndex + 1).setValue(now);
        ticketsSheet.getRange(sheetRow, paidIndex + 1).setValue(body.amountPaid || 0);

        salesSheet.appendRow([
          "VENTA-" + new Date().getTime(),
          body.rifaId,
          body.number,
          body.buyer,
          body.phone || "",
          body.amountPaid || 0,
          now,
          body.vendor || "principal"
        ]);

        return { success: true };
      }
    }

    throw new Error("Boleta no encontrada.");
  } finally {
    lock.releaseLock();
  }
}

function liberarBoleta(body) {
  const sheet = SpreadsheetApp.getActive().getSheetByName(SHEET_TICKETS);
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const rows = data.slice(1);
  const rifaIndex = headers.indexOf("rifa_id");
  const numberIndex = headers.indexOf("numero");
  const statusIndex = headers.indexOf("estado");
  const buyerIndex = headers.indexOf("comprador");
  const phoneIndex = headers.indexOf("telefono");
  const soldAtIndex = headers.indexOf("vendido_en");
  const paidIndex = headers.indexOf("valor_pagado");

  for (var i = 0; i < rows.length; i += 1) {
    const row = rows[i];
    if (row[rifaIndex] === body.rifaId && row[numberIndex] === body.number) {
      const sheetRow = i + 2;
      sheet.getRange(sheetRow, statusIndex + 1).setValue("libre");
      sheet.getRange(sheetRow, buyerIndex + 1).setValue("");
      sheet.getRange(sheetRow, phoneIndex + 1).setValue("");
      sheet.getRange(sheetRow, soldAtIndex + 1).setValue("");
      sheet.getRange(sheetRow, paidIndex + 1).setValue("");
      return { success: true };
    }
  }

  throw new Error("Boleta no encontrada.");
}

function nextRaffleId(sheet) {
  const values = sheet.getDataRange().getValues();
  if (values.length <= 1) return "RIFA001";
  return "RIFA" + Utilities.formatString("%03d", values.length);
}

function valuesToObjects(values) {
  const headers = values[0];
  return values.slice(1).map(function(row) {
    const item = {};
    headers.forEach(function(header, index) {
      item[header] = row[index];
    });
    return item;
  });
}

function jsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}
