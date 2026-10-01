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
        const kodeKomponen = hv(row, context.map, ["Kode Komponen", "KodeKomponen"]);
        const kodeSubKomponen = hv(row, context.map, ["Kode Sub Komponen", "KodeSubKomponen"]);
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
            kodeAsli: kode,
            kodeKomponen,
            kodeSubKomponen,
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
        normalizeDraftAdditionsContext();
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

    // Setiap perubahan item membuat hasil validasi sebelumnya menjadi kedaluwarsa.
    // Jangan tampilkan pesan validasi lama yang sudah tidak sesuai dengan draft terbaru.
    revisiDraft.validation = null;
    revisiDraft.status = "DRAFT";

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

        revisiDraft.validation = null;
        revisiDraft.status = "DRAFT";
        render();
    }

    if (button.dataset.action === "delete-add") {
        revisiDraft.additions = revisiDraft.additions.map(item =>
            item.id === button.dataset.id ? { ...item, deleted: true } : item
        );

        revisiDraft.validation = null;
        revisiDraft.status = "DRAFT";
        render();
    }
});

["filterTahun", "filterKomponen", "filterSubKomponen", "filterAkun"].forEach(id => {
    document.getElementById(id).addEventListener("change", () => {
        refreshFilters();
        render();
    });
});

function draftGlobalRows() {
    return revisiRows.map(row => ({
        row,
        effective: effectiveRow(row),
        deleted: isDeleted(row)
    }));
}

function draftGroupKey(item) {
    // Validasi pagu hanya sampai level KOMPONEN.
    // Perubahan antar akun belanja maupun antar sub komponen di dalam
    // komponen yang sama diperbolehkan selama total komponen tetap.
    const code = norm(item.kodeKomponen);
    const name = norm(item.komponen);
    return [code, name].filter(Boolean).join(" | ") || "(Tanpa Komponen)";
}

function draftGroupLabel(item) {
    const code = norm(item.kodeKomponen);
    const name = norm(item.komponen);
    if (code && name) return code + " — " + name;
    return name || code || "(Tanpa Komponen)";
}

function additionContextCandidates(item) {
    const code = norm(item.kodeAkun || item.kode);
    const akun = norm(item.akunLabel || item.akun);

    return revisiRows.filter(row => {
        const sameCode = !code || norm(row.kodeAkun || row.kode) === code;
        const sameAkun = !akun || norm(row.akunLabel || row.akun) === akun;
        return sameCode && sameAkun;
    });
}

function resolveAdditionContext(item) {
    const result = { ...item };
    const f = filters();

    // Prioritaskan konteks filter saat item ditambahkan.
    if (!norm(result.tahun) && f.tahun) result.tahun = f.tahun;
    if (!norm(result.komponen) && f.komponen) result.komponen = f.komponen;
    if (!norm(result.subKomponen) && f.subKomponen) result.subKomponen = f.subKomponen;

    const candidates = additionContextCandidates(result);

    const contextual = candidates.filter(row =>
        (!result.tahun || norm(row.tahun) === norm(result.tahun)) &&
        (!result.komponen || norm(row.komponen) === norm(result.komponen)) &&
        (!result.subKomponen || norm(row.subKomponen) === norm(result.subKomponen))
    );

    const source = contextual[0] || (candidates.length === 1 ? candidates[0] : null);

    if (source) {
        result.tahun = norm(result.tahun || source.tahun);
        result.komponen = norm(result.komponen || source.komponen);
        result.kodeKomponen = norm(result.kodeKomponen || source.kodeKomponen);
        result.subKomponen = norm(result.subKomponen || source.subKomponen);
        result.kodeSubKomponen = norm(result.kodeSubKomponen || source.kodeSubKomponen);
        result.kodeAkun = norm(result.kodeAkun || source.kodeAkun || source.kode);
        result.kode = norm(result.kode || result.kodeAkun);
        result.akun = norm(result.akun || source.akun);
        result.akunLabel = norm(result.akunLabel || source.akunLabel || source.akun);
    }

    return result;
}

