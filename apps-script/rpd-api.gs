// ============================================================
// GOOGLE APPS SCRIPT - RPD API
// ============================================================
// Spreadsheet harus memiliki sheet:
// 1. RPD
// 2. USERS
// 3. RPD_LOG
//
// Deployment:
// Execute as: Me
// Who has access: Anyone
//
// Setelah deploy, masukkan Web App URL ke RPD_CONFIG.RPD_API_URL.
// Untuk login Google, buat OAuth Client ID tipe Web application dan
// masukkan Client ID ke RPD_CONFIG.GOOGLE_CLIENT_ID.
// ============================================================

const RPD_SHEET_ID = "1HA8oG7ItA9r5Yf9NRQXNvzJp9qaVRZeAbcDK3gxQR88"; // isi Spreadsheet ID RPD
const RPD_CLIENT_ID = ""; // harus sama dengan GOOGLE_CLIENT_ID di frontend

// URL CSV DATA_APLIKASI yang saat ini dipakai Dashboard.
const SOURCE_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vShdaPwws12pkv75bkQJL9AYjuC_4xjvANknmsoT6HVmgKeQ2DJsLLm5QzbvlKQJeQvqNGzYALsOk5n/pub?gid=1473286966&single=true&output=csv";

const RPD_SHEETS = {
  RPD: "RPD",
  USERS: "USERS",
  LOG: "RPD_LOG"
};

const RPD_HEADERS = [
  "ID_RPD","TAHUN","KODE_SUB_KOMPONEN","SUB_KOMPONEN","AKUN","ITEM_AKUN",
  "DETIL_AKUN","PAGU_DETIL","TW1","TW2","TW3","TW4","TOTAL_RPD",
  "CATATAN","UPDATED_AT","UPDATED_BY"
];

const USER_HEADERS = ["EMAIL","NAMA","ROLE","AKTIF"];

function doPost(e) {
  try {
    const request = JSON.parse(e?.postData?.contents || "{}");
    const action = String(request.action || "").trim();

    if (action === "auth") return jsonOutput(authenticate_(request.id_token));
    if (action === "bootstrap") return jsonOutput(bootstrap_(request.id_token));
    if (action === "save") return jsonOutput(saveRpd_(request.id_token, request.row));

    return jsonOutput({ ok: false, message: "Action API tidak dikenal." });
  } catch (error) {
    console.error(error);
    return jsonOutput({ ok: false, message: error.message || "Kesalahan server." });
  }
}

function doGet() {
  return jsonOutput({ ok: true, service: "RPD API", version: "1.0.0" });
}

function jsonOutput(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function getSpreadsheet_() {
  if (!RPD_SHEET_ID) throw new Error("RPD_SHEET_ID belum diisi.");
  return SpreadsheetApp.openById(RPD_SHEET_ID);
}

function authenticate_(idToken) {
  const user = verifyGoogleToken_(idToken);
  const allowed = findAllowedUser_(user.email);

  if (!allowed || String(allowed.aktif).toUpperCase() !== "YA") {
    throw new Error("Email Google Anda belum terdaftar sebagai Operator RPD.");
  }

  return {
    ok: true,
    user: {
      email: user.email,
      name: allowed.nama || user.name || user.email,
      role: allowed.role || "OPERATOR",
      id_token: idToken
    }
  };
}

function verifyGoogleToken_(idToken) {
  if (!idToken) throw new Error("Token login Google tidak ditemukan.");
  if (!RPD_CLIENT_ID) throw new Error("RPD_CLIENT_ID belum diisi.");

  const url = "https://oauth2.googleapis.com/tokeninfo?id_token=" + encodeURIComponent(idToken);
  const response = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
  const code = response.getResponseCode();

  if (code !== 200) throw new Error("Token Google tidak valid atau sudah kedaluwarsa.");

  const data = JSON.parse(response.getContentText());
  if (String(data.aud || "") !== String(RPD_CLIENT_ID)) {
    throw new Error("Token Google bukan untuk aplikasi RPD ini.");
  }

  const email = String(data.email || "").trim().toLowerCase();
  const verified = String(data.email_verified || "").toLowerCase();

  if (!email || (verified !== "true" && verified !== "1")) {
    throw new Error("Email Google belum terverifikasi.");
  }

  return {
    email,
    name: data.name || ""
  };
}

function findAllowedUser_(email) {
  const sheet = getSpreadsheet_().getSheetByName(RPD_SHEETS.USERS);
  if (!sheet) throw new Error("Sheet USERS belum dibuat.");

  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return null;

  const index = headerIndex_(values[0]);
  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    const rowEmail = String(row[index.EMAIL] || "").trim().toLowerCase();
    if (rowEmail === email) {
      return {
        email: rowEmail,
        nama: row[index.NAMA] || "",
        role: row[index.ROLE] || "OPERATOR",
        aktif: row[index.AKTIF] || "TIDAK"
      };
    }
  }

  return null;
}

