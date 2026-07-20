import React, { useEffect, useState } from 'react';
import { Box, Grid, Card, CardContent, Typography, Avatar, useTheme, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, FormControl, Select, MenuItem } from '@mui/material';
import { PeopleRounded, CheckCircleRounded, CancelRounded, PersonRemoveRounded, WarningRounded } from '@mui/icons-material';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import api from '../services/api';
import { motion } from 'framer-motion';

const StatCard = ({ title, value, icon, color, delay }: any) => (
  <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay, duration: 0.4 }}>
    <Card sx={{ borderRadius: 3, height: '100%' }}>
      <CardContent sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', p: 3 }}>
        <Box>
          <Typography variant="body2" color="text.secondary" fontWeight={600} gutterBottom>
            {title}
          </Typography>
          <Typography variant="h4" fontWeight="bold">
            {value}
          </Typography>
        </Box>
        <Avatar sx={{ bgcolor: `${color}.light`, color: `${color}.main`, width: 56, height: 56 }}>
          {icon}
        </Avatar>
      </CardContent>
    </Card>
  </motion.div>
);

const AlertCard = ({ famille, index }: any) => (
  <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.5 + index * 0.1 }}>
    <Card sx={{ borderRadius: 3, bgcolor: '#fef2f2', border: '1px solid #f87171' }}>
      <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        <WarningRounded sx={{ color: '#ef4444' }} />
        <Box>
          <Typography variant="body2" color="#991b1b" fontWeight="bold">Alerte Absences</Typography>
          <Typography variant="h6" color="#7f1d1d" fontWeight="bold">{famille}</Typography>
        </Box>
      </CardContent>
    </Card>
  </motion.div>
);

