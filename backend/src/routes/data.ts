import { Router } from 'express';
import { nanoid } from 'nanoid';
import { query } from '../db/pool';
import { authMiddleware } from '../middleware/auth';
import { rowToDoc, docToRow } from '../utils/transform';

const router = Router();

const COLLECTION_TABLE: Record<string, string> = {
  employees: 'employees',
  launches: 'launches',
  launchTypes: 'launch_types',
  requests: 'requests',
  vacationPlans: 'vacation_plans',
  dailyReports: 'daily_reports',
  notifications: 'notifications',
  roles: 'roles',
  schedules: 'schedules',
  shifts: 'shifts',
  units: 'units',
  shiftPeriods: 'shift_periods',
  servicePosts: 'service_posts',
};

const CAMEL_TO_SNAKE: Record<string, string> = {
  employeeId: 'employee_id',
  employeeName: 'employee_name',
  employeeQra: 'employee_qra',
  launchNumber: 'launch_number',
  startDate: 'start_date',
  endDate: 'end_date',
  qtdEscala: 'qtd_escala',
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  validationCode: 'validation_code',
  emergencyContactName: 'emergency_contact_name',
  emergencyPhone: 'emergency_phone',
  maritalStatus: 'marital_status',
  spouseName: 'spouse_name',
  hasChildren: 'has_children',
  voterId: 'voter_id',
  voterZone: 'voter_zone',
  votingLocation: 'voting_location',
  votingCity: 'voting_city',
  birthDate: 'birth_date',
  cnhNumber: 'cnh_number',
  cnhCategory: 'cnh_category',
  cnhExpiration: 'cnh_expiration',
  accessLevel: 'access_level',
  lastMuralVisit: 'last_mural_visit',
  readReceipts: 'read_receipts',
  adminResponse: 'admin_response',
  chefiaImediata: 'chefia_imediata',
  chefiaIds: 'chefia_ids',
  partnerId: 'partner_id',
  partnerName: 'partner_name',
  advance13th: 'advance_13th',
  splitVacation: 'split_vacation',
  splitPattern: 'split_pattern',
  hasMinorChildren: 'has_minor_children',
  spouseIsTeacher: 'spouse_is_teacher',
  selectedOptions: 'selected_options',
  processedByQra: 'processed_by_qra',
  escalaId: 'escala_id',
  escalaName: 'escala_name',
  startTime: 'start_time',
  endTime: 'end_time',
  absentTodayList: 'absent_today_list',
  specialSchedule: 'special_schedule',
  lastReturnReason: 'last_return_reason',
  auditHistory: 'audit_history',
  createdBy: 'created_by',
  targetType: 'target_type',
  targetId: 'target_id',
  targetLabel: 'target_label',
  authorQra: 'author_qra',
  authorName: 'author_name',
  employeeEscala: 'employee_escala',
  employeeTurno: 'employee_turno',
  admissionDate: 'admission_date',
};

function toSnake(field: string): string {
  return CAMEL_TO_SNAKE[field] || field.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
}

function getTable(collection: string): string | null {
  return COLLECTION_TABLE[collection] || null;
}

interface WhereClause {
  field: string;
  op: string;
  value: unknown;
}

interface QueryBody {
  collection: string;
  where?: WhereClause[];
  orderBy?: { field: string; direction?: 'asc' | 'desc' }[];
  limit?: number;
}

function buildWhere(wheres: WhereClause[]): { sql: string; params: Record<string, unknown> } {
  const params: Record<string, unknown> = {};
  const parts: string[] = [];

  wheres.forEach((w, i) => {
    const col = toSnake(w.field);
    const param = `w${i}`;

    if (w.op === '==' || w.op === '=') {
      parts.push(`${col} = @${param}`);
      params[param] = w.value;
    } else if (w.op === 'in' && Array.isArray(w.value)) {
      const inParams = (w.value as unknown[]).map((v, j) => {
        const p = `${param}_${j}`;
        params[p] = v;
        return `@${p}`;
      });
      parts.push(`${col} IN (${inParams.join(', ')})`);
    } else if (w.op === 'array-contains') {
      parts.push(`${col} LIKE '%' + @${param} + '%'`);
      params[param] = String(w.value);
    }
  });

  return { sql: parts.length ? `WHERE ${parts.join(' AND ')}` : '', params };
}

