import express from 'express';
import prisma from '../prisma';

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const employees = await prisma.employee.findMany();
    res.json(employees);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/force_absences/', async (req, res) => {
  const { mle, absences } = req.body;
  if (!mle || absences === undefined) {
    return res.status(400).json({ error: 'MLE et nombre d\'absences sont requis.' });
  }

  try {
    const absencesNum = parseInt(absences, 10);
    if (isNaN(absencesNum)) {
      return res.status(400).json({ error: 'Le nombre d\'absences doit être un nombre valide.' });
    }

    let employee = await prisma.employee.findUnique({ where: { mle: String(mle) } });
    
    // Case insensitive fallback (Prisma doesn't have a great case-insensitive findUnique if it's not the id)
    if (!employee) {
      const allEmps = await prisma.employee.findMany({
        where: { mle: { equals: String(mle), mode: 'insensitive' } }
      });
      if (allEmps.length > 0) employee = allEmps[0];
    }

    if (!employee) {
      return res.status(404).json({ error: 'Employé introuvable avec ce MLE.' });
    }

    await prisma.employee.update({
      where: { mle: employee.mle },
      data: { consecutive_absences: absencesNum }
    });

    if (absencesNum >= 4) {
      // Upsert departure
      const existingDep = await prisma.departure.findFirst({ where: { employeeId: employee.mle } });
      if (existingDep) {
        await prisma.departure.update({
          where: { id: existingDep.id },
          data: { absences_count: absencesNum }
        });
      } else {
        await prisma.departure.create({
          data: {
            employeeId: employee.mle,
            absences_count: absencesNum
          }
        });
      }
    } else {
      await prisma.departure.deleteMany({ where: { employeeId: employee.mle } });
    }

    res.json({ message: `Absences consécutives mises à jour à ${absences} pour l'employé ${employee.mle} (${employee.nom_prenom}).` });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
