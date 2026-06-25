import express from 'express';
import cors from 'cors';
import { config } from './config';
import { getPool } from './db/pool';
import authRoutes from './routes/auth';
import dataRoutes from './routes/data';

const app = express();

app.use(cors({ origin: config.corsOrigin, credentials: true }));
app.use(express.json({ limit: '10mb' }));

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'nrh-gmvv-api' });
});

app.use('/api/auth', authRoutes);
app.use('/api/data', dataRoutes);

async function start() {
  try {
    await getPool();
    console.log('Conectado ao SQL Server');

    app.listen(config.port, () => {
      console.log(`API rodando em http://localhost:${config.port}`);
    });
  } catch (err) {
    console.error('Falha ao iniciar API:', err);
    process.exit(1);
  }
}

start();
