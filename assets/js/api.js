// ============================================================
// API.JS
// Mengambil data Google Sheet
// Dipakai oleh Dashboard dan Monitoring
// ============================================================


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


        const response = await fetch(
            CONFIG.SHEET_URL,
            {
                cache: "no-store"
            }
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


        console.log(
            "JUMLAH BARIS GOOGLE SHEET:",
            data.length
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