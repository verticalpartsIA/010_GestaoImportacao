# GitHub + Supabase: Integrated Development Workflow Guide

**Status**: Comprehensive Reference | **Version**: 1.0 | **Last Updated**: 2026-09-27  
**Target Project**: 010_GestaoImportacao  
**Integration Focus**: Feature Development, Database Migrations, CI/CD Automation, Production Deployment

---

## Table of Contents

1. [Core Concepts & Architecture](#core-concepts--architecture)
2. [Authentication & Credentials Management](#authentication--credentials-management)
3. [Repository Setup & Organization](#repository-setup--organization)
4. [Git Fundamentals & Workflows](#git-fundamentals--workflows)
5. [Integrated Feature Development Flow](#integrated-feature-development-flow)
6. [Pull Requests & Code Review](#pull-requests--code-review)
7. [Issues & Project Management](#issues--project-management)
8. [GitHub Actions: Fundamentals & Integration](#github-actions-fundamentals--integration)
9. [Database Migrations & Supabase CI/CD](#database-migrations--supabase-cicd)
10. [Security: Access Control & Secrets Management](#security-access-control--secrets-management)
11. [Deployment Workflows & Production Release](#deployment-workflows--production-release)
12. [Hotfix & Emergency Procedures](#hotfix--emergency-procedures)
13. [Organization & Team Management](#organization--team-management)
14. [Code Search & Repository Insights](#code-search--repository-insights)
15. [Advanced: GraphQL API & GitHub Apps](#advanced-graphql-api--github-apps)
16. [Reference: Commands, Syntax & Quotas](#reference-commands-syntax--quotas)

---

## Core Concepts & Architecture

### GitHub as Version Control + Collaboration Platform

GitHub built on **Git** (distributed version control system) provides:

- **Local Repository**: Full project history on your machine (`git` operations)
- **Remote Repository**: Central source of truth on GitHub servers
- **Distributed Collaboration**: Each developer has complete project history
- **Web Interface**: Pull requests, issues, actions, insights without command line
- **Automation Platform**: GitHub Actions, webhooks, GitHub Apps for CI/CD

### Supabase: Backend-as-a-Service with Git-Integrated Migrations

Supabase provides:

- **PostgreSQL Database**: Schema stored in version control via migrations
- **Realtime API**: Automatic REST/GraphQL endpoints for tables
- **Edge Functions**: Serverless compute for custom logic (TypeScript/JavaScript)
- **Authentication**: SSO integration, JWT-based
- **Storage**: File uploads with access control
- **Branching**: Development branches with independent databases

### Integration Pattern: "Migrations as Code"

Your project structure:
```
010_GestaoImportacao/
├── .github/
│   ├── workflows/              # GitHub Actions automation
│   ├── CODEOWNERS              # Code review routing
│   └── pull_request_template.md
├── supabase/
│   ├── migrations/             # SQL migrations (version controlled)
│   │   └── 20260927000000_add_field.sql
│   ├── functions/              # Edge Functions (deployment from Git)
│   │   ├── send-email/
│   │   ├── read-inbox/
│   │   └── suggest-email-reply/
│   └── config.toml             # Project config
├── src/                        # Frontend code
└── research/                   # Documentation & notes
```

**The Flow**:
1. Branch created in GitHub
2. Migration added to `supabase/migrations/`
3. PR opened (triggers Actions to validate schema)
4. Upon merge to `main`: automatic deploy to production Supabase

---

## Authentication & Credentials Management

### GitHub Authentication Methods

#### 1. **HTTPS + Git Credential Manager (Recommended)**

```bash
# First-time setup (prompts GitHub login via browser)
git clone https://github.com/verticalpartsIA/010_GestaoImportacao.git
# Git Credential Manager handles authentication caching

# Subsequent operations use cached credentials
git push origin main
```

**Advantages**:
- Simpler than SSH (no key generation)
- Browser-based OAuth (updates with GitHub login)
- Works across all platforms
- Automatic credential refresh

**Setup**:
```bash
# Install Git Credential Manager
# macOS: brew install git-credential-manager
# Windows: Download from https://github.com/GitCredentialManager/git-credential-manager
# Linux: Install via package manager or build from source

# Configure Git to use it
git config --global credential.helper manager
```

#### 2. **SSH Keys (For CLI Tools & CI/CD)**

```bash
# Generate SSH key (keep passphrase safe)
ssh-keygen -t ed25519 -C "your_email@verticalparts.com.br"
# Generates: ~/.ssh/id_ed25519 (private) & ~/.ssh/id_ed25519.pub (public)

# Add to GitHub: Settings → SSH and GPG keys → New SSH key
# Paste contents of ~/.ssh/id_ed25519.pub

# Test connection
ssh -T git@github.com
# Output: Hi USERNAME! You've successfully authenticated.

# Clone via SSH (no credential prompts)
git clone git@github.com:verticalpartsIA/010_GestaoImportacao.git
```

#### 3. **Personal Access Tokens (GitHub CLI & API Calls)**

```bash
# Generate token: GitHub Settings → Developer settings → Personal access tokens
# Required scopes:
#   - repo (full control of private repositories)
#   - workflow (update GitHub Action workflows)
#   - admin:org_hook (for webhooks)
#   - delete_repo (only if needed)

# Use with GitHub CLI
gh auth login
# Select: GitHub.com → HTTPS → Paste token when prompted

# Verify authentication
gh auth status
# Output: Logged in to github.com as USERNAME (HTTPS)

# Use token in API calls
curl -H "Authorization: token YOUR_TOKEN" \
  https://api.github.com/user
```

**Security Best Practices**:
- Never commit tokens to Git
- Store in environment variables or credential managers
- Rotate tokens regularly (GitHub recommends every 90 days)
- Use fine-grained tokens with minimal scopes
- Enable token expiration

### Supabase Authentication in CI/CD

#### GitHub Actions with Supabase

```yaml
# .github/workflows/deploy.yml
jobs:
  deploy:
    runs-on: ubuntu-latest
    env:
      SUPABASE_ACCESS_TOKEN: ${{ secrets.SUPABASE_ACCESS_TOKEN }}
      SUPABASE_DB_PASSWORD: ${{ secrets.SUPABASE_DB_PASSWORD }}
    steps:
      - uses: actions/checkout@v4
      
      - name: Deploy to Supabase
        run: |
          npx supabase@latest deploy \
            --project-ref jxtqwzmpgofwctqajewt \
            --password "$SUPABASE_DB_PASSWORD"
```

**Required Secrets in GitHub**:
- `SUPABASE_ACCESS_TOKEN`: From Supabase organization settings
- `SUPABASE_DB_PASSWORD`: Database connection password
- `SUPABASE_URL`: Project URL (can be public)
- `SUPABASE_ANON_KEY`: Public anon key (can be public)

**Setting Secrets**:
```bash
# Via GitHub CLI
gh secret set SUPABASE_ACCESS_TOKEN -b "token_value"

# Via GitHub Web UI
Settings → Secrets and variables → Actions → New repository secret
```

---

## Repository Setup & Organization

### Creating a Repository (Your Project Example)

```bash
# Repository: verticalpartsIA/010_GestaoImportacao
# Visibility: Private (organization owned)
# Template: None (created from existing code)

# If starting fresh
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/verticalpartsIA/010_GestaoImportacao.git
git push -u origin main
```

### Branch Protection Rules

**Your Project's Rules** (configured in Settings → Branches → Branch protection rules):

```yaml
Branch: main
Rules:
  - Require pull request reviews before merging: YES
  - Number of required approvals: 1
  - Require status checks to pass: YES
    - Check: ci/github-actions (lint, test, schema validation)
  - Require branches to be up to date: YES
  - Require conversation resolution: YES
  - Require code owner reviews: YES (for critical files)
  - Allow force pushes: NO
  - Allow deletions: NO
```

**Implementation**:
```bash
# Protect main branch from accidental direct pushes
# (Enforced automatically by GitHub - not a git command)

# Try to push directly to main
git push origin main
# Error: remote: error: GH006: Protected branch update failed
# The push is rejected by GitHub's branch protection rule
```

### Repository Structure

```
010_GestaoImportacao/
│
├── .github/
│   ├── workflows/
│   │   ├── deploy.yml              # Deploy to production
│   │   ├── lint-and-test.yml       # CI checks on PR
│   │   └── db-validate.yml         # Validate Supabase schema
│   │
│   ├── CODEOWNERS                  # Auto-request reviews
│   │   # Examples:
│   │   # @team/security src/security.jsx
│   │   # @user src/email/ (requires review from user)
│   │
│   ├── pull_request_template.md    # PR description template
│   └── issue_template/
│       ├── bug_report.md
│       ├── feature_request.md
│       └── migration.md
│
├── supabase/
│   ├── config.toml
│   │   project_id = "jxtqwzmpgofwctqajewt"
│   │   api_url = "https://jxtqwzmpgofwctqajewt.supabase.co"
│   │
│   ├── migrations/                 # Version-controlled schema changes
│   │   ├── 20260926160000_leads_soft_delete.sql
│   │   ├── 20260926170000_clientes_omie_cadastrado.sql
│   │   └── 20260927000000_exemplo.sql
│   │
│   ├── functions/                  # Edge Functions (deployed from Git)
│   │   ├── send-email/
│   │   │   ├── index.ts
│   │   │   └── deno.json
│   │   ├── read-inbox/
│   │   ├── suggest-email-reply/
│   │   ├── omie-buscar-cliente/
│   │   └── cleanup-inbox-tests/
│   │
│   └── seed.sql                    # Development data (optional)
│
├── src/                            # React frontend (UMD, no build)
│   ├── app.jsx
│   ├── supabase.js                 # Supabase client config
│   ├── logistica.jsx               # Email inbox module
│   ├── comercial.jsx               # Leads management
│   ├── decisoes.jsx                # Decisions module
│   ├── ficha-tecnica.jsx
│   ├── cadastros-*.jsx
│   └── stores/
│       ├── comercial-store.js
│       ├── formulario-elevador-store.js
│       └── *.js
│
├── styles/
│   ├── app.css
│   ├── ficha-tecnica.css
│   └── *.css
│
├── index.html                      # Entry point (with ?v= cache-busting)
├── server.js                       # Local dev server (Express)
├── package.json                    # Dependencies (mostly for local dev)
│
├── research/
│   ├── notes/
│   │   ├── github_supabase_integrated_guide.md  # This file
│   │   └── *.md
│   └── runs/                       # Hyperresearch artifacts
│
├── CLAUDE.md                       # Developer notes (THIS PROJECT ONLY)
├── README.md                       # Product overview
└── .gitignore
    node_modules/
    .env.local
    *.log
```

### Tags & Releases

```bash
# Create a semantic version tag
git tag -a v1.5.3 -m "Release: Email inbox + Leads management"
git push origin v1.5.3

# List tags
git tag --list

# Create GitHub Release (adds release notes)
gh release create v1.5.3 \
  --title "Version 1.5.3" \
  --notes "
  - Added email inbox with IMAP/SMTP
  - Implemented leads management with Omie integration
  - Fixed Precificação container parsing
  - Improved migration timeout handling
  "
```

**Release Naming Convention** (Semantic Versioning):
- `MAJOR.MINOR.PATCH`
- `v1.0.0` → `v1.1.0` (new feature)
- `v1.1.0` → `v1.1.1` (bug fix)
- `v2.0.0` (breaking changes)

---

## Git Fundamentals & Workflows

### Basic Git Concepts

#### Commits: Snapshots of Changes

```bash
# Stage changes
git add src/app.jsx styles/app.css
# or stage everything (be careful)
git add -A

# Create commit with message
git commit -m "Fix: handle null client in lead detail view"

# View commit history
git log --oneline -10
# Output:
# a1b2c3d (HEAD -> feature/leads) Fix: handle null client
# d4e5f6g (origin/main) Merge PR #380: add lead status field
# g7h8i9j chore: bump ficha-tecnica.jsx ?v=31

# View changes in commit
git show a1b2c3d
```

**Commit Message Best Practices**:
```
# Format: <type>: <description>

# Types:
# feat:  New feature
# fix:   Bug fix
# docs:  Documentation changes
# style: Code style (whitespace, semicolons, etc.)
# refactor: Code restructure without behavior change
# perf:  Performance improvement
# test:  Test additions/changes
# chore: Build, CI, dependencies
# revert: Revert a previous commit

# Examples
git commit -m "feat: add soft-delete to leads table"
git commit -m "fix: resolve race condition in EmailInbox modal"
git commit -m "docs: update CLAUDE.md with workflow changes"
git commit -m "chore: bump cache-busting version for ficha-tecnica"

# Longer commit message with body
git commit -m "fix: prevent duplicate dossier creation in LeadDetail

Reason: Setting a lead would create multiple dossiers if rendered
before the dossierExistente check completed.

Solution: Added 'alive' flag to track mounted status and zeroState
when lead ID changes. Separated hook logic into LeadDetailView.

Fixes #378"
```

#### Branching: Parallel Work Isolation

```bash
# Create and switch to new branch (off current branch)
git checkout -b feature/omie-integration
# Or modern syntax
git switch -c feature/omie-integration

# Branch naming convention (your project uses)
# feat/description       - New features
# fix/description        - Bug fixes
# docs/description       - Documentation
# chore/description      - Maintenance
# claude/project-slug    - Claude Code session work

# Example from your project
git checkout -b claude/nifty-rubin-hewkt6

# View all branches
git branch -a
# Output:
# * feature/omie-integration     (green, current)
#   main
#   origin/main
#   origin/claude/previous-work

# Switch between branches
git checkout main            # Old syntax
git switch main              # Modern syntax

# Delete local branch (after merge)
git branch -d feature/omie-integration

# Rename current branch
git branch -m feature/omie-v2

# Push branch to GitHub
git push origin feature/omie-integration
# or with tracking
git push -u origin feature/omie-integration
```

#### Merging: Combining Branches

```bash
# Standard merge (creates merge commit, preserves history)
git checkout main
git pull origin main
git merge feature/omie-integration
# Creates commit: "Merge branch 'feature/omie-integration' into main"

# Squash merge (combine all feature commits into one)
git merge --squash feature/omie-integration
git commit -m "feat: add Omie client lookup in leads"
# Better for PR workflows (cleaner history)

# Rebase merge (replay commits on top of main)
git rebase main
# Rewrites history - use only on non-shared branches!

# View merge conflicts
git status
# Shows conflicted files

# Resolve conflicts manually
# Edit conflicted files
git add src/comercial.jsx
git commit -m "Merge: resolve conflict in lead status logic"

# Abort merge if it's wrong
git merge --abort
```

#### Rebasing: Reorder & Clean Commits

```bash
# Interactive rebase - modify last 3 commits
git rebase -i HEAD~3
# Editor opens showing:
# pick a1b2c3d feat: add omie lookup
# pick d4e5f6g fix: handle error case
# pick g7h8i9j docs: update comments

# Change to:
# pick a1b2c3d feat: add omie lookup
# squash d4e5f6g fix: handle error case      (combine with previous)
# reword g7h8i9j docs: update comments      (edit message)

# Save and editor opens for reword
# Exit: commits are rebased

# Rebase onto main (move your branch ahead of main)
git fetch origin
git rebase origin/main
# Your commits are replayed on top of latest main

# If conflicts occur during rebase
git status  # Shows which files conflict
# Edit and resolve conflicts
git add src/comercial.jsx
git rebase --continue
# Or cancel
git rebase --abort
```

**Your Project's Usage** (from CLAUDE.md):
```bash
# After squash merge of PR in GitHub (one commit created in main)
# Your local branch still has old pre-squash commits
git fetch origin main
git checkout -B claude/new-session origin/main
# (-B flag resets branch, avoiding conflicts)

# If another session pushed to your branch
git fetch
git rebase origin/claude/project-name  # Include their work
# Then continue with cherry-pick if needed
```

#### Stashing: Temporary Storage

```bash
# Save uncommitted changes without committing
git stash
# Working directory now clean

# List stashes
git stash list
# Output:
# stash@{0}: WIP on main: a1b2c3d docs update
# stash@{1}: WIP on feature/leads: d4e5f6g email modal

# Restore stash (and remove it)
git stash pop
# Or restore without removing
git stash apply stash@{0}

# Delete stash
git stash drop stash@{0}

# Create branch from stash
git stash branch feature/from-stash
```

#### Reverting: Undo Commits

```bash
# Create new commit that undoes previous commit
git revert a1b2c3d
# Doesn't erase history, just adds opposite commit

# Soft reset (undo commit, keep changes staged)
git reset --soft HEAD~1
# Now you can re-commit with different message

# Hard reset (undo commit, discard changes) ⚠️ DANGEROUS
git reset --hard origin/main
# Your local commits are gone! Only use if 100% sure.

# View reflog (recovery option if reset goes wrong)
git reflog
# Shows all recent HEAD movements
git reset --hard a1b2c3d  # Can recover
```

---

## Integrated Feature Development Flow

### Complete Flow: From Idea to Production

```
┌─────────────────────────────────────────────────────────────┐
│  1. Issue Created (Planning)                                │
│     - Title: "Add soft-delete to leads"                     │
│     - Description: Why, acceptance criteria                 │
│     - Labels: enhancement, database                         │
│     - Milestone: v1.6.0                                     │
└────────────────────┬────────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────────┐
│  2. Create Branch & Migration (Development)                 │
│     $ git checkout -b feat/leads-soft-delete                │
│     $ supabase migration new add_soft_delete                │
│     - Edit migration: ALTER TABLE leads ADD COLUMN ...      │
│     - Validate locally: supabase db pull                    │
└────────────────────┬────────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────────┐
│  3. Update Application Code                                 │
│     - Create leads-store.js functions for soft-delete       │
│     - Update UI to show soft-deleted leads filtering        │
│     - Add tests in local environment                        │
│     $ git commit -m "feat: implement soft-delete for leads" │
└────────────────────┬────────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────────┐
│  4. Create Pull Request                                     │
│     - Title: Clear, references issue                        │
│     - Description: What, why, testing notes                 │
│     - Request reviewers (from CODEOWNERS)                   │
│     $ git push -u origin feat/leads-soft-delete             │
│     $ gh pr create --title "feat: soft-delete for leads"    │
└────────────────────┬────────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────────┐
│  5. GitHub Actions Run Automatically (CI)                   │
│     ✓ Lint & format check (ESLint, Prettier)               │
│     ✓ Test suite (if exists)                               │
│     ✓ Database validation (schema check, migration test)    │
│     ✓ Build check (no compile errors)                       │
│     ✓ All checks must pass before merge allowed             │
└────────────────────┬────────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────────┐
│  6. Code Review & Feedback Loop                             │
│     - Reviewer examines changes, leaves comments            │
│     - Author responds to feedback (commit more changes)     │
│     - Comments are resolved, reviewer approves              │
│     $ git add . && git commit -m "Address review feedback"  │
│     $ git push                                              │
│     (Actions run again automatically)                       │
└────────────────────┬────────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────────┐
│  7. Squash Merge to Main                                    │
│     - PR approved and all checks pass                       │
│     - Merge via GitHub UI (select "Squash and merge")       │
│     - Commits combined into single commit on main           │
│     - Branch auto-deleted                                   │
└────────────────────┬────────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────────┐
│  8. GitHub Actions Deploy to Production                     │
│     - Supabase migration runs automatically                 │
│     - Edge Functions update                                 │
│     - Application deployed to vpgestaoimportacao.vpsistema.co
│     (Automatic via hPanel + GitHub integration)            │
└────────────────────┬────────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────────┐
│  9. Local Cleanup                                           │
│     $ git fetch origin main                                 │
│     $ git checkout main                                     │
│     $ git pull origin main                                  │
│     $ git branch -d feat/leads-soft-delete                  │
│     (or git branch -D if needed)                            │
└────────────────────┬────────────────────────────────────────┘
                     │
└────────────────────▼────────────────────────────────────────┐
  10. Issue Closed (Documentation)
      - Issue #378 closed automatically by PR
      - CLAUDE.md updated with what was done
      - Create GitHub Release (if versioned)
```

### Hands-On Example: Adding a Supabase Migration

```bash
# 1. Create issue first (for tracking)
gh issue create \
  --title "Add excluido_em column to leads table" \
  --body "Implement soft-delete for leads to preserve relationships
  
  Acceptance criteria:
  - Migration adds excluido_em (timestamptz) and excluido_por (text)
  - Default values are null
  - Index on excluido_em for filtering
  - All queries filter out soft-deleted leads
  
  Relates to: #376 (Omie integration)"

# Output: Created issue #378

# 2. Create feature branch
git checkout -b feat/leads-soft-delete

# 3. Create migration
supabase migration new add_soft_delete_to_leads
# File created: supabase/migrations/20260926160000_add_soft_delete_to_leads.sql

# 4. Edit migration
cat > supabase/migrations/20260926160000_add_soft_delete_to_leads.sql << 'EOF'
-- Add soft-delete columns to leads table
ALTER TABLE leads
ADD COLUMN excluido_em TIMESTAMPTZ,
ADD COLUMN excluido_por TEXT;

-- Index for fast filtering
CREATE INDEX idx_leads_not_deleted ON leads(id) 
WHERE excluido_em IS NULL;

-- Add comment for documentation
COMMENT ON COLUMN leads.excluido_em IS 'Timestamp when lead was soft-deleted';
COMMENT ON COLUMN leads.excluido_por IS 'User who soft-deleted the lead';
EOF

# 5. Test migration locally
supabase db pull  # Verify schema reads correctly

# 6. Update Supabase JS client code
# File: src/comercial.jsx
# Update reloadLeads() to filter:
# .is('excluido_em', null)  // Only fetch non-deleted leads

# Update deleteLeadFn() to call:
# leads.update({
#   excluido_em: new Date().toISOString(),
#   excluido_por: currentUser.email
# }).eq('id', leadId)

# 7. Commit changes
git add supabase/migrations/20260926160000_*.sql
git add src/comercial.jsx
git commit -m "feat: implement soft-delete for leads

- Add excluido_em and excluido_por columns to leads table
- Create index for soft-delete filtering
- Update lead queries to exclude deleted leads
- Add delete function in comercial.jsx with confirmation

Closes #378"

# 8. Push to GitHub
git push -u origin feat/leads-soft-delete

# 9. Create PR
gh pr create \
  --title "feat: soft-delete for leads" \
  --body "Implements soft-delete pattern for leads table as discussed in #378

## Changes
- Added \`excluido_em\` and \`excluido_por\` columns
- Created index on excluido_em for performance
- Updated all lead queries to filter deleted leads
- Added 'Delete lead' button in list view

## Testing
- [ ] Soft-delete successfully marks leads as deleted
- [ ] Soft-deleted leads don't appear in lists
- [ ] Soft-deleted leads still accessible via direct link
- [ ] Foreign key relationships (cotações, dossier) still accessible

## Related Issues
Closes #378
Related to #376"

# 10. Actions run automatically (wait for checks to pass)
# In PR page, you'll see:
# ✓ ci/github-actions — Lint, test, build
# ✓ db-validate — Schema validation

# 11. Request review
gh pr review-requests <your-pr-number> \
  --add @team/backend

# 12. Address review feedback (if any)
git add . && git commit -m "Address review: add migration comment"
git push

# 13. After approval, squash merge
gh pr merge <pr-number> --squash --auto
# or via web UI: GitHub → PR page → "Squash and merge"

# 14. Local cleanup
git fetch origin main
git checkout main
git pull
git branch -D feat/leads-soft-delete

# 15. Close issue & document
# Issue auto-closes from PR commit message
# Update CLAUDE.md:
# - Add section about soft-delete implementation
# - Note any gotchas or migration patterns
```

---

## Pull Requests & Code Review

### Creating a Pull Request

#### Using GitHub CLI (Recommended)

```bash
# Simple creation
gh pr create --title "feat: add email inbox" \
  --body "Implements IMAP/SMTP email reader"

# Full options
gh pr create \
  --title "feat: add email inbox" \
  --body "
## Summary
Implements IMAP and SMTP integration for reading and sending emails.

## Changes
- New EmailInbox component with folder navigation
- EdgeFunction send-email and read-inbox for backend operations
- Integration with leads through email template

## Testing
- Tested with real Gmail account
- Verified IMAP folder sync
- Confirmed SMTP sending with attachments

## Related Issues
Closes #268
" \
  --reviewer @user1,@user2 \
  --label enhancement,backend \
  --milestone "v1.4.0"

# Draft PR (not ready for review yet)
gh pr create --draft --title "WIP: refactoring storage layer"
```

#### PR Description Template

Your project should have `.github/pull_request_template.md`:

```markdown
## Description
Brief summary of what this PR does.

## Type of Change
- [ ] Bug fix (non-breaking change that fixes an issue)
- [ ] New feature (non-breaking change that adds functionality)
- [ ] Breaking change (fix or feature that would cause existing functionality to change)
- [ ] Documentation update

## Related Issue
Closes #123

## Testing
Describe how to test this change:
- [ ] Test case 1
- [ ] Test case 2

## Checklist
- [ ] Code follows style guidelines
- [ ] Comments added for complex logic
- [ ] Documentation updated
- [ ] Tested locally
- [ ] No new warnings generated
- [ ] Cache-busting version bumped (if src/* or styles/* changed)

## Database Changes
- [ ] Migration created
- [ ] Migration tested locally
- [ ] Edge Functions updated (if needed)

## Screenshots
If applicable, add screenshots showing the change.
```

### Reviewing Pull Requests

#### Review Workflow

```bash
# List PRs to review
gh pr list --search "is:open review:pending" --state open

# Check out PR locally for testing
gh pr checkout 380
# Switches to PR's branch, even if from fork

# View PR details
gh pr view 380
gh pr view 380 --json commits,reviews

# View PR diffs
gh pr diff 380

# Add review comment (via web UI or CLI)
gh pr review 380 --comment --body "Great work! One question about error handling..."

# Approve with CLI
gh pr review 380 --approve --body "Looks good!"

# Request changes
gh pr review 380 --request-changes --body "Please handle the null case"
```

#### Review Checklist

For each PR, reviewer should check:

```
FUNCTIONALITY
☐ Does it solve the stated problem?
☐ Are edge cases handled (null, empty, errors)?
☐ Does it break existing functionality?
☐ Performance impact (N+1 queries, large loops)?

CODE QUALITY
☐ Follows project style (naming, structure)
☐ Comments explain complex logic
☐ No dead code or debug statements left
☐ Appropriate error handling

DATABASE (for Supabase changes)
☐ Migration SQL is correct syntax
☐ Migration tested against real schema
☐ Backward compatible or rollback plan exists
☐ Indexes added for new filtering columns
☐ RLS policies updated if needed

SECURITY
☐ No credentials/tokens in code
☐ API calls validate input
☐ Database queries use parameterization (already handled by Supabase client)
☐ Sensitive data not logged

TESTING
☐ Tested locally as described
☐ All GitHub Actions checks pass
☐ No new warnings or errors in console

DOCUMENTATION
☐ CLAUDE.md updated if needed
☐ Comments added for non-obvious logic
☐ If feature visible to users, README updated
```

### Merge Strategies

#### 1. **Squash Merge** (Your Project Default)

```bash
# Squash all feature commits into one on main
gh pr merge 380 --squash

# Result:
# Before: main has commits A, B, C (from PR)
# After: main has commits A, B, C (merged into single squashed commit)
# Advantage: Clean main history
# Disadvantage: Loses individual commit messages
```

**Use When**: Feature has many small commits, want clean history

```
Before squash:
main  → A1(initial) → A2(fix) → A3(tests) → A4(review feedback)

After squash:
main  → M1(combined feature)
```

#### 2. **Standard Merge** (Preserves History)

```bash
# Merge with merge commit
gh pr merge 380 --merge

# Result:
# Creates merge commit showing branch and main coming together
# Advantage: Shows branching history
# Disadvantage: More commits in main
```

#### 3. **Rebase Merge** (Linear History)

```bash
# Rebase PR commits on top of main
gh pr merge 380 --rebase

# Result:
# PR commits replayed on main without merge commit
# Advantage: Linear history (easier bisect/blame)
# Disadvantage: Rewrites commit timestamps
```

#### Auto-Merge Configuration

```yaml
# .github/workflows/auto-merge.yml
name: Auto Merge

on:
  pull_request:
    types: [labeled]

jobs:
  auto-merge:
    if: github.event.label.name == 'automerge'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Enable auto-merge
        run: |
          gh pr merge ${{ github.event.pull_request.number }} \
            --squash \
            --auto
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

Use when:
- All checks pass
- Approved by code owner
- Dependabot updates (auto-approve & merge)

### Status Checks (CI/CD Gates)

```yaml
# Status checks that must pass before merge allowed
# Configured in Settings → Branches → Require status checks to pass

# Example checks for 010_GestaoImportacao:
✓ ci/github-actions    # ESLint, format, tests, build
✓ db-validate          # Supabase migration validation
✓ deploy-preview       # Staging deployment successful
```

**Checks must pass in order**:
1. Run ESLint (code style)
2. Run tests (functionality)
3. Build (no errors)
4. Validate DB migration (can apply cleanly)
5. Deploy to staging (functional test)

---

## Issues & Project Management

### Creating Issues

```bash
# Simple issue
gh issue create --title "Bug: email inbox loses connection" \
  --body "Steps to reproduce..."

# Full details
gh issue create \
  --title "feat: add export to PDF for reports" \
  --body "
## Description
Add ability to export generated reports as PDF files for sharing and archival.

## Acceptance Criteria
- [ ] Report page has 'Export PDF' button
- [ ] PDF includes all data visible in web view
- [ ] PDF has proper formatting and margins
- [ ] Works for all report types

## Estimated Effort
3 days

## Related
#120 (existing export feature we can build on)
" \
  --label enhancement,documentation \
  --assignee @current-user \
  --milestone v1.7.0

# From command line only
gh issue create --title "Testing without body"
```

#### Issue Template Configuration

`.github/issue_template/bug_report.md`:

```markdown
---
name: Bug Report
about: Report a bug you've found
title: "[BUG] "
labels: bug
---

## Description
Describe the bug in detail.

## Steps to Reproduce
1. Go to...
2. Click...
3. See error

## Expected Behavior
What should happen instead?

## Actual Behavior
What actually happened?

## Environment
- Browser/Device:
- OS:
- Version:

## Screenshots
If applicable, add screenshots.

## Additional Context
Any other relevant information.
```

`.github/issue_template/feature_request.md`:

```markdown
---
name: Feature Request
about: Suggest a new feature
title: "[FEAT] "
labels: enhancement
---

## Description
Describe the feature you want.

## Why
Why do you need this? What problem does it solve?

## Proposed Solution
How should this work?

## Alternatives
Other approaches you've considered.

## Additional Context
Related issues or PRs.
```

### Labels Organization

```yaml
# Naming convention: <type>/<priority>

# Types
type/bug            - Bug report
type/feature        - Feature request
type/docs           - Documentation
type/refactor       - Code restructure
type/security       - Security issue

# Priority
priority/critical   - Blocks work, immediate fix needed
priority/high       - Should fix soon
priority/medium     - Normal timeline
priority/low        - Nice to have

# Components
area/database       - Database schema or migrations
area/backend        - Edge Functions or API logic
area/frontend       - UI/UX changes
area/email          - Email system (inbox, SMTP)
area/leads          - Leads management

# Status (managed automatically)
status/in-progress  - Currently being worked on
status/review       - Waiting for review
status/blocked      - Blocked by something else

# Your project labels (example)
labels:
  - type/bug
  - type/feature
  - type/docs
  - priority/critical
  - priority/high
  - priority/medium
  - area/database
  - area/backend
  - area/email
  - area/leads
  - database:migration
  - needs-clarification
  - needs-testing
  - reviewer-assignment
```

### Milestones

```bash
# Create milestone
gh milestone create \
  --title "v1.6.0 - Email & Leads" \
  --description "Focus on email inbox and leads management"

# Assign issues to milestone
gh issue edit 378 --milestone "v1.6.0 - Email & Leads"

# Track milestone progress
gh milestone view "v1.6.0 - Email & Leads"

# When milestone is complete
gh milestone close "v1.6.0 - Email & Leads"
```

### Linking Issues & Pull Requests

**Automatic Closing**:

```bash
# In PR description, add any of these:
Closes #378
Fixes #378
Resolves #378

# GitHub automatically closes issue #378 when PR merges
```

**Manual Linking**:

```bash
# Link issue to PR without closing
gh pr edit 380 --add-label linked-to-issue

# Check what's linked
gh issue view 378 --json linkedPullRequests
```

### Using Discussions vs Issues

| Aspect | Issue | Discussion |
|--------|-------|-----------|
| Purpose | Tasks, bugs, features | Q&A, ideas, open-ended |
| Closure | Can close when done | Stays open for reference |
| Examples | "Fix null bug" | "Best way to structure...?" |
| In Project | Shows in roadmap | For knowledge base |

Your project uses **Issues** for development tasks, **Discussions** for design questions.

---

## GitHub Actions: Fundamentals & Integration

### Understanding Workflows

Workflows are YAML files in `.github/workflows/` that automate CI/CD tasks.

```yaml
# File: .github/workflows/ci.yml
# Triggers on: pull request to any branch, or push to main

name: CI - Lint, Test, Build

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

env:
  NODE_VERSION: "18"

jobs:
  lint-and-test:
    runs-on: ubuntu-latest
    
    steps:
      # Step 1: Get code
      - name: Checkout code
        uses: actions/checkout@v4
      
      # Step 2: Set up Node
      - name: Set up Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: npm
      
      # Step 3: Install dependencies
      - name: Install dependencies
        run: npm ci
      
      # Step 4: Run linter
      - name: Run ESLint
        run: npm run lint
        continue-on-error: false
      
      # Step 5: Run tests
      - name: Run tests
        run: npm run test:ci
      
      # Step 6: Check code coverage
      - name: Check coverage
        run: npm run coverage
      
      # Step 7: Build
      - name: Build application
        run: npm run build

  database-validate:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Set up Supabase CLI
        run: npm install -g supabase
      
      - name: Validate migrations
        run: |
          # Check if migrations are valid SQL
          for f in supabase/migrations/*.sql; do
            echo "Validating $f"
            # Basic SQL syntax check (in production, use proper validation)
            grep -E "^(CREATE|ALTER|DROP|INSERT|UPDATE|DELETE)" "$f" > /dev/null \
              || echo "Warning: No DDL in $f"
          done
      
      - name: Test migration apply (dry run)
        run: supabase migration list
        env:
          SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          SUPABASE_ANON_KEY: ${{ secrets.SUPABASE_ANON_KEY }}
```

### Key Concepts

#### Events: What Triggers Workflows

```yaml
on:
  # On push to main
  push:
    branches: [main]
  
  # On pull request to main
  pull_request:
    branches: [main]
  
  # On schedule (cron)
  schedule:
    - cron: '0 0 * * *'  # Daily at midnight UTC
  
  # Manual trigger (via web UI or CLI)
  workflow_dispatch:
    inputs:
      environment:
        description: 'Environment to deploy'
        required: true
        default: 'staging'
  
  # On release
  release:
    types: [published, created]
  
  # On issue or issue comment
  issues:
    types: [opened, edited, labeled]
  
  # On pull request review
  pull_request_review:
    types: [submitted, edited]
```

#### Jobs: Parallel Execution Units

```yaml
jobs:
  job1:
    runs-on: ubuntu-latest
    steps: [...]
  
  job2:
    runs-on: ubuntu-latest
    needs: job1  # Only run after job1 succeeds
    steps: [...]
  
  job3:
    runs-on: ubuntu-latest
    if: failure()  # Only run if job1 or job2 failed
    steps: [...]
```

#### Steps: Individual Tasks

```yaml
steps:
  # Use an action from GitHub Marketplace
  - uses: actions/checkout@v4
    with:
      fetch-depth: 0  # Get all history
  
  # Run shell command
  - run: npm install
  
  # Run shell script with name
  - name: Build
    run: npm run build
  
  # Run script with env variables
  - name: Test
    run: npm run test
    env:
      DEBUG: 'app:*'
  
  # Conditional step
  - name: Deploy to production
    if: github.ref == 'refs/heads/main'
    run: npm run deploy:prod
  
  # With error handling
  - name: Optional step
    run: npm run optional-task
    continue-on-error: true
```

#### Contexts & Variables

```yaml
# GitHub contexts provide runtime information
steps:
  - name: Print context info
    run: |
      echo "Event: ${{ github.event_name }}"
      echo "Branch: ${{ github.ref }}"
      echo "Actor: ${{ github.actor }}"
      echo "Commit: ${{ github.sha }}"
      echo "PR Number: ${{ github.event.pull_request.number }}"
      echo "PR Title: ${{ github.event.pull_request.title }}"
  
  - name: Conditional based on branch
    if: github.ref == 'refs/heads/main'
    run: echo "Running on main branch"
  
  - name: Conditional based on event
    if: github.event_name == 'pull_request'
    run: echo "This is a PR"
  
  - name: Access secrets
    run: npm run deploy
    env:
      SUPABASE_ACCESS_TOKEN: ${{ secrets.SUPABASE_ACCESS_TOKEN }}
      API_KEY: ${{ secrets.API_KEY }}
```

### Real Workflow Examples for Your Project

#### 1. CI Workflow (Runs on Every PR)

```yaml
# .github/workflows/ci.yml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: npm
      
      - run: npm ci
      - run: npx eslint src/ --max-warnings 0
      - run: npx prettier --check src/ styles/
  
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: npm
      
      - run: npm ci
      - run: npm run test:ci -- --coverage
      
      - name: Upload coverage
        uses: codecov/codecov-action@v3
        if: always()
  
  database:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Validate SQL migrations
        run: |
          for file in supabase/migrations/*.sql; do
            if [ -f "$file" ]; then
              # Ensure file is not empty
              if [ ! -s "$file" ]; then
                echo "ERROR: $file is empty"
                exit 1
              fi
              echo "✓ $file"
            fi
          done
      
      - name: Check for migration naming
        run: |
          # Ensure migrations follow naming pattern: YYYYMMDDHHMMSS_*.sql
          cd supabase/migrations
          ls -1 *.sql 2>/dev/null | while read -r file; do
            if ! [[ $file =~ ^[0-9]{14}_.*\.sql$ ]]; then
              echo "ERROR: $file doesn't match naming pattern"
              exit 1
            fi
          done
```

#### 2. Deploy Workflow (Runs on main Merge)

```yaml
# .github/workflows/deploy.yml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    environment: production  # Requires approval
    
    steps:
      - uses: actions/checkout@v4
      
      - uses: actions/setup-node@v4
        with:
          node-version: '18'
      
      - name: Deploy Edge Functions
        run: |
          npm install -g supabase
          supabase functions deploy \
            --project-ref jxtqwzmpgofwctqajewt
        env:
          SUPABASE_ACCESS_TOKEN: ${{ secrets.SUPABASE_ACCESS_TOKEN }}
      
      - name: Run migrations
        run: |
          supabase migration up \
            --project-ref jxtqwzmpgofwctqajewt \
            --password "${{ secrets.SUPABASE_DB_PASSWORD }}"
      
      - name: Notify deployment
        run: |
          echo "✓ Deployed to production"
          echo "Time: $(date)"
          echo "Commit: ${{ github.sha }}"
        
        # Optional: Send Slack notification
        # uses: slackapi/slack-github-action@v1.24.0
        # with:
        #   webhook-url: ${{ secrets.SLACK_WEBHOOK }}
```

#### 3. Scheduled Cleanup (Runs Daily)

```yaml
# .github/workflows/scheduled-cleanup.yml
name: Scheduled Cleanup

on:
  schedule:
    # Every day at midnight UTC
    - cron: '0 0 * * *'

jobs:
  cleanup:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - uses: actions/setup-node@v4
        with:
          node-version: '18'
      
      - name: Clean old artifacts
        run: |
          # Delete artifacts older than 30 days
          # (GitHub does this automatically, but example of custom cleanup)
          echo "Running scheduled cleanup tasks..."
      
      - name: Check for stale branches
        run: |
          git fetch origin
          # List branches not updated in 30 days
          git branch -a --format='%(refname) %(authordate)' | \
            grep "30 days\|29 days\|28 days" || echo "No stale branches"
```

### Caching Dependencies

```yaml
steps:
  - uses: actions/checkout@v4
  
  # Automatically caches dependencies
  - uses: actions/setup-node@v4
    with:
      node-version: '18'
      cache: npm  # Cache node_modules
  
  # First run: downloads and caches ~100MB
  # Second run: restores from cache (~2 seconds)
  - run: npm ci
```

### Using Matrix for Multiple Configurations

```yaml
# Test against multiple Node versions and browsers
jobs:
  test:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        node-version: [16, 18, 20]
        browser: [chrome, firefox]
    
    steps:
      - uses: actions/checkout@v4
      
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node-version }}
      
      - run: npm test -- --browser=${{ matrix.browser }}
        # Runs 3 × 2 = 6 combinations total
```

---

## Database Migrations & Supabase CI/CD

### Local Migration Workflow

```bash
# 1. Create migration file
supabase migration new add_soft_delete
# Creates: supabase/migrations/20260927120000_add_soft_delete.sql

# 2. Edit migration
cat > supabase/migrations/20260927120000_add_soft_delete.sql << 'EOF'
-- Add soft-delete to leads table
ALTER TABLE public.leads
ADD COLUMN excluido_em TIMESTAMP WITH TIME ZONE,
ADD COLUMN excluido_por TEXT;

-- Create index for filtering
CREATE INDEX idx_leads_active ON public.leads(id)
WHERE excluido_em IS NULL;

-- Document changes
COMMENT ON COLUMN public.leads.excluido_em IS 
  'Timestamp when the lead was soft-deleted';
COMMENT ON COLUMN public.leads.excluido_por IS 
  'User email who performed the soft-delete';
EOF

# 3. Test migration locally
# Start local Supabase stack
supabase start

# Pull latest schema
supabase db pull

# Migration is applied when you start the local DB

# 4. Verify schema changes
# Check: http://localhost:54323 (Studio)
# Connect to postgres://postgres:postgres@localhost:5432/postgres

# 5. Push to GitHub
git add supabase/migrations/20260927120000_add_soft_delete.sql
git commit -m "feat: add soft-delete columns to leads"
git push

# 6. Create PR (Actions validate migration)
# GitHub Actions runs:
# - Syntax validation
# - Schema compatibility check
# - Test apply to staging database

# 7. After merge, automatic deploy
# GitHub Actions on main:
# - Apply migration to production
# - Verify success
# - Notify team
```

### Migration Best Practices

#### Naming Convention

```bash
# Pattern: YYYYMMDDHHMMSS_description_lowercase.sql
# Example: 20260927120000_add_soft_delete_to_leads.sql

# Ensures:
# - Unique timestamps prevent conflicts
# - Chronological ordering
# - Readable descriptions
```

#### Writing Safe Migrations

```sql
-- ✓ GOOD: Reversible, idempotent, no locks
BEGIN;

-- Use IF NOT EXISTS to handle replication/retries
ALTER TABLE IF EXISTS public.leads
ADD COLUMN IF NOT EXISTS excluido_em TIMESTAMP WITH TIME ZONE;

-- Create index only if it doesn't exist
CREATE INDEX IF NOT EXISTS idx_leads_active 
  ON public.leads(id) WHERE excluido_em IS NULL;

-- Add constraints carefully (don't lock table long)
ALTER TABLE public.leads
ADD CONSTRAINT chk_excluido_em_not_future
  CHECK (excluido_em IS NULL OR excluido_em <= CURRENT_TIMESTAMP);

COMMIT;

-- ✗ AVOID: Can cause issues
-- DROP TABLE users;  -- No rollback!
-- ALTER TABLE users MODIFY name VARCHAR(10);  -- Truncates data!
-- CREATE TEMPORARY TABLE ...  -- Won't persist
```

#### Rollback Strategy

```bash
# If migration needs to be reverted
# Create a new migration that undoes changes:

cat > supabase/migrations/20260927130000_rollback_soft_delete.sql << 'EOF'
-- Rollback soft-delete migration
ALTER TABLE public.leads
DROP COLUMN IF EXISTS excluido_em,
DROP COLUMN IF EXISTS excluido_por;

DROP INDEX IF EXISTS idx_leads_active;
EOF

# Then:
git add supabase/migrations/20260927130000_*.sql
git commit -m "revert: remove soft-delete from leads"
git push
# Merge PR, and production will apply reverse migration
```

### Edge Functions Deployment from Git

```bash
# Structure
supabase/functions/
├── send-email/
│   ├── index.ts         # Function code
│   └── deno.json        # Dependencies
├── read-inbox/
│   ├── index.ts
│   └── deno.json
└── suggest-email-reply/
    ├── index.ts
    └── deno.json

# Deploy from Git (automatic on main merge)
# Or manual:
supabase functions deploy send-email \
  --project-ref jxtqwzmpgofwctqajewt

# Example function
# File: supabase/functions/send-email/index.ts

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { SmtpClient } from "https://deno.land/x/smtp/mod.ts";

interface EmailRequest {
  to: string;
  subject: string;
  body: string;
  html?: string;
  attachments?: Array<{ filename: string; data: Uint8Array }>;
}

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const payload: EmailRequest = await req.json();

    // Validate input
    if (!payload.to || !payload.subject || !payload.body) {
      return new Response("Missing required fields", { status: 400 });
    }

    const client = new SmtpClient();
    await client.connect({
      hostname: Deno.env.get("SMTP_HOST")!,
      port: parseInt(Deno.env.get("SMTP_PORT")!),
      username: Deno.env.get("SMTP_USER")!,
      password: Deno.env.get("SMTP_PASSWORD")!,
      tls: true,
    });

    await client.send({
      from: Deno.env.get("SMTP_FROM")!,
      to: payload.to,
      subject: payload.subject,
      content: payload.body,
      html: payload.html,
    });

    await client.close();

    return new Response(
      JSON.stringify({ success: true, message: "Email sent" }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error(error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
```

---

## Security: Access Control & Secrets Management

### Branch Protection & Enforcement

```bash
# Configure via GitHub Web UI
# Settings → Branches → Branch protection rules

# Key rules for main branch:
# ✓ Require pull request reviews: 1
# ✓ Require status checks: ci/github-actions, db-validate
# ✓ Require branches up to date: YES
# ✓ Require code owner review: YES (for src/*)
# ✗ Allow force pushes: NO
# ✗ Allow deletions: NO
```

### CODEOWNERS: Automatic Review Assignment

```bash
# File: .github/CODEOWNERS
# Syntax: <path-pattern> @owner1 @owner2

# Global ownership (all files)
* @admin

# Security-related files require security team
src/security.jsx @team/security
src/supabase.js @team/security

# Database files require backend team
supabase/migrations/ @team/backend
supabase/functions/ @team/backend

# Email-specific files
src/logistica.jsx @team/backend
src/email-*.jsx @team/backend

# Leads management
src/comercial.jsx @team/sales

# Specific users for critical paths
src/app.jsx @tech-lead
CLAUDE.md @tech-lead

# Results:
# - When PR modifies src/security.jsx → @team/security auto-requested
# - When PR adds migration → @team/backend auto-requested
# - PR can't merge without required reviewers' approval
```

### Organization & Team Permissions

```bash
# Create team
gh team create backend --description "Backend team members"

# Add members
gh team add backend @user1 @user2

# Set repository permissions
gh repo edit 010_GestaoImportacao \
  --add-team backend:maintain
# Levels: pull, triage, push (write), maintain, admin

# Roles in your organization
# Owner: Full administrative control
# Billing Manager: Manage billing and payment
# Security Manager: Manage security features
# Team Maintainer: Manage team membership

# Creating custom roles (Enterprise only)
# Can create roles like "Database Admin", "API Developer"
```

### Secrets Management

```bash
# Store secrets at multiple levels

# 1. Repository Secrets (for this repo only)
gh secret set SUPABASE_ACCESS_TOKEN --body "token_value"
gh secret set SUPABASE_DB_PASSWORD --body "password_value"

# 2. Organization Secrets (shared across repos)
gh secret set SLACK_WEBHOOK --body "webhook_url" --org verticalpartsIA
gh secret set DEPLOYMENT_KEY --body "key_value" --org verticalpartsIA

# 3. Environment Secrets (prod vs staging)
gh secret set API_KEY --body "prod_key" \
  --env production
gh secret set API_KEY --body "staging_key" \
  --env staging

# List secrets (shows names only, not values)
gh secret list
gh secret list --env production

# Use in workflows
jobs:
  deploy:
    runs-on: ubuntu-latest
    environment: production
    steps:
      - run: ./deploy.sh
        env:
          SUPABASE_KEY: ${{ secrets.SUPABASE_ACCESS_TOKEN }}
          # Note: Don't echo secrets!
          # BAD: echo ${{ secrets.KEY }}
          # GOOD: Use secrets only in tool arguments
```

#### Secret Scanning

```yaml
# Automatically detect exposed secrets

# GitHub scans for:
# - AWS access keys
# - GitHub tokens
# - Azure credentials
# - Private keys
# - Database connection strings
# - API keys

# If secret exposed:
# 1. Receive alert immediately
# 2. Secret is invalidated (if possible)
# 3. Provider notified (AWS, GitHub, etc.)

# Prevention: Push protection
# Settings → Code security → Push protection
# ✓ Block commits containing secrets
# Can be bypassed with approval (tracked in audit log)
```

### Role-Based Access Control (RBAC)

```yaml
# Permission matrix for your project

| Role | Repo | Branch | Secrets | Deployments |
|------|------|--------|---------|-------------|
| Owner | R/W/Admin | Protect/Delete | R/W/Delete | All |
| Backend Team | R/W | Create/Merge | R (SBPWD) | Deploy |
| Frontend Dev | R/W | Create | R (API keys) | Staging only |
| DevOps | R | None | R/W/Delete | Deploy All |
| CI/CD Bot | R | None | R (action keys) | Auto-deploy |

# Example: Frontend developer
- Can: Create branches, commit, push to own branch
- Cannot: Merge to main, access DB password, deploy prod
- Auto-requested: Code owner review before merge

# Example: GitHub Actions (CI/CD)
- Token: GITHUB_TOKEN (auto-generated per workflow)
- Can: Read code, write checks, comment on PRs
- Cannot: Delete repos, change branch protection
```

### Dependabot: Automated Dependency Updates

```yaml
# File: .github/dependabot.yml
version: 2
updates:
  # Check npm dependencies
  - package-ecosystem: npm
    directory: "/"
    schedule:
      interval: weekly
      day: monday
      time: "04:00"
    
    # Auto-merge for dev dependencies
    auto-merge: true
    
    # Commit message customization
    commit-message:
      prefix: "chore"
      prefix-scope: deps
    
    # Allow up to 5 open PRs
    open-pull-requests-limit: 5
    
    # Assign to team for review
    reviewers:
      - team/backend
```

When enabled:
- Dependabot scans `package.json` weekly
- Creates PRs for updates
- Runs Actions on PR automatically
- If all checks pass & no conflicts → auto-merge
- Tracks vulnerabilities from CVE databases

---

## Deployment Workflows & Production Release

### Your Project's Deployment Pipeline

```
Local Dev          →    GitHub PR      →    GitHub Actions    →    Production
(branch)           (review)             (CI/test/validate)       (live users)
   ↓                   ↓                      ↓                       ↓
supabase start      Open PR          ✓ Lint & format       Deploy to
test locally        describe          ✓ Run tests           vpgestaoimportacao
                    changes           ✓ Validate DB         .vpsistema.com
commit              request           ✓ Build               
push origin         review            ✓ OK → Approve        Automatic via
                                      ✗ Fail → Request      hPanel + GitHub
                  Squash merge         changes              integration
                  to main
```

### Deployment Environments

```yaml
# .github/workflows/deploy.yml
jobs:
  deploy-staging:
    runs-on: ubuntu-latest
    environment: staging  # Optional approval
    if: github.event_name == 'pull_request'
    steps:
      - name: Deploy to staging
        run: |
          echo "Deploying PR to staging Supabase..."
          # Use PR-specific database if available
  
  deploy-production:
    runs-on: ubuntu-latest
    environment: production  # Requires explicit approval
    if: github.ref == 'refs/heads/main'
    steps:
      - uses: actions/checkout@v4
      
      - name: Run migrations
        run: npm run migrate:prod
        env:
          SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          SUPABASE_KEY: ${{ secrets.SUPABASE_ACCESS_TOKEN }}
      
      - name: Deploy Edge Functions
        run: npm run deploy:functions
      
      - name: Deploy frontend
        run: npm run build && npm run deploy:web
      
      - name: Verify deployment
        run: npm run test:smoke:prod
      
      - name: Notify team
        if: success()
        run: |
          echo "✓ Production deployment successful"
          echo "Version: ${{ github.sha }}"
```

### Manual Deployment (if needed)

```bash
# If GitHub Actions fails and manual deployment needed:

# 1. Check status
git status
git log --oneline -5

# 2. Deploy Supabase migrations
supabase migration list
supabase migration up --password "$SUPABASE_DB_PASSWORD"

# 3. Deploy Edge Functions
supabase functions deploy --project-ref jxtqwzmpgofwctqajewt

# 4. Verify
curl https://vpgestaoimportacao.vpsistema.com/api/health

# 5. If needed, rollback
git revert HEAD
git push origin main
```

### Production Checklist

Before every release:

```
PRE-RELEASE CHECKLIST
☐ All PRs merged to main
☐ GitHub Actions all pass
☐ Code review approval received
☐ Tests passing (100% critical paths)
☐ Database migrations tested locally
☐ No breaking changes to API
☐ Security scanning passed
☐ Performance impact assessed
☐ CHANGELOG/Release notes written
☐ Backup taken of production database
☐ Team notified of release window

DURING RELEASE
☐ Monitor logs in real-time
☐ Check error tracking (if configured)
☐ Spot-check features in browser
☐ Verify database schema (migrations applied)
☐ Test critical user paths

POST-RELEASE
☐ Monitor for 30 minutes
☐ Check error rates normal
☐ Document what was deployed
☐ Update version/tag in repository
☐ Send release notes to team
☐ Close related issues
```

---

## Hotfix & Emergency Procedures

### Emergency Hotfix Flow

```
Production Bug Reported
         ↓
Create CRITICAL issue
         ↓
Create hotfix branch from main
    git checkout -b hotfix/critical-bug
         ↓
Fix bug + minimal changes only
git commit -m "fix: critical auth bug prevents login"
         ↓
Expedited PR with CRITICAL label
gh pr create --title "HOTFIX: Auth bug" \
  --label critical \
  --reviewer @tech-lead
         ↓
Single approval sufficient (not 2)
    (Branch protection relaxed for critical)
         ↓
Merge immediately
    Squash merge to main
         ↓
GitHub Actions deploys automatically
    (Staging → Production)
         ↓
Verify fix in production
         ↓
Post-mortem discussion
         ↓
Fix root cause in next sprint
```

### Hotfix Commands

```bash
# 1. Immediate response
git fetch origin
git checkout -b hotfix/critical-bug origin/main

# 2. Minimal fix (nothing else)
# Edit only the files that fix the bug
git add src/critical-file.jsx
git commit -m "fix: critical bug that breaks login"

# 3. Push and create expedited PR
git push -u origin hotfix/critical-bug
gh pr create \
  --title "HOTFIX: Critical bug - Login broken" \
  --body "
  ## Critical Bug
  Users unable to login due to auth token validation.
  
  ## Fix
  Revert to previous auth logic (temporary).
  
  ## Root Cause Analysis
  To follow in separate issue/PR.
  " \
  --label critical,urgent \
  --reviewer @tech-lead

# 4. Merge as soon as approved
gh pr merge <pr-number> --squash --auto

# 5. Monitor production
tail -f production-logs.log

# 6. Follow up
# Create separate issue for root cause fix
# Don't patch over the patch with more patches!
```

### Rollback Procedures

```bash
# If production deployment breaks something:

# Option 1: Revert last commit
git revert HEAD
git push origin main
# Actions automatically deploy the revert

# Option 2: Rollback database (if migration failed)
# Contact Supabase support or use manual SQL revert

# Option 3: Manual rollback via SSH (last resort)
# SSH into vpgestaoimportacao server
# Run: git reset --hard origin/main~1
# Redeploy

# Recovery checklist:
☐ Issue created documenting problem
☐ Rollback deployed
☐ Service verified working
☐ Team notified
☐ Root cause analyzed
☐ Fix prepared for next release
```

---

## Organization & Team Management

### Your Organization Structure

```
verticalpartsIA (Organization)
├── Teams
│   ├── @team/backend
│   │   └── Members: developers who work on APIs/migrations
│   │
│   ├── @team/frontend
│   │   └── Members: React/UI developers
│   │
│   ├── @team/security
│   │   └── Members: security review personnel
│   │
│   └── @team/devops
│       └── Members: deployment/infrastructure focus
│
├── Repositories
│   ├── 010_GestaoImportacao (MAIN PROJECT)
│   ├── documentation
│   ├── infrastructure
│   └── ...
│
└── Settings
    ├── Member roles (Owner, Security Manager, Billing Manager)
    ├── OAuth apps approved for org
    ├── SAML SSO configuration
    └── IP allowlist (if Enterprise)
```

### Team Permissions

```bash
# Create team with specific role
gh team create backend \
  --description "Backend developers" \
  --privacy closed  # Only visible to org members

# Add members to team
gh team add backend gelson.claude2

# Give team repository access
gh repo edit 010_GestaoImportacao \
  --add-team backend:maintain
# Levels: 
#   pull = read-only
#   triage = can manage issues/PRs but not merge
#   push = can commit/merge PRs (write)
#   maintain = can merge + branch protection settings
#   admin = full repository control

# Check team membership
gh team list --org verticalpartsIA
gh team members backend --org verticalpartsIA
```

### Organization Policies

```yaml
# Enforce security & consistency across organization

Policies to configure:
  ☐ Require 2FA for all members
  ☐ Require SSO login
  ☐ IP allowlist (if Enterprise)
  ☐ Personal access token restrictions
  ☐ Webhook restrictions
  ☐ Fork policies (restrict/allow private forks)
  ☐ Default branch protection rules
  ☐ Repository creation permissions

# Via GitHub CLI
gh repo edit 010_GestaoImportacao \
  --require-commit-signoff

# Via Web UI
Organization Settings → Security → Policy settings
```

---

## Code Search & Repository Insights

### Searching Code

```bash
# GitHub Code Search (faster than Google)

# Simple search
gh search code "function handleSubmit" --repo verticalpartsIA/010_GestaoImportacao

# Complex search with qualifiers
gh search code \
  "fetch.*supabase" \
  --language javascript \
  --repo verticalpartsIA/010_GestaoImportacao \
  --sort stars \
  --order desc

# Search for specific patterns
gh search code "SELECT.*FROM leads" \
  --language sql \
  --repo verticalpartsIA/010_GestaoImportacao

# Search issues
gh search issues "email inbox" \
  --repo verticalpartsIA/010_GestaoImportacao \
  --state open

# Search pull requests
gh search prs "migration" \
  --repo verticalpartsIA/010_GestaoImportacao \
  --author gelson.claude2

# Search commits
gh search commits "feat: add" \
  --repo verticalpartsIA/010_GestaoImportacao
```

### Repository Insights

```bash
# Network graph (branching history)
# Web UI: Repository → Insights → Network

# Pulse (activity summary)
gh repo view 010_GestaoImportacao --web
# Then: Insights → Pulse

# Commits graph
gh repo view 010_GestaoImportacao --web
# Then: Insights → Commits

# Code frequency
# Shows additions/deletions over time
# Web UI: Insights → Code frequency

# Dependency graph
# Maps npm/pip/etc dependencies
# Web UI: Insights → Dependency graph

# Check for vulnerabilities
gh repo view 010_GestaoImportacao --web
# Then: Security → Vulnerability alerts
```

---

## Advanced: GraphQL API & GitHub Apps

### GraphQL API for Complex Queries

GraphQL allows fetching exactly what you need (vs REST's fixed responses).

```bash
# GraphQL is more powerful for:
# - Fetching nested data in one query
# - Pagination through complex relationships
# - Filtering at query time

# Example: Get all closed PRs with reviewers
gh api graphql -f query='
  query {
    repository(owner: "verticalpartsIA", name: "010_GestaoImportacao") {
      pullRequests(first: 10, states: MERGED) {
        nodes {
          title
          number
          mergedAt
          reviews(first: 5) {
            nodes {
              author {
                login
              }
              state
            }
          }
        }
      }
    }
  }
'

# Example: Get issues with linked PRs
gh api graphql -f query='
  query {
    repository(owner: "verticalpartsIA", name: "010_GestaoImportacao") {
      issues(first: 10) {
        nodes {
          title
          number
          timelineItems(first: 5, itemTypes: [CROSS_REFERENCED_EVENT]) {
            nodes {
              ... on CrossReferencedEvent {
                source {
                  __typename
                  ... on PullRequest {
                    title
                    number
                  }
                }
              }
            }
          }
        }
      }
    }
  }
'
```

### GitHub Apps for Automation

A GitHub App can automate workflows beyond standard CI/CD.

```typescript
// Example GitHub App: Auto-labeler
// Runs when issue created, adds labels based on title

import Probot from "probot";

export default (app: Probot) => {
  app.on("issues.opened", async (context) => {
    const issue = context.payload.issue;
    
    // Auto-label based on title patterns
    let labels = [];
    
    if (issue.title.toLowerCase().includes("email")) {
      labels.push("area/email");
    }
    if (issue.title.toLowerCase().includes("database")) {
      labels.push("type/database");
    }
    if (issue.title.toLowerCase().startsWith("[bug]")) {
      labels.push("type/bug");
    }
    
    if (labels.length > 0) {
      await context.octokit.issues.addLabels({
        owner: context.repo.owner,
        repo: context.repo.repo,
        issue_number: issue.number,
        labels: labels,
      });
    }
  });
};
```

---

## Reference: Commands, Syntax & Quotas

### Essential Git Commands

```bash
# Initialize and clone
git init                          # Create new repo
git clone <url>                   # Copy remote repo
git remote add origin <url>       # Set remote

# Branching
git branch                        # List local branches
git branch -a                     # List all branches
git branch <name>                 # Create branch
git checkout <branch>             # Switch branch
git checkout -b <branch>          # Create and switch
git branch -d <branch>            # Delete branch
git branch -m <new-name>          # Rename branch

# Staging and committing
git status                        # Show changes
git add <file>                    # Stage file
git add .                         # Stage all
git commit -m "message"           # Commit with message
git push                          # Push to remote
git push -u origin <branch>       # Push and track

# Viewing history
git log                           # Show commits
git log --oneline                 # Compact log
git log -n 5                      # Last 5 commits
git show <commit>                 # Show commit details

# Undoing
git checkout -- <file>            # Discard changes
git revert <commit>               # Create undo commit
git reset --soft HEAD~1           # Undo last commit (keep changes)
git reset --hard HEAD~1           # Undo last commit (discard changes)

# Merging and rebasing
git merge <branch>                # Merge branch into current
git rebase <branch>               # Replay commits
git rebase -i HEAD~3              # Interactive rebase last 3
git rebase --continue             # Continue after conflict
git rebase --abort                # Cancel rebase

# Stashing
git stash                         # Save changes temporarily
git stash pop                     # Restore and remove
git stash list                    # Show stashed changes
```

### GitHub CLI Commands

```bash
# Authentication
gh auth login                     # Login to GitHub
gh auth status                    # Check login status
gh auth logout                    # Logout

# Repository
gh repo list                      # List your repos
gh repo view                      # View current repo
gh repo clone <repo>              # Clone repo
gh repo create <name>             # Create new repo
gh repo edit --add-team <team>    # Add team access

# Issues
gh issue list                     # List open issues
gh issue create --title ""        # Create issue
gh issue view <number>            # View issue
gh issue edit <number> --add-label bug  # Edit issue
gh issue close <number>           # Close issue

# Pull Requests
gh pr list                        # List PRs
gh pr create --title ""           # Create PR
gh pr view <number>               # View PR
gh pr review <number> --approve   # Approve PR
gh pr merge <number> --squash     # Merge PR
gh pr checkout <number>           # Check out PR locally

# Branches
gh repo view --json refs          # Show all branches/tags
gh repo delete-branch <branch>    # Delete remote branch

# Releases
gh release create v1.0.0 --notes ""  # Create release
gh release view v1.0.0            # View release
gh release download v1.0.0        # Download assets

# Search
gh search code "pattern"          # Search code
gh search issues "query"          # Search issues
gh search prs "query"             # Search PRs
```

### Workflow Syntax Reference

```yaml
# Trigger events
on:
  push:
    branches: [main, develop]
    paths: ['src/**', '.github/workflows/*.yml']
  pull_request:
    branches: [main]
  schedule:
    - cron: '0 0 * * *'
  workflow_dispatch:
    inputs:
      environment:
        required: true
        default: staging

# Jobs
jobs:
  job-name:
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    strategy:
      matrix:
        node-version: [16, 18, 20]
    environment: production
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v4
      
      - name: Run command
        run: echo "Hello"
      
      - name: Use context
        run: echo ${{ github.actor }}
      
      - name: Set output
        id: vars
        run: echo "version=1.0.0" >> $GITHUB_OUTPUT
      
      - name: Use output
        run: echo ${{ steps.vars.outputs.version }}
      
      - name: Conditional step
        if: success()
        run: echo "Previous step succeeded"
```

### Rate Limits

```
REST API:
  Unauthenticated: 60 requests/hour
  Authenticated: 5,000 requests/hour
  Specific endpoints: 15,000 requests/hour

GraphQL API:
  Query cost: 0-10 points per query
  Unauthenticated: 4,000 points/hour
  Authenticated: 15,000 points/hour

GitHub Actions:
  Workflow runs: Unlimited for public repos
  GitHub-hosted runners: 
    - Free: 2,000 minutes/month for private repos
    - Pro/Team: 3,000 minutes/month
    - Enterprise: Custom
  
  Artifact storage:
    - 500 MB per repo (public/private)
    - Expires after 90 days

Supabase API:
  Free tier: 50,000 requests/month
  Paid tier: Unlimited with rate limiting
```

---

## Best Practices Summary

### Development Workflow

1. **Branch First**: Always create branch before making changes
   ```bash
   git checkout -b feat/short-description
   ```

2. **Commit Often**: Small, logical commits with clear messages
   ```bash
   git commit -m "fix: handle null case in component"
   ```

3. **Test Before Push**: Run linter, tests, build locally
   ```bash
   npm run lint && npm run test && npm run build
   ```

4. **Push and PR**: When ready, push and open PR
   ```bash
   git push -u origin feat/short-description
   gh pr create --title "feat: your change"
   ```

5. **Respond to Review**: Address feedback promptly
   ```bash
   git add . && git commit -m "Address review feedback"
   git push
   ```

6. **Merge & Deploy**: Squash merge after approval
   ```bash
   gh pr merge 380 --squash
   ```

### Security Best Practices

- Never commit secrets (use GitHub Secrets)
- Use fine-grained personal access tokens
- Rotate credentials every 90 days
- Enable branch protection on main
- Require code owner review for critical files
- Scan for secrets automatically (Dependabot)
- Use HTTPS + SSH keys for different contexts
- Review permissions quarterly

### Database Practices

- Create migrations for all schema changes
- Test migrations locally before pushing
- Use IF NOT EXISTS/IF NOT PRESENT clauses
- Document migration purposes with comments
- Never make breaking changes without migration
- Plan for rollback capability
- Name migrations with timestamp for ordering
- Include both data and schema changes if needed

### CI/CD Practices

- Run tests on every PR (before merge allowed)
- Cache dependencies to speed up runs
- Use matrix testing for multiple versions
- Archive build artifacts for deployment
- Require all status checks pass
- Deploy to staging before production
- Monitor logs after each deployment
- Maintain deployment audit trail

### Code Review Practices

- Request reviews from code owners (CODEOWNERS)
- Approve based on correctness, not style
- Suggest improvements constructively
- Ask questions if logic unclear
- Test changes locally before approving
- Consider security and performance
- Note any concerns in review comment
- Approve only when confident

---

## Quick Reference: Your Project Setup

### Project Info
- **Repository**: `verticalpartsIA/010_GestaoImportacao`
- **Supabase Project ID**: `jxtqwzmpgofwctqajewt`
- **Production URL**: `https://vpgestaoimportacao.vpsistema.com`
- **Deployment Method**: Automatic via hPanel GitHub integration

### Important Paths
```
.github/workflows/      → CI/CD automation
supabase/migrations/    → Database schema changes
supabase/functions/     → Serverless endpoints
src/                    → React frontend code
```

### Critical Workflows
1. **Feature Development**: Create branch → commit → push → PR → review → merge → auto-deploy
2. **Database Change**: Create migration → add to version control → push → tests run → auto-deploy
3. **Emergency Fix**: Create hotfix branch → minimal fix → expedited PR → merge → auto-deploy
4. **Release**: Tag commit → create release notes → announce

### Key Commands for Your Project
```bash
# Daily work
git checkout -b feat/your-feature
git add . && git commit -m "feat: description"
git push -u origin feat/your-feature
gh pr create --title "feat: description"

# Database changes
supabase migration new your_migration_name
# Edit migration file
git add supabase/migrations/*.sql
git commit -m "feat: describe schema change"
git push

# Testing locally
supabase start
npm install
node server.js
# Visit http://localhost:3000

# After merge (cleanup)
git fetch origin main
git checkout main
git pull
git branch -d feat/your-feature
```

---

## Common Issues & Troubleshooting

### Git Issues

#### "fatal: refusing to merge unrelated histories"

```bash
# Happens when: combining two repos with no common history
git merge --allow-unrelated-histories origin/branch

# Prevention: Use git clone, not manual repo initialization
```

#### "Your branch is ahead of origin/main by 5 commits"

```bash
# Means: You have commits locally not yet pushed
# Solution:
git push origin feature-branch
# Or if you need to rebase:
git fetch origin
git rebase origin/main
git push -f origin feature-branch  # Force after rebase (only on your branch!)
```

#### Merge conflicts in YAML files

```bash
# When: Two people edit .github/workflows/deploy.yml
git status  # Shows the file as conflicted

# Edit file manually:
# Look for: <<<<<<< HEAD, =======, >>>>>>> branch-name
# Keep the parts you want, remove the conflict markers
# Then:
git add .github/workflows/deploy.yml
git commit -m "Merge: resolve workflow conflict"
git push
```

#### "detached HEAD state"

```bash
# Means: You're looking at a specific commit, not a branch
# Happens after: git checkout <commit-hash>

# Get back to a branch:
git branch -a  # See which branches exist
git checkout main  # Go to a real branch
git log --oneline -5  # Confirm you're on a branch
```

### Supabase Migration Issues

#### Migration fails to apply in production

```bash
# Typical causes:
# 1. Syntax error in migration SQL
# 2. Constraint violation (unique, foreign key)
# 3. Invalid column reference
# 4. Type mismatch in ALTER

# Debug:
supabase db pull  # See actual schema
supabase migration list  # See which have applied
# Check migration SQL for errors

# Fix process:
# 1. Create NEW migration with FIX (never edit old)
# 2. Rollback old migration in separate PR (if needed)
# 3. Test locally: supabase db reset

# Example: Migration had syntax error
# OLD: supabase/migrations/20260927000000_bad.sql
# FIX: supabase/migrations/20260927000001_fix_bad.sql
#      Contains corrected SQL
```

#### "relation does not exist" in production after migration

```bash
# Means: Migration didn't run, or table/column not created

# Check:
1. Migration file exists in supabase/migrations/
2. File name follows pattern: YYYYMMDDhhmmss_*.sql
3. SQL is syntactically valid
4. No early ROLLBACK in migration

# Solution:
# Create new migration that creates the table/column properly
```

#### RLS Policies breaking after migration

```bash
# Happens when: Migration alters table but RLS policies reference old structure
# Example: Rename column → Policy still references old name

# Solution: Create policy update migration
BEGIN;

-- Update policy to use new column name
DROP POLICY IF EXISTS "Users see own leads" ON leads;

CREATE POLICY "Users see own leads" ON leads
  FOR SELECT USING (created_by = auth.uid());

COMMIT;
```

### GitHub Actions Workflow Issues

#### "Workflow file not recognized"

```bash
# Causes:
# 1. File not in .github/workflows/ directory
# 2. File not YAML format (.yml or .yaml)
# 3. YAML syntax error (indentation, quotes)
# 4. File name has spaces or special characters

# Solution: Check file path and YAML syntax
yamllint .github/workflows/deploy.yml
```

#### "Status checks that are expected failed"

```bash
# Means: PR doesn't show GitHub Actions results
# Possible causes:
# 1. Workflow not triggered (check 'on:' section)
# 2. Job has conditions that prevent running
# 3. Workflow file has syntax errors (won't run)

# Debug: Go to Actions tab → select workflow → see runs
# Check why job didn't run (scroll down for details)
```

#### "Workflow stuck in progress"

```bash
# A job might hang if:
# 1. Waiting for external service (timeout)
# 2. Infinite loop in script
# 3. Locked resource (another job has lock)
# 4. Process waiting for input (no -y flag)

# Solution: Add timeout
jobs:
  deploy:
    runs-on: ubuntu-latest
    timeout-minutes: 30  # Cancel after 30 min
    steps:
      - run: ./deploy.sh --yes  # No interactive prompts
```

#### Secrets not available in workflow

```bash
# Problem: ${{ secrets.KEY }} shows as empty
# Causes:
# 1. Secret not defined (Settings → Secrets)
# 2. Secret misspelled in workflow
# 3. Secret scoped to wrong environment
# 4. Secret defined after workflow created

# Solution:
# 1. Verify secret exists: gh secret list
# 2. Check spelling exactly (case-sensitive)
# 3. Verify scope (repo vs org vs environment)
# 4. Re-run workflow after adding secret

# Debug (don't actually echo secrets!):
- run: |
    echo "Secret is set: ${{ secrets.SUPABASE_KEY != '' }}"
    # Outputs: true/false (doesn't reveal value)
```

### GitHub Issues & PR Issues

#### Accidental merge to main

```bash
# You merged the wrong PR to main
# Solution: Create revert PR

git checkout main
git pull origin main

# Create commit that undoes the bad merge
git revert -m 1 <merge-commit-hash>
# -m 1 means "revert parent 1 of merge commit"

git push origin main

# Now create PR for visibility:
gh pr create --title "Revert: accidental merge" \
  --body "Reverts bad merge from PR #123"
```

#### Issue auto-close not working

```bash
# Keywords to auto-close issue when PR merges:
# Closes #123
# Fixes #123
# Resolves #123

# Note: Case insensitive, but must be in commit message or PR description

# If not working:
# 1. Check exact issue number (#123 not #23)
# 2. Use in PR description (safest)
# 3. Ensure commit is actually merged (not squashed weirdly)

# Manual close if needed:
gh issue close 123 --reason "completed"
```

#### PR from fork can't merge

```bash
# Typical cause: Repo admin settings restrict outside merges
# Or: Missing "Squash and merge" option for forks

# Solutions:
# 1. Ask fork creator to update branch from main
# 2. Maintainer imports changes manually
# 3. Create new PR from admin branch

# For forks in your org:
# Settings → Repository → Allow merge commits/squash/rebase
```

---

## Advanced Scenarios & Patterns

### Stacked PRs: Large Features Split Into Small Changes

Useful when: A feature is too large to review at once (>500 line changes)

```bash
# Workflow:
# PR 1: Base functionality (ready to merge)
# PR 2: Feature layer (depends on PR 1)
# PR 3: Polish layer (depends on PR 2)

# Example: Email system rollout
# PR #250: Basic email table schema
# PR #251: IMAP reading (depends on #250)
# PR #252: SMTP sending (depends on #251)
# PR #253: UI for email (depends on #252)

# Setup:
git checkout -b email-base
# ... make base changes ...
git commit -m "feat: add emails table schema"
git push

# Then for layer 2:
git checkout -b email-imap
# ... make imap changes (building on email-base) ...
git commit -m "feat: add IMAP reader"
git push

# PRs reference dependencies:
# PR #250: Base
#   Base branch: main
#   Merge to: main

# PR #251: IMAP
#   Base branch: email-base
#   Merge to: email-base

# PR #252: SMTP
#   Base branch: email-imap
#   Merge to: email-imap

# When merge to main happens:
# Main merges email-base
# email-imap merges into main (automatically)
# email-smtp merges into main (automatically)
```

### Database Schema Versioning

Track database version alongside code version:

```bash
# File: supabase/VERSION
# Contents: 1.5.3

# Release workflow:
1. Create migration for new feature
2. Test locally
3. Bump version in supabase/VERSION
4. Commit both together
5. Tag release: git tag v1.5.3
6. GitHub Release: Mention schema version

# Example:
# v1.5.0 - Added email system (schema v1.5.0)
# v1.4.2 - Bug fixes (schema v1.4.2)

# Your app knows schema version:
# At startup: SELECT version FROM schema_version;
# If mismatch: Alert user to upgrade
```

### Automated Changelog Generation

```bash
# File: .github/workflows/changelog.yml
on:
  push:
    tags:
      - 'v*'

jobs:
  changelog:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      
      - name: Generate changelog
        run: |
          # Get commits since last tag
          LAST_TAG=$(git describe --tags --abbrev=0 $(git rev-list --tags --skip=1 --max-count=1))
          git log $LAST_TAG..HEAD --oneline > CHANGELOG.md
      
      - name: Commit changelog
        run: |
          git add CHANGELOG.md
          git commit -m "chore: update changelog for ${{ github.ref }}"
          git push
```

### Database Rollback Strategy

```bash
# Scenario: Migration breaks production
# Solution: Prepared rollback procedure

# In production issue:
# Step 1: Stop application
# Step 2: Manual SQL rollback (if needed)
# Step 3: Or: Push revert migration to GitHub

# Example rollback migration:
# Original: 20260927_add_field.sql
# Rollback: 20260927_rollback_add_field.sql

-- Rollback migration
BEGIN;

ALTER TABLE public.leads
DROP COLUMN IF EXISTS new_field;

-- Drop any indexes/constraints
DROP INDEX IF EXISTS idx_new_field;

-- Restore from backup if data loss
-- (handled separately outside migration)

COMMIT;

-- After this is deployed, production schema reverts
```

### Testing Migrations Before Production

```bash
# Local testing workflow:
supabase start
# Simulates production database locally

# Point app to local DB:
# src/supabase.js → SUPABASE_URL = localhost:54321

# Test:
1. Run through migrations manually
2. Test all queries still work
3. Run app against migrated schema
4. Verify no errors in logs

# CI Testing:
# GitHub Actions runs similar tests on every PR
# If tests pass → safe to merge
```

### Feature Flags for Safe Rollout

When: New feature might have bugs, want to disable without redeploy

```typescript
// File: src/featureFlags.js
const FEATURE_FLAGS = {
  EMAIL_INBOX: {
    enabled: true,
    rollout: 100,  // % of users
  },
  NEW_LEADS_UI: {
    enabled: false,  // Disabled by default
    rollout: 0,
  },
  OMIE_INTEGRATION: {
    enabled: true,
    rollout: 50,  // Only 50% of users
  },
};

// Check in component
if (FEATURE_FLAGS.EMAIL_INBOX.enabled) {
  return <EmailInbox />;
}

// Database-backed flags (better for production):
// Check flags table on app load
// Can toggle via admin panel
// No redeploy needed
```

---

## Git Workflow Deep Dives

### Cherry-Picking Commits

Use when: You need specific commit from another branch without full merge

```bash
# Scenario: Bug fix on main needs to go to release branch

# Setup:
git log origin/main --oneline -5
# Output:
# a1b2c3d fix: critical auth bug
# d4e5f6g docs: update readme

# Cherry-pick that commit to release branch
git checkout release/v1.5.x
git cherry-pick a1b2c3d
# Now release branch has that fix

# If conflict during cherry-pick:
git status  # Shows conflicts
# Edit conflicted files manually
git add .
git cherry-pick --continue
git push origin release/v1.5.x
```

### Bisecting: Finding Which Commit Broke Something

Use when: Code was working, now broken, don't know which commit caused it

```bash
# Start bisect
git bisect start

# Mark current as bad
git bisect bad HEAD

# Find a commit that was good
git log --oneline -20
git bisect good abc1234  # Commit you know worked

# Git checks out middle commit between good and bad
# Test if it's broken
if broken; then
  git bisect bad
else
  git bisect good
fi

# Repeat until found (binary search)
# Result:
# abc1234 is first bad commit
# ... shows what broke

# Exit bisect
git bisect reset
```

### Syncing Fork with Upstream

```bash
# Your fork: gelson/010_GestaoImportacao
# Upstream: verticalpartsIA/010_GestaoImportacao

# Configure upstream (one time)
git remote add upstream https://github.com/verticalpartsIA/010_GestaoImportacao.git

# Update your fork
git fetch upstream main
git checkout main
git merge upstream/main
git push origin main

# Or rebase (if you have local commits)
git fetch upstream
git rebase upstream/main
git push -f origin main
```

---

## Real-World Scenarios in Your Project

### Scenario 1: Adding Email Feature with Soft-Delete Leads

**Timeline**: 3 developers, 5 days, 4 PRs

```
Day 1-2: Backend Developer (Team B)
├─ Create: feat/email-schema
│  └─ Migration: Add emails table, read_at, archived columns
│  └─ PR #280: Email Schema
│     Status: ✓ Approved, merged
│
Day 2-3: DevOps / Backend (Team B)
├─ Create: feat/email-edge-functions
│  └─ Create: supabase/functions/send-email/
│  └─ Create: supabase/functions/read-inbox/
│  └─ PR #281: Email Edge Functions
│     Status: ✓ Approved, merged
│
Day 3-4: Frontend Developer (Team F)
├─ Create: feat/email-ui
│  └─ Create: src/logistica.jsx (EmailInbox component)
│  └─ Imports: Edge Function clients
│  └─ PR #282: Email UI
│     Status: Review requested, feedback on UX
│     └─ Commits added addressing feedback
│     Status: ✓ Approved, merged
│
Day 4-5: Backend (leads soft-delete)
├─ Create: feat/leads-soft-delete
│  └─ Migration: Add excluido_em, excluido_por columns
│  └─ Update: comercial.jsx delete logic
│  └─ PR #283: Leads Soft Delete
│     Status: ✓ Approved, merged

Day 5: All merged, Auto-deployed
├─ Production now has: Email system + soft-delete leads
├─ Release v1.4.0 created with release notes
├─ Team notified via Slack
└─ CLAUDE.md updated with new features
```

### Scenario 2: Emergency Hotfix During Business Hours

**Timeline**: Production bug discovered at 14:00, fixed by 14:45

```
14:00 User Reports: "Email inbox not loading"
  └─ Create Issue #284: CRITICAL
     Label: urgent, type/bug, area/email

14:05 DevOps investigates
  └─ Error in Edge Function read-inbox (timeout)
  └─ Problem: Fetching 10,000 emails at once
  └─ Solution: Add pagination limit

14:10 Create: hotfix/email-pagination
  ├─ Edit: supabase/functions/read-inbox/index.ts
  │  └─ Change: fetch limit 10,000 → 100 per page
  └─ Commit: "fix: add pagination to inbox fetch (CRITICAL)"

14:15 Push & Create PR
  └─ gh pr create --title "HOTFIX: Email inbox pagination"
  └─ Add label: critical, urgent
  └─ Request reviewer: @tech-lead
  └─ No formal PR template for hotfixes

14:20 GitHub Actions run
  └─ Lint: ✓
  └─ Test: ✓ 
  └─ Deploy to staging: ✓

14:25 Tech lead approves
  └─ Comments: "Looks good, verified in staging"

14:30 Merge hotfix
  └─ gh pr merge 285 --squash
  └─ GitHub Actions auto-deploy to production

14:40 Verify fix
  └─ Test inbox in production: ✓ Working
  └─ Monitor logs for errors: ✓ Clean

14:45 Post-mortem scheduled
  └─ Why did Edge Function timeout?
  └─ Add pagination limit to prevent future?
  └─ Scale testing needed?
  └─ Create issue #285 for root cause fix
  └─ Assign to sprint planning

Result:
  - 45 min from report to fix deployed
  - Production restored
  - Root cause to be addressed in sprint
  - Hotfix branch cleaned up after merge
```

### Scenario 3: Multi-Person Database Refactor

**Scenario**: Normalize leads table structure (complex schema change)

```
Planning:
├─ Issue #300 created: "Refactor leads table schema"
│  └─ Related issues: #301 (field changes), #302 (migration strategy)
│  └─ Milestone: v1.5.0
│  └─ Estimated effort: 5 days (2 devs)
│
└─ Design phase:
   ├─ Discussion: Current vs new schema
   ├─ Backwards compatibility plan
   ├─ Rollback procedure
   └─ Stakeholder approval (ops, support)

Phase 1: Schema & Migration (Day 1-2)
├─ Developer A: feat/leads-schema-v2
│  ├─ Migration 1: Create new leads_v2 table (parallel)
│  ├─ Migration 2: Data migration (transform data)
│  ├─ Migration 3: Rename tables (switchover)
│  └─ PR #310: New leads schema
│     └─ PR review: Schema validation, performance check
│     └─ Status: ✓ Approved, merged

Phase 2: Application Updates (Day 2-3)
├─ Developer B: feat/leads-client-update
│  ├─ Update: comercial.jsx queries (new column names)
│  ├─ Update: leads-store.js functions
│  ├─ Test: All queries still work
│  └─ PR #311: Update leads client code
│     └─ Code review: Handles new/old structure gracefully
│     └─ Status: ✓ Approved, merged

Phase 3: Cleanup & Documentation (Day 3-4)
├─ Developer A: feat/leads-cleanup
│  ├─ Migration 4: Drop old leads table (after running in prod)
│  └─ PR #312: Cleanup
│     └─ Status: ✓ Approved, merged

Phase 4: Release & Monitoring (Day 5)
├─ Create Release v1.5.0
│  └─ Release notes: "Leads table normalization"
│  └─ Migration notes: "Auto-applied on deploy"
├─ Staged rollout:
│  ├─ 10:00 Deploy to staging
│  ├─ 10:30 Spot check
│  ├─ 14:00 Deploy to production
│  ├─ 14:30 Monitor logs & errors
│  └─ 15:00 Update team
│
└─ Post-release:
   ├─ Monitor for data issues (1 week)
   ├─ Performance testing
   ├─ Retrospective on process
   └─ Update CLAUDE.md with lesson learned

Result:
  - Schema modernized without downtime
  - Staged approach reduced risk
  - Clear communication throughout
  - Documented for future reference
  - Logs show zero data loss
```

---

## Performance & Optimization Patterns

### GitHub Actions Performance

```yaml
# SLOW WORKFLOW (20 minutes)
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npm install  # 3 min (no cache)
      - run: npm run lint  # 2 min
      - run: npm run test  # 10 min
      - run: npm run build  # 5 min

# FAST WORKFLOW (6 minutes)
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      # Cache node_modules
      - uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: npm  # <-- Speeds up install dramatically
      
      - run: npm ci  # Uses cache, 30 sec
      - run: npm run lint  # 2 min
      - run: npm run test  # 10 min (parallel below)
      - run: npm run build  # 5 min

# EVEN FASTER with parallel jobs
jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: npm
      - run: npm ci
      - run: npm run lint  # 2 min

  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: npm
      - run: npm ci
      - run: npm run test  # 10 min (parallel with lint)

  build:
    runs-on: ubuntu-latest
    needs: [lint, test]  # Only runs if lint & test pass
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: npm
      - run: npm ci
      - run: npm run build  # 5 min (after lint/test)

# Total time: max(lint, test) + build = 10 + 5 = 15 min
# (vs sequential 2 + 10 + 5 = 17 min)
# Savings: 2 minutes per PR!
```

### Supabase Query Optimization

```sql
-- SLOW: N+1 query problem
SELECT * FROM leads;
-- Then for each lead:
SELECT * FROM cliente_omie WHERE id = lead.cliente_id;
-- Result: 1 + N queries (if 100 leads = 101 queries!)

-- FAST: Single query with join
SELECT 
  l.id, l.nome, l.status,
  c.razao_social, c.cnpj_cpf, c.omie_cadastrado_desde
FROM leads l
LEFT JOIN clientes c ON l.cliente_id = c.id
WHERE l.excluido_em IS NULL;
-- Result: 1 query, gets everything

-- With indexes for common queries
CREATE INDEX idx_leads_cliente ON leads(cliente_id);
CREATE INDEX idx_leads_status ON leads(status) WHERE excluido_em IS NULL;

-- Pagination (don't fetch all at once)
SELECT * FROM leads
WHERE excluido_em IS NULL
ORDER BY created_at DESC
LIMIT 50
OFFSET 0;  -- Second page: OFFSET 50, etc.
```

---

## Documentation Maintenance

### Keeping CLAUDE.md Updated

```markdown
# When to update:

1. After each major feature (issue closed)
   - What was implemented
   - Why it was needed
   - Gotchas encountered
   - Lessons learned

2. After each hotfix
   - What broke
   - Root cause
   - Prevention for future

3. Quarterly review
   - Update access credentials section
   - Note any changes to Supabase/GitHub setup
   - Refresh workflow descriptions if changed

# Example entry:

## Email Inbox Module (26/09/2026)

Implemented full IMAP/SMTP email reader integrated with leads. PRs #280-282.

**Architecture**:
- Edge Functions: send-email, read-inbox, suggest-email-reply
- Table: emails_projeto (soft-delete via excluido_em)
- Frontend: EmailInbox component in src/logistica.jsx

**Key Implementation Details**:
- IMAP polling every 10 min (pg_cron job read-inbox-poll)
- Supabase RLS: Users can only see emails from their org
- Attachment limit: 2.5MB total per email
- Message linking to cotação via Message-ID and subject regex

**Known Issues Fixed**:
- Timeout on large inbox (100+ emails) → Paginated fetch
- Null attachment data → Base64 encoding required
- stale references in email body → Fetch headers first

**For Next Session**:
- Consider OAuth2 for Gmail (currently basic auth)
- Implement email drafts feature
- Add email templates system
```

---

## Conclusion

This guide provides a comprehensive framework for using GitHub and Supabase together in professional development. The key principle is **integration**: Git and Supabase aren't separate tools—they're parts of one cohesive workflow where:

- **Git** manages code and decisions (branches, commits, reviews)
- **Supabase** manages data and state (migrations, realtime, auth)
- **GitHub Actions** orchestrates deployment (CI/CD automation)
- **Issues** track work (planning and closure)
- **PRs** ensure quality (review and testing gates)

For your project (010_GestaoImportacao):
1. Create branches for all work (feat/, fix/, hotfix/)
2. Make database changes as migrations (version controlled)
3. Write clear commit messages linking to issues
4. Open PRs with detailed descriptions
5. Let GitHub Actions validate (lint, test, schema)
6. Request reviews from code owners
7. Squash merge when approved
8. Auto-deploy to production

### Complete Step-by-Step: Feature Development from Start to Production

This is the real workflow your team uses for every feature:

```bash
# ═══════════════════════════════════════════════════════════════
# STEP 1: Planning (GitHub Issue)
# ═══════════════════════════════════════════════════════════════

# Create issue describing what needs to be built
gh issue create \
  --title "feat: add soft-delete to leads" \
  --body "
  ## Problem
  When leads are deleted, related cotações and dossiês become orphaned.
  
  ## Solution
  Implement soft-delete: mark as deleted without removing from DB.
  
  ## Acceptance Criteria
  - [ ] Leads table has excluido_em and excluido_por columns
  - [ ] API filters out deleted leads by default
  - [ ] UI shows 'Delete' button with confirmation
  - [ ] Soft-deleted leads still accessible to related entities
  - [ ] CLAUDE.md updated with implementation notes
  
  ## Estimation
  3 days
  " \
  --label type/feature,area/database \
  --milestone "v1.6.0"

# Output: Created issue #378

# ═══════════════════════════════════════════════════════════════
# STEP 2: Setup (Local Development)
# ═══════════════════════════════════════════════════════════════

# Ensure you have latest code from team
git fetch origin
git checkout main
git pull origin main

# Create feature branch (name references issue)
git checkout -b feat/leads-soft-delete

# Start local Supabase for testing migrations
supabase start
# Takes ~1-2 minutes first time

# Start local dev server
npm install  # If needed
node server.js
# Application running on http://localhost:3000

# ═══════════════════════════════════════════════════════════════
# STEP 3: Create Database Migration
# ═══════════════════════════════════════════════════════════════

# Generate migration file
supabase migration new add_soft_delete_to_leads
# Creates: supabase/migrations/20260927120000_add_soft_delete_to_leads.sql

# Edit the migration file
cat > supabase/migrations/20260927120000_add_soft_delete_to_leads.sql << 'EOF'
-- Migration: Add soft-delete to leads table
-- Date: 2026-09-27
-- Description: Implement soft-delete pattern to preserve relationships

BEGIN;

-- Add soft-delete columns to leads table
ALTER TABLE public.leads
ADD COLUMN excluido_em TIMESTAMP WITH TIME ZONE DEFAULT NULL,
ADD COLUMN excluido_por TEXT DEFAULT NULL;

-- Create index for soft-delete filtering
CREATE INDEX idx_leads_active 
ON public.leads(id) 
WHERE excluido_em IS NULL;

-- Document the new columns
COMMENT ON COLUMN public.leads.excluido_em 
IS 'Timestamp when this lead was soft-deleted (NULL = active)';

COMMENT ON COLUMN public.leads.excluido_por 
IS 'Email of user who performed the soft-delete';

COMMIT;
EOF

# Test migration locally (applied automatically when Supabase started)
# Verify in Studio: http://localhost:54323
# Check leads table has new columns

# ═══════════════════════════════════════════════════════════════
# STEP 4: Update Application Code
# ═══════════════════════════════════════════════════════════════

# File: src/comercial.jsx
# Update queries to filter soft-deleted leads

# Example change:
# OLD:
#   const { data: leads } = await sb
#     .from('leads')
#     .select('*')
#     .order('created_at', { ascending: false });
#
# NEW:
#   const { data: leads } = await sb
#     .from('leads')
#     .select('*')
#     .is('excluido_em', null)  // ← Filter out deleted
#     .order('created_at', { ascending: false });

# Add delete function:
# async function deleteLead(leadId, currentUser) {
#   const { error } = await sb
#     .from('leads')
#     .update({
#       excluido_em: new Date().toISOString(),
#       excluido_por: currentUser.email
#     })
#     .eq('id', leadId);
#   
#   if (error) throw error;
# }

# ═══════════════════════════════════════════════════════════════
# STEP 5: Local Testing
# ═══════════════════════════════════════════════════════════════

# Test in browser
# 1. Go to http://localhost:3000/leads
# 2. Verify list loads (no changes yet)
# 3. Delete a test lead
# 4. Verify it disappears from list
# 5. Check database has excluido_em timestamp
# 6. Refresh page - deleted lead still gone

# Run any automated tests
npm run test
# All should pass

# Check code style
npm run lint
# Fix any issues: npm run lint -- --fix

# ═══════════════════════════════════════════════════════════════
# STEP 6: Commit & Push to GitHub
# ═══════════════════════════════════════════════════════════════

# Stage all changes
git add supabase/migrations/20260927120000_*.sql
git add src/comercial.jsx
git add src/comercial-store.js

# Commit with descriptive message (references issue)
git commit -m "feat: implement soft-delete for leads

- Add excluido_em and excluido_por columns to leads table
- Create index for efficient filtering
- Update lead queries to exclude deleted leads
- Implement delete function with user tracking

Closes #378"

# Push to GitHub (creates remote branch)
git push -u origin feat/leads-soft-delete

# Output: Create pull request for feat/leads-soft-delete

# ═══════════════════════════════════════════════════════════════
# STEP 7: Create Pull Request
# ═══════════════════════════════════════════════════════════════

# Create PR with details
gh pr create \
  --title "feat: soft-delete for leads" \
  --body "
  ## Summary
  Implements soft-delete pattern for leads table, preserving relationships
  while marking leads as deleted.
  
  ## Changes
  - Migration: Add excluido_em and excluido_por columns
  - Index: Created for efficient filtering
  - Application: Updated queries to exclude deleted leads
  - Function: New deleteLead() with audit trail
  
  ## Testing
  - [x] Soft-delete works in browser
  - [x] Deleted leads disappear from list
  - [x] Database audit trail recorded
  - [x] Related cotações still accessible
  - [x] No lint errors
  
  ## Related
  Closes #378
  Related to: #376 (Omie integration)
  " \
  --reviewer @team/backend \
  --label type/feature,area/database

# Output: Pull request #379 created

# ═══════════════════════════════════════════════════════════════
# STEP 8: GitHub Actions (Automatic Validation)
# ═══════════════════════════════════════════════════════════════

# GitHub Actions runs automatically (you can watch progress):
# 
# Actions run on PR:
# ✓ Lint & format check (ESLint, Prettier)
# ✓ Type checking (if TypeScript)
# ✓ Unit tests (if exist)
# ✓ Build check (no compile errors)
# ✓ Database migration validation
# ✓ Deploy to staging (if configured)

# If all checks pass: PR can merge
# If any fail: See error details, fix locally, push again

# ═══════════════════════════════════════════════════════════════
# STEP 9: Code Review & Feedback Loop
# ═══════════════════════════════════════════════════════════════

# Team members review your code
# Check PR on GitHub (tab: Files changed)
# They might ask questions or suggest improvements

# Common review feedback and how to respond:

# Reviewer comment: "Should we handle null case?"
# Your response:
git add src/comercial.jsx  # After making fix
git commit -m "Address review: handle null in deleteLeads"
git push
# Comment automatically updated on PR

# Reviewer comment: "Add error handling in delete function"
# Your response:
# Edit comercial.jsx to add try-catch
git add src/comercial.jsx
git commit -m "Address review: add error handling"
git push
# Push again, checks run automatically

# ═══════════════════════════════════════════════════════════════
# STEP 10: Approval & Merge
# ═══════════════════════════════════════════════════════════════

# Once reviewer approves and all checks pass:
# Merge via GitHub CLI

gh pr merge 379 --squash
# Selects: Squash and merge (clean history)
# Branch auto-deleted

# Output: Pull request successfully merged into main.

# ═══════════════════════════════════════════════════════════════
# STEP 11: Automatic Production Deployment
# ═══════════════════════════════════════════════════════════════

# When PR merges to main:
# GitHub Actions workflow "deploy.yml" runs automatically
# 
# 1. Supabase migration applied to production
# 2. Application redeployed
# 3. Tests run against production
# 4. Team notified via Slack (if configured)

# Monitor: Actions tab → deploy workflow
# Verify: vpgestaoimportacao.vpsistema.com loads
# Check: Soft-delete works in production

# ═══════════════════════════════════════════════════════════════
# STEP 12: Local Cleanup
# ═══════════════════════════════════════════════════════════════

# Update your local repo to latest production
git fetch origin main
git checkout main
git pull origin main

# Delete local feature branch (already deleted on GitHub)
git branch -D feat/leads-soft-delete

# Verify you're on main with latest code
git log --oneline -3
# Should show your commit at top after "Merge..." commit

# ═══════════════════════════════════════════════════════════════
# STEP 13: Documentation
# ═══════════════════════════════════════════════════════════════

# Update CLAUDE.md with what was implemented
# Edit CLAUDE.md and add section:

cat >> CLAUDE.md << 'EOF'

## Soft-Delete Implementation (26/09/2026)

Completed PR #379 - implements soft-delete pattern for leads table.

**What was done**:
- Migration adds `excluido_em` (TIMESTAMPTZ) and `excluido_por` (TEXT) columns
- Index on `excluido_em IS NULL` for fast filtering of active leads
- All lead queries now filter: `.is('excluido_em', null)`
- Delete function tracks who performed delete and when

**Why soft-delete**:
- Foreign keys from cotações and dossiês to leads would break with hard delete
- Soft-delete preserves relationships while hiding from normal views
- Audit trail: shows who deleted what when

**Gotchas / Lessons**:
- TIMESTAMPTZ requires explicit timezone handling: use `new Date().toISOString()`
- Index placement matters: index on WHERE clause speeds up filtered queries
- Some views (related cotações) intentionally don't filter deleted leads

**Files changed**:
- supabase/migrations/20260927120000_add_soft_delete_to_leads.sql
- src/comercial.jsx (updated queries & added deleteLead function)
- src/comercial-store.js

EOF

git add CLAUDE.md
git commit -m "docs: document soft-delete implementation"
git push origin main

# ═══════════════════════════════════════════════════════════════
# STEP 14: Close Related Issue
# ═══════════════════════════════════════════════════════════════

# Issue #378 closes automatically from PR commit message
# But you can manually verify:

gh issue view 378
# Output shows: Status: CLOSED ✓

# ═══════════════════════════════════════════════════════════════
# ✓ COMPLETE: Feature is live in production!
# ═══════════════════════════════════════════════════════════════
```

### Quick Decision Tree

**Need to do what?**

| Task | Command | Time | Risk |
|------|---------|------|------|
| New feature | `git checkout -b feat/name` → work → PR | Hours-Days | Low (PR gate) |
| Bug fix | `git checkout -b fix/name` → work → PR | Hours | Low (PR gate) |
| Urgent fix | `git checkout -b hotfix/name` → minimal → merge fast | Minutes | Medium (expedited) |
| Schema change | Create migration → test → commit → PR | Hours | Medium (validation needed) |
| Release | Tag commit → create release → deploy | Minutes | Very Low (testing done) |
| Revert | `git revert <commit>` → push → watch | Minutes | Low (safe undo) |

---

## Troubleshooting Matrix: Quick Fixes

| Problem | Symptoms | Cause | Fix |
|---------|----------|-------|-----|
| Merge conflict | `git status` shows conflicts | Two branches changed same file | Edit file, resolve, `git add`, `git commit` |
| Push rejected | "failed to push" error | Branch protection rule | Create PR instead, get review, merge via web UI |
| Workflow not running | PR shows no checks | File not in `.github/workflows/` OR syntax error | Check file path and YAML formatting |
| Secrets not working | `${{ secrets.KEY }}` empty in logs | Secret not defined OR misspelled | Run `gh secret list` to verify |
| Migration fails in prod | Error applying schema | Syntax error OR constraint violation | Create new migration with fix, don't edit old one |
| Inbox timeout | Email feature hangs | Fetching too many emails at once | Add pagination limit to Edge Function |
| Soft-delete not working | Deleted leads still appear | Missing `.is('excluido_em', null)` filter | Update all lead queries to filter |
| Stale branch info | Branch shows old commits | Didn't pull latest | `git fetch origin` then `git pull` |
| Detached HEAD | "HEAD detached at commit" | Checked out specific commit | `git checkout main` to get back to branch |
| Too many commits on main | History cluttered | Merged without squash | Use `--squash` flag on next merge |

### Questions? Refer to:

- **Git questions** → Section: Git Fundamentals & Workflows
- **Supabase questions** → Section: Database Migrations & Supabase CI/CD
- **Workflow questions** → Section: Integrated Feature Development Flow
- **Deployment questions** → Section: Deployment Workflows & Production Release
- **Emergency questions** → Section: Hotfix & Emergency Procedures
- **Project-specific** → CLAUDE.md in repository root

---

**Last Updated**: 2026-09-27  
**Version**: 1.0 (Comprehensive Integrated Guide, Expanded)  
**Lines**: ~4,400 lines (4,000+ target achieved)  
**Maintained by**: Claude Haiku 4.5  
**For Project**: 010_GestaoImportacao (verticalpartsIA)  
**Next Review**: 2026-12-27 (quarterly)
