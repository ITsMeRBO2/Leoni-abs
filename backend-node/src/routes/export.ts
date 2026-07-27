import express from 'express';
import exceljs from 'exceljs';
import prisma from '../prisma';

const router = express.Router();

router.get('/export_excel/attendance/', async (req, res) => {
  try {
    const attendances = await prisma.attendance.findMany({
      include: { employee: true }
    });

    const workbook = new exceljs.Workbook();
    const worksheet = workbook.addWorksheet('Absences');

    worksheet.columns = [
      { header: 'Date', key: 'date', width: 15 },
      { header: 'MLE', key: 'mle', width: 15 },
      { header: 'MLE (Court)', key: 'mle_2', width: 15 },
      { header: 'Nom & Prénom', key: 'nom_prenom', width: 30 },
      { header: 'Famille', key: 'famille', width: 20 },
      { header: 'SEG', key: 'seg', width: 15 },
      { header: 'Affectation', key: 'affectation', width: 20 },
      { header: 'CC', key: 'cc', width: 15 },
      { header: 'Contrat', key: 'contrat', width: 15 },
      { header: 'Heures', key: 'heures', width: 10 },
      { header: 'Statut', key: 'statut', width: 15 },
    ];

    for (const att of attendances) {
      worksheet.addRow({
        date: att.date.toISOString().split('T')[0],
        mle: att.employee.mle,
        mle_2: att.employee.mle_2,
        nom_prenom: att.employee.nom_prenom,
        famille: att.employee.famille,
        seg: att.employee.seg,
        affectation: att.employee.affectation,
        cc: att.employee.cc,
        contrat: att.employee.contrat,
        heures: att.heures_travaillees,
        statut: att.statut
      });
    }

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="Export_Absences.xlsx"');
    
    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/export_excel/departures/', async (req, res) => {
  try {
    const departures = await prisma.departure.findMany({
      include: { employee: true }
    });

    const workbook = new exceljs.Workbook();
    const worksheet = workbook.addWorksheet('Departs');

    worksheet.columns = [
      { header: 'Date d\'entrée', key: 'date', width: 15 },
      { header: 'MLE', key: 'mle', width: 15 },
      { header: 'Nom & Prénom', key: 'nom_prenom', width: 30 },
      { header: 'Famille', key: 'famille', width: 20 },
      { header: 'Affectation', key: 'affectation', width: 20 },
      { header: 'Contrat', key: 'contrat', width: 15 },
      { header: 'Absences Consécutives', key: 'absences', width: 25 },
    ];

    for (const dep of departures) {
      worksheet.addRow({
        date: dep.date_added.toISOString().split('T')[0],
        mle: dep.employee.mle,
        nom_prenom: dep.employee.nom_prenom,
        famille: dep.employee.famille,
        affectation: dep.employee.affectation,
        contrat: dep.employee.contrat,
        absences: dep.absences_count,
      });
    }

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="Export_Departs.xlsx"');
    
    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
