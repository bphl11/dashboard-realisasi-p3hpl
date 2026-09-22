// ============================================================
// RPD MODULE
// Input RPD per triwulan pada level Detil Akun.
// ============================================================

let rpdUser = null;
let rpdMasterRows = [];
let rpdExisting = [];
let rpdCurrentSelection = null;

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

function rpdQuarterTotals(saved) {
    const weekly = RPD_WEEK_FIELDS.map(key => rpdNumber(saved?.[key]));
    if (weekly.some(value => value !== 0)) {
        const q = {1:0,2:0,3:0,4:0};
        RPD_MONTHS.forEach(month => {
            for (let week=1; week<=4; week++) q[month.tw] += rpdNumber(saved?.[`${month.key}_m${week}`]);
        });
        return {tw1:q[1],tw2:q[2],tw3:q[3],tw4:q[4]};
    }
    return {tw1:rpdNumber(saved?.tw1),tw2:rpdNumber(saved?.tw2),tw3:rpdNumber(saved?.tw3),tw4:rpdNumber(saved?.tw4)};
}

const RPD_LOCAL_CACHE_KEY = "p3hpl_rpd_saved_v4";
const RPD_MASTER_CACHE_KEY = "p3hpl_rpd_master_v2";
const RPD_MASTER_CACHE_TTL = 5 * 60 * 1000;

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
    const byId = new Map(rpdExisting.map(item => [String(item.id_rpd || ""), item]));
    (rows || []).forEach(item => {
        const normalized = rpdNormalizeSavedRow(item);
        if (normalized.id_rpd) byId.set(String(normalized.id_rpd), normalized);
    });
    rpdExisting = [...byId.values()];
    rpdSaveLocalCache(rpdExisting);
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
    const normalize = value => String(value ?? "").trim().toUpperCase().replace(/\s+/g, " ").replace(/\|/g, "/");
    return [
        row.tahun, row.kodeSubKomponen, row.subKomponen, row.akun,
        row.itemAkun, row.detilAkun, row.rincianItem, row.pagu
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
    RPD_WEEK_FIELDS.forEach(key => { normalized[key]=rpdNumber(source[key] ?? source[key.toUpperCase()] ?? 0); });
    if (!RPD_WEEK_FIELDS.some(key => normalized[key] !== 0)) {
        [normalized.tw1,normalized.tw2,normalized.tw3,normalized.tw4].forEach((value,i) => {
            if (value > 0) normalized[["jan","apr","jul","okt"][i]+"_m1"]=value;
        });
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

function rpdRenderDetilTable() {
    const tbody=document.getElementById("rpdTableBody"); if(!tbody)return;
    const rows=rpdGetFilteredRows();
    if(!rows.length){tbody.innerHTML='<tr><td colspan="9" class="text-center text-muted py-4">Pilih Sub Komponen dan/atau Akun untuk menampilkan Detil.</td></tr>';return;}
    tbody.innerHTML=rows.map(row=>{
        const saved=rpdFindSavedForMaster(row)||RPD_EMPTY, q=rpdQuarterTotals(saved);
        const total=q.tw1+q.tw2+q.tw3+q.tw4, sisa=Math.max(rpdNumber(row.pagu)-total,0);
        return '<tr><td><strong>'+rpdEsc(row.itemAkun?row.itemAkun+" — ":"")+rpdEsc(row.akun)+'</strong><div class="small text-muted">'+(row.detilAkun?'Detil: '+rpdEsc(row.detilAkun):'Detil: -')+'</div><div class="small">'+(row.rincianItem?'Rincian: '+rpdEsc(row.rincianItem):'')+'</div></td>'+
        '<td class="text-end">'+rpdFormatRupiah(row.pagu)+'</td><td class="text-end">'+rpdFormatRupiah(q.tw1)+'</td><td class="text-end">'+rpdFormatRupiah(q.tw2)+'</td><td class="text-end">'+rpdFormatRupiah(q.tw3)+'</td><td class="text-end">'+rpdFormatRupiah(q.tw4)+'</td><td class="text-end fw-bold">'+rpdFormatRupiah(total)+'</td><td class="text-end">'+rpdFormatRupiah(sisa)+'</td>'+
        '<td><button type="button" class="btn btn-sm btn-success rpd-edit-btn" data-rpd-id="'+rpdEsc(row.id_rpd)+'"><i class="bi bi-pencil-square"></i> Input/Edit</button></td></tr>';
    }).join("");
    tbody.querySelectorAll(".rpd-edit-btn").forEach(button=>button.addEventListener("click",function(){rpdOpenEditor(this.dataset.rpdId);}));
}

function rpdFindSavedForMaster(masterRow) {
    // ID_RPD stabil sekarang menjadi kunci utama.
    const exact = rpdExisting.find(item =>
        String(item.id_rpd || "").trim() === String(masterRow.id_rpd || "").trim()
    );
    if (exact) return exact;

    // Kompatibilitas hanya untuk record lama: seluruh identitas baris harus cocok.
    // Jangan pernah mencocokkan hanya berdasarkan Akun/Detil karena satu akun
    // dapat mempunyai banyak Rincian Item.
    const same = rpdExisting.filter(item =>
        String(item.tahun ?? "") === String(masterRow.tahun ?? "") &&
        String(item.kode_sub_komponen ?? "").trim() === String(masterRow.kodeSubKomponen ?? "").trim() &&
        String(item.sub_komponen ?? "").trim() === String(masterRow.subKomponen ?? "").trim() &&
        String(item.akun ?? item.AKUN ?? "").trim() === String(masterRow.akun ?? "").trim() &&
        String(item.item_akun ?? "").trim() === String(masterRow.itemAkun ?? "").trim() &&
        String(item.detil_akun ?? "").trim() === String(masterRow.detilAkun ?? "").trim() &&
        String(item.rincian_item ?? "").trim() === String(masterRow.rincianItem ?? "").trim() &&
        rpdNumber(item.pagu_detil ?? item.pagu ?? 0) === rpdNumber(masterRow.pagu)
    );
    return same.length === 1 ? same[0] : null;
}

function rpdOpenEditor(id) {
    const row=rpdMasterRows.find(r=>String(r.id_rpd)===String(id)); if(!row)return;
    const saved=rpdFindSavedForMaster(row)||RPD_EMPTY; rpdCurrentSelection=row;
    document.getElementById("rpdEditId").value=row.id_rpd;
    document.getElementById("rpdEditLabel").textContent=row.detilAkun||"-";
    document.getElementById("rpdEditSub").textContent=row.subKomponen||"-";
    document.getElementById("rpdEditAkun").textContent=row.akun||"-";
    document.getElementById("rpdEditItem").textContent=row.itemAkun||"-";
    document.getElementById("rpdEditRincian").textContent=row.rincianItem?"Rincian: "+row.rincianItem:"";
    document.getElementById("rpdEditPagu").textContent=rpdFormatRupiah(row.pagu);
    RPD_WEEK_FIELDS.forEach(key=>{const el=document.getElementById("rpd_"+key);if(el)el.value=rpdNumber(saved[key])||"";});
    document.getElementById("rpdCatatan").value=saved.catatan||"";
    rpdUpdateEditorTotal();
    new bootstrap.Modal(document.getElementById("rpdEditorModal")).show();
}

function rpdUpdateEditorTotal() {
    const pagu=rpdNumber(rpdCurrentSelection?.pagu);
    const q={1:0,2:0,3:0,4:0};
    let total=0, negative=false;
    RPD_MONTHS.forEach(month=>{for(let week=1;week<=4;week++){const v=rpdNumber(document.getElementById("rpd_"+month.key+"_m"+week)?.value);q[month.tw]+=v;total+=v;if(v<0)negative=true;}});
    const valid=!negative&&total<=pagu;
    ["rpdTw1Summary","rpdTw2Summary","rpdTw3Summary","rpdTw4Summary"].forEach((id,i)=>document.getElementById(id).textContent=rpdFormatRupiah(q[i+1]));
    document.getElementById("rpdEditTotal").textContent=rpdFormatRupiah(total);
    document.getElementById("rpdEditSisa").textContent=rpdFormatRupiah(Math.max(pagu-total,0));
    const state=document.getElementById("rpdEditValidation");
    state.className="small mt-2 "+(valid?"text-success":"text-danger");
    state.textContent=negative?"Tidak valid: nilai mingguan tidak boleh negatif.":(valid?"Valid: total 48 minggu tidak melebihi pagu.":"Tidak valid: total 48 minggu melebihi pagu.");
    document.getElementById("rpdSaveButton").disabled=!valid;
}

async function rpdSave() {
    if(!rpdCurrentSelection||!rpdUser)return;
    const payload={id_rpd:rpdCurrentSelection.id_rpd,tahun:rpdCurrentSelection.tahun,kode_sub_komponen:rpdCurrentSelection.kodeSubKomponen,sub_komponen:rpdCurrentSelection.subKomponen,akun:rpdCurrentSelection.akun,item_akun:rpdCurrentSelection.itemAkun,detil_akun:rpdCurrentSelection.detilAkun,rincian_item:rpdCurrentSelection.rincianItem,pagu_detil:rpdCurrentSelection.pagu,catatan:document.getElementById("rpdCatatan").value.trim()};
    RPD_WEEK_FIELDS.forEach(key=>payload[key]=rpdNumber(document.getElementById("rpd_"+key)?.value));
    const total=RPD_WEEK_FIELDS.reduce((sum,key)=>sum+payload[key],0);
    if(RPD_WEEK_FIELDS.some(key=>payload[key]<0)){rpdSetStatus("Nilai RPD mingguan tidak boleh negatif.","danger");return;}
    if(total>payload.pagu_detil){rpdSetStatus("Total RPD 48 minggu melebihi pagu detil.","danger");return;}
    const q={1:0,2:0,3:0,4:0};
    RPD_MONTHS.forEach(month=>{for(let week=1;week<=4;week++)q[month.tw]+=payload[month.key+"_m"+week];});
    payload.tw1=q[1];payload.tw2=q[2];payload.tw3=q[3];payload.tw4=q[4];payload.total_rpd=total;
    const button=document.getElementById("rpdSaveButton");button.disabled=true;button.innerHTML='<span class="spinner-border spinner-border-sm"></span> Menyimpan...';
    try{
        const result=await rpdApiRequest("save",{id_token:rpdUser.id_token,row:payload});
        if(!result.ok)throw new Error(result.message||"Data RPD gagal disimpan.");
        const localSaved=rpdNormalizeSavedRow(payload);
        rpdMergeSavedRows([localSaved,...rpdNormalizeExistingRows(result.data??result.rpd??result)]);
        bootstrap.Modal.getInstance(document.getElementById("rpdEditorModal"))?.hide();
        rpdRenderDetilTable();
        const uniqueExisting=new Set(rpdExisting.map(r=>String(r.id_rpd||"")));
        document.getElementById("rpdTotalTerisi").textContent=rpdMasterRows.filter(r=>uniqueExisting.has(String(r.id_rpd))).length.toLocaleString("id-ID");
        rpdSetStatus("RPD berhasil disimpan.","success");
    }catch(error){console.error(error);rpdSetStatus(error.message||"RPD gagal disimpan.","danger");}
    finally{button.disabled=false;button.innerHTML='<i class="bi bi-save"></i> Simpan RPD';}
}



function rpdGetPrintRows() {
    const masterById = new Map(
        rpdMasterRows.map(row => [String(row.id_rpd || ""), row])
    );

    return rpdExisting
        .map(saved => {
            const master = masterById.get(String(saved.id_rpd || ""));
            return {
                ...(master || {}),
                ...saved,
                subKomponen: saved.sub_komponen || saved.subKomponen || master?.subKomponen || "",
                kodeSubKomponen: saved.kode_sub_komponen || saved.kodeSubKomponen || master?.kodeSubKomponen || "",
                akun: saved.akun || master?.akun || "",
                itemAkun: saved.item_akun || saved.itemAkun || master?.itemAkun || "",
                detilAkun: saved.detil_akun || saved.detilAkun || master?.detilAkun || "",
                rincianItem: saved.rincian_item || saved.rincianItem || master?.rincianItem || "",
                pagu: rpdNumber(saved.pagu_detil ?? saved.pagu ?? master?.pagu ?? 0)
            };
        })
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

    const grouped = new Map();
    rows.forEach(row => {
        const key = row.subKomponen || "Sub Komponen Tidak Diketahui";
        if (!grouped.has(key)) grouped.set(key, []);
        grouped.get(key).push(row);
    });

    const yearSet = [...new Set(rows.map(row => String(row.tahun || "").trim()).filter(Boolean))];
    const yearLabel = yearSet.length === 1 ? yearSet[0] : yearSet.join(", ");

    const summaryRows = [];
    let grandPagu = 0;
    let grandTotal = 0;

    grouped.forEach((items, sub) => {
        const subPagu = items.reduce((sum, row) => sum + rpdNumber(row.pagu), 0);
        const subTotal = items.reduce((sum, row) => {
            const q = rpdQuarterTotals(row);
            return sum + q.tw1 + q.tw2 + q.tw3 + q.tw4;
        }, 0);
        grandPagu += subPagu;
        grandTotal += subTotal;
        summaryRows.push(
            '<tr><td class="no">' + (summaryRows.length + 1) + '</td>' +
            '<td><strong>' + rpdEsc(sub) + '</strong></td>' +
            '<td class="num">' + items.length.toLocaleString("id-ID") + '</td>' +
            '<td class="num">' + rpdFormatRupiah(subPagu) + '</td>' +
            '<td class="num">' + rpdFormatRupiah(subTotal) + '</td>' +
            '<td class="num">' + rpdFormatRupiah(Math.max(subPagu - subTotal, 0)) + '</td></tr>'
        );
    });

    const detailRows = [];
    let detailNo = 0;

    grouped.forEach((items, sub) => {
        detailRows.push(
            '<tr class="group-row"><td colspan="10"><strong>SUB KOMPONEN: ' +
            rpdEsc(sub) + '</strong></td></tr>'
        );

        items.forEach(row => {
            detailNo++;
            const q = rpdQuarterTotals(row);
            const total = q.tw1 + q.tw2 + q.tw3 + q.tw4;
            const label = [
                row.itemAkun ? row.itemAkun : "",
                row.akun || "",
                row.detilAkun ? "Detil: " + row.detilAkun : "",
                row.rincianItem ? "Rincian: " + row.rincianItem : ""
            ].filter(Boolean).join(" — ");

            detailRows.push(
                '<tr>' +
                '<td class="no">' + detailNo + '</td>' +
                '<td>' + rpdEsc(row.itemAkun || "-") + '</td>' +
                '<td>' + rpdEsc(row.akun || "-") + '</td>' +
                '<td>' + rpdEsc(row.detilAkun || "-") + '</td>' +
                '<td>' + rpdEsc(row.rincianItem || "-") + '</td>' +
                '<td class="num">' + rpdFormatRupiah(row.pagu) + '</td>' +
                '<td class="num">' + rpdFormatRupiah(q.tw1) + '</td>' +
                '<td class="num">' + rpdFormatRupiah(q.tw2) + '</td>' +
                '<td class="num">' + rpdFormatRupiah(q.tw3) + '</td>' +
                '<td class="num">' + rpdFormatRupiah(q.tw4) + '</td>' +
                '<td class="num"><strong>' + rpdFormatRupiah(total) + '</strong></td>' +
                '<td class="num">' + rpdFormatRupiah(Math.max(row.pagu - total, 0)) + '</td>' +
                '</tr>'
            );

            const weekly = RPD_WEEK_FIELDS.map(key => rpdNumber(row[key]));
            const hasWeekly = weekly.some(value => value !== 0);

            if (hasWeekly) {
                detailRows.push(
                    '<tr class="weekly-parent"><td></td><td colspan="11">' +
                    '<strong>Rincian Mingguan</strong></td></tr>'
                );

                RPD_MONTHS.forEach(month => {
                    const values = [1,2,3,4].map(week =>
                        rpdNumber(row[month.key + "_m" + week])
                    );
                    const monthTotal = values.reduce((a,b) => a + b, 0);
                    detailRows.push(
                        '<tr class="weekly-row">' +
                        '<td></td><td colspan="4"><strong>' + month.label + '</strong></td>' +
                        '<td class="num">' + rpdFormatRupiah(values[0]) + '</td>' +
                        '<td class="num">' + rpdFormatRupiah(values[1]) + '</td>' +
                        '<td class="num">' + rpdFormatRupiah(values[2]) + '</td>' +
                        '<td class="num">' + rpdFormatRupiah(values[3]) + '</td>' +
                        '<td class="num"><strong>' + rpdFormatRupiah(monthTotal) + '</strong></td>' +
                        '<td colspan="2"></td>' +
                        '</tr>'
                    );
                });
            }
        });
    });

    const generated = new Date().toLocaleString("id-ID");
    const printWindow = window.open("", "_blank", "width=1400,height=900");

    if (!printWindow) {
        rpdSetStatus("Jendela cetak diblokir browser. Izinkan pop-up untuk halaman ini lalu coba lagi.", "warning");
        return;
    }

    printWindow.document.open();
    printWindow.document.write(
        '<!DOCTYPE html><html lang="id"><head><meta charset="UTF-8">' +
        '<title>Cetak RPD P3HPL</title>' +
        '<style>' +
        '@page{size:A4 landscape;margin:12mm}' +
        '*{box-sizing:border-box}' +
        'body{font-family:Arial,Helvetica,sans-serif;color:#111;font-size:10px;margin:0}' +
        'h1{font-size:18px;margin:0 0 3px;text-align:center}' +
        'h2{font-size:13px;margin:0 0 12px;text-align:center;font-weight:normal}' +
        '.meta{display:flex;justify-content:space-between;border-bottom:1px solid #999;padding-bottom:6px;margin-bottom:10px}' +
        '.cards{display:flex;gap:8px;margin-bottom:12px}' +
        '.card{border:1px solid #aaa;padding:6px 9px;flex:1}' +
        '.card strong{display:block;font-size:12px}' +
        'table{width:100%;border-collapse:collapse;margin-bottom:14px}' +
        'th,td{border:1px solid #888;padding:4px;vertical-align:top}' +
        'th{background:#e9ecef;text-align:center;font-weight:700}' +
        '.num{text-align:right;white-space:nowrap}' +
        '.no{width:28px;text-align:center}' +
        '.group-row td{background:#dfeadd;font-size:11px;padding:6px}' +
        '.weekly-parent td{background:#f3f5f3}' +
        '.weekly-row td{font-size:9px;background:#fafafa}' +
        '.section-title{font-size:12px;font-weight:700;margin:10px 0 5px}' +
        '.summary th,.summary td{font-size:10px}' +
        '.detail th:nth-child(1){width:28px}.detail th:nth-child(6){width:78px}.detail th:nth-child(n+7){width:70px}' +
        '.footer{margin-top:14px;font-size:9px;color:#555}' +
        '.sign{margin-top:35px;display:flex;justify-content:flex-end}' +
        '.sign-box{width:260px;text-align:center}' +
        '@media print{.no-print{display:none}.group-row{break-inside:avoid}.weekly-row{break-inside:avoid}}' +
        '</style></head><body>' +
        '<h1>RENCANA PENARIKAN DANA (RPD)</h1>' +
        '<h2>P3HPL — BPHL XI Banjarbaru</h2>' +
        '<div class="meta"><div><strong>Tahun Anggaran:</strong> ' + rpdEsc(yearLabel || "-") + '</div>' +
        '<div><strong>Dicetak:</strong> ' + rpdEsc(generated) + '</div></div>' +
        '<div class="cards">' +
        '<div class="card"><span>Jumlah Sub Komponen</span><strong>' + grouped.size.toLocaleString("id-ID") + '</strong></div>' +
        '<div class="card"><span>Jumlah Detil RPD</span><strong>' + rows.length.toLocaleString("id-ID") + '</strong></div>' +
        '<div class="card"><span>Total Pagu</span><strong>' + rpdFormatRupiah(grandPagu) + '</strong></div>' +
        '<div class="card"><span>Total RPD</span><strong>' + rpdFormatRupiah(grandTotal) + '</strong></div>' +
        '<div class="card"><span>Sisa</span><strong>' + rpdFormatRupiah(Math.max(grandPagu - grandTotal, 0)) + '</strong></div>' +
        '</div>' +
        '<div class="section-title">Rekapitulasi RPD per Sub Komponen</div>' +
        '<table class="summary"><thead><tr><th>No</th><th>Sub Komponen</th><th>Jumlah Detil</th><th>Pagu</th><th>Total RPD</th><th>Sisa</th></tr></thead>' +
        '<tbody>' + summaryRows.join("") + '</tbody></table>' +
        '<div class="section-title">Rincian RPD</div>' +
        '<table class="detail"><thead><tr><th>No</th><th>Item Akun</th><th>Akun Belanja</th><th>Detil Akun</th><th>Rincian Item</th><th>Pagu</th><th>TW I</th><th>TW II</th><th>TW III</th><th>TW IV</th><th>Total RPD</th><th>Sisa</th></tr></thead>' +
        '<tbody>' + detailRows.join("") + '</tbody></table>' +
        '<div class="footer">Dokumen ini dicetak dari Modul RPD. RPD merupakan rencana penarikan dana dan tidak menggunakan data realisasi.</div>' +
        '<div class="sign"><div class="sign-box">Mengetahui,<br><br><br><br>____________________________<br>Pejabat yang berwenang</div></div>' +
        '<script>window.onload=function(){setTimeout(function(){window.print();},350);};<\/script>' +
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
    const out = [];

    let currentSub = "";
    let currentKodeSub = "";
    let currentAkun = "";
    let currentItem = "";
    let currentDetil = "";

    for (let i = headerIndex + 1; i < rawData.length; i++) {
        const row = Array.isArray(rawData[i]) ? rawData[i] : [];
        if (!row.length || !row.some(v => String(v ?? "").trim() !== "")) continue;

        const rowSub = get(row, ["Sub Komponen", "Subkomponen", "Nama Sub Komponen"]);
        const rowKodeSub = get(row, ["Kode Sub Komponen", "KodeSubKomponen"]);
        const rowAkun = get(row, ["Akun Belanja", "Akun"]);
        const rowItem = get(row, ["Item Akun", "Item"]);
        const rowDetil = get(row, ["Detil Akun", "Detail Akun", "Detil"]);
        const rowRincian = get(row, ["Rincian Item", "Rincian"]);
        const status = get(row, ["Status Pagu", "Status"]).toLowerCase();
        const pagu = money(get(row, ["Pagu"]));


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

        out.push({
            rowIndex: i,
            sourceFormat: "RPD_RAW",
            id_rpd: rpdStableId({ tahun: get(row, ["Tahun", "Tahun Anggaran"]) || new Date().getFullYear(), kodeSubKomponen: kodeSub, subKomponen: sub, akun: akun, itemAkun: item || "", detilAkun: detil || "", rincianItem: rincian || "", pagu: pagu }),
            tahun: get(row, ["Tahun", "Tahun Anggaran"]) || new Date().getFullYear(),
            kodeSubKomponen: kodeSub,
            subKomponen: sub,
            akun: akun,
            itemAkun: item || "",
            detilAkun: detil || "",
            rincianItem: rincian || "",
            pagu: pagu
        });
    }

    console.log("RPD MASTER ROWS:", out.length);
    console.log("RPD SUB KOMPONEN:", new Set(out.map(r => r.subKomponen)).size);
    console.log("RPD AKUN BELANJA:", new Set(out.map(r => r.akun)).size);

    return out;
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
                    pagu: Number(row.pagu) || 0
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
    document.getElementById("rpdPrintButton")?.addEventListener("click", rpdPrintAll);
});