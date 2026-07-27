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
// FUNGSI UTAMA
// ============================================================

function auditParser(rawData) {

    console.clear();

    console.log("========================================");
    console.log("AUDIT PARSER V3");
    console.log("========================================");

    if (!Array.isArray(rawData)) {

        console.error("auditParser : rawData bukan array");

        return;

    }

    // ===========================================
    // Jalankan parser utama
    // ===========================================

    const parserData =
        parseDataMonitoring(rawData);

    console.log(
        "Jumlah Data Parser :",
        parserData.length
    );

    // ===========================================
    // Buat hasil audit
    // ===========================================

    const hasilAudit =
        buatAudit(
            rawData,
            parserData
        );

    console.log(
        "Jumlah Audit :",
        hasilAudit.length
    );

    // ===========================================
    // Tampilkan ke UI
    // ===========================================

    tampilkanAudit(
        hasilAudit
    );

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

        const parent=item.parserRows.filter(

            i=>i.isRincian===false

        );

        const rincian=item.parserRows.filter(

            i=>i.isRincian===true

        );

        if(

            parent.length>0 &&

            rincian.length>0

        ){

            item.errorList.push(

                "Parent + Rincian"

            );

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

        item.parserRows.forEach(function(row){

            const nama=row.komponen||"-";

            if(!map.has(nama)){

                map.set(nama,0);

            }

            map.set(

                nama,

                map.get(nama)+

                Math.abs(

                    item.paguParser-

                    item.paguExcel

                )

            );

        });

    });

    return [...map.entries()]

    .sort(

        (a,b)=>b[1]-a[1]

    );

}
const hasilAudit=

buatAudit(

    rawData,

    parserData

);

// Analisis Error

analisaAudit(

    hasilAudit

);

// Statistik

const statistik=

statistikAudit(

    hasilAudit

);

console.table(

    statistik

);

// Ringkasan

console.table(

    ringkasanSelisih(

        hasilAudit

    )

);

// Komponen terbesar

console.table(

    komponenError(

        hasilAudit

    )

);

// Tampilkan

tampilkanAudit(

    hasilAudit

);
