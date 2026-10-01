# 🔧 Instruções para Resolver Erros - VP Gestão Módulo Comercial/Leads

**Status:** 🔴 Faça  
**Prioridade:** Média (3 erros ALTA bloqueiam funcionalidade)  
**Arquivo Principal:** `src/comercial.jsx`  
**Criado em:** 2026-09-26

---

## 📋 Resumo Executivo

Sessão anterior identificou **10 erros** + **1 nova funcionalidade** em `src/comercial.jsx`:

| Tipo | Qtd | Descrição |
|------|-----|-----------|
| 🔴 **ALTA** | 4 | Erros críticos que travam a página |
| 🟡 **MÉDIA** | 5 | Lógica incorreta que exibe dados errados |
| 🔵 **BAIXA** | 2 | Informações incompletas |
| 🆕 **NOVA** | 1 | Busca no Omie ao inserir CNPJ |

**Documento de análise completo:**  
👉 https://claude.ai/artifact/UUF1zBwwjrz9rVQraQKH87

---

## 🔴 ERROS ALTA — RESOLVER PRIMEIRO

Estes erros **travam** a funcionalidade. Resolver em ordem.

### ⚠️ E01 – EnderecoAPI sem verificação de carregamento

**Localização:** `src/comercial.jsx` — função `ModalNovoLead`, método `buscarCnpj()` (linhas 56, 59, 76, 77)

**Código atual (ERRADO):**
```javascript
// Linha 56
if (!window.EnderecoAPI?.isCnpjValido(f.cnpj)) return ...

// Linha 59 — ERRO: sem ?.
const dados = await window.EnderecoAPI.buscarCNPJ(f.cnpj);
```

**Impacto:** Se o módulo EnderecoAPI não carregar, validação falha silenciosamente ou quebra a página.

**Solução:**
```javascript
const buscarCnpj = async () => {
  // 1. Verificar se módulo existe
  if (!window.EnderecoAPI) {
    return window.toast('Módulo de endereço indisponível. Tente novamente.', 'error');
  }
  
  // 2. Validar CNPJ
  if (!window.EnderecoAPI.isCnpjValido(f.cnpj)) {
    return window.toast('CNPJ inválido — informe 14 dígitos.', 'warning');
  }
  
  setBuscandoCnpj(true);
  try {
    const dados = await window.EnderecoAPI.buscarCNPJ(f.cnpj);
    setF(p => ({ 
      ...p, 
      razaoSocial: dados.razao_social || p.razaoSocial, 
      phone: p.phone || dados.telefone || p.phone 
    }));
    window.toast('Dados do CNPJ preenchidos automaticamente.', 'success');
  } catch (e) {
    window.toast('Erro ao buscar CNPJ: ' + e.message, 'warning');
  } finally {
    setBuscandoCnpj(false);
  }
};
```

---

### ⚠️ E02 – FormularioElevadorStore sem optional chaining

**Localização:** `src/comercial.jsx` — função `ModalNovoLead`, bloco de salvar cliente (linha 115)

**Código atual (ERRADO):**
```javascript
// Linha 115 — sem ?.
const cliente = await window.FormularioElevadorStore.buscarOuCriarCliente({
  // payload
});
```

**Impacto:** Se FormularioElevadorStore não carregar, erro não tratado e modal trava ao salvar.

**Solução:**
```javascript
// Adicionar verificação ANTES de usar
if (!window.FormularioElevadorStore?.buscarOuCriarCliente) {
  throw new Error('Módulo FormularioElevadorStore não disponível');
}

const cliente = await window.FormularioElevadorStore.buscarOuCriarCliente({
  [f.tipoPessoa === 'PF' ? 'cpf' : 'cnpj']: docDigits, 
  tipo_pessoa: f.tipoPessoa,
  razao_social: f.razaoSocial || f.building,
  contato: f.contact, 
  telefone: f.phone || null, 
  email: f.email || null,
  clienteIdProvisorio: isEdit ? (lead.cliente_id || null) : null,
});
```

---

### ⚠️ E03 – Supabase sem verificação antes de usar

**Localização:** `src/comercial.jsx` — função `LeadsPage`, método `reloadLeads()` (linha 300)

