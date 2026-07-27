// ============================================================
// AUDIT-UI.JS
// Dashboard Audit Parser V3
// ============================================================

"use strict";

// ============================================================
// GLOBAL
// ============================================================

let auditData = [];
let auditFilter = "Semua";

// ============================================================
// TAMPILKAN AUDIT
// ============================================================

function tampilkanAudit(data) {

    if (!Array.isArray(data)) {

        console.error("Audit UI : data bukan array");

        return;

    }

    auditData = data;

    tampilSummary();

    tampilFilter();

    tampilTable();

}

// ============================================================
// SUMMARY
// ============================================================

function tampilSummary() {

    const totalExcel =
        auditData.reduce(
            (a, b) => a + (b.paguExcel || 0),
            0
        );

    const totalParser =
        auditData.reduce(
            (a, b) => a + (b.paguParser || 0),
            0
        );

    const totalDouble =
        auditData.filter(i => i.doubleCount).length;

    const totalStatus =
        auditData.filter(i => i.salahStatus).length;

    const totalTidak =
        auditData.filter(i => !i.terbaca).length;

    const totalPagu =
        auditData.filter(i => i.bedaPagu).length;

    document.getElementById("summary").innerHTML = `

<div class="audit-summary">

<div class="card">

<h4>Total Excel</h4>

<h2>${formatRupiah(totalExcel)}</h2>

</div>

<div class="card">

<h4>Total Parser</h4>

<h2>${formatRupiah(totalParser)}</h2>

</div>

<div class="card">

<h4>Selisih</h4>

<h2>${formatRupiah(totalParser-totalExcel)}</h2>

</div>

<div class="card merah">

<h4>Double Count</h4>

<h2>${totalDouble}</h2>

</div>

<div class="card kuning">

<h4>Status</h4>

<h2>${totalStatus}</h2>

</div>

<div class="card merah">

<h4>Tidak Terbaca</h4>

<h2>${totalTidak}</h2>

</div>

<div class="card orange">

<h4>Pagu Berbeda</h4>

<h2>${totalPagu}</h2>

</div>

</div>

`;

}

// ============================================================
// FILTER
// ============================================================

function tampilFilter() {

document.getElementById("filterArea").innerHTML=`

<select id="auditFilter">

<option>Semua</option>

<option>Double Count</option>

<option>Tidak Terbaca</option>

<option>Status Berubah</option>

<option>Pagu Berbeda</option>

</select>

<input

type="text"

id="auditCari"

placeholder="Cari Item..."

>

`;

document
.getElementById("auditFilter")
.onchange=function(){

auditFilter=this.value;

tampilTable();

};

document
.getElementById("auditCari")
.onkeyup=function(){

tampilTable();

};

}

// ============================================================
// FILTER DATA
// ============================================================

function dataFilter(){

let hasil=[...auditData];

const cari=document
.getElementById("auditCari")
.value
.toLowerCase();

if(cari){

hasil=hasil.filter(

i=>

(i.uraian||"")

.toLowerCase()

.includes(cari)

);

}

switch(auditFilter){

case"Double Count":

hasil=hasil.filter(

i=>i.doubleCount

);

break;

case"Tidak Terbaca":

hasil=hasil.filter(

i=>!i.terbaca

);

break;

case"Status Berubah":

hasil=hasil.filter(

i=>i.salahStatus

);

break;

case"Pagu Berbeda":

hasil=hasil.filter(

i=>i.bedaPagu

);

break;

}

return hasil;

}

// ============================================================
// TABEL
// ============================================================

function tampilTable(){

const data=dataFilter();

let html="";

html+=`

<table class="audit-table">

<thead>

<tr>

<th>No</th>

<th>Row</th>

<th>Item</th>

<th>Status Excel</th>

<th>Status Parser</th>

<th>Pagu Excel</th>

<th>Pagu Parser</th>

<th>Count</th>

<th>Error</th>

</tr>

</thead>

<tbody>

`;

let no=1;

data.forEach(item=>{

let warna="";

let error="🟢 OK";

if(item.doubleCount){

warna="table-danger";

error="🔴 Double Count";

}

else if(!item.terbaca){

warna="table-danger";

error="🔴 Tidak Terbaca";

}

else if(item.bedaPagu){

warna="table-warning";

error="🟠 Pagu Berbeda";

}

else if(item.salahStatus){

warna="table-info";

error="🟡 Status";

}

html+=`

<tr

class="${warna}"

onclick="detailAudit(${item.rowIndex})"

>

<td>${no++}</td>

<td>${item.rowIndex}</td>

<td>${item.uraian}</td>

<td>${item.statusExcel}</td>

<td>${item.statusParser}</td>

<td>${formatRupiah(item.paguExcel)}</td>

<td>${formatRupiah(item.paguParser)}</td>

<td>${item.count}</td>

<td>${error}</td>

</tr>

`;

});

html+=`

</tbody>

</table>

`;

document
.getElementById("auditTable")
.innerHTML=html;

}

// ============================================================
// DETAIL
// ============================================================

function detailAudit(row){

const item=

auditData.find(

i=>i.rowIndex===row

);

if(!item){

return;

}

console.clear();

console.log("================================");

console.log("DETAIL AUDIT");

console.log("================================");

console.table(item);

console.log("================================");

alert(

"Row Excel : "+row+

"\n\n"

+"Lihat Console (F12)"

);

}
