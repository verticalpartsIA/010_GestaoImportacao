# 🎯 PROJETO: CRM VERTICALPARTS — CAPTURA + ESTRUTURA + OMIE

**Status:** Planejamento (Aguardando "Faça")  
**Data:** 26 de setembro de 2026  
**Versão:** 1.0

---

## 📊 FLUXOGRAMA

```
SITE VERTICALPARTS.COM.BR (Formulário Elementor)
                    │
                    ▼ (webhook POST)
         ┌──────────────────────┐
         │  EDGE FUNCTION       │
         │ capturar-lead-       │
         │ verticalparts        │
         └─────────┬────────────┘
                   │
         ┌─────────┴──────────┐
         │                    │
         ▼                    ▼
    SUPABASE         RD STATION
    (leads)          (paralelo)
         │
         ▼
    OMIE CRM
   (oportunidade)
         │
         ▼
   ┌─────────────────────────┐
   │  CRM PRÓPRIO (NOVO)     │
   │ ├─ Dashboard Kanban     │
   │ ├─ Histórico            │
   │ ├─ WhatsApp integrado   │
   │ └─ Funis customizáveis  │
   └─────────────────────────┘
         │ (2–4 semanas)
         ▼
    CANCELAR RD STATION
```

---

## 📋 FASES

### **FASE 1: Captura (1 dia)**
- 2h: Webhook Elementor
- 4h: Integração Omie
- 3h: Testes
- **Total:** 9h = 1 dia

### **FASE 2: CRM Próprio (~11 dias)**
- 3h: Estrutura Supabase
- 40h: UI Kanban
- 15h: Histórico
- 10h: Automações
- 10h: Testes
- **Total:** 88h = 11 dias

### **FASE 3: WhatsApp (1 dia)**
- 3h: Capturar clique
- 5h: Integrar CRM
- 2h: Testes
- **Total:** 10h = 1 dia

### **FASE 4: Validação (2 semanas)**
- Monitorar RD vs CRM
- Backup + Cancelar

---

## ⏰ SLA

| Tarefa | SLA |
|--------|-----|
| Webhook | 2h |
| Omie | 4h |
| Testes/Deploy | 3h |
| Supabase | 3h |
| Kanban | 40h |
| Histórico | 15h |
| Automações | 10h |
| WhatsApp | 10h |
| Monitoramento | 5min/dia × 14 dias |
| **TOTAL** | **~115h (5-6 sem)** |

---

## 🔧 SCRIPT 1: Edge Function

**Arquivo:** `supabase/functions/capturar-lead-verticalparts/index.ts`

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL");
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const sb = createClient(supabaseUrl, supabaseKey);

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const payload = await req.json();
    const { form_fields } = payload;

    const nome = form_fields?.name || "";
    const email = form_fields?.email || "";
    const telefone = form_fields?.phone || "";
    const cnpj = form_fields?.cnpj_cpf || "";
    const empresa = form_fields?.company || "";

    // 1. Criar lead em Supabase
    const { data: lead } = await sb
      .from("leads")
      .upsert({
        contact: nome,
        email: email,
        phone: telefone,
        building: empresa,
        origin: "Site verticalparts.com.br",
        status: "Em qualificação",
        priority: "Média",
      }, { onConflict: "email" })
      .select()
      .single();

    // 2. Log atividade
    await sb.from("crm_leads_atividades").insert({
      lead_id: lead.id,
      tipo: "contato_site",
      descricao: `Contato via site verticalparts.com.br`,
      criado_em: new Date().toISOString(),
    });

    // 3. Enviar Omie
    await fetch("https://app.omie.com.br/api/v1/oportunidades/IncluirOportunidade", {
      method: "POST",
      body: JSON.stringify({
        call: "IncluirOportunidade",
        app_key: Deno.env.get("OMIE_APP_KEY"),
        app_secret: Deno.env.get("OMIE_APP_SECRET"),
        param: [{
          oportunidade_titulo: `${nome} - ${new Date().toLocaleDateString("pt-BR")}`,
          oportunidade_estágio: "A Qualificar",
          oportunidade_valor_total: 0,
        }],
      }),
    });

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
```

---

## 🔧 SCRIPT 2: SQL (Criar Tabelas)

```sql
CREATE TABLE crm_leads_atividades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  tipo VARCHAR(50),
  descricao TEXT,
  criado_em TIMESTAMP DEFAULT NOW()
);

CREATE TABLE crm_kanban_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome VARCHAR(100) UNIQUE,
  estágios JSONB
);

INSERT INTO crm_kanban_config (nome, estágios) VALUES
('Elevador', '[
  {"ordem": 1, "nome": "Lead", "cor": "#95a5a6"},
  {"ordem": 2, "nome": "Qualificação", "cor": "#3498db"},
  {"ordem": 3, "nome": "Proposta", "cor": "#f39c12"},
  {"ordem": 4, "nome": "Fechado", "cor": "#27ae60"}
]'::jsonb);
```

---

## 📝 PASSO A PASSO

### **Passo 1: Deploy Edge Function (2h)**
```bash
mkdir -p supabase/functions/capturar-lead-verticalparts
# Copiar SCRIPT 1 acima
supabase functions deploy capturar-lead-verticalparts
# Copiar URL gerada (https://xxxxx.supabase.co/functions/v1/capturar-lead-verticalparts)
```

### **Passo 2: Configurar Elementor (0.5h)**
1. wp-admin → Páginas → Contato → Editar com Elementor
2. Formulário → Ações após envio
3. Adicionar ação: Webhook
4. URL: `[da Passo 1]`
5. Testar com 1 submissão

### **Passo 3: Criar Tabelas Supabase (1h)**
```bash
# supabase web console → SQL Editor
# Copiar SCRIPT 2 acima
```

### **Passo 4: Criar CRM UI (40h+)**
```bash
# Criar src/crm-kanban.jsx
# Implementar Kanban drag & drop
# Implementar histórico/notas
# Testes
```

### **Passo 5: WhatsApp (10h)**
```bash
# Capturar clique do site
# Registrar em crm_leads_atividades
# Notificar gestor
```

### **Passo 6: Validação (14 dias)**
- Monitorar: Supabase + Omie + RD Station
- Backup RD
- Cancelar

---

## ✅ CHECKLIST

- [ ] Branch: `feat/crm-verticalparts`
- [ ] Passo 1–2: Edge Function + Elementor
- [ ] 10 testes manuais OK
- [ ] Passo 3: Tabelas criadas
- [ ] Passo 4: Kanban funcional
- [ ] Passo 5: WhatsApp OK
- [ ] 2 semanas validação
- [ ] Cancelar RD Station

---

**Pronto para "Faça"!**