**Código atual (ERRADO):**
```javascript
const reloadLeads = () => {
  window.__VP_SB.sb.from('leads').select('*')  // ← PODE QUEBRAR
    .order('date', { ascending: false })
    .then(({ data }) => setLeads(data || []));
};
```

**Impacto:** Se Supabase não carregar, página trava indefinidamente em estado de carregamento. Usuário vê apenas o spinner.

**Solução:**
```javascript
const reloadLeads = () => {
  // 1. Verificar se Supabase está disponível
  if (!window.__VP_SB?.sb) {
    window.toast('Falha ao conectar com banco de dados', 'error');
    setLeads([]); // exibir "Nenhum lead" em vez de travar
    return;
  }

  // 2. Fazer a busca com tratamento de erro
  window.__VP_SB.sb
    .from('leads')
    .select('*')
    .order('date', { ascending: false })
    .then(({ data, error }) => {
      if (error) {
        window.toast('Erro ao carregar leads: ' + error.message, 'error');
        setLeads([]);
      } else {
        setLeads(data || []);
      }
    })
    .catch((e) => {
      window.toast('Erro de conexão: ' + e.message, 'error');
      setLeads([]);
    });
};
```

**Nota:** Aplicar o mesmo padrão em OUTRAS linhas que usam `window.__VP_SB`:
- Linha 509 (LeadDetail — carregamento de histórico)
- Linha 534 (LeadDetail — verificação de dossier existente)
- Linha 94 (ModalNovoLead — update leads)

**Padrão recomendado:**
```javascript
if (!window.__VP_SB?.sb) {
  window.toast('Banco de dados indisponível', 'error');
  return;
}
// ... resto do código
```

---

### ⚠️ E11 – Race condition em hooks do LeadDetail

**Localização:** `src/comercial.jsx` — componente `LeadDetail`, hook de cliente (linhas 479-485)

**Problema:** Quando usuário navega rapidamente entre leads, a promise anterior ainda está pendente, exibindo dados do lead anterior.

**Código atual (ERRADO):**
```javascript
// Linhas 479-485
const [cliente, setCliente] = React.useState(undefined); // undefined = carregando
React.useEffect(() => {
  let alive = true;
  if (!lead.cliente_id) { setCliente(null); return; }
  // Promise pode ficar pendente de lead anterior
  window.CadastrosClientesStore?.obter(lead.cliente_id).then((c) => { if (alive) setCliente(c || null); });
  return () => { alive = false; };
}, [lead.cliente_id]);
```

**Impacto:** 
- Usuário muda de Lead A (com cliente) → Lead B (sem cliente)
- Exibe cliente A enquanto deveria mostrar "Sem cliente (CNPJ)"
- Estado fica inconsistente entre componentes

**Solução:**
```javascript
const [cliente, setCliente] = React.useState(null); // Começar null, não undefined
React.useEffect(() => {
  let alive = true;
  
  // IMPORTANTE: Reset imediato quando lead muda
  setCliente(null); // ← Limpar estado ANTES de buscar novo
  
  if (!lead.cliente_id) { 
    return; // Sair após limpar
  }
  
  window.CadastrosClientesStore?.obter(lead.cliente_id)
    .then((c) => { 
      if (alive) setCliente(c || null); 
    })
    .catch((e) => {
      console.warn('Erro ao carregar cliente:', e);
      if (alive) setCliente(null); // Limpar se erro
    });
  
  return () => { alive = false; };
}, [lead.cliente_id]);
```

**Nota técnica:** O `alive` flag só funciona corretamente se o estado for resetado ANTES de fazer a promise. Isso evita que a promise anterior de um lead diferente sobrescreva o estado.

---

## 🟡 ERROS MÉDIA — RESOLVER APÓS ALTA

Estes erros não travam, mas exibem dados **incorretos** ou **incompletos**.

### E04 – Prioridade com case inconsistente

**Localização:** `src/comercial.jsx` — componente `LeadsPage`, renderização de tabela (linhas 424-426)

**Problema:** Código mistura `toLowerCase()` com comparação direta:
```javascript
// Linha 424 — com toLowerCase
String(l.priority).toLowerCase() === "alta" ? "danger" :
String(l.priority).toLowerCase() === "media" ||
l.priority === "Média"  // ← SEM toLowerCase (ERRO!)
? "warning" : "neutral"
```

