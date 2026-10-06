// ============================================================
// GOOGLE APPS SCRIPT - RPD API
// ============================================================
// Spreadsheet:
// 1. RPD P3HPL
// 2. USERS
// 3. RPD_LOG
// 4. REALISASI P3HPL  -> dibuat otomatis jika belum ada
// 5. REALISASI_LOG    -> dibuat otomatis jika belum ada
//
// Deployment:
// Execute as: Me
// Who has access: Anyone
// ============================================================

const RPD_SHEET_ID =
  "1HA8oG7ItA9r5Yf9NRQXNvzJp9qaVRZeAbcDK3gxQR88";

const RPD_CLIENT_ID =
  "443412026871-pqoa9tskrfkaffp5u2ohjhtq1l0ds2r1.apps.googleusercontent.com";

// ============================================================
// DATA_APLIKASI
// ============================================================

const SOURCE_CSV_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vShdaPwws12pkv75bkQJL9AYjuC_4xjvANknmsoT6HVmgKeQ2DJsLLm5QzbvlKQJeQvqNGzYALsOk5n/pub?gid=1473286966&single=true&output=csv";

const RPD_API_VERSION = "1.8.0";
const RPD_DATA_GENERATION = "RPD-CLEAN-20261002-01";
const RPD_GENERATION_PROPERTY = "RPD_DATA_GENERATION";

const RPD_SHEETS = {
  RPD: "RPD P3HPL",
  USERS: "USERS",
  LOG: "RPD_LOG",
  REALISASI: "REALISASI P3HPL",
  REALISASI_LOG: "REALISASI_LOG"
};

// ============================================================
// PERMANENT ID_ANGGARAN
// ============================================================
// Satu detil anggaran mempunyai ID yang tidak berubah saat Pagu,
// Volume, atau Harga direvisi. ID ini menjadi relasi resmi antara
// DATA_APLIKASI, INPUT_REALISASI dan modul turunan aplikasi.
// ============================================================

const ANGGARAN_ID_HEADER_ = "ID_ANGGARAN";
const ANGGARAN_ID_PREFIX_ = "ANG-";

function ensureAnggaranIdSchema_() {
  const ss = getSpreadsheet_();
  const sheet = ss.getSheetByName("DATA_APLIKASI");
  if (!sheet) throw new Error("Sheet DATA_APLIKASI tidak ditemukan.");

  let values = sheet.getDataRange().getValues();
  let headerRow = -1;
  let map = null;

  for (let r = 0; r < Math.min(values.length, 10); r++) {
    const candidate = headerIndex_(values[r]);
    if (
      candidate.PAGU !== undefined &&
      (candidate.SUB_KOMPONEN !== undefined || candidate.SUBKOMPONEN !== undefined)
    ) {
      headerRow = r;
      map = candidate;
      break;
    }
  }

  if (headerRow < 0) throw new Error("Header DATA_APLIKASI tidak ditemukan.");

  let idCol = map[ANGGARAN_ID_HEADER_] ?? map["ID ANGGARAN"];
  if (idCol === undefined) {
    idCol = sheet.getLastColumn();
    sheet.getRange(headerRow + 1, idCol + 1).setValue(ANGGARAN_ID_HEADER_);
    values = sheet.getDataRange().getValues();
    map = headerIndex_(values[headerRow]);
    idCol = map[ANGGARAN_ID_HEADER_] ?? map["ID ANGGARAN"];
  }

  if (idCol === undefined) throw new Error("Kolom ID_ANGGARAN tidak dapat dibuat.");

  const existingIds = new Set();
  const output = [];
  let changed = false;

  for (let i = headerRow + 1; i < values.length; i++) {
    const row = values[i] || [];
    const current = String(row[idCol] ?? "").trim();
    const hasData = row.some(v => String(v ?? "").trim() !== "");

    if (!hasData) {
      output.push([current]);
      continue;
    }

    const pagu = map.PAGU !== undefined ? parseAmount_(row[map.PAGU]) : 0;
    const sub = headerValue_(row, map, ["Sub Komponen", "Subkomponen", "Nama Sub Komponen"]);
    const akun = headerValue_(row, map, ["Akun Belanja", "Akun"]);
    const detil = headerValue_(row, map, ["Detil Akun", "Detail Akun", "Detil"]);
    const rincian = headerValue_(row, map, ["Rincian Item", "Rincian"]);
    const isBudgetDetail = pagu > 0 && Boolean(sub || akun || detil || rincian);

    let id = current;
    if (isBudgetDetail) {
      if (!id || existingIds.has(id)) {
        id = ANGGARAN_ID_PREFIX_ + Utilities.getUuid().replace(/-/g, "").toUpperCase();
        changed = true;
      }
      existingIds.add(id);
    }
    output.push([id]);
  }

  if (changed) {
    sheet.getRange(headerRow + 2, idCol + 1, output.length, 1).setValues(output);
    SpreadsheetApp.flush();
  }

  // Migrasikan ID_REALISASI yang masih memakai identitas lama
  // (termasuk format lama yang memasukkan Pagu) ke ID_ANGGARAN baru.
  // Ini menjaga transaksi lama tetap terhubung setelah migrasi.
  const legacyToPermanent = new Map();

  for (let i = headerRow + 1; i < values.length; i++) {
    const row = values[i] || [];
    const id = String(row[idCol] ?? "").trim();
    if (!id) continue;

    const tahun = headerValue_(row, map, ["Tahun", "Tahun Anggaran"]);
    const kodeSub = headerValue_(row, map, ["Kode Sub Komponen", "KodeSubKomponen"]);
    const sub = headerValue_(row, map, ["Sub Komponen", "Subkomponen", "Nama Sub Komponen"]);
    const akun = headerValue_(row, map, ["Akun Belanja", "Akun"]);
    const item = headerValue_(row, map, ["Item Akun", "Item"]);
    const detil = headerValue_(row, map, ["Detil Akun", "Detail Akun", "Detil"]);
    const rincian = headerValue_(row, map, ["Rincian Item", "Rincian"]);
    const pagu = parseAmount_(row[map.PAGU]);

    const stableLegacy = makeStableRpdId_(
      tahun, kodeSub, sub, akun, item, detil, rincian
    );
    const paguLegacy = makeRpdId_(
      tahun, kodeSub, sub, akun, item, detil, rincian, pagu
    );

    if (stableLegacy && stableLegacy !== id) legacyToPermanent.set(stableLegacy, id);
    if (paguLegacy && paguLegacy !== id) legacyToPermanent.set(paguLegacy, id);
  }

  if (legacyToPermanent.size) {
    const realisasiSheet = ss.getSheetByName(RPD_SHEETS.REALISASI);
    if (realisasiSheet) {
      ensureRealisasiSchema_(realisasiSheet);
      const realisasiValues = realisasiSheet.getDataRange().getValues();
      if (realisasiValues.length >= 2) {
        const realisasiIndex = realisasiHeaderIndex_(realisasiValues[0]);
        const realisasiIdCol = realisasiIndex.ID_ANGGARAN;
        if (realisasiIdCol !== undefined) {
          let realisasiChanged = false;
          const migrated = realisasiValues.slice(1).map(row => {
            const oldId = String(row[realisasiIdCol] ?? "").trim();
            const newId = legacyToPermanent.get(oldId);
            if (newId && newId !== oldId) {
              const next = row.slice();
              next[realisasiIdCol] = newId;
              realisasiChanged = true;
              return next;
            }
            return row;
          });

          if (realisasiChanged) {
            realisasiSheet
              .getRange(2, 1, migrated.length, realisasiValues[0].length)
              .setValues(migrated);
          }
        }
      }
    }
  }

  return { sheet, headerRow, idCol, changed, migrated: legacyToPermanent.size };
}


// ============================================================
// HEADER REALISASI
// ============================================================

const REALISASI_HEADERS = [
  "ID_REALISASI",
  "TAHUN",
  "ID_ANGGARAN",
  "KODE_SUB_KOMPONEN",
  "SUB_KOMPONEN",
  "AKUN",
  "ITEM_AKUN",
  "DETIL_AKUN",
  "RINCIAN_ITEM",
  "PAGU_DETIL",
  "BULAN_REALISASI",
  "NOMINAL_REALISASI",
  "KETERANGAN",
  "STATUS",
  "CREATED_AT",
  "CREATED_BY",
  "UPDATED_AT",
  "UPDATED_BY"
];

// ============================================================
// HEADER RPD
// ============================================================

const RPD_HEADERS = [
  "ID_RPD",
  "ID_ANGGARAN",
  "DATA_GENERATION",
  "TAHUN",
  "KODE_SUB_KOMPONEN",
  "SUB_KOMPONEN",
  "AKUN",
  "ITEM_AKUN",
  "DETIL_AKUN",
  "RINCIAN_ITEM",
  "PAGU_DETIL",
  "TW1",
  "TW2",
  "TW3",
  "TW4",
  "TOTAL_RPD",

  "JAN_M1",
  "JAN_M2",
  "JAN_M3",
  "JAN_M4",

  "FEB_M1",
  "FEB_M2",
  "FEB_M3",
  "FEB_M4",

  "MAR_M1",
  "MAR_M2",
  "MAR_M3",
  "MAR_M4",

  "APR_M1",
  "APR_M2",
  "APR_M3",
  "APR_M4",

  "MEI_M1",
  "MEI_M2",
  "MEI_M3",
  "MEI_M4",

  "JUN_M1",
  "JUN_M2",
  "JUN_M3",
  "JUN_M4",

  "JUL_M1",
  "JUL_M2",
  "JUL_M3",
  "JUL_M4",

  "AGU_M1",
  "AGU_M2",
  "AGU_M3",
  "AGU_M4",

  "SEP_M1",
  "SEP_M2",
  "SEP_M3",
  "SEP_M4",

  "OKT_M1",
  "OKT_M2",
  "OKT_M3",
  "OKT_M4",

  "NOV_M1",
  "NOV_M2",
  "NOV_M3",
  "NOV_M4",

  "DES_M1",
  "DES_M2",
  "DES_M3",
  "DES_M4",

  "CATATAN",
  "UPDATED_AT",
  "UPDATED_BY"
];

// ============================================================
// POST ROUTER
// ============================================================

function doPost(e) {
  try {
    const request = JSON.parse(
      e && e.postData && e.postData.contents
        ? e.postData.contents
        : "{}"
    );

    const action = String(request.action || "")
      .trim()
      .toLowerCase();

    // -----------------------------
    // RPD
    // -----------------------------

    if (action === "auth") {
      return jsonOutput(authenticate_(request.id_token));
    }

    if (action === "bootstrap") {
      return jsonOutput(
        bootstrap_(request.id_token)
      );
    }

    if (action === "list") {
      return jsonOutput(
        listRpd_(request.id_token)
      );
    }

    if (action === "save") {
      return jsonOutput(
        saveRpd_(
          request.id_token,
          request.row
        )
      );
    }

    // -----------------------------
        // -----------------------------
    // TU API v1.0
    // -----------------------------
    if (action === "tu_realisasi_save") { const lock=LockService.getScriptLock(); lock.waitLock(30000); try{return jsonOutput(tuRealisasiSave_(request.id_token,request));}finally{lock.releaseLock();} }
    if (action === "tu_realisasi_update") { const lock=LockService.getScriptLock(); lock.waitLock(30000); try{return jsonOutput(tuRealisasiUpdate_(request.id_token,request));}finally{lock.releaseLock();} }
    if (action === "tu_realisasi_delete") { const lock=LockService.getScriptLock(); lock.waitLock(30000); try{return jsonOutput(tuRealisasiDelete_(request.id_token,request));}finally{lock.releaseLock();} }
    if (action === "tu_rpd_save") { const lock=LockService.getScriptLock(); lock.waitLock(30000); try{return jsonOutput(tuRpdSave_(request.id_token,request));}finally{lock.releaseLock();} }
    if (action === "tu_revisi_save") { const lock=LockService.getScriptLock(); lock.waitLock(30000); try{return jsonOutput(tuRevisiSave_(request.id_token,request));}finally{lock.releaseLock();} }
    if (action === "tu_bootstrap") return jsonOutput(tuBootstrap_(request.id_token,request));
    if (action === "tu_realisasi_list") return jsonOutput(tuRealisasiList_(request.id_token,request));
    if (action === "tu_rpd_list") return jsonOutput(tuRpdList_(request.id_token,request));
    if (action === "tu_revisi_list") return jsonOutput(tuRevisiList_(request.id_token,request));
    if (action === "tu_monitoring") return jsonOutput(tuMonitoring_(request.id_token,request));

// INPUT REALISASI
    // -----------------------------

    if (action === "realisasi_bootstrap") {
      return jsonOutput(
        realisasiBootstrap_(
          request.id_token
        )
      );
    }

    if (action === "realisasi_list") {
      return jsonOutput(
        listRealisasi_(
          request.id_token
        )
      );
    }

    if (action === "realisasi_save") {
      // Serialisasi INSERT Realisasi agar dua klik/request paralel
      // tidak sama-sama melewati validasi total lalu keduanya appendRow().
      const lock = LockService.getScriptLock();
      lock.waitLock(30000);

      try {
        return jsonOutput(
          saveRealisasi_(
            request.id_token,
            request.row
          )
        );
      } finally {
        lock.releaseLock();
      }
    }

    if (action === "realisasi_update") {
      return jsonOutput(
        updateRealisasi_(
          request.id_token,
          request.row
        )
      );
    }

    if (action === "realisasi_delete") {
      return jsonOutput(
        deleteRealisasi_(
          request.id_token,
          request.row
        )
      );
    }

    // REVISI ANGGARAN
    // dry_run=true hanya memvalidasi draft dan TIDAK menulis DATA_APLIKASI.
    if (action === "apply_revisi") {
      return jsonOutput(
        applyRevisi_(request)
      );
    }

    // Dipakai Dashboard / Grafik / Monitoring / Laporan.
    // Endpoint ini hanya mengembalikan transaksi AKTIF.
    if (action === "realisasi_monitoring") {
      return jsonOutput(
        listRealisasiMonitoring_()
      );
    }

    return jsonOutput({
      ok: false,
      message:
        "Action API tidak dikenal: " + action
    });

  } catch (error) {

    console.error(error);

    return jsonOutput({
      ok: false,
      message:
        error && error.message
          ? error.message
          : "Kesalahan server."
    });
  }
}

// ============================================================
// GET / PING
// ============================================================

function doGet(e) {

  const action =
    e &&
    e.parameter &&
    e.parameter.action
      ? String(e.parameter.action)
          .trim()
          .toLowerCase()
      : "";

  // TU GET endpoints
  if (action === "tu_bootstrap") return jsonOutput(tuBootstrap_(e.parameter.id_token,e.parameter));
  if (action === "tu_realisasi_list") return jsonOutput(tuRealisasiList_(e.parameter.id_token,e.parameter));
  if (action === "tu_rpd_list") return jsonOutput(tuRpdList_(e.parameter.id_token,e.parameter));
  if (action === "tu_revisi_list") return jsonOutput(tuRevisiList_(e.parameter.id_token,e.parameter));
  if (action === "tu_monitoring") return jsonOutput(tuMonitoring_(e.parameter.id_token,e.parameter));

  if (action === "ping" || !action) {

    return jsonOutput({
      ok: true,
      service: "RPD API",
      version: RPD_API_VERSION,

      endpoints: [
        "auth",
        "bootstrap",
        "list",
        "save",
        "realisasi_bootstrap",
        "realisasi_list",
        "realisasi_save",
        "realisasi_update",
        "realisasi_monitoring",
        "realisasi_delete",
        "apply_revisi"
      ]
    });
  }

  return jsonOutput({
    ok: false,
    message:
      "Gunakan POST untuk endpoint API."
  });
}

// ============================================================
// ============================================================
// INPUT REALISASI BULANAN
// ============================================================
// ============================================================

function ensureRealisasiSchema_(sheet) {

  const lastColumn =
    Math.max(sheet.getLastColumn(), 1);

  const existing =
    sheet
      .getRange(
        1,
        1,
        1,
        lastColumn
      )
      .getValues()[0]
      .map(function (v) {
        return String(v || "")
          .trim()
          .toUpperCase();
      });

  const missing =
    REALISASI_HEADERS.filter(function (header) {
      return existing.indexOf(header) === -1;
    });

  if (!missing.length) return;

  const start =
    Math.max(sheet.getLastColumn(), 0) + 1;

  sheet
    .getRange(
      1,
      start,
      1,
      missing.length
    )
    .setValues([missing]);
}

// ============================================================
// SHEET REALISASI
// ============================================================

function getRealisasiSheet_() {

  const ss = getSpreadsheet_();

  let sheet =
    ss.getSheetByName(
      RPD_SHEETS.REALISASI
    );

  if (!sheet) {
    sheet =
      ss.insertSheet(
        RPD_SHEETS.REALISASI
      );
  }

  ensureRealisasiSchema_(sheet);

  return sheet;
}

// ============================================================
// LOG REALISASI
// ============================================================

function getRealisasiLogSheet_() {

  const ss = getSpreadsheet_();

  let sheet =
    ss.getSheetByName(
      RPD_SHEETS.REALISASI_LOG
    );

  if (!sheet) {

    sheet =
      ss.insertSheet(
        RPD_SHEETS.REALISASI_LOG
      );

    sheet
      .getRange(1, 1, 1, 7)
      .setValues([[
        "TIMESTAMP",
        "ACTION",
        "ID_REALISASI",
        "EMAIL",
        "OLD_DATA",
        "NEW_DATA",
        "KETERANGAN"
      ]]);
  }

  return sheet;
}

