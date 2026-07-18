// ============================================================
// PARSER.JS
// PARSER UTAMA DATA REALISASI ANGGARAN BPHL XI
//
// Digunakan bersama oleh:
// - Dashboard
// - Monitoring
// - Grafik
// - Laporan
//
// STRUKTUR GOOGLE SHEET:
//
// A = 0  = Kode
// B = 1  = Uraian
// C = 2  = Volume
// D = 3  = Satuan
// E = 4  = Harga Satuan
// F = 5  = Pagu
//
// G - R = 6 - 17 = Realisasi Bulanan
//
// S = 18 = Jumlah Realisasi
// T = 19 = Sisa Anggaran
// U = 20 = Persen Realisasi
// ============================================================



// ============================================================
// 1. PARSER DATA MONITORING
// ============================================================

function parseDataMonitoring(data) {

    const hasil = [];


    // ========================================================
    // INFORMASI HIERARKI
    // ========================================================

    let kegiatan = "";
    let output = "";
    let komponen = "";
    let subKomponen = "";

    let akunKode = "";
    let akunNama = "";

    let itemAkun = "";


    // ========================================================
    // STATUS BLOKIR HIERARKI
    //
    // Jika parent diblokir, child dianggap diblokir.
    // ========================================================

    let kegiatanDiblokir = false;
    let outputDiblokir = false;
    let komponenDiblokir = false;
    let subKomponenDiblokir = false;
    let akunDiblokir = false;
    let itemUtamaDiblokir = false;


    // ========================================================
    // VALIDASI
    // ========================================================

    if (!Array.isArray(data)) {

        console.error(
            "parseDataMonitoring: data bukan array"
        );

        return hasil;

    }


    // ========================================================
    // LOOP GOOGLE SHEET
    // ========================================================

    for (
        let i = 0;
        i < data.length;
        i++
    ) {

        const row =
            data[i] || [];


        const kode =
            clean(
                row[0]
            );


        const namaAsli =
            clean(
                row[1]
            );


        const nama =
            cleanItemName(
                namaAsli
            );


        // ====================================================
        // LEWATI BARIS KOSONG
        // ====================================================

        if (
            !kode &&
            !namaAsli
        ) {

            continue;

        }


        // ====================================================
        // STATUS BLOKIR BARIS
        // ====================================================

        const barisDiblokir =
            isDiblokir(
                namaAsli
            );


        // ====================================================
        // KEGIATAN
        //
        // Contoh:
        // 7279
        // ====================================================

        if (
            /^\d{4}$/.test(
                kode
            )
        ) {

            kegiatan =
                nama ||
                namaAsli;


            kegiatanDiblokir =
                barisDiblokir;


            // Reset child

            output = "";
            komponen = "";
            subKomponen = "";

            akunKode = "";
            akunNama = "";

            itemAkun = "";


            outputDiblokir = false;
            komponenDiblokir = false;
            subKomponenDiblokir = false;
            akunDiblokir = false;
            itemUtamaDiblokir = false;


            continue;

        }


        // ====================================================
        // OUTPUT
        //
        // Contoh:
        // 7279.BDB
        // ====================================================

        if (
            /^\d{4}\.[A-Z0-9]+$/i
                .test(
                    kode
                )
        ) {

            output =
                nama ||
                namaAsli;


            outputDiblokir =

                kegiatanDiblokir ||

                barisDiblokir;


            // Reset child

            komponen = "";
            subKomponen = "";

            akunKode = "";
            akunNama = "";

            itemAkun = "";


            komponenDiblokir = false;
            subKomponenDiblokir = false;
            akunDiblokir = false;
            itemUtamaDiblokir = false;


            continue;

        }


        // ====================================================
        // KOMPONEN
        //
        // Contoh:
        // 7279.BDB.001
        // ====================================================

        if (
            /^\d{4}\.[A-Z0-9]+\.\d{3}$/i
                .test(
                    kode
                )
        ) {

            komponen =
                nama ||
                namaAsli;


            komponenDiblokir =

                kegiatanDiblokir ||

                outputDiblokir ||

                barisDiblokir;


            // Reset child

            subKomponen = "";

            akunKode = "";
            akunNama = "";

            itemAkun = "";


            subKomponenDiblokir = false;
            akunDiblokir = false;
            itemUtamaDiblokir = false;


            continue;

        }


        // ====================================================
        // SUB KOMPONEN FORMAT KODE
        //
        // Contoh:
        // 7279.BDB.001.051
        // ====================================================

        if (
            /^\d{4}\.[A-Z0-9]+\.\d{3}\.\d{3}$/i
                .test(
                    kode
                )
        ) {

            subKomponen =
                nama ||
                namaAsli;


            subKomponenDiblokir =

                kegiatanDiblokir ||

                outputDiblokir ||

                komponenDiblokir ||

                barisDiblokir;


            // Reset child

            akunKode = "";
            akunNama = "";

            itemAkun = "";

            akunDiblokir = false;
            itemUtamaDiblokir = false;


            continue;

        }


        // ====================================================
        // DETEKSI SUB KOMPONEN HURUF
        //
        // Contoh:
        //
        // A
        // Nama Sub Komponen
        //
        // atau:
        //
        // A Nama Sub Komponen
        // A. Nama Sub Komponen
        // A) Nama Sub Komponen
        //
        // Baris ini juga merupakan BARIS SUMMARY Excel.
        // Angka Pagu/Realisasi/Sisa pada baris ini digunakan
        // untuk ringkasan Sub Komponen.
        // ====================================================

        const subHuruf =
            deteksiSubKomponenHuruf(
                row
            );


        if (subHuruf) {

            subKomponen =
                cleanItemName(
                    subHuruf.nama
                );


            subKomponenDiblokir =

                kegiatanDiblokir ||

                outputDiblokir ||

                komponenDiblokir ||

                isDiblokir(
                    subHuruf.nama
                ) ||

                barisDiblokir;


            // Reset akun agar akun dari Sub Komponen sebelumnya
            // tidak terbawa ke Sub Komponen berikutnya.

            akunKode = "";
            akunNama = "";

            itemAkun = "";

            akunDiblokir = false;
            itemUtamaDiblokir = false;


            continue;

        }


        // ====================================================
        // DETEKSI AKUN BELANJA
        // ====================================================

        if (
            /^5\d{5}$/.test(
                kode
            ) &&
            namaAsli &&
            isAkunBelanja(
                namaAsli
            )
        ) {

            akunKode =
                kode;


            akunNama =
                cleanItemName(
                    namaAsli
                );


            akunDiblokir =

                kegiatanDiblokir ||

                outputDiblokir ||

                komponenDiblokir ||

                subKomponenDiblokir ||

                barisDiblokir;


            itemAkun = "";

            itemUtamaDiblokir = false;


            continue;

        }


        // ====================================================
        // BELUM ADA AKUN
        // ====================================================

        if (!akunNama) {

            continue;

        }


        // ====================================================
        // NAMA ITEM
        // ====================================================

        const namaBersih =
            cleanItemName(
                namaAsli
            );


        if (!namaBersih) {

            continue;

        }


        // ====================================================
        // AMBIL ANGKA KEUANGAN
        // ====================================================

        const angka =
            ambilAngkaKeuangan(
                row
            );


        // ====================================================
        // BARIS TANPA PAGU DAN REALISASI
        //
        // Tidak perlu dimasukkan sebagai data keuangan.
        // ====================================================

        if (
            angka.pagu === 0 &&
            angka.realisasi === 0 &&
            angka.sisa === 0
        ) {

            continue;

        }


        // ====================================================
        // DETEKSI RINCIAN
        // ====================================================

        const rincian =
            isRincianItem(
                namaAsli
            );


        let itemFinal = "";

        let rincianFinal = "-";


        // ====================================================
        // ITEM UTAMA
        // ====================================================

        if (!rincian) {

            itemAkun =
                namaBersih;


            itemUtamaDiblokir =

                kegiatanDiblokir ||

                outputDiblokir ||

                komponenDiblokir ||

                subKomponenDiblokir ||

                akunDiblokir ||

                barisDiblokir;


            itemFinal =
                namaBersih;

        }


        // ====================================================
        // RINCIAN ITEM
        // ====================================================

        else {

            itemFinal =

                itemAkun ||

                namaBersih;


            rincianFinal =
                namaBersih;

        }


        // ====================================================
        // STATUS FINAL
        // ====================================================

        const statusDiblokir =

            kegiatanDiblokir ||

            outputDiblokir ||

            komponenDiblokir ||

            subKomponenDiblokir ||

            akunDiblokir ||

            itemUtamaDiblokir ||

            barisDiblokir;


        const statusPagu =

            statusDiblokir

                ? "Diblokir"

                : "Normal";


        // ====================================================
        // PERSENTASE
        // ====================================================

        const persen =

            angka.pagu > 0

                ? (
                    angka.realisasi /
                    angka.pagu
                ) * 100

                : 0;


        // ====================================================
        // SIMPAN
        // ====================================================

        hasil.push({

            rowIndex:
                i,

            kode:
                akunKode ||
                "-",

            kegiatan:
                kegiatan ||
                "-",

            output:
                output ||
                "-",

            komponen:
                komponen ||
                "-",

            subKomponen:
                subKomponen ||
                "-",

            akun:
                akunNama ||
                "-",

            itemAkun:
                itemFinal ||
                "-",

            rincianItem:
                rincianFinal,

            statusPagu:
                statusPagu,

            pagu:
                angka.pagu,

            realisasi:
                angka.realisasi,

            sisa:
                angka.sisa,

            persen:
                persen,

            // Digunakan untuk menghindari double count
            isRincian:
                rincian

        });

    }


    console.log(
        "TOTAL DATA HASIL PARSER:",
        hasil.length
    );


    return hasil;

}



