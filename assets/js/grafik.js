// ============================================================
// GRAFIK.JS
// GRAFIK REALISASI ANGGARAN P3HPHL
//
// Membutuhkan:
// - config.js
// - api.js
// - parser.js
// - Chart.js
//
// GRAFIK:
// 1. Realisasi Bulanan
// 2. Normal vs Diblokir
// 3. Pagu vs Realisasi vs Sisa
// 4. Persentase Penyerapan
//
// LOGIKA STATUS:
//
// TOTAL     = Total Utama Excel
// DIBLOKIR  = Detail yang berstatus Diblokir
// NORMAL    = TOTAL - DIBLOKIR
//
// Dengan demikian:
//
// NORMAL + DIBLOKIR = TOTAL
//
// Logika ini mengikuti konsep yang sudah digunakan
// pada halaman Laporan.
// ============================================================



// ============================================================
// VARIABEL GLOBAL
// ============================================================

let grafikRawData = [];

let grafikParsedData = [];


let chartBulanan = null;
let chartKumulatif = null;

let chartStatusAnggaran = null;

let chartPerbandingan = null;

let chartPersentase = null;

let grafikRpdBulanan = Array(12).fill(0);
let grafikRpdTotal = 0;

// Cache RPD khusus halaman Grafik.
// Grafik boleh menampilkan cache terlebih dahulu, lalu menyegarkan RPD
// di belakang layar agar perpindahan menu tidak menunggu request API.
const GRAFIK_RPD_CACHE_KEY = "p3hpl_grafik_rpd_cache_v3";
const GRAFIK_RPD_CACHE_TTL = 2 * 60 * 1000;
let grafikRpdRefreshPromise = null;

function invalidasiCacheRpdGrafik() {
    try {
        localStorage.removeItem(GRAFIK_RPD_CACHE_KEY);
    } catch (error) {
        console.warn("Cache RPD Grafik tidak dapat dihapus:", error);
    }
}

function hitungRpdBulananGrafik(rows, tersedia = true) {
    const fields = [
        ["jan_m1","jan_m2","jan_m3","jan_m4"],
        ["feb_m1","feb_m2","feb_m3","feb_m4"],
        ["mar_m1","mar_m2","mar_m3","mar_m4"],
        ["apr_m1","apr_m2","apr_m3","apr_m4"],
        ["mei_m1","mei_m2","mei_m3","mei_m4"],
        ["jun_m1","jun_m2","jun_m3","jun_m4"],
        ["jul_m1","jul_m2","jul_m3","jul_m4"],
        ["agu_m1","agu_m2","agu_m3","agu_m4"],
        ["sep_m1","sep_m2","sep_m3","sep_m4"],
        ["okt_m1","okt_m2","okt_m3","okt_m4"],
        ["nov_m1","nov_m2","nov_m3","nov_m4"],
        ["des_m1","des_m2","des_m3","des_m4"]
    ];

    const bulanan = Array(12).fill(0);

    (Array.isArray(rows) ? rows : []).forEach(function (row) {
        fields.forEach(function (monthFields, monthIndex) {
            monthFields.forEach(function (field) {
                bulanan[monthIndex] += Number(row?.[field]) || 0;
            });
        });
    });

    return {
        bulanan: bulanan,
        total: bulanan.reduce(function (sum, value) {
            return sum + value;
        }, 0),
        tersedia: tersedia
    };
}

