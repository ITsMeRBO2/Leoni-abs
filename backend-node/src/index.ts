import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './routes/auth';
import employeesRoutes from './routes/employees';
import attendanceRoutes from './routes/attendance';
import departuresRoutes from './routes/departures';
import configRoutes from './routes/config';
import dashboardRoutes from './routes/dashboard';
import importsRoutes from './routes/imports';
import exportRoutes from './routes/export';
import { authenticateToken } from './middlewares/auth';

dotenv.config();

const app = express();
const port = process.env.PORT || 8000;

const corsOptions = {
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    // Allow requests from Vercel domains, localhost, and no-origin (server-to-server)
    if (!origin || origin.includes('vercel.app') || origin.includes('localhost')) {
      callback(null, true);
    } else {
      callback(null, true); // Allow all origins for now
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions)); // Handle preflight requests
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Routes without auth
app.use('/api/auth', authRoutes);

// Apply auth middleware to following routes (unless specific routes bypass it)
app.use('/api/employees', authenticateToken, employeesRoutes);
app.use('/api/attendance', authenticateToken, attendanceRoutes);
app.use('/api/departures', authenticateToken, departuresRoutes);
app.use('/api', authenticateToken, configRoutes); // settings, saturday-config, public-holidays, families
app.use('/api', authenticateToken, dashboardRoutes); // dashboard/
app.use('/api/imports', authenticateToken, importsRoutes);
app.use('/api', authenticateToken, exportRoutes);

app.get('/api/debug/', (req, res) => {
  res.json({ status: 'ok', message: 'Node.js backend is running.' });
});

app.get('/api/health/', async (req: any, res: any) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: 'ok', db: 'connected' });
  } catch (e: any) {
    res.status(500).json({ status: 'error', db: 'disconnected', error: e.message });
  }
});

if (process.env.NODE_ENV !== 'production' || !process.env.VERCEL) {
  app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
  });
}

export default app;
