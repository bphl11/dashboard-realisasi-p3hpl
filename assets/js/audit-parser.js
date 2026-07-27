// ============================================================
// AUDIT-PARSER.JS
// Audit Parser V3
//
// Digunakan untuk:
//
// - Membandingkan Excel vs Parser
// - Deteksi Double Count
// - Deteksi Tidak Terbaca
// - Deteksi Status Berubah
// - Deteksi Pagu Berbeda
//
// Tahap 2.1
// ============================================================

"use strict";
// ============================================================
// MEMBUAT AUDIT ID
// ============================================================

function buatAuditId(item){

    return [

        item.kegiatan || "",

        item.output || "",

        item.komponen || "",

        item.subKomponen || "",

        item.kode || "",

        item.akun || "",

        item.itemAkun || ""

    ].join("|");

}

// ============================================================
// FUNGSI UTAMA
// ============================================================

function auditParser(rawData){

    console.clear();

    console.log("====================================");

    console.log("AUDIT PARSER V3");

    console.log("====================================");

    if(!Array.isArray(rawData)){

        console.error("Raw data bukan array");

        return;

    }

    const parserData=
        parseDataMonitoring(rawData);

    console.log(
        "Jumlah Parser",
        parserData.length
    );

    const hasilAudit=
        buatAudit(
            rawData,
            parserData
        );

    analisaAudit(
        hasilAudit
    );

    const statistik=
        statistikAudit(
            hasilAudit
        );

    console.table(statistik);

    console.table(
        ringkasanSelisih(
            hasilAudit
        )
    );

    console.table(
        komponenError(
            hasilAudit
        )
    );

    tampilkanAudit(
        hasilAudit
    );

}

   // ============================================================
// BUAT AUDIT
// ============================================================

function buatAudit(rawData, parserData){

    const hasil=[];

    const parserMap=new Map();

    const auditMap=new Map();

   parserData.forEach(function(item){

    const row=item.rowIndex;

    if(!parserMap.has(row)){

        parserMap.set(row,[]);

    }

    parserMap.get(row).push(item);

    const auditId=buatAuditId(item);

    if(!auditMap.has(auditId)){

        auditMap.set(auditId,[]);

    }

    auditMap.get(auditId).push(item);

});
    rawData.forEach(function(row,index){
        if (!row || row.length === 0) {
    return;
}

const uraian = clean(row[1] || "");

if (!uraian) {
    return;
}
        // ============================================
// LEWATI BARIS PARENT
// Parser memang tidak menyimpan:
// - Kegiatan
// - Output
// - Komponen
// - Sub Komponen
// ============================================

const kode = clean(row[0] || "");

if (
    /^\d{4}$/.test(kode) ||
    /^\d{4}\.[A-Z0-9]+$/i.test(kode) ||
    /^\d{4}\.[A-Z0-9]+\.\d{3}$/i.test(kode) ||
    /^\d{4}\.[A-Z0-9]+\.\d{3}\.\d{3}$/i.test(kode)
){
    return;
}

const subHuruf = deteksiSubKomponenHuruf(row);

if(subHuruf){
    return;
}

        const parserRows=
            parserMap.get(index)||[];

        const paguExcel=
            parseNumber(row[5])||0;
        if (paguExcel <= 0) {
    return;
}

        const paguParser=

            parserRows.reduce(function(total,item){

                return total+(Number(item.pagu)||0);

            },0);

       const statusExcel =
    isDiblokir(uraian)
        ? "Diblokir"
        : "Normal";
        const statusParser=

            parserRows.length

            ?parserRows[0].statusPagu

            :"-";

hasil.push({

    auditId:
        parserRows.length
        ? buatAuditId(parserRows[0])
        : "ROW_" + index,

    rowIndex: index,

    uraian: uraian,

    paguExcel: paguExcel,

    paguParser: paguParser,

    count: parserRows.length,

    statusExcel: statusExcel,

    statusParser: statusParser,

    terbaca: parserRows.length > 0,

    doubleCount: parserRows.length > 1,

    bedaPagu: paguExcel !== paguParser,

    salahStatus: statusExcel !== statusParser,

    parserRows: parserRows,

    severity: "OK",

    errorList: [],

    trace: getTrace(index) || null

});

    });

    return hasil;

}

    
// ============================================================
// ANALISIS PENYEBAB ERROR
// ============================================================

function analisaAudit(hasilAudit){

    hasilAudit.forEach(function(item){

        item.errorList=[];
       
        // ============================================
        // DOUBLE COUNT
        // ============================================

        if(item.count>1){

            item.errorList.push("Double Count");

        }

        // ============================================
        // TIDAK TERBACA
        // ============================================

        if(!item.terbaca){

            item.errorList.push("Tidak Terbaca");

        }

        // ============================================
        // STATUS BERUBAH
        // ============================================

        if(item.statusExcel!==item.statusParser){

            item.errorList.push("Status Berubah");

        }

        // ============================================
        // PAGU BERBEDA
        // ============================================

        if(item.paguExcel!==item.paguParser){

            item.errorList.push("Pagu Berbeda");

        }

        // ============================================
        // PARENT + RINCIAN
        // ============================================

        const rows = item.parserRows || [];

const parent = rows.filter(
    i => i.isRincian === false
);

const rincian = rows.filter(
    i => i.isRincian === true
);


        if(

            parent.length>0 &&

            rincian.length>0

        ){

            item.errorList.push(

                "Parent + Rincian"

            );

        }

        // ============================================
// SEVERITY
// ============================================

if(item.errorList.length===0){

    item.severity="OK";

}
else if(item.errorList.includes("Double Count")){

    item.severity="CRITICAL";

}
else if(item.errorList.includes("Pagu Berbeda")){

    item.severity="MAJOR";

}
else if(item.errorList.includes("Parent + Rincian")){

    item.severity="MAJOR";

}
else if(item.errorList.includes("Status Berubah")){

    item.severity="WARNING";

}
else{

    item.severity="INFO";

}

    });

}
// ============================================================
// STATISTIK ERROR
// ============================================================

function statistikAudit(data){

    return{

        doubleCount:

        data.filter(

            i=>i.errorList.includes(

                "Double Count"

            )

        ).length,

        tidakTerbaca:

        data.filter(

            i=>i.errorList.includes(

                "Tidak Terbaca"

            )

        ).length,

        status:

        data.filter(

            i=>i.errorList.includes(

                "Status Berubah"

            )

        ).length,

        pagu:

        data.filter(

            i=>i.errorList.includes(

                "Pagu Berbeda"

            )

        ).length,

        parent:

        data.filter(

            i=>i.errorList.includes(

                "Parent + Rincian"

            )

        ).length

    };

}
// ============================================================
// RINGKASAN SELISIH
// ============================================================

function ringkasanSelisih(data){

    let excel=0;

    let parser=0;

    data.forEach(function(item){

        excel+=item.paguExcel;

        parser+=item.paguParser;

    });

    return{

        totalExcel:excel,

        totalParser:parser,

        selisih:parser-excel

    };

}
// ============================================================
// PENYEBAB TERBESAR
// ============================================================

function komponenError(data){

    const map=new Map();

    data.forEach(function(item){

       const rows = item.parserRows || [];

rows.forEach(function(row){

    const nama = row.komponen || "-";

    if(!map.has(nama)){
        map.set(nama,0);
    }

    map.set(
        nama,
        map.get(nama) +
        Math.abs(item.paguParser - item.paguExcel)
    );

});

    });

    return [...map.entries()]

    .sort(

        (a,b)=>b[1]-a[1]

    );

}
