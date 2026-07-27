import express from 'express';
import prisma from '../prisma';

const router = express.Router();

router.get('/settings/', async (req, res) => {
  try {
    let settings = await prisma.settings.findUnique({ where: { id: 1 } });
    if (!settings) {
      settings = await prisma.settings.create({ data: { id: 1 } });
    }
    res.json(settings);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/settings/', async (req, res) => {
  const { min_working_hours, disabled_families } = req.body;
  try {
    const data: any = {};
    if (min_working_hours !== undefined) data.min_working_hours = parseFloat(min_working_hours);
    if (disabled_families !== undefined) data.disabled_families = disabled_families;

    const settings = await prisma.settings.upsert({
      where: { id: 1 },
      update: data,
      create: { id: 1, ...data }
    });
    res.json(settings);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/saturday-config/', async (req, res) => {
  try {
    const configs = await prisma.saturdayConfiguration.findMany();
    res.json(configs);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/saturday-config/', async (req, res) => {
  const { date, families_off } = req.body;
  try {
    const config = await prisma.saturdayConfiguration.create({
      data: {
        date: new Date(date),
        families_off: families_off || []
      }
    });
    res.json(config);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/saturday-config/:id', async (req, res) => {
  try {
    await prisma.saturdayConfiguration.delete({ where: { id: parseInt(req.params.id, 10) } });
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/public-holidays/', async (req, res) => {
  try {
    const holidays = await prisma.publicHoliday.findMany({ orderBy: { date: 'desc' } });
    res.json(holidays);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/public-holidays/', async (req, res) => {
  const { date, description } = req.body;
  try {
    const holiday = await prisma.publicHoliday.create({
      data: {
        date: new Date(date),
        description
      }
    });
    res.json(holiday);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/public-holidays/:id', async (req, res) => {
  try {
    await prisma.publicHoliday.delete({ where: { id: parseInt(req.params.id, 10) } });
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/families/', async (req, res) => {
  try {
    const allFamilies = await prisma.employee.findMany({
      where: { famille: { not: '' } },
      select: { famille: true },
      distinct: ['famille']
    });
    
    let settings = await prisma.settings.findUnique({ where: { id: 1 } });
    const disabled = (settings?.disabled_families as string[]) || [];

    const familiesData = allFamilies.map(f => ({
      famille: f.famille,
      enabled: !disabled.includes(f.famille)
    }));

    res.json(familiesData);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
