// ============================================================
// MONITORING.JS
// Halaman Monitoring Realisasi Anggaran
//
// Membutuhkan:
// - config.js
// - api.js
// - parser.js
// - jQuery
// - DataTables
// ============================================================


// ============================================================
// VARIABEL GLOBAL
// ============================================================

let dataMonitoring = [];

let dataMonitoringFiltered = [];

let rawMonitoringData = [];

let monitoringTable = null;


// ============================================================
// SAAT HALAMAN SELESAI DIMUAT
// ============================================================

document.addEventListener(
    "DOMContentLoaded",
    async function () {

        console.log(
            "Monitoring: halaman dimuat"
        );


        // ====================================================
        // CEK FUNGSI PARSER
        // ====================================================

        if (
            typeof parseDataMonitoring !==
            "function"
        ) {

            console.error(
                "parseDataMonitoring tidak ditemukan. Pastikan parser.js dimuat sebelum monitoring.js"
            );

            return;

        }


        // ====================================================
        // CEK ELEMENT HTML
        // ====================================================

        const tabel =
            document.getElementById(
                "tblMonitoring"
            );


        if (!tabel) {

            console.error(
                "Element #tblMonitoring tidak ditemukan"
            );

            return;

        }


        // ====================================================
        // LOAD DATA
        // ====================================================

        await loadMonitoring();


        // ====================================================
        // PASANG EVENT FILTER
        // ====================================================

        pasangEventFilterMonitoring();

    }
);


// ============================================================
// LOAD DATA MONITORING
// ============================================================

async function loadMonitoring() {

    try {

        console.log(
            "Monitoring: mengambil data Google Sheet..."
        );


        let rawData = [];


        // ====================================================
        // PRIORITAS:
        // getSheetDataMonitoring()
        // ====================================================

        if (
            typeof getSheetDataMonitoring ===
            "function"
        ) {

            rawData =
                await getSheetDataMonitoring();

        }


        // ====================================================
        // FALLBACK:
        // FETCH LANGSUNG
        // ====================================================

        else {

            console.warn(
                "getSheetDataMonitoring tidak ditemukan. Menggunakan fetch langsung."
            );


            if (
                typeof CONFIG ===
                "undefined"
            ) {

                throw new Error(
                    "CONFIG tidak ditemukan"
                );

            }


            const response =
                await fetch(
                    CONFIG.SHEET_URL
                );


            if (!response.ok) {

                throw new Error(
                    "Gagal mengambil Google Sheet. HTTP " +
                    response.status
                );

            }


            const csv =
                await response.text();


            if (
                typeof csvToArray !==
                "function"
            ) {

                throw new Error(
                    "csvToArray tidak ditemukan"
                );

            }


            rawData =
                csvToArray(csv);

        }


        console.log(
    "Monitoring: jumlah baris mentah:",
    rawData.length
);

rawMonitoringData = rawData;

// ====================================================
// PARSE DATA
// ====================================================

dataMonitoring =
    parseDataMonitoring(
        rawData
    );

        console.log(
            "Monitoring: jumlah data hasil parser:",
            dataMonitoring.length
        );


        // ====================================================
        // SALIN DATA UNTUK FILTER
        // ====================================================

        dataMonitoringFiltered =
            [...dataMonitoring];


        // ====================================================
        // ISI FILTER
        // ====================================================

        isiFilterMonitoring();

        // ====================================================
// UPDATE RINGKASAN
// ====================================================

updateRingkasanMonitoring();


        // ====================================================
        // TAMPILKAN TABEL
        // ====================================================

        renderMonitoring(
            dataMonitoringFiltered
        );


    } catch (error) {

        console.error(
            "ERROR LOAD MONITORING:",
            error
        );


        tampilkanErrorMonitoring(
            error.message
        );

    }

}


// ============================================================
// ISI SEMUA FILTER
// ============================================================

function isiFilterMonitoring() {

    isiFilterKomponenMonitoring();

    isiFilterSubKomponenMonitoring();

    isiFilterAkunMonitoring();

}