// ============================================================
// HEADER INDEX REALISASI
// ============================================================

function realisasiHeaderIndex_(headers) {

  const map = {};

  headers.forEach(function (value, i) {

    const key =
      String(value || "")
        .trim()
        .toUpperCase()
        .replace(/[._-]/g, " ")
        .replace(/\s+/g, " ");

    if (!key) return;

    map[key] = i;

    map[
      key.replace(/ /g, "_")
    ] = i;
  });

  return map;
}

// ============================================================
// MASTER KEY REALISASI
// ============================================================

function realisasiMasterKey_(row) {
  const explicitId = String(row.idAnggaran || row.id_anggaran || "").trim();
  return explicitId || makeStableRpdId_(
    row.tahun,
    row.kodeSubKomponen,
    row.subKomponen,
    row.akun,
    row.itemAkun,
    row.detilAkun,
    row.rincianItem
  );
}

// ============================================================
// MEMBACA MASTER DATA_APLIKASI
// ============================================================

// ============================================================
// CACHE MASTER REALISASI
// ============================================================
// Master DATA_APLIKASI adalah sumber referensi yang sama untuk
// semua request Realisasi. Cache hanya dipakai sebagai optimasi
// sementara; DATA_APLIKASI tetap menjadi source of truth.

const REALISASI_MASTER_CACHE_KEY = "p3hpl_realisasi_master_v1";
const REALISASI_MASTER_CACHE_TTL = 60;
const REALISASI_MASTER_CACHE_CHUNK = 80000;

function getCachedRealisasiMaster_() {
  try {
    const cache = CacheService.getScriptCache();
    const meta = cache.get(
      REALISASI_MASTER_CACHE_KEY + "_meta"
    );

    if (!meta) return null;

    const count = Number(meta);

    if (!Number.isInteger(count) || count < 1) {
      return null;
    }

    let encoded = "";

    for (let i = 0; i < count; i++) {
      const part = cache.get(
        REALISASI_MASTER_CACHE_KEY + "_" + i
      );

      if (!part) return null;
      encoded += part;
    }

    const bytes = Utilities.base64Decode(encoded);
    const json = Utilities
      .ungzip(Utilities.newBlob(bytes))
      .getDataAsString();

    const data = JSON.parse(json);

    return Array.isArray(data) ? data : null;
  } catch (error) {
    // Cache tidak boleh membuat API gagal.
    return null;
  }
}

function setCachedRealisasiMaster_(master) {
  try {
    const cache = CacheService.getScriptCache();
    const json = JSON.stringify(master || []);
    const blob = Utilities.gzip(
      Utilities.newBlob(json, "application/json")
    );
    const encoded = Utilities.base64Encode(
      blob.getBytes()
    );

    const parts = [];

    for (
      let i = 0;
      i < encoded.length;
      i += REALISASI_MASTER_CACHE_CHUNK
    ) {
      parts.push(
        encoded.substring(
          i,
          i + REALISASI_MASTER_CACHE_CHUNK
        )
      );
    }

    if (!parts.length) {
      return;
    }

    parts.forEach(function (part, i) {
      cache.put(
        REALISASI_MASTER_CACHE_KEY + "_" + i,
        part,
        REALISASI_MASTER_CACHE_TTL
      );
    });

    cache.put(
      REALISASI_MASTER_CACHE_KEY + "_meta",
      String(parts.length),
      REALISASI_MASTER_CACHE_TTL
    );
  } catch (error) {
    // Ukuran/kapasitas cache bukan alasan untuk menggagalkan request.
  }
}

function buildRealisasiMasterFromDataAplikasi_() {
  // Master cache adalah snapshot yang diinvalidasi setelah Revisi Anggaran.
  // Cek cache lebih dulu supaya setiap Save Realisasi tidak membaca
  // seluruh DATA_APLIKASI dan membangun ulang ID_ANGGARAN.
  const cached = getCachedRealisasiMaster_();

  if (cached) {
    return cached;
  }

  ensureAnggaranIdSchema_();

  // DATA_APLIKASI adalah source of truth untuk transaksi Realisasi.
  // Baca langsung Spreadsheet agar Pagu dan ID_ANGGARAN terbaru langsung
  // tersedia setelah Revisi, tanpa menunggu propagasi published CSV.
  const ss = getSpreadsheet_();
  const dataSheet = ss.getSheetByName("DATA_APLIKASI");

  if (!dataSheet) {
    throw new Error("Sheet DATA_APLIKASI tidak ditemukan.");
  }

  const values = dataSheet.getDataRange().getValues();

  const context = detectHeader_(values);

  if (!context) {
    throw new Error(
      "Header DATA_APLIKASI tidak terdeteksi."
    );
  }

  // ==========================================================
  // MEMBANGUN MASTER INPUT REALISASI
  // ==========================================================
  // DATA_APLIKASI dapat memiliki beberapa baris dengan
  // ID_ANGGARAN yang sama. PAGU tidak dijumlahkan, sedangkan
  // REALISASI dijumlahkan.

  const byId = {};

  // Resolve index header satu kali agar tidak melakukan lookup
  // alias berulang untuk setiap kolom pada setiap baris.
  function indexAlias(aliases) {
    for (const alias of aliases) {
      const key = String(alias)
        .trim()
        .toUpperCase()
        .replace(/[._-]/g, " ")
        .replace(/\s+/g, " ");

      if (context.map[key] !== undefined) {
        return context.map[key];
      }
    }

    return undefined;
  }

  const idx = {
    subKomponen: indexAlias([
      "Sub Komponen",
      "Subkomponen",
      "Nama Sub Komponen"
    ]),
    kodeSubKomponen: indexAlias([
      "Kode Sub Komponen",
      "KodeSubKomponen"
    ]),
    akun: indexAlias([
      "Akun Belanja",
      "Akun"
    ]),
    itemAkun: indexAlias([
      "Item Akun",
      "Item"
    ]),
    detilAkun: indexAlias([
      "Detil Akun",
      "Detail Akun",
      "Detil"
    ]),
    rincianItem: indexAlias([
      "Rincian Item",
      "Rincian"
    ]),
    idAnggaran: indexAlias([
      "ID_ANGGARAN",
      "ID ANGGARAN"
    ]),
    pagu: indexAlias(["Pagu"]),
    realisasi: indexAlias([
      "Realisasi",
      "Jumlah Realisasi"
    ]),
    status: indexAlias([
      "Status Pagu",
      "Status"
    ]),
    tahun: indexAlias([
      "Tahun",
      "Tahun Anggaran"
    ])
  };

  const bulanIndices = [
    "Januari",
    "Februari",
    "Maret",
    "April",
    "Mei",
    "Juni",
    "Juli",
    "Agustus",
    "September",
    "Oktober",
    "November",
    "Desember"
  ].map(function (bulan) {
    return indexAlias([bulan]);
  });

  for (
    let i = context.headerIndex + 1;
    i < values.length;
    i++
  ) {
    const row = values[i];

    const subKomponen =
      idx.subKomponen !== undefined
        ? String(row[idx.subKomponen] || "").trim()
        : "";

    const kodeSubKomponen =
      idx.kodeSubKomponen !== undefined
        ? String(row[idx.kodeSubKomponen] || "").trim()
        : "";

    const akun =
      idx.akun !== undefined
        ? String(row[idx.akun] || "").trim()
        : "";

    const itemAkun =
      idx.itemAkun !== undefined
        ? String(row[idx.itemAkun] || "").trim()
        : "";

    const detilAkun =
      idx.detilAkun !== undefined
        ? String(row[idx.detilAkun] || "").trim()
        : "";

    const rincianItem =
      idx.rincianItem !== undefined
        ? String(row[idx.rincianItem] || "").trim()
        : "";

    const idAnggaran =
      idx.idAnggaran !== undefined
        ? String(row[idx.idAnggaran] || "").trim()
        : "";

    const pagu =
      idx.pagu !== undefined
        ? parseAmount_(row[idx.pagu])
        : 0;

    if (!subKomponen || !akun || pagu <= 0) {
      continue;
    }

    const status =
      idx.status !== undefined
        ? String(row[idx.status] || "").trim()
        : "";

    if (/blok/i.test(status)) {
      continue;
    }

    const realisasiKolom =
      idx.realisasi !== undefined
        ? parseAmount_(row[idx.realisasi])
        : 0;

    let realisasiBulanan = 0;

    if (realisasiKolom <= 0) {
      for (let b = 0; b < bulanIndices.length; b++) {
        const bulanIndex = bulanIndices[b];

        if (bulanIndex !== undefined) {
          realisasiBulanan += parseAmount_(
            row[bulanIndex]
          );
        }
      }
    }

    const realisasi =
      realisasiKolom > 0
        ? realisasiKolom
        : realisasiBulanan;

    const tahun =
      idx.tahun !== undefined
        ? String(
            row[idx.tahun] || ""
          ).trim()
        : String(new Date().getFullYear());

    const item = {
      rowIndex: i,
      id_anggaran: idAnggaran || "",
      tahun: tahun,
      kodeSubKomponen: kodeSubKomponen,
      subKomponen: subKomponen,
      akun: akun,
      itemAkun: itemAkun,
      detilAkun: detilAkun,
      rincianItem: rincianItem,
      pagu: pagu,
      realisasi: realisasi
    };

    item.id_anggaran =
      realisasiMasterKey_(item);

    if (!byId[item.id_anggaran]) {
      byId[item.id_anggaran] = item;
    } else {
      byId[item.id_anggaran].realisasi += realisasi;
    }
  }

  const master = Object.values(byId);

  setCachedRealisasiMaster_(master);

  return master;
}

// ============================================================
// READ REALISASI
// ============================================================

function parseRealisasiValues_(values) {
  if (!values || values.length < 2) {
    return [];
  }

  const index =
    realisasiHeaderIndex_(
      values[0]
    );

  return values
    .slice(1)
    .filter(function (row) {
      return row.some(function (cell) {
        return String(cell || "").trim() !== "";
      });
    })
    .map(function (row) {
      return {
        id_realisasi:
          String(
            row[index.ID_REALISASI] || ""
          ),

        tahun:
          String(
            row[index.TAHUN] || ""
          ),

        id_anggaran:
          String(
            row[index.ID_ANGGARAN] ||
            row[index["ID ANGGARAN"]] ||
            ""
          ),

        kode_sub_komponen:
          String(
            row[index.KODE_SUB_KOMPONEN] ||
            row[index["KODE SUB KOMPONEN"]] ||
            ""
          ),

        sub_komponen:
          String(
            row[index.SUB_KOMPONEN] ||
            row[index["SUB KOMPONEN"]] ||
            ""
          ),

        akun:
          String(
            row[index.AKUN] || ""
          ),

        item_akun:
          String(
            row[index.ITEM_AKUN] ||
            row[index["ITEM AKUN"]] ||
            ""
          ),

        detil_akun:
          String(
            row[index.DETIL_AKUN] ||
            row[index["DETIL AKUN"]] ||
            ""
          ),

        rincian_item:
          String(
            row[index.RINCIAN_ITEM] ||
            row[index["RINCIAN ITEM"]] ||
            ""
          ),

        pagu_detil:
          parseAmount_(
            row[index.PAGU_DETIL]
          ),

        bulan:
          String(
            row[index.BULAN_REALISASI] ||
            row[index["BULAN REALISASI"]] ||
            ""
          ),

        nominal_realisasi:
          parseAmount_(
            row[index.NOMINAL_REALISASI] ||
            row[index["NOMINAL REALISASI"]]
          ),

        keterangan:
          String(
            row[index.KETERANGAN] || ""
          ),

        status:
          String(
            row[index.STATUS] || "AKTIF"
          ),

        created_at:
          row[index.CREATED_AT] || "",

        created_by:
          String(
            row[index.CREATED_BY] || ""
          ),

        updated_at:
          row[index.UPDATED_AT] || "",

        updated_by:
          String(
            row[index.UPDATED_BY] || ""
          )
      };
    });
}

function readRealisasi_(sheet) {
  ensureRealisasiSchema_(sheet);

  return parseRealisasiValues_(
    sheet.getDataRange().getValues()
  );
}

// Dipakai oleh UPDATE agar sheet cukup dibaca sekali.
function readRealisasiWithMeta_(sheet) {
  ensureRealisasiSchema_(sheet);

  const values =
    sheet.getDataRange().getValues();

  return {
    values: values,
    index:
      values.length
        ? realisasiHeaderIndex_(values[0])
        : {},
    realisasi:
      parseRealisasiValues_(values)
  };
}

// ============================================================
// REALISASI BOOTSTRAP
// ============================================================

function realisasiBootstrap_(idToken) {

  const auth =
    authenticate_(idToken);

  const master =
    buildRealisasiMasterFromDataAplikasi_();

  const realisasi =
    readRealisasi_(
      getRealisasiSheet_()
    );

  return {

    ok: true,

    user:
      auth.user,

    master:
      master,

    master_count:
      master.length,

    realisasi:
      realisasi,

    realisasi_count:
      realisasi.length,

    source:
      "DATA_APLIKASI"
  };
}

// ============================================================
// LIST REALISASI
// ============================================================

function listRealisasi_(idToken) {

  const auth =
    authenticate_(idToken);

  const realisasi =
    readRealisasi_(
      getRealisasiSheet_()
    );

  return {

    ok: true,

    user:
      auth.user,

    realisasi:
      realisasi,

    realisasi_count:
      realisasi.length
  };
}

// ============================================================
// NORMALISASI BULAN
// ============================================================

function normalisasiBulanRealisasi_(value) {

  const key =
    String(value || "")
      .trim()
      .toLowerCase();

  const bulan = {

    januari: "Januari",
    februari: "Februari",
    maret: "Maret",
    april: "April",
    mei: "Mei",
    juni: "Juni",
    juli: "Juli",
    agustus: "Agustus",
    september: "September",
    oktober: "Oktober",
    november: "November",
    desember: "Desember"

  };

  return bulan[key] || "";
}

// ============================================================
// SAVE REALISASI
// ============================================================

