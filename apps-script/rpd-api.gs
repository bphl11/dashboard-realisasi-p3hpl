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
const RPD_CLIENT_ID = "443412026871-pqoa9tskrfkaffp5u2ohjhtq1l0ds2r1.apps.googleusercontent.com"; // sama dengan frontend

// URL CSV DATA_APLIKASI yang saat ini dipakai Dashboard.
const SOURCE_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vShdaPwws12pkv75bkQJL9AYjuC_4xjvANknmsoT6HVmgKeQ2DJsLLm5QzbvlKQJeQvqNGzYALsOk5n/pub?gid=1473286966&single=true&output=csv";

const RPD_SHEETS = {
  RPD: "RPD P3HPL",
  USERS: "USERS",
  LOG: "RPD_LOG"
};

const RPD_HEADERS = [
  "ID_RPD","TAHUN","KODE_SUB_KOMPONEN","SUB_KOMPONEN","AKUN","ITEM_AKUN",
  "DETIL_AKUN","RINCIAN_ITEM","PAGU_DETIL","TW1","TW2","TW3","TW4","TOTAL_RPD",
  "JAN_M1","JAN_M2","JAN_M3","JAN_M4","FEB_M1","FEB_M2","FEB_M3","FEB_M4","MAR_M1","MAR_M2","MAR_M3","MAR_M4","APR_M1","APR_M2","APR_M3","APR_M4","MEI_M1","MEI_M2","MEI_M3","MEI_M4","JUN_M1","JUN_M2","JUN_M3","JUN_M4","JUL_M1","JUL_M2","JUL_M3","JUL_M4","AGU_M1","AGU_M2","AGU_M3","AGU_M4","SEP_M1","SEP_M2","SEP_M3","SEP_M4","OKT_M1","OKT_M2","OKT_M3","OKT_M4","NOV_M1","NOV_M2","NOV_M3","NOV_M4","DES_M1","DES_M2","DES_M3","DES_M4",
  "CATATAN","UPDATED_AT","UPDATED_BY"
];

const USER_HEADERS = ["EMAIL","NAMA","ROLE","AKTIF"];

