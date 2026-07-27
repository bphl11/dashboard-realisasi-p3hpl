// ============================================================
// AUDIT TRACE ENGINE
// Tahap 2.3.1
// ============================================================

"use strict";

// ============================================================
// GLOBAL TRACE
// ============================================================

let auditTrace = new Map();

// ============================================================
// MULAI TRACE
// ============================================================

function traceMulai(rowIndex){

    if(!auditTrace.has(rowIndex)){

        auditTrace.set(rowIndex,{

            rowIndex:rowIndex,

            langkah:[],

            error:[],

            selesai:false

        });

    }

}

// ============================================================
// TAMBAH LANGKAH
// ============================================================

function traceTambah(rowIndex,nama,data=null){

    traceMulai(rowIndex);

    auditTrace
        .get(rowIndex)
        .langkah
        .push({

            waktu:new Date().toLocaleTimeString(),

            nama:nama,

            data:data

        });

}

// ============================================================
// TAMBAH ERROR
// ============================================================

function traceError(rowIndex,pesan){

    traceMulai(rowIndex);

    auditTrace
        .get(rowIndex)
        .error
        .push(pesan);

}

// ============================================================
// SELESAI
// ============================================================

function traceSelesai(rowIndex){

    traceMulai(rowIndex);

    auditTrace
        .get(rowIndex)
        .selesai=true;

}

// ============================================================
// AMBIL TRACE
// ============================================================

function getTrace(rowIndex){

    return auditTrace.get(rowIndex);

}

// ============================================================
// HAPUS TRACE
// ============================================================

function clearTrace(){

    auditTrace.clear();

}

// ============================================================
// CETAK TRACE
// ============================================================

function tampilTrace(rowIndex){

    const trace=getTrace(rowIndex);

    if(!trace){

        console.warn("Trace tidak ditemukan");

        return;

    }

    console.clear();

    console.log("===================================");

    console.log("TRACE PARSER");

    console.log("ROW :",rowIndex);

    console.log("===================================");

    trace.langkah.forEach(function(item,index){

        console.log(

            (index+1)+".",

            item.nama,

            item.data

        );

    });

    if(trace.error.length){

        console.log("===================================");

        console.log("ERROR");

        console.table(trace.error);

    }

}

// ============================================================
// EXPORT TRACE
// ============================================================

function semuaTrace(){

    return [...auditTrace.values()];

}