function normalizeDraftAdditionsContext() {
    if (!Array.isArray(revisiDraft.additions) || !revisiDraft.additions.length) return;

    let changed = false;
    revisiDraft.additions = revisiDraft.additions.map(item => {
        const resolved = resolveAdditionContext(item);
        if (JSON.stringify(resolved) !== JSON.stringify(item)) changed = true;
        return resolved;
    });

    if (changed) {
        try {
            localStorage.setItem(REVISI_DRAFT_KEY, JSON.stringify(revisiDraft));
        } catch (error) {
            console.warn("Konteks item tambahan tidak dapat disimpan:", error);
        }
    }
}

function calculateGlobalDraftTotals() {
    const beforeByGroup = new Map();
    const afterByGroup = new Map();
    const unresolvedAdditions = [];

    draftGlobalRows().forEach(({ row, effective, deleted }) => {
        const key = draftGroupKey(row);
        const before = num(row.jumlah);
        const after = deleted ? 0 : num(effective.jumlah);

        beforeByGroup.set(key, (beforeByGroup.get(key) || 0) + before);
        afterByGroup.set(key, (afterByGroup.get(key) || 0) + after);
    });

    revisiDraft.additions.filter(item => !item.deleted).forEach(item => {
        const resolved = resolveAdditionContext(item);
        const hasComponent = norm(resolved.komponen) || norm(resolved.kodeKomponen);

        if (!hasComponent) {
            unresolvedAdditions.push(resolved);
            return;
        }

        const key = draftGroupKey(resolved);
        afterByGroup.set(key, (afterByGroup.get(key) || 0) + num(resolved.volume) * num(resolved.harga));
        if (!beforeByGroup.has(key)) beforeByGroup.set(key, 0);
    });

    const keys = new Set([...beforeByGroup.keys(), ...afterByGroup.keys()]);
    const groups = [...keys].map(key => {
        const before = beforeByGroup.get(key) || 0;
        const after = afterByGroup.get(key) || 0;
        return {
            key,
            before,
            after,
            diff: after - before,
            label: key
        };
    }).filter(group => Math.abs(group.diff) > 0.000001);

    const before = [...beforeByGroup.values()].reduce((sum, value) => sum + value, 0);
    const after = [...afterByGroup.values()].reduce((sum, value) => sum + value, 0);

    return {
        before,
        after,
        diff: after - before,
        groups,
        unresolvedAdditions
    };
}

