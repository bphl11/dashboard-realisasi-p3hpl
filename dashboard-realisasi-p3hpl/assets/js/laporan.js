// ============================================================
// LAPORAN.JS
// Laporan Realisasi Anggaran P3HPHL
//
// Membutuhkan:
// - config.js
// - api.js
// - parser.js
//
// FILTER:
// - Komponen
// - Sub Komponen
// - Akun Belanja
// - Status
// - Pencarian
//
// ATURAN RINGKASAN:
//
// 1. Tanpa filter:
//    menggunakan ambilTotalUtama(rawDataLaporan)
//
// 2. Hanya filter Komponen:
//    mengambil angka dari BARIS SUMMARY Komponen Excel
//
// 3. Hanya filter Komponen + Sub Komponen:
//    mengambil angka dari BARIS SUMMARY Sub Komponen Excel
//
// 4. Jika ada filter Akun:
//    menghitung detail hasil filter
//
// 5. Jika ada filter Status Normal/Diblokir:
//    menghitung detail sesuai status
//
// 6. Jika ada Pencarian:
//    menghitung detail hasil pencarian
//
// PENTING:
// Filter Status tidak boleh menggunakan summary hierarki utuh,
// karena summary Excel mencakup Normal + Diblokir.
// ============================================================


// ============================================================
// VARIABEL GLOBAL
// ============================================================

let rawDataLaporan = [];

let dataLaporan = [];

let dataLaporanFiltered = [];


// ============================================================
// HELPER ESCAPE HTML
// ============================================================