// ============================================================
// 2. AMBIL TOTAL UTAMA
//
// Digunakan untuk:
//
// - Dashboard
// - Grafik
// - Laporan ketika semua filter kosong
//
// TIDAK menjumlahkan seluruh item.
// ============================================================

function ambilTotalUtama(data) {

    if (!Array.isArray(data)) {

        return buatTotalKosong();

    }


    const kandidat = [];


    for (
        let i = 0;
        i < data.length;
        i++
    ) {

        const row =
            data[i] || [];


        const nama =
            clean(
                row[1]
            );


        const pagu =
            parseNumber(
                row[5]
            );


        const realisasi =
            parseNumber(
                row[18]
            );


        const sisaSheet =
            parseNumber(
                row[19]
            );


        if (
            pagu === null ||
            pagu <= 0
        ) {

            continue;

        }


        const realisasiFinal =
            realisasi || 0;


        const sisaFinal =

            sisaSheet !== null

                ? sisaSheet

                : Math.max(
                    pagu -
                    realisasiFinal,
                    0
                );


        kandidat.push({

            index:
                i,

            nama:
                nama,

            pagu:
                pagu,

            realisasi:
                realisasiFinal,

            sisa:
                sisaFinal

        });

    }


    // ========================================================
    // PRIORITAS 1:
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
    // PRIORITAS 2:
    // BARIS MENGANDUNG KATA PAGU
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
    // PRIORITAS 3:
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

        return buatTotalKosong();

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
            persen,

        index:
            total.index,

        nama:
            total.nama

    };

}



