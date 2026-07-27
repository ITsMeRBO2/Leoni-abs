import express from 'express';
import prisma from '../prisma';

const router = express.Router();

router.get('/', async (req, res) => {
  const { date } = req.query;
  try {
    const whereClause = date ? { date: new Date(date as string) } : {};
    const attendances = await prisma.attendance.findMany({
      where: whereClause,
      include: { employee: true }
    });
    res.json(attendances);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/bulk_delete/', async (req, res) => {
  const { ids } = req.body;
  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: 'No IDs provided' });
  }

  try {
    const attendances = await prisma.attendance.findMany({
      where: { id: { in: ids } },
      select: { employeeId: true }
    });
    const empIds = attendances.map(a => a.employeeId);
    
    await prisma.employee.deleteMany({
      where: { mle: { in: empIds } }
    });
    
    res.json({ message: 'Deleted successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/manual_create/', async (req, res) => {
  const data = req.body;
  try {
    let employee = await prisma.employee.findUnique({ where: { mle: data.mle } });
    if (!employee) {
      employee = await prisma.employee.create({
        data: {
          mle: data.mle,
          mle_2: data.mle_2 || '',
          nom_prenom: data.nom_prenom || '',
          famille: data.famille || '',
          seg: data.seg || '',
          affectation: data.affectation || '',
          cc: data.cc || '',
          contrat: data.contrat || ''
        }
      });
    } else {
      employee = await prisma.employee.update({
        where: { mle: data.mle },
        data: {
          nom_prenom: data.nom_prenom || employee.nom_prenom,
          famille: data.famille || employee.famille,
          affectation: data.affectation || employee.affectation,
          contrat: data.contrat || employee.contrat
        }
      });
    }

    let att = await prisma.attendance.findFirst({
      where: { employeeId: employee.mle, date: new Date(data.date) }
    });

    if (att) {
      att = await prisma.attendance.update({
        where: { id: att.id },
        data: { statut: data.statut || 'Absent', heures_travaillees: 0 }
      });
    } else {
      att = await prisma.attendance.create({
        data: {
          employeeId: employee.mle,
          date: new Date(data.date),
          statut: data.statut || 'Absent',
          heures_travaillees: 0
        }
      });
    }

    const attWithEmp = await prisma.attendance.findUnique({
      where: { id: att.id },
      include: { employee: true }
    });
    res.json(attWithEmp);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/manual_update/:id', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const data = req.body;
  
  try {
    let att = await prisma.attendance.findUnique({
      where: { id },
      include: { employee: true }
    });
    if (!att) return res.status(404).json({ error: 'Not found' });

    await prisma.employee.update({
      where: { mle: att.employeeId },
      data: {
        nom_prenom: data.nom_prenom || att.employee.nom_prenom,
        famille: data.famille || att.employee.famille,
        affectation: data.affectation || att.employee.affectation,
        contrat: data.contrat || att.employee.contrat
      }
    });

    if (data.statut) {
      att = await prisma.attendance.update({
        where: { id },
        data: { statut: data.statut },
        include: { employee: true }
      });
    } else {
      // Fetch fresh again if only employee updated
      att = await prisma.attendance.findUnique({
        where: { id },
        include: { employee: true }
      });
    }

    res.json(att);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
