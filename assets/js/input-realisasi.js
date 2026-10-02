// ============================================================
// INPUT REALISASI
// Menyimpan transaksi bulanan ke sheet REALISASI P3HPL.
// Transaksi aktif otomatis digabungkan ke Realisasi Final
// yang dipakai Dashboard, Grafik, Monitoring, dan Laporan.
// ============================================================

let realisasiMaster = [];
let realisasiRows = [];
let selectedMaster = null;
let editingRealisasiId = null;

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

function getExistingInputTotalForMaster(idAnggaran, excludeId = "") {
    return realisasiRows
        .filter(item =>
            item.id_anggaran === idAnggaran &&
            String(item.status || "AKTIF").toUpperCase() === "AKTIF" &&
            (!excludeId || item.id_realisasi !== excludeId)
        )
        .reduce((sum, item) => sum + (Number(item.nominal_realisasi) || 0), 0);
}

function getBaseRealisasiForMaster(master) {
    return Number(master?.realisasi) || 0;
}

function getTotalRealisasiForMaster(master) {
    if (!master) return 0;
    return getBaseRealisasiForMaster(master) +
        getExistingInputTotalForMaster(master.id_anggaran);
}

function renderMasterInfoInputRealisasi() {
    const box = document.getElementById("realisasiMasterInfo");
    if (!box) return;

    if (!selectedMaster) {
        box.innerHTML = '<div class="text-muted">Pilih detil anggaran untuk melihat pagu.</div>';
        return;
    }

    const baseRealisasi = getBaseRealisasiForMaster(selectedMaster);
    const inputRealisasi = getExistingInputTotalForMaster(selectedMaster.id_anggaran);
    const totalRealisasi = baseRealisasi + inputRealisasi;
    const sisaInput = Math.max((Number(selectedMaster.pagu) || 0) - totalRealisasi, 0);

    box.innerHTML = `
        <div class="row g-2">
            <div class="col-md-3"><div class="small text-muted">Akun</div><strong>${escapeHtmlInputRealisasi(selectedMaster.akun)}</strong></div>
            <div class="col-md-3"><div class="small text-muted">Pagu Detil</div><strong>${rupiahInput(selectedMaster.pagu)}</strong></div>
            <div class="col-md-3"><div class="small text-muted">Total Realisasi</div><strong>${rupiahInput(totalRealisasi)}</strong></div>
            <div class="col-md-3"><div class="small text-muted">Sisa Pagu</div><strong>${rupiahInput(sisaInput)}</strong></div>
        </div>
        <div class="small text-muted mt-2">
            Realisasi DATA_APLIKASI: ${rupiahInput(baseRealisasi)} · Input bulanan: ${rupiahInput(inputRealisasi)}<br>
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
                <td class="text-center">
                    <button type="button" class="btn btn-sm btn-outline-primary" onclick="editInputRealisasi('${escapeHtmlInputRealisasi(item.id_realisasi)}')">
                        <i class="bi bi-pencil-square"></i> Edit
                    </button>
                    <button type="button" class="btn btn-sm btn-outline-danger" onclick="deleteInputRealisasi('${escapeHtmlInputRealisasi(item.id_realisasi)}')">
                        <i class="bi bi-trash"></i> Hapus
                    </button>
                </td>
            </tr>
        `).join("")
        : '<tr><td colspan="8" class="text-center text-muted py-4">Belum ada Input Realisasi.</td></tr>';
}

// ============================================================
// BOOTSTRAP CEPAT INPUT REALISASI
//
// Prioritas:
// 1. Tampilkan snapshot APP_STORE + cache transaksi yang sudah ada.
// 2. Bootstrap RPD berjalan di belakang layar untuk sinkronisasi server.
// 3. Jika RPD lambat/404 sementara, halaman tidak kembali kosong.
// ============================================================