// ============================================================
// 3. HITUNG RINGKASAN DATA FILTER
//
// LOGIKA:
//
// 1. Tidak ada filter
//    -> ambil total utama dari raw Google Sheet
//
// 2. Hanya Komponen dipilih
//    -> ambil angka langsung dari baris summary Komponen
//
// 3. Komponen + Sub Komponen
//    -> ambil angka langsung dari baris summary Sub Komponen
//
// 4. Filter Akun / Status / Pencarian
//    -> hitung berdasarkan detail hasil filter
//
// Tujuan:
// Total Komponen/Sub Komponen harus sama dengan Excel.
// ============================================================

function hitungRingkasanData(
    dataDetail,
    rawData,
    options = {}
) {

    const {
        adaFilter = false,
        komponen = "",
        subKomponen = "",
        akun = "",
        status = "",
        cari = ""
    } = options;


    const filterKomponen =
        clean(komponen);

    const filterSubKomponen =
        clean(subKomponen);

    const filterAkun =
        clean(akun);

    const filterStatus =
        clean(status);

    const filterCari =
        clean(cari);


    // ========================================================
    // 1. TANPA FILTER
    // ========================================================

    if (
        !adaFilter ||
        (
            !filterKomponen &&
            !filterSubKomponen &&
            !filterAkun &&
            !filterStatus &&
            !filterCari
        )
    ) {

        return ambilTotalUtama(
            rawData
        );

    }


    // ========================================================
    // 2. TENTUKAN SUMMARY HIERARKI
    //
    // Summary dipakai sebagai batas maksimum angka.
    // ========================================================

    let summaryHierarki =
        null;


    // ========================================================
    // SUB KOMPONEN
    // ========================================================

    if (filterSubKomponen) {

        summaryHierarki =
            cariRingkasanHierarki(

                rawData,

                "subKomponen",

                filterSubKomponen,

                filterKomponen

            );

    }


    // ========================================================
    // KOMPONEN
    // ========================================================

    else if (filterKomponen) {

        summaryHierarki =
            cariRingkasanHierarki(

                rawData,

                "komponen",

                filterKomponen

            );

    }


    // ========================================================
    // 3. HANYA FILTER HIERARKI
    //
    // Tidak ada Akun / Status / Pencarian.
    //
    // WAJIB menggunakan summary Excel.
    // ========================================================

    if (
        summaryHierarki &&
        !filterAkun &&
        !filterStatus &&
        !filterCari
    ) {

        console.log(

            "Ringkasan menggunakan summary hierarki Excel:",

            summaryHierarki

        );


        return summaryHierarki;

    }


    // ========================================================
    // 4. FILTER STATUS PADA KOMPONEN / SUB KOMPONEN
    //
    // ATURAN:
    //
    // Semua     = Summary Excel
    //
    // Diblokir  = nilai detail yang benar-benar diblokir
    //
    // Normal    = Summary Excel - Diblokir
    //
    // Dengan demikian:
    //
    // Normal + Diblokir = Semua
    //
    // dan Normal tidak mungkin lebih besar dari Summary.
    // ========================================================

    if (
        summaryHierarki &&
        filterStatus &&
        !filterAkun &&
        !filterCari
    ) {

        // ====================================================
        // AMBIL SEMUA DATA DALAM HIERARKI
        //
        // Jangan gunakan dataDetail karena dataDetail sudah
        // terkena filter Status.
        // ====================================================

        let semuaDataHierarki =

            Array.isArray(
                window.dataLaporan
            )

                ? window.dataLaporan

                : [];


        // ====================================================
        // FALLBACK
        //
        // Pada deklarasi global dengan let, window.dataLaporan
        // bisa tidak tersedia.
        //
        // Maka parse ulang rawData.
        // ====================================================

        if (
            !Array.isArray(
                semuaDataHierarki
            ) ||
            semuaDataHierarki.length === 0
        ) {

            semuaDataHierarki =

                parseDataMonitoring(

                    rawData

                );

        }


        // ====================================================
        // FILTER KOMPONEN
        // ====================================================

        if (filterKomponen) {

            semuaDataHierarki =

                semuaDataHierarki.filter(

                    function (item) {

                        return (

                            item.komponen ===
                            filterKomponen

                        );

                    }

                );

        }


        // ====================================================
        // FILTER SUB KOMPONEN
        // ====================================================

        if (filterSubKomponen) {

            semuaDataHierarki =

                semuaDataHierarki.filter(

                    function (item) {

                        return (

                            item.subKomponen ===
                            filterSubKomponen

                        );

                    }

                );

        }


        // ====================================================
        // AMBIL HANYA DATA DIBLOKIR
        // ====================================================

        const dataDiblokir =

            semuaDataHierarki.filter(

                function (item) {

                    return (

                        item.statusPagu ===
                        "Diblokir"

                    );

                }

            );


        // ====================================================
        // HITUNG TOTAL DIBLOKIR
        //
        // Menggunakan mekanisme anti double-count.
        // ====================================================

        const ringkasanDiblokir =

            hitungRingkasanDetail(

                dataDiblokir

            );


        console.log(

            "===================================="

        );


        console.log(

            "PERHITUNGAN STATUS HIERARKI"

        );


        console.log(

            "Summary Semua:",

            summaryHierarki

        );


        console.log(

            "Ringkasan Diblokir:",

            ringkasanDiblokir

        );


        // ====================================================
        // STATUS DIBLOKIR
        // ====================================================

        if (
            filterStatus ===
            "Diblokir"
        ) {

            return {

                pagu:

                    Math.min(

                        Number(
                            ringkasanDiblokir.pagu
                        ) || 0,

                        Number(
                            summaryHierarki.pagu
                        ) || 0

                    ),


                realisasi:

                    Math.min(

                        Number(
                            ringkasanDiblokir.realisasi
                        ) || 0,

                        Number(
                            summaryHierarki.realisasi
                        ) || 0

                    ),


                sisa:

                    Math.max(

                        (
                            Number(
                                ringkasanDiblokir.pagu
                            ) || 0
                        )

                        -

                        (
                            Number(
                                ringkasanDiblokir.realisasi
                            ) || 0
                        ),

                        0

                    ),


                persen:

                    (
                        Number(
                            ringkasanDiblokir.pagu
                        ) || 0
                    ) > 0

                        ? (

                            (
                                Number(
                                    ringkasanDiblokir.realisasi
                                ) || 0
                            )

                            /

                            (
                                Number(
                                    ringkasanDiblokir.pagu
                                ) || 0
                            )

                        ) * 100

                        : 0

            };

        }


        // ====================================================
        // STATUS NORMAL
        //
        // NORMAL = SUMMARY - DIBLOKIR
        //
        // Ini bagian penting yang mencegah:
        //
        // Summary Semua = Rp96.916.000
        // tetapi Normal = Rp98.856.000
        //
        // Kondisi tersebut sekarang tidak mungkin terjadi.
        // ====================================================

        if (
            filterStatus ===
            "Normal"
        ) {

            const paguNormal =

                Math.max(

                    (
                        Number(
                            summaryHierarki.pagu
                        ) || 0
                    )

                    -

                    (
                        Number(
                            ringkasanDiblokir.pagu
                        ) || 0
                    ),

                    0

                );


            const realisasiNormal =

                Math.max(

                    (
                        Number(
                            summaryHierarki.realisasi
                        ) || 0
                    )

                    -

                    (
                        Number(
                            ringkasanDiblokir.realisasi
                        ) || 0
                    ),

                    0

                );


            const sisaNormal =

                Math.max(

                    paguNormal -

                    realisasiNormal,

                    0

                );


            const persenNormal =

                paguNormal > 0

                    ? (

                        realisasiNormal /

                        paguNormal

                    ) * 100

                    : 0;


            const hasilNormal = {

                pagu:
                    paguNormal,

                realisasi:
                    realisasiNormal,

                sisa:
                    sisaNormal,

                persen:
                    persenNormal

            };


            console.log(

                "Ringkasan Normal:",

                hasilNormal

            );


            console.log(

                "===================================="

            );


            return hasilNormal;

        }

    }


    // ========================================================
    // 5. FILTER AKUN / PENCARIAN
    //
    // Untuk filter detail tetap menggunakan data yang sudah
    // difilter laporan.js.
    // ========================================================

    return hitungRingkasanDetail(

        dataDetail

    );

}



