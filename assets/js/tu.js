// ============================================================
// TU PAGE CONTROLLER — READ-ONLY PHASE
// ============================================================

let tuPageState = {
    tahun: Number(TU_CONFIG?.TAHUN_DEFAULT || 2026),
    bootstrap: null,
    monitoring: null
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

function tuHandleBootstrap(result) {
    tuPageState.bootstrap =
        result;

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
            "Sesi TU dipulihkan dari browser.",
            "success"
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

        const idTu =
            document.getElementById(
                "tuIdTu"
            );

        if (idTu) {
            idTu.value =
                "TU-2026-000356";
        }

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
