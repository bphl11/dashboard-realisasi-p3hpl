const REVISI_DRAFT_KEY = "p3hpl_revisi_anggaran_draft_v1";
let revisiStore = null;
let revisiRows = [];
let revisiFilteredRows = [];
let revisiDraft = { version: 1, status: "DRAFT", changes: {}, deletions: [], additions: [], updatedAt: null };

const rupiah = value => "Rp" + (Number(value) || 0).toLocaleString("id-ID");
const num = value => { const n = Number(String(value ?? "").replace(/[^0-9.-]/g, "")); return Number.isFinite(n) ? n : 0; };
const esc = value => String(value ?? "").replace(/[&<>"']/g, s => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#039;" }[s]));
const norm = value => String(value ?? "").trim();

function hi(map, aliases) {
    return typeof indeksHeaderDataAplikasi === "function" ? indeksHeaderDataAplikasi(map, aliases) : -1;
}
function hv(row, map, aliases) {
    const index = hi(map, aliases);
    return index >= 0 ? String(row[index] ?? "").trim() : "";
}
function hn(row, map, aliases) {
    return typeof angkaDataAplikasi === "function" ? angkaDataAplikasi(hv(row, map, aliases)) : num(hv(row, map, aliases));
}

function buildRows(raw) {
    const context = typeof konteksDataAplikasi === "function" ? konteksDataAplikasi(raw) : null;
    if (!context) return [];

    const rows = [];
    let currentAkunCode = "";
    let currentAkunName = "";

    for (let i = context.headerIndex + 1; i < raw.length; i++) {
        const row = Array.isArray(raw[i]) ? raw[i] : [];
        if (!row.some(value => norm(value) !== "")) continue;

        const kode = hv(row, context.map, ["Kode"]);
        const kodeAkun = hv(row, context.map, ["Kode Akun", "KodeAkun", "Kode Rekening", "Kode Rekening Belanja"]);
        const komponen = hv(row, context.map, ["Komponen", "Nama Komponen"]);
        const subKomponen = hv(row, context.map, ["Sub Komponen", "Subkomponen", "Nama Sub Komponen"]);
        const akun = hv(row, context.map, ["Akun Belanja", "Akun"]);

        // Pada DATA_APLIKASI, kode akun sering berada pada baris header akun
        // (mis. 521211) sedangkan baris detail di bawahnya kosong.
        // Karena itu kode akun harus diwariskan ke seluruh detail di bawahnya.
        const kodeAkunBaris = kodeAkun || (/^\\d{6}$/.test(kode) ? kode : "");
        if (kodeAkunBaris || akun) {
            if (kodeAkunBaris) currentAkunCode = kodeAkunBaris;
            if (akun) currentAkunName = akun;
        }

        const inheritedCode = currentAkunCode || kode;
        const inheritedAkun = akun || currentAkunName;
        const itemAkun = hv(row, context.map, ["Item Akun", "Item"]);
        const detil = hv(row, context.map, ["Detil Akun", "Detail Akun", "Detil"]);
        const rincian = hv(row, context.map, ["Rincian Item", "Rincian"]);
        const uraian = rincian || detil || itemAkun || inheritedAkun || subKomponen || komponen || inheritedCode;

        rows.push({
            rowIndex: i,
            kode: inheritedCode,
            kodeAkun: currentAkunCode,
            komponen,
            subKomponen,
            akun: inheritedAkun,
            akunLabel: currentAkunCode ? (currentAkunCode + " " + inheritedAkun) : inheritedAkun,
            itemAkun,
            detil,
            rincian,
            uraian,
            volume: hn(row, context.map, ["Volume", "Vol"]),
            satuan: hv(row, context.map, ["Satuan", "Sat"]),
            harga: hn(row, context.map, ["Harga Satuan", "Harga"]),
            jumlah: hn(row, context.map, ["Jumlah", "Pagu"]),
            tahun: hv(row, context.map, ["Tahun", "Tahun Anggaran"])
        });
    }
    return rows;
}
function loadDraft() {
    try {
        const raw = localStorage.getItem(REVISI_DRAFT_KEY);
        if (!raw) return;
        const parsed = JSON.parse(raw);
        if (parsed && parsed.version === 1) {
            revisiDraft = {
                ...revisiDraft,
                ...parsed,
                changes: parsed.changes || {},
                deletions: Array.isArray(parsed.deletions) ? parsed.deletions : [],
                additions: Array.isArray(parsed.additions) ? parsed.additions : []
            };
        }
    } catch (error) {
        console.warn("Draft revisi tidak dapat dibaca:", error);
    }
}