function doPost(e) {
  try {
    const request = JSON.parse(e?.postData?.contents || "{}");
    const action = String(request.action || "").trim();

    if (action === "auth") return jsonOutput(authenticate_(request.id_token));
    if (action === "bootstrap") return jsonOutput(bootstrap_(request.id_token));
    if (action === "list") return jsonOutput(listRpd_(request.id_token));
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

function ensureRpdSchema_(sheet) {
  const lastColumn = Math.max(sheet.getLastColumn(), 1);
  let headers = sheet.getRange(1, 1, 1, lastColumn).getValues()[0]
    .map(v => String(v ?? "").trim().toUpperCase());

  // Tambahkan kolom baru di ujung sheet agar data lama tidak bergeser.
  // Ini membuat migrasi 48 minggu aman untuk record RPD yang sudah ada.
  const missing = RPD_HEADERS.filter(header => !headers.includes(header));
  if (missing.length) {
    const start = sheet.getLastColumn() + 1;
    sheet.getRange(1, start, 1, missing.length).setValues([missing]);
  }
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

function listRpd_(idToken) {
  const user = authenticate_(idToken);
  const ss = getSpreadsheet_();
  const sheet = ss.getSheetByName(RPD_SHEETS.RPD);
  if (!sheet) throw new Error("Sheet RPD belum dibuat.");
  ensureRpdSchema_(sheet);

  return {
    ok: true,
    user: user.user,
    rpd: readRpd_(sheet)
  };
}

function bootstrap_(idToken) {
  const user = authenticate_(idToken);
  const ss = getSpreadsheet_();

  const rpdSheet = ss.getSheetByName(RPD_SHEETS.RPD);
  if (!rpdSheet) throw new Error("Sheet RPD belum dibuat.");
  ensureRpdSchema_(rpdSheet);

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
  ensureRpdSchema_(sheet);
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];

  const index = headerIndex_(values[0]);
  return values.slice(1)
    .filter(row => row.some(cell => String(cell ?? "").trim() !== ""))
    .map(row => {
      const existingId = String(row[index.ID_RPD] || "").trim();
      const tahun = String(row[index.TAHUN] || "");
      const kodeSub = String(row[index.KODE_SUB_KOMPONEN] || "");
      const sub = String(row[index.SUB_KOMPONEN] || "");
      const akun = String(row[index.AKUN] || "");
      const item = String(row[index.ITEM_AKUN] || "");
      const detil = String(row[index.DETIL_AKUN] || "");
      const rincian = String(row[index.RINCIAN_ITEM] || "");
      const paguDetil = parseAmount_(row[index.PAGU_DETIL]);
      const generatedId = existingId || makeRpdId_(tahun, kodeSub, sub, akun, item, detil, rincian, paguDetil);

      const result = {
        id_rpd: generatedId,
        tahun,
        kode_sub_komponen: kodeSub,
        sub_komponen: sub,
        akun,
        item_akun: item,
        detil_akun: detil,
        rincian_item: rincian,
        pagu_detil: paguDetil,
        tw1: parseAmount_(row[index.TW1]),
        tw2: parseAmount_(row[index.TW2]),
        tw3: parseAmount_(row[index.TW3]),
        tw4: parseAmount_(row[index.TW4]),
        total_rpd: parseAmount_(row[index.TOTAL_RPD]),
        catatan: String(row[index.CATATAN] || ""),
        updated_at: row[index.UPDATED_AT] || "",
        updated_by: String(row[index.UPDATED_BY] || "")
      };

      result.jan_m1 = parseAmount_(row[index.JAN_M1]);
      result.jan_m2 = parseAmount_(row[index.JAN_M2]);
      result.jan_m3 = parseAmount_(row[index.JAN_M3]);
      result.jan_m4 = parseAmount_(row[index.JAN_M4]);
      result.feb_m1 = parseAmount_(row[index.FEB_M1]);
      result.feb_m2 = parseAmount_(row[index.FEB_M2]);
      result.feb_m3 = parseAmount_(row[index.FEB_M3]);
      result.feb_m4 = parseAmount_(row[index.FEB_M4]);
      result.mar_m1 = parseAmount_(row[index.MAR_M1]);
      result.mar_m2 = parseAmount_(row[index.MAR_M2]);
      result.mar_m3 = parseAmount_(row[index.MAR_M3]);
      result.mar_m4 = parseAmount_(row[index.MAR_M4]);
      result.apr_m1 = parseAmount_(row[index.APR_M1]);
      result.apr_m2 = parseAmount_(row[index.APR_M2]);
      result.apr_m3 = parseAmount_(row[index.APR_M3]);
      result.apr_m4 = parseAmount_(row[index.APR_M4]);
      result.mei_m1 = parseAmount_(row[index.MEI_M1]);
      result.mei_m2 = parseAmount_(row[index.MEI_M2]);
      result.mei_m3 = parseAmount_(row[index.MEI_M3]);
      result.mei_m4 = parseAmount_(row[index.MEI_M4]);
      result.jun_m1 = parseAmount_(row[index.JUN_M1]);
      result.jun_m2 = parseAmount_(row[index.JUN_M2]);
      result.jun_m3 = parseAmount_(row[index.JUN_M3]);
      result.jun_m4 = parseAmount_(row[index.JUN_M4]);
      result.jul_m1 = parseAmount_(row[index.JUL_M1]);
      result.jul_m2 = parseAmount_(row[index.JUL_M2]);
      result.jul_m3 = parseAmount_(row[index.JUL_M3]);
      result.jul_m4 = parseAmount_(row[index.JUL_M4]);
      result.agu_m1 = parseAmount_(row[index.AGU_M1]);
      result.agu_m2 = parseAmount_(row[index.AGU_M2]);
      result.agu_m3 = parseAmount_(row[index.AGU_M3]);
      result.agu_m4 = parseAmount_(row[index.AGU_M4]);
      result.sep_m1 = parseAmount_(row[index.SEP_M1]);
      result.sep_m2 = parseAmount_(row[index.SEP_M2]);
      result.sep_m3 = parseAmount_(row[index.SEP_M3]);
      result.sep_m4 = parseAmount_(row[index.SEP_M4]);
      result.okt_m1 = parseAmount_(row[index.OKT_M1]);
      result.okt_m2 = parseAmount_(row[index.OKT_M2]);
      result.okt_m3 = parseAmount_(row[index.OKT_M3]);
      result.okt_m4 = parseAmount_(row[index.OKT_M4]);
      result.nov_m1 = parseAmount_(row[index.NOV_M1]);
      result.nov_m2 = parseAmount_(row[index.NOV_M2]);
      result.nov_m3 = parseAmount_(row[index.NOV_M3]);
      result.nov_m4 = parseAmount_(row[index.NOV_M4]);
      result.des_m1 = parseAmount_(row[index.DES_M1]);
      result.des_m2 = parseAmount_(row[index.DES_M2]);
      result.des_m3 = parseAmount_(row[index.DES_M3]);
      result.des_m4 = parseAmount_(row[index.DES_M4]);
      return result;
    });
}
function saveRpd_(idToken, row) {
  const user = authenticate_(idToken).user;
  if (!row || !row.id_rpd) throw new Error("ID RPD tidak lengkap.");

  const ss = getSpreadsheet_();
  const sheet = ss.getSheetByName(RPD_SHEETS.RPD);
  if (!sheet) throw new Error("Sheet RPD belum dibuat.");
  ensureRpdSchema_(sheet);

  const index = headerIndex_(sheet.getRange(1,1,1,sheet.getLastColumn()).getValues()[0]);
  const pagu = parseAmount_(row.pagu_detil);

  const weeklyValues = {
    jan_m1: parseAmount_(row.jan_m1),
    jan_m2: parseAmount_(row.jan_m2),
    jan_m3: parseAmount_(row.jan_m3),
    jan_m4: parseAmount_(row.jan_m4),
    feb_m1: parseAmount_(row.feb_m1),
    feb_m2: parseAmount_(row.feb_m2),
    feb_m3: parseAmount_(row.feb_m3),
    feb_m4: parseAmount_(row.feb_m4),
    mar_m1: parseAmount_(row.mar_m1),
    mar_m2: parseAmount_(row.mar_m2),
    mar_m3: parseAmount_(row.mar_m3),
    mar_m4: parseAmount_(row.mar_m4),
    apr_m1: parseAmount_(row.apr_m1),
    apr_m2: parseAmount_(row.apr_m2),
    apr_m3: parseAmount_(row.apr_m3),
    apr_m4: parseAmount_(row.apr_m4),
    mei_m1: parseAmount_(row.mei_m1),
    mei_m2: parseAmount_(row.mei_m2),
    mei_m3: parseAmount_(row.mei_m3),
    mei_m4: parseAmount_(row.mei_m4),
    jun_m1: parseAmount_(row.jun_m1),
    jun_m2: parseAmount_(row.jun_m2),
    jun_m3: parseAmount_(row.jun_m3),
    jun_m4: parseAmount_(row.jun_m4),
    jul_m1: parseAmount_(row.jul_m1),
    jul_m2: parseAmount_(row.jul_m2),
    jul_m3: parseAmount_(row.jul_m3),
    jul_m4: parseAmount_(row.jul_m4),
    agu_m1: parseAmount_(row.agu_m1),
    agu_m2: parseAmount_(row.agu_m2),
    agu_m3: parseAmount_(row.agu_m3),
    agu_m4: parseAmount_(row.agu_m4),
    sep_m1: parseAmount_(row.sep_m1),
    sep_m2: parseAmount_(row.sep_m2),
    sep_m3: parseAmount_(row.sep_m3),
    sep_m4: parseAmount_(row.sep_m4),
    okt_m1: parseAmount_(row.okt_m1),
    okt_m2: parseAmount_(row.okt_m2),
    okt_m3: parseAmount_(row.okt_m3),
    okt_m4: parseAmount_(row.okt_m4),
    nov_m1: parseAmount_(row.nov_m1),
    nov_m2: parseAmount_(row.nov_m2),
    nov_m3: parseAmount_(row.nov_m3),
    nov_m4: parseAmount_(row.nov_m4),
    des_m1: parseAmount_(row.des_m1),
    des_m2: parseAmount_(row.des_m2),
    des_m3: parseAmount_(row.des_m3),
    des_m4: parseAmount_(row.des_m4)
  };
  const weekList = Object.values(weeklyValues);
  if (weekList.some(value => value < 0)) throw new Error("Nilai RPD mingguan tidak boleh negatif.");

  const tw1 = weekList.slice(0,12).reduce((a,b)=>a+b,0);
  const tw2 = weekList.slice(12,24).reduce((a,b)=>a+b,0);
  const tw3 = weekList.slice(24,36).reduce((a,b)=>a+b,0);
  const tw4 = weekList.slice(36,48).reduce((a,b)=>a+b,0);
  const total = tw1 + tw2 + tw3 + tw4;

  // Kompatibilitas: record lama yang belum mempunyai slot mingguan
  // tetap dapat diedit. Nilai TW lama akan dipertahankan sebagai
  // subtotal sampai operator memasukkan nilai mingguan.
  const legacyProvided = weekList.some(value => value > 0);
  if (!legacyProvided) {
    const legacy = [
      parseAmount_(row.tw1), parseAmount_(row.tw2),
      parseAmount_(row.tw3), parseAmount_(row.tw4)
    ];
    legacy.forEach((value,i) => {
      if (value > 0) {
        const firstIndex = i * 12;
        const key = Object.keys(weeklyValues)[firstIndex];
        weeklyValues[key] = value;
      }
    });
  }

  const finalWeeks = Object.values(weeklyValues);
  const finalTw1 = finalWeeks.slice(0,12).reduce((a,b)=>a+b,0);
  const finalTw2 = finalWeeks.slice(12,24).reduce((a,b)=>a+b,0);
  const finalTw3 = finalWeeks.slice(24,36).reduce((a,b)=>a+b,0);
  const finalTw4 = finalWeeks.slice(36,48).reduce((a,b)=>a+b,0);
  const finalTotal = finalTw1 + finalTw2 + finalTw3 + finalTw4;

  if (finalTotal > pagu) throw new Error("Total RPD 48 minggu melebihi Pagu Detil.");

  const now = new Date();
  const values = sheet.getDataRange().getValues();
  let targetRow = -1;
  let oldData = null;
  const requestedId = String(row.id_rpd || "").trim();

  for (let i = 1; i < values.length; i++) {
    const currentId = String(values[i][index.ID_RPD] || "").trim();
    const sameId = requestedId && currentId === requestedId;
    const sameIdentity =
      String(values[i][index.TAHUN] || "") === String(row.tahun || "") &&
      String(values[i][index.AKUN] || "").trim() === String(row.akun || "").trim() &&
      String(values[i][index.ITEM_AKUN] || "").trim() === String(row.item_akun || "").trim() &&
      String(values[i][index.DETIL_AKUN] || "").trim() === String(row.detil_akun || "").trim() &&
      String(values[i][index.RINCIAN_ITEM] || "").trim() === String(row.rincian_item || "").trim() &&
      Number(values[i][index.PAGU_DETIL] || 0) === Number(pagu || 0);

    if (sameId || (!currentId && sameIdentity)) {
      targetRow = i + 1;
      oldData = values[i].slice();
      break;
    }
  }

  const stableId = requestedId || makeRpdId_(row.tahun,row.kode_sub_komponen,row.sub_komponen,row.akun,row.item_akun,row.detil_akun,row.rincian_item,pagu);
  const record = {
    id_rpd: stableId,
    tahun: String(row.tahun || ""),
    kode_sub_komponen: String(row.kode_sub_komponen || ""),
    sub_komponen: String(row.sub_komponen || ""),
    akun: String(row.akun || ""),
    item_akun: String(row.item_akun || ""),
    detil_akun: String(row.detil_akun || ""),
    rincian_item: String(row.rincian_item || ""),
    pagu_detil: pagu,
    tw1: finalTw1, tw2: finalTw2, tw3: finalTw3, tw4: finalTw4,
    total_rpd: finalTotal,
    catatan: String(row.catatan || ""),
    updated_at: now,
    updated_by: user.email
  };

  const output = new Array(sheet.getLastColumn()).fill("");
  output[index.ID_RPD] = record.id_rpd;
  output[index.TAHUN] = record.tahun;
  output[index.KODE_SUB_KOMPONEN] = record.kode_sub_komponen;
  output[index.SUB_KOMPONEN] = record.sub_komponen;
  output[index.AKUN] = record.akun;
  output[index.ITEM_AKUN] = record.item_akun;
  output[index.DETIL_AKUN] = record.detil_akun;
  output[index.RINCIAN_ITEM] = record.rincian_item;
  output[index.PAGU_DETIL] = record.pagu_detil;
  output[index.TW1] = record.tw1;
  output[index.TW2] = record.tw2;
  output[index.TW3] = record.tw3;
  output[index.TW4] = record.tw4;
  output[index.TOTAL_RPD] = record.total_rpd;
  output[index.JAN_M1] = weeklyValues.jan_m1;
  output[index.JAN_M2] = weeklyValues.jan_m2;
  output[index.JAN_M3] = weeklyValues.jan_m3;
  output[index.JAN_M4] = weeklyValues.jan_m4;
  output[index.FEB_M1] = weeklyValues.feb_m1;
  output[index.FEB_M2] = weeklyValues.feb_m2;
  output[index.FEB_M3] = weeklyValues.feb_m3;
  output[index.FEB_M4] = weeklyValues.feb_m4;
  output[index.MAR_M1] = weeklyValues.mar_m1;
  output[index.MAR_M2] = weeklyValues.mar_m2;
  output[index.MAR_M3] = weeklyValues.mar_m3;
  output[index.MAR_M4] = weeklyValues.mar_m4;
  output[index.APR_M1] = weeklyValues.apr_m1;
  output[index.APR_M2] = weeklyValues.apr_m2;
  output[index.APR_M3] = weeklyValues.apr_m3;
  output[index.APR_M4] = weeklyValues.apr_m4;
  output[index.MEI_M1] = weeklyValues.mei_m1;
  output[index.MEI_M2] = weeklyValues.mei_m2;
  output[index.MEI_M3] = weeklyValues.mei_m3;
  output[index.MEI_M4] = weeklyValues.mei_m4;
  output[index.JUN_M1] = weeklyValues.jun_m1;
  output[index.JUN_M2] = weeklyValues.jun_m2;
  output[index.JUN_M3] = weeklyValues.jun_m3;
  output[index.JUN_M4] = weeklyValues.jun_m4;
  output[index.JUL_M1] = weeklyValues.jul_m1;
  output[index.JUL_M2] = weeklyValues.jul_m2;
  output[index.JUL_M3] = weeklyValues.jul_m3;
  output[index.JUL_M4] = weeklyValues.jul_m4;
  output[index.AGU_M1] = weeklyValues.agu_m1;
  output[index.AGU_M2] = weeklyValues.agu_m2;
  output[index.AGU_M3] = weeklyValues.agu_m3;
  output[index.AGU_M4] = weeklyValues.agu_m4;
  output[index.SEP_M1] = weeklyValues.sep_m1;
  output[index.SEP_M2] = weeklyValues.sep_m2;
  output[index.SEP_M3] = weeklyValues.sep_m3;
  output[index.SEP_M4] = weeklyValues.sep_m4;
  output[index.OKT_M1] = weeklyValues.okt_m1;
  output[index.OKT_M2] = weeklyValues.okt_m2;
  output[index.OKT_M3] = weeklyValues.okt_m3;
  output[index.OKT_M4] = weeklyValues.okt_m4;
  output[index.NOV_M1] = weeklyValues.nov_m1;
  output[index.NOV_M2] = weeklyValues.nov_m2;
  output[index.NOV_M3] = weeklyValues.nov_m3;
  output[index.NOV_M4] = weeklyValues.nov_m4;
  output[index.DES_M1] = weeklyValues.des_m1;
  output[index.DES_M2] = weeklyValues.des_m2;
  output[index.DES_M3] = weeklyValues.des_m3;
  output[index.DES_M4] = weeklyValues.des_m4;
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

  // Jangan membaca ulang seluruh sheet setelah save.
  // Client sudah mempunyai payload lengkap; response cukup satu record.
  return {
    ok: true,
    message: "RPD tersimpan.",
    data: record
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

function makeRpdId_(tahun, kodeSub, sub, akun, item, detil, rincian, paguDetil) {
  return [tahun, kodeSub, sub, akun, item, detil, rincian, paguDetil]
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
    const raw = String(value ?? "").trim().toUpperCase();
    const key = raw.replace(/[._-]/g, " ").replace(/\s+/g, " ");
    if (!key) return;

    // Simpan nama normalisasi utama.
    map[key] = i;

    // Penting untuk schema RPD 48 minggu:
    // header seperti JAN_M1 dinormalisasi menjadi JAN M1,
    // sedangkan kode internal menggunakan JAN_M1.
    // Simpan alias underscore agar keduanya menunjuk kolom yang sama.
    const underscoreKey = key.replace(/ /g, "_");
    if (underscoreKey) map[underscoreKey] = i;
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
