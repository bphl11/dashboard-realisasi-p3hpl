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

        const normalData = dashboardParsedData.filter(function (item) {
            return item && item.statusPagu === "Normal";
        });

        // Angka kartu utama harus mengikuti DATA_APLIKASI secara langsung.
        // Jangan bergantung pada hasil parser untuk total, karena parser hanya
        // dipakai untuk struktur/hierarki Komponen dan Sub Komponen.
        const total = ringkasDashboardRawNormal(dashboardRawData);

        console.log("DASHBOARD NORMAL (RAW DATA_APLIKASI):", {
            jumlahDataParser: normalData.length,
            total: total
        });

        tampilkanRingkasanDashboard(total);
        tampilkanGrafikBulananDashboard(normalData);
        tampilkanKomponenDashboard(normalData);
        tampilkanSubKomponenDashboard(normalData);
        tampilkanMonitoringDashboard(normalData);

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

    const groups = buatKelompokDashboard(items, ["komponen"])
        .sort(function (a, b) { return b.total.realisasi - a.total.realisasi; });

    if (count) count.textContent = groups.length + " Komponen";

    container.innerHTML = groups.length
        ? groups.map(function (group) {
            const nama = group.values[0];
            const total = group.total;
            return '<div class="col-12 col-lg-6 col-xxl-4">' +
                '<article class="component-card h-100">' +
                    '<div class="component-card-title"><span class="component-icon"><i class="bi bi-folder2-open"></i></span><h5>' + escapeHtmlDashboard(nama) + '</h5></div>' +
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

function tampilkanSubKomponenDashboard(items) {
    const container = document.getElementById("dashboardSubKomponen");
    const count = document.getElementById("jumlahSubKomponen");
    if (!container) return;

    const groups = buatKelompokDashboard(items, ["komponen", "subKomponen"])
        .sort(function (a, b) { return b.total.realisasi - a.total.realisasi; });

    if (count) count.textContent = groups.length + " Sub Komponen";

    container.innerHTML = groups.length
        ? groups.map(function (group) {
            const total = group.total;
            return '<tr>' +
                '<td class="component-cell">' + escapeHtmlDashboard(group.values[0]) + '</td>' +
                '<td class="subcomponent-cell">' + escapeHtmlDashboard(group.values[1]) + '</td>' +
                '<td class="text-end">' + formatRupiahDashboard(total.pagu) + '</td>' +
                '<td class="text-end text-success fw-semibold">' + formatRupiahDashboard(total.realisasi) + '</td>' +
                '<td class="text-end text-danger-emphasis">' + formatRupiahDashboard(total.sisa) + '</td>' +
                '<td class="text-end"><span class="percent-pill">' + formatPersenDashboard(total.persen) + '</span></td>' +
            '</tr>';
        }).join("")
        : '<tr><td colspan="6" class="text-center text-muted py-4">Data sub komponen belum tersedia.</td></tr>';
}

function tampilkanMonitoringDashboard(items) {
    const container = document.getElementById("monitoringDashboard");
    if (!container) return;

    const groups = buatKelompokDashboard(items, ["komponen", "subKomponen"])
        .sort(function (a, b) { return b.total.realisasi - a.total.realisasi; })
        .slice(0, 10);

    container.innerHTML = '<div class="table-responsive dashboard-table-wrap"><table class="table dashboard-table align-middle mb-0">' +
        '<thead><tr><th>Komponen</th><th>Sub Komponen</th><th class="text-end">Pagu</th><th class="text-end">Realisasi</th><th class="text-end">%</th></tr></thead>' +
        '<tbody>' +
        (groups.length ? groups.map(function (group) {
            const total = group.total;
            return '<tr><td>' + escapeHtmlDashboard(group.values[0]) + '</td><td>' + escapeHtmlDashboard(group.values[1]) + '</td><td class="text-end">' + formatRupiahDashboard(total.pagu) + '</td><td class="text-end text-success fw-semibold">' + formatRupiahDashboard(total.realisasi) + '</td><td class="text-end">' + formatPersenDashboard(total.persen) + '</td></tr>';
        }).join("") : '<tr><td colspan="5" class="text-center text-muted py-4">Tidak ada data Normal.</td></tr>') +
        '</tbody></table></div>';
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