function saveRealisasi_(
  idToken,
  row
) {

  const auth =
    authenticate_(idToken);

  const user =
    auth.user;

  if (!row) {
    throw new Error(
      "Data realisasi tidak ditemukan."
    );
  }

  const bulan =
    normalisasiBulanRealisasi_(
      row.bulan_realisasi ||
      row.bulan
    );

  const nominal =
    parseAmount_(
      row.nominal_realisasi
    );

  const tahun =
    String(
      row.tahun || ""
    ).trim();

  const idAnggaran =
    String(
      row.id_anggaran || ""
    ).trim();

  if (!tahun) {
    throw new Error(
      "Tahun anggaran belum dipilih."
    );
  }

  if (!idAnggaran) {
    throw new Error(
      "Detil anggaran belum dipilih."
    );
  }

  if (!bulan) {
    throw new Error(
      "Bulan realisasi tidak valid."
    );
  }

  if (!(nominal > 0)) {
    throw new Error(
      "Nominal realisasi harus lebih besar dari 0."
    );
  }

  // Ambil master langsung dari DATA_APLIKASI
  const master =
    buildRealisasiMasterFromDataAplikasi_();

  const target =
    master.find(function (item) {

      return (
        item.id_anggaran ===
          idAnggaran &&
        item.tahun ===
          tahun
      );

    });

  if (!target) {

    throw new Error(
      "Detil anggaran tidak ditemukan pada DATA_APLIKASI."
    );
  }

  // Realisasi Dasar berasal dari DATA_APLIKASI.
  // Input Realisasi hanya boleh memakai sisa Pagu setelah Realisasi Dasar.
  const realisasiDasar =
    Number(target.realisasi) || 0;

  const danaTersediaInput =
    Math.max(
      Number(target.pagu) - realisasiDasar,
      0
    );

  const sheet =
    getRealisasiSheet_();

  const existing =
    readRealisasi_(sheet);

  const activeTotal =
    existing
      .filter(function (item) {

        return (
          item.id_anggaran ===
            idAnggaran &&
          item.tahun ===
            tahun &&
          String(
            item.status
          ).toUpperCase() ===
            "AKTIF"
        );

      })
      .reduce(
        function (sum, item) {

          return (
            sum +
            (
              Number(
                item.nominal_realisasi
              ) || 0
            )
          );

        },
        0
      );

  // Validasi Pagu:
  // Realisasi Final = Realisasi Dasar + seluruh Input Realisasi aktif.
  if (
    activeTotal + nominal >
    danaTersediaInput
  ) {

    throw new Error(
      "Total Realisasi Final akan melebihi Pagu Detil. " +
      "Pagu: " +
      target.pagu +
      ", Realisasi Dasar: " +
      realisasiDasar +
      ", sudah diinput: " +
      activeTotal +
      ", tambahan: " +
      nominal +
      ", sisa yang dapat diinput: " +
      danaTersediaInput +
      "."
    );
  }

  const now =
    new Date();

  const id =
    "REAL-" +
    Utilities.getUuid();

  const index =
    realisasiHeaderIndex_(
      sheet
        .getRange(
          1,
          1,
          1,
          sheet.getLastColumn()
        )
        .getValues()[0]
    );

  const output =
    new Array(
      sheet.getLastColumn()
    ).fill("");

  function setValue(
    name,
    value
  ) {

    const idx =
      index[name] !== undefined
        ? index[name]
        : index[
            name.replace(
              /_/g,
              " "
            )
          ];

    if (
      idx !== undefined
    ) {
      output[idx] =
        value;
    }
  }

  setValue(
    "ID_REALISASI",
    id
  );

  setValue(
    "TAHUN",
    tahun
  );

  setValue(
    "ID_ANGGARAN",
    idAnggaran
  );

  setValue(
    "KODE_SUB_KOMPONEN",
    target.kodeSubKomponen
  );

  setValue(
    "SUB_KOMPONEN",
    target.subKomponen
  );

  setValue(
    "AKUN",
    target.akun
  );

  setValue(
    "ITEM_AKUN",
    target.itemAkun
  );

  setValue(
    "DETIL_AKUN",
    target.detilAkun
  );

  setValue(
    "RINCIAN_ITEM",
    target.rincianItem
  );

  setValue(
    "PAGU_DETIL",
    target.pagu
  );

  setValue(
    "BULAN_REALISASI",
    bulan
  );

  setValue(
    "NOMINAL_REALISASI",
    nominal
  );

  setValue(
    "KETERANGAN",
    String(
      row.keterangan || ""
    ).trim()
  );

  setValue(
    "STATUS",
    "AKTIF"
  );

  setValue(
    "CREATED_AT",
    now
  );

  setValue(
    "CREATED_BY",
    user.email
  );

  setValue(
    "UPDATED_AT",
    now
  );

  setValue(
    "UPDATED_BY",
    user.email
  );

  sheet.appendRow(
    output
  );

  const record = {

    id_realisasi:
      id,

    tahun:
      tahun,

    id_anggaran:
      idAnggaran,

    kode_sub_komponen:
      target.kodeSubKomponen,

    sub_komponen:
      target.subKomponen,

    akun:
      target.akun,

    item_akun:
      target.itemAkun,

    detil_akun:
      target.detilAkun,

    rincian_item:
      target.rincianItem,

    pagu_detil:
      target.pagu,

    bulan:
      bulan,

    nominal_realisasi:
      nominal,

    keterangan:
      String(
        row.keterangan || ""
      ).trim(),

    status:
      "AKTIF",

    created_by:
      user.email
  };

  getRealisasiLogSheet_()
    .appendRow([

      now,

      "INSERT",

      id,

      user.email,

      "",

      JSON.stringify(
        record
      ),

      "Input realisasi bulanan"

    ]);

  return {

    ok: true,

    message:
      "Realisasi berhasil disimpan.",

    user: {
      email:
        user.email,

      name:
        user.name ||
        user.email,

      role:
        user.role ||
        "OPERATOR"
    },

    data:
      record,

    pagu:
      target.pagu,

    realisasi_dasar:
      realisasiDasar,

    total_realisasi_input:
      activeTotal + nominal,

    realisasi_final:
      realisasiDasar + activeTotal + nominal,

    sisa_pagu_input:
      Math.max(
        danaTersediaInput -
        activeTotal -
        nominal,
        0
      )
  };
}


// ============================================================
// REALISASI MONITORING
// Sumber transaksi untuk Dashboard / Grafik / Monitoring / Laporan
// ============================================================

function listRealisasiMonitoring_() {

  const realisasi =
    readRealisasi_(
      getRealisasiSheet_()
    );

  const rows =
    realisasi
      .filter(function (item) {

        return (
          String(
            item.status || "AKTIF"
          ).toUpperCase() === "AKTIF"
        );

      })
      .filter(function (item) {

        return (
          item.id_anggaran &&
          item.tahun &&
          item.bulan &&
          Number(item.nominal_realisasi) > 0
        );

      })
      .map(function (item) {

        return {

          id_realisasi:
            String(item.id_realisasi || ""),

          id_anggaran:
            String(item.id_anggaran || ""),

          tahun:
            String(item.tahun || ""),

          bulan:
            String(item.bulan || ""),

          nominal_realisasi:
            Number(item.nominal_realisasi) || 0,

          kode_sub_komponen:
            String(item.kode_sub_komponen || ""),

          sub_komponen:
            String(item.sub_komponen || ""),

          akun:
            String(item.akun || ""),

          item_akun:
            String(item.item_akun || ""),

          detil_akun:
            String(item.detil_akun || ""),

          rincian_item:
            String(item.rincian_item || ""),

          pagu_detil:
            Number(item.pagu_detil) || 0

        };

      });

  const master = buildRealisasiMasterFromDataAplikasi_();

  return {

    ok: true,

    realisasi:
      rows,

    realisasi_count:
      rows.length,

    master:
      master,

    master_count:
      master.length,

    source:
      "DATA_APLIKASI"
  };
}


// ============================================================
// UPDATE REALISASI
// ============================================================

function updateRealisasi_(
  idToken,
  row
) {

  const auth =
    authenticate_(idToken);

  const user =
    auth.user;

  if (!row) {
    throw new Error(
      "Data realisasi tidak ditemukan."
    );
  }

  const idRealisasi =
    String(
      row.id_realisasi || ""
    ).trim();

  if (!idRealisasi) {
    throw new Error(
      "ID realisasi tidak ditemukan."
    );
  }

  const bulan =
    normalisasiBulanRealisasi_(
      row.bulan_realisasi ||
      row.bulan
    );

  const nominal =
    parseAmount_(
      row.nominal_realisasi
    );

  const tahun =
    String(
      row.tahun || ""
    ).trim();

  const idAnggaran =
    String(
      row.id_anggaran || ""
    ).trim();

  if (!tahun) {
    throw new Error(
      "Tahun anggaran belum dipilih."
    );
  }

  if (!idAnggaran) {
    throw new Error(
      "Detil anggaran belum dipilih."
    );
  }

  if (!bulan) {
    throw new Error(
      "Bulan realisasi tidak valid."
    );
  }

  if (!(nominal > 0)) {
    throw new Error(
      "Nominal realisasi harus lebih besar dari 0."
    );
  }

  // Master memakai cache server sehingga Edit tidak perlu
  // fetch + parse DATA_APLIKASI setiap request.
  const master =
    buildRealisasiMasterFromDataAplikasi_();

  const target =
    master.find(function (item) {
      return (
        item.id_anggaran === idAnggaran &&
        item.tahun === tahun
      );
    });

  if (!target) {
    throw new Error(
      "Detil anggaran tidak ditemukan pada DATA_APLIKASI."
    );
  }

  const sheet =
    getRealisasiSheet_();

  // Baca sheet REALISASI hanya SATU kali.
  // Data yang sama dipakai untuk:
  // 1. mencari transaksi lama,
  // 2. validasi total pagu,
  // 3. menemukan nomor baris untuk update.
  const bundle =
    readRealisasiWithMeta_(sheet);

  const existing =
    bundle.realisasi;

  const values =
    bundle.values;

  const index =
    bundle.index;

  const old =
    existing.find(function (item) {
      return item.id_realisasi === idRealisasi;
    });

  if (!old) {
    throw new Error(
      "Transaksi realisasi tidak ditemukan."
    );
  }

  if (
    String(
      old.status || "AKTIF"
    ).toUpperCase() !== "AKTIF"
  ) {
    throw new Error(
      "Transaksi realisasi sudah tidak aktif."
    );
  }

  // Hitung total INPUT REALISASI aktif tanpa transaksi
  // yang sedang diedit.
  let activeTotalOther = 0;

  for (const item of existing) {
    if (
      item.id_anggaran === idAnggaran &&
      item.tahun === tahun &&
      item.id_realisasi !== idRealisasi &&
      String(
        item.status || "AKTIF"
      ).toUpperCase() === "AKTIF"
    ) {
      activeTotalOther +=
        Number(item.nominal_realisasi) || 0;
    }
  }

  const realisasiDasar =
    Number(target.realisasi) || 0;

  const danaTersediaInput =
    Math.max(
      Number(target.pagu) - realisasiDasar,
      0
    );

  if (
    activeTotalOther + nominal >
    danaTersediaInput
  ) {
    throw new Error(
      "Total Realisasi Final akan melebihi Pagu Detil. " +
      "Pagu: " +
      target.pagu +
      ", Realisasi Dasar: " +
      realisasiDasar +
      ", input aktif lainnya: " +
      activeTotalOther +
      ", nominal baru: " +
      nominal +
      ", sisa yang dapat diinput: " +
      danaTersediaInput +
      "."
    );
  }

  let targetRow = -1;
  let oldData = null;
  const idColumn = index.ID_REALISASI;

  if (
    idColumn === undefined
  ) {
    throw new Error(
      "Kolom ID_REALISASI tidak ditemukan."
    );
  }

  for (
    let i = 1;
    i < values.length;
    i++
  ) {
    const currentId =
      String(
        values[i][idColumn] || ""
      ).trim();

    if (currentId === idRealisasi) {
      targetRow = i + 1;
      oldData = values[i].slice();
      break;
    }
  }

  if (targetRow < 0 || !oldData) {
    throw new Error(
      "Baris transaksi realisasi tidak ditemukan."
    );
  }

  const output =
    oldData.slice();

  function setValue(
    name,
    value
  ) {
    const idx =
      index[name] !== undefined
        ? index[name]
        : index[
            name.replace(
              /_/g,
              " "
            )
          ];

    if (idx !== undefined) {
      output[idx] = value;
    }
  }

  // Pastikan identitas master tetap sinkron
  // dengan DATA_APLIKASI.
  setValue("ID_REALISASI", idRealisasi);
  setValue("TAHUN", tahun);
  setValue("ID_ANGGARAN", idAnggaran);
  setValue("KODE_SUB_KOMPONEN", target.kodeSubKomponen);
  setValue("SUB_KOMPONEN", target.subKomponen);
  setValue("AKUN", target.akun);
  setValue("ITEM_AKUN", target.itemAkun);
  setValue("DETIL_AKUN", target.detilAkun);
  setValue("RINCIAN_ITEM", target.rincianItem);
  setValue("PAGU_DETIL", target.pagu);
  setValue("BULAN_REALISASI", bulan);
  setValue("NOMINAL_REALISASI", nominal);
  setValue(
    "KETERANGAN",
    String(
      row.keterangan || ""
    ).trim()
  );
  setValue("STATUS", "AKTIF");

  const now = new Date();
  setValue("UPDATED_AT", now);
  setValue("UPDATED_BY", user.email);

  sheet
    .getRange(
      targetRow,
      1,
      1,
      values[0].length
    )
    .setValues([output]);

  const record = {
    id_realisasi: idRealisasi,
    tahun: tahun,
    id_anggaran: idAnggaran,
    kode_sub_komponen: target.kodeSubKomponen,
    sub_komponen: target.subKomponen,
    akun: target.akun,
    item_akun: target.itemAkun,
    detil_akun: target.detilAkun,
    rincian_item: target.rincianItem,
    pagu_detil: target.pagu,
    bulan: bulan,
    nominal_realisasi: nominal,
    keterangan:
      String(
        row.keterangan || ""
      ).trim(),
    status: "AKTIF",
    created_at: old.created_at || "",
    created_by: old.created_by || "",
    updated_at: now,
    updated_by: user.email
  };

  getRealisasiLogSheet_()
    .appendRow([
      now,
      "UPDATE",
      idRealisasi,
      user.email,
      JSON.stringify(old),
      JSON.stringify(record),
      "Update input realisasi bulanan"
    ]);

  return {
    ok: true,
    message:
      "Realisasi berhasil diperbarui.",
    user: {
      email: user.email,
      name:
        user.name ||
        user.email,
      role:
        user.role ||
        "OPERATOR"
    },
    data: record,
    pagu: target.pagu,
    total_realisasi_input:
      activeTotalOther + nominal,
    sisa_pagu_input:
      Math.max(
        target.pagu -
        activeTotalOther -
        nominal,
        0
      )
  };
}

// ============================================================
// DELETE INPUT REALISASI
// HARD DELETE
// ============================================================
// Transaksi benar-benar dihapus dari sheet REALISASI P3HPL.
// Tidak membuat log DELETE.
// ============================================================

function deleteRealisasi_(idToken, row) {

  const user = authenticate_(idToken).user;

  if (!row) {
    throw new Error(
      "Data realisasi tidak ditemukan."
    );
  }

  const idRealisasi =
    String(
      row.id_realisasi ||
      row.id ||
      ""
    ).trim();

  if (!idRealisasi) {
    throw new Error(
      "ID realisasi tidak ditemukan."
    );
  }

  const sheet =
    getRealisasiSheet_();

  const values =
    sheet
      .getDataRange()
      .getValues();

  if (values.length < 2) {
    throw new Error(
      "Transaksi realisasi tidak ditemukan."
    );
  }

  const index =
    realisasiHeaderIndex_(
      values[0]
    );

  const idCol =
    index.ID_REALISASI;

  if (idCol === undefined) {
    throw new Error(
      "Kolom ID_REALISASI tidak ditemukan."
    );
  }

  let rowNumber = -1;

  for (
    let i = 1;
    i < values.length;
    i++
  ) {

    const currentId =
      String(
        values[i][idCol] || ""
      ).trim();

    if (
      currentId ===
      idRealisasi
    ) {
      rowNumber =
        i + 1;

      break;
    }
  }

  if (rowNumber < 0) {
    throw new Error(
      "Transaksi realisasi tidak ditemukan atau sudah dihapus."
    );
  }

  // ==========================================================
  // HARD DELETE
  // ==========================================================

  sheet.deleteRow(
    rowNumber
  );

  return {

    ok: true,

    message:
      "Realisasi berhasil dihapus.",

    id_realisasi:
      idRealisasi,

    deleted_by:
      user.email,

    deleted_at:
      new Date()

  };
}

// ============================================================
// REVISI ANGGARAN - VALIDASI, DRY RUN, DAN APPLY
// ============================================================

const REVISI_LOG_HEADERS_ = [
  "NOMOR_REVISI", "TANGGAL_REVISI", "PEMBUAT", "ALASAN",
  "WAKTU_APPLY", "USER_EMAIL", "USER_NAMA", "STATUS",
  "TOTAL_SEBELUM", "TOTAL_SESUDAH", "SELISIH",
  "JUMLAH_PERUBAHAN", "SNAPSHOT_SHEET", "DETAIL", "ERROR"
];

