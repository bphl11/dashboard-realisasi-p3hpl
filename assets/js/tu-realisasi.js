// ============================================================
// TU REALISASI — TRANSACTION UI
//
// Fase: UI transaksi Realisasi TU.
// Tidak melakukan request write otomatis saat halaman dibuka.
// Semua SAVE / UPDATE / NONAKTIF hanya berjalan setelah tombol
// diklik dan dikonfirmasi user.
// ============================================================

let tuRealisasiState = {
    rows: [],
    editingId: null,
    busy: false
};

function tuRealGetTahun() {
    return Number(
        document.getElementById("tuRealTahun")?.value ||
        TU_CONFIG.TAHUN_DEFAULT
    );
}

function tuRealGetIdTu() {
    return String(
        document.getElementById("tuRealIdTu")?.value ||
        ""
    ).trim();
}

function tuRealShowStatus(
    message,
    type = "info"
) {
    const el =
        document.getElementById(
            "tuPageStatus"
        );

    if (!el) return;

    el.className =
        "tu-alert tu-alert-" +
        type;

    el.textContent =
        message || "";

    el.classList.remove("d-none");
}

function tuRealSetOutput(
    action,
    data
) {
    const output =
        document.getElementById(
            "tuRealOutput"
        );

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

function tuRealFormatRupiah(value) {
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

function tuRealFormatDate(value) {
    if (!value) return "";

    const date =
        new Date(value);

    if (Number.isNaN(
        date.getTime()
    )) {
        return String(value);
    }

    return new Intl.DateTimeFormat(
        "id-ID",
        {
            day: "2-digit",
            month: "2-digit",
            year: "numeric"
        }
    ).format(date);
}

function tuRealEscapeHtml(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function tuRealSetBusy(
    busy,
    buttonText = "Memproses..."
) {
    tuRealisasiState.busy =
        busy;

    const ids = [
        "tuRealSaveButton",
        "tuRealUpdateButton",
        "tuRealCancelButton",
        "tuRealRefreshButton"
    ];

    ids.forEach(
        function (id) {
            const button =
                document.getElementById(id);

            if (button) {
                button.disabled =
                    busy;
            }
        }
    );

    if (busy) {
        const output =
            document.getElementById(
                "tuRealOutput"
            );

        if (output) {
            output.textContent =
                buttonText;
        }
    }
}

function tuRealSetEditing(
    row
) {
    tuRealisasiState.editingId =
        String(
            row?.id_realisasi_tu ||
            ""
        ).trim();

    document.getElementById(
        "tuRealIdTu"
    ).value =
        row?.id_tu || "";

    document.getElementById(
        "tuRealTanggal"
    ).value =
        tuRealToInputDate(
            row?.tanggal_realisasi
        );

    document.getElementById(
        "tuRealBulan"
    ).value =
        Number(
            row?.bulan_realisasi ||
            0
        );

    document.getElementById(
        "tuRealNominal"
    ).value =
        Number(
            row?.nominal_realisasi ||
            0
        );

    document.getElementById(
        "tuRealKeterangan"
    ).value =
        row?.keterangan || "";

    const editing =
        document.getElementById(
            "tuRealEditing"
        );

    if (editing) {
        editing.textContent =
            "Mode EDIT aktif untuk " +
            tuRealisasiState.editingId +
            ". Ubah data yang diperlukan lalu klik Simpan Perubahan.";
        editing.classList.remove(
            "d-none"
        );
    }

    document.getElementById(
        "tuRealSaveButton"
    )?.classList.add(
        "d-none"
    );

    document.getElementById(
        "tuRealUpdateButton"
    )?.classList.remove(
        "d-none"
    );

    document.getElementById(
        "tuRealCancelButton"
    )?.classList.remove(
        "d-none"
    );

    document.getElementById(
        "tuRealStatusReadonly"
    ).value =
        "EDIT — data lama";

    window.scrollTo({
        top: 0,
        behavior: "smooth"
    });
}

function tuRealResetForm() {
    tuRealisasiState.editingId =
        null;

    document.getElementById(
        "tuRealIdTu"
    ).value =
        "TU-2026-000356";

    document.getElementById(
        "tuRealTanggal"
    ).value =
        tuRealToday();

    document.getElementById(
        "tuRealBulan"
    ).value =
        new Date().getMonth() + 1;

    document.getElementById(
        "tuRealNominal"
    ).value = "";

    document.getElementById(
        "tuRealKeterangan"
    ).value = "";

    document.getElementById(
        "tuRealStatusReadonly"
    ).value =
        "AKTIF untuk transaksi baru";

    document.getElementById(
        "tuRealEditing"
    )?.classList.add(
        "d-none"
    );

    document.getElementById(
        "tuRealSaveButton"
    )?.classList.remove(
        "d-none"
    );

    document.getElementById(
        "tuRealUpdateButton"
    )?.classList.add(
        "d-none"
    );

    document.getElementById(
        "tuRealCancelButton"
    )?.classList.add(
        "d-none"
    );
}

function tuRealToday() {
    const now =
        new Date();

    const yyyy =
        now.getFullYear();

    const mm =
        String(
            now.getMonth() + 1
        ).padStart(2, "0");

    const dd =
        String(
            now.getDate()
        ).padStart(2, "0");

    return (
        yyyy +
        "-" +
        mm +
        "-" +
        dd
    );
}

function tuRealToInputDate(
    value
) {
    if (!value) return "";

    const s =
        String(value);

    const match =
        s.match(
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

    const date =
        new Date(value);

    if (Number.isNaN(
        date.getTime()
    )) {
        return "";
    }

    return (
        date.getFullYear() +
        "-" +
        String(
            date.getMonth() + 1
        ).padStart(2, "0") +
        "-" +
        String(
            date.getDate()
        ).padStart(2, "0")
    );
}

function tuRealValidateForm() {
    const idTu =
        tuRealGetIdTu();

    const tanggal =
        document.getElementById(
            "tuRealTanggal"
        ).value;

    const bulan =
        Number(
            document.getElementById(
                "tuRealBulan"
            ).value
        );

    const nominal =
        Number(
            document.getElementById(
                "tuRealNominal"
            ).value
        );

    const keterangan =
        String(
            document.getElementById(
                "tuRealKeterangan"
            ).value ||
            ""
        ).trim();

    if (!idTu) {
        throw new Error(
            "ID TU wajib diisi."
        );
    }

    if (!tanggal) {
        throw new Error(
            "Tanggal realisasi wajib diisi."
        );
    }

    if (
        !Number.isInteger(bulan) ||
        bulan < 1 ||
        bulan > 12
    ) {
        throw new Error(
            "Bulan realisasi harus 1 sampai 12."
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

    if (!keterangan) {
        throw new Error(
            "Keterangan wajib diisi."
        );
    }

    return {
        id_tu: idTu,
        tanggal_realisasi: tanggal,
        bulan_realisasi: bulan,
        nominal_realisasi: nominal,
        keterangan
    };
}

async function tuRealisasiList(
    options = {}
) {
    if (tuRealisasiState.busy) {
        return;
    }

    const year =
        Number(
            options.tahun ||
            tuRealGetTahun()
        );

    try {
        const result =
            await tuApiRequest(
                "tu_realisasi_list",
                {
                    tahun: year
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

        if (
            options.showStatus !==
            false
        ) {
            tuRealShowStatus(
                "Daftar realisasi berhasil dimuat.",
                "success"
            );
        }

        return result;
    } catch (error) {
        tuRealisasiState.rows =
            [];

        tuRenderList([]);

        tuRealShowStatus(
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
        document.getElementById(
            "tuRealBody"
        );

    const count =
        document.getElementById(
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
            '<tr><td colspan="9" class="tu-real-empty">' +
            "Tidak ada realisasi untuk tahun yang dipilih." +
            "</td></tr>";

        return;
    }

    body.innerHTML =
        rows.map(
            function (row, index) {
                const id =
                    tuRealEscapeHtml(
                        row.id_realisasi_tu
                    );

                const status =
                    String(
                        row.status ||
                        ""
                    ).toUpperCase();

                const inactive =
                    status ===
                    "NONAKTIF";

                return (
                    "<tr>" +
                    "<td>" +
                    (index + 1) +
                    "</td>" +

                    "<td>" +
                    id +
                    "</td>" +

                    "<td>" +
                    tuRealEscapeHtml(
                        row.id_tu
                    ) +
                    "</td>" +

                    "<td>" +
                    tuRealEscapeHtml(
                        tuRealFormatDate(
                            row.tanggal_realisasi
                        )
                    ) +
                    "</td>" +

                    "<td>" +
                    tuRealEscapeHtml(
                        row.bulan_realisasi
                    ) +
                    "</td>" +

                    '<td class="num">' +
                    tuRealFormatRupiah(
                        row.nominal_realisasi
                    ) +
                    "</td>" +

                    "<td>" +
                    tuRealEscapeHtml(
                        row.keterangan
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
                        status ||
                        "AKTIF"
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
                              id +
                              '">Edit</button>'
                    ) +

                    (
                        inactive
                            ? ""
                            :
                              '<button type="button" class="tu-btn tu-real-danger" data-real-delete="' +
                              id +
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
    const key =
        String(
            id || ""
        );

    return tuRealisasiState.rows.find(
        function (row) {
            return String(
                row?.id_realisasi_tu ||
                ""
            ) === key;
        }
    ) || null;
}

async function tuSaveRealisasi() {
    if (tuRealisasiState.busy) {
        return;
    }

    let fields;

    try {
        fields =
            tuRealValidateForm();
    } catch (error) {
        tuRealShowStatus(
            error.message,
            "danger"
        );
        return;
    }

    const confirmed =
        window.confirm(
            "Simpan realisasi TU ini?\n\n" +
            "ID TU: " +
            fields.id_tu +
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
                        tuRealGetTahun(),
                    ...fields
                }
            );

        tuRealSetOutput(
            "tu_realisasi_save",
            result
        );

        tuRealShowStatus(
            result?.message ||
            "Realisasi berhasil disimpan.",
            "success"
        );

        tuRealResetForm();

        await tuRealisasiList({
            showStatus:
                false
        });
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

        tuRealShowStatus(
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
    if (tuRealisasiState.busy) {
        return;
    }

    const id =
        tuRealisasiState.editingId;

    if (!id) {
        tuRealShowStatus(
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
        tuRealShowStatus(
            error.message,
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
                        tuRealGetTahun(),
                    id_realisasi_tu:
                        id,
                    ...fields
                }
            );

        tuRealSetOutput(
            "tu_realisasi_update",
            result
        );

        tuRealShowStatus(
            result?.message ||
            "Realisasi berhasil diperbarui.",
            "success"
        );

        tuRealResetForm();

        await tuRealisasiList({
            showStatus:
                false
        });
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

        tuRealShowStatus(
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
        tuRealShowStatus(
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
            "Data tidak dihapus dari sheet. Endpoint TU akan mengubah status menjadi NONAKTIF."
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
                        tuRealGetTahun(),
                    id_realisasi_tu:
                        id
                }
            );

        tuRealSetOutput(
            "tu_realisasi_delete",
            result
        );

        tuRealShowStatus(
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

        await tuRealisasiList({
            showStatus:
                false
        });
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

        tuRealShowStatus(
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
    const editButton =
        event.target.closest(
            "[data-real-edit]"
        );

    if (editButton) {
        const row =
            tuFindRow(
                editButton.dataset.realEdit
            );

        if (row) {
            tuRealSetEditing(row);
        }

        return;
    }

    const deleteButton =
        event.target.closest(
            "[data-real-delete]"
        );

    if (deleteButton) {
        tuDeleteRealisasi(
            deleteButton.dataset.realDelete
        );
    }
}

function tuHandleRealisasiBootstrap(
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

    tuRealisasiList({
        showStatus:
            false
    }).catch(
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
        tuShowApp(user);

        tuRealShowStatus(
            "Sesi TU dipulihkan. Data realisasi siap dibaca.",
            "success"
        );

        tuRealisasiList({
            showStatus:
                false
        }).catch(
            function () {}
        );
    }
}

function tuHandleBootstrap(
    result
) {
    tuHandleRealisasiBootstrap(
        result
    );

    tuRealShowStatus(
        "Login Operator dan tu_bootstrap berhasil.",
        "success"
    );
}

document.addEventListener(
    "DOMContentLoaded",
    function () {
        const date =
            document.getElementById(
                "tuRealTanggal"
            );

        if (date) {
            date.value =
                tuRealToday();
        }

        const month =
            document.getElementById(
                "tuRealBulan"
            );

        if (month) {
            month.value =
                new Date().getMonth() + 1;
        }

        document
            .getElementById(
                "tuRealSaveButton"
            )
            ?.addEventListener(
                "click",
                tuSaveRealisasi
            );

        document
            .getElementById(
                "tuRealUpdateButton"
            )
            ?.addEventListener(
                "click",
                tuUpdateRealisasi
            );

        document
            .getElementById(
                "tuRealCancelButton"
            )
            ?.addEventListener(
                "click",
                tuRealResetForm
            );

        document
            .getElementById(
                "tuRealRefreshButton"
            )
            ?.addEventListener(
                "click",
                function () {
                    tuRealisasiList()
                        .catch(
                            function () {}
                        );
                }
            );

        document
            .getElementById(
                "tuRealBody"
            )
            ?.addEventListener(
                "click",
                tuRealHandleTableClick
            );
    }
);
