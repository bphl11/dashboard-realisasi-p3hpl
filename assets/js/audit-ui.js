// ============================================================
// AUDIT UI V4
// Dashboard Audit Monitoring
// ============================================================

"use strict";

// ============================================================
// GLOBAL
// ============================================================

let auditData = [];

let auditView = [];

let auditFilter = "Semua";

let auditKeyword = "";

// ============================================================
// TAMPILKAN AUDIT
// ============================================================

function tampilkanAudit(data){

    if(!Array.isArray(data)){

        console.error("Audit UI : Data bukan array");

        return;

    }

   auditData=data;

auditView=[...data];

tampilSummary();

tampilFilter();

tampilChart();

tampilTable();
}
// ============================================================
// SUMMARY
// ============================================================

function tampilSummary(){

    let totalExcel = 0;

    let totalParser = 0;

    let critical = 0;

    let major = 0;

    let warning = 0;

    let info = 0;

    let ok = 0;

    auditData.forEach(function(item){

        totalExcel += Number(item.paguExcel) || 0;

        totalParser += Number(item.paguParser) || 0;

        switch(item.severity){

            case "CRITICAL":
                critical++;
                break;

            case "MAJOR":
                major++;
                break;

            case "WARNING":
                warning++;
                break;

            case "INFO":
                info++;
                break;

            default:
                ok++;
                break;

        }

    });

    const selisih = totalParser - totalExcel;

    let html = "";

    html += "<div class='audit-summary'>";

    html += "<table class='summary-table'>";

    html += "<tr><td>Total Excel</td><td>" + formatRupiah(totalExcel) + "</td></tr>";

    html += "<tr><td>Total Parser</td><td>" + formatRupiah(totalParser) + "</td></tr>";

    html += "<tr><td>Selisih</td><td>" + formatRupiah(selisih) + "</td></tr>";

    html += "<tr><td>CRITICAL</td><td>" + critical + "</td></tr>";

    html += "<tr><td>MAJOR</td><td>" + major + "</td></tr>";

    html += "<tr><td>WARNING</td><td>" + warning + "</td></tr>";

    html += "<tr><td>INFO</td><td>" + info + "</td></tr>";

    html += "<tr><td>OK</td><td>" + ok + "</td></tr>";

    html += "</table>";

    html += "</div>";

    document.getElementById("summary").innerHTML = html;

}
// ============================================================
// FILTER
// ============================================================

function tampilFilter(){

    let html = "";

    html += "<div class='audit-filter'>";

    // ============================================
    // FILTER SEVERITY
    // ============================================

    html += "<label>Severity</label>";

    html += "<select id='filterSeverity'>";

    html += "<option value='Semua'>Semua</option>";

    html += "<option value='CRITICAL'>CRITICAL</option>";

    html += "<option value='MAJOR'>MAJOR</option>";

    html += "<option value='WARNING'>WARNING</option>";

    html += "<option value='INFO'>INFO</option>";

    html += "<option value='OK'>OK</option>";

    html += "</select>";

    // ============================================
    // FILTER ERROR
    // ============================================

    html += "<label>Error</label>";

    html += "<select id='filterError'>";

    html += "<option value='Semua'>Semua</option>";

    html += "<option value='Double Count'>Double Count</option>";

    html += "<option value='Duplicate AuditID'>Duplicate AuditID</option>";

    html += "<option value='Parent + Rincian'>Parent + Rincian</option>";

    html += "<option value='Status Berubah'>Status Berubah</option>";

    html += "<option value='Pagu Berbeda'>Pagu Berbeda</option>";

    html += "<option value='Output Kosong'>Output Kosong</option>";

    html += "<option value='Komponen Kosong'>Komponen Kosong</option>";

    html += "<option value='Sub Komponen Kosong'>Sub Komponen Kosong</option>";

    html += "<option value='Akun Kosong'>Akun Kosong</option>";

    html += "</select>";

    // ============================================
    // SEARCH
    // ============================================

   html += "<label>Cari</label>";

html += "<input";
html += " type='text'";
html += " id='filterKeyword'";
html += " placeholder='Cari uraian...'";
html += ">";

html += "<button onclick='exportCSV()'>CSV</button>";
html += "<button onclick='exportJSON()'>JSON</button>";
html += "<button onclick='printAudit()'>Print</button>";

html += "</div>";

    document.getElementById("filterArea").innerHTML = html;

    // ============================================
    // EVENT
    // ============================================

    document.getElementById("filterSeverity").onchange = function(){

        auditFilter = this.value;

        dataFilter();

    };

    document.getElementById("filterError").onchange = function(){

        dataFilter();

    };

    document.getElementById("filterKeyword").onkeyup = function(){

        auditKeyword = this.value;

        dataFilter();

    };

}
// ============================================================
// FILTER DATA
// ============================================================

