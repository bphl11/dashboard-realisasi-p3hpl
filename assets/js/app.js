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

            const totalSemua =
                ambilTotalDashboard(
                    dashboardRawData
                );


            console.log(
                "TOTAL DASHBOARD SEMUA:",
                totalSemua
            );


            // =================================================
            // HITUNG DASHBOARD TANPA BLOKIR
            // =================================================

            const totalTanpaBlokir =
                hitungDashboardTanpaBlokir(
                    dashboardRawData,
                    totalSemua
                );


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
                dashboardRawData
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

function tampilkanCardDashboard(
    total
) {

    setTextDashboard(
        "totalPagu",
        formatRupiahDashboard(
            total.pagu
        )
    );


    setTextDashboard(
        "totalRealisasi",
        formatRupiahDashboard(
            total.realisasi
        )
    );


    setTextDashboard(
        "sisaAnggaran",
        formatRupiahDashboard(
            total.sisa
        )
    );


    setTextDashboard(
        "persentase",
        formatPersenDashboard(
            total.persen
        )
    );

}


// ============================================================
// TAMPILKAN GRAFIK BULANAN
// ============================================================

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

function tampilkanMonitoringDashboard(
    data
) {

    const container =
        document.getElementById(
            "monitoringDashboard"
        );


    if (!container) {

        return;

    }


    const hasil = [];

    let akunKode = "";
    let akunNama = "";


    for (
        let i = 0;
        i < data.length;
        i++
    ) {

        const row =
            data[i] || [];


        const kode =
            cleanDashboard(
                row[0]
            );


        const nama =
            cleanDashboard(
                row[1]
            );


        // ====================================================
        // DETEKSI AKUN
        // ====================================================

        if (
            /^5\d{5}$/
                .test(
                    kode
                ) &&
            nama
                .toLowerCase()
                .startsWith(
                    "belanja"
                )
        ) {

            akunKode =
                kode;

            akunNama =
                nama;

            continue;

        }


        if (!akunNama) {

            continue;

        }


        // ====================================================
        // ITEM
        // ====================================================

        if (
            !nama ||
            /^5\d{5}$/
                .test(
                    kode
                )
        ) {

            continue;

        }


        const pagu =
            parseNumberDashboard(
                row[5]
            );


        const realisasi =
            parseNumberDashboard(
                row[18]
            );


        if (
            pagu === null
        ) {

            continue;

        }


        hasil.push({

            kode:
                akunKode,

            akun:
                akunNama,

            item:
                nama.replace(
                    /^\s*-\s*/,
                    ""
                ),

            pagu:
                pagu || 0,

            realisasi:
                realisasi || 0

        });


        if (
            hasil.length >=
            10
        ) {

            break;

        }

    }


    if (
        hasil.length === 0
    ) {

        container.innerHTML =
            "Data Monitoring belum tersedia.";

        return;

    }


    let html = `

        <div class="table-responsive">

            <table
                class="table table-striped table-bordered"
            >

                <thead>

                    <tr>

                        <th>
                            Kode
                        </th>

                        <th>
                            Akun Belanja
                        </th>

                        <th>
                            Item
                        </th>

                        <th>
                            Pagu
                        </th>

                        <th>
                            Realisasi
                        </th>

                    </tr>

                </thead>

                <tbody>

    `;


    hasil.forEach(

        item => {

            html += `

                <tr>

                    <td>
                        ${escapeHtmlDashboard(
                            item.kode
                        )}
                    </td>

                    <td>
                        ${escapeHtmlDashboard(
                            item.akun
                        )}
                    </td>

                    <td>
                        ${escapeHtmlDashboard(
                            item.item
                        )}
                    </td>

                    <td>
                        ${formatRupiahDashboard(
                            item.pagu
                        )}
                    </td>

                    <td>
                        ${formatRupiahDashboard(
                            item.realisasi
                        )}
                    </td>

                </tr>

            `;

        }

    );


    html += `

                </tbody>

            </table>

        </div>

        <div class="text-end mt-3">

            <a
                href="monitoring.html"
                class="btn btn-success btn-sm"
            >

                Lihat Semua Monitoring

            </a>

        </div>

    `;


    container.innerHTML =
        html;

}


// ============================================================
// ERROR DASHBOARD
// ============================================================

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

function tampilkanDashboardKomponen(rawData) {

    const container =
        document.getElementById("dashboardKomponen");

    if (!container) return;

    if (typeof parseDataMonitoring !== "function") {

        container.innerHTML =
            `<div class="alert alert-warning">
                Parser tidak ditemukan.
            </div>`;

        return;
    }

    const data = parseDataMonitoring(rawData);

console.log("HASIL PARSER");
console.log(data);
console.log(data[0]);
console.log(data[1]);

    const komponenMap =
        new Map();
    console.table(data.slice(0,10));
    data.forEach(item => {

        if (
            item.isRincian ||
            !item.komponen
        ) return;

        if (!komponenMap.has(item.komponen)) {

            komponenMap.set(item.komponen, {
                pagu: 0,
                realisasi: 0
            });

        }

        const obj =
            komponenMap.get(item.komponen);

        obj.pagu +=
            Number(item.pagu) || 0;

        obj.realisasi +=
            Number(item.realisasi) || 0;

    });

    let html = "";

    komponenMap.forEach((nilai, nama) => {

        const persen =
            nilai.pagu > 0
            ? (nilai.realisasi / nilai.pagu) * 100
            : 0;

        html += `

<div class="col-lg-4 col-md-6">

<div class="card shadow-sm border-0 h-100">

<div class="card-body">

<h5 class="fw-bold text-success">

<i class="bi bi-folder2-open"></i>

${escapeHtmlDashboard(nama)}

</h5>

<hr>

<p class="mb-2">

<small class="text-muted">
Pagu
</small>

<br>

<strong>

${formatRupiahDashboard(
    nilai.pagu
)}

</strong>

</p>

<p class="mb-3">

<small class="text-muted">
Realisasi
</small>

<br>

<strong class="text-success">

${formatRupiahDashboard(
    nilai.realisasi
)}

</strong>

</p>

<div class="progress mb-2"
style="height:10px">

<div
class="progress-bar bg-success"
style="width:${persen}%">

</div>

</div>

<div class="text-end">

<strong>

${formatPersenDashboard(
    persen
)}

</strong>

</div>

</div>

</div>

</div>

`;

    });

    container.innerHTML = html;

}