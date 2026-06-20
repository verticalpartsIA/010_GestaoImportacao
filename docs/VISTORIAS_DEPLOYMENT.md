# 🏗️ Vistorias de Obras — Deployment Guide

## ✅ Completed

### 1. React Component (src/vistorias-obras.jsx)
- ✅ Full feature module created (31KB, 982 lines)
- ✅ Responsive grid layout (3 cols desktop, 2 tablet, 1 mobile)
- ✅ Agendamento form with datetime picker
- ✅ Vistoriador field with text input
- ✅ Tipo dropdown (vistoria, pré-obra, inserção, pós-venda)
- ✅ PDF document upload (max 5 files)
- ✅ Image gallery upload (max 10 images)
- ✅ Status filters (Todas, Agendadas, Em Progresso, Concluídas, Canceladas)
- ✅ Modal detail view with download links
- ✅ Toast notifications in Portuguese
- ✅ Real-time statistics cards with gradients

### 2. Navigation Integration (src/shell.jsx)
- ✅ **FIRST item** in "Instalação & Entrega" section
- ✅ Breadcrumb mapping configured
- ✅ Icon: search 🔍

### 3. Routing Integration (src/app.jsx)
- ✅ Route title added: "Vistorias de Obras"
- ✅ Case handler in renderPage() switch statement
- ✅ Props: obraId={subsel}, setRoute={setRoute}

### 4. Database Schema (migrations/002-create-vistorias-obras-table.sql)
- ✅ Table schema created with TEXT PKs (matches dossier_obra)
- ✅ All columns defined with proper types
- ✅ Foreign key: obra_id → dossier_obra(id) ON DELETE CASCADE
- ✅ Audit columns: criado_em, atualizado_em, criado_por
- ✅ JSONB fields: documentos, imagens (for base64 file storage)

### 5. Database Indices
- ✅ idx_vistorias_obra_id — FK lookups
- ✅ idx_vistorias_status — Filtering
- ✅ idx_vistorias_data_agendada — Sorting
- ✅ idx_vistorias_vistoriador — Search
- ✅ idx_vistorias_tipo — Category filtering
- ✅ idx_vistorias_criado_em — Audit trail

### 6. Database Trigger
- ✅ atualizar_timestamp_vistorias() — Auto-updates atualizado_em

### 7. Row Level Security (RLS) Policies
- ✅ SELECT: Users see only their own dossier vistorias
- ✅ INSERT: Users can only create in their own obras
- ✅ UPDATE: Users can only update their own vistorias
- ✅ DELETE: Users can only delete their own vistorias
- ✅ ADMIN: service_role can manage all

### 8. Git Integration
- ✅ Commit 3f1ddf6: "feat(instalacao): Criar módulo Vistorias de Obras"
- ✅ Commit ff05a61: "fix(migration): Align vistorias_obras table schema"
- ✅ Branch: claude/quirky-dijkstra-q4c502
- ✅ Pushed to origin

---

## ⚠️ Pending: Database Migration Execution

### Why It's Pending

The environment has **network restrictions** that block outbound TCP connections to PostgreSQL ports (5432, 6543, 5433). This prevents automated execution via:
- `psql` CLI
- Node.js `pg` package
- Python `psycopg2`

Additionally, only the **anon key** is available in the environment, which cannot execute DDL (CREATE TABLE, CREATE INDEX, etc.). Migration requires the **service_role key**.

### What You Must Do (Manual Steps)

**Option 1: Via Supabase Dashboard (Recommended)**

1. Go to: https://jxtqwzmpgofwctqajewt.supabase.co
2. Login with: gelson.simoes@verticalparts.com.br / Papa0202%@
3. Navigate to: **SQL Editor** (left sidebar)
4. Click: **New Query**
5. Copy-paste this entire SQL:
   ```sql
   -- Paste contents of migrations/002-create-vistorias-obras-table.sql here
   ```
6. Click: **Run** button
7. Verify in left sidebar: **Tables** → should see `vistorias_obras`

**Option 2: Via Supabase CLI (If Available)**

```bash
# Ensure you have the service_role key in .env
export SUPABASE_ACCESS_TOKEN="<your-supabase-master-pat>"  # See credenciais.md for MASTER key

supabase db push
```

