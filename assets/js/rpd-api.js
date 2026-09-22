// ============================================================
// RPD API CLIENT
// Semua akses RPD diarahkan ke Google Apps Script.
// Tidak membaca DATA_APLIKASI dari Dashboard.
// ============================================================

async function rpdApiRequest(action, payload = {}) {
    // Credential Google Identity Services (id_token) bersifat sementara.
    // Jika Apps Script menyatakan token kedaluwarsa, jangan biarkan UI
    // terlihat seperti "data hilang". Arahkan pengguna untuk login ulang.
    const handleAuthExpired = () => {
        if (typeof rpdClearStoredUser === "function") rpdClearStoredUser();
        if (typeof rpdShowLogin === "function") rpdShowLogin();
        if (typeof rpdShowMessage === "function") {
            rpdShowMessage("Sesi Google RPD sudah kedaluwarsa. Silakan login Google kembali.", "warning");
        }
        if (typeof rpdInitGoogleLogin === "function") {
            try { rpdInitGoogleLogin(); } catch (e) { console.warn(e); }
        }
    };
    if (!RPD_CONFIG.RPD_API_URL) {
        throw new Error("RPD_API_URL belum dikonfigurasi.");
    }

    const body = JSON.stringify({
        action,
        ...payload
    });

    const response = await fetch(RPD_CONFIG.RPD_API_URL, {
        method: "POST",
        headers: {
            "Content-Type": "text/plain;charset=utf-8"
        },
        body,
        redirect: "follow",
        credentials: "omit"
    });

    if (!response.ok) {
        throw new Error("API RPD mengembalikan HTTP " + response.status);
    }

    const text = await response.text();
    let result;

    try {
        result = JSON.parse(text);
    } catch (e) {
        throw new Error("Respons API RPD bukan JSON yang valid.");
    }

    if (result?.ok === false) {
        const message = result.message || "Permintaan RPD ditolak.";
        if (/token.*(valid|kadaluarsa|kedaluwarsa)|kedaluwarsa.*token|sesi.*(berakhir|kadaluarsa|kedaluwarsa)/i.test(message)) {
            handleAuthExpired();
        }
        throw new Error(message);
    }

    return result;
}
