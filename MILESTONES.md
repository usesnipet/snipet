# 🎯 Snipet Milestones

Documentação das milestones do projeto Snipet com descrições de cada release e funcionalidades implementadas.

## 📦 Versão 0.1.0 ✅ CLOSED

**Status:** Concluída  
**Data de Conclusão:** 15 de Outubro de 2026

### Descrição
Foundação do sistema de plugins e provedores de LLM. Esta milestone estabeleceu a estrutura base para extensibilidade do projeto.

### Issues Implementadas
- **#6** - Add more json plugins template - Adicionou templates JSON para facilitar criação de plugins
- **#11** - Add more llm providers - Integrou múltiplos provedores de LLM (OpenAI, Claude, etc)
- **#12** - Improve llm provider structure to be similar to plugins - Refatorou estrutura de provedores para ser consistente com o sistema de plugins

### Principais Features
✅ Sistema de plugins estruturado  
✅ Múltiplos provedores de LLM  
✅ Templates reutilizáveis para novos plugins

---

## 📦 Versão 0.2.0 ✅ CLOSED

**Status:** Concluída  
**Data de Conclusão:** 16 de Outubro de 2026

### Descrição
Introdução do sistema de debug, configurações e ferramentas de monitoramento para execução de agentes. Esta foi uma milestone focada em observabilidade e facilidades de desenvolvimento.

### Issues Implementadas
- **#14** - Add Debug for agents - Sistema completo de debug para agentes (PARENT ISSUE)
  - **#16** - At the beginning of generation, report that this session is in debug mode
  - **#19** - Add Debug mode on settings
  - **#20** - Add debugger for agent runs and store data on storage
- **#18** - Add settings module for key value configurations - Sistema de configurações persistentes
- **#21** - Add anonymous login support for widget - Autenticação anônima para widget
- **#24** - Add library for use widget in web frameworks - Biblioteca para integração em web frameworks

### Principais Features
✅ Debug completo para execução de agentes  
✅ Sistema de settings com armazenamento persistente  
✅ Modo debug em tempo real  
✅ Widget integrável em diferentes frameworks web  
✅ Suporte a login anônimo para widget  
✅ Armazenamento de dados de execução para análise

---

## 📦 Versão 0.2.1 ✅ CLOSED

**Status:** Concluída  
**Data de Conclusão:** 19 de Outubro de 2026

### Descrição
Patch release focada em melhorias no processo de release e automação.

### Issues Implementadas
- **#27** - Release: skip npm packages already published - Otimizou pipeline de release para evitar re-publicação de pacotes já publicados

### Principais Features
✅ Pipeline de release mais eficiente  
✅ Prevenção de re-publicação de pacotes

---

## 📦 Versão 0.2.2 ✅ CLOSED

**Status:** Concluída  
**Data de Conclusão:** 19 de Outubro de 2026

### Descrição
Documentação e refatoração de features para simplificar e separar responsabilidades do projeto.

### Issues Implementadas
- **#28** - Docs: Add readme to apps and packages - Documentação comprehensive para todos os apps e packages
- **#29** - Feat: remove knowledge from project to simplify and separate features - Remoção do módulo de knowledge para simplificar a arquitetura

### Principais Features
✅ Documentação completa de apps e packages  
✅ Arquitetura simplificada (remoção de knowledge)  
✅ Separação mais clara de responsabilidades

---

## 📦 Versão 0.3.0 🚀 OPEN (EM DESENVOLVIMENTO)

**Status:** Em Desenvolvimento  
**Objetivo:** Expandir capacidades do agente com novos comandos e integrações

### Issues em Progresso
- **#22** - Feat: Add a cost monitoring - Sistema de monitoramento de custos de API
- **#30** - Fix: check allowed origins on run with app token - [BUG FIX] Correção de validação de origens permitidas
- **#33** - Feat: add mcp instructions to agent context - Integração de instruções MCP diretamente no contexto do agente
- **#39** - Docs: Add site app with landing page and docs of project - Documentação e landing page do projeto

### Objetivos
🎯 Sistema de cost monitoring para rastrear gastos com LLMs  
🎯 Suporte expandido para MCP (Model Context Protocol)  
🎯 Documentação pública e landing page  
🎯 Melhorias de segurança (CORS)

### Sub-tasks em Andamento (Issue #34 - Feat: add commands to agent)
- **#35** - Feat: add support for claude skills and other ai agents
- **#36** - Feat: add support for mcp server prompts
- **#37** - Feat: add support for internal builtin commands
- **#38** - Feat: add snipet owner command pattern

---

## 📊 Resumo de Progresso

| Milestone | Status | Issues | Progresso |
|-----------|--------|---------|-----------|
| 0.1.0 | ✅ | 3/3 | 100% |
| 0.2.0 | ✅ | 7/7 | 100% |
| 0.2.1 | ✅ | 1/1 | 100% |
| 0.2.2 | ✅ | 2/2 | 100% |
| 0.3.0 | 🚀 | 4+4/8 | ~50% (com sub-tasks) |

**Total de Issues:** 32  
**Concluídas:** 15 (47%)  
**Em Desenvolvimento:** 17 (53%)

---

## 🔜 Próximas Milestones Planejadas

### Versão 0.4.0 (Planejada)
- Melhorias em armazenamento e indexação de plugins
- Suporte para OAuth2 em plugins
- Adicionais métodos de embedding para LLMs
- Sistema de memória persistente para agentes
- Interatividade expandida em execução de agentes

---

## 🎯 Roadmap de Longo Prazo

1. **Storage & Indexing** - Sistema avançado de indexação para plugins
2. **Authentication** - Suporte completo para OAuth2 e múltiplos provedores
3. **AI Capabilities** - Embedding, vector search, e advanced prompting
4. **Agent Intelligence** - Memória persistente, aprendizado contextual
5. **Platform Features** - Cost tracking, analytics, team management

---

*Última atualização: 20 de Outubro de 2026*
