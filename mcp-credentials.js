/**
 * ========================================
 * MCP CREDENTIALS SERVER - VERTICALPARTS
 * ========================================
 *
 * Servidor MCP para Claude Code acessar credenciais
 * de forma segura e automatizada.
 */

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config({ path: path.join(process.cwd(), '.env') });

export const tools = [
  {
    name: 'get_credential',
    description: 'Retorna credenciais de login para um serviço (URL, login, senha)',
    inputSchema: {
      type: 'object',
      properties: {
        service: {
          type: 'string',
          description: 'Nome do serviço',
          enum: ['hostinger', 'github', 'github_escamax', 'wordpress', 'supabase_gelson', 'supabase_giovanna', 'lovable', 'gmail_vp', 'safecube', 'rdstation']
        }
      },
      required: ['service']
    }
  },
  {
    name: 'get_supabase_project',
    description: 'Retorna URLs e chaves de um projeto Supabase',
    inputSchema: {
      type: 'object',
      properties: {
        project_name: {
          type: 'string',
          enum: ['vpprd', 'vpsistema', 'vprequisicoes', 'posvenda', 'vpclick', 'propostas', 'escamaxcompravp']
        }
      },
      required: ['project_name']
    }
  },
  {
    name: 'get_vps_access',
    description: 'Retorna credenciais para acessar VPS via SSH',
    inputSchema: {
      type: 'object',
      properties: {
        server: {
          type: 'string',
          enum: ['primary', 'secondary']
        }
      },
      required: ['server']
    }
  },
  {
    name: 'get_api_key',
    description: 'Retorna chave de API para serviço externo',
    inputSchema: {
      type: 'object',
      properties: {
        api_name: {
          type: 'string',
          enum: ['omie', 'anthropic', 'gemini', 'openai', 'openrouter']
        }
      },
      required: ['api_name']
    }
  },
  {
    name: 'list_services',
    description: 'Lista todos os serviços disponíveis',
    inputSchema: {
      type: 'object',
      properties: {
        category: {
          type: 'string',
          enum: ['logins', 'supabase', 'vps', 'apis', 'all']
        }
      }
    }
  }
];

function getCredential({ service }) {
  const credentials = {
    hostinger: {
      url: process.env.HOSTINGER_URL,
      login: process.env.HOSTINGER_LOGIN,
      password: process.env.HOSTINGER_PASSWORD
    },
    github: {
      url: process.env.GITHUB_URL,
      login: process.env.GITHUB_LOGIN,
      password: process.env.GITHUB_PASSWORD,
      token: process.env.GITHUB_TOKEN
    },
    github_escamax: {
      url: process.env.GITHUB_ESCAMAX_URL,
      login: process.env.GITHUB_ESCAMAX_LOGIN,
      password: process.env.GITHUB_ESCAMAX_PASSWORD
    },
    wordpress: {
      url: process.env.WORDPRESS_URL,
      login: process.env.WORDPRESS_LOGIN,
      password: process.env.WORDPRESS_PASSWORD
    },
    supabase_gelson: {
      url: process.env.SUPABASE_GELSON_URL,
      login: process.env.SUPABASE_GELSON_LOGIN,
      password: process.env.SUPABASE_GELSON_PASSWORD
    },
    supabase_giovanna: {
      url: process.env.SUPABASE_GIOVANNA_URL,
      login: process.env.SUPABASE_GIOVANNA_LOGIN,
      password: process.env.SUPABASE_GIOVANNA_PASSWORD
    },
    lovable: {
      url: process.env.LOVABLE_URL,
      login: process.env.LOVABLE_LOGIN,
      password: process.env.LOVABLE_PASSWORD
    },
    gmail_vp: {
      url: process.env.GMAIL_VP_URL,
      login: process.env.GMAIL_VP_LOGIN,
      password: process.env.GMAIL_VP_PASSWORD
    },
    safecube: {
      url: process.env.SAFECUBE_URL,
      login: process.env.SAFECUBE_LOGIN,
      password: process.env.SAFECUBE_PASSWORD,
      token: process.env.SAFECUBE_TOKEN
    },
    rdstation: {
      url: process.env.RDSTATION_URL,
      login: process.env.RDSTATION_LOGIN,
      password: process.env.RDSTATION_PASSWORD
    }
  };
  return credentials[service] || { error: `Serviço "${service}" não encontrado` };
}

