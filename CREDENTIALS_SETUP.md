# 🔐 Sistema de Credenciais - Gestão de Importação

**Status:** ✅ Instalado e pronto para usar  
**Data:** 05/09/2026  
**Localização:** `/010_GestaoImportacao`

---

## 📦 O que foi instalado?

### 1. `.env` (164 linhas)
- Todas as credenciais consolidadas
- Logins, APIs, Supabase, VPS, webhooks
- **NUNCA fazer commit** (já está no .gitignore)

### 2. `mcp-credentials.js` (8KB)
- Servidor MCP que Claude Code pode chamar
- 5 ferramentas disponíveis:
  - `get_credential(service)` → retorna login/senha
  - `get_supabase_project(project_name)` → retorna URLs e chaves
  - `get_vps_access(server)` → retorna SSH credentials
  - `get_api_key(api_name)` → retorna chaves de API
  - `list_services(category)` → lista serviços

### 3. `dotenv` (npm)
- Instalado: `dotenv@17.4.2`
- Necessário para carregar `.env` em Node.js

---

## 🚀 COMO USAR COM CLAUDE CODE

### Padrão 1: Acessar WordPress
```
Claude Code: "Entre no WordPress usando as credenciais salvas 
e mostre quantos posts há publicados"
```

### Padrão 2: Acessar Supabase
```
Claude Code: "Conecte ao projeto Supabase 'vpsistema' 
e liste os usuários da tabela 'users'"
```

### Padrão 3: SSH ao VPS
```
Claude Code: "Conecte ao servidor VPS principal e verifique 
o espaço em disco com 'df -h'"
```

### Padrão 4: Consultar API
```
Claude Code: "Use a chave API do Omie salva e liste os clientes"
```

---

## ⚙️ CONFIGURAÇÃO NO CLAUDE CODE

Para que Claude Code consiga chamar as ferramentas MCP:

**Opção 1: Variáveis de Ambiente**
```bash
# No seu .claude/config.json ou equivalente:
export NODE_PATH=/sessions/rcw-01xsmp16wbtvq3sym9gztbpq/mnt/010_GestaoImportacao/node_modules
```

**Opção 2: Registrar MCP**
```json
// .claude/mcp-servers.json
{
  "mcpServers": {
    "vp-credentials": {
      "command": "node",
      "args": ["./mcp-credentials.js"]
    }
  }
}
```

---

## 📋 SERVIÇOS DISPONÍVEIS

### Logins (get_credential)
- `hostinger`, `github`, `github_escamax`, `wordpress`
- `supabase_gelson`, `supabase_giovanna`
- `lovable`, `gmail_vp`, `safecube`, `rdstation`

### Supabase Projects (get_supabase_project)
- `vpprd`, `vpsistema`, `vprequisicoes`, `posvenda`
- `vpclick`, `propostas`, `escamaxcompravp`

### VPS (get_vps_access)
- `primary` (SSH principal)
- `secondary` (SSH com porta customizada)

### APIs (get_api_key)
- `omie`, `anthropic`, `gemini`, `openai`, `openrouter`

---

## 🔒 SEGURANÇA

✅ `.env` está no `.gitignore` — não será commitado  
✅ Credenciais abstradas no MCP — Claude Code não vê senhas direto  
✅ Organizado por projeto — fácil atualizar quando necessário  

---

## 📝 PRÓXIMOS PASSOS

1. Teste simples:
   ```
   Claude Code: "Mostre-me os serviços disponíveis"
   ```

2. Teste com login:
   ```
   Claude Code: "Entre no WordPress e verifique o dashboard"
   ```

3. Automação:
   ```
   Claude Code: "Crie um script que verifica logins de todos os sites"
   ```

---

**Criado:** 05/09/2026  
**Mantido por:** Gelson  
**Versão:** 1.0.0
