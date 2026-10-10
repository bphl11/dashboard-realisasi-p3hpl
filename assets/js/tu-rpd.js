// ============================================================
// TU RPD — TRANSACTION UI
//
// Form:
//   Komponen
//   Sub Komponen
//   Akun
//   Rincian Item
//   48 minggu RPD
//   Catatan
//
// Backend:
//   tu_bootstrap   -> master anggaran
//   tu_rpd_list    -> RPD tersimpan
//   tu_rpd_save    -> simpan/update RPD
//
// Tidak ada SAVE otomatis saat halaman dibuka.
// ============================================================

const TU_RPD_MONTHS = [
    { key: "jan", label: "Januari", quarter: "TW I" },
    { key: "feb", label: "Februari", quarter: "TW I" },
    { key: "mar", label: "Maret", quarter: "TW I" },
    { key: "apr", label: "April", quarter: "TW II" },
    { key: "mei", label: "Mei", quarter: "TW II" },
    { key: "jun", label: "Juni", quarter: "TW II" },
    { key: "jul", label: "Juli", quarter: "TW III" },
    { key: "agu", label: "Agustus", quarter: "TW III" },
    { key: "sep", label: "September", quarter: "TW III" },
    { key: "okt", label: "Oktober", quarter: "TW IV" },
    { key: "nov", label: "November", quarter: "TW IV" },
    { key: "des", label: "Desember", quarter: "TW IV" }
];

let tuRpdState = {
    masters: [],
    masterById: Object.create(null),
    rpdRows: [],
    rpdById: Object.create(null),
    selectedMaster: null,
    selectedRpd: null,
    busy: false
};

function tuRpdEl(id) {
    return document.getElementById(id);
}

function tuRpdYear() {
    return Number(
        TU_CONFIG?.TAHUN_DEFAULT || 2026
    );
}

function tuRpdMoney(value) {
    return new Intl.NumberFormat(
        "id-ID",
        {
            style: "currency",
            currency: "IDR",
            maximumFractionDigits: 0
        }
    ).format(Number(value) || 0);
}

