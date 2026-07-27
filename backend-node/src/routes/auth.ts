import express from 'express';
import jwt from 'jsonwebtoken';
import prisma from '../prisma';
import { verifyDjangoPassword } from '../utils/hash';

const router = express.Router();

router.post('/login/', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ detail: 'Please provide username and password.' });
  }

  try {
    const user = await prisma.user.findUnique({ where: { username } });

    if (!user) {
      return res.status(401).json({ detail: 'No active account found with the given credentials' });
    }

    const isValid = verifyDjangoPassword(password, user.password);

    if (!isValid) {
      return res.status(401).json({ detail: 'No active account found with the given credentials' });
    }

    // Generate token matching Django simple JWT format if possible
    // Simple JWT default payload has user_id
    const payload = {
      user_id: user.id,
      username: user.username,
      role: user.role
    };

    const access = jwt.sign(payload, process.env.JWT_SECRET || 'secret', { expiresIn: '1d' });
    const refresh = jwt.sign(payload, process.env.JWT_SECRET || 'secret', { expiresIn: '7d' });

    res.json({ access, refresh });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/refresh/', (req, res) => {
  const { refresh } = req.body;
  if (!refresh) return res.status(400).json({ detail: 'Refresh token required' });

  jwt.verify(refresh, process.env.JWT_SECRET || 'secret', (err: any, user: any) => {
    if (err) return res.status(401).json({ detail: 'Token is invalid or expired', code: 'token_not_valid' });

    const payload = {
      user_id: user.user_id,
      username: user.username,
      role: user.role
    };

    const access = jwt.sign(payload, process.env.JWT_SECRET || 'secret', { expiresIn: '1d' });
    res.json({ access });
  });
});

export default router;
