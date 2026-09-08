document.addEventListener("DOMContentLoaded", async function(){
const els=["selectSubOutput","selectKomponen","selectSubKomponen","selectAkun","selectItemAkun","selectRincian"].map(id=>document.getElementById(id));
const [so,k,sk,a,ia,ri]=els, clean=v=>String(v??"").trim(), status=document.getElementById("verifyStatus"), msg=document.getElementById("verifyMessage"), out=document.getElementById("verifyResult");
let rows=[];
function opt(el,vals,ph,on){el.innerHTML='<option value="">'+ph+'</option>';[...new Set(vals.filter(v=>clean(v)&&clean(v)!="-"))].sort().forEach(v=>el.add(new Option(clean(v),clean(v))));el.disabled=!on}
function wait(t){status.className="verify-badge";status.innerHTML='<i class="bi bi-hourglass-split"></i> Belum diverifikasi';msg.textContent=t;out.innerHTML=""}
function reset(n){["Pilih Sub Output","Pilih Komponen","Pilih Sub Komponen","Pilih Akun Belanja","Pilih Item Akun","Pilih Rincian Item"].slice(n).forEach((p,i)=>opt(els[n+i],[],p,false))}
function filtered(){return rows.filter(r=>(!so.value||clean(r.subOutput)==so.value)&&(!k.value||clean(r.komponen)==k.value)&&(!sk.value||clean(r.subKomponen)==sk.value)&&(!a.value||clean(r.akun)==a.value)&&(!ia.value||clean(r.itemAkun)==ia.value))}
so.onchange=()=>{reset(2);opt(k,filtered().map(r=>r.komponen),"Pilih Komponen",!!so.value);wait("Pilih Komponen.")};
k.onchange=()=>{reset(3);opt(sk,filtered().map(r=>r.subKomponen),"Pilih Sub Komponen",!!k.value);wait("Pilih Sub Komponen.")};
sk.onchange=()=>{reset(4);opt(a,filtered().map(r=>r.akun),"Pilih Akun Belanja",!!sk.value);wait("Pilih Akun Belanja.")};
a.onchange=()=>{reset(5);opt(ia,filtered().map(r=>r.itemAkun),"Pilih Item Akun",!!a.value);wait("Pilih Item Akun.")};
ia.onchange=()=>{opt(ri,filtered().map(r=>r.rincianItem),"Pilih Rincian Item",!!ia.value);wait("Pilih Rincian Item.")};
ri.onchange=()=>{const x=filtered().filter(r=>clean(r.rincianItem)==ri.value);if(x.length===1){const r=x[0], months=Object.values(r.bulanan||{}).reduce((s,v)=>s+(Number(v)||0),0), f=new Intl.NumberFormat("id-ID",{style:"currency",currency:"IDR",maximumFractionDigits:0});status.className="verify-badge";status.innerHTML='<i class="bi bi-check-circle-fill"></i> VALID — 1 record ditemukan';msg.textContent="Kombinasi pilihan menunjuk tepat satu record DATA_APLIKASI.";const fields=[["Sub Output",r.subOutput],["Komponen",r.komponen],["Sub Komponen",r.subKomponen],["Akun Belanja",r.akun],["Item Akun",r.itemAkun],["Rincian Item",r.rincianItem],["Pagu Saat Ini",f.format(r.pagu||0)],["Status Pagu",r.statusPagu],["Realisasi",f.format(months)],["Sisa",f.format((r.pagu||0)-months)],["Index Record",r.rowIndex]];out.innerHTML=fields.map(z=>'<div class="result-item"><div class="result-label">'+z[0]+'</div><div class="result-value">'+String(z[1]??"")+'</div></div>').join("")}else{status.className="verify-badge "+(x.length?"warn":"error");status.innerHTML='<i class="bi bi-exclamation-triangle-fill"></i> '+x.length+" record ditemukan";msg.textContent=x.length?"Kombinasi belum unik.":"Record tidak ditemukan.";out.innerHTML=""}};
try{
const raw=await fetchSheetData();
const parsed=parseDataAplikasi(raw);
if(!Array.isArray(parsed)||!parsed.length)throw new Error("DATA_APLIKASI kosong.");
rows=parsed.filter(r=>r.isRincian);
opt(so,rows.map(r=>r.subOutput),"Pilih Sub Output",true);
wait("Pilih Sub Output untuk memulai verifikasi.");
}catch(e){console.error(e);status.className="verify-badge error";status.innerHTML='<i class="bi bi-x-circle-fill"></i> GAGAL MEMUAT DATA';msg.textContent=e.message||"Tidak dapat membaca DATA_APLIKASI."}
});