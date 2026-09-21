// ============================================================
// RPD API CLIENT
// Semua akses RPD diarahkan ke Google Apps Script.
// Tidak membaca DATA_APLIKASI dari Dashboard.
// ============================================================

async function rpdApiRequest(action, payload = {}) {
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
        body
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
        throw new Error(result.message || "Permintaan RPD ditolak.");
    }

    return result;
}
