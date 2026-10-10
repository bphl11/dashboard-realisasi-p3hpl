// ============================================================
// TU API CLIENT
// Read-only UI tahap pertama. Endpoint write tetap tersedia di
// client layer untuk tahap implementasi berikutnya, tetapi
// halaman tu.html saat ini tidak memanggil endpoint write.
// ============================================================

const TU_API_ACTIONS = new Set([
    "tu_bootstrap",
    "tu_realisasi_list",
    "tu_realisasi_save",
    "tu_realisasi_update",
    "tu_realisasi_delete",
    "tu_rpd_list",
    "tu_rpd_save",
    "tu_revisi_list",
    "tu_revisi_save",
    "tu_monitoring"
]);

function tuGetApiUrl() {
    const url = String(TU_CONFIG?.TU_API_URL || "").trim();
    if (!url) {
        throw new Error("TU_API_URL belum dikonfigurasi.");
    }
    return url;
}

function tuHandleAuthExpired() {
    if (typeof tuClearSession === "function") {
        tuClearSession();
    }

    if (typeof tuShowLogin === "function") {
        tuShowLogin();
    }

    if (typeof tuShowMessage === "function") {
        tuShowMessage(
            "Sesi Google TU sudah kedaluwarsa. Silakan login Google kembali.",
            "warning"
        );
    }
}

function tuParseApiResponse(response, text) {
    let result = null;

    try {
        result = JSON.parse(text);
    } catch (error) {
        if (!response.ok) {
            throw new Error(
                "API TU mengembalikan HTTP " +
                response.status +
                ". Respons bukan JSON."
            );
        }

        throw new Error("Respons API TU bukan JSON yang valid.");
    }

    if (!response.ok) {
        throw new Error(
            result?.message ||
            ("API TU mengembalikan HTTP " + response.status)
        );
    }

    if (result?.ok === false) {
        const message =
            result.message ||
            "Permintaan TU ditolak.";

        if (
            /token.*(valid|kadaluarsa|kedaluwarsa)|kedaluwarsa.*token|sesi.*(berakhir|kadaluarsa|kedaluwarsa)/i.test(message)
        ) {
            tuHandleAuthExpired();
        }

        throw new Error(message);
    }

    return result;
}

async function tuApiRequest(action, payload = {}) {
    const normalizedAction =
        String(action || "")
            .trim()
            .toLowerCase();

    if (!TU_API_ACTIONS.has(normalizedAction)) {
        throw new Error(
            "Action TU tidak dikenal: " + normalizedAction
        );
    }

    const idToken =
        typeof tuGetIdToken === "function"
            ? tuGetIdToken()
            : "";

    if (!idToken) {
        tuHandleAuthExpired();

        throw new Error(
            "Sesi login TU tidak ditemukan. Silakan login Google kembali."
        );
    }

    const body = JSON.stringify({
        action: normalizedAction,
        id_token: idToken,
        ...payload
    });

    const response = await fetch(
        tuGetApiUrl(),
        {
            method: "POST",
            headers: {
                "Content-Type":
                    "text/plain;charset=utf-8"
            },
            body,
            redirect: "follow",
            credentials: "omit",
            cache: "no-store"
        }
    );

    const text = await response.text();

    return tuParseApiResponse(
        response,
        text
    );
}
