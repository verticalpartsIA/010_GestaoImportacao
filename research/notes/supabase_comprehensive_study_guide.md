# Comprehensive Supabase Expert Study Guide

**Last Updated:** 2026-09-27  
**Source:** Official Supabase Documentation (https://supabase.com/docs)  
**Scope:** Complete coverage of Getting Started, Database, Auth, Storage, Realtime, Edge Functions, Vectors, AI, CLI, Platform, API Reference, Guides, and Pricing

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Core Components](#core-components)
3. [Getting Started & Concepts](#getting-started--concepts)
4. [Database (PostgreSQL)](#database-postgresql)
5. [Authentication (Auth)](#authentication-auth)
6. [Storage](#storage)
7. [Realtime](#realtime)
8. [Edge Functions](#edge-functions)
9. [Vectors & pgvector](#vectors--pgvector)
10. [AI Integrations](#ai-integrations)
11. [CLI & Local Development](#cli--local-development)
12. [Platform Management](#platform-management)
13. [API Reference & SDKs](#api-reference--sdks)
14. [Best Practices & Patterns](#best-practices--patterns)
15. [Anti-Patterns & Common Mistakes](#anti-patterns--common-mistakes)
16. [Security Considerations](#security-considerations)
17. [Performance Optimization](#performance-optimization)
18. [Debugging & Troubleshooting](#debugging--troubleshooting)
19. [Integration Patterns](#integration-patterns)
20. [Migration Guides](#migration-guides)
21. [Rate Limits & Quotas](#rate-limits--quotas)
22. [Recent Updates & Alpha/Beta Features](#recent-updates--alphabeta-features)

---

## Architecture Overview

### Supabase Stack

Supabase provides an open-source Firebase alternative built on:

- **PostgreSQL** - Open-source relational database (12+, 13, 14, 15, 16 supported)
- **PostgREST** - Auto-generated REST API from PostgreSQL schema
- **GoTrue** - Open-source authentication & authorization built on JWT
- **Realtime** - WebSocket-based real-time subscriptions
- **Storage** - S3-compatible object storage with signed URLs
- **Vector/pgvector** - Vector embeddings for semantic search
- **Edge Functions** - Serverless computing at the edge (powered by Deno)

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Client Layer (SDK)                        │
│  supabase-js (Web), supabase-flutter, supabase-py, etc.         │
└─────────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        │                     │                     │
        ▼                     ▼                     ▼
   ┌─────────┐          ┌──────────┐         ┌─────────────┐
   │PostgREST│          │GoTrue    │         │Realtime     │
   │(REST API)          │(Auth)    │         │(WebSocket)  │
   └────┬────┘          └────┬─────┘         └────┬────────┘
        │                    │                     │
        └────────────────────┼─────────────────────┘
                             │
        ┌────────────────────┼────────────────────┐
        │                    │                    │
        ▼                    ▼                    ▼
   ┌──────────────┐  ┌──────────────┐  ┌────────────────┐
   │ PostgreSQL   │  │ Storage      │  │ Edge Functions │
   │ (pgvector)   │  │ (S3 compat.) │  │ (Deno)         │
   └──────────────┘  └──────────────┘  └────────────────┘
```

### Design Principles

1. **Declarative Security** - Authorization via PostgreSQL RLS (Row Level Security), not application logic
2. **Real-time First** - WebSocket subscriptions built into the core
3. **Serverless Functions** - Edge Functions for custom logic without container management
4. **Developer-Friendly API** - Auto-generated REST/GraphQL APIs from schema
5. **Open Source** - All core components are open-source (Apache 2.0, MIT)
6. **PostgreSQL-Native** - Leverage PostgreSQL features directly (JSON, arrays, full-text search, etc.)

---

## Core Components

### 1. PostgreSQL Database

**Purpose:** Primary data store with relational schema capabilities

**Key Features:**
- **Version Support:** PostgreSQL 12+ (versions 12, 13, 14, 15, 16 supported)
- **Extensions:** Full support for PostgreSQL extensions (uuid-ossp, pgvector, pg_trgm, hstore, etc.)
- **Built-in Types:** JSON/JSONB, arrays, ranges, full-text search, UUIDs, enums
- **Replication:** Logical replication to external databases supported
- **Backups:** Automated daily backups with point-in-time recovery (PITR)
- **Vacuum:** Auto-managed with tunable parameters

**Connection Pooling:**
- PgBouncer for connection pooling (reduces resource usage)
- Session vs. Transaction mode pooling
- Connection limits: Standard plan = 100, Pro = 200, Business = Custom

**Performance:**
- Indexes: B-tree, Hash, GiST, GIN, BRIN supported
- Query optimization via PostgreSQL query planner
- Statistics collection and ANALYZE
- Slow query logging available

### 2. PostgREST (Auto-Generated REST API)

**Purpose:** RESTful API automatically generated from PostgreSQL schema

**Key Features:**
- **HTTP Methods:** GET, POST, PATCH, DELETE for CRUD operations
- **Filters:** Complex filtering with operators (eq, neq, gt, lt, gte, lte, like, in, etc.)
- **Pagination:** Limit/offset and keyset pagination
- **Ordering:** Multi-column sorting with direction
- **Embedding:** Foreign key relationships automatically embedded
- **Aggregations:** Count, sum, avg, max, min via SELECT
- **Full-Text Search:** Integrated PostgreSQL full-text search
- **Bulk Operations:** Batch insert/update/delete

**Limitations:**
- Read-only by default (write requires explicit grant via RLS)
- No SQL injection risk (parameterized queries only)
- Auto-increment IDs not returned by default in v11.2+ (must SELECT id after INSERT)
- Foreign key names matter for embedding (`?select=users(*),posts(*)`)

**URL Structure:**
```
GET    /rest/v1/<table>                          # List records
GET    /rest/v1/<table>?id=eq.123                # Filter
GET    /rest/v1/<table>/<pk>                     # Get by PK
POST   /rest/v1/<table>                          # Create
PATCH  /rest/v1/<table>?id=eq.123                # Update
DELETE /rest/v1/<table>?id=eq.123                # Delete
```

### 3. GoTrue (Authentication & Authorization)

**Purpose:** Built-in authentication with JWT-based sessions

**Key Features:**
- **Auth Providers:**
  - Email/Password (with optional email confirmation)
  - OAuth (Google, GitHub, GitLab, Bitbucket, Microsoft, Twitch, Discord, Apple, Slack, Workos)
  - SAML 2.0
  - LDAP
  - Phone/SMS (Twilio integration)
  - Magic Link (passwordless)
  - WebAuthn/Passkeys
- **Session Management:** JWT tokens (access + refresh), session control
- **Multi-Factor Authentication (MFA):** TOTP, phone SMS
- **Row Level Security (RLS):** PostgreSQL policies tied to auth user ID
- **Custom Claims:** JWT custom claims for fine-grained authorization
- **Hooks:** Pre/post auth events (trigger notifications, sync data)

**JWT Token Structure:**
```json
{
  "aud": "authenticated",
  "exp": 1234567890,
  "iat": 1234564290,
  "sub": "<user-uuid>",
  "email": "user@example.com",
  "phone": "",
  "app_metadata": {
    "provider": "email"
  },
  "user_metadata": {
    "custom_claim": "custom_value"
  }
}
```

**RLS (Row Level Security):**
```sql
-- Enable RLS on table
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;

-- Create policy: users can only see their own posts
CREATE POLICY "Users see their own posts"
  ON posts FOR SELECT
  USING (user_id = auth.uid());

-- Create policy: users can only update their own posts
CREATE POLICY "Users update their own posts"
  ON posts FOR UPDATE
  USING (user_id = auth.uid());
```

### 4. Realtime (WebSocket Subscriptions)

**Purpose:** Real-time data synchronization and broadcasts

**Key Features:**
- **Postgres Changes:** Subscribe to INSERT, UPDATE, DELETE events
- **Presence:** Track online users and their presence state
- **Broadcast:** Send custom messages to clients on a channel
- **Filtering:** Fine-grained subscriptions with column-level filters
- **Schema Filtering:** Only receive events from specific schemas/tables

**Subscription Model:**
```javascript
// Subscribe to table changes
supabase
  .channel('posts')
  .on('postgres_changes', {
    event: '*',  // INSERT, UPDATE, DELETE, or specific
    schema: 'public',
    table: 'posts'
  }, (payload) => {
    console.log('Change received!', payload)
  })
  .subscribe()

// Presence tracking
supabase
  .channel('room-1')
  .on('presence', { event: 'sync' }, (payload) => {
    console.log('Online users:', payload.presenceState)
  })
  .subscribe()

// Broadcast
supabase
  .channel('chat')
  .on('broadcast', { event: 'message' }, (payload) => {
    console.log(payload.payload)
  })
  .subscribe()

// Send broadcast
channel.send({
  type: 'broadcast',
  event: 'message',
  payload: { message: 'Hello' }
})
```

**Limitations:**
- Connections timeout after 24 hours (reconnect handled by SDK)
- Realtime max message size: ~64KB
- Presence state lost on disconnect (not persisted)
- Channel names limited to 250 characters

### 5. Storage (S3-Compatible Object Store)

**Purpose:** File uploads/downloads with signed URLs and CDN

**Key Features:**
- **Buckets:** Separate namespaces for file organization
- **Public/Private:** Access control at bucket and object level
- **Signed URLs:** Time-limited download links (max 1 week)
- **CDN Integration:** Files served via edge CDN with caching
- **Resumable Uploads:** Large file upload support
- **Duplicate Handling:** Overwrite or create versions
- **CORS Support:** Cross-origin requests configurable
- **Transformations:** Image resizing, formatting via query params

**URL Format:**
```
GET  /storage/v1/object/public/<bucket>/<path>
POST /storage/v1/object/<bucket>/<path>
GET  /storage/v1/object/sign/<bucket>/<path>  # Create signed URL
```

**File Size Limits (by plan):**
- Free: 1GB per bucket, 50MB per file
- Pro: 100GB per bucket, 5GB per file
- Enterprise: Custom limits

**Example:** Image transformation via URL
```
https://project.supabase.co/storage/v1/object/public/images/photo.jpg
  ?width=300&height=300&quality=80
```

### 6. Edge Functions (Serverless Computing)

**Purpose:** Custom business logic deployed globally at the edge

**Key Features:**
- **Runtime:** Deno (TypeScript-first, secure by default)
- **Deployment:** Deployed from GitHub or via CLI
- **Environment Variables:** Secrets management with encryption
- **Database Access:** Direct PostgreSQL connection string provided
- **Request/Response:** HTTP-based serverless functions
- **Timeout:** 5-10 minutes per function
- **Memory:** 512MB memory, scalable CPU
- **Cold Starts:** Minimal (Deno runtime cached)
- **CORS:** Configurable per function
- **Logging:** Structured logging via stderr/stdout

**Example Edge Function:**
```typescript
// supabase/functions/hello-world/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

serve(async (req) => {
  const { name } = await req.json()
  
  return new Response(
    JSON.stringify({ message: `Hello ${name}` }),
    { headers: { "Content-Type": "application/json" } }
  )
})
```

**Invocation:**
```javascript
const { data, error } = await supabase.functions.invoke('hello-world', {
  body: { name: 'World' },
})
```

**Limits (by plan):**
- Free: 500K invocations/month, 10s timeout
- Pro: 2M invocations/month, 60s timeout
- Enterprise: Custom limits, 10m timeout

### 7. pgvector (Vector Embeddings)

**Purpose:** Store and query vector embeddings for semantic search/AI

**Key Features:**
- **Vector Type:** Native PostgreSQL vector type (float4, float8)
- **Similarity Search:** L2, cosine, inner product distance metrics
- **Indexing:** IVFFLAT and HNSW index types for fast retrieval
- **Integration:** Works with OpenAI embeddings, Hugging Face models, etc.
- **Operations:** Vector addition, subtraction, normalization

**Example:**
```sql
-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Create table with vector column
CREATE TABLE documents (
  id bigserial PRIMARY KEY,
  content text,
  embedding vector(1536)  -- OpenAI embedding dimension
);

-- Create index for faster similarity search
CREATE INDEX ON documents USING ivfflat (embedding vector_cosine_ops);

-- Query similar documents
SELECT id, content, 1 - (embedding <=> $1::vector) as similarity
FROM documents
ORDER BY embedding <=> $1::vector
LIMIT 5;
```

**Distance Operators:**
- `<->` L2 distance (Euclidean)
- `<#>` Negative inner product
- `<=>` Cosine distance

**Indexes:**
- IVFFLAT: Faster, approximate (95%+ recall)
- HNSW: Exact, slower (newer, more efficient)

---

## Getting Started & Concepts

### Project Setup

**1. Create Supabase Project**
- Go to https://supabase.com/dashboard
- Create new project (choose region, set password)
- Copy API keys: `anon` (client-side) and `service_role` (server-side)

**2. Install SDK**
```bash
npm install @supabase/supabase-js  # Web/Node.js
flutter pub add supabase           # Flutter
pip install supabase               # Python
```

**3. Initialize Client**
```javascript
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://PROJECT_ID.supabase.co',
  'ANON_KEY'
)
```

### Key Concepts

**1. Project ID**
- Unique identifier for your Supabase project
- Used in API URLs: `https://<PROJECT_ID>.supabase.co`
- Found in project settings

**2. API Keys**
- **Anon Key:** Client-side key, limited by RLS and public buckets
- **Service Role Key:** Server-side key, bypasses RLS (KEEP SECRET)
- Rotate regularly, revoke compromised keys immediately

**3. Database URL**
- PostgreSQL connection string: `postgres://user:password@host:5432/postgres`
- Use with PgBouncer for connection pooling (recommended)
- Never expose in client code

**4. JWT (JSON Web Token)**
- Default expiry: 1 hour (access token)
- Refresh token: 7 days (configurable)
- Stored in localStorage by SDK (configurable persistence)
- Includes `sub` (user ID), `email`, `app_metadata`, `user_metadata`

**5. Schema Public vs. Auth**
- **public schema:** Default, tables visible to PostgREST API
- **auth schema:** Internal, manages auth data (users, sessions, etc.)
- Other schemas created by you are NOT exposed to PostgREST by default

---

## Database (PostgreSQL)

### Schema Design

**1. Essential Tables for Most Apps**

```sql
-- Users (auto-created by auth system)
-- Managed by GoTrue - do not create manually

-- Example: User profiles (extend auth.users)
CREATE TABLE profiles (
  id uuid PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  username text UNIQUE,
  avatar_url text,
  full_name text,
  created_at timestamp with time zone DEFAULT now()
);

-- Example: Posts
CREATE TABLE posts (
  id bigserial PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  content text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Example: Comments
CREATE TABLE comments (
  id bigserial PRIMARY KEY,
  post_id bigint NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content text NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);

-- Example: Likes (junction table)
CREATE TABLE likes (
  id bigserial PRIMARY KEY,
  post_id bigint NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at timestamp with time zone DEFAULT now(),
  UNIQUE(post_id, user_id)
);
```

**2. Column Types & Best Practices**

| Type | Use Case | Notes |
|------|----------|-------|
| `uuid` | User IDs, primary keys | Auto-gen with `gen_random_uuid()`, immutable |
| `bigserial` | Sequential IDs | Auto-incrementing, use for non-user data |
| `timestamp with time zone` | Timestamps | Always use TZ-aware, store UTC |
| `text` | Strings | Unlimited length, no perf penalty vs varchar |
| `jsonb` | Flexible data | Indexed, queryable, better than text |
| `array` | Collections | Native PostgreSQL arrays, searchable |
| `boolean` | Flags | Nullable by default (true/false/null) |
| `integer` | Numbers | -2B to +2B range, use `bigint` for larger |
| `numeric(p,s)` | Decimal money | Use for financial data, never float |
| `date` / `time` | Date/time only | Without timezone, careful with conversions |

**3. Indexes**

```sql
-- Single column index
CREATE INDEX idx_posts_user_id ON posts(user_id);

-- Composite index (order matters!)
CREATE INDEX idx_comments_post_user ON comments(post_id, user_id);

-- Full-text search index
CREATE INDEX idx_posts_content_fts ON posts USING gin(to_tsvector('english', content));

-- Partial index (smaller, faster for common queries)
CREATE INDEX idx_active_users ON profiles(id) WHERE deleted_at IS NULL;

-- JSONB index
CREATE INDEX idx_data_jsonb ON table_name USING gin(data);
```

**4. Foreign Keys & Cascades**

```sql
-- Default: RESTRICT (prevent delete if referenced)
REFERENCES parent(id)

-- CASCADE: Delete child when parent deleted
REFERENCES parent(id) ON DELETE CASCADE

-- SET NULL: Set to NULL when parent deleted
REFERENCES parent(id) ON DELETE SET NULL

-- SET DEFAULT: Use column default when parent deleted
REFERENCES parent(id) ON DELETE SET DEFAULT

-- NO ACTION: Same as RESTRICT but checked after triggers
REFERENCES parent(id) ON DELETE NO ACTION
```

### Query Patterns with PostgREST

**1. Basic CRUD Operations**

```javascript
// Create
const { data, error } = await supabase
  .from('posts')
  .insert({ title: 'Hello', content: 'World', user_id: userId })
  .select()

// Read
const { data } = await supabase
  .from('posts')
  .select()

// Update
const { data } = await supabase
  .from('posts')
  .update({ title: 'Updated' })
  .eq('id', 1)
  .select()

// Delete
const { error } = await supabase
  .from('posts')
  .delete()
  .eq('id', 1)
```

**2. Filtering**

```javascript
// Equals
.eq('status', 'published')

// Not equals
.neq('status', 'draft')

// Greater than / less than
.gt('created_at', '2024-01-01')
.lt('price', 100)
.gte('rating', 4)
.lte('age', 65)

// In array
.in('status', ['published', 'scheduled'])

// Null checks
.is('deleted_at', null)

// Text search
.like('title', '%javascript%')  // Case-sensitive
.ilike('title', '%javascript%') // Case-insensitive

// Full-text search
.textSearch('content', 'search query')

// Range contains
.contains('tags', ['javascript', 'web'])  // For array columns
.containedBy('tags', ['javascript', 'web', 'python'])

// Filters can be chained
.select()
.eq('status', 'published')
.gt('views', 1000)
.order('created_at', { ascending: false })
```

**3. Relationships & Embedding**

```javascript
// One-to-many: select posts with user details
const { data } = await supabase
  .from('posts')
  .select(`
    id,
    title,
    user:profiles(username, avatar_url)
  `)

// Many-to-many: select posts with comments and commenters
const { data } = await supabase
  .from('posts')
  .select(`
    id,
    title,
    comments(id, content, user:profiles(username))
  `)

// Nested embedding (3+ levels)
const { data } = await supabase
  .from('posts')
  .select(`
    id,
    title,
    comments(
      id,
      content,
      user:profiles(username),
      likes(id)
    )
  `)

// With filters on related data
const { data } = await supabase
  .from('posts')
  .select(`
    id,
    title,
    comments!comments_post_id_fkey(id, content)
  `)
  .eq('comments.user_id', userId)
```

**Key Point:** Foreign key name must match table_name + id (e.g., `user_id` → `users` table as `user`) or explicit relationship syntax with `!` operator.

**4. Pagination**

```javascript
// Limit/Offset (simple but inefficient for large datasets)
const { data } = await supabase
  .from('posts')
  .select()
  .range(0, 9)  // Get 10 items (0-9)

// Keyset pagination (faster, better for infinite scroll)
const { data } = await supabase
  .from('posts')
  .select('*', { count: 'exact' })
  .order('id', { ascending: false })
  .range(0, 9)
  .limit(10)
```

**5. Aggregations**

```javascript
// Count rows
const { count } = await supabase
  .from('posts')
  .select('*', { count: 'exact', head: true })

// Count with filter
const { count } = await supabase
  .from('posts')
  .select('*', { count: 'exact', head: true })
  .eq('user_id', userId)

// Aggregate in query (via PostgREST select)
// Note: PostgREST has limited aggregation; use SQL for complex cases
```

**6. Full-Text Search**

```javascript
// Full-text search (requires tsvector column or on-the-fly conversion)
const { data } = await supabase
  .from('posts')
  .select()
  .textSearch('content', 'design system & web')

// Or use raw SQL for complex search
const { data } = await supabase.rpc('search_posts', {
  query: 'design system'
})
```

### Transactions & Raw SQL

**1. Raw SQL Queries**

```javascript
// Execute raw SQL (useful for complex queries, transactions)
const { data, error } = await supabase
  .rpc('my_function')

// Or using client.query() for direct PostgreSQL queries
const client = await supabase.client.connect()
const result = await client.query('SELECT * FROM posts WHERE user_id = $1', [userId])
await client.end()
```

**2. SQL Transactions with Edge Functions**

```typescript
// In an Edge Function
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL'),
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
)

await supabase.rpc('my_transaction')

// Better: use PostgreSQL stored procedure for atomicity
// supabase/sql/transactions.sql
CREATE OR REPLACE FUNCTION transfer_credits(
  from_user_id uuid,
  to_user_id uuid,
  amount int
) RETURNS boolean AS $$
BEGIN
  UPDATE users SET credits = credits - amount WHERE id = from_user_id;
  UPDATE users SET credits = credits + amount WHERE id = to_user_id;
  RETURN true;
END;
$$ LANGUAGE plpgsql;
```

### Migrations & Schema Management

**1. Create Migrations**

```bash
# Create a new migration
supabase migration new create_posts_table

# Adds migration to supabase/migrations/<timestamp>_create_posts_table.sql
```

**2. Migration Content**

```sql
-- supabase/migrations/20240101000000_create_posts_table.sql
CREATE TABLE public.posts (
  id bigserial PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  title text NOT NULL,
  content text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Down migration (for rollback)
-- DROP TABLE public.posts;
```

**3. Apply Migrations**

```bash
# Apply to local database
supabase db push

# Reset local database and reapply all migrations
supabase db reset

# Pull remote schema (after manual changes)
supabase db pull
```

### Replication & Backups

**1. Logical Replication**

```sql
-- Enable publication on source database
CREATE PUBLICATION supabase_publication FOR ALL TABLES;

-- Subscribe on target database
CREATE SUBSCRIPTION supabase_subscription
  CONNECTION 'postgresql://user:password@source-host/db'
  PUBLICATION supabase_publication;

-- Monitor replication lag
SELECT slot_name, restart_lsn, confirmed_flush_lsn FROM pg_replication_slots;
```

**2. Automated Backups**

- **Free Plan:** Daily backups, 7-day retention
- **Pro Plan:** Daily backups, 30-day retention
- **Enterprise:** Custom retention, point-in-time recovery (PITR)
- Access backups in Project Settings → Backups

**3. Point-in-Time Recovery (PITR)**

```bash
# Available in Pro/Enterprise tiers
# Requires logical replication enabled

# Request PITR via CLI or dashboard
supabase db restore --backup-id <backup_id>
```

### Vacuum & Maintenance

**1. Auto-Vacuum Settings**

```sql
-- Check current settings
SELECT * FROM pg_settings WHERE name LIKE '%vacuum%';

-- Adjust for high-write tables (e.g., logs, events)
ALTER TABLE events SET (autovacuum_vacuum_scale_factor = 0.01);
ALTER TABLE events SET (autovacuum_analyze_scale_factor = 0.005);
```

**2. Analyze Statistics**

```sql
-- Manually analyze table (for query planner optimization)
ANALYZE posts;

-- Monitor table bloat
SELECT schemaname, tablename, 
  ROUND(100 * pg_relation_size(schemaname||'.'||tablename) / pg_total_relation_size(schemaname||'.'||tablename)) AS table_bloat_percent
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

---

## Authentication (Auth)

### Email/Password Authentication

**1. Sign Up**

```javascript
const { data, error } = await supabase.auth.signUp({
  email: 'user@example.com',
  password: 'SecurePassword123',
  options: {
    data: {
      first_name: 'John',
      last_name: 'Doe'
    }
  }
})

if (error) {
  console.error('Signup error:', error)
} else {
  console.log('User:', data.user)
  console.log('Session:', data.session)
  // If email confirmation required: "Check your email for confirmation link"
}
```

**2. Sign In**

```javascript
const { data, error } = await supabase.auth.signInWithPassword({
  email: 'user@example.com',
  password: 'SecurePassword123'
})

if (error) {
  console.error('Login error:', error)
} else {
  console.log('User:', data.user)
  console.log('Session:', data.session)
}
```

**3. Password Reset**

```javascript
// Step 1: Request reset
const { error } = await supabase.auth.resetPasswordForEmail(
  'user@example.com',
  { redirectTo: 'https://yourapp.com/auth/callback' }
)

// Step 2: User clicks link in email, gets redirected with recovery_token
// Step 3: Update password with recovery token
const { data, error } = await supabase.auth.updateUser(
  { password: 'NewPassword123' }
)
```

**4. Session Management**

```javascript
// Get current session
const { data } = await supabase.auth.getSession()
console.log(data.session)

// Get current user
const { data } = await supabase.auth.getUser()
console.log(data.user)

// Refresh token
const { data, error } = await supabase.auth.refreshSession()

// Sign out
const { error } = await supabase.auth.signOut()
```

### OAuth Authentication

**1. Configure OAuth Provider**

1. Go to Project Settings → Authentication → Providers
2. Select provider (Google, GitHub, etc.)
3. Enter Client ID and Client Secret from provider
4. Set redirect URL: `https://PROJECT_ID.supabase.co/auth/v1/callback`

**2. Implement OAuth Sign In**

```javascript
// Google OAuth
const { data, error } = await supabase.auth.signInWithOAuth({
  provider: 'google',
  options: {
    redirectTo: 'https://yourapp.com/auth/callback'
  }
})

if (data.url) {
  // Redirect to OAuth provider
  window.location.href = data.url
}

// After redirect back to app, session is automatically set
const { data } = await supabase.auth.getSession()
```

**3. OAuth Providers Supported**

- Google
- GitHub
- GitLab
- Bitbucket
- Microsoft
- Twitch
- Discord
- Apple
- Slack
- Workos (Enterprise SSO)

### Multi-Factor Authentication (MFA)

**1. TOTP Setup**

```javascript
// Step 1: User initiates MFA setup
const { data, error } = await supabase.auth.mfa.enroll({
  factorType: 'totp'
})

const { qr_code, secret } = data

// Step 2: Display QR code to user (scan with authenticator app)
// Step 3: User enters TOTP code
const { data, error } = await supabase.auth.mfa.verify({
  factorId: data.id,
  code: '123456'
})
```

**2. Phone/SMS MFA**

```javascript
// Requires Twilio integration
const { data, error } = await supabase.auth.mfa.enroll({
  factorType: 'phone',
  phone: '+1234567890'
})

// Verify with OTP sent via SMS
const { data, error } = await supabase.auth.mfa.verify({
  factorId: data.id,
  code: '123456'
})
```

**3. MFA During Login**

```javascript
// After sign-in, if MFA is required
const { data, error } = await supabase.auth.signInWithPassword({
  email: 'user@example.com',
  password: 'password'
})

if (data.session === null && data.user.factors.length > 0) {
  // MFA is required
  // Prompt user for MFA code
  
  const { data, error } = await supabase.auth.mfa.challenge({
    factorId: data.user.factors[0].id
  })
  
  // After user enters code
  const { data, error } = await supabase.auth.mfa.verify({
    factorId: data.user.factors[0].id,
    code: userEnteredCode,
    challengeId: data.id
  })
}
```

### Row Level Security (RLS)

**1. Enable RLS**

```sql
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
```

**2. Basic Policies**

```sql
-- Profiles: Users can see all profiles, but only update their own
CREATE POLICY "Public profiles are viewable by everyone" ON profiles
  FOR SELECT USING (true);

CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Posts: Users can see all posts, but only update/delete their own
CREATE POLICY "Posts are viewable by everyone" ON posts
  FOR SELECT USING (true);

CREATE POLICY "Users can insert their own posts" ON posts
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own posts" ON posts
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own posts" ON posts
  FOR DELETE USING (auth.uid() = user_id);
```

**3. Advanced RLS Examples**

```sql
-- Comments: Users see comments on public posts, can edit/delete own comments
CREATE POLICY "Comments on public posts are viewable" ON comments
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM posts WHERE posts.id = comments.post_id AND posts.published = true)
  );

CREATE POLICY "Users can create comments on public posts" ON comments
  FOR INSERT WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (SELECT 1 FROM posts WHERE posts.id = comments.post_id AND posts.published = true)
  );

CREATE POLICY "Users can update own comments" ON comments
  FOR UPDATE USING (auth.uid() = user_id);

-- Admin bypass: Admins can see/modify all records
CREATE POLICY "Admins can do anything" ON posts
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );

-- Shared access: Users can see posts shared with them
CREATE POLICY "Users see shared posts" ON posts
  FOR SELECT USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM post_shares WHERE post_id = posts.id AND user_id = auth.uid()
    )
  );
```

**4. RLS Testing**

```javascript
// Test RLS by making requests as different users

// As user A
const { data: userAPosts } = await supabase
  .from('posts')
  .select()

// As user B (will only see their own posts if RLS is configured correctly)
const { data: userBPosts } = await supabase
  .from('posts')
  .select()
```

### JWT & Custom Claims

**1. JWT Token Structure**

```javascript
// Decode token to see claims
const { data } = await supabase.auth.getSession()
const token = data.session.access_token

// Decoded JWT:
{
  "aud": "authenticated",
  "exp": 1234567890,
  "iat": 1234564290,
  "sub": "user-uuid",
  "email": "user@example.com",
  "phone": "",
  "app_metadata": {
    "provider": "email",
    "providers": ["email"]
  },
  "user_metadata": {
    "first_name": "John",
    "last_name": "Doe"
  },
  "role": "authenticated"
}
```

**2. Add Custom Claims**

```javascript
// Update user metadata (stored in JWT)
const { data, error } = await supabase.auth.updateUser({
  data: { 
    role: 'admin',
    department: 'engineering'
  }
})

// Access in JWT
const { data } = await supabase.auth.getSession()
const role = data.session.user.user_metadata.role
```

**3. Use Custom Claims in RLS**

```sql
CREATE POLICY "Admins can moderate posts" ON posts
  FOR UPDATE USING (
    (auth.jwt() ->> 'user_metadata')::jsonb ->> 'role' = 'admin'
  );
```

### Auth Hooks

**1. Configure Hooks**

Go to Project Settings → Authentication → Hooks

**2. Custom SMS Provider (via webhook)**

```bash
# Custom SMS Provider webhook
POST https://yourapp.com/auth/sms

# Payload:
{
  "phone_number": "+1234567890",
  "otp": "123456",
  "message_id": "msg_123"
}

# Response: 200 OK (or 5xx to retry)
```

**3. Pre-Registration Hook**

```bash
# Pre-registration webhook
POST https://yourapp.com/auth/pre-register

# Payload:
{
  "user_id": "user-uuid",
  "email": "user@example.com",
  "user_metadata": { ... }
}

# Response:
{
  "allow": true,  // or false to reject signup
  "error_message": "Signup not allowed"
}
```

---

## Storage

### Bucket Management

**1. Create Bucket**

```javascript
// Create public bucket (files accessible via public URL)
const { data, error } = await supabase
  .storage
  .createBucket('avatars', {
    public: true,
    fileSizeLimit: 1048576  // 1MB in bytes
  })

// Create private bucket
const { data, error } = await supabase
  .storage
  .createBucket('private-documents', {
    public: false
  })
```

**2. Upload File**

```javascript
// Simple upload
const { data, error } = await supabase.storage
  .from('avatars')
  .upload('user-123/avatar.jpg', file, {
    cacheControl: '3600',
    upsert: false  // true to overwrite
  })

// Resumable upload for large files
const upload$ = supabase.storage
  .from('avatars')
  .upload('user-123/large-file.mov', file, {
    onUploadProgress: (progress) => {
      const percent = (progress.loaded / progress.total) * 100
      console.log(`Upload progress: ${percent}%`)
    }
  })
```

**3. Download File**

```javascript
// Get file as blob
const { data, error } = await supabase.storage
  .from('avatars')
  .download('user-123/avatar.jpg')

// Create download link
const url = supabase.storage
  .from('avatars')
  .getPublicUrl('user-123/avatar.jpg')

// URL for public bucket:
// https://PROJECT_ID.supabase.co/storage/v1/object/public/avatars/user-123/avatar.jpg
```

**4. Delete File**

```javascript
const { error } = await supabase.storage
  .from('avatars')
  .remove(['user-123/avatar.jpg', 'user-456/avatar.jpg'])
```

### Signed URLs

**1. Create Signed URL**

```javascript
// Signed URL valid for 1 hour
const { data, error } = await supabase.storage
  .from('private-documents')
  .createSignedUrl('user-123/secret.pdf', 3600)

const signedUrl = data.signedUrl
// https://PROJECT_ID.supabase.co/storage/v1/object/sign/private-documents/...?token=...
```

**2. Signed URL for Download**

```javascript
const { data, error } = await supabase.storage
  .from('documents')
  .createSignedUrl('user-123/contract.pdf', 86400, {
    download: 'contract.pdf'  // Forces download with name
  })
```

**3. Batch Create Signed URLs**

```javascript
const { data, error } = await supabase.storage
  .from('documents')
  .createSignedUrls([
    'user-123/doc1.pdf',
    'user-123/doc2.pdf',
    'user-123/doc3.pdf'
  ], 3600)
```

### Image Transformations

**1. Image Resizing**

```
https://PROJECT_ID.supabase.co/storage/v1/object/public/avatars/user-123/photo.jpg
  ?width=300&height=300&quality=80

# Parameters:
- width: Width in pixels
- height: Height in pixels
- quality: 1-100 (default 80)
- resize: "cover" (default), "contain", "fill"
- format: "origin" (default), "jpg", "png", "webp"
```

**2. CDN Performance**

- Images cached at edge CDN globally
- Cache headers: `Cache-Control: public, max-age=31536000` (1 year for immutable assets)
- Automatic format optimization based on browser support

### File Permissions & RLS

**1. Bucket-Level Access**

```sql
-- Example: Users can only access their own avatar
CREATE POLICY "Users can upload their own avatar" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'avatars'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can delete their own avatar" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'avatars'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
```

**2. Check File Permissions**

```javascript
// Client doesn't directly check permissions, rely on RLS
// Server can check with service role key:

const { data, error } = await supabase.storage
  .from('avatars')
  .list('user-123', {
    limit: 100,
    offset: 0,
    sortBy: { column: 'name', order: 'asc' }
  })
```

### Storage Limits

| Plan | Storage | File Size | Upload Bandwidth |
|------|---------|-----------|------------------|
| Free | 1GB | 50MB | 2GB/month |
| Pro | 100GB | 5GB | 100GB/month |
| Team | 200GB | 5GB | 200GB/month |
| Enterprise | Custom | Custom | Custom |

---

## Realtime

### Postgres Changes Subscriptions

**1. Subscribe to Table Changes**

```javascript
const channel = supabase
  .channel('posts-channel')
  .on(
    'postgres_changes',
    {
      event: '*',  // INSERT, UPDATE, DELETE, or *
      schema: 'public',
      table: 'posts'
    },
    (payload) => {
      console.log('Change received!', payload)
      // payload.eventType: 'INSERT', 'UPDATE', 'DELETE'
      // payload.new: New record (for INSERT/UPDATE)
      // payload.old: Old record (for UPDATE/DELETE)
    }
  )
  .subscribe()

// Unsubscribe
channel.unsubscribe()
```

**2. Filter Changes**

```javascript
const channel = supabase
  .channel('user-posts')
  .on(
    'postgres_changes',
    {
      event: '*',
      schema: 'public',
      table: 'posts',
      filter: `user_id=eq.${userId}`
    },
    (payload) => {
      // Only changes to posts by this user
    }
  )
  .subscribe()
```

**3. Multiple Subscriptions**

```javascript
const channel = supabase.channel('multi-channel')
  .on(
    'postgres_changes',
    { event: '*', schema: 'public', table: 'posts' },
    (payload) => console.log('Posts:', payload)
  )
  .on(
    'postgres_changes',
    { event: '*', schema: 'public', table: 'comments' },
    (payload) => console.log('Comments:', payload)
  )
  .subscribe()
```

### Presence Tracking

**1. Track Presence**

```javascript
const channel = supabase.channel('room-1', { config: { presence: { key: userId } } })

channel
  .on('presence', { event: 'sync' }, () => {
    const users = channel.presenceState()
    console.log('Online users:', users)
    // users = { [user_id]: [{ user_id, presence_ref, ... }] }
  })
  .on('presence', { event: 'join' }, ({ key, newPresences }) => {
    console.log('User joined:', newPresences)
  })
  .on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
    console.log('User left:', leftPresences)
  })
  .subscribe(async (status) => {
    if (status === 'SUBSCRIBED') {
      // Add current user to presence
      const presenceStatus = await channel.track({
        online_at: new Date().toISOString(),
        user_status: 'active'
      })
      console.log(presenceStatus)
    }
  })

// Update presence
channel.track({
  user_status: 'away'
})

// Unsubscribe
channel.unsubscribe()
```

**2. Presence State Structure**

```javascript
{
  "user-1": [
    {
      "user_id": "user-1",
      "online_at": "2024-01-01T00:00:00Z",
      "user_status": "active",
      "presence_ref": "xyz123"
    }
  ]
}
```

### Broadcasting

**1. Broadcast Messages**

```javascript
const channel = supabase.channel('chat')

channel.subscribe((status) => {
  if (status === 'SUBSCRIBED') {
    // Send a message
    channel.send({
      type: 'broadcast',
      event: 'message',
      payload: { text: 'Hello everyone!' }
    })
  }
})

// Receive broadcasts
channel.on('broadcast', { event: 'message' }, (payload) => {
  console.log('Message received:', payload)
})
```

**2. Broadcast with Server-Side Validation**

```typescript
// Edge Function to validate and broadcast
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

serve(async (req) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  const { message } = await req.json()

  // Validate message
  if (!message || message.length > 500) {
    return new Response(
      JSON.stringify({ error: 'Invalid message' }),
      { status: 400 }
    )
  }

  // Broadcast to all clients
  await supabase.realtime.broadcast('chat', {
    event: 'message',
    payload: { text: message, timestamp: new Date() }
  })

  return new Response(JSON.stringify({ success: true }))
})
```

### Realtime Configuration

**1. Enable/Disable Realtime**

```sql
-- In Supabase dashboard: Project Settings → Replication

-- For specific tables, disable replication for high-volume tables
ALTER PUBLICATION supabase_realtime DROP TABLE events;

-- Re-add a table
ALTER PUBLICATION supabase_realtime ADD TABLE events;
```

**2. Connection Limits**

- Free: Up to 200 concurrent connections
- Pro: Up to 500 concurrent connections
- Enterprise: Custom limits

---

## Edge Functions

### Getting Started

**1. Create Function**

```bash
supabase functions new hello-world
```

**2. Function Structure**

```typescript
// supabase/functions/hello-world/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

serve(async (req) => {
  console.log("Function invoked")

  return new Response(
    JSON.stringify({ message: 'Hello from Edge Function!' }),
    {
      headers: { "Content-Type": "application/json" },
      status: 200
    }
  )
})
```

**3. Invoke Function**

```javascript
const { data, error } = await supabase.functions.invoke('hello-world', {
  body: {
    name: 'World'
  }
})

console.log(data)
```

### Advanced Patterns

**1. Database Access**

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

serve(async (req) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  const { data, error } = await supabase
    .from('posts')
    .select()
    .limit(10)

  if (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400 }
    )
  }

  return new Response(
    JSON.stringify(data),
    { headers: { "Content-Type": "application/json" } }
  )
})
```

**2. Authentication with JWT**

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

serve(async (req) => {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) {
    return new Response(
      JSON.stringify({ error: 'Missing Authorization header' }),
      { status: 401 }
    )
  }

  const token = authHeader.replace('Bearer ', '')
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  const { data, error } = await supabase.auth.getUser(token)
  if (error) {
    return new Response(
      JSON.stringify({ error: 'Invalid token' }),
      { status: 401 }
    )
  }

  return new Response(
    JSON.stringify({ user_id: data.user.id }),
    { headers: { "Content-Type": "application/json" } }
  )
})
```

**3. CORS Handling**

```typescript
serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization'
      }
    })
  }

  return new Response(
    JSON.stringify({ message: 'OK' }),
    {
      headers: {
        "Content-Type": "application/json",
        'Access-Control-Allow-Origin': '*'
      }
    }
  )
})
```

**4. Error Handling**

```typescript
serve(async (req) => {
  try {
    // Function logic
    const { data } = await supabase.from('posts').select()
    return new Response(JSON.stringify(data))
  } catch (error) {
    console.error('Error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500 }
    )
  }
})
```

### Testing & Debugging

**1. Local Testing**

```bash
supabase functions serve hello-world

# Call locally
curl -X POST http://localhost:54321/functions/v1/hello-world \
  -H "Authorization: Bearer ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"name":"World"}'
```

**2. Logging**

```typescript
// Logs appear in `supabase functions serve` output
console.log('Info message')
console.error('Error message')
console.warn('Warning message')

// Also available in Supabase dashboard: Edge Function Logs
```

**3. Deployment**

```bash
# Deploy to Supabase
supabase functions deploy hello-world

# View logs
supabase functions logs hello-world

# Verify deployment
curl https://PROJECT_ID.supabase.co/functions/v1/hello-world \
  -H "Authorization: Bearer ANON_KEY"
```

### Function Limits

| Resource | Free | Pro | Enterprise |
|----------|------|-----|------------|
| Invocations/month | 500K | 2M | Custom |
| Timeout | 10s | 60s | 10m |
| Memory | 512MB | 512MB | Custom |
| Payload size | 6MB | 6MB | Custom |
| Concurrent executions | 10 | 50 | Custom |

---

## Vectors & pgvector

### pgvector Setup

**1. Enable pgvector**

```sql
-- Enable extension (usually pre-enabled in Supabase)
CREATE EXTENSION IF NOT EXISTS vector;

-- Verify installation
SELECT * FROM pg_extension WHERE extname = 'vector';
```

**2. Create Vector Table**

```sql
CREATE TABLE documents (
  id bigserial PRIMARY KEY,
  content text,
  embedding vector(1536),  -- 1536 for OpenAI embeddings
  metadata jsonb,
  created_at timestamp with time zone DEFAULT now()
);

-- Create index for faster search
CREATE INDEX documents_embedding_idx 
  ON documents USING ivfflat (embedding vector_cosine_ops) 
  WITH (lists = 100);

-- Alternative: HNSW index (newer, exact)
CREATE INDEX documents_embedding_idx 
  ON documents USING hnsw (embedding vector_cosine_ops);
```

### Vector Operations

**1. Store Embeddings**

```javascript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

serve(async (req) => {
  const { text } = await req.json()

  // Generate embedding using OpenAI
  const embeddingRes = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      input: text,
      model: 'text-embedding-3-small'
    })
  })

  const { data } = await embeddingRes.json()
  const embedding = data[0].embedding

  // Store in database
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  const { error } = await supabase
    .from('documents')
    .insert({
      content: text,
      embedding: embedding
    })

  return new Response(JSON.stringify({ success: !error }))
})
```

**2. Semantic Search**

```javascript
const { data, error } = await supabase
  .rpc('match_documents', {
    query_embedding: queryVector,  // Pre-computed query embedding
    match_threshold: 0.78,
    match_count: 10
  })
```

**SQL Function for RPC:**

```sql
CREATE OR REPLACE FUNCTION match_documents(
  query_embedding vector,
  match_threshold float,
  match_count int
)
RETURNS TABLE (
  id bigint,
  content text,
  similarity float
)
LANGUAGE SQL
AS $$
  SELECT
    id,
    content,
    1 - (embedding <=> query_embedding) as similarity
  FROM documents
  WHERE 1 - (embedding <=> query_embedding) > match_threshold
  ORDER BY embedding <=> query_embedding
  LIMIT match_count;
$$;
```

**3. Distance Metrics**

```sql
-- L2 (Euclidean) distance: <->
SELECT 1 - (embedding <-> query_embedding) as similarity

-- Cosine distance: <=> (recommended for embeddings)
SELECT 1 - (embedding <=> query_embedding) as similarity

-- Inner product: <#>
SELECT (embedding <#> query_embedding) as similarity
```

### Embedding Providers

**1. OpenAI**

```typescript
const response = await fetch('https://api.openai.com/v1/embeddings', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${OPENAI_API_KEY}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    input: 'Your text here',
    model: 'text-embedding-3-small'  // or text-embedding-3-large
  })
})

const { data } = await response.json()
const embedding = data[0].embedding  // 1536-dim vector
```

**2. Hugging Face**

```typescript
const response = await fetch(
  'https://api-inference.huggingface.co/pipeline/feature-extraction',
  {
    headers: { Authorization: `Bearer ${HF_API_KEY}` },
    method: 'POST',
    body: JSON.stringify({ inputs: 'Your text here' })
  }
)

const embedding = await response.json()
```

**3. Local Embeddings (via Edge Function)**

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

serve(async (req) => {
  // Use a local embedding model or proxy
  const { text } = await req.json()
  
  // Example using Ollama locally
  const result = await fetch('http://localhost:11434/api/embeddings', {
    method: 'POST',
    body: JSON.stringify({
      model: 'nomic-embed-text',
      prompt: text
    })
  })

  const { embedding } = await result.json()
  return new Response(JSON.stringify({ embedding }))
})
```

### Vector Indexing Strategy

| Index Type | Speed | Accuracy | Memory | Use Case |
|------------|-------|----------|--------|----------|
| IVFFLAT | Fast | ~95% | Low | Large scale (100K+ vectors) |
| HNSW | Fast | 100% | Medium | Medium scale (10K-100K) |
| Brute force | Slow | 100% | Low | Small datasets, accuracy critical |

**1. IVFFLAT Index**

```sql
CREATE INDEX documents_embedding_idx 
  ON documents USING ivfflat (embedding vector_cosine_ops) 
  WITH (lists = 100);

-- Tune 'lists' based on dataset size:
-- Small (< 10K): 10-50
-- Medium (10K-100K): 50-200
-- Large (100K+): 200-1000
```

**2. HNSW Index**

```sql
CREATE INDEX documents_embedding_idx 
  ON documents USING hnsw (embedding vector_cosine_ops) 
  WITH (m = 16, ef_construction = 64);

-- m: Maximum number of connections per node (default 16)
-- ef_construction: Search parameter during index building (default 64)
```

---

## AI Integrations

### OpenAI Integration

**1. Set Up API Key**

```bash
# Add to Supabase edge function environment
supabase secrets set OPENAI_API_KEY=sk-...
```

**2. Generate Embeddings**

```typescript
// supabase/functions/embed-text/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

serve(async (req) => {
  const { text } = await req.json()

  // Call OpenAI API
  const embeddingRes = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      input: text,
      model: 'text-embedding-3-small'
    })
  })

  const { data } = await embeddingRes.json()
  
  // Store embedding in database
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  await supabase
    .from('documents')
    .insert({ content: text, embedding: data[0].embedding })

  return new Response(JSON.stringify({ success: true }))
})
```

**3. Generate Completions**

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

serve(async (req) => {
  const { prompt } = await req.json()

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'gpt-4',
      messages: [
        { role: 'system', content: 'You are a helpful assistant.' },
        { role: 'user', content: prompt }
      ],
      max_tokens: 500
    })
  })

  const { choices } = await response.json()
  return new Response(JSON.stringify({ message: choices[0].message.content }))
})
```

### Semantic Search with LLM

**1. RAG Pattern (Retrieval Augmented Generation)**

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

serve(async (req) => {
  const { question } = await req.json()

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  // Step 1: Embed question
  const embeddingRes = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      input: question,
      model: 'text-embedding-3-small'
    })
  })

  const { data } = await embeddingRes.json()
  const queryEmbedding = data[0].embedding

  // Step 2: Search for similar documents
  const { data: documents } = await supabase.rpc('match_documents', {
    query_embedding: queryEmbedding,
    match_threshold: 0.7,
    match_count: 5
  })

  // Step 3: Generate answer using retrieved context
  const context = documents
    .map(doc => doc.content)
    .join('\n---\n')

  const completionRes = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content: `Answer the question based on the provided context:\n${context}`
        },
        {
          role: 'user',
          content: question
        }
      ],
      max_tokens: 500
    })
  })

  const { choices } = await completionRes.json()
  
  return new Response(
    JSON.stringify({
      answer: choices[0].message.content,
      sources: documents.map(doc => doc.id)
    })
  )
})
```

### Multi-Modal AI (Vision, Audio)

**1. Image Analysis with GPT-4V**

```typescript
serve(async (req) => {
  const { imageUrl } = await req.json()

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'gpt-4-vision-preview',
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: 'What is in this image?' },
            { type: 'image_url', image_url: { url: imageUrl } }
          ]
        }
      ],
      max_tokens: 1024
    })
  })

  const { choices } = await response.json()
  return new Response(JSON.stringify({ description: choices[0].message.content }))
})
```

---

## CLI & Local Development

### Installation & Setup

**1. Install Supabase CLI**

```bash
# macOS/Linux
brew install supabase/tap/supabase

