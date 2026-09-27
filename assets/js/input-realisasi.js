// ============================================================
// INPUT REALISASI - TAHAP 1
// Hanya menyimpan transaksi bulanan ke sheet REALISASI P3HPL.
// Dashboard/Monitoring belum diubah pada tahap ini.
// ============================================================

let realisasiMaster = [];
let realisasiRows = [];
let selectedMaster = null;

const BULAN_REALISASI = [
    "Januari","Februari","Maret","April","Mei","Juni",
    "Juli","Agustus","September","Oktober","November","Desember"
];

function rupiahInput(value) {
    return new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        maximumFractionDigits: 0
    }).format(Number(value) || 0);
}

function escapeHtmlInputRealisasi(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function normalizeTextInputRealisasi(value) {
    return String(value ?? "").trim().toLowerCase();
}

function getUserInputRealisasi() {
    return typeof rpdGetStoredUser === "function" ? rpdGetStoredUser() : null;
}

function setStatusInputRealisasi(message, type = "info") {
    const el = document.getElementById("realisasiStatus");
    if (!el) return;
    el.className = "alert alert-" + type;
    el.textContent = message;
    el.classList.remove("d-none");
}

function clearStatusInputRealisasi() {
    document.getElementById("realisasiStatus")?.classList.add("d-none");
}

function groupMasterBySubKomponen() {
    const values = [...new Set(
        realisasiMaster
            .map(item => String(item.subKomponen || "").trim())
            .filter(Boolean)
    )];

    values.sort((a, b) => a.localeCompare(b, "id"));
    return values;
}

function populateSubKomponenInputRealisasi() {
    const select = document.getElementById("realisasiSubKomponen");
    if (!select) return;

    select.innerHTML =
        '<option value="">-- Pilih Sub Komponen --</option>' +
        groupMasterBySubKomponen()
            .map(value => '<option value="' + escapeHtmlInputRealisasi(value) + '">' +
                escapeHtmlInputRealisasi(value) + '</option>')
            .join("");
}

function populateDetilInputRealisasi() {
    const sub = normalizeTextInputRealisasi(
        document.getElementById("realisasiSubKomponen")?.value
    );
    const select = document.getElementById("realisasiDetil");

    if (!select) return;

    const rows = realisasiMaster
        .filter(item => normalizeTextInputRealisasi(item.subKomponen) === sub)
        .sort((a, b) => {
            const left = [a.akun, a.itemAkun, a.detilAkun, a.rincianItem].join(" ");
            const right = [b.akun, b.itemAkun, b.detilAkun, b.rincianItem].join(" ");
            return left.localeCompare(right, "id");
        });

    select.innerHTML =
        '<option value="">-- Pilih Detil Anggaran --</option>' +
        rows.map(item => {
            const label = [
                item.akun,
                item.itemAkun,
                item.detilAkun,
                item.rincianItem
            ].filter(Boolean).join(" | ");

            return '<option value="' + escapeHtmlInputRealisasi(item.id_anggaran) + '">' +
                escapeHtmlInputRealisasi(label || item.id_anggaran) +
                '</option>';
        }).join("");

    selectedMaster = null;
    renderMasterInfoInputRealisasi();
}

function onMasterSelectedInputRealisasi() {
    const id = String(document.getElementById("realisasiDetil")?.value || "");
    selectedMaster = realisasiMaster.find(item => item.id_anggaran === id) || null;
    renderMasterInfoInputRealisasi();
}

function getExistingTotalForMaster(idAnggaran) {
    return realisasiRows
        .filter(item =>
            item.id_anggaran === idAnggaran &&
            String(item.status || "AKTIF").toUpperCase() === "AKTIF"
        )
        .reduce((sum, item) => sum + (Number(item.nominal_realisasi) || 0), 0);
}

function renderMasterInfoInputRealisasi() {
    const box = document.getElementById("realisasiMasterInfo");
    if (!box) return;

    if (!selectedMaster) {
        box.innerHTML = '<div class="text-muted">Pilih detil anggaran untuk melihat pagu.</div>';
        return;
    }

    const totalInput = getExistingTotalForMaster(selectedMaster.id_anggaran);
    const sisaInput = Math.max((Number(selectedMaster.pagu) || 0) - totalInput, 0);

    box.innerHTML = `
        <div class="row g-2">
            <div class="col-md-3"><div class="small text-muted">Akun</div><strong>${escapeHtmlInputRealisasi(selectedMaster.akun)}</strong></div>
            <div class="col-md-3"><div class="small text-muted">Pagu Detil</div><strong>${rupiahInput(selectedMaster.pagu)}</strong></div>
            <div class="col-md-3"><div class="small text-muted">Input Realisasi</div><strong>${rupiahInput(totalInput)}</strong></div>
            <div class="col-md-3"><div class="small text-muted">Sisa Pagu</div><strong>${rupiahInput(sisaInput)}</strong></div>
        </div>
        <div class="small text-muted mt-2">
            ${escapeHtmlInputRealisasi(selectedMaster.detilAkun || selectedMaster.rincianItem || "Detil anggaran")}
        </div>
    `;
}

function resetFormInputRealisasi() {
    document.getElementById("realisasiBulan").value = "";
    document.getElementById("realisasiNominal").value = "";
    document.getElementById("realisasiKeterangan").value = "";
}

function renderListInputRealisasi() {
    const tbody = document.getElementById("realisasiTableBody");
    const count = document.getElementById("realisasiCount");
    if (!tbody) return;

    const monthFilter = normalizeTextInputRealisasi(
        document.getElementById("realisasiFilterBulan")?.value
    );

    const rows = realisasiRows
        .filter(item => !monthFilter || normalizeTextInputRealisasi(item.bulan) === monthFilter)
        .sort((a, b) => String(b.created_at || "").localeCompare(String(a.created_at || "")));

    if (count) count.textContent = rows.length + " transaksi";

    tbody.innerHTML = rows.length
        ? rows.map(item => `
            <tr>
                <td>${escapeHtmlInputRealisasi(item.bulan)}</td>
                <td>${escapeHtmlInputRealisasi(item.sub_komponen)}</td>
                <td>${escapeHtmlInputRealisasi(item.akun)}</td>
                <td>${escapeHtmlInputRealisasi(item.detil_akun || item.rincian_item || "-")}</td>
                <td class="text-end">${rupiahInput(item.nominal_realisasi)}</td>
                <td>${escapeHtmlInputRealisasi(item.keterangan || "-")}</td>
                <td><span class="badge text-bg-success">${escapeHtmlInputRealisasi(item.status || "AKTIF")}</span></td>
            </tr>
        `).join("")
        : '<tr><td colspan="7" class="text-center text-muted py-4">Belum ada Input Realisasi.</td></tr>';
}

async function loadInputRealisasiData() {
    clearStatusInputRealisasi();

    const user = getUserInputRealisasi();
    if (!user?.email) return;

    try {
        const result = await realisasiBootstrap();
        realisasiMaster = Array.isArray(result.master) ? result.master : [];
        realisasiRows = Array.isArray(result.realisasi) ? result.realisasi : [];

        populateSubKomponenInputRealisasi();
        renderListInputRealisasi();
        document.getElementById("realisasiLoginUser").textContent =
            result.user?.name || result.user?.email || "Operator";

        setStatusInputRealisasi(
            "Data master berhasil dimuat. Tahap 1: transaksi tersimpan terpisah dan belum mengubah Dashboard/Monitoring.",
            "info"
        );
    } catch (error) {
        console.error(error);
        setStatusInputRealisasi(error.message || "Gagal memuat data Input Realisasi.", "danger");
    }
}

async function submitInputRealisasi(event) {
    event.preventDefault();
    clearStatusInputRealisasi();

    if (!selectedMaster) {
        setStatusInputRealisasi("Pilih detil anggaran terlebih dahulu.", "warning");
        return;
    }

    const bulan = document.getElementById("realisasiBulan").value;
    const nominal = Number(document.getElementById("realisasiNominal").value || 0);
    const keterangan = document.getElementById("realisasiKeterangan").value.trim();

    if (!bulan) {
        setStatusInputRealisasi("Pilih Bulan Realisasi.", "warning");
        return;
    }

    if (!(nominal > 0)) {
        setStatusInputRealisasi("Nominal Realisasi harus lebih besar dari 0.", "warning");
        return;
    }

    const existingTotal = getExistingTotalForMaster(selectedMaster.id_anggaran);
    const pagu = Number(selectedMaster.pagu) || 0;

    if (existingTotal + nominal > pagu) {
        setStatusInputRealisasi(
            "Nominal melebihi sisa pagu. Sisa saat ini: " + rupiahInput(Math.max(pagu - existingTotal, 0)),
            "warning"
        );
        return;
    }

    const button = document.getElementById("realisasiSaveButton");
    button.disabled = true;
    button.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Menyimpan...';

    try {
        const result = await realisasiSave({
            tahun: selectedMaster.tahun,
            id_anggaran: selectedMaster.id_anggaran,
            bulan_realisasi: bulan,
            nominal_realisasi: nominal,
            keterangan
        });

        if (!result?.ok) throw new Error(result?.message || "Realisasi gagal disimpan.");

        realisasiRows.push(result.data);
        renderListInputRealisasi();
        renderMasterInfoInputRealisasi();
        resetFormInputRealisasi();

        setStatusInputRealisasi("Realisasi bulan " + bulan + " berhasil disimpan.", "success");
    } catch (error) {
        console.error(error);
        setStatusInputRealisasi(error.message || "Gagal menyimpan realisasi.", "danger");
    } finally {
        button.disabled = false;
        button.innerHTML = '<i class="bi bi-save"></i> Simpan Realisasi';
    }
}

function setupInputRealisasi() {
    document.getElementById("realisasiSubKomponen")
        ?.addEventListener("change", populateDetilInputRealisasi);
    document.getElementById("realisasiDetil")
        ?.addEventListener("change", onMasterSelectedInputRealisasi);
    document.getElementById("realisasiFilterBulan")
        ?.addEventListener("change", renderListInputRealisasi);
    document.getElementById("realisasiForm")
        ?.addEventListener("submit", submitInputRealisasi);
}

document.addEventListener("DOMContentLoaded", function () {
    // Dipakai oleh rpd-auth.js agar tidak mencoba memuat modul RPD.
    window.rpdInitData = function () {};

    setupInputRealisasi();

    const user = getUserInputRealisasi();
    if (user?.email) {
        loadInputRealisasiData();
    }
});