function bootstrap_(idToken) {
  const user = authenticate_(idToken);
  const ss = getSpreadsheet_();

  const rpdSheet = ss.getSheetByName(RPD_SHEETS.RPD);
  if (!rpdSheet) throw new Error("Sheet RPD belum dibuat.");

  const master = buildMasterFromDataAplikasi_();
  const rpd = readRpd_(rpdSheet);

  return {
    ok: true,
    user: user.user,
    master,
    rpd
  };
}

function buildMasterFromDataAplikasi_() {
  if (!SOURCE_CSV_URL) throw new Error("SOURCE_CSV_URL belum diisi.");

  const response = UrlFetchApp.fetch(SOURCE_CSV_URL, {
    muteHttpExceptions: true,
    followRedirects: true
  });

  if (response.getResponseCode() !== 200) {
    throw new Error("DATA_APLIKASI tidak dapat dibaca dari sumber CSV.");
  }

  const values = Utilities.parseCsv(response.getContentText());
  if (values.length < 2) return [];

  const context = detectHeader_(values);
  if (!context) throw new Error("Header DATA_APLIKASI tidak terdeteksi.");

  const out = [];
  const seen = {};

  for (let i = context.headerIndex + 1; i < values.length; i++) {
    const row = values[i];
    const subKomponen = headerValue_(row, context.map, ["Sub Komponen","Subkomponen","Nama Sub Komponen"]);
    const kodeSubKomponen = headerValue_(row, context.map, ["Kode Sub Komponen","KodeSubKomponen"]);
    const akun = headerValue_(row, context.map, ["Akun Belanja","Akun"]);
    const itemAkun = headerValue_(row, context.map, ["Item Akun","Item"]);
    const detilAkun = headerValue_(row, context.map, ["Detil Akun","Detail Akun","Detil"]);
    const pagu = parseAmount_(headerValue_(row, context.map, ["Pagu"]));
    const status = headerValue_(row, context.map, ["Status Pagu","Status"]);

    if (!subKomponen || !akun || !detilAkun || pagu <= 0) continue;
    if (/blok/i.test(String(status))) continue;

    const tahun = headerValue_(row, context.map, ["Tahun","Tahun Anggaran"]) || new Date().getFullYear();
    const id = makeRpdId_(tahun, kodeSubKomponen, subKomponen, akun, itemAkun, detilAkun);

    if (seen[id]) continue;
    seen[id] = true;

    out.push({
      id_rpd: id,
      tahun: String(tahun),
      kodeSubKomponen: kodeSubKomponen || "",
      subKomponen: subKomponen,
      akun: akun,
      itemAkun: itemAkun || "",
      detilAkun: detilAkun,
      pagu: pagu
    });
  }

  return out;
}

function readRpd_(sheet) {
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];

  const index = headerIndex_(values[0]);
  return values.slice(1).filter(row => row[index.ID_RPD]).map(row => ({
    id_rpd: String(row[index.ID_RPD]),
    tahun: String(row[index.TAHUN] || ""),
    kode_sub_komponen: String(row[index.KODE_SUB_KOMPONEN] || ""),
    sub_komponen: String(row[index.SUB_KOMPONEN] || ""),
    akun: String(row[index.AKUN] || ""),
    item_akun: String(row[index.ITEM_AKUN] || ""),
    detil_akun: String(row[index.DETIL_AKUN] || ""),
    pagu_detil: parseAmount_(row[index.PAGU_DETIL]),
    tw1: parseAmount_(row[index.TW1]),
    tw2: parseAmount_(row[index.TW2]),
    tw3: parseAmount_(row[index.TW3]),
    tw4: parseAmount_(row[index.TW4]),
    total_rpd: parseAmount_(row[index.TOTAL_RPD]),
    catatan: String(row[index.CATATAN] || ""),
    updated_at: row[index.UPDATED_AT] || "",
    updated_by: String(row[index.UPDATED_BY] || "")
  }));
}

