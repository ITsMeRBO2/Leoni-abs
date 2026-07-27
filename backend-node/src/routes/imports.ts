import express from 'express';
import multer from 'multer';
import * as xlsx from 'xlsx';
import prisma from '../prisma';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

router.post('/upload/', upload.single('file'), async (req: any, res: any) => {
  const file = req.file;
  const dateStr = req.body.date;

  if (!file || !dateStr) {
    return res.status(400).json({ error: 'File and date are required' });
  }

  try {
    const importDate = new Date(dateStr);
    const isSaturday = importDate.getDay() === 6;
    let familiesOff: string[] = [];

    if (isSaturday) {
      const satConfig = await prisma.saturdayConfiguration.findUnique({
        where: { date: importDate }
      });
      if (satConfig) {
        familiesOff = satConfig.families_off as string[];
      }
    }

    const isPublicHoliday = await prisma.publicHoliday.findUnique({
      where: { date: importDate }
    });

    const workbook = xlsx.read(file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    
    // Parse to array of arrays first to find header row
    const rawData: any[][] = xlsx.utils.sheet_to_json(sheet, { header: 1 });
    
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

    // Now parse properly with found header
    const data: any[] = xlsx.utils.sheet_to_json(sheet, { range: headerRowIdx });

    const familiesJson = req.body.families;
    let ALLOWED_FAMILIES = ['CMA 2', 'CMA 3', 'MEP1', 'GPA-A', 'GPA-B', 'GPA', 'MAJORS'];
    if (familiesJson) {
      try {
        ALLOWED_FAMILIES = JSON.parse(familiesJson);
      } catch (e) {}
    }

    const settings = await prisma.settings.findUnique({ where: { id: 1 } });
    const minHours = settings?.min_working_hours || 5.0;

    let recordsCreated = 0;

    const ALLOWED_MAPPING: Record<string, string> = {};
    for (const f of ALLOWED_FAMILIES) {
      const normalizedF = f.replace(/[\s-]/g, '').toLowerCase();
      ALLOWED_MAPPING[normalizedF] = f.trim();
    }

    const getVal = (row: any, possibleNames: string[]) => {
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

    console.log('Fetching existing records from DB...');
    const existingEmployees = await prisma.employee.findMany();
    const employeeMap = new Map(existingEmployees.map(e => [e.mle, e]));

    const existingAttendances = await prisma.attendance.findMany({
      where: { date: importDate }
    });
    const attendanceMap = new Map(existingAttendances.map(a => [a.employeeId, a]));

    const existingDepartures = await prisma.departure.findMany();
    const departureMap = new Map(existingDepartures.map(d => [d.employeeId, d]));

    const employeesToCreate: any[] = [];
    const employeesToUpdate: any[] = [];

    const attendancesToCreate: any[] = [];
    const attendancesToUpdate: any[] = [];

    const departuresToCreate: any[] = [];
    const departuresToUpdate: any[] = [];

    console.log('Processing Excel rows in memory...');

    for (const row of data) {
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

      // Check if Employee needs create or update
      const existingEmp = employeeMap.get(mle);
      let consecutive = existingEmp ? existingEmp.consecutive_absences : 0;

      const empData = {
        mle,
        mle_2,
        nom_prenom,
        famille,
        seg: seg_val,
        affectation: affectationVal,
        cc,
        contrat,
        consecutive_absences: consecutive
      };

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
              
              const parseTime = (timeStr: string) => {
                const parts = timeStr.split(':');
                if (parts.length >= 2) {
                  const hrs = parseInt(parts[0], 10);
                  const mins = parseInt(parts[1], 10);
                  return hrs * 60 + mins;
                }
                return NaN;
              };
              
              const t1 = parseTime(t1Str);
              let t2 = parseTime(t2Str);
              
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

      // Update consecutive absences
      if (statut === 'Present') {
        consecutive = 0;
      } else if (statut === 'Absent') {
        consecutive += 1;
      }
      empData.consecutive_absences = consecutive;

      if (!existingEmp) {
        employeesToCreate.push(empData);
        employeeMap.set(mle, empData as any); // Track in map
      } else {
        if (
          existingEmp.mle_2 !== mle_2 ||
          existingEmp.nom_prenom !== nom_prenom ||
          existingEmp.famille !== famille ||
          existingEmp.seg !== seg_val ||
          existingEmp.affectation !== affectationVal ||
          existingEmp.cc !== cc ||
          existingEmp.contrat !== contrat ||
          existingEmp.consecutive_absences !== consecutive
        ) {
          employeesToUpdate.push(empData);
        }
      }

      // Attendance
      const existingAtt = attendanceMap.get(mle);
      const attData = {
        employeeId: mle,
        date: importDate,
        heures_travaillees,
        statut
      };

      if (!existingAtt) {
        attendancesToCreate.push(attData);
      } else {
        if (existingAtt.heures_travaillees !== heures_travaillees || existingAtt.statut !== statut) {
          attendancesToUpdate.push({ id: existingAtt.id, ...attData });
        }
      }

      // Departure logic
      if (consecutive >= 4 && statut === 'Absent') {
        const existingDep = departureMap.get(mle);
        const depData = {
          employeeId: mle,
          absences_count: consecutive,
          date_added: importDate
        };

        if (!existingDep) {
          departuresToCreate.push(depData);
        } else {
          if (existingDep.absences_count !== consecutive) {
            departuresToUpdate.push({ id: existingDep.id, ...depData });
          }
        }
      }

      recordsCreated++;
    }

    console.log('Writing to DB...');
    await prisma.$transaction(async (tx) => {
      // 1. Create Employees
      if (employeesToCreate.length > 0) {
        await tx.employee.createMany({
          data: employeesToCreate,
          skipDuplicates: true
        });
      }

      // 2. Update Employees
      for (const emp of employeesToUpdate) {
        await tx.employee.update({
          where: { mle: emp.mle },
          data: emp
        });
      }

      // 3. Create Attendances
      if (attendancesToCreate.length > 0) {
        await tx.attendance.createMany({
          data: attendancesToCreate,
          skipDuplicates: true
        });
      }

      // 4. Update Attendances
      for (const att of attendancesToUpdate) {
        await tx.attendance.update({
          where: { id: att.id },
          data: { heures_travaillees: att.heures_travaillees, statut: att.statut }
        });
      }

      // 5. Create Departures
      if (departuresToCreate.length > 0) {
        await tx.departure.createMany({
          data: departuresToCreate,
          skipDuplicates: true
        });
      }

      // 6. Update Departures
      for (const dep of departuresToUpdate) {
        await tx.departure.update({
          where: { id: dep.id },
          data: { absences_count: dep.absences_count }
        });
      }
    });

    await prisma.importHistory.create({
      data: {
        userId: req.user?.user_id || null,
        status: 'Success',
        records_processed: recordsCreated,
        file_name: file.originalname
      }
    });

    res.json({ message: `Imported successfully. Processed ${recordsCreated} records.` });

  } catch (error: any) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
