// ============================================================
// TU REALISASI — TRANSACTION UI
//
// Form visible:
//   Komponen
//   Sub Komponen
//   Akun
//   Rincian Item
//   Bulan Realisasi
//   Nominal
//   Keterangan
//
// ID TU dan ID Realisasi tidak diisi operator.
// ID TU diambil dari Rincian Item.
// ID Realisasi dibuat otomatis oleh backend.
//
// Tanggal realisasi dipakai internal oleh API dan tidak ditampilkan.
// Tidak ada SAVE/UPDATE/DELETE otomatis saat halaman dibuka.
// ============================================================

let tuRealisasiState = {
    masters: [],
    masterById: Object.create(null),
    rows: [],
    editingId: null,
    editingOriginalDate: "",
    busy: false
};

function tuRealEl(id) {
    return document.getElementById(id);
}

function tuRealTahun() {
    return Number(
        TU_CONFIG?.TAHUN_DEFAULT || 2026
    );
}

function tuRealFormatRupiah(value) {
    return new Intl.NumberFormat(
        "id-ID",
        {
            style: "currency",
            currency: "IDR",
            maximumFractionDigits: 0
        }
    ).format(Number(value) || 0);
}

function tuRealEscapeHtml(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function tuRealToday() {
    const now = new Date();

    return [
        now.getFullYear(),
        String(now.getMonth() + 1).padStart(2, "0"),
        String(now.getDate()).padStart(2, "0")
    ].join("-");
}

function tuRealToInputDate(value) {
    if (!value) return "";

    const text = String(value);

    const match = text.match(
        /^(\d{4})-(\d{2})-(\d{2})/
    );

    if (match) {
        return (
            match[1] +
            "-" +
            match[2] +
            "-" +
            match[3]
        );
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return "";
    }

    return [
        date.getFullYear(),
        String(date.getMonth() + 1).padStart(2, "0"),
        String(date.getDate()).padStart(2, "0")
    ].join("-");
}

function tuRealSetStatus(
    message,
    type = "info"
) {
    const el =
        tuRealEl("tuPageStatus");

    if (!el) return;

    el.className =
        "tu-alert tu-alert-" + type;

    el.textContent =
        message || "";

    el.classList.remove("d-none");
}

function tuRealSetOutput(
    action,
    data
) {
    const output =
        tuRealEl("tuRealOutput");

    if (!output) return;

    output.textContent =
        action +
        "\n\n" +
        JSON.stringify(
            data,
            null,
            2
        );
}

function tuRealSetBusy(
    busy,
    text = "Memproses..."
) {
    tuRealisasiState.busy = busy;

    const ids = [
        "tuRealSaveButton",
        "tuRealUpdateButton",
        "tuRealCancelButton",
        "tuRealRefreshButton",
        "tuRealKomponen",
        "tuRealSubKomponen",
        "tuRealAkun",
        "tuRealRincianItem",
        "tuRealBulan",
        "tuRealNominal",
        "tuRealKeterangan"
    ];

    ids.forEach(function (id) {
        const el = tuRealEl(id);
        if (el) {
            el.disabled = busy;
        }
    });

    if (busy) {
        const output =
            tuRealEl("tuRealOutput");

        if (output) {
            output.textContent =
                text;
        }
    }
}

function tuRealResetSelect(
    id,
    placeholder,
    disabled = true
) {
    const select =
        tuRealEl(id);

    if (!select) return;

    select.innerHTML =
        "";

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

function tuRealSetOptions(
    id,
    rows,
    valueKey,
    labelFn,
    placeholder
) {
    const select =
        tuRealEl(id);

    if (!select) return;

    select.innerHTML =
        "";

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

    rows.forEach(function (row) {
        const option =
            document.createElement(
                "option"
            );

        option.value =
            String(
                row[valueKey] ?? ""
            );

        option.textContent =
            labelFn(row);

        select.appendChild(
            option
        );
    });

    select.disabled =
        rows.length === 0;
}

function tuRealUniqueBy(
    rows,
    keyFn
) {
    const map =
        new Map();

    rows.forEach(function (row) {
        const key =
            String(
                keyFn(row) ?? ""
            );

        if (!map.has(key)) {
            map.set(key, row);
        }
    });

    return Array.from(
        map.values()
    );
}

function tuRealLoadMasters(
    masters
) {
    const valid =
        Array.isArray(masters)
            ? masters.filter(function (m) {
                return (
                    String(
                        m?.status || "AKTIF"
                    ).toUpperCase() ===
                    "AKTIF"
                );
            })
            : [];

    tuRealisasiState.masters =
        valid;

    tuRealisasiState.masterById =
        Object.create(null);

    valid.forEach(function (m) {
        const id =
            String(
                m?.id_tu || ""
            ).trim();

        if (id) {
            tuRealisasiState.masterById[id] =
                m;
        }
    });

    const components =
        tuRealUniqueBy(
            valid,
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

    tuRealSetOptions(
        "tuRealKomponen",
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
                ? code +
                    " — " +
                    name
                : name;
        },
        "Pilih Komponen"
    );

    tuRealResetSelect(
        "tuRealSubKomponen",
        "Pilih Komponen terlebih dahulu",
        true
    );

    tuRealResetSelect(
        "tuRealAkun",
        "Pilih Sub Komponen terlebih dahulu",
        true
    );

    tuRealResetSelect(
        "tuRealRincianItem",
        "Pilih Akun terlebih dahulu",
        true
    );

    tuRealHideItemInfo();
}

function tuRealComponentRows() {
    return tuRealisasiState.masters;
}

function tuRealSelectedMaster() {
    const idTu =
        tuRealSelectedIdTu();

    return idTu
        ? tuRealisasiState.masterById[idTu] || null
        : null;
}

function tuRealSelectedIdTu() {
    const select =
        tuRealEl(
            "tuRealRincianItem"
        );

    return String(
        select?.value || ""
    ).trim();
}

function tuRealSyncSubKomponen() {
    const komponenSelect =
        tuRealEl("tuRealKomponen");

    const kodeKomponen =
        String(
            komponenSelect?.value || ""
        ).trim();

    tuRealResetSelect(
        "tuRealSubKomponen",
        "Pilih Sub Komponen terlebih dahulu",
        true
    );

    tuRealResetSelect(
        "tuRealAkun",
        "Pilih Akun terlebih dahulu",
        true
    );

    tuRealResetSelect(
        "tuRealRincianItem",
        "Pilih Rincian Item terlebih dahulu",
        true
    );

    tuRealHideItemInfo();

    if (!kodeKomponen) {
        return;
    }

    const rows =
        tuRealComponentRows().filter(
            function (m) {
                return String(
                    m?.kode_komponen || ""
                ).trim() ===
                kodeKomponen;
            }
        );

    const unique =
        tuRealUniqueBy(
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

    tuRealSetOptions(
        "tuRealSubKomponen",
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
                ? code +
                    " — " +
                    name
                : name;
        },
        "Pilih Sub Komponen"
    );
}

function tuRealSyncAkun() {
    const kodeKomponen =
        String(
            tuRealEl(
                "tuRealKomponen"
            )?.value || ""
        ).trim();

    const kodeSub =
        String(
            tuRealEl(
                "tuRealSubKomponen"
            )?.value || ""
        ).trim();

    tuRealResetSelect(
        "tuRealAkun",
        "Pilih Akun terlebih dahulu",
        true
    );

    tuRealResetSelect(
        "tuRealRincianItem",
        "Pilih Akun terlebih dahulu",
        true
    );

    tuRealHideItemInfo();

    if (!kodeKomponen || !kodeSub) {
        return;
    }

    const rows =
        tuRealisasiState.masters.filter(
            function (m) {
                return (
                    String(
                        m?.kode_komponen || ""
                    ).trim() ===
                    kodeKomponen &&
                    String(
                        m?.kode_sub_komponen || ""
                    ).trim() ===
                    kodeSub
                );
            }
        );

    const unique =
        tuRealUniqueBy(
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

    tuRealSetOptions(
        "tuRealAkun",
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
                ? code +
                    " — " +
                    name
                : name;
        },
        "Pilih Akun"
    );
}

function tuRealSyncRincianItem() {
    const kodeKomponen =
        String(
            tuRealEl(
                "tuRealKomponen"
            )?.value || ""
        ).trim();

    const kodeSub =
        String(
            tuRealEl(
                "tuRealSubKomponen"
            )?.value || ""
        ).trim();

    const kodeAkun =
        String(
            tuRealEl(
                "tuRealAkun"
            )?.value || ""
        ).trim();

    tuRealResetSelect(
        "tuRealRincianItem",
        "Pilih Rincian Item",
        true
    );

    tuRealHideItemInfo();

    if (
        !kodeKomponen ||
        !kodeSub ||
        !kodeAkun
    ) {
        return;
    }

    const rows =
        tuRealisasiState.masters.filter(
            function (m) {
                return (
                    String(
                        m?.kode_komponen || ""
                    ).trim() ===
                    kodeKomponen &&
                    String(
                        m?.kode_sub_komponen || ""
                    ).trim() ===
                    kodeSub &&
                    String(
                        m?.kode_akun || ""
                    ).trim() ===
                    kodeAkun
                );
            }
        );

    tuRealSetOptions(
        "tuRealRincianItem",
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
                ? code +
                    " — " +
                    name
                : name;
        },
        "Pilih Rincian Item"
    );
}

function tuRealActiveInputTotal(
    idTu,
    excludeId = ""
) {
    const target =
        String(idTu || "").trim();

    const excluded =
        String(excludeId || "").trim();

    return tuRealisasiState.rows.reduce(
        function (total, row) {
            const rowIdTu =
                String(
                    row?.id_tu || ""
                ).trim();

            const rowId =
                String(
                    row?.id_realisasi_tu || ""
                ).trim();

            const status =
                String(
                    row?.status || "AKTIF"
                ).trim().toUpperCase();

            if (
                rowIdTu === target &&
                status === "AKTIF" &&
                rowId !== excluded
            ) {
                return (
                    total +
                    (
                        Number(
                            row?.nominal_realisasi
                        ) || 0
                    )
                );
            }

            return total;
        },
        0
    );
}

function tuRealAvailableAmount(
    master,
    excludeId = ""
) {
    if (!master) {
        return 0;
    }

    const pagu =
        Number(
            master?.pagu_revisi
        ) || 0;

    const dasar =
        Number(
            master?.realisasi_dasar
        ) || 0;

    const activeInput =
        tuRealActiveInputTotal(
            master?.id_tu,
            excludeId
        );

    return Math.max(
        pagu -
        dasar -
        activeInput,
        0
    );
}

function tuRealShowItemInfo() {
    const master =
        tuRealSelectedMaster();

    const box =
        tuRealEl(
            "tuRealItemInfo"
        );

    if (!master) {
        tuRealHideItemInfo();
        return;
    }

    if (box) {
        box.classList.remove(
            "d-none"
        );
    }

    const pagu =
        tuRealEl(
            "tuRealPagu"
        );

    const dasar =
        tuRealEl(
            "tuRealDasar"
        );

    const sisa =
        tuRealEl(
            "tuRealSisa"
        );

    const idInfo =
        tuRealEl(
            "tuRealIdTuInfo"
        );

    if (pagu) {
        pagu.textContent =
            tuRealFormatRupiah(
                master.pagu_revisi
            );
    }

    if (dasar) {
        dasar.textContent =
            tuRealFormatRupiah(
                master.realisasi_dasar
            );
    }

    if (sisa) {
        sisa.textContent =
            tuRealFormatRupiah(
                tuRealAvailableAmount(
                    master,
                    tuRealisasiState.editingId
                )
            );
    }

    if (idInfo) {
        idInfo.textContent =
            String(
                master.id_tu || "-"
            );
    }
}

function tuRealHideItemInfo() {
    tuRealEl(
        "tuRealItemInfo"
    )?.classList.add(
        "d-none"
    );
}

function tuRealValidateForm() {
    const master =
        tuRealSelectedMaster();

    const bulan =
        Number(
            tuRealEl(
                "tuRealBulan"
            )?.value
        );

    const nominal =
        Number(
            tuRealEl(
                "tuRealNominal"
            )?.value
        );

    const keterangan =
        String(
            tuRealEl(
                "tuRealKeterangan"
            )?.value ||
            ""
        ).trim();

    if (!master) {
        throw new Error(
            "Rincian Item belum dipilih."
        );
    }

    if (
        !Number.isInteger(bulan) ||
        bulan < 1 ||
        bulan > 12
    ) {
        throw new Error(
            "Bulan realisasi harus dipilih."
        );
    }

    if (
        !Number.isFinite(nominal) ||
        nominal <= 0
    ) {
        throw new Error(
            "Nominal realisasi harus lebih besar dari 0."
        );
    }

    const sisa =
        tuRealAvailableAmount(
            master,
            tuRealisasiState.editingId
        );

    if (nominal > sisa) {
        throw new Error(
            "Nominal melebihi sisa anggaran Rincian Item. Sisa tersedia: " +
            tuRealFormatRupiah(sisa) +
            "."
        );
    }

    if (!keterangan) {
        throw new Error(
            "Keterangan wajib diisi."
        );
    }

    return {
        id_tu:
            String(
                master.id_tu || ""
            ).trim(),

        tanggal_realisasi:
            String(
                tuRealEl(
                    "tuRealTanggal"
                )?.value ||
                tuRealToday()
            ),

        bulan_realisasi:
            bulan,

        nominal_realisasi:
            nominal,

        keterangan
    };
}

function tuRealApplyMaster(
    master
) {
    if (!master) {
        throw new Error(
            "Master Rincian Item tidak ditemukan."
        );
    }

    const komponen =
        String(
            master.kode_komponen || ""
        ).trim();

    const sub =
        String(
            master.kode_sub_komponen || ""
        ).trim();

    const akun =
        String(
            master.kode_akun || ""
        ).trim();

    const idTu =
        String(
            master.id_tu || ""
        ).trim();

    const c =
        tuRealEl(
            "tuRealKomponen"
        );

    c.value =
        komponen;

    tuRealSyncSubKomponen();

    const s =
        tuRealEl(
            "tuRealSubKomponen"
        );

    s.value =
        sub;

    tuRealSyncAkun();

    const a =
        tuRealEl(
            "tuRealAkun"
        );

    a.value =
        akun;

    tuRealSyncRincianItem();

    const r =
        tuRealEl(
            "tuRealRincianItem"
        );

    r.value =
        idTu;

    tuRealShowItemInfo();
}

async function tuRealisasiList(
    showStatus = true
) {
    if (
        tuRealisasiState.busy
    ) {
        return;
    }

    try {
        const result =
            await tuApiRequest(
                "tu_realisasi_list",
                {
                    tahun:
                        tuRealTahun()
                }
            );

        tuRealisasiState.rows =
            Array.isArray(
                result?.data
            )
                ? result.data
                : [];

        tuRenderList(
            tuRealisasiState.rows
        );

        if (tuRealSelectedMaster()) {
            tuRealShowItemInfo();
        }

        if (showStatus) {
            tuRealSetStatus(
                "Daftar realisasi berhasil dimuat.",
                "success"
            );
        }

        return result;
    } catch (error) {
        tuRealisasiState.rows =
            [];

        tuRenderList([]);

        tuRealSetStatus(
            error?.message ||
            "Gagal membaca daftar realisasi.",
            "danger"
        );

        tuRealSetOutput(
            "tu_realisasi_list",
            {
                ok: false,
                error:
                    error?.message ||
                    String(error)
            }
        );

        throw error;
    }
}

function tuRenderList(
    rows
) {
    const body =
        tuRealEl(
            "tuRealBody"
        );

    const count =
        tuRealEl(
            "tuRealCount"
        );

    if (count) {
        count.textContent =
            String(
                rows.length
            ) +
            " data";
    }

    if (!body) return;

    if (!rows.length) {
        body.innerHTML =
            '<tr><td colspan="10" class="tu-real-empty">' +
            "Tidak ada realisasi untuk tahun yang dipilih." +
            "</td></tr>";

        return;
    }

    body.innerHTML =
        rows.map(
            function (row, index) {
                const id =
                    String(
                        row?.id_realisasi_tu ||
                        ""
                    );

                const master =
                    tuRealisasiState.masterById[
                        String(
                            row?.id_tu || ""
                        ).trim()
                    ];

                const status =
                    String(
                        row?.status ||
                        "AKTIF"
                    ).toUpperCase();

                const inactive =
                    status ===
                    "NONAKTIF";

                const komponen =
                    master?.komponen ||
                    "-";

                const sub =
                    master?.sub_komponen ||
                    "-";

                const akun =
                    master?.akun ||
                    "-";

                const rincian =
                    master?.rincian_item ||
                    "-";

                return (
                    "<tr>" +

                    "<td>" +
                    (index + 1) +
                    "</td>" +

                    "<td>" +
                    tuRealEscapeHtml(
                        komponen
                    ) +
                    "</td>" +

                    "<td>" +
                    tuRealEscapeHtml(
                        sub
                    ) +
                    "</td>" +

                    "<td>" +
                    tuRealEscapeHtml(
                        akun
                    ) +
                    "</td>" +

                    "<td>" +
                    tuRealEscapeHtml(
                        rincian
                    ) +
                    "</td>" +

                    "<td>" +
                    tuRealEscapeHtml(
                        row?.bulan_realisasi
                    ) +
                    "</td>" +

                    '<td class="num">' +
                    tuRealFormatRupiah(
                        row?.nominal_realisasi
                    ) +
                    "</td>" +

                    "<td>" +
                    tuRealEscapeHtml(
                        row?.keterangan
                    ) +
                    "</td>" +

                    "<td>" +
                    '<span class="tu-status-pill ' +
                    (
                        inactive
                            ? "tu-status-wait"
                            : "tu-status-ok"
                    ) +
                    '">' +
                    tuRealEscapeHtml(
                        status
                    ) +
                    "</span>" +
                    "</td>" +

                    "<td>" +
                    '<div class="tu-real-row-actions">' +

                    (
                        inactive
                            ? ""
                            :
                              '<button type="button" class="tu-btn secondary" data-real-edit="' +
                              tuRealEscapeHtml(id) +
                              '">Edit</button>'
                    ) +

                    (
                        inactive
                            ? ""
                            :
                              '<button type="button" class="tu-btn tu-real-danger" data-real-delete="' +
                              tuRealEscapeHtml(id) +
                              '">Nonaktifkan</button>'
                    ) +

                    "</div>" +
                    "</td>" +

                    "</tr>"
                );
            }
        ).join("");
}

function tuFindRow(
    id
) {
    return (
        tuRealisasiState.rows.find(
            function (row) {
                return String(
                    row?.id_realisasi_tu ||
                    ""
                ) ===
                String(id || "");
            }
        ) ||
        null
    );
}

function tuRealStartEdit(
    row
) {
    const master =
        tuRealisasiState.masterById[
            String(
                row?.id_tu || ""
            ).trim()
        ];

    if (!master) {
        tuRealSetStatus(
            "Master Rincian Item untuk transaksi tidak ditemukan.",
            "danger"
        );
        return;
    }

    tuRealisasiState.editingId =
        String(
            row?.id_realisasi_tu || ""
        ).trim();

    tuRealisasiState.editingOriginalDate =
        tuRealToInputDate(
            row?.tanggal_realisasi
        );

    tuRealApplyMaster(
        master
    );

    tuRealEl(
        "tuRealBulan"
    ).value =
        String(
            row?.bulan_realisasi ||
            ""
        );

    tuRealEl(
        "tuRealNominal"
    ).value =
        Number(
            row?.nominal_realisasi ||
            0
        );

    tuRealEl(
        "tuRealKeterangan"
    ).value =
        row?.keterangan ||
        "";

    tuRealEl(
        "tuRealTanggal"
    ).value =
        tuRealisasiState.editingOriginalDate ||
        tuRealToday();

    const editing =
        tuRealEl(
            "tuRealEditing"
        );

    if (editing) {
        editing.textContent =
            "Mode EDIT aktif untuk " +
            tuRealisasiState.editingId +
            ". Rincian Item dipertahankan dari transaksi lama.";
        editing.classList.remove(
            "d-none"
        );
    }

    tuRealEl(
        "tuRealSaveButton"
    )?.classList.add(
        "d-none"
    );

    tuRealEl(
        "tuRealUpdateButton"
    )?.classList.remove(
        "d-none"
    );

    tuRealEl(
        "tuRealCancelButton"
    )?.classList.remove(
        "d-none"
    );

    window.scrollTo({
        top: 0,
        behavior: "smooth"
    });
}

function tuRealResetForm() {
    tuRealisasiState.editingId =
        null;

    tuRealisasiState.editingOriginalDate =
        "";

    tuRealEl(
        "tuRealKomponen"
    ).value =
        "";

    tuRealResetSelect(
        "tuRealSubKomponen",
        "Pilih Komponen terlebih dahulu",
        true
    );

    tuRealResetSelect(
        "tuRealAkun",
        "Pilih Sub Komponen terlebih dahulu",
        true
    );

    tuRealResetSelect(
        "tuRealRincianItem",
        "Pilih Akun terlebih dahulu",
        true
    );

    tuRealEl(
        "tuRealBulan"
    ).value =
        "";

    tuRealEl(
        "tuRealNominal"
    ).value =
        "";

    tuRealEl(
        "tuRealKeterangan"
    ).value =
        "";

    tuRealEl(
        "tuRealTanggal"
    ).value =
        tuRealToday();

    tuRealHideItemInfo();

    tuRealEl(
        "tuRealEditing"
    )?.classList.add(
        "d-none"
    );

    tuRealEl(
        "tuRealSaveButton"
    )?.classList.remove(
        "d-none"
    );

    tuRealEl(
        "tuRealUpdateButton"
    )?.classList.add(
        "d-none"
    );

    tuRealEl(
        "tuRealCancelButton"
    )?.classList.add(
        "d-none"
    );
}

async function tuSaveRealisasi() {
    if (
        tuRealisasiState.busy
    ) {
        return;
    }

    let fields;

    try {
        fields =
            tuRealValidateForm();
    } catch (error) {
        tuRealSetStatus(
            error?.message ||
            String(error),
            "danger"
        );
        return;
    }

    const master =
        tuRealSelectedMaster();

    const confirmed =
        window.confirm(
            "Simpan realisasi TU ini?\n\n" +
            "Rincian Item: " +
            (
                master?.rincian_item ||
                "-"
            ) +
            "\n" +
            "Nominal: " +
            tuRealFormatRupiah(
                fields.nominal_realisasi
            )
        );

    if (!confirmed) {
        return;
    }

    tuRealSetBusy(
        true,
        "Menjalankan tu_realisasi_save..."
    );

    try {
        const result =
            await tuApiRequest(
                "tu_realisasi_save",
                {
                    tahun:
                        tuRealTahun(),
                    ...fields
                }
            );

        tuRealSetOutput(
            "tu_realisasi_save",
            result
        );

        tuRealSetStatus(
            result?.message ||
            "Realisasi berhasil disimpan.",
            "success"
        );

        tuRealResetForm();

        await tuRealisasiList(
            false
        );
    } catch (error) {
        tuRealSetOutput(
            "tu_realisasi_save",
            {
                ok: false,
                error:
                    error?.message ||
                    String(error)
            }
        );

        tuRealSetStatus(
            error?.message ||
            "Gagal menyimpan realisasi.",
            "danger"
        );
    } finally {
        tuRealSetBusy(
            false
        );
    }
}

async function tuUpdateRealisasi() {
    if (
        tuRealisasiState.busy
    ) {
        return;
    }

    const id =
        tuRealisasiState.editingId;

    if (!id) {
        tuRealSetStatus(
            "Tidak ada transaksi yang sedang diedit.",
            "danger"
        );
        return;
    }

    let fields;

    try {
        fields =
            tuRealValidateForm();
    } catch (error) {
        tuRealSetStatus(
            error?.message ||
            String(error),
            "danger"
        );
        return;
    }

    const confirmed =
        window.confirm(
            "Simpan perubahan pada " +
            id +
            "?"
        );

    if (!confirmed) {
        return;
    }

    tuRealSetBusy(
        true,
        "Menjalankan tu_realisasi_update..."
    );

    try {
        const result =
            await tuApiRequest(
                "tu_realisasi_update",
                {
                    tahun:
                        tuRealTahun(),
                    id_realisasi_tu:
                        id,
                    ...fields
                }
            );

        tuRealSetOutput(
            "tu_realisasi_update",
            result
        );

        tuRealSetStatus(
            result?.message ||
            "Realisasi berhasil diperbarui.",
            "success"
        );

        tuRealResetForm();

        await tuRealisasiList(
            false
        );
    } catch (error) {
        tuRealSetOutput(
            "tu_realisasi_update",
            {
                ok: false,
                error:
                    error?.message ||
                    String(error)
            }
        );

        tuRealSetStatus(
            error?.message ||
            "Gagal memperbarui realisasi.",
            "danger"
        );
    } finally {
        tuRealSetBusy(
            false
        );
    }
}

async function tuDeleteRealisasi(
    id
) {
    if (
        tuRealisasiState.busy ||
        !id
    ) {
        return;
    }

    const row =
        tuFindRow(id);

    if (!row) {
        tuRealSetStatus(
            "Data realisasi tidak ditemukan.",
            "danger"
        );
        return;
    }

    const confirmed =
        window.confirm(
            "Nonaktifkan transaksi " +
            id +
            "?\n\n" +
            "Data tidak dihapus dari sheet; status akan menjadi NONAKTIF."
        );

    if (!confirmed) {
        return;
    }

    tuRealSetBusy(
        true,
        "Menjalankan tu_realisasi_delete..."
    );

    try {
        const result =
            await tuApiRequest(
                "tu_realisasi_delete",
                {
                    tahun:
                        tuRealTahun(),
                    id_realisasi_tu:
                        id
                }
            );

        tuRealSetOutput(
            "tu_realisasi_delete",
            result
        );

        tuRealSetStatus(
            result?.message ||
            "Realisasi berhasil dinonaktifkan.",
            "success"
        );

        if (
            tuRealisasiState.editingId ===
            id
        ) {
            tuRealResetForm();
        }

        await tuRealisasiList(
            false
        );
    } catch (error) {
        tuRealSetOutput(
            "tu_realisasi_delete",
            {
                ok: false,
                error:
                    error?.message ||
                    String(error)
            }
        );

        tuRealSetStatus(
            error?.message ||
            "Gagal menonaktifkan realisasi.",
            "danger"
        );
    } finally {
        tuRealSetBusy(
            false
        );
    }
}

function tuRealHandleTableClick(
    event
) {
    const edit =
        event.target.closest(
            "[data-real-edit]"
        );

    if (edit) {
        const row =
            tuFindRow(
                edit.dataset.realEdit
            );

        if (row) {
            tuRealStartEdit(
                row
            );
        }

        return;
    }

    const del =
        event.target.closest(
            "[data-real-delete]"
        );

    if (del) {
        tuDeleteRealisasi(
            del.dataset.realDelete
        );
    }
}

function tuHandleBootstrap(
    result
) {
    if (
        result?.user?.role &&
        String(
            result.user.role
        )
        .trim()
        .toUpperCase() !==
        "OPERATOR"
    ) {
        return;
    }

    const masters =
        Array.isArray(
            result?.master
        )
            ? result.master
            : [];

    tuRealLoadMasters(
        masters
    );

    tuRealSetStatus(
        "Login Operator dan tu_bootstrap berhasil. Pilihan Rincian Item siap digunakan.",
        "success"
    );

    tuRealisasiList(
        false
    ).catch(
        function () {}
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

        tuRealSetStatus(
            "Sesi TU dipulihkan dari browser.",
            "success"
        );

        // Sesi yang dipulihkan perlu bootstrap lagi agar
        // master Rincian Item tersedia.
        tuApiRequest(
            "tu_bootstrap",
            {
                tahun:
                    tuRealTahun()
            }
        ).then(
            function (result) {
                tuHandleBootstrap(
                    result
                );
            }
        ).catch(
            function (error) {
                tuRealSetStatus(
                    error?.message ||
                    "Gagal memuat master TU.",
                    "danger"
                );
            }
        );
    }
}

document.addEventListener(
    "DOMContentLoaded",
    function () {
        tuRealEl(
            "tuRealTanggal"
        ).value =
            tuRealToday();

        tuRealEl(
            "tuRealKomponen"
        )?.addEventListener(
            "change",
            tuRealSyncSubKomponen
        );

        tuRealEl(
            "tuRealSubKomponen"
        )?.addEventListener(
            "change",
            tuRealSyncAkun
        );

        tuRealEl(
            "tuRealAkun"
        )?.addEventListener(
            "change",
            tuRealSyncRincianItem
        );

        tuRealEl(
            "tuRealRincianItem"
        )?.addEventListener(
            "change",
            tuRealShowItemInfo
        );

        tuRealEl(
            "tuRealSaveButton"
        )?.addEventListener(
            "click",
            tuSaveRealisasi
        );

        tuRealEl(
            "tuRealUpdateButton"
        )?.addEventListener(
            "click",
            tuUpdateRealisasi
        );

        tuRealEl(
            "tuRealCancelButton"
        )?.addEventListener(
            "click",
            tuRealResetForm
        );

        tuRealEl(
            "tuRealRefreshButton"
        )?.addEventListener(
            "click",
            function () {
                tuRealisasiList()
                    .catch(
                        function () {}
                    );
            }
        );

        tuRealEl(
            "tuRealBody"
        )?.addEventListener(
            "click",
            tuRealHandleTableClick
        );
    }
);
