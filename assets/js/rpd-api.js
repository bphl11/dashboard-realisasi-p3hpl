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

    // Login Google: gunakan GET agar tidak terkena redirect POST -> GET
    // pada ContentService Google Apps Script.
    // Token hanya dipakai untuk proses autentikasi dan segera divalidasi
    // oleh Apps Script.
    if (action === "auth") {
        const params = new URLSearchParams({
            action: "auth",
            id_token: String(payload.id_token || "")
        });

        const response = await fetch(
            RPD_CONFIG.RPD_API_URL + "?" + params.toString(),
            {
                method: "GET",
                redirect: "follow",
                credentials: "omit",
                cache: "no-store"
            }
        );

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

    const body = JSON.stringify({
        action,
        ...payload
    });

    // POST tetap dipakai untuk bootstrap/list/save karena payload save
    // dapat besar. Redirect POST ContentService tidak digunakan untuk login.
    const response = await fetch(RPD_CONFIG.RPD_API_URL, {
        method: "POST",
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
