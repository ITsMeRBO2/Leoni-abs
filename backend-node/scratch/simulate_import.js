const fs = require('fs');
const xlsx = require('xlsx');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const filePath = 'C:\\Users\\rahil\\Downloads\\Classeur5.xlsx';
const dateStr = '2026-07-08'; // Matches the date in the file headers (7/8/26)

async function simulateImport() {
  if (!fs.existsSync(filePath)) {
    console.error(`File not found at: ${filePath}`);
    return;
  }

  const importDate = new Date(dateStr);
  const isSaturday = importDate.getDay() === 6;
  let familiesOff = [];

  if (isSaturday) {
    const satConfig = await prisma.saturdayConfiguration.findUnique({
      where: { date: importDate }
    });
    if (satConfig) {
      familiesOff = satConfig.families_off;
    }
  }

  const isPublicHoliday = await prisma.publicHoliday.findUnique({
    where: { date: importDate }
  });

  const workbook = xlsx.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  
  const rawData = xlsx.utils.sheet_to_json(sheet, { header: 1 });
  
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

  const data = xlsx.utils.sheet_to_json(sheet, { range: headerRowIdx });

  const ALLOWED_FAMILIES = ['CMA 2', 'CMA 3', 'MEP1', 'GPA-A', 'GPA-B', 'GPA', 'MAJORS'];
  const settings = await prisma.settings.findUnique({ where: { id: 1 } });
  const minHours = settings?.min_working_hours || 5.0;

  let recordsCreated = 0;

  const ALLOWED_MAPPING = {};
  for (const f of ALLOWED_FAMILIES) {
    const normalizedF = f.replace(/[\s-]/g, '').toLowerCase();
    ALLOWED_MAPPING[normalizedF] = f.trim();
  }

  const getVal = (row, possibleNames) => {
    for (const name of possibleNames) {
      for (const key of Object.keys(row)) {
        if (key.trim() === name) return row[key] ? String(row[key]).trim() : '';
      }
    }
    for (const name of possibleNames) {
      for (const key of Object.keys(row)) {
        if (key.trim().toLowerCase() === name.toLowerCase()) return row[key] ? String(row[key]).trim() : '';
      }
    }
    return '';
  };

  console.log('Starting transaction simulation...');

  await prisma.$transaction(async (tx) => {
    // Let's test first 10 rows to see if transaction works
    const rowsToProcess = data.slice(0, 10);
    for (const row of rowsToProcess) {
      const affectationVal = getVal(row, ['Affectation', 'affectation', 'affect', 'AFFECTATION']);
      const affNorm = affectationVal.replace(/[\s-]/g, '').toLowerCase();
      
      let famille = '';
      if (ALLOWED_MAPPING[affNorm]) {
        famille = ALLOWED_MAPPING[affNorm];
      } else {
        continue;
      }

      let mle = getVal(row, ['Mle', 'MLE', 'mle', 'Matricule', 'matricule']);
      let mle_2 = getVal(row, ['MLE']);
      
      if (!mle || mle.toLowerCase() === 'nan') continue;

      const nom_prenom = getVal(row, ['Nom & prénom', 'Nom & prenom', 'Nom et prénom', 'NOM & PRENOM', 'Nom', 'nom']);
      const cc = getVal(row, ['CC', 'cc']);
      const contrat = getVal(row, ['Contrat', 'contrat']);
      const seg_val = getVal(row, ['SEG', 'seg']);

      console.log(`Processing employee: ${mle} - ${nom_prenom}`);

      await tx.employee.upsert({
        where: { mle },
        update: {
          mle_2, nom_prenom, famille, seg: seg_val, affectation: affectationVal, cc, contrat
        },
        create: {
          mle, mle_2, nom_prenom, famille, seg: seg_val, affectation: affectationVal, cc, contrat
        }
      });

      const keys = Object.keys(row);
      const pointageVal = row[keys[keys.length - 1]];
      let pointage = pointageVal ? String(pointageVal).trim() : '';
      
      let heures_travaillees = 0.0;
      if (!pointage || pointage === '0' || pointage.toLowerCase() === 'nan') {
        pointage = "0";
      } else {
        try {
          const parts = pointage.split(/\s+/);
          if (parts.length >= 2 && parts.length % 2 === 0) {
            for (let j = 0; j < parts.length; j += 2) {
              const t1Str = parts[j];
              const t2Str = parts[j+1];
              const t1 = new Date(`1970-01-01T${t1Str}:00Z`).getTime();
              let t2 = new Date(`1970-01-01T${t2Str}:00Z`).getTime();
              if (t2 < t1) {
                t2 += 24 * 60 * 60 * 1000; // Night shift
              }
              const diff = (t2 - t1) / (1000 * 3600.0);
              heures_travaillees += diff;
            }
          }
        } catch (e) {
          heures_travaillees = 0.0;
        }
      }

      let statut = 'Absent';
      if (isPublicHoliday) {
        statut = 'Ferie';
      } else if (familiesOff.includes(famille)) {
        statut = 'Repos';
      } else if (heures_travaillees >= minHours) {
        statut = 'Present';
      }

      console.log(`  statut: ${statut}, hours: ${heures_travaillees}`);

      await tx.attendance.upsert({
        where: { employeeId_date: { employeeId: mle, date: importDate } },
        update: { heures_travaillees, statut },
        create: { employeeId: mle, date: importDate, heures_travaillees, statut }
      });

      const emp = await tx.employee.findUnique({ where: { mle } });
      if (emp) {
        let consecutive = emp.consecutive_absences;
        if (statut === 'Present') {
          consecutive = 0;
        } else if (statut === 'Absent') {
          consecutive += 1;
        }
        await tx.employee.update({
          where: { mle },
          data: { consecutive_absences: consecutive }
        });

        if (consecutive >= 4 && statut === 'Absent') {
          const existingDep = await tx.departure.findFirst({ where: { employeeId: mle } });
          if (existingDep) {
            await tx.departure.update({
              where: { id: existingDep.id },
              data: { absences_count: consecutive }
            });
          } else {
            await tx.departure.create({
              data: { employeeId: mle, absences_count: consecutive, date_added: importDate }
            });
          }
        }
      }

      recordsCreated++;
    }
  });

  console.log(`Simulation complete! Processed ${recordsCreated} rows successfully.`);
}

simulateImport()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