function saveDraft() {
    revisiDraft.updatedAt = new Date().toISOString();
    try {
        localStorage.setItem(REVISI_DRAFT_KEY, JSON.stringify(revisiDraft));
        setStatus("Draft tersimpan di browser.", "ok");
    } catch (error) {
        setStatus("Draft gagal disimpan: " + error.message, "danger");
    }
}

function clearDraft() {
    revisiDraft = { version:1, status:"DRAFT", changes:{}, deletions:[], additions:[], updatedAt:null };
    localStorage.removeItem(REVISI_DRAFT_KEY);
    render();
    setStatus("Draft dikosongkan. DATA_APLIKASI tidak berubah.", "ok");
}

function uniq(values) {
    return [...new Set(values.filter(value => norm(value) !== ""))].sort((a,b) => a.localeCompare(b, "id"));
}

function fillSelect(id, values, placeholder, current) {
    const element = document.getElementById(id);
    const old = current ?? element.value;
    element.innerHTML = '<option value="">' + esc(placeholder) + "</option>" +
        values.map(value => '<option value="' + esc(value) + '">' + esc(value) + "</option>").join("");
    if (values.includes(old)) element.value = old;
}

function filters() {
    return {
        tahun: document.getElementById("filterTahun").value,
        komponen: document.getElementById("filterKomponen").value,
        subKomponen: document.getElementById("filterSubKomponen").value,
        akun: document.getElementById("filterAkun").value
    };
}

function refreshFilters() {
    const f = filters();
    fillSelect("filterTahun", uniq(revisiRows.map(row => row.tahun)), "-- Semua Tahun --", f.tahun);

    const byYear = revisiRows.filter(row => !filterTahun.value || row.tahun === filterTahun.value);
    fillSelect("filterKomponen", uniq(byYear.map(row => row.komponen)), "-- Semua Komponen --", f.komponen);

    const byComponent = byYear.filter(row => !filterKomponen.value || row.komponen === filterKomponen.value);
    fillSelect("filterSubKomponen", uniq(byComponent.map(row => row.subKomponen)), "-- Semua Sub Komponen --", f.subKomponen);

    const bySubKomponen = byComponent.filter(row => !filterSubKomponen.value || row.subKomponen === filterSubKomponen.value);
    fillSelect("filterAkun", uniq(bySubKomponen.map(row => row.akunLabel)), "-- Semua Akun Belanja --", f.akun);
}

function filteredRows() {
    const f = filters();
    return revisiRows.filter(row =>
        (!f.tahun || row.tahun === f.tahun) &&
        (!f.komponen || row.komponen === f.komponen) &&
        (!f.subKomponen || row.subKomponen === f.subKomponen) &&
        (!f.akun || row.akunLabel === f.akun)
    );
}

function effectiveRow(row) {
    const change = revisiDraft.changes[String(row.rowIndex)];
    return change ? { ...row, ...change, jumlah: num(change.volume) * num(change.harga) } : { ...row };
}

function isDeleted(row) {
    return revisiDraft.deletions.includes(row.rowIndex);
}