async function ambilRpdBulananGrafik(forceRefresh = false) {
    const kosong = {
        bulanan: Array(12).fill(0),
        total: 0,
        tersedia: false,
        sumber: "none"
    };

    function bacaRpdLocalRows() {
        const keys = [
            "p3hpl_rpd_saved_v5",
            "p3hpl_rpd_saved_v4"
        ];

        for (const key of keys) {
            try {
                const raw = localStorage.getItem(key);
                if (!raw) continue;

                const rows = JSON.parse(raw);
                if (!Array.isArray(rows) || !rows.length) continue;

                const validRows = rows.filter(row =>
                    row && typeof row === "object" &&
                    (
                        row.id_rpd ||
                        row.ID_RPD
                    )
                );

                if (validRows.length) return validRows;
            } catch (error) {
                console.warn("Cache RPD lokal tidak dapat dibaca:", key, error);
            }
        }

        return [];
    }

    function hitungRpdDariLocal() {
        const rows = bacaRpdLocalRows();
        if (!rows.length) return null;

        const data = hitungRpdBulananGrafik(rows, true);
        return {
            ...data,
            sumber: "local"
        };
    }

    function bacaCacheRpd() {
        try {
            const raw = localStorage.getItem(GRAFIK_RPD_CACHE_KEY);
            if (!raw) return null;

            const cached = JSON.parse(raw);
            if (!cached || !Array.isArray(cached.bulanan)) return null;

            return {
                bulanan: cached.bulanan.slice(0, 12),
                total: Number(cached.total) || 0,
                timestamp: Number(cached.timestamp) || 0,
                tersedia: true
            };
        } catch (error) {
            return null;
        }
    }

    function simpanCacheRpd(data) {
        try {
            localStorage.setItem(
                GRAFIK_RPD_CACHE_KEY,
                JSON.stringify({
                    timestamp: Date.now(),
                    bulanan: data.bulanan,
                    total: data.total
                })
            );
        } catch (error) {
            console.warn("Cache RPD Grafik tidak dapat disimpan:", error);
        }
    }

    const cached = bacaCacheRpd();
    const cacheFresh =
        cached &&
        Date.now() - cached.timestamp < GRAFIK_RPD_CACHE_TTL;

    // Jika cache tersedia, langsung gunakan.
    // Ini membuat Grafik tidak menunggu API RPD.
    if (!forceRefresh && cached) {
        if (cacheFresh) {
            // Refresh dilakukan di belakang layar, bukan menghambat render.
            if (!grafikRpdRefreshPromise) {
                grafikRpdRefreshPromise = ambilRpdBulananGrafik(true)
                    .then(function (fresh) {
                        // Jika cache ternyata berbeda dengan server, perbarui
                        // angka grafik yang sedang tampil tanpa menunggu
                        // pengguna membuka ulang halaman.
                        if (fresh && fresh.tersedia) {
                            const changed =
                                JSON.stringify(fresh.bulanan) !== JSON.stringify(cached.bulanan) ||
                                Number(fresh.total) !== Number(cached.total);

                            if (changed) {
                                grafikRpdBulanan = fresh.bulanan;
                                grafikRpdTotal = fresh.total;

                                if (typeof buatGrafikBulanan === "function" &&
                                    typeof grafikParsedData !== "undefined" &&
                                    grafikParsedData) {
                                    try {
                                        const totalDataNow = {
                                            ...((window.appStore && window.appStore.get)
                                                ? {}
                                                : {}),
                                            bulanan: ambilDataUtamaGrafik(grafikRawData).bulanan
                                        };
                                        buatGrafikBulanan(totalDataNow.bulanan, grafikRpdBulanan);
                                        if (typeof buatGrafikKumulatif === "function") {
                                            buatGrafikKumulatif(totalDataNow.bulanan, grafikRpdBulanan);
                                        }
                                    } catch (refreshRenderError) {
                                        console.warn("Refresh grafik RPD gagal dirender:", refreshRenderError);
                                    }
                                }
                            }
                        }
                        return fresh;
                    })
                    .catch(function () { return cached; })
                    .finally(function () {
                        grafikRpdRefreshPromise = null;
                    });
            }
            return cached;
        }

        // Cache lama tetap lebih baik daripada halaman kosong.
        if (!grafikRpdRefreshPromise) {
            grafikRpdRefreshPromise = ambilRpdBulananGrafik(true)
                .catch(function () { return cached; })
                .finally(function () {
                    grafikRpdRefreshPromise = null;
                });
        }
        return cached;
    }

    try {
        const rawUser = sessionStorage.getItem("p3hpl_rpd_user_v1");
        const user = rawUser ? JSON.parse(rawUser) : null;
        const token = String(user?.id_token || "").trim();

        // Jika belum login, gunakan data RPD tersimpan dari modul RPD.
        if (!token) {
            const localData = hitungRpdDariLocal();
            if (localData) {
                simpanCacheRpd(localData);
                return localData;
            }
            return cached || kosong;
        }

        const apiUrl =
            typeof RPD_CONFIG !== "undefined"
                ? String(
                    RPD_CONFIG.RPD_PROXY_URL ||
                    RPD_CONFIG.RPD_API_URL ||
                    ""
                ).trim()
                : "";

        if (!apiUrl) return cached || kosong;

        const response = await fetch(apiUrl, {
            method: "POST",
            headers: { "Content-Type": "text/plain;charset=utf-8" },
            body: JSON.stringify({
                // Grafik cukup membutuhkan daftar RPD tersimpan.
                // Tidak perlu bootstrap/master karena endpoint bootstrap
                // membaca dan memproses seluruh DATA_APLIKASI sehingga lebih
                // berat dan rentan 502/timeout.
                action: "list",
                id_token: token
            }),
            redirect: "follow",
            credentials: "omit",
            cache: "no-store"
        });

        const textResponse = await response.text();
        let result;

        try {
            result = JSON.parse(textResponse);
        } catch (error) {
            throw new Error("Respons RPD bukan JSON yang valid.");
        }

        if (!response.ok || result?.ok === false) {
            throw new Error(
                result?.message || "Data RPD tidak dapat dibaca."
            );
        }

        // Endpoint LIST memang hanya mengembalikan RPD tersimpan.
        // Identitas Grafik dinormalisasi lokal tanpa ketergantungan pada Pagu,
        // sehingga tetap kompatibel dengan record lama berbasis Pagu.
        const rowsAll = Array.isArray(result.rpd) ? result.rpd : [];

        function stableRpdIdGrafik(row) {
            const normalize = function (value) {
                return String(value ?? "")
                    .trim()
                    .toUpperCase()
                    .replace(/\s+/g, " ")
                    .replace(/\|/g, "/");
            };

            return [
                row?.tahun ?? row?.TAHUN,
                row?.kode_sub_komponen ?? row?.KODE_SUB_KOMPONEN,
                row?.sub_komponen ?? row?.SUB_KOMPONEN,
                row?.akun ?? row?.AKUN,
                row?.item_akun ?? row?.ITEM_AKUN,
                row?.detil_akun ?? row?.DETIL_AKUN,
                row?.rincian_item ?? row?.RINCIAN_ITEM
            ].map(normalize).join("|");
        }

        const normalizedRows = rowsAll.map(function (row) {
            return {
                ...row,
                id_rpd: stableRpdIdGrafik(row)
            };
        });

        const validRows = normalizedRows;

        // Satu ID RPD harus dihitung satu kali. Sheet lama dapat berisi
        // duplikasi record akibat penyimpanan/versi sebelumnya; halaman RPD
        // sendiri sudah melakukan merge berdasarkan id_rpd.
        const rowsById = new Map();
        validRows.forEach(function (row) {
            const id = String(row?.id_rpd || "").trim();
            if (!id) return;

            const existing = rowsById.get(id);
            if (!existing) {
                rowsById.set(id, row);
                return;
            }

            // Jika ada duplikat, gunakan record dengan updated_at paling baru.
            const oldTime = new Date(existing.updated_at || 0).getTime();
            const newTime = new Date(row.updated_at || 0).getTime();
            if (newTime >= oldTime) rowsById.set(id, row);
        });

        const rows = Array.from(rowsById.values());

        console.log(
            "GRAFIK RPD: record server =", rowsAll.length,
            "record valid sebelum deduplikasi =", validRows.length,
            "record dihitung =", rows.length
        );

        const data = hitungRpdBulananGrafik(rows, true);

        simpanCacheRpd(data);

        return data;
    } catch (error) {
        console.warn("RPD grafik tidak dapat dimuat dari server:", error);

        // Saat Worker/Apps Script sementara 502/redirect, gunakan RPD
        // yang baru saja tersimpan di browser. Ini penting agar Grafik
        // tetap mengikuti input terbaru operator dan tidak berubah menjadi 0.
        const localData = hitungRpdDariLocal();
        if (localData) {
            simpanCacheRpd(localData);
            return localData;
        }

        return cached || kosong;
    }
}


