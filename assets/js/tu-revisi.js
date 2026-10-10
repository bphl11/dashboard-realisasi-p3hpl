// ============================================================
// TU REVISI PAGU — TRANSACTION UI
//
// Flow:
//   Komponen
//     -> Sub Komponen
//       -> Akun
//         -> Rincian Item
//           -> Pagu Lama
//           -> Pagu Baru
//           -> Jenis Revisi
//           -> Tanggal
//           -> Alasan
//
// Backend:
//   tu_bootstrap
//   tu_revisi_list
//   tu_revisi_save
//
// Tidak ada SAVE otomatis saat halaman dibuka.
// ============================================================

let tuRevisiState = {
    masters: [],
    masterById: Object.create(null),
    revisions: [],
    selectedMaster: null,
    busy: false
};

function tuRevEl(id) {
    return document.getElementById(id);
}

function tuRevYear() {
    return Number(
        TU_CONFIG?.TAHUN_DEFAULT || 2026
    );
}

function tuRevMoney(value) {
    return new Intl.NumberFormat(
        "id-ID",
        {
            style: "currency",
            currency: "IDR",
            maximumFractionDigits: 0
        }
    ).format(
        Number(value) || 0
    );
}

function tuRevEscape(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function tuRevToday() {
    const now =
        new Date();

    return [
        now.getFullYear(),
        String(
            now.getMonth() + 1
        ).padStart(2, "0"),
        String(
            now.getDate()
        ).padStart(2, "0")
    ].join("-");
}

function tuRevSetStatus(
    message,
    type = "info"
) {
    const el =
        tuRevEl(
            "tuPageStatus"
        );

    if (!el) return;

    el.className =
        "tu-alert tu-alert-" +
        type;

    el.textContent =
        message || "";

    el.classList.remove(
        "d-none"
    );
}

function tuRevOutput(
    action,
    data
) {
    const el =
        tuRevEl(
            "tuRevOutput"
        );

    if (!el) return;

    el.textContent =
        action +
        "\n\n" +
        JSON.stringify(
            data,
            null,
            2
        );
}

function tuRevResetSelect(
    id,
    placeholder,
    disabled = true
) {
    const select =
        tuRevEl(id);

    if (!select) return;

    select.innerHTML = "";

    const option =
        document.createElement(
            "option"
        );

    option.value = "";
    option.textContent =
        placeholder;

    select.appendChild(
        option
    );

    select.disabled =
        disabled;
}

function tuRevUnique(
    rows,
    keyFn
) {
    const seen =
        new Set();

    const output = [];

    (Array.isArray(rows)
        ? rows
        : []
    ).forEach(
        function (row) {
            const key =
                String(
                    keyFn(row) ?? ""
                );

            if (
                seen.has(key)
            ) {
                return;
            }

            seen.add(key);
            output.push(row);
        }
    );

    return output;
}

function tuRevSetOptions(
    id,
    rows,
    valueKey,
    labelFn,
    placeholder
) {
    const select =
        tuRevEl(id);

    if (!select) return;

    select.innerHTML = "";

    const first =
        document.createElement(
            "option"
        );

    first.value = "";
    first.textContent =
        placeholder;

    select.appendChild(
        first
    );

    (Array.isArray(rows)
        ? rows
        : []
    ).forEach(
        function (row) {
            const option =
                document.createElement(
                    "option"
                );

            option.value =
                String(
                    row?.[valueKey] ?? ""
                );

            option.textContent =
                labelFn(row);

            select.appendChild(
                option
            );
        }
    );

    select.disabled =
        !Array.isArray(rows) ||
        rows.length === 0;
}

function tuRevLoadMasters(
    result
) {
    const raw =
        Array.isArray(
            result?.master
        )
            ? result.master
            : Array.isArray(
                result?.data
            )
                ? result.data
                : Array.isArray(
                    result?.data?.master
                )
                    ? result.data.master
                    : [];

    const rows =
        raw.filter(
            function (m) {
                return String(
                    m?.status ??
                    "AKTIF"
                )
                .trim()
                .toUpperCase() ===
                "AKTIF";
            }
        );

    tuRevisiState.masters =
        rows;

    tuRevisiState.masterById =
        Object.create(null);

    rows.forEach(
        function (m) {
            const id =
                String(
                    m?.id_tu || ""
                ).trim();

            if (id) {
                tuRevisiState.masterById[id] =
                    m;
            }
        }
    );

    const components =
        tuRevUnique(
            rows,
            function (m) {
                return (
                    String(
                        m?.kode_komponen || ""
                    ).trim() +
                    "|" +
                    String(
                        m?.komponen || ""
                    ).trim()
                );
            }
        );

    tuRevSetOptions(
        "tuRevKomponen",
        components,
        "kode_komponen",
        function (m) {
            const code =
                String(
                    m?.kode_komponen || ""
                ).trim();

            const name =
                String(
                    m?.komponen || ""
                ).trim();

            return code
                ? code + " — " + name
                : name;
        },
        "Pilih Komponen"
    );

    tuRevResetSelect(
        "tuRevSubKomponen",
        "Pilih Komponen terlebih dahulu",
        true
    );

    tuRevResetSelect(
        "tuRevAkun",
        "Pilih Sub Komponen terlebih dahulu",
        true
    );

    tuRevResetSelect(
        "tuRevRincianItem",
        "Pilih Akun terlebih dahulu",
        true
    );

    tuRevClearSelection();

    if (!rows.length) {
        tuRevSetStatus(
            "Master TU kosong. tu_bootstrap tidak memberikan data aktif.",
            "danger"
        );
        return;
    }

    tuRevSetStatus(
        rows.length.toLocaleString("id-ID") +
        " Rincian Item berhasil dimuat. Silakan pilih Komponen.",
        "success"
    );
}

function tuRevClearSelection() {
    tuRevisiState.selectedMaster =
        null;

    tuRevEl(
        "tuRevSelected"
    )?.classList.add(
        "d-none"
    );

    tuRevEl(
        "tuRevFormSection"
    )?.classList.add(
        "d-none"
    );
}

function tuRevSyncSubKomponen() {
    const komponen =
        String(
            tuRevEl(
                "tuRevKomponen"
            )?.value || ""
        ).trim();

    tuRevResetSelect(
        "tuRevSubKomponen",
        "Pilih Komponen terlebih dahulu",
        true
    );

    tuRevResetSelect(
        "tuRevAkun",
        "Pilih Sub Komponen terlebih dahulu",
        true
    );

    tuRevResetSelect(
        "tuRevRincianItem",
        "Pilih Akun terlebih dahulu",
        true
    );

    tuRevClearSelection();

    if (!komponen) {
        return;
    }

    const rows =
        tuRevisiState.masters.filter(
            function (m) {
                return String(
                    m?.kode_komponen || ""
                ).trim() ===
                komponen;
            }
        );

    const unique =
        tuRevUnique(
            rows,
            function (m) {
                return (
                    String(
                        m?.kode_sub_komponen || ""
                    ).trim() +
                    "|" +
                    String(
                        m?.sub_komponen || ""
                    ).trim()
                );
            }
        );

    tuRevSetOptions(
        "tuRevSubKomponen",
        unique,
        "kode_sub_komponen",
        function (m) {
            const code =
                String(
                    m?.kode_sub_komponen || ""
                ).trim();

            const name =
                String(
                    m?.sub_komponen || ""
                ).trim();

            return code
                ? code + " — " + name
                : name;
        },
        "Pilih Sub Komponen"
    );
}

function tuRevSyncAkun() {
    const komponen =
        String(
            tuRevEl(
                "tuRevKomponen"
            )?.value || ""
        ).trim();

    const sub =
        String(
            tuRevEl(
                "tuRevSubKomponen"
            )?.value || ""
        ).trim();

    tuRevResetSelect(
        "tuRevAkun",
        "Pilih Sub Komponen terlebih dahulu",
        true
    );

    tuRevResetSelect(
        "tuRevRincianItem",
        "Pilih Akun terlebih dahulu",
        true
    );

    tuRevClearSelection();

    if (
        !komponen ||
        !sub
    ) {
        return;
    }

    const rows =
        tuRevisiState.masters.filter(
            function (m) {
                return (
                    String(
                        m?.kode_komponen || ""
                    ).trim() ===
                    komponen &&
                    String(
                        m?.kode_sub_komponen || ""
                    ).trim() ===
                    sub
                );
            }
        );

    const unique =
        tuRevUnique(
            rows,
            function (m) {
                return (
                    String(
                        m?.kode_akun || ""
                    ).trim() +
                    "|" +
                    String(
                        m?.akun || ""
                    ).trim()
                );
            }
        );

    tuRevSetOptions(
        "tuRevAkun",
        unique,
        "kode_akun",
        function (m) {
            const code =
                String(
                    m?.kode_akun || ""
                ).trim();

            const name =
                String(
                    m?.akun || ""
                ).trim();

            return code
                ? code + " — " + name
                : name;
        },
        "Pilih Akun"
    );
}

function tuRevSyncRincian() {
    const komponen =
        String(
            tuRevEl(
                "tuRevKomponen"
            )?.value || ""
        ).trim();

    const sub =
        String(
            tuRevEl(
                "tuRevSubKomponen"
            )?.value || ""
        ).trim();

    const akun =
        String(
            tuRevEl(
                "tuRevAkun"
            )?.value || ""
        ).trim();

    tuRevResetSelect(
        "tuRevRincianItem",
        "Pilih Akun terlebih dahulu",
        true
    );

    tuRevClearSelection();

    if (
        !komponen ||
        !sub ||
        !akun
    ) {
        return;
    }

    const rows =
        tuRevisiState.masters.filter(
            function (m) {
                return (
                    String(
                        m?.kode_komponen || ""
                    ).trim() ===
                    komponen &&
                    String(
                        m?.kode_sub_komponen || ""
                    ).trim() ===
                    sub &&
                    String(
                        m?.kode_akun || ""
                    ).trim() ===
                    akun
                );
            }
        );

    tuRevSetOptions(
        "tuRevRincianItem",
        rows,
        "id_tu",
        function (m) {
            const code =
                String(
                    m?.kode_item || ""
                ).trim();

            const name =
                String(
                    m?.rincian_item || ""
                ).trim();

            return code
                ? code + " — " + name
                : name;
        },
        "Pilih Rincian Item"
    );
}

function tuRevSelectMaster(
    master
) {
    tuRevisiState.selectedMaster =
        master || null;

    const section =
        tuRevEl(
            "tuRevFormSection"
        );

    const selected =
        tuRevEl(
            "tuRevSelected"
        );

    if (!master) {
        tuRevClearSelection();
        return;
    }

    const pagu =
        Number(
            master?.pagu_revisi
        ) || 0;

    const real =
        Number(
            master?.realisasi_final
        ) || 0;

    // Prefer the latest matching revision from the read list
    // for context, but the current master pagu remains the source
    // for Pagu Lama.
    const revisions =
        tuRevisiState.revisions.filter(
            function (row) {
                return String(
                    row?.id_tu || ""
                ).trim() ===
                String(
                    master?.id_tu || ""
                ).trim();
            }
        );

    const latestRevision =
        revisions.length
            ? revisions[revisions.length - 1]
            : null;

    const rpdResult =
        Number(
            master?.total_rpd
        ) || 0;

    const minimum =
        Math.max(
            real,
            rpdResult
        );

    if (selected) {
        selected.textContent =
            "Terpilih: " +
            String(
                master?.rincian_item || "-"
            ) +
            " · ID TU " +
            String(
                master?.id_tu || "-"
            );
        selected.classList.remove(
            "d-none"
        );
    }

    tuRevEl(
        "tuRevPaguLama"
    ).textContent =
        tuRevMoney(pagu);

    tuRevEl(
        "tuRevRealisasi"
    ).textContent =
        tuRevMoney(real);

    tuRevEl(
        "tuRevRpd"
    ).textContent =
        tuRevMoney(rpdResult);

    tuRevEl(
        "tuRevMinimum"
    ).textContent =
        tuRevMoney(minimum);

    const input =
        tuRevEl(
            "tuRevPaguBaru"
        );

    if (input) {
        input.value =
            "";

        input.min =
            String(
                Math.max(
                    minimum,
                    0
                )
            );
    }

    const date =
        tuRevEl(
            "tuRevTanggal"
        );

    if (date) {
        date.value =
            tuRevToday();
    }

    const preview =
        tuRevEl(
            "tuRevPreview"
        );

    if (preview) {
        preview.textContent =
            latestRevision
                ? (
                    "Revisi terakhir: " +
                    tuRevMoney(
                        latestRevision.pagu_lama
                    ) +
                    " → " +
                    tuRevMoney(
                        latestRevision.pagu_baru
                    ) +
                    " (" +
                    String(
                        latestRevision.jenis_revisi ||
                        "-"
                    ) +
                    ")."
                )
                : "Belum ada riwayat revisi untuk Rincian Item ini.";

        preview.classList.remove(
            "d-none"
        );
    }

    section?.classList.remove(
        "d-none"
    );

    tuRevUpdatePreview();
}

function tuRevUpdatePreview() {
    const master =
        tuRevisiState.selectedMaster;

    const input =
        tuRevEl(
            "tuRevPaguBaru"
        );

    const preview =
        tuRevEl(
            "tuRevPreview"
        );

    if (
        !master ||
        !input ||
        !preview
    ) {
        return;
    }

    const oldPagu =
        Number(
            master?.pagu_revisi
        ) || 0;

    const newPagu =
        Number(
            input.value
        );

    if (!Number.isFinite(newPagu)) {
        return;
    }

    const selisih =
        newPagu -
        oldPagu;

    const minimum =
        Math.max(
            Number(
                master?.realisasi_final
            ) || 0,
            Number(
                master?.total_rpd
            ) || 0
        );

    preview.textContent =
        "Preview: " +
        tuRevMoney(oldPagu) +
        " → " +
        tuRevMoney(newPagu) +
        " · Selisih " +
        (
            selisih >= 0
                ? "+"
                : ""
        ) +
        tuRevMoney(selisih) +
        " · Minimum Pagu Baru " +
        tuRevMoney(minimum) +
        ".";

    preview.classList.remove(
        "d-none"
    );
}

function tuRevValidate() {
    const master =
        tuRevisiState.selectedMaster;

    if (!master) {
        throw new Error(
            "Rincian Item belum dipilih."
        );
    }

    const paguLama =
        Number(
            master?.pagu_revisi
        ) || 0;

    const real =
        Number(
            master?.realisasi_final
        ) || 0;

    const rpd =
        Number(
            master?.total_rpd
        ) || 0;

    const minimum =
        Math.max(
            real,
            rpd
        );

    const paguBaru =
        Number(
            tuRevEl(
                "tuRevPaguBaru"
            )?.value
        );

    const jenis =
        String(
            tuRevEl(
                "tuRevJenis"
            )?.value || ""
        ).trim();

    const tanggal =
        String(
            tuRevEl(
                "tuRevTanggal"
            )?.value || ""
        ).trim();

    const alasan =
        String(
            tuRevEl(
                "tuRevAlasan"
            )?.value || ""
        ).trim();

    if (
        !Number.isFinite(
            paguBaru
        ) ||
        paguBaru < 0
    ) {
        throw new Error(
            "Pagu Baru harus diisi dan tidak boleh negatif."
        );
    }

    if (
        paguBaru <
        minimum
    ) {
        throw new Error(
            "Pagu Baru tidak boleh lebih kecil dari minimum " +
            tuRevMoney(minimum) +
            " (maksimum Realisasi Final dan Total RPD Existing)."
        );
    }

    if (!jenis) {
        throw new Error(
            "Jenis Revisi wajib dipilih."
        );
    }

    if (!tanggal) {
        throw new Error(
            "Tanggal Revisi wajib diisi."
        );
    }

    if (!alasan) {
        throw new Error(
            "Alasan revisi wajib diisi."
        );
    }

    return {
        tahun:
            tuRevYear(),

        id_tu:
            String(
                master?.id_tu || ""
            ).trim(),

        pagu_baru:
            paguBaru,

        jenis_revisi:
            jenis,

        tanggal_revisi:
            tanggal,

        alasan
    };
}

function tuRevSetBusy(
    busy,
    message = "Memproses..."
) {
    tuRevisiState.busy =
        busy;

    [
        "tuRevSaveButton",
        "tuRevResetButton",
        "tuRevReloadButton",
        "tuRevKomponen",
        "tuRevSubKomponen",
        "tuRevAkun",
        "tuRevRincianItem",
        "tuRevPaguBaru",
        "tuRevJenis",
        "tuRevTanggal",
        "tuRevAlasan"
    ].forEach(
        function (id) {
            const el =
                tuRevEl(id);

            if (el) {
                el.disabled =
                    busy;
            }
        }
    );

    if (busy) {
        tuRevOutput(
            "tu_revisi_save",
            {
                status: message
            }
        );
    }
}

async function tuRevLoadRevisions() {
    const result =
        await tuApiRequest(
            "tu_revisi_list",
            {
                tahun:
                    tuRevYear()
            }
        );

    tuRevisiState.revisions =
        Array.isArray(
            result?.data
        )
            ? result.data
            : [];

    tuRevRenderRevisions();

    return result;
}

function tuRevRenderRevisions() {
    const rows =
        tuRevisiState.revisions;

    const count =
        tuRevEl(
            "tuRevCount"
        );

    if (count) {
        count.textContent =
            rows.length +
            " data";
    }

    const body =
        tuRevEl(
            "tuRevBody"
        );

    if (!body) return;

    if (!rows.length) {
        body.innerHTML =
            '<tr><td colspan="10" class="tu-rev-log-empty">' +
            "Belum ada riwayat revisi." +
            "</td></tr>";
        return;
    }

    body.innerHTML =
        rows.map(
            function (row, index) {
                const status =
                    String(
                        row?.status ||
                        "AKTIF"
                    ).toUpperCase();

                const diff =
                    Number(
                        row?.selisih_pagu
                    ) || 0;

                return (
                    "<tr>" +
                    "<td>" +
                    (index + 1) +
                    "</td>" +
                    "<td>" +
                    tuRevEscape(
                        row?.id_revisi_tu
                    ) +
                    "</td>" +
                    "<td>" +
                    tuRevEscape(
                        row?.id_tu
                    ) +
                    "</td>" +
                    '<td class="text-end">' +
                    tuRevMoney(
                        row?.pagu_lama
                    ) +
                    "</td>" +
                    '<td class="text-end">' +
                    tuRevMoney(
                        row?.pagu_baru
                    ) +
                    "</td>" +
                    '<td class="text-end">' +
                    (
                        diff >= 0
                            ? "+"
                            : ""
                    ) +
                    tuRevMoney(
                        diff
                    ) +
                    "</td>" +
                    "<td>" +
                    tuRevEscape(
                        row?.jenis_revisi
                    ) +
                    "</td>" +
                    "<td>" +
                    tuRevEscape(
                        row?.tanggal_revisi
                    ) +
                    "</td>" +
                    "<td>" +
                    tuRevEscape(
                        row?.alasan
                    ) +
                    "</td>" +
                    "<td>" +
                    '<span class="tu-status-pill ' +
                    (
                        status === "AKTIF"
                            ? "tu-status-ok"
                            : "tu-status-wait"
                    ) +
                    '">' +
                    tuRevEscape(
                        status
                    ) +
                    "</span>" +
                    "</td>" +
                    "</tr>"
                );
            }
        ).join("");
}

async function tuRevLoadAll() {
    tuRevSetStatus(
        "Memuat master TU dan riwayat revisi...",
        "info"
    );

    const bootstrap =
        await tuApiRequest(
            "tu_bootstrap",
            {
                tahun:
                    tuRevYear()
            }
        );

    if (!bootstrap?.ok) {
        throw new Error(
            bootstrap?.message ||
            "tu_bootstrap gagal."
        );
    }

    const master =
        Array.isArray(
            bootstrap?.master
        )
            ? bootstrap.master
            : [];

    if (!master.length) {
        throw new Error(
            "tu_bootstrap berhasil tetapi master TU kosong."
        );
    }

    tuRevLoadMasters(
        bootstrap
    );

    await tuRevLoadRevisions();

    tuRevSetStatus(
        master.length.toLocaleString("id-ID") +
        " Rincian Item dan riwayat revisi berhasil dimuat.",
        "success"
    );

    tuRevOutput(
        "tu_bootstrap + tu_revisi_list",
        {
            ok: true,
            master_count:
                master.length,
            revisi_count:
                tuRevisiState.revisions.length
        }
    );
}

async function tuRevisiSave() {
    if (tuRevisiState.busy) {
        return;
    }

    let payload;

    try {
        payload =
            tuRevValidate();
    } catch (error) {
        tuRevSetStatus(
            error?.message ||
            String(error),
            "danger"
        );
        return;
    }

    const master =
        tuRevisiState.selectedMaster;

    const confirmed =
        window.confirm(
            "Simpan revisi pagu?\n\n" +
            "Rincian Item: " +
            String(
                master?.rincian_item ||
                "-"
            ) +
            "\nID TU: " +
            String(
                master?.id_tu ||
                "-"
            ) +
            "\nPagu Lama: " +
            tuRevMoney(
                master?.pagu_revisi
            ) +
            "\nPagu Baru: " +
            tuRevMoney(
                payload.pagu_baru
            ) +
            "\n\nPerubahan ini akan langsung dicatat di data TU produksi."
        );

    if (!confirmed) {
        return;
    }

    tuRevSetBusy(
        true,
        "Menjalankan tu_revisi_save..."
    );

    try {
        const result =
            await tuApiRequest(
                "tu_revisi_save",
                payload
            );

        tuRevOutput(
            "tu_revisi_save",
            result
        );

        tuRevSetStatus(
            result?.message ||
            "Revisi Pagu TU berhasil disimpan.",
            "success"
        );

        await tuRevLoadAll();
    } catch (error) {
        tuRevOutput(
            "tu_revisi_save",
            {
                ok: false,
                error:
                    error?.message ||
                    String(error)
            }
        );

        tuRevSetStatus(
            error?.message ||
            "Gagal menyimpan revisi pagu.",
            "danger"
        );
    } finally {
        tuRevSetBusy(
            false
        );
    }
}

function tuRevResetForm() {
    const master =
        tuRevisiState.selectedMaster;

    if (!master) {
        return;
    }

    tuRevEl(
        "tuRevPaguBaru"
    ).value = "";

    tuRevEl(
        "tuRevJenis"
    ).value =
        "PENAMBAHAN_PAGU";

    tuRevEl(
        "tuRevTanggal"
    ).value =
        tuRevToday();

    tuRevEl(
        "tuRevAlasan"
    ).value = "";

    tuRevUpdatePreview();
}

function tuHandleBootstrap(
    result
) {
    tuRevLoadMasters(
        result
    );

    tuRevLoadRevisions()
        .catch(
            function (error) {
                tuRevSetStatus(
                    error?.message ||
                    "Gagal memuat riwayat revisi.",
                    "danger"
                );
            }
        );
}

function tuInitData() {
    const user =
        typeof tuGetStoredUser ===
        "function"
            ? tuGetStoredUser()
            : null;

    if (
        user?.email &&
        typeof tuShowApp ===
        "function"
    ) {
        tuShowApp(
            user
        );

        tuRevLoadAll()
            .catch(
                function (error) {
                    tuRevSetStatus(
                        error?.message ||
                        "Gagal memuat data revisi TU.",
                        "danger"
                    );
                }
            );
    }
}

document.addEventListener(
    "DOMContentLoaded",
    function () {

        const date =
            tuRevEl(
                "tuRevTanggal"
            );

        if (date) {
            date.value =
                tuRevToday();
        }

        tuRevEl(
            "tuRevKomponen"
        )?.addEventListener(
            "change",
            tuRevSyncSubKomponen
        );

        tuRevEl(
            "tuRevSubKomponen"
        )?.addEventListener(
            "change",
            tuRevSyncAkun
        );

        tuRevEl(
            "tuRevAkun"
        )?.addEventListener(
            "change",
            tuRevSyncRincian
        );

        tuRevEl(
            "tuRevRincianItem"
        )?.addEventListener(
            "change",
            function () {
                const id =
                    String(
                        this.value || ""
                    ).trim();

                const master =
                    tuRevisiState.masterById[
                        id
                    ] || null;

                tuRevSelectMaster(
                    master
                );
            }
        );

        tuRevEl(
            "tuRevPaguBaru"
        )?.addEventListener(
            "input",
            tuRevUpdatePreview
        );

        tuRevEl(
            "tuRevJenis"
        )?.addEventListener(
            "change",
            tuRevUpdatePreview
        );

        tuRevEl(
            "tuRevSaveButton"
        )?.addEventListener(
            "click",
            tuRevisiSave
        );

        tuRevEl(
            "tuRevResetButton"
        )?.addEventListener(
            "click",
            tuRevResetForm
        );

        tuRevEl(
            "tuRevReloadButton"
        )?.addEventListener(
            "click",
            function () {
                tuRevLoadAll()
                    .catch(
                        function (error) {
                            tuRevSetStatus(
                                error?.message ||
                                "Gagal memuat ulang revisi.",
                                "danger"
                            );
                        }
                    );
            }
        );
    }
);