**Impacto:** Badge exibe cor incorreta se dados vêm com case misto (ex.: "ALTA", "Média", "média").

**Solução — Normalizar tudo:**
```javascript
// NO LUGAR DAS LINHAS 424-426:
const priorityKey = String(l.priority || '').toLowerCase();
const variantMap = {
  'alta': 'danger',
  'media': 'warning',
  'baixa': 'neutral',
};
<Badge variant={variantMap[priorityKey] || 'neutral'} style={{ marginTop: 4 }}>
  {({ alta: "Alta", media: "Média", baixa: "Baixa" }[priorityKey] || "—")}
</Badge>
```

**Aplicar em DOIS lugares:**
1. Linha 424-426 (LeadsPage — table)
2. Linha 581-582 (LeadDetail — page head)

---

### E05 – Null-safety: cliente.cnpj quando cliente = null

**Localização:** `src/comercial.jsx` — componente `LeadDetail`, subtitle (linha 577)

**Código atual:**
```javascript
<p className="page-head__sub">
  {cliente ? `${cliente.razao_social}${cliente.cnpj ? ' · ' + ...` :
    lead.equip || 'Sem cliente...'}
</p>
```

**Impacto:** Se cliente é null, interpolação falha silenciosamente ou exibe "undefined".

**Solução:**
```javascript
<p className="page-head__sub">
  {cliente 
    ? `${cliente.razao_social || '—'}${
        cliente.cnpj 
          ? ' · ' + (window.cadFmtDoc ? window.cadFmtDoc(cliente.cnpj) : cliente.cnpj)
          : ''
      }`
    : 'Sem cliente (CNPJ) vinculado ainda'}
</p>
```

---

### E06 – Promises sem tratamento de erro de rede/timeout

**Localização:** `src/comercial.jsx` — linhas 42, 115, 483

**Problema:** Promises não têm `.catch()`:
```javascript
// Linha 42
window.CadastrosClientesStore?.obter(lead.cliente_id).then((c) => { ... });
// Sem .catch() — timeout fica indefinidamente "carregando"
```

**Impacto:** Se houver erro de rede ou timeout, estado fica "carregando" para sempre.

**Solução — Adicionar `.catch()` em TODOS os `.then()`:**
```javascript
React.useEffect(() => {
  let alive = true;
  if (!lead.cliente_id) { 
    setCliente(null); 
    return; 
  }
  
  window.CadastrosClientesStore?.obter(lead.cliente_id)
    .then((c) => { 
      if (alive) setCliente(c || null); 
    })
    .catch((e) => {
      console.warn('Erro ao carregar cliente:', e);
      if (alive) {
        setCliente(null); // sair do estado "carregando"
        window.toast?.('Erro ao carregar dados do cliente', 'warning');
      }
    });
  
  return () => { alive = false; };
}, [lead.cliente_id]);
```

**Locais para aplicar:**
- Linha 42: useEffect de cliente em ModalNovoLead
- Linha 483: useEffect de cliente em LeadDetail
- Qualquer outro `.then()` sem `.catch()`

---

### E07 – stylesByStatus[status] pode retornar undefined

**Localização:** `src/comercial.jsx` — componente `SuggestedStep` (linha 712)

**Código atual:**
```javascript
const stylesByStatus = {
  current: { background: "#FFFBE6", borderColor: "var(--vp-yellow)" },
  next:    { background: "#fff", borderColor: "var(--border-strong)" },
  future:  { background: "var(--vp-gray-50)", borderColor: "var(--border)", opacity: .7 },
};

return (
  <div style={{
    display: "flex", 
    ...stylesByStatus[status]  // ← ERRO se status inválido
  }}>
```

**Impacto:** Se `status` não é "current", "next" ou "future", spread de undefined falha.

**Solução:**
```javascript
const stylesByStatus = {
  current: { background: "#FFFBE6", borderColor: "var(--vp-yellow)" },
  next:    { background: "#fff", borderColor: "var(--border-strong)" },
  future:  { background: "var(--vp-gray-50)", borderColor: "var(--border)", opacity: .7 },
};

// Usar default 'future' se status for inválido
const styles = stylesByStatus[status] || stylesByStatus.future;

return (
  <div style={{
    display: "flex", 
    alignItems: "center", 
    gap: 12,
    padding: "12px 14px",
    border: "1px solid var(--border)",
    ...styles  // ← seguro
  }}>
    {/* conteúdo */}
  </div>
);
```

---

### E10 – Padrão inconsistente de verificação

**Localização:** `src/comercial.jsx` — linhas 94, 115, 300, 509, 534, 553

**Problema:** Código mistura dois padrões de verificação:
```javascript
// Padrão A (correto): linha 509
const sb = window.__VP_SB && window.__VP_SB.sb;

// Padrão B (sem verificação): linha 300
window.__VP_SB.sb.from(...) // ← pode quebrar
```

**Impacto:** Código difícil de manter; erros podem ser mascarados.

**Solução — Padronizar todo o arquivo com optional chaining:**
```javascript
// SEMPRE usar este padrão:
if (!window.__VP_SB?.sb) {
  window.toast('Banco de dados indisponível', 'error');
  return;
}

// Depois usar normalmente
const { data } = await window.__VP_SB.sb.from('leads').select('*');
```

**Substituir todas as ocorrências:**
- Linha 94: ModalNovoLead update
- Linha 300: LeadsPage reloadLeads
- Linha 509: LeadDetail history
- Linha 534: LeadDetail dossier check
- Linha 553: LeadDetail criarDossier

---

## 🔵 ERROS BAIXA — RESOLVER ÚLTIMO

Informações incompletas. Usuário não é impactado criticamente, mas experiência melhora.

### E08 – "Última atualização" nunca preenchida

**Localização:** `src/comercial.jsx` — componente `LeadDetail`, page head (linha 584)

**Código atual:**
```javascript
<span className="muted small">Última atualização: —</span>
```

**Solução:**
Verificar se existe coluna `updated_at` em `leads` no Supabase. Se sim:
```javascript
<span className="muted small">
  Última atualização: {fmtDate(lead.updated_at || lead.date)}
</span>
```

Se não existe, usar o histórico já carregado:
```javascript
const ultimaAtualização = history?.[0]?.ts || lead.date;
<span className="muted small">
  Última atualização: {fmtDate(ultimaAtualização)}
</span>
```

---

### E09 – PAGE_SIZE hardcoded (Opcional)

**Localização:** `src/comercial.jsx` — LeadsPage (linha 291)

**Atual:** `const PAGE_SIZE = 15;` (fixo)

**Solução (opcional):**
```javascript
const [pageSize, setPageSize] = React.useState(15);
const PAGE_SIZE = pageSize;

// Na toolbar (onde estão os filtros), adicionar seletor:
<select 
  className="input" 
  style={{ width: 160, height: 28, fontSize: 12 }} 
  value={pageSize} 
  onChange={(e) => { 
    setPageSize(Number(e.target.value)); 
    setPage(0); // reset para primeira página
  }}
>
  <option value={10}>10 por página</option>
  <option value={15}>15 por página</option>
  <option value={25}>25 por página</option>
  <option value={50}>50 por página</option>
</select>
```

---

## 🆕 NOVA FUNCIONALIDADE: Busca no Omie

**Status:** 🔴 Faça (após resolver erros ALTA/MÉDIA)  
**Prioridade:** Média  
**Localização:** `src/comercial.jsx` — `ModalNovoLead`, função `buscarCnpj()` (linha ~55)

### 📌 Requisito

Quando o usuário inserir um CNPJ e clicar "Buscar CNPJ":

1. **Primeira busca:** No ERP **Omie** (via MCP)
2. **Se encontrar:** Exibir `✓ Cliente cadastrado desde dd/mm/aaaa`
3. **Se não encontrar:** Prosseguir com API de endereço (EnderecoAPI)
4. **Exibir status:** Campo visual mostrando status do cliente no Omie

### 📝 Implementação

#### Passo 1: Adicionar estados

```javascript
const [statusOmie, setStatusOmie] = React.useState(null); 
// null = não verificado
// { encontrado: true, data_cadastro: '2026-09-26', razao_social: 'Empresa XYZ' }
// { encontrado: false }

const [buscandoOmie, setBuscandoOmie] = React.useState(false);
```

#### Passo 2: Modificar `buscarCnpj()`

```javascript
const buscarCnpj = async () => {
  // Verificação básica
  if (!window.EnderecoAPI) {
    return window.toast('Módulo de endereço indisponível.', 'error');
  }
  if (!window.EnderecoAPI.isCnpjValido(f.cnpj)) {
    return window.toast('CNPJ inválido — informe 14 dígitos.', 'warning');
  }

  setBuscandoOmie(true);
  setStatusOmie(null);

  try {
    // 1️⃣ BUSCAR NO OMIE PRIMEIRO
    const cnpjDigits = (f.cnpj || '').replace(/\D/g, '');
    
    // Chamar MCP Omie (ajustar nome do método conforme seu store)
    const clienteOmie = await window.OmieClientesStore?.buscarPorCnpj(cnpjDigits);
    
    if (clienteOmie) {
      // Cliente encontrado no Omie ✓
      const dataCadastro = new Date(
        clienteOmie.data_cadastro || 
        clienteOmie.created_at || 
        clienteOmie.date_created
      );
      
      setStatusOmie({
        encontrado: true,
        data_cadastro: dataCadastro.toLocaleDateString('pt-BR'),
        razao_social: clienteOmie.razao_social || clienteOmie.nome,
      });
      
      // Preencher campos com dados do Omie
      setF(p => ({
        ...p,
        razaoSocial: clienteOmie.razao_social || clienteOmie.nome || p.razaoSocial,
        phone: p.phone || clienteOmie.telefone || p.phone,
        email: p.email || clienteOmie.email || p.email,
      }));
      
      window.toast('✓ Cliente encontrado no ERP Omie!', 'success');
      setBuscandoOmie(false);
      return; // PARAR AQUI — não buscar na API de endereço
    }

    // 2️⃣ SENÃO, BUSCAR NA API DE ENDEREÇO
    const dados = await window.EnderecoAPI.buscarCNPJ(f.cnpj);
    
    setF(p => ({
      ...p,
      razaoSocial: dados.razao_social || p.razaoSocial,
      phone: p.phone || dados.telefone || p.phone,
    }));
    
    setStatusOmie({ encontrado: false });
    window.toast('Dados do CNPJ preenchidos via API de Endereço.', 'success');

  } catch (e) {
    window.toast('Erro ao buscar CNPJ: ' + e.message, 'warning');
    setStatusOmie({ encontrado: false });
  } finally {
    setBuscandoOmie(false);
  }
};
```

#### Passo 3: Exibir status na tela

**Localização:** Na seção "Cliente (CNPJ/CPF)" (linha ~224), APÓS o botão "Buscar CNPJ":

```javascript
{/* Status do Omie */}
{statusOmie && (
  <div style={{
    background: statusOmie.encontrado ? '#ecfdf5' : '#f0f9ff',
    border: '1px solid ' + (statusOmie.encontrado ? '#10b981' : '#3b82f6'),
    padding: '12px 14px',
    borderRadius: '6px',
    fontSize: '13px',
    marginTop: '8px',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  }}>
    {statusOmie.encontrado ? (
      <>
        <span style={{ color: '#059669', fontSize: '16px' }}>✓</span>
        <div>
          <div style={{ fontWeight: 600, color: '#059669' }}>Cliente cadastrado no ERP</div>
          <div style={{ color: '#6b7280', fontSize: '12px', marginTop: '2px' }}>
            Desde {statusOmie.data_cadastro} · {statusOmie.razao_social}
          </div>
        </div>
      </>
    ) : (
      <>
        <span style={{ color: '#0284c7', fontSize: '16px' }}>ℹ</span>
        <div>
          <div style={{ color: '#0284c7', fontWeight: 600 }}>Não encontrado no ERP</div>
          <div style={{ color: '#6b7280', fontSize: '12px', marginTop: '2px' }}>
            Usando dados da API de Endereço
          </div>
        </div>
      </>
    )}
  </div>
)}
```

---

### 🔧 Notas Técnicas

**MCP Omie:**
- Projeto já tem `window.OmieClientesStore` ou similar
- Confirmar **nome do método**: `buscarPorCnpj()`, `searchByCNPJ()`, `obter()`, etc.
- Confirmar **estrutura da resposta**: quais campos retorna
  - `razao_social` (ou `nome`)
  - `data_cadastro` (ou `created_at`, `date_created`)
  - `telefone` (ou `phone`)
  - `email`

**Formatação de data:**
- Usar `toLocaleDateString('pt-BR')` para formato `dd/mm/aaaa`
- Se disponível, usar `fmtDate()` do projeto

**Chamada ao Omie:**
```javascript
// Exemplo (ajustar conforme seu store):
const cliente = await window.OmieClientesStore?.buscarPorCnpj('12345678000190');
// Retorna: { razao_social, data_cadastro, telefone, email, ... }
```

---

## ✅ Checklist de Resolução

**Erros ALTA (CRÍTICO):**
- [ ] E01 – EnderecoAPI verificação
- [ ] E02 – FormularioElevadorStore verificação
- [ ] E03 – Supabase verificação + .catch() em 5 locais
- [ ] E11 – Race condition em hooks LeadDetail

**Erros MÉDIA (IMPORTANTE):**
- [ ] E04 – Prioridade case normalização (2 locais)
- [ ] E05 – Cliente null-safety
- [ ] E06 – Promises .catch() (3+ locais)
- [ ] E07 – stylesByStatus default
- [ ] E10 – Padronizar Supabase check (5 locais)

**Erros BAIXA (NICE-TO-HAVE):**
- [ ] E08 – "Última atualização" preenchimento
- [ ] E09 – PAGE_SIZE seletor (opcional)

**Nova Funcionalidade:**
- [ ] Omie busca ao inserir CNPJ
- [ ] Exibir "Cliente cadastrado desde dd/mm/aaaa"
- [ ] Fallback para API de endereço se não encontrar

**Testes:**
- [ ] E01: Desabilitar EnderecoAPI → exibir toast erro
- [ ] E03: Desabilitar Supabase → exibir mensagem clara, não travar
- [ ] E04: Lead com priority="ALTA" → badge vermelho
- [ ] E11: Navegar rapidamente Lead A (com cliente) → Lead B (sem cliente) → deve exibir "Sem cliente", não cliente A
- [ ] Omie: CNPJ válido do Omie → exibir "✓ Cliente cadastrado desde 26/09/2026"
- [ ] Omie: CNPJ novo → exibir "ℹ Não encontrado no ERP"

**Git Commits:**
- [ ] Commit 1: Resolver E01 + E02 + E03 ("fix: adicionar verificações de módulos carregados")
- [ ] Commit 2: Resolver E04 + E05 + E06 ("fix: null-safety e tratamento de erros")
- [ ] Commit 3: Resolver E07 + E10 ("fix: validação de estilos e padronização Supabase")
- [ ] Commit 4: Resolver E08 + E09 ("improvement: preencher última atualização e paginação flexível")
- [ ] Commit 5: Nova funcionalidade Omie ("feat: busca de cliente no Omie ao inserir CNPJ")

---

## 📌 Cache-busting

**IMPORTANTE:** Se modificar `src/comercial.jsx`, incrementar o `?v=` em `index.html`:

```html
<!-- Procurar por esta linha em index.html: -->
<script src="/src/comercial.jsx?v=N"></script>

<!-- E aumentar N, exemplo: -->
<script src="/src/comercial.jsx?v=2"></script> <!-- se era v=1 -->
```

Caso contrário, usuários em produção continuarão vendo a versão antiga (cache do navegador).

---

## 📚 Referências

- **Repositório:** github.com/verticalpartsIA/010_GestaoImportacao
- **Análise completa:** https://claude.ai/artifact/UUF1zBwwjrz9rVQraQKH87
- **Arquivo:** `src/comercial.jsx` (~770 linhas)
- **Componentes:** `ModalNovoLead`, `LeadsPage`, `LeadDetail`, `FormulariosPage`

---

**Status:** 🔴 **FAÇA**  
**Criado em:** 2026-09-26  
**Próxima etapa:** Criar PR com todos os fixes + nova funcionalidade