function validateDraft() {
    syncMetadataToDraft();
    const errors = [];

    if (!revisiDraft.nomor) errors.push("Nomor revisi belum diisi.");
    if (!revisiDraft.tanggal) errors.push("Tanggal revisi belum diisi.");
    if (!revisiDraft.pembuat) errors.push("Pembuat revisi belum diisi.");
    if (!revisiDraft.alasan) errors.push("Alasan revisi belum diisi.");

    /*
     * Validasi pagu dilakukan GLOBAL, bukan hanya pada filter yang sedang
     * tampil. Tujuannya menjaga agar revisi tidak mengubah pagu total
     * komponen maupun total seluruh anggaran.
     */
    // Pastikan item tambahan memiliki konteks Komponen/Sub Komponen.
    // Item baru harus mengikuti lokasi yang dipilih pengguna.
    normalizeDraftAdditionsContext();

    const global = calculateGlobalDraftTotals();

    global.unresolvedAdditions.forEach(item => {
        errors.push(
            "ITEM TAMBAHAN BELUM MEMILIKI KOMPONEN: " +
            (item.uraian || item.akunLabel || item.kode || "Item baru") +
            ". Pilih Komponen dan Sub Komponen sebelum menambahkan item."
        );
    });

    const changedCount =
        Object.keys(revisiDraft.changes).length +
        revisiDraft.deletions.length +
        revisiDraft.additions.filter(item => !item.deleted).length;

    if (!changedCount) errors.push("Belum ada perubahan anggaran.");

    if (!Number.isFinite(global.before) || !Number.isFinite(global.after)) {
        errors.push("Total pagu anggaran tidak valid.");
    }

    /*
     * ATURAN UTAMA:
     * 1. Total seluruh pagu harus tetap.
     * 2. Total setiap KOMPONEN harus tetap.
     *
     * Perubahan antar Akun Belanja dan antar Sub Komponen DI DALAM
     * Komponen yang sama diperbolehkan. Yang tidak diperbolehkan adalah
     * perubahan pagu total suatu Komponen.
     */
    if (Math.abs(global.diff) > 0.000001) {
        errors.push(
            "TOTAL PAGU ANGGARAN BERUBAH: sebelum " +
            rupiah(global.before) +
            " → sesudah " +
            rupiah(global.after) +
            " (selisih " +
            rupiah(global.diff) +
            "). Revisi tidak dapat divalidasi."
        );
    }

    global.groups.forEach(group => {
        errors.push(
            "SELISIH DITEMUKAN DI KOMPONEN: " +
            group.label +
            " — sebelum " +
            rupiah(group.before) +
            " → sesudah " +
            rupiah(group.after) +
            " (selisih " +
            rupiah(group.diff) +
            "). Perubahan antar akun belanja dan antar sub komponen di dalam komponen ini diperbolehkan selama total Komponen tetap."
        );
    });

    const allEffectiveRows = draftGlobalRows()
        .filter(item => !item.deleted)
        .map(item => item.effective);

    const allAdditions = revisiDraft.additions.filter(item => !item.deleted);

    [...allEffectiveRows, ...allAdditions].forEach((row, index) => {
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
        before: global.before,
        after: global.after,
        diff: global.diff,
        differenceGroups: global.groups,
        validatedAt
    };

    revisiDraft.status = errors.length ? "DRAFT" : "TERVALIDASI";

    const historyEntry = {
        at: validatedAt,
        action: errors.length ? "VALIDASI GAGAL" : "VALIDASI BERHASIL",
        nomor: revisiDraft.nomor,
        before: global.before,
        after: global.after,
        diff: global.diff,
        errors
    };

    revisiDraft.history = [historyEntry, ...(revisiDraft.history || [])].slice(0, 20);

    localStorage.setItem(REVISI_DRAFT_KEY, JSON.stringify(revisiDraft));
    render();
    renderValidationState();
    renderHistory();

    setStatus(
        errors.length
            ? "Validasi ditolak. Periksa selisih pagu yang ditampilkan."
            : "Revisi lolos validasi dan total pagu tetap.",
        errors.length ? "warning" : "ok"
    );
}

function renderValidationState() {
    const box = document.getElementById("revisiValidationBox");
    const status = document.getElementById("revisiValidationStatus");
    const v = revisiDraft.validation;
    const applyButton = document.getElementById("btnTerapkanRevisi");
    const summaryStatus = document.querySelector(".revisi-summary .draft-text");

    if (!box || !status) return;

    if (!v) {
        box.textContent = "Validasi: belum dijalankan.";
        status.textContent = "Belum divalidasi";
        status.className = "status-pill status-warning";
        if (applyButton) {
            applyButton.disabled = true;
            applyButton.title = "Aktif setelah validasi berhasil.";
        }
        if (summaryStatus) summaryStatus.textContent = "DRAFT";
        return;
    }

    box.textContent = v.ok
        ? "Validasi berhasil. Total sebelum " + rupiah(v.before) +
          " → sesudah " + rupiah(v.after) +
          "; selisih " + rupiah(v.diff) + "."
        : "Validasi gagal: " + v.errors.join(" ");

    status.textContent = v.ok ? "TERVALIDASI" : "PERLU PERBAIKAN";
    status.className = "status-pill " + (v.ok ? "status-ok" : "status-danger");

    // Tombol Terapkan Revisi hanya aktif jika validasi terakhir berhasil.
    // Jika ada perubahan setelah validasi, input handler mengosongkan
    // revisiDraft.validation sehingga tombol kembali terkunci.
    if (applyButton) {
        applyButton.disabled = !v.ok;
        applyButton.title = v.ok
            ? "Validasi berhasil. Siap diterapkan setelah konfirmasi."
            : "Aktif setelah validasi berhasil.";
    }

    if (summaryStatus) {
        summaryStatus.textContent = v.ok ? "TERVALIDASI" : "DRAFT";
        summaryStatus.className = v.ok ? "validated-text" : "draft-text";
    }
}
function renderHistory() {
    const el=document.getElementById("revisiHistoryBody"); if(!el) return;
    const rows=(revisiDraft.history||[]);
    el.innerHTML=rows.length ? rows.map(x=>'<div class="history-item"><strong>'+esc(x.action)+'</strong> · '+esc(x.nomor||"-")+' · '+esc(new Date(x.at).toLocaleString("id-ID"))+'<br><span>'+rupiah(x.before)+' → '+rupiah(x.after)+' (selisih '+rupiah(x.diff)+')</span></div>').join("") : "Belum ada riwayat.";
}
function hierarchyLabel(value, fallbackCode = "") {
    const text = norm(value);
    if (!text && !fallbackCode) return { code:"", label:"" };

    const sub = text.match(/^([A-Z])\.\s*(.*)$/);
    if (sub) return { code:sub[1], label:sub[2] };

    const component = text.match(/^([0-9]{4}\.[A-Z]{3}\.[0-9]{3}\.[0-9]{3})\s*[-:]?\s*(.*)$/);
    if (component) return { code:component[1], label:component[2] || text };

    return { code:norm(fallbackCode), label:text };
}

function hierarchyRowsForEntries(entries) {
    const result = [];
    let currentComponent = "";
    let currentSub = "";
    let currentAccount = "";

    const accountGroups = new Map();
    entries.forEach(entry => {
        const source = entry.type === "addition" ? entry.item : entry.row;
        const key = [
            norm(source.tahun), norm(source.komponen), norm(source.subKomponen),
            norm(source.kodeAkun || source.kode), norm(source.akunLabel || source.akun)
        ].join("|");
        if (!accountGroups.has(key)) accountGroups.set(key, []);
        accountGroups.get(key).push(entry);
    });

    entries.forEach(entry => {
        const source = entry.type === "addition" ? entry.item : entry.row;
        const component = hierarchyLabel(source.komponen, source.kodeKomponen || "");
        const sub = hierarchyLabel(source.subKomponen, source.kodeSubKomponen || "");

        const componentKey = [norm(source.tahun), norm(source.komponen)].join("|");
        const subKey = [componentKey, norm(source.subKomponen)].join("|");
        const accountKey = [
            subKey, norm(source.kodeAkun || source.kode),
            norm(source.akunLabel || source.akun)
        ].join("|");

        if (componentKey !== currentComponent) {
            currentComponent = componentKey;
            currentSub = "";
            currentAccount = "";
            result.push({
                type:"hierarchy", level:"component",
                code:component.code, label:component.label,
                before:0, after:0
            });
        }

        if (subKey !== currentSub) {
            currentSub = subKey;
            currentAccount = "";
            result.push({
                type:"hierarchy", level:"sub",
                code:sub.code, label:sub.label,
                before:0, after:0
            });
        }

        if (accountKey !== currentAccount) {
            currentAccount = accountKey;
            const group = accountGroups.get(accountKey) || [];
            const before = group.reduce((sum, e) => {
                if (e.type === "addition") return sum;
                return sum + (isDeleted(e.row) ? 0 : num(e.row.jumlah));
            }, 0);
            const after = group.reduce((sum, e) => {
                if (e.type === "addition") return sum + num(e.item.volume) * num(e.item.harga);
                return sum + (isDeleted(e.row) ? 0 : num(effectiveRow(e.row).jumlah));
            }, 0);

            result.push({
                type:"hierarchy", level:"account",
                code:norm(source.kodeAkun || source.kode),
                label:norm(source.akunLabel || source.akun),
                before, after
            });
        }

        result.push(entry);
    });

    return result;
}

function getComparisonExportRows() {
    return hierarchyRowsForEntries(comparisonEntries()).map(entry => {
        if (entry.type === "hierarchy") {
            return {
                before:[entry.code, entry.label, "", "", "", entry.before],
                after:[entry.code, entry.label, "", "", "", entry.after],
                status:entry.level === "sub" ? "SUB KOMPONEN" :
                    entry.level === "component" ? "KOMPONEN" : "AKUN"
            };
        }

        if (entry.type === "addition") {
            const item = entry.item;
            return {
                before:["","","","","",""],
                after:[item.kode, item.uraian || item.akunLabel || item.akun || "", item.volume, item.satuan, num(item.harga), num(item.volume)*num(item.harga)],
                status:"DITAMBAH"
            };
        }

        const row = entry.row;
        const effective = effectiveRow(row);
        return {
            before:[row.kode || "", row.uraian || row.akunLabel || "", row.volume, row.satuan, num(row.harga), num(row.jumlah)],
            after:[effective.kode || "", effective.uraian || effective.akunLabel || "", effective.volume, effective.satuan, num(effective.harga), num(effective.jumlah)],
            status:isDeleted(row) ? "DIHAPUS" : (revisiDraft.changes[String(row.rowIndex)] ? "DIUBAH" : "TETAP")
        };
    });
}


function exportRevisionExcel() {
    if (typeof XLSX === "undefined") {
        setStatus("Library Excel belum dimuat. Silakan refresh halaman.", "danger");
        return;
    }

    syncMetadataToDraft();

    const entries = comparisonEntries();
    const wb = XLSX.utils.book_new();

    // Format mengikuti CONTOH.xlsx:
    // 6 kolom SEBELUM + 6 kolom SESUDAH berdampingan.
    const rows = [
        ["KODE", "Program/Kegiatan/Output/Sub Output/Komponen/Sub Komponen/Akun/Detail", "VOL", "SAT", "HARGA", "JUMLAH",
         "KODE", "Program/Kegiatan/Output/Sub Output/Komponen/Sub Komponen/Akun/Detail", "VOL", "SAT", "HARGA", "JUMLAH"],
        [1, 2, 3, 4, 5, 6, 1, 2, 3, 4, 5, 6],
        ["SEBELUM REVISI", "", "", "", "", "", "SESUDAH REVISI", "", "", "", "", ""]
    ];

    const exportRows = hierarchyRowsForEntries(entries);

    exportRows.forEach(entry => {
        if (entry.type === "hierarchy") {
            rows.push([
                entry.code || "", entry.label || "", "", "", "", entry.before || 0,
                entry.code || "", entry.label || "", "", "", "", entry.after || 0
            ]);
            return;
        }

        if (entry.type === "addition") {
            const x = entry.item;
            rows.push([
                "", "", "", "", "", "",
                x.kode, x.uraian || x.akunLabel || x.akun || "", x.volume, x.satuan, num(x.harga), num(x.volume) * num(x.harga)
            ]);
            return;
        }

        const row = entry.row;
        const effective = effectiveRow(row);
        rows.push([
            row.kode || "", row.uraian || row.akunLabel || "", row.volume ?? "", row.satuan || "",
            num(row.harga), num(row.jumlah),
            effective.kode || "", effective.uraian || effective.akunLabel || "", effective.volume ?? "",
            effective.satuan || "", num(effective.harga), num(effective.jumlah)
        ]);
    });

    const ws = XLSX.utils.aoa_to_sheet(rows);

    ws["!merges"] = [
        {s:{r:0,c:0},e:{r:0,c:0}},
        {s:{r:0,c:1},e:{r:0,c:1}},
        {s:{r:0,c:2},e:{r:0,c:2}},
        {s:{r:0,c:3},e:{r:0,c:3}},
        {s:{r:0,c:4},e:{r:0,c:4}},
        {s:{r:0,c:5},e:{r:0,c:5}},
        {s:{r:0,c:6},e:{r:0,c:6}},
        {s:{r:0,c:7},e:{r:0,c:7}},
        {s:{r:0,c:8},e:{r:0,c:8}},
        {s:{r:0,c:9},e:{r:0,c:9}},
        {s:{r:0,c:10},e:{r:0,c:10}},
        {s:{r:0,c:11},e:{r:0,c:11}},
        {s:{r:2,c:0},e:{r:2,c:5}},
        {s:{r:2,c:6},e:{r:2,c:11}}
    ];

    ws["!cols"] = [
        {wch:18.5},{wch:49},{wch:8},{wch:10},{wch:15},{wch:17},
        {wch:18.5},{wch:49},{wch:8},{wch:10},{wch:15},{wch:17}
    ];
    ws["!rows"] = [
        {hpt:24},
        {hpt:20},
        {hpt:22}
    ];

    const blue = "156082";
    const green = "00B050";
    const black = "000000";
    const white = "FFFFFF";
    const thin = {style:"thin", color:{rgb:"B7B7B7"}};

    const styleHeader = {
        fill:{patternType:"solid", fgColor:{rgb:blue}},
        font:{name:"Arial", sz:11, bold:true, color:{rgb:white}},
        alignment:{horizontal:"center", vertical:"center", wrapText:true},
        border:{top:thin,bottom:thin,left:thin,right:thin}
    };

    const styleTitle = {
        fill:{patternType:"solid", fgColor:{rgb:blue}},
        font:{name:"Arial", sz:11, bold:true, color:{rgb:white}},
        alignment:{horizontal:"left", vertical:"center"},
        border:{top:thin,bottom:thin,left:thin,right:thin}
    };

    const styleNormal = {
        font:{name:"Arial", sz:11, color:{rgb:black}},
        alignment:{vertical:"top"},
        border:{bottom:thin}
    };

    const styleAccount = {
        font:{name:"Arial", sz:11, bold:true, color:{rgb:black}},
        alignment:{vertical:"top"},
        border:{bottom:thin}
    };

    const styleSub = {
        fill:{patternType:"solid", fgColor:{rgb:green}},
        font:{name:"Arial", sz:11, bold:true, color:{rgb:black}},
        alignment:{vertical:"top"},
        border:{top:thin,bottom:thin,left:thin,right:thin}
    };

    for (let c = 0; c < 12; c++) {
        ws[XLSX.utils.encode_cell({r:0,c})].s = styleHeader;
        ws[XLSX.utils.encode_cell({r:1,c})].s = styleHeader;
        ws[XLSX.utils.encode_cell({r:2,c})].s = styleTitle;
    }

    const isAccountCode = value => /^\\d{6}$/.test(norm(value));
    const isLevelCode = value => /^[A-Z]$/.test(norm(value));

    for (let r = 3; r < rows.length; r++) {
        const exportEntry = exportRows[r - 3];

        for (let side = 0; side < 2; side++) {
            const base = side * 6;
            let style = styleNormal;

            if (exportEntry?.type === "hierarchy") {
                style = exportEntry.level === "sub" ? styleSub :
                    exportEntry.level === "account" ? styleAccount : styleTitle;
            } else if (exportEntry?.type === "addition") {
                style = {...styleNormal, fill:{patternType:"solid", fgColor:{rgb:"E2F0D9"}}};
            }

            for (let c = base; c < base + 6; c++) {
                const cell = ws[XLSX.utils.encode_cell({r,c})];
                if (!cell) continue;
                cell.s = {...style};

                if (c === base + 4 || c === base + 5) {
                    cell.z = '#,##0';
                    cell.alignment = {
                        ...(cell.alignment || {}),
                        horizontal:"right",
                        vertical:"top"
                    };
                }
            }
        }

        ws["!rows"] = ws["!rows"] || [];
        ws["!rows"][r] = {hpt: exportEntry?.type === "hierarchy" ? 24 : 18};
    }

    // Freeze header dan tampilan cetak mengikuti template.
    ws["!freeze"] = {xSplit:0, ySplit:3};
    ws["!pageSetup"] = {
        orientation:"landscape",
        paperSize:"9",
        fitToWidth:1,
        fitToHeight:0
    };
    ws["!margins"] = {
        left:0.25,right:0.25,top:0.4,bottom:0.4,header:0.2,footer:0.2
    };
    ws["!printOptions"] = {gridLines:true};

    // Sheet kedua berisi identitas revisi dan ringkasan.
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
        ["Jumlah Sebelum", calculateBeforeTotal()],
        ["Jumlah Sesudah", calculateAfterTotal()],
        ["Selisih", calculateAfterTotal() - calculateBeforeTotal()],
        ["Status", revisiDraft.status || "DRAFT"]
    ];
    const wsSummary = XLSX.utils.aoa_to_sheet(summary);
    wsSummary["!cols"] = [{wch:25},{wch:75}];
    wsSummary["A1"].s = styleHeader;
    wsSummary["B1"].s = styleHeader;
    for (let r = 1; r < summary.length; r++) {
        if (wsSummary[XLSX.utils.encode_cell({r,c:0})]) wsSummary[XLSX.utils.encode_cell({r,c:0})].s = styleAccount;
    }

    XLSX.utils.book_append_sheet(wb, ws, "RAB Revisi");
    XLSX.utils.book_append_sheet(wb, wsSummary, "Informasi Revisi");

    const safeNomor = (revisiDraft.nomor || "REV").replace(/[^a-zA-Z0-9_-]/g, "_");
    XLSX.writeFile(wb, "Revisi_Anggaran_" + safeNomor + ".xlsx");
    setStatus("Excel berhasil dibuat dengan format RAB seperti template.", "ok");
}


