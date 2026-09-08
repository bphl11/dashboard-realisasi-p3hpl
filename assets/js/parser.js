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
// DATA_APLIKASI ADAPTER
// Format baru dibaca berdasarkan NAMA HEADER, bukan posisi kolom.
// ============================================================

function normalisasiHeaderDataAplikasi(value) {
    return String(value ?? "")
        .trim()
        .toLowerCase()
        .replace(/\s+/g, " ")
        .replace(/[._-]/g, " ");
}

function konteksDataAplikasi(data) {
    if (!Array.isArray(data)) return null;

    const max = Math.min(data.length, 10);

    for (let i = 0; i < max; i++) {
        const row = Array.isArray(data[i]) ? data[i] : [];
        const map = {};

        row.forEach(function (value, index) {
            const key = normalisasiHeaderDataAplikasi(value);
            if (key) map[key] = index;
        });

        // DATA_APLIKASI versi baru dimulai dari level Sub Output.
        // Kolom Kode Kegiatan, Kegiatan, Kode Output, dan Output dapat
        // dihapus tanpa membuat parser gagal mendeteksi sumber data.
        const punyaPagu = Object.prototype.hasOwnProperty.call(map, "pagu");
        const punyaRealisasi =
            Object.prototype.hasOwnProperty.call(map, "realisasi") ||
            Object.prototype.hasOwnProperty.call(map, "jumlah realisasi");

        const punyaIdentitasHierarki = [
            "sub output",
            "suboutput",
            "nama sub output",
            "nama suboutput",
            "kode sub output",
            "kode suboutput",
            "komponen",
            "nama komponen",
            "sub komponen",
            "subkomponen",
            "nama sub komponen",
            "akun belanja",
            "akun",
            "item akun",
            "item",
            "detil akun",
            "detail akun",
            "rincian item",
            "rincian"
        ].some(function (key) {
            return Object.prototype.hasOwnProperty.call(map, key);
        });

        if (punyaPagu && punyaRealisasi && punyaIdentitasHierarki) {
            return { headerIndex: i, map: map };
        }
    }

    return null;
}

function indeksHeaderDataAplikasi(map, aliases) {
    for (const alias of aliases) {
        const key = normalisasiHeaderDataAplikasi(alias);
        if (Object.prototype.hasOwnProperty.call(map, key)) return map[key];
    }
    return -1;
}

function nilaiHeaderDataAplikasi(row, map, aliases) {
    const index = indeksHeaderDataAplikasi(map, aliases);
    return index >= 0 ? String(row[index] ?? "").trim() : "";
}

function angkaDataAplikasi(value) {
    if (value === null || value === undefined) return 0;

    let text = String(value).trim();
    if (!text || text === "-") return 0;

    // DATA_APLIKASI adalah data anggaran dalam rupiah bulat.
    // Google Sheet/CSV dapat mengirim pemisah ribuan dengan titik,
    // koma, atau campuran keduanya. Parser lama gagal pada nilai
    // seperti "13,984,002" sehingga nilainya menjadi 0.
    // Normalisasi seluruh pemisah ribuan terlebih dahulu.
    const negative = /^\s*-/.test(text);

    text = text
        .replace(/Rp/gi, "")
        .replace(/[^0-9.,]/g, "")
        .replace(/[.,]/g, "");

    if (!text) return 0;

    const number = Number(text);
    if (!Number.isFinite(number)) return 0;

    return negative ? -number : number;
}

function statusDataAplikasi(value) {
    const text = String(value ?? "").trim().toLowerCase();
    return text.includes("blok") ? "Diblokir" : "Normal";
}