function escapeHtml(value) {

    if (
        value === null ||
        value === undefined
    ) {

        return "";

    }


    return String(value)

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
// HALAMAN SELESAI DIMUAT
// ============================================================

document.addEventListener(

    "DOMContentLoaded",

    async function () {

        console.log(
            "Laporan: halaman dimuat"
        );


        // ====================================================
        // CEK PARSER
        // ====================================================

        if (
            typeof parseDataMonitoring !==
            "function"
        ) {

            tampilkanErrorLaporan(

                "parser.js belum dimuat atau fungsi parseDataMonitoring tidak ditemukan."

            );


            return;

        }


        if (
            typeof ambilTotalUtama !==
            "function"
        ) {

            tampilkanErrorLaporan(

                "Fungsi ambilTotalUtama() tidak ditemukan di parser.js."

            );


            return;

        }


        if (
            typeof hitungRingkasanData !==
            "function"
        ) {

            tampilkanErrorLaporan(

                "Fungsi hitungRingkasanData() tidak ditemukan di parser.js."

            );


            return;

        }


        // ====================================================
        // LOAD DATA
        // ====================================================

        await loadLaporan();


        // ====================================================
        // EVENT FILTER
        // ====================================================

        pasangEventFilterLaporan();

    }

);


// ============================================================
// LOAD DATA LAPORAN
// ============================================================

async function loadLaporan() {

    try {

        console.log(
            "Laporan: mengambil data Google Sheet..."
        );


        // ====================================================
        // CEK API
        // ====================================================

        if (
            typeof getSheetDataMonitoring !==
            "function"
        ) {

            throw new Error(

                "Fungsi getSheetDataMonitoring() tidak ditemukan."

            );

        }


        // ====================================================
        // SIMPAN DATA MENTAH
        // ====================================================

        rawDataLaporan =

            await getSheetDataMonitoring();


        if (
            !Array.isArray(
                rawDataLaporan
            )
        ) {

            throw new Error(

                "Data Google Sheet bukan Array."

            );

        }


        console.log(

            "Laporan: jumlah baris mentah:",

            rawDataLaporan.length

        );


        // ====================================================
        // PARSE DATA
        // ====================================================

        dataLaporan =

            parseDataMonitoring(

                rawDataLaporan

            );


        if (
            !Array.isArray(
                dataLaporan
            )
        ) {

            throw new Error(

                "Hasil parseDataMonitoring() bukan Array."

            );

        }


        console.log(

            "Laporan: jumlah data hasil parser:",

            dataLaporan.length

        );


        // ====================================================
        // DATA AWAL
        // ====================================================

        dataLaporanFiltered =

            [...dataLaporan];


        // ====================================================
        // ISI FILTER
        // ====================================================

        isiFilterKomponenLaporan();

        isiFilterSubKomponenLaporan();

        isiFilterAkunLaporan();


        // ====================================================
        // TAMPILKAN
        // ====================================================

        jalankanFilterLaporan();

    }

    catch (error) {

        console.error(

            "ERROR LOAD LAPORAN:",

            error

        );


        tampilkanErrorLaporan(

            error.message

        );

    }

}


// ============================================================
// AMBIL NILAI UNIK
// ============================================================

function ambilNilaiUnikLaporan(
    data,
    field
) {

    const nilai =

        data

            .map(

                function (item) {

                    const value =
                        item[field];


                    if (
                        value === null ||
                        value === undefined
                    ) {

                        return "";

                    }


                    return String(

                        value

                    ).trim();

                }

            )

            .filter(

                function (value) {

                    return (

                        value !== "" &&

                        value !== "-"

                    );

                }

            );


    return [

        ...new Set(
            nilai
        )

    ].sort(

        function (a, b) {

            return a.localeCompare(

                b,

                "id"

            );

        }

    );

}


// ============================================================
// ISI FILTER KOMPONEN
// ============================================================

function isiFilterKomponenLaporan() {

    const select =

        document.getElementById(

            "filterKomponenLaporan"

        );


    if (!select) {

        return;

    }


    const daftar =

        ambilNilaiUnikLaporan(

            dataLaporan,

            "komponen"

        );


    select.innerHTML =

        '<option value="">Semua Komponen</option>';


    daftar.forEach(

        function (nilai) {

            const option =

                document.createElement(

                    "option"

                );


            option.value =
                nilai;


            option.textContent =
                nilai;


            select.appendChild(

                option

            );

        }

    );

}


// ============================================================
// ISI FILTER SUB KOMPONEN
// BERDASARKAN KOMPONEN
// ============================================================

function isiFilterSubKomponenLaporan() {

    const select =

        document.getElementById(

            "filterSubKomponenLaporan"

        );


    if (!select) {

        return;

    }


    const komponen =

        document.getElementById(

            "filterKomponenLaporan"

        )?.value || "";


    let sumberData =

        [...dataLaporan];


    // ========================================================
    // FILTER BERDASARKAN KOMPONEN
    // ========================================================

    if (komponen) {

        sumberData =

            sumberData.filter(

                function (item) {

                    return (

                        item.komponen ===
                        komponen

                    );

                }

            );

    }


    const daftar =

        ambilNilaiUnikLaporan(

            sumberData,

            "subKomponen"

        );


    select.innerHTML =

        '<option value="">Semua Sub Komponen</option>';


    daftar.forEach(

        function (nilai) {

            const option =

                document.createElement(

                    "option"

                );


            option.value =
                nilai;


            option.textContent =
                nilai;


            select.appendChild(

                option

            );

        }

    );

}


// ============================================================
// ISI FILTER AKUN
// BERDASARKAN KOMPONEN + SUB KOMPONEN
// ============================================================

function isiFilterAkunLaporan() {

    const select =

        document.getElementById(

            "filterAkunLaporan"

        );


    if (!select) {

        return;

    }


    const komponen =

        document.getElementById(

            "filterKomponenLaporan"

        )?.value || "";


    const subKomponen =

        document.getElementById(

            "filterSubKomponenLaporan"

        )?.value || "";


    let sumberData =

        [...dataLaporan];


    // ========================================================
    // FILTER KOMPONEN
    // ========================================================

    if (komponen) {

        sumberData =

            sumberData.filter(

                function (item) {

                    return (

                        item.komponen ===
                        komponen

                    );

                }

            );

    }


    // ========================================================
    // FILTER SUB KOMPONEN
    // ========================================================

    if (subKomponen) {

        sumberData =

            sumberData.filter(

                function (item) {

                    return (

                        item.subKomponen ===
                        subKomponen

                    );

                }

            );

    }


    const daftar =

        ambilNilaiUnikLaporan(

            sumberData,

            "akun"

        );


    select.innerHTML =

        '<option value="">Semua Akun Belanja</option>';


    daftar.forEach(

        function (nilai) {

            const option =

                document.createElement(

                    "option"

                );


            option.value =
                nilai;


            option.textContent =
                nilai;


            select.appendChild(

                option

            );

        }

    );

}


// ============================================================
// PASANG EVENT FILTER
// ============================================================

function pasangEventFilterLaporan() {

    const filterKomponen =

        document.getElementById(

            "filterKomponenLaporan"

        );


    const filterSubKomponen =

        document.getElementById(

            "filterSubKomponenLaporan"

        );


    const filterAkun =

        document.getElementById(

            "filterAkunLaporan"

        );


    const filterStatus =

        document.getElementById(

            "filterStatusLaporan"

        );


    const cari =

        document.getElementById(

            "cariLaporan"

        );


    // ========================================================
    // KOMPONEN
    // ========================================================

    if (filterKomponen) {

        filterKomponen.addEventListener(

            "change",

            function () {


                // Reset Sub Komponen

                if (filterSubKomponen) {

                    filterSubKomponen.value =
                        "";

                }


                // Reset Akun

                if (filterAkun) {

                    filterAkun.value =
                        "";

                }


                isiFilterSubKomponenLaporan();

                isiFilterAkunLaporan();

                jalankanFilterLaporan();

            }

        );

    }


    // ========================================================
    // SUB KOMPONEN
    // ========================================================

    if (filterSubKomponen) {

        filterSubKomponen.addEventListener(

            "change",

            function () {


                // Reset akun

                if (filterAkun) {

                    filterAkun.value =
                        "";

                }


                isiFilterAkunLaporan();

                jalankanFilterLaporan();

            }

        );

    }


    // ========================================================
    // AKUN
    // ========================================================

    if (filterAkun) {

        filterAkun.addEventListener(

            "change",

            function () {

                jalankanFilterLaporan();

            }

        );

    }


    // ========================================================
    // STATUS
    // ========================================================

    if (filterStatus) {

        filterStatus.addEventListener(

            "change",

            function () {

                jalankanFilterLaporan();

            }

        );

    }


    // ========================================================
    // PENCARIAN
    // ========================================================

    if (cari) {

        cari.addEventListener(

            "input",

            function () {

                jalankanFilterLaporan();

            }

        );

    }

}


// ============================================================
// JALANKAN FILTER
// ============================================================

function jalankanFilterLaporan() {

    const komponen =

        document.getElementById(

            "filterKomponenLaporan"

        )?.value || "";


    const subKomponen =

        document.getElementById(

            "filterSubKomponenLaporan"

        )?.value || "";


    const akun =

        document.getElementById(

            "filterAkunLaporan"

        )?.value || "";


    const status =

        document.getElementById(

            "filterStatusLaporan"

        )?.value || "";


    const cari =

        (

            document.getElementById(

                "cariLaporan"

            )?.value || ""

        )

            .trim()

            .toLowerCase();


    // ========================================================
    // FILTER DATA
    // ========================================================

    dataLaporanFiltered =

        dataLaporan.filter(

            function (item) {


                // ============================================
                // KOMPONEN
                // ============================================

                if (
                    komponen &&
                    item.komponen !==
                    komponen
                ) {

                    return false;

                }


                // ============================================
                // SUB KOMPONEN
                // ============================================

                if (
                    subKomponen &&
                    item.subKomponen !==
                    subKomponen
                ) {

                    return false;

                }


                // ============================================
                // AKUN
                // ============================================

                if (
                    akun &&
                    item.akun !==
                    akun
                ) {

                    return false;

                }


                // ============================================
                // STATUS
                //
                // Normal:
                // hanya item.statusPagu === "Normal"
                //
                // Diblokir:
                // hanya item.statusPagu === "Diblokir"
                // ============================================

                if (
                    status &&
                    item.statusPagu !==
                    status
                ) {

                    return false;

                }


                // ============================================
                // PENCARIAN
                // ============================================

                if (cari) {

                    const teks = [

                        item.kode,

                        item.kegiatan,

                        item.output,

                        item.komponen,

                        item.subKomponen,

                        item.akun,

                        item.itemAkun,

                        item.rincianItem,

                        item.statusPagu

                    ]

                        .map(

                            function (value) {

                                return (

                                    value ||
                                    ""

                                );

                            }

                        )

                        .join(
                            " "
                        )

                        .toLowerCase();


                    if (
                        !teks.includes(
                            cari
                        )
                    ) {

                        return false;

                    }

                }


                return true;

            }

        );


    console.log(

        "Laporan: hasil filter:",

        dataLaporanFiltered.length

    );


    // ========================================================
    // RENDER TABEL
    // ========================================================

    renderTabelLaporan(

        dataLaporanFiltered

    );


    // ========================================================
    // UPDATE RINGKASAN
    // ========================================================

    updateRingkasanLaporan();


    // ========================================================
    // INFO
    // ========================================================

    updateInfoLaporan(

        dataLaporanFiltered.length

    );

}


// ============================================================
// UPDATE RINGKASAN LAPORAN
// ============================================================

function updateRingkasanLaporan() {

    const komponen =

        document.getElementById(

            "filterKomponenLaporan"

        )?.value || "";


    const subKomponen =

        document.getElementById(

            "filterSubKomponenLaporan"

        )?.value || "";


    const akun =

        document.getElementById(

            "filterAkunLaporan"

        )?.value || "";


    const status =

        document.getElementById(

            "filterStatusLaporan"

        )?.value || "";


    const cari =

        (

            document.getElementById(

                "cariLaporan"

            )?.value || ""

        ).trim();


    // ========================================================
    // CEK FILTER
    // ========================================================

    const adaFilter = Boolean(

        komponen ||

        subKomponen ||

        akun ||

        status ||

        cari

    );


    let ringkasan = {

        pagu:
            0,

        realisasi:
            0,

        sisa:
            0,

        persen:
            0

    };


    // ========================================================
    // TANPA FILTER
    //
    // Total utama harus mengikuti baris total Excel.
    // ========================================================

    if (!adaFilter) {

        console.log(

            "Ringkasan Laporan: menggunakan ambilTotalUtama()"

        );


        const totalUtama =

            ambilTotalUtama(

                rawDataLaporan

            );


        ringkasan = {

            pagu:

                Number(
                    totalUtama.pagu
                ) || 0,


            realisasi:

                Number(
                    totalUtama.realisasi
                ) || 0,


            sisa:

                Number(
                    totalUtama.sisa
                ) || 0,


            persen:

                Number(
                    totalUtama.persen
                ) || 0

        };

    }


    // ========================================================
    // DENGAN FILTER
    // ========================================================

    else {

        let hasil =
            null;


        // ====================================================
        // HANYA FILTER KOMPONEN
        //
        // Tidak ada:
        // - Sub Komponen
        // - Akun
        // - Status
        // - Pencarian
        //
        // Ambil BARIS SUMMARY KOMPONEN Excel.
        // ====================================================

        const hanyaFilterKomponen =

            komponen &&

            !subKomponen &&

            !akun &&

            !status &&

            !cari;


        // ====================================================
        // FILTER SUB KOMPONEN TANPA FILTER DETAIL
        //
        // Tidak ada:
        // - Akun
        // - Status
        // - Pencarian
        //
        // Ambil BARIS SUMMARY SUB KOMPONEN Excel.
        // ====================================================

        const hanyaFilterSubKomponen =

            subKomponen &&

            !akun &&

            !status &&

            !cari;


        // ====================================================
        // SUMMARY KOMPONEN
        // ====================================================

        if (
            hanyaFilterKomponen &&
            typeof cariRingkasanHierarki ===
            "function"
        ) {

            console.log(

                "Ringkasan Laporan: mengambil summary Komponen dari Excel"

            );


            hasil =

                cariRingkasanHierarki(

                    rawDataLaporan,

                    "komponen",

                    komponen

                );

        }


        // ====================================================
        // SUMMARY SUB KOMPONEN
        //
        // Contoh Sub Komponen A:
        //
        // Pagu       Rp96.916.000
        // Realisasi  Rp79.346.900
        // Sisa       Rp17.569.100
        // Persentase 81,87%
        //
        // Tidak menjumlahkan Belanja Modal Rp1.940.000
        // dari hierarki lain.
        // ====================================================

        else if (
            hanyaFilterSubKomponen &&
            typeof cariRingkasanHierarki ===
            "function"
        ) {

            console.log(

                "Ringkasan Laporan: mengambil summary Sub Komponen dari Excel"

            );


            hasil =

                cariRingkasanHierarki(

                    rawDataLaporan,

                    "subKomponen",

                    subKomponen,

                    komponen

                );

        }


        // ====================================================
        // FILTER DETAIL / FALLBACK
        //
        // Masuk ke sini jika ada:
        //
        // - Akun
        // - Status Normal
        // - Status Diblokir
        // - Pencarian
        //
        // PENTING:
        //
        // Jika Status = Normal, hanya detail Normal dihitung.
        //
        // Jika Status = Diblokir, hanya detail Diblokir dihitung.
        //
        // Jadi summary hierarki Excel TIDAK digunakan ketika
        // filter status aktif.
        // ====================================================

        if (!hasil) {

            console.log(

                "Ringkasan Laporan: menggunakan hitungRingkasanData() untuk detail/filter status"

            );


            hasil =

                hitungRingkasanData(

                    dataLaporanFiltered,

                    rawDataLaporan,

                    {

                        adaFilter:
                            true,

                        komponen:
                            komponen,

                        subKomponen:
                            subKomponen,

                        akun:
                            akun,

                        status:
                            status,

                        cari:
                            cari

                    }

                );

        }


        // ====================================================
        // SIMPAN HASIL
        // ====================================================

        ringkasan = {

            pagu:

                Number(
                    hasil.pagu
                ) || 0,


            realisasi:

                Number(
                    hasil.realisasi
                ) || 0,


            sisa:

                Number(
                    hasil.sisa
                ) || 0,


            persen:

                Number(
                    hasil.persen
                ) || 0

        };

    }


    // ========================================================
    // SAFETY SISA
    // ========================================================

    if (
        !Number.isFinite(
            ringkasan.sisa
        )
    ) {

        ringkasan.sisa =

            ringkasan.pagu -

            ringkasan.realisasi;

    }


    // ========================================================
    // SAFETY PERSENTASE
    // ========================================================

    if (
        !Number.isFinite(
            ringkasan.persen
        )
    ) {

        ringkasan.persen =

            ringkasan.pagu > 0

                ? (

                    ringkasan.realisasi /

                    ringkasan.pagu

                ) * 100

                : 0;

    }


    // ========================================================
    // TAMPILKAN PAGU
    // ========================================================

    setTextLaporan(

        "laporanTotalPagu",

        formatRupiah(

            ringkasan.pagu

        )

    );


    // ========================================================
    // TAMPILKAN REALISASI
    // ========================================================

    setTextLaporan(

        "laporanTotalRealisasi",

        formatRupiah(

            ringkasan.realisasi

        )

    );


    // ========================================================
    // TAMPILKAN SISA
    // ========================================================

    setTextLaporan(

        "laporanSisa",

        formatRupiah(

            ringkasan.sisa

        )

    );


    // ========================================================
    // TAMPILKAN PERSENTASE
    // ========================================================

    setTextLaporan(

        "laporanPersentase",

        formatPersen(

            ringkasan.persen

        )

    );


    // ========================================================
    // DEBUG
    // ========================================================

    console.log(
        "===================================="
    );


    console.log(
        "RINGKASAN LAPORAN"
    );


    console.log(

        "Ada Filter:",

        adaFilter

    );


    console.log(

        "Filter:",

        {

            komponen,

            subKomponen,

            akun,

            status,

            cari

        }

    );


    console.log(

        "Jumlah Data:",

        dataLaporanFiltered.length

    );


    console.log(

        "Ringkasan:",

        ringkasan

    );


    console.log(
        "===================================="
    );

}


// ============================================================
// RENDER TABEL
// ============================================================

function renderTabelLaporan(
    data
) {

    const tbody =

        document.getElementById(

            "tabelLaporan"

        );


    if (!tbody) {

        console.error(

            "#tabelLaporan tidak ditemukan"

        );


        return;

    }


    tbody.innerHTML =
        "";


    // ========================================================
    // DATA KOSONG
    // ========================================================

    if (
        !data ||
        data.length === 0
    ) {

        tbody.innerHTML = `

            <tr>

                <td
                    colspan="11"
                    class="text-center text-muted py-4"
                >

                    Tidak ada data yang sesuai dengan filter.

                </td>

            </tr>

        `;


        return;

    }


    // ========================================================
    // TAMPILKAN DATA
    // ========================================================

    data.forEach(

        function (item) {

            const tr =

                document.createElement(

                    "tr"

                );


            // ================================================
            // STATUS DIBLOKIR
            // ================================================

            if (
                item.statusPagu ===
                "Diblokir"
            ) {

                tr.classList.add(

                    "status-diblokir"

                );

            }


            // ================================================
            // NAMA ITEM
            // ================================================

            let namaItem =

                item.itemAkun ||
                "-";


            if (
                item.rincianItem &&
                item.rincianItem !==
                "-"
            ) {

                namaItem =

                    (
                        item.itemAkun ||
                        ""
                    )

                    +

                    " - "

                    +

                    item.rincianItem;

            }


            // ================================================
            // HTML
            // ================================================

            tr.innerHTML = `

                <td>
                    ${escapeHtml(
                        item.kode
                    )}
                </td>

                <td>
                    ${escapeHtml(
                        item.kegiatan
                    )}
                </td>

                <td>
                    ${escapeHtml(
                        item.komponen
                    )}
                </td>

                <td>
                    ${escapeHtml(
                        item.subKomponen
                    )}
                </td>

                <td>
                    ${escapeHtml(
                        item.akun
                    )}
                </td>

                <td>
                    ${escapeHtml(
                        namaItem
                    )}
                </td>

                <td>
                    ${escapeHtml(
                        item.statusPagu
                    )}
                </td>

                <td class="text-end">

                    ${formatRupiah(

                        Number(
                            item.pagu
                        ) || 0

                    )}

                </td>

                <td class="text-end">

                    ${formatRupiah(

                        Number(
                            item.realisasi
                        ) || 0

                    )}

                </td>

                <td class="text-end">

                    ${formatRupiah(

                        Number(
                            item.sisa
                        ) || 0

                    )}

                </td>

                <td class="text-end">

                    ${formatPersen(

                        Number(
                            item.persen
                        ) || 0

                    )}

                </td>

            `;


            tbody.appendChild(

                tr

            );

        }

    );

}


// ============================================================
// SET TEXT
// ============================================================

function setTextLaporan(
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
// INFO JUMLAH DATA
// ============================================================

function updateInfoLaporan(
    jumlah
) {

    const element =

        document.getElementById(

            "infoLaporan"

        );


    if (!element) {

        return;

    }


    element.textContent =

        Number(
            jumlah
        )

            .toLocaleString(
                "id-ID"
            )

        +

        " data ditampilkan";

}


// ============================================================
// ERROR
// ============================================================

function tampilkanErrorLaporan(
    message
) {

    console.error(

        "ERROR LAPORAN:",

        message

    );


    const tbody =

        document.getElementById(

            "tabelLaporan"

        );


    if (tbody) {

        tbody.innerHTML = `

            <tr>

                <td
                    colspan="11"
                    class="text-center text-danger py-4"
                >

                    Gagal memuat data laporan.

                    <br>

                    ${escapeHtml(
                        message
                    )}

                </td>

            </tr>

        `;

    }

}


// ============================================================
// CETAK LAPORAN
// ============================================================

function cetakLaporan() {

    window.print();

}
// ============================================================
// DOWNLOAD LAPORAN KE EXCEL
//
// Data yang diekspor mengikuti filter yang sedang aktif.
//
// Contoh:
// - Semua data
// - Komponen tertentu
// - Sub Komponen tertentu
// - Akun tertentu
// - Status Normal
// - Status Diblokir
// - Hasil pencarian
// ============================================================

function downloadExcelLaporan() {

    // ========================================================
    // CEK LIBRARY XLSX
    // ========================================================

    if (
        typeof XLSX ===
        "undefined"
    ) {

        alert(
            "Library Excel belum dimuat."
        );

        console.error(
            "XLSX tidak ditemukan."
        );

        return;

    }


    // ========================================================
    // CEK DATA
    // ========================================================

    if (
        !Array.isArray(
            dataLaporanFiltered
        ) ||
        dataLaporanFiltered.length === 0
    ) {

        alert(
            "Tidak ada data yang dapat diekspor."
        );

        return;

    }


    // ========================================================
    // AMBIL FILTER AKTIF
    // ========================================================

    const komponen =

        document.getElementById(
            "filterKomponenLaporan"
        )?.value || "";


    const subKomponen =

        document.getElementById(
            "filterSubKomponenLaporan"
        )?.value || "";


    const akun =

        document.getElementById(
            "filterAkunLaporan"
        )?.value || "";


    const status =

        document.getElementById(
            "filterStatusLaporan"
        )?.value || "";


    const cari =

        document.getElementById(
            "cariLaporan"
        )?.value || "";


    // ========================================================
    // AMBIL NILAI RINGKASAN YANG SEDANG TAMPIL
    //
    // Dengan cara ini angka Excel sama dengan angka
    // yang tampil di kartu laporan.
    // ========================================================

    const totalPagu =

        document.getElementById(
            "laporanTotalPagu"
        )?.textContent || "Rp0";


    const totalRealisasi =

        document.getElementById(
            "laporanTotalRealisasi"
        )?.textContent || "Rp0";


    const totalSisa =

        document.getElementById(
            "laporanSisa"
        )?.textContent || "Rp0";


    const totalPersentase =

        document.getElementById(
            "laporanPersentase"
        )?.textContent || "0%";


    // ========================================================
    // BUAT DATA EXCEL
    // ========================================================

    const dataExcel = [];


    // ========================================================
    // JUDUL
    // ========================================================

    dataExcel.push([

        "LAPORAN REALISASI ANGGARAN P3HPHL"

    ]);


    dataExcel.push([

        "BPHL XI Banjarbaru"

    ]);


    dataExcel.push([]);


    // ========================================================
    // INFORMASI FILTER
    // ========================================================

    dataExcel.push([

        "FILTER LAPORAN"

    ]);


    dataExcel.push([

        "Komponen",

        komponen ||
        "Semua Komponen"

    ]);


    dataExcel.push([

        "Sub Komponen",

        subKomponen ||
        "Semua Sub Komponen"

    ]);


    dataExcel.push([

        "Akun Belanja",

        akun ||
        "Semua Akun Belanja"

    ]);


    dataExcel.push([

        "Status",

        status ||
        "Semua Status"

    ]);


    if (cari) {

        dataExcel.push([

            "Pencarian",

            cari

        ]);

    }


    dataExcel.push([]);


    // ========================================================
    // RINGKASAN
    // ========================================================

    dataExcel.push([

        "RINGKASAN"

    ]);


    dataExcel.push([

        "Total Pagu",

        totalPagu

    ]);


    dataExcel.push([

        "Total Realisasi",

        totalRealisasi

    ]);


    dataExcel.push([

        "Sisa Anggaran",

        totalSisa

    ]);


    dataExcel.push([

        "Persentase",

        totalPersentase

    ]);


    dataExcel.push([]);


    // ========================================================
    // HEADER TABEL
    // ========================================================

    dataExcel.push([

        "No",

        "Kode",

        "Kegiatan",

        "Komponen",

        "Sub Komponen",

        "Akun Belanja",

        "Item",

        "Status",

        "Pagu",

        "Realisasi",

        "Sisa",

        "Persentase"

    ]);


    // ========================================================
    // DATA DETAIL
    // ========================================================

    dataLaporanFiltered.forEach(

        function (
            item,
            index
        ) {

            let namaItem =

                item.itemAkun ||
                "-";


            // =================================================
            // TAMBAHKAN RINCIAN ITEM
            // =================================================

            if (
                item.rincianItem &&
                item.rincianItem !==
                "-"
            ) {

                namaItem =

                    (
                        item.itemAkun ||
                        ""
                    )

                    +

                    " - "

                    +

                    item.rincianItem;

            }


            dataExcel.push([

                index + 1,

                item.kode ||
                "-",

                item.kegiatan ||
                "-",

                item.komponen ||
                "-",

                item.subKomponen ||
                "-",

                item.akun ||
                "-",

                namaItem,

                item.statusPagu ||
                "-",

                Number(
                    item.pagu
                ) || 0,

                Number(
                    item.realisasi
                ) || 0,

                Number(
                    item.sisa
                ) || 0,

                Number(
                    item.persen
                ) || 0

            ]);

        }

    );


    // ========================================================
    // BUAT WORKSHEET
    // ========================================================

    const worksheet =

        XLSX.utils.aoa_to_sheet(

            dataExcel

        );


    // ========================================================
    // LEBAR KOLOM
    // ========================================================

    worksheet["!cols"] = [

        {
            wch: 6
        },

        {
            wch: 12
        },

        {
            wch: 35
        },

        {
            wch: 35
        },

        {
            wch: 45
        },

        {
            wch: 30
        },

        {
            wch: 60
        },

        {
            wch: 12
        },

        {
            wch: 18
        },

        {
            wch: 18
        },

        {
            wch: 18
        },

        {
            wch: 14
        }

    ];


    // ========================================================
    // FORMAT ANGKA DETAIL
    //
    // Cari posisi header tabel agar tidak bergantung pada
    // jumlah baris filter.
    // ========================================================

    let headerIndex =

        dataExcel.findIndex(

            function (row) {

                return (

                    Array.isArray(row) &&

                    row[0] ===
                    "No" &&

                    row[1] ===
                    "Kode"

                );

            }

        );


    if (
        headerIndex >= 0
    ) {

        // XLSX menggunakan index baris mulai dari 1.

        const barisAwalData =

            headerIndex + 2;


        const barisAkhirData =

            dataExcel.length;


        for (

            let row =
                barisAwalData;

            row <=
                barisAkhirData;

            row++

        ) {

            // ================================================
            // PAGU
            // ================================================

            const cellPagu =

                worksheet[
                    "I" + row
                ];


            if (cellPagu) {

                cellPagu.z =

                    '"Rp"#,##0';

            }


            // ================================================
            // REALISASI
            // ================================================

            const cellRealisasi =

                worksheet[
                    "J" + row
                ];


            if (cellRealisasi) {

                cellRealisasi.z =

                    '"Rp"#,##0';

            }


            // ================================================
            // SISA
            // ================================================

            const cellSisa =

                worksheet[
                    "K" + row
                ];


            if (cellSisa) {

                cellSisa.z =

                    '"Rp"#,##0';

            }


            // ================================================
            // PERSENTASE
            //
            // item.persen berupa:
            // 81.87
            //
            // Excel persen membutuhkan:
            // 0.8187
            // ================================================

            const cellPersen =

                worksheet[
                    "L" + row
                ];


            if (cellPersen) {

                cellPersen.v =

                    Number(
                        cellPersen.v
                    ) / 100;


                cellPersen.t =
                    "n";


                cellPersen.z =
                    "0.00%";

            }

        }

    }


    // ========================================================
    // BUAT WORKBOOK
    // ========================================================

    const workbook =

        XLSX.utils.book_new();


    XLSX.utils.book_append_sheet(

        workbook,

        worksheet,

        "Laporan Realisasi"

    );


    // ========================================================
    // BUAT NAMA FILE
    // ========================================================

    const sekarang =

        new Date();


    const tanggal =

        sekarang
            .toISOString()
            .slice(
                0,
                10
            );


    let namaFile =

        "Laporan_Realisasi_P3HPHL";


    // ========================================================
    // TAMBAHKAN STATUS KE NAMA FILE
    // ========================================================

    if (status) {

        namaFile +=

            "_" +

            status;

    }


    namaFile +=

        "_" +

        tanggal +

        ".xlsx";


    // ========================================================
    // DOWNLOAD
    // ========================================================

    XLSX.writeFile(

        workbook,

        namaFile

    );


    console.log(

        "Excel berhasil dibuat:",

        namaFile

    );

}