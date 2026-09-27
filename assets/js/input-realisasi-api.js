// ============================================================
// INPUT REALISASI API CLIENT
// Menggunakan autentikasi/API RPD yang sudah ada.
// ============================================================

async function realisasiApiRequest(action, payload = {}) {
    return await rpdApiRequest(action, payload);
}

async function realisasiBootstrap() {
    return await realisasiApiRequest("realisasi_bootstrap", {
        id_token: rpdGetStoredUser()?.id_token || ""
    });
}

async function realisasiList() {
    return await realisasiApiRequest("realisasi_list", {
        id_token: rpdGetStoredUser()?.id_token || ""
    });
}

async function realisasiSave(row) {
    return await realisasiApiRequest("realisasi_save", {
        id_token: rpdGetStoredUser()?.id_token || "",
        row
    });
}

async function realisasiUpdate(row) {
    return await realisasiApiRequest("realisasi_update", {
        id_token: rpdGetStoredUser()?.id_token || "",
        row
    });
}


async function realisasiDelete(row) {
    return await realisasiApiRequest("realisasi_delete", {
        id_token: rpdGetStoredUser()?.id_token || "",
        row
    });
}