# Windows (Scoop)
scoop install supabase

# Npm (any OS)
npm install -g supabase
```

**2. Initialize Project**

```bash
supabase init

# Creates supabase/ directory with:
# - config.toml (local settings)
# - migrations/ (database migrations)
# - functions/ (edge functions)
```

**3. Start Local Stack**

```bash
supabase start

# Outputs:
# API URL: http://localhost:54321
# GraphQL URL: http://localhost:54321/graphql/v1
# DB URL: postgresql://postgres:postgres@localhost:5432/postgres
# Studio URL: http://localhost:54323
# Inbucket URL: http://localhost:54324
```

**4. Stop Local Stack**

```bash
supabase stop

# Persist data
supabase stop --no-backup  # Delete data on stop
```

### Database Migrations

**1. Create Migration**

```bash
supabase migration new create_users_table

# Creates: supabase/migrations/<timestamp>_create_users_table.sql
```

**2. Migration File**

```sql
-- supabase/migrations/20240101000000_create_users_table.sql

CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);
```

**3. Apply Migrations**

```bash
# Apply locally
supabase db push

# Reset and reapply all
supabase db reset

# Pull remote schema into local
supabase db pull

# View migration status
supabase migration list
```

### Secrets Management

**1. Store Secrets**

```bash
# Add secret
supabase secrets set OPENAI_API_KEY=sk-...
supabase secrets set DATABASE_PASSWORD=secure123

