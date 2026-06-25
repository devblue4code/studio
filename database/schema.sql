-- NRH-GMVV Schema for SQL Server
-- Run against database nrh_gmvv

IF NOT EXISTS (SELECT * FROM sys.databases WHERE name = 'nrh_gmvv')
BEGIN
  CREATE DATABASE nrh_gmvv;
END
GO

USE nrh_gmvv;
GO

-- Auth users (replaces Firebase Auth)
IF OBJECT_ID('users', 'U') IS NULL
CREATE TABLE users (
  id            UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
  email         NVARCHAR(255) NOT NULL UNIQUE,
  password_hash NVARCHAR(255) NOT NULL,
  display_name  NVARCHAR(255) NULL,
  created_at    DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  updated_at    DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
);

-- Lookup tables
IF OBJECT_ID('roles', 'U') IS NULL
CREATE TABLE roles (
  id            NVARCHAR(50) PRIMARY KEY,
  name          NVARCHAR(100) NOT NULL,
  access_level  INT NOT NULL DEFAULT 0
);

IF OBJECT_ID('schedules', 'U') IS NULL
CREATE TABLE schedules (
  id   NVARCHAR(50) PRIMARY KEY,
  name NVARCHAR(100) NOT NULL
);

IF OBJECT_ID('shifts', 'U') IS NULL
CREATE TABLE shifts (
  id   NVARCHAR(50) PRIMARY KEY,
  name NVARCHAR(100) NOT NULL
);

IF OBJECT_ID('units', 'U') IS NULL
CREATE TABLE units (
  id   NVARCHAR(50) PRIMARY KEY,
  name NVARCHAR(100) NOT NULL
);

IF OBJECT_ID('launch_types', 'U') IS NULL
CREATE TABLE launch_types (
  id   NVARCHAR(50) PRIMARY KEY,
  name NVARCHAR(100) NOT NULL
);

IF OBJECT_ID('shift_periods', 'U') IS NULL
CREATE TABLE shift_periods (
  id          NVARCHAR(50) PRIMARY KEY,
  escala_id   NVARCHAR(50) NOT NULL,
  escala_name NVARCHAR(100) NULL,
  start_time  NVARCHAR(5) NOT NULL,
  end_time    NVARCHAR(5) NOT NULL,
  duration    NVARCHAR(5) NOT NULL
);

IF OBJECT_ID('service_posts', 'U') IS NULL
CREATE TABLE service_posts (
  id   NVARCHAR(50) PRIMARY KEY,
  name NVARCHAR(100) NOT NULL
);

-- Employees
IF OBJECT_ID('employees', 'U') IS NULL
CREATE TABLE employees (
  id                    NVARCHAR(50) PRIMARY KEY,
  uid                   UNIQUEIDENTIFIER NULL REFERENCES users(id),
  name                  NVARCHAR(255) NOT NULL,
  email                 NVARCHAR(255) NULL,
  qra                   NVARCHAR(50) NOT NULL,
  matricula             NVARCHAR(50) NOT NULL,
  validation_code       NVARCHAR(50) NULL,
  escala                NVARCHAR(100) NOT NULL,
  turno                 NVARCHAR(100) NOT NULL,
  role                  NVARCHAR(100) NOT NULL,
  unit                  NVARCHAR(100) NOT NULL,
  status                NVARCHAR(20) NOT NULL DEFAULT 'PENDENTE',
  avatar                NVARCHAR(500) NULL,
  admission_date        DATE NULL,
  phone                 NVARCHAR(30) NULL,
  emergency_contact_name NVARCHAR(255) NULL,
  emergency_phone       NVARCHAR(30) NULL,
  address               NVARCHAR(500) NULL,
  city                  NVARCHAR(100) NULL,
  state                 NVARCHAR(2) NULL,
  marital_status        NVARCHAR(30) NULL,
  spouse_name           NVARCHAR(255) NULL,
  has_children          BIT NULL DEFAULT 0,
  children              NVARCHAR(MAX) NULL, -- JSON array
  voter_id              NVARCHAR(50) NULL,
  voter_zone            NVARCHAR(20) NULL,
  voting_location       NVARCHAR(255) NULL,
  voting_city           NVARCHAR(100) NULL,
  birth_date            DATE NULL,
  cpf                   NVARCHAR(14) NULL,
  cnh_number            NVARCHAR(20) NULL,
  cnh_category          NVARCHAR(5) NULL,
  cnh_expiration        DATE NULL,
  access_level          INT NULL DEFAULT 0,
  last_mural_visit      DATETIME2 NULL,
  read_receipts         NVARCHAR(MAX) NULL, -- JSON object
  created_at            DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  updated_at            DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
);

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_employees_uid')
  CREATE INDEX IX_employees_uid ON employees(uid);
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_employees_qra')
  CREATE INDEX IX_employees_qra ON employees(qra);
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_employees_email')
  CREATE INDEX IX_employees_email ON employees(email);
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_employees_status')
  CREATE INDEX IX_employees_status ON employees(status);

