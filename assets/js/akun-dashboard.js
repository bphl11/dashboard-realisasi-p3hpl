// ============================================================
// AKUN DASHBOARD
// Menampilkan ringkasan berdasarkan NAMA AKUN BELANJA saja.
// Item Akun (mis. 521211 / 524111) tidak ditampilkan sebagai
// baris terpisah.
// ============================================================

(function () {
    function renderAkunBelanja() {
        const container = document.getElementById("diagramAkunBelanjaDashboard");
        if (!container || !Array.isArray(window.dashboardParsedData) && typeof dashboardParsedData === "undefined") {
            return false;
        }

        const data = typeof dashboardParsedData !== "undefined"
            ? dashboardParsedData
            : [];

        const normalData = data.filter(function (item) {
            return item && item.statusPagu === "Normal";
        });

        const akunMap = new Map();

        normalData.forEach(function (item) {
            const akun = String(item.akun || "").trim() || "Tidak Teridentifikasi";
            if (!akunMap.has(akun)) akunMap.set(akun, []);
            akunMap.get(akun).push(item);
        });

        const groups = Array.from(akunMap.entries()).map(function (entry) {
            return {
                akun: entry[0],
                total: ringkasDashboard(entry[1])
            };
        }).filter(function (group) {
            return group.total.pagu > 0 || group.total.realisasi > 0;
        }).sort(function (a, b) {
            return bandingkanTeksDashboard(a.akun, b.akun);
        });

        if (!groups.length) return false;

        function makeBar(title, subtitle, value, className) {
            return '<section class="akun-mini-chart">' +
                '<div class="akun-mini-chart-title"><strong>' +
                    escapeHtmlDashboard(title) +
                    '</strong><span>' +
                    escapeHtmlDashboard(subtitle) +
                    '</span></div>' +
                '<div class="akun-bars">' +
                    '<div class="akun-bar-row akun-bar-row-single">' +
                        '<div class="akun-bar-label" title="' + escapeHtmlDashboard(title) + '">' +
                            escapeHtmlDashboard(title) +
                        '</div>' +
                        '<div class="akun-bar-track">' +
                            '<div class="akun-bar ' + className + '" style="width:100%">' +
                                '<span>' + formatSingkatRupiahDashboard(value) + '</span>' +
                            '</div>' +
                        '</div>' +
                    '</div>' +
                '</div>' +
            '</section>';
        }

        container.innerHTML = groups.map(function (group) {
            const akun = group.akun;
            const total = group.total;

            return '<article class="akun-chart-card">' +
                '<div class="akun-chart-header">' +
                    '<div><span class="akun-chart-kicker">Akun Belanja</span><h5><i class="bi bi-wallet2"></i> ' +
                        escapeHtmlDashboard(akun) +
                    '</h5></div>' +
                    '<span class="akun-chart-count">1 Akun Belanja</span>' +
                '</div>' +
                '<div class="akun-chart-grid">' +
                    makeBar(akun, "Pagu seluruh " + akun, total.pagu, "chart-pagu") +
                    makeBar(akun, "Realisasi seluruh " + akun, total.realisasi, "chart-realisasi") +
                    makeBar(akun, "Sisa anggaran seluruh " + akun, total.sisa, "chart-sisa") +
                '</div>' +
            '</article>';
        }).join("");

        return true;
    }

    document.addEventListener("DOMContentLoaded", function () {
        let percobaan = 0;
        const timer = setInterval(function () {
            percobaan++;
            if (renderAkunBelanja() || percobaan >= 100) {
                clearInterval(timer);
            }
        }, 100);
    });
})();
