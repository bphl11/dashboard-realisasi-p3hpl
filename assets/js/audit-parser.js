function auditParser(rawData){

    const parserData=parseDataMonitoring(rawData);

    const hasil=buatAudit(rawData,parserData);

    tampilkanAudit(hasil);

}
function buatAudit(rawData,dataParser){

    const hasil=[];

    const mapParser=new Map();

    dataParser.forEach(item=>{

        if(!mapParser.has(item.rowIndex)){

            mapParser.set(item.rowIndex,[]);

        }

        mapParser.get(item.rowIndex).push(item);

    });

    for(let i=0;i<rawData.length;i++){

        const row=rawData[i];

        const pagu=parseNumber(row[5])||0;

        if(pagu<=0) continue;

        const parserRows=mapParser.get(i)||[];

        hasil.push({

            rowIndex:i,

            uraian:clean(row[1]),

            paguExcel:pagu,

            paguParser:parserRows.reduce(

                (a,b)=>a+(Number(b.pagu)||0),

                0

            ),

            count:parserRows.length,

            statusExcel:isDiblokir(row[1])

                ?"Diblokir"

                :"Normal",

            statusParser:parserRows.length

                ?parserRows[0].statusPagu

                :"-",

            terbaca:parserRows.length>0,

            doubleCount:parserRows.length>1,

            bedaPagu:false,

            salahStatus:false

        });

    }

    hasil.forEach(item=>{

        item.bedaPagu=

            item.paguExcel!==item.paguParser;

        item.salahStatus=

            item.statusExcel!==item.statusParser;

    });

    return hasil;

}
