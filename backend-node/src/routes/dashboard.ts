import express from 'express';
import prisma from '../prisma';

const router = express.Router();

router.get('/dashboard/', async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const latestAtt = await prisma.attendance.findFirst({
      orderBy: { date: 'desc' },
      select: { date: true }
    });
    const latestDate = latestAtt?.date;

    const settings = await prisma.settings.findUnique({ where: { id: 1 } });
    const disabledFamilies = (settings?.disabled_families as string[]) || [];

    const total_employees = latestDate ? await prisma.attendance.count({
      where: {
        date: latestDate,
        employee: { famille: { notIn: disabledFamilies } }
      }
    }) : 0;

    const present_today = await prisma.attendance.count({
      where: {
        date: today,
        statut: 'Present',
        employee: { famille: { notIn: disabledFamilies } }
      }
    });

    const absent_today = await prisma.attendance.count({
      where: {
        date: today,
        statut: 'Absent',
        employee: { famille: { notIn: disabledFamilies } }
      }
    });

    const total_departures = await prisma.departure.count({
      where: {
        employee: { famille: { notIn: disabledFamilies } }
      }
    });

    // All absent families
    const all_absent_families_query = await prisma.attendance.groupBy({
      by: ['employeeId'],
      where: {
        statut: 'Absent',
        employee: { famille: { notIn: disabledFamilies } }
      },
      _count: { id: true }
    });
    
    // We need to group by family, but Prisma groupBy on relation field is not directly supported without raw SQL or joining in JS
    // Let's use JS aggregation
    const allAbsences = await prisma.attendance.findMany({
      where: {
        statut: 'Absent',
        employee: { famille: { notIn: disabledFamilies } }
      },
      include: { employee: { select: { famille: true } } }
    });

    const familyAbsenceMap: Record<string, number> = {};
    for (const a of allAbsences) {
      if (a.employee && a.employee.famille) {
        familyAbsenceMap[a.employee.famille] = (familyAbsenceMap[a.employee.famille] || 0) + 1;
      }
    }

    const all_absent_families = Object.entries(familyAbsenceMap)
      .map(([fam, count]) => ({ employee__famille: fam, total_absences: count }))
      .sort((a, b) => b.total_absences - a.total_absences);

    const top_absent_families = all_absent_families.slice(0, 4);

    const targetYearStr = req.query.year as string;
    const statut_filter = (req.query.statut as string) || 'Absent';
    const curr_year = targetYearStr ? parseInt(targetYearStr, 10) : today.getFullYear();

    const months_data = [
      'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
    ].map((name, index) => ({ year: curr_year, month: index + 1, name }));

    const activeFamilies = await prisma.employee.findMany({
      where: { famille: { not: '', notIn: disabledFamilies } },
      select: { famille: true },
      distinct: ['famille']
    });

    const monthly_absences_table = [];
    const monthly_departures_table = [];
    const family_effectifs = [];

    for (const f of activeFamilies) {
      const fam = f.famille;
      const row: any = { famille: fam };
      const dep_row: any = { famille: fam };
      let total_target = 0;
      let total_deps = 0;
      let total_effectif = 0;

      const fam_total_employees = latestDate ? await prisma.attendance.count({
        where: { date: latestDate, employee: { famille: fam } }
      }) : 0;

      family_effectifs.push({ famille: fam, effectif: fam_total_employees });

      for (const m of months_data) {
        // Date range for the month
        const startDate = new Date(m.year, m.month - 1, 1);
        const endDate = new Date(m.year, m.month, 0); // last day of month

        const baseAtts = await prisma.attendance.findMany({
          where: {
            employee: { famille: fam },
            date: { gte: startDate, lte: endDate }
          }
        });

        const count = baseAtts.filter(a => a.statut === statut_filter).length;
        row[m.name] = count;
        total_target += count;
        total_effectif += baseAtts.length;

        const depCount = await prisma.departure.count({
          where: {
            employee: { famille: fam },
            date_added: { gte: startDate, lte: endDate }
          }
        });
        dep_row[m.name] = depCount;
        total_deps += depCount;
      }

      row['taux'] = total_effectif > 0 ? Number((total_target / total_effectif).toFixed(2)) : 0;
      dep_row['taux'] = total_effectif > 0 ? Number((total_deps / total_effectif).toFixed(2)) : 0;

      monthly_absences_table.push(row);
      monthly_departures_table.push(dep_row);
    }

    const absences_by_family_full = activeFamilies.map(f => ({
      employee__famille: f.famille,
      total_absences: familyAbsenceMap[f.famille] || 0
    })).sort((a, b) => b.total_absences - a.total_absences);

    res.json({
      total_employees,
      present_today,
      absent_today,
      total_departures,
      top_absent_families,
      all_families_absences: all_absent_families,
      family_effectifs,
      charts: {
        absences_by_family: absences_by_family_full,
        monthly_absences_table,
        monthly_departures_table,
        months_columns: months_data.map(m => m.name)
      }
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Implement DashboardWeeklyView and DashboardDailyView similarly...
router.get('/dashboard/weekly/', async (req, res) => {
  try {
    const today = new Date();
    const year = req.query.year ? parseInt(req.query.year as string, 10) : today.getFullYear();
    const month = req.query.month ? parseInt(req.query.month as string, 10) : today.getMonth() + 1;
    const statut_filter = (req.query.statut as string) || 'Absent';

    const lastDay = new Date(year, month, 0).getDate();
    const weeks = [];
    let week_num = 1;
    let start = 1;
    while (start <= lastDay) {
      let end = Math.min(start + 6, lastDay);
      weeks.push({ name: `Semaine ${week_num}`, start, end });
      week_num++;
      start += 7;
    }

    const settings = await prisma.settings.findUnique({ where: { id: 1 } });
    const disabledFamilies = (settings?.disabled_families as string[]) || [];

    const activeFamilies = await prisma.employee.findMany({
      where: { famille: { not: '', notIn: disabledFamilies } },
      select: { famille: true },
      distinct: ['famille']
    });

    const weekly_absences_table = [];
    const weekly_departures_table = [];

    for (const f of activeFamilies) {
      const fam = f.famille;
      const row: any = { famille: fam };
      const dep_row: any = { famille: fam };
      let total_target = 0;
      let total_deps = 0;
      let total_effectif = 0;

      for (const w of weeks) {
        const startDate = new Date(year, month - 1, w.start);
        const endDate = new Date(year, month - 1, w.end);

        const baseAtts = await prisma.attendance.findMany({
          where: {
            employee: { famille: fam },
            date: { gte: startDate, lte: endDate }
          }
        });

        const count = baseAtts.filter(a => a.statut === statut_filter).length;
        row[w.name] = count;
        total_target += count;
        total_effectif += baseAtts.length;

        const depCount = await prisma.departure.count({
          where: {
            employee: { famille: fam },
            date_added: { gte: startDate, lte: endDate }
          }
        });
        dep_row[w.name] = depCount;
        total_deps += depCount;
      }

      row['taux'] = total_effectif > 0 ? Number((total_target / total_effectif).toFixed(2)) : 0;
      dep_row['taux'] = total_effectif > 0 ? Number((total_deps / total_effectif).toFixed(2)) : 0;

      weekly_absences_table.push(row);
      weekly_departures_table.push(dep_row);
    }

    res.json({
      weekly_absences_table,
      weekly_departures_table,
      weeks_columns: weeks.map(w => w.name)
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/dashboard/daily/', async (req, res) => {
  try {
    const weekStartStr = req.query.week_start as string;
    const statut_filter = (req.query.statut as string) || 'Absent';
    
    let startDate = new Date();
    startDate.setHours(0,0,0,0);
    if (weekStartStr) {
      startDate = new Date(weekStartStr);
    } else {
      const day = startDate.getDay();
      const diff = startDate.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
      startDate.setDate(diff);
    }

    const endOfMonth = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 0);
    
    const dayNamesMap = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
    const days = [];
    
    for (let i = 0; i < 7; i++) {
      const currentDate = new Date(startDate);
      currentDate.setDate(startDate.getDate() + i);
      
      if (currentDate > endOfMonth) break;
      
      const wd = currentDate.getDay();
      if (wd === 0) continue; // Skip sunday
      
      const is_holiday = await prisma.publicHoliday.findUnique({
        where: { date: currentDate }
      });
      
      days.push({
        date: currentDate.toISOString().split('T')[0],
        name: dayNamesMap[wd],
        is_holiday: !!is_holiday,
        dateObj: currentDate
      });
    }

    const settings = await prisma.settings.findUnique({ where: { id: 1 } });
    const disabledFamilies = (settings?.disabled_families as string[]) || [];

    const activeFamilies = await prisma.employee.findMany({
      where: { famille: { not: '', notIn: disabledFamilies } },
      select: { famille: true },
      distinct: ['famille']
    });

    const daily_absences_table = [];
    const daily_departures_table = [];

    for (const f of activeFamilies) {
      const fam = f.famille;
      const row: any = { famille: fam };
      const dep_row: any = { famille: fam };
      let total_target = 0;
      let total_deps = 0;
      let total_effectif = 0;

      for (const d of days) {
        if (d.is_holiday) {
          row[d.name] = '-';
          dep_row[d.name] = '-';
        } else {
          const baseAtts = await prisma.attendance.findMany({
            where: {
              employee: { famille: fam },
              date: d.dateObj
            }
          });

          const count = baseAtts.filter(a => a.statut === statut_filter).length;
          row[d.name] = count;
          total_target += count;
          total_effectif += baseAtts.length;

          const depCount = await prisma.departure.count({
            where: {
              employee: { famille: fam },
              date_added: d.dateObj
            }
          });
          dep_row[d.name] = depCount;
          total_deps += depCount;
        }
      }

      row['taux'] = total_effectif > 0 ? Number((total_target / total_effectif).toFixed(2)) : 0;
      dep_row['taux'] = total_effectif > 0 ? Number((total_deps / total_effectif).toFixed(2)) : 0;

      daily_absences_table.push(row);
      daily_departures_table.push(dep_row);
    }

    res.json({
      daily_absences_table,
      daily_departures_table,
      days_columns: days.map(d => ({ date: d.date, name: d.name, is_holiday: d.is_holiday }))
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
