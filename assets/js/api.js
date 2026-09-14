// ============================================================
// API.JS
// Mengambil data Google Sheet untuk Dashboard dan Monitoring
// ============================================================

// ============================================================
// CACHE DATA
//
// Dashboard hanya membaca DATA_APLIKASI.
// INPUT_REALISASI tidak dipanggil pada saat load Dashboard/Monitoring.
// Cache diberi versi baru agar cache lama yang masih menyimpan metadata
// INPUT_REALISASI tidak ikut digunakan.
// ============================================================

const API_CACHE_KEY = "p3hpl_data_cache_v2";
const API_CACHE_TTL = 2 * 60 * 1000;

let apiMemoryCache = null;

function bacaCacheApi(allowStale = false) {
    if (apiMemoryCache && Array.isArray(apiMemoryCache.data)) {
        const expired = Date.now() - Number(apiMemoryCache.timestamp || 0) > API_CACHE_TTL;
        if (!expired || allowStale) return apiMemoryCache.data;
    }

    try {
        const raw = sessionStorage.getItem(API_CACHE_KEY);
        if (!raw) return null;

        const cached = JSON.parse(raw);
        if (!cached || !Array.isArray(cached.data)) return null;

        const expired = Date.now() - Number(cached.timestamp || 0) > API_CACHE_TTL;
        if (expired && !allowStale) {
            sessionStorage.removeItem(API_CACHE_KEY);
            return null;
        }

        apiMemoryCache = cached;
        return cached.data;
    } catch (error) {
        console.warn("Cache API tidak dapat dibaca:", error);
        return null;
    }
}

function simpanCacheApi(data) {
    if (!Array.isArray(data)) return;

    const cached = {
        timestamp: Date.now(),
        data: data
    };

    apiMemoryCache = cached;

    try {
        sessionStorage.setItem(API_CACHE_KEY, JSON.stringify(cached));
    } catch (error) {
        console.warn("Cache API tidak dapat disimpan:", error);
    }
}

function hapusCacheApi() {
    apiMemoryCache = null;

    try {
        sessionStorage.removeItem(API_CACHE_KEY);
    } catch (error) {
        console.warn("Cache API tidak dapat dihapus:", error);
    }
}

// Satu promise dipakai bersama jika beberapa bagian aplikasi meminta
// data hampir bersamaan. Ini mencegah request Google ganda pada saat load.
let apiLoadingPromise = null;


// ============================================================
// AMBIL DATA GOOGLE SHEET
//
// DATA_APLIKASI adalah satu-satunya sumber data Dashboard/Monitoring.
// INPUT_REALISASI tetap digunakan oleh halaman Input Data melalui
// input-data.js, tetapi TIDAK diambil di sini.
// ============================================================

async function fetchSheetData(forceRefresh = false) {
    if (!forceRefresh) {
        const cached = bacaCacheApi();
        if (cached) {
            console.log("=== MENGGUNAKAN CACHE DATA_APLIKASI ===");
            return cached;
        }
    }

    if (apiLoadingPromise) {
        return await apiLoadingPromise;
    }

    apiLoadingPromise = (async function () {
        try {
            console.log("=== MENGAMBIL DATA_APLIKASI GOOGLE SHEET ===");

            if (
                typeof CONFIG === "undefined" ||
                !CONFIG.SHEET_URL
            ) {
                throw new Error(
                    "CONFIG.SHEET_URL belum tersedia. Periksa config.js"
                );
            }

            const response = await fetch(CONFIG.SHEET_URL);

            if (!response.ok) {
                throw new Error(
                    "Gagal mengambil DATA_APLIKASI. HTTP " + response.status
                );
            }

            const csv = await response.text();
            if (!csv) {
                throw new Error("DATA_APLIKASI mengembalikan data kosong.");
            }

            const data = csvToArray(csv);

            console.log("JUMLAH BARIS DATA_APLIKASI:", data.length);

            simpanCacheApi(data);
            return data;
        } catch (error) {
            console.error("ERROR FETCH DATA_APLIKASI:", error);

            // True stale fallback: cache lama tetap dapat dipakai saat sumber
            // utama sedang gagal, meskipun TTL-nya sudah lewat.
            const staleCache = bacaCacheApi(true);
            if (staleCache) {
                console.warn("Request gagal. Menggunakan stale cache yang tersedia.");
                return staleCache;
            }

            throw error;
        } finally {
            apiLoadingPromise = null;
        }
    })();

    return await apiLoadingPromise;
}


// ============================================================
// INVALIDASI CACHE
//
// Tetap tersedia agar halaman Input Data dapat meminta Dashboard
// memuat ulang DATA_APLIKASI pada sesi berikutnya bila diperlukan.
// ============================================================

function invalidateApiCache() {
    hapusCacheApi();
}


// ============================================================
// GET DATA UNTUK DASHBOARD
// ============================================================

async function getSheetData() {
    return await fetchSheetData();
}


// ============================================================
// GET DATA UNTUK MONITORING
// ============================================================

async function getSheetDataMonitoring() {
    return await fetchSheetData();
}


// ============================================================
// CSV TO ARRAY
//
// Parser CSV internal.
// Tidak lagi membutuhkan Papa Parse.
//
// Mendukung:
// - koma
// - tanda kutip
// - koma di dalam tanda kutip
// - line break
// ============================================================

function csvToArray(csv) {
    const rows = [];
    let row = [];
    let field = "";
    let insideQuotes = false;

    for (let i = 0; i < csv.length; i++) {
        const char = csv[i];
        const nextChar = csv[i + 1];

        if (char === '"') {
            if (insideQuotes && nextChar === '"') {
                field += '"';
                i++;
            } else {
                insideQuotes = !insideQuotes;
            }
            continue;
        }

        if (char === "," && !insideQuotes) {
            row.push(field);
            field = "";
            continue;
        }

        if (
            (char === "\n" || char === "\r") &&
            !insideQuotes
        ) {
            if (char === "\r" && nextChar === "\n") {
                i++;
            }

            row.push(field);
            field = "";

            const adaIsi = row.some(function (value) {
                return String(value).trim() !== "";
            });

            if (adaIsi) rows.push(row);
            row = [];
            continue;
        }

        field += char;
    }

    if (field !== "" || row.length > 0) {
        row.push(field);

        const adaIsi = row.some(function (value) {
            return String(value).trim() !== "";
        });

        if (adaIsi) rows.push(row);
    }

    return rows;
}