// ============================================================
// LABEL NILAI LANGSUNG PADA DIAGRAM
//
// Menampilkan nominal tanpa harus mengarahkan kursor.
// Berlaku untuk seluruh diagram Chart.js pada halaman Grafik.
// ============================================================

const directValueLabelsPlugin = {
    id: "directValueLabels",

    afterDatasetsDraw: function (chart) {
        const ctx = chart.ctx;
        const chartArea = chart.chartArea;

        if (!chartArea) return;

        ctx.save();

        chart.data.datasets.forEach(function (dataset, datasetIndex) {
            const meta = chart.getDatasetMeta(datasetIndex);

            if (meta.hidden) return;

            meta.data.forEach(function (element, index) {
                const value = Number(dataset.data[index]) || 0;

                // Nilai 0 tidak perlu ditulis agar grafik tetap bersih.
                if (value === 0) return;

                const text = formatSingkatRupiah(value);
                const position = element.tooltipPosition();

                ctx.font = "700 11px system-ui, sans-serif";
                ctx.fillStyle = "#243142";
                ctx.textAlign = "center";

                if (chart.config.type === "doughnut" || chart.config.type === "pie") {
                    ctx.textBaseline = "middle";
                    ctx.fillText(text, position.x, position.y);
                    return;
                }

                ctx.textBaseline = "bottom";

                // Pastikan label tetap berada di dalam area chart,
                // termasuk untuk batang yang sangat tinggi.
                const y = Math.max(
                    chartArea.top + 14,
                    position.y - 8
                );

                ctx.fillText(text, position.x, y);
            });
        });

        ctx.restore();
    }
};


// ============================================================
// LOAD HALAMAN GRAFIK
// ============================================================

