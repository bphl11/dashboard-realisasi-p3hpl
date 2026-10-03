// ============================================================
// RPD MODULE
// VERSION: 20260922-12-multi-week-input
// VERSION: 20260922-07-legacy-week-migration
// Input RPD per triwulan pada level Detil Akun.
// ============================================================

let rpdUser = null;
let rpdMasterRows = [];
let rpdExisting = [];
let rpdCurrentSelection = null;
let rpdOriginalWeekly = {};
let rpdOriginalCatatan = "";

const RPD_MONTHS = [
    { key: "jan", label: "Januari", tw: 1 }, { key: "feb", label: "Februari", tw: 1 },
    { key: "mar", label: "Maret", tw: 1 }, { key: "apr", label: "April", tw: 2 },
    { key: "mei", label: "Mei", tw: 2 }, { key: "jun", label: "Juni", tw: 2 },
    { key: "jul", label: "Juli", tw: 3 }, { key: "agu", label: "Agustus", tw: 3 },
    { key: "sep", label: "September", tw: 3 }, { key: "okt", label: "Oktober", tw: 4 },
    { key: "nov", label: "November", tw: 4 }, { key: "des", label: "Desember", tw: 4 }
];
const RPD_WEEK_FIELDS = RPD_MONTHS.flatMap(month => [1,2,3,4].map(week => `${month.key}_m${week}`));
const RPD_EMPTY = { tw1:0, tw2:0, tw3:0, tw4:0, ...Object.fromEntries(RPD_WEEK_FIELDS.map(key => [key,0])), catatan:"" };

function rpdHasWeeklyFields(row) {
    const source = row && typeof row === "object" ? row : {};
    return RPD_WEEK_FIELDS.some(key =>
        Object.prototype.hasOwnProperty.call(source, key) ||
        Object.prototype.hasOwnProperty.call(source, key.toUpperCase())
    );
}

function rpdQuarterTotals(saved) {
    const source = saved && typeof saved === "object" ? saved : {};

    // Bila record memiliki skema 48 minggu, 48 field adalah sumber
    // kebenaran, termasuk ketika seluruh nilainya sengaja 0.
    if (rpdHasWeeklyFields(source)) {
        const q = {1:0,2:0,3:0,4:0};
        RPD_MONTHS.forEach(month => {
            for (let week=1; week<=4; week++) {
                const field = month.key + "_m" + week;
                q[month.tw] += rpdNumber(
                    source[field] ?? source[field.toUpperCase()] ?? 0
                );
            }
        });
        return {tw1:q[1],tw2:q[2],tw3:q[3],tw4:q[4]};
    }

    // Hanya record lama yang benar-benar tidak memiliki field mingguan
    // yang boleh menggunakan subtotal TW1-TW4.
    return {
        tw1:rpdNumber(source.tw1 ?? source.TW1),
        tw2:rpdNumber(source.tw2 ?? source.TW2),
        tw3:rpdNumber(source.tw3 ?? source.TW3),
        tw4:rpdNumber(source.tw4 ?? source.TW4)
    };
}

// CACHE GENERASI BARU: seluruh cache RPD lama sengaja diputus agar
// nilai RPD lama tidak ikut hidup kembali setelah reset/migrasi.
const RPD_LOCAL_CACHE_KEY = "p3hpl_rpd_saved_v6_clean";
const RPD_MASTER_CACHE_KEY = "p3hpl_rpd_master_v5_clean";
const RPD_MASTER_CACHE_TTL = 5 * 60 * 1000;
const RPD_LEGACY_CACHE_KEYS = [
    "p3hpl_rpd_saved_v5",
    "p3hpl_rpd_saved_v4",
    "p3hpl_rpd_master_v4_stable_id_revisi",
    "p3hpl_grafik_rpd_cache_v2",
    "p3hpl_grafik_rpd_cache_v3"
];

function rpdClearLegacyCaches() {
    try {
        RPD_LEGACY_CACHE_KEYS.forEach(key => localStorage.removeItem(key));
    } catch (error) {
        console.warn("Cache RPD lama tidak dapat dihapus:", error);
    }
}

