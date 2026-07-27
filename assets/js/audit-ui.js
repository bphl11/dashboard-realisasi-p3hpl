function tampilkanAudit(data){

    tampilSummary(data);

    tampilTable(data);

}
function tampilSummary(data){

    const totalExcel=

        data.reduce(

            (a,b)=>a+b.paguExcel,

            0

        );

    const totalParser=

        data.reduce(

            (a,b)=>a+b.paguParser,

            0

        );

    document.getElementById("summary").innerHTML=

`
<table border="1">

<tr>

<td>Total Excel</td>

<td>${formatRupiah(totalExcel)}</td>

</tr>

<tr>

<td>Total Parser</td>

<td>${formatRupiah(totalParser)}</td>

</tr>

<tr>

<td>Selisih</td>

<td>${formatRupiah(totalParser-totalExcel)}</td>

</tr>

<tr>

<td>Double Count</td>

<td>${data.filter(i=>i.doubleCount).length}</td>

</tr>

<tr>

<td>Tidak Terbaca</td>

<td>${data.filter(i=>!i.terbaca).length}</td>

</tr>

<tr>

<td>Status Berubah</td>

<td>${data.filter(i=>i.salahStatus).length}</td>

</tr>

</table>
`;

}
