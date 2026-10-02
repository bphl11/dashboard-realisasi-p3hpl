// ============================================================
// APP-STORE.JS - P3HPHL
// Satu sumber data bersama untuk Dashboard, Grafik, Monitoring,
// dan Laporan.
//
// Tujuan:
// - DATA_APLIKASI hanya dimuat sekali sesuai cache API.
// - INPUT_REALISASI tetap mengikuti cache transaksi.
// - parseDataMonitoring() dan hitungCalculationEngine() tidak
//   dihitung ulang setiap perpindahan menu.
// - Setelah Save/Edit/Delete Realisasi, hanya hasil turunan
//   (parsed/calculation) yang di-invalidasi.
// ============================================================

const APP_STORE_KEY = "p3hpl_app_store_v2";
const APP_STORE_TTL = 2 * 60 * 1000;

let appStoreMemory = null;
let appStoreLoadingPromise = null;

function appStoreReadCache() {
    if (appStoreMemory && Array.isArray(appStoreMemory.rawData) &&
        Array.isArray(appStoreMemory.parsedData) &&
        appStoreMemory.calculation) {
        return appStoreMemory;
    }

    try {
        const raw = sessionStorage.getItem(APP_STORE_KEY);
        if (!raw) return null;

        const cached = JSON.parse(raw);
        if (!cached ||
            !Array.isArray(cached.rawData) ||
            !Array.isArray(cached.parsedData) ||
            !cached.calculation) {
            return null;
        }

        const timestamp = Number(cached.timestamp || 0);
        if (Date.now() - timestamp > APP_STORE_TTL) {
            sessionStorage.removeItem(APP_STORE_KEY);
            return null;
        }

        // Pulihkan metadata transaksi ke rawData. JSON.stringify()
        // tidak membawa property non-enumerable __inputRealisasi.
        if (typeof attachInputRealisasiToRawData === "function") {
            const inputCache =
                typeof bacaCacheInputRealisasi === "function"
                    ? bacaCacheInputRealisasi()
                    : null;

            const inputRows = Array.isArray(inputCache)
                ? inputCache
                : (Array.isArray(cached.inputRealisasi) ? cached.inputRealisasi : []);

            const masterCache =
                typeof bacaCacheMasterAnggaran === "function"
                    ? bacaCacheMasterAnggaran()
                    : null;

            const masterRows = Array.isArray(masterCache)
                ? masterCache
                : (Array.isArray(cached.anggaranMaster) ? cached.anggaranMaster : []);

            attachInputRealisasiToRawData(
                cached.rawData,
                inputRows,
                masterRows
            );

            const inputAt =
                typeof getInputRealisasiCacheTimestamp === "function"
                    ? getInputRealisasiCacheTimestamp()
                    : 0;

            const masterAt =
                typeof getMasterAnggaranCacheTimestamp === "function"
                    ? getMasterAnggaranCacheTimestamp()
                    : 0;

            const storedInputAt = Number(cached.inputRealisasiAt || 0);
            const storedMasterAt = Number(cached.anggaranMasterAt || 0);

            // Jangan mengembalikan parsed/calculation yang sudah basi ketika
            // transaksi atau master ID anggaran berubah di luar halaman ini.
            if (
                inputAt > storedInputAt ||
                masterAt > storedMasterAt ||
                !Array.isArray(cached.rawData.__inputRealisasi)
            ) {
                const parsedData =
                    typeof parseDataMonitoring === "function"
                        ? parseDataMonitoring(cached.rawData)
                        : [];

                const calculation =
                    typeof hitungCalculationEngine === "function"
                        ? hitungCalculationEngine(cached.rawData, parsedData)
                        : null;

                if (Array.isArray(parsedData) && calculation) {
                    cached.parsedData = parsedData;
                    cached.calculation = calculation;
                    cached.inputRealisasi = inputRows;
                    cached.anggaranMaster = masterRows;
                    cached.inputRealisasiAt = inputAt;
                    cached.anggaranMasterAt = masterAt;

                    try {
                        sessionStorage.setItem(
                            APP_STORE_KEY,
                            JSON.stringify(cached)
                        );
                    } catch (error) {}
                }
            }
        }

        appStoreMemory = cached;
        return cached;
    } catch (error) {
        console.warn("APP STORE cache tidak dapat dibaca:", error);
        return null;
    }
}