// ============================================================
// ISI FILTER KOMPONEN
// ============================================================

function isiFilterKomponenMonitoring() {

    const select =
        document.getElementById(
            "filterKomponen"
        );


    if (!select) {

        console.warn(
            "#filterKomponen tidak ditemukan"
        );

        return;

    }


    const komponenList =
        ambilNilaiUnikMonitoring(
            dataMonitoring,
            "komponen"
        );


    select.innerHTML =
        '<option value="">Semua Komponen</option>';


    komponenList.forEach(
        function (komponen) {

            const option =
                document.createElement(
                    "option"
                );


            option.value =
                komponen;


            option.textContent =
                komponen;


            select.appendChild(
                option
            );

        }
    );

}


// ============================================================
// ISI FILTER SUB KOMPONEN
//
// Pada awal halaman:
// tampilkan semua Sub Komponen.
//
// Setelah Komponen dipilih:
// tampilkan hanya Sub Komponen milik Komponen tersebut.
// ============================================================

function isiFilterSubKomponenMonitoring(
    komponenTerpilih = ""
) {

    const select =
        document.getElementById(
            "filterSubKomponen"
        );


    if (!select) {

        console.warn(
            "#filterSubKomponen tidak ditemukan"
        );

        return;

    }


    let sumberData =
        dataMonitoring;


    if (komponenTerpilih) {

        sumberData =
            dataMonitoring.filter(
                function (item) {

                    return (
                        item.komponen ===
                        komponenTerpilih
                    );

                }
            );

    }


    const subKomponenList =
        ambilNilaiUnikMonitoring(
            sumberData,
            "subKomponen"
        );


    select.innerHTML =
        '<option value="">Semua Sub Komponen</option>';


    subKomponenList.forEach(
        function (subKomponen) {

            const option =
                document.createElement(
                    "option"
                );


            option.value =
                subKomponen;


            option.textContent =
                subKomponen;


            select.appendChild(
                option
            );

        }
    );

}


// ============================================================
// ISI FILTER AKUN BELANJA
// ============================================================

function isiFilterAkunMonitoring() {

    const select =
        document.getElementById(
            "filterAkun"
        );


    if (!select) {

        console.warn(
            "#filterAkun tidak ditemukan"
        );

        return;

    }


    const akunList =
        ambilNilaiUnikMonitoring(
            dataMonitoring,
            "akun"
        );


    select.innerHTML =
        '<option value="">Semua Akun Belanja</option>';


    akunList.forEach(
        function (akun) {

            const option =
                document.createElement(
                    "option"
                );


            option.value =
                akun;


            option.textContent =
                akun;


            select.appendChild(
                option
            );

        }
    );

}


// ============================================================
// AMBIL NILAI UNIK
// ============================================================