# List secrets
supabase secrets list
```

**2. Use in Edge Function**

```typescript
const openaiKey = Deno.env.get('OPENAI_API_KEY')
const dbPassword = Deno.env.get('DATABASE_PASSWORD')
```

**3. Local Secrets**

```bash
# In supabase/.env.local
OPENAI_API_KEY=sk-test-key
DATABASE_PASSWORD=local-password

# Load automatically in local development
supabase start
```

### Edge Functions

**1. Create Function**

```bash
supabase functions new my-function

# Creates: supabase/functions/my-function/index.ts
```

**2. Serve Locally**

```bash
supabase functions serve my-function

# Call locally
curl http://localhost:54321/functions/v1/my-function
```

**3. Deploy Function**

```bash
supabase functions deploy my-function

# Verify deployed
curl https://PROJECT_ID.supabase.co/functions/v1/my-function
```

---

## Platform Management

### Project Settings

**1. Access Control**

- **API Keys:** Found in Project Settings → API
  - `anon` key: Client-side, limited by RLS
  - `service_role`: Server-side, full access (KEEP SECRET)
  - Auto-generated, rotate in Project Settings

**2. Database Connection**

- **Connection String:** Available in Project Settings → Database
- Format: `postgresql://user:password@host:5432/postgres`
- PgBouncer URL available for pooled connections

