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

const INPUT_REALISASI_CACHE_KEY = "p3hpl_input_realisasi_cache_v1";
const INPUT_REALISASI_CACHE_TTL = 2 * 60 * 1000;

let inputRealisasiCache = null;
let inputRealisasiCacheAt = 0;
let inputRealisasiLoadingPromise = null;
let inputRealisasiRefreshQueued = false;

function bacaCacheInputRealisasi() {
    if (Array.isArray(inputRealisasiCache)) {
        return inputRealisasiCache;
    }

    try {
        const raw = sessionStorage.getItem(INPUT_REALISASI_CACHE_KEY);
        if (!raw) return null;

        const cached = JSON.parse(raw);
        if (!cached || !Array.isArray(cached.data)) return null;

        inputRealisasiCache = cached.data;
        inputRealisasiCacheAt = Number(cached.timestamp || 0);

        return inputRealisasiCache;
    } catch (error) {
        console.warn("Cache INPUT_REALISASI tidak dapat dibaca:", error);
        return null;
    }
}

function simpanCacheInputRealisasi(rows) {
    if (!Array.isArray(rows)) return;

    inputRealisasiCache = rows;
    inputRealisasiCacheAt = Date.now();

    try {
        sessionStorage.setItem(
            INPUT_REALISASI_CACHE_KEY,
            JSON.stringify({
                timestamp: inputRealisasiCacheAt,
                data: rows
            })
        );
    } catch (error) {
        console.warn("Cache INPUT_REALISASI tidak dapat disimpan:", error);
    }
}

function hapusCacheInputRealisasi() {
    inputRealisasiCache = null;
    inputRealisasiCacheAt = 0;
    inputRealisasiLoadingPromise = null;

    try {
        sessionStorage.removeItem(INPUT_REALISASI_CACHE_KEY);
    } catch (error) {
        console.warn("Cache INPUT_REALISASI tidak dapat dihapus:", error);
    }
}

// Memperbarui cache lokal segera setelah INSERT/UPDATE/DELETE.
// Tidak perlu download DATA_APLIKASI ulang.
function updateCacheInputRealisasiMutasi(action, result) {
    const current = bacaCacheInputRealisasi();
    if (!Array.isArray(current)) return;

    const normalizedAction = String(action || "").toLowerCase();
    const row = result?.data;
    const id = String(
        result?.id_realisasi ||
        row?.id_realisasi ||
        ""
    ).trim();

    let next = current.slice();

    if (
        (normalizedAction === "save" || normalizedAction === "insert") &&
        row?.id_realisasi
    ) {
        next = next.filter(item => item.id_realisasi !== row.id_realisasi);
        next.push({
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
            pagu_detil: Number(row.pagu_detil) || 0
        });
    }

    if (
        (normalizedAction === "update" || normalizedAction === "edit") &&
        row?.id_realisasi
    ) {
        next = next.filter(item => item.id_realisasi !== row.id_realisasi);
        next.push({
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
            pagu_detil: Number(row.pagu_detil) || 0
        });
    }

    if (normalizedAction === "delete" && id) {
        // Monitoring cache tidak membawa id_realisasi.
        // Jika cache berasal dari monitoring, paksa refresh transaksi
        // pada request berikutnya. DATA_APLIKASI tetap dipertahankan.
        hapusCacheInputRealisasi();
        return;
    }

    simpanCacheInputRealisasi(next);
}