function applyRevisi_(request) {
  const auth = authenticate_(request.id_token);
  const draft = request.draft || {};
  const nomor = String(draft.nomor || "").trim();
  const dryRun = request.dry_run === true || String(request.dry_run).toLowerCase() === "true";

  if (!nomor) throw new Error("Nomor revisi wajib diisi.");
  if (String(draft.status || "").toUpperCase() !== "TERVALIDASI") {
    throw new Error("Draft belum berstatus TERVALIDASI.");
  }
  if (!draft.validation || draft.validation.ok !== true) {
    throw new Error("Validasi browser belum berhasil.");
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  let ss = null;
  let sheet = null;
  let snapshot = null;

  try {
    ss = getSpreadsheet_();
    if (!dryRun) ensureAnggaranIdSchema_();
    sheet = ss.getSheetByName("DATA_APLIKASI");
    if (!sheet) throw new Error("Sheet DATA_APLIKASI tidak ditemukan.");

    const beforeRows = readRevisionRows_();
    const expectedHash = String(
      request.expected_snapshot_hash || draft.snapshotHash || ""
    ).trim();
    const actualHash = revisionFingerprint_(beforeRows);

    if (!expectedHash) {
      throw new Error("Fingerprint DATA_APLIKASI tidak tersedia. Validasi ulang draft.");
    }

    if (actualHash !== expectedHash) {
      throw new Error(
        "DATA_APLIKASI berubah sejak draft dibuat. Revisi dibatalkan. " +
        "Muat ulang data dan validasi ulang sebelum menerapkan."
      );
    }

    const validation = validateRevisionServer_(beforeRows, draft);

    if (!validation.ok) {
      throw new Error(
        "Validasi server gagal:\n- " + validation.errors.join("\n- ")
      );
    }

    // ==========================================================
    // DRY RUN
    // Tidak membuat snapshot.
    // Tidak mengubah DATA_APLIKASI.
    // Tidak membuat log BERHASIL.
    // ==========================================================
    if (dryRun) {
      return {
        ok: true,
        dry_run: true,
        message: "Uji REV-" + nomor + " berhasil. DATA_APLIKASI tidak diubah.",
        nomor: nomor,
        before: validation.before,
        after: validation.after,
        diff: validation.diff,
        component_count: Object.keys(validation.componentDiffs || {}).length,
        component_diffs: validation.componentDiffs || {},
        changes: Object.keys(draft.changes || {}).length,
        deletions: Array.isArray(draft.deletions) ? draft.deletions.length : 0,
        additions: Array.isArray(draft.additions)
          ? draft.additions.filter(function (item) { return !item.deleted; }).length
          : 0,
        server_time: new Date()
      };
    }

    // ==========================================================
    // APPLY NYATA
    // ==========================================================
    const log = ensureRevisiLogSheet_();

    if (findSuccessfulRevision_(log, nomor)) {
      throw new Error("Nomor revisi " + nomor + " sudah pernah diterapkan.");
    }

    // Snapshot dibuat SEBELUM satu pun perubahan DATA_APLIKASI.
    snapshot = sheet.copyTo(ss);
    snapshot.setName(makeSnapshotName_(ss, nomor));

    const info = getRevisionHeaderInfo_(sheet);
    const changes = draft.changes && typeof draft.changes === "object"
      ? draft.changes
      : {};

    const changeIndexes = Object.keys(changes)
      .map(Number)
      .filter(Number.isInteger)
      .sort(function (a, b) { return a - b; });

    // 1. Ubah item yang sudah ada.
    changeIndexes.forEach(function (rowIndex) {
      const rowNumber = rowIndex + 1;

      if (
        rowNumber <= info.headerRow + 1 ||
        rowNumber > sheet.getLastRow()
      ) {
        throw new Error("Baris perubahan tidak valid: " + rowIndex);
      }

      const change = changes[String(rowIndex)] || {};
      const row = sheet
        .getRange(rowNumber, 1, 1, sheet.getLastColumn())
        .getValues()[0];

      if (change.uraian !== undefined && info.uraian >= 0) {
        sheet.getRange(rowNumber, info.uraian + 1)
          .setValue(String(change.uraian || "").trim());
      }

      if (change.volume !== undefined && info.volume >= 0) {
        sheet.getRange(rowNumber, info.volume + 1)
          .setValue(toRevisionNumber_(change.volume));
      }

      if (change.satuan !== undefined && info.satuan >= 0) {
        sheet.getRange(rowNumber, info.satuan + 1)
          .setValue(String(change.satuan || "").trim());
      }

      if (change.harga !== undefined && info.harga >= 0) {
        sheet.getRange(rowNumber, info.harga + 1)
          .setValue(toRevisionNumber_(change.harga));
      }

      if (info.pagu >= 0) {
        const volume = change.volume !== undefined
          ? toRevisionNumber_(change.volume)
          : toRevisionNumber_(row[info.volume]);
        const harga = change.harga !== undefined
          ? toRevisionNumber_(change.harga)
          : toRevisionNumber_(row[info.harga]);

        sheet.getRange(rowNumber, info.pagu + 1)
          .setValue(volume * harga);
      }
    });

    // 2. Hapus baris dari bawah ke atas agar rowIndex tidak bergeser.
    const deletions = Array.from(new Set(
      (Array.isArray(draft.deletions) ? draft.deletions : [])
        .map(Number)
        .filter(Number.isInteger)
    )).sort(function (a, b) { return b - a; });

    // Jangan menghapus detil yang masih mempunyai RPD atau Realisasi aktif.
    // Hal ini mencegah transaksi lama menjadi orphan setelah Revisi.
    if (deletions.length) {
      const deletedRows = beforeRows.filter(function (row) {
        return deletions.indexOf(Number(row.rowIndex)) >= 0;
      });

      const deletedIds = new Set(
        deletedRows
          .map(function (row) { return String(row.idAnggaran || "").trim(); })
          .filter(Boolean)
      );

      if (deletedIds.size) {
        const rpdSheet = ss.getSheetByName(RPD_SHEETS.RPD);
        const activeRpdIds = new Set(
          rpdSheet
            ? readRpd_(rpdSheet)
                .map(function (row) { return String(row.id_anggaran || "").trim(); })
                .filter(Boolean)
            : []
        );

        const activeRealisasiIds = new Set(
          readRealisasi_(getRealisasiSheet_())
            .filter(function (row) {
              return String(row.status || "AKTIF").toUpperCase() === "AKTIF";
            })
            .map(function (row) { return String(row.id_anggaran || "").trim(); })
            .filter(Boolean)
        );

        deletedRows.forEach(function (row) {
          const id = String(row.idAnggaran || "").trim();
          if (id && (activeRpdIds.has(id) || activeRealisasiIds.has(id))) {
            throw new Error(
              "Detil anggaran " +
              (row.uraian || row.detil || row.rincian || id) +
              " tidak dapat dihapus karena masih memiliki RPD dan/atau Input Realisasi aktif. " +
              "Kosongkan/selesaikan data terkait terlebih dahulu."
            );
          }
        });
      }
    }

    deletions.forEach(function (rowIndex) {
      const rowNumber = rowIndex + 1;
      if (
        rowNumber > info.headerRow + 1 &&
        rowNumber <= sheet.getLastRow()
      ) {
        sheet.deleteRow(rowNumber);
      }
    });

    // 3. Tambahkan item baru setelah baris terakhir akun tujuan.
    const additions = (Array.isArray(draft.additions) ? draft.additions : [])
      .filter(function (item) { return !item.deleted; });

    additions.forEach(function (item) {
      const targetRow = findLastRevisionAccountRow_(sheet, item);

      if (!targetRow) {
        throw new Error(
          "Lokasi Akun Belanja item tambahan tidak ditemukan: " +
          String(item.kodeAkun || item.kode || "") + " " +
          String(item.akunLabel || item.akun || "")
        );
      }

      const lastCol = sheet.getLastColumn();
      sheet.insertRowAfter(targetRow);

      sheet
        .getRange(targetRow, 1, 1, lastCol)
        .copyTo(
          sheet.getRange(targetRow + 1, 1, 1, lastCol),
          { contentsOnly: false }
        );

      const newRow = targetRow + 1;
      const volume = toRevisionNumber_(item.volume);

      // Baris baru mewarisi format dari baris akun tujuan, tetapi
      // harus mendapat ID anggaran baru agar tidak berbagi identitas.
      if (info.idAnggaran >= 0) {
        sheet
          .getRange(newRow, info.idAnggaran + 1)
          .setValue(ANGGARAN_ID_PREFIX_ + Utilities.getUuid().replace(/-/g, "").toUpperCase());
      }
      const harga = toRevisionNumber_(item.harga);

      if (info.uraian >= 0) {
        sheet.getRange(newRow, info.uraian + 1)
          .setValue(String(item.uraian || "").trim());
      }
      if (info.volume >= 0) {
        sheet.getRange(newRow, info.volume + 1).setValue(volume);
      }
      if (info.satuan >= 0) {
        sheet.getRange(newRow, info.satuan + 1)
          .setValue(String(item.satuan || "").trim());
      }
      if (info.harga >= 0) {
        sheet.getRange(newRow, info.harga + 1).setValue(harga);
      }
      if (info.pagu >= 0) {
        sheet.getRange(newRow, info.pagu + 1)
          .setValue(volume * harga);
      }

      // Jika DATA_APLIKASI mempunyai kolom eksplisit untuk konteks,
      // isi juga agar item baru tidak kehilangan identitas hierarki.
      setRevisionContext_(sheet, newRow, info, item);
    });

    SpreadsheetApp.flush();

    // Pemeriksaan akhir setelah write.
    const afterRows = readRevisionRows_();
    const final = calculateRevisionTotals_(afterRows);

    if (Math.abs(final.total - validation.before) > 0.000001) {
      throw new Error(
        "Pemeriksaan akhir gagal: total berubah dari " +
        formatRevisionRupiah_(validation.before) +
        " menjadi " +
        formatRevisionRupiah_(final.total) + "."
      );
    }

    invalidateRealisasiMasterCache_();

    appendRevisiLog_(log, [
      nomor,
      draft.tanggal || "",
      draft.pembuat || "",
      draft.alasan || "",
      new Date(),
      auth.user.email,
      auth.user.name,
      "BERHASIL",
      validation.before,
      final.total,
      final.total - validation.before,
      changeIndexes.length + deletions.length + additions.length,
      snapshot.getName(),
      JSON.stringify({
        changes: changeIndexes.length,
        deletions: deletions.length,
        additions: additions.length
      }),
      ""
    ]);

    return {
      ok: true,
      dry_run: false,
      message: "Revisi " + nomor + " berhasil diterapkan ke DATA_APLIKASI.",
      nomor: nomor,
      before: validation.before,
      after: final.total,
      diff: final.total - validation.before,
      snapshotSheet: snapshot.getName(),
      user: auth.user
    };

  } catch (error) {
    // Jika penerapan nyata sudah membuat snapshot, pulihkan DATA_APLIKASI.
    if (!dryRun && snapshot && sheet) {
      try {
        restoreRevisionSnapshot_(sheet, snapshot);
      } catch (rollbackError) {
        console.error("Rollback snapshot gagal: " + rollbackError.message);
      }
    }

    if (!dryRun && ss) {
      try {
        const log = ensureRevisiLogSheet_();
        appendRevisiLog_(log, [
          nomor,
          draft.tanggal || "",
          draft.pembuat || "",
          draft.alasan || "",
          new Date(),
          auth.user.email,
          auth.user.name,
          "GAGAL",
          "",
          "",
          "",
          "",
          snapshot ? snapshot.getName() : "",
          "",
          error.message || ""
        ]);
      } catch (logError) {
        console.error("Log gagal: " + logError.message);
      }
    }

    throw error;
  } finally {
    lock.releaseLock();
  }
}

function ensureRevisiLogSheet_() {
  const ss = getSpreadsheet_();
  let sheet = ss.getSheetByName("REVISI_ANGGARAN_LOG");

  if (!sheet) {
    sheet = ss.insertSheet("REVISI_ANGGARAN_LOG");
  }

  const lastColumn = Math.max(sheet.getLastColumn(), 1);
  const current = sheet
    .getRange(1, 1, 1, lastColumn)
    .getValues()[0]
    .map(function (value) {
      return String(value || "")
        .trim()
        .toUpperCase();
    });

  if (sheet.getLastRow() === 0 || !current.some(Boolean)) {
    sheet.getRange(1, 1, 1, REVISI_LOG_HEADERS_.length)
      .setValues([REVISI_LOG_HEADERS_]);
  } else {
    const missing = REVISI_LOG_HEADERS_.filter(function (header) {
      return current.indexOf(header) === -1;
    });

    if (missing.length) {
      sheet
        .getRange(1, sheet.getLastColumn() + 1, 1, missing.length)
        .setValues([missing]);
    }
  }

  return sheet;
}

function appendRevisiLog_(sheet, row) {
  sheet.appendRow(row);
}

function findSuccessfulRevision_(sheet, nomor) {
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return false;

  const map = headerIndex_(values[0]);
  if (map.NOMOR_REVISI === undefined || map.STATUS === undefined) {
    return false;
  }

  for (let i = 1; i < values.length; i++) {
    if (
      String(values[i][map.NOMOR_REVISI] || "").trim() === nomor &&
      String(values[i][map.STATUS] || "").trim().toUpperCase() === "BERHASIL"
    ) {
      return true;
    }
  }

  return false;
}

function makeSnapshotName_(ss, nomor) {
  const stamp = Utilities.formatDate(
    new Date(),
    Session.getScriptTimeZone() || "Asia/Makassar",
    "yyyyMMdd_HHmmss"
  );

  const base = ("BAK_" + nomor + "_" + stamp)
    .replace(/[^A-Za-z0-9_-]/g, "_")
    .slice(0, 90);

  let name = base;
  let n = 1;

  while (ss.getSheetByName(name)) {
    name = (base + "_" + n++).slice(0, 99);
  }

  return name;
}

function restoreRevisionSnapshot_(target, snapshot) {
  const rows = snapshot.getMaxRows();
  const cols = snapshot.getMaxColumns();

  if (target.getMaxRows() < rows) {
    target.insertRowsAfter(
      target.getMaxRows(),
      rows - target.getMaxRows()
    );
  }

  if (target.getMaxColumns() < cols) {
    target.insertColumnsAfter(
      target.getMaxColumns(),
      cols - target.getMaxColumns()
    );
  }

  target.clear({ contentsOnly: false });

  snapshot
    .getRange(1, 1, rows, cols)
    .copyTo(
      target.getRange(1, 1, rows, cols),
      { contentsOnly: false }
    );

  if (target.getMaxRows() > rows) {
    target.deleteRows(
      rows + 1,
      target.getMaxRows() - rows
    );
  }

  if (target.getMaxColumns() > cols) {
    target.deleteColumns(
      cols + 1,
      target.getMaxColumns() - cols
    );
  }
}

function readRevisionRows_() {
  const sheet = getSpreadsheet_().getSheetByName("DATA_APLIKASI");
  if (!sheet) throw new Error("Sheet DATA_APLIKASI tidak ditemukan.");

  const values = sheet.getDataRange().getValues();
  const info = getRevisionHeaderInfo_(sheet);
  const rows = [];

  let currentAkunCode = "";
  let currentAkunName = "";
  let currentKomponenCode = "";
  let currentKomponen = "";
  let currentSubCode = "";
  let currentSub = "";
  let currentTahun = "";

  for (let i = info.headerRow + 1; i < values.length; i++) {
    const row = values[i];
    if (!row.some(function (value) { return String(value ?? "").trim() !== ""; })) {
      continue;
    }

    const value = function (idx) {
      return idx >= 0 ? String(row[idx] ?? "").trim() : "";
    };

    const kode = value(info.kode);
    const kodeKomponen = value(info.kodeKomponen);
    const kodeSubKomponen = value(info.kodeSubKomponen);
    const kodeAkun = value(info.kodeAkun);
    const komponen = value(info.komponen);
    const subKomponen = value(info.subKomponen);
    const akun = value(info.akun);
    const itemAkun = value(info.itemAkun);
    const detil = value(info.detil);
    const uraian = value(info.uraian);
    const tahun = value(info.tahun);

    const accountCandidate = [kodeAkun, kode, akun, itemAkun, detil, uraian]
      .map(function (v) { return String(v || ""); })
      .map(function (v) {
        const match = v.match(/(?:^|\D)(\d{6})(?:\D|$)/);
        return match ? match[1] : "";
      })
      .find(Boolean) || "";

    if (accountCandidate) currentAkunCode = accountCandidate;
    if (akun) currentAkunName = akun;
    if (kodeKomponen) currentKomponenCode = kodeKomponen;
    if (komponen) currentKomponen = komponen;
    if (kodeSubKomponen) currentSubCode = kodeSubKomponen;
    if (subKomponen) currentSub = subKomponen;
    if (tahun) currentTahun = tahun;

    const inheritedCode = currentAkunCode || kode;
    const inheritedAkun = akun || currentAkunName;
    const detailUraian = uraian || detil || itemAkun || inheritedAkun || currentSub || currentKomponen || inheritedCode;

    rows.push({
      rowIndex: i,
      kode: inheritedCode,
      kodeAsli: kode,
      kodeKomponen: currentKomponenCode,
      kodeSubKomponen: currentSubCode,
      kodeAkun: currentAkunCode,
      komponen: currentKomponen,
      subKomponen: currentSub,
      akun: inheritedAkun,
      akunLabel: inheritedAkun,
      itemAkun: itemAkun,
      detil: detil,
      rincian: uraian,
      uraian: detailUraian,
      volume: toRevisionNumber_(row[info.volume]),
      satuan: value(info.satuan),
      harga: toRevisionNumber_(row[info.harga]),
      jumlah: toRevisionNumber_(row[info.pagu]),
      tahun: currentTahun,
      idAnggaran:
        info.idAnggaran >= 0
          ? String(row[info.idAnggaran] || "").trim()
          : ""
    });
  }

  return rows;
}

function revisionFingerprint_(rows) {
  const canonical = (Array.isArray(rows) ? rows : []).map(function (row) {
    return [
      row.rowIndex, row.kode, row.kodeAsli, row.kodeKomponen,
      row.kodeSubKomponen, row.kodeAkun, row.komponen,
      row.subKomponen, row.akun, row.akunLabel, row.itemAkun,
      row.detil, row.rincian, row.uraian, row.volume, row.satuan,
      row.harga, row.jumlah, row.tahun
    ];
  });

  const textValue = JSON.stringify(canonical);
  let hash = 2166136261;

  for (let i = 0; i < textValue.length; i++) {
    hash ^= textValue.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }

  return (hash >>> 0).toString(16).padStart(8, "0");
}

function calculateRevisionTotals_(rows) {
  const groups = {};

  (Array.isArray(rows) ? rows : []).forEach(function (row) {
    const code = String(row.kodeKomponen || "").trim();
    const name = String(row.komponen || "").trim();
    const key = [code, name].filter(Boolean).join(" | ") || "(Tanpa Komponen)";

    groups[key] = (groups[key] || 0) + toRevisionNumber_(row.jumlah);
  });

  return {
    total: (Array.isArray(rows) ? rows : []).reduce(function (sum, row) {
      return sum + toRevisionNumber_(row.jumlah);
    }, 0),
    groups: groups
  };
}

function validateRevisionServer_(rows, draft) {
  const errors = [];
  const byIndex = {};
  rows.forEach(function (row) { byIndex[row.rowIndex] = row; });

  const after = rows.map(function (row) {
    return Object.assign({}, row);
  });

  const changes = draft.changes && typeof draft.changes === "object"
    ? draft.changes
    : {};

  Object.keys(changes).forEach(function (key) {
    const idx = Number(key);
    const base = byIndex[idx];
    const target = after.find(function (row) { return row.rowIndex === idx; });

    if (!base || !target) {
      errors.push("Baris " + key + " tidak ditemukan pada DATA_APLIKASI.");
      return;
    }

    const change = changes[key] || {};

    if (change.volume !== undefined) {
      target.volume = toRevisionNumber_(change.volume);
    }
    if (change.harga !== undefined) {
      target.harga = toRevisionNumber_(change.harga);
    }
    if (change.satuan !== undefined) {
      target.satuan = String(change.satuan || "").trim();
    }
    if (change.uraian !== undefined) {
      target.uraian = String(change.uraian || "").trim();
      target.rincian = target.uraian;
    }

    if (target.volume < 0 || target.harga < 0) {
      errors.push("Nilai negatif pada baris " + idx + ".");
    }

    target.jumlah = target.volume * target.harga;
  });

  const deletions = Array.from(new Set(
    (Array.isArray(draft.deletions) ? draft.deletions : [])
      .map(Number)
      .filter(Number.isInteger)
  ));

  deletions.forEach(function (idx) {
    if (!byIndex[idx]) {
      errors.push("Baris penghapusan " + idx + " tidak ditemukan.");
    }
  });

  const deleted = new Set(deletions);
  const filtered = after.filter(function (row) {
    return !deleted.has(row.rowIndex);
  });

  const additions = (Array.isArray(draft.additions) ? draft.additions : [])
    .filter(function (item) { return !item.deleted; });

  additions.forEach(function (item) {
    const comp = String(item.komponen || "").trim();
    const sub = String(item.subKomponen || "").trim();
    const code = String(item.kodeAkun || item.kode || "").trim();
    const account = String(item.akunLabel || item.akun || "").trim();
    const year = String(item.tahun || "").trim();
    const volume = toRevisionNumber_(item.volume);
    const price = toRevisionNumber_(item.harga);

    if (!comp) errors.push("Item tambahan tanpa Komponen.");
    if (!sub) errors.push("Item tambahan tanpa Sub Komponen.");
    if (!code || !account) errors.push("Item tambahan tanpa Akun Belanja.");
    if (!String(item.uraian || "").trim()) errors.push("Item tambahan tanpa Uraian.");
    if (volume <= 0) errors.push("Volume item tambahan harus > 0.");
    if (price < 0) errors.push("Harga item tambahan tidak boleh negatif.");

    const accountExists = rows.some(function (row) {
      return (
        (!year || String(row.tahun || "").trim() === year) &&
        String(row.komponen || "").trim() === comp &&
        String(row.subKomponen || "").trim() === sub &&
        String(row.kodeAkun || row.kode || "").trim() === code &&
        String(row.akun || row.akunLabel || "").trim() === account
      );
    });

    if (!accountExists) {
      errors.push(
        "Akun tujuan item tambahan tidak ditemukan: " + code + " " + account
      );
    }

    filtered.push(Object.assign({}, item, {
      rowIndex: "ADD",
      kode: code,
      kodeAkun: code,
      akun: account,
      akunLabel: account,
      volume: volume,
      harga: price,
      jumlah: volume * price
    }));
  });

  const before = calculateRevisionTotals_(rows);
  const afterTotals = calculateRevisionTotals_(filtered);
  const componentDiffs = {};

  const keys = new Set(
    Object.keys(before.groups).concat(Object.keys(afterTotals.groups))
  );

  keys.forEach(function (key) {
    const beforeValue = before.groups[key] || 0;
    const afterValue = afterTotals.groups[key] || 0;
    const diff = afterValue - beforeValue;

    if (Math.abs(diff) > 0.000001) {
      componentDiffs[key] = {
        before: beforeValue,
        after: afterValue,
        diff: diff
      };

      errors.push(
        "SELISIH PAGU KOMPONEN: " + key + " — " +
        formatRevisionRupiah_(beforeValue) + " → " +
        formatRevisionRupiah_(afterValue) +
        ". Perubahan antar akun belanja/sub komponen di dalam Komponen " +
        "diperbolehkan selama total Komponen tetap."
      );
    }
  });

  if (Math.abs(afterTotals.total - before.total) > 0.000001) {
    errors.push(
      "TOTAL PAGU BERUBAH: " +
      formatRevisionRupiah_(before.total) + " → " +
      formatRevisionRupiah_(afterTotals.total) + "."
    );
  }

  return {
    ok: errors.length === 0,
    errors: errors,
    before: before.total,
    after: afterTotals.total,
    diff: afterTotals.total - before.total,
    componentDiffs: componentDiffs
  };
}

function getRevisionHeaderInfo_(sheet) {
  const values = sheet.getDataRange().getValues();

  for (let i = 0; i < Math.min(values.length, 10); i++) {
    const map = headerIndex_(values[i]);

    if (
      map.PAGU !== undefined &&
      (
        map["RINCIAN ITEM"] !== undefined ||
        map.RINCIAN !== undefined ||
        map["DETIL AKUN"] !== undefined ||
        map["DETAIL AKUN"] !== undefined
      )
    ) {
      return {
        headerRow: i,
        kode: revisionHeader_(map, ["KODE"]),
        kodeKomponen: revisionHeader_(map, ["KODE KOMPONEN", "KODEKOMPONEN"]),
        komponen: revisionHeader_(map, ["KOMPONEN", "NAMA KOMPONEN"]),
        kodeSubKomponen: revisionHeader_(map, ["KODE SUB KOMPONEN", "KODE SUBKOMPONEN"]),
        subKomponen: revisionHeader_(map, ["SUB KOMPONEN", "SUBKOMPONEN", "NAMA SUB KOMPONEN"]),
        kodeAkun: revisionHeader_(map, ["KODE AKUN", "KODEAKUN", "KODE REKENING", "KODE REKENING BELANJA"]),
        akun: revisionHeader_(map, ["AKUN BELANJA", "AKUN"]),
        itemAkun: revisionHeader_(map, ["ITEM AKUN", "ITEM"]),
        detil: revisionHeader_(map, ["DETIL AKUN", "DETAIL AKUN", "DETIL"]),
        uraian: revisionHeader_(map, ["RINCIAN ITEM", "RINCIAN", "DETIL AKUN", "DETAIL AKUN", "ITEM AKUN", "ITEM"]),
        volume: revisionHeader_(map, ["VOLUME", "VOL"]),
        satuan: revisionHeader_(map, ["SATUAN", "SAT"]),
        harga: revisionHeader_(map, ["HARGA SATUAN", "HARGA"]),
        pagu: revisionHeader_(map, ["PAGU", "JUMLAH"]),
        idAnggaran: revisionHeader_(map, ["ID_ANGGARAN", "ID ANGGARAN"]),
        tahun: revisionHeader_(map, ["TAHUN", "TAHUN ANGGARAN"])
      };
    }
  }

  throw new Error("Header DATA_APLIKASI tidak ditemukan.");
}

function revisionHeader_(map, aliases) {
  for (const alias of aliases) {
    const key = String(alias)
      .toUpperCase()
      .replace(/[._-]/g, " ")
      .replace(/\s+/g, " ");

    if (map[key] !== undefined) return map[key];
  }
  return -1;
}

function setRevisionContext_(sheet, rowNumber, info, item) {
  const setIf = function (index, value) {
    if (index >= 0 && value !== undefined && value !== null && String(value) !== "") {
      sheet.getRange(rowNumber, index + 1).setValue(value);
    }
  };

  setIf(info.tahun, item.tahun);
  setIf(info.kodeKomponen, item.kodeKomponen);
  setIf(info.komponen, item.komponen);
  setIf(info.kodeSubKomponen, item.kodeSubKomponen);
  setIf(info.subKomponen, item.subKomponen);
  setIf(info.kodeAkun, item.kodeAkun || item.kode);
  setIf(info.akun, item.akunLabel || item.akun);
}

function toRevisionNumber_(value) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }

  const raw = String(value == null ? "" : value).trim();
  if (!raw) return 0;

  let normalized = raw.replace(/\s/g, "");

  if (normalized.includes(",") && normalized.includes(".")) {
    normalized = normalized.lastIndexOf(",") > normalized.lastIndexOf(".")
      ? normalized.replace(/\./g, "").replace(",", ".")
      : normalized.replace(/,/g, "");
  } else if (normalized.includes(",")) {
    // Untuk nominal Rupiah seperti 3,100,000, koma berarti ribuan.
    normalized = (normalized.match(/,/g) || []).length > 1
      ? normalized.replace(/,/g, "")
      : normalized.replace(",", ".");
  } else {
    normalized = normalized.replace(/,/g, "");
  }

  const out = Number(normalized.replace(/[^0-9.-]/g, ""));
  return Number.isFinite(out) ? out : 0;
}

