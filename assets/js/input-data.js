document.addEventListener("DOMContentLoaded", async function () {
  const els = [
    "selectSubOutput",
    "selectKomponen",
    "selectSubKomponen",
    "selectAkun",
    "selectItemAkun",
    "selectRincian"
  ].map(id => document.getElementById(id));

  const [so, k, sk, a, ia, ri] = els;
  const clean = v => String(v ?? "").trim();
  const EMPTY = "__DATA_APLIKASI_EMPTY__";

  const status = document.getElementById("verifyStatus");
  const msg = document.getElementById("verifyMessage");
  const out = document.getElementById("verifyResult");

  let rows = [];

  function rawValue(v) {
    const x = clean(v);
    return x && x !== "-" ? x : "";
  }

  function valueMatches(value, selected) {
    if (!selected) return true;
    if (selected === EMPTY) return rawValue(value) === "";
    return rawValue(value) === selected;
  }

  function labelValue(value) {
    return value === EMPTY ? "— Tidak ada data pada level ini —" : value;
  }

  function opt(el, values, placeholder, enabled) {
    const normalized = [];
    let hasEmpty = false;

    values.forEach(v => {
      const x = rawValue(v);
      if (x) normalized.push(x);
      else hasEmpty = true;
    });

    const unique = [...new Set(normalized)]
      .sort((x, y) => x.localeCompare(y, "id"));

    // Jika pada cabang DATA_APLIKASI memang ada level yang kosong,
    // tampilkan sebagai pilihan eksplisit. Dengan demikian record
    // Belanja Bahan/akun lain tidak hilang hanya karena level berikutnya kosong.
    if (hasEmpty) unique.push(EMPTY);

    el.innerHTML = '<option value="">'+placeholder+'</option>';
    unique.forEach(v => el.add(new Option(labelValue(v), v)));
    el.disabled = !enabled;
  }

  function wait(text) {
    status.className = "verify-badge";
    status.innerHTML = '<i class="bi bi-hourglass-split"></i> Belum diverifikasi';
    msg.textContent = text;
    out.innerHTML = "";
  }

  function reset(from) {
    [
      "Pilih Sub Output",
      "Pilih Komponen",
      "Pilih Sub Komponen",
      "Pilih Akun Belanja",
      "Pilih Item Akun",
      "Pilih Rincian Item"
    ].slice(from).forEach((placeholder, index) => {
      opt(els[from + index], [], placeholder, false);
    });
  }

  // DATA_APLIKASI dapat berasal dari Sheet yang menggunakan merge cell
  // atau nilai parent hanya ditulis pada baris pertama. CSV kemudian
  // menghasilkan sel kosong pada baris-baris berikutnya. Untuk Input Data,
  // parent harus diteruskan ke child agar seluruh cabang dropdown tetap utuh.
  function inheritHierarchy(parsed) {
    const keys = [
      "subOutput",
      "komponen",
      "subKomponen",
      "akun",
      "itemAkun",
      "rincianItem"
    ];

    const context = Object.fromEntries(keys.map(key => [key, ""]));

    return [...parsed]
      .sort((x, y) => (Number(x.rowIndex) || 0) - (Number(y.rowIndex) || 0))
      .map(source => {
        const row = { ...source };

        keys.forEach((key, index) => {
          const explicit = rawValue(source[key]);

          if (explicit) {
            // Parent berubah: konteks level di bawahnya harus dimulai ulang.
            if (context[key] !== explicit) {
              for (let i = index + 1; i < keys.length; i++) {
                context[keys[i]] = "";
              }
            }
            context[key] = explicit;
          }

          row[key] = explicit || context[key] || "";
        });

        return row;
      });
  }

  function filtered() {
    return rows.filter(r =>
      valueMatches(r.subOutput, so.value) &&
      valueMatches(r.komponen, k.value) &&
      valueMatches(r.subKomponen, sk.value) &&
      valueMatches(r.akun, a.value) &&
      valueMatches(r.itemAkun, ia.value) &&
      valueMatches(r.rincianItem, ri.value)
    );
  }

  so.onchange = () => {
    reset(2);
    opt(k, filtered().map(r => r.komponen), "Pilih Komponen", !!so.value);
    wait("Pilih Komponen.");
  };

  k.onchange = () => {
    reset(3);
    opt(sk, filtered().map(r => r.subKomponen), "Pilih Sub Komponen", !!k.value);
    wait("Pilih Sub Komponen.");
  };

  sk.onchange = () => {
    reset(4);
    opt(a, filtered().map(r => r.akun), "Pilih Akun Belanja", !!sk.value);
    wait("Pilih Akun Belanja.");
  };

  a.onchange = () => {
    reset(5);
    opt(ia, filtered().map(r => r.itemAkun), "Pilih Item Akun", !!a.value);
    wait("Pilih Item Akun.");
  };

  ia.onchange = () => {
    ri.value = "";
    opt(ri, filtered().map(r => r.rincianItem), "Pilih Rincian Item", !!ia.value);
    wait("Pilih Rincian Item.");
  };

  ri.onchange = () => {
    const found = filtered();

    if (found.length === 1) {
      const r = found[0];
      const months = Object.values(r.bulanan || {})
        .reduce((sum, value) => sum + (Number(value) || 0), 0);

      const f = new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        maximumFractionDigits: 0
      });

      status.className = "verify-badge";
      status.innerHTML = '<i class="bi bi-check-circle-fill"></i> VALID — 1 record ditemukan';
      msg.textContent = "Kombinasi pilihan menunjuk tepat satu record DATA_APLIKASI.";

      const fields = [
        ["Sub Output", rawValue(r.subOutput) || "—"],
        ["Komponen", rawValue(r.komponen) || "—"],
        ["Sub Komponen", rawValue(r.subKomponen) || "—"],
        ["Akun Belanja", rawValue(r.akun) || "—"],
        ["Item Akun", rawValue(r.itemAkun) || "—"],
        ["Rincian Item", rawValue(r.rincianItem) || "—"],
        ["Pagu Saat Ini", f.format(r.pagu || 0)],
        ["Status Pagu", r.statusPagu],
        ["Realisasi", f.format(months)],
        ["Sisa", f.format((r.pagu || 0) - months)],
        ["Index Record", r.rowIndex]
      ];

      out.innerHTML = fields.map(([label, value]) =>
        '<div class="result-item"><div class="result-label">' + label +
        '</div><div class="result-value">' + String(value ?? "") +
        '</div></div>'
      ).join("");
    } else {
      status.className = "verify-badge " + (found.length ? "warn" : "error");
      status.innerHTML = '<i class="bi bi-exclamation-triangle-fill"></i> ' +
        found.length + " record ditemukan";
      msg.textContent = found.length
        ? "Kombinasi belum unik."
        : "Record tidak ditemukan.";
      out.innerHTML = "";
    }
  };

  try {
    const raw = await fetchSheetData();
    const parsed = parseDataAplikasi(raw);

    if (!Array.isArray(parsed) || !parsed.length) {
      throw new Error("DATA_APLIKASI kosong.");
    }

    rows = inheritHierarchy(parsed).filter(r =>
      rawValue(r.subOutput) ||
      rawValue(r.komponen) ||
      rawValue(r.subKomponen) ||
      rawValue(r.akun) ||
      rawValue(r.itemAkun) ||
      rawValue(r.rincianItem)
    );

    if (!rows.length) {
      throw new Error("Tidak ada record DATA_APLIKASI yang memiliki data hierarki.");
    }

    console.table({
      "Total record": rows.length,
      "Sub Output": new Set(rows.map(r => rawValue(r.subOutput)).filter(Boolean)).size,
      "Komponen": new Set(rows.map(r => rawValue(r.komponen)).filter(Boolean)).size,
      "Sub Komponen": new Set(rows.map(r => rawValue(r.subKomponen)).filter(Boolean)).size,
      "Akun Belanja": new Set(rows.map(r => rawValue(r.akun)).filter(Boolean)).size,
      "Item Akun": new Set(rows.map(r => rawValue(r.itemAkun)).filter(Boolean)).size,
      "Rincian Item": new Set(rows.map(r => rawValue(r.rincianItem)).filter(Boolean)).size
    });

    opt(so, rows.map(r => r.subOutput), "Pilih Sub Output", true);
    wait("Pilih Sub Output untuk memulai verifikasi.");
  } catch (e) {
    console.error(e);
    status.className = "verify-badge error";
    status.innerHTML = '<i class="bi bi-x-circle-fill"></i> GAGAL MEMUAT DATA';
    msg.textContent = e.message || "Tidak dapat membaca DATA_APLIKASI.";
  }
});