function rpdLoadMasterCache() {
    try {
        const raw = localStorage.getItem(RPD_MASTER_CACHE_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (!parsed || !Array.isArray(parsed.rows) || !parsed.savedAt) return null;
        if (Date.now() - Number(parsed.savedAt) > RPD_MASTER_CACHE_TTL) return null;
        return parsed.rows;
    } catch (e) {
        return null;
    }
}

function rpdSaveMasterCache(rows) {
    try {
        localStorage.setItem(RPD_MASTER_CACHE_KEY, JSON.stringify({
            savedAt: Date.now(),
            rows: rows || []
        }));
    } catch (e) {}
}


function rpdLoadLocalCache() {
    try {
        const raw = localStorage.getItem(RPD_LOCAL_CACHE_KEY);
        return raw ? rpdNormalizeExistingRows(JSON.parse(raw)) : [];
    } catch (e) {
        return [];
    }
}

function rpdSaveLocalCache(rows) {
    try {
        localStorage.setItem(RPD_LOCAL_CACHE_KEY, JSON.stringify(rows || []));
    } catch (e) {}
}

function rpdMergeSavedRows(rows) {
    const byId = new Map(
        rpdExisting.map(item => [String(item.id_rpd || ""), item])
    );

    (rows || []).forEach(item => {
        const normalized = rpdNormalizeSavedRow(item);
        if (!normalized.id_rpd) return;

        const key = String(normalized.id_rpd);
        const existing = byId.get(key);

        if (!existing) {
            byId.set(key, normalized);
            return;
        }

        const incomingLegacyQuarterMapped = item?._legacyQuarterMapped === true;
        const incomingHasWeekly = !incomingLegacyQuarterMapped &&
            RPD_WEEK_FIELDS.some(field =>
                item?.[field] !== undefined ||
                item?.[field.toUpperCase()] !== undefined
            );

        const existingHasWeekly = RPD_WEEK_FIELDS.some(field =>
            Object.prototype.hasOwnProperty.call(existing, field)
        );

        // Jika perubahan lokal sudah berhasil disimpan di browser tetapi
        // request server gagal, jangan timpa nilai baru dengan snapshot
        // server lama saat pengguna login kembali.
        const existingPending = existing?._localPendingSync === true;
        const existingTime = new Date(existing?.updated_at || 0).getTime();
        const incomingTime = new Date(normalized?.updated_at || 0).getTime();

        if (existingPending && incomingTime > 0 && existingTime > incomingTime) {
            byId.set(key, {
                ...existing,
                // Identity/Pagu terbaru tetap boleh disinkronkan dari server.
                pagu_detil: normalized.pagu_detil ?? existing.pagu_detil,
                realisasi: normalized.realisasi ?? existing.realisasi,
                _localPendingSync: true
            });
            return;
        }

        // Jika API lama tidak membawa 48 minggu, jangan menimpa input
        // mingguan yang sudah ada.
        if (existing && existingHasWeekly && !incomingHasWeekly) {
            byId.set(key, {
                ...normalized,
                ...Object.fromEntries(
                    RPD_WEEK_FIELDS.map(field => [field, rpdNumber(existing[field])])
                ),
                tw1:rpdNumber(existing.tw1),
                tw2:rpdNumber(existing.tw2),
                tw3:rpdNumber(existing.tw3),
                tw4:rpdNumber(existing.tw4),
                total_rpd:rpdQuarterTotals(existing).tw1 +
                           rpdQuarterTotals(existing).tw2 +
                           rpdQuarterTotals(existing).tw3 +
                           rpdQuarterTotals(existing).tw4,
                catatan:existing.catatan || normalized.catatan || "",
                _localPendingSync:existingPending
            });
            return;
        }

        // Server yang lebih baru menjadi sumber kebenaran.
        // Hapus penanda pending setelah konfirmasi server berhasil.
        if (
            normalized.updated_at &&
            existingTime > 0 &&
            incomingTime > 0 &&
            incomingTime < existingTime &&
            existingPending
        ) {
            return;
        }

        normalized._localPendingSync = false;
        byId.set(key, normalized);
    });

    rpdExisting = [...byId.values()];
    rpdSaveLocalCache(rpdExisting);
}

function rpdDanaTersedia(row) {
    const pagu = rpdNumber(row?.pagu);
    const realisasi = rpdNumber(row?.realisasi);
    return Math.max(pagu - realisasi, 0);
}

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

function rpdStableId(row) {
    // ID RPD TIDAK boleh bergantung pada PAGU.
    // Revisi Anggaran dapat mengubah Pagu Detil, tetapi RPD
    // yang sudah diinput harus tetap melekat pada item anggaran
    // yang sama.
    const normalize = value => String(value ?? "").trim().toUpperCase().replace(/\s+/g, " ").replace(/\|/g, "/");
    return [
        row.tahun, row.kodeSubKomponen, row.subKomponen, row.akun,
        row.itemAkun, row.detilAkun, row.rincianItem
    ].map(normalize).join("|");
}

function rpdNormalizeSavedRow(row) {
    const source = row && typeof row === "object" ? row : {};
    const normalized = {
        ...source,
        id_rpd:String(source.id_rpd ?? source.ID_RPD ?? "").trim(),
        tw1:rpdNumber(source.tw1 ?? source.TW1 ?? 0),
        tw2:rpdNumber(source.tw2 ?? source.TW2 ?? 0),
        tw3:rpdNumber(source.tw3 ?? source.TW3 ?? 0),
        tw4:rpdNumber(source.tw4 ?? source.TW4 ?? 0),
        catatan:String(source.catatan ?? source.CATATAN ?? "").trim()
    };

    const stableId = rpdStableId({
        tahun: source.tahun ?? source.TAHUN,
        kodeSubKomponen: source.kode_sub_komponen ?? source.KODE_SUB_KOMPONEN,
        subKomponen: source.sub_komponen ?? source.SUB_KOMPONEN,
        akun: source.akun ?? source.AKUN,
        itemAkun: source.item_akun ?? source.ITEM_AKUN,
        detilAkun: source.detil_akun ?? source.DETIL_AKUN,
        rincianItem: source.rincian_item ?? source.RINCIAN_ITEM
    });

    // Record server yang sudah memiliki ID_ANGGARAN permanen
    // mempertahankan ID_RPD yang dikirim server.
    const permanentId = String(
        source.id_anggaran ??
        source.ID_ANGGARAN ??
        ""
    ).trim();

    if (
        !permanentId &&
        stableId &&
        stableId.replace(/\|/g, "") !== ""
    ) {
        normalized.id_rpd = stableId;
    }

    const sourceHasWeeklyFields = rpdHasWeeklyFields(source);
    RPD_WEEK_FIELDS.forEach(key => {
        normalized[key] = rpdNumber(source[key] ?? source[key.toUpperCase()] ?? 0);
    });

    // Hanya record yang benar-benar tidak mempunyai field mingguan
    // yang menjalankan migrasi kompatibilitas TW1-TW4.
    if (!sourceHasWeeklyFields) {
        const legacyQuarterMap = [
            ["tw1", "mar_m4"],
            ["tw2", "jun_m4"],
            ["tw3", "sep_m4"],
            ["tw4", "okt_m4"]
        ];
        legacyQuarterMap.forEach(([quarter, weekField]) => {
            const value = rpdNumber(normalized[quarter]);
            if (value > 0) normalized[weekField] = value;
        });
        normalized._legacyQuarterMapped = true;
    } else {
        normalized._legacyQuarterMapped = false;
    }

    const q=rpdQuarterTotals(normalized);
    normalized.tw1=q.tw1; normalized.tw2=q.tw2; normalized.tw3=q.tw3; normalized.tw4=q.tw4;
    normalized.total_rpd=q.tw1+q.tw2+q.tw3+q.tw4;
    return normalized;
}

function rpdNormalizeExistingRows(value) {
    if (Array.isArray(value)) return value.map(rpdNormalizeSavedRow);
    if (value && typeof value === "object") {
        if (Array.isArray(value.rpd)) return value.rpd.map(rpdNormalizeSavedRow);
        if (Array.isArray(value.data)) return value.data.map(rpdNormalizeSavedRow);
        if (value.id_rpd || value.ID_RPD) return [rpdNormalizeSavedRow(value)];
    }
    return [];
}

function rpdCountTerisi() {
    // "Sudah Diisi" berarti detil yang memiliki TOTAL RPD > 0.
    // Record yang pernah disimpan lalu dikembalikan menjadi 0 tidak
    // dihitung sebagai RPD terisi.
    const countedIds = new Set();

    rpdExisting.forEach(item => {
        const total = rpdQuarterTotals(item).tw1 +
            rpdQuarterTotals(item).tw2 +
            rpdQuarterTotals(item).tw3 +
            rpdQuarterTotals(item).tw4;

        if (total > 0) {
            const id = String(item.id_rpd || "").trim();
            if (id) countedIds.add(id);
        }
    });

    return rpdMasterRows.filter(row =>
        countedIds.has(String(row.id_rpd || "").trim())
    ).length;
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

function rpdRefreshFilters(options = {}) {
    const subSelect = document.getElementById("rpdSubKomponen");
    const akunSelect = document.getElementById("rpdAkun");
    const subValue = subSelect?.value || "";
    const keepAkun = options.keepAkun === true;
    const akunValue = keepAkun ? (akunSelect?.value || "") : "";

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
    rpdPopulateSelect("rpdAkun", akuns, "Semua Akun Belanja");

    // Secara default tampilkan SEMUA akun/detil pada Sub Komponen.
    // Dropdown Akun hanya menjadi filter tambahan.
    if (akunSelect) {
        akunSelect.value = keepAkun && akuns.includes(akunValue) ? akunValue : "";
    }
}

function rpdRenderBudgetWarnings() {
    const box = document.getElementById("rpdBudgetWarning");
    if (!box) return;

    const warnings = [];
    let totalExcess = 0;

    rpdMasterRows.forEach(row => {
        const saved = rpdFindSavedForMaster(row);
        if (!saved) return;

        const q = rpdQuarterTotals(saved);
        const total = q.tw1 + q.tw2 + q.tw3 + q.tw4;
        const pagu = rpdNumber(row.pagu);
        const realisasi = rpdNumber(row.realisasi);
        const danaTersedia = Math.max(pagu - realisasi, 0);
        const excess = total - danaTersedia;

        if (excess > 0) {
            totalExcess += excess;
            warnings.push({
                label: [row.itemAkun, row.akun, row.detilAkun, row.rincianItem]
                    .filter(Boolean).join(" — "),
                excess: excess
            });
        }
    });

    if (!warnings.length) {
        box.classList.add("d-none");
        box.innerHTML = "";
        return;
    }

    const detail = warnings.slice(0, 5).map(item =>
        '<div class="small mt-1">• ' +
        rpdEsc(item.label || "Detil Anggaran") +
        ': kelebihan ' + rpdFormatRupiah(item.excess) +
        '</div>'
    ).join("");

    const more = warnings.length > 5
        ? '<div class="small mt-1">dan ' + (warnings.length - 5) + ' detil lainnya...</div>'
        : "";

    box.className = "alert alert-warning mt-2";
    box.innerHTML =
        '<strong><i class="bi bi-exclamation-triangle"></i> Perlu Penyesuaian RPD</strong>' +
        '<div class="small mt-1">Ada ' + warnings.length.toLocaleString("id-ID") +
        ' detil yang RPD-nya melebihi dana tersedia setelah realisasi. Total kelebihan ' +
        rpdFormatRupiah(totalExcess) +
        '. Silakan buka Input/Edit pada detil terkait dan sesuaikan kembali RPD.</div>' +
        detail + more;
}

function rpdRenderDetilTable() {
    const tbody=document.getElementById("rpdTableBody"); if(!tbody)return;
    const rows=rpdGetFilteredRows();
    if(!rows.length){
        tbody.innerHTML='<tr><td colspan="10" class="text-center text-muted py-4">Pilih Sub Komponen dan/atau Akun untuk menampilkan Detil.</td></tr>';
        rpdRenderBudgetWarnings();
        return;
    }
    tbody.innerHTML=rows.map(row=>{
        const saved=rpdFindSavedForMaster(row)||RPD_EMPTY, q=rpdQuarterTotals(saved);
        const realisasi=rpdNumber(row.realisasi);
        const danaTersedia=rpdDanaTersedia(row);
        const total=q.tw1+q.tw2+q.tw3+q.tw4, sisa=Math.max(danaTersedia-total,0);
        return '<tr><td><strong>'+rpdEsc(row.itemAkun?row.itemAkun+" — ":"")+rpdEsc(row.akun)+'</strong><div class="small text-muted">'+(row.detilAkun?'Detil: '+rpdEsc(row.detilAkun):'Detil: -')+'</div><div class="small">'+(row.rincianItem?'Rincian: '+rpdEsc(row.rincianItem):'')+'</div></td>'+
        '<td class="text-end">'+rpdFormatRupiah(row.pagu)+'</td><td class="text-end">'+rpdFormatRupiah(realisasi)+'</td><td class="text-end">'+rpdFormatRupiah(danaTersedia)+'</td><td class="text-end">'+rpdFormatRupiah(q.tw1)+'</td><td class="text-end">'+rpdFormatRupiah(q.tw2)+'</td><td class="text-end">'+rpdFormatRupiah(q.tw3)+'</td><td class="text-end">'+rpdFormatRupiah(q.tw4)+'</td><td class="text-end fw-bold">'+rpdFormatRupiah(total)+'</td><td class="text-end">'+rpdFormatRupiah(sisa)+'</td>'+
        '<td><button type="button" class="btn btn-sm btn-success rpd-edit-btn" data-rpd-id="'+rpdEsc(row.id_rpd)+'"><i class="bi bi-pencil-square"></i> Input/Edit</button></td></tr>';
    }).join("");
    tbody.querySelectorAll(".rpd-edit-btn").forEach(button=>button.addEventListener("click",function(){rpdOpenEditor(this.dataset.rpdId);}));
    rpdRenderBudgetWarnings();
}

function rpdFindSavedForMaster(masterRow) {
    const permanentId = String(
        masterRow?.id_anggaran ||
        masterRow?.ID_ANGGARAN ||
        ""
    ).trim();

    if (permanentId) {
        const byPermanentId = rpdExisting.find(item =>
            String(item.id_anggaran || item.ID_ANGGARAN || "").trim() === permanentId
        );
        if (byPermanentId) return byPermanentId;
    }

    // ID_RPD tetap dipakai untuk kompatibilitas.
    const exact = rpdExisting.find(item =>
        String(item.id_rpd || "").trim() === String(masterRow.id_rpd || "").trim()
    );
    if (exact) return exact;

    // Kompatibilitas hanya untuk record lama: seluruh identitas baris harus cocok.
    const same = rpdExisting.filter(item =>
        String(item.tahun ?? "") === String(masterRow.tahun ?? "") &&
        String(item.kode_sub_komponen ?? "").trim() === String(masterRow.kodeSubKomponen ?? "").trim() &&
        String(item.sub_komponen ?? "").trim() === String(masterRow.subKomponen ?? "").trim() &&
        String(item.akun ?? item.AKUN ?? "").trim() === String(masterRow.akun ?? "").trim() &&
        String(item.item_akun ?? "").trim() === String(masterRow.itemAkun ?? "").trim() &&
        String(item.detil_akun ?? "").trim() === String(masterRow.detilAkun ?? "").trim() &&
        String(item.rincian_item ?? "").trim() === String(masterRow.rincianItem ?? "").trim()
    );
    return same.length === 1 ? same[0] : null;
}

function rpdOpenEditor(id) {
    const row=rpdMasterRows.find(r=>String(r.id_rpd)===String(id)); if(!row)return;
    const saved=rpdFindSavedForMaster(row)||RPD_EMPTY; rpdCurrentSelection=row;
    rpdOriginalWeekly = Object.fromEntries(RPD_WEEK_FIELDS.map(key => [key, rpdNumber(saved?.[key])]));
    rpdOriginalCatatan = String(saved?.catatan || "");
    document.getElementById("rpdEditId").value=row.id_rpd;
    document.getElementById("rpdEditLabel").textContent=row.detilAkun||"-";
    document.getElementById("rpdEditSub").textContent=row.subKomponen||"-";
    document.getElementById("rpdEditAkun").textContent=row.akun||"-";
    document.getElementById("rpdEditItem").textContent=row.itemAkun||"-";
    document.getElementById("rpdEditRincian").textContent=row.rincianItem?"Rincian: "+row.rincianItem:"";
    document.getElementById("rpdEditPagu").textContent=rpdFormatRupiah(row.pagu);
    const realisasi=rpdNumber(row.realisasi);
    const danaTersedia=rpdDanaTersedia(row);
    const realisasiEl=document.getElementById("rpdEditRealisasi");
    const danaTersediaEl=document.getElementById("rpdEditDanaTersedia");
    if(realisasiEl) realisasiEl.textContent=rpdFormatRupiah(realisasi);
    if(danaTersediaEl) danaTersediaEl.textContent=rpdFormatRupiah(danaTersedia);
    RPD_WEEK_FIELDS.forEach(key=>{const el=document.getElementById("rpd_"+key);if(el)el.value=rpdNumber(saved[key])||"";});
    document.getElementById("rpdCatatan").value=saved.catatan||"";
    rpdUpdateEditorTotal();
    new bootstrap.Modal(document.getElementById("rpdEditorModal")).show();
}

function rpdUpdateEditorTotal() {
    const pagu=rpdNumber(rpdCurrentSelection?.pagu);
    const realisasi=rpdNumber(rpdCurrentSelection?.realisasi);
    const danaTersedia=Math.max(pagu-realisasi,0);
    const q={1:0,2:0,3:0,4:0};
    let total=0, negative=false;
    RPD_MONTHS.forEach(month=>{for(let week=1;week<=4;week++){const v=rpdNumber(document.getElementById("rpd_"+month.key+"_m"+week)?.value);q[month.tw]+=v;total+=v;if(v<0)negative=true;}});
    const excess=Math.max(total-danaTersedia,0);
    // Kelebihan RPD tetap boleh disimpan agar operator dapat memperbaikinya
    // setelah Revisi Anggaran; sistem hanya memberi peringatan.
    const valid=!negative;
    ["rpdTw1Summary","rpdTw2Summary","rpdTw3Summary","rpdTw4Summary"].forEach((id,i)=>document.getElementById(id).textContent=rpdFormatRupiah(q[i+1]));
    document.getElementById("rpdEditTotal").textContent=rpdFormatRupiah(total);
    document.getElementById("rpdEditSisa").textContent=rpdFormatRupiah(Math.max(danaTersedia-total,0));
    const state=document.getElementById("rpdEditValidation");
    state.className="small mt-2 "+(valid?"text-success":"text-danger");
    state.className="small mt-2 "+(negative?"text-danger":(excess>0?"text-warning":"text-success"));
    state.textContent=negative
        ? "Tidak valid: nilai mingguan tidak boleh negatif."
        : (excess>0
            ? "Peringatan: RPD melebihi dana tersedia sebesar " + rpdFormatRupiah(excess) + ". Nilai tetap dapat disimpan dan dapat disesuaikan kembali."
            : "Valid: RPD sesuai dengan dana tersedia setelah Realisasi.");
    document.getElementById("rpdSaveButton").disabled=negative;
}

function rpdResetEditor() {
    if (!rpdCurrentSelection) return;

    RPD_WEEK_FIELDS.forEach(key => {
        const el = document.getElementById("rpd_" + key);
        if (el) el.value = rpdNumber(rpdOriginalWeekly[key]) || "";
    });

    const catatan = document.getElementById("rpdCatatan");
    if (catatan) catatan.value = rpdOriginalCatatan || "";

    rpdUpdateEditorTotal();
    rpdSetStatus("Input dikembalikan ke nilai RPD terakhir tersimpan.", "info");
}

async function rpdSave() {
    if(!rpdCurrentSelection||!rpdUser)return;
    const payload={id_rpd:rpdCurrentSelection.id_rpd,id_anggaran:rpdCurrentSelection.id_anggaran || "",tahun:rpdCurrentSelection.tahun,kode_sub_komponen:rpdCurrentSelection.kodeSubKomponen,sub_komponen:rpdCurrentSelection.subKomponen,akun:rpdCurrentSelection.akun,item_akun:rpdCurrentSelection.itemAkun,detil_akun:rpdCurrentSelection.detilAkun,rincian_item:rpdCurrentSelection.rincianItem,pagu_detil:rpdCurrentSelection.pagu,catatan:document.getElementById("rpdCatatan").value.trim()};
    RPD_WEEK_FIELDS.forEach(key=>payload[key]=rpdNumber(document.getElementById("rpd_"+key)?.value));

    // Semua nilai dari 48 minggu dipertahankan.
    // Operator dapat mengisi beberapa bulan dan beberapa minggu sekaligus.
    // Menambah nilai pada minggu/bulan lain TIDAK lagi memindahkan atau
    // menghapus nilai minggu yang sudah ada.
    const total=RPD_WEEK_FIELDS.reduce((sum,key)=>sum+payload[key],0);
    if(RPD_WEEK_FIELDS.some(key=>payload[key]<0)){rpdSetStatus("Nilai RPD mingguan tidak boleh negatif.","danger");return;}
    const realisasiTerkini=rpdNumber(rpdCurrentSelection?.realisasi);
    const danaTersedia=Math.max(rpdNumber(payload.pagu_detil)-realisasiTerkini,0);
    const rpdExcess=Math.max(total-danaTersedia,0);
    const q={1:0,2:0,3:0,4:0};
    RPD_MONTHS.forEach(month=>{for(let week=1;week<=4;week++)q[month.tw]+=payload[month.key+"_m"+week];});
    payload.tw1=q[1];payload.tw2=q[2];payload.tw3=q[3];payload.tw4=q[4];payload.total_rpd=total;
    const button=document.getElementById("rpdSaveButton");button.disabled=true;button.innerHTML='<span class="spinner-border spinner-border-sm"></span> Menyimpan...';
    const localSaved=rpdNormalizeSavedRow({
        ...payload,
        // Tandai sebagai perubahan lokal sampai server mengonfirmasi.
        updated_at: new Date().toISOString(),
        _localPendingSync: true
    });

    // Simpan ke cache lokal SEBELUM menghubungi API.
    // Dengan demikian input 48-minggu tidak hilang hanya karena
    // Apps Script sedang gagal merespons. Data lokal juga dapat
    // langsung dipakai untuk preview/cetak.
    rpdMergeSavedRows([localSaved]);
    rpdRenderDetilTable();
    document.getElementById("rpdTotalTerisi").textContent =
        rpdCountTerisi().toLocaleString("id-ID");

    try{
        const result=await rpdApiRequest("save",{id_token:rpdUser.id_token,row:payload});
        if(!result.ok)throw new Error(result.message||"Data RPD gagal disimpan.");

        // API boleh mengembalikan record tersimpan; jika API lama hanya
        // mengembalikan TW1-TW4, rpdMergeSavedRows() menjaga posisi
        // 48-minggu yang sudah tersimpan di cache lokal.
        const serverSavedRows = rpdNormalizeExistingRows(result.data??result.rpd??result).map(item => ({
            ...item,
            _localPendingSync: false
        }));
        rpdMergeSavedRows(serverSavedRows);
        rpdRenderDetilTable();
        rpdOriginalWeekly = Object.fromEntries(RPD_WEEK_FIELDS.map(key => [key, rpdNumber(localSaved?.[key])]));
        rpdOriginalCatatan = String(localSaved?.catatan || "");

        bootstrap.Modal.getInstance(document.getElementById("rpdEditorModal"))?.hide();
        rpdSetStatus(
            result.warning
                ? result.warning
                : (rpdExcess > 0
                    ? "RPD berhasil disimpan dengan peringatan kelebihan " + rpdFormatRupiah(rpdExcess) + ". Silakan sesuaikan kembali."
                    : "RPD berhasil disimpan ke server."),
            rpdExcess > 0 ? "warning" : "success"
        );
    }catch(error){
        console.error(error);

        // Jangan hapus cache lokal. Pengguna tetap dapat melihat dan
        // mencetak input yang baru saja dibuat. Beri status jelas bahwa
        // sinkronisasi server belum berhasil.
        bootstrap.Modal.getInstance(document.getElementById("rpdEditorModal"))?.hide();
        rpdSetStatus(
            "RPD tersimpan di browser, tetapi belum tersinkron ke server: " +
            (error.message || "API RPD gagal dihubungi."),
            "warning"
        );
    }finally{
        button.disabled=false;
        button.innerHTML='<i class="bi bi-save"></i> Simpan RPD';
    }
}



function rpdGetPrintRows() {
    const masterById = new Map(
        rpdMasterRows.map(row => [String(row.id_rpd || ""), row])
    );

    return rpdExisting
        .map(saved => {
            const master = masterById.get(String(saved.id_rpd || ""));
            // Cetak hanya record yang masih mempunyai pasangan pada
            // MASTER RPD terbaru. Record lama yang tersisa di cache lokal
            // tidak boleh ikut teragregasi ke laporan cetak.
            if (!master) return null;

            return {
                ...master,
                ...saved,
                kodeKomponen: saved.kode_komponen || saved.kodeKomponen || master.kodeKomponen || "",
                komponen: saved.komponen || master.komponen || "",
                subKomponen: saved.sub_komponen || saved.subKomponen || master.subKomponen || "",
                kodeSubKomponen: saved.kode_sub_komponen || saved.kodeSubKomponen || master.kodeSubKomponen || "",
                akun: saved.akun || master.akun || "",
                itemAkun: saved.item_akun || saved.itemAkun || master.itemAkun || "",
                detilAkun: saved.detil_akun || saved.detilAkun || master.detilAkun || "",
                rincianItem: saved.rincian_item || saved.rincianItem || master.rincianItem || "",
                pagu: rpdNumber(saved.pagu_detil ?? saved.pagu ?? master.pagu ?? 0)
            };
        })
        .filter(Boolean)
        .filter(row => {
            const q = rpdQuarterTotals(row);
            return (q.tw1 + q.tw2 + q.tw3 + q.tw4) > 0;
        });
}

function rpdPrintAll() {
    const rows = rpdGetPrintRows();

    if (!rows.length) {
        rpdSetStatus("Belum ada RPD yang terisi untuk dicetak.", "warning");
        return;
    }

    // Format cetak matriks:
    // No | Komponen | Sub Komponen | Bulan (M1-M4 + Jumlah) | Total Triwulan.
    // Hanya bulan yang benar-benar mempunyai nilai RPD yang ditampilkan,
    // sehingga hasil tetap terbaca pada kertas A4 landscape.
    const grouped = new Map();

    rows.forEach(row => {
        const componentCode = String(row.kodeKomponen || "").trim();
        const componentName = String(row.komponen || "").trim();
        const subCode = String(row.kodeSubKomponen || "").trim();
        const subName = String(row.subKomponen || "Sub Komponen Tidak Diketahui").trim();

        const key = [componentCode, componentName, subCode, subName].join("|");
        if (!grouped.has(key)) {
            grouped.set(key, {
                componentCode,
                componentName,
                subCode,
                subName,
                months: Object.fromEntries(
                    RPD_MONTHS.map(month => [month.key, [0,0,0,0]])
                )
            });
        }

        const bucket = grouped.get(key);
        RPD_MONTHS.forEach(month => {
            for (let week = 1; week <= 4; week++) {
                bucket.months[month.key][week - 1] +=
                    rpdNumber(row[month.key + "_m" + week]);
            }
        });
    });

    const activeMonths = RPD_MONTHS.filter(month =>
        [...grouped.values()].some(bucket =>
            bucket.months[month.key].some(value => value > 0)
        )
    );

    if (!activeMonths.length) {
        rpdSetStatus("Belum ada nilai RPD mingguan yang lebih besar dari Rp0 untuk dicetak.", "warning");
        return;
    }

    const activeQuarterNumbers = [...new Set(activeMonths.map(month => month.tw))];
    const yearSet = [...new Set(
        rows.map(row => String(row.tahun || "").trim()).filter(Boolean)
    )];
    const yearLabel = yearSet.length === 1 ? yearSet[0] : yearSet.join(", ");

    const formatPrintNumber = value => {
        const n = Math.round(Number(value) || 0);
        return n > 0 ? n.toLocaleString("id-ID") : "-";
    };

    const quarterTotal = (bucket, quarter) =>
        RPD_MONTHS
            .filter(month => month.tw === quarter)
            .reduce((sum, month) =>
                sum + bucket.months[month.key].reduce((a, b) => a + b, 0), 0
            );

    const grandTotal = [...grouped.values()].reduce(
        (sum, bucket) =>
            sum + activeMonths.reduce(
                (s, month) => s + bucket.months[month.key].reduce((a,b) => a+b, 0),
                0
            ),
        0
    );

    const totalWeeklyRows = rows.reduce((count, row) =>
        count + RPD_WEEK_FIELDS.filter(key => rpdNumber(row[key]) > 0).length, 0
    );

    const colCount = 3 + activeMonths.length * 5 + activeQuarterNumbers.length;
    const headRow1 = [
        '<th rowspan="2" class="no">No</th>',
        '<th rowspan="2" class="component">Komponen</th>',
        '<th rowspan="2" class="subcomponent">Sub Komponen</th>'
    ];

    activeMonths.forEach(month => {
        headRow1.push(
            '<th colspan="5" class="month-head">' + rpdEsc(month.label) + '</th>'
        );
    });

    activeQuarterNumbers.forEach(q => {
        headRow1.push(
            '<th rowspan="2" class="quarter-total-head"><span>Total</span><br>Triwulan ' +
            ["I","II","III","IV"][q - 1] + '</th>'
        );
    });

    const headRow2 = [];
    activeMonths.forEach(() => {
        headRow2.push(
            '<th>Minggu 1</th><th>Minggu 2</th><th>Minggu 3</th><th>Minggu 4</th><th>Jumlah</th>'
        );
    });

    let number = 0;
    const bodyRows = [];

    grouped.forEach(bucket => {
        number++;
        const cells = [
            '<td class="no">' + number + '</td>',
            '<td class="component">' + rpdEsc(
                bucket.componentCode && bucket.componentName
                    ? bucket.componentCode + " - " + bucket.componentName
                    : (bucket.componentName || bucket.componentCode || "-")
            ) + '</td>',
            '<td class="subcomponent">' + rpdEsc(
                bucket.subCode && bucket.subName
                    ? bucket.subCode + " - " + bucket.subName
                    : bucket.subName
            ) + '</td>'
        ];

        activeMonths.forEach(month => {
            const weeks = bucket.months[month.key];
            const monthTotal = weeks.reduce((a,b) => a+b, 0);
            weeks.forEach(value => {
                cells.push('<td class="num">' + formatPrintNumber(value) + '</td>');
            });
            cells.push('<td class="num total-month">' + formatPrintNumber(monthTotal) + '</td>');
        });

        activeQuarterNumbers.forEach(q => {
            cells.push(
                '<td class="num total-quarter">' +
                formatPrintNumber(quarterTotal(bucket, q)) +
                '</td>'
            );
        });

        bodyRows.push('<tr>' + cells.join("") + '</tr>');
    });

    // Baris total seluruh Sub Komponen.
    const totalCells = [
        '<td colspan="3" class="grand-label">TOTAL</td>'
    ];

    activeMonths.forEach(month => {
        const weeks = [0,0,0,0];
        [...grouped.values()].forEach(bucket => {
            bucket.months[month.key].forEach((value, index) => weeks[index] += value);
        });
        const monthTotal = weeks.reduce((a,b) => a+b, 0);
        weeks.forEach(value => {
            totalCells.push('<td class="num grand-total">' + formatPrintNumber(value) + '</td>');
        });
        totalCells.push('<td class="num grand-total">' + formatPrintNumber(monthTotal) + '</td>');
    });

    activeQuarterNumbers.forEach(q => {
        totalCells.push(
            '<td class="num grand-total">' +
            formatPrintNumber(
                [...grouped.values()].reduce((sum, bucket) => sum + quarterTotal(bucket, q), 0)
            ) +
            '</td>'
        );
    });

    bodyRows.push('<tr class="grand-row">' + totalCells.join("") + '</tr>');

    const generated = new Date().toLocaleString("id-ID");
    const printWindow = window.open("", "_blank", "width=1500,height=900");

    if (!printWindow) {
        rpdSetStatus("Jendela cetak diblokir browser. Izinkan pop-up untuk halaman ini lalu coba lagi.", "warning");
        return;
    }

    printWindow.document.open();
    printWindow.document.write(
        '<!DOCTYPE html><html lang="id"><head><meta charset="UTF-8">' +
        '<title>RPD Matriks P3HPL</title>' +
        '<style>' +
        '@page{size:A4 landscape;margin:8mm}' +
        '*{box-sizing:border-box}' +
        'body{font-family:Arial,Helvetica,sans-serif;color:#111;font-size:8.5px;margin:0}' +
        'h1{font-size:16px;margin:0 0 2px;text-align:center;font-weight:700}' +
        'h2{font-size:11px;margin:0 0 7px;text-align:center;font-weight:normal}' +
        '.meta{display:flex;justify-content:space-between;border-bottom:1px solid #777;padding-bottom:5px;margin-bottom:7px;font-size:8px}' +
        'table{width:100%;border-collapse:collapse;table-layout:fixed}' +
        'th,td{border:1px solid #777;padding:3px 4px;vertical-align:middle}' +
        'th{background:#d9dde3;text-align:center;font-weight:700;line-height:1.15}' +
        'thead th.month-head{font-size:9px}' +
        'thead th.quarter-total-head{font-size:8px;white-space:nowrap}' +
        '.no{width:3%;text-align:center}' +
        '.component{width:13%;white-space:normal;word-break:break-word}' +
        '.subcomponent{width:16%;white-space:normal;word-break:break-word}' +
        '.num{text-align:right;white-space:nowrap}' +
        '.total-month,.total-quarter{font-weight:700}' +
        '.grand-row td{font-weight:700;background:#e5e7eb}' +
        '.grand-label{text-align:right}' +
        '.footer{margin-top:7px;font-size:7.5px;color:#555}' +
        '.sign{margin-top:18px;display:flex;justify-content:flex-end}' +
        '.sign-box{width:190px;text-align:center;font-size:8px}' +
        '.page-break{page-break-after:always}' +
        '@media print{thead{display:table-header-group}tr{break-inside:avoid}}' +
        '</style></head><body>' +
        '<h1>RENCANA PENARIKAN DANA (RPD)</h1>' +
        '<h2>P3HPL — BPHL XI Banjarbaru</h2>' +
        '<div class="meta">' +
        '<div><strong>Tahun Anggaran:</strong> ' + rpdEsc(yearLabel || "-") + '</div>' +
        '<div><strong>Dicetak:</strong> ' + rpdEsc(generated) + '</div>' +
        '</div>' +
        '<table>' +
        '<thead><tr>' + headRow1.join("") + '</tr><tr>' + headRow2.join("") + '</tr></thead>' +
        '<tbody>' + bodyRows.join("") + '</tbody>' +
        '</table>' +
        '<div class="footer">RPD merupakan rencana penarikan dana. Nilai pada laporan merupakan agregasi seluruh Detil Akun/Rincian Item pada masing-masing Komponen, Sub Komponen, Bulan, dan Minggu.</div>' +
        '<div class="footer"><strong>Jumlah Sub Komponen:</strong> ' + grouped.size.toLocaleString("id-ID") +
        ' &nbsp;&nbsp; <strong>Jumlah Baris Mingguan:</strong> ' + totalWeeklyRows.toLocaleString("id-ID") +
        ' &nbsp;&nbsp; <strong>Total RPD:</strong> ' + formatPrintNumber(grandTotal) + '</div>' +
        '<div class="sign"><div class="sign-box">Mengetahui,<br><br><br>____________________________<br>Pejabat yang berwenang</div></div>' +
        '<script>window.onload=function(){setTimeout(function(){window.print();},350);};<\\/script>' +
        '</body></html>'
    );
    printWindow.document.close();
}

function rpdBuildMasterRows(rawData) {
    if (!Array.isArray(rawData) || !rawData.length) return [];

    // DATA_APLIKASI dapat berasal dari Google Sheet yang memakai sel
    // ter-merge/fill-down: Sub Komponen, Item Akun, Akun Belanja, atau
    // Detil Akun tidak selalu diulang pada setiap baris rincian.
    //
    // Aturan RPD:
    // 1. Parent hierarchy boleh di-fill-down sampai ada parent baru.
    // 2. Detil Akun hanya di-fill-down jika baris tersebut mempunyai Rincian Item.
    // 3. Rincian Item dan Pagu selalu diambil dari BARIS AKTUAL.
    // 4. Tidak melakukan deduplikasi: setiap baris anggaran menjadi satu record RPD.
    // 5. Baris Diblokir tidak menjadi master RPD.

    const norm = value => String(value ?? "")
        .trim()
        .toLowerCase()
        .replace(/\s+/g, " ")
        .replace(/[._-]/g, " ");

    const headers = rawData.find(row =>
        Array.isArray(row) && row.some(v => norm(v) === "pagu")
    );
    if (!headers) return [];

    const map = {};
    headers.forEach((v, i) => {
        const k = norm(v);
        if (k) map[k] = i;
    });

    const idx = aliases => {
        for (const a of aliases) {
            const k = norm(a);
            if (Object.prototype.hasOwnProperty.call(map, k)) return map[k];
        }
        return -1;
    };

    const get = (row, aliases) => {
        const i = idx(aliases);
        return i >= 0 ? String(row[i] ?? "").trim() : "";
    };

    const money = value => {
        if (value === null || value === undefined || value === "") return 0;
        let s = String(value).replace(/Rp/gi, "").trim();
        s = s.replace(/[^0-9,.-]/g, "");
        if (s.includes(".") && s.includes(",")) {
            s = s.replace(/\./g, "").replace(",", ".");
        } else if (/^\d{1,3}(\.\d{3})+$/.test(s)) {
            s = s.replace(/\./g, "");
        } else {
            s = s.replace(/,/g, "");
        }
        return Number(s) || 0;
    };

    const headerIndex = rawData.indexOf(headers);
    const serverMasterRows =
        Array.isArray(rawData.__anggaranMaster)
            ? rawData.__anggaranMaster
            : [];

    const serverMasterByRow = new Map(
        serverMasterRows
            .filter(item => item && item.rowIndex !== undefined)
            .map(item => [String(item.rowIndex), item])
    );

    // ID_ANGGARAN menjadi relasi utama. Buat juga lookup berdasarkan ID
    // agar realisasi final dari server tetap dapat diterapkan walaupun
    // posisi/baris CSV berubah.
    const serverMasterById = new Map(
        serverMasterRows
            .filter(item => item && item.id_anggaran)
            .map(item => [String(item.id_anggaran).trim(), item])
    );

    const out = [];

    let currentKodeKomponen = "";
    let currentKomponen = "";
    let currentSub = "";
    let currentKodeSub = "";
    let currentAkun = "";
    let currentItem = "";
    let currentDetil = "";

    for (let i = headerIndex + 1; i < rawData.length; i++) {
        const row = Array.isArray(rawData[i]) ? rawData[i] : [];
        if (!row.length || !row.some(v => String(v ?? "").trim() !== "")) continue;

        const rowKodeKomponen = get(row, ["Kode Komponen", "KodeKomponen"]);
        const rowKomponen = get(row, ["Komponen", "Nama Komponen"]);
        const rowSub = get(row, ["Sub Komponen", "Subkomponen", "Nama Sub Komponen"]);
        const rowKodeSub = get(row, ["Kode Sub Komponen", "KodeSubKomponen"]);
        const rowAkun = get(row, ["Akun Belanja", "Akun"]);
        const rowItem = get(row, ["Item Akun", "Item"]);
        const rowDetil = get(row, ["Detil Akun", "Detail Akun", "Detil"]);
        const rowRincian = get(row, ["Rincian Item", "Rincian"]);
        const status = get(row, ["Status Pagu", "Status"]).toLowerCase();
        const pagu = money(get(row, ["Pagu"]));


        // Komponen mengikuti struktur parent DATA_APLIKASI.
        if (rowKodeKomponen) currentKodeKomponen = rowKodeKomponen;
        if (rowKomponen) currentKomponen = rowKomponen;

        // Parent baru memutus konteks Detil sebelumnya.
        if (rowSub) {
            currentSub = rowSub;
            currentKodeSub = rowKodeSub || rowSub;
            currentAkun = "";
            currentItem = "";
            currentDetil = "";
        } else if (rowKodeSub) {
            currentKodeSub = rowKodeSub;
        }

        if (rowAkun) {
            currentAkun = rowAkun;
            currentItem = "";
            currentDetil = "";
        }

        if (rowItem) {
            currentItem = rowItem;
            currentDetil = "";
        }

        // Detil Akun boleh menjadi header yang kemudian diikuti beberapa
        // Rincian Item. Simpan sebagai konteks untuk baris rincian berikutnya.
        if (rowDetil) {
            currentDetil = rowDetil;
        }

        const sub = currentSub;
        const kodeSub = currentKodeSub || sub;
        const akun = currentAkun;
        const item = currentItem;
        const detil = rowDetil || currentDetil;
        const rincian = rowRincian;

        if (status.includes("blok")) continue;
        if (!sub || !akun || pagu <= 0) continue;

        // Rincian Item adalah leaf. Untuk akun yang tidak memiliki Rincian,
        // Detil Akun tetap menjadi leaf.
        const leaf = rincian || detil || "";
        if (!leaf) continue;

        const stableId = rpdStableId({
            tahun: get(row, ["Tahun", "Tahun Anggaran"]) || new Date().getFullYear(),
            kodeSubKomponen: kodeSub,
            subKomponen: sub,
            akun: akun,
            itemAkun: item || "",
            detilAkun: detil || "",
            rincianItem: rincian || ""
        });

        const serverMaster = serverMasterByRow.get(String(i));
        const idAnggaran =
            get(row, ["ID_ANGGARAN", "ID ANGGARAN"]) ||
            String(serverMaster?.id_anggaran || "").trim() ||
            stableId;

        out.push({
            rowIndex: i,
            sourceFormat: "RPD_RAW",
            id_rpd: serverMaster?.id_rpd || stableId,
            id_anggaran: idAnggaran,
            tahun: get(row, ["Tahun", "Tahun Anggaran"]) || new Date().getFullYear(),
            kodeKomponen: currentKodeKomponen,
            komponen: currentKomponen,
            kodeSubKomponen: kodeSub,
            subKomponen: sub,
            akun: akun,
            itemAkun: item || "",
            detilAkun: detil || "",
            rincianItem: rincian || "",
            pagu: pagu,
            realisasi: money(get(row, ["Realisasi", "Jumlah Realisasi"]))
        });

        const last = out[out.length - 1];
        const serverByRow = serverMasterByRow.get(String(i));
        const serverById = serverMasterById.get(String(last.id_anggaran || "").trim());
        const authoritativeMaster = serverByRow || serverById;

        if (authoritativeMaster) {
            // RPD harus memakai Realisasi Final:
            // Realisasi Dasar DATA_APLIKASI + Input Realisasi aktif.
            // Pagu tetap berasal dari baris DATA_APLIKASI terbaru.
            last.realisasiDasar =
                Number(authoritativeMaster.realisasiDasar) ||
                Math.max(
                    Number(last.realisasi) || 0,
                    0
                );

            last.realisasiInput =
                Number(authoritativeMaster.realisasiInput) || 0;

            last.realisasi =
                Number(authoritativeMaster.realisasi) ||
                (
                    last.realisasiDasar +
                    last.realisasiInput
                );

            last.sisa =
                Math.max(
                    Number(last.pagu) - last.realisasi,
                    0
                );
        }
    }

    console.log("RPD MASTER ROWS:", out.length);
    console.log("RPD SUB KOMPONEN:", new Set(out.map(r => r.subKomponen)).size);
    console.log("RPD AKUN BELANJA:", new Set(out.map(r => r.akun)).size);

    return out;
}

async function rpdInitData() {
    rpdUser = rpdGetStoredUser();

    // Reset cache generasi lama sebelum membaca master/RPD.
    rpdClearLegacyCaches();

    if (!rpdUser) return;

    if (!RPD_CONFIG.RPD_API_URL) {
        rpdSetStatus("RPD_API_URL belum dikonfigurasi.", "warning");
        return;
    }

    rpdSetLoading(true);

    try {
        // MASTER RPD mengikuti DATA_APLIKASI, tetapi gunakan cache master
        // terlebih dahulu agar halaman langsung tampil. DATA_APLIKASI tetap
        // diperbarui di background untuk menjaga data tetap mutakhir.
        let builtMaster = rpdLoadMasterCache();
        let rawData = null;

        if (Array.isArray(builtMaster) && builtMaster.length) {
            rpdMasterRows = builtMaster;
        } else {
            rawData = await getSheetData();
            builtMaster = rpdBuildMasterRows(rawData);
        }

        // Fallback ke parser utama jika format sheet sudah flat.
        if (!builtMaster.length) {
            const parsed = typeof parseDataAplikasi === "function"
                ? (parseDataAplikasi(rawData) || [])
                : [];

            builtMaster = parsed
                .filter(row => row && row.statusPagu !== "Diblokir")
                .filter(row => row.subKomponen && row.subKomponen !== "-")
                .filter(row => row.akun && row.akun !== "-")
                .filter(row => row.detilAkun && row.detilAkun !== "-")
                .map(row => ({
                    ...row,
                    id_rpd: rpdStableId({ tahun: row.tahun || new Date().getFullYear(), kodeSubKomponen: row.kodeSubKomponen || row.subKomponen, subKomponen: row.subKomponen, akun: row.akun, itemAkun: row.itemAkun || "", detilAkun: row.detilAkun, rincianItem: row.rincianItem || "", pagu: Number(row.pagu) || 0 }),
                    tahun: row.tahun || new Date().getFullYear(),
                    kodeSubKomponen: row.kodeSubKomponen || row.subKomponen,
                    subKomponen: row.subKomponen,
                    akun: row.akun,
                    itemAkun: row.itemAkun || "",
                    detilAkun: row.detilAkun,
                    pagu: Number(row.pagu) || 0,
                    realisasi: Number(row.realisasi) || 0
                }));
        }

        rpdMasterRows = builtMaster;
        rpdSaveMasterCache(rpdMasterRows);

        // Tampilkan cache RPD lebih dulu agar halaman tidak menunggu API.
        rpdExisting = rpdLoadLocalCache();
        rpdRefreshFilters({ keepAkun: false });
        rpdRenderDetilTable();

        // Jika master berasal dari cache, refresh DATA_APLIKASI di background.
        // Kegagalan refresh tidak mengganggu tampilan yang sudah tersedia.
        if (rawData === null) {
            getSheetData().then(freshRaw => {
                const freshMaster = rpdBuildMasterRows(freshRaw);
                if (freshMaster.length) {
                    rpdMasterRows = freshMaster;
                    rpdSaveMasterCache(freshMaster);
                    rpdRefreshFilters({ keepAkun: true });
                    rpdRenderDetilTable();
                    document.getElementById("rpdTotalDetil").textContent =
                        rpdMasterRows.length.toLocaleString("id-ID");
                }
            }).catch(error => console.warn("Refresh master RPD background gagal:", error));
        }

        // Ambil RPD tersimpan dari API secara background. API tidak lagi
        // membangun MASTER dari DATA_APLIKASI sehingga jauh lebih ringan.
        try {
            const result = await rpdApiRequest("list", { id_token: rpdUser.id_token });
            rpdMergeSavedRows(result.rpd ?? result.data ?? result);
            rpdRenderDetilTable();
        } catch (apiError) {
            console.warn("List RPD dari API gagal; cache lokal tetap digunakan:", apiError);
            if (rpdExisting.length) {
                rpdSetStatus("RPD ditampilkan dari cache terakhir. Sinkronisasi server gagal.", "warning");
            }
        }

        document.getElementById("rpdTotalDetil").textContent =
            rpdMasterRows.length.toLocaleString("id-ID");

        document.getElementById("rpdTotalTerisi").textContent =
            rpdCountTerisi().toLocaleString("id-ID");

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
    RPD_WEEK_FIELDS.forEach(key => {
        document.getElementById("rpd_"+key)?.addEventListener("input", rpdUpdateEditorTotal);
    });
    document.getElementById("rpdSubKomponen")?.addEventListener("change", function () {
        // Reset Akun setiap kali Sub Komponen berubah agar seluruh
        // daftar Akun pada Sub Komponen tersebut dimuat ulang.
        const akun = document.getElementById("rpdAkun");
        if (akun) akun.value = "";
        rpdRefreshFilters();
        rpdRenderDetilTable();
    });    document.getElementById("rpdAkun")?.addEventListener("change", rpdRenderDetilTable);
    document.getElementById("rpdSaveButton")?.addEventListener("click", rpdSave);
    document.getElementById("rpdResetButton")?.addEventListener("click", rpdResetEditor);
    document.getElementById("rpdPrintButton")?.addEventListener("click", rpdPrintAll);
});