function buildInputRealisasiMasterFromAppStore(store, inputRows) {
    if (!store || !Array.isArray(store.parsedData)) return [];

    const transaksiById = new Map();

    (Array.isArray(inputRows) ? inputRows : []).forEach(row => {
        if (String(row?.status || "AKTIF").toUpperCase() !== "AKTIF") return;

        const id = String(row?.id_anggaran || "").trim();
        if (!id) return;

        const key = String(row?.tahun || "") + "::" + id;
        transaksiById.set(
            key,
            (transaksiById.get(key) || 0) +
            (Number(row?.nominal_realisasi) || 0)
        );
    });

    const byId = new Map();

    store.parsedData.forEach(item => {
        if (!item || item.statusPagu === "Diblokir") return;

        const id = String(item.idAnggaran || "").trim();
        if (!id) return;

        const tahun = String(item.tahun || "");
        const key = tahun + "::" + id;
        const inputTotal = transaksiById.get(key) || 0;

        if (!byId.has(key)) {
            byId.set(key, {
                id_anggaran: id,
                tahun,
                kodeSubKomponen: item.kodeSubKomponen || "",
                subKomponen: item.subKomponen || "",
                akun: item.akun || "",
                itemAkun: item.itemAkun || "",
                detilAkun: item.detilAkun || "",
                rincianItem: item.rincianItem || "",
                pagu: Number(item.pagu) || 0,
                realisasi: 0
            });
        }

        // parsedData sudah memasukkan INPUT_REALISASI ke item.realisasi.
        // Kurangi transaksi input sekali per ID agar yang tersisa adalah
        // Realisasi DATA_APLIKASI sebagai baseRealisasi.
        const target = byId.get(key);
        target.realisasi += Number(item.realisasi) || 0;
    });

    byId.forEach((master, key) => {
        master.realisasi = Math.max(
            master.realisasi - (transaksiById.get(key) || 0),
            0
        );
    });

    return Array.from(byId.values());
}

function renderInputRealisasiSnapshotLocal() {
    const store =
        typeof window.appStore?.peek === "function"
            ? window.appStore.peek()
            : null;

    const cachedRows =
        typeof bacaCacheInputRealisasi === "function"
            ? bacaCacheInputRealisasi()
            : null;

    if (Array.isArray(cachedRows)) {
        realisasiRows = cachedRows;
    }

    if (store && Array.isArray(store.parsedData)) {
        realisasiMaster = buildInputRealisasiMasterFromAppStore(
            store,
            realisasiRows
        );
    }

    if (realisasiMaster.length) {
        populateSubKomponenInputRealisasi();
    }

    renderListInputRealisasi();

    const storedUser = getUserInputRealisasi();
    const loginUser = document.getElementById("realisasiLoginUser");
    if (loginUser) {
        loginUser.textContent =
            storedUser?.name || storedUser?.email || "Operator";
    }

    return Boolean(
        realisasiMaster.length ||
        realisasiRows.length
    );
}

