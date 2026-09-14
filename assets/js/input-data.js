document.addEventListener("DOMContentLoaded", async function () {
  const ids = ["selectSubOutput","selectKomponen","selectSubKomponen","selectAkun","selectItemAkun","selectDetilAkun","selectRincian"];
  const els = ids.map(id => document.getElementById(id));
  const [so,k,sk,a,ia,da,ri] = els;
  const clean = v => String(v ?? "").trim();
  const EMPTY = "__DATA_APLIKASI_EMPTY__";
  const status = document.getElementById("verifyStatus");
  const msg = document.getElementById("verifyMessage");
  const out = document.getElementById("verifyResult");

  const realisasiFormCard = document.getElementById("realisasiFormCard");
  const realisasiForm = document.getElementById("realisasiForm");
  const inputIndexRecord = document.getElementById("inputIndexRecord");
  const inputBulan = document.getElementById("inputBulan");
  const inputNominal = document.getElementById("inputNominal");
  const inputKeterangan = document.getElementById("inputKeterangan");
  const realisasiFormMessage = document.getElementById("realisasiFormMessage");
  const btnSimpanRealisasi = document.getElementById("btnSimpanRealisasi");
  const inputIdPreview = document.getElementById("inputIdPreview");

  // Gunakan satu sumber konfigurasi untuk endpoint INPUT_REALISASI.
  const INPUT_REALISASI_ENDPOINT = CONFIG.INPUT_REALISASI_URL;

  let rows = [];

  function rawValue(v){ const x=clean(v); return x && x!=="-" ? x : ""; }
  function valueMatches(value, selected){
    if(!selected) return true;
    if(selected===EMPTY) return rawValue(value)==="";
    return rawValue(value)===selected;
  }
  function labelValue(v){ return v===EMPTY ? "— Tidak ada data pada level ini —" : v; }

  function hideRealisasiForm(){
    realisasiFormCard.classList.add("d-none");
    inputIndexRecord.value="";
    inputBulan.value="";
    inputNominal.value="";
    inputKeterangan.value="";
    realisasiFormMessage.textContent="";
    inputIdPreview.value="Dibuat otomatis saat disimpan";
    btnSimpanRealisasi.disabled=true;
  }

  function showRealisasiForm(record){
    inputIndexRecord.value=record.rowIndex ?? "";
    inputBulan.value="";
    inputNominal.value="";
    inputKeterangan.value="";
    inputIdPreview.value="Dibuat otomatis saat disimpan";
    realisasiFormMessage.textContent="Form siap digunakan. Data akan disimpan ke sheet INPUT_REALISASI.";
    btnSimpanRealisasi.disabled=false;
    realisasiFormCard.classList.remove("d-none");
  }

  function opt(el, values, placeholder, enabled){
    const valuesClean=[], seen=new Set();
    let hasEmpty=false;
    values.forEach(v=>{
      const x=rawValue(v);
      if(x){ if(!seen.has(x)){seen.add(x); valuesClean.push(x);} }
      else hasEmpty=true;
    });
    valuesClean.sort((x,y)=>x.localeCompare(y,"id"));
    el.innerHTML='<option value="">'+placeholder+'</option>';
    valuesClean.forEach(v=>el.add(new Option(v,v)));
    if(hasEmpty) el.add(new Option(labelValue(EMPTY),EMPTY));
    el.disabled=!enabled;
  }

  function wait(text){
    hideRealisasiForm();
    status.className="verify-badge";
    status.innerHTML='<i class="bi bi-hourglass-split"></i> Belum diverifikasi';
    msg.textContent=text; out.innerHTML="";
  }

  const placeholders=[
    "Pilih Sub Output","Pilih Komponen","Pilih Sub Komponen",
    "Pilih Akun Belanja","Pilih Item Akun","Pilih Detil Akun","Pilih Rincian Item"
  ];
  function reset(from){
    placeholders.slice(from).forEach((ph,i)=>opt(els[from+i],[],ph,false));
  }

  function inheritHierarchy(parsed){
    const keys=["subOutput","komponen","subKomponen","akun","itemAkun","detilAkun","rincianItem"];
    const context=Object.fromEntries(keys.map(key=>[key,""]));
    return [...parsed]
      .sort((x,y)=>(Number(x.rowIndex)||0)-(Number(y.rowIndex)||0))
      .map(source=>{
        const row={...source};
        keys.forEach((key,index)=>{
          const explicit=rawValue(source[key]);
          if(explicit){
            if(context[key]!==explicit){
              for(let i=index+1;i<keys.length;i++) context[keys[i]]="";
            }
            context[key]=explicit;
          }
          row[key]=explicit||context[key]||"";
        });
        return row;
      });
  }

  function filtered(){
    return rows.filter(r=>
      valueMatches(r.subOutput,so.value) &&
      valueMatches(r.komponen,k.value) &&
      valueMatches(r.subKomponen,sk.value) &&
      valueMatches(r.akun,a.value) &&
      valueMatches(r.itemAkun,ia.value) &&
      valueMatches(r.detilAkun,da.value) &&
      valueMatches(r.rincianItem,ri.value)
    );
  }

  so.onchange=()=>{ reset(2); opt(k,filtered().map(r=>r.komponen),placeholders[1],!!so.value); wait("Pilih Komponen."); };
  k.onchange=()=>{ reset(3); opt(sk,filtered().map(r=>r.subKomponen),placeholders[2],!!k.value); wait("Pilih Sub Komponen."); };
  sk.onchange=()=>{ reset(4); opt(a,filtered().map(r=>r.akun),placeholders[3],!!sk.value); wait("Pilih Akun Belanja."); };
  a.onchange=()=>{ reset(5); opt(ia,filtered().map(r=>r.itemAkun),placeholders[4],!!a.value); wait("Pilih Item Akun."); };
  ia.onchange=()=>{ reset(6); opt(da,filtered().map(r=>r.detilAkun),placeholders[5],!!ia.value); wait("Pilih Detil Akun."); };
  da.onchange=()=>{ ri.value=""; opt(ri,filtered().map(r=>r.rincianItem),placeholders[6],!!da.value); wait("Pilih Rincian Item."); };

  ri.onchange=()=>{
    hideRealisasiForm();
    const found=filtered();
    if(found.length===1){
      const r=found[0];
      const months=Object.values(r.bulanan||{}).reduce((sum,v)=>sum+(Number(v)||0),0);
      const f=new Intl.NumberFormat("id-ID",{style:"currency",currency:"IDR",maximumFractionDigits:0});
      status.className="verify-badge";
      status.innerHTML='<i class="bi bi-check-circle-fill"></i> VALID — 1 record ditemukan';
      msg.textContent="Kombinasi pilihan menunjuk tepat satu record DATA_APLIKASI.";
      const fields=[
        ["Sub Output",rawValue(r.subOutput)||"—"],
        ["Komponen",rawValue(r.komponen)||"—"],
        ["Sub Komponen",rawValue(r.subKomponen)||"—"],
        ["Akun Belanja",rawValue(r.akun)||"—"],
        ["Item Akun",rawValue(r.itemAkun)||"—"],
        ["Detil Akun",rawValue(r.detilAkun)||"—"],
        ["Rincian Item",rawValue(r.rincianItem)||"—"],
        ["Pagu Saat Ini",f.format(r.pagu||0)],
        ["Status Pagu",r.statusPagu],
        ["Realisasi",f.format(months)],
        ["Sisa",f.format((r.pagu||0)-months)],
        ["Index Record",r.rowIndex]
      ];
      out.innerHTML=fields.map(([label,value])=>'<div class="result-item"><div class="result-label">'+label+'</div><div class="result-value">'+String(value??"")+'</div></div>').join("");
      showRealisasiForm(r);
    } else {
      status.className="verify-badge "+(found.length?"warn":"error");
      status.innerHTML='<i class="bi bi-exclamation-triangle-fill"></i> '+found.length+" record ditemukan";
      msg.textContent=found.length?"Kombinasi belum unik.":"Record tidak ditemukan.";
      out.innerHTML="";
    }
  };

  async function bacaInputRealisasiTerbaru(){
    const separator=INPUT_REALISASI_ENDPOINT.includes("?")?"&":"?";
    const url=INPUT_REALISASI_ENDPOINT+separator+"action=list&_="+Date.now();
    const response=await fetch(url,{cache:"no-store"});
    if(!response.ok) throw new Error("Gagal memverifikasi INPUT_REALISASI. HTTP "+response.status);
    const text=await response.text();
    let payload;
    try{ payload=JSON.parse(text); }
    catch(error){ throw new Error("Respons verifikasi INPUT_REALISASI bukan JSON yang valid."); }
    if(!payload||payload.success!==true) throw new Error(payload?.message||"Verifikasi INPUT_REALISASI gagal.");
    return Array.isArray(payload.data)?payload.data:[];
  }

  async function verifikasiTransaksiTersimpan(payload){
    const targetIndex=Number(payload.index_record);
    const targetNominal=Number(payload.nominal_realisasi);
    const targetBulan=clean(payload.bulan);

    for(let attempt=1;attempt<=5;attempt++){
      try{
        const rowsInput=await bacaInputRealisasiTerbaru();
        const found=rowsInput.find(row=>
          Number(row?.index_record)===targetIndex &&
          clean(row?.bulan)===targetBulan &&
          Number(row?.nominal_realisasi)===targetNominal
        );
        if(found) return found;
      }catch(error){
        if(attempt===5) throw error;
        console.warn("Verifikasi transaksi percobaan "+attempt+" gagal:",error);
      }
      await new Promise(resolve=>setTimeout(resolve,800));
    }
    return null;
  }

  realisasiForm.addEventListener("submit", async event=>{
    event.preventDefault();

    const indexRecord=Number(inputIndexRecord.value);
    const bulan=clean(inputBulan.value);
    const nominalRealisasi=Number(inputNominal.value);
    const keterangan=clean(inputKeterangan.value);

    if(!indexRecord){
      realisasiFormMessage.className="small mt-3 text-danger";
      realisasiFormMessage.textContent="INDEX_RECORD tidak valid. Pilih kembali record yang akan direalisasikan.";
      return;
    }
    if(!bulan){
      realisasiFormMessage.className="small mt-3 text-danger";
      realisasiFormMessage.textContent="Pilih bulan realisasi terlebih dahulu.";
      inputBulan.focus();
      return;
    }
    if(!Number.isFinite(nominalRealisasi)||nominalRealisasi<=0){
      realisasiFormMessage.className="small mt-3 text-danger";
      realisasiFormMessage.textContent="Nominal realisasi harus berupa angka lebih dari 0.";
      inputNominal.focus();
      return;
    }

    const payload={
      index_record:indexRecord,
      bulan:bulan,
      nominal_realisasi:nominalRealisasi,
      keterangan:keterangan
    };

    const originalHtml=btnSimpanRealisasi.innerHTML;
    btnSimpanRealisasi.disabled=true;
    btnSimpanRealisasi.innerHTML='<span class="spinner-border spinner-border-sm me-1"></span>Menyimpan...';
    realisasiFormMessage.className="small mt-3 text-muted";
    realisasiFormMessage.textContent="Mengirim transaksi ke INPUT_REALISASI...";

    try{
      // Apps Script saat ini tidak memberikan header CORS untuk membaca respons
      // POST dari GitHub Pages. Gunakan simple POST no-cors agar request tetap
      // terkirim. Responsnya opaque, jadi keberhasilan tidak pernah diasumsikan.
      await fetch(INPUT_REALISASI_ENDPOINT,{
        method:"POST",
        mode:"no-cors",
        headers:{"Content-Type":"text/plain;charset=utf-8"},
        body:JSON.stringify(payload)
      });

      realisasiFormMessage.textContent="Transaksi terkirim. Memverifikasi data pada INPUT_REALISASI...";
      const saved=await verifikasiTransaksiTersimpan(payload);

      if(!saved){
        throw new Error("Transaksi belum dapat diverifikasi pada INPUT_REALISASI. Data tidak dinyatakan berhasil tersimpan.");
      }

      inputIdPreview.value=saved?.id_input||"Berhasil disimpan";
      inputNominal.value="";
      inputKeterangan.value="";
      inputBulan.value="";
      realisasiFormMessage.className="small mt-3 text-success";
      realisasiFormMessage.innerHTML='<i class="bi bi-check-circle-fill me-1"></i>Realisasi berhasil disimpan dan sudah diverifikasi pada INPUT_REALISASI.';

      // Data INPUT_REALISASI berubah; request berikutnya harus mengambil data terbaru.
      if(typeof invalidateApiCache === "function"){
        invalidateApiCache();
      }
    }catch(error){
      console.error("Gagal menyimpan INPUT_REALISASI:",error);
      realisasiFormMessage.className="small mt-3 text-danger";
      realisasiFormMessage.innerHTML='<i class="bi bi-x-circle-fill me-1"></i>'+String(error.message||"Gagal menyimpan realisasi.");
    }finally{
      btnSimpanRealisasi.disabled=false;
      btnSimpanRealisasi.innerHTML=originalHtml;
    }
  });

  try{
    const raw=await fetchSheetData();
    const parsed=parseDataAplikasi(raw);
    if(!Array.isArray(parsed)||!parsed.length) throw new Error("DATA_APLIKASI kosong.");
    rows=inheritHierarchy(parsed).filter(r=>
      rawValue(r.subOutput)||rawValue(r.komponen)||rawValue(r.subKomponen)||
      rawValue(r.akun)||rawValue(r.itemAkun)||rawValue(r.detilAkun)||rawValue(r.rincianItem)
    );
    if(!rows.length) throw new Error("Tidak ada record DATA_APLIKASI yang memiliki data hierarki.");
    console.table({
      "Total record":rows.length,
      "Sub Output":new Set(rows.map(r=>rawValue(r.subOutput)).filter(Boolean)).size,
      "Komponen":new Set(rows.map(r=>rawValue(r.komponen)).filter(Boolean)).size,
      "Sub Komponen":new Set(rows.map(r=>rawValue(r.subKomponen)).filter(Boolean)).size,
      "Akun Belanja":new Set(rows.map(r=>rawValue(r.akun)).filter(Boolean)).size,
      "Item Akun":new Set(rows.map(r=>rawValue(r.itemAkun)).filter(Boolean)).size,
      "Detil Akun":new Set(rows.map(r=>rawValue(r.detilAkun)).filter(Boolean)).size,
      "Rincian Item":new Set(rows.map(r=>rawValue(r.rincianItem)).filter(Boolean)).size
    });
    opt(so,rows.map(r=>r.subOutput),placeholders[0],true);
    wait("Pilih Sub Output untuk memulai verifikasi.");
  }catch(e){
    console.error(e);
    hideRealisasiForm();
    status.className="verify-badge error";
    status.innerHTML='<i class="bi bi-x-circle-fill"></i> GAGAL MEMUAT DATA';
    msg.textContent=e.message||"Tidak dapat membaca DATA_APLIKASI.";
  }
});