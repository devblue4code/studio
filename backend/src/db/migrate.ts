import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';
import sql from 'mssql';
import { config } from '../config';

dotenv.config();

async function getConnection(database?: string): Promise<sql.ConnectionPool> {
  return sql.connect({
    server: config.db.server,
    port: config.db.port,
    user: config.db.user,
    password: config.db.password,
    database: database || config.db.database,
    options: {
      encrypt: config.db.encrypt,
      trustServerCertificate: config.db.trustServerCertificate,
    },
    connectionTimeout: 30000,
    requestTimeout: 60000,
  });
}

async function runSqlFile(pool: sql.ConnectionPool, filePath: string) {
  const fullPath = path.resolve(filePath);
  if (!fs.existsSync(fullPath)) {
    console.warn(`Arquivo não encontrado: ${fullPath}`);
    return;
  }

  const content = fs.readFileSync(fullPath, 'utf-8');
  const batches = content.split(/\r?\nGO\r?\n/i);

  for (const batch of batches) {
    const trimmed = batch.trim();
    if (!trimmed) continue;
    await pool.request().query(trimmed);
  }
}

async function seedAdminPassword(pool: sql.ConnectionPool) {
  const hash = await bcrypt.hash('Admin@123', 10);
  await pool.request()
    .input('hash', sql.NVarChar, hash)
    .query(`UPDATE users SET password_hash = @hash WHERE email = 'ADMIN@GMVV.LOCAL'`);
  console.log('Senha do admin demo definida: Admin@123');
}

async function migrate() {
  console.log(`Conectando a ${config.db.server}:${config.db.port}...`);

  let pool: sql.ConnectionPool | null = null;
  let retries = 30;

  while (retries > 0) {
    try {
      pool = await getConnection('master');
      await pool.request().query('SELECT 1');
      console.log('SQL Server disponível');
      break;
    } catch (err) {
      retries--;
      console.log(`Aguardando SQL Server... (${retries} tentativas restantes)`);
      if (pool) { try { await pool.close(); } catch {} pool = null; }
      await new Promise((r) => setTimeout(r, 3000));
    }
  }

  if (!pool) throw new Error('SQL Server indisponível após 30 tentativas');

  const dbDir = process.env.DB_SCRIPTS_DIR || path.join(__dirname, '../../../database');

  console.log('Executando schema...');
  await runSqlFile(pool, path.join(dbDir, 'schema.sql'));

  await pool.close();

  // Reconecta ao banco criado
  pool = await getConnection(config.db.database);

  console.log('Executando seed...');
  await runSqlFile(pool, path.join(dbDir, 'seed.sql'));

  await seedAdminPassword(pool);

  await pool.close();
  console.log('Migração concluída.');
  process.exit(0);
}

migrate().catch((err) => {
  console.error('Erro na migração:', err);
  process.exit(1);
});
