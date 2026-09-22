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

    const parseResponse = async (response) => {
        const text = await response.text();
        let result = null;

        try {
            result = JSON.parse(text);
        } catch (e) {
            if (!response.ok) {
                throw new Error(
                    "API RPD mengembalikan HTTP " + response.status +
                    ". Respons bukan JSON."
                );
            }
            throw new Error("Respons API RPD bukan JSON yang valid.");
        }

        if (!response.ok) {
            const message = result?.message || (
                "API RPD mengembalikan HTTP " + response.status
            );
            throw new Error(message);
        }

        if (result?.ok === false) {
            const message = result.message || "Permintaan RPD ditolak.";
            if (/token.*(valid|kadaluarsa|kedaluwarsa)|kedaluwarsa.*token|sesi.*(berakhir|kadaluarsa|kedaluwarsa)/i.test(message)) {
                handleAuthExpired();
            }
            throw new Error(message);
        }

        return result;
    };

    // ========================================================
    // AUTH
    // ========================================================
    // Jangan gunakan GET + id_token di query string.
    //
    // Google Apps Script ContentService mengirim response melalui
    // redirect ke script.googleusercontent.com. Untuk request dari
    // GitHub Pages, gunakan POST sederhana (text/plain) + redirect
    // follow agar tidak memicu CORS preflight dan agar token tidak
    // ditaruh di URL.
    if (action === "auth") {
        const body = JSON.stringify({
            action: "auth",
            id_token: String(payload.id_token || "")
        });

        const response = await fetch(RPD_CONFIG.RPD_API_URL, {
            method: "POST",
            headers: {
                "Content-Type": "text/plain;charset=utf-8"
            },
            body,
            redirect: "follow",
            credentials: "omit",
            cache: "no-store"
        });

        return await parseResponse(response);
    }

    // ========================================================
    // BOOTSTRAP / LIST / SAVE
    // ========================================================
    // Tetap gunakan POST sederhana. Jangan menggunakan
    // application/json karena dapat memicu OPTIONS preflight.
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
        credentials: "omit",
        cache: "no-store"
    });

    return await parseResponse(response);
}
