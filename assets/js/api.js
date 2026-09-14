// ============================================================
// API.JS
// Mengambil data Google Sheet
// Dipakai oleh Dashboard dan Monitoring
// ============================================================

// ============================================================
// CACHE DATA
//
// Data anggaran relatif besar dan dipakai berulang oleh beberapa
// halaman. Cache sementara menghindari request Google Sheet dan
// Apps Script setiap kali halaman dibuka/pindah menu.
//
// TTL 2 menit: cukup cepat untuk perubahan data, tetapi mengurangi
// request berulang yang menjadi sumber lambat/loading ulang.
// ============================================================

const API_CACHE_KEY = "p3hpl_data_cache_v1";
const API_CACHE_TTL = 2 * 60 * 1000;

let apiMemoryCache = null;

function bacaCacheApi() {
    if (apiMemoryCache && Array.isArray(apiMemoryCache.data)) {
        return apiMemoryCache.data;
    }

    try {
        const raw = sessionStorage.getItem(API_CACHE_KEY);
        if (!raw) return null;

        const cached = JSON.parse(raw);
        if (!cached || !Array.isArray(cached.data)) return null;

        if (Date.now() - Number(cached.timestamp || 0) > API_CACHE_TTL) {
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
        sessionStorage.setItem(
            API_CACHE_KEY,
            JSON.stringify(cached)
        );
    } catch (error) {
        // Jika storage penuh/tidak tersedia, memory cache tetap dipakai.
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
// AMBIL TRANSAKSI INPUT_REALISASI
// ============================================================

async function fetchInputRealisasi() {
    if (
        typeof CONFIG === "undefined" ||
        !CONFIG.INPUT_REALISASI_URL
    ) {
        return [];
    }

    const separator =
        CONFIG.INPUT_REALISASI_URL.includes("?")
            ? "&"
            : "?";

    const url =
        CONFIG.INPUT_REALISASI_URL +
        separator +
        "action=list";

    const response = await fetch(url);

    if (!response.ok) {
        throw new Error(
            "Gagal mengambil INPUT_REALISASI. HTTP " +
            response.status
        );
    }

    const text = await response.text();

    let payload;

    try {
        payload = JSON.parse(text);
    } catch (error) {
        throw new Error(
            "Respons INPUT_REALISASI bukan JSON yang valid."
        );
    }

    if (!payload || payload.success !== true) {
        throw new Error(
            payload?.message ||
            "Endpoint INPUT_REALISASI mengembalikan respons gagal."
        );
    }

    return Array.isArray(payload.data)
        ? payload.data
        : [];
}


// ============================================================
// AMBIL DATA GOOGLE SHEET
// ============================================================

async function fetchSheetData(forceRefresh = false) {
    // Gunakan cache selama TTL masih berlaku.
    if (!forceRefresh) {
        const cached = bacaCacheApi();
        if (cached) {
            console.log("=== MENGGUNAKAN CACHE DATA GOOGLE SHEET ===");
            return cached;
        }
    }

    // Jika beberapa pemanggilan terjadi bersamaan, tunggu request yang sama.
    if (apiLoadingPromise) {
        return await apiLoadingPromise;
    }

    apiLoadingPromise = (async function () {
        try {
            console.log("=== MENGAMBIL DATA GOOGLE SHEET ===");

            if (
                typeof CONFIG === "undefined" ||
                !CONFIG.SHEET_URL
            ) {
                throw new Error(
                    "CONFIG.SHEET_URL belum tersedia. Periksa config.js"
                );
            }

            const [response, inputRealisasi] = await Promise.all([
                fetch(CONFIG.SHEET_URL),
                fetchInputRealisasi()
            ]);

            if (!response.ok) {
                throw new Error(
                    "Gagal mengambil Google Sheet. HTTP " +
                    response.status
                );
            }

            const csv = await response.text();

            if (!csv) {
                throw new Error(
                    "Google Sheet mengembalikan data kosong."
                );
            }

            const data = csvToArray(csv);

            // Transaksi tambahan disimpan sebagai metadata pada array raw.
            // Bentuk utama tetap Array agar seluruh halaman lama tidak perlu
            // diubah. parser.js akan menggabungkannya berdasarkan INDEX_RECORD.
            data.__inputRealisasi = inputRealisasi;

            console.log(
                "JUMLAH BARIS GOOGLE SHEET:",
                data.length
            );

            console.log(
                "JUMLAH TRANSAKSI INPUT_REALISASI:",
                inputRealisasi.length
            );

            simpanCacheApi(data);
            return data;
        } catch (error) {
            console.error("ERROR FETCH GOOGLE SHEET:", error);

            // Bila refresh gagal tetapi cache lama masih ada, gunakan cache
            // lama agar aplikasi tetap dapat dibuka tanpa reload manual.
            const staleCache = bacaCacheApi();
            if (staleCache) {
                console.warn("Request gagal. Menggunakan cache yang tersedia.");
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
// Dipanggil oleh modul lain setelah berhasil mengubah INPUT_REALISASI.
// Tidak mengubah data atau perhitungan; hanya memaksa pembacaan terbaru
// pada request berikutnya.
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

        // ====================================================
        // TANDA KUTIP
        // ====================================================
        if (char === '"') {
            // Quote ganda di dalam quoted field
            if (insideQuotes && nextChar === '"') {
                field += '"';
                i++;
            } else {
                insideQuotes = !insideQuotes;
            }
            continue;
        }

        // ====================================================
        // PEMISAH KOLOM
        // ====================================================
        if (char === "," && !insideQuotes) {
            row.push(field);
            field = "";
            continue;
        }

        // ====================================================
        // BARIS BARU
        // ====================================================
        if (
            (char === "\n" || char === "\r") &&
            !insideQuotes
        ) {
            // CRLF
            if (char === "\r" && nextChar === "\n") {
                i++;
            }

            row.push(field);
            field = "";

            // Jangan masukkan baris kosong total
            const adaIsi = row.some(function (value) {
                return String(value).trim() !== "";
            });

            if (adaIsi) {
                rows.push(row);
            }

            row = [];
            continue;
        }

        // ====================================================
        // KARAKTER NORMAL
        // ====================================================
        field += char;
    }

    // ========================================================
    // BARIS TERAKHIR
    // ========================================================
    if (field !== "" || row.length > 0) {
        row.push(field);

        const adaIsi = row.some(function (value) {
            return String(value).trim() !== "";
        });

        if (adaIsi) {
            rows.push(row);
        }
    }

    return rows;
}