function ambilNilaiUnikMonitoring(
    data,
    field
) {

    return [

        ...new Set(

            data

                .map(
                    function (item) {

                        return clean(
                            item[field]
                        );

                    }
                )

                .filter(
                    function (value) {

                        return (
                            value &&
                            value !== "-"
                        );

                    }
                )

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
// PASANG EVENT FILTER
// ============================================================

function pasangEventFilterMonitoring() {

    const filterKomponen =
        document.getElementById(
            "filterKomponen"
        );


    const filterSubKomponen =
        document.getElementById(
            "filterSubKomponen"
        );


    const filterAkun =
        document.getElementById(
            "filterAkun"
        );
    const filterStatus =
    document.getElementById(
        "filterStatus"
    );


    // ========================================================
    // KOMPONEN BERUBAH
    // ========================================================

    if (filterKomponen) {

        filterKomponen.addEventListener(
            "change",
            function () {

                const komponen =
                    this.value;


                // Update pilihan Sub Komponen
                isiFilterSubKomponenMonitoring(
                    komponen
                );


                // Reset Sub Komponen
                if (
                    filterSubKomponen
                ) {

                    filterSubKomponen.value =
                        "";

                }


                jalankanFilterMonitoring();

            }
        );

    }


    // ========================================================
    // SUB KOMPONEN BERUBAH
    // ========================================================

    if (filterSubKomponen) {

        filterSubKomponen.addEventListener(
            "change",
            function () {

                jalankanFilterMonitoring();

            }
        );

    }


    // ========================================================
    // AKUN BERUBAH
    // ========================================================
    if (filterStatus) {

    filterStatus.addEventListener(
        "change",
        function () {

            jalankanFilterMonitoring();

        }
    );

}
    if (filterAkun) {

        filterAkun.addEventListener(
            "change",
            function () {

                jalankanFilterMonitoring();

            }
        );

    }

}

// ============================================================
// JALANKAN FILTER
// ============================================================

function jalankanFilterMonitoring() {

    const komponen =
        document.getElementById(
            "filterKomponen"
        )?.value || "";


    const subKomponen =
        document.getElementById(
            "filterSubKomponen"
        )?.value || "";


    const akun =
        document.getElementById(
            "filterAkun"
        )?.value || "";


    const status =
        document.getElementById(
            "filterStatus"
        )?.value || "";


    dataMonitoringFiltered =
        dataMonitoring.filter(
            function (item) {

                // ============================================
                // FILTER KOMPONEN
                // ============================================

                if (
                    komponen &&
                    item.komponen !== komponen
                ) {

                    return false;

                }


                // ============================================
                // FILTER SUB KOMPONEN
                // ============================================

                if (
                    subKomponen &&
                    item.subKomponen !== subKomponen
                ) {

                    return false;

                }


                // ============================================
                // FILTER AKUN
                // ============================================

                if (
                    akun &&
                    item.akun !== akun
                ) {

                    return false;

                }


                // ============================================
                // FILTER STATUS
                // ============================================

                if (
                    status &&
                    item.statusPagu !== status
                ) {

                    return false;

                }


                return true;

            }
        );


    console.log(
        "Monitoring: hasil filter:",
        dataMonitoringFiltered.length
    );


    // ========================================================
    // UPDATE RINGKASAN
    // ========================================================

    updateRingkasanMonitoring();
        // ========================================================
    // RENDER TABEL
    // ========================================================

    renderMonitoring(
        dataMonitoringFiltered
    );

}
        // ============================================================
// UPDATE RINGKASAN MONITORING
// ============================================================

function updateRingkasanMonitoring() {

    const komponen =
        document.getElementById(
            "filterKomponen"
        )?.value || "";

    const subKomponen =
        document.getElementById(
            "filterSubKomponen"
        )?.value || "";

    const akun =
        document.getElementById(
            "filterAkun"
        )?.value || "";

    const status =
        document.getElementById(
            "filterStatus"
        )?.value || "";


    const ringkasan =
    hitungRingkasanData(
        dataMonitoringFiltered,
        rawMonitoringData,
        {
            adaFilter:
                !!(
                    komponen ||
                    subKomponen ||
                    akun ||
                    status
                ),

            komponen,
            subKomponen,
            akun,
            status
        }
    );


    const elPagu =
        document.getElementById(
            "monitorPagu"
        );

    const elRealisasi =
        document.getElementById(
            "monitorRealisasi"
        );

    const elSisa =
        document.getElementById(
            "monitorSisa"
        );

    const elPersen =
        document.getElementById(
            "monitorPersen"
        );


    if (elPagu) {

        elPagu.textContent =
            formatRupiah(
                ringkasan.pagu
            );

    }

    if (elRealisasi) {

        elRealisasi.textContent =
            formatRupiah(
                ringkasan.realisasi
            );

    }

    if (elSisa) {

    elSisa.textContent =
        formatRupiah(
            ringkasan.sisa
        );

}

    if (elPersen) {

        elPersen.textContent =
            formatPersen(
                ringkasan.persen
            );

    }

}
// ============================================================
// RENDER TABEL MONITORING
// ============================================================

function renderMonitoring(data) {

    const tbody =
        document.querySelector(
            "#tblMonitoring tbody"
        );


    if (!tbody) {

        console.error(
            "#tblMonitoring tbody tidak ditemukan"
        );

        return;

    }


    // ========================================================
    // HANCURKAN DATATABLE SEBELUM UPDATE
    // ========================================================

    if (
        typeof $ !==
        "undefined" &&
        $.fn &&
        $.fn.DataTable &&
        $.fn.DataTable.isDataTable(
            "#tblMonitoring"
        )
    ) {

        $("#tblMonitoring")
            .DataTable()
            .destroy();

    }


    tbody.innerHTML =
        "";


    // ========================================================
    // JIKA DATA KOSONG
    // ========================================================

    if (
        !data ||
        data.length === 0
    ) {

        tbody.innerHTML = `
            <tr>
                <td
                    colspan="13"
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
            // WARNA BARIS DIBLOKIR
            // ================================================

            if (
                item.statusPagu ===
                "Diblokir"
            ) {

                tr.classList.add(
                    "table-danger"
                );

            }


            tr.innerHTML = `

                <td>
                    ${escapeHtml(item.kode)}
                </td>

                <td>
                    ${escapeHtml(item.kegiatan)}
                </td>

                <td>
                    ${escapeHtml(item.komponen)}
                </td>

                <td>
                    ${escapeHtml(item.output)}
                </td>

                <td>
                    ${escapeHtml(item.subKomponen)}
                </td>

                <td>
                    ${escapeHtml(item.akun)}
                </td>

                <td>
                    ${escapeHtml(item.itemAkun)}
                </td>

                <td>
                    ${escapeHtml(item.rincianItem)}
                </td>

                <td>
                    <strong>
                        ${escapeHtml(item.statusPagu)}
                    </strong>
                </td>

                <td>
                    ${formatRupiah(item.pagu)}
                </td>

                <td>
                    ${formatRupiah(item.realisasi)}
                </td>

                <td>
                    ${formatRupiah(item.sisa)}
                </td>

                <td>
                    ${formatPersen(item.persen)}
                </td>

            `;


            tbody.appendChild(
                tr
            );

        }
    );


    // ========================================================
    // AKTIFKAN DATATABLE
    // ========================================================

    aktifkanDataTableMonitoring();

}


// ============================================================
// AKTIFKAN DATATABLE
// ============================================================

function aktifkanDataTableMonitoring() {

    if (
        typeof $ ===
        "undefined"
    ) {

        console.warn(
            "jQuery tidak ditemukan. DataTables tidak diaktifkan."
        );

        return;

    }


    if (
        !$.fn ||
        !$.fn.DataTable
    ) {

        console.warn(
            "DataTables tidak ditemukan."
        );

        return;

    }


    monitoringTable =
        $("#tblMonitoring")
            .DataTable({

                pageLength:
                    25,

                lengthMenu:
                    [
                        10,
                        25,
                        50,
                        100
                    ],

                order:
                    [],

                destroy:
                    true,

                autoWidth:
                    false,

                language: {

                    search:
                        "Cari:",

                    lengthMenu:
                        "Tampilkan _MENU_ entri",

                    info:
                        "Menampilkan _START_ sampai _END_ dari _TOTAL_ entri",

                    infoEmpty:
                        "Tidak ada data",

                    zeroRecords:
                        "Data tidak ditemukan",

                    emptyTable:
                        "Tidak ada data",

                    paginate: {

                        previous:
                            "Sebelumnya",

                        next:
                            "Selanjutnya"

                    }

                }

            });

}


// ============================================================
// TAMPILKAN ERROR
// ============================================================

function tampilkanErrorMonitoring(
    message
) {

    const tbody =
        document.querySelector(
            "#tblMonitoring tbody"
        );


    if (!tbody) {
        return;
    }


    tbody.innerHTML = `

        <tr>

            <td
                colspan="13"
                class="text-center text-danger py-4"
            >

                Gagal memuat data.

                <br>

                ${escapeHtml(message)}

            </td>

        </tr>

    `;

}
