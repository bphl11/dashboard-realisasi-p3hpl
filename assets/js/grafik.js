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
// 1. Realisasi + RPD Bulanan
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

let chartStatusAnggaran = null;

let chartPerbandingan = null;

let chartPersentase = null;

let grafikRpdBulanan = Array(12).fill(0);

let grafikRpdTotal = 0;

function ambilRpdBulananGrafik() {
    const kosong = { bulanan: Array(12).fill(0), total: 0, tersedia: false };

    try {
        const rawUser = sessionStorage.getItem("p3hpl_rpd_user_v1");
        const user = rawUser ? JSON.parse(rawUser) : null;
        const token = String(user?.id_token || "").trim();

        if (!token) return Promise.resolve(kosong);

        const apiUrl =
            typeof RPD_CONFIG !== "undefined"
                ? String(RPD_CONFIG.RPD_PROXY_URL || RPD_CONFIG.RPD_API_URL || "").trim()
                : "";

        if (!apiUrl) return Promise.resolve(kosong);

        return fetch(apiUrl, {
            method: "POST",
            headers: { "Content-Type": "text/plain;charset=utf-8" },
            body: JSON.stringify({ action: "list", id_token: token }),
            redirect: "follow",
            credentials: "omit",
            cache: "no-store"
        }).then(function (response) {
            return response.text().then(function (text) {
                let result;
                try {
                    result = JSON.parse(text);
                } catch (error) {
                    throw new Error("Respons RPD bukan JSON yang valid.");
                }

                if (!response.ok || result?.ok === false) {
                    throw new Error(result?.message || "Data RPD tidak dapat dibaca.");
                }

                const rows = Array.isArray(result.rpd) ? result.rpd : [];
                const fields = [
                    "jan_m1","jan_m2","jan_m3","jan_m4",
                    "feb_m1","feb_m2","feb_m3","feb_m4",
                    "mar_m1","mar_m2","mar_m3","mar_m4",
                    "apr_m1","apr_m2","apr_m3","apr_m4",
                    "mei_m1","mei_m2","mei_m3","mei_m4",
                    "jun_m1","jun_m2","jun_m3","jun_m4",
                    "jul_m1","jul_m2","jul_m3","jul_m4",
                    "agu_m1","agu_m2","agu_m3","agu_m4",
                    "sep_m1","sep_m2","sep_m3","sep_m4",
                    "okt_m1","okt_m2","okt_m3","okt_m4",
                    "nov_m1","nov_m2","nov_m3","nov_m4",
                    "des_m1","des_m2","des_m3","des_m4"
                ];
                const bulanan = Array(12).fill(0);

                rows.forEach(function (row) {
                    for (let month = 0; month < 12; month++) {
                        const start = month * 4;
                        for (let week = 0; week < 4; week++) {
                            bulanan[month] += Number(row?.[fields[start + week]]) || 0;
                        }
                    }
                });

                return {
                    bulanan,
                    total: bulanan.reduce((sum, value) => sum + value, 0),
                    tersedia: true
                };
            });
        }).catch(function (error) {
            console.warn("RPD grafik tidak dapat dimuat:", error);
            return kosong;
        });
    } catch (error) {
        console.warn("RPD grafik gagal membaca sesi login:", error);
        return Promise.resolve(kosong);
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

            grafikRawData =

                await getSheetDataMonitoring();


            if (
                !Array.isArray(
                    grafikRawData
                )
            ) {

                throw new Error(

                    "Data Google Sheet tidak valid."

                );

            }


            console.log(

                "JUMLAH BARIS RAW:",

                grafikRawData.length

            );


            // =================================================
            // PARSE DATA DETAIL
            //
            // Menggunakan parser yang sama dengan Laporan.
            // =================================================

            grafikParsedData =

                parseDataMonitoring(

                    grafikRawData

                );


            console.log(

                "JUMLAH DATA PARSER:",

                grafikParsedData.length

            );


            // =================================================
            // AMBIL TOTAL UTAMA
            //
            // Untuk grafik bulanan tetap menggunakan fungsi
            // khusus karena membutuhkan Januari - Desember.
            // =================================================

            const calculation = hitungCalculationEngine(grafikRawData, grafikParsedData);

            const totalData = { ...calculation.total, bulanan: ambilDataUtamaGrafik(grafikRawData).bulanan };

            const rpdGrafik = await ambilRpdBulananGrafik();
            grafikRpdBulanan = rpdGrafik.bulanan;
            grafikRpdTotal = rpdGrafik.total;

            const statusRpdGrafik = document.getElementById("statusRpdGrafik");
            if (statusRpdGrafik) {
                statusRpdGrafik.textContent = rpdGrafik.tersedia
                    ? "RPD terisi: " + formatRupiahGrafik(grafikRpdTotal)
                    : "RPD belum dapat dimuat pada sesi ini. Login pada halaman RPD untuk menampilkan RPD terisi.";
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

function tampilkanCardGrafik(
    data
) {

    setTextGrafik(

        "totalPagu",

        formatRupiahGrafik(

            data.pagu

        )

    );


    setTextGrafik(

        "totalRealisasi",

        formatRupiahGrafik(

            data.realisasi

        )

    );


    setTextGrafik(

        "sisaAnggaran",

        formatRupiahGrafik(

            data.sisa

        )

    );


    setTextGrafik(

        "persentase",

        formatPersenGrafik(

            data.persen

        )

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

                                            context.dataset.label + ": "

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
