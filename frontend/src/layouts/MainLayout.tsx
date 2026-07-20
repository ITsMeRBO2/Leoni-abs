import React, { useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Box, Drawer, List, ListItem, ListItemIcon, ListItemText, AppBar, Toolbar, Typography, IconButton, Avatar, useTheme } from '@mui/material';
import DashboardIcon from '@mui/material/Icon/Dashboard'; // Note: using standard @mui/icons-material paths later, just mock for now, wait I should use actual imports
import { DashboardRounded, TableChartRounded, PersonRemoveRounded, SettingsRounded, LogoutRounded } from '@mui/icons-material';
import { motion } from 'framer-motion';

import leoniLogo from '../leoni.png';

const drawerWidth = 260;

const MainLayout = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useTheme();

  const menuItems = [
    { text: 'Dashboard', icon: <DashboardRounded />, path: '/dashboard' },
    { text: 'Absences', icon: <TableChartRounded />, path: '/attendance' },
    { text: 'Départs', icon: <PersonRemoveRounded />, path: '/departures' },
    { text: 'Paramètres', icon: <SettingsRounded />, path: '/settings' },
  ];

  const handleLogout = () => {
    localStorage.removeItem('token');
    navigate('/login');
  };

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: 'background.default' }}>
      <AppBar 
        position="fixed" 
        sx={{ 
          width: `calc(100% - ${drawerWidth}px)`, 
          ml: `${drawerWidth}px`,
          bgcolor: 'white',
          color: 'text.primary',
          boxShadow: '0 1px 3px 0 rgb(0 0 0 / 0.1)'
        }}
      >
        <Toolbar>
          <Typography variant="h6" noWrap component="div" sx={{ flexGrow: 1, fontWeight: 600 }}>
            {menuItems.find(i => i.path === location.pathname)?.text || 'Application'}
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Typography variant="body2" fontWeight={500}>Admin RH</Typography>
            <Avatar sx={{ bgcolor: theme.palette.primary.main, width: 36, height: 36 }}>RH</Avatar>
            <IconButton onClick={handleLogout} color="error" size="small">
              <LogoutRounded />
            </IconButton>
          </Box>
        </Toolbar>
      </AppBar>
      
      <Drawer
        variant="permanent"
        sx={{
          width: drawerWidth,
          flexShrink: 0,
          '& .MuiDrawer-paper': {
            width: drawerWidth,
            boxSizing: 'border-box',
            borderRight: 'none',
            boxShadow: '1px 0 3px 0 rgb(0 0 0 / 0.05)',
            bgcolor: 'white'
          },
        }}
      >
        <Box sx={{ pt: 5, pb: 3, px: 3, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <img src={leoniLogo} alt="Leoni" style={{ maxWidth: '160px', height: 'auto' }} />
        </Box>
        <List sx={{ px: 2 }}>
          {menuItems.map((item) => {
            const isActive = location.pathname.startsWith(item.path);
            return (
              <ListItem 
                button 
                key={item.text} 
                onClick={() => navigate(item.path)}
                sx={{
                  mb: 1,
                  borderRadius: 2,
                  bgcolor: isActive ? 'primary.50' : 'transparent',
                  color: isActive ? 'primary.main' : 'text.secondary',
                  '&:hover': {
                    bgcolor: 'primary.50',
                    color: 'primary.main',
                  },
                  transition: 'all 0.2s',
                }}
              >
                <ListItemIcon sx={{ color: 'inherit', minWidth: 40 }}>
                  {item.icon}
                </ListItemIcon>
                <ListItemText 
                  primary={item.text} 
                  primaryTypographyProps={{ fontWeight: isActive ? 600 : 500 }} 
                />
              </ListItem>
            );
          })}
        </List>
      </Drawer>

      <Box
        component="main"
        sx={{ flexGrow: 1, p: 4, mt: 8 }}
      >
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.3 }}
        >
          <Outlet />
        </motion.div>
      </Box>
    </Box>
  );
};

export default MainLayout;
