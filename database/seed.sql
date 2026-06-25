USE nrh_gmvv;
GO

-- Seed lookup data
MERGE roles AS t USING (VALUES
  ('role-comandante', 'Comandante', 4),
  ('role-insp-geral', 'Inspetor Geral', 4),
  ('role-gestor-rh', 'Gestor de RH', 3),
  ('role-inspetor', 'Inspetor', 2),
  ('role-subinspetor', 'Subinspetor', 2),
  ('role-agente', 'Agente', 0)
) AS s(id, name, access_level) ON t.id = s.id
WHEN NOT MATCHED THEN INSERT (id, name, access_level) VALUES (s.id, s.name, s.access_level);

MERGE schedules AS t USING (VALUES
  ('esc-12x36', '12x36'),
  ('esc-24x72', '24x72')
) AS s(id, name) ON t.id = s.id
WHEN NOT MATCHED THEN INSERT (id, name) VALUES (s.id, s.name);

MERGE shifts AS t USING (VALUES
  ('turno-a', 'Turno A'),
  ('turno-b', 'Turno B')
) AS s(id, name) ON t.id = s.id
WHEN NOT MATCHED THEN INSERT (id, name) VALUES (s.id, s.name);

MERGE units AS t USING (VALUES
  ('unit-op', 'Operacional'),
  ('unit-adm', 'Administrativo')
) AS s(id, name) ON t.id = s.id
WHEN NOT MATCHED THEN INSERT (id, name) VALUES (s.id, s.name);

MERGE launch_types AS t USING (VALUES
  ('lt-bh', 'Banco de Horas'),
  ('lt-tre', 'TRE'),
  ('lt-ferias', 'Férias'),
  ('lt-licenca', 'Licença'),
  ('lt-atestado', 'Atestado')
) AS s(id, name) ON t.id = s.id
WHEN NOT MATCHED THEN INSERT (id, name) VALUES (s.id, s.name);

MERGE app_settings AS t USING (VALUES
  ('vacation', '{"isOpen":true}')
) AS s([key], value) ON t.[key] = s.[key]
WHEN NOT MATCHED THEN INSERT ([key], value) VALUES (s.[key], s.value);

-- Demo admin user: password = Admin@123
-- bcrypt hash generated for Admin@123
DECLARE @adminUid UNIQUEIDENTIFIER = '11111111-1111-1111-1111-111111111111';

IF NOT EXISTS (SELECT 1 FROM users WHERE email = 'ADMIN@GMVV.LOCAL')
INSERT INTO users (id, email, password_hash, display_name)
VALUES (
  @adminUid,
  'ADMIN@GMVV.LOCAL',
  '$2b$10$rQZ8K8Y5Y5Y5Y5Y5Y5Y5YuGKxGKxGKxGKxGKxGKxGKxGKxGKxGKxG',
  'Administrador RH'
);

IF NOT EXISTS (SELECT 1 FROM employees WHERE qra = 'ADMIN')
INSERT INTO employees (
  id, uid, name, email, qra, matricula, validation_code,
  escala, turno, role, unit, status, access_level
) VALUES (
  'emp-admin',
  @adminUid,
  'Administrador do Sistema',
  'ADMIN@GMVV.LOCAL',
  'ADMIN',
  '00001',
  'VALID001',
  '12x36', 'Turno A', 'Gestor de RH', 'Administrativo', 'ATIVO', 3
);

GO
