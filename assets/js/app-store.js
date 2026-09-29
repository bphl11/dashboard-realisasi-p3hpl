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

const APP_STORE_KEY = "p3hpl_app_store_v1";
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

            if (Array.isArray(inputCache)) {
                attachInputRealisasiToRawData(cached.rawData, inputCache);
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

    appStoreMemory = {
        timestamp: Date.now(),
        rawData: state.rawData,
        parsedData: state.parsedData,
        calculation: state.calculation,
        inputRealisasi: inputRealisasi
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
    }
};

// Dipanggil setelah Save/Edit/Delete Realisasi.
// DATA_APLIKASI dan cache API tidak dihapus; hanya hasil turunan yang
// perlu dihitung ulang pada permintaan berikutnya.
window.invalidateAppStore = appStoreInvalidate;
