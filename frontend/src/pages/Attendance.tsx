import React, { useState, useEffect } from 'react';
import { 
  Box, Typography, Button, Card, Dialog, DialogTitle, DialogContent, DialogActions, 
  Stepper, Step, StepLabel, TextField, Chip, FormControl, InputLabel, Select, MenuItem, Autocomplete, IconButton
} from '@mui/material';
import { 
  DataGrid, GridColDef, GridToolbarContainer, GridToolbarColumnsButton, 
  GridToolbarFilterButton, GridToolbarDensitySelector 
} from '@mui/x-data-grid';
import { UploadFileRounded, AddRounded, DownloadRounded, DeleteRounded, EditRounded } from '@mui/icons-material';
import { motion } from 'framer-motion';
import api from '../services/api';

const FAMILIES = ['CMA 2', 'CMA 3', 'MEP1', 'GPA-A', 'GPA-B', 'GPA', 'MAJORS'];

const Attendance = () => {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [openImport, setOpenImport] = useState(false);
  const [activeStep, setActiveStep] = useState(0);
  const [importDate, setImportDate] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [selectedFamiliesOff, setSelectedFamiliesOff] = useState<string[]>([]);
  const [isSaturday, setIsSaturday] = useState(false);
  const [tableDateFilter, setTableDateFilter] = useState(new Date().toISOString().split('T')[0]);
  const [selectedFamiliesToExtract, setSelectedFamiliesToExtract] = useState<string[]>(FAMILIES);
  const [selectionModel, setSelectionModel] = useState<any[]>([]);

  // Modal manuel
  const [openModal, setOpenModal] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [formData, setFormData] = useState({ mle: '', nom_prenom: '', famille: '', affectation: '', contrat: '', date: tableDateFilter, statut: 'Absent' });

  const openCreateModal = () => {
    setIsEditMode(false);
    setEditId(null);
    setFormData({ mle: '', nom_prenom: '', famille: '', affectation: '', contrat: '', date: tableDateFilter, statut: 'Absent' });
    setOpenModal(true);
  };

  const openEditModal = (row: any) => {
    setIsEditMode(true);
    setEditId(row.id);
    setFormData({
      mle: row.employee?.mle || '',
      nom_prenom: row.employee?.nom_prenom || '',
      famille: row.employee?.famille || '',
      affectation: row.employee?.affectation || '',
      contrat: row.employee?.contrat || '',
      date: row.date,
      statut: row.statut
    });
    setOpenModal(true);
  };

  const handleManualSave = async () => {
    if (!formData.mle || !formData.nom_prenom || !formData.famille) {
      alert("Veuillez remplir les champs obligatoires (MLE, Nom, Famille)");
      return;
    }
    try {
      if (isEditMode && editId) {
        await api.put(`attendance/${editId}/manual_update/`, formData);
      } else {
        await api.post('attendance/manual_create/', formData);
      }
      setOpenModal(false);
      loadData();
    } catch (err) {
      console.error(err);
      alert("Erreur lors de l'enregistrement");
    }
  };

  const columns: GridColDef[] = [
    { field: 'date', headerName: 'Date', width: 120 },
    { field: 'mle', headerName: 'Mle', width: 100, valueGetter: (value, row: any) => row.employee?.mle },
    { field: 'mle_2', headerName: 'MLE (Court)', width: 100, valueGetter: (value, row: any) => row.employee?.mle_2 },
    { field: 'nom', headerName: 'Nom & Prénom', width: 200, valueGetter: (value, row: any) => row.employee?.nom_prenom },
    { field: 'famille', headerName: 'Famille', width: 120, valueGetter: (value, row: any) => row.employee?.famille },
    { field: 'seg', headerName: 'SEG', width: 120, valueGetter: (value, row: any) => row.employee?.seg },
    { field: 'affectation', headerName: 'Affectation', width: 150, valueGetter: (value, row: any) => row.employee?.affectation },
    { field: 'cc', headerName: 'CC', width: 100, valueGetter: (value, row: any) => row.employee?.cc },
    { field: 'contrat', headerName: 'Contrat', width: 120, valueGetter: (value, row: any) => row.employee?.contrat },
    { field: 'heures_travaillees', headerName: 'Heures', width: 100 },
    { 
      field: 'statut', 
      headerName: 'Statut', 
      width: 130,
      renderCell: (params) => {
        const status = params.value;
        let color: 'success' | 'error' | 'default' = 'default';
        if (status === 'Present') color = 'success';
        if (status === 'Absent') color = 'error';
        return <Chip label={status} color={color} size="small" variant="outlined" />;
      }
    },
    {
      field: 'actions',
      headerName: 'Actions',
      width: 80,
      renderCell: (params) => (
        <IconButton size="small" onClick={(e) => { e.stopPropagation(); openEditModal(params.row); }}>
          <EditRounded fontSize="small" />
        </IconButton>
      )
    }
  ];

  const loadData = async () => {
    setLoading(true);
    try {
      const url = tableDateFilter ? `attendance/?date=${tableDateFilter}` : 'attendance/';
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

  const handleDateChange = (e: any) => {
    const d = e.target.value;
    setImportDate(d);
    const dateObj = new Date(d);
    if (dateObj.getDay() === 6) { // Saturday
      setIsSaturday(true);
    } else {
      setIsSaturday(false);
    }
  };

  const handleImportSubmit = async () => {
    if (!file || !importDate) return;
    
    if (isSaturday && selectedFamiliesOff.length > 0) {
      try {
        await api.post('saturday-config/', { date: importDate, families_off: selectedFamiliesOff });
      } catch (err) {
        console.error("Error saving saturday config", err);
      }
    }

    const formData = new FormData();
    formData.append('file', file);
    formData.append('date', importDate);
    formData.append('families', JSON.stringify(selectedFamiliesToExtract));

    try {
      const res = await api.post('imports/upload/', formData, { headers: { 'Content-Type': 'multipart/form-data' }});
      alert(res.data.message);
      setOpenImport(false);
      setActiveStep(0);
      loadData();
    } catch (err) {
      console.error(err);
      alert('Erreur lors de l\'importation');
    }
  };

  const handleExportExcel = async () => {
    try {
      const url = tableDateFilter ? `attendance/export_excel/?date=${tableDateFilter}` : 'attendance/export_excel/';
      const response = await api.get(url, { responseType: 'blob' });
      const blob = new Blob([response.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const link = document.createElement('a');
      link.href = window.URL.createObjectURL(blob);
      link.download = `Export_Absences_${tableDateFilter || 'Global'}.xlsx`;
      link.click();
    } catch (err) {
      console.error(err);
      alert('Erreur lors de l\'exportation Excel');
    }
  };

  const handleDeleteSelected = async () => {
    if (!window.confirm(`ATTENTION : Cette action supprimera DÉFINITIVEMENT ${selectionModel.length} employé(s) de la base de données, y compris tout leur historique d'absences.\n\nÊtes-vous sûr ?`)) return;
    try {
      await api.post('attendance/bulk_delete/', { ids: selectionModel });
      setSelectionModel([]);
      loadData();
    } catch (err) {
      console.error(err);
      alert('Erreur lors de la suppression');
    }
  };

  const CustomToolbar = () => (
    <GridToolbarContainer sx={{ display: 'flex', justifyContent: 'space-between', p: 1, borderBottom: '1px solid #f1f5f9' }}>
      <Box>
        <GridToolbarColumnsButton />
        <GridToolbarFilterButton />
        <GridToolbarDensitySelector />
        <Button size="small" startIcon={<DownloadRounded />} onClick={handleExportExcel}>
          Exporter Excel
        </Button>
      </Box>
      <Box sx={{ display: 'flex', gap: 1 }}>
        <Button 
          size="small" 
          color="primary" 
          variant="contained" 
          startIcon={<AddRounded />} 
          onClick={openCreateModal}
          disableElevation
        >
          Créer Employé
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

  const steps = isSaturday ? ['Fichier & Date', 'Configuration Samedi', 'Validation'] : ['Fichier & Date', 'Validation'];

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
        <Typography variant="h4" fontWeight="bold" color="text.primary">
          Table des Absences <Typography component="span" variant="h5" color="text.secondary">({rows.length} employés)</Typography>
        </Typography>
        
        <Box sx={{ display: 'flex', gap: 2 }}>
          <TextField
            type="date"
            label="Afficher pour le :"
            InputLabelProps={{ shrink: true }}
            size="small"
            value={tableDateFilter}
            onChange={(e) => setTableDateFilter(e.target.value)}
          />
          <Button 
            variant="contained" 
            startIcon={<UploadFileRounded />} 
            onClick={() => setOpenImport(true)}
            sx={{ borderRadius: 2 }}
          >
            Importer Fichier RH
          </Button>
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
            setSelectionModel(newSelectionModel as any[]);
          }}
          rowSelectionModel={selectionModel}
          sx={{ border: 'none', '& .MuiDataGrid-cell': { borderColor: '#f1f5f9' } }}
        />
      </Card>

      <Dialog open={openImport} onClose={() => setOpenImport(false)} maxWidth="sm" fullWidth>
        <DialogTitle fontWeight="bold">Nouvel Import Excel</DialogTitle>
        <DialogContent sx={{ minHeight: 250, mt: 2 }}>
          <Stepper activeStep={activeStep} sx={{ mb: 4 }}>
            {steps.map((label) => (
              <Step key={label}>
                <StepLabel>{label}</StepLabel>
              </Step>
            ))}
          </Stepper>

          {activeStep === 0 && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <TextField
                fullWidth
                type="date"
                label="Date du fichier"
                InputLabelProps={{ shrink: true }}
                value={importDate}
                onChange={handleDateChange}
                sx={{ mb: 3 }}
              />
              <Autocomplete
                multiple
                freeSolo
                options={FAMILIES}
                value={selectedFamiliesToExtract}
                onChange={(event, newValue) => {
                  setSelectedFamiliesToExtract(newValue);
                }}
                renderTags={(value: readonly string[], getTagProps) =>
                  value.map((option: string, index: number) => {
                    const { key, ...tagProps } = getTagProps({ index });
                    return <Chip variant="outlined" label={option} key={key} {...tagProps} />;
                  })
                }
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Familles à extraire"
                    placeholder="Tapez pour ajouter une famille"
                  />
                )}
                sx={{ mb: 3 }}
              />
              <Button variant="outlined" component="label" fullWidth sx={{ py: 2, borderStyle: 'dashed' }}>
                {file ? file.name : "Sélectionner un fichier Excel (.xlsx, .xls)"}
                <input type="file" hidden accept=".xlsx, .xls, .csv" onChange={(e) => setFile(e.target.files?.[0] || null)} />
              </Button>
            </motion.div>
          )}

          {activeStep === 1 && isSaturday && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <Typography variant="body2" color="warning.main" mb={2} fontWeight="bold">
                Attention : Le fichier correspond à un Samedi.
              </Typography>
              <Typography variant="body2" mb={2}>
                Veuillez sélectionner les familles qui ne travaillent pas ce samedi. 
                Leurs employés auront le statut "Repos".
              </Typography>
              <FormControl fullWidth>
                <InputLabel>Familles au repos</InputLabel>
                <Select
                  multiple
                  value={selectedFamiliesOff}
                  onChange={(e) => setSelectedFamiliesOff(typeof e.target.value === 'string' ? e.target.value.split(',') : e.target.value)}
                  renderValue={(selected) => (
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                      {selected.map((value) => <Chip key={value} label={value} size="small" />)}
                    </Box>
                  )}
                >
                  {FAMILIES.map((name) => (
                    <MenuItem key={name} value={name}>{name}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </motion.div>
          )}

          {((activeStep === 1 && !isSaturday) || activeStep === 2) && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ textAlign: 'center' }}>
              <Typography variant="h6" mb={2}>Prêt à importer</Typography>
              <Typography variant="body2" color="text.secondary">
                Le fichier sera analysé, les heures calculées, et les compteurs d'absences seront mis à jour.
              </Typography>
            </motion.div>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 3 }}>
          <Button onClick={() => setOpenImport(false)} color="inherit">Annuler</Button>
          {activeStep > 0 && <Button onClick={() => setActiveStep(prev => prev - 1)}>Retour</Button>}
          
          {activeStep < steps.length - 1 ? (
            <Button variant="contained" onClick={() => setActiveStep(prev => prev + 1)} disabled={!file || !importDate}>
              Suivant
            </Button>
          ) : (
            <Button variant="contained" color="primary" onClick={handleImportSubmit}>
              Confirmer l'import
            </Button>
          )}
        </DialogActions>
      </Dialog>

      {/* Modal Création/Modification Manuelle */}
      <Dialog open={openModal} onClose={() => setOpenModal(false)} maxWidth="sm" fullWidth>
        <DialogTitle fontWeight="bold">{isEditMode ? 'Modifier Employé' : 'Créer un Employé'}</DialogTitle>
        <DialogContent dividers>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <TextField
              label="Date" type="date" size="small" value={formData.date}
              onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              InputLabelProps={{ shrink: true }} required disabled={isEditMode}
            />
            <TextField
              label="MLE" size="small" value={formData.mle}
              onChange={(e) => setFormData({ ...formData, mle: e.target.value })}
              required disabled={isEditMode}
            />
            <TextField
              label="Nom & Prénom" size="small" value={formData.nom_prenom}
              onChange={(e) => setFormData({ ...formData, nom_prenom: e.target.value })} required
            />
            <FormControl size="small" required>
              <InputLabel>Famille</InputLabel>
              <Select
                value={formData.famille} label="Famille"
                onChange={(e) => setFormData({ ...formData, famille: e.target.value })}
              >
                {FAMILIES.map(f => (
                  <MenuItem key={f} value={f}>{f}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              label="Affectation" size="small" value={formData.affectation}
              onChange={(e) => setFormData({ ...formData, affectation: e.target.value })}
            />
            <TextField
              label="Contrat" size="small" value={formData.contrat}
              onChange={(e) => setFormData({ ...formData, contrat: e.target.value })}
            />
            <FormControl size="small" required>
              <InputLabel>Statut</InputLabel>
              <Select
                value={formData.statut} label="Statut"
                onChange={(e) => setFormData({ ...formData, statut: e.target.value })}
              >
                <MenuItem value="Present">Présent</MenuItem>
                <MenuItem value="Absent">Absent</MenuItem>
                <MenuItem value="Repos">Repos</MenuItem>
                <MenuItem value="Ferie">Férié</MenuItem>
              </Select>
            </FormControl>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenModal(false)}>Annuler</Button>
          <Button variant="contained" onClick={handleManualSave}>{isEditMode ? 'Enregistrer' : 'Créer'}</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Attendance;