function formatRevisionRupiah_(value) {
  return "Rp" + (Number(value) || 0).toLocaleString("id-ID");
}

function findLastRevisionAccountRow_(sheet, item) {
  const rows = readRevisionRows_();
  const year = String(item.tahun || "").trim();
  const comp = String(item.komponen || "").trim();
  const sub = String(item.subKomponen || "").trim();
  const code = String(item.kodeAkun || item.kode || "").trim();
  const account = String(item.akunLabel || item.akun || "").trim();

  const matches = rows.filter(function (row) {
    return (
      (!year || String(row.tahun || "").trim() === year) &&
      String(row.komponen || "").trim() === comp &&
      String(row.subKomponen || "").trim() === sub &&
      String(row.kodeAkun || row.kode || "").trim() === code &&
      String(row.akun || row.akunLabel || "").trim() === account
    );
  });

  return matches.length
    ? Math.max.apply(null, matches.map(function (row) { return row.rowIndex + 1; }))
    : 0;
}

function invalidateRealisasiMasterCache_() {
  try {
    const cache = CacheService.getScriptCache();
    const metaKey = REALISASI_MASTER_CACHE_KEY + "_meta";
    const meta = cache.get(metaKey);
    const count = Number(meta);

    if (Number.isInteger(count) && count > 0) {
      for (let i = 0; i < count; i++) {
        cache.remove(REALISASI_MASTER_CACHE_KEY + "_" + i);
      }
    }

    cache.remove(metaKey);
  } catch (error) {
    // Cache hanya optimasi; kegagalan invalidasi tidak boleh menggagalkan Revisi.
  }
}
// ============================================================
// JSON OUTPUT
// ============================================================

function jsonOutput(data) {

  return ContentService
    .createTextOutput(
      JSON.stringify(data)
    )
    .setMimeType(
      ContentService.MimeType.JSON
    );
}

// ============================================================
// SPREADSHEET
// ============================================================

function getSpreadsheet_() {

  if (!RPD_SHEET_ID) {

    throw new Error(
      "RPD_SHEET_ID belum diisi."
    );
  }

  return SpreadsheetApp.openById(
    RPD_SHEET_ID
  );
}

// ============================================================
// RPD SCHEMA
// ============================================================

function ensureRpdSchema_(sheet) {

  const lastColumn =
    Math.max(
      sheet.getLastColumn(),
      1
    );

  const headers =
    sheet
      .getRange(
        1,
        1,
        1,
        lastColumn
      )
      .getValues()[0]
      .map(function (v) {

        return String(v || "")
          .trim()
          .toUpperCase();

      });

  const missing =
    RPD_HEADERS.filter(
      function (header) {

        return (
          headers.indexOf(
            header
          ) === -1
        );

      }
    );

  if (missing.length) {
    const start =
      sheet.getLastColumn() + 1;

    sheet
      .getRange(
        1,
        start,
        1,
        missing.length
      )
      .setValues([
        missing
      ]);
  }

  // RESET GENERASI RPD:
  // Setelah RPD_DATA_GENERATION dinaikkan, seluruh record RPD lama
  // dibersihkan satu kali. Ini mencegah RPD lama muncul kembali dari
  // server setelah revisi/reset. Setelah properti sama dengan generasi
  // saat ini, data baru tidak akan dihapus lagi.
  const properties = PropertiesService.getScriptProperties();
  const activeGeneration = properties.getProperty(RPD_GENERATION_PROPERTY) || "";

  if (activeGeneration !== RPD_DATA_GENERATION) {
    const lastRow = sheet.getLastRow();
    if (lastRow > 1) {
      sheet.deleteRows(2, lastRow - 1);
    }
    properties.setProperty(RPD_GENERATION_PROPERTY, RPD_DATA_GENERATION);
    SpreadsheetApp.flush();
  }
}

// ============================================================
// AUTHENTICATION
// ============================================================

function authenticate_(
  idToken
) {

  const user =
    verifyGoogleToken_(
      idToken
    );

  const allowed =
    findAllowedUser_(
      user.email
    );

  if (
    !allowed ||
    String(
      allowed.aktif
    ).toUpperCase() !== "YA"
  ) {

    throw new Error(
      "Email Google Anda belum terdaftar sebagai Operator RPD."
    );
  }

  return {

    ok: true,

    user: {

      email:
        user.email,

      name:
        allowed.nama ||
        user.name ||
        user.email,

      role:
        allowed.role ||
        "OPERATOR",

      id_token:
        idToken
    }
  };
}

// ============================================================
// VERIFY GOOGLE TOKEN
// ============================================================

function verifyGoogleToken_(
  idToken
) {

  if (!idToken) {

    throw new Error(
      "Token login Google tidak ditemukan."
    );
  }

  if (!RPD_CLIENT_ID) {

    throw new Error(
      "RPD_CLIENT_ID belum diisi."
    );
  }

  const url =
    "https://oauth2.googleapis.com/tokeninfo?id_token=" +
    encodeURIComponent(
      idToken
    );

  const response =
    UrlFetchApp.fetch(
      url,
      {
        muteHttpExceptions: true
      }
    );

  const code =
    response.getResponseCode();

  if (code !== 200) {

    throw new Error(
      "Token Google tidak valid atau sudah kedaluwarsa."
    );
  }

  const data =
    JSON.parse(
      response.getContentText()
    );

  if (
    String(data.aud || "") !==
    String(RPD_CLIENT_ID)
  ) {

    throw new Error(
      "Token Google bukan untuk aplikasi RPD ini."
    );
  }

  const email =
    String(
      data.email || ""
    )
      .trim()
      .toLowerCase();

  const verified =
    String(
      data.email_verified || ""
    ).toLowerCase();

  if (
    !email ||
    (
      verified !== "true" &&
      verified !== "1"
    )
  ) {

    throw new Error(
      "Email Google belum terverifikasi."
    );
  }

  return {

    email:
      email,

    name:
      data.name || ""
  };
}

// ============================================================
// USERS
// ============================================================

function findAllowedUser_(
  email
) {

  const sheet =
    getSpreadsheet_()
      .getSheetByName(
        RPD_SHEETS.USERS
      );

  if (!sheet) {

    throw new Error(
      "Sheet USERS belum dibuat."
    );
  }

  const values =
    sheet
      .getDataRange()
      .getValues();

  if (
    values.length < 2
  ) {
    return null;
  }

  const index =
    headerIndex_(
      values[0]
    );

  for (
    let i = 1;
    i < values.length;
    i++
  ) {

    const row =
      values[i];

    const rowEmail =
      String(
        row[index.EMAIL] ||
        ""
      )
        .trim()
        .toLowerCase();

    if (
      rowEmail ===
      email
    ) {

      return {

        email:
          rowEmail,

        nama:
          row[index.NAMA] ||
          "",

        role:
          row[index.ROLE] ||
          "OPERATOR",

        aktif:
          row[index.AKTIF] ||
          "TIDAK"
      };
    }
  }

  return null;
}

// ============================================================
// RPD BOOTSTRAP
// ============================================================

function bootstrap_(
  idToken
) {

  const user =
    authenticate_(
      idToken
    );

  const ss =
    getSpreadsheet_();

  const rpdSheet =
    ss.getSheetByName(
      RPD_SHEETS.RPD
    );

  if (!rpdSheet) {

    throw new Error(
      "Sheet RPD belum dibuat."
    );
  }

  ensureRpdSchema_(
    rpdSheet
  );

  const master =
    buildMasterFromDataAplikasi_();

  const rpd =
    readRpd_(
      rpdSheet
    );

  return {

    ok: true,

    user:
      user.user,

    master:
      master,

    rpd:
      rpd
  };
}

// ============================================================
// LIST RPD
// ============================================================

function listRpd_(
  idToken
) {

  const user =
    authenticate_(
      idToken
    );

  const sheet =
    getSpreadsheet_()
      .getSheetByName(
        RPD_SHEETS.RPD
      );

  if (!sheet) {

    throw new Error(
      "Sheet RPD belum dibuat."
    );
  }

  ensureRpdSchema_(
    sheet
  );

  return {

    ok: true,

    user:
      user.user,

    rpd:
      readRpd_(
        sheet
      )
  };
}

// ============================================================
// MASTER RPD
// ============================================================

