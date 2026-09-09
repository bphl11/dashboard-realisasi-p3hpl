// ============================================================
// APP.JS - DASHBOARD REALISASI P3HPHL
// Dashboard utama menggunakan DATA_APLIKASI dan hanya Status Pagu Normal.
// ============================================================

let dashboardRawData = [];
let dashboardParsedData = [];

document.addEventListener("DOMContentLoaded", async function () {
    try {
        console.log("=== LOAD DASHBOARD BARU ===");
        dashboardRawData = await getSheetData();

        if (!Array.isArray(dashboardRawData)) {
            throw new Error("Data Google Sheet tidak valid.");
        }

        dashboardParsedData = typeof parseDataMonitoring === "function"
            ? parseDataMonitoring(dashboardRawData)
            : [];

        // Kode Sub Komponen dipakai khusus untuk tata letak Dashboard.
        // Tidak mengubah Calculation Engine maupun nilai anggaran.
        lengkapiKodeSubKomponenDashboard(
            dashboardParsedData,
            dashboardRawData
        );

        const normalData = dashboardParsedData.filter(function (item) {
            return item && item.statusPagu === "Normal";
        });

        // Semua kartu Dashboard wajib memakai Calculation Engine yang sama
        // dengan Grafik, Komponen, Monitoring, dan Laporan. Untuk DATA_APLIKASI,
        // parser sudah menggabungkan INPUT_REALISASI ke Realisasi Final per record.
        // Dengan demikian setiap transaksi INPUT_REALISASI hanya masuk satu kali.
        const calculation = typeof hitungCalculationEngine === "function"
            ? hitungCalculationEngine(dashboardRawData, dashboardParsedData)
            : null;

        const total = calculation && calculation.tanpaBlokir
            ? calculation.tanpaBlokir
            : ringkasDashboard(normalData);

        console.log("DASHBOARD TANPA BLOKIR (CALCULATION ENGINE):", {
            jumlahDataParser: normalData.length,
            total: total,
            calculation: calculation
        });

        tampilkanRingkasanDashboard(total);
        tampilkanGrafikBulananDashboard(normalData);
        tampilkanKomponenDashboard(normalData);
        tampilkanSubKomponenDashboard(normalData);
        tampilkanDiagramAkunBelanjaDashboard(normalData);

    } catch (error) {
        console.error("ERROR DASHBOARD:", error);
        tampilkanErrorDashboard(error);
    }
});

// ============================================================
// SUMBER ANGKA RESMI DASHBOARD
// Menjumlahkan langsung kolom Pagu dan Realisasi dari DATA_APLIKASI
// dengan Status Pagu = Normal. Ini mencegah baris valid hilang karena
// proses pengelompokan/hierarki parser.
// ============================================================
function ringkasDashboardRawNormal(rawData) {
    const context = typeof konteksDataAplikasi === "function"
        ? konteksDataAplikasi(rawData)
        : null;

    if (!context) {
        return ringkasDashboard([]);
    }

    let pagu = 0;
    let realisasi = 0;

    for (let i = context.headerIndex + 1; i < rawData.length; i++) {
        const row = Array.isArray(rawData[i]) ? rawData[i] : [];
        if (!row.some(function (value) { return String(value ?? "").trim() !== ""; })) continue;

        const statusRaw = typeof nilaiHeaderDataAplikasi === "function"
            ? nilaiHeaderDataAplikasi(row, context.map, ["Status Pagu", "Status"])
            : "";

        // Hanya status Normal yang masuk "Tanpa Blokir".
        if (String(statusRaw).trim().toLowerCase() !== "normal") continue;

        const paguRaw = typeof nilaiHeaderDataAplikasi === "function"
            ? nilaiHeaderDataAplikasi(row, context.map, ["Pagu"])
            : "";

        const realisasiRaw = typeof nilaiHeaderDataAplikasi === "function"
            ? nilaiHeaderDataAplikasi(row, context.map, ["Realisasi", "Jumlah Realisasi"])
            : "";

        const toNumber = typeof angkaDataAplikasi === "function"
            ? angkaDataAplikasi
            : function (value) { return Number(value) || 0; };

        pagu += toNumber(paguRaw);
        realisasi += toNumber(realisasiRaw);
    }

    return {
        pagu: pagu,
        realisasi: realisasi,
        sisa: Math.max(pagu - realisasi, 0),
        persen: pagu > 0 ? (realisasi / pagu) * 100 : 0
    };
}