**3. Custom Domain**

- Project Settings → Custom Domain
- Point DNS to Supabase nameservers
- SSL certificate auto-provisioned

### Monitoring & Observability

**1. Metrics Dashboard**

- Project Settings → Monitoring
- View API usage, database performance, storage usage
- Real-time graphs for requests, errors, latency

**2. Logs**

- **Database Logs:** Project Settings → Logs → Database
- **API Logs:** Project Settings → Logs → API
- **Edge Function Logs:** Project Settings → Logs → Edge Functions
- Filter by time, query, errors

**3. Performance Insights**

```sql
-- Check slow queries
SELECT * FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 10;

-- Table sizes
SELECT 
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- Index usage
SELECT * FROM pg_stat_user_indexes
WHERE idx_scan = 0;  -- Unused indexes
```

### Team & Collaboration

**1. Invite Team Members**

- Project Settings → Team
- Share project access with email-based invites
- Role-based permissions: Owner, Developer, Viewer

**2. Permissions**

- **Owner:** Full control, can delete project, manage billing
- **Developer:** Can access database, deploy functions, manage auth
- **Viewer:** Read-only access to dashboard and logs

---

## API Reference & SDKs

### Supabase JS SDK

**1. Installation**

```bash
npm install @supabase/supabase-js
```