function getSupabaseProject({ project_name }) {
  const projects = {
    vpprd: {
      name: 'VPPRD (Cotação de Importação)',
      project_id: process.env.VPPRD_PROJECT_ID,
      url: process.env.VPPRD_URL,
      anon_key: process.env.VPPRD_ANON_KEY,
      service_role: process.env.VPPRD_SERVICE_ROLE
    },
    vpsistema: {
      name: 'VP Sistema (Portal Central)',
      project_id: process.env.VPSISTEMA_PROJECT_ID,
      url: process.env.VPSISTEMA_URL,
      anon_key: process.env.VPSISTEMA_ANON_KEY,
      service_role: process.env.VPSISTEMA_SERVICE_ROLE
    },
    vprequisicoes: {
      name: 'VP Requisições Pro',
      project_id: process.env.VPREQUISICOES_PROJECT_ID,
      url: process.env.VPREQUISICOES_URL,
      anon_key: process.env.VPREQUISICOES_ANON_KEY,
      service_role: process.env.VPREQUISICOES_SERVICE_ROLE
    },
    posvenda: {
      name: 'VP Pós-Venda 360',
      project_id: process.env.POSVENDA_PROJECT_ID,
      url: process.env.POSVENDA_URL,
      anon_key: process.env.POSVENDA_ANON_KEY,
      service_role: process.env.POSVENDA_SERVICE_ROLE
    },
    vpclick: {
      name: 'VP Click',
      project_id: process.env.VPCLICK_PROJECT_ID,
      url: process.env.VPCLICK_URL,
      service_role: process.env.VPCLICK_SERVICE_ROLE
    },
    propostas: {
      name: 'Propostas Comerciais',
      project_id: process.env.PROPOSTAS_PROJECT_ID,
      url: process.env.PROPOSTAS_URL,
      anon_key: process.env.PROPOSTAS_ANON_KEY,
      service_role: process.env.PROPOSTAS_SERVICE_ROLE
    },
    escamaxcompravp: {
      name: 'Escamax Compra VP',
      project_id: process.env.ESCAMAXCOMPRAVP_PROJECT_ID,
      url: process.env.ESCAMAXCOMPRAVP_URL,
      anon_key: process.env.ESCAMAXCOMPRAVP_ANON_KEY,
      service_role: process.env.ESCAMAXCOMPRAVP_SERVICE_ROLE
    }
  };
  return projects[project_name] || { error: `Projeto "${project_name}" não encontrado` };
}

function getVpsAccess({ server }) {
  const servers = {
    primary: {
      ip: process.env.VPS_PRIMARY_IP,
      user: process.env.VPS_PRIMARY_USER,
      password: process.env.VPS_PRIMARY_PASSWORD,
      ssh_command: process.env.VPS_PRIMARY_SSH_COMMAND,
      port: '22'
    },
    secondary: {
      ip: process.env.VPS_SECONDARY_IP,
      port: process.env.VPS_SECONDARY_PORT,
      user: process.env.VPS_SECONDARY_USER,
      password: process.env.VPS_SECONDARY_PASSWORD,
      ssh_command: process.env.VPS_SECONDARY_SSH_COMMAND
    }
  };
  return servers[server] || { error: `Servidor "${server}" não encontrado` };
}

function getApiKey({ api_name }) {
  const keys = {
    omie: {
      token: process.env.OMIE_TOKEN,
      key: process.env.OMIE_KEY
    },
    anthropic: {
      api_key: process.env.ANTHROPIC_API_KEY
    },
    gemini: {
      api_key: process.env.GEMINI_API_KEY,
      model: process.env.GEMINI_MODEL
    },
    openai: {
      api_key: process.env.OPENAI_API_KEY
    },
    openrouter: {
      api_key: process.env.OPENROUTER_API_KEY
    }
  };
  return keys[api_name] || { error: `API "${api_name}" não encontrada` };
}

function listServices({ category = 'all' }) {
  const services = {
    logins: ['hostinger', 'github', 'wordpress', 'supabase_gelson', 'supabase_giovanna', 'lovable', 'gmail_vp', 'safecube', 'rdstation'],
    supabase: ['vpprd', 'vpsistema', 'vprequisicoes', 'posvenda', 'vpclick', 'propostas', 'escamaxcompravp'],
    vps: ['primary', 'secondary'],
    apis: ['omie', 'anthropic', 'gemini', 'openai', 'openrouter']
  };
  return category === 'all' ? services : { [category]: services[category] || [] };
}

export function handleToolCall(toolName, toolInput) {
  switch (toolName) {
    case 'get_credential':
      return getCredential(toolInput);
    case 'get_supabase_project':
      return getSupabaseProject(toolInput);
    case 'get_vps_access':
      return getVpsAccess(toolInput);
    case 'get_api_key':
      return getApiKey(toolInput);
    case 'list_services':
      return listServices(toolInput);
    default:
      return { error: `Ferramenta "${toolName}" não encontrada` };
  }
}

export default { tools, handleToolCall };
