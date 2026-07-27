import express from 'express';
import prisma from '../prisma';

const router = express.Router();

router.get('/', async (req, res) => {
  const { date } = req.query;
  try {
    const whereClause = date ? { date_added: new Date(date as string) } : {};
    const departures = await prisma.departure.findMany({
      where: whereClause,
      include: { employee: true }
    });
    res.json(departures);
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
    const departures = await prisma.departure.findMany({
      where: { id: { in: ids } },
      select: { employeeId: true }
    });
    const empIds = departures.map(d => d.employeeId);
    
    await prisma.employee.deleteMany({
      where: { mle: { in: empIds } }
    });
    
    res.json({ message: 'Deleted successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/reset_absences/', async (req, res) => {
  const { ids } = req.body;
  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: 'No IDs provided' });
  }

  try {
    const departures = await prisma.departure.findMany({
      where: { id: { in: ids } }
    });

    let resetCount = 0;
    for (const dep of departures) {
      await prisma.employee.update({
        where: { mle: dep.employeeId },
        data: { consecutive_absences: 0 }
      });
      await prisma.departure.delete({ where: { id: dep.id } });
      resetCount++;
    }

    res.json({ message: `${resetCount} employé(s) réinitialisé(s) avec succès` });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/reset_all_absences/', async (req, res) => {
  try {
    const result = await prisma.employee.updateMany({
      data: { consecutive_absences: 0 }
    });
    await prisma.departure.deleteMany({});
    
    res.json({ message: `${result.count} employé(s) réinitialisé(s) avec succès` });
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
          contrat: data.contrat || '',
          consecutive_absences: 4
        }
      });
    } else {
      employee = await prisma.employee.update({
        where: { mle: data.mle },
        data: {
          nom_prenom: data.nom_prenom || employee.nom_prenom,
          famille: data.famille || employee.famille,
          affectation: data.affectation || employee.affectation,
          contrat: data.contrat || employee.contrat,
          consecutive_absences: 4
        }
      });
    }

    let dep = await prisma.departure.findFirst({
      where: { employeeId: employee.mle }
    });

    if (!dep) {
      dep = await prisma.departure.create({
        data: {
          employeeId: employee.mle,
          absences_count: 4,
          date_added: data.date ? new Date(data.date) : new Date()
        }
      });
    } else if (data.date) {
      dep = await prisma.departure.update({
        where: { id: dep.id },
        data: { date_added: new Date(data.date) }
      });
    }

    const depWithEmp = await prisma.departure.findUnique({
      where: { id: dep.id },
      include: { employee: true }
    });
    res.json(depWithEmp);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