async function loadInputRealisasiData() {
    clearStatusInputRealisasi();

    const user = getUserInputRealisasi();
    if (!user?.email) return;

    // Tampilkan snapshot transaksi terlebih dahulu.
    const hasLocalSnapshot = renderInputRealisasiSnapshotLocal();

    // Pastikan master anggaran tersedia sebelum menggunakan endpoint
    // realisasi_list. Endpoint list hanya mengembalikan transaksi, bukan
    // daftar Sub Komponen/Detil Anggaran.
    if (!realisasiMaster.length && typeof window.appStore?.get === "function") {
        try {
            const store = await window.appStore.get();
            realisasiMaster = buildInputRealisasiMasterFromAppStore(
                store,
                realisasiRows
            );

            if (realisasiMaster.length) {
                populateSubKomponenInputRealisasi();
                renderMasterInfoInputRealisasi();
            }
        } catch (storeError) {
            console.warn("Master APP STORE belum tersedia:", storeError);
        }
    }

    if (hasLocalSnapshot || realisasiMaster.length) {
        setStatusInputRealisasi(
            "Data master dan transaksi terakhir ditampilkan. Menyinkronkan...",
            "info"
        );
    }

    try {
        // Bila master sudah tersedia dari APP_STORE, ambil transaksi saja.
        // Bila belum, gunakan bootstrap yang mengembalikan master + transaksi.
        const result = realisasiMaster.length
            ? await realisasiList()
            : await realisasiBootstrap();

        if (Array.isArray(result.master) && result.master.length) {
            realisasiMaster = result.master;
        }

        realisasiRows = Array.isArray(result.realisasi)
            ? result.realisasi
            : [];

        // Bootstrap/list adalah snapshot transaksi lengkap dari server.
        if (typeof replaceInputRealisasiLocalCache === "function") {
            replaceInputRealisasiLocalCache(realisasiRows);
        }

        populateSubKomponenInputRealisasi();
        renderListInputRealisasi();

        const loginUser = document.getElementById("realisasiLoginUser");
        if (loginUser) {
            loginUser.textContent =
                result.user?.name || result.user?.email || user.email || "Operator";
        }

        setStatusInputRealisasi(
            "Data master dan transaksi berhasil disinkronkan.",
            "success"
        );
    } catch (error) {
        console.error("Bootstrap RPD gagal, snapshot lokal tetap dipakai:", error);

        // Jangan mengosongkan halaman ketika proxy RPD sedang lambat/gagal.
        // Snapshot lokal tetap valid untuk tampilan sementara.
        if (hasLocalSnapshot) {
            setStatusInputRealisasi(
                "RPD sementara belum merespons. Data terakhir tetap ditampilkan; coba Muat Ulang untuk sinkronisasi.",
                "warning"
            );
        } else {
            setStatusInputRealisasi(
                error.message || "Gagal memuat data Input Realisasi.",
                "danger"
            );
        }
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

    const existingInputTotal = getExistingInputTotalForMaster(
        selectedMaster.id_anggaran,
        editingRealisasiId || ""
    );
    const baseRealisasi = getBaseRealisasiForMaster(selectedMaster);
    const totalSebelumInput = baseRealisasi + existingInputTotal;
    const pagu = Number(selectedMaster.pagu) || 0;

    if (totalSebelumInput + nominal > pagu) {
        setStatusInputRealisasi(
            "Nominal melebihi sisa pagu. Sisa saat ini: " + rupiahInput(Math.max(pagu - totalSebelumInput, 0)),
            "warning"
        );
        return;
    }

    const button = document.getElementById("realisasiSaveButton");
    button.disabled = true;
    button.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Menyimpan...';

    try {
        const payload = {
            tahun: selectedMaster.tahun,
            id_anggaran: selectedMaster.id_anggaran,
            bulan_realisasi: bulan,
            nominal_realisasi: nominal,
            keterangan
        };

        const result = editingRealisasiId
            ? await realisasiUpdate({ ...payload, id_realisasi: editingRealisasiId })
            : await realisasiSave(payload);

        if (!result?.ok) throw new Error(result?.message || "Realisasi gagal disimpan.");

        if (editingRealisasiId) {
            const index = realisasiRows.findIndex(item => item.id_realisasi === editingRealisasiId);
            if (index >= 0) realisasiRows[index] = result.data;
        } else {
            realisasiRows.push(result.data);
        }

        const wasEditing = Boolean(editingRealisasiId);
        editingRealisasiId = null;
        renderListInputRealisasi();
        renderMasterInfoInputRealisasi();
        resetFormInputRealisasi();
        setInputRealisasiEditMode(false);

        // Simpan mutation ke snapshot Realisasi terlebih dahulu.
        // Jangan menghapus cache transaksi sebelum snapshot diperbarui.
        if (typeof updateInputRealisasiLocalCache === "function") {
            updateInputRealisasiLocalCache(wasEditing ? "update" : "save", result);
        }

        // Patch APP STORE yang sudah ada secara lokal. DATA_APLIKASI tidak
        // diunduh ulang dan parser/rumus tetap sama.
        let patchedAppStore = false;
        if (typeof window.patchAppStoreRealisasi === "function") {
            try {
                patchedAppStore = window.patchAppStoreRealisasi(
                    wasEditing ? "update" : "save",
                    result
                );
            } catch (patchError) {
                console.warn("Patch APP STORE gagal:", patchError);
            }
        }

        // Jika belum ada APP STORE, jangan membuat snapshot parsial.
        // Halaman berikutnya akan melakukan load normal.
        if (!patchedAppStore && typeof window.invalidateAppStore === "function") {
            window.invalidateAppStore();
        }

        setStatusInputRealisasi(
            wasEditing ? "Realisasi berhasil diperbarui." : "Realisasi bulan " + bulan + " berhasil disimpan.",
            "success"
        );
    } catch (error) {
        console.error(error);
        setStatusInputRealisasi(error.message || "Gagal menyimpan realisasi.", "danger");
    } finally {
        button.disabled = false;
        setInputRealisasiEditMode(Boolean(editingRealisasiId));
    }
}



async function deleteInputRealisasi(id) {
    const item = realisasiRows.find(row => row.id_realisasi === id);
    if (!item) {
        setStatusInputRealisasi("Transaksi realisasi tidak ditemukan.", "warning");
        return;
    }

    const konfirmasi = window.confirm(
        "Hapus transaksi realisasi ini?\\n\\n" +
        "Bulan: " + (item.bulan || "-") + "\\n" +
        "Nominal: " + rupiahInput(item.nominal_realisasi) + "\\n" +
        "Keterangan: " + (item.keterangan || "-") + "\\n\\n" +
        "Data akan dihapus permanen dan dapat diinput ulang."
    );
    if (!konfirmasi) return;

    try {
        setStatusInputRealisasi("Menghapus transaksi...", "info");
        const result = await realisasiDelete({ id_realisasi: id });
        if (!result?.ok) throw new Error(result?.message || "Gagal menghapus realisasi.");

        realisasiRows = realisasiRows.filter(row => row.id_realisasi !== id);

        if (editingRealisasiId === id) {
            editingRealisasiId = null;
            resetFormInputRealisasi();
            setInputRealisasiEditMode(false);
        }

        renderListInputRealisasi();
        renderMasterInfoInputRealisasi();

        // Hapus dari snapshot lokal berdasarkan ID hasil mutation.
        if (typeof updateInputRealisasiLocalCache === "function") {
            updateInputRealisasiLocalCache("delete", result);
        }

        let patchedAppStore = false;
        if (typeof window.patchAppStoreRealisasi === "function") {
            try {
                patchedAppStore = window.patchAppStoreRealisasi("delete", result);
            } catch (patchError) {
                console.warn("Patch APP STORE gagal:", patchError);
            }
        }

        if (!patchedAppStore && typeof window.invalidateAppStore === "function") {
            window.invalidateAppStore();
        }

        setStatusInputRealisasi("Realisasi berhasil dihapus. Data dapat diinput ulang.", "success");
    } catch (error) {
        console.error(error);
        setStatusInputRealisasi(error.message || "Gagal menghapus realisasi.", "danger");
    }
}

function setInputRealisasiEditMode(editing) {
    const button = document.getElementById("realisasiSaveButton");
    const text = document.getElementById("realisasiSaveButtonText");
    if (text) text.textContent = editing ? "Perbarui Realisasi" : "Simpan Realisasi";
    if (button) {
        button.classList.toggle("btn-warning", editing);
        button.classList.toggle("btn-success", !editing);
    }

    let cancel = document.getElementById("realisasiCancelEditButton");
    if (editing && !cancel) {
        cancel = document.createElement("button");
        cancel.type = "button";
        cancel.id = "realisasiCancelEditButton";
        cancel.className = "btn btn-outline-secondary";
        cancel.innerHTML = '<i class="bi bi-x-circle"></i> Batal Edit';
        cancel.addEventListener("click", cancelEditInputRealisasi);
        button?.parentElement?.appendChild(cancel);
    } else if (!editing && cancel) {
        cancel.remove();
    }
}

function editInputRealisasi(id) {
    const item = realisasiRows.find(row => row.id_realisasi === id);
    if (!item) {
        setStatusInputRealisasi("Transaksi realisasi tidak ditemukan.", "warning");
        return;
    }

    if (String(item.status || "AKTIF").toUpperCase() !== "AKTIF") {
        setStatusInputRealisasi("Hanya transaksi aktif yang dapat diedit.", "warning");
        return;
    }

    const master = realisasiMaster.find(row =>
        row.id_anggaran === item.id_anggaran &&
        String(row.tahun) === String(item.tahun)
    );

    if (!master) {
        setStatusInputRealisasi("Master anggaran untuk transaksi ini tidak ditemukan.", "danger");
        return;
    }

    editingRealisasiId = id;
    selectedMaster = master;
    document.getElementById("realisasiSubKomponen").value = master.subKomponen || "";
    populateDetilInputRealisasi();
    document.getElementById("realisasiDetil").value = master.id_anggaran;
    selectedMaster = master;
    document.getElementById("realisasiBulan").value = item.bulan || "";
    document.getElementById("realisasiNominal").value = Number(item.nominal_realisasi) || "";
    document.getElementById("realisasiKeterangan").value = item.keterangan || "";
    renderMasterInfoInputRealisasi();
    setInputRealisasiEditMode(true);

    document.getElementById("realisasiForm")?.scrollIntoView({ behavior: "smooth", block: "start" });
    setStatusInputRealisasi("Mode Edit aktif. Ubah bulan, nominal, atau keterangan lalu klik Perbarui Realisasi.", "info");
}

function cancelEditInputRealisasi() {
    editingRealisasiId = null;
    resetFormInputRealisasi();
    setInputRealisasiEditMode(false);
    setStatusInputRealisasi("Edit dibatalkan.", "secondary");
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