function parseDataAplikasi(data) {
    const context = konteksDataAplikasi(data);
    if (!context) return null;

    const hasil = [];
    const map = context.map;

    const bulan = [
        "Januari", "Februari", "Maret", "April", "Mei", "Juni",
        "Juli", "Agustus", "September", "Oktober", "November", "Desember"
    ];

    for (let i = context.headerIndex + 1; i < data.length; i++) {
        const row = Array.isArray(data[i]) ? data[i] : [];
        if (!row.some(function (value) { return String(value ?? "").trim() !== ""; })) continue;

        // Kolom sebelum Sub Output bersifat opsional pada DATA_APLIKASI baru.
        const kegiatan = nilaiHeaderDataAplikasi(row, map, ["Kegiatan"]);
        const kodeKegiatan = nilaiHeaderDataAplikasi(row, map, ["Kode Kegiatan"]);
        const output = nilaiHeaderDataAplikasi(row, map, ["Output"]);
        const kodeOutput = nilaiHeaderDataAplikasi(row, map, ["Kode Output"]);

        // Jangan pernah memakai kode sebagai nama Sub Output. Pada versi
        // sebelumnya "Kode Sub Output" ikut terbaca sebagai subOutput sehingga
        // grouping Dashboard/Komponen dapat salah.
        const subOutput = nilaiHeaderDataAplikasi(row, map, [
            "Sub Output",
            "Suboutput",
            "Nama Sub Output",
            "Nama Suboutput"
        ]);
        const kodeSubOutput = nilaiHeaderDataAplikasi(row, map, [
            "Kode Sub Output",
            "Kode Suboutput"
        ]);

        const komponen = nilaiHeaderDataAplikasi(row, map, ["Komponen", "Nama Komponen"]);
        const subKomponen = nilaiHeaderDataAplikasi(row, map, ["Sub Komponen", "Subkomponen", "Nama Sub Komponen"]);
        const akun = nilaiHeaderDataAplikasi(row, map, ["Akun Belanja", "Akun"]);
        const itemAkun = nilaiHeaderDataAplikasi(row, map, ["Item Akun", "Item"]);
        const detilAkun = nilaiHeaderDataAplikasi(row, map, ["Detil Akun", "Detail Akun", "Detil"]);
        const rincianItem = nilaiHeaderDataAplikasi(row, map, ["Rincian Item", "Rincian"]);

        const pagu = angkaDataAplikasi(nilaiHeaderDataAplikasi(row, map, ["Pagu"]));
        const realisasi = angkaDataAplikasi(nilaiHeaderDataAplikasi(row, map, ["Realisasi", "Jumlah Realisasi"]));
        const sisaRaw = nilaiHeaderDataAplikasi(row, map, ["Sisa", "Sisa Anggaran"]);
        const sisa = sisaRaw === "" || sisaRaw === "-" ? Math.max(pagu - realisasi, 0) : angkaDataAplikasi(sisaRaw);
        const statusPagu = statusDataAplikasi(nilaiHeaderDataAplikasi(row, map, ["Status Pagu", "Status"]));

        const hasIdentity = kegiatan || kodeKegiatan || output || kodeOutput || subOutput || kodeSubOutput || komponen || subKomponen || akun || itemAkun || detilAkun || rincianItem;
        if (!hasIdentity && pagu === 0 && realisasi === 0) continue;

        const item = {
            rowIndex: i,
            sourceFormat: "DATA_APLIKASI",
            kode: akun || kodeKegiatan || kodeSubOutput || kodeOutput || "-",
            kodeKegiatan: kodeKegiatan || "-",
            kegiatan: kegiatan || "-",
            kodeOutput: kodeOutput || "-",
            output: output || "-",
            subOutput: subOutput || kodeSubOutput || "-",
            komponen: komponen || "-",
            subKomponen: subKomponen || "-",
            akun: akun || "-",
            itemAkun: itemAkun || "-",
            detilAkun: detilAkun || "-",
            rincianItem: rincianItem || "-",
            statusPagu: statusPagu,
            pagu: pagu,
            realisasi: realisasi,
            sisa: sisa,
            persen: pagu > 0 ? (realisasi / pagu) * 100 : 0,
            isRincian: Boolean(rincianItem && rincianItem !== "-"),
            bulanan: {}
        };

        bulan.forEach(function (namaBulan) {
            item.bulanan[namaBulan] = angkaDataAplikasi(
                nilaiHeaderDataAplikasi(row, map, [namaBulan])
            );
        });

        hasil.push(item);
    }


    gabungkanInputRealisasi(
        hasil,
        ambilInputRealisasiDariRaw(
            data
        )
    );


    console.log("FORMAT DATA: DATA_APLIKASI");
    console.log("TOTAL DATA HASIL PARSER:", hasil.length);

    return hasil;
}

function totalDataAplikasi(data) {
    const parsed = Array.isArray(data) && data.length && data[0] && data[0].sourceFormat === "DATA_APLIKASI"
        ? data
        : parseDataAplikasi(data);

    if (!Array.isArray(parsed)) return null;

    return ringkasDataAplikasi(parsed);
}