// ============================================================
// 3B. BUAT RINGKASAN DARI BARIS RAW GOOGLE SHEET
//
// Fungsi ini membaca LANGSUNG angka pada baris summary.
// ============================================================

function buatRingkasanDariRawRow(
    row,
    rowIndex,
    nama,
    level
) {

    const pagu =
        parseNumber(
            row[5]
        ) || 0;


    const realisasi =
        parseNumber(
            row[18]
        ) || 0;


    const sisaSheet =
        parseNumber(
            row[19]
        );


    const sisa =

        sisaSheet !== null

            ? sisaSheet

            : Math.max(

                pagu -

                realisasi,

                0

            );


    const persen =

        pagu > 0

            ? (
                realisasi /
                pagu
            ) * 100

            : 0;


    return {

        pagu:
            pagu,

        realisasi:
            realisasi,

        sisa:
            sisa,

        persen:
            persen,

        rowIndex:
            rowIndex,

        nama:
            nama,

        level:
            level

    };

}



// ============================================================
// 3C. CARI RINGKASAN HIERARKI
//
// INI BAGIAN PERBAIKAN UTAMA.
//
// Fungsi mencari baris summary Komponen/Sub Komponen langsung
// pada raw data Excel / Google Sheet.
//
// Untuk Sub Komponen huruf seperti A, B, C:
// angka diambil langsung dari baris Sub Komponen tersebut.
//
// Dengan demikian:
// Belanja Modal Rp1.940.000 yang berada di luar Sub Komponen A
// tidak akan ikut terhitung pada ringkasan Sub Komponen A.
// ============================================================