function appStoreWriteCache(state) {
    if (!state ||
        !Array.isArray(state.rawData) ||
        !Array.isArray(state.parsedData) ||
        !state.calculation) {
        return;
    }

    const inputRealisasi =
        state.rawData &&
        Array.isArray(state.rawData.__inputRealisasi)
            ? state.rawData.__inputRealisasi
            : [];

    const anggaranMaster =
        state.rawData &&
        Array.isArray(state.rawData.__anggaranMaster)
            ? state.rawData.__anggaranMaster
            : [];

    const inputRealisasiAt =
        typeof getInputRealisasiCacheTimestamp === "function"
            ? getInputRealisasiCacheTimestamp()
            : 0;

    const anggaranMasterAt =
        typeof getMasterAnggaranCacheTimestamp === "function"
            ? getMasterAnggaranCacheTimestamp()
            : 0;

    appStoreMemory = {
        timestamp: Date.now(),
        rawData: state.rawData,
        parsedData: state.parsedData,
        calculation: state.calculation,
        inputRealisasi: inputRealisasi,
        anggaranMaster: anggaranMaster,
        inputRealisasiAt: inputRealisasiAt,
        anggaranMasterAt: anggaranMasterAt
    };

    try {
        // rawData dapat memiliki metadata non-enumerable __inputRealisasi.
        // Metadata itu sengaja tidak disimpan di sessionStorage karena akan
        // ditempel kembali oleh api.js saat data dipakai.
        sessionStorage.setItem(
            APP_STORE_KEY,
            JSON.stringify(appStoreMemory)
        );
    } catch (error) {
        // Jika quota browser tidak cukup, memory cache tetap digunakan.
        console.warn("APP STORE cache tidak dapat disimpan:", error);
    }
}

function appStoreInvalidate() {
    appStoreMemory = null;
    appStoreLoadingPromise = null;

    try {
        sessionStorage.removeItem(APP_STORE_KEY);
    } catch (error) {
        console.warn("APP STORE cache tidak dapat dihapus:", error);
    }
}

// ============================================================
// PATCH REALISASI KE APP STORE
//
// Setelah Save/Edit/Delete, jangan buang snapshot lalu mengunduh ulang
// DATA_APLIKASI. Jika APP STORE sudah tersedia, cukup ubah metadata
// INPUT_REALISASI, parse ulang snapshot lokal, lalu hitung ulang.
// Parser dan Calculation Engine tetap dipakai apa adanya.
// ============================================================

function normalisasiAppStoreRealisasiRow(row) {
    if (!row) return null;

    return {
        id_realisasi: String(row.id_realisasi || ""),
        id_anggaran: String(row.id_anggaran || ""),
        tahun: String(row.tahun || ""),
        bulan: String(row.bulan || row.bulan_realisasi || ""),
        nominal_realisasi: Number(row.nominal_realisasi) || 0,
        kode_sub_komponen: String(row.kode_sub_komponen || ""),
        sub_komponen: String(row.sub_komponen || ""),
        akun: String(row.akun || ""),
        item_akun: String(row.item_akun || ""),
        detil_akun: String(row.detil_akun || ""),
        rincian_item: String(row.rincian_item || ""),
        pagu_detil: Number(row.pagu_detil) || 0,
        keterangan: String(row.keterangan || ""),
        status: String(row.status || "AKTIF"),
        created_at: row.created_at || "",
        created_by: String(row.created_by || ""),
        updated_at: row.updated_at || "",
        updated_by: String(row.updated_by || "")
    };
}