**2. Initialization**

```javascript
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://PROJECT_ID.supabase.co',
  'ANON_KEY'
)
```

**3. Core Methods**

```javascript
// Database
supabase.from('<table>').select() | .insert() | .update() | .delete()

// Auth
supabase.auth.signUp() | .signIn() | .signOut() | .getSession()

// Storage
supabase.storage.from('<bucket>').upload() | .download() | .remove()

// Realtime
supabase.channel('<name>').on() | .subscribe()

// Edge Functions
supabase.functions.invoke('<function-name>')

// RPC
supabase.rpc('<function-name>', { params })
```

### Other SDKs

| Language | Package | Link |
|----------|---------|------|
| Python | `supabase` | https://pypi.org/project/supabase/ |
| Flutter | `supabase_flutter` | https://pub.dev/packages/supabase |
| Go | `supabase-go` | https://github.com/supabase-community/supabase-go |
| Rust | `supabase-rs` | https://github.com/supabase-community/supabase-rs |
| Java/Kotlin | `supabase-kt` | https://github.com/supabase-community/supabase-kt |
| Ruby | `supabase-rb` | https://github.com/supabase-community/supabase-rb |
| C# | `supabase-csharp` | https://github.com/supabase-community/supabase-csharp |

### REST API

**1. Database Operations**