function dataFilter(){

    const severity =
        document.getElementById("filterSeverity").value;

    const error =
        document.getElementById("filterError").value;

    const keyword =
        document.getElementById("filterKeyword")
            .value
            .trim()
            .toLowerCase();

    auditView = auditData.filter(function(item){

        // ============================================
        // FILTER SEVERITY
        // ============================================

        if(

            severity !== "Semua" &&

            item.severity !== severity

        ){

            return false;

        }

        // ============================================
        // FILTER ERROR
        // ============================================

        if(

            error !== "Semua"

        ){

            if(

                !item.errorList ||

                !item.errorList.includes(error)

            ){

                return false;

            }

        }

        // ============================================
        // FILTER KEYWORD
        // ============================================

        if(keyword){

            const text = (

                item.uraian ||

                ""

            ).toLowerCase();

            if(

                !text.includes(keyword)

            ){

                return false;

            }

        }

        return true;

    });

    tampilTable();

}
// ============================================================
// TAMPILKAN TABEL AUDIT
// ============================================================

function tampilTable(){

    let html = "";

    html += "<table class='audit-table'>";

    html += "<thead>";

    html += "<tr>";

    html += "<th>No</th>";

    html += "<th>Row</th>";

    html += "<th>Severity</th>";

    html += "<th>Uraian</th>";

    html += "<th>Status Excel</th>";

    html += "<th>Status Parser</th>";

    html += "<th>Pagu Excel</th>";

    html += "<th>Pagu Parser</th>";

    html += "<th>Selisih</th>";

    html += "<th>Error</th>";

    html += "</tr>";

    html += "</thead>";

    html += "<tbody>";

    auditView.forEach(function(item,index){

        let warna = "";

        switch(item.severity){

            case "CRITICAL":

                warna = "table-danger";

                break;

            case "MAJOR":

                warna = "table-warning";

                break;

            case "WARNING":

                warna = "table-info";

                break;

            case "INFO":

                warna = "table-secondary";

                break;

            default:

                warna = "";

        }

        html += "<tr";

        html += " class='" + warna + "'";

        html += " onclick='detailAudit(" + item.rowIndex + ")'>";

        html += "<td>" + (index+1) + "</td>";

        html += "<td>" + item.rowIndex + "</td>";

        html += "<td>" + item.severity + "</td>";

        html += "<td>" + (item.uraian || "-") + "</td>";

        html += "<td>" + item.statusExcel + "</td>";

        html += "<td>" + item.statusParser + "</td>";

        html += "<td>" + formatRupiah(item.paguExcel) + "</td>";

        html += "<td>" + formatRupiah(item.paguParser) + "</td>";

        html += "<td>" + formatRupiah(item.selisihPagu || 0) + "</td>";

        html += "<td>";

        if(item.errorList.length){

            html += item.errorList.join("<br>");

        }else{

            html += "-";

        }

        html += "</td>";

        html += "</tr>";

    });

    html += "</tbody>";

    html += "</table>";

    document.getElementById("auditTable").innerHTML = html;

}
// ============================================================
// DETAIL AUDIT
// ============================================================

function detailAudit(rowIndex){

    const item = auditData.find(function(i){

        return i.rowIndex === rowIndex;

    });

    if(!item){

        alert("Data tidak ditemukan.");

        return;

    }

    let pesan = "";

    pesan += "========== DETAIL AUDIT ==========\n\n";

    pesan += "Row Excel : " + item.rowIndex + "\n";

    pesan += "Audit ID : " + item.auditId + "\n\n";

    pesan += "Uraian :\n";

    pesan += item.uraian + "\n\n";

    pesan += "Severity : " + item.severity + "\n\n";

    pesan += "Status Excel : ";

    pesan += item.statusExcel + "\n";

    pesan += "Status Parser : ";

    pesan += item.statusParser + "\n\n";

    pesan += "Pagu Excel : ";

    pesan += formatRupiah(item.paguExcel) + "\n";

    pesan += "Pagu Parser : ";

    pesan += formatRupiah(item.paguParser) + "\n";

    pesan += "Selisih : ";

    pesan += formatRupiah(item.selisihPagu || 0) + "\n\n";

    pesan += "Jumlah Parser Rows : ";

    pesan += item.parserRows.length + "\n\n";

    pesan += "ERROR :\n";

    if(item.errorList.length){

        item.errorList.forEach(function(err){

            pesan += "• " + err + "\n";

        });

    }else{

        pesan += "Tidak ada error.\n";

    }

    console.clear();

    console.log("====================================");

    console.log("DETAIL AUDIT");

    console.log("====================================");

    console.table(item);

    console.log("Parser Rows");

    console.table(item.parserRows);

alert(pesan);

tampilTraceViewer(rowIndex);

}
// ============================================================
// TRACE VIEWER
// ============================================================