function buildMasterFromDataAplikasi_() {
  // DATA_APLIKASI adalah source of truth. RPD harus membaca langsung
  // spreadsheet agar Pagu dan Realisasi sama persis dengan Dashboard/
  // Monitoring dan langsung mengikuti Revisi Anggaran.
  const ss = getSpreadsheet_();
  const sheet = ss.getSheetByName("DATA_APLIKASI");

  if (!sheet) {
    throw new Error("Sheet DATA_APLIKASI tidak ditemukan.");
  }

  ensureAnggaranIdSchema_();

  const values = sheet.getDataRange().getValues();

  if (values.length < 2) {
    return [];
  }

  const context = detectHeader_(values);

  if (!context) {
    throw new Error(
      "Header DATA_APLIKASI tidak terdeteksi."
    );
  }

  const out = [];
  const seen = {};

  for (
    let i = context.headerIndex + 1;
    i < values.length;
    i++
  ) {

    const row = values[i];

    const subKomponen = headerValue_(
      row,
      context.map,
      [
        "Sub Komponen",
        "Subkomponen",
        "Nama Sub Komponen"
      ]
    );

    const kodeSubKomponen = headerValue_(
      row,
      context.map,
      [
        "Kode Sub Komponen",
        "KodeSubKomponen"
      ]
    );

    const akun = headerValue_(
      row,
      context.map,
      [
        "Akun Belanja",
        "Akun"
      ]
    );

    const itemAkun = headerValue_(
      row,
      context.map,
      [
        "Item Akun",
        "Item"
      ]
    );

    const detilAkun = headerValue_(
      row,
      context.map,
      [
        "Detil Akun",
        "Detail Akun",
        "Detil"
      ]
    );

    const rincianItem = headerValue_(
      row,
      context.map,
      [
        "Rincian Item",
        "Rincian"
      ]
    );

    const idAnggaran = headerValue_(
      row,
      context.map,
      [
        "ID_ANGGARAN",
        "ID ANGGARAN"
      ]
    );

    const pagu = parseAmount_(
      headerValue_(
        row,
        context.map,
        ["Pagu"]
      )
    );

    let realisasiKolom = parseAmount_(
      headerValue_(
        row,
        context.map,
        [
          "Realisasi",
          "Jumlah Realisasi"
        ]
      )
    );

    const bulanRealisasi = [
      "Januari",
      "Februari",
      "Maret",
      "April",
      "Mei",
      "Juni",
      "Juli",
      "Agustus",
      "September",
      "Oktober",
      "November",
      "Desember"
    ];

    const realisasiBulanan =
      bulanRealisasi.reduce(
        function (sum, bulan) {
          return sum + parseAmount_(
            headerValue_(
              row,
              context.map,
              [bulan]
            )
          );
        },
        0
      );

    // Jika kolom Realisasi sudah berisi nilai positif, gunakan nilai
    // resmi tersebut. Jika kosong/0, gunakan penjumlahan bulanan.
    const realisasi =
      realisasiKolom > 0
        ? realisasiKolom
        : realisasiBulanan;

    const status = headerValue_(
      row,
      context.map,
      [
        "Status Pagu",
        "Status"
      ]
    );

    const tahun =
      headerValue_(
        row,
        context.map,
        [
          "Tahun",
          "Tahun Anggaran"
        ]
      ) ||
      new Date().getFullYear();

    if (
      !subKomponen ||
      !akun ||
      pagu <= 0
    ) {
      continue;
    }

    if (
      /blok/i.test(
        String(status)
      )
    ) {
      continue;
    }

    const id = makeStableRpdId_(
      tahun,
      kodeSubKomponen,
      subKomponen,
      akun,
      itemAkun,
      detilAkun,
      rincianItem
    );

    if (seen[id]) {
      continue;
    }

    seen[id] = true;

    out.push({
      rowIndex: i,
      id_rpd: id,
      tahun: String(tahun),
      kodeSubKomponen: kodeSubKomponen || "",
      subKomponen: subKomponen,
      akun: akun,
      itemAkun: itemAkun || "",
      detilAkun: detilAkun || "",
      rincianItem: rincianItem || "",
      id_anggaran:
        idAnggaran ||
        makeStableRpdId_(
          tahun,
          kodeSubKomponen,
          subKomponen,
          akun,
          itemAkun,
          detilAkun,
          rincianItem
        ),
      pagu: pagu,
      realisasi: realisasi
    });
  }

  return enrichMasterWithFinalRealisasi_(out);
}

// ============================================================
// REALISASI FINAL UNTUK RPD
// ============================================================

function enrichMasterWithFinalRealisasi_(master) {
  const rows = readRealisasi_(getRealisasiSheet_());
  const byId = new Map();
  const byIdentity = new Map();

  rows.forEach(item => {
    if (
      String(item.status || "AKTIF").toUpperCase() !== "AKTIF" ||
      !(Number(item.nominal_realisasi) > 0)
    ) {
      return;
    }

    const nominal = Number(item.nominal_realisasi) || 0;
    const id = String(item.id_anggaran || "").trim();

    if (id) {
      byId.set(id, (byId.get(id) || 0) + nominal);
    }

    const identity = makeStableRpdId_(
      item.tahun,
      item.kode_sub_komponen,
      item.sub_komponen,
      item.akun,
      item.item_akun,
      item.detil_akun,
      item.rincian_item
    );

    if (identity) {
      byIdentity.set(identity, (byIdentity.get(identity) || 0) + nominal);
    }
  });

  return master.map(item => {
    const realisasiDasar = Number(item.realisasi) || 0;
    const explicitId = String(item.id_anggaran || "").trim();
    const identity = String(item.id_rpd || "").trim();

    const realisasiInput =
      (explicitId && byId.get(explicitId) !== undefined)
        ? byId.get(explicitId)
        : (byIdentity.get(identity) || 0);

    const realisasiFinal = realisasiDasar + realisasiInput;
    const pagu = Number(item.pagu) || 0;

    return {
      ...item,
      realisasiDasar,
      realisasiInput,
      realisasi: realisasiFinal,
      sisa: Math.max(pagu - realisasiFinal, 0),
      persen: pagu > 0 ? (realisasiFinal / pagu) * 100 : 0
    };
  });
}

// ============================================================
// READ RPD
// ============================================================

function readRpd_(
  sheet
) {

  ensureRpdSchema_(
    sheet
  );

  const values =
    sheet
      .getDataRange()
      .getValues();

  if (
    values.length < 2
  ) {
    return [];
  }

  const index =
    headerIndex_(
      values[0]
    );

  // Master terbaru menjadi sumber Pagu dan Realisasi.
  // RPD yang sudah tersimpan tetap dipertahankan berdasarkan ID stabil.
  let currentMasterById = new Map();

  try {

    const master =
      buildMasterFromDataAplikasi_();

    const masterRows = Array.isArray(master) ? master : [];

    currentMasterById =
      new Map(
        masterRows
          .map(function (item) {
            return [
              String(
                item.id_rpd || ""
              ).trim(),
              item
            ];
          })
      );

    var currentMasterByAnggaranId =
      new Map(
        masterRows
          .map(function (item) {
            return [
              String(
                item.id_anggaran || ""
              ).trim(),
              item
            ];
          })
          .filter(function (pair) {
            return pair[0] !== "";
          })
      );

  } catch (error) {

    console.warn(
      "Master terbaru RPD tidak dapat dimuat:",
      error.message
    );

    var currentMasterByAnggaranId = new Map();
  }

  const generationColumn =
    index.DATA_GENERATION !== undefined
      ? index.DATA_GENERATION
      : -1;

  return values
    .slice(1)
    .filter(function (row) {

      if (!row.some(function (cell) {
        return String(cell || "").trim() !== "";
      })) {
        return false;
      }

      // Record tanpa generation dianggap legacy dan tidak boleh
      // dihidupkan kembali setelah reset generasi.
      if (
        generationColumn >= 0 &&
        String(row[generationColumn] || "").trim() !== RPD_DATA_GENERATION
      ) {
        return false;
      }

      return true;
    })
    .map(function (row) {

      const tahun =
        String(
          row[index.TAHUN] ||
          ""
        );

      const kodeSub =
        String(
          row[index.KODE_SUB_KOMPONEN] ||
          ""
        );

      const sub =
        String(
          row[index.SUB_KOMPONEN] ||
          ""
        );

      const akun =
        String(
          row[index.AKUN] ||
          ""
        );

      const item =
        String(
          row[index.ITEM_AKUN] ||
          ""
        );

      const detil =
        String(
          row[index.DETIL_AKUN] ||
          ""
        );

      const rincian =
        String(
          row[index.RINCIAN_ITEM] ||
          ""
        );

      const paguLama =
        parseAmount_(
          row[index.PAGU_DETIL]
        );

      const storedAnggaranId =
        index.ID_ANGGARAN !== undefined
          ? String(row[index.ID_ANGGARAN] || "").trim()
          : "";

      const generatedIdentityId =
        makeStableRpdId_(
          tahun,
          kodeSub,
          sub,
          akun,
          item,
          detil,
          rincian
        );

      const currentMaster =
        (storedAnggaranId
          ? currentMasterByAnggaranId.get(storedAnggaranId)
          : null) ||
        currentMasterById.get(
          generatedIdentityId
        );

      const result = {

        data_generation:
          RPD_DATA_GENERATION,

        id_rpd:
          currentMaster
            ? String(currentMaster.id_rpd || "")
            : generatedIdentityId,

        id_anggaran:
          currentMaster
            ? String(currentMaster.id_anggaran || "")
            : storedAnggaranId,

        tahun:
          tahun,

        kode_sub_komponen:
          kodeSub,

        sub_komponen:
          sub,

        akun:
          akun,

        item_akun:
          item,

        detil_akun:
          detil,

        rincian_item:
          rincian,

        pagu_detil:
          currentMaster
            ? parseAmount_(
                currentMaster.pagu
              )
            : paguLama,

        realisasi:
          currentMaster
            ? parseAmount_(
                currentMaster.realisasi
              )
            : 0,

        tw1:
          parseAmount_(
            row[index.TW1]
          ),

        tw2:
          parseAmount_(
            row[index.TW2]
          ),

        tw3:
          parseAmount_(
            row[index.TW3]
          ),

        tw4:
          parseAmount_(
            row[index.TW4]
          ),

        total_rpd:
          parseAmount_(
            row[index.TOTAL_RPD]
          ),

        catatan:
          String(
            row[index.CATATAN] ||
            ""
          ),

        updated_at:
          row[index.UPDATED_AT] ||
          "",

        updated_by:
          String(
            row[index.UPDATED_BY] ||
            ""
          )
      };

      const months = [
        "JAN",
        "FEB",
        "MAR",
        "APR",
        "MEI",
        "JUN",
        "JUL",
        "AGU",
        "SEP",
        "OKT",
        "NOV",
        "DES"
      ];

      months.forEach(
        function (month) {

          for (
            let week = 1;
            week <= 4;
            week++
          ) {

            const key =
              month +
              "_M" +
              week;

            const prop =
              month.toLowerCase() +
              "_m" +
              week;

            result[prop] =
              parseAmount_(
                row[index[key]]
              );
          }
        }
      );

      return result;
    });
}
// ============================================================
// SAVE RPD
// ============================================================

function saveRpd_(
  idToken,
  row
) {

  const user =
    authenticate_(
      idToken
    ).user;

  if (
    !row ||
    !row.id_rpd
  ) {

    throw new Error(
      "ID RPD tidak lengkap."
    );
  }

  const sheet =
    getSpreadsheet_()
      .getSheetByName(
        RPD_SHEETS.RPD
      );

  if (!sheet) {

    throw new Error(
      "Sheet RPD belum dibuat."
    );
  }

  ensureRpdSchema_(
    sheet
  );

  const index =
    headerIndex_(
      sheet
        .getRange(
          1,
          1,
          1,
          sheet.getLastColumn()
        )
        .getValues()[0]
    );

  const pagu =
    parseAmount_(
      row.pagu_detil
    );

  // ========================================================
  // 48 SLOT
  // ========================================================

  const weeklyValues = {};

  const months = [
    "jan",
    "feb",
    "mar",
    "apr",
    "mei",
    "jun",
    "jul",
    "agu",
    "sep",
    "okt",
    "nov",
    "des"
  ];

  months.forEach(
    function (month) {

      for (
        let week = 1;
        week <= 4;
        week++
      ) {

        const key =
          month +
          "_m" +
          week;

        weeklyValues[key] =
          parseAmount_(
            row[key]
          );
      }
    }
  );

  const weekList =
    Object.values(
      weeklyValues
    );

  if (
    weekList.some(
      function (value) {
        return value < 0;
      }
    )
  ) {

    throw new Error(
      "Nilai RPD mingguan tidak boleh negatif."
    );
  }

  const tw1 =
    weekList
      .slice(0, 12)
      .reduce(
        function (a, b) {
          return a + b;
        },
        0
      );

  const tw2 =
    weekList
      .slice(12, 24)
      .reduce(
        function (a, b) {
          return a + b;
        },
        0
      );

  const tw3 =
    weekList
      .slice(24, 36)
      .reduce(
        function (a, b) {
          return a + b;
        },
        0
      );

  const tw4 =
    weekList
      .slice(36, 48)
      .reduce(
        function (a, b) {
          return a + b;
        },
        0
      );

  const total =
    tw1 +
    tw2 +
    tw3 +
    tw4;

  const requestedId =
    String(
      row.id_rpd || ""
    ).trim();

  const requestedAnggaranId =
    String(
      row.id_anggaran ||
      row.ID_ANGGARAN ||
      ""
    ).trim();

  // ========================================================
  // REALISASI TERKINI DAN SISA UNTUK RPD
  // ========================================================

  const master =
    buildMasterFromDataAplikasi_();

  let targetMaster =
    requestedAnggaranId
      ? master.find(function (item) {
          return String(item.id_anggaran || "").trim() === requestedAnggaranId;
        })
      : null;

  if (!targetMaster) {
    targetMaster =
      master.find(
        function (item) {

          return (
            String(
              item.id_rpd || ""
            ).trim() ===
            requestedId
          );

        }
      );
  }

  // Kompatibilitas untuk client/record lama:
  // jika ID lama masih memakai Pagu, cari berdasarkan identitas
  // anggaran yang tidak berubah saat Revisi Anggaran.
  if (!targetMaster) {
    targetMaster =
      master.find(
        function (item) {
          return (
            String(item.tahun || "").trim() ===
              String(row.tahun || "").trim() &&
            String(item.kodeSubKomponen || "").trim() ===
              String(row.kode_sub_komponen || "").trim() &&
            String(item.subKomponen || "").trim() ===
              String(row.sub_komponen || "").trim() &&
            String(item.akun || "").trim() ===
              String(row.akun || "").trim() &&
            String(item.itemAkun || "").trim() ===
              String(row.item_akun || "").trim() &&
            String(item.detilAkun || "").trim() ===
              String(row.detil_akun || "").trim() &&
            String(item.rincianItem || "").trim() ===
              String(row.rincian_item || "").trim()
          );
        }
      );
  }

  const paguTerbaru =
    targetMaster
      ? parseAmount_(targetMaster.pagu)
      : pagu;

  const realisasiAktual =
    targetMaster
      ? parseAmount_(
          targetMaster.realisasi
        )
      : 0;

  const danaTersedia =
    Math.max(
      paguTerbaru -
      realisasiAktual,
      0
    );

  // ========================================================
  // CARI RECORD YANG SAMA
  // ========================================================
  // ========================================================
  // Pencocokan TIDAK menggunakan Pagu.
  // Tujuannya agar Revisi Anggaran tidak membuat RPD baru.

  const values =
    sheet
      .getDataRange()
      .getValues();

  let targetRow = -1;
  let oldData = null;

  for (
    let i = 1;
    i < values.length;
    i++
  ) {

    const currentId =
      String(
        values[i][index.ID_RPD] ||
        ""
      ).trim();

    const currentAnggaranId =
      index.ID_ANGGARAN !== undefined
        ? String(values[i][index.ID_ANGGARAN] || "").trim()
        : "";

    const targetAnggaranId =
      targetMaster
        ? String(targetMaster.id_anggaran || "").trim()
        : "";

    const sameAnggaranId =
      targetAnggaranId &&
      currentAnggaranId &&
      currentAnggaranId === targetAnggaranId;

    const sameId =
      requestedId &&
      (
        currentId ===
        requestedId
      );

    const sameIdentity =
      String(
        values[i][index.TAHUN] ||
        ""
      ) ===
      String(
        row.tahun || ""
      ) &&

      String(
        values[i][index.KODE_SUB_KOMPONEN] ||
        ""
      ).trim() ===
      String(
        row.kode_sub_komponen || ""
      ).trim() &&

      String(
        values[i][index.SUB_KOMPONEN] ||
        ""
      ).trim() ===
      String(
        row.sub_komponen || ""
      ).trim() &&

      String(
        values[i][index.AKUN] ||
        ""
      ).trim() ===
      String(
        row.akun || ""
      ).trim() &&

      String(
        values[i][index.ITEM_AKUN] ||
        ""
      ).trim() ===
      String(
        row.item_akun || ""
      ).trim() &&

      String(
        values[i][index.DETIL_AKUN] ||
        ""
      ).trim() ===
      String(
        row.detil_akun || ""
      ).trim() &&

      String(
        values[i][index.RINCIAN_ITEM] ||
        ""
      ).trim() ===
      String(
        row.rincian_item || ""
      ).trim();

    if (
      sameAnggaranId ||
      sameId ||
      sameIdentity
    ) {

      targetRow =
        i + 1;

      oldData =
        values[i].slice();

      break;
    }
  }

  // ========================================================
  // VALIDASI RPD: RPD LAMA + RUANG RPD YANG MASIH TERSEDIA
  // ========================================================
  // RPD yang sudah tersimpan tetap sah ketika Realisasi bertambah.
  // Hanya ruang yang belum direncanakan yang dapat ditambahkan.
  let rpdLama = 0;

  if (oldData) {
    months.forEach(function (month) {
      for (let week = 1; week <= 4; week++) {
        const column = month.toUpperCase() + "_M" + week;
        if (index[column] !== undefined) {
          rpdLama += parseAmount_(oldData[index[column]]);
        }
      }
    });
  }

  const ruangRpdBaru = Math.max(
    paguTerbaru - realisasiAktual - rpdLama,
    0
  );

  const kapasitasRpd = Math.min(
    paguTerbaru,
    rpdLama + ruangRpdBaru
  );

  const rpdExcess =
    Math.max(total - kapasitasRpd, 0);

  const rpdWarning =
    rpdExcess > 0
      ? (
          "RPD melebihi batas yang masih dapat direncanakan sebesar " +
          formatRevisionRupiah_(rpdExcess) +
          "."
        )
      : "";

  const stableId =
    targetMaster
      ? String(targetMaster.id_rpd || "").trim()
      : makeStableRpdId_(
          row.tahun,
          row.kode_sub_komponen,
          row.sub_komponen,
          row.akun,
          row.item_akun,
          row.detil_akun,
          row.rincian_item
        );

  const idAnggaran =
    targetMaster
      ? String(targetMaster.id_anggaran || "").trim()
      : "";

  const record = {

    data_generation:
      RPD_DATA_GENERATION,

    id_rpd:
      stableId,

    id_anggaran:
      idAnggaran,

    tahun:
      String(
        row.tahun || ""
      ),

    kode_sub_komponen:
      String(
        row.kode_sub_komponen ||
        ""
      ),

    sub_komponen:
      String(
        row.sub_komponen ||
        ""
      ),

    akun:
      String(
        row.akun ||
        ""
      ),

    item_akun:
      String(
        row.item_akun ||
        ""
      ),

    detil_akun:
      String(
        row.detil_akun ||
        ""
      ),

    rincian_item:
      String(
        row.rincian_item ||
        ""
      ),

    pagu_detil:
      paguTerbaru,

    tw1:
      tw1,

    tw2:
      tw2,

    tw3:
      tw3,

    tw4:
      tw4,

    total_rpd:
      total,

    catatan:
      String(
        row.catatan ||
        ""
      ),

    updated_at:
      new Date(),

    updated_by:
      user.email
  };

  const output =
    new Array(
      sheet.getLastColumn()
    ).fill("");

  output[index.ID_RPD] =
    record.id_rpd;

  if (index.ID_ANGGARAN !== undefined) {
    output[index.ID_ANGGARAN] =
      record.id_anggaran;
  }

  if (index.DATA_GENERATION !== undefined) {
    output[index.DATA_GENERATION] =
      record.data_generation;
  }

  output[index.TAHUN] =
    record.tahun;

  output[index.KODE_SUB_KOMPONEN] =
    record.kode_sub_komponen;

  output[index.SUB_KOMPONEN] =
    record.sub_komponen;

  output[index.AKUN] =
    record.akun;

  output[index.ITEM_AKUN] =
    record.item_akun;

  output[index.DETIL_AKUN] =
    record.detil_akun;

  output[index.RINCIAN_ITEM] =
    record.rincian_item;

  output[index.PAGU_DETIL] =
    record.pagu_detil;

  output[index.TW1] =
    record.tw1;

  output[index.TW2] =
    record.tw2;

  output[index.TW3] =
    record.tw3;

  output[index.TW4] =
    record.tw4;

  output[index.TOTAL_RPD] =
    record.total_rpd;

  months.forEach(
    function (month) {

      for (
        let week = 1;
        week <= 4;
        week++
      ) {

        const prop =
          month +
          "_m" +
          week;

        const column =
          month.toUpperCase() +
          "_M" +
          week;

        if (
          index[column] !==
          undefined
        ) {

          output[index[column]] =
            weeklyValues[prop];

        }

      }

    }
  );

  output[index.CATATAN] =
    record.catatan;

  output[index.UPDATED_AT] =
    record.updated_at;

  output[index.UPDATED_BY] =
    record.updated_by;

  if (
    targetRow > 0
  ) {

    sheet
      .getRange(
        targetRow,
        1,
        1,
        sheet.getLastColumn()
      )
      .setValues([
        output
      ]);

    writeLog_(
      "UPDATE",
      record,
      oldData,
      user.email
    );

  } else {

    sheet.appendRow(
      output
    );

    writeLog_(
      "INSERT",
      record,
      null,
      user.email
    );
  }

  return {

    ok: true,

    message:
      rpdWarning ||
      "RPD tersimpan.",

    warning:
      rpdWarning,

    rpd_excess:
      rpdExcess,

    pagu_detil:
      paguTerbaru,

    realisasi_aktual:
      realisasiAktual,

    dana_tersedia:
      danaTersedia,

    data:
      record
  };
}
// ============================================================
// LOG RPD
// ============================================================