```bash
# List records
curl "https://PROJECT_ID.supabase.co/rest/v1/posts?select=*" \
  -H "apikey: ANON_KEY"

# Create record
curl -X POST "https://PROJECT_ID.supabase.co/rest/v1/posts" \
  -H "apikey: ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"title": "Hello", "user_id": "uuid"}'

# Update record
curl -X PATCH "https://PROJECT_ID.supabase.co/rest/v1/posts?id=eq.1" \
  -H "apikey: ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"title": "Updated"}'

# Delete record
curl -X DELETE "https://PROJECT_ID.supabase.co/rest/v1/posts?id=eq.1" \
  -H "apikey: ANON_KEY"
```

**2. Auth Endpoints**

```bash
# Sign up
curl -X POST "https://PROJECT_ID.supabase.co/auth/v1/signup" \
  -H "apikey: ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com", "password": "password"}'

# Sign in
curl -X POST "https://PROJECT_ID.supabase.co/auth/v1/token?grant_type=password" \
  -H "apikey: ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com", "password": "password"}'

# Get user
curl "https://PROJECT_ID.supabase.co/auth/v1/user" \
  -H "Authorization: Bearer ACCESS_TOKEN"
```

**3. Storage Endpoints**

```bash
# Upload file
curl -X POST "https://PROJECT_ID.supabase.co/storage/v1/object/avatars/user-123/avatar.jpg" \
  -H "apikey: ANON_KEY" \
  -H "Authorization: Bearer ACCESS_TOKEN" \
  -F "file=@/path/to/avatar.jpg"

# Download file
curl "https://PROJECT_ID.supabase.co/storage/v1/object/public/avatars/user-123/avatar.jpg"

# Create signed URL
curl -X POST "https://PROJECT_ID.supabase.co/storage/v1/object/sign/documents/file.pdf" \
  -H "apikey: ANON_KEY" \
  -H "Authorization: Bearer ACCESS_TOKEN" \
  -d '{"expiresIn": 3600}'
```

---

## Best Practices & Patterns

### Schema Design

**1. Naming Conventions**

```sql
-- Tables: plural, lowercase, snake_case
CREATE TABLE users ( ... )
CREATE TABLE user_profiles ( ... )

-- Columns: lowercase, snake_case
id, user_id, created_at, is_active

-- Indexes: idx_<table>_<columns>
CREATE INDEX idx_users_email ON users(email)

-- Foreign keys: <table>_<column>_fkey
CONSTRAINT users_profile_id_fkey

-- Functions: snake_case
CREATE FUNCTION calculate_age( ... )
```

**2. ID Strategy**

```sql
-- UUIDs for user-facing data (immutable, privacy-friendly)
CREATE TABLE profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ...
)

-- Serial for internal/sequential data
CREATE TABLE logs (
  id bigserial PRIMARY KEY,  -- Auto-incrementing
  ...
)

-- Composite keys for junction tables
CREATE TABLE user_roles (
  user_id uuid NOT NULL REFERENCES users(id),
  role_id bigint NOT NULL REFERENCES roles(id),
  PRIMARY KEY (user_id, role_id)
)
```

**3. Timestamp Best Practices**

```sql
-- Always use timestamp with time zone (NOT date or time)
CREATE TABLE events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  deleted_at timestamp with time zone  -- For soft deletes
);

-- Automatically update updated_at with trigger
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_events_updated_at
  BEFORE UPDATE ON events
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();
```

### Query Optimization

**1. Use Indexes Strategically**

```sql
-- Index foreign keys (for joins)
CREATE INDEX idx_posts_user_id ON posts(user_id);

-- Index filtering columns
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_posts_status ON posts(status);

-- Composite indexes for common filter patterns
CREATE INDEX idx_posts_user_status ON posts(user_id, status);

-- Partial indexes for common conditions
CREATE INDEX idx_active_users ON users(id) WHERE deleted_at IS NULL;

-- Full-text search indexes
CREATE INDEX idx_posts_fts ON posts USING gin(to_tsvector('english', content));
```

**2. Query Patterns**