function ringkasDashboard(items) {
    if (typeof ringkasDataAplikasi === "function" &&
        Array.isArray(items) &&
        items.some(function (item) { return item && item.sourceFormat === "DATA_APLIKASI"; })) {
        return ringkasDataAplikasi(items);
    }

    if (typeof hitungRingkasanDetail === "function") {
        return hitungRingkasanDetail(items || []);
    }

    return (items || []).reduce(function (hasil, item) {
        hasil.pagu += Number(item && item.pagu) || 0;
        hasil.realisasi += Number(item && item.realisasi) || 0;
        hasil.sisa = Math.max(hasil.pagu - hasil.realisasi, 0);
        hasil.persen = hasil.pagu > 0 ? (hasil.realisasi / hasil.pagu) * 100 : 0;
        return hasil;
    }, { pagu: 0, realisasi: 0, sisa: 0, persen: 0 });
}

function tampilkanRingkasanDashboard(total) {
    setTextDashboard("totalPagu", formatRupiahDashboard(total.pagu));
    setTextDashboard("totalRealisasi", formatRupiahDashboard(total.realisasi));
    setTextDashboard("totalSisa", formatRupiahDashboard(total.sisa));
    setTextDashboard("totalPersen", formatPersenDashboard(total.persen));
}

function tampilkanGrafikBulananDashboard(items) {
    const container = document.getElementById("grafikBulanan");
    if (!container) return;

    const bulan = ["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"];
    const total = {};
    bulan.forEach(function (nama) { total[nama] = 0; });

    (items || []).forEach(function (item) {
        bulan.forEach(function (nama) {
            total[nama] += Number(item && item.bulanan && item.bulanan[nama]) || 0;
        });
    });

    const nilai = bulan.map(function (nama) { return total[nama] || 0; });
    const maksimum = Math.max.apply(null, nilai.concat([1]));

    container.innerHTML = '<div class="monthly-chart">' +
        bulan.map(function (nama, index) {
            const value = nilai[index];
            const height = value > 0 ? Math.max((value / maksimum) * 100, 2) : 0;
            return '<div class="month-column">' +
                '<div class="month-tooltip">' + escapeHtmlDashboard(nama) + '<br><strong>' + formatRupiahDashboard(value) + '</strong></div>' +
                '<div class="month-value">' + formatSingkatRupiahDashboard(value) + '</div>' +
                '<div class="month-bar-area"><div class="month-bar" style="height:' + height + '%"></div></div>' +
                '<div class="month-name">' + escapeHtmlDashboard(nama.substring(0, 3)) + '</div>' +
            '</div>';
        }).join("") +
    '</div>';
}

function buatKelompokDashboard(items, fields) {
    const groups = new Map();

    (items || []).forEach(function (item) {
        const values = fields.map(function (field) {
            const value = String(item && item[field] !== undefined ? item[field] : "").trim();
            return value && value !== "-" ? value : "Tidak Teridentifikasi";
        });

        const key = values.join("||");
        if (!groups.has(key)) {
            groups.set(key, { values: values, items: [] });
        }
        groups.get(key).items.push(item);
    });

    return Array.from(groups.values()).map(function (group) {
        return {
            values: group.values,
            total: ringkasDashboard(group.items),
            items: group.items
        };
    }).filter(function (group) {
        return group.total.pagu > 0 || group.total.realisasi > 0;
    });
}

function tampilkanKomponenDashboard(items) {
    const container = document.getElementById("dashboardKomponen");
    const count = document.getElementById("jumlahKomponen");
    if (!container) return;

    const groups = buatKelompokDashboard(items, ["kodeKomponen", "komponen"])
        .sort(function (a, b) { return b.total.realisasi - a.total.realisasi; });

    if (count) count.textContent = groups.length + " Komponen";

    container.innerHTML = groups.length
        ? groups.map(function (group) {
            const kode = group.values[0] === "Tidak Teridentifikasi" ? "" : group.values[0];
            const nama = group.values[1];
            const judul = kode ? kode + " - " + nama : nama;
            const total = group.total;
            return '<div class="col-12 col-lg-6 col-xxl-4">' +
                '<article class="component-card h-100">' +
                    '<div class="component-card-title"><span class="component-icon"><i class="bi bi-folder2-open"></i></span><h5>' + escapeHtmlDashboard(judul) + '</h5></div>' +
                    '<div class="component-metrics">' +
                        metricDashboard("Pagu", formatRupiahDashboard(total.pagu), "metric-blue") +
                        metricDashboard("Realisasi", formatRupiahDashboard(total.realisasi), "metric-green") +
                        metricDashboard("Sisa", formatRupiahDashboard(total.sisa), "metric-red") +
                    '</div>' +
                    '<div class="progress-label"><span>Penyerapan</span><strong>' + formatPersenDashboard(total.persen) + '</strong></div>' +
                    '<div class="progress component-progress"><div class="progress-bar" style="width:' + Math.min(Math.max(total.persen, 0), 100) + '%"></div></div>' +
                '</article>' +
            '</div>';
        }).join("")
        : '<div class="col-12"><div class="empty-dashboard">Data komponen belum teridentifikasi dari DATA_APLIKASI.</div></div>';
}