-- Launches (banco de horas)
IF OBJECT_ID('launches', 'U') IS NULL
CREATE TABLE launches (
  id              NVARCHAR(50) PRIMARY KEY,
  launch_number   INT NOT NULL,
  date            DATE NOT NULL,
  employee_id     NVARCHAR(50) NOT NULL REFERENCES employees(id),
  employee_name   NVARCHAR(255) NULL,
  employee_qra    NVARCHAR(50) NULL,
  escala          NVARCHAR(100) NULL,
  turno           NVARCHAR(100) NULL,
  type            NVARCHAR(100) NOT NULL,
  days            DECIMAL(10,2) NULL DEFAULT 0,
  hours           NVARCHAR(10) NULL,
  qtd_escala      INT NULL DEFAULT 0,
  start_date      DATE NULL,
  end_date        DATE NULL,
  observations    NVARCHAR(MAX) NULL,
  created_at      DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
);

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_launches_employee')
  CREATE INDEX IX_launches_employee ON launches(employee_id);
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_launches_date')
  CREATE INDEX IX_launches_date ON launches(date);
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_launches_number')
  CREATE UNIQUE INDEX IX_launches_number ON launches(launch_number);

-- Operational requests
IF OBJECT_ID('requests', 'U') IS NULL
CREATE TABLE requests (
  id              NVARCHAR(50) PRIMARY KEY,
  employee_id     NVARCHAR(50) NOT NULL REFERENCES employees(id),
  employee_name   NVARCHAR(255) NULL,
  type            NVARCHAR(100) NOT NULL,
  date            NVARCHAR(50) NULL,
  status          NVARCHAR(50) NOT NULL DEFAULT 'Pendente',
  description     NVARCHAR(MAX) NULL,
  chefia_imediata NVARCHAR(255) NULL,
  chefia_ids      NVARCHAR(MAX) NULL, -- JSON array of UIDs
  partner_id      NVARCHAR(50) NULL,
  partner_name    NVARCHAR(255) NULL,
  admin_response  NVARCHAR(MAX) NULL,
  created_at      DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
);

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_requests_employee')
  CREATE INDEX IX_requests_employee ON requests(employee_id);
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_requests_status')
  CREATE INDEX IX_requests_status ON requests(status);

-- Vacation plans
IF OBJECT_ID('vacation_plans', 'U') IS NULL
CREATE TABLE vacation_plans (
  id                  NVARCHAR(50) PRIMARY KEY,
  employee_id         NVARCHAR(50) NOT NULL REFERENCES employees(id),
  employee_name       NVARCHAR(255) NULL,
  employee_qra        NVARCHAR(50) NULL,
  employee_escala     NVARCHAR(100) NULL,
  employee_turno      NVARCHAR(100) NULL,
  advance_13th        BIT NULL DEFAULT 0,
  split_vacation      BIT NULL DEFAULT 0,
  split_pattern       NVARCHAR(20) NULL,
  has_minor_children  BIT NULL DEFAULT 0,
  spouse_is_teacher   BIT NULL DEFAULT 0,
  options             NVARCHAR(MAX) NULL, -- JSON
  status              NVARCHAR(20) NOT NULL DEFAULT 'PENDENTE',
  selected_options    NVARCHAR(MAX) NULL, -- JSON
  admin_response      NVARCHAR(MAX) NULL,
  processed_by_qra    NVARCHAR(50) NULL,
  created_at          DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  updated_at          DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
);

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_vacation_plans_employee')
  CREATE INDEX IX_vacation_plans_employee ON vacation_plans(employee_id);
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_vacation_plans_status')
  CREATE INDEX IX_vacation_plans_status ON vacation_plans(status);

-- Daily reports
IF OBJECT_ID('daily_reports', 'U') IS NULL
CREATE TABLE daily_reports (
  id                NVARCHAR(50) PRIMARY KEY,
  date              NVARCHAR(20) NOT NULL,
  time              NVARCHAR(10) NULL,
  escala_id         NVARCHAR(50) NULL,
  escala_name       NVARCHAR(100) NULL,
  inspector         NVARCHAR(MAX) NULL, -- JSON
  subinspectors     NVARCHAR(MAX) NULL, -- JSON
  absences          NVARCHAR(MAX) NULL,
  absent_today_list NVARCHAR(MAX) NULL,
  special_schedule  NVARCHAR(MAX) NULL,
  overtime          NVARCHAR(MAX) NULL,
  sectors           NVARCHAR(MAX) NULL,
  observations      NVARCHAR(MAX) NULL,
  status            NVARCHAR(20) NOT NULL DEFAULT 'PENDENTE',
  last_return_reason NVARCHAR(MAX) NULL,
  audit_history     NVARCHAR(MAX) NULL, -- JSON array
  created_by        NVARCHAR(50) NULL,
  created_at        DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  updated_at        DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
);

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_daily_reports_status')
  CREATE INDEX IX_daily_reports_status ON daily_reports(status);
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_daily_reports_date')
  CREATE INDEX IX_daily_reports_date ON daily_reports(date);

-- Notifications (mural)
IF OBJECT_ID('notifications', 'U') IS NULL
CREATE TABLE notifications (
  id           NVARCHAR(50) PRIMARY KEY,
  title        NVARCHAR(255) NOT NULL,
  message      NVARCHAR(MAX) NOT NULL,
  priority     NVARCHAR(20) NOT NULL DEFAULT 'NORMAL',
  target_type  NVARCHAR(20) NOT NULL DEFAULT 'TODOS',
  target_id    NVARCHAR(50) NULL,
  target_label NVARCHAR(255) NULL,
  author_qra   NVARCHAR(50) NOT NULL,
  author_name  NVARCHAR(255) NULL,
  created_at   DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
);

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_notifications_created')
  CREATE INDEX IX_notifications_created ON notifications(created_at DESC);

-- App settings (key-value)
IF OBJECT_ID('app_settings', 'U') IS NULL
CREATE TABLE app_settings (
  [key]       NVARCHAR(100) PRIMARY KEY,
  value       NVARCHAR(MAX) NOT NULL,
  updated_at  DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
);

GO