async function fetchInputRealisasiMonitoring(forceRefresh = false) {
    const endpoint = String(CONFIG?.RPD_PROXY_URL || "").trim();
    if (!endpoint) return [];

    const now = Date.now();
    const cached = bacaCacheInputRealisasi();
    const cacheAge = cached ? now - Number(inputRealisasiCacheAt || 0) : Infinity;
    const cacheFresh = Array.isArray(cached) && cacheAge < INPUT_REALISASI_CACHE_TTL;

    if (!forceRefresh && cacheFresh) {
        return cached;
    }

    // Cache lama langsung dipakai agar perpindahan menu tidak menunggu API.
    // Sinkronisasi terbaru dijalankan di belakang layar.
    if (!forceRefresh && Array.isArray(cached)) {
        if (!inputRealisasiRefreshQueued) {
            inputRealisasiRefreshQueued = true;
            setTimeout(function () {
                fetchInputRealisasiMonitoring(true).catch(function () {});
            }, 0);
        }
        return cached;
    }

    if (inputRealisasiLoadingPromise) {
        return await inputRealisasiLoadingPromise;
    }

    inputRealisasiLoadingPromise = (async function () {
        try {
            const response = await fetch(endpoint, {
                method: "POST",
                headers: {
                    "Content-Type": "text/plain;charset=utf-8"
                },
                body: JSON.stringify({ action: "realisasi_monitoring" }),
                redirect: "follow",
                credentials: "omit",
                cache: "no-store"
            });

            const text = await response.text();
            let result;

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

            simpanCacheInputRealisasi(rows);
            return rows;
        } catch (error) {
            console.warn("INPUT_REALISASI monitoring tidak dapat dimuat:", error);
            return Array.isArray(cached) ? cached : [];
        } finally {
            inputRealisasiLoadingPromise = null;
            inputRealisasiRefreshQueued = false;
        }
    })();

    return await inputRealisasiLoadingPromise;
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

            // Jika cache transaksi sudah tersedia, halaman langsung lanjut.
            // Refresh jaringan berjalan di background.
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

            // DATA_APLIKASI dan INPUT_REALISASI diambil bersamaan.
            // Sebelumnya transaksi menunggu CSV selesai, sehingga waktu
            // tunggu halaman adalah CSV + API Realisasi.
            const dataPromise = fetch(CONFIG.SHEET_URL).then(async function (response) {
                if (!response.ok) {
                    throw new Error(
                        "Gagal mengambil DATA_APLIKASI. HTTP " + response.status
                    );
                }

                const csv = await response.text();

                if (!csv) {
                    throw new Error("DATA_APLIKASI mengembalikan data kosong.");
                }

                return csvToArray(csv);
            });

            const inputPromise = fetchInputRealisasiMonitoring();

            const [data, inputRealisasi] = await Promise.all([
                dataPromise,
                inputPromise
            ]);

            console.log("JUMLAH BARIS DATA_APLIKASI:", data.length);
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

function invalidateApiCache(options = {}) {
    const onlyRealisasi = options?.onlyRealisasi === true;

    if (!onlyRealisasi) {
        hapusCacheApi();
    }

    hapusCacheInputRealisasi();
}

function invalidateInputRealisasiCache() {
    hapusCacheInputRealisasi();
}


// Memaksa mengambil transaksi terbaru tanpa mengunduh DATA_APLIKASI ulang.
// Dipakai bila suatu halaman memang membutuhkan sinkronisasi segera.
async function refreshInputRealisasiCache() {
    return await fetchInputRealisasiMonitoring(true);
}




// Dipanggil setelah Save/Edit/Delete transaksi agar menu berikutnya
// langsung menggunakan data terbaru tanpa mengunduh DATA_APLIKASI.
function updateInputRealisasiLocalCache(action, result) {
    updateCacheInputRealisasiMutasi(action, result);
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


// ============================================================
// NAVIGASI CEPAT
//
// GitHub Pages adalah static site. Service Worker membuat halaman,
// JS, CSS, gambar, dan navigasi menu dapat diambil dari cache.
// Prefetch saat mouse masuk ke menu membuat klik berikutnya lebih cepat.
// ============================================================

(function aktifkanNavigasiCepat() {
    if (!("serviceWorker" in navigator)) return;

    window.addEventListener("load", function () {
        navigator.serviceWorker.register("./sw.js", {
            scope: "./"
        }).then(function () {
            console.log("P3HPL Service Worker aktif.");
        }).catch(function (error) {
            console.warn("Service Worker P3HPL tidak aktif:", error);
        });
    });

    let prefetchInProgress = false;

    document.addEventListener("pointerenter", function (event) {
        const link = event.target?.closest?.(".sidebar a[href]");

        if (!link || prefetchInProgress) return;

        const href = link.getAttribute("href") || "";

        if (
            !href ||
            href.startsWith("#") ||
            href.startsWith("http") ||
            href.startsWith("javascript:")
        ) {
            return;
        }

        const target = new URL(href, window.location.href);

        if (target.origin !== window.location.origin) return;

        prefetchInProgress = true;

        // Biarkan browser menyiapkan halaman di Cache API.
        fetch(target.href, {
            credentials: "same-origin",
            cache: "no-cache"
        })
        .then(function (response) {
            if (!response || !response.ok) return;

            if ("caches" in window) {
                return caches.open("p3hpl-static-v1").then(function (cache) {
                    return cache.put(target.href, response.clone());
                });
            }
        })
        .catch(function () {})
        .finally(function () {
            setTimeout(function () {
                prefetchInProgress = false;
            }, 300);
        });
    }, true);
})();