function tampilTraceViewer(rowIndex){

    if(typeof getTrace !== "function"){

        console.warn("audit-trace.js belum dimuat.");

        return;

    }

    const trace = getTrace(rowIndex);

    if(!trace){

        alert("Trace tidak ditemukan.");

        return;

    }

    console.clear();

    console.log("====================================");

    console.log("TRACE VIEWER");

    console.log("====================================");

    console.log("Row :", rowIndex);

    console.table(trace.langkah);

    if(trace.error.length){

        console.log("====================================");

        console.log("ERROR");

        console.table(trace.error);

    }

    let pesan="";

    pesan+="========== TRACE ==========\n\n";

    pesan+="Row : "+rowIndex+"\n\n";

    trace.langkah.forEach(function(step,index){

        pesan+=(index+1)+". "+step.nama+"\n";

    });

    if(trace.error.length){

        pesan+="\nERROR\n";

        trace.error.forEach(function(err){

            pesan+="• "+err+"\n";

        });

    }

alert(pesan);

}
// ============================================================
// EXPORT CSV
// ============================================================

function exportCSV(){

    if(!auditView.length){

        alert("Tidak ada data.");

        return;

    }

    let csv="";

    csv+="Row,Uraian,Severity,Status Excel,Status Parser,";

    csv+="Pagu Excel,Pagu Parser,Selisih,Error\n";

    auditView.forEach(function(item){

        csv+=item.rowIndex+",";

        csv+="\""+(item.uraian||"")+"\",";
        csv+=item.severity+",";
        csv+=item.statusExcel+",";
        csv+=item.statusParser+",";
        csv+=item.paguExcel+",";
        csv+=item.paguParser+",";
        csv+=item.selisihPagu+",";

        csv+="\""+item.errorList.join(" | ")+"\"";

        csv+="\n";

    });

    const blob=new Blob(

        [csv],

        {

            type:"text/csv;charset=utf-8;"

        }

    );

    const url=

        URL.createObjectURL(blob);

    const a=

        document.createElement("a");

    a.href=url;

    a.download="AuditParser.csv";

    a.click();

    URL.revokeObjectURL(url);

}
// ============================================================
// EXPORT JSON
// ============================================================

function exportJSON(){

    const json=

        JSON.stringify(

            auditView,

            null,

            2

        );

    const blob=

        new Blob(

            [json],

            {

                type:"application/json"

            }

        );

    const url=

        URL.createObjectURL(blob);

    const a=

        document.createElement("a");

    a.href=url;

    a.download="AuditParser.json";

    a.click();

    URL.revokeObjectURL(url);

}
// ============================================================
// PRINT
// ============================================================

function printAudit(){

    window.print();

}
// ============================================================
// DASHBOARD CHART
// ============================================================

function tampilChart(){

    let critical=0;
    let major=0;
    let warning=0;
    let info=0;
    let ok=0;

    auditData.forEach(function(item){

        switch(item.severity){

            case "CRITICAL":
                critical++;
                break;

            case "MAJOR":
                major++;
                break;

            case "WARNING":
                warning++;
                break;

            case "INFO":
                info++;
                break;

            default:
                ok++;
        }

    });

    let html="";

    html+="<table class='chart-table'>";

    html+="<tr>";
    html+="<th>Severity</th>";
    html+="<th>Jumlah</th>";
    html+="<th>Grafik</th>";
    html+="</tr>";

    html+=buatBarisChart("CRITICAL",critical,"#d9534f");
    html+=buatBarisChart("MAJOR",major,"#f0ad4e");
    html+=buatBarisChart("WARNING",warning,"#5bc0de");
    html+=buatBarisChart("INFO",info,"#777777");
    html+=buatBarisChart("OK",ok,"#5cb85c");

    html+="</table>";

    document.getElementById("chartArea").innerHTML=html;

}
// ============================================================
// BARIS CHART
// ============================================================

function buatBarisChart(judul,jumlah,warna){

    return `

<tr>

<td>${judul}</td>

<td>${jumlah}</td>

<td>

<div
style="
background:${warna};
height:18px;
width:${jumlah*8}px;
border-radius:4px;
">

</div>

</td>

</tr>

`;

}
