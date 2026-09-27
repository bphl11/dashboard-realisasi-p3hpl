// ============================================================
// API.JS
// Mengambil data Google Sheet untuk Dashboard dan Monitoring
// ============================================================

// ============================================================
// CACHE DATA
//
// DATA_APLIKASI tetap menjadi sumber master anggaran.
// INPUT_REALISASI aktif ditempel sebagai metadata raw dan digabungkan
// oleh parser menjadi Realisasi Final untuk Dashboard/Monitoring/Grafik/Laporan.
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
// INPUT REALISASI TAMBAHAN
//
// Dashboard/Monitoring tetap memakai DATA_APLIKASI sebagai master.
// Transaksi pada REALISASI P3HPL dibaca terpisah melalui proxy RPD,
// lalu ditempel sebagai metadata non-enumerable pada array raw agar
// parser dapat menggabungkannya tanpa mengubah sumber DATA_APLIKASI.
// ============================================================

// ============================================================
// CACHE TRANSAKSI INPUT REALISASI
//
// DATA_APLIKASI dan INPUT_REALISASI mempunyai cache terpisah.
// Tujuannya:
// - tidak meminta REALISASI_MONITORING berulang kali setiap halaman;
// - setelah Save/Edit/Delete, cache transaksi dapat di-invalidasi saja;
// - DATA_APLIKASI tetap memakai cache yang sudah ada.
//
// Cache transaksi dibuat singkat karena data dapat berubah dari halaman
// Input Realisasi. Setelah mutasi, invalidateApiCache() menghapusnya.
// ============================================================

let inputRealisasiCache = null;
let inputRealisasiCacheAt = 0;

// 30 detik cukup pendek untuk perubahan eksternal, tetapi menghindari
// request berulang ketika user berpindah Dashboard -> Monitoring -> Grafik.
const INPUT_REALISASI_CACHE_TTL = 30000;

async function fetchInputRealisasiMonitoring(forceRefresh = false) {
    const endpoint = String(CONFIG?.RPD_PROXY_URL || "").trim();
    if (!endpoint) return [];

    const now = Date.now();

    // Gunakan cache transaksi jika masih segar.
    if (
        !forceRefresh &&
        Array.isArray(inputRealisasiCache) &&
        (now - inputRealisasiCacheAt) < INPUT_REALISASI_CACHE_TTL
    ) {
        return inputRealisasiCache;
    }

    try {
        const response = await fetch(endpoint, {
            method: "POST",
            headers: {
                "Content-Type": "text/plain;charset=utf-8"
            },
            body: JSON.stringify({
                action: "realisasi_monitoring"
            }),
            redirect: "follow",
            credentials: "omit",
            cache: "no-store"
        });

        const text = await response.text();
        let result = null;

        try {
            result = JSON.parse(text);
        } catch (error) {
            throw new Error("Respons realisasi monitoring bukan JSON yang valid.");
        }

        if (!response.ok || result?.ok === false) {
            throw new Error(result?.message || ("HTTP " + response.status));
        }

        const rows = Array.isArray(result?.realisasi)
            ? result.realisasi
            : [];

        inputRealisasiCache = rows;
        inputRealisasiCacheAt = Date.now();

        return rows;
    } catch (error) {
        console.warn("INPUT_REALISASI monitoring tidak dapat dimuat:", error);

        // Jika request gagal tetapi cache lama masih ada, gunakan cache lama
        // agar Dashboard/Monitoring tidak kehilangan angka sementara.
        if (Array.isArray(inputRealisasiCache)) {
            return inputRealisasiCache;
        }

        return [];
    }
}

function attachInputRealisasiToRawData(data, inputRealisasi) {
    if (!Array.isArray(data)) return data;

    try {
        Object.defineProperty(data, "__inputRealisasi", {
            value: Array.isArray(inputRealisasi) ? inputRealisasi : [],
            writable: true,
            configurable: true,
            enumerable: false
        });
    } catch (error) {
        data.__inputRealisasi = Array.isArray(inputRealisasi) ? inputRealisasi : [];
    }

    return data;
}


// ============================================================
// AMBIL DATA GOOGLE SHEET
//
// DATA_APLIKASI tetap menjadi sumber master anggaran.
// INPUT_REALISASI aktif ikut dimuat dan dipakai parser sebagai transaksi tambahan.
// ============================================================

async function fetchSheetData(forceRefresh = false) {
    if (!forceRefresh) {
        const cached = bacaCacheApi();
        if (cached) {
            console.log("=== MENGGUNAKAN CACHE DATA_APLIKASI ===");
            const inputRealisasi = await fetchInputRealisasiMonitoring();
            attachInputRealisasiToRawData(cached, inputRealisasi);
            console.log("JUMLAH INPUT_REALISASI AKTIF:", inputRealisasi.length);
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

            // Ambil transaksi Input Realisasi secara terpisah.
            // Jika API transaksi sedang tidak tersedia, Dashboard/Monitoring
            // tetap menggunakan DATA_APLIKASI tanpa gagal total.
            const inputRealisasi = await fetchInputRealisasiMonitoring();
            attachInputRealisasiToRawData(data, inputRealisasi);
            console.log("JUMLAH INPUT_REALISASI AKTIF:", inputRealisasi.length);

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
// ============================================================

function invalidateApiCache() {
    // Cache DATA_APLIKASI
    hapusCacheApi();

    // Cache INPUT_REALISASI
    inputRealisasiCache = null;
    inputRealisasiCacheAt = 0;
}


// Memaksa mengambil transaksi terbaru tanpa mengunduh DATA_APLIKASI ulang.
// Dipakai bila suatu halaman memang membutuhkan sinkronisasi segera.
async function refreshInputRealisasiCache() {
    return await fetchInputRealisasiMonitoring(true);
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


// ============================================================
// MENU INPUT DATA DINONAKTIFKAN
//
// DATA REALISASI sekarang dikelola langsung di DATA_APLIKASI.
// Halaman/menu Input Data tidak lagi menjadi bagian dari aplikasi.
// ============================================================

document.addEventListener("DOMContentLoaded", function () {
    document.querySelectorAll('.sidebar li[onclick*="input-data.html"]').forEach(function (item) {
        item.remove();
    });

    document.querySelectorAll('.sidebar a[href="input-data.html"]').forEach(function (link) {
        const item = link.closest("li");
        if (item) item.remove();
    });
});