function appStorePatchRealisasi(action, result) {
    const state = appStoreReadCache();

    // Tidak membuat APP STORE parsial. Jika belum ada snapshot, halaman
    // berikutnya akan melakukan load normal dari sumber data.
    if (!state) return false;

    const normalizedAction = String(action || "").toLowerCase();
    const resultRow = normalisasiAppStoreRealisasiRow(result?.data);
    const resultId = String(
        result?.id_realisasi ||
        resultRow?.id_realisasi ||
        ""
    ).trim();

    let currentRows = [];

    if (Array.isArray(state.inputRealisasi)) {
        currentRows = state.inputRealisasi.slice();
    } else if (Array.isArray(state.rawData?.__inputRealisasi)) {
        currentRows = state.rawData.__inputRealisasi.slice();
    } else if (typeof bacaCacheInputRealisasi === "function") {
        const cachedRows = bacaCacheInputRealisasi();
        currentRows = Array.isArray(cachedRows) ? cachedRows.slice() : [];
    }

    if (
        (normalizedAction === "save" ||
         normalizedAction === "insert" ||
         normalizedAction === "update" ||
         normalizedAction === "edit") &&
        resultRow?.id_realisasi
    ) {
        currentRows = currentRows.filter(item =>
            String(item?.id_realisasi || "") !== resultRow.id_realisasi
        );
        currentRows.push(resultRow);
    } else if (normalizedAction === "delete" && resultId) {
        currentRows = currentRows.filter(item =>
            String(item?.id_realisasi || "") !== resultId
        );
    } else {
        return false;
    }

    // Raw master DATA_APLIKASI tetap sama. Hanya metadata transaksi yang
    // diperbarui, lalu parser dan calculation engine menghitung snapshot baru.
    attachInputRealisasiToRawData(state.rawData, currentRows);

    const parsedData =
        typeof parseDataMonitoring === "function"
            ? parseDataMonitoring(state.rawData)
            : [];

    if (!Array.isArray(parsedData)) {
        throw new Error("Patch APP STORE menghasilkan parser tidak valid.");
    }

    const calculation =
        typeof hitungCalculationEngine === "function"
            ? hitungCalculationEngine(state.rawData, parsedData)
            : null;

    if (!calculation) {
        throw new Error("Calculation Engine tidak tersedia untuk patch APP STORE.");
    }

    appStoreWriteCache({
        rawData: state.rawData,
        parsedData,
        calculation
    });

    return true;
}

async function appStoreLoad(forceRefresh = false) {
    if (!forceRefresh) {
        const cached = appStoreReadCache();
        if (cached) {
            return cached;
        }
    }

    if (appStoreLoadingPromise) {
        return await appStoreLoadingPromise;
    }

    appStoreLoadingPromise = (async function () {
        try {
            const rawData = await getSheetDataMonitoring();

            if (!Array.isArray(rawData)) {
                throw new Error("Data aplikasi tidak valid.");
            }

            const parsedData =
                typeof parseDataMonitoring === "function"
                    ? parseDataMonitoring(rawData)
                    : [];

            if (!Array.isArray(parsedData)) {
                throw new Error("Hasil parser tidak valid.");
            }

            const calculation =
                typeof hitungCalculationEngine === "function"
                    ? hitungCalculationEngine(rawData, parsedData)
                    : null;

            if (!calculation) {
                throw new Error("Calculation Engine tidak tersedia.");
            }

            const state = {
                rawData,
                parsedData,
                calculation
            };

            appStoreWriteCache(state);

            return state;
        } finally {
            appStoreLoadingPromise = null;
        }
    })();

    return await appStoreLoadingPromise;
}

// API publik untuk halaman.
window.appStore = {
    get: function () {
        return appStoreLoad(false);
    },

    refresh: function () {
        appStoreInvalidate();
        return appStoreLoad(true);
    },

    invalidate: function () {
        appStoreInvalidate();
    },

    peek: function () {
        return appStoreReadCache();
    },

    patchRealisasi: function (action, result) {
        return appStorePatchRealisasi(action, result);
    }
};

// Dipanggil sebagai fallback jika APP STORE belum tersedia.
window.invalidateAppStore = appStoreInvalidate;

// Mutation Realisasi menggunakan patch langsung jika snapshot sudah ada.
// Jika belum ada snapshot, tidak memaksa download ulang pada saat Save.
window.patchAppStoreRealisasi = appStorePatchRealisasi;


// ============================================================
// BFCache / PAGESHOW
//
// Setiap menu adalah dokumen HTML terpisah. Browser dapat menyimpan
// halaman lama di Back/Forward Cache (BFCache). Jika pengguna kembali
// ke Dashboard/Monitoring/Grafik/Laporan, DOM lama dapat dipulihkan
// tanpa menjalankan DOMContentLoaded lagi.
//
// APP_STORE sudah dipatch saat Save/Edit/Delete, tetapi dokumen yang
// dipulihkan dari BFCache belum otomatis merender snapshot terbaru.
// Untuk kasus tersebut, muat ulang dokumen sekali agar halaman menjalankan
// loader normal dan membaca APP_STORE terbaru.
//
// Tidak membuat cache baru dan tidak melakukan polling.
// ============================================================

window.addEventListener("pageshow", function (event) {
    if (!event.persisted) return;

    console.log(
        "APP STORE: halaman dipulihkan dari BFCache. Memuat ulang agar snapshot Realisasi terbaru tampil."
    );

    window.location.reload();
});
