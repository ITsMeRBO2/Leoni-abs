import React, { useState, useEffect } from 'react';
import { Box, Typography, Card, Chip, Button, TextField, Snackbar, Alert, Dialog, DialogTitle, DialogContent, DialogActions, FormControl, InputLabel, Select, MenuItem } from '@mui/material';
import { 
  DataGrid, GridColDef, GridToolbarContainer, GridToolbarColumnsButton, 
  GridToolbarFilterButton, GridToolbarDensitySelector 
} from '@mui/x-data-grid';
import { DeleteRounded, DownloadRounded, RestartAltRounded, AddRounded } from '@mui/icons-material';
import api from '../services/api';

const Departures = () => {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectionModel, setSelectionModel] = useState<any[]>([]);
  const [tableDateFilter, setTableDateFilter] = useState('');
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({ open: false, message: '', severity: 'success' });

  // Modal manuel
  const [openModal, setOpenModal] = useState(false);
  const [formData, setFormData] = useState({ mle: '', nom_prenom: '', famille: '', affectation: '', contrat: '', date: new Date().toISOString().split('T')[0] });

  const columns: GridColDef[] = [
    { field: 'mle', headerName: 'MLE', width: 100, valueGetter: (value, row: any) => row.employee?.mle },
    { field: 'nom', headerName: 'Nom & Prénom', width: 200, valueGetter: (value, row: any) => row.employee?.nom_prenom },
    { field: 'famille', headerName: 'Famille', width: 120, valueGetter: (value, row: any) => row.employee?.famille },
    { field: 'affectation', headerName: 'Affectation', width: 150, valueGetter: (value, row: any) => row.employee?.affectation },
    { field: 'contrat', headerName: 'Contrat', width: 120, valueGetter: (value, row: any) => row.employee?.contrat },
    { 
      field: 'absences_count', 
      headerName: 'Absences Consécutives', 
      width: 180,
      renderCell: (params) => (
        <Chip label={`${params.value} abs`} color="error" size="small" />
      )
    },
    { field: 'date_added', headerName: 'Date d\'entrée', width: 150 },
  ];

  const loadData = async () => {
    setLoading(true);
    try {
      const url = tableDateFilter ? `departures/?date=${tableDateFilter}` : 'departures/';
      const res = await api.get(url);
      setRows(res.data);
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, [tableDateFilter]);

  const handleDeleteSelected = async () => {
    if (!window.confirm(`ATTENTION : Cette action supprimera DÉFINITIVEMENT ${selectionModel.length} employé(s) de la base de données, y compris tout leur historique d'absences.\n\nÊtes-vous sûr ?`)) return;
    try {
      await api.post('departures/bulk_delete/', { ids: selectionModel });
      setSelectionModel([]);
      loadData();
    } catch (err) {
      console.error(err);
      alert('Erreur lors de la suppression');
    }
  };

  const handleResetAbsences = async () => {
    if (!window.confirm(`Réinitialiser le compteur d'absences consécutives pour ${selectionModel.length} employé(s) sélectionné(s) ?\n\nCes employés seront retirés de la liste des départs.`)) return;
    try {
      const res = await api.post('departures/reset_absences/', { ids: selectionModel });
      setSelectionModel([]);
      loadData();
      setSnackbar({ open: true, message: res.data.message, severity: 'success' });
    } catch (err) {
      console.error(err);
      setSnackbar({ open: true, message: 'Erreur lors de la réinitialisation', severity: 'error' });
    }
  };

  const handleResetAllAbsences = async () => {
    if (!window.confirm(`Êtes-vous sûr de vouloir réinitialiser TOUTES les absences de la liste des départs ?\n\nTous les employés seront retirés de cette liste.`)) return;
    try {
      const res = await api.post('departures/reset_all_absences/');
      setSelectionModel([]);
      loadData();
      setSnackbar({ open: true, message: res.data.message, severity: 'success' });
    } catch (err) {
      console.error(err);
      setSnackbar({ open: true, message: 'Erreur lors de la réinitialisation globale', severity: 'error' });
    }
  };

  const handleManualCreate = async () => {
    if (!formData.mle || !formData.nom_prenom || !formData.famille) {
      alert("Veuillez remplir les champs obligatoires (MLE, Nom, Famille)");
      return;
    }
    try {
      await api.post('departures/manual_create/', formData);
      setOpenModal(false);
      loadData();
      setSnackbar({ open: true, message: 'Employé ajouté aux départs', severity: 'success' });
    } catch (err) {
      console.error(err);
      alert("Erreur lors de la création");
    }
  };

  const handleExportExcel = async () => {
    try {
      const url = tableDateFilter ? `departures/export_excel/?date=${tableDateFilter}` : 'departures/export_excel/';
      const response = await api.get(url, { responseType: 'blob' });
      const blob = new Blob([response.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const link = document.createElement('a');
      link.href = window.URL.createObjectURL(blob);
      link.download = `Export_Departs_${tableDateFilter || 'Global'}.xlsx`;
      link.click();
    } catch (err) {
      console.error(err);
      alert('Erreur lors de l\'exportation Excel');
    }
  };

  const CustomToolbar = () => (
    <GridToolbarContainer sx={{ display: 'flex', justifyContent: 'space-between', p: 1, borderBottom: '1px solid #f1f5f9' }}>
      <Box>
        <GridToolbarColumnsButton />
        <GridToolbarFilterButton />
        <GridToolbarDensitySelector />
        <Button size="small" onClick={handleExportExcel} startIcon={<DownloadRounded />}>
          Exporter Excel
        </Button>
      </Box>
      <Box sx={{ display: 'flex', gap: 1 }}>
        <Button 
          size="small" 
          color="warning" 
          variant="outlined" 
          startIcon={<RestartAltRounded />} 
          onClick={handleResetAllAbsences}
          sx={{ borderColor: '#f59e0b', color: '#d97706', '&:hover': { bgcolor: '#fef3c7', borderColor: '#d97706' } }}
        >
          Réinitialiser Tout
        </Button>
        <Button 
          size="small" 
          color="primary" 
          variant="contained" 
          startIcon={<AddRounded />} 
          onClick={() => setOpenModal(true)}
          disableElevation
        >
          Créer Employé
        </Button>
        <Button 
          size="small" 
          color="warning" 
          variant="contained" 
          startIcon={<RestartAltRounded />} 
          onClick={handleResetAbsences}
          disableElevation
          disabled={selectionModel.length === 0}
          sx={{ bgcolor: '#f59e0b', '&:hover': { bgcolor: '#d97706' } }}
        >
          Réinitialiser Sélection
        </Button>
        <Button 
          size="small" 
          color="error" 
          variant="contained" 
          startIcon={<DeleteRounded />} 
          onClick={handleDeleteSelected}
          disableElevation
          disabled={selectionModel.length === 0}
        >
          Supprimer Sélection
        </Button>
      </Box>
    </GridToolbarContainer>
  );

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
        <Box>
          <Typography variant="h4" fontWeight="bold" color="text.primary" mb={1}>
            Liste des Départs <Typography component="span" variant="h5" color="text.secondary">({rows.length} employés)</Typography>
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Employés ayant accumulé 4 absences consécutives ou plus.
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
          <TextField
            label="Afficher pour le :"
            type="date"
            size="small"
            value={tableDateFilter}
            onChange={(e) => setTableDateFilter(e.target.value)}
            InputLabelProps={{ shrink: true }}
            sx={{ bgcolor: 'white', borderRadius: 1 }}
          />
        </Box>
      </Box>

      <Card sx={{ height: 'calc(100vh - 180px)', minHeight: 600, width: '100%', borderRadius: 3, p: 1 }}>
        <DataGrid
          rows={rows}
          columns={columns}
          loading={loading}
          slots={{ toolbar: CustomToolbar }}
          slotProps={{ toolbar: { showQuickFilter: true } }}
          checkboxSelection
          disableRowSelectionOnClick
          onRowSelectionModelChange={(newSelectionModel) => {
            setSelectionModel(newSelectionModel);
          }}
          rowSelectionModel={selectionModel}
          sx={{ border: 'none' }}
        />
      </Card>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar(s => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity={snackbar.severity} sx={{ width: '100%' }} onClose={() => setSnackbar(s => ({ ...s, open: false }))}>
          {snackbar.message}
        </Alert>
      </Snackbar>

      {/* Modal Création Manuelle */}
      <Dialog open={openModal} onClose={() => setOpenModal(false)} maxWidth="sm" fullWidth>
        <DialogTitle fontWeight="bold">Créer un Employé (Départ)</DialogTitle>
        <DialogContent dividers>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <TextField
              label="Date d'entrée"
              type="date"
              size="small"
              value={formData.date}
              onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              InputLabelProps={{ shrink: true }}
              required
            />
            <TextField
              label="MLE"
              size="small"
              value={formData.mle}
              onChange={(e) => setFormData({ ...formData, mle: e.target.value })}
              required
            />
            <TextField
              label="Nom & Prénom"
              size="small"
              value={formData.nom_prenom}
              onChange={(e) => setFormData({ ...formData, nom_prenom: e.target.value })}
              required
            />
            <FormControl size="small" required>
              <InputLabel>Famille</InputLabel>
              <Select
                value={formData.famille}
                label="Famille"
                onChange={(e) => setFormData({ ...formData, famille: e.target.value })}
              >
                {['CMA 2', 'CMA 3', 'MEP1', 'GPA-A', 'GPA-B', 'GPA', 'MAJORS'].map(f => (
                  <MenuItem key={f} value={f}>{f}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              label="Affectation"
              size="small"
              value={formData.affectation}
              onChange={(e) => setFormData({ ...formData, affectation: e.target.value })}
            />
            <TextField
              label="Contrat"
              size="small"
              value={formData.contrat}
              onChange={(e) => setFormData({ ...formData, contrat: e.target.value })}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenModal(false)}>Annuler</Button>
          <Button variant="contained" onClick={handleManualCreate}>Créer et Ajouter</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Departures;