function ringkasDataAplikasi(items) {
    const rows = Array.isArray(items) ? items : [];

    let pagu = 0;
    let realisasi = 0;

    rows.forEach(function (item) {
        pagu += Number(item?.pagu) || 0;
        realisasi += Number(item?.realisasi) || 0;
    });

    return {
        pagu: pagu,
        realisasi: realisasi,
        sisa: Math.max(pagu - realisasi, 0),
        persen: pagu > 0 ? (realisasi / pagu) * 100 : 0
    };
}

function isDataAplikasi(data) {
    return Boolean(konteksDataAplikasi(data));
}

function ambilBulananDataAplikasi(data) {
    const parsed = Array.isArray(data) && data.length && data[0] && data[0].sourceFormat === "DATA_APLIKASI"
        ? data
        : parseDataAplikasi(data);

    const bulan = ["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"];
    const hasil = {};
    bulan.forEach(function (nama) { hasil[nama] = 0; });

    (parsed || []).forEach(function (item) {
        bulan.forEach(function (nama) {
            hasil[nama] += Number(item?.bulanan?.[nama]) || 0;
        });
    });

    return hasil;
}


// ============================================================
// INPUT_REALISASI ADAPTER
//
// INPUT_REALISASI adalah transaksi tambahan dan tidak mengganti
// nilai DATA_APLIKASI. Setiap transaksi dicocokkan dengan rowIndex
// DATA_APLIKASI melalui INDEX_RECORD.
// ============================================================

function normalisasiBulanInputRealisasi(value) {

    const nama =
        String(
            value ?? ""
        )
            .trim()
            .toLowerCase();


    const bulan = {
        januari: "Januari",
        februari: "Februari",
        maret: "Maret",
        april: "April",
        mei: "Mei",
        juni: "Juni",
        juli: "Juli",
        agustus: "Agustus",
        september: "September",
        oktober: "Oktober",
        november: "November",
        desember: "Desember"
    };


    return (
        bulan[
            nama
        ] ||
        ""
    );

}


function ambilInputRealisasiDariRaw(data) {

    if (
        !Array.isArray(
            data
        )
    ) {

        return [];

    }


    const input =
        data.__inputRealisasi;


    return Array.isArray(
        input
    )

        ? input

        : [];

}


function gabungkanInputRealisasi(
    items,
    inputRealisasi
) {

    if (
        !Array.isArray(
            items
        )
    ) {

        return [];

    }


    if (
        !Array.isArray(
            inputRealisasi
        ) ||
        !inputRealisasi.length
    ) {

        return items;

    }


    const byIndex =
        new Map();


    items.forEach(
        function (
            item
        ) {

            byIndex.set(
                Number(
                    item.rowIndex
                ),
                item
            );

        }
    );


    let diterapkan =
        0;


    let diabaikan =
        0;


    inputRealisasi.forEach(
        function (
            transaksi
        ) {

            const indexRecord =
                Number(
                    transaksi?.index_record ??
                    transaksi?.INDEX_RECORD ??
                    transaksi?.indexRecord
                );


            const bulan =
                normalisasiBulanInputRealisasi(
                    transaksi?.bulan ??
                    transaksi?.BULAN
                );


            const nominal =
                angkaDataAplikasi(
                    transaksi?.nominal_realisasi ??
                    transaksi?.NOMINAL_REALISASI ??
                    transaksi?.nominalRealisasi
                );


            const item =
                byIndex.get(
                    indexRecord
                );


            if (
                !item ||
                !bulan ||
                !Number.isFinite(
                    nominal
                ) ||
                nominal <= 0
            ) {

                diabaikan++;

                return;

            }


            item.bulanan =
                item.bulanan ||
                {};


            item.bulanan[
                bulan
            ] =
                (
                    Number(
                        item.bulanan[
                            bulan
                        ]
                    ) ||
                    0
                ) +
                nominal;


            item.realisasi =
                (
                    Number(
                        item.realisasi
                    ) ||
                    0
                ) +
                nominal;


            item.sisa =
                Math.max(
                    (
                        Number(
                            item.pagu
                        ) ||
                        0
                    ) -
                    (
                        Number(
                            item.realisasi
                        ) ||
                        0
                    ),
                    0
                );


            item.persen =
                (
                    Number(
                        item.pagu
                    ) ||
                    0
                ) > 0

                    ? (
                        (
                            Number(
                                item.realisasi
                            ) ||
                            0
                        ) /
                        Number(
                            item.pagu
                        )
                    ) *
                    100

                    : 0;


            diterapkan++;

        }
    );


    console.log(
        "INPUT_REALISASI diterapkan:",
        diterapkan
    );


    if (
        diabaikan > 0
    ) {

        console.warn(
            "INPUT_REALISASI diabaikan:",
            diabaikan
        );

    }


    return items;

}