function saveRpd_(idToken, row) {
  const user = authenticate_(idToken).user;
  if (!row || !row.id_rpd) throw new Error("ID RPD tidak lengkap.");

  const ss = getSpreadsheet_();
  const sheet = ss.getSheetByName(RPD_SHEETS.RPD);
  if (!sheet) throw new Error("Sheet RPD belum dibuat.");

  const index = headerIndex_(sheet.getRange(1,1,1,sheet.getLastColumn()).getValues()[0]);
  const pagu = parseAmount_(row.pagu_detil);
  const tw1 = parseAmount_(row.tw1);
  const tw2 = parseAmount_(row.tw2);
  const tw3 = parseAmount_(row.tw3);
  const tw4 = parseAmount_(row.tw4);
  const total = tw1 + tw2 + tw3 + tw4;

  if (total > pagu) throw new Error("Total RPD melebihi Pagu Detil.");

  const now = new Date();
  const values = sheet.getDataRange().getValues();
  let targetRow = -1;
  let oldData = null;

  for (let i = 1; i < values.length; i++) {
    if (String(values[i][index.ID_RPD] || "") === String(row.id_rpd)) {
      targetRow = i + 1;
      oldData = values[i].slice();
      break;
    }
  }

  const record = {
    id_rpd: String(row.id_rpd),
    tahun: String(row.tahun || ""),
    kode_sub_komponen: String(row.kode_sub_komponen || ""),
    sub_komponen: String(row.sub_komponen || ""),
    akun: String(row.akun || ""),
    item_akun: String(row.item_akun || ""),
    detil_akun: String(row.detil_akun || ""),
    pagu_detil: pagu,
    tw1, tw2, tw3, tw4,
    total_rpd: total,
    catatan: String(row.catatan || ""),
    updated_at: now,
    updated_by: user.email
  };

  const output = [];
  output[index.ID_RPD] = record.id_rpd;
  output[index.TAHUN] = record.tahun;
  output[index.KODE_SUB_KOMPONEN] = record.kode_sub_komponen;
  output[index.SUB_KOMPONEN] = record.sub_komponen;
  output[index.AKUN] = record.akun;
  output[index.ITEM_AKUN] = record.item_akun;
  output[index.DETIL_AKUN] = record.detil_akun;
  output[index.PAGU_DETIL] = record.pagu_detil;
  output[index.TW1] = record.tw1;
  output[index.TW2] = record.tw2;
  output[index.TW3] = record.tw3;
  output[index.TW4] = record.tw4;
  output[index.TOTAL_RPD] = record.total_rpd;
  output[index.CATATAN] = record.catatan;
  output[index.UPDATED_AT] = record.updated_at;
  output[index.UPDATED_BY] = record.updated_by;

  if (targetRow > 0) {
    sheet.getRange(targetRow, 1, 1, sheet.getLastColumn()).setValues([output]);
    writeLog_("UPDATE", record, oldData, user.email);
  } else {
    sheet.appendRow(output);
    writeLog_("INSERT", record, null, user.email);
  }

  return {
    ok: true,
    message: "RPD tersimpan.",
    data: readRpd_(sheet)
  };
}

function writeLog_(action, record, oldData, email) {
  const sheet = getSpreadsheet_().getSheetByName(RPD_SHEETS.LOG);
  if (!sheet) return;

  sheet.appendRow([
    new Date(),
    action,
    record.id_rpd,
    email,
    oldData ? JSON.stringify(oldData) : "",
    JSON.stringify(record)
  ]);
}

function makeRpdId_(tahun, kodeSub, sub, akun, item, detil) {
  return [tahun, kodeSub, sub, akun, item, detil]
    .map(normalizeKey_)
    .join("|");
}

function normalizeKey_(value) {
  return String(value ?? "")
    .trim().toUpperCase()
    .replace(/\s+/g, " ")
    .replace(/\|/g, "/");
}

function detectHeader_(values) {
  const max = Math.min(values.length, 10);
  for (let r = 0; r < max; r++) {
    const map = headerIndex_(values[r]);
    if (map.PAGU !== undefined &&
        (map.REALISASI !== undefined || map["JUMLAH REALISASI"] !== undefined) &&
        (map["SUB KOMPONEN"] !== undefined || map.SUBKOMPONEN !== undefined)) {
      return { headerIndex: r, map };
    }
  }
  return null;
}

function headerIndex_(headers) {
  const map = {};
  headers.forEach((value, i) => {
    const key = String(value ?? "").trim().toUpperCase().replace(/[._-]/g, " ").replace(/\s+/g, " ");
    if (key) map[key] = i;
  });

  // Alias yang dipakai internal.
  if (map["SUBKOMPONEN"] !== undefined && map["SUB KOMPONEN"] === undefined) {
    map["SUB KOMPONEN"] = map["SUBKOMPONEN"];
  }
  if (map["KODE SUBKOMPONEN"] !== undefined && map["KODE SUB KOMPONEN"] === undefined) {
    map["KODE SUB KOMPONEN"] = map["KODE SUBKOMPONEN"];
  }
  if (map["AKUN"] !== undefined && map["AKUN BELANJA"] === undefined) {
    map["AKUN BELANJA"] = map["AKUN"];
  }
  if (map["ITEM"] !== undefined && map["ITEM AKUN"] === undefined) {
    map["ITEM AKUN"] = map["ITEM"];
  }
  if (map["DETAIL AKUN"] !== undefined && map["DETIL AKUN"] === undefined) {
    map["DETIL AKUN"] = map["DETAIL AKUN"];
  }
  return map;
}

function headerValue_(row, map, aliases) {
  for (const alias of aliases) {
    const key = String(alias).trim().toUpperCase().replace(/[._-]/g, " ").replace(/\s+/g, " ");
    const idx = map[key];
    if (idx !== undefined) return String(row[idx] ?? "").trim();
  }
  return "";
}

function parseAmount_(value) {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  let text = String(value ?? "").trim();
  if (!text || text === "-") return 0;
  text = text.replace(/Rp/gi, "").replace(/[^0-9.,-]/g, "");
  // Anggaran biasanya rupiah bulat; hilangkan pemisah ribuan.
  text = text.replace(/[.,]/g, "");
  return Number(text) || 0;
}
