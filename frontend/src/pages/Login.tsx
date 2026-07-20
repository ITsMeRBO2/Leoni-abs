import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Button, TextField, Typography, Alert, Grid, Link } from '@mui/material';
import { motion } from 'framer-motion';
import api from '../services/api';
import leoniLogo from '../leoni.png';
import rightImg from '../../right.jpg';

const Login = () => {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    try {
      const res = await api.post('auth/login/', { username, password });
      localStorage.setItem('token', res.data.access);
      navigate('/dashboard');
    } catch (err) {
      setError('Identifiants incorrects');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Grid container sx={{ minHeight: '100vh' }}>
      {/* Left Side */}
      <Grid item xs={12} md={6} lg={5} sx={{ display: 'flex', flexDirection: 'column', p: 5, bgcolor: 'white' }}>
        <Box sx={{ mb: 'auto' }}>
          <img src={leoniLogo} alt="Leoni" style={{ height: '40px' }} />
        </Box>
        
        <Box sx={{ maxWidth: 400, width: '100%', mx: 'auto', mb: 'auto', mt: 'auto' }}>
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5 }}
          >
            <Typography variant="h4" fontWeight="normal" color="#1e293b" gutterBottom sx={{ fontSize: '2rem' }}>
              Welcome to Leoni
            </Typography>
            <Typography variant="h5" color="#475569" mb={5} sx={{ fontSize: '1.75rem' }}>
              Sign into your account
            </Typography>

            {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}

            <form onSubmit={handleLogin}>
              <TextField
                fullWidth
                placeholder="Phone or Email address"
                variant="outlined"
                margin="normal"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                InputProps={{
                  sx: { borderRadius: 8, bgcolor: 'white', '& input': { p: 1.5, pl: 2 } }
                }}
              />
              <TextField
                fullWidth
                placeholder="Password"
                type="password"
                variant="outlined"
                margin="normal"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                InputProps={{
                  sx: { borderRadius: 8, bgcolor: 'white', '& input': { p: 1.5, pl: 2 } }
                }}
                sx={{ mb: 3 }}
              />
              <Button
                type="submit"
                variant="contained"
                disabled={loading}
                sx={{ 
                  py: 1, 
                  px: 5, 
                  borderRadius: 8, 
                  fontSize: '1rem', 
                  textTransform: 'none', 
                  bgcolor: '#0ea5e9',
                  '&:hover': {
                    bgcolor: '#0284c7'
                  }
                }}
              >
                {loading ? '...' : 'Log In'}
              </Button>
              <Box mt={2}>
                <Link href="#" underline="hover" sx={{ fontSize: '0.8rem', color: '#0ea5e9' }}>
                  Forgot password?
                </Link>
              </Box>
            </form>
          </motion.div>
        </Box>
      </Grid>

      {/* Right Side */}
      <Grid 
        item 
        xs={12} 
        md={6} 
        lg={7} 
        sx={{
          backgroundImage: `url(${rightImg})`,
          backgroundRepeat: 'no-repeat',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      />
    </Grid>
  );
};

export default Login;
