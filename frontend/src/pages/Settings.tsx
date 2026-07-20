import React, { useState, useEffect } from 'react';
import { Box, Typography, Card, CardContent, TextField, Button, Grid, Alert, Switch, Chip } from '@mui/material';
import api from '../services/api';
import { SaveRounded, DeleteRounded, AddRounded, VisibilityRounded, VisibilityOffRounded } from '@mui/icons-material';
import { IconButton, List, ListItem, ListItemText, ListItemSecondaryAction, Divider } from '@mui/material';

const Settings = () => {
  const [minHours, setMinHours] = useState(5.0);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [holidays, setHolidays] = useState<any[]>([]);
  const [newHolidayDate, setNewHolidayDate] = useState('');
  const [newHolidayDesc, setNewHolidayDesc] = useState('');
  const [families, setFamilies] = useState<{ famille: string; enabled: boolean }[]>([]);
  const [familySaving, setFamilySaving] = useState(false);
  const [familySuccess, setFamilySuccess] = useState(false);

  const [forceMle, setForceMle] = useState('');
  const [forceAbsences, setForceAbsences] = useState<number | ''>('');
  const [forceMsg, setForceMsg] = useState('');
  const [forceSuccess, setForceSuccess] = useState(false);
  const [forceError, setForceError] = useState('');

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const res = await api.get('settings/');
        setMinHours(res.data.min_working_hours);
      } catch (err) {
        console.error(err);
      }
    };
    const loadHolidays = async () => {
      try {
        const res = await api.get('public-holidays/');
        setHolidays(res.data);
      } catch (err) {
        console.error(err);
      }
    };
    const loadFamilies = async () => {
      try {
        const res = await api.get('families/');
        setFamilies(res.data);
      } catch (err) {
        console.error(err);
      }
    };
    loadSettings();
    loadHolidays();
    loadFamilies();
  }, []);

  const handleSave = async () => {
    setLoading(true);
    setSuccess(false);
    try {
      await api.put('settings/', { min_working_hours: minHours });
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  const handleToggleFamily = (famille: string) => {
    setFamilies(prev =>
      prev.map(f => f.famille === famille ? { ...f, enabled: !f.enabled } : f)
    );
  };

  const handleSaveFamilies = async () => {
    setFamilySaving(true);
    setFamilySuccess(false);
    try {
      const disabled = families.filter(f => !f.enabled).map(f => f.famille);
      await api.put('settings/', { disabled_families: disabled });
      setFamilySuccess(true);
      setTimeout(() => setFamilySuccess(false), 3000);
    } catch (err) {
      console.error(err);
    }
    setFamilySaving(false);
  };

  const handleAddHoliday = async () => {
    if (!newHolidayDate) return;
    try {
      await api.post('public-holidays/', { date: newHolidayDate, description: newHolidayDesc });
      setNewHolidayDate('');
      setNewHolidayDesc('');
      const res = await api.get('public-holidays/');
      setHolidays(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteHoliday = async (id: number) => {
    try {
      await api.delete(`public-holidays/${id}/`);
      const res = await api.get('public-holidays/');
      setHolidays(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleForceAbsences = async () => {
    setForceError('');
    setForceSuccess(false);
    setForceMsg('');
    const mleTrimmed = forceMle.trim();
    if (!mleTrimmed || forceAbsences === '') return;
    try {
      const res = await api.post('employees/force_absences/', { mle: mleTrimmed, absences: forceAbsences });
      setForceMsg(res.data.message || 'Mise à jour réussie.');
      setForceSuccess(true);
      setForceMle('');
      setForceAbsences('');
      setTimeout(() => setForceSuccess(false), 5000);
    } catch (err: any) {
      const msg = err.response?.data?.error 
        || err.response?.data?.detail 
        || JSON.stringify(err.response?.data) 
        || 'Erreur lors de la mise à jour.';
      setForceError(msg);
    }
  };

  return (
    <Box>
      <Typography variant="h4" fontWeight="bold" color="text.primary" mb={4}>
        Paramètres du Système
      </Typography>

      <Grid container spacing={3}>
        {/* Colonne de Gauche : Règles de présence + Jours fériés */}
        <Grid item xs={12} md={6}>
          <Card sx={{ borderRadius: 3, mb: 3 }}>
            <CardContent sx={{ p: 4 }}>
              <Typography variant="h6" fontWeight="bold" mb={2}>
                Règles de Présence
              </Typography>
              <Typography variant="body2" color="text.secondary" mb={4}>
                Définissez le seuil minimal d'heures travaillées pour qu'un employé soit considéré comme "Présent". 
                En dessous de ce seuil, l'employé sera marqué "Absent".
              </Typography>
              
              {success && <Alert severity="success" sx={{ mb: 3 }}>Paramètres sauvegardés avec succès.</Alert>}

              <TextField
                fullWidth
                label="Seuil minimum d'heures"
                type="number"
                inputProps={{ step: "0.1", min: "0", max: "24" }}
                value={minHours}
                onChange={(e) => setMinHours(parseFloat(e.target.value))}
                sx={{ mb: 3 }}
              />

              <Button 
                variant="contained" 
                color="primary" 
                startIcon={<SaveRounded />}
                onClick={handleSave}
                disabled={loading}
                sx={{ py: 1.5, px: 4 }}
              >
                Sauvegarder
              </Button>
            </CardContent>
          </Card>

          <Card sx={{ borderRadius: 3 }}>
            <CardContent sx={{ p: 4 }}>
              <Typography variant="h6" fontWeight="bold" mb={2}>
                Jours Fériés
              </Typography>
              <Typography variant="body2" color="text.secondary" mb={4}>
                Ajoutez les jours fériés. Lors de l'importation des pointages, les employés seront marqués comme "Férié" ces jours-là et cela ne comptera pas comme une absence.
              </Typography>

              <Grid container spacing={2} mb={3}>
                <Grid item xs={12} sm={5}>
                  <TextField
                    fullWidth
                    label="Date"
                    type="date"
                    InputLabelProps={{ shrink: true }}
                    value={newHolidayDate}
                    onChange={(e) => setNewHolidayDate(e.target.value)}
                  />
                </Grid>
                <Grid item xs={12} sm={5}>
                  <TextField
                    fullWidth
                    label="Description (Optionnel)"
                    value={newHolidayDesc}
                    onChange={(e) => setNewHolidayDesc(e.target.value)}
                  />
                </Grid>
                <Grid item xs={12} sm={2} display="flex" alignItems="center">
                  <Button 
                    variant="contained" 
                    color="primary" 
                    fullWidth 
                    sx={{ height: '100%' }}
                    onClick={handleAddHoliday}
                    disabled={!newHolidayDate}
                  >
                    <AddRounded />
                  </Button>
                </Grid>
              </Grid>

              <List sx={{ bgcolor: 'background.paper', borderRadius: 2, border: '1px solid #e2e8f0' }}>
                {holidays.map((h, i) => (
                  <React.Fragment key={h.id}>
                    <ListItem>
                      <ListItemText 
                        primary={h.date} 
                        secondary={h.description || 'Jour Férié'} 
                      />
                      <ListItemSecondaryAction>
                        <IconButton edge="end" color="error" onClick={() => handleDeleteHoliday(h.id)}>
                          <DeleteRounded />
                        </IconButton>
                      </ListItemSecondaryAction>
                    </ListItem>
                    {i < holidays.length - 1 && <Divider />}
                  </React.Fragment>
                ))}
                {holidays.length === 0 && (
                  <ListItem>
                    <ListItemText primary="Aucun jour férié configuré." />
                  </ListItem>
                )}
              </List>
            </CardContent>
          </Card>
        </Grid>

        {/* Colonne de Droite : Visibilité des familles */}
        <Grid item xs={12} md={6}>
          <Card sx={{ borderRadius: 3, mb: 3 }}>
            <CardContent sx={{ p: 4 }}>
              <Typography variant="h6" fontWeight="bold" mb={1}>
                Visibilité des Familles
              </Typography>
              <Typography variant="body2" color="text.secondary" mb={3}>
                Activez ou désactivez l'affichage de chaque famille dans les graphiques et tableaux du Dashboard. 
                Les données restent en base, seul l'affichage est masqué.
              </Typography>

              {familySuccess && <Alert severity="success" sx={{ mb: 2 }}>Visibilité sauvegardée avec succès.</Alert>}

              {families.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  Aucune famille trouvée. Importez un fichier RH d'abord.
                </Typography>
              ) : (
                <Box>
                  <List sx={{ bgcolor: 'background.paper', borderRadius: 2, border: '1px solid #e2e8f0', mb: 2 }}>
                    {families.map((f, i) => (
                      <React.Fragment key={f.famille}>
                        <ListItem>
                          <Box sx={{ mr: 2 }}>
                            {f.enabled 
                              ? <VisibilityRounded color="primary" fontSize="small" />
                              : <VisibilityOffRounded color="disabled" fontSize="small" />
                            }
                          </Box>
                          <ListItemText 
                            primary={
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <Typography fontWeight="bold">{f.famille}</Typography>
                                <Chip 
                                  label={f.enabled ? 'Affiché' : 'Masqué'} 
                                  size="small" 
                                  color={f.enabled ? 'success' : 'default'} 
                                  variant="outlined"
                                />
                              </Box>
                            }
                          />
                          <ListItemSecondaryAction>
                            <Switch
                              checked={f.enabled}
                              onChange={() => handleToggleFamily(f.famille)}
                              color="primary"
                            />
                          </ListItemSecondaryAction>
                        </ListItem>
                        {i < families.length - 1 && <Divider />}
                      </React.Fragment>
                    ))}
                  </List>
                  <Button
                    variant="contained"
                    color="primary"
                    startIcon={<SaveRounded />}
                    onClick={handleSaveFamilies}
                    disabled={familySaving}
                    sx={{ py: 1.5, px: 4 }}
                  >
                    Sauvegarder la visibilité
                  </Button>
                </Box>
              )}
            </CardContent>
          </Card>

          <Card sx={{ borderRadius: 3 }}>
            <CardContent sx={{ p: 4 }}>
              <Typography variant="h6" fontWeight="bold" mb={2}>
                Forcer les Absences Consécutives
              </Typography>
              <Typography variant="body2" color="text.secondary" mb={4}>
                Modifiez manuellement le compteur d'absences consécutives d'un employé. 
                S'il atteint ou dépasse 4, il apparaîtra dans le tableau des Départs.
              </Typography>

              {forceSuccess && <Alert severity="success" sx={{ mb: 2 }}>{forceMsg}</Alert>}
              {forceError && <Alert severity="error" sx={{ mb: 2 }}>{forceError}</Alert>}

              <Grid container spacing={2} mb={3}>
                <Grid item xs={12} sm={4}>
                  <TextField
                    fullWidth
                    label="MLE"
                    size="small"
                    value={forceMle}
                    onChange={(e) => setForceMle(e.target.value)}
                  />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <TextField
                    fullWidth
                    label="Nb Absences"
                    type="number"
                    size="small"
                    value={forceAbsences}
                    onChange={(e) => setForceAbsences(e.target.value === '' ? '' : parseInt(e.target.value))}
                  />
                </Grid>
                <Grid item xs={12} sm={4} display="flex" alignItems="center">
                  <Button 
                    variant="contained" 
                    color="primary" 
                    fullWidth 
                    sx={{ height: '100%' }}
                    onClick={handleForceAbsences}
                    disabled={!forceMle || forceAbsences === ''}
                  >
                    Appliquer
                  </Button>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default Settings;
