// ============================================================
// RPD CONFIGURATION
// Modul RPD dipisahkan dari DATA_APLIKASI agar Dashboard lama
// tetap menggunakan mekanisme dan cache yang sama.
// ============================================================

const RPD_CONFIG = {
    // Isi setelah membuat OAuth Client ID tipe Web application.
    GOOGLE_CLIENT_ID: "443412026871-pqoa9tskrfkaffp5u2ohjhtq1l0ds2r1.apps.googleusercontent.com",

    // Isi dengan URL Web App Google Apps Script setelah deploy.
    RPD_API_URL: "https://script.google.com/macros/s/AKfycbxxncp8pn5sF5pGOzErDG2vmHiDWfR0R3_m9QXRUXxfb41R9MqbkLyRmMiE98CmIeth7Q/exec",

    // Cloudflare Worker proxy.
    // Isi setelah Worker dibuat, contoh:
    // https://rpd-proxy.<akun>.workers.dev/rpd
    RPD_PROXY_URL: "",

    // URL Apps Script tetap dipertahankan sebagai upstream/fallback.
    RPD_API_URL: "https://script.google.com/macros/s/AKfycbxxncp8pn5sF5pGOzErDG2vmHiDWfR0R3_m9QXRUXxfb41R9MqbkLyRmMiE98CmIeth7Q/exec",

    // Nama aplikasi/scope sederhana untuk tampilan login.
    APP_NAME: "RPD P3HPL"
};