function cariRingkasanHierarki(
    rawData,
    level,
    namaTarget,
    parentKomponen = ""
) {

    // ========================================================
    // VALIDASI
    // ========================================================

    if (!Array.isArray(rawData)) {

        return null;

    }


    const target =
        normalisasiNamaUntukPencarian(
            namaTarget
        );


    const parentTarget =
        normalisasiNamaUntukPencarian(
            parentKomponen
        );


    if (!target) {

        return null;

    }


    // ========================================================
    // KONTEKS HIERARKI
    // ========================================================

    let komponenAktif = "";

    let subKomponenKodeAktif = "";


    // ========================================================
    // LOOP RAW DATA
    // ========================================================

    for (
        let i = 0;
        i < rawData.length;
        i++
    ) {

        const row =
            rawData[i] || [];


        const kode =
            clean(
                row[0]
            );


        const namaAsli =
            clean(
                row[1]
            );


        const namaBersih =
            cleanItemName(
                namaAsli
            );


        if (
            !kode &&
            !namaAsli
        ) {

            continue;

        }


        // ====================================================
        // KOMPONEN
        //
        // Contoh:
        // 7279.BDB.001
        //
        // Angka ringkasan Komponen diambil LANGSUNG
        // dari baris ini.
        // ====================================================

        if (
            /^\d{4}\.[A-Z0-9]+\.\d{3}$/i
                .test(
                    kode
                )
        ) {

            komponenAktif =
                namaBersih ||
                namaAsli;


            subKomponenKodeAktif =
                "";


            if (
                level ===
                "komponen"
            ) {

                if (
                    namaSama(
                        komponenAktif,
                        target
                    )
                ) {

                    return buatRingkasanDariRawRow(

                        row,

                        i,

                        komponenAktif,

                        "komponen"

                    );

                }

            }


            continue;

        }


        // ====================================================
        // SUB KOMPONEN BERKODE
        //
        // Contoh:
        // 7279.BDB.001.051
        //
        // Tetap didukung jika nama ini digunakan sebagai
        // Sub Komponen pada filter.
        // ====================================================

        if (
            /^\d{4}\.[A-Z0-9]+\.\d{3}\.\d{3}$/i
                .test(
                    kode
                )
        ) {

            subKomponenKodeAktif =
                namaBersih ||
                namaAsli;


            if (
                level ===
                "subKomponen"
            ) {

                const cocokNama =
                    namaSama(

                        subKomponenKodeAktif,

                        target

                    );


                const cocokParent =

                    !parentTarget ||

                    namaSama(

                        komponenAktif,

                        parentTarget

                    );


                if (
                    cocokNama &&
                    cocokParent
                ) {

                    return buatRingkasanDariRawRow(

                        row,

                        i,

                        subKomponenKodeAktif,

                        "subKomponen"

                    );

                }

            }


            continue;

        }


        // ====================================================
        // SUB KOMPONEN HURUF
        //
        // Contoh:
        //
        // A
        // Nama Sub Komponen
        //
        // atau:
        //
        // A Nama Sub Komponen
        //
        // BARIS INI MERUPAKAN SUMBER ANGKA RINGKASAN.
        //
        // Tidak menjumlahkan detail di bawahnya.
        // ====================================================

        const subHuruf =
            deteksiSubKomponenHuruf(
                row
            );


        if (subHuruf) {

            const namaSubHuruf =
                cleanItemName(
                    subHuruf.nama
                );


            if (
                level ===
                "subKomponen"
            ) {

                const cocokNama =
                    namaSama(

                        namaSubHuruf,

                        target

                    );


                const cocokParent =

                    !parentTarget ||

                    namaSama(

                        komponenAktif,

                        parentTarget

                    );


                if (
                    cocokNama &&
                    cocokParent
                ) {

                    return buatRingkasanDariRawRow(

                        row,

                        i,

                        namaSubHuruf,

                        "subKomponen"

                    );

                }

            }

        }

    }


    // ========================================================
    // TIDAK DITEMUKAN
    // ========================================================

    console.warn(

        "cariRingkasanHierarki: summary tidak ditemukan",

        {

            level:
                level,

            namaTarget:
                namaTarget,

            parentKomponen:
                parentKomponen

        }

    );


    return null;

}



