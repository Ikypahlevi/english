const XLSX = require('xlsx');

const filePath = 'C:\\Users\\ADMIN\\Downloads\\TỪ MỚI V12  (1).xlsx';
const workbook = XLSX.readFile(filePath);

function inspectSheet(sheetName) {
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) {
    console.log(`Sheet ${sheetName} not found.`);
    return;
  }
  
  const range = XLSX.utils.decode_range(sheet['!ref']);
  console.log(`\n--- Inspecting ${sheetName} (Rows: ${range.s.r} to ${range.e.r}) ---`);
  
  for (let r = 0; r <= Math.min(range.e.r, 20); r++) {
    const a = sheet[XLSX.utils.encode_cell({r: r, c: 0})]?.v;
    const b = sheet[XLSX.utils.encode_cell({r: r, c: 1})]?.v;
    const c = sheet[XLSX.utils.encode_cell({r: r, c: 2})]?.v;
    const d = sheet[XLSX.utils.encode_cell({r: r, c: 3})]?.v;
    const f = sheet[XLSX.utils.encode_cell({r: r, c: 5})]?.v;
    const g = sheet[XLSX.utils.encode_cell({r: r, c: 6})]?.v;
    const h = sheet[XLSX.utils.encode_cell({r: r, c: 7})]?.v;
    const j = sheet[XLSX.utils.encode_cell({r: r, c: 9})]?.v;
    
    console.log(`Row ${r+1}: A=${a}, B=${b}, C=${c}, D=${d} | F=${f}, G=${g}, H=${h}, J=${j}`);
  }
  console.log("Sheet names:", workbook.SheetNames);
}

inspectSheet('TEST 6');
