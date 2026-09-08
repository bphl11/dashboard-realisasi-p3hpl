// ============================================================
// API.JS
// Mengambil data Google Sheet
// Dipakai oleh Dashboard dan Monitoring
// ============================================================


// ============================================================
// AMBIL TRANSAKSI INPUT_REALISASI
//
// Endpoint Google Apps Script mengembalikan JSON:
// {
//   success: true,
//   data: [
//     {
//       id_input,
//       index_record,
//       bulan,
//       nominal_realisasi,
//       keterangan
//     }
//   ]
// }
// ============================================================

async function fetchInputRealisasi() {

    if (
        typeof CONFIG === "undefined" ||
        !CONFIG.INPUT_REALISASI_URL
    ) {

        return [];

    }


    const separator =
        CONFIG.INPUT_REALISASI_URL.includes("?")
            ? "&"
            : "?";


    const url =
        CONFIG.INPUT_REALISASI_URL +
        separator +
        "action=list";


    const response = await fetch(
        url,
        {
            cache: "no-store"
        }
    );


    if (!response.ok) {

        throw new Error(
            "Gagal mengambil INPUT_REALISASI. HTTP " +
            response.status
        );

    }


    const text =
        await response.text();


    let payload;

    try {

        payload =
            JSON.parse(
                text
            );

    } catch (error) {

        throw new Error(
            "Respons INPUT_REALISASI bukan JSON yang valid."
        );

    }


    if (
        !payload ||
        payload.success !== true
    ) {

        throw new Error(
            payload?.message ||
            "Endpoint INPUT_REALISASI mengembalikan respons gagal."
        );

    }


    return Array.isArray(
        payload.data
    )

        ? payload.data

        : [];

}


// ============================================================
// AMBIL DATA GOOGLE SHEET
// ============================================================

async function fetchSheetData() {

    try {

        console.log("=== MENGAMBIL DATA GOOGLE SHEET ===");

        if (
            typeof CONFIG === "undefined" ||
            !CONFIG.SHEET_URL
        ) {
            throw new Error(
                "CONFIG.SHEET_URL belum tersedia. Periksa config.js"
            );
        }


        const [
            response,
            inputRealisasi
        ] = await Promise.all(
            [
                fetch(
                    CONFIG.SHEET_URL,
                    {
                        cache: "no-store"
                    }
                ),

                fetchInputRealisasi()
            ]
        );


        if (!response.ok) {

            throw new Error(
                "Gagal mengambil Google Sheet. HTTP " +
                response.status
            );

        }


        const csv = await response.text();


        if (!csv) {

            throw new Error(
                "Google Sheet mengembalikan data kosong."
            );

        }


        const data = csvToArray(csv);


        // Transaksi tambahan disimpan sebagai metadata pada array raw.
        // Bentuk utama tetap Array agar seluruh halaman lama tidak perlu
        // diubah. parser.js akan menggabungkannya berdasarkan INDEX_RECORD.
        data.__inputRealisasi =
            inputRealisasi;


        console.log(
            "JUMLAH BARIS GOOGLE SHEET:",
            data.length
        );

        console.log(
            "JUMLAH TRANSAKSI INPUT_REALISASI:",
            inputRealisasi.length
        );


        return data;


    } catch (error) {

        console.error(
            "ERROR FETCH GOOGLE SHEET:",
            error
        );

        throw error;

    }

}


// ============================================================
// GET DATA UNTUK DASHBOARD
// ============================================================

async function getSheetData() {

    return await fetchSheetData();

}


// ============================================================
// GET DATA UNTUK MONITORING
// ============================================================

async function getSheetDataMonitoring() {

    return await fetchSheetData();

}


// ============================================================
// CSV TO ARRAY
//
// Parser CSV internal.
// Tidak lagi membutuhkan Papa Parse.
//
// Mendukung:
// - koma
// - tanda kutip
// - koma di dalam tanda kutip
// - line break
// ============================================================

function csvToArray(csv) {

    const rows = [];

    let row = [];
    let field = "";

    let insideQuotes = false;


    for (
        let i = 0;
        i < csv.length;
        i++
    ) {

        const char =
            csv[i];

        const nextChar =
            csv[i + 1];


        // ====================================================
        // TANDA KUTIP
        // ====================================================

        if (char === '"') {

            // Quote ganda di dalam quoted field
            if (
                insideQuotes &&
                nextChar === '"'
            ) {

                field += '"';

                i++;

            } else {

                insideQuotes =
                    !insideQuotes;

            }

            continue;

        }


        // ====================================================
        // PEMISAH KOLOM
        // ====================================================

        if (
            char === "," &&
            !insideQuotes
        ) {

            row.push(field);

            field = "";

            continue;

        }


        // ====================================================
        // BARIS BARU
        // ====================================================

        if (
            (char === "\n" ||
             char === "\r") &&
            !insideQuotes
        ) {

            // CRLF
            if (
                char === "\r" &&
                nextChar === "\n"
            ) {

                i++;

            }


            row.push(field);

            field = "";


            // Jangan masukkan baris kosong total
            const adaIsi =
                row.some(
                    value =>
                        String(value)
                            .trim() !== ""
                );


            if (adaIsi) {

                rows.push(row);

            }


            row = [];

            continue;

        }


        // ====================================================
        // KARAKTER NORMAL
        // ====================================================

        field += char;

    }


    // ========================================================
    // BARIS TERAKHIR
    // ========================================================

    if (
        field !== "" ||
        row.length > 0
    ) {

        row.push(field);


        const adaIsi =
            row.some(
                value =>
                    String(value)
                        .trim() !== ""
            );


        if (adaIsi) {

            rows.push(row);

        }

    }


    return rows;

}