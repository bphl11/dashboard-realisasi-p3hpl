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
    // Semua halaman wajib memakai Calculation Engine yang sama.
    // ========================================================

    if (!adaFilter && typeof hitungCalculationEngine === "function") {

        const engine = hitungCalculationEngine(
            rawDataLaporan,
            dataLaporan
        );

        ringkasan = engine.total;

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
                    colspan="12"
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
            // IDENTITAS AKUN
            // ================================================

            const namaItemAkun =

                item.itemAkun ||
                "-";


            const namaDetilAkun =

                item.detilAkun ||
                "-";


            const namaRincianItem =

                item.rincianItem ||
                "-";


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
                        namaItemAkun
                    )}
                </td>

                <td>
                    ${escapeHtml(
                        namaDetilAkun
                    )}
                </td>

                <td>
                    ${escapeHtml(
                        namaRincianItem
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
                    colspan="12"
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
    if (typeof XLSX === "undefined") {
        alert("Library Excel belum dimuat.");
        return;
    }

    if (!Array.isArray(dataLaporanFiltered) || dataLaporanFiltered.length === 0) {
        alert("Tidak ada data yang dapat diekspor.");
        return;
    }

    const komponen = document.getElementById("filterKomponenLaporan")?.value || "";
    const subKomponen = document.getElementById("filterSubKomponenLaporan")?.value || "";
    const akun = document.getElementById("filterAkunLaporan")?.value || "";
    const status = document.getElementById("filterStatusLaporan")?.value || "";
    const cari = document.getElementById("cariLaporan")?.value || "";

    const totalPagu = document.getElementById("laporanTotalPagu")?.textContent || "Rp0";
    const totalRealisasi = document.getElementById("laporanTotalRealisasi")?.textContent || "Rp0";
    const totalSisa = document.getElementById("laporanSisa")?.textContent || "Rp0";
    const totalPersentase = document.getElementById("laporanPersentase")?.textContent || "0%";

    const dataExcel = [
        ["LAPORAN REALISASI ANGGARAN P3HPHL"],
        ["BPHL XI Banjarbaru"],
        [],
        ["FILTER LAPORAN"],
        ["Komponen", komponen || "Semua Komponen"],
        ["Sub Komponen", subKomponen || "Semua Sub Komponen"],
        ["Akun Belanja", akun || "Semua Akun Belanja"],
        ["Status", status || "Semua Status"]
    ];

    if (cari) dataExcel.push(["Pencarian", cari]);

    dataExcel.push(
        [],
        ["RINGKASAN"],
        ["Total Pagu", totalPagu],
        ["Total Realisasi", totalRealisasi],
        ["Sisa Anggaran", totalSisa],
        ["Persentase", totalPersentase],
        [],
        ["No","Kode","Komponen","Sub Komponen","Akun Belanja","Item Akun","Detil Akun","Rincian Item","Status","Pagu","Realisasi","Sisa","Persentase"]
    );

    const headerIndex = dataExcel.length - 1;

    dataLaporanFiltered.forEach(function (item, index) {
        dataExcel.push([
            index + 1,
            item.kode || "-",
            item.komponen || "-",
            item.subKomponen || "-",
            item.akun || "-",
            item.itemAkun || "-",
            item.detilAkun || "-",
            item.rincianItem || "-",
            item.statusPagu || "-",
            Number(item.pagu) || 0,
            Number(item.realisasi) || 0,
            Number(item.sisa) || 0,
            Number(item.persen) || 0
        ]);
    });

    const worksheet = XLSX.utils.aoa_to_sheet(dataExcel);
    const headerRow = headerIndex + 1;
    const dataStartRow = headerRow + 1;
    const dataEndRow = dataExcel.length;

    worksheet["!cols"] = [
        { wch: 6 }, { wch: 20 }, { wch: 31 }, { wch: 38 }, { wch: 24 },
        { wch: 16 }, { wch: 28 }, { wch: 42 }, { wch: 12 },
        { wch: 17 }, { wch: 17 }, { wch: 17 }, { wch: 12 }
    ];

    worksheet["!merges"] = [
        { s:{ r:0, c:0 }, e:{ r:0, c:12 } },
        { s:{ r:1, c:0 }, e:{ r:1, c:12 } },
        { s:{ r:3, c:0 }, e:{ r:3, c:12 } },
        { s:{ r:headerRow - 7, c:0 }, e:{ r:headerRow - 7, c:12 } }
    ];

    const thin = { style:"thin", color:{ rgb:"9AA8A2" } };
    const medium = { style:"medium", color:{ rgb:"2F5D50" } };
    const border = { left:thin, right:thin, top:thin, bottom:thin };
    const green = "2F5D50";
    const headerGreen = "3F6B5B";

    function styleCell(address, style) {
        if (!worksheet[address]) return;
        worksheet[address].s = Object.assign({}, worksheet[address].s || {}, style);
    }

    for (let r = 1; r <= dataEndRow; r++) {
        for (let c = 0; c < 13; c++) {
            const address = XLSX.utils.encode_cell({ r:r - 1, c:c });
            if (!worksheet[address]) worksheet[address] = { t:"s", v:"" };
            styleCell(address, {
                font:{ name:"Arial", sz:9, color:{ rgb:"222222" } },
                border:border,
                alignment:{
                    vertical:"center",
                    wrapText:true,
                    horizontal:(c >= 9 ? "right" : "left")
                }
            });
        }
    }

    styleCell("A1", {
        font:{ name:"Arial", sz:16, bold:true, color:{ rgb:green } },
        alignment:{ horizontal:"center", vertical:"center" },
        border:{ bottom:medium }
    });

    styleCell("A2", {
        font:{ name:"Arial", sz:10, bold:true, color:{ rgb:"5B6470" } },
        alignment:{ horizontal:"center", vertical:"center" }
    });

    [4, headerRow - 6].forEach(function(row) {
        const cell = "A" + row;
        styleCell(cell, {
            font:{ name:"Arial", sz:10, bold:true, color:{ rgb:"FFFFFF" } },
            fill:{ fgColor:{ rgb:green } },
            alignment:{ horizontal:"left", vertical:"center" }
        });
    });

    const filterRows = cari ? [5,6,7,8,9] : [5,6,7,8];
    filterRows.concat([headerRow - 5, headerRow - 4, headerRow - 3, headerRow - 2]).forEach(function(row) {
        styleCell("A" + row, {
            font:{ name:"Arial", sz:9, bold:true, color:{ rgb:green } },
            fill:{ fgColor:{ rgb:"EAF2EE" } },
            alignment:{ horizontal:"left", vertical:"center", wrapText:true }
        });
        styleCell("B" + row, {
            fill:{ fgColor:{ rgb:"F3F7F5" } },
            alignment:{ vertical:"center", wrapText:true }
        });
    });

    for (let c = 0; c < 13; c++) {
        const address = XLSX.utils.encode_cell({ r:headerRow - 1, c:c });
        styleCell(address, {
            font:{ name:"Arial", sz:8, bold:true, color:{ rgb:"FFFFFF" } },
            fill:{ fgColor:{ rgb:headerGreen } },
            border:{ left:medium, right:medium, top:medium, bottom:medium },
            alignment:{ horizontal:"center", vertical:"center", wrapText:true }
        });
    }

    for (let row = dataStartRow; row <= dataEndRow; row++) {
        const fill = ((row - dataStartRow) % 2 === 0) ? "FFFFFF" : "F5F7F8";

        for (let c = 0; c < 13; c++) {
            const address = XLSX.utils.encode_cell({ r:row - 1, c:c });
            styleCell(address, {
                fill:{ fgColor:{ rgb:fill } },
                border:border,
                alignment:{
                    vertical:"top",
                    wrapText:true,
                    horizontal:(c >= 9 ? "right" : (c === 0 || c === 8 || c === 12 ? "center" : "left"))
                }
            });
        }

        ["J","K","L"].forEach(function(col) {
            const cell = worksheet[col + row];
            if (cell) cell.z = '"Rp"#,##0';
        });

        const persen = worksheet["M" + row];
        if (persen) {
            persen.v = (Number(persen.v) || 0) / 100;
            persen.t = "n";
            persen.z = "0.00%";
        }
    }

    worksheet["!rows"] = [];
    worksheet["!rows"][0] = { hpt:27 };
    worksheet["!rows"][1] = { hpt:20 };
    worksheet["!rows"][3] = { hpt:20 };
    worksheet["!rows"][headerRow - 7] = { hpt:20 };
    worksheet["!rows"][headerRow - 1] = { hpt:32 };
    for (let row = dataStartRow; row <= dataEndRow; row++) {
        worksheet["!rows"][row - 1] = { hpt:42 };
    }

    worksheet["!autofilter"] = { ref:"A" + headerRow + ":M" + dataEndRow };
    worksheet["!freeze"] = { xSplit:0, ySplit:headerRow };
    worksheet["!margins"] = {
        left:0.25, right:0.25, top:0.35, bottom:0.35,
        header:0.15, footer:0.15
    };
    worksheet["!pageSetup"] = {
        orientation:"landscape",
        paperSize:9,
        fitToWidth:1,
        fitToHeight:0
    };
    worksheet["!printArea"] = "A1:M" + dataEndRow;

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Laporan Realisasi");

    const tanggal = new Date().toISOString().slice(0, 10);
    let namaFile = "Laporan_Realisasi_P3HPHL";
    if (status) namaFile += "_" + status;
    namaFile += "_" + tanggal + ".xlsx";

    XLSX.writeFile(workbook, namaFile);
    console.log("Excel berhasil dibuat:", namaFile);
}

