// ============================================================
// TU REVISI ANGGARAN — FULL DRAFT / VALIDASI
//
// Pola UI meniru revisi-anggaran.js P3HPHL:
//
//   Filter Tahun / Komponen / Sub Komponen / Akun
//   Informasi Revisi
//   SEBELUM vs SESUDAH
//   Simpan Draft
//   Validasi
//   Cetak
//   Excel
//   Riwayat lokal
//
// PENTING:
//   - Tidak memanggil tu_revisi_save.
//   - Tidak memanggil endpoint write apa pun.
//   - UJI SERVER / Terapkan Revisi dikunci.
//   - Perubahan hanya disimpan di localStorage.
// ============================================================

const TU_REVISI_DRAFT_KEY =
    "p3hpl_tu_revisi_draft_v1";

let tuRevisiState = {
    masters: [],
    masterById: Object.create(null),
    revisions: [],
    rpdByIdTu: Object.create(null),
    selectedRows: [],
    loadingPromise: null
};

let tuRevisiDraft = {
    version: 1,
    status: "DRAFT",
    nomor: "",
    tanggal: "",
    pembuat: "",
    alasan: "",
    changes: {},
    updatedAt: null,
    validation: null,
    history: []
};

function tuRevEl(id) {
    return document.getElementById(id);
}

function tuRevYear() {
    return Number(
        tuRevEl("tuRevFilterTahun")?.value ||
        TU_CONFIG?.TAHUN_DEFAULT ||
        2026
    );
}

function tuRevNorm(value) {
    return String(value ?? "").trim();
}

function tuRevNum(value) {
    const raw =
        String(value ?? "")
            .trim()
            .replace(/\s/g, "");

    if (!raw) {
        return 0;
    }

    let normalized = raw;

    if (
        raw.includes(",") &&
        raw.includes(".")
    ) {
        normalized =
            raw.lastIndexOf(",") >
            raw.lastIndexOf(".")
                ? raw
                    .replace(/\./g, "")
                    .replace(",", ".")
                : raw.replace(/,/g, "");
    } else if (raw.includes(",")) {
        normalized =
            raw.replace(",", ".");
    } else {
        normalized =
            raw.replace(/,/g, "");
    }

    const n =
        Number(
            normalized.replace(
                /[^0-9.-]/g,
                ""
            )
        );

    return Number.isFinite(n)
        ? n
        : 0;
}

function tuRevMoney(value) {
    return (
        "Rp" +
        (
            Number(value) || 0
        ).toLocaleString(
            "id-ID"
        )
    );
}