```javascript
// ❌ Avoid: N+1 queries
for (const post of posts) {
  const author = await supabase
    .from('users')
    .select()
    .eq('id', post.user_id)
}

// ✅ Correct: Embed relationships in single query
const posts = await supabase
  .from('posts')
  .select('*, user:users(*)')
```

**3. Pagination**

```javascript
// ❌ Avoid: Offset pagination (slow for large datasets)
const page1 = await supabase.from('posts').select().range(0, 49)
const page2 = await supabase.from('posts').select().range(50, 99)

// ✅ Better: Keyset pagination
const posts = await supabase
  .from('posts')
  .select()
  .order('id', { ascending: false })
  .limit(50)

// For next page, get last ID and query after it
const nextPosts = await supabase
  .from('posts')
  .select()
  .order('id', { ascending: false })
  .lt('id', lastId)
  .limit(50)
```

### Security

**1. RLS Policies**

```sql
-- Principle: Default DENY, selectively ALLOW

-- ✅ Good: Users see only public data + their own data
CREATE POLICY "Users see public posts and own posts" ON posts
  FOR SELECT
  USING (
    is_public = true
    OR user_id = auth.uid()
  );

-- ❌ Bad: World-readable by default
CREATE POLICY "Everyone sees all posts" ON posts
  FOR SELECT USING (true);
```

**2. API Key Security**

```
- Anon key: Safe for client-side (limited by RLS)
- Service role key: NEVER expose to client
  - Only use in server/Edge Functions
  - Rotate regularly
  - Store in environment variables
```

**3. SQL Injection Prevention**

```javascript
// ❌ Vulnerable: Building strings
const query = `SELECT * FROM posts WHERE id = ${userId}`

// ✅ Safe: Use SDK or parameterized queries
const { data } = await supabase
  .from('posts')
  .select()
  .eq('id', userId)
```

### Real-time Subscriptions

**1. Efficient Subscriptions**

```javascript
// ❌ Avoid: Subscribing to all changes
supabase
  .channel('all-posts')
  .on('postgres_changes', { event: '*', schema: 'public', table: 'posts' }, callback)
  .subscribe()

// ✅ Better: Filter to specific posts
supabase
  .channel('user-posts')
  .on('postgres_changes', {
    event: '*',
    schema: 'public',
    table: 'posts',
    filter: `user_id=eq.${userId}`
  }, callback)
  .subscribe()
```

**2. Cleanup**

```javascript
// Unsubscribe when component unmounts
useEffect(() => {
  const channel = supabase
    .channel('posts')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'posts' }, callback)
    .subscribe()

  return () => {
    channel.unsubscribe()
  }
}, [])
```

---

## Anti-Patterns & Common Mistakes

**1. Exposing Service Role Key**

```
❌ WRONG: Committing service role key to git
❌ WRONG: Using service role key in client-side code
❌ WRONG: Sending service role key in API responses

✅ CORRECT: Store in environment variables
✅ CORRECT: Use only in backend/Edge Functions
✅ CORRECT: Rotate if compromised
```

**2. Missing RLS Policies**

```
❌ WRONG: No RLS on sensitive tables (auth bypass)
❌ WRONG: Overly permissive policies (e.g., USING (true))
❌ WRONG: Forgetting to test RLS with different users

✅ CORRECT: Enable RLS on all user-facing tables
✅ CORRECT: Write explicit ALLOW policies per operation
✅ CORRECT: Test policies in development with multiple users
```

**3. N+1 Query Problem**

```javascript
❌ WRONG:
const posts = await supabase.from('posts').select('*')
for (const post of posts) {
  const user = await supabase.from('users').select().eq('id', post.user_id)
}

✅ CORRECT:
const posts = await supabase
  .from('posts')
  .select('*, user:users(*)')
```

**4. Unhandled Errors**

```javascript
❌ WRONG:
const { data } = await supabase.from('posts').select()
data.forEach(post => console.log(post))  // May crash if error

✅ CORRECT:
const { data, error } = await supabase.from('posts').select()
if (error) {
  console.error('Query failed:', error)
  return
}
data.forEach(post => console.log(post))
```

**5. Auth Token Mismanagement**

```javascript
❌ WRONG:
const token = localStorage.getItem('token')
fetch(url, { headers: { 'Authorization': token } })

✅ CORRECT:
const { data } = await supabase.auth.getSession()
const token = data.session?.access_token

// SDK handles token refresh automatically
const { data } = await supabase.from('posts').select()
```

**6. No Connection Pooling**

```
❌ WRONG: Using direct PostgreSQL URL in app (connection exhaustion)
✅ CORRECT: Use PgBouncer URL (connection pooling)
```

---

## Security Considerations

### Database Security

**1. Principle of Least Privilege**

```sql
-- Create role with minimal permissions
CREATE ROLE app_user WITH LOGIN;

-- Grant only necessary permissions
GRANT CONNECT ON DATABASE postgres TO app_user;
GRANT USAGE ON SCHEMA public TO app_user;
GRANT SELECT, INSERT, UPDATE ON posts TO app_user;

-- Do NOT grant SUPERUSER or CREATE DATABASE
```

**2. Encryption**

- **In Transit:** All connections use SSL/TLS
- **At Rest:** Database encrypted via provider encryption (AWS KMS, etc.)
- **Application-Level:** Encrypt sensitive fields before storing
  ```sql
  CREATE EXTENSION IF NOT EXISTS pgcrypto;
  
  INSERT INTO secrets (data) VALUES (pgp_sym_encrypt('password', 'key'))
  SELECT pgp_sym_decrypt(data, 'key') FROM secrets
  ```

**3. Audit Trail**

```sql
CREATE TABLE audit_log (
  id bigserial PRIMARY KEY,
  table_name text NOT NULL,
  record_id uuid NOT NULL,
  operation text NOT NULL,
  old_data jsonb,
  new_data jsonb,
  changed_by uuid REFERENCES auth.users(id),
  changed_at timestamp with time zone DEFAULT now()
);

-- Create trigger to log changes
CREATE OR REPLACE FUNCTION audit_trigger()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO audit_log (table_name, record_id, operation, old_data, new_data, changed_by)
  VALUES (TG_TABLE_NAME, NEW.id, TG_OP, to_jsonb(OLD), to_jsonb(NEW), auth.uid());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

### API Security

**1. CORS Configuration**

```javascript
// Supabase handles CORS by default for your project domain
// For custom domains, verify in Project Settings → API

// Client-side, always use authenticated requests
const { data, error } = await supabase.auth.getSession()
if (!data.session) return

const { data: posts } = await supabase
  .from('posts')
  .select()
```

**2. Rate Limiting**

```
Free Plan: 600 requests/minute per IP
Pro Plan: 2000 requests/minute per IP
Enterprise: Custom limits

Use rate-limit headers to detect limits:
X-RateLimit-Limit: 600
X-RateLimit-Remaining: 599
X-RateLimit-Reset: 1234567890
```

**3. API Key Rotation**

```bash
# Rotate API keys regularly
# Supabase dashboard: Project Settings → API → Rotate key

# Old key will stop working immediately
# Plan for key rotation in advance
```

### Auth Security

**1. Password Strength**

```
Supabase enforces minimum password requirements:
- At least 6 characters
- Recommend: 12+ characters with mixed case, numbers, symbols

Implement password strength checker on client:
- Length: 12+ characters
- Uppercase: A-Z
- Lowercase: a-z
- Numbers: 0-9
- Special: !@#$%^&*
```

**2. Session Expiry**

```
Access token: 1 hour (default, configurable)
Refresh token: 7 days (default, configurable)

Set in Project Settings → Authentication → JWT Expiry
```

**3. WebAuthn / Passkeys**

```javascript
// Enable WebAuthn for passwordless authentication
const { data, error } = await supabase.auth.signUpWithWebAuthn({
  email: 'user@example.com'
})

// Sign in with WebAuthn
const { data, error } = await supabase.auth.signInWithWebAuthn({
  email: 'user@example.com'
})
```

---

## Performance Optimization

### Database Performance

**1. Query Analysis**

```sql
-- Explain query plan
EXPLAIN ANALYZE SELECT * FROM posts WHERE user_id = 'uuid';

-- Look for:
-- - Seq Scan (bad, use index)
-- - Index Scan (good)
-- - Hash Join (acceptable for smaller tables)
-- - Sort (expensive, avoid if possible)
```

**2. Materialized Views**

```sql
-- Create cached view for complex queries
CREATE MATERIALIZED VIEW monthly_stats AS
SELECT
  DATE_TRUNC('month', created_at) AS month,
  user_id,
  COUNT(*) AS post_count,
  AVG(LENGTH(content)) AS avg_length
FROM posts
GROUP BY DATE_TRUNC('month', created_at), user_id;

-- Create index on materialized view
CREATE INDEX idx_monthly_stats_user_month ON monthly_stats(month, user_id);

-- Refresh periodically (via cron job)
REFRESH MATERIALIZED VIEW monthly_stats;
```

**3. Connection Pooling**

```
Use PgBouncer connection pool URL instead of direct database URL
Reduces connection overhead, improves performance

Free Plan: 5 pooled connections
Pro Plan: 10 pooled connections
Enterprise: Custom
```

### API Performance

**1. Response Size Optimization**

```javascript
// ❌ Large response
const { data } = await supabase
  .from('posts')
  .select('*, user:users(*), comments(*), likes(*)')

// ✅ Optimized
const { data } = await supabase
  .from('posts')
  .select('id, title, user:users(id, username)')
  .limit(20)
```

**2. Caching**

```javascript
// Use HTTP caching headers
const { data } = await supabase
  .from('posts')
  .select()
  .limit(10)
  .headers({ 'Cache-Control': 'public, max-age=300' })  // 5 min cache