function writeLog_(
  action,
  record,
  oldData,
  email
) {

  const sheet =
    getSpreadsheet_()
      .getSheetByName(
        RPD_SHEETS.LOG
      );

  if (!sheet) {
    return;
  }

  sheet.appendRow([

    new Date(),

    action,

    record.id_rpd,

    email,

    oldData
      ? JSON.stringify(
          oldData
        )
      : "",

    JSON.stringify(
      record
    )

  ]);
}

// ============================================================
// STABLE ID
// ============================================================

function makeStableRpdId_(
  tahun,
  kodeSub,
  sub,
  akun,
  item,
  detil,
  rincian
) {

  return [
    tahun,
    kodeSub,
    sub,
    akun,
    item,
    detil,
    rincian
  ]
    .map(
      normalizeKey_
    )
    .join("|");
}

function makeRpdId_(
  tahun,
  kodeSub,
  sub,
  akun,
  item,
  detil,
  rincian,
  paguDetil
) {

  return [

    tahun,
    kodeSub,
    sub,
    akun,
    item,
    detil,
    rincian,
    paguDetil

  ]
    .map(
      normalizeKey_
    )
    .join("|");
}

function normalizeKey_(
  value
) {

  return String(
    value || ""
  )
    .trim()
    .toUpperCase()
    .replace(
      /\s+/g,
      " "
    )
    .replace(
      /\|/g,
      "/"
    );
}

// ============================================================
// DETEKSI HEADER
// ============================================================

