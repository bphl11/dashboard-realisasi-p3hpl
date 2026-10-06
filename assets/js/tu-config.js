// ============================================================
// TU CONFIGURATION
// Modul TU dipisahkan dari frontend RPD P3HPL.
// Backend TU menggunakan Apps Script yang sama, tetapi client/API
// dan namespace sesi dibuat terpisah.
// ============================================================

const TU_CONFIG = {
    GOOGLE_CLIENT_ID:
        "443412026871-pqoa9tskrfkaffp5u2ohjhtq1l0ds2r1.apps.googleusercontent.com",

    // KHUSUS TESTING — menggunakan deployment /dev.
    // Jangan digunakan sebagai URL produksi.
    TU_API_URL:
        "https://script.google.com/macros/s/AKfycbzKYuVKhAna1TQNkhp-f9XRYYx9E34nLBkPlfIchVb2/dev",

    APP_NAME: "TU BPHL XI Banjarbaru",

    TAHUN_DEFAULT: 2026
};