document.addEventListener(

    "DOMContentLoaded",

    async function () {

        try {

            console.log(
                "===================================="
            );

            console.log(
                "LOAD HALAMAN GRAFIK"
            );

            console.log(
                "===================================="
            );


            // =================================================
            // CEK FUNGSI API
            // =================================================

            if (
                typeof getSheetDataMonitoring !==
                "function"
            ) {

                throw new Error(

                    "Fungsi getSheetDataMonitoring() tidak ditemukan."

                );

            }


            // =================================================
            // CEK PARSER
            // =================================================

            if (
                typeof parseDataMonitoring !==
                "function"
            ) {

                throw new Error(

                    "parser.js belum dimuat. Pastikan parser.js dimuat sebelum grafik.js."

                );

            }


            // =================================================
            // AMBIL DATA GOOGLE SHEET
            // =================================================

            // APP STORE menyimpan raw + parsed + calculation.
            // Grafik tidak perlu download dan parse ulang saat
            // pengguna berpindah menu.
            const storePromise = window.appStore.get();

            // RPD tetap berjalan paralel sebagai data pembanding.
            const rpdPromise = ambilRpdBulananGrafik();

            const store = await storePromise;

            grafikRawData = store.rawData;
            grafikParsedData = store.parsedData;

            console.log(
                "GRAFIK: menggunakan APP STORE:",
                grafikParsedData.length,
                "baris"
            );

            // =================================================
            // AMBIL TOTAL UTAMA
            //
            // Untuk grafik bulanan tetap menggunakan fungsi
            // khusus karena membutuhkan Januari - Desember.
            // =================================================

            const calculation = store.calculation;

            const totalData = {
                ...calculation.total,
                bulanan: ambilDataUtamaGrafik(grafikRawData).bulanan
            };

            const rpdGrafik = await rpdPromise;
            grafikRpdBulanan = rpdGrafik.bulanan;
            grafikRpdTotal = rpdGrafik.total;

            // Sisa yang dapat direncanakan melalui RPD berasal dari
            // anggaran yang BELUM direalisasikan.
            const sisaBelumDirealisasikan = Math.max(
                (Number(totalData.pagu) || 0) -
                (Number(totalData.realisasi) || 0),
                0
            );

            // RPD adalah rencana penarikan atas sisa belum direalisasikan.
            // Karena itu "Sisa Pagu Setelah RPD" = sisa belum direalisasikan
            // dikurangi RPD yang sudah terisi, bukan Pagu dikurangi RPD.
            totalData.sisaBelumDirealisasikan = sisaBelumDirealisasikan;
            totalData.rpdTerisi = grafikRpdTotal;
            totalData.sisaRpd = Math.max(
                sisaBelumDirealisasikan - grafikRpdTotal,
                0
            );

            totalData.selisihRpd = sisaBelumDirealisasikan - grafikRpdTotal;

            totalData.persen = Number(totalData.pagu) > 0
                ? ((Number(totalData.realisasi) || 0) / Number(totalData.pagu)) * 100
                : 0;

            const statusRpdGrafik = document.getElementById("statusRpdGrafik");
            if (statusRpdGrafik) {
                if (!rpdGrafik.tersedia) {
                    statusRpdGrafik.textContent =
                        "RPD belum dapat dimuat dari server dan belum tersedia pada cache lokal.";
                } else {
                    const selisihRpd = Number(totalData.selisihRpd) || 0;

                    if (selisihRpd < 0) {
                        statusRpdGrafik.textContent =
                            "Sisa belum direalisasikan: " +
                            formatRupiahGrafik(totalData.sisaBelumDirealisasikan) +
                            " | RPD terisi: " +
                            formatRupiahGrafik(grafikRpdTotal) +
                            " | Peringatan: RPD melebihi sisa belum direalisasikan sebesar " +
                            formatRupiahGrafik(Math.abs(selisihRpd)) + ".";
                    } else {
                        statusRpdGrafik.textContent =
                            "Sisa belum direalisasikan: " +
                            formatRupiahGrafik(totalData.sisaBelumDirealisasikan) +
                            " | RPD terisi: " +
                            formatRupiahGrafik(grafikRpdTotal) +
                            " | Sisa Pagu Setelah RPD: " +
                            formatRupiahGrafik(totalData.sisaRpd);
                    }
                }
            }



            console.log(

                "DATA UTAMA GRAFIK:",

                totalData

            );


            // =================================================
            // HITUNG STATUS NORMAL VS DIBLOKIR
            // =================================================

            const dataStatus = { normal: calculation.tanpaBlokir, diblokir: calculation.diblokir, total: calculation.total };


            console.log(

                "DATA STATUS ANGGARAN:",

                dataStatus

            );


            // =================================================
            // TAMPILKAN CARD TOTAL
            // =================================================

            tampilkanCardGrafik(

                totalData

            );


            // =================================================
            // GRAFIK BULANAN
            // =================================================

            buatGrafikBulanan(

                totalData.bulanan,

                grafikRpdBulanan

            );

            // =================================================
            // GRAFIK KUMULATIF REALISASI VS RPD
            // =================================================

            buatGrafikKumulatif(
                totalData.bulanan,
                grafikRpdBulanan
            );


            // =================================================
            // GRAFIK NORMAL VS DIBLOKIR
            // =================================================

            buatGrafikStatusAnggaran(

                dataStatus

            );


            // =================================================
            // GRAFIK PAGU REALISASI SISA
            // =================================================

            buatGrafikPerbandingan(

                totalData

            );


            // =================================================
            // GRAFIK PERSENTASE
            // =================================================

            buatGrafikPersentase(

                totalData

            );


            // =================================================
            // HILANGKAN LOADING
            // =================================================

            const loading =

                document.getElementById(

                    "loadingGrafikBulanan"

                );


            if (loading) {

                loading.style.display =
                    "none";

            }


            console.log(
                "===================================="
            );

            console.log(
                "GRAFIK SELESAI DIMUAT"
            );

            console.log(
                "===================================="
            );


        }

        catch (error) {

            console.error(

                "ERROR GRAFIK:",

                error

            );


            const loading =

                document.getElementById(

                    "loadingGrafikBulanan"

                );


            if (loading) {

                loading.innerHTML =

                    '<span class="text-danger">' +

                    "Gagal memuat data grafik: " +

                    escapeHtmlGrafik(

                        error.message

                    )

                    +

                    "</span>";

            }

        }

    }

);



