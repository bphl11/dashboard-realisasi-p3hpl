const REVISI_DRAFT_KEY = "p3hpl_revisi_anggaran_draft_v1";
let revisiStore = null;
let revisiRows = [];
let revisiFilteredRows = [];
let revisiDraft = { version: 2, status: "DRAFT", nomor: "", tanggal: "", pembuat: "", alasan: "", changes: {}, deletions: [], additions: [], updatedAt: null, validation: null, history: [] };

const rupiah = value => "Rp" + (Number(value) || 0).toLocaleString("id-ID");
const num = value => {
    const raw = String(value ?? "").trim().replace(/\s/g, "");
    if (!raw) return 0;

    // Mendukung input Indonesia:
    // 35 -> 35
    // 3,5 -> 3.5
    // 1.500.000 -> 1500000
    // 1.500,5 -> 1500.5
    // 1500.5 -> 1500.5
    let normalized = raw;
    if (raw.includes(",") && raw.includes(".")) {
        normalized = raw.lastIndexOf(",") > raw.lastIndexOf(".")
            ? raw.replace(/\./g, "").replace(",", ".")
            : raw.replace(/,/g, "");
    } else if (raw.includes(",")) {
        normalized = raw.replace(",", ".");
    } else {
        normalized = raw.replace(/,/g, "");
    }

    const n = Number(normalized.replace(/[^0-9.-]/g, ""));
    return Number.isFinite(n) ? n : 0;
};
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
        const itemAkun = hv(row, context.map, ["Item Akun", "Item"]);
        const detil = hv(row, context.map, ["Detil Akun", "Detail Akun", "Detil"]);
        const rincian = hv(row, context.map, ["Rincian Item", "Rincian"]);

        // Kode akun pada DATA_APLIKASI dapat berada pada kolom KODE
        // atau Kode Akun dan kadang tampil bersama teks/format lain.
        // Ambil enam digit pertama yang membentuk kode rekening.
        const kandidatKode = [kodeAkun, kode, akun, itemAkun, detil, rincian]
            .map(value => String(value || "").trim());
        const kodeAkunBaris = kandidatKode
            .map(value => {
                const match = value.match(/(?:^|\D)(\d{6})(?:\D|$)/);
                return match ? match[1] : "";
            })
            .find(Boolean) || "";

        if (kodeAkunBaris || akun) {
            if (kodeAkunBaris) currentAkunCode = kodeAkunBaris;
            if (akun) currentAkunName = akun;
        }

        const inheritedCode = currentAkunCode || kode;
        const inheritedAkun = akun || currentAkunName;
        const uraian = rincian || detil || itemAkun || inheritedAkun || subKomponen || komponen || inheritedCode;

        rows.push({
            rowIndex: i,
            kode: inheritedCode,
            kodeAkun: currentAkunCode,
            komponen,
            subKomponen,
            akun: inheritedAkun,
            akunLabel: inheritedAkun,
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
        if (parsed && (parsed.version === 1 || parsed.version === 2)) {
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

function syncMetadataToDraft() {
    revisiDraft.nomor = norm(document.getElementById("revisiNomor")?.value);
    revisiDraft.tanggal = norm(document.getElementById("revisiTanggal")?.value);
    revisiDraft.pembuat = norm(document.getElementById("revisiPembuat")?.value);
    revisiDraft.alasan = norm(document.getElementById("revisiAlasan")?.value);
}
function calculateBeforeTotal() {
    return filteredRows().filter(row => !isDeleted(row))
        .reduce((sum, row) => sum + num(row.jumlah), 0);
}

function calculateAfterTotal() {
    const existing = filteredRows().filter(row => !isDeleted(row))
        .reduce((sum, row) => sum + num(effectiveRow(row).jumlah), 0);
    const additions = filteredAdditions()
        .reduce((sum, row) => sum + num(row.volume) * num(row.harga), 0);
    return existing + additions;
}

function saveDraft(event) {
    if (event) event.preventDefault();

    syncMetadataToDraft();
    revisiDraft.updatedAt = new Date().toISOString();

    try {
        const historyEntry = {
            at: revisiDraft.updatedAt,
            action: "DRAFT DISIMPAN",
            nomor: revisiDraft.nomor,
            before: calculateBeforeTotal(),
            after: calculateAfterTotal(),
            diff: calculateAfterTotal() - calculateBeforeTotal(),
            errors: []
        };
        revisiDraft.history = [historyEntry, ...(revisiDraft.history || [])].slice(0, 20);

        const serialized = JSON.stringify(revisiDraft);
        localStorage.setItem(REVISI_DRAFT_KEY, serialized);

        const verified = localStorage.getItem(REVISI_DRAFT_KEY);
        if (verified !== serialized) {
            throw new Error("Penyimpanan browser tidak dapat diverifikasi.");
        }

        setStatus("Draft tersimpan di browser.", "ok");
        renderValidationState();
        renderHistory();
    } catch (error) {
        console.error("Simpan Draft gagal:", error);
        setStatus("Draft gagal disimpan: " + error.message, "danger");
    }
}

function clearDraft() {
    revisiDraft = { version:2, status:"DRAFT", nomor:"", tanggal:"", pembuat:"", alasan:"", changes:{}, deletions:[], additions:[], updatedAt:null, validation:null, history:[] };
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

function rowMatchesFilters(row) {
    const f = filters();
    return (!f.tahun || row.tahun === f.tahun) &&
        (!f.komponen || row.komponen === f.komponen) &&
        (!f.subKomponen || row.subKomponen === f.subKomponen) &&
        (!f.akun || row.akunLabel === f.akun);
}

function filteredRows() {
    return revisiRows.filter(row => rowMatchesFilters(row));
}

function filteredAdditions() {
    return revisiDraft.additions.filter(item => !item.deleted && rowMatchesFilters(item));
}

function additionParentContext() {
    const f = filters();
    const source = revisiRows.filter(row =>
        (!f.tahun || row.tahun === f.tahun) &&
        (!f.komponen || row.komponen === f.komponen) &&
        (!f.subKomponen || row.subKomponen === f.subKomponen) &&
        (!f.akun || row.akunLabel === f.akun)
    );
    return source[0] || {};
}

function comparisonEntries() {
    const base = revisiFilteredRows;
    const additions = filteredAdditions();
    const entries = [];

    base.forEach(row => {
        entries.push({ type: "base", row });

        // Item baru ditempatkan setelah seluruh item akun belanja
        // yang sama pada Sub Komponen yang sedang dipilih.
        const isLastSameAccount = !base.some(other =>
            other.rowIndex !== row.rowIndex &&
            other.rowIndex > row.rowIndex &&
            norm(other.kodeAkun || other.kode) === norm(row.kodeAkun || row.kode) &&
            norm(other.akunLabel) === norm(row.akunLabel) &&
            norm(other.subKomponen) === norm(row.subKomponen) &&
            norm(other.komponen) === norm(row.komponen) &&
            norm(other.tahun) === norm(row.tahun)
        );

        if (isLastSameAccount) {
            additions
                .filter(item =>
                    norm(item.kode) === norm(row.kodeAkun || row.kode) &&
                    norm(item.akunLabel || item.akun) === norm(row.akunLabel) &&
                    norm(item.subKomponen) === norm(row.subKomponen) &&
                    norm(item.komponen) === norm(row.komponen) &&
                    norm(item.tahun) === norm(row.tahun)
                )
                .forEach(item => entries.push({ type: "addition", item }));
        }
    });

    // Jika akun baru belum ada di DATA_APLIKASI, letakkan setelah
    // baris terakhir dari Sub Komponen yang sedang dipilih.
    const inserted = new Set(entries.filter(x => x.type === "addition").map(x => x.item.id));
    additions.filter(item => !inserted.has(item.id)).forEach(item => {
        entries.push({ type: "addition", item });
    });

    return entries;
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
                '<td><input class="edit-input numeric-input" type="text" inputmode="decimal" data-row="' + row.rowIndex +
                '" data-field="volume" value="' + esc(effective.volume) + '" ' + (deleted ? "disabled" : "") + '></td>' +
                '<td><input class="edit-input" data-row="' + row.rowIndex + '" data-field="satuan" value="' +
                esc(effective.satuan) + '" ' + (deleted ? "disabled" : "") + '></td>' +
                '<td><input class="edit-input money numeric-input" type="text" inputmode="decimal" data-row="' + row.rowIndex +
                '" data-field="harga" value="' + esc(effective.harga) + '" ' + (deleted ? "disabled" : "") + '></td>' +
                '<td class="text-end fw-bold">' + rupiah(effective.jumlah) + '</td>' +
                '<td class="action-cell"><button class="btn-icon delete" data-action="delete" data-row="' +
                row.rowIndex + '"><i class="bi ' + (deleted ? "bi-arrow-counterclockwise" : "bi-trash") + '"></i></button></td></tr>';
        }).join("");
    }

    const entries = comparisonEntries();
    afterBody.innerHTML = entries.length ? entries.map(entry => {
        if (entry.type === "addition") {
            const item = entry.item;
            return '<tr class="added"><td>' + esc(item.kode) + '</td><td>' + esc(item.akunLabel || item.akun || '') +
                '</td><td>' + esc(item.uraian) + '</td><td>' + esc(item.volume) + '</td><td>' + esc(item.satuan) +
                '</td><td class="text-end">' + rupiah(item.harga) + '</td><td class="text-end fw-bold">' +
                rupiah(num(item.volume) * num(item.harga)) + '</td><td class="action-cell"><button class="btn-icon delete" data-action="delete-add" data-id="' +
                esc(item.id) + '"><i class="bi bi-trash"></i></button></td></tr>';
        }

        const row = entry.row;
        const effective = effectiveRow(row);
        const changed = Boolean(revisiDraft.changes[String(row.rowIndex)]);
        const deleted = isDeleted(row);
        return '<tr class="' + (deleted ? "deleted" : changed ? "changed" : "") + '">' +
            '<td>' + esc(effective.kode) + '</td><td>' + esc(effective.akunLabel) + '</td><td><input class="edit-input uraian-input" data-row="' + row.rowIndex + '" data-field="uraian" value="' + esc(effective.uraian) + '" ' + (deleted ? "disabled" : "") + '></td>' +
            '<td><input class="edit-input numeric-input" type="text" inputmode="decimal" data-row="' + row.rowIndex + '" data-field="volume" value="' + esc(effective.volume) + '" ' + (deleted ? "disabled" : "") + '></td>' +
            '<td><input class="edit-input" data-row="' + row.rowIndex + '" data-field="satuan" value="' + esc(effective.satuan) + '" ' + (deleted ? "disabled" : "") + '></td>' +
            '<td><input class="edit-input money numeric-input" type="text" inputmode="decimal" data-row="' + row.rowIndex + '" data-field="harga" value="' + esc(effective.harga) + '" ' + (deleted ? "disabled" : "") + '></td>' +
            '<td class="text-end fw-bold">' + rupiah(effective.jumlah) + '</td>' +
            '<td class="action-cell"><button class="btn-icon delete" data-action="delete" data-row="' + row.rowIndex + '"><i class="bi ' + (deleted ? "bi-arrow-counterclockwise" : "bi-trash") + '"></i></button></td></tr>';
    }).join("") : '<tr><td colspan="8" class="empty-cell">Tidak ada data sesuai filter.</td></tr>';

    const additions = filteredAdditions();
    const before = revisiFilteredRows.reduce((sum, row) => sum + (isDeleted(row) ? 0 : num(row.jumlah)), 0);
    const after = revisiFilteredRows.reduce((sum, row) => sum + (isDeleted(row) ? 0 : num(effectiveRow(row).jumlah)), 0) +
        additions.reduce((sum, item) => sum + num(item.volume) * num(item.harga), 0);
    const diff = after - before;

    document.getElementById("summaryBefore").textContent = rupiah(before);
    document.getElementById("summaryAfter").textContent = rupiah(after);
    document.getElementById("summaryDiff").textContent = (diff >= 0 ? "+" : "-") + rupiah(Math.abs(diff));
    document.getElementById("summaryDiff").className = diff > 0 ? "text-danger" : diff < 0 ? "text-success" : "";
    document.getElementById("beforeCount").textContent = revisiFilteredRows.length + " item";
    renderValidationState();
    renderHistory();
    document.getElementById("afterCount").textContent = (revisiFilteredRows.filter(row => !isDeleted(row)).length + additions.length) + " item";
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

    // Jangan render ulang saat setiap karakter diketik.
    // Render ulang saat input selesai (blur/change) agar kursor tidak meloncat
    // dan nilai seperti "35" tetap bisa diketik langsung.
    if (input.dataset.field === "uraian" || input.dataset.field === "satuan") {
        input.classList.add("draft-edited");
    } else {
        input.classList.add("draft-edited");
    }
});