function metricDashboard(label, value, className) {
    return '<div class="metric-item ' + className + '"><span>' + label + '</span><strong>' + value + '</strong></div>';
}

function lengkapiKodeSubKomponenDashboard(items, rawData) {
    if (!Array.isArray(items) || !Array.isArray(rawData)) return;

    const context = typeof konteksDataAplikasi === "function"
        ? konteksDataAplikasi(rawData)
        : null;

    if (!context || typeof nilaiHeaderDataAplikasi !== "function") return;

    items.forEach(function (item) {
        if (!item || !Number.isInteger(item.rowIndex)) return;

        const row = Array.isArray(rawData[item.rowIndex])
            ? rawData[item.rowIndex]
            : [];

        const kode = nilaiHeaderDataAplikasi(row, context.map, [
            "Kode Sub Komponen",
            "Kode Subkomponen",
            "KodeSubKomponen"
        ]);

        item.kodeSubKomponen = kode || item.kodeSubKomponen || "-";
    });
}

function bandingkanTeksDashboard(a, b) {
    return String(a ?? "").localeCompare(
        String(b ?? ""),
        "id",
        { numeric: true, sensitivity: "base" }
    );
}

function tampilkanSubKomponenDashboard(items) {
    const container = document.getElementById("dashboardSubKomponen");
    const count = document.getElementById("jumlahSubKomponen");
    if (!container) return;

    const groups = buatKelompokDashboard(items, [
        "kodeKomponen",
        "komponen",
        "kodeSubKomponen",
        "subKomponen"
    ]).sort(function (a, b) {
        return (
            bandingkanTeksDashboard(a.values[0], b.values[0]) ||
            bandingkanTeksDashboard(a.values[1], b.values[1]) ||
            bandingkanTeksDashboard(a.values[2], b.values[2]) ||
            bandingkanTeksDashboard(a.values[3], b.values[3])
        );
    });

    if (count) count.textContent = groups.length + " Sub Komponen";

    const componentGroups = new Map();

    groups.forEach(function (group) {
        const kodeKomponen = group.values[0] === "Tidak Teridentifikasi"
            ? "-"
            : group.values[0];

        const namaKomponen = group.values[1];
        const key = kodeKomponen + "||" + namaKomponen;

        if (!componentGroups.has(key)) {
            componentGroups.set(key, {
                kode: kodeKomponen,
                nama: namaKomponen,
                subKomponen: []
            });
        }

        componentGroups.get(key).subKomponen.push(group);
    });

    container.innerHTML = groups.length
        ? Array.from(componentGroups.values()).map(function (component) {
            const kodeKomponen = component.kode && component.kode !== "-"
                ? component.kode + " - "
                : "";

            const componentHeader =
                '<tr class="component-group-row">' +
                    '<td colspan="6">' +
                        '<span class="component-group-label">Komponen</span>' +
                        '<strong>' +
                            escapeHtmlDashboard(kodeKomponen + component.nama) +
                        '</strong>' +
                    '</td>' +
                '</tr>';

            const rows = component.subKomponen.map(function (group) {
                const total = group.total;
                const kodeSub = group.values[2] === "Tidak Teridentifikasi"
                    ? ""
                    : group.values[2];

                const namaSub = group.values[3];
                const subLabel = kodeSub
                    ? kodeSub + " - " + namaSub
                    : namaSub;

                return '<tr>' +
                    '<td class="subcomponent-indent"><span class="subcomponent-marker"><i class="bi bi-arrow-return-right"></i></span></td>' +
                    '<td class="subcomponent-cell">' + escapeHtmlDashboard(subLabel) + '</td>' +
                    '<td class="text-end">' + formatRupiahDashboard(total.pagu) + '</td>' +
                    '<td class="text-end text-success fw-semibold">' + formatRupiahDashboard(total.realisasi) + '</td>' +
                    '<td class="text-end text-danger-emphasis">' + formatRupiahDashboard(total.sisa) + '</td>' +
                    '<td class="text-end"><span class="percent-pill">' + formatPersenDashboard(total.persen) + '</span></td>' +
                '</tr>';
            }).join("");

            return componentHeader + rows;
        }).join("")
        : '<tr><td colspan="6" class="text-center text-muted py-4">Data sub komponen belum tersedia.</td></tr>';
}