// Client-side caching
const cache = new Map()
const getUser = async (userId) => {
  if (cache.has(userId)) return cache.get(userId)
  const { data } = await supabase.from('users').select().eq('id', userId)
  cache.set(userId, data[0])
  return data[0]
}
```

**3. Batch Operations**

```javascript
// ❌ Slow: Individual requests
for (const item of items) {
  await supabase.from('posts').insert(item)
}

// ✅ Fast: Batch insert
await supabase.from('posts').insert(items)
```

### Storage Performance

**1. Image Optimization**

```
Use image transformations at edge (CDN):
- Resize before download: &width=300
- Format optimization: &format=webp
- Quality reduction: &quality=80

Benefits:
- Smaller downloads
- Faster rendering
- Lower bandwidth costs
```

**2. File Size Limits**

```
Free: 50MB per file
Pro: 5GB per file

Compression recommendations:
- Images: WebP format, resize before upload
- Videos: H.264 codec, 720p for web
- Documents: PDF compression
```

---

## Debugging & Troubleshooting

### Common Errors

**1. "Invalid API key"**

```
Cause: Wrong API key or key expired/rotated

Fix:
- Verify you're using the correct key (anon vs service_role)
- Check Project Settings → API for current keys
- Rotate key if suspected compromise
```

**2. "Project not found"**

```
Cause: Incorrect project ID in URL

Fix:
- Verify project ID in dashboard URL
- Format: https://PROJECT_ID.supabase.co
```

**3. "Permission denied" on RLS**

```
Cause: RLS policy blocking request

Debug:
1. Check if RLS is enabled: ALTER TABLE table_name ENABLE ROW LEVEL SECURITY;
2. List policies: SELECT * FROM pg_policies WHERE tablename = 'table_name';
3. Test with service_role key (bypasses RLS): Does it work? RLS is blocking
4. Review policy logic for correct auth.uid() filter
```

**4. "Column does not exist"**

```
Cause: Typo in column name or missing column

Fix:
- Use SELECT * to see available columns
- Check schema in Supabase dashboard
- Migrations may not have been applied
```

**5. "Token expired"**

```
Cause: Access token expired (normally 1 hour)

Fix:
- SDK automatically refreshes if refresh token is valid
- If both expired, user must sign in again
- Implement refresh logic:
  const { data, error } = await supabase.auth.refreshSession()
```

### Debugging Tools

**1. Browser DevTools**

```javascript
// Enable detailed logging
localStorage.setItem('supabase.debug', 'true')

// Check Network tab for API requests
// Look at Response headers for rate-limit info
```

**2. PostgREST Logs**

```bash
# Access via Supabase dashboard
Project Settings → Logs → API

# Filter by endpoint, time, error type
```

**3. Database Logs**

```bash
# Access via Supabase dashboard
Project Settings → Logs → Database

# Check for slow queries, errors, warnings
```

**4. Edge Function Logs**

```bash
# Local testing
supabase functions serve function-name

# View logs in console output

# Production logs
supabase functions logs function-name
```

---

## Integration Patterns

### Real-time Collaboration

```typescript
// Track user edits in real-time
const [edits$, setEdits] = useState([])

// Subscribe to document changes
supabase
  .channel(`doc-${docId}`)
  .on('postgres_changes', {
    event: '*',
    schema: 'public',
    table: 'document_edits',
    filter: `document_id=eq.${docId}`
  }, (payload) => {
    setEdits(prev => [...prev, payload.new])
  })
  .subscribe()

// Broadcast local edits
const applyEdit = async (edit) => {
  const { error } = await supabase
    .from('document_edits')
    .insert({
      document_id: docId,
      user_id: userId,
      operation: edit
    })
  
  if (!error) {
    channel.send({
      type: 'broadcast',
      event: 'edit_confirmed',
      payload: { edit_id: edit.id }
    })
  }
}
```

### File Upload with Progress

```javascript
const uploadFile = async (file, bucket, path) => {
  return new Promise((resolve, reject) => {
    supabase.storage
      .from(bucket)
      .upload(path, file, {
        onUploadProgress: (progress) => {
          const percent = (progress.loaded / progress.total) * 100
          console.log(`Upload progress: ${Math.round(percent)}%`)
          setUploadProgress(percent)
        }
      })
      .then(result => {
        if (result.error) reject(result.error)
        else resolve(result.data)
      })
      .catch(reject)
  })
}
```

### Multi-Tenant SaaS

```sql
-- Organization table
CREATE TABLE organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);

-- User-Organization relationship
CREATE TABLE user_org_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  org_id uuid NOT NULL REFERENCES organizations(id),
  role text NOT NULL,  -- owner, admin, member
  UNIQUE(user_id, org_id)
);

-- Data table with org isolation
CREATE TABLE org_data (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id),
  data jsonb,
  created_at timestamp with time zone DEFAULT now()
);

-- RLS: Users can only see data from orgs they're members of
CREATE POLICY "Users can see org data they're members of" ON org_data
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_org_memberships
      WHERE org_id = org_data.org_id
      AND user_id = auth.uid()
    )
  );
```

---

## Migration Guides

### From Firebase to Supabase

**1. Migrate Auth**

```javascript
// Export Firebase users via Admin SDK
// Import to Supabase using API

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(url, serviceRoleKey)

// For each Firebase user
const { data, error } = await supabase.auth.admin.createUser({
  email: firebaseUser.email,
  password: temporaryPassword,  // User changes on first login
  email_confirm: true,
  user_metadata: {
    firebase_uid: firebaseUser.uid
  }
})
```

**2. Migrate Data**

```bash
# Export Firebase Firestore as JSON
# Transform to PostgreSQL schema
# Import via INSERT statements or bulk load

# Example: Import CSV to Supabase
psql postgres://user:password@host/database
  COPY table_name FROM '/path/to/data.csv' WITH (FORMAT csv, HEADER true)
```

**3. Migrate Storage**

```javascript
// Download from Firebase Storage
// Upload to Supabase Storage

const bucket = admin.storage().bucket()
const files = await bucket.getFiles()

for (const file of files[0]) {
  const content = await file.download()
  await supabase.storage
    .from('backup')
    .upload(file.name, content[0])
}
```

### From Traditional REST API to Supabase

**1. Migrate Endpoints**

```javascript
// Before: REST API
GET /api/posts
POST /api/posts
PATCH /api/posts/:id
DELETE /api/posts/:id

// After: Supabase
supabase.from('posts').select()
supabase.from('posts').insert(data)
supabase.from('posts').update(data).eq('id', id)
supabase.from('posts').delete().eq('id', id)
```

**2. Migrate Business Logic**

```
Complex business logic → Edge Functions
User authentication → Supabase Auth
Authorization → Row Level Security (RLS)
File uploads → Supabase Storage
Real-time → Supabase Realtime
```

---

## Rate Limits & Quotas

### API Rate Limits

| Operation | Free | Pro |
|-----------|------|-----|
| Requests/minute | 600 | 2000 |
| Concurrent connections | 200 | 500 |
| Max response size | 1MB | 10MB |

**Headers:**
```
X-RateLimit-Limit: 600
X-RateLimit-Remaining: 599
X-RateLimit-Reset: 1234567890
```

### Database Limits

| Resource | Free | Pro | Enterprise |
|----------|------|-----|------------|
| Storage | 500MB | 8GB | Custom |
| Connections | 20 | 40 | 100+ |
| Row size | 1.6MB | 1.6MB | 1.6MB |
| Query timeout | 10s | 10s | Custom |

### Storage Limits

| Resource | Free | Pro |
|----------|------|-----|
| Total storage | 1GB | 100GB |
| File size | 50MB | 5GB |
| Bandwidth | 2GB/month | 100GB/month |

### Edge Functions Limits

| Resource | Free | Pro |
|----------|------|-----|
| Invocations/month | 500K | 2M |
| Timeout | 10s | 60s |
| Memory | 512MB | 512MB |
| Payload size | 6MB | 6MB |

### Realtime Limits

| Resource | Free | Pro |
|----------|------|-----|
| Connections | 200 | 500 |
| Message size | 64KB | 64KB |
| Channels | Unlimited | Unlimited |

---

## Recent Updates & Alpha/Beta Features

### Version 2.x Features

**1. SQL Transactions in Edge Functions**

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

serve(async (req) => {
  const supabase = createClient(url, key)
  
  // SQL transactions
  await supabase.rpc('transfer_funds', {
    from_id: 'uuid-1',
    to_id: 'uuid-2',
    amount: 100
  })
})
```

**2. Improved RLS Performance**

- Optimized row-level security policy evaluation
- Better index utilization with RLS filters

**3. WebAuthn/Passkeys Support**

```javascript
// Native passkey authentication
const { data } = await supabase.auth.signUpWithWebAuthn({
  email: 'user@example.com'
})
```

### Planned Features (Alpha/Beta)

**1. GraphQL API** - Full GraphQL support (currently beta)

```graphql
query {
  postsCollection {
    edges {
      node {
        id
        title
        user {
          username
        }
      }
    }
  }
}
```

**2. Branching** - Database branches for testing (pro/enterprise)

```bash
supabase branches create
supabase branches list
supabase branches delete
```

**3. Webhooks** - Event-driven architecture (beta)

```bash
# Configure webhooks for auth events
# POST to external service on user signup, login, etc.
```

**4. Full-Text Search Improvements**

- Enhanced multilingual support
- Phrase searching
- Relevance ranking

---

## Conclusion

This comprehensive guide covers Supabase's architecture, core components, best practices, and common patterns. Key takeaways:

1. **Leverage PostgreSQL features** - JSON, arrays, full-text search, extensions
2. **Use RLS for authorization** - Declarative, database-enforced security
3. **Optimize queries** - Indexes, embedding relationships, pagination
4. **Real-time first** - Design systems for real-time collaboration
5. **Edge Functions for custom logic** - Serverless, globally deployed
6. **Secure your keys** - Separate anon/service-role, rotate regularly
7. **Monitor and observe** - Use dashboards, logs, and metrics

For latest updates and more, visit: https://supabase.com/docs