// ============================================================
// 1. PARSER DATA MONITORING
// ============================================================

function parseDataMonitoring(data) {

    // DATA_APLIKASI adalah sumber standar baru.
    // Jika header terdeteksi, jangan gunakan parser hierarki lama.
    if (isDataAplikasi(data)) {
        return parseDataAplikasi(data) || [];
    }

    const hasil = [];


    // ========================================================
    // INFORMASI HIERARKI
    // ========================================================

    let kegiatan = "";
    let output = "";
    let subOutput = "";
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
    let subOutputDiblokir = false;
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
        traceMulai(i);

traceTambah(
    i,
    "Baca Row Excel"
);


        const kode =
            clean(
                row[0]
            );

        traceTambah(
    i,
    "Kode",
    kode
);


        const namaAsli =
            clean(
                row[1]
            );

        traceTambah(
    i,
    "Nama",
    namaAsli
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
            traceTambah(
    i,
    "Deteksi Kegiatan",
    kegiatan
);


            kegiatanDiblokir =
                barisDiblokir;


            // Reset child

            output = "";
            subOutput = "";
            komponen = "";
            subKomponen = "";

            akunKode = "";
            akunNama = "";

            itemAkun = "";


            outputDiblokir = false;
            subOutputDiblokir = false;
            subOutputDiblokir = false;
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
            traceTambah(
    i,
    "Deteksi Output",
    output
);


            outputDiblokir =

                kegiatanDiblokir ||

                barisDiblokir;


            // Reset child

            subOutput = "";
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
        // SUB OUTPUT
        //
        // Contoh:
        // 7279.BDB.001
        //
        // Hierarki Excel:
        // Program/Kegiatan/Output/Sub Output/Komponen/Sub Komponen.
        // Karena itu .001 bukan Komponen. Menyimpan .001 sebagai
        // Sub Output mencegah .001.052 salah masuk ke Komponen .001.051.
        // ====================================================

        if (
            /^\d{4}\.[A-Z0-9]+\.\d{3}$/i
                .test(
                    kode
                )
        ) {

            subOutput =
                nama ||
                namaAsli;

            subOutputDiblokir =
                kegiatanDiblokir ||
                outputDiblokir ||
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
        // KOMPONEN FORMAT KODE
        //
        // Contoh:
        // 7279.BDB.001.051
        //
        // Level ini adalah Komponen untuk filter Monitoring.
        // ====================================================

        if (
            /^\d{4}\.[A-Z0-9]+\.\d{3}\.\d{3}$/i
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
                subOutputDiblokir ||
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
            traceTambah(
    i,
    "Deteksi Sub Komponen Huruf",
    subKomponen
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

            traceTambah(
    i,
    "Deteksi Akun",
    akunKode + " - " + akunNama
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
        traceTambah(
    i,
    "Keuangan",
    angka
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
        traceTambah(
    i,
    rincian
        ? "Rincian Item"
        : "Item Utama",
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

            subOutputDiblokir ||

            komponenDiblokir ||

            subKomponenDiblokir ||

            akunDiblokir ||

            itemUtamaDiblokir ||

            barisDiblokir;


        const statusPagu =

            statusDiblokir

                ? "Diblokir"

                : "Normal";
        traceTambah(
    i,
    "Status Pagu",
    statusPagu
);


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
     traceTambah(i,"Simpan ke Hasil Parser");

hasil.push({

    rowIndex:i,

    kode:akunKode || "-",

    kegiatan:kegiatan || "-",

    output:output || "-",

    subOutput:subOutput || "-",

    komponen:komponen || "-",

    subKomponen:subKomponen || "-",

    akun:akunNama || "-",

    itemAkun:itemFinal || "-",

    rincianItem:rincianFinal,

    statusPagu:statusPagu,

    pagu:angka.pagu,

    realisasi:angka.realisasi,

    sisa:angka.sisa,

    persen:persen,

    isRincian:rincian

});

traceSelesai(i);
         

    }


    console.log(
        "TOTAL DATA HASIL PARSER:",
        hasil.length
    );
    // ===============================
// DEBUG HASIL PARSER
// ===============================
console.log("===== HASIL PARSER =====");
console.log("Jumlah Record :", hasil.length);
console.table(hasil);

// Agar bisa diakses dari Browser Console
window.hasilParser = hasil;

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

    // Total DATA_APLIKASI dihitung dari seluruh baris detail flat.
    const totalDataBaru = totalDataAplikasi(data);
    if (totalDataBaru) {
        return totalDataBaru;
    }

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

    // DATA_APLIKASI sudah berupa baris detail final.
    // Ringkasan harus selalu berasal dari scope yang sama dengan tabel.
    if (Array.isArray(dataDetail) && dataDetail.some(function (item) {
        return item && item.sourceFormat === "DATA_APLIKASI";
    })) {
        return ringkasDataAplikasi(dataDetail);
    }
    const {
        adaFilter = false,
        komponen = "",
        subKomponen = "",
        akun = "",
        status = "",
        cari = ""
    } = options;

    const filterKomponen = clean(komponen);
    const filterSubKomponen = clean(subKomponen);
    const filterAkun = clean(akun);
    const filterStatus = clean(status);
    const filterCari = clean(cari);

    const adaFilterAktif = Boolean(
        adaFilter ||
        filterKomponen ||
        filterSubKomponen ||
        filterAkun ||
        filterStatus ||
        filterCari
    );

    // Tanpa filter: gunakan total utama Google Sheet.
    if (!adaFilterAktif) {
        return ambilTotalUtama(rawData);
    }

    // Status global Normal/Diblokir harus identik dengan Calculation Engine.
    if (
        filterStatus &&
        !filterKomponen &&
        !filterSubKomponen &&
        !filterAkun &&
        !filterCari &&
        typeof hitungCalculationEngine === "function"
    ) {
        const engine = hitungCalculationEngine(rawData, dataDetail);

        if (filterStatus === "Normal") {
            return engine.tanpaBlokir || buatTotalKosong();
        }

        if (filterStatus === "Diblokir") {
            return engine.diblokir || buatTotalKosong();
        }
    }

    // PENTING: semua ringkasan harus dihitung dari scope yang
    // sama dengan tabel Monitoring yang sedang ditampilkan.
    let scoped = Array.isArray(dataDetail) ? [...dataDetail] : [];

    if (filterKomponen) {
        scoped = scoped.filter(item => item.komponen === filterKomponen);
    }

    if (filterSubKomponen) {
        scoped = scoped.filter(item => item.subKomponen === filterSubKomponen);
    }

    if (filterAkun) {
        scoped = scoped.filter(item => item.akun === filterAkun);
    }

    if (filterStatus) {
        scoped = scoped.filter(item => item.statusPagu === filterStatus);
    }

    if (filterCari) {
        const q = normalisasiNamaUntukPencarian(filterCari);
        scoped = scoped.filter(item =>
            normalisasiNamaUntukPencarian([
                item.kegiatan,
                item.output,
                item.subOutput,
                item.komponen,
                item.subKomponen,
                item.akun,
                item.itemAkun,
                item.rincianItem
            ].join(" ")).includes(q)
        );
    }

    // Hanya filter hierarki tanpa akun/status/pencarian boleh memakai
    // summary Excel. Begitu Status Normal/Diblokir dipilih, angka wajib
    // berasal dari detail yang sudah berada dalam scope filter.
    if (
        !filterAkun &&
        !filterStatus &&
        !filterCari &&
        (filterKomponen || filterSubKomponen)
    ) {
        let summaryHierarki = null;

        if (filterSubKomponen) {
            summaryHierarki = cariRingkasanHierarki(
                rawData,
                "subKomponen",
                filterSubKomponen,
                filterKomponen
            );
        } else if (filterKomponen) {
            summaryHierarki = cariRingkasanHierarki(
                rawData,
                "komponen",
                filterKomponen
            );
        }

        if (summaryHierarki) {
            return summaryHierarki;
        }
    }

    return hitungRingkasanDetail(scoped);
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


    if (
        level === "komponen" &&
        nama.includes(
            "Peta Arahan Pemanfaatan Hutan Produksi dan Hutan Lindung"
        )
    ) {

        console.log({
            rowIndex,
            level,
            nama,
            pagu,
            realisasi,
            sisa,
            row
        });

    }


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
    console.log("TARGET =", target);


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
        // SUB OUTPUT
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
            // Sub Output menjadi konteks parent untuk Komponen.
            komponenAktif =
                namaBersih ||
                namaAsli;

            subKomponenKodeAktif = "";

            continue;

        }


        // ====================================================
        // KOMPONEN
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

            const komponenKode =
                namaBersih ||
                namaAsli;

            if (
                level === "komponen" &&
                namaSama(
                    komponenKode,
                    target
                )
            ) {
                return buatRingkasanDariRawRow(
                    row,
                    i,
                    komponenKode,
                    "komponen"
                );
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
    console.log("===== DATA HITUNG =====");
console.log("Jumlah dataHitung:", dataHitung.length);
console.table(dataHitung);

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


// ============================================================
// HITUNG BLOKIR LANGSUNG DARI RAW GOOGLE SHEET
//
// Sumber status blokir adalah tanda (*) / (**) / (***) pada
// baris rincian anggaran. Perhitungan ini sengaja TIDAK memakai
// hasil grouping parser, karena grouping item/rincian dapat
// menghilangkan sebagian baris blokir ketika nama item sama.
//
// Hanya baris transaksi atomik yang dihitung: baris harus memiliki
// pagu dan Volume atau Harga Satuan. Dengan demikian baris summary
// Program/Output/Komponen/Akun tidak ikut dijumlahkan.
// ============================================================

function hitungBlokirDariRawData(rawData) {

    let pagu = 0;
    let realisasi = 0;

    if (!Array.isArray(rawData)) {
        return { pagu, realisasi };
    }

    rawData.forEach(row => {

        if (!Array.isArray(row)) {
            return;
        }

        const nama = String(row[1] || "");

        if (!isDiblokir(nama)) {
            return;
        }

        const nilaiPagu = parseNumber(row[5]) || 0;
        const volume = parseNumber(row[2]);
        const hargaSatuan = parseNumber(row[4]);

        const transaksiAtomik =
            volume !== null ||
            hargaSatuan !== null;

        if (!transaksiAtomik || nilaiPagu <= 0) {
            return;
        }

        pagu += nilaiPagu;
        realisasi += parseNumber(row[18]) || 0;

    });

    return { pagu, realisasi };
}


// ============================================================
// CALCULATION ENGINE
// Single Source of Truth untuk Dashboard, Monitoring, Grafik dan Laporan.
//
// Aturan:
// 1. Total selalu berasal dari summary utama Excel (ambilTotalUtama).
// 2. Nilai diblokir berasal dari detail parser dengan perlindungan anti
//    double count (hitungRingkasanDetail).
// 3. Nilai tanpa blokir = Total - Diblokir.
// ============================================================

function hitungCalculationEngine(rawData, parsedData) {

    // Calculation engine khusus DATA_APLIKASI.
    // Status Pagu tersedia langsung di sumber sehingga tidak perlu
    // lagi inferensi blokir dari teks hierarki Excel lama.
    if (isDataAplikasi(rawData)) {
        const detail = Array.isArray(parsedData) && parsedData.some(function (item) {
            return item && item.sourceFormat === "DATA_APLIKASI";
        })
            ? parsedData
            : (parseDataAplikasi(rawData) || []);

        const normal = detail.filter(function (item) {
            return item.statusPagu === "Normal";
        });

        const diblokir = detail.filter(function (item) {
            return item.statusPagu === "Diblokir";
        });

        return {
            total: ringkasDataAplikasi(detail),
            diblokir: ringkasDataAplikasi(diblokir),
            tanpaBlokir: ringkasDataAplikasi(normal),
            meta: {
                jumlahDetail: detail.length,
                jumlahDiblokir: diblokir.length,
                sourceFormat: "DATA_APLIKASI"
            }
        };
    }

    const total = typeof ambilTotalUtama === "function"
        ? (ambilTotalUtama(rawData) || {})
        : {};

    const data = Array.isArray(parsedData)
        ? parsedData
        : (typeof parseDataMonitoring === "function" ? parseDataMonitoring(rawData) : []);

    const totalPagu = Number(total.pagu) || 0;
    const totalRealisasi = Number(total.realisasi) || 0;

    // Status blokir global dihitung langsung dari raw Google Sheet.
    // Ini mencegah grouping parsedData membuang sebagian rincian bertanda (*).
    const diblokirRaw =
        typeof hitungBlokirDariRawData === "function"
            ? hitungBlokirDariRawData(rawData)
            : { pagu: 0, realisasi: 0 };

    const paguDiblokir = Math.min(
        Math.max(Number(diblokirRaw.pagu) || 0, 0),
        totalPagu
    );

    const realisasiDiblokir = Math.min(
        Math.max(Number(diblokirRaw.realisasi) || 0, 0),
        totalRealisasi
    );

    const paguTanpaBlokir = Math.max(totalPagu - paguDiblokir, 0);
    const realisasiTanpaBlokir = Math.max(totalRealisasi - realisasiDiblokir, 0);

    const totalSisa = Math.max(totalPagu - totalRealisasi, 0);
    const sisaDiblokir = Math.max(paguDiblokir - realisasiDiblokir, 0);
    const sisaTanpaBlokir = Math.max(paguTanpaBlokir - realisasiTanpaBlokir, 0);

    return {
        total: {
            pagu: totalPagu,
            realisasi: totalRealisasi,
            sisa: totalSisa,
            persen: totalPagu > 0 ? (totalRealisasi / totalPagu) * 100 : 0
        },
        diblokir: {
            pagu: paguDiblokir,
            realisasi: realisasiDiblokir,
            sisa: sisaDiblokir,
            persen: paguDiblokir > 0 ? (realisasiDiblokir / paguDiblokir) * 100 : 0
        },
        tanpaBlokir: {
            pagu: paguTanpaBlokir,
            realisasi: realisasiTanpaBlokir,
            sisa: sisaTanpaBlokir,
            persen: paguTanpaBlokir > 0 ? (realisasiTanpaBlokir / paguTanpaBlokir) * 100 : 0
        },
        meta: {
            jumlahDetail: data.length,
            jumlahDiblokir: Array.isArray(rawData)
                ? rawData.filter(function (row) {
                    if (!Array.isArray(row)) return false;

                    const nama = String(row[1] || "");
                    const nilaiPagu = parseNumber(row[5]) || 0;
                    const volume = parseNumber(row[2]);
                    const hargaSatuan = parseNumber(row[4]);

                    return (
                        isDiblokir(nama) &&
                        nilaiPagu > 0 &&
                        (volume !== null || hargaSatuan !== null)
                    );
                }).length
                : 0
        }
    };
}

// Alias singkat untuk pemakaian lintas halaman.
function hitungRingkasanAnggaran(rawData, parsedData) {
    return hitungCalculationEngine(rawData, parsedData);
}


// ============================================================
// CONSISTENCY CHECK
// Dipanggil setelah semua halaman menghitung ringkasan.
// ============================================================
function cekKonsistensiCalculationEngine(rawData, parsedData, summaries) {
    const engine = hitungCalculationEngine(rawData, parsedData);
    const hasil = {};
    Object.keys(summaries || {}).forEach(function (nama) {
        const nilai = summaries[nama] || {};
        const sama = ["pagu", "realisasi", "sisa"].every(function (k) {
            return Math.abs((Number(nilai[k]) || 0) - (Number(engine.total[k]) || 0)) < 0.01;
        });
        hasil[nama] = { sama: sama, nilai: nilai, acuan: engine.total };
    });
    return hasil;
}


// ============================================================
// FINAL VERIFICATION REPORT
// Digunakan untuk mencatat satu snapshot angka dari Google Sheet aktif.
// ============================================================
function buatLaporanVerifikasiAkhir(rawData, parsedData) {
    const engine = hitungCalculationEngine(rawData, parsedData);
    const snapshot = {
        paguTotal: engine.total.pagu,
        paguDiblokir: engine.diblokir.pagu,
        paguTanpaBlokir: engine.tanpaBlokir.pagu,
        realisasiTotal: engine.total.realisasi,
        realisasiDiblokir: engine.diblokir.realisasi,
        realisasiTanpaBlokir: engine.tanpaBlokir.realisasi
    };
    return {
        snapshot,
        identities: {
            pagu: Math.abs(snapshot.paguTotal - (snapshot.paguDiblokir + snapshot.paguTanpaBlokir)) < 0.01,
            realisasi: Math.abs(snapshot.realisasiTotal - (snapshot.realisasiDiblokir + snapshot.realisasiTanpaBlokir)) < 0.01
        }
    };
}
