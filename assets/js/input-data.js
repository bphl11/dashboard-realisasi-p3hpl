document.addEventListener("DOMContentLoaded", async function () {
  const ids = ["selectSubOutput","selectKomponen","selectSubKomponen","selectAkun","selectItemAkun","selectDetilAkun","selectRincian"];
  const els = ids.map(id => document.getElementById(id));
  const [so,k,sk,a,ia,da,ri] = els;
  const clean = v => String(v ?? "").trim();
  const EMPTY = "__DATA_APLIKASI_EMPTY__";
  const status = document.getElementById("verifyStatus");
  const msg = document.getElementById("verifyMessage");
  const out = document.getElementById("verifyResult");
  let rows = [];

  function rawValue(v){ const x=clean(v); return x && x!=="-" ? x : ""; }
  function valueMatches(value, selected){
    if(!selected) return true;
    if(selected===EMPTY) return rawValue(value)==="";
    return rawValue(value)===selected;
  }
  function labelValue(v){ return v===EMPTY ? "— Tidak ada data pada level ini —" : v; }

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
    } else {
      status.className="verify-badge "+(found.length?"warn":"error");
      status.innerHTML='<i class="bi bi-exclamation-triangle-fill"></i> '+found.length+" record ditemukan";
      msg.textContent=found.length?"Kombinasi belum unik.":"Record tidak ditemukan.";
      out.innerHTML="";
    }
  };

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
    status.className="verify-badge error";
    status.innerHTML='<i class="bi bi-x-circle-fill"></i> GAGAL MEMUAT DATA';
    msg.textContent=e.message||"Tidak dapat membaca DATA_APLIKASI.";
  }
});