function render() {
    revisiFilteredRows = filteredRows();
    const beforeBody = document.getElementById("beforeBody");
    const afterBody = document.getElementById("afterBody");

    if (!revisiFilteredRows.length) {
        beforeBody.innerHTML = '<tr><td colspan="7" class="empty-cell">Tidak ada data sesuai filter.</td></tr>';
        afterBody.innerHTML = '<tr><td colspan="8" class="empty-cell">Tidak ada data sesuai filter.</td></tr>';
    } else {
        beforeBody.innerHTML = revisiFilteredRows.map(row =>
            '<tr><td>' + esc(row.kode) + '</td><td>' + esc(row.akunLabel) + '</td><td>' + esc(row.uraian) + '</td><td>' +
            esc(row.volume) + '</td><td>' + esc(row.satuan) + '</td><td class="text-end">' +
            rupiah(row.harga) + '</td><td class="text-end">' + rupiah(row.jumlah) + '</td></tr>'
        ).join("");

        afterBody.innerHTML = revisiFilteredRows.map(row => {
            const effective = effectiveRow(row);
            const changed = Boolean(revisiDraft.changes[String(row.rowIndex)]);
            const deleted = isDeleted(row);

            return '<tr class="' + (deleted ? "deleted" : changed ? "changed" : "") + '">' +
                '<td>' + esc(effective.kode) + '</td><td>' + esc(effective.akunLabel) + '</td><td><input class="edit-input uraian-input" data-row="' + row.rowIndex + '" data-field="uraian" value="' + esc(effective.uraian) + '" ' + (deleted ? "disabled" : "") + '></td>' +
                '<td><input class="edit-input" type="number" min="0" step="0.01" data-row="' + row.rowIndex +
                '" data-field="volume" value="' + esc(effective.volume) + '" ' + (deleted ? "disabled" : "") + '></td>' +
                '<td><input class="edit-input" data-row="' + row.rowIndex + '" data-field="satuan" value="' +
                esc(effective.satuan) + '" ' + (deleted ? "disabled" : "") + '></td>' +
                '<td><input class="edit-input money" type="number" min="0" data-row="' + row.rowIndex +
                '" data-field="harga" value="' + esc(effective.harga) + '" ' + (deleted ? "disabled" : "") + '></td>' +
                '<td class="text-end fw-bold">' + rupiah(effective.jumlah) + '</td>' +
                '<td class="action-cell"><button class="btn-icon delete" data-action="delete" data-row="' +
                row.rowIndex + '"><i class="bi ' + (deleted ? "bi-arrow-counterclockwise" : "bi-trash") + '"></i></button></td></tr>';
        }).join("");
    }

    const additions = revisiDraft.additions.filter(item => !item.deleted);
    if (additions.length) {
        afterBody.innerHTML += additions.map(item =>
            '<tr class="added"><td>' + esc(item.kode) + '</td><td>' + esc(item.akunLabel || item.akun || '') + '</td><td>' + esc(item.uraian) + '</td><td>' +
            esc(item.volume) + '</td><td>' + esc(item.satuan) + '</td><td class="text-end">' +
            rupiah(item.harga) + '</td><td class="text-end fw-bold">' + rupiah(item.volume * item.harga) +
            '</td><td class="action-cell"><button class="btn-icon delete" data-action="delete-add" data-id="' +
            esc(item.id) + '"><i class="bi bi-trash"></i></button></td></tr>'
        ).join("");
    }

    const before = revisiFilteredRows.reduce((sum, row) => sum + (isDeleted(row) ? 0 : num(row.jumlah)), 0);
    const after = revisiFilteredRows.reduce((sum, row) => sum + (isDeleted(row) ? 0 : num(effectiveRow(row).jumlah)), 0) +
        additions.reduce((sum, item) => sum + num(item.volume) * num(item.harga), 0);
    const diff = after - before;

    document.getElementById("summaryBefore").textContent = rupiah(before);
    document.getElementById("summaryAfter").textContent = rupiah(after);
    document.getElementById("summaryDiff").textContent = (diff >= 0 ? "+" : "-") + rupiah(Math.abs(diff));
    document.getElementById("summaryDiff").className = diff > 0 ? "text-danger" : diff < 0 ? "text-success" : "";
    document.getElementById("beforeCount").textContent = revisiFilteredRows.length + " item";
    document.getElementById("afterCount").textContent = (revisiFilteredRows.length + additions.length) + " item";
}

function setStatus(message, type) {
    const element = document.getElementById("revisiDataStatus");
    element.textContent = message;
    element.className = "status-pill " + (type === "ok" ? "status-ok" : type === "danger" ? "status-danger" : type === "warning" ? "status-warning" : "status-loading");
}