function tampilkanDiagramAkunBelanjaDashboard(items) {
    const container = document.getElementById("diagramAkunBelanjaDashboard");
    if (!container) return;

    const groups = buatKelompokDashboard(items, ["akun", "itemAkun"])
        .sort(function (a, b) {
            return bandingkanTeksDashboard(a.values[0], b.values[0]) ||
                bandingkanTeksDashboard(a.values[1], b.values[1]);
        });

    if (!groups.length) {
        container.innerHTML = '<div class="empty-dashboard">Tidak ada data akun belanja dengan status Normal.</div>';
        return;
    }

    const akunMap = new Map();

    groups.forEach(function (group) {
        const akun = group.values[0];
        if (!akunMap.has(akun)) akunMap.set(akun, []);
        akunMap.get(akun).push(group);
    });

    container.innerHTML = Array.from(akunMap.entries()).map(function (entry) {
        const akun = entry[0];
        const itemGroups = entry[1];
        const labels = itemGroups.map(function (group) {
            return group.values[1] && group.values[1] !== "Tidak Teridentifikasi"
                ? group.values[1]
                : "Tanpa Item Akun";
        });

        return '<article class="akun-chart-card">' +
            '<div class="akun-chart-header">' +
                '<div><span class="akun-chart-kicker">Akun Belanja</span><h5><i class="bi bi-wallet2"></i> ' +
                escapeHtmlDashboard(akun) +
                '</h5></div>' +
                '<span class="akun-chart-count">' + itemGroups.length + ' Item Akun</span>' +
            '</div>' +
            '<div class="akun-chart-grid">' +
                buatDiagramAkunDashboard("Pagu", "Pagu seluruh " + akun, labels, itemGroups.map(function (g) { return g.total.pagu; }), "chart-pagu") +
                buatDiagramAkunDashboard("Realisasi", "Realisasi seluruh " + akun, labels, itemGroups.map(function (g) { return g.total.realisasi; }), "chart-realisasi") +
                buatDiagramAkunDashboard("Sisa", "Sisa anggaran seluruh " + akun, labels, itemGroups.map(function (g) { return g.total.sisa; }), "chart-sisa") +
            '</div>' +
        '</article>';
    }).join("");
}

function buatDiagramAkunDashboard(title, subtitle, labels, values, className) {
    const maksimum = Math.max.apply(null, values.concat([1]));

    const rows = labels.map(function (label, index) {
        const value = Number(values[index]) || 0;
        const width = value > 0 ? Math.max((value / maksimum) * 100, 1.5) : 0;

        return '<div class="akun-bar-row">' +
            '<div class="akun-bar-label" title="' + escapeHtmlDashboard(label) + '">' +
                escapeHtmlDashboard(label) +
            '</div>' +
            '<div class="akun-bar-track">' +
                '<div class="akun-bar ' + className + '" style="width:' + width + '%">' +
                    (width >= 12 ? '<span>' + formatSingkatRupiahDashboard(value) + '</span>' : '') +
                '</div>' +
                (width < 12 ? '<span class="akun-bar-outside">' + formatSingkatRupiahDashboard(value) + '</span>' : '') +
            '</div>' +
        '</div>';
    }).join("");

    return '<section class="akun-mini-chart">' +
        '<div class="akun-mini-chart-title"><strong>' + escapeHtmlDashboard(title) + '</strong><span>' +
            escapeHtmlDashboard(subtitle) +
        '</span></div>' +
        '<div class="akun-bars">' + rows + '</div>' +
    '</section>';
}
function tampilkanErrorDashboard(error) {
    const message = escapeHtmlDashboard(error && error.message ? error.message : "Terjadi kesalahan.");
    ["grafikBulanan","dashboardKomponen","monitoringDashboard"].forEach(function (id) {
        const element = document.getElementById(id);
        if (element) element.innerHTML = '<div class="alert alert-danger mb-0">Gagal memuat Dashboard: ' + message + '</div>';
    });
}

function formatRupiahDashboard(value) {
    return "Rp" + Math.round(Number(value) || 0).toLocaleString("id-ID");
}

function formatSingkatRupiahDashboard(value) {
    const number = Math.round(Number(value) || 0);

    if (number >= 1000000000) {
        return "Rp" + (number / 1000000000).toLocaleString("id-ID", { maximumFractionDigits: 1 }) + " M";
    }

    if (number >= 1000000) {
        return "Rp" + (number / 1000000).toLocaleString("id-ID", { maximumFractionDigits: 1 }) + " Jt";
    }

    if (number >= 1000) {
        return "Rp" + (number / 1000).toLocaleString("id-ID", { maximumFractionDigits: 1 }) + " Rb";
    }

    return "Rp" + number.toLocaleString("id-ID");
}

function formatPersenDashboard(value) {
    return (Number(value) || 0).toLocaleString("id-ID", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + "%";
}

function setTextDashboard(id, value) {
    const element = document.getElementById(id);
    if (element) element.textContent = value;
}

function escapeHtmlDashboard(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}