const Dashboard = () => {
  const theme = useTheme();
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [dailySelectedYear, setDailySelectedYear] = useState(new Date().getFullYear());
  const [dailySelectedMonth, setDailySelectedMonth] = useState(new Date().getMonth() + 1);
  const [dailySelectedWeek, setDailySelectedWeek] = useState(1);
  // Initialiser directement avec la date de Semaine 1 du mois courant (jour 1)
  // pour éviter une race condition entre la valeur initiale (today) et l'useEffect
  const [selectedDailyDate, setSelectedDailyDate] = useState(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}-01`; // Semaine 1 = jour 1 du mois
  });

  const [monthlyType, setMonthlyType] = useState('Absent');
  const [weeklyType, setWeeklyType] = useState('Absent');
  const [dailyType, setDailyType] = useState('Absent');
  const [departuresTimeframe, setDeparturesTimeframe] = useState('Mensuel');

  // États indépendants pour le Bilan des Départs
  const [depYear, setDepYear] = useState(new Date().getFullYear());
  const [depMonth, setDepMonth] = useState(new Date().getMonth() + 1);
  const [depWeek, setDepWeek] = useState(1);
  const [depDate, setDepDate] = useState(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}-01`;
  });

  const getWeeksInMonth = (year: number, month: number) => {
    // Nombre de blocs de 7 jours à partir du 1er du mois (1-7, 8-14, ..., dernier)
    const lastDay = new Date(year, month, 0).getDate();
    return Math.ceil(lastDay / 7);
  };

  const [stats, setStats] = useState({
    total_employees: 0,
    present_today: 0,
    absent_today: 0,
    total_departures: 0,
    top_absent_families: [] as any[],
    all_families_absences: [] as any[],
    family_effectifs: [] as any[],
    charts: { monthly_absences_table: [], monthly_departures_table: [], months_columns: [] }
  });

  const [weeklyStats, setWeeklyStats] = useState({
    weekly_absences_table: [],
    weekly_departures_table: [],
    weeks_columns: []
  });

  const [dailyStats, setDailyStats] = useState({
    daily_absences_table: [],
    daily_departures_table: [],
    days_columns: []
  });

  // Données indépendantes pour le Bilan des Départs
  const [depMonthlyStats, setDepMonthlyStats] = useState<any>({ monthly_departures_table: [], months_columns: [] });
  const [depWeeklyStats, setDepWeeklyStats] = useState<any>({ weekly_departures_table: [], weeks_columns: [] });
  const [depDailyStats, setDepDailyStats] = useState<any>({ daily_departures_table: [], days_columns: [] });

  const loadData = async () => {
    try {
      const res = await api.get(`dashboard/?year=${selectedYear}&statut=${monthlyType}`);
      setStats(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const loadWeeklyData = async () => {
    try {
      const res = await api.get(`dashboard/weekly/?year=${selectedYear}&month=${selectedMonth}&statut=${weeklyType}`);
      setWeeklyStats(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const loadDailyData = async () => {
    try {
      const res = await api.get(`dashboard/daily/?week_start=${selectedDailyDate}&statut=${dailyType}`);
      setDailyStats(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const loadDepMonthly = async () => {
    try {
      const res = await api.get(`dashboard/?year=${depYear}&statut=Absent`);
      setDepMonthlyStats({ monthly_departures_table: res.data.charts.monthly_departures_table, months_columns: res.data.charts.months_columns });
    } catch (err) { console.error(err); }
  };

  const loadDepWeekly = async () => {
    try {
      const res = await api.get(`dashboard/weekly/?year=${depYear}&month=${depMonth}&statut=Absent`);
      setDepWeeklyStats({ weekly_departures_table: res.data.weekly_departures_table, weeks_columns: res.data.weeks_columns });
    } catch (err) { console.error(err); }
  };

  const loadDepDaily = async () => {
    try {
      const res = await api.get(`dashboard/daily/?week_start=${depDate}&statut=Absent`);
      setDepDailyStats({ daily_departures_table: res.data.daily_departures_table, days_columns: res.data.days_columns });
    } catch (err) { console.error(err); }
  };

  useEffect(() => {
    loadData();
  }, [selectedYear, monthlyType]);

  useEffect(() => {
    loadWeeklyData();
  }, [selectedYear, selectedMonth, weeklyType]);

  useEffect(() => {
    // Calcul correct : le premier jour de la plage de la semaine du mois
    // Semaine 1 → jour 1, Semaine 2 → jour 8, Semaine 3 → jour 15, Semaine 4 → jour 22
    const firstDayOfWeek = (dailySelectedWeek - 1) * 7 + 1;
    const y = dailySelectedYear;
    const m = String(dailySelectedMonth).padStart(2, '0');
    const d2 = String(firstDayOfWeek).padStart(2, '0');
    setSelectedDailyDate(`${y}-${m}-${d2}`);
  }, [dailySelectedYear, dailySelectedMonth, dailySelectedWeek]);

  useEffect(() => {
    loadDailyData();
  }, [selectedDailyDate, dailyType]);

  // Effets pour le Bilan des Départs
  useEffect(() => {
    if (departuresTimeframe === 'Mensuel') loadDepMonthly();
  }, [departuresTimeframe, depYear]);

  useEffect(() => {
    if (departuresTimeframe === 'Hebdomadaire') loadDepWeekly();
  }, [departuresTimeframe, depYear, depMonth]);

  useEffect(() => {
    const firstDayOfWeek = (depWeek - 1) * 7 + 1;
    const y = depYear;
    const m = String(depMonth).padStart(2, '0');
    const d = String(firstDayOfWeek).padStart(2, '0');
    setDepDate(`${y}-${m}-${d}`);
  }, [depYear, depMonth, depWeek]);

  useEffect(() => {
    if (departuresTimeframe === 'Journalier') loadDepDaily();
  }, [departuresTimeframe, depDate]);

  useEffect(() => {
    // Recharger quand on change de timeframe
    if (departuresTimeframe === 'Mensuel') loadDepMonthly();
    else if (departuresTimeframe === 'Hebdomadaire') loadDepWeekly();
    else if (departuresTimeframe === 'Journalier') loadDepDaily();
  }, [departuresTimeframe]);

  const pieColors = ['#ef4444', '#f97316', '#eab308', '#3b82f6'];

  return (
    <Box>
      <Typography variant="h4" fontWeight="bold" color="text.primary" mb={4}>
        Dashboard
      </Typography>

      {/* KPI Cards */}
      <Grid container spacing={3} mb={4}>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard title="Total Employés" value={stats.total_employees} icon={<PeopleRounded fontSize="large" />} color="primary" delay={0.1} />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard title="Présents Aujourd'hui" value={stats.present_today} icon={<CheckCircleRounded fontSize="large" />} color="success" delay={0.2} />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard title="Absents Aujourd'hui" value={stats.absent_today} icon={<CancelRounded fontSize="large" />} color="error" delay={0.3} />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard title="Départs (4 abs)" value={stats.total_departures} icon={<PersonRemoveRounded fontSize="large" />} color="warning" delay={0.4} />
        </Grid>
      </Grid>

      {/* Top 4 Alertes Absences */}
      <Typography variant="h6" fontWeight="bold" mb={2}>
        Top 4 Familles les plus absentes
      </Typography>
      <Grid container spacing={2} mb={4}>
        {stats.top_absent_families.map((fam, i) => (
          <Grid item xs={12} sm={6} md={3} key={i}>
            <AlertCard famille={fam.employee__famille} index={i} />
          </Grid>
        ))}
      </Grid>

      {/* Charts & Effectif Table */}
      <Grid container spacing={3} mb={4}>
        <Grid item xs={12} md={8}>
          <Card sx={{ borderRadius: 4, p: 3, boxShadow: '0 4px 20px rgba(0,0,0,0.03)', border: '1px solid #f1f5f9' }}>
            <Typography variant="h6" fontWeight="bold" mb={3} color="text.primary">
              Évolution Globale des Absences
            </Typography>
            <Box sx={{ height: 400 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.all_families_absences} margin={{ top: 20, right: 30, left: 0, bottom: 20 }}>
                  <defs>
                    <linearGradient id="colorAbsences" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={theme.palette.primary.main} stopOpacity={0.9}/>
                      <stop offset="95%" stopColor={theme.palette.primary.main} stopOpacity={0.2}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis 
                    dataKey="employee__famille" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: '#64748b', fontSize: 13, fontWeight: 500 }}
                    dy={10}
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: '#64748b', fontSize: 13, fontWeight: 500 }}
                    dx={-10}
                  />
                  <Tooltip 
                    cursor={{fill: '#f8fafc'}}
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)' }}
                  />
                  <Bar 
                    dataKey="total_absences" 
                    name="Absences" 
                    fill="url(#colorAbsences)" 
                    radius={[8, 8, 0, 0]}
                    barSize={50}
                  />
                </BarChart>
              </ResponsiveContainer>
            </Box>
          </Card>
        </Grid>
        
        <Grid item xs={12} md={4}>
          <Card sx={{ borderRadius: 4, p: 3, boxShadow: '0 4px 20px rgba(0,0,0,0.03)', border: '1px solid #f1f5f9', height: '100%' }}>
            <Typography variant="h6" fontWeight="bold" mb={3} color="text.primary">
              Effectif par Famille
            </Typography>
            <TableContainer>
              <Table size="small">
                <TableHead sx={{ bgcolor: '#f8fafc' }}>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 'bold' }}>Famille</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 'bold' }}>Effectif</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {stats.family_effectifs?.map((row: any, i: number) => (
                    <TableRow key={i} sx={{ '&:last-child td, &:last-child th': { border: 0 } }}>
                      <TableCell>{row.famille}</TableCell>
                      <TableCell align="right">
                        <Box sx={{ display: 'inline-flex', alignItems: 'center', bgcolor: '#e0e7ff', color: '#4f46e5', px: 1.5, py: 0.5, borderRadius: 2, fontWeight: 'bold' }}>
                          {row.effectif}
                        </Box>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Card>
        </Grid>
      </Grid>

      {/* Table: Absences par famille et par mois */}
      {stats.charts?.monthly_absences_table && stats.charts.monthly_absences_table.length > 0 && (
        <>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 4, mb: 2 }}>
            <Typography variant="h6" fontWeight="bold">
              Bilan Mensuel des {monthlyType === 'Absent' ? 'Absences' : 'Présences'}
            </Typography>
            <Box sx={{ display: 'flex', gap: 2 }}>
              <FormControl size="small" sx={{ minWidth: 120 }}>
                <Select value={monthlyType} onChange={(e) => setMonthlyType(e.target.value as string)} sx={{ bgcolor: 'white', borderRadius: 2 }}>
                  <MenuItem value="Absent">Absences</MenuItem>
                  <MenuItem value="Present">Présences</MenuItem>
                </Select>
              </FormControl>
              <FormControl size="small" sx={{ minWidth: 120 }}>
                <Select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(Number(e.target.value))}
                  sx={{ bgcolor: 'white', borderRadius: 2 }}
                >
                  {[...Array(5)].map((_, i) => {
                    const y = new Date().getFullYear() - i;
                    return <MenuItem key={y} value={y}>{y}</MenuItem>;
                  })}
                </Select>
              </FormControl>
            </Box>
          </Box>
          <Card sx={{ borderRadius: 3, mb: 4, overflow: 'hidden', border: '1px solid #f1f5f9', boxShadow: 'none' }}>
            <TableContainer>
              <Table size="small">
                <TableHead sx={{ bgcolor: '#f8fafc' }}>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 'bold', minWidth: 100 }}>Famille</TableCell>
                    {stats.charts.months_columns.map((m: string) => (
                      <TableCell 
                        key={m} 
                        align="center" 
                        sx={{ 
                          fontWeight: 'bold', 
                          writingMode: 'vertical-rl', 
                          transform: 'rotate(180deg)', 
                          padding: '16px 8px' 
                        }}
                      >
                        {m}
                      </TableCell>
                    ))}
                    <TableCell align="center" sx={{ fontWeight: 'bold' }}>Taux</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {stats.charts.monthly_absences_table.map((row: any) => (
                    <TableRow key={row.famille} hover>
                      <TableCell sx={{ fontWeight: 'bold', color: theme.palette.primary.main, whiteSpace: 'nowrap' }}>
                        {row.famille}
                      </TableCell>
                      {stats.charts.months_columns.map((m: string) => (
                        <TableCell key={m} align="center">
                          {row[m]}
                        </TableCell>
                      ))}
                      <TableCell align="center" sx={{ fontWeight: 'bold', color: theme.palette.text.secondary }}>
                        {row.taux}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Card>
        </>
      )}

      {/* Table: Absences par famille et par semaine */}
      {weeklyStats.weekly_absences_table && weeklyStats.weekly_absences_table.length > 0 && (
        <>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 4, mb: 2 }}>
            <Typography variant="h6" fontWeight="bold">
              Bilan Hebdomadaire des {weeklyType === 'Absent' ? 'Absences' : 'Présences'}
            </Typography>
            <Box sx={{ display: 'flex', gap: 2 }}>
              <FormControl size="small" sx={{ minWidth: 120 }}>
                <Select value={weeklyType} onChange={(e) => setWeeklyType(e.target.value as string)} sx={{ bgcolor: 'white', borderRadius: 2 }}>
                  <MenuItem value="Absent">Absences</MenuItem>
                  <MenuItem value="Present">Présences</MenuItem>
                </Select>
              </FormControl>
              <FormControl size="small" sx={{ minWidth: 120 }}>
                <Select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(Number(e.target.value))}
                  sx={{ bgcolor: 'white', borderRadius: 2 }}
                >
                  {['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'].map((m, i) => (
                    <MenuItem key={i} value={i + 1}>{m}</MenuItem>
                  ))}
                </Select>
              </FormControl>
              <FormControl size="small" sx={{ minWidth: 120 }}>
                <Select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(Number(e.target.value))}
                  sx={{ bgcolor: 'white', borderRadius: 2 }}
                >
                  {[...Array(5)].map((_, i) => {
                    const y = new Date().getFullYear() - i;
                    return <MenuItem key={y} value={y}>{y}</MenuItem>;
                  })}
                </Select>
              </FormControl>
            </Box>
          </Box>
          <Card sx={{ borderRadius: 3, mb: 4, overflow: 'hidden', border: '1px solid #f1f5f9', boxShadow: 'none' }}>
            <TableContainer>
              <Table size="small">
                <TableHead sx={{ bgcolor: '#f8fafc' }}>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 'bold', minWidth: 100 }}>Famille</TableCell>
                    {weeklyStats.weeks_columns?.map((w: string) => (
                      <TableCell 
                        key={w} 
                        align="center" 
                        sx={{ 
                          fontWeight: 'bold', 
                          writingMode: 'vertical-rl', 
                          transform: 'rotate(180deg)', 
                          padding: '16px 8px' 
                        }}
                      >
                        {w}
                      </TableCell>
                    ))}
                    <TableCell align="center" sx={{ fontWeight: 'bold' }}>Taux</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {weeklyStats.weekly_absences_table?.map((row: any) => (
                    <TableRow key={row.famille} hover>
                      <TableCell sx={{ fontWeight: 'bold', color: theme.palette.primary.main, whiteSpace: 'nowrap' }}>
                        {row.famille}
                      </TableCell>
                      {weeklyStats.weeks_columns?.map((w: string) => (
                        <TableCell key={w} align="center">
                          {row[w]}
                        </TableCell>
                      ))}
                      <TableCell align="center" sx={{ fontWeight: 'bold', color: theme.palette.text.secondary }}>
                        {row.taux}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Card>
        </>
      )}

      {/* Table: Absences par famille et par jour */}
      {dailyStats.daily_absences_table && dailyStats.daily_absences_table.length > 0 && (
        <>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 4, mb: 2 }}>
            <Typography variant="h6" fontWeight="bold">
              Bilan Journalier des {dailyType === 'Absent' ? 'Absences' : 'Présences'}
            </Typography>
            <Box sx={{ display: 'flex', gap: 2 }}>
              <FormControl size="small" sx={{ minWidth: 120 }}>
                <Select value={dailyType} onChange={(e) => setDailyType(e.target.value as string)} sx={{ bgcolor: 'white', borderRadius: 2 }}>
                  <MenuItem value="Absent">Absences</MenuItem>
                  <MenuItem value="Present">Présences</MenuItem>
                </Select>
              </FormControl>
              <FormControl size="small" sx={{ minWidth: 120 }}>
                <Select
                  value={dailySelectedWeek}
                  onChange={(e) => setDailySelectedWeek(Number(e.target.value))}
                  sx={{ bgcolor: 'white', borderRadius: 2 }}
                >
                  {Array.from({length: getWeeksInMonth(dailySelectedYear, dailySelectedMonth)}, (_, i) => i + 1).map((w) => (
                    <MenuItem key={w} value={w}>Semaine {w}</MenuItem>
                  ))}
                </Select>
              </FormControl>
              <FormControl size="small" sx={{ minWidth: 120 }}>
                <Select
                  value={dailySelectedMonth}
                  onChange={(e) => {
                    setDailySelectedMonth(Number(e.target.value));
                    setDailySelectedWeek(1);
                  }}
                  sx={{ bgcolor: 'white', borderRadius: 2 }}
                >
                  {['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'].map((m, i) => (
                    <MenuItem key={i} value={i + 1}>{m}</MenuItem>
                  ))}
                </Select>
              </FormControl>
              <FormControl size="small" sx={{ minWidth: 120 }}>
                <Select
                  value={dailySelectedYear}
                  onChange={(e) => setDailySelectedYear(Number(e.target.value))}
                  sx={{ bgcolor: 'white', borderRadius: 2 }}
                >
                  {[...Array(5)].map((_, i) => {
                    const y = new Date().getFullYear() - i;
                    return <MenuItem key={y} value={y}>{y}</MenuItem>;
                  })}
                </Select>
              </FormControl>
            </Box>
          </Box>
          <Card sx={{ borderRadius: 3, mb: 4, overflow: 'hidden', border: '1px solid #f1f5f9', boxShadow: 'none' }}>
            <TableContainer>
              <Table size="small">
                <TableHead sx={{ bgcolor: '#f8fafc' }}>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 'bold', minWidth: 100 }}>Famille</TableCell>
                    {dailyStats.days_columns?.map((d: any) => (
                      <TableCell 
                        key={d.name} 
                        align="center" 
                        sx={{ 
                          fontWeight: 'bold', 
                          bgcolor: d.is_holiday ? '#fef3c7' : 'transparent',
                          color: d.is_holiday ? '#d97706' : 'inherit',
                          p: 2
                        }}
                      >
                        {d.name}
                        {d.is_holiday && <Typography variant="caption" display="block" fontWeight="bold">(Férié)</Typography>}
                      </TableCell>
                    ))}
                    <TableCell align="center" sx={{ fontWeight: 'bold' }}>Taux</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {dailyStats.daily_absences_table?.map((row: any) => (
                    <TableRow key={row.famille} hover>
                      <TableCell sx={{ fontWeight: 'bold', color: theme.palette.primary.main, whiteSpace: 'nowrap' }}>
                        {row.famille}
                      </TableCell>
                      {dailyStats.days_columns?.map((d: any) => (
                        <TableCell 
                          key={d.name} 
                          align="center"
                          sx={{ 
                            bgcolor: d.is_holiday ? '#fef3c7' : 'transparent',
                            color: d.is_holiday ? '#d97706' : 'inherit'
                          }}
                        >
                          {row[d.name]}
                        </TableCell>
                      ))}
                      <TableCell align="center" sx={{ fontWeight: 'bold', color: theme.palette.text.secondary }}>
                        {row.taux}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Card>
        </>
      )}
      {/* Table: Bilan des Départs */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 4, mb: 2 }}>
        <Typography variant="h6" fontWeight="bold">
          Bilan des Départs
        </Typography>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
          <FormControl size="small" sx={{ minWidth: 150 }}>
            <Select
              value={departuresTimeframe}
              onChange={(e) => { setDeparturesTimeframe(e.target.value as string); setDepWeek(1); }}
              sx={{ bgcolor: 'white', borderRadius: 2 }}
            >
              <MenuItem value="Mensuel">Mensuel</MenuItem>
              <MenuItem value="Hebdomadaire">Hebdomadaire</MenuItem>
              <MenuItem value="Journalier">Journalier</MenuItem>
            </Select>
          </FormControl>

          {/* Sélecteur Semaine — Journalier uniquement */}
          {departuresTimeframe === 'Journalier' && (
            <FormControl size="small" sx={{ minWidth: 120 }}>
              <Select
                value={depWeek}
                onChange={(e) => setDepWeek(Number(e.target.value))}
                sx={{ bgcolor: 'white', borderRadius: 2 }}
              >
                {Array.from({ length: getWeeksInMonth(depYear, depMonth) }, (_, i) => i + 1).map((w) => (
                  <MenuItem key={w} value={w}>Semaine {w}</MenuItem>
                ))}
              </Select>
            </FormControl>
          )}

          {/* Sélecteur Mois — Hebdomadaire & Journalier */}
          {(departuresTimeframe === 'Hebdomadaire' || departuresTimeframe === 'Journalier') && (
            <FormControl size="small" sx={{ minWidth: 120 }}>
              <Select
                value={depMonth}
                onChange={(e) => { setDepMonth(Number(e.target.value)); setDepWeek(1); }}
                sx={{ bgcolor: 'white', borderRadius: 2 }}
              >
                {['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'].map((m, i) => (
                  <MenuItem key={i} value={i + 1}>{m}</MenuItem>
                ))}
              </Select>
            </FormControl>
          )}

          {/* Sélecteur Année — toujours visible */}
          <FormControl size="small" sx={{ minWidth: 100 }}>
            <Select
              value={depYear}
              onChange={(e) => setDepYear(Number(e.target.value))}
              sx={{ bgcolor: 'white', borderRadius: 2 }}
            >
              {[...Array(5)].map((_, i) => {
                const y = new Date().getFullYear() - i;
                return <MenuItem key={y} value={y}>{y}</MenuItem>;
              })}
            </Select>
          </FormControl>
        </Box>
      </Box>

      <Card sx={{ borderRadius: 3, mb: 4, overflow: 'hidden', border: '1px solid #f1f5f9', boxShadow: 'none' }}>
        <TableContainer>
          <Table size="small">
            <TableHead sx={{ bgcolor: '#f8fafc' }}>
              <TableRow>
                <TableCell sx={{ fontWeight: 'bold', minWidth: 100 }}>Famille</TableCell>
                {departuresTimeframe === 'Mensuel' && depMonthlyStats.months_columns?.map((m: string) => (
                  <TableCell key={m} align="center" sx={{ fontWeight: 'bold', p: 2 }}>{m}</TableCell>
                ))}
                {departuresTimeframe === 'Hebdomadaire' && depWeeklyStats.weeks_columns?.map((w: string) => (
                  <TableCell key={w} align="center" sx={{ fontWeight: 'bold', p: 2 }}>{w}</TableCell>
                ))}
                {departuresTimeframe === 'Journalier' && depDailyStats.days_columns?.map((d: any) => (
                  <TableCell key={d.name} align="center" sx={{ fontWeight: 'bold', bgcolor: d.is_holiday ? '#fef3c7' : 'transparent', color: d.is_holiday ? '#d97706' : 'inherit', p: 2 }}>
                    {d.name}{d.is_holiday && <Typography variant="caption" display="block" fontWeight="bold">(Férié)</Typography>}
                  </TableCell>
                ))}
                <TableCell align="center" sx={{ fontWeight: 'bold' }}>Taux</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {departuresTimeframe === 'Mensuel' && depMonthlyStats.monthly_departures_table?.map((row: any) => (
                <TableRow key={row.famille} hover>
                  <TableCell sx={{ fontWeight: 'bold', color: theme.palette.primary.main }}>{row.famille}</TableCell>
                  {depMonthlyStats.months_columns?.map((m: string) => (
                    <TableCell key={m} align="center">{row[m]}</TableCell>
                  ))}
                  <TableCell align="center" sx={{ fontWeight: 'bold', color: theme.palette.text.secondary }}>{row.taux}</TableCell>
                </TableRow>
              ))}
              {departuresTimeframe === 'Hebdomadaire' && depWeeklyStats.weekly_departures_table?.map((row: any) => (
                <TableRow key={row.famille} hover>
                  <TableCell sx={{ fontWeight: 'bold', color: theme.palette.primary.main }}>{row.famille}</TableCell>
                  {depWeeklyStats.weeks_columns?.map((w: string) => (
                    <TableCell key={w} align="center">{row[w]}</TableCell>
                  ))}
                  <TableCell align="center" sx={{ fontWeight: 'bold', color: theme.palette.text.secondary }}>{row.taux}</TableCell>
                </TableRow>
              ))}
              {departuresTimeframe === 'Journalier' && depDailyStats.daily_departures_table?.map((row: any) => (
                <TableRow key={row.famille} hover>
                  <TableCell sx={{ fontWeight: 'bold', color: theme.palette.primary.main }}>{row.famille}</TableCell>
                  {depDailyStats.days_columns?.map((d: any) => (
                    <TableCell key={d.name} align="center" sx={{ bgcolor: d.is_holiday ? '#fef3c7' : 'transparent', color: d.is_holiday ? '#d97706' : 'inherit' }}>
                      {row[d.name]}
                    </TableCell>
                  ))}
                  <TableCell align="center" sx={{ fontWeight: 'bold', color: theme.palette.text.secondary }}>{row.taux}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>

    </Box>
  );
};

export default Dashboard;