async function init() {
    loadDraft();
    setStatus("Memuat APP_STORE...", "loading");

    try {
        revisiStore = await window.appStore.get();
        if (!revisiStore?.rawData) throw new Error("APP_STORE belum tersedia.");

        revisiRows = buildRows(revisiStore.rawData);
        refreshFilters();
        render();
        setStatus("DATA_APLIKASI siap · Draft lokal aktif", "ok");
    } catch (error) {
        console.error(error);
        setStatus(error.message || "Gagal memuat data.", "danger");
    }
}

document.addEventListener("input", event => {
    const input = event.target;
    if (!input.matches(".edit-input")) return;

    const row = revisiRows.find(item => item.rowIndex === Number(input.dataset.row));
    if (!row) return;

    const change = {
        volume: effectiveRow(row).volume,
        satuan: effectiveRow(row).satuan,
        harga: effectiveRow(row).harga
    };
    change[input.dataset.field] = input.dataset.field === "uraian" || input.dataset.field === "satuan" ? input.value : num(input.value);

    if (change.uraian === row.uraian && change.volume === row.volume && change.satuan === row.satuan && change.harga === row.harga) {
        delete revisiDraft.changes[String(row.rowIndex)];
    } else {
        revisiDraft.changes[String(row.rowIndex)] = change;
    }
    render();
});

document.addEventListener("click", event => {
    const button = event.target.closest("[data-action]");
    if (!button) return;

    if (button.dataset.action === "delete") {
        const rowIndex = Number(button.dataset.row);
        const index = revisiDraft.deletions.indexOf(rowIndex);
        if (index >= 0) revisiDraft.deletions.splice(index, 1);
        else revisiDraft.deletions.push(rowIndex);
        render();
    }

    if (button.dataset.action === "delete-add") {
        revisiDraft.additions = revisiDraft.additions.map(item =>
            item.id === button.dataset.id ? { ...item, deleted: true } : item
        );
        render();
    }
});

["filterTahun", "filterKomponen", "filterSubKomponen", "filterAkun"].forEach(id => {
    document.getElementById(id).addEventListener("change", () => {
        refreshFilters();
        render();
    });
});

document.getElementById("btnSimpanDraft").addEventListener("click", saveDraft);
document.getElementById("btnResetDraft").addEventListener("click", () => {
    if (confirm("Hapus seluruh perubahan draft? DATA_APLIKASI tetap aman.")) clearDraft();
});

document.getElementById("addVol").addEventListener("input", updateAddJumlah);
document.getElementById("addHarga").addEventListener("input", updateAddJumlah);

function updateAddJumlah() {
    document.getElementById("addJumlah").value =
        rupiah(num(document.getElementById("addVol").value) * num(document.getElementById("addHarga").value));
}

document.getElementById("btnTambahItem").addEventListener("click", () => {
    addKode.value = "";
    addUraian.value = "";
    addVol.value = 1;
    addSat.value = "";
    addHarga.value = 0;
    updateAddJumlah();
    bootstrap.Modal.getOrCreateInstance(document.getElementById("modalTambahItem")).show();
});

document.getElementById("btnTambahkanItem").addEventListener("click", () => {
    const item = {
        id: "ADD-" + Date.now(),
        kode: norm(addKode.value),
        akun: norm(document.getElementById("addAkun")?.value || ""),
        akunLabel: norm(document.getElementById("addAkun")?.value || ""),
        uraian: norm(addUraian.value),
        volume: num(addVol.value),
        satuan: norm(addSat.value),
        harga: num(addHarga.value)
    };

    if (!item.uraian) return alert("Uraian wajib diisi.");
    if (item.volume <= 0) return alert("Volume harus lebih besar dari 0.");

    revisiDraft.additions.push(item);
    bootstrap.Modal.getOrCreateInstance(document.getElementById("modalTambahItem")).hide();
    render();
    setStatus("Item ditambahkan ke draft. Belum mengubah DATA_APLIKASI.", "warning");
});

document.addEventListener("DOMContentLoaded", init);
window.addEventListener("pageshow", event => { if (event.persisted) location.reload(); });