// Generic query endpoint (replaces Firestore onSnapshot reads)
router.post('/query', authMiddleware, async (req, res) => {
  try {
    const body = req.body as QueryBody;
    const table = getTable(body.collection);
    if (!table) return res.status(400).json({ error: `Coleção desconhecida: ${body.collection}` });

    const { sql: whereSql, params } = buildWhere(body.where || []);

    let orderSql = '';
    if (body.orderBy?.length) {
      const orders = body.orderBy.map((o) => {
        const col = toSnake(o.field);
        return `${col} ${o.direction === 'desc' ? 'DESC' : 'ASC'}`;
      });
      orderSql = `ORDER BY ${orders.join(', ')}`;
    }

    const limitSql = body.limit ? `TOP ${body.limit}` : '';
    const sqlText = `SELECT ${limitSql} * FROM ${table} ${whereSql} ${orderSql}`.trim();

    const result = await query(sqlText, params);
    const docs = result.recordset.map((row) => rowToDoc(row as Record<string, unknown>));

    res.json({ docs });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro na consulta' });
  }
});

// Get single document
router.get('/:collection/:id', authMiddleware, async (req, res) => {
  try {
    const table = getTable(req.params.collection);
    if (!table) return res.status(400).json({ error: 'Coleção desconhecida' });

    const result = await query(`SELECT * FROM ${table} WHERE id = @id`, { id: req.params.id });
    if (!result.recordset[0]) return res.status(404).json({ error: 'Não encontrado' });

    res.json({ doc: rowToDoc(result.recordset[0] as Record<string, unknown>) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao buscar documento' });
  }
});

// Create document
router.post('/:collection', authMiddleware, async (req, res) => {
  try {
    const table = getTable(req.params.collection);
    if (!table) return res.status(400).json({ error: 'Coleção desconhecida' });

    const id = req.body.id || nanoid();
    const row = docToRow({ ...req.body, id });
    delete row.id;

    const cols = Object.keys(row);
    const placeholders = cols.map((c) => `@${c}`);
    const params: Record<string, unknown> = { id };
    cols.forEach((c) => { params[c] = row[c]; });

    // Auto launch_number for launches
    if (req.params.collection === 'launches' && !params.launch_number) {
      const maxResult = await query(`SELECT ISNULL(MAX(launch_number), 0) + 1 as next_num FROM launches`);
      params.launch_number = maxResult.recordset[0].next_num;
    }

    if (!params.created_at) params.created_at = new Date();

    const allCols = ['id', ...cols.filter((c) => c !== 'created_at'), ...(params.created_at ? ['created_at'] : [])];
    const allPlaceholders = allCols.map((c) => `@${c}`);
    const allParams: Record<string, unknown> = {};
    allCols.forEach((c) => { if (params[c] !== undefined) allParams[c] = params[c]; });

    await query(
      `INSERT INTO ${table} (${allCols.join(', ')}) VALUES (${allPlaceholders.join(', ')})`,
      allParams
    );

    const created = await query(`SELECT * FROM ${table} WHERE id = @id`, { id });
    res.status(201).json({ doc: rowToDoc(created.recordset[0] as Record<string, unknown>) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao criar documento' });
  }
});

// Update document
router.patch('/:collection/:id', authMiddleware, async (req, res) => {
  try {
    const table = getTable(req.params.collection);
    if (!table) return res.status(400).json({ error: 'Coleção desconhecida' });

    const row = docToRow(req.body);
    delete row.id;
    row.updated_at = new Date();

    const sets = Object.keys(row).map((c) => `${c} = @${c}`);
    const params: Record<string, unknown> = { id: req.params.id, ...row };

    await query(`UPDATE ${table} SET ${sets.join(', ')} WHERE id = @id`, params);

    const updated = await query(`SELECT * FROM ${table} WHERE id = @id`, { id: req.params.id });
    res.json({ doc: rowToDoc(updated.recordset[0] as Record<string, unknown>) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao atualizar documento' });
  }
});

// Delete document
router.delete('/:collection/:id', authMiddleware, async (req, res) => {
  try {
    const table = getTable(req.params.collection);
    if (!table) return res.status(400).json({ error: 'Coleção desconhecida' });

    await query(`DELETE FROM ${table} WHERE id = @id`, { id: req.params.id });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao excluir documento' });
  }
});

// Settings (special doc paths like settings/vacation)
router.get('/settings/:key', authMiddleware, async (req, res) => {
  const result = await query(`SELECT * FROM app_settings WHERE [key] = @key`, { key: req.params.key });
  if (!result.recordset[0]) return res.json({ doc: { id: req.params.key, isOpen: false } });

  const value = JSON.parse(result.recordset[0].value as string);
  res.json({ doc: { id: req.params.key, ...value } });
});

router.put('/settings/:key', authMiddleware, async (req, res) => {
  const value = JSON.stringify(req.body);
  await query(
    `MERGE app_settings AS t USING (SELECT @key as [key], @value as value) AS s
     ON t.[key] = s.[key]
     WHEN MATCHED THEN UPDATE SET value = s.value, updated_at = SYSUTCDATETIME()
     WHEN NOT MATCHED THEN INSERT ([key], value) VALUES (s.[key], s.value)`,
    { key: req.params.key, value }
  );
  res.json({ doc: { id: req.params.key, ...req.body } });
});

export default router;