// ============================================================
// AMBIL DATA UTAMA GRAFIK
//
// Mengambil satu baris total utama.
//
// Data bulanan:
//
// F = Pagu
// G = Januari
// H = Februari
// ...
// R = Desember
//
// Fungsi lama tetap dipertahankan karena grafik bulanan
// membutuhkan angka Januari sampai Desember.
// ============================================================

function ambilDataUtamaGrafik(data) {

    // DATA_APLIKASI: data bulanan dijumlahkan berdasarkan nama header.
    if (typeof isDataAplikasi === "function" && isDataAplikasi(data) &&
        typeof ambilBulananDataAplikasi === "function") {
        const totalBulanan = ambilBulananDataAplikasi(data);
        const bulan = [
            "Januari","Februari","Maret","April","Mei","Juni",
            "Juli","Agustus","September","Oktober","November","Desember"
        ];
        return {
            bulanan: bulan.map(function (nama) {
                return Number(totalBulanan[nama]) || 0;
            })
        };
    }
    // Fungsi ini sekarang hanya bertanggung jawab mengambil data bulanan.
    // Nilai total Pagu/Realisasi/Sisa selalu berasal dari Calculation Engine.
    let rowTerbaik = null;
    let skorTerbaik = -1;

    (data || []).forEach(function (row) {
        let skor = 0;
        for (let i = 6; i <= 17; i++) {
            if (parseNumberGrafik(row?.[i]) !== null) skor++;
        }
        if (skor > skorTerbaik) {
            skorTerbaik = skor;
            rowTerbaik = row;
        }
    });

    const bulanan = [];
    for (let i = 0; i < 12; i++) {
        bulanan.push(
            parseNumberGrafik(rowTerbaik?.[6 + i]) || 0
        );
    }

    return { bulanan };
}

// ============================================================
// // ============================================================
// TAMPILKAN CARD GRAFIK
// ============================================================

function tampilkanCardGrafik(data) {
    setTextGrafik(
        "totalPagu",
        formatRupiahGrafik(data.pagu)
    );

    setTextGrafik(
        "totalRealisasi",
        formatRupiahGrafik(data.realisasi)
    );

    setTextGrafik(
        "rpdTerisi",
        formatRupiahGrafik(data.rpdTerisi || 0)
    );

    setTextGrafik(
        "sisaAnggaran",
        formatRupiahGrafik(data.sisaRpd)
    );
}


// ============================================================
// GRAFIK REALISASI BULANAN
// ============================================================

