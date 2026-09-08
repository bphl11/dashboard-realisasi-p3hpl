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

let chartStatusAnggaran = null;

let chartPerbandingan = null;

let chartPersentase = null;



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

                totalData.bulanan

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
    bulanan
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

                type:
                    "bar",


                data: {

                    labels:
                        bulan,


                    datasets: [

                        {

                            label:

                                "Realisasi Bulanan",


                            data:

                                bulanan,


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

                                            "Realisasi: "

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