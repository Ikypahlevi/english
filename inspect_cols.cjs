const XLSX = require('xlsx');

const filePath = 'C:\\Users\\ADMIN\\Downloads\\TỪ MỚI V12  (1).xlsx';
const workbook = XLSX.readFile(filePath);

for (let sheetName of workbook.SheetNames) {
  if (sheetName.toUpperCase().trim().startsWith("TEST")) {
    const sheet = workbook.Sheets[sheetName];
    const range = XLSX.utils.decode_range(sheet['!ref']);
    
    // Read the first few rows of columns E to L
    console.log(`\n--- Inspecting ${sheetName} ---`);
    for (let r = 0; r <= 3; r++) {
      let rowStr = `Row ${r+1}: `;
      for (let c = 4; c <= 11; c++) { // E=4, F=5, G=6, H=7, I=8, J=9, K=10, L=11
        const cell = sheet[XLSX.utils.encode_cell({r: r, c: c})];
        rowStr += `${String.fromCharCode(65+c)}=${cell ? cell.v : 'undef'} | `;
      }
      console.log(rowStr);
    }
  }
}
