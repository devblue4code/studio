# NRH-GMVV — Ambiente Docker Local (SQL Server)

Sistema de Gestão de RH migrado de Firebase para **SQL Server** com API REST.

## Arquitetura

```
┌─────────────┐     REST/Polling     ┌─────────────┐     SQL      ┌──────────────┐
│  Frontend   │ ◄──────────────────► │  API :3001  │ ◄──────────► │ SQL Server   │
│  Next :9002 │                      │  Express    │              │  :1433       │
└─────────────┘                      └─────────────┘              └──────────────┘
```

O frontend mantém a mesma UI. As chamadas ao Firebase são redirecionadas via **shim de compatibilidade** (`src/firebase/api/`) para a API REST.

## Pré-requisitos

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (Windows/Mac/Linux)
- 4 GB RAM livres (SQL Server exige ~2 GB)

## Início rápido

```bash
# 1. Copiar variáveis de ambiente
cp .env.example .env

# 2. Subir tudo (SQL Server + migração + API + Frontend)
docker compose up --build

# 3. Acessar
# Frontend: http://localhost:9002
# API:      http://localhost:3001/health
```

### Credenciais demo

| Campo | Valor |
|-------|-------|
| QRA | `ADMIN` |
| Senha | `Admin@123` |

## Serviços Docker

| Serviço | Porta | Descrição |
|---------|-------|-----------|
| `sqlserver` | 1433 | Microsoft SQL Server 2022 |
| `migrate` | — | Executa `schema.sql` + `seed.sql` (uma vez) |
| `api` | 3001 | Backend Express + JWT |
| `frontend` | 9002 | Next.js com `NEXT_PUBLIC_USE_API=true` |

## Desenvolvimento sem Docker (frontend local)

```bash
# Terminal 1 — apenas SQL Server + API
docker compose up sqlserver migrate api

# Terminal 2 — frontend local
cp .env.example .env
npm install
npm run dev
```

## Desenvolvimento da API local

```bash
cd backend
cp .env.example .env
npm install
npm run db:migrate   # requer SQL Server rodando
npm run dev
```

## Variáveis de ambiente

| Variável | Padrão | Descrição |
|----------|--------|-----------|
| `DB_PASSWORD` | `YourStrong@Passw0rd` | Senha SA do SQL Server |
| `JWT_SECRET` | `dev-secret-...` | Segredo para tokens JWT |
| `NEXT_PUBLIC_USE_API` | `true` | Usa API em vez de Firebase |
| `NEXT_PUBLIC_API_URL` | `http://localhost:3001` | URL da API |

## Schema do banco

Scripts em `database/`:
- `schema.sql` — cria tabelas
- `seed.sql` — dados iniciais (cargos, escalas, admin demo)

### Tabelas principais

`employees`, `users`, `launches`, `requests`, `vacation_plans`, `daily_reports`, `notifications`, `roles`, `schedules`, `shifts`, `units`, `launch_types`, `shift_periods`, `service_posts`, `app_settings`

## API Endpoints

```
GET  /health
POST /api/auth/login          { qra, password }
POST /api/auth/register       { qra, validationCode, password }
GET  /api/auth/me             (Bearer token)
POST /api/data/query          { collection, where, orderBy, limit }
GET  /api/data/:collection/:id
POST /api/data/:collection
PATCH /api/data/:collection/:id
DELETE /api/data/:collection/:id
GET  /api/data/settings/:key
PUT  /api/data/settings/:key
```

## Voltar ao Firebase (legado)

1. Remova os path aliases do `tsconfig.json` (`firebase/app`, `firebase/firestore`, `firebase/auth`)
2. Defina `NEXT_PUBLIC_USE_API=false`
3. Configure `src/firebase/config.ts` com credenciais Firebase

## Limitações atuais

- **Tempo real**: polling a cada 5s (substitui `onSnapshot` do Firestore)
- **Reset de senha**: endpoint stub (sem envio de e-mail)
- **Alteração de senha no perfil**: em desenvolvimento
- **RBAC**: validado no frontend; API precisa de middleware por cargo (próxima fase)

## Próximos passos

1. Middleware RBAC na API
2. WebSockets para notificações e solicitações
3. Testes de integração
4. Script de migração Firebase → SQL Server
