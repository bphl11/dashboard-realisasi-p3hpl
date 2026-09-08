// ============================================================
// APP.JS
// DASHBOARD REALISASI ANGGARAN P3HPHL
// ============================================================


// ============================================================
// VARIABEL GLOBAL
// ============================================================

let dashboardRawData = [];


// ============================================================
// LOAD DASHBOARD
// ============================================================

document.addEventListener(
    "DOMContentLoaded",
    async function () {

        try {

            console.log(
                "=== LOAD DASHBOARD ==="
            );


            // =================================================
            // AMBIL DATA GOOGLE SHEET
            // =================================================

            dashboardRawData =
                await getSheetData();


            if (
                !dashboardRawData ||
                !Array.isArray(
                    dashboardRawData
                )
            ) {

                throw new Error(
                    "Data Google Sheet tidak valid."
                );

            }


            console.log(
                "JUMLAH BARIS DASHBOARD:",
                dashboardRawData.length
            );


            // =================================================
            // AMBIL TOTAL UTAMA
            // =================================================

            const parsedDashboardData = parseDataMonitoring(dashboardRawData);

            const calculation = hitungCalculationEngine(dashboardRawData, parsedDashboardData);

            const totalSemua = calculation.total;


            console.log(
                "TOTAL DASHBOARD SEMUA:",
                totalSemua
            );


            // =================================================
            // HITUNG DASHBOARD TANPA BLOKIR
            // =================================================

            const totalTanpaBlokir = calculation.tanpaBlokir;


            console.log(
                "TOTAL DASHBOARD TANPA BLOKIR:",
                totalTanpaBlokir
            );


            // =================================================
            // TAMPILKAN CARD
            // =================================================

            tampilkanCardDashboard(
                totalTanpaBlokir
            );


            // =================================================
            // TAMPILKAN GRAFIK BULANAN
            // =================================================

            tampilkanGrafikBulanan(
                dashboardRawData
            );

            tampilkanDashboardKomponen(
                parsedDashboardData
            );



            // =================================================
            // TAMPILKAN MONITORING RINGKAS
            // =================================================

            tampilkanMonitoringDashboard(
                dashboardRawData
            );


        } catch (error) {

            console.error(
                "ERROR DASHBOARD:",
                error
            );


            tampilkanErrorDashboard(
                error
            );

        }

    }
);


// ============================================================
// AMBIL TOTAL DASHBOARD
//
// Total utama tetap diambil dari baris summary utama Excel.
//
// Dashboard TIDAK menjumlahkan seluruh item akun.
//
// F = PAGU
// S = REALISASI
// T = SISA
// ============================================================

function ambilTotalDashboard(data) {

    // ========================================================
    // JIKA PARSER.JS TERSEDIA
    // GUNAKAN FUNGSI TOTAL UTAMA DARI PARSER
    // ========================================================

    if (
        typeof ambilTotalUtama ===
        "function"
    ) {

        const totalParser =
            ambilTotalUtama(
                data
            );


        if (totalParser) {

            return {

                pagu:
                    Number(
                        totalParser.pagu
                    ) || 0,

                realisasi:
                    Number(
                        totalParser.realisasi
                    ) || 0,

                sisa:
                    Number(
                        totalParser.sisa
                    ) || 0,

                persen:
                    Number(
                        totalParser.persen
                    ) || 0

            };

        }

    }


    // ========================================================
    // FALLBACK
    // JIKA PARSER.JS TIDAK TERSEDIA
    // ========================================================

    let kandidat = [];


    for (
        let i = 0;
        i < data.length;
        i++
    ) {

        const row =
            data[i] || [];


        const nama =
            cleanDashboard(
                row[1]
            );


        const pagu =
            parseNumberDashboard(
                row[5]
            );


        const realisasi =
            parseNumberDashboard(
                row[18]
            );


        const sisa =
            parseNumberDashboard(
                row[19]
            );


        if (
            pagu === null ||
            pagu <= 0
        ) {

            continue;

        }


        kandidat.push({

            index:
                i,

            nama:
                nama,

            pagu:
                pagu || 0,

            realisasi:
                realisasi || 0,

            sisa:
                sisa !== null

                    ? sisa

                    : Math.max(

                        pagu -
                        (realisasi || 0),

                        0

                    )

        });

    }


    // ========================================================
    // PRIORITAS 1
    // PAGU SEKSI
    // ========================================================

    let total =
        kandidat.find(

            item =>

                /pagu\s+seksi/i
                    .test(
                        item.nama
                    )

        );


    // ========================================================
    // PRIORITAS 2
    // BARIS MENGANDUNG PAGU
    // ========================================================

    if (!total) {

        total =
            kandidat.find(

                item =>

                    /\bpagu\b/i
                        .test(
                            item.nama
                        )

            );

    }


    // ========================================================
    // PRIORITAS 3
    // PAGU TERBESAR
    // ========================================================

    if (!total) {

        total =
            kandidat.reduce(

                (
                    terbesar,
                    sekarang
                ) => {

                    if (!terbesar) {

                        return sekarang;

                    }


                    return (

                        sekarang.pagu >
                        terbesar.pagu

                    )

                        ? sekarang

                        : terbesar;

                },

                null

            );

    }


    if (!total) {

        return {

            pagu: 0,

            realisasi: 0,

            sisa: 0,

            persen: 0

        };

    }


    const persen =

        total.pagu > 0

            ? (

                total.realisasi /
                total.pagu

            ) * 100

            : 0;


    return {

        pagu:
            total.pagu,

        realisasi:
            total.realisasi,

        sisa:
            total.sisa,

        persen:
            persen

    };

}