function detectHeader_(
  values
) {

  const max =
    Math.min(
      values.length,
      10
    );

  for (
    let r = 0;
    r < max;
    r++
  ) {

    const map =
      headerIndex_(

// ============================================================
// TU API v1.0 — TERPISAH DARI P3HPL
// ============================================================
const TU_SHEETS_={DATA:"DATA_ANGGARAN_TU",REALISASI:"REALISASI_TU",RPD:"RPD_TU",REVISI:"REVISI_TU"};
const TU_DATA_HEADERS_=["ID_TU","TAHUN","KODE_PROGRAM","PROGRAM","KODE_KEGIATAN","KEGIATAN","KODE_OUTPUT","OUTPUT","KODE_SUB_OUTPUT","SUB_OUTPUT","KODE_KOMPONEN","KOMPONEN","KODE_SUB_KOMPONEN","SUB_KOMPONEN","KODE_AKUN","AKUN","KODE_ITEM","RINCIAN_ITEM","PAGU_REVISI","LOCK_PAGU","REALISASI_DASAR","STATUS","CREATED_AT","CREATED_BY","UPDATED_AT","UPDATED_BY"];
const TU_REALISASI_HEADERS_=["ID_REALISASI_TU","ID_TU","TAHUN","TANGGAL_REALISASI","BULAN_REALISASI","NOMINAL_REALISASI","KETERANGAN","STATUS","CREATED_AT","CREATED_BY","UPDATED_AT","UPDATED_BY"];
const TU_RPD_HEADERS_=["ID_RPD_TU","ID_TU","TAHUN","TW1","TW2","TW3","TW4","TOTAL_RPD","JAN_M1","JAN_M2","JAN_M3","JAN_M4","FEB_M1","FEB_M2","FEB_M3","FEB_M4","MAR_M1","MAR_M2","MAR_M3","MAR_M4","APR_M1","APR_M2","APR_M3","APR_M4","MEI_M1","MEI_M2","MEI_M3","MEI_M4","JUN_M1","JUN_M2","JUN_M3","JUN_M4","JUL_M1","JUL_M2","JUL_M3","JUL_M4","AGU_M1","AGU_M2","AGU_M3","AGU_M4","SEP_M1","SEP_M2","SEP_M3","SEP_M4","OKT_M1","OKT_M2","OKT_M3","OKT_M4","NOV_M1","NOV_M2","NOV_M3","NOV_M4","DES_M1","DES_M2","DES_M3","DES_M4","CATATAN","UPDATED_AT","UPDATED_BY"];
const TU_REVISI_HEADERS_=["ID_REVISI_TU","ID_TU","TAHUN","PAGU_LAMA","PAGU_BARU","SELISIH_PAGU","JENIS_REVISI","TANGGAL_REVISI","ALASAN","STATUS","CREATED_AT","CREATED_BY"];

function tuAuthorize_(idToken){const a=authenticate_(idToken);const user=a.user||{};if(String(user.role||"").toUpperCase()!=="OPERATOR")throw new Error("Hak akses TU hanya untuk Operator.");return {email:user.email||"",name:user.name||"",role:user.role||"OPERATOR"};}
function tuText_(v){return String(v==null?"":v).trim();}
function tuYear_(v){const n=Number(v);if(!Number.isInteger(n)||n<2000||n>2100)throw new Error("Tahun TU tidak valid.");return n;}
function tuNum_(v){const n=parseAmount_(v);return Number.isFinite(n)?n:0;}
function tuPos_(v,l){const n=tuNum_(v);if(!(n>0))throw new Error(l+" harus lebih besar dari 0.");return n;}
function tuNN_(v,l){const n=tuNum_(v);if(n<0)throw new Error(l+" tidak boleh negatif.");return n;}
function tuStatus_(v,d){const s=tuText_(v).toUpperCase();return s||d;}
function tuMap_(h){const m={};(h||[]).forEach((v,i)=>{const k=tuText_(v).toUpperCase().replace(/[.\- ]+/g,"_");if(k)m[k]=i;});return m;}

function tuSheet_(name,headers){
  const ss=getSpreadsheet_();let s=ss.getSheetByName(name);if(!s)s=ss.insertSheet(name);
  const last=Math.max(s.getLastColumn(),1),cur=s.getRange(1,1,1,last).getValues()[0],norm=cur.map(v=>tuText_(v).toUpperCase());
  if(!norm.some(Boolean))s.getRange(1,1,1,headers.length).setValues([headers]);
  else {const missing=headers.filter(h=>norm.indexOf(h)<0);if(missing.length)s.getRange(1,s.getLastColumn()+1,1,missing.length).setValues([missing]);}
  return s;
}
function tuObject_(row,map){const o={};Object.keys(map).forEach(k=>o[k]=row[map[k]]);return o;}
function tuFindMaster_(id,year){
  const s=tuSheet_(TU_SHEETS_.DATA,TU_DATA_HEADERS_),v=s.getDataRange().getValues();if(v.length<2)return null;const m=tuMap_(v[0]);
  for(let i=1;i<v.length;i++)if(tuText_(v[i][m.ID_TU])===tuText_(id)&&String(v[i][m.TAHUN])===String(year)){const o=tuObject_(v[i],m);o.__row=i+1;o.__map=m;return o;}return null;
}
function tuMasters_(year){
  const s=tuSheet_(TU_SHEETS_.DATA,TU_DATA_HEADERS_),v=s.getDataRange().getValues();if(v.length<2)return [];const m=tuMap_(v[0]),out=[];
  for(let i=1;i<v.length;i++){if(String(v[i][m.TAHUN])!==String(year)||tuStatus_(v[i][m.STATUS],"AKTIF")!=="AKTIF")continue;const o=tuObject_(v[i],m);o.__row=i+1;out.push(o);}return out;
}
function tuRealisasiRows_(year,id,activeOnly){
  const s=tuSheet_(TU_SHEETS_.REALISASI,TU_REALISASI_HEADERS_),v=s.getDataRange().getValues();if(v.length<2)return [];const m=tuMap_(v[0]),out=[];
  for(let i=1;i<v.length;i++){if(String(v[i][m.TAHUN])!==String(year)||id&&tuText_(v[i][m.ID_TU])!==tuText_(id))continue;if(activeOnly&&tuStatus_(v[i][m.STATUS],"AKTIF")!=="AKTIF")continue;const o=tuObject_(v[i],m);o.__row=i+1;o.__map=m;o.__sheet=s;out.push(o);}return out;
}
function tuRpdRows_(year,id){
  const s=tuSheet_(TU_SHEETS_.RPD,TU_RPD_HEADERS_),v=s.getDataRange().getValues();if(v.length<2)return [];const m=tuMap_(v[0]),out=[];
  for(let i=1;i<v.length;i++){if(String(v[i][m.TAHUN])!==String(year)||id&&tuText_(v[i][m.ID_TU])!==tuText_(id))continue;const o=tuObject_(v[i],m);o.__row=i+1;o.__map=m;o.__sheet=s;out.push(o);}return out;
}
function tuRevisionRows_(year,id){
  const s=tuSheet_(TU_SHEETS_.REVISI,TU_REVISI_HEADERS_),v=s.getDataRange().getValues();if(v.length<2)return [];const m=tuMap_(v[0]),out=[];
  for(let i=1;i<v.length;i++){if(String(v[i][m.TAHUN])!==String(year)||id&&tuText_(v[i][m.ID_TU])!==tuText_(id))continue;const o=tuObject_(v[i],m);o.__row=i+1;out.push(o);}return out;
}
function tuActiveReal_(year,id){return tuRealisasiRows_(year,id,true);}
function tuFinal_(master,rows){const dasar=tuNum_(master.REALISASI_DASAR),input=rows.reduce((a,r)=>a+tuNum_(r.NOMINAL_REALISASI),0);return {dasar,input,final:dasar+input};}
function tuAssert_(m){if(!m)throw new Error("ID_TU tidak ditemukan untuk tahun tersebut.");if(tuStatus_(m.STATUS,"AKTIF")!=="AKTIF")throw new Error("Data TU tidak aktif.");if(tuStatus_(m.LOCK_PAGU,"TIDAK")==="YA")throw new Error("Pagu TU sedang BLOKIR.");}
function tuDate_(v){if(v instanceof Date&&!isNaN(v))return v;const d=new Date(tuText_(v));if(!tuText_(v)||isNaN(d))throw new Error("Tanggal tidak valid.");return d;}
function tuMonth_(v){const n=Number(v);if(!Number.isInteger(n)||n<1||n>12)throw new Error("Bulan realisasi harus 1 sampai 12.");return n;}
function tuNextId_(s,prefix,year,col){const v=s.getDataRange().getValues(),m=tuMap_(v[0]||[]),pre=prefix+year+"-",idx=m[col];let max=0;for(let i=1;i<v.length;i++){const x=tuText_(v[i][idx]);if(x.indexOf(pre)!==0)continue;const n=Number(x.slice(pre.length));if(Number.isInteger(n)&&n>max)max=n;}return pre+String(max+1).padStart(6,"0");}
function tuSummary_(m,active,rpd){const pagu=tuNum_(m.PAGU_REVISI),real=tuFinal_(m,active),rpdTotal=rpd?tuNum_(rpd.TOTAL_RPD):0;return{pagu_revisi:pagu,lock_pagu:tuStatus_(m.LOCK_PAGU,"TIDAK"),realisasi_dasar:real.dasar,realisasi_input:real.input,realisasi_final:real.final,dana_tersedia:Math.max(pagu-real.final,0),persentase:pagu>0?real.final/pagu*100:0,total_rpd:rpdTotal,sisa_rpd:Math.max(pagu-real.final-rpdTotal,0)};}
function tuMasterOut_(m){const active=tuActiveReal_(m.TAHUN,m.ID_TU),rr=tuRpdRows_(m.TAHUN,m.ID_TU),s=tuSummary_(m,active,rr[0]);return Object.assign({id_tu:tuText_(m.ID_TU),tahun:Number(m.TAHUN),kode_program:tuText_(m.KODE_PROGRAM),program:tuText_(m.PROGRAM),kode_kegiatan:tuText_(m.KODE_KEGIATAN),kegiatan:tuText_(m.KEGIATAN),kode_output:tuText_(m.KODE_OUTPUT),output:tuText_(m.OUTPUT),kode_sub_output:tuText_(m.KODE_SUB_OUTPUT),sub_output:tuText_(m.SUB_OUTPUT),kode_komponen:tuText_(m.KODE_KOMPONEN),komponen:tuText_(m.KOMPONEN),kode_sub_komponen:tuText_(m.KODE_SUB_KOMPONEN),sub_komponen:tuText_(m.SUB_KOMPONEN),kode_akun:tuText_(m.KODE_AKUN),akun:tuText_(m.AKUN),kode_item:tuText_(m.KODE_ITEM),rincian_item:tuText_(m.RINCIAN_ITEM),status:tuStatus_(m.STATUS,"AKTIF")},s);}
function tuWeekly_(req){const months=["JAN","FEB","MAR","APR","MEI","JUN","JUL","AGU","SEP","OKT","NOV","DES"],list=[],out={};months.forEach((mon)=>{for(let w=1;w<=4;w++){const k=mon.toLowerCase()+"_m"+w,n=tuNN_(req[k],k);out[k]=n;list.push(n);}});return{out,list,tw1:list.slice(0,12).reduce((a,b)=>a+b,0),tw2:list.slice(12,24).reduce((a,b)=>a+b,0),tw3:list.slice(24,36).reduce((a,b)=>a+b,0),tw4:list.slice(36,48).reduce((a,b)=>a+b,0),months};}

function tuBootstrap_(token,p){const user=tuAuthorize_(token),year=tuYear_(p.tahun);return{ok:true,user,tahun:year,master:tuMasters_(year).map(tuMasterOut_)};}
function tuRealisasiList_(token,p){const user=tuAuthorize_(token),year=tuYear_(p.tahun),id=tuText_(p.id_tu);let rows=tuRealisasiRows_(year,id,false);const status=tuText_(p.status).toUpperCase(),month=p.bulan==null||p.bulan===""?null:Number(p.bulan);if(month!=null&&(!Number.isInteger(month)||month<1||month>12))throw new Error("Filter bulan tidak valid.");if(status)rows=rows.filter(r=>tuStatus_(r.STATUS,"AKTIF")===status);if(month!=null)rows=rows.filter(r=>Number(r.BULAN_REALISASI)===month);return{ok:true,user,tahun:year,data:rows.map(r=>({id_realisasi_tu:tuText_(r.ID_REALISASI_TU),id_tu:tuText_(r.ID_TU),tahun:Number(r.TAHUN),tanggal_realisasi:r.TANGGAL_REALISASI,bulan_realisasi:Number(r.BULAN_REALISASI),nominal_realisasi:tuNum_(r.NOMINAL_REALISASI),keterangan:tuText_(r.KETERANGAN),status:tuStatus_(r.STATUS,"AKTIF"),created_at:r.CREATED_AT,created_by:tuText_(r.CREATED_BY),updated_at:r.UPDATED_AT,updated_by:tuText_(r.UPDATED_BY)}))};}
function tuRealisasiSave_(token,req){const user=tuAuthorize_(token),year=tuYear_(req.tahun),id=tuText_(req.id_tu),m=tuFindMaster_(id,year);tuAssert_(m);const date=tuDate_(req.tanggal_realisasi),month=tuMonth_(req.bulan_realisasi),nom=tuPos_(req.nominal_realisasi,"Nominal realisasi"),real=tuFinal_(m,tuActiveReal_(year,id)),pagu=tuNum_(m.PAGU_REVISI);if(real.final+nom>pagu)throw new Error("Realisasi TU melebihi Pagu Revisi yang tersedia.");const s=tuSheet_(TU_SHEETS_.REALISASI,TU_REALISASI_HEADERS_),rid=tuNextId_(s,"RTU-",year,"ID_REALISASI_TU"),now=new Date();s.appendRow([rid,id,year,date,month,nom,tuText_(req.keterangan),"AKTIF",now,user.email,now,user.email]);return{ok:true,message:"Realisasi TU tersimpan.",id_realisasi_tu:rid,realisasi_final:real.final+nom,dana_tersedia:Math.max(pagu-real.final-nom,0)};}
function tuFindReal_(rid,year){const rows=tuRealisasiRows_(year,null,false);for(const r of rows)if(tuText_(r.ID_REALISASI_TU)===tuText_(rid))return r;return null;}
function tuRealisasiUpdate_(token,req){const user=tuAuthorize_(token),year=tuYear_(req.tahun),old=tuFindReal_(req.id_realisasi_tu,year);if(!old)throw new Error("ID_REALISASI_TU tidak ditemukan.");if(tuStatus_(old.STATUS,"AKTIF")!=="AKTIF")throw new Error("Transaksi realisasi sudah NONAKTIF.");const m=tuFindMaster_(old.ID_TU,year);tuAssert_(m);const date=tuDate_(req.tanggal_realisasi),month=tuMonth_(req.bulan_realisasi),nom=tuPos_(req.nominal_realisasi,"Nominal realisasi"),active=tuActiveReal_(year,old.ID_TU).filter(r=>r.__row!==old.__row),real=tuFinal_(m,active),pagu=tuNum_(m.PAGU_REVISI);if(real.final+nom>pagu)throw new Error("Realisasi TU melebihi Pagu Revisi yang tersedia.");const s=old.__sheet,mp=old.__map,now=new Date();s.getRange(old.__row,mp.TANGGAL_REALISASI+1).setValue(date);s.getRange(old.__row,mp.BULAN_REALISASI+1).setValue(month);s.getRange(old.__row,mp.NOMINAL_REALISASI+1).setValue(nom);s.getRange(old.__row,mp.KETERANGAN+1).setValue(tuText_(req.keterangan));s.getRange(old.__row,mp.UPDATED_AT+1).setValue(now);s.getRange(old.__row,mp.UPDATED_BY+1).setValue(user.email);return{ok:true,message:"Realisasi TU diperbarui.",id_realisasi_tu:tuText_(old.ID_REALISASI_TU),realisasi_final:real.final+nom,dana_tersedia:Math.max(pagu-real.final-nom,0)};}
function tuRealisasiDelete_(token,req){const user=tuAuthorize_(token),year=tuYear_(req.tahun),old=tuFindReal_(req.id_realisasi_tu,year);if(!old)throw new Error("ID_REALISASI_TU tidak ditemukan.");if(tuStatus_(old.STATUS,"AKTIF")!=="AKTIF")throw new Error("Transaksi realisasi sudah NONAKTIF.");const m=tuFindMaster_(old.ID_TU,year);tuAssert_(m);const s=old.__sheet,mp=old.__map,now=new Date();s.getRange(old.__row,mp.STATUS+1).setValue("NONAKTIF");s.getRange(old.__row,mp.UPDATED_AT+1).setValue(now);s.getRange(old.__row,mp.UPDATED_BY+1).setValue(user.email);const real=tuFinal_(m,tuActiveReal_(year,old.ID_TU));return{ok:true,message:"Realisasi TU dinonaktifkan.",id_realisasi_tu:tuText_(old.ID_REALISASI_TU),realisasi_final:real.final,dana_tersedia:Math.max(tuNum_(m.PAGU_REVISI)-real.final,0)};}
function tuRpdList_(token,p){const user=tuAuthorize_(token),year=tuYear_(p.tahun),id=tuText_(p.id_tu),masters=tuMasters_(year).filter(m=>!id||tuText_(m.ID_TU)===id),rpd=tuRpdRows_(year,id),by={};rpd.forEach(r=>by[tuText_(r.ID_TU)]=r);const months=["JAN","FEB","MAR","APR","MEI","JUN","JUL","AGU","SEP","OKT","NOV","DES"],data=masters.map(m=>{const r=by[tuText_(m.ID_TU)],real=tuFinal_(m,tuActiveReal_(year,m.ID_TU)),total=r?tuNum_(r.TOTAL_RPD):0,o={id_rpd_tu:r?tuText_(r.ID_RPD_TU):"TU-RPD-"+tuText_(m.ID_TU),id_tu:tuText_(m.ID_TU),tahun:year,pagu_revisi:tuNum_(m.PAGU_REVISI),realisasi_dasar:real.dasar,realisasi_input:real.input,realisasi_final:real.final,dana_tersedia:Math.max(tuNum_(m.PAGU_REVISI)-real.final,0),total_rpd:total,sisa_rpd:Math.max(tuNum_(m.PAGU_REVISI)-real.final-total,0),tw1:r?tuNum_(r.TW1):0,tw2:r?tuNum_(r.TW2):0,tw3:r?tuNum_(r.TW3):0,tw4:r?tuNum_(r.TW4):0,catatan:r?tuText_(r.CATATAN):"",updated_at:r?r.UPDATED_AT:"",updated_by:r?tuText_(r.UPDATED_BY):""};months.forEach(mon=>{for(let w=1;w<=4;w++)o[mon.toLowerCase()+"_m"+w]=r?tuNum_(r[mon+"_M"+w]):0;});return o;});return{ok:true,user,tahun:year,data};}
function tuRpdSave_(token,req){const user=tuAuthorize_(token),year=tuYear_(req.tahun),id=tuText_(req.id_tu),m=tuFindMaster_(id,year);tuAssert_(m);const w=tuWeekly_(req),total=w.list.reduce((a,b)=>a+b,0),real=tuFinal_(m,tuActiveReal_(year,id)),pagu=tuNum_(m.PAGU_REVISI),oldRows=tuRpdRows_(year,id),old=oldRows.length?oldRows[0]:null,oldTotal=old?tuNum_(old.TOTAL_RPD):0,additional=Math.max(total-oldTotal,0),available=Math.max(pagu-real.final,0);if(total>pagu)throw new Error("TOTAL RPD TU tidak boleh melebihi Pagu Revisi.");if(additional>available)throw new Error("RPD tambahan melebihi Dana Tersedia.");const s=tuSheet_(TU_SHEETS_.RPD,TU_RPD_HEADERS_),mp=tuMap_(s.getRange(1,1,1,s.getLastColumn()).getValues()[0]),out=new Array(s.getLastColumn()).fill(""),now=new Date(),rid=old?tuText_(old.ID_RPD_TU):tuNextId_(s,"RPD-TU-",year,"ID_RPD_TU");out[mp.ID_RPD_TU]=rid;out[mp.ID_TU]=id;out[mp.TAHUN]=year;out[mp.TW1]=w.tw1;out[mp.TW2]=w.tw2;out[mp.TW3]=w.tw3;out[mp.TW4]=w.tw4;out[mp.TOTAL_RPD]=total;Object.keys(w.out).forEach(k=>out[mp[k.toUpperCase()]]=w.out[k]);out[mp.CATATAN]=tuText_(req.catatan);out[mp.UPDATED_AT]=now;out[mp.UPDATED_BY]=user.email;if(old)s.getRange(old.__row,1,1,s.getLastColumn()).setValues([out]);else s.appendRow(out);return{ok:true,message:"RPD TU tersimpan.",id_rpd_tu:rid,total_rpd:total,dana_tersedia:available,sisa_rpd:Math.max(pagu-real.final-total,0),tw1:w.tw1,tw2:w.tw2,tw3:w.tw3,tw4:w.tw4};}
function tuRevisiList_(token,p){const user=tuAuthorize_(token),year=tuYear_(p.tahun),id=tuText_(p.id_tu);return{ok:true,user,tahun:year,data:tuRevisionRows_(year,id).map(r=>({id_revisi_tu:tuText_(r.ID_REVISI_TU),id_tu:tuText_(r.ID_TU),tahun:Number(r.TAHUN),pagu_lama:tuNum_(r.PAGU_LAMA),pagu_baru:tuNum_(r.PAGU_BARU),selisih_pagu:tuNum_(r.SELISIH_PAGU),jenis_revisi:tuText_(r.JENIS_REVISI),tanggal_revisi:r.TANGGAL_REVISI,alasan:tuText_(r.ALASAN),status:tuStatus_(r.STATUS,"AKTIF"),created_at:r.CREATED_AT,created_by:tuText_(r.CREATED_BY)}))};}
function tuRevisiSave_(token,req){
  const user=tuAuthorize_(token),year=tuYear_(req.tahun),id=tuText_(req.id_tu),m=tuFindMaster_(id,year);
  tuAssert_(m);
  const newPagu=tuNN_(req.pagu_baru,"Pagu Baru");
  const oldPagu=tuNum_(m.PAGU_REVISI);
  const real=tuFinal_(m,tuActiveReal_(year,id));
  const rr=tuRpdRows_(year,id);
  const rpdTotal=rr.length?tuNum_(rr[0].TOTAL_RPD):0;
  const minimum=Math.max(real.final,rpdTotal);

  if(newPagu<minimum){
    throw new Error("Pagu Baru tidak boleh lebih kecil dari Realisasi Final ("+
      formatRevisionRupiah_(real.final)+") maupun Total RPD Existing ("+
      formatRevisionRupiah_(rpdTotal)+").");
  }

  const ds=tuSheet_(TU_SHEETS_.DATA,TU_DATA_HEADERS_);
  const dm=tuMap_(ds.getRange(1,1,1,ds.getLastColumn()).getValues()[0]);
  const rs=tuSheet_(TU_SHEETS_.REVISI,TU_REVISI_HEADERS_);
  const rid=tuNextId_(rs,"REV-TU-",year,"ID_REVISI_TU");
  const now=new Date();

  // Simpan nilai lama agar perubahan Pagu dapat di-rollback
  // apabila penulisan history revisi gagal.
  ds.getRange(m.__row,dm.PAGU_REVISI+1).setValue(newPagu);
  ds.getRange(m.__row,dm.UPDATED_AT+1).setValue(now);
  ds.getRange(m.__row,dm.UPDATED_BY+1).setValue(user.email);
  SpreadsheetApp.flush();

  try{
    rs.appendRow([
      rid,id,year,oldPagu,newPagu,newPagu-oldPagu,
      tuText_(req.jenis_revisi),tuDate_(req.tanggal_revisi),
      tuText_(req.alasan),"AKTIF",now,user.email
    ]);
    SpreadsheetApp.flush();
  }catch(error){
    ds.getRange(m.__row,dm.PAGU_REVISI+1).setValue(oldPagu);
    ds.getRange(m.__row,dm.UPDATED_AT+1).setValue(m.UPDATED_AT||"");
    ds.getRange(m.__row,dm.UPDATED_BY+1).setValue(m.UPDATED_BY||"");
    SpreadsheetApp.flush();
    throw new Error("Revisi Pagu TU gagal dicatat. Perubahan Pagu dibatalkan: "+error.message);
  }

  return{
    ok:true,message:"Revisi Pagu TU tersimpan.",id_revisi_tu:rid,
    pagu_lama:oldPagu,pagu_baru:newPagu,selisih_pagu:newPagu-oldPagu,
    realisasi_final:real.final,total_rpd_existing:rpdTotal
  };
}
function tuMonitoring_(token,p){
  const user=tuAuthorize_(token),year=tuYear_(p.tahun),id=tuText_(p.id_tu);
  const masters=tuMasters_(year).filter(m=>!id||tuText_(m.ID_TU)===id);
  const rpd=tuRpdRows_(year,id),by={};
  rpd.forEach(r=>by[tuText_(r.ID_TU)]=r);
  const real=tuRealisasiRows_(year,id,true),rb={};
  real.forEach(r=>{const k=tuText_(r.ID_TU);(rb[k]||(rb[k]=[])).push(r);});

  let tp=0,td=0,ti=0,tf=0,ts=0,tr=0,tsr=0;
  const detail=masters.map(m=>{
    const a=rb[tuText_(m.ID_TU)]||[],s=tuSummary_(m,a,by[tuText_(m.ID_TU)]);
    tp+=s.pagu_revisi;td+=s.realisasi_dasar;ti+=s.realisasi_input;tf+=s.realisasi_final;
    ts+=s.dana_tersedia;tr+=s.total_rpd;tsr+=s.sisa_rpd;
    return tuMasterOut_(m);
  });

  const monthly={};
  real.forEach(r=>{
    const mo=Number(r.BULAN_REALISASI);
    monthly[mo]=(monthly[mo]||0)+tuNum_(r.NOMINAL_REALISASI);
  });

  const programMap={},kegiatanMap={};
  detail.forEach(d=>{
    const pk=tuText_(d.kode_program)||"(TANPA PROGRAM)";
    const kk=tuText_(d.kode_kegiatan)||"(TANPA KEGIATAN)";
    if(!programMap[pk])programMap[pk]={
      kode_program:d.kode_program,program:d.program,pagu_revisi:0,
      realisasi_dasar:0,realisasi_input:0,realisasi_final:0,
      sisa_anggaran:0,total_rpd:0,total_sisa_rpd:0
    };
    if(!kegiatanMap[kk])kegiatanMap[kk]={
      kode_kegiatan:d.kode_kegiatan,kegiatan:d.kegiatan,
      kode_program:d.kode_program,program:d.program,pagu_revisi:0,
      realisasi_dasar:0,realisasi_input:0,realisasi_final:0,
      sisa_anggaran:0,total_rpd:0,total_sisa_rpd:0
    };
    const pRow=programMap[pk],kRow=kegiatanMap[kk];
    [pRow,kRow].forEach(x=>{
      x.pagu_revisi+=d.pagu_revisi;
      x.realisasi_dasar+=d.realisasi_dasar;
      x.realisasi_input+=d.realisasi_input;
      x.realisasi_final+=d.realisasi_final;
      x.sisa_anggaran+=d.dana_tersedia;
      x.total_rpd+=d.total_rpd;
      x.total_sisa_rpd+=d.sisa_rpd;
    });
  });

  Object.values(programMap).forEach(x=>{
    x.persentase=x.pagu_revisi>0?x.realisasi_final/x.pagu_revisi*100:0;
  });
  Object.values(kegiatanMap).forEach(x=>{
    x.persentase=x.pagu_revisi>0?x.realisasi_final/x.pagu_revisi*100:0;
  });

  return{
    ok:true,user,tahun:year,
    summary:{
      total_pagu:tp,realisasi_dasar:td,realisasi_input:ti,
      realisasi_final:tf,sisa_anggaran:ts,
      persentase:tp>0?tf/tp*100:0,total_rpd:tr,total_sisa_rpd:tsr
    },
    monthly,
    program:Object.values(programMap),
    kegiatan:Object.values(kegiatanMap),
    detail
  };
}

