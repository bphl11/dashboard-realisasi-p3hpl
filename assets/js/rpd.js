// ============================================================
// RPD MODULE
// Input RPD per triwulan pada level Detil Akun.
// ============================================================

let rpdUser = null;
let rpdMasterRows = [];
let rpdExisting = [];
let rpdCurrentSelection = null;

const RPD_EMPTY = {
    tw1: 0, tw2: 0, tw3: 0, tw4: 0, catatan: ""
};

function rpdFormatRupiah(value) {
    return "Rp" + Math.round(Number(value) || 0).toLocaleString("id-ID");
}

function rpdNumber(value) {
    if (value === null || value === undefined || value === "") return 0;
    if (typeof value === "number") return Number.isFinite(value) ? value : 0;
    const text = String(value).replace(/Rp/gi, "").replace(/\./g, "").replace(/,/g, "").replace(/[^0-9-]/g, "");
    return Number(text) || 0;
}

function rpdEsc(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;").replace(/</g, "&lt;")
        .replace(/>/g, "&gt;").replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function rpdSetLoading(show, text = "Memuat data RPD...") {
    const el = document.getElementById("rpdLoading");
    if (!el) return;
    el.textContent = text;
    el.classList.toggle("d-none", !show);
}

function rpdSetStatus(message, type = "info") {
    const el = document.getElementById("rpdStatus");
    if (!el) return;
    el.className = "alert alert-" + type;
    el.textContent = message;
    el.classList.remove("d-none");
}

function rpdHideStatus() {
    document.getElementById("rpdStatus")?.classList.add("d-none");
}

function rpdPopulateSelect(id, values, placeholder) {
    const select = document.getElementById(id);
    if (!select) return;
    const current = select.value;
    select.innerHTML = '<option value="">' + rpdEsc(placeholder) + '</option>';
    values.forEach(value => {
        select.insertAdjacentHTML("beforeend", '<option value="' + rpdEsc(value) + '">' + rpdEsc(value) + '</option>');
    });
    if (values.includes(current)) select.value = current;
}

function rpdUniqueSorted(rows, key) {
    return [...new Set(rows.map(r => String(r?.[key] ?? "").trim()).filter(Boolean))]
        .sort((a, b) => a.localeCompare(b, "id"));
}

function rpdGetFilteredRows() {
    const sub = document.getElementById("rpdSubKomponen")?.value || "";
    const akun = document.getElementById("rpdAkun")?.value || "";

    // Akun dan Detil baru boleh ditampilkan setelah Sub Komponen dipilih.
    // Ini mencegah halaman langsung menampilkan satu akun saja
    // (misalnya Belanja Perjalanan Dinas Biasa) sebelum filter dipilih.
    if (!sub) return [];

    return rpdMasterRows.filter(row =>
        row.subKomponen === sub &&
        (!akun || row.akun === akun)
    );
}

function rpdRefreshFilters() {
    const subSelect = document.getElementById("rpdSubKomponen");
    const akunSelect = document.getElementById("rpdAkun");
    const subValue = subSelect?.value || "";
    const akunValue = akunSelect?.value || "";

    const subs = rpdUniqueSorted(rpdMasterRows, "subKomponen");
    rpdPopulateSelect("rpdSubKomponen", subs, "Pilih Sub Komponen");

    if (subSelect && subs.includes(subValue)) {
        subSelect.value = subValue;
    } else if (subSelect) {
        subSelect.value = "";
    }

    // Jangan tampilkan akun sebelum Sub Komponen dipilih.
    if (!subValue) {
        rpdPopulateSelect("rpdAkun", [], "Pilih Akun Belanja");
        return;
    }

    const filteredBySub = rpdMasterRows.filter(r => r.subKomponen === subValue);
    const akuns = rpdUniqueSorted(filteredBySub, "akun");
    rpdPopulateSelect("rpdAkun", akuns, "Pilih Akun Belanja");

    if (akunSelect && akuns.includes(akunValue)) {
        akunSelect.value = akunValue;
    } else if (akunSelect) {
        akunSelect.value = "";
    }
}

function rpdRenderDetilTable() {
    const tbody = document.getElementById("rpdTableBody");
    if (!tbody) return;

    const rows = rpdGetFilteredRows();
    const byId = new Map(rpdExisting.map(r => [String(r.id_rpd), r]));

    if (!rows.length) {
        tbody.innerHTML = '<tr><td colspan="8" class="text-center text-muted py-4">Pilih Sub Komponen dan/atau Akun untuk menampilkan Detil.</td></tr>';
        return;
    }

    tbody.innerHTML = rows.map(row => {
        const saved = byId.get(String(row.id_rpd)) || RPD_EMPTY;
        const total = [saved.tw1, saved.tw2, saved.tw3, saved.tw4].reduce((a,b) => a + rpdNumber(b), 0);
        const sisa = Math.max(rpdNumber(row.pagu) - total, 0);
        const status = total > rpdNumber(row.pagu) ? "Melebihi Pagu" : (total === rpdNumber(row.pagu) ? "Sesuai Pagu" : "Belum Lengkap");

        return '<tr>' +
            '<td><strong>' + rpdEsc(row.akun) + '</strong><div class="small text-muted">' + rpdEsc(row.detilAkun) + '</div></td>' +
            '<td class="text-end">' + rpdFormatRupiah(row.pagu) + '</td>' +
            '<td class="text-end">' + rpdFormatRupiah(saved.tw1) + '</td>' +
            '<td class="text-end">' + rpdFormatRupiah(saved.tw2) + '</td>' +
            '<td class="text-end">' + rpdFormatRupiah(saved.tw3) + '</td>' +
            '<td class="text-end">' + rpdFormatRupiah(saved.tw4) + '</td>' +
            '<td class="text-end fw-bold">' + rpdFormatRupiah(total) + '</td>' +
            '<td class="text-end">' + rpdFormatRupiah(sisa) + '</td>' +
            '<td><button class="btn btn-sm btn-success" onclick="rpdOpenEditor(' + JSON.stringify(row.id_rpd) + ')"><i class="bi bi-pencil-square"></i> Input/Edit</button></td>' +
            '</tr>';
    }).join("");
}

function rpdOpenEditor(id) {
    const row = rpdMasterRows.find(r => String(r.id_rpd) === String(id));
    if (!row) return;

    const saved = rpdExisting.find(r => String(r.id_rpd) === String(id)) || RPD_EMPTY;
    rpdCurrentSelection = row;

    document.getElementById("rpdEditId").value = row.id_rpd;
    document.getElementById("rpdEditLabel").textContent = row.detilAkun || "-";
    document.getElementById("rpdEditSub").textContent = row.subKomponen || "-";
    document.getElementById("rpdEditAkun").textContent = row.akun || "-";
    document.getElementById("rpdEditPagu").textContent = rpdFormatRupiah(row.pagu);
    document.getElementById("rpdTw1").value = rpdNumber(saved.tw1) || "";
    document.getElementById("rpdTw2").value = rpdNumber(saved.tw2) || "";
    document.getElementById("rpdTw3").value = rpdNumber(saved.tw3) || "";
    document.getElementById("rpdTw4").value = rpdNumber(saved.tw4) || "";
    document.getElementById("rpdCatatan").value = saved.catatan || "";

    rpdUpdateEditorTotal();
    new bootstrap.Modal(document.getElementById("rpdEditorModal")).show();
}

function rpdUpdateEditorTotal() {
    const values = ["rpdTw1","rpdTw2","rpdTw3","rpdTw4"].map(id => rpdNumber(document.getElementById(id)?.value));
    const total = values.reduce((a,b) => a+b, 0);
    const pagu = rpdNumber(rpdCurrentSelection?.pagu);
    const valid = total <= pagu;

    document.getElementById("rpdEditTotal").textContent = rpdFormatRupiah(total);
    document.getElementById("rpdEditSisa").textContent = rpdFormatRupiah(Math.max(pagu-total, 0));

    const state = document.getElementById("rpdEditValidation");
    state.className = "small mt-2 " + (valid ? "text-success" : "text-danger");
    state.textContent = valid ? "Valid: total RPD tidak melebihi pagu." : "Tidak valid: total RPD melebihi pagu.";
    document.getElementById("rpdSaveButton").disabled = !valid;
}

async function rpdSave() {
    if (!rpdCurrentSelection || !rpdUser) return;

    const payload = {
        id_rpd: rpdCurrentSelection.id_rpd,
        tahun: rpdCurrentSelection.tahun,
        kode_sub_komponen: rpdCurrentSelection.kodeSubKomponen,
        sub_komponen: rpdCurrentSelection.subKomponen,
        akun: rpdCurrentSelection.akun,
        item_akun: rpdCurrentSelection.itemAkun,
        detil_akun: rpdCurrentSelection.detilAkun,
        pagu_detil: rpdCurrentSelection.pagu,
        tw1: rpdNumber(document.getElementById("rpdTw1").value),
        tw2: rpdNumber(document.getElementById("rpdTw2").value),
        tw3: rpdNumber(document.getElementById("rpdTw3").value),
        tw4: rpdNumber(document.getElementById("rpdTw4").value),
        catatan: document.getElementById("rpdCatatan").value.trim()
    };

    const total = payload.tw1 + payload.tw2 + payload.tw3 + payload.tw4;
    if (total > payload.pagu_detil) {
        rpdSetStatus("Total RPD melebihi pagu detil.", "danger");
        return;
    }

    const button = document.getElementById("rpdSaveButton");
    button.disabled = true;
    button.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Menyimpan...';

    try {
        const result = await rpdApiRequest("save", {
            id_token: rpdUser.id_token,
            row: payload
        });

        if (!result.ok) throw new Error(result.message || "Data RPD gagal disimpan.");

        rpdExisting = result.data || rpdExisting;
        bootstrap.Modal.getInstance(document.getElementById("rpdEditorModal"))?.hide();
        rpdRenderDetilTable();
        rpdSetStatus("RPD berhasil disimpan.", "success");
    } catch (error) {
        console.error(error);
        rpdSetStatus(error.message || "RPD gagal disimpan.", "danger");
    } finally {
        button.disabled = false;
        button.innerHTML = '<i class="bi bi-save"></i> Simpan RPD';
    }
}

async function rpdInitData() {
    rpdUser = rpdGetStoredUser();
    if (!rpdUser) return;

    if (!RPD_CONFIG.RPD_API_URL) {
        rpdSetStatus("RPD_API_URL belum dikonfigurasi.", "warning");
        return;
    }

    rpdSetLoading(true);

    try {
        // MASTER RPD harus mengikuti DATA_APLIKASI, bukan daftar akun
        // yang dibentuk terbatas oleh API RPD. Dengan demikian seluruh
        // Akun Belanja (barang, jasa, perjalanan, modal, honor, dll.)
        // dan seluruh Detil Akun yang ada di DATA_APLIKASI ikut muncul.
        const rawData = await getSheetData();
        const parsed = typeof parseDataAplikasi === "function"
            ? (parseDataAplikasi(rawData) || [])
            : [];

        rpdMasterRows = parsed
            .filter(row => row && row.statusPagu !== "Diblokir")
            .filter(row => row.subKomponen && row.subKomponen !== "-")
            .filter(row => row.akun && row.akun !== "-")
            .filter(row => row.detilAkun && row.detilAkun !== "-")
            .map(row => ({
                ...row,
                id_rpd: "RPD-" + String(row.rowIndex),
                tahun: row.tahun || new Date().getFullYear(),
                kodeSubKomponen: row.kodeSubKomponen || row.subKomponen,
                subKomponen: row.subKomponen,
                akun: row.akun,
                itemAkun: row.itemAkun || "",
                detilAkun: row.detilAkun,
                pagu: Number(row.pagu) || 0
            }));

        // API tetap dipakai hanya untuk mengambil RPD yang sudah tersimpan.
        // Jika API master lama masih hanya berisi akun perjalanan, ia tidak
        // lagi membatasi pilihan master pada halaman RPD.
        let result = { rpd: [] };
        try {
            result = await rpdApiRequest("bootstrap", { id_token: rpdUser.id_token });
        } catch (apiError) {
            console.warn("Bootstrap RPD lama gagal, master DATA_APLIKASI tetap digunakan:", apiError);
        }

        rpdExisting = Array.isArray(result.rpd) ? result.rpd : [];

        // Gabungkan data RPD tersimpan yang ID-nya memakai rowIndex lama.
        // Untuk data baru, ID dibuat deterministik dari row DATA_APLIKASI.
        rpdRefreshFilters();
        rpdRenderDetilTable();

        document.getElementById("rpdTotalDetil").textContent =
            rpdMasterRows.length.toLocaleString("id-ID");

        const uniqueExisting = new Set(rpdExisting.map(r => String(r.id_rpd || "")));
        document.getElementById("rpdTotalTerisi").textContent =
            rpdMasterRows.filter(r => uniqueExisting.has(String(r.id_rpd))).length.toLocaleString("id-ID");

        if (!rpdMasterRows.length) {
            rpdSetStatus("DATA_APLIKASI tidak menghasilkan Detil Akun yang dapat digunakan untuk RPD. Periksa kolom Sub Komponen, Akun Belanja, dan Detil Akun.", "warning");
        } else {
            rpdHideStatus();
        }
    } catch (error) {
        console.error(error);
        rpdSetStatus(error.message || "Data RPD gagal dimuat.", "danger");
    } finally {
        rpdSetLoading(false);
    }
}

document.addEventListener("DOMContentLoaded", function () {
    ["rpdTw1","rpdTw2","rpdTw3","rpdTw4"].forEach(id => {
        document.getElementById(id)?.addEventListener("input", rpdUpdateEditorTotal);
    });
    document.getElementById("rpdSubKomponen")?.addEventListener("change", function () {
        // Reset Akun setiap kali Sub Komponen berubah agar seluruh
        // daftar Akun pada Sub Komponen tersebut dimuat ulang.
        const akun = document.getElementById("rpdAkun");
        if (akun) akun.value = "";
        rpdRefreshFilters();
        rpdRenderDetilTable();
    });
    document.getElementById("rpdAkun")?.addEventListener("change", rpdRenderDetilTable);
    document.getElementById("rpdSaveButton")?.addEventListener("click", rpdSave);
});