function tuRpdEscape(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function tuRpdSetStatus(
    message,
    type = "info"
) {
    const el =
        tuRpdEl("tuPageStatus");

    if (!el) return;

    el.className =
        "tu-alert tu-alert-" + type;

    el.textContent =
        message || "";

    el.classList.remove("d-none");
}

function tuRpdOutput(
    action,
    data
) {
    const el =
        tuRpdEl("tuRpdOutput");

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

function tuRpdResetSelect(
    id,
    placeholder,
    disabled = true
) {
    const select =
        tuRpdEl(id);

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

function tuRpdUnique(
    rows,
    keyFn
) {
    const seen = new Set();
    const out = [];

    (Array.isArray(rows) ? rows : [])
        .forEach(function (row) {
            const key =
                String(
                    keyFn(row) ?? ""
                );

            if (seen.has(key)) return;

            seen.add(key);
            out.push(row);
        });

    return out;
}

function tuRpdOptions(
    id,
    rows,
    valueKey,
    labelFn,
    placeholder
) {
    const select =
        tuRpdEl(id);

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

    rows.forEach(function (row) {
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
    });

    select.disabled =
        rows.length === 0;
}

function tuRpdLoadMasters(
    result
) {
    // Backend TU V5 mengembalikan master pada result.master.
    // Fallback result.data dipertahankan agar UI tidak gagal diam-diam
    // bila gateway/versi respons membungkus data berbeda.
    const raw =
        Array.isArray(result?.master)
            ? result.master
            : Array.isArray(result?.data)
                ? result.data
                : Array.isArray(result?.data?.master)
                    ? result.data.master
                    : [];

    const rows =
        raw.filter(function (m) {
            return (
                String(
                    m?.status ?? "AKTIF"
                )
                .trim()
                .toUpperCase() ===
                "AKTIF"
            );
        });

    tuRpdState.masters =
        rows;

    tuRpdState.masterById =
        Object.create(null);

    rows.forEach(function (m) {
        const id =
            String(
                m?.id_tu || ""
            ).trim();

        if (id) {
            tuRpdState.masterById[id] =
                m;
        }
    });

    const components =
        tuRpdUnique(
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

    tuRpdOptions(
        "tuRpdKomponen",
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

    tuRpdResetSelect(
        "tuRpdSubKomponen",
        "Pilih Komponen terlebih dahulu",
        true
    );

    tuRpdResetSelect(
        "tuRpdAkun",
        "Pilih Sub Komponen terlebih dahulu",
        true
    );

    tuRpdResetSelect(
        "tuRpdRincianItem",
        "Pilih Akun terlebih dahulu",
        true
    );

    tuRpdClearSelected();

    if (rows.length === 0) {
        tuRpdSetStatus(
            "Master RPD TU kosong. Respons tu_bootstrap tidak berisi master yang dapat digunakan.",
            "danger"
        );
    } else {
        tuRpdSetStatus(
            rows.length.toLocaleString("id-ID") +
            " Rincian Item berhasil dimuat. Silakan pilih Komponen.",
            "success"
        );
    }
}

function tuRpdClearSelected() {
    tuRpdState.selectedMaster =
        null;

    tuRpdState.selectedRpd =
        null;

    tuRpdEl(
        "tuRpdSelected"
    )?.classList.add(
        "d-none"
    );

    tuRpdEl(
        "tuRpdSummary"
    )?.classList.add(
        "d-none"
    );

    tuRpdEl(
        "tuRpdEditorSection"
    )?.classList.add(
        "d-none"
    );
}

function tuRpdSelectMaster(
    master
) {
    tuRpdState.selectedMaster =
        master || null;

    if (!master) {
        tuRpdClearSelected();
        return;
    }

    const idTu =
        String(
            master?.id_tu || ""
        ).trim();

    const rpd =
        tuRpdState.rpdById[
            idTu
        ] || null;

    tuRpdState.selectedRpd =
        rpd;

    const selected =
        tuRpdEl(
            "tuRpdSelected"
        );

    if (selected) {
        selected.textContent =
            "Terpilih: " +
            String(
                master?.rincian_item || "-"
            ) +
            " · ID TU " +
            idTu;
        selected.classList.remove(
            "d-none"
        );
    }

    tuRpdEl(
        "tuRpdPagu"
    ).textContent =
        tuRpdMoney(
            master?.pagu_revisi
        );

    tuRpdEl(
        "tuRpdRealisasi"
    ).textContent =
        tuRpdMoney(
            master?.realisasi_final
        );

    tuRpdEl(
        "tuRpdDana"
    ).textContent =
        tuRpdMoney(
            rpd?.dana_tersedia ??
            master?.dana_tersedia ??
            Math.max(
                Number(
                    master?.pagu_revisi
                ) -
                Number(
                    master?.realisasi_final
                ),
                0
            )
        );

    tuRpdEl(
        "tuRpdExistingTotal"
    ).textContent =
        tuRpdMoney(
            rpd?.total_rpd || 0
        );

    tuRpdEl(
        "tuRpdExistingSisa"
    ).textContent =
        tuRpdMoney(
            rpd?.sisa_rpd ??
            Math.max(
                Number(
                    master?.pagu_revisi
                ) -
                Number(
                    master?.realisasi_final
                ) -
                Number(
                    rpd?.total_rpd || 0
                ),
                0
            )
        );

    tuRpdEl(
        "tuRpdSummary"
    )?.classList.remove(
        "d-none"
    );

    tuRpdBuildEditor(
        rpd
    );
}

function tuRpdSyncSubKomponen() {
    const kode =
        String(
            tuRpdEl(
                "tuRpdKomponen"
            )?.value || ""
        ).trim();

    tuRpdResetSelect(
        "tuRpdSubKomponen",
        "Pilih Komponen terlebih dahulu",
        true
    );

    tuRpdResetSelect(
        "tuRpdAkun",
        "Pilih Sub Komponen terlebih dahulu",
        true
    );

    tuRpdResetSelect(
        "tuRpdRincianItem",
        "Pilih Akun terlebih dahulu",
        true
    );

    tuRpdClearSelected();

    if (!kode) return;

    const rows =
        tuRpdState.masters.filter(
            function (m) {
                return String(
                    m?.kode_komponen || ""
                ).trim() === kode;
            }
        );

    const unique =
        tuRpdUnique(
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

    tuRpdOptions(
        "tuRpdSubKomponen",
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

function tuRpdSyncAkun() {
    const komponen =
        String(
            tuRpdEl(
                "tuRpdKomponen"
            )?.value || ""
        ).trim();

    const sub =
        String(
            tuRpdEl(
                "tuRpdSubKomponen"
            )?.value || ""
        ).trim();

    tuRpdResetSelect(
        "tuRpdAkun",
        "Pilih Sub Komponen terlebih dahulu",
        true
    );

    tuRpdResetSelect(
        "tuRpdRincianItem",
        "Pilih Akun terlebih dahulu",
        true
    );

    tuRpdClearSelected();

    if (!komponen || !sub) return;

    const rows =
        tuRpdState.masters.filter(
            function (m) {
                return (
                    String(
                        m?.kode_komponen || ""
                    ).trim() === komponen &&
                    String(
                        m?.kode_sub_komponen || ""
                    ).trim() === sub
                );
            }
        );

    const unique =
        tuRpdUnique(
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

    tuRpdOptions(
        "tuRpdAkun",
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

function tuRpdSyncRincian() {
    const komponen =
        String(
            tuRpdEl(
                "tuRpdKomponen"
            )?.value || ""
        ).trim();

    const sub =
        String(
            tuRpdEl(
                "tuRpdSubKomponen"
            )?.value || ""
        ).trim();

    const akun =
        String(
            tuRpdEl(
                "tuRpdAkun"
            )?.value || ""
        ).trim();

    tuRpdResetSelect(
        "tuRpdRincianItem",
        "Pilih Akun terlebih dahulu",
        true
    );

    tuRpdClearSelected();

    if (
        !komponen ||
        !sub ||
        !akun
    ) {
        return;
    }

    const rows =
        tuRpdState.masters.filter(
            function (m) {
                return (
                    String(
                        m?.kode_komponen || ""
                    ).trim() === komponen &&
                    String(
                        m?.kode_sub_komponen || ""
                    ).trim() === sub &&
                    String(
                        m?.kode_akun || ""
                    ).trim() === akun
                );
            }
        );

    tuRpdOptions(
        "tuRpdRincianItem",
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

function tuRpdGenerateEditor() {
    const editor =
        tuRpdEl(
            "tuRpdEditor"
        );

    if (!editor) return;

    editor.innerHTML = "";

    let currentQuarter = "";

    TU_RPD_MONTHS.forEach(
        function (month) {

            if (
                month.quarter !==
                currentQuarter
            ) {
                currentQuarter =
                    month.quarter;

                const quarter =
                    document.createElement(
                        "div"
                    );

                quarter.className =
                    "tu-rpd-quarter";

                quarter.dataset.quarter =
                    currentQuarter;

                const title =
                    document.createElement(
                        "div"
                    );

                title.className =
                    "tu-rpd-quarter-title";

                title.textContent =
                    currentQuarter;

                quarter.appendChild(
                    title
                );

                editor.appendChild(
                    quarter
                );
            }

            const quarter =
                editor.lastElementChild;

            const monthBox =
                document.createElement(
                    "div"
                );

            monthBox.className =
                "tu-rpd-month";

            const monthTitle =
                document.createElement(
                    "div"
                );

            monthTitle.className =
                "tu-rpd-month-title";

            monthTitle.textContent =
                month.label;

            monthBox.appendChild(
                monthTitle
            );

            const grid =
                document.createElement(
                    "div"
                );

            grid.className =
                "tu-rpd-week-grid";

            let monthInputs = [];

            for (
                let week = 1;
                week <= 4;
                week++
            ) {
                const field =
                    document.createElement(
                        "div"
                    );

                field.className =
                    "tu-rpd-week";

                const label =
                    document.createElement(
                        "label"
                    );

                label.textContent =
                    "Minggu " +
                    week;

                const input =
                    document.createElement(
                        "input"
                    );

                input.type =
                    "number";

                input.min = "0";
                input.step = "1";

                input.id =
                    "tuRpd_" +
                    month.key +
                    "_m" +
                    week;

                input.placeholder =
                    "Rp";

                input.addEventListener(
                    "input",
                    tuRpdUpdateTotals
                );

                field.appendChild(
                    label
                );

                field.appendChild(
                    input
                );

                grid.appendChild(
                    field
                );

                monthInputs.push(
                    input
                );
            }

            monthBox.appendChild(
                grid
            );

            const total =
                document.createElement(
                    "div"
                );

            total.className =
                "tu-rpd-quarter-total";

            total.innerHTML =
                "Jumlah " +
                tuRpdEscape(
                    month.label
                ) +
                ": <strong id="tuRpdMonthTotal_" +
                month.key +
                "">Rp0</strong>";

            monthBox.appendChild(
                total
            );

            quarter.appendChild(
                monthBox
            );
        }
    );
}

function tuRpdReadValues() {
    const values = {};

    TU_RPD_MONTHS.forEach(
        function (month) {
            for (
                let week = 1;
                week <= 4;
                week++
            ) {
                const el =
                    tuRpdEl(
                        "tuRpd_" +
                        month.key +
                        "_m" +
                        week
                    );

                values[
                    month.key +
                    "_m" +
                    week
                ] =
                    Math.max(
                        Number(
                            el?.value
                        ) || 0,
                        0
                    );
            }
        }
    );

    return values;
}

function tuRpdWriteValues(
    row
) {
    const values =
        row || {};

    TU_RPD_MONTHS.forEach(
        function (month) {
            for (
                let week = 1;
                week <= 4;
                week++
            ) {
                const key =
                    month.key +
                    "_m" +
                    week;

                const el =
                    tuRpdEl(
                        "tuRpd_" +
                        key
                    );

                if (el) {
                    const value =
                        Number(
                            values[key]
                        ) || 0;

                    el.value =
                        value === 0
                            ? ""
                            : value;
                }
            }
        }
    );

    tuRpdEl(
        "tuRpdCatatan"
    ).value =
        String(
            values?.catatan || ""
        );
}

function tuRpdClearValues() {
    TU_RPD_MONTHS.forEach(
        function (month) {
            for (
                let week = 1;
                week <= 4;
                week++
            ) {
                const el =
                    tuRpdEl(
                        "tuRpd_" +
                        month.key +
                        "_m" +
                        week
                    );

                if (el) {
                    el.value = "";
                }
            }
        }
    );

    tuRpdEl(
        "tuRpdCatatan"
    ).value = "";
}

function tuRpdMonthTotal(
    month
) {
    let total = 0;

    for (
        let week = 1;
        week <= 4;
        week++
    ) {
        total +=
            Number(
                tuRpdEl(
                    "tuRpd_" +
                    month.key +
                    "_m" +
                    week
                )?.value
            ) || 0;
    }

    return total;
}

function tuRpdQuarterTotal(
    quarter
) {
    return TU_RPD_MONTHS
        .filter(function (month) {
            return (
                month.quarter ===
                quarter
            );
        })
        .reduce(
            function (total, month) {
                return (
                    total +
                    tuRpdMonthTotal(
                        month
                    )
                );
            },
            0
        );
}

function tuRpdTotal() {
    return [
        "TW I",
        "TW II",
        "TW III",
        "TW IV"
    ].reduce(
        function (total, quarter) {
            return (
                total +
                tuRpdQuarterTotal(
                    quarter
                )
            );
        },
        0
    );
}

function tuRpdUpdateTotals() {
    TU_RPD_MONTHS.forEach(
        function (month) {
            const el =
                tuRpdEl(
                    "tuRpdMonthTotal_" +
                    month.key
                );

            if (el) {
                el.textContent =
                    tuRpdMoney(
                        tuRpdMonthTotal(
                            month
                        )
                    );
            }
        }
    );

    const total =
        tuRpdTotal();

    tuRpdEl(
        "tuRpdNewTotal"
    ).textContent =
        tuRpdMoney(total);

    const existing =
        Number(
            tuRpdState.selectedRpd?.total_rpd
        ) || 0;

    const dana =
        Number(
            tuRpdState.selectedRpd?.dana_tersedia ??
            tuRpdState.selectedMaster?.dana_tersedia ??
            Math.max(
                Number(
                    tuRpdState.selectedMaster?.pagu_revisi
                ) -
                Number(
                    tuRpdState.selectedMaster?.realisasi_final
                ),
                0
            )
        ) || 0;

    // Saat edit, RPD lama boleh tetap dipertahankan.
    // Tambahan RPD baru dibatasi oleh dana yang tersedia.
    const maxAllowed =
        dana + existing;

    tuRpdEl(
        "tuRpdMaxAllowed"
    ).textContent =
        tuRpdMoney(
            maxAllowed
        );

    const validation =
        tuRpdEl(
            "tuRpdValidation"
        );

    const card =
        tuRpdEl(
            "tuRpdValidationCard"
        );

    if (total <= maxAllowed) {
        validation.textContent =
            "VALID";

        card.classList.remove(
            "warn"
        );
    } else {
        validation.textContent =
            "MELEBIHI BATAS";

        card.classList.add(
            "warn"
        );
    }
}

function tuRpdUpdateExistingNotice(
    row
) {
    const el =
        tuRpdEl(
            "tuRpdExistingNotice"
        );

    if (!el) return;

    if (!row) {
        el.textContent =
            "Belum ada RPD tersimpan untuk Rincian Item ini.";
        return;
    }

    el.textContent =
        "RPD tersimpan: " +
        String(
            row?.id_rpd_tu || "-"
        ) +
        " · Total " +
        tuRpdMoney(
            row?.total_rpd
        ) +
        " · Sisa RPD " +
        tuRpdMoney(
            row?.sisa_rpd
        );
}

function tuRpdBuildEditor(
    row
) {
    tuRpdGenerateEditor();

    tuRpdWriteValues(
        row
    );

    tuRpdUpdateExistingNotice(
        row
    );

    tuRpdUpdateTotals();

    tuRpdEl(
        "tuRpdEditorSection"
    )?.classList.remove(
        "d-none"
    );
}

async function tuRpdList() {
    const result =
        await tuApiRequest(
            "tu_rpd_list",
            {
                tahun:
                    tuRpdYear()
            }
        );

    const rows =
        Array.isArray(
            result?.data
        )
            ? result.data
            : [];

    tuRpdState.rpdRows =
        rows;

    tuRpdState.rpdById =
        Object.create(null);

    rows.forEach(function (row) {
        const id =
            String(
                row?.id_tu || ""
            ).trim();

        if (id) {
            tuRpdState.rpdById[id] =
                row;
        }
    });

    if (tuRpdState.selectedMaster) {
        tuRpdSelectMaster(
            tuRpdState.selectedMaster
        );
    }

    return result;
}

async function tuRpdLoadAll() {
    tuRpdSetStatus(
        "Memuat master RPD TU dari server...",
        "info"
    );

    const bootstrap =
        await tuApiRequest(
            "tu_bootstrap",
            {
                tahun:
                    tuRpdYear()
            }
        );

    if (!bootstrap?.ok) {
        throw new Error(
            bootstrap?.message ||
            "tu_bootstrap gagal."
        );
    }

    const master =
        Array.isArray(bootstrap?.master)
            ? bootstrap.master
            : [];

    if (!master.length) {
        throw new Error(
            "tu_bootstrap berhasil tetapi master TU kosong."
        );
    }

    tuRpdLoadMasters(
        bootstrap
    );

    const rpdResult =
        await tuRpdList();

    const rpdRows =
        Array.isArray(
            rpdResult?.data
        )
            ? rpdResult.data
            : [];

    tuRpdOutput(
        "tu_bootstrap + tu_rpd_list",
        {
            ok: true,
            master_count: master.length,
            rpd_count: rpdRows.length,
            tahun: tuRpdYear()
        }
    );

    tuRpdSetStatus(
        "Master RPD TU berhasil dimuat: " +
        master.length.toLocaleString("id-ID") +
        " Rincian Item. Silakan pilih Komponen.",
        "success"
    );
}

function tuRpdApplySelectionById(
    idTu
) {
    const master =
        tuRpdState.masterById[
            String(
                idTu || ""
            ).trim()
        ];

    if (!master) {
        return false;
    }

    const komponen =
        String(
            master?.kode_komponen || ""
        ).trim();

    const sub =
        String(
            master?.kode_sub_komponen || ""
        ).trim();

    const akun =
        String(
            master?.kode_akun || ""
        ).trim();

    tuRpdEl(
        "tuRpdKomponen"
    ).value =
        komponen;

    tuRpdSyncSubKomponen();

    tuRpdEl(
        "tuRpdSubKomponen"
    ).value =
        sub;

    tuRpdSyncAkun();

    tuRpdEl(
        "tuRpdAkun"
    ).value =
        akun;

    tuRpdSyncRincian();

    tuRpdEl(
        "tuRpdRincianItem"
    ).value =
        String(
            master?.id_tu || ""
        ).trim();

    tuRpdSelectMaster(
        master
    );

    return true;
}

function tuRpdValidateBeforeSave() {
    const master =
        tuRpdState.selectedMaster;

    if (!master) {
        throw new Error(
            "Rincian Item belum dipilih."
        );
    }

    const values =
        tuRpdReadValues();

    const total =
        tuRpdTotal();

    const existing =
        Number(
            tuRpdState.selectedRpd?.total_rpd
        ) || 0;

    const dana =
        Number(
            tuRpdState.selectedRpd?.dana_tersedia ??
            master?.dana_tersedia ??
            Math.max(
                Number(
                    master?.pagu_revisi
                ) -
                Number(
                    master?.realisasi_final
                ),
                0
            )
        ) || 0;

    const maxAllowed =
        dana +
        existing;

    if (total > maxAllowed) {
        throw new Error(
            "Total RPD melebihi batas. " +
            "Dana tersedia " +
            tuRpdMoney(dana) +
            ", RPD existing " +
            tuRpdMoney(existing) +
            ", batas total " +
            tuRpdMoney(maxAllowed) +
            "."
        );
    }

    return {
        values,
        total
    };
}

function tuRpdSetBusy(
    busy,
    message = "Memproses..."
) {
    tuRpdState.busy =
        busy;

    [
        "tuRpdSaveButton",
        "tuRpdResetButton",
        "tuRpdReloadButton",
        "tuRpdKomponen",
        "tuRpdSubKomponen",
        "tuRpdAkun",
        "tuRpdRincianItem",
        "tuRpdCatatan"
    ].forEach(function (id) {
        const el =
            tuRpdEl(id);

        if (el) {
            el.disabled =
                busy;
        }
    });

    if (busy) {
        tuRpdOutput(
            "RPD TU",
            message
        );
    }
}

async function tuRpdSave() {
    if (tuRpdState.busy) {
        return;
    }

    let prepared;

    try {
        prepared =
            tuRpdValidateBeforeSave();
    } catch (error) {
        tuRpdSetStatus(
            error?.message ||
            String(error),
            "danger"
        );
        return;
    }

    const master =
        tuRpdState.selectedMaster;

    const existing =
        tuRpdState.selectedRpd;

    const confirmed =
        window.confirm(
            "Simpan RPD untuk Rincian Item berikut?\n\n" +
            String(
                master?.rincian_item ||
                "-"
            ) +
            "\nID TU: " +
            String(
                master?.id_tu ||
                "-"
            ) +
            "\nTotal RPD: " +
            tuRpdMoney(
                prepared.total
            )
        );

    if (!confirmed) {
        return;
    }

    tuRpdSetBusy(
        true,
        "Menjalankan tu_rpd_save..."
    );

    try {
        const values =
            prepared.values;

        const payload = {
            tahun:
                tuRpdYear(),

            id_tu:
                String(
                    master?.id_tu || ""
                ).trim(),

            catatan:
                String(
                    tuRpdEl(
                        "tuRpdCatatan"
                    )?.value || ""
                ).trim()
        };

        Object.assign(
            payload,
            values
        );

        const result =
            await tuApiRequest(
                "tu_rpd_save",
                payload
            );

        tuRpdOutput(
            "tu_rpd_save",
            result
        );

        tuRpdSetStatus(
            result?.message ||
            "RPD TU berhasil disimpan.",
            "success"
        );

        await tuRpdList();
    } catch (error) {
        tuRpdOutput(
            "tu_rpd_save",
            {
                ok: false,
                error:
                    error?.message ||
                    String(error)
            }
        );

        tuRpdSetStatus(
            error?.message ||
            "Gagal menyimpan RPD TU.",
            "danger"
        );
    } finally {
        tuRpdSetBusy(
            false
        );
    }
}

function tuRpdReset() {
    if (tuRpdState.selectedRpd) {
        tuRpdWriteValues(
            tuRpdState.selectedRpd
        );
    } else {
        tuRpdClearValues();
    }

    tuRpdUpdateExistingNotice(
        tuRpdState.selectedRpd
    );

    tuRpdUpdateTotals();
}

function tuHandleBootstrap(
    result
) {
    tuRpdLoadMasters(
        result
    );

    tuRpdList()
        .catch(function (error) {
            tuRpdSetStatus(
                error?.message ||
                "Gagal memuat RPD.",
                "danger"
            );
        });

    tuRpdSetStatus(
        "Login Operator dan master RPD berhasil dimuat.",
        "success"
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

        tuRpdLoadAll()
            .catch(function (error) {
                tuRpdSetStatus(
                    error?.message ||
                    "Gagal memuat data RPD TU.",
                    "danger"
                );
            });
    }
}

document.addEventListener(
    "DOMContentLoaded",
    function () {

        tuRpdEl(
            "tuRpdKomponen"
        )?.addEventListener(
            "change",
            tuRpdSyncSubKomponen
        );

        tuRpdEl(
            "tuRpdSubKomponen"
        )?.addEventListener(
            "change",
            tuRpdSyncAkun
        );

        tuRpdEl(
            "tuRpdAkun"
        )?.addEventListener(
            "change",
            tuRpdSyncRincian
        );

        tuRpdEl(
            "tuRpdRincianItem"
        )?.addEventListener(
            "change",
            function () {
                const id =
                    String(
                        this.value || ""
                    ).trim();

                const master =
                    tuRpdState.masterById[
                        id
                    ] || null;

                tuRpdSelectMaster(
                    master
                );
            }
        );

        tuRpdEl(
            "tuRpdSaveButton"
        )?.addEventListener(
            "click",
            tuRpdSave
        );

        tuRpdEl(
            "tuRpdResetButton"
        )?.addEventListener(
            "click",
            tuRpdReset
        );

        tuRpdEl(
            "tuRpdReloadButton"
        )?.addEventListener(
            "click",
            function () {
                tuRpdLoadAll()
                    .catch(
                        function (error) {
                            tuRpdSetStatus(
                                error?.message ||
                                "Gagal memuat ulang RPD.",
                                "danger"
                            );
                        }
                    );
            }
        );
    }
);
