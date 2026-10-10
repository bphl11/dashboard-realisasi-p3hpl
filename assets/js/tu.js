// ============================================================
// TU PAGE CONTROLLER — READ-ONLY PHASE
// ============================================================

let tuPageState = {
    tahun: Number(TU_CONFIG?.TAHUN_DEFAULT || 2026),
    bootstrap: null,
    monitoring: null,
    masters: [],
    selectedMaster: null
};

function tuFormatRupiah(value) {
    return new Intl.NumberFormat(
        "id-ID",
        {
            style: "currency",
            currency: "IDR",
            maximumFractionDigits: 0
        }
    ).format(Number(value) || 0);
}

function tuFormatNumber(value, digits = 0) {
    return new Intl.NumberFormat(
        "id-ID",
        {
            minimumFractionDigits: digits,
            maximumFractionDigits: digits
        }
    ).format(Number(value) || 0);
}

function tuEscapeHtml(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function tuSetPageStatus(
    message,
    type = "info"
) {
    const el =
        document.getElementById(
            "tuPageStatus"
        );

    if (!el) return;

    el.className =
        "tu-alert tu-alert-" + type;

    el.textContent =
        message || "";

    el.classList.remove("d-none");
}

function tuClearPageStatus() {
    document.getElementById(
        "tuPageStatus"
    )?.classList.add("d-none");
}

function tuSetBusy(
    button,
    busy,
    busyText
) {
    if (!button) return;

    if (busy) {
        if (!button.dataset.originalText) {
            button.dataset.originalText =
                button.textContent;
        }

        button.disabled = true;
        button.textContent =
            busyText || "Memuat...";
    } else {
        button.disabled = false;

        if (button.dataset.originalText) {
            button.textContent =
                button.dataset.originalText;

            delete button.dataset.originalText;
        }
    }
}

function tuRenderSummary(summary) {
    const map = {
        tuMetricPagu: summary?.total_pagu,
        tuMetricRealisasi: summary?.realisasi_final,
        tuMetricSisa: summary?.sisa_anggaran,
        tuMetricPersentase:
            tuFormatNumber(
                summary?.persentase,
                2
            ) + "%"
    };

    Object.entries(map).forEach(
        function ([id, value]) {
            const el =
                document.getElementById(id);

            if (!el) return;

            if (
                id ===
                "tuMetricPersentase"
            ) {
                el.textContent =
                    String(value);
            } else {
                el.textContent =
                    tuFormatRupiah(value);
            }
        }
    );

    const rpd =
        document.getElementById(
            "tuMetricRpd"
        );

    const sisaRpd =
        document.getElementById(
            "tuMetricSisaRpd"
        );

    if (rpd) {
        rpd.textContent =
            tuFormatRupiah(
                summary?.total_rpd
            );
    }

    if (sisaRpd) {
        sisaRpd.textContent =
            tuFormatRupiah(
                summary?.total_sisa_rpd
            );
    }
}

function tuUniqueMasters(rows, keyFn) {
    const map = new Map();

    (Array.isArray(rows) ? rows : []).forEach(function (row) {
        const key = String(
            keyFn(row) ?? ""
        );

        if (!map.has(key)) {
            map.set(key, row);
        }
    });

    return Array.from(map.values());
}

function tuResetFilterSelect(
    id,
    placeholder,
    disabled = true
) {
    const select =
        document.getElementById(id);

    if (!select) return;

    select.innerHTML = "";

    const option =
        document.createElement("option");

    option.value = "";
    option.textContent = placeholder;

    select.appendChild(option);

    select.disabled = disabled;
}

function tuSetFilterOptions(
    id,
    rows,
    valueKey,
    labelFn,
    placeholder
) {
    const select =
        document.getElementById(id);

    if (!select) return;

    select.innerHTML = "";

    const first =
        document.createElement("option");

    first.value = "";
    first.textContent = placeholder;

    select.appendChild(first);

    (Array.isArray(rows) ? rows : []).forEach(
        function (row) {
            const option =
                document.createElement("option");

            option.value =
                String(row?.[valueKey] ?? "");

            option.textContent =
                labelFn(row);

            select.appendChild(option);
        }
    );

    select.disabled =
        !Array.isArray(rows) ||
        rows.length === 0;
}

function tuLoadFilterMasters(result) {
    const masters =
        Array.isArray(result?.master)
            ? result.master.filter(function (m) {
                return String(
                    m?.status || "AKTIF"
                ).toUpperCase() === "AKTIF";
            })
            : [];

    tuPageState.masters = masters;

    const components =
        tuUniqueMasters(
            masters,
            function (m) {
                return (
                    String(m?.kode_komponen || "").trim() +
                    "|" +
                    String(m?.komponen || "").trim()
                );
            }
        );

    tuSetFilterOptions(
        "tuFilterKomponen",
        components,
        "kode_komponen",
        function (m) {
            const code =
                String(m?.kode_komponen || "").trim();

            const name =
                String(m?.komponen || "").trim();

            return code
                ? code + " — " + name
                : name;
        },
        "Pilih Komponen"
    );

    tuResetFilterSelect(
        "tuFilterSubKomponen",
        "Pilih Komponen terlebih dahulu",
        true
    );

    tuResetFilterSelect(
        "tuFilterAkun",
        "Pilih Sub Komponen terlebih dahulu",
        true
    );

    tuResetFilterSelect(
        "tuFilterRincianItem",
        "Pilih Akun terlebih dahulu",
        true
    );

    const selected =
        document.getElementById(
            "tuFilterSelected"
        );

    if (selected) {
        selected.textContent = "";
        selected.classList.add("d-none");
    }

    tuPageState.selectedMaster = null;
}

function tuSyncFilterSubKomponen() {
    const kodeKomponen =
        String(
            document.getElementById(
                "tuFilterKomponen"
            )?.value || ""
        ).trim();

    tuResetFilterSelect(
        "tuFilterSubKomponen",
        "Pilih Komponen terlebih dahulu",
        true
    );

    tuResetFilterSelect(
        "tuFilterAkun",
        "Pilih Sub Komponen terlebih dahulu",
        true
    );

    tuResetFilterSelect(
        "tuFilterRincianItem",
        "Pilih Akun terlebih dahulu",
        true
    );

    tuPageState.selectedMaster = null;

    if (!kodeKomponen) return;

    const rows =
        tuPageState.masters.filter(function (m) {
            return String(
                m?.kode_komponen || ""
            ).trim() === kodeKomponen;
        });

    const unique =
        tuUniqueMasters(
            rows,
            function (m) {
                return (
                    String(m?.kode_sub_komponen || "").trim() +
                    "|" +
                    String(m?.sub_komponen || "").trim()
                );
            }
        );

    tuSetFilterOptions(
        "tuFilterSubKomponen",
        unique,
        "kode_sub_komponen",
        function (m) {
            const code =
                String(m?.kode_sub_komponen || "").trim();

            const name =
                String(m?.sub_komponen || "").trim();

            return code
                ? code + " — " + name
                : name;
        },
        "Pilih Sub Komponen"
    );
}

function tuSyncFilterAkun() {
    const kodeKomponen =
        String(
            document.getElementById(
                "tuFilterKomponen"
            )?.value || ""
        ).trim();

    const kodeSubKomponen =
        String(
            document.getElementById(
                "tuFilterSubKomponen"
            )?.value || ""
        ).trim();

    tuResetFilterSelect(
        "tuFilterAkun",
        "Pilih Sub Komponen terlebih dahulu",
        true
    );

    tuResetFilterSelect(
        "tuFilterRincianItem",
        "Pilih Akun terlebih dahulu",
        true
    );

    tuPageState.selectedMaster = null;

    if (
        !kodeKomponen ||
        !kodeSubKomponen
    ) return;

    const rows =
        tuPageState.masters.filter(function (m) {
            return (
                String(m?.kode_komponen || "").trim() === kodeKomponen &&
                String(m?.kode_sub_komponen || "").trim() === kodeSubKomponen
            );
        });

    const unique =
        tuUniqueMasters(
            rows,
            function (m) {
                return (
                    String(m?.kode_akun || "").trim() +
                    "|" +
                    String(m?.akun || "").trim()
                );
            }
        );

    tuSetFilterOptions(
        "tuFilterAkun",
        unique,
        "kode_akun",
        function (m) {
            const code =
                String(m?.kode_akun || "").trim();

            const name =
                String(m?.akun || "").trim();

            return code
                ? code + " — " + name
                : name;
        },
        "Pilih Akun"
    );
}

function tuSyncFilterRincianItem() {
    const kodeKomponen =
        String(
            document.getElementById(
                "tuFilterKomponen"
            )?.value || ""
        ).trim();

    const kodeSubKomponen =
        String(
            document.getElementById(
                "tuFilterSubKomponen"
            )?.value || ""
        ).trim();

    const kodeAkun =
        String(
            document.getElementById(
                "tuFilterAkun"
            )?.value || ""
        ).trim();

    tuResetFilterSelect(
        "tuFilterRincianItem",
        "Pilih Akun terlebih dahulu",
        true
    );

    tuPageState.selectedMaster = null;

    if (
        !kodeKomponen ||
        !kodeSubKomponen ||
        !kodeAkun
    ) return;

    const rows =
        tuPageState.masters.filter(function (m) {
            return (
                String(m?.kode_komponen || "").trim() === kodeKomponen &&
                String(m?.kode_sub_komponen || "").trim() === kodeSubKomponen &&
                String(m?.kode_akun || "").trim() === kodeAkun
            );
        });

    tuSetFilterOptions(
        "tuFilterRincianItem",
        rows,
        "id_tu",
        function (m) {
            const code =
                String(m?.kode_item || "").trim();

            const name =
                String(m?.rincian_item || "").trim();

            return code
                ? code + " — " + name
                : name;
        },
        "Pilih Rincian Item"
    );
}

function tuSelectFilterRincianItem() {
    const idTu =
        String(
            document.getElementById(
                "tuFilterRincianItem"
            )?.value || ""
        ).trim();

    tuPageState.selectedMaster =
        tuPageState.masters.find(function (m) {
            return String(
                m?.id_tu || ""
            ).trim() === idTu;
        }) || null;

    const selected =
        document.getElementById(
            "tuFilterSelected"
        );

    if (!selected) return;

    if (!tuPageState.selectedMaster) {
        selected.textContent = "";
        selected.classList.add("d-none");
        return;
    }

    const m =
        tuPageState.selectedMaster;

    selected.textContent =
        "Terpilih: " +
        String(m?.rincian_item || "-") +
        " · ID TU " +
        String(m?.id_tu || "-") +
        " · Pagu " +
        tuFormatRupiah(m?.pagu_revisi);

    selected.classList.remove("d-none");
}

function tuHandleBootstrap(result) {
    tuPageState.bootstrap =
        result;

    tuLoadFilterMasters(
        result
    );

    const summary =
        result?.summary || {};

    if (
        Object.keys(summary).length
    ) {
        tuRenderSummary(summary);
    }

    const yearLabel =
        document.getElementById(
            "tuYearLabel"
        );

    if (yearLabel) {
        yearLabel.textContent =
            String(
                result?.tahun ||
                TU_CONFIG.TAHUN_DEFAULT
            );
    }

    tuSetPageStatus(
        "Login Operator dan tu_bootstrap berhasil.",
        "success"
    );
}

function tuInitData() {
    const user =
        typeof tuGetStoredUser ===
        "function"
            ? tuGetStoredUser()
            : null;

    if (user?.email) {
        tuRenderUser(user);
        tuShowApp(user);

        tuSetPageStatus(
            "Sesi TU dipulihkan dari browser. Memuat master filter...",
            "success"
        );

        tuApiRequest(
            "tu_bootstrap",
            {
                tahun:
                    tuPageState.tahun
            }
        ).then(
            function (result) {
                tuHandleBootstrap(
                    result
                );
            }
        ).catch(
            function (error) {
                tuSetPageStatus(
                    error?.message ||
                    "Gagal memuat master TU.",
                    "danger"
                );
            }
        );
    }
}

async function tuRunMonitoring() {
    const button =
        document.getElementById(
            "tuBtnMonitoring"
        );

    const year =
        Number(
            document.getElementById(
                "tuYear"
            )?.value ||
            TU_CONFIG.TAHUN_DEFAULT
        );

    tuSetBusy(
        button,
        true,
        "Memuat monitoring..."
    );

    const started =
        performance.now();

    try {
        tuClearPageStatus();

        const result =
            await tuApiRequest(
                "tu_monitoring",
                {
                    tahun: year
                }
            );

        const elapsed =
            (performance.now() -
                started) / 1000;

        tuPageState.monitoring =
            result;

        tuRenderSummary(
            result?.summary || {}
        );

        const details =
            Array.isArray(
                result?.detail
            )
                ? result.detail
                : [];

        const count =
            document.getElementById(
                "tuMonitoringCount"
            );

        if (count) {
            count.textContent =
                details.length.toLocaleString(
                    "id-ID"
                ) + " detail";
        }

        const time =
            document.getElementById(
                "tuMonitoringTime"
            );

        if (time) {
            time.textContent =
                elapsed.toFixed(2) +
                " detik";
        }

        const body =
            document.getElementById(
                "tuMonitoringBody"
            );

        if (body) {
            if (!details.length) {
                body.innerHTML =
                    '<tr><td colspan="10" class="text-center text-muted py-4">' +
                    "Tidak ada detail." +
                    "</td></tr>";
            } else {
                body.innerHTML =
                    details.map(
                        function (row, index) {
                            return (
                                "<tr>" +
                                "<td>" +
                                (index + 1) +
                                "</td>" +
                                "<td>" +
                                tuEscapeHtml(
                                    row.kode_sub_komponen
                                ) +
                                "</td>" +
                                "<td>" +
                                tuEscapeHtml(
                                    row.sub_komponen
                                ) +
                                "</td>" +
                                "<td>" +
                                tuEscapeHtml(
                                    row.akun
                                ) +
                                "</td>" +
                                "<td>" +
                                tuEscapeHtml(
                                    row.rincian_item
                                ) +
                                "</td>" +
                                '<td class="num">' +
                                tuFormatRupiah(
                                    row.pagu_revisi
                                ) +
                                "</td>" +
                                '<td class="num">' +
                                tuFormatRupiah(
                                    row.realisasi_final
                                ) +
                                "</td>" +
                                '<td class="num">' +
                                tuFormatRupiah(
                                    row.dana_tersedia
                                ) +
                                "</td>" +
                                '<td class="num">' +
                                tuFormatNumber(
                                    row.persentase,
                                    2
                                ) +
                                "%</td>" +
                                "<td>" +
                                tuEscapeHtml(
                                    row.status
                                ) +
                                "</td>" +
                                "</tr>"
                            );
                        }
                    ).join("");
            }
        }

        const output =
            document.getElementById(
                "tuReadOutput"
            );

        if (output) {
            output.textContent =
                "tu_monitoring (FULL " +
                year +
                ")" +
                "\n\n" +
                "HTTP: 200" +
                "\nWaktu: " +
                elapsed.toFixed(2) +
                " detik" +
                "\nDetail: " +
                details.length +
                "\n\n" +
                JSON.stringify(
                    result,
                    null,
                    2
                );
        }

        tuSetPageStatus(
            "tu_monitoring berhasil dimuat: " +
            details.length +
            " detail dalam " +
            elapsed.toFixed(2) +
            " detik.",
            "success"
        );
    } catch (error) {
        tuSetPageStatus(
            error?.message ||
            "tu_monitoring gagal.",
            "danger"
        );
    } finally {
        tuSetBusy(
            button,
            false
        );
    }
}

async function tuRunMonitoringFilter() {
    const button =
        document.getElementById(
            "tuBtnMonitoringFilter"
        );

    const master =
        tuPageState.selectedMaster;

    if (!master) {
        tuSetPageStatus(
            "Pilih Rincian Item terlebih dahulu.",
            "danger"
        );
        return;
    }

    const year =
        Number(
            document.getElementById(
                "tuYear"
            )?.value ||
            TU_CONFIG.TAHUN_DEFAULT
        );

    const idTu =
        String(
            master.id_tu || ""
        ).trim();

    tuSetBusy(
        button,
        true,
        "Memuat filter..."
    );

    const started =
        performance.now();

    try {
        tuClearPageStatus();

        const result =
            await tuApiRequest(
                "tu_monitoring",
                {
                    tahun: year,
                    ...(idTu ? { id_tu: idTu } : {})
                }
            );

        const elapsed =
            (performance.now() -
                started) / 1000;

        tuPageState.monitoring =
            result;

        tuRenderSummary(
            result?.summary || {}
        );

        const details =
            Array.isArray(
                result?.detail
            )
                ? result.detail
                : [];

        const count =
            document.getElementById(
                "tuMonitoringCount"
            );

        if (count) {
            count.textContent =
                details.length.toLocaleString(
                    "id-ID"
                ) +
                " detail";
        }

        const time =
            document.getElementById(
                "tuMonitoringTime"
            );

        if (time) {
            time.textContent =
                elapsed.toFixed(2) +
                " detik";
        }

        const body =
            document.getElementById(
                "tuMonitoringBody"
            );

        if (body) {
            if (!details.length) {
                body.innerHTML =
                    '<tr><td colspan="10" class="text-center text-muted py-4">Tidak ada detail.</td></tr>';
            } else {
                body.innerHTML =
                    details.map(
                        function (row, index) {
                            return (
                                "<tr>" +
                                "<td>" +
                                (index + 1) +
                                "</td>" +
                                "<td>" +
                                tuEscapeHtml(
                                    row.kode_sub_komponen
                                ) +
                                "</td>" +
                                "<td>" +
                                tuEscapeHtml(
                                    row.sub_komponen
                                ) +
                                "</td>" +
                                "<td>" +
                                tuEscapeHtml(
                                    row.akun
                                ) +
                                "</td>" +
                                "<td>" +
                                tuEscapeHtml(
                                    row.rincian_item
                                ) +
                                "</td>" +
                                '<td class="num">' +
                                tuFormatRupiah(
                                    row.pagu_revisi
                                ) +
                                "</td>" +
                                '<td class="num">' +
                                tuFormatRupiah(
                                    row.realisasi_final
                                ) +
                                "</td>" +
                                '<td class="num">' +
                                tuFormatRupiah(
                                    row.dana_tersedia
                                ) +
                                "</td>" +
                                '<td class="num">' +
                                tuFormatNumber(
                                    row.persentase,
                                    2
                                ) +
                                "%</td>" +
                                "<td>" +
                                tuEscapeHtml(
                                    row.status
                                ) +
                                "</td>" +
                                "</tr>"
                            );
                        }
                    ).join("");
            }
        }

        const output =
            document.getElementById(
                "tuReadOutput"
            );

        if (output) {
            output.textContent =
                "tu_monitoring (FILTER)" +
                "\n\n" +
                "HTTP: 200" +
                "\nWaktu: " +
                elapsed.toFixed(2) +
                " detik" +
                "\nID TU: " +
                idTu +
                "\nDetail: " +
                details.length +
                "\n\n" +
                JSON.stringify(
                    result,
                    null,
                    2
                );
        }

        tuSetPageStatus(
            "tu_monitoring FILTER berhasil dimuat: " +
            details.length +
            " detail untuk " +
            idTu +
            " dalam " +
            elapsed.toFixed(2) +
            " detik.",
            "success"
        );
    } catch (error) {
        tuSetPageStatus(
            error?.message ||
            "tu_monitoring FILTER gagal.",
            "danger"
        );
    } finally {
        tuSetBusy(
            button,
            false
        );
    }
}

async function tuRunList(
    action,
    label
) {
    const output =
        document.getElementById(
            "tuReadOutput"
        );

    const year =
        Number(
            document.getElementById(
                "tuYear"
            )?.value ||
            TU_CONFIG.TAHUN_DEFAULT
        );

    const idTu =
        String(
            document.getElementById(
                "tuIdTu"
            )?.value ||
            ""
        ).trim();

    tuSetPageStatus(
        "Membaca " +
        label +
        "...",
        "info"
    );

    try {
        const result =
            await tuApiRequest(
                action,
                {
                    tahun: year,
                    id_tu: idTu
                }
            );

        if (output) {
            output.textContent =
                label +
                "\n\n" +
                JSON.stringify(
                    result,
                    null,
                    2
                );
        }

        tuSetPageStatus(
            label +
            " berhasil dibaca.",
            "success"
        );
    } catch (error) {
        if (output) {
            output.textContent =
                label +
                "\n\n" +
                JSON.stringify(
                    {
                        ok: false,
                        error:
                            error?.message ||
                            String(error)
                    },
                    null,
                    2
                );
        }

        tuSetPageStatus(
            error?.message ||
            label + " gagal.",
            "danger"
        );
    }
}

function tuShowApp(user) {
    tuRenderUser(user);

    document.getElementById(
        "tuLoginPanel"
    )?.classList.add("d-none");

    document.getElementById(
        "tuAppPanel"
    )?.classList.remove("d-none");
}

function tuRenderUser(user) {
    const name =
        document.getElementById(
            "tuUserName"
        );

    const email =
        document.getElementById(
            "tuUserEmail"
        );

    const role =
        document.getElementById(
            "tuUserRole"
        );

    if (name) {
        name.textContent =
            user?.name || "Operator";
    }

    if (email) {
        email.textContent =
            user?.email || "";
    }

    if (role) {
        role.textContent =
            String(
                user?.role ||
                "OPERATOR"
            ).toUpperCase();
    }
}

document.addEventListener(
    "DOMContentLoaded",
    function () {
        const year =
            document.getElementById(
                "tuYear"
            );

        const yearLabel =
            document.getElementById(
                "tuYearLabel"
            );

        if (year) {
            year.value =
                String(
                    TU_CONFIG.TAHUN_DEFAULT
                );

            year.addEventListener(
                "input",
                function () {
                    if (yearLabel) {
                        yearLabel.textContent =
                            String(
                                year.value
                            );
                    }
                }
            );
        }

        document
            .getElementById(
                "tuFilterKomponen"
            )
            ?.addEventListener(
                "change",
                tuSyncFilterSubKomponen
            );

        document
            .getElementById(
                "tuFilterSubKomponen"
            )
            ?.addEventListener(
                "change",
                tuSyncFilterAkun
            );

        document
            .getElementById(
                "tuFilterAkun"
            )
            ?.addEventListener(
                "change",
                tuSyncFilterRincianItem
            );

        document
            .getElementById(
                "tuFilterRincianItem"
            )
            ?.addEventListener(
                "change",
                tuSelectFilterRincianItem
            );

        document
            .getElementById(
                "tuBtnMonitoring"
            )
            ?.addEventListener(
                "click",
                tuRunMonitoring
            );

        document
            .getElementById(
                "tuBtnMonitoringFilter"
            )
            ?.addEventListener(
                "click",
                tuRunMonitoringFilter
            );

        document
            .getElementById(
                "tuBtnRealisasi"
            )
            ?.addEventListener(
                "click",
                function () {
                    tuRunList(
                        "tu_realisasi_list",
                        "tu_realisasi_list"
                    );
                }
            );

        document
            .getElementById(
                "tuBtnRpd"
            )
            ?.addEventListener(
                "click",
                function () {
                    tuRunList(
                        "tu_rpd_list",
                        "tu_rpd_list"
                    );
                }
            );

        document
            .getElementById(
                "tuBtnRevisi"
            )
            ?.addEventListener(
                "click",
                function () {
                    tuRunList(
                        "tu_revisi_list",
                        "tu_revisi_list"
                    );
                }
            );
    }
);
