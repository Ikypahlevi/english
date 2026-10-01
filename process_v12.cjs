const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');

const inputPath = 'C:\\Users\\ADMIN\\Downloads\\TỪ MỚI V12  (1).xlsx';
const outputPath = path.join(__dirname, 'data', 'TỪ MỚI V12_EDITED.xlsx');

const workbook = XLSX.readFile(inputPath);

for (let sheetName of workbook.SheetNames) {
  if (sheetName.toUpperCase().trim().startsWith("TEST")) {
    const sheet = workbook.Sheets[sheetName];
    const range = XLSX.utils.decode_range(sheet['!ref']);
    
    // Find the first empty row in column B (index 1) to start appending
    let appendRow = 1;
    let lastSTT = 0;
    while (true) {
      const bCell = sheet[XLSX.utils.encode_cell({r: appendRow, c: 1})];
      if (!bCell || !bCell.v || String(bCell.v).trim() === '') {
        break;
      }
      const aCell = sheet[XLSX.utils.encode_cell({r: appendRow, c: 0})];
      if (aCell && aCell.v && !isNaN(Number(aCell.v))) {
        lastSTT = Number(aCell.v);
      }
      appendRow++;
    }
    
    console.log(`Sheet "${sheetName}": Appending starts at row ${appendRow + 1}, Last STT: ${lastSTT}`);
    
    // Scan F, G, H, J starting from row 1 (data)
    for (let r = 1; r <= range.e.r; r++) {
      const gCell = sheet[XLSX.utils.encode_cell({r: r, c: 6})];
      if (gCell && gCell.v && String(gCell.v).trim() !== '') {
        const hCell = sheet[XLSX.utils.encode_cell({r: r, c: 7})];
        const jCell = sheet[XLSX.utils.encode_cell({r: r, c: 9})];
        
        lastSTT++;
        
        // Write to A, B, C, D
        sheet[XLSX.utils.encode_cell({r: appendRow, c: 0})] = { t: 'n', v: lastSTT }; // STT
        sheet[XLSX.utils.encode_cell({r: appendRow, c: 1})] = gCell; // Word
        if (hCell) sheet[XLSX.utils.encode_cell({r: appendRow, c: 2})] = hCell; // IPA
        if (jCell) sheet[XLSX.utils.encode_cell({r: appendRow, c: 3})] = jCell; // Meaning
        
        appendRow++;
      }
      
      // Clear F, G, H, J
      delete sheet[XLSX.utils.encode_cell({r: r, c: 5})];
      delete sheet[XLSX.utils.encode_cell({r: r, c: 6})];
      delete sheet[XLSX.utils.encode_cell({r: r, c: 7})];
      delete sheet[XLSX.utils.encode_cell({r: r, c: 9})];
    }
    
    // Clear F, G, H, J headers
    delete sheet[XLSX.utils.encode_cell({r: 0, c: 5})];
    delete sheet[XLSX.utils.encode_cell({r: 0, c: 6})];
    delete sheet[XLSX.utils.encode_cell({r: 0, c: 7})];
    delete sheet[XLSX.utils.encode_cell({r: 0, c: 9})];
    
    // Update sheet range if necessary
    if (appendRow - 1 > range.e.r) {
      range.e.r = appendRow - 1;
      sheet['!ref'] = XLSX.utils.encode_range(range);
    }
  }
}

XLSX.writeFile(workbook, outputPath);
console.log(`Saved to ${outputPath}`);
