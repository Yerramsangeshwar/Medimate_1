import 'dotenv/config';
import express, { Request, Response } from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

import { db } from './server/db.ts';
import { seedDatabaseIfEmpty } from './server/seed.ts';
import authRouter from './server/routes/auth.ts';
import medicinesRouter from './server/routes/medicines.ts';
import dosesRouter from './server/routes/doses.ts';
import dashboardRouter from './server/routes/dashboard.ts';
import familyRouter from './server/routes/family.ts';
import inventoryRouter from './server/routes/inventory.ts';
import prescriptionsRouter from './server/routes/prescriptions.ts';
import analyticsRouter from './server/routes/analytics.ts';
import reportsRouter from './server/routes/reports.ts';
import caregiverRouter from './server/routes/caregiver.ts';
import aiRouter from './server/routes/ai.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;

// Ensure upload directory exists
const uploadDir = path.resolve(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Auto-seed demo data on startup if needed
try {
  seedDatabaseIfEmpty();
} catch (e) {
  console.error('Seed initialization notice:', e);
}

app.use(cors());
app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));

// Static uploads for prescription documents & images
app.use('/uploads', express.static(uploadDir));

// Health check
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', service: 'MediMate Health Platform', time: new Date().toISOString() });
});

// Clinical disclaimer
app.get('/api/disclaimer', (_req: Request, res: Response) => {
  res.json({
    text: 'MediMate is a medication-management and reminder tool. It does not diagnose conditions, recommend dosage changes, or replace professional medical advice from a doctor or pharmacist.',
  });
});

// Mount API endpoints
app.use('/api/auth', authRouter);
app.use('/api/medicines', medicinesRouter);
app.use('/api/doses', dosesRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api/family', familyRouter);
app.use('/api/inventory', inventoryRouter);
app.use('/api/prescriptions', prescriptionsRouter);
app.use('/api/analytics', analyticsRouter);
app.use('/api/reports', reportsRouter);
app.use('/api/caregiver', caregiverRouter);
app.use('/api/ai', aiRouter);

// Start server with Vite middleware in dev or static dist in prod
async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR !== 'true',
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`💊 MediMate platform running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start MediMate server:', err);
  process.exit(1);
});