// ============================================================
// 3D. HITUNG RINGKASAN DATA DETAIL
//
// Digunakan jika ada filter:
//
// - Akun
// - Status
// - Pencarian
//
// Mencegah parent item dan rincian dihitung bersamaan.
// ============================================================

function hitungRingkasanDetail(
    dataDetail
) {

    if (
        !Array.isArray(
            dataDetail
        ) ||
        dataDetail.length === 0
    ) {

        return buatTotalKosong();

    }


    // ========================================================
    // KELOMPOKKAN BERDASARKAN ITEM UTAMA
    // ========================================================

    const grup =
        new Map();


    dataDetail.forEach(

        item => {

            const key = [

                item.kegiatan || "",

                item.output || "",

                item.komponen || "",

                item.subKomponen || "",

                item.kode || "",

                item.akun || "",

                item.itemAkun || ""

            ].join(
                "||"
            );


            if (
                !grup.has(
                    key
                )
            ) {

                grup.set(

                    key,

                    []

                );

            }


            grup
                .get(
                    key
                )
                .push(
                    item
                );

        }

    );


    const dataHitung =
        [];


    // ========================================================
    // JIKA ADA RINCIAN
    //
    // Gunakan rincian saja.
    //
    // Jika tidak ada rincian,
    // gunakan item utama.
    // ========================================================

    grup.forEach(

        items => {

            const rincian =
                items.filter(

                    item =>

                        item.isRincian ===
                        true

                );


            if (
                rincian.length >
                0
            ) {

                dataHitung.push(
                    ...rincian
                );

            }

            else {

                dataHitung.push(
                    ...items
                );

            }

        }

    );


    // ========================================================
    // HITUNG
    // ========================================================

    let totalPagu =
        0;


    let totalRealisasi =
        0;


    dataHitung.forEach(

        item => {

            totalPagu +=

                Number(
                    item.pagu
                ) || 0;


            totalRealisasi +=

                Number(
                    item.realisasi
                ) || 0;

        }

    );


    const totalSisa =

        Math.max(

            totalPagu -

            totalRealisasi,

            0

        );


    const persen =

        totalPagu > 0

            ? (
                totalRealisasi /
                totalPagu
            ) * 100

            : 0;


    return {

        pagu:
            totalPagu,

        realisasi:
            totalRealisasi,

        sisa:
            totalSisa,

        persen:
            persen

    };

}