### Migration SQL Location
- **File**: `/home/user/vpprd/migrations/002-create-vistorias-obras-table.sql`
- **Size**: 3.4 KB
- **Statements**: 
  - 1 × CREATE TABLE
  - 6 × CREATE INDEX
  - 1 × CREATE FUNCTION (trigger)
  - 1 × CREATE TRIGGER
  - 5 × CREATE POLICY (RLS)
  - 1 × ALTER TABLE (RLS enable)
  - 4 × COMMENT

---

## 🧪 Post-Migration Testing

Once migration is executed, verify:

### 1. Table Exists
```sql
SELECT table_name FROM information_schema.tables 
WHERE table_name = 'vistorias_obras';
-- Should return 1 row
```

### 2. Indices Created
```sql
SELECT indexname FROM pg_indexes 
WHERE tablename = 'vistorias_obras';
-- Should return 6 rows: idx_vistorias_*
```

### 3. RLS Enabled
```sql
SELECT * FROM pg_tables 
WHERE tablename = 'vistorias_obras' AND rowsecurity = true;
-- Should return 1 row with rowsecurity = true
```

### 4. Trigger Active
```sql
SELECT trigger_name FROM information_schema.triggers 
WHERE trigger_name LIKE 'trg_vistorias%';
-- Should return 1 row: trg_vistorias_atualizar_timestamp
```

### 5. Frontend Test
- [ ] Reload application in browser
- [ ] Navigate to sidebar: **Instalação & Entrega** → **Vistorias de Obras**
- [ ] Stats cards display (may show 0 until data is added)
- [ ] Click **+ Agendar Vistoria**
- [ ] Form opens with all fields
- [ ] Fill form and submit
- [ ] Card appears in grid
- [ ] Click card to open modal
- [ ] Modal shows all details
- [ ] Download buttons work (if documents were uploaded)
- [ ] Filter buttons work (Todas, Agendadas, Concluídas, Canceladas)
- [ ] Mark complete button works
- [ ] Delete button works with confirmation

---

## 📊 Data Model

```
vistorias_obras
├── id (TEXT, PK) — gen_random_uuid()::text
├── obra_id (TEXT, FK→dossier_obra)
├── vistoriador (TEXT, NOT NULL)
├── tipo (TEXT) — vistoria|pre_obra|insercao|pos_venda
├── status (TEXT) — agendada|em_progresso|concluida|cancelada
├── data_agendada (TIMESTAMPTZ, NOT NULL)
├── data_conclusao (TIMESTAMPTZ)
├── observacoes (TEXT)
├── documentos (JSONB) — [{nome, tipo, tamanho, dados}]
├── imagens (JSONB) — [{nome, tipo, tamanho, dados}]
├── criado_em (TIMESTAMPTZ)
├── atualizado_em (TIMESTAMPTZ)
└── criado_por (UUID, FK→auth.users)
```

---

## 🔐 Security Summary

- **RLS Enabled**: ✅ Yes
- **Foreign Keys**: ✅ Cascade delete on obra_id
- **Audit Trail**: ✅ criado_em, atualizado_em, criado_por
- **Type-Safe**: ✅ CHECK constraints on tipo and status
- **Performance**: ✅ 6 strategic indices

---

## 📋 Deployment Checklist

- [x] Component created and integrated
- [x] Navigation added (FIRST item)
- [x] Routes configured
- [x] Migration SQL prepared and schema fixed
- [x] Git commits signed and pushed
- [x] **Pushed to GitHub via MCP**
- [ ] **MANUAL: Execute migration in Supabase Dashboard**
- [ ] Verify table creation
- [ ] Frontend test in browser
- [ ] Create test vistoria record
- [ ] Test document/image upload
- [ ] Test status filtering
- [ ] Test mark complete/delete

---

## 📞 Support

If migration fails in Supabase Dashboard:

1. Check table doesn't already exist: `SELECT * FROM vistorias_obras LIMIT 1`
2. Check dossier_obra exists: `SELECT * FROM dossier_obra LIMIT 1`
3. Review SQL Editor error message for specific constraint violations
4. Contact: Gelson (gelson.simoes@verticalparts.com.br)

---

**Generated**: 2026-06-20  
**Branch**: claude/quirky-dijkstra-q4c502  
**Status**: Pushed to GitHub & Ready for deployment