function buatGrafikBulanan(
    bulanan,
    rpdBulanan = Array(12).fill(0)
) {

    const canvas =

        document.getElementById(

            "grafikBulanan"

        );


    if (!canvas) {

        console.warn(

            "Canvas grafikBulanan tidak ditemukan."

        );


        return;

    }


    if (
        typeof Chart ===
        "undefined"
    ) {

        console.error(

            "Chart.js belum dimuat."

        );


        return;

    }


    // ========================================================
    // HAPUS CHART LAMA
    // ========================================================

    if (chartBulanan) {

        chartBulanan.destroy();

    }


    const bulan = [

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


    chartBulanan =

        new Chart(

            canvas,

            {

                plugins: [directValueLabelsPlugin],

                type:
                    "bar",


                data: {

                    labels:
                        bulan,


                    datasets: [

                        {

                            label:

                                "Realisasi",


                            data:

                                bulanan,


                            backgroundColor:

                                "rgba(25, 135, 84, 0.70)",


                            borderColor:

                                "rgb(25, 135, 84)",


                            borderWidth:

                                1

                        },

                        {

                            label:

                                "RPD Terisi",

                            data:

                                rpdBulanan,

                            backgroundColor:

                                "rgba(13, 110, 253, 0.55)",

                            borderColor:

                                "rgb(13, 110, 253)",

                            borderWidth:

                                1

                        }

                    ]

                },


                options: {

                    responsive:
                        true,


            animation: {
                duration: 0
            },
                    maintainAspectRatio:
                        false,


                    plugins: {

                        legend: {

                            display:
                                true

                        },


                        tooltip: {

                            callbacks: {

                                label:

                                    function (
                                        context
                                    ) {

                                        return (

                                            context.dataset.label

                                            +

                                            ": "

                                            +

                                            formatRupiahGrafik(

                                                context.raw

                                            )

                                        );

                                    }

                            }

                        }

                    },


                    scales: {

                        y: {

                            beginAtZero:
                                true,


                            ticks: {

                                callback:

                                    function (
                                        value
                                    ) {

                                        return (

                                            formatSingkatRupiah(

                                                value

                                            )

                                        );

                                    }

                            }

                        }

                    }

                }

            }

        );

}



// ============================================================
// GRAFIK KUMULATIF REALISASI vs RPD
// ============================================================

function buatGrafikKumulatif(
    bulanan,
    rpdBulanan = Array(12).fill(0)
) {
    const canvas = document.getElementById("grafikKumulatif");

    if (!canvas || typeof Chart === "undefined") {
        return;
    }

    if (chartKumulatif) {
        chartKumulatif.destroy();
    }

    const bulan = [
        "Januari", "Februari", "Maret", "April", "Mei", "Juni",
        "Juli", "Agustus", "September", "Oktober", "November", "Desember"
    ];

    let totalRealisasi = 0;
    let totalRpd = 0;

    const kumulatifRealisasi = (Array.isArray(bulanan) ? bulanan : []).map(function (value) {
        totalRealisasi += Number(value) || 0;
        return totalRealisasi;
    });

    const kumulatifRpd = (Array.isArray(rpdBulanan) ? rpdBulanan : []).map(function (value) {
        totalRpd += Number(value) || 0;
        return totalRpd;
    });

    chartKumulatif = new Chart(canvas, {
        type: "line",
        data: {
            labels: bulan,
            datasets: [
                {
                    label: "Realisasi Aktual Kumulatif",
                    data: kumulatifRealisasi,
                    borderColor: "rgb(25, 135, 84)",
                    backgroundColor: "rgba(25, 135, 84, 0.10)",
                    borderWidth: 3,
                    pointRadius: 4,
                    pointHoverRadius: 6,
                    fill: false,
                    tension: 0.25
                },
                {
                    label: "RPD Kumulatif",
                    data: kumulatifRpd,
                    borderColor: "rgb(13, 110, 253)",
                    backgroundColor: "rgba(13, 110, 253, 0.10)",
                    borderWidth: 3,
                    pointRadius: 4,
                    pointHoverRadius: 6,
                    fill: false,
                    tension: 0.25
                }
            ]
        },
        options: {
            responsive: true,
            animation: {
                duration: 0
            },
            maintainAspectRatio: false,
            interaction: {
                mode: "index",
                intersect: false
            },
            plugins: {
                legend: {
                    display: true,
                    position: "top"
                },
                tooltip: {
                    callbacks: {
                        label: function (context) {
                            return context.dataset.label + ": " +
                                formatRupiahGrafik(context.raw);
                        },
                        afterBody: function (items) {
                            if (!items || !items.length) return "";
                            const index = items[0].dataIndex;
                            const aktual = Number(kumulatifRealisasi[index]) || 0;
                            const rpd = Number(kumulatifRpd[index]) || 0;
                            return "Selisih aktual - RPD: " +
                                formatRupiahGrafik(aktual - rpd);
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function (value) {
                            return formatSingkatRupiah(value);
                        }
                    }
                }
            }
        }
    });
}

// ============================================================
// GRAFIK STATUS ANGGARAN
//
// Menampilkan:
//
// NORMAL
// - Pagu
// - Realisasi
//
// DIBLOKIR
// - Pagu
// - Realisasi
//
// Bentuk grouped bar chart.
// ============================================================

function buatGrafikStatusAnggaran(
    data
) {

    const canvas =

        document.getElementById(

            "grafikStatusAnggaran"

        );


    if (!canvas) {

        console.warn(

            "Canvas grafikStatusAnggaran tidak ditemukan."

        );


        return;

    }


    if (
        typeof Chart ===
        "undefined"
    ) {

        console.error(

            "Chart.js belum dimuat."

        );


        return;

    }


    // ========================================================
    // HAPUS CHART LAMA
    // ========================================================

    if (chartStatusAnggaran) {

        chartStatusAnggaran.destroy();

    }


    // ========================================================
    // BUAT CHART
    // ========================================================

    chartStatusAnggaran =

        new Chart(

            canvas,

            {

                plugins: [directValueLabelsPlugin],

                type:
                    "bar",


                data: {

                    labels: [

                        "Normal",

                        "Diblokir"

                    ],


                    datasets: [

                        // =====================================
                        // PAGU
                        // =====================================

                        {

                            label:

                                "Pagu",


                            data: [

                                data.normal.pagu,

                                data.diblokir.pagu

                            ],


                            backgroundColor:

                                "rgba(13, 110, 253, 0.70)",


                            borderColor:

                                "rgb(13, 110, 253)",


                            borderWidth:

                                1

                        },


                        // =====================================
                        // REALISASI
                        // =====================================

                        {

                            label:

                                "Realisasi",


                            data: [

                                data.normal.realisasi,

                                data.diblokir.realisasi

                            ],


                            backgroundColor:

                                "rgba(25, 135, 84, 0.70)",


                            borderColor:

                                "rgb(25, 135, 84)",


                            borderWidth:

                                1

                        }

                    ]

                },


                options: {

                    responsive:
                        true,


            animation: {
                duration: 0
            },
                    maintainAspectRatio:
                        false,


                    interaction: {

                        mode:
                            "index",

                        intersect:
                            false

                    },


                    plugins: {

                        legend: {

                            display:
                                true,


                            position:
                                "top"

                        },


                        tooltip: {

                            callbacks: {

                                label:

                                    function (
                                        context
                                    ) {

                                        return (

                                            context.dataset.label

                                            +

                                            ": "

                                            +

                                            formatRupiahGrafik(

                                                context.raw

                                            )

                                        );

                                    },


                                afterBody:

                                    function (
                                        tooltipItems
                                    ) {

                                        if (
                                            !tooltipItems ||
                                            tooltipItems.length === 0
                                        ) {

                                            return "";

                                        }


                                        const index =

                                            tooltipItems[0]
                                                .dataIndex;


                                        const statusData =

                                            index === 0

                                                ? data.normal

                                                : data.diblokir;


                                        return [

                                            "Sisa: " +

                                            formatRupiahGrafik(

                                                statusData.sisa

                                            ),


                                            "Persentase: " +

                                            formatPersenGrafik(

                                                statusData.persen

                                            )

                                        ];

                                    }

                            }

                        }

                    },


                    scales: {

                        y: {

                            beginAtZero:
                                true,


                            ticks: {

                                callback:

                                    function (
                                        value
                                    ) {

                                        return (

                                            formatSingkatRupiah(

                                                value

                                            )

                                        );

                                    }

                            }

                        }

                    }

                }

            }

        );

}



// ============================================================
// GRAFIK PERBANDINGAN
//
// Pagu
// Realisasi
// Sisa Anggaran
// ============================================================

function buatGrafikPerbandingan(
    data
) {

    const canvas =

        document.getElementById(

            "grafikPerbandingan"

        );


    if (!canvas) {

        console.warn(

            "Canvas grafikPerbandingan tidak ditemukan."

        );


        return;

    }


    if (
        typeof Chart ===
        "undefined"
    ) {

        return;

    }


    if (chartPerbandingan) {

        chartPerbandingan.destroy();

    }


    chartPerbandingan =

        new Chart(

            canvas,

            {

                plugins: [directValueLabelsPlugin],

                type:
                    "bar",


                data: {

                    labels: [

                        "Pagu",

                        "Realisasi",

                        "Sisa Anggaran"

                    ],


                    datasets: [

                        {

                            label:

                                "Nilai Anggaran",


                            data: [

                                data.pagu,

                                data.realisasi,

                                data.sisa

                            ],


                            backgroundColor: [

                                "rgba(13, 110, 253, 0.70)",

                                "rgba(25, 135, 84, 0.70)",

                                "rgba(108, 117, 125, 0.70)"

                            ],


                            borderWidth:

                                1

                        }

                    ]

                },


                options: {

                    responsive:
                        true,


            animation: {
                duration: 0
            },
                    maintainAspectRatio:
                        false,


                    plugins: {

                        legend: {

                            display:
                                false

                        },


                        tooltip: {

                            callbacks: {

                                label:

                                    function (
                                        context
                                    ) {

                                        return (

                                            formatRupiahGrafik(

                                                context.raw

                                            )

                                        );

                                    }

                            }

                        }

                    },


                    scales: {

                        y: {

                            beginAtZero:
                                true,


                            ticks: {

                                callback:

                                    function (
                                        value
                                    ) {

                                        return (

                                            formatSingkatRupiah(

                                                value

                                            )

                                        );

                                    }

                            }

                        }

                    }

                }

            }

        );

}



// ============================================================
// GRAFIK PERSENTASE PENYERAPAN
//
// Doughnut:
// Realisasi
// Sisa
// ============================================================

function buatGrafikPersentase(
    data
) {

    const canvas =

        document.getElementById(

            "grafikPersentase"

        );


    if (!canvas) {

        console.warn(

            "Canvas grafikPersentase tidak ditemukan."

        );


        return;

    }


    if (
        typeof Chart ===
        "undefined"
    ) {

        return;

    }


    if (chartPersentase) {

        chartPersentase.destroy();

    }


    chartPersentase =

        new Chart(

            canvas,

            {

                plugins: [directValueLabelsPlugin],

                type:
                    "doughnut",


                data: {

                    labels: [

                        "Realisasi",

                        "Sisa Anggaran"

                    ],


                    datasets: [

                        {

                            data: [

                                data.realisasi,

                                data.sisa

                            ],


                            backgroundColor: [

                                "rgba(25, 135, 84, 0.80)",

                                "rgba(222, 226, 230, 0.90)"

                            ],


                            borderWidth:

                                1

                        }

                    ]

                },


                options: {

                    responsive:
                        true,


            animation: {
                duration: 0
            },
                    maintainAspectRatio:
                        false,


                    cutout:
                        "65%",


                    plugins: {

                        legend: {

                            position:
                                "top"

                        },


                        tooltip: {

                            callbacks: {

                                label:

                                    function (
                                        context
                                    ) {

                                        const nilai =

                                            context.raw || 0;


                                        return (

                                            context.label

                                            +

                                            ": "

                                            +

                                            formatRupiahGrafik(

                                                nilai

                                            )

                                        );

                                    }

                            }

                        }

                    }

                }

            }

        );

}



// ============================================================
// PARSE NUMBER
// ============================================================

function parseNumberGrafik(
    value
) {

    if (
        value === null ||
        value === undefined
    ) {

        return null;

    }


    let text =

        String(

            value

        ).trim();


    if (
        text === "" ||
        text === "-"
    ) {

        return null;

    }


    if (
        text.includes(
            "%"
        )
    ) {

        return null;

    }


    // ========================================================
    // HAPUS Rp
    // ========================================================

    text =

        text.replace(

            /Rp/gi,

            ""

        );


    // ========================================================
    // HAPUS SPASI
    // ========================================================

    text =

        text.replace(

            /\s/g,

            ""

        );


    // ========================================================
    // TITIK + KOMA
    // ========================================================

    if (
        text.includes(
            "."
        ) &&
        text.includes(
            ","
        )
    ) {

        const lastDot =

            text.lastIndexOf(
                "."
            );


        const lastComma =

            text.lastIndexOf(
                ","
            );


        // ====================================================
        // FORMAT INDONESIA
        // 3.133.003.500,00
        // ====================================================

        if (
            lastComma >
            lastDot
        ) {

            text =

                text.replace(

                    /\./g,

                    ""

                );


            text =

                text.replace(

                    ",",

                    "."

                );

        }


        // ====================================================
        // FORMAT INTERNASIONAL
        // 3,133,003,500.00
        // ====================================================

        else {

            text =

                text.replace(

                    /,/g,

                    ""

                );

        }

    }


    // ========================================================
    // HANYA TITIK
    // ========================================================

    else if (
        text.includes(
            "."
        )
    ) {

        const bagian =

            text.split(
                "."
            );


        if (
            bagian.length > 1 &&
            bagian
                .slice(
                    1
                )
                .every(

                    function (
                        x
                    ) {

                        return (

                            x.length ===
                            3

                        );

                    }

                )
        ) {

            text =

                bagian.join(
                    ""
                );

        }

    }


    // ========================================================
    // HANYA KOMA
    // ========================================================

    else if (
        text.includes(
            ","
        )
    ) {

        const bagian =

            text.split(
                ","
            );


        if (
            bagian.length > 1 &&
            bagian
                .slice(
                    1
                )
                .every(

                    function (
                        x
                    ) {

                        return (

                            x.length ===
                            3

                        );

                    }

                )
        ) {

            text =

                bagian.join(
                    ""
                );

        }

        else {

            text =

                text.replace(

                    ",",

                    "."

                );

        }

    }


    // ========================================================
    // SISAKAN ANGKA
    // ========================================================

    text =

        text.replace(

            /[^0-9.-]/g,

            ""

        );


    if (!text) {

        return null;

    }


    const number =

        Number(
            text
        );


    if (
        !Number.isFinite(
            number
        )
    ) {

        return null;

    }


    return number;

}



// ============================================================
// FORMAT RUPIAH
// ============================================================

function formatRupiahGrafik(
    value
) {

    const number =

        Number(
            value
        ) || 0;


    return (

        "Rp"

        +

        Math.round(

            number

        ).toLocaleString(

            "id-ID"

        )

    );

}



// ============================================================
// FORMAT RUPIAH SINGKAT
// ============================================================

function formatSingkatRupiah(
    value
) {

    const number =

        Number(
            value
        ) || 0;


    // ========================================================
    // MILIAR
    // ========================================================

    if (
        number >=
        1000000000
    ) {

        return (

            "Rp"

            +

            (
                number /
                1000000000
            )
                .toLocaleString(

                    "id-ID",

                    {

                        maximumFractionDigits:
                            1

                    }

                )

            +

            " M"

        );

    }


    // ========================================================
    // JUTA
    // ========================================================

    if (
        number >=
        1000000
    ) {

        return (

            "Rp"

            +

            (
                number /
                1000000
            )
                .toLocaleString(

                    "id-ID",

                    {

                        maximumFractionDigits:
                            1

                    }

                )

            +

            " Jt"

        );

    }


    // ========================================================
    // RIBU
    // ========================================================

    if (
        number >=
        1000
    ) {

        return (

            "Rp"

            +

            (
                number /
                1000
            )
                .toLocaleString(

                    "id-ID",

                    {

                        maximumFractionDigits:
                            1

                    }

                )

            +

            " Rb"

        );

    }


    return (

        "Rp"

        +

        number.toLocaleString(

            "id-ID"

        )

    );

}



// ============================================================
// FORMAT PERSEN
// ============================================================

function formatPersenGrafik(
    value
) {

    const number =

        Number(
            value
        ) || 0;


    return (

        number.toLocaleString(

            "id-ID",

            {

                minimumFractionDigits:
                    2,

                maximumFractionDigits:
                    2

            }

        )

        +

        "%"

    );

}



// ============================================================
// SET TEXT
// ============================================================

function setTextGrafik(
    id,
    value
) {

    const element =

        document.getElementById(

            id

        );


    if (element) {

        element.textContent =

            value;

    }

}



// ============================================================
// CLEAN TEXT
// ============================================================

function cleanGrafik(
    value
) {

    if (
        value === null ||
        value === undefined
    ) {

        return "";

    }


    return String(

        value

    )

        .replace(

            /\s+/g,

            " "

        )

        .trim();

}



// ============================================================
// ESCAPE HTML
// ============================================================

function escapeHtmlGrafik(
    value
) {

    return String(

        value ?? ""

    )

        .replace(

            /&/g,

            "&amp;"

        )

        .replace(

            /</g,

            "&lt;"

        )

        .replace(

            />/g,

            "&gt;"

        )

        .replace(

            /"/g,

            "&quot;"

        )

        .replace(

            /'/g,

            "&#039;"

        );

}