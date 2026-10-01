const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');

const inputPath = 'C:\\Users\\ADMIN\\Downloads\\TỪ MỚI V12  (1).xlsx';
const outputPath = path.join(__dirname, 'data', 'TỪ MỚI V12_FIXED.xlsx');

console.log("Reading original file...");
const workbook = XLSX.readFile(inputPath);

for (let sheetName of workbook.SheetNames) {
  if (sheetName.toUpperCase().trim().startsWith("TEST")) {
    const sheet = workbook.Sheets[sheetName];
    const range = XLSX.utils.decode_range(sheet['!ref']);
    
    // Find the append row by checking column B (index 1)
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
    
    // Find the starting column for the right-side data by looking for '1' in row 2 (index 1) or 'TỪ VỰNG ĐỌC' in row 1 (index 0)
    let startCol = -1;
    for (let c = 4; c <= 8; c++) {
      const headerCell = sheet[XLSX.utils.encode_cell({r: 0, c: c})];
      if (headerCell && String(headerCell.v).includes("TỪ VỰNG ĐỌC")) {
        startCol = c;
        break;
      }
      const valCell = sheet[XLSX.utils.encode_cell({r: 1, c: c})];
      if (valCell && String(valCell.v).trim() === '1') {
        startCol = c;
        break;
      }
    }

    if (startCol === -1) {
      console.log(`Sheet "${sheetName}": Could not find right-side data start column.`);
      continue;
    }
    
    console.log(`Sheet "${sheetName}": Appending at row ${appendRow + 1} | Right-side starts at col ${String.fromCharCode(65+startCol)}`);
    
    const colSTT = startCol;
    const colWord = startCol + 1;
    const colIPA = startCol + 2;
    const colPOS = startCol + 3;
    const colMeaning = startCol + 4;
    
    for (let r = 1; r <= range.e.r; r++) {
      const wordCell = sheet[XLSX.utils.encode_cell({r: r, c: colWord})];
      if (wordCell && wordCell.v && String(wordCell.v).trim() !== '') {
        const ipaCell = sheet[XLSX.utils.encode_cell({r: r, c: colIPA})];
        const meaningCell = sheet[XLSX.utils.encode_cell({r: r, c: colMeaning})];
        
        lastSTT++;
        
        // Write to A, B, C, D
        sheet[XLSX.utils.encode_cell({r: appendRow, c: 0})] = { t: 'n', v: lastSTT };
        sheet[XLSX.utils.encode_cell({r: appendRow, c: 1})] = wordCell;
        if (ipaCell) sheet[XLSX.utils.encode_cell({r: appendRow, c: 2})] = ipaCell;
        if (meaningCell) sheet[XLSX.utils.encode_cell({r: appendRow, c: 3})] = meaningCell;
        
        appendRow++;
      }
      
      // Clear original columns (including Part of Speech)
      for (let c = colSTT; c <= colMeaning; c++) {
        delete sheet[XLSX.utils.encode_cell({r: r, c: c})];
      }
    }
    
    // Clear headers
    for (let c = colSTT; c <= colMeaning; c++) {
      delete sheet[XLSX.utils.encode_cell({r: 0, c: c})];
    }
    
    if (appendRow - 1 > range.e.r) {
      range.e.r = appendRow - 1;
      sheet['!ref'] = XLSX.utils.encode_range(range);
    }
  }
}

XLSX.writeFile(workbook, outputPath);
console.log(`Successfully fixed and saved to ${outputPath}`);