function buildPrintReport() {
    const entries = hierarchyRowsForEntries(comparisonEntries());
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

    const makeRows = side => entries.map(entry => {
        let values;
        let code = "";
        let type = "normal";

        if (entry.type === "hierarchy") {
            code = entry.code || "";
            values = [
                entry.code || "",
                entry.label || "",
                "",
                "",
                "",
                rupiah(side === "before" ? entry.before : entry.after)
            ];
            type = entry.level === "sub" ? "sub" :
                entry.level === "account" ? "account" : "component";
        } else if (entry.type === "addition") {
            const x = entry.item;
            code = x.kode;
            values = side === "after"
                ? [x.kode, x.uraian || x.akunLabel || x.akun || "", x.volume, x.satuan, rupiah(x.harga), rupiah(num(x.volume) * num(x.harga))]
                : ["", "", "", "", "", ""];
            type = "added";
        } else {
            const row = entry.row;
            const effective = effectiveRow(row);
            const data = side === "before" ? row : effective;
            code = data.kode;
            values = [
                data.kode || "",
                data.uraian || data.akunLabel || "",
                data.volume ?? "",
                data.satuan || "",
                rupiah(data.harga),
                rupiah(data.jumlah)
            ];
            if (side === "after" && revisiDraft.changes[String(row.rowIndex)]) {
                type = "changed";
            }
            if (side === "after" && isDeleted(row)) type = "deleted";
        }

        return '<tr class="print-row-' + type + '">' +
            values.map((v, i) => '<td class="' + (i >= 4 ? 'money' : '') + '">' + esc(v) + '</td>').join("") +
            '</tr>';
    }).join("");

    const table = (side, label) =>
        '<div class="print-side">' +
        '<h3 class="' + side + '-label">' + label + '</h3>' +
        '<table><thead><tr><th>KODE</th><th>Program/Kegiatan/Output/Sub Output/Komponen/Sub Komponen/Akun/Detail</th><th>VOL</th><th>SAT</th><th>HARGA</th><th>JUMLAH</th></tr></thead>' +
        '<tbody>' + makeRows(side) + '</tbody></table></div>';

    const print = document.getElementById("printRevisionReport");
    if (!print) return;

    print.innerHTML =
        '<div class="print-title"><h1>REVISI ANGGARAN</h1><p>' + esc(title) + '</p></div>' +
        '<table class="print-meta">' +
        meta.map(x => '<tr><th>' + esc(x[0]) + '</th><td>' + esc(x[1]) + '</td></tr>').join("") +
        '</table>' +
        '<div class="print-summary">' +
        '<strong>Jumlah Sebelum: ' + rupiah(calculateBeforeTotal()) + '</strong>' +
        '<strong>Jumlah Sesudah: ' + rupiah(calculateAfterTotal()) + '</strong>' +
        '<strong>Selisih: ' + rupiah(calculateAfterTotal() - calculateBeforeTotal()) + '</strong>' +
        '</div>' +
        '<div class="print-two-tables">' +
        table("before", "SEBELUM REVISI") +
        table("after", "SESUDAH REVISI") +
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

    // Simpan identitas hierarki secara eksplisit agar item baru
    // masuk ke Komponen/Sub Komponen yang dipilih.
    const resolvedItem = resolveAdditionContext(item);
    revisiDraft.additions.push(resolvedItem);

    // Validasi lama tidak berlaku setelah ada item baru.
    revisiDraft.validation = null;
    revisiDraft.status = "DRAFT";

    buildPrintReport();
    bootstrap.Modal.getOrCreateInstance(document.getElementById("modalTambahItem")).hide();
    render();
    setStatus("Item ditambahkan ke draft. Belum mengubah DATA_APLIKASI.", "warning");
});

document.addEventListener("DOMContentLoaded", init);
window.addEventListener("pageshow", event => { if (event.persisted) location.reload(); });
