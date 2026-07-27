const fs = require('fs');
const xlsx = require('xlsx');

const filePath = 'C:\\Users\\rahil\\Downloads\\Classeur5.xlsx';

function testExcelParse() {
  if (!fs.existsSync(filePath)) {
    console.error(`File not found at: ${filePath}`);
    return;
  }
  
  console.log(`File found! Size: ${fs.statSync(filePath).size} bytes`);
  
  const workbook = xlsx.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  
  const rawData = xlsx.utils.sheet_to_json(sheet, { header: 1 });
  console.log(`Total raw rows: ${rawData.length}`);
  
  // Auto-detect header row
  let headerRowIdx = 0;
  for (let i = 0; i < rawData.length; i++) {
    const rowStr = rawData[i].map(String).join(' ').toLowerCase();
    let matches = 0;
    if (rowStr.includes('mle') || rowStr.includes('matricule')) matches++;
    if (rowStr.includes('nom')) matches++;
    if (rowStr.includes('seg')) matches++;
    if (rowStr.includes('affectation')) matches++;
    
    if (matches >= 2) {
      headerRowIdx = i;
      break;
    }
  }
  
  console.log(`Detected header row index: ${headerRowIdx}`);
  console.log(`Headers:`, rawData[headerRowIdx]);
  
  const data = xlsx.utils.sheet_to_json(sheet, { range: headerRowIdx });
  console.log(`Total records parsed: ${data.length}`);
  
  if (data.length > 0) {
    console.log(`First record:`, data[0]);
    
    // Check keys
    const keys = Object.keys(data[0]);
    console.log(`Columns of first record:`, keys);
    const lastColKey = keys[keys.length - 1];
    console.log(`Last column key: "${lastColKey}" (value: "${data[0][lastColKey]}")`);
    
    // Test pointage calculation for first few records
    for (let i = 0; i < Math.min(data.length, 5); i++) {
      const row = data[i];
      const pointageVal = row[lastColKey];
      let pointage = pointageVal ? String(pointageVal).trim() : '';
      let heures_travaillees = 0.0;
      
      console.log(`Row ${i} pointage string: "${pointage}"`);
      
      if (!pointage || pointage === '0' || pointage.toLowerCase() === 'nan') {
        heures_travaillees = 0.0;
      } else {
        try {
          const parts = pointage.split(/\s+/);
          console.log(`  Split parts:`, parts);
          if (parts.length >= 2 && parts.length % 2 === 0) {
            for (let j = 0; j < parts.length; j += 2) {
              const t1Str = parts[j];
              const t2Str = parts[j+1];
              
              // Parse time safely
              const parseTime = (timeStr) => {
                const parts = timeStr.split(':');
                if (parts.length >= 2) {
                  const hrs = parseInt(parts[0], 10);
                  const mins = parseInt(parts[1], 10);
                  return hrs * 60 + mins; // returns time in minutes
                }
                return NaN;
              };
              
              const t1 = parseTime(t1Str);
              let t2 = parseTime(t2Str);
              
              console.log(`  t1Str: "${t1Str}" -> ${t1} mins, t2Str: "${t2Str}" -> ${t2} mins`);
              
              if (!isNaN(t1) && !isNaN(t2)) {
                let diff = t2 - t1;
                if (t2 < t1) {
                  diff += 24 * 60; // Night shift
                }
                heures_travaillees += diff / 60.0;
              }
            }
          }
        } catch (e) {
          console.error(`  Error parsing row ${i}:`, e);
          heures_travaillees = 0.0;
        }
      }
      
      console.log(`  Calculated hours: ${heures_travaillees}`);
    }
  }
}

try {
  testExcelParse();
} catch (error) {
  console.error('Fatal execution error:', error);
}
