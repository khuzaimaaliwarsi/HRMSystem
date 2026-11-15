# iSysware HRMS — PostgreSQL Migration & Deployment Guide (Batch 2)

This document details the migration procedures, commands, safety constraints, and verification protocols for the PostgreSQL 18 database `aliyan_hrms_dev`.

---

## 1. Migration Protocol & Safety Constraints

### Strict Rules
1. **Never use `prisma migrate reset`**:
   - `prisma migrate reset` drops the entire database schema and destroys all records. It is strictly prohibited in development and production.
2. **Additive-Only Migrations**:
   - All migrations must be forward-only and additive (`CREATE TYPE`, `CREATE TABLE`, `CREATE INDEX`, `ALTER TABLE ... ADD CONSTRAINT`).
3. **No Unrelated Database Interference**:
   - Never run migrations against `postgres`, `resident_welfare_association`, or any host database other than the explicitly configured `aliyan_hrms_dev`.
4. **Environment Isolation**:
   - Migration credentials are loaded strictly from `backend/.env` (which is git-ignored).

---

## 2. Executed Migration History

### Migration 1: `20261105001924_init_hrms_schema`
- **Timestamp**: 2026-11-05 00:19:24 UTC
- **Status**: Applied Successfully (`prisma migrate deploy`)
- **Target**: `aliyan_hrms_dev` (PostgreSQL 18.6 on 127.0.0.1:5432)
- **Objects Created**:
  - 28 PostgreSQL ENUM types
  - 61 Normalized relational application tables + 1 `_prisma_migrations` tracking table
  - 75 Foreign key constraints
  - 114 Unique indexes / primary keys

---

## 3. Standard Developer Migration Commands

### A. Verify Database Connectivity & State
```bash
npm --prefix backend run db:verify
```

### B. Verify Tables & Constraints
```bash
node backend/src/scripts/verifySchema.js
```

### C. Apply Pending Migrations in CI / Production (Non-Destructive)
```bash
cd backend && npx prisma migrate deploy
```

### D. Generate Fresh Prisma Client After Schema Updates
```bash
cd backend && npx prisma generate
```

### E. Run Full Schema Integration Tests
```bash
npm --prefix backend test
```