// ============================================================
// HITUNG DASHBOARD TANPA BLOKIR
//
// ATURAN:
//
// PAGU:
// Tetap menggunakan Total Pagu utama.
//
// REALISASI:
// Total Realisasi Semua - Realisasi Diblokir.
//
// SISA:
// Total Pagu - Realisasi Tanpa Blokir.
//
// PERSENTASE:
// Realisasi Tanpa Blokir / Total Pagu.
//
// PENTING:
// Data Normal TIDAK dijumlahkan langsung karena berisiko
// terjadi double count parent item dan rincian.
//
// Kita mencari nilai Diblokir dengan parser,
// kemudian:
//
// NORMAL = TOTAL - DIBLOKIR
// ============================================================

function hitungDashboardTanpaBlokir(
    rawData,
    totalSemua
) {

    const totalPagu =
        Number(
            totalSemua.pagu
        ) || 0;


    const totalRealisasi =
        Number(
            totalSemua.realisasi
        ) || 0;


    // ========================================================
    // VALIDASI PARSER
    // ========================================================

    if (
        typeof parseDataMonitoring !==
        "function"
    ) {

        console.warn(
            "parseDataMonitoring() tidak ditemukan."
        );


        return {

            pagu:
                totalPagu,

            realisasi:
                totalRealisasi,

            sisa:
                Math.max(
                    totalPagu -
                    totalRealisasi,
                    0
                ),

            persen:

                totalPagu > 0

                    ? (

                        totalRealisasi /
                        totalPagu

                    ) * 100

                    : 0

        };

    }


    // ========================================================
    // PARSE RAW DATA
    // ========================================================

    const parsedData =
        parseDataMonitoring(
            rawData
        );


    if (
        !Array.isArray(
            parsedData
        )
    ) {

        return totalSemua;

    }


    // ========================================================
    // AMBIL DATA DIBLOKIR
    // ========================================================

    const dataDiblokir =
        parsedData.filter(

            function (item) {

                return (

                    item.statusPagu ===
                    "Diblokir"

                );

            }

        );


    console.log(
        "JUMLAH DATA DIBLOKIR DASHBOARD:",
        dataDiblokir.length
    );


    // ========================================================
    // HITUNG RINGKASAN DIBLOKIR
    // ========================================================

    let ringkasanDiblokir = {

        pagu: 0,

        realisasi: 0,

        sisa: 0,

        persen: 0

    };


    if (
        typeof hitungRingkasanDetail ===
        "function"
    ) {

        ringkasanDiblokir =
            hitungRingkasanDetail(
                dataDiblokir
            );

    }

    else {

        console.warn(
            "hitungRingkasanDetail() tidak ditemukan."
        );

    }


    // ========================================================
    // REALISASI DIBLOKIR
    //
    // Tidak boleh lebih besar dari Total Realisasi.
    // ========================================================

    const realisasiDiblokir =
        Math.min(

            Math.max(

                Number(
                    ringkasanDiblokir.realisasi
                ) || 0,

                0

            ),

            totalRealisasi

        );


    // ========================================================
    // REALISASI TANPA BLOKIR
    //
    // NORMAL = TOTAL - DIBLOKIR
    // ========================================================

    const realisasiTanpaBlokir =
        Math.max(

            totalRealisasi -
            realisasiDiblokir,

            0

        );


    // ========================================================
    // SISA ANGGARAN
    // ========================================================

    const sisaTanpaBlokir =
        Math.max(

            totalPagu -
            realisasiTanpaBlokir,

            0

        );


    // ========================================================
    // PERSENTASE
    // ========================================================

    const persenTanpaBlokir =

        totalPagu > 0

            ? (

                realisasiTanpaBlokir /
                totalPagu

            ) * 100

            : 0;


    // ========================================================
    // DEBUG
    // ========================================================

    console.log(
        "===================================="
    );


    console.log(
        "DASHBOARD TANPA BLOKIR"
    );


    console.log(
        "Total Pagu:",
        totalPagu
    );


    console.log(
        "Total Realisasi Semua:",
        totalRealisasi
    );


    console.log(
        "Ringkasan Diblokir:",
        ringkasanDiblokir
    );


    console.log(
        "Realisasi Diblokir:",
        realisasiDiblokir
    );


    console.log(
        "Realisasi Tanpa Blokir:",
        realisasiTanpaBlokir
    );


    console.log(
        "Sisa Anggaran:",
        sisaTanpaBlokir
    );


    console.log(
        "Persentase:",
        persenTanpaBlokir
    );


    console.log(
        "===================================="
    );


    return {

        pagu:
            totalPagu,

        realisasi:
            realisasiTanpaBlokir,

        sisa:
            sisaTanpaBlokir,

        persen:
            persenTanpaBlokir

    };

}


// ============================================================
// TAMPILKAN CARD DASHBOARD
// ============================================================

function tampilkanCardDashboard(total) {
    const element = document.getElementById("realisasiTanpaBlokir");
    if (element) {
        element.innerText = formatRupiahDashboard(Number(total?.realisasi) || 0);
    }
}

function tampilkanGrafikBulanan(
    data
) {

    const container =
        document.getElementById(
            "grafikBulanan"
        );


    if (!container) {

        return;

    }


    const namaBulan = [

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


    // ========================================================
    // CARI BARIS TOTAL UTAMA
    // ========================================================

    let barisTotal =
        null;


    for (
        let i = 0;
        i < data.length;
        i++
    ) {

        const row =
            data[i] || [];


        const nama =
            cleanDashboard(
                row[1]
            );


        if (
            /pagu\s+seksi/i
                .test(
                    nama
                )
        ) {

            barisTotal =
                row;

            break;

        }

    }


    // ========================================================
    // FALLBACK PAGU TERBESAR
    // ========================================================

    if (!barisTotal) {

        let paguTerbesar =
            0;


        data.forEach(

            row => {

                const pagu =
                    parseNumberDashboard(
                        row[5]
                    ) || 0;


                if (
                    pagu >
                    paguTerbesar
                ) {

                    paguTerbesar =
                        pagu;

                    barisTotal =
                        row;

                }

            }

        );

    }


    if (!barisTotal) {

        container.innerHTML =
            "Data grafik belum tersedia.";

        return;

    }


    // ========================================================
    // AMBIL DATA BULAN G - R
    // ========================================================

    const nilaiBulanan = [];


    for (
        let i = 6;
        i <= 17;
        i++
    ) {

        nilaiBulanan.push(

            parseNumberDashboard(
                barisTotal[i]
            ) || 0

        );

    }


    const maxValue =
        Math.max(
            ...nilaiBulanan,
            1
        );


    let html = `

        <div class="dashboard-chart">

    `;


    namaBulan.forEach(

        (
            bulan,
            index
        ) => {

            const nilai =
                nilaiBulanan[
                    index
                ];


            const persenBar =

                maxValue > 0

                    ? (

                        nilai /
                        maxValue

                    ) * 100

                    : 0;


            html += `

                <div
                    style="
                        display:grid;
                        grid-template-columns:100px 1fr 150px;
                        gap:10px;
                        align-items:center;
                        margin-bottom:10px;
                    "
                >

                    <div>
                        ${bulan}
                    </div>


                    <div
                        style="
                            height:20px;
                            background:#eeeeee;
                            border-radius:4px;
                            overflow:hidden;
                        "
                    >

                        <div
                            style="
                                width:${persenBar}%;
                                height:100%;
                                background:#198754;
                            "
                        ></div>

                    </div>


                    <div
                        style="
                            text-align:right;
                            font-weight:600;
                        "
                    >

                        ${formatRupiahDashboard(
                            nilai
                        )}

                    </div>

                </div>

            `;

        }

    );


    html += `

        </div>

    `;


    container.innerHTML =
        html;

}


// ============================================================
// TAMPILKAN MONITORING RINGKAS
// ============================================================

function tampilkanMonitoringDashboard(rawData) {
    const container = document.getElementById("monitoringDashboard");
    if (!container) return;
    const parsed = typeof parseDataMonitoring === "function" ? parseDataMonitoring(rawData) : [];
    const normal = parsed.filter(item => item && item.statusPagu === "Normal");
    const map = new Map();
    normal.forEach(item => {
        const komponen = item.komponen || "-";
        const subKomponen = item.subKomponen || "-";
        const key = komponen + "||" + subKomponen;
        if (!map.has(key)) map.set(key, []);
        map.get(key).push(item);
    });
    const rows = Array.from(map.entries()).map(([key, items]) => {
        const [komponen, subKomponen] = key.split("||");
        const ringkasan = typeof hitungRingkasanDetail === "function" ? hitungRingkasanDetail(items) : { realisasi: 0 };
        return { komponen, subKomponen, realisasi: Number(ringkasan.realisasi) || 0 };
    }).filter(item => item.realisasi > 0).sort((a,b) => b.realisasi-a.realisasi);
    container.innerHTML = `<div class="table-responsive"><table class="table table-sm table-striped"><thead><tr><th>Komponen</th><th>Sub Komponen</th><th class="text-end">Realisasi Tanpa Blokir</th></tr></thead><tbody>${rows.length ? rows.map(item => `<tr><td>${escapeHtmlDashboard(item.komponen)}</td><td>${escapeHtmlDashboard(item.subKomponen)}</td><td class="text-end">${formatRupiahDashboard(item.realisasi)}</td></tr>`).join("") : '<tr><td colspan="3" class="text-center text-muted">Tidak ada realisasi tanpa blokir.</td></tr>'}</tbody></table></div>`;
}

function tampilkanErrorDashboard(
    error
) {

    const grafik =
        document.getElementById(
            "grafikBulanan"
        );


    const monitoring =
        document.getElementById(
            "monitoringDashboard"
        );


    if (grafik) {

        grafik.innerHTML = `

            <div
                class="alert alert-danger"
            >

                Gagal memuat data Dashboard.

            </div>

        `;

    }


    if (monitoring) {

        monitoring.innerHTML = `

            <div
                class="alert alert-danger"
            >

                ${
                    escapeHtmlDashboard(
                        error.message ||
                        "Terjadi kesalahan."
                    )
                }

            </div>

        `;

    }

}


// ============================================================
// PARSE NUMBER
// ============================================================

function parseNumberDashboard(
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
        text.includes("%")
    ) {

        return null;

    }


    text =
        text.replace(
            /Rp/gi,
            ""
        );


    text =
        text.replace(
            /\s/g,
            ""
        );


    text =
        text.replace(
            /\./g,
            ""
        );


    text =
        text.replace(
            /,/g,
            "."
        );


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
        Number.isNaN(
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

function formatRupiahDashboard(
    value
) {

    const number =
        Number(
            value
        ) || 0;


    return (

        "Rp" +

        Math.round(
            number
        ).toLocaleString(
            "id-ID"
        )

    );

}


// ============================================================
// FORMAT PERSEN
// ============================================================

function formatPersenDashboard(
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

function setTextDashboard(
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
// CLEAN
// ============================================================

function cleanDashboard(
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

function escapeHtmlDashboard(
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

// ============================================================
// DASHBOARD CARD PER KOMPONEN
// ============================================================

function tampilkanDashboardKomponen(parsedData) {
    const container = document.getElementById("dashboardKomponen");
    if (!container) return;
    const normal = Array.isArray(parsedData) ? parsedData.filter(item => item && item.statusPagu === "Normal" && item.komponen && item.komponen !== "-") : [];
    const map = new Map();
    normal.forEach(item => {
        if (!map.has(item.komponen)) map.set(item.komponen, []);
        map.get(item.komponen).push(item);
    });
    const cards = Array.from(map.entries()).map(([nama, items]) => {
        const ringkasan = typeof hitungRingkasanDetail === "function" ? hitungRingkasanDetail(items) : { realisasi: 0 };
        return { nama, realisasi: Number(ringkasan.realisasi) || 0 };
    }).filter(item => item.realisasi > 0).sort((a,b) => b.realisasi-a.realisasi);
    container.innerHTML = cards.length ? cards.map(item => `<div class="col-md-6 col-xl-4"><div class="card dashboard-card h-100"><h6><i class="bi bi-folder"></i> ${escapeHtmlDashboard(item.nama)}</h6><hr><small class="text-muted">Realisasi Tanpa Blokir</small><h4>${formatRupiahDashboard(item.realisasi)}</h4></div></div>`).join("") : '<div class="col-12 text-muted">Tidak ada realisasi tanpa blokir.</div>';
}