function tuRevEscape(value) {
    return String(
        value ?? ""
    ).replace(
        /[&<>"']/g,
        function (s) {
            return {
                "&": "&amp;",
                "<": "&lt;",
                ">": "&gt;",
                '"': "&quot;",
                "'": "&#039;"
            }[s];
        }
    );
}

function tuRevToday() {
    const d =
        new Date();

    return [
        d.getFullYear(),
        String(
            d.getMonth() + 1
        ).padStart(2, "0"),
        String(
            d.getDate()
        ).padStart(2, "0")
    ].join("-");
}

function tuRevPair(
    code,
    name
) {
    const c =
        tuRevNorm(code);

    const n =
        tuRevNorm(name);

    return [
        c,
        n
    ].filter(Boolean).join(" | ");
}

function tuRevPairLabel(
    code,
    name
) {
    const c =
        tuRevNorm(code);

    const n =
        tuRevNorm(name);

    if (c && n) {
        return c + " — " + n;
    }

    return n || c || "-";
}

function tuRevIsActive(
    row
) {
    return (
        tuRevNorm(
            row?.status
        ).toUpperCase() ===
        "AKTIF"
    );
}

function tuRevIsLocked(
    row
) {
    return (
        tuRevNorm(
            row?.lock_pagu
        ).toUpperCase() ===
        "YA"
    );
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
    title,
    value
) {
    const el =
        tuRevEl(
            "tuRevOutput"
        );

    if (!el) return;

    el.textContent =
        title +
        "\n\n" +
        (
            typeof value === "string"
                ? value
                : JSON.stringify(
                    value,
                    null,
                    2
                )
        );
}

function tuRevLoadDraft() {
    try {
        const raw =
            localStorage.getItem(
                TU_REVISI_DRAFT_KEY
            );

        if (!raw) {
            return;
        }

        const parsed =
            JSON.parse(raw);

        if (
            !parsed ||
            Number(
                parsed.version
            ) !== 1
        ) {
            return;
        }

        tuRevisiDraft = {
            ...tuRevisiDraft,
            ...parsed,
            changes:
                parsed.changes &&
                typeof parsed.changes ===
                    "object"
                    ? parsed.changes
                    : {},
            history:
                Array.isArray(
                    parsed.history
                )
                    ? parsed.history
                    : []
        };
    } catch (error) {
        console.warn(
            "Draft TU tidak dapat dibaca:",
            error
        );
    }
}

function tuRevSaveDraftLocal() {
    tuRevisiDraft.updatedAt =
        new Date().toISOString();

    localStorage.setItem(
        TU_REVISI_DRAFT_KEY,
        JSON.stringify(
            tuRevisiDraft
        )
    );
}

function tuRevSyncMetadata() {
    tuRevisiDraft.nomor =
        tuRevNorm(
            tuRevEl(
                "tuRevNomor"
            )?.value
        );

    tuRevisiDraft.tanggal =
        tuRevNorm(
            tuRevEl(
                "tuRevTanggal"
            )?.value
        );

    tuRevisiDraft.pembuat =
        tuRevNorm(
            tuRevEl(
                "tuRevPembuat"
            )?.value
        );

    tuRevisiDraft.alasan =
        tuRevNorm(
            tuRevEl(
                "tuRevAlasan"
            )?.value
        );
}

function tuRevApplyDraftToInputs() {
    const user =
        typeof tuGetStoredUser ===
        "function"
            ? tuGetStoredUser()
            : null;

    const nomor =
        tuRevEl(
            "tuRevNomor"
        );

    const tanggal =
        tuRevEl(
            "tuRevTanggal"
        );

    const pembuat =
        tuRevEl(
            "tuRevPembuat"
        );

    const alasan =
        tuRevEl(
            "tuRevAlasan"
        );

    if (nomor) {
        nomor.value =
            tuRevisiDraft.nomor ||
            "";
    }

    if (tanggal) {
        tanggal.value =
            tuRevisiDraft.tanggal ||
            tuRevToday();
    }

    if (pembuat) {
        pembuat.value =
            tuRevisiDraft.pembuat ||
            user?.name ||
            "";
    }

    if (alasan) {
        alasan.value =
            tuRevisiDraft.alasan ||
            "";
    }
}

function tuRevSetOptions(
    id,
    rows,
    valueFn,
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

    rows.forEach(
        function (row) {
            const option =
                document.createElement(
                    "option"
                );

            option.value =
                valueFn(row);

            option.textContent =
                labelFn(row);

            select.appendChild(
                option
            );
        }
    );

    select.disabled =
        rows.length === 0;
}

function tuRevUnique(
    rows,
    valueFn,
    labelFn
) {
    const map =
        new Map();

    rows.forEach(
        function (row) {
            const value =
                String(
                    valueFn(row)
                );

            if (!map.has(value)) {
                map.set(
                    value,
                    {
                        value,
                        label:
                            labelFn(row)
                    }
                );
            }
        }
    );

    return Array.from(
        map.values()
    );
}

function tuRevLoadMasters(
    result
) {
    const raw =
        Array.isArray(
            result?.master
        )
            ? result.master
            : [];

    tuRevisiState.masters =
        raw.filter(
            tuRevIsActive
        );

    tuRevisiState.masterById =
        Object.create(null);

    tuRevisiState.masters.forEach(
        function (row) {
            const id =
                tuRevNorm(
                    row?.id_tu
                );

            if (id) {
                tuRevisiState.masterById[id] =
                    row;
            }
        }
    );

    tuRevRenderFilters();

    tuRevOutput(
        "tu_bootstrap",
        {
            ok: true,
            master_count:
                tuRevisiState.masters.length
        }
    );
}

async function tuRevLoadRpd() {
    const result =
        await tuApiRequest(
            "tu_rpd_list",
            {
                tahun:
                    tuRevYear()
            }
        );

    const rows =
        Array.isArray(
            result?.data
        )
            ? result.data
            : [];

    tuRevisiState.rpdByIdTu =
        Object.create(null);

    rows.forEach(
        function (row) {
            const id =
                tuRevNorm(
                    row?.id_tu
                );

            if (id) {
                tuRevisiState.rpdByIdTu[id] =
                    row;
            }
        }
    );

    tuRevisiState.masters.forEach(
        function (master) {
            const id =
                tuRevNorm(
                    master?.id_tu
                );

            const rpd =
                tuRevisiState.rpdByIdTu[id];

            master.total_rpd =
                tuRevNum(
                    rpd?.total_rpd
                );

            master.rpd_sisa =
                tuRevNum(
                    rpd?.sisa_rpd
                );
        }
    );

    return rows.length;
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

    return (
        tuRevisiState.revisions.length
    );
}

function tuRevRenderFilters() {
    const rows =
        tuRevisiState.masters;

    const components =
        tuRevUnique(
            rows,
            function (row) {
                return tuRevPair(
                    row?.kode_komponen,
                    row?.komponen
                );
            },
            function (row) {
                return tuRevPairLabel(
                    row?.kode_komponen,
                    row?.komponen
                );
            }
        );

    tuRevSetOptions(
        "tuRevFilterKomponen",
        components,
        function (x) {
            return x.value;
        },
        function (x) {
            return x.label;
        },
        "-- Semua Komponen --"
    );

    tuRevResetSub();
    tuRevResetAkun();

    tuRevRenderFiltered();
}

function tuRevResetSub() {
    const select =
        tuRevEl(
            "tuRevFilterSub"
        );

    if (!select) return;

    select.innerHTML =
        '<option value="">-- Semua Sub Komponen --</option>';

    select.disabled = true;
}

function tuRevResetAkun() {
    const select =
        tuRevEl(
            "tuRevFilterAkun"
        );

    if (!select) return;

    select.innerHTML =
        '<option value="">-- Semua Akun Belanja --</option>';

    select.disabled = true;
}

function tuRevSelectedComponent() {
    return tuRevNorm(
        tuRevEl(
            "tuRevFilterKomponen"
        )?.value
    );
}

function tuRevSelectedSub() {
    return tuRevNorm(
        tuRevEl(
            "tuRevFilterSub"
        )?.value
    );
}

function tuRevSelectedAkun() {
    return tuRevNorm(
        tuRevEl(
            "tuRevFilterAkun"
        )?.value
    );
}

function tuRevSyncSub() {
    const component =
        tuRevSelectedComponent();

    tuRevResetSub();
    tuRevResetAkun();

    if (!component) {
        tuRevRenderFiltered();
        return;
    }

    const rows =
        tuRevisiState.masters.filter(
            function (row) {
                return (
                    tuRevPair(
                        row?.kode_komponen,
                        row?.komponen
                    ) ===
                    component
                );
            }
        );

    const subs =
        tuRevUnique(
            rows,
            function (row) {
                return tuRevPair(
                    row?.kode_sub_komponen,
                    row?.sub_komponen
                );
            },
            function (row) {
                return tuRevPairLabel(
                    row?.kode_sub_komponen,
                    row?.sub_komponen
                );
            }
        );

    tuRevSetOptions(
        "tuRevFilterSub",
        subs,
        function (x) {
            return x.value;
        },
        function (x) {
            return x.label;
        },
        "-- Semua Sub Komponen --"
    );

    tuRevRenderFiltered();
}

function tuRevSyncAkun() {
    const component =
        tuRevSelectedComponent();

    const sub =
        tuRevSelectedSub();

    tuRevResetAkun();

    if (!component || !sub) {
        tuRevRenderFiltered();
        return;
    }

    const rows =
        tuRevisiState.masters.filter(
            function (row) {
                return (
                    tuRevPair(
                        row?.kode_komponen,
                        row?.komponen
                    ) ===
                    component &&
                    tuRevPair(
                        row?.kode_sub_komponen,
                        row?.sub_komponen
                    ) ===
                    sub
                );
            }
        );

    const accounts =
        tuRevUnique(
            rows,
            function (row) {
                return tuRevPair(
                    row?.kode_akun,
                    row?.akun
                );
            },
            function (row) {
                return tuRevPairLabel(
                    row?.kode_akun,
                    row?.akun
                );
            }
        );

    tuRevSetOptions(
        "tuRevFilterAkun",
        accounts,
        function (x) {
            return x.value;
        },
        function (x) {
            return x.label;
        },
        "-- Semua Akun Belanja --"
    );

    tuRevRenderFiltered();
}

function tuRevFiltersMatch(
    row
) {
    const component =
        tuRevSelectedComponent();

    const sub =
        tuRevSelectedSub();

    const account =
        tuRevSelectedAkun();

    if (
        component &&
        tuRevPair(
            row?.kode_komponen,
            row?.komponen
        ) !== component
    ) {
        return false;
    }

    if (
        sub &&
        tuRevPair(
            row?.kode_sub_komponen,
            row?.sub_komponen
        ) !== sub
    ) {
        return false;
    }

    if (
        account &&
        tuRevPair(
            row?.kode_akun,
            row?.akun
        ) !== account
    ) {
        return false;
    }

    return true;
}

function tuRevFilteredRows() {
    return tuRevisiState.masters.filter(
        tuRevFiltersMatch
    );
}

function tuRevCurrentPagu(
    row
) {
    const id =
        tuRevNorm(
            row?.id_tu
        );

    if (
        Object.prototype.hasOwnProperty.call(
            tuRevisiDraft.changes,
            id
        )
    ) {
        return tuRevNum(
            tuRevisiDraft.changes[id]
        );
    }

    return tuRevNum(
        row?.pagu_revisi
    );
}

function tuRevHasChange(
    row
) {
    const id =
        tuRevNorm(
            row?.id_tu
        );

    if (
        !Object.prototype.hasOwnProperty.call(
            tuRevisiDraft.changes,
            id
        )
    ) {
        return false;
    }

    return (
        tuRevNum(
            tuRevisiDraft.changes[id]
        ) !==
        tuRevNum(
            row?.pagu_revisi
        )
    );
}

function tuRevSetChange(
    row,
    value
) {
    const id =
        tuRevNorm(
            row?.id_tu
        );

    const newPagu =
        tuRevNum(value);

    const oldPagu =
        tuRevNum(
            row?.pagu_revisi
        );

    if (
        newPagu === oldPagu
    ) {
        delete tuRevisiDraft.changes[id];
    } else {
        tuRevisiDraft.changes[id] =
            newPagu;
    }

    tuRevisiDraft.validation =
        null;

    tuRevisiDraft.status =
        "DRAFT";

    tuRevSaveDraftLocal();
}

function tuRevRenderFiltered() {
    const rows =
        tuRevFilteredRows();

    tuRevisiState.selectedRows =
        rows;

    const info =
        tuRevEl(
            "tuRevFilterInfo"
        );

    if (info) {
        const component =
            tuRevSelectedComponent();

        const sub =
            tuRevSelectedSub();

        const account =
            tuRevSelectedAkun();

        const parts =
            [
                component || "Semua Komponen",
                sub || "Semua Sub Komponen",
                account || "Semua Akun"
            ];

        info.textContent =
            parts.join(
                " · "
            ) +
            " · " +
            rows.length.toLocaleString(
                "id-ID"
            ) +
            " item";
    }

    tuRevRenderTables(
        rows
    );

    tuRevRenderSummary();
    tuRevRenderValidationState();
}

function tuRevRowMinPagu(
    row
) {
    return Math.max(
        tuRevNum(
            row?.realisasi_final
        ),
        tuRevNum(
            row?.total_rpd
        )
    );
}

function tuRevRenderTables(
    rows
) {
    const before =
        tuRevEl(
            "tuRevBeforeBody"
        );

    const after =
        tuRevEl(
            "tuRevAfterBody"
        );

    const beforeCount =
        tuRevEl(
            "tuRevBeforeCount"
        );

    const afterCount =
        tuRevEl(
            "tuRevAfterCount"
        );

    if (
        beforeCount
    ) {
        beforeCount.textContent =
            rows.length +
            " item";
    }

    if (
        afterCount
    ) {
        afterCount.textContent =
            rows.length +
            " item";
    }

    if (
        !rows.length
    ) {
        const empty =
            '<tr><td colspan="7" class="center">' +
            "Tidak ada data sesuai filter." +
            "</td></tr>";

        if (before) {
            before.innerHTML =
                empty;
        }

        if (after) {
            after.innerHTML =
                '<tr><td colspan="8" class="center">' +
                "Tidak ada data sesuai filter." +
                "</td></tr>";
        }

        return;
    }

    before.innerHTML =
        rows.map(
            function (
                row,
                index
            ) {
                return (
                    "<tr>" +
                    "<td>" +
                    (index + 1) +
                    "</td>" +
                    "<td>" +
                    tuRevEscape(
                        row?.id_tu
                    ) +
                    "</td>" +
                    "<td>" +
                    tuRevEscape(
                        tuRevPairLabel(
                            row?.kode_komponen,
                            row?.komponen
                        )
                    ) +
                    "</td>" +
                    "<td>" +
                    tuRevEscape(
                        tuRevPairLabel(
                            row?.kode_sub_komponen,
                            row?.sub_komponen
                        )
                    ) +
                    "</td>" +
                    "<td>" +
                    tuRevEscape(
                        tuRevPairLabel(
                            row?.kode_akun,
                            row?.akun
                        )
                    ) +
                    "</td>" +
                    "<td>" +
                    tuRevEscape(
                        row?.rincian_item ||
                        ""
                    ) +
                    "</td>" +
                    '<td class="money">' +
                    tuRevMoney(
                        row?.pagu_revisi
                    ) +
                    "</td>" +
                    "</tr>"
                );
            }
        ).join("");

    after.innerHTML =
        rows.map(
            function (
                row,
                index
            ) {
                const changed =
                    tuRevHasChange(
                        row
                    );

                const locked =
                    tuRevIsLocked(
                        row
                    );

                const minimum =
                    tuRevRowMinPagu(
                        row
                    );

                const invalid =
                    tuRevHasChange(
                        row
                    ) &&
                    tuRevCurrentPagu(
                        row
                    ) < minimum;

                const cls =
                    [
                        changed
                            ? "tu-rev-row-changed"
                            : "",
                        invalid
                            ? "tu-rev-row-invalid"
                            : "",
                        locked
                            ? "tu-rev-row-locked"
                            : ""
                    ]
                        .filter(Boolean)
                        .join(" ");

                return (
                    '<tr class="' +
                    cls +
                    '">' +
                    "<td>" +
                    (index + 1) +
                    "</td>" +
                    "<td>" +
                    tuRevEscape(
                        row?.id_tu
                    ) +
                    "</td>" +
                    "<td>" +
                    tuRevEscape(
                        tuRevPairLabel(
                            row?.kode_komponen,
                            row?.komponen
                        )
                    ) +
                    "</td>" +
                    "<td>" +
                    tuRevEscape(
                        tuRevPairLabel(
                            row?.kode_sub_komponen,
                            row?.sub_komponen
                        )
                    ) +
                    "</td>" +
                    "<td>" +
                    tuRevEscape(
                        tuRevPairLabel(
                            row?.kode_akun,
                            row?.akun
                        )
                    ) +
                    "</td>" +
                    "<td>" +
                    tuRevEscape(
                        row?.rincian_item ||
                        ""
                    ) +
                    "</td>" +
                    '<td class="money">' +
                    '<input class="tu-rev-pagu-input ' +
                    (changed
                        ? "changed"
                        : "") +
                    '" type="text" inputmode="decimal"' +
                    ' data-id-tu="' +
                    tuRevEscape(
                        row?.id_tu
                    ) +
                    '" value="' +
                    tuRevEscape(
                        tuRevCurrentPagu(
                            row
                        )
                    ) +
                    '" ' +
                    (
                        locked
                            ? "disabled"
                            : ""
                    ) +
                    ' title="' +
                    (
                        locked
                            ? "Pagu terkunci"
                            : "Minimum " +
                              tuRevMoney(
                                  minimum
                              )
                    ) +
                    '">' +
                    "</td>" +
                    '<td class="center">' +
                    (
                        changed
                            ? (
                                '<button type="button" class="tu-btn secondary" ' +
                                'data-reset-id="' +
                                tuRevEscape(
                                    row?.id_tu
                                ) +
                                '" title="Kembalikan ke Pagu Lama">' +
                                '<i class="bi bi-arrow-counterclockwise"></i>' +
                                "</button>"
                            )
                            : locked
                                ? '<span class="tu-rev-muted">TERKUNCI</span>'
                                : '<span class="tu-rev-muted">-</span>'
                    ) +
                    "</td>" +
                    "</tr>"
                );
            }
        ).join("");
}

function tuRevCalculateGlobal() {
    const beforeByComponent =
        new Map();

    const afterByComponent =
        new Map();

    let before =
        0;

    let after =
        0;

    tuRevisiState.masters.forEach(
        function (row) {
            const key =
                tuRevPair(
                    row?.kode_komponen,
                    row?.komponen
                ) ||
                "(Tanpa Komponen)";

            const oldValue =
                tuRevNum(
                    row?.pagu_revisi
                );

            const newValue =
                tuRevCurrentPagu(
                    row
                );

            before +=
                oldValue;

            after +=
                newValue;

            beforeByComponent.set(
                key,
                (
                    beforeByComponent.get(
                        key
                    ) || 0
                ) + oldValue
            );

            afterByComponent.set(
                key,
                (
                    afterByComponent.get(
                        key
                    ) || 0
                ) + newValue
            );
        }
    );

    const componentDiffs =
        [];

    const keys =
        new Set([
            ...beforeByComponent.keys(),
            ...afterByComponent.keys()
        ]);

    keys.forEach(
        function (key) {
            const b =
                beforeByComponent.get(
                    key
                ) || 0;

            const a =
                afterByComponent.get(
                    key
                ) || 0;

            const diff =
                a - b;

            if (
                Math.abs(diff) >
                0.000001
            ) {
                componentDiffs.push({
                    key,
                    before: b,
                    after: a,
                    diff
                });
            }
        }
    );

    return {
        before,
        after,
        diff: after - before,
        componentDiffs
    };
}

function tuRevValidate() {
    tuRevSyncMetadata();

    const errors =
        [];

    if (
        !tuRevisiDraft.nomor
    ) {
        errors.push(
            "Nomor Revisi wajib diisi."
        );
    }

    if (
        !tuRevisiDraft.tanggal
    ) {
        errors.push(
            "Tanggal wajib diisi."
        );
    }

    if (
        !tuRevisiDraft.pembuat
    ) {
        errors.push(
            "Pembuat wajib diisi."
        );
    }

    if (
        !tuRevisiDraft.alasan
    ) {
        errors.push(
            "Alasan Revisi wajib diisi."
        );
    }

    const changeIds =
        Object.keys(
            tuRevisiDraft.changes
        );

    if (!changeIds.length) {
        errors.push(
            "Belum ada perubahan Pagu pada sisi SESUDAH."
        );
    }

    const global =
        tuRevCalculateGlobal();

    if (
        Math.abs(
            global.diff
        ) >
        0.000001
    ) {
        errors.push(
            "TOTAL PAGU berubah: " +
            tuRevMoney(
                global.before
            ) +
            " → " +
            tuRevMoney(
                global.after
            ) +
            " (selisih " +
            tuRevMoney(
                global.diff
            ) +
            "). Total seluruh anggaran harus tetap."
        );
    }

    global.componentDiffs.forEach(
        function (item) {
            errors.push(
                "SELISIH KOMPONEN: " +
                item.key +
                " — " +
                tuRevMoney(
                    item.before
                ) +
                " → " +
                tuRevMoney(
                    item.after
                ) +
                " (selisih " +
                tuRevMoney(
                    item.diff
                ) +
                ")."
            );
        }
    );

    tuRevisiState.masters.forEach(
        function (row) {
            const id =
                tuRevNorm(
                    row?.id_tu
                );

            const newValue =
                tuRevCurrentPagu(
                    row
                );

            const minimum =
                tuRevRowMinPagu(
                    row
                );

            if (
                newValue < 0
            ) {
                errors.push(
                    id +
                    ": Pagu tidak boleh negatif."
                );
            }

            if (
                newValue <
                minimum
            ) {
                errors.push(
                    id +
                    ": Pagu " +
                    tuRevMoney(
                        newValue
                    ) +
                    " lebih kecil dari minimum " +
                    tuRevMoney(
                        minimum
                    ) +
                    " (maksimum Realisasi Final / Total RPD)."
                );
            }

            if (
                tuRevHasChange(row) &&
                tuRevIsLocked(row)
            ) {
                errors.push(
                    id +
                    ": Pagu terkunci (LOCK_PAGU=YA) dan tidak boleh diubah."
                );
            }
        }
    );

    const validatedAt =
        new Date().toISOString();

    tuRevisiDraft.validation = {
        ok:
            errors.length === 0,
        errors,
        before:
            global.before,
        after:
            global.after,
        diff:
            global.diff,
        componentDiffs:
            global.componentDiffs,
        validatedAt
    };

    tuRevisiDraft.status =
        errors.length === 0
            ? "TERVALIDASI"
            : "DRAFT";

    tuRevisiDraft.history =
        [
            {
                at:
                    validatedAt,
                action:
                    errors.length === 0
                        ? "VALIDASI BERHASIL"
                        : "VALIDASI GAGAL",
                nomor:
                    tuRevisiDraft.nomor,
                before:
                    global.before,
                after:
                    global.after,
                diff:
                    global.diff,
                errors
            },
            ...(
                Array.isArray(
                    tuRevisiDraft.history
                )
                    ? tuRevisiDraft.history
                    : []
            )
        ].slice(
            0,
            20
        );

    tuRevSaveDraftLocal();

    tuRevRenderSummary();
    tuRevRenderValidationState();
    tuRevRenderHistory();

    tuRevSetStatus(
        errors.length
            ? "Validasi ditolak. Periksa rincian yang ditampilkan."
            : "Revisi lolos validasi. Total anggaran dan total per Komponen tetap.",
        errors.length
            ? "warning"
            : "success"
    );

    return (
        errors.length === 0
    );
}

function tuRevRenderSummary() {
    const global =
        tuRevCalculateGlobal();

    const before =
        tuRevEl(
            "tuRevSummaryBefore"
        );

    const after =
        tuRevEl(
            "tuRevSummaryAfter"
        );

    const diff =
        tuRevEl(
            "tuRevSummaryDiff"
        );

    const status =
        tuRevEl(
            "tuRevSummaryStatus"
        );

    if (before) {
        before.textContent =
            tuRevMoney(
                global.before
            );
    }

    if (after) {
        after.textContent =
            tuRevMoney(
                global.after
            );
    }

    if (diff) {
        diff.textContent =
            (
                global.diff >= 0
                    ? "+"
                    : ""
            ) +
            tuRevMoney(
                global.diff
            );
    }

    if (status) {
        status.textContent =
            tuRevisiDraft.status;
    }
}

function tuRevRenderValidationState() {
    const box =
        tuRevEl(
            "tuRevValidationBox"
        );

    const status =
        tuRevEl(
            "tuRevValidationStatus"
        );

    if (!box || !status) {
        return;
    }

    tuRevSyncMetadata();

    const metadataReady =
        Boolean(
            tuRevisiDraft.nomor &&
            tuRevisiDraft.tanggal &&
            tuRevisiDraft.pembuat &&
            tuRevisiDraft.alasan
        );

    const validation =
        tuRevisiDraft.validation;

    if (
        !validation
    ) {
        box.textContent =
            metadataReady
                ? "Validasi belum dijalankan."
                : "Belum siap divalidasi: lengkapi Nomor Revisi, Tanggal, Pembuat, dan Alasan.";

        box.className =
            metadataReady
                ? "tu-rev-validation"
                : "tu-rev-validation warn";

        status.textContent =
            "DRAFT";

        status.className =
            "tu-status-pill tu-status-wait";

        return;
    }

    box.textContent =
        validation.ok
            ? (
                "Validasi berhasil. Total sebelum " +
                tuRevMoney(
                    validation.before
                ) +
                " → sesudah " +
                tuRevMoney(
                    validation.after
                ) +
                "; selisih " +
                tuRevMoney(
                    validation.diff
                ) +
                "."
            )
            : (
                "Validasi gagal: " +
                validation.errors.join(
                    " "
                )
            );

    box.className =
        validation.ok
            ? "tu-rev-validation ok"
            : "tu-rev-validation danger";

    status.textContent =
        validation.ok
            ? "TERVALIDASI"
            : "PERLU PERBAIKAN";

    status.className =
        validation.ok
            ? "tu-status-pill tu-status-ok"
            : "tu-status-pill tu-status-wait";
}

function tuRevRenderHistory() {
    const container =
        tuRevEl(
            "tuRevHistory"
        );

    if (!container) {
        return;
    }

    const rows =
        Array.isArray(
            tuRevisiDraft.history
        )
            ? tuRevisiDraft.history
            : [];

    if (!rows.length) {
        container.textContent =
            "Belum ada riwayat.";
        return;
    }

    container.innerHTML =
        rows.map(
            function (row) {
                return (
                    '<div class="tu-rev-history-item">' +
                    "<strong>" +
                    tuRevEscape(
                        row.action
                    ) +
                    "</strong>" +
                    " · " +
                    tuRevEscape(
                        row.nomor ||
                        "-"
                    ) +
                    "<br>" +
                    tuRevEscape(
                        new Date(
                            row.at
                        ).toLocaleString(
                            "id-ID"
                        )
                    ) +
                    "<br>" +
                    tuRevEscape(
                        tuRevMoney(
                            row.before
                        )
                    ) +
                    " → " +
                    tuRevEscape(
                        tuRevMoney(
                            row.after
                        )
                    ) +
                    " · Selisih " +
                    tuRevEscape(
                        tuRevMoney(
                            row.diff
                        )
                    ) +
                    (
                        row.errors?.length
                            ? '<br><span class="tu-rev-danger-text">' +
                              tuRevEscape(
                                  row.errors.length +
                                  " error"
                              ) +
                              "</span>"
                            : ""
                    ) +
                    "</div>"
                );
            }
        ).join("");
}

function tuRevRefreshAll() {
    tuRevRenderFiltered();
    tuRevRenderHistory();
}

function tuRevStoreCurrentMetadata() {
    tuRevSyncMetadata();
    tuRevSaveDraftLocal();
}

function tuRevResetDraft() {
    tuRevisiDraft = {
        version: 1,
        status: "DRAFT",
        nomor: "",
        tanggal: "",
        pembuat: "",
        alasan: "",
        changes: {},
        updatedAt: null,
        validation: null,
        history: []
    };

    localStorage.removeItem(
        TU_REVISI_DRAFT_KEY
    );

    tuRevApplyDraftToInputs();
    tuRevRefreshAll();

    tuRevSetStatus(
        "Draft TU telah direset. Data server tidak berubah.",
        "warning"
    );
}

function tuRevSaveDraft() {
    tuRevSyncMetadata();

    tuRevisiDraft.status =
        "DRAFT";

    tuRevSaveDraftLocal();

    tuRevRenderHistory();
    tuRevRenderSummary();
    tuRevRenderValidationState();

    tuRevSetStatus(
        "Draft Revisi TU tersimpan di browser. DATA TU tidak berubah.",
        "success"
    );
}

function tuRevResetRow(
    id
) {
    const row =
        tuRevisiState.masterById[
            String(
                id || ""
            ).trim()
        ];

    if (!row) {
        return;
    }

    delete tuRevisiDraft.changes[
        String(
            id
        ).trim()
    ];

    tuRevisiDraft.status =
        "DRAFT";

    tuRevisiDraft.validation =
        null;

    tuRevSaveDraftLocal();
    tuRevRefreshAll();

    tuRevSetStatus(
        "Pagu " +
        String(
            id
        ) +
        " dikembalikan ke nilai SEBELUM.",
        "success"
    );
}

function tuRevDownloadExcel() {
    if (
        !window.XLSX
    ) {
        tuRevSetStatus(
            "Library Excel belum termuat.",
            "danger"
        );
        return;
    }

    const rows =
        tuRevisiState.selectedRows
            .map(
                function (row) {
                    return {
                        "ID TU":
                            row?.id_tu || "",
                        "Komponen":
                            tuRevPairLabel(
                                row?.kode_komponen,
                                row?.komponen
                            ),
                        "Sub Komponen":
                            tuRevPairLabel(
                                row?.kode_sub_komponen,
                                row?.sub_komponen
                            ),
                        "Akun":
                            tuRevPairLabel(
                                row?.kode_akun,
                                row?.akun
                            ),
                        "Rincian Item":
                            row?.rincian_item ||
                            "",
                        "Pagu Sebelum":
                            tuRevNum(
                                row?.pagu_revisi
                            ),
                        "Pagu Sesudah":
                            tuRevCurrentPagu(
                                row
                            ),
                        "Selisih":
                            tuRevCurrentPagu(
                                row
                            ) -
                            tuRevNum(
                                row?.pagu_revisi
                            ),
                        "Realisasi Final":
                            tuRevNum(
                                row?.realisasi_final
                            ),
                        "Total RPD":
                            tuRevNum(
                                row?.total_rpd
                            )
                    };
                }
            );

    const ws =
        XLSX.utils.json_to_sheet(
            rows
        );

    const wb =
        XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(
        wb,
        ws,
        "Revisi TU"
    );

    XLSX.writeFile(
        wb,
        "Revisi_Anggaran_TU_Draft.xlsx"
    );
}

function tuRevPrint() {
    window.print();
}

async function tuRevLoadAll(
    bootstrapOverride = null
) {
    if (
        tuRevisiState.loadingPromise
    ) {
        return tuRevisiState.loadingPromise;
    }

    tuRevisiState.loadingPromise =
        (async function () {
            tuRevSetStatus(
                "Memuat master TU, RPD, dan riwayat revisi...",
                "info"
            );

            let bootstrap =
                bootstrapOverride;

            if (!bootstrap) {
                bootstrap =
                    await tuApiRequest(
                        "tu_bootstrap",
                        {
                            tahun:
                                tuRevYear()
                        }
                    );
            }

            if (
                !bootstrap?.ok
            ) {
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

            if (
                !master.length
            ) {
                throw new Error(
                    "tu_bootstrap berhasil tetapi master TU kosong."
                );
            }

            tuRevLoadMasters(
                bootstrap
            );

            const rpdCount =
                await tuRevLoadRpd();

            const revisionCount =
                await tuRevLoadRevisions();

            tuRevLoadDraft();
            tuRevApplyDraftToInputs();
            tuRevRefreshAll();

            tuRevOutput(
                "tu_revisi — LOAD READ-ONLY",
                {
                    ok: true,
                    master_count:
                        master.length,
                    active_master_count:
                        tuRevisiState.masters.length,
                    rpd_count:
                        rpdCount,
                    revisi_count:
                        revisionCount,
                    write_endpoint_called:
                        false
                }
            );

            tuRevSetStatus(
                tuRevisiState.masters.length.toLocaleString(
                    "id-ID"
                ) +
                " Rincian Item aktif berhasil dimuat. Draft/Validasi siap digunakan.",
                "success"
            );
        })()
        .catch(
            function (error) {
                tuRevSetStatus(
                    error?.message ||
                    String(error),
                    "danger"
                );

                tuRevOutput(
                    "tu_revisi — LOAD ERROR",
                    {
                        ok: false,
                        error:
                            error?.message ||
                            String(error)
                    }
                );
            }
        )
        .finally(
            function () {
                tuRevisiState.loadingPromise =
                    null;
            }
        );

    return tuRevisiState.loadingPromise;
}

function tuHandleBootstrap(
    result
) {
    tuRevLoadAll(
        result
    );
}

function tuInitData() {
    const user =
        typeof tuGetStoredUser ===
        "function"
            ? tuGetStoredUser()
            : null;

    if (
        user?.email
    ) {
        tuShowApp(
            user
        );

        tuRevLoadAll();
    }
}

document.addEventListener(
    "DOMContentLoaded",
    function () {
        tuRevLoadDraft();

        tuRevApplyDraftToInputs();

        tuRevEl(
            "tuRevFilterKomponen"
        )?.addEventListener(
            "change",
            tuRevSyncSub
        );

        tuRevEl(
            "tuRevFilterSub"
        )?.addEventListener(
            "change",
            tuRevSyncAkun
        );

        tuRevEl(
            "tuRevFilterAkun"
        )?.addEventListener(
            "change",
            tuRevRenderFiltered
        );

        [
            "tuRevNomor",
            "tuRevTanggal",
            "tuRevPembuat",
            "tuRevAlasan"
        ].forEach(
            function (id) {
                tuRevEl(id)
                    ?.addEventListener(
                        "input",
                        function () {
                            tuRevisiDraft.validation =
                                null;
                            tuRevisiDraft.status =
                                "DRAFT";
                            tuRevRenderValidationState();
                            tuRevRenderSummary();
                        }
                    );
            }
        );

        tuRevEl(
            "tuRevFilterTahun"
        )?.addEventListener(
            "change",
            function () {
                tuRevLoadAll();
            }
        );

        tuRevEl(
            "tuRevSaveDraft"
        )?.addEventListener(
            "click",
            tuRevSaveDraft
        );

        tuRevEl(
            "tuRevValidate"
        )?.addEventListener(
            "click",
            tuRevValidate
        );

        tuRevEl(
            "tuRevReset"
        )?.addEventListener(
            "click",
            function () {
                if (
                    window.confirm(
                        "Reset seluruh Draft Revisi TU? Data server tidak akan berubah."
                    )
                ) {
                    tuRevResetDraft();
                }
            }
        );

        tuRevEl(
            "tuRevPrint"
        )?.addEventListener(
            "click",
            tuRevPrint
        );

        tuRevEl(
            "tuRevExcel"
        )?.addEventListener(
            "click",
            tuRevDownloadExcel
        );

        tuRevEl(
            "tuRevAfterBody"
        )?.addEventListener(
            "input",
            function (event) {
                const input =
                    event.target.closest(
                        ".tu-rev-pagu-input"
                    );

                if (!input) {
                    return;
                }

                const id =
                    tuRevNorm(
                        input.dataset.idTu
                    );

                const row =
                    tuRevisiState.masterById[
                        id
                    ];

                if (!row) {
                    return;
                }

                tuRevSetChange(
                    row,
                    input.value
                );

                tuRevRenderFiltered();
            }
        );

        tuRevEl(
            "tuRevAfterBody"
        )?.addEventListener(
            "click",
            function (event) {
                const button =
                    event.target.closest(
                        "[data-reset-id]"
                    );

                if (!button) {
                    return;
                }

                tuRevResetRow(
                    button.dataset.resetId
                );
            }
        );

        tuRevRenderHistory();
        tuRevRenderSummary();
        tuRevRenderValidationState();
    }
);