// ============================================================
// 3E. NORMALISASI NAMA UNTUK PENCOCOKAN
// ============================================================

function normalisasiNamaUntukPencarian(
    value
) {

    return cleanItemName(
        value
    )

        .toLowerCase()

        .replace(
            /\s+/g,
            " "
        )

        .trim();

}



// ============================================================
// 3F. BANDINGKAN NAMA
// ============================================================

function namaSama(
    nama,
    target
) {

    const namaNormal =
        normalisasiNamaUntukPencarian(
            nama
        );


    const targetNormal =
        normalisasiNamaUntukPencarian(
            target
        );


    return (

        namaNormal ===
        targetNormal

    );

}



// ============================================================
// 4. BUAT TOTAL KOSONG
// ============================================================

function buatTotalKosong() {

    return {

        pagu:
            0,

        realisasi:
            0,

        sisa:
            0,

        persen:
            0

    };

}



// ============================================================
// 5. DETEKSI SUB KOMPONEN HURUF
// ============================================================

function deteksiSubKomponenHuruf(
    row
) {

    if (!Array.isArray(row)) {

        return null;

    }


    // ========================================================
    // CARI DI 6 KOLOM PERTAMA
    // ========================================================

    for (
        let c = 0;
        c < Math.min(
            row.length,
            6
        );
        c++
    ) {

        const nilai =
            clean(
                row[c]
            );


        if (!nilai) {

            continue;

        }


        // ====================================================
        // FORMAT:
        //
        // A
        //
        // Nama berada di kolom berikutnya.
        // ====================================================

        if (
            /^[A-Z]$/.test(
                nilai
            )
        ) {

            for (
                let n = c + 1;
                n < Math.min(
                    row.length,
                    c + 6
                );
                n++
            ) {

                const calonNama =
                    clean(
                        row[n]
                    );


                if (
                    calonNama &&

                    !/^[A-Z]$/.test(
                        calonNama
                    ) &&

                    !/^\d+$/.test(
                        calonNama
                    ) &&

                    !isAkunBelanja(
                        calonNama
                    )
                ) {

                    return {

                        kode:
                            nilai,

                        nama:
                            calonNama

                    };

                }

            }

        }


        // ====================================================
        // FORMAT:
        //
        // A Nama
        // A. Nama
        // A) Nama
        // ====================================================

        const match =
            nilai.match(

                /^([A-Z])[\.\)]?\s+(.+)$/

            );


        if (match) {

            const nama =
                clean(
                    match[2]
                );


            if (
                nama &&

                !isAkunBelanja(
                    nama
                )
            ) {

                return {

                    kode:
                        match[1],

                    nama:
                        nama

                };

            }

        }

    }


    return null;

}



// ============================================================
// 6. DETEKSI AKUN BELANJA
// ============================================================