document.addEventListener("change", event => {
    const input = event.target;
    if (!input.matches(".edit-input")) return;
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

function validateDraft() {
    syncMetadataToDraft();
    const errors = [];
    if (!revisiDraft.nomor) errors.push("Nomor revisi belum diisi.");
    if (!revisiDraft.tanggal) errors.push("Tanggal revisi belum diisi.");
    if (!revisiDraft.pembuat) errors.push("Pembuat revisi belum diisi.");
    if (!revisiDraft.alasan) errors.push("Alasan revisi belum diisi.");

    // Validasi harus menggunakan ruang lingkup yang sama dengan
    // ringkasan yang sedang tampil (Tahun/Komponen/Sub Komponen/Akun).
    // Sebelumnya validasi memakai seluruh revisiRows sehingga angka validasi
    // bisa berbeda dengan kartu "Jumlah Sebelum/Sesudah".
    const activeRows = filteredRows().filter(row => !isDeleted(row));
    const effectiveRows = activeRows.map(effectiveRow);
    const additions = filteredAdditions();

    const before = activeRows.reduce((s, r) => s + num(r.jumlah), 0);
    const afterExisting = effectiveRows.reduce((s, r) => s + num(r.jumlah), 0);
    const afterAdditions = additions.reduce((s, x) => s + num(x.volume) * num(x.harga), 0);
    const after = afterExisting + afterAdditions;

    const changed = activeRows.filter(row => Boolean(revisiDraft.changes[String(row.rowIndex)])).length +
        activeRows.filter(row => revisiDraft.deletions.includes(row.rowIndex)).length +
        additions.length;

    if (!changed) errors.push("Belum ada perubahan anggaran.");
    if (!Number.isFinite(before) || !Number.isFinite(after)) errors.push("Total anggaran tidak valid.");

    [...effectiveRows, ...additions].forEach((row, index) => {
        const label = row.uraian || ("Item #" + (index + 1));
        if (!norm(row.kode)) errors.push(label + ": kode akun belum diisi.");
        if (!norm(row.akun)) errors.push(label + ": akun belanja belum diisi.");
        if (!norm(row.uraian)) errors.push(label + ": uraian belum diisi.");
        if (!norm(row.satuan)) errors.push(label + ": satuan belum diisi.");
        if (num(row.volume) < 0) errors.push(label + ": volume tidak boleh negatif.");
        if (num(row.harga) < 0) errors.push(label + ": harga tidak boleh negatif.");
    });

    const validatedAt = new Date().toISOString();
    revisiDraft.validation = {
        ok: errors.length === 0,
        errors,
        before,
        after,
        diff: after - before,
        validatedAt
    };
    revisiDraft.status = errors.length ? "DRAFT" : "TERVALIDASI";

    const historyEntry = {
        at: validatedAt,
        action: errors.length ? "VALIDASI GAGAL" : "VALIDASI BERHASIL",
        nomor: revisiDraft.nomor,
        before,
        after,
        diff: after - before,
        errors
    };
    revisiDraft.history = [historyEntry, ...(revisiDraft.history || [])].slice(0, 20);

    localStorage.setItem(REVISI_DRAFT_KEY, JSON.stringify(revisiDraft));
    render();
    renderValidationState();
    renderHistory();

    setStatus(
        errors.length ? errors.join(" ") : "Revisi lolos validasi draft.",
        errors.length ? "warning" : "ok"
    );
}
function renderValidationState() {
    const box=document.getElementById("revisiValidationBox");
    const status=document.getElementById("revisiValidationStatus");
    const v=revisiDraft.validation;
    if(!box||!status) return;
    if(!v){ box.textContent="Validasi: belum dijalankan."; status.textContent="Belum divalidasi"; status.className="status-pill status-warning"; return; }
    box.textContent=v.ok ? "Validasi berhasil. Total sebelum "+rupiah(v.before)+" → sesudah "+rupiah(v.after)+"; selisih "+rupiah(v.diff)+"." : "Validasi gagal: "+v.errors.join(" ");
    status.textContent=v.ok ? "TERVALIDASI" : "PERLU PERBAIKAN";
    status.className="status-pill "+(v.ok ? "status-ok" : "status-danger");
    const btn=document.getElementById("btnTerapkanRevisi");
    if(btn) btn.disabled=true;
}
function renderHistory() {
    const el=document.getElementById("revisiHistoryBody"); if(!el) return;
    const rows=(revisiDraft.history||[]);
    el.innerHTML=rows.length ? rows.map(x=>'<div class="history-item"><strong>'+esc(x.action)+'</strong> · '+esc(x.nomor||"-")+' · '+esc(new Date(x.at).toLocaleString("id-ID"))+'<br><span>'+rupiah(x.before)+' → '+rupiah(x.after)+' (selisih '+rupiah(x.diff)+')</span></div>').join("") : "Belum ada riwayat.";
}
function getComparisonExportRows() {
    return comparisonEntries().map(entry => {
        if (entry.type === "addition") {
            const item = entry.item;
            return {
                before: ["", "", "", "", "", "", ""],
                after: [item.kode, item.akunLabel || item.akun || "", item.uraian, item.volume, item.satuan, num(item.harga), num(item.volume) * num(item.harga), "DITAMBAH"]
            };
        }
        const row = entry.row;
        const effective = effectiveRow(row);
        return {
            before: [row.kode, row.akunLabel, row.uraian, row.volume, row.satuan, num(row.harga), num(row.jumlah)],
            after: [effective.kode, effective.akunLabel, effective.uraian, effective.volume, effective.satuan, num(effective.harga), num(effective.jumlah), isDeleted(row) ? "DIHAPUS" : (revisiDraft.changes[String(row.rowIndex)] ? "DIUBAH" : "TETAP")]
        };
    });
}

function exportRevisionExcel() {
    if (typeof XLSX === "undefined") {
        setStatus("Library Excel belum dimuat. Silakan refresh halaman.", "danger");
        return;
    }

    syncMetadataToDraft();

    const comparison = getComparisonExportRows();
    const wb = XLSX.utils.book_new();

    const summary = [
        ["REVISI ANGGARAN", ""],
        ["Nomor Revisi", revisiDraft.nomor || ""],
        ["Tanggal", revisiDraft.tanggal || ""],
        ["Pembuat", revisiDraft.pembuat || ""],
        ["Alasan Revisi", revisiDraft.alasan || ""],
        ["Tahun Anggaran", filters().tahun || "Semua Tahun"],
        ["Komponen", filters().komponen || "Semua Komponen"],
        ["Sub Komponen", filters().subKomponen || "Semua Sub Komponen"],
        ["Akun Belanja", filters().akun || "Semua Akun Belanja"],
        ["Status", revisiDraft.status || "DRAFT"],
        ["Jumlah Sebelum", calculateBeforeTotal()],
        ["Jumlah Sesudah", calculateAfterTotal()],
        ["Selisih", calculateAfterTotal() - calculateBeforeTotal()]
    ];

    const wsSummary = XLSX.utils.aoa_to_sheet(summary);
    wsSummary["!cols"] = [{wch:24},{wch:70}];

    const wsData = XLSX.utils.aoa_to_sheet([
        ["SEBELUM","","","","","","","SESUDAH","","","","","","",""],
        ["Kode","Akun Belanja","Uraian","Volume","Satuan","Harga","Jumlah","","Kode","Akun Belanja","Uraian","Volume","Satuan","Harga","Jumlah","Status"],
        ...comparison.map(x => [...x.before, "", ...x.after])
    ]);

    wsData["!merges"] = [
        {s:{r:0,c:0},e:{r:0,c:6}},
        {s:{r:0,c:8},e:{r:0,c:15}}
    ];
    wsData["!cols"] = [
        {wch:12},{wch:32},{wch:52},{wch:10},{wch:12},{wch:16},{wch:18},{wch:3},
        {wch:12},{wch:32},{wch:52},{wch:10},{wch:12},{wch:16},{wch:18},{wch:14}
    ];

    const headerStyle = {
        fill:{fgColor:{rgb:"1F6B35"}},
        font:{bold:true,color:{rgb:"FFFFFF"}},
        alignment:{horizontal:"center",vertical:"center",wrapText:true}
    };
    ["A1","I1","A2","B2","C2","D2","E2","F2","G2","I2","J2","K2","L2","M2","N2","O2","P2","Q2"].forEach(addr => {
        if (wsData[addr]) wsData[addr].s = headerStyle;
    });

    const lastRow = 2 + comparison.length;
    for (let r = 2; r < lastRow; r++) {
        if (wsData[XLSX.utils.encode_cell({r,c:8})]?.v === "DITAMBAH") continue;
    }

    XLSX.utils.book_append_sheet(wb, wsSummary, "Ringkasan");
    XLSX.utils.book_append_sheet(wb, wsData, "Perbandingan");

    const safeNomor = (revisiDraft.nomor || "REV").replace(/[^a-zA-Z0-9_-]/g, "_");
    XLSX.writeFile(wb, "Revisi_Anggaran_" + safeNomor + ".xlsx");
    setStatus("Excel berhasil dibuat.", "ok");
}

function buildPrintReport() {
    const entries = comparisonEntries();
    const title = filters().subKomponen || "Revisi Anggaran";
    const meta = [
        ["Nomor Revisi", revisiDraft.nomor || "-"],
        ["Tanggal", revisiDraft.tanggal || "-"],
        ["Pembuat", revisiDraft.pembuat || "-"],
        ["Tahun Anggaran", filters().tahun || "Semua Tahun"],
        ["Komponen", filters().komponen || "-"],
        ["Sub Komponen", filters().subKomponen || "-"],
        ["Akun Belanja", filters().akun || "Semua Akun Belanja"],
        ["Alasan Revisi", revisiDraft.alasan || "-"]
    ];

    const rowCells = entries.map(entry => {
        if (entry.type === "addition") {
            const x = entry.item;
            return {
                before: ["","","","","","",""],
                after: [x.kode,x.akunLabel || x.akun || "",x.uraian,x.volume,x.satuan,rupiah(x.harga),rupiah(num(x.volume)*num(x.harga))]
            };
        }
        const row = entry.row, e = effectiveRow(row);
        return {
            before: [row.kode,row.akunLabel,row.uraian,row.volume,row.satuan,rupiah(row.harga),rupiah(row.jumlah)],
            after: [e.kode,e.akunLabel,e.uraian,e.volume,e.satuan,rupiah(e.harga),rupiah(e.jumlah)]
        };
    });

    const table = side => rowCells.map(x => '<tr>' + x[side].map((v,i) =>
        '<td class="' + (i >= 5 ? 'money' : '') + '">' + esc(v) + '</td>'
    ).join("") + '</tr>').join("");

    const print = document.getElementById("printRevisionReport");
    if (!print) return;
    print.innerHTML =
        '<div class="print-title"><h1>REVISI ANGGARAN</h1><p>' + esc(title) + '</p></div>' +
        '<table class="print-meta">' + meta.map(x => '<tr><th>' + esc(x[0]) + '</th><td>' + esc(x[1]) + '</td></tr>').join("") + '</table>' +
        '<div class="print-summary"><strong>Jumlah Sebelum: ' + rupiah(calculateBeforeTotal()) + '</strong><strong>Jumlah Sesudah: ' + rupiah(calculateAfterTotal()) + '</strong><strong>Selisih: ' + rupiah(calculateAfterTotal()-calculateBeforeTotal()) + '</strong></div>' +
        '<div class="print-two-tables">' +
        '<div><h3>SEBELUM</h3><table><thead><tr><th>Kode</th><th>Akun Belanja</th><th>Uraian</th><th>Vol</th><th>Sat</th><th>Harga</th><th>Jumlah</th></tr></thead><tbody>' + table("before") + '</tbody></table></div>' +
        '<div><h3>SESUDAH</h3><table><thead><tr><th>Kode</th><th>Akun Belanja</th><th>Uraian</th><th>Vol</th><th>Sat</th><th>Harga</th><th>Jumlah</th></tr></thead><tbody>' + table("after") + '</tbody></table></div>' +
        '</div>';
}


function printRevision() {
    syncMetadataToDraft();
    buildPrintReport();
    window.print();
}

document.getElementById("btnCetakRevisi").addEventListener("click", printRevision);
document.getElementById("btnDownloadExcelRevisi").addEventListener("click", exportRevisionExcel);
document.getElementById("btnValidasiRevisi").addEventListener("click", validateDraft);
["revisiNomor","revisiTanggal","revisiPembuat","revisiAlasan"].forEach(id=>document.getElementById(id).addEventListener("input",()=>{revisiDraft.validation=null;renderValidationState();}));
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

function populateAddAkun() {
    const select = document.getElementById("addAkun");
    if (!select) return;

    const sourceRows = filteredRows();
    const accounts = [];
    const seen = new Set();

    sourceRows.forEach(row => {
        const code = norm(row.kodeAkun);
        const name = norm(row.akun);
        if (!code && !name) return;

        const key = code + "|" + name;
        if (seen.has(key)) return;
        seen.add(key);
        accounts.push({ code, name });
    });

    select.innerHTML = '<option value="">-- Pilih Akun Belanja --</option>' +
        accounts.map(item =>
            '<option value="' + esc(item.code + " | " + item.name) +
            '" data-code="' + esc(item.code) + '" data-name="' + esc(item.name) + '">' +
            esc(item.code + " " + item.name) +
            '</option>'
        ).join("");

    const current = norm(document.getElementById("filterAkun")?.value || "");
    if (current) {
        const match = accounts.find(item => item.name === current);
        if (match) select.value = match.code + " | " + match.name;
    }
}

document.getElementById("addAkun").addEventListener("change", event => {
    const option = event.target.selectedOptions[0];
    document.getElementById("addKode").value = option?.dataset.code || "";
});

document.getElementById("btnTambahItem").addEventListener("click", () => {
    populateAddAkun();
    addKode.value = "";
    addUraian.value = "";
    addVol.value = 1;
    addSat.value = "";
    addHarga.value = 0;
    updateAddJumlah();
    bootstrap.Modal.getOrCreateInstance(document.getElementById("modalTambahItem")).show();
});

document.getElementById("btnTambahkanItem").addEventListener("click", () => {
    const akunOption = document.getElementById("addAkun")?.selectedOptions[0];
    const parent = additionParentContext();
    const item = {
        id: "ADD-" + Date.now(),
        kode: norm(akunOption?.dataset.code || addKode.value),
        kodeAkun: norm(akunOption?.dataset.code || addKode.value),
        akun: norm(akunOption?.dataset.name || ""),
        akunLabel: norm(akunOption?.dataset.name || ""),
        tahun: norm(parent.tahun || filters().tahun),
        komponen: norm(parent.komponen || filters().komponen),
        subKomponen: norm(parent.subKomponen || filters().subKomponen),
        uraian: norm(addUraian.value),
        volume: num(addVol.value),
        satuan: norm(addSat.value),
        harga: num(addHarga.value)
    };

    if (!item.kode || !item.akun) return alert("Akun Belanja wajib dipilih.");
    if (!item.uraian) return alert("Uraian wajib diisi.");
    if (item.volume <= 0) return alert("Volume harus lebih besar dari 0.");

    revisiDraft.additions.push(item);
    buildPrintReport();
    bootstrap.Modal.getOrCreateInstance(document.getElementById("modalTambahItem")).hide();
    render();
    setStatus("Item ditambahkan ke draft. Belum mengubah DATA_APLIKASI.", "warning");
});

document.addEventListener("DOMContentLoaded", init);
window.addEventListener("pageshow", event => { if (event.persisted) location.reload(); });
