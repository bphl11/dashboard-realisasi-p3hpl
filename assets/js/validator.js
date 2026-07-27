// ============================================================
// VALIDATOR.JS
// Audit Validator V1
// ============================================================

"use strict";

// ============================================================
// VALIDATOR UTAMA
// ============================================================

function validatorAudit(data){

    console.log("======================================");
    console.log("VALIDATOR AUDIT");
    console.log("======================================");

    if(!Array.isArray(data)){

        console.error("validatorAudit : Data bukan array");

        return [];

    }

    duplicateDetector(data);

    parentDetector(data);

    statusDetector(data);

    paguDetector(data);

    hierarchyDetector(data);

    severityDetector(data);

    console.log("Validator selesai");

    return data;

}
// ============================================================
// DUPLICATE DETECTOR
// ============================================================

function duplicateDetector(data){

    console.log("Duplicate Detector...");

    const map = new Map();

    data.forEach(function(item){

        const key = item.auditId || "";

        if(!map.has(key)){

            map.set(key,[]);

        }

        map.get(key).push(item);

    });

    map.forEach(function(items,key){

        if(items.length<=1){

            return;

        }

        items.forEach(function(item){

            if(!item.errorList.includes("Duplicate AuditID")){

                item.errorList.push(

                    "Duplicate AuditID"

                );

            }

        });

    });

}
// ============================================================
// PARENT DETECTOR
// ============================================================

function parentDetector(data){

    console.log("Parent Detector...");

    data.forEach(function(item){

        const rows = item.parserRows || [];

        if(rows.length === 0){

            return;

        }

        const parent = rows.filter(function(r){

            return r.isRincian === false;

        });

        const rincian = rows.filter(function(r){

            return r.isRincian === true;

        });

        item.parentCount = parent.length;

        item.rincianCount = rincian.length;

        item.parentIkut = parent.length > 0;

        item.rincianAda = rincian.length > 0;

        if(item.parentIkut && item.rincianAda){

            if(!item.errorList.includes("Parent + Rincian")){

                item.errorList.push("Parent + Rincian");

            }

        }

    });

}
// ============================================================
// STATUS DETECTOR
// ============================================================

function statusDetector(data){

    console.log("Status Detector...");

    data.forEach(function(item){

        const excel =
            (item.statusExcel || "")
            .toString()
            .trim();

        const parser =
            (item.statusParser || "")
            .toString()
            .trim();

        if(excel === parser){

            return;

        }

        item.statusValid = false;

        if(!item.errorList.includes("Status Berubah")){

            item.errorList.push("Status Berubah");

        }

    });

}
// ============================================================
// PAGU DETECTOR
// ============================================================

function paguDetector(data){

    console.log("Pagu Detector...");

    data.forEach(function(item){

        const excel = Number(item.paguExcel) || 0;

        const parser = Number(item.paguParser) || 0;

        item.selisihPagu = parser - excel;

        item.selisihAbsolut = Math.abs(item.selisihPagu);

        item.persentaseSelisih = 0;

        if(excel > 0){

            item.persentaseSelisih = Number(

                ((item.selisihAbsolut / excel) * 100).toFixed(2)

            );

        }

        item.paguValid = (excel === parser);

        if(!item.paguValid){

            if(!item.errorList.includes("Pagu Berbeda")){

                item.errorList.push("Pagu Berbeda");

            }

        }

        // ====================================================
        // KATEGORI SELISIH
        // ====================================================

        if(item.selisihAbsolut === 0){

            item.kategoriSelisih = "OK";

        }
        else if(item.selisihAbsolut < 100000){

            item.kategoriSelisih = "Kecil";

        }
        else if(item.selisihAbsolut < 1000000){

            item.kategoriSelisih = "Sedang";

        }
        else{

            item.kategoriSelisih = "Besar";

        }

    });

}
// ============================================================
// HIERARCHY DETECTOR
// ============================================================

function hierarchyDetector(data){

    console.log("Hierarchy Detector...");

    data.forEach(function(item){

        item.hierarchyValid = true;

        // ============================================
        // Komponen tanpa Output
        // ============================================

        if(item.komponen && !item.output){

            item.hierarchyValid = false;

            if(!item.errorList.includes("Output Kosong")){

                item.errorList.push("Output Kosong");

            }

        }

        // ============================================
        // Sub Komponen tanpa Komponen
        // ============================================

        if(item.subKomponen && !item.komponen){

            item.hierarchyValid = false;

            if(!item.errorList.includes("Komponen Kosong")){

                item.errorList.push("Komponen Kosong");

            }

        }

        // ============================================
        // Akun tanpa Sub Komponen
        // ============================================

        if(item.akun && !item.subKomponen){

            item.hierarchyValid = false;

            if(!item.errorList.includes("Sub Komponen Kosong")){

                item.errorList.push("Sub Komponen Kosong");

            }

        }

        // ============================================
        // Item tanpa Akun
        // ============================================

        if(item.uraian && !item.akun){

            item.hierarchyValid = false;

            if(!item.errorList.includes("Akun Kosong")){

                item.errorList.push("Akun Kosong");

            }

        }

    });

}
// ============================================================
// SEVERITY DETECTOR
// ============================================================

function severityDetector(data){

    console.log("Severity Detector...");

    data.forEach(function(item){

        item.severity = "OK";

        // ============================================
        // CRITICAL
        // ============================================

        if(

            item.errorList.includes("Duplicate AuditID") ||

            item.errorList.includes("Double Count")

        ){

            item.severity = "CRITICAL";

            return;

        }

        // ============================================
        // MAJOR
        // ============================================

        if(

            item.errorList.includes("Parent + Rincian") ||

            item.errorList.includes("Pagu Berbeda")

        ){

            item.severity = "MAJOR";

            return;

        }

        // ============================================
        // WARNING
        // ============================================

        if(

            item.errorList.includes("Status Berubah") ||

            item.errorList.includes("Output Kosong") ||

            item.errorList.includes("Komponen Kosong") ||

            item.errorList.includes("Sub Komponen Kosong") ||

            item.errorList.includes("Akun Kosong")

        ){

            item.severity = "WARNING";

            return;

        }

        // ============================================
        // INFO
        // ============================================

        if(item.errorList.length>0){

            item.severity="INFO";

        }

    });

}
