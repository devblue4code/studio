import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { query } from '../db/pool';
import { config } from '../config';
import { authMiddleware } from '../middleware/auth';
import { rowToDoc } from '../utils/transform';

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

const FIELD_MAP: Record<string, Record<string, string>> = {
  employees: { uid: 'uid', email: 'email', qra: 'qra', status: 'status', role: 'role' },
  launches: { employeeId: 'employee_id', date: 'date', type: 'type' },
  requests: { employeeId: 'employee_id', status: 'status', partnerId: 'partner_id' },
  vacationPlans: { employeeId: 'employee_id', status: 'status' },
  dailyReports: { status: 'status', date: 'date', createdBy: 'created_by' },
  notifications: { targetType: 'target_type', targetId: 'target_id' },
  shiftPeriods: { escalaId: 'escala_id' },
};

router.post('/login', async (req, res) => {
  try {
    const { qra, password, email: directEmail } = req.body;

    let email = directEmail?.toUpperCase();

    if (qra) {
      const empResult = await query(
        `SELECT TOP 1 e.id, e.uid, e.name, e.email, e.qra, e.matricula, e.role, e.unit, e.status,
                e.escala, e.turno, e.access_level, u.password_hash, u.id as user_id
         FROM employees e
         LEFT JOIN users u ON e.uid = u.id
         WHERE UPPER(e.qra) = @qra`,
        { qra: qra.toUpperCase() }
      );
      const emp = empResult.recordset[0];
      if (!emp) return res.status(401).json({ error: 'QRA não encontrado' });
      if (!emp.password_hash) return res.status(401).json({ error: 'Usuário ainda não ativou o cadastro' });
      email = emp.email?.toUpperCase();

      const valid = await bcrypt.compare(password, emp.password_hash);
      if (!valid) return res.status(401).json({ error: 'Senha incorreta' });

      const token = jwt.sign(
        { userId: emp.user_id, email, employeeId: emp.id },
        config.jwtSecret,
        { expiresIn: config.jwtExpiresIn }
      );

      return res.json({
        token,
        user: { uid: emp.user_id, email, displayName: emp.name },
        employee: rowToDoc(emp),
      });
    }

    if (email && password) {
      const userResult = await query(
        `SELECT u.*, e.id as employee_id FROM users u
         LEFT JOIN employees e ON e.uid = u.id
         WHERE UPPER(u.email) = @email`,
        { email }
      );
      const user = userResult.recordset[0];
      if (!user) return res.status(401).json({ error: 'Credenciais inválidas' });

      const valid = await bcrypt.compare(password, user.password_hash);
      if (!valid) return res.status(401).json({ error: 'Credenciais inválidas' });

      const token = jwt.sign(
        { userId: user.id, email, employeeId: user.employee_id },
        config.jwtSecret,
        { expiresIn: config.jwtExpiresIn }
      );

      const empResult = user.employee_id
        ? await query(`SELECT * FROM employees WHERE id = @id`, { id: user.employee_id })
        : { recordset: [] };

      return res.json({
        token,
        user: { uid: user.id, email, displayName: user.display_name },
        employee: empResult.recordset[0] ? rowToDoc(empResult.recordset[0]) : null,
      });
    }

    return res.status(400).json({ error: 'QRA ou email obrigatório' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro no login' });
  }
});

router.post('/register', async (req, res) => {
  try {
    const { qra, validationCode, password, name } = req.body;

    const empResult = await query(
      `SELECT * FROM employees WHERE UPPER(qra) = @qra AND validation_code = @code`,
      { qra: qra.toUpperCase(), code: validationCode }
    );
    const emp = empResult.recordset[0];
    if (!emp) return res.status(400).json({ error: 'QRA ou código de validação inválido' });
    if (emp.uid) return res.status(400).json({ error: 'Cadastro já ativado' });

    const email = (emp.email || `${qra.toUpperCase()}@GMVV.LOCAL`).toUpperCase();
    const hash = await bcrypt.hash(password, 10);
    const userId = crypto.randomUUID();

    await query(
      `INSERT INTO users (id, email, password_hash, display_name) VALUES (@id, @email, @hash, @name)`,
      { id: userId, email, hash, name: name || emp.name }
    );

    await query(
      `UPDATE employees SET uid = @uid, email = @email, status = 'ATIVO', updated_at = SYSUTCDATETIME() WHERE id = @id`,
      { uid: userId, email, id: emp.id }
    );

    const token = jwt.sign(
      { userId, email, employeeId: emp.id },
      config.jwtSecret,
      { expiresIn: config.jwtExpiresIn }
    );

    res.json({
      token,
      user: { uid: userId, email, displayName: name || emp.name },
      employee: rowToDoc({ ...emp, uid: userId, email, status: 'ATIVO' }),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro no registro' });
  }
});

router.get('/me', authMiddleware, async (req, res) => {
  try {
    const empResult = await query(
      `SELECT * FROM employees WHERE uid = @uid OR id = @employeeId`,
      { uid: req.user!.userId, employeeId: req.user!.employeeId || '' }
    );
    const emp = empResult.recordset[0];
    if (!emp) return res.status(404).json({ error: 'Funcionário não vinculado' });

    res.json({
      user: { uid: req.user!.userId, email: req.user!.email },
      employee: rowToDoc(emp),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao buscar perfil' });
  }
});

router.post('/password-reset', async (req, res) => {
  // Em produção: enviar e-mail. Em dev: apenas confirma.
  res.json({ message: 'Se o e-mail existir, instruções foram enviadas.' });
});

export default router;