function isAkunBelanja(
    text
) {

    const value =

        clean(
            text
        )

            .replace(
                /^\s*-\s*/,
                ""
            )

            .toLowerCase();


    return (

        value.startsWith(
            "belanja bahan"
        ) ||

        value.startsWith(
            "belanja honor"
        ) ||

        value.startsWith(
            "belanja jasa"
        ) ||

        value.startsWith(
            "belanja perjalanan"
        ) ||

        value.startsWith(
            "belanja modal"
        ) ||

        value.startsWith(
            "belanja barang"
        )

    );

}



// ============================================================
// 7. DETEKSI RINCIAN ITEM
// ============================================================

function isRincianItem(
    text
) {

    const value =
        clean(
            text
        );


    return (

        /^[a-z]\.\s+/i
            .test(
                value
            ) ||

        /^biaya transport/i
            .test(
                value
            ) ||

        /^biaya penginapan/i
            .test(
                value
            ) ||

        /^uang harian/i
            .test(
                value
            )

    );

}



// ============================================================
// 8. CEK BLOKIR
//
// Mendukung:
// (*)
// (**)
// (***)
// ============================================================

function isDiblokir(
    text
) {

    const value =
        String(
            text ||
            ""
        );


    return (

        value.includes(
            "(*)"
        ) ||

        value.includes(
            "(**)"
        ) ||

        value.includes(
            "(***)"
        )

    );

}



// ============================================================
// 9. CEK STATUS PAGU
// ============================================================

function cekStatusPagu(
    text
) {

    return isDiblokir(
        text
    )

        ? "Diblokir"

        : "Normal";

}



// ============================================================
// 10. BERSIHKAN NAMA ITEM
// ============================================================

function cleanItemName(
    text
) {

    return clean(
        text
    )

        // Hapus tanda blokir
        .replace(
            /\(\*{1,3}\)/g,
            ""
        )

        // Hapus tanda "-"
        .replace(
            /^\s*-\s*/,
            ""
        )

        // Hapus a. b. c.
        .replace(
            /^\s*[a-z]\.\s*/i,
            ""
        )

        .replace(
            /\s+/g,
            " "
        )

        .trim();

}



// ============================================================
// 11. AMBIL ANGKA KEUANGAN
// ============================================================

function ambilAngkaKeuangan(
    row
) {

    if (!Array.isArray(row)) {

        return {

            pagu:
                0,

            realisasi:
                0,

            sisa:
                0

        };

    }


    const INDEX_PAGU =
        5;


    const INDEX_REALISASI =
        18;


    const INDEX_SISA =
        19;


    const pagu =

        parseNumber(

            row[
                INDEX_PAGU
            ]

        ) || 0;


    const realisasi =

        parseNumber(

            row[
                INDEX_REALISASI
            ]

        ) || 0;


    const sisaSheet =

        parseNumber(

            row[
                INDEX_SISA
            ]

        );


    // ========================================================
    // SISA
    //
    // Jika kolom Sisa tersedia di Excel, gunakan nilai Excel.
    // Jika tidak tersedia, hitung Pagu - Realisasi.
    // ========================================================

    const sisa =

        sisaSheet !== null

            ? sisaSheet

            : Math.max(

                pagu -

                realisasi,

                0

            );


    return {

        pagu:
            pagu,

        realisasi:
            realisasi,

        sisa:
            sisa

    };

}



// ============================================================
// 12. PARSE NUMBER
// ============================================================

function parseNumber(
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
        )
            .trim();


    if (
        text === "" ||
        text === "-"
    ) {

        return null;

    }


    // ========================================================
    // JANGAN BACA PERSEN
    // ========================================================

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
    // FORMAT INDONESIA
    //
    // 1.500.000
    // 1.500.000,50
    //
    // Hilangkan titik ribuan.
    // ========================================================

    text =
        text.replace(
            /\./g,
            ""
        );


    // ========================================================
    // KOMA MENJADI DESIMAL
    // ========================================================

    text =
        text.replace(
            /,/g,
            "."
        );


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
        Number.isNaN(
            number
        )
    ) {

        return null;

    }


    return number;

}



// ============================================================
// 13. FORMAT RUPIAH
// ============================================================

function formatRupiah(
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
        )
            .toLocaleString(
                "id-ID"
            )

    );

}



// ============================================================
// 14. FORMAT PERSEN
// ============================================================

function formatPersen(
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
// 15. CLEAN STRING
// ============================================================

function clean(
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
// 16. ESCAPE HTML
// ============================================================

function escapeHtml(
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