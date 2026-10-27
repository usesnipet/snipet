# Hooks do loop de agentes

Catálogo de todos os pontos de hook do loop de agentes: quando cada um dispara,
o que recebe e o que pode fazer. Como um hook é executado (interno, HTTP, gRPC,
código, ...) está em [hook-handlers.md](./hook-handlers.md).

## Onde o loop está hoje

| Etapa                       | Código                                                     |
| --------------------------- | ---------------------------------------------------------- |
| Criar sessão/run e salvar o input | `AgentRunService.start` (`apps/api/src/modules/agent-run/agent-run.service.ts:122`) |
| Cancelar                    | `AgentRunService.cancel` (`agent-run.service.ts:155`)      |
| Carregar histórico          | `AgentRunner.getHistory` (`agent-run.runner.ts:60`)        |
| Montar system + tools       | `AgentContext.build` (`agent-context.ts`)                  |
| Loop de turnos              | `AgentRunner.execute` (`agent-run.runner.ts:93`)           |
| Chamar a LLM (stream)       | `this.llm.stream(...)` (`agent-run.runner.ts:124`) → `LLMRunner.stream` (`llm/llm.runner.ts`) |
| Salvar mensagem             | `AgentRunner.save` (`agent-run.runner.ts:178`)             |
| Executar tool               | `context.call(call)` (`agent-run.runner.ts:146`)           |
| Fechar a run                | `runs.update(...)` + `run_finished` (`agent-run.runner.ts:168`) |

Os hooks entram nesses pontos. O runner passa a chamar um `HookDispatcher`
em vez de ter lógica extra embutida.

## Conceitos

### Tipos de hook

Cada ponto de hook tem um **modo**, que limita o que o handler pode devolver:

- **observe**: só observa. Roda em paralelo e, por padrão, sem bloquear o
  loop (fire-and-forget). O retorno é ignorado. Serve para logs, métricas,
  webhooks, auditoria e notificações.
- **intercept**: roda em sequência, antes de a etapa acontecer, e bloqueia o
  loop. Pode alterar o payload (o próximo handler recebe a versão alterada),
  bloquear a etapa ou responder no lugar dela (short-circuit).
- **transform**: roda em sequência, depois da etapa, e pode alterar o
  resultado antes de ele seguir no loop ou ser salvo.

Um mesmo handler pode ser configurado como `async: true` num ponto intercept
ou transform. Nesse caso ele vira observe ali: o loop não espera e o retorno
é ignorado.

### Envelope de entrada

Todo handler recebe o mesmo envelope, e só o `payload` muda por hook:

```ts
interface HookEvent<P> {
  version: 1;
  id: string; // único por disparo, serve de chave de idempotência
  hook: HookName; // ex.: "tool.before"
  mode: "observe" | "intercept" | "transform";
  occurredAt: string; // ISO
  run: { id: string; sessionId: string; turn: number; status: AgentRunStatus };
  agent: { id: string; name: string };
  owner: { userId: string | null; appId: string | null; externalUserId: string | null; name?: string };
  metadata: JsonObject; // compartilhado entre hooks da mesma run (ver "Estado da run")
  payload: P;
}
```

### Retorno

```ts
type HookResult<P, R = never> =
  | { action: "continue" } // não muda nada (também é o retorno vazio/204)
  | { action: "modify"; payload: Partial<P> } // intercept/transform
  | { action: "block"; reason: string } // intercept: a etapa não acontece
  | { action: "respond"; result: R } // intercept: devolve o resultado sem executar a etapa
  | { action: "stop"; reason: string; status?: "completed" | "failed" } // encerra a run
```

Cada hook abaixo diz quais ações aceita. Uma ação que o hook não aceita é
tratada como erro do handler (ver `onError`).

`metadata` também pode vir no retorno (`{ ..., metadata: {...} }`) em qualquer
modo síncrono. Ele é mesclado no `metadata` da run.

### Estado da run

`metadata` é um objeto JSON por run, criado vazio em `run.start` e passado a
todo hook. Os hooks usam esse objeto para trocar dados entre si, por exemplo
um id de trace criado em `run.start` e lido em `run.end`, ou um contador de
custo. Ele é salvo junto da run (coluna nova `agent_runs.metadata`) e aparece
no debug.

### Ordem, filtros e falhas

Cada vínculo de hook (ver [hook-handlers.md](./hook-handlers.md#configuração))
tem:

- `order`: ordem de execução dentro do mesmo hook (menor primeiro).
- `match`: filtro opcional. Exemplos: nome da tool (glob `github_*`), modelo
  (`ollama/*`), status final (`failed`), role da mensagem.
- `timeoutMs`: tempo máximo. Estourar o tempo conta como erro.
- `onError`: `"continue"` (fail-open, padrão em observe) ou `"fail"`
  (fail-closed: a etapa falha como se tivesse dado erro, padrão em guardrails).
- `async`: não espera o retorno (só faz sentido em intercept/transform).

Hooks não disparam hooks. Um erro em hook de `*.error` nunca dispara outro
`*.error`, para não entrar em loop.

---

## Catálogo

Legenda: **Modo**, **Aceita** (ações de retorno), **Payload**.

### Sessão

#### `session.created`
Uma sessão nova foi criada no primeiro input.
- Modo: observe
- Payload: `{ session: AgentSession, input: string }`
- Usos: provisionar recursos externos (memória, thread no CRM), analytics de
  conversas novas.

#### `session.deleted`
A sessão foi apagada (as runs dela já foram abortadas).
- Modo: observe
- Payload: `{ sessionId: string }`
- Usos: apagar dados externos (LGPD/GDPR), limpar memória vetorial.

### Run

#### `run.beforeStart`
Antes de criar a run e salvar o input, ainda dentro do request HTTP. O cliente
recebe o erro na hora.
- Modo: intercept
- Aceita: `continue`, `modify` (`input`), `block`, `respond`
- Payload: `{ input: string, sessionId: string | null, isNewSession: boolean }`
- `block` → 400/403 para o cliente com o `reason`.
- `respond` → `{ text }`: cria a run já concluída com essa resposta e sem
  chamar a LLM (FAQ, resposta canned, modo manutenção).
- Usos: moderação de entrada, rate limit/quota por usuário ou app, horário de
  atendimento, normalizar ou traduzir o input, detectar e mascarar PII antes de
  persistir.

#### `run.start`
A run começou (primeira coisa em `AgentRunner.run`).
- Modo: observe (com `metadata` aceito em modo síncrono)
- Payload: `{ input: string }`
- Usos: abrir trace (OpenTelemetry/Langfuse), iniciar timer, setar
  `metadata.traceId`.

#### `run.history`
O histórico da sessão foi carregado, antes do primeiro turno.
- Modo: transform
- Aceita: `continue`, `modify` (`messages`)
- Payload: `{ messages: LlmMessage[], limit: number }`
- Usos: compactar ou resumir conversas longas, remover mensagens antigas,
  redigir PII do histórico, recuperar mensagens de outra fonte.
- Diferença para `llm.request`: roda uma vez por run e o resultado vira o
  histórico do loop. `llm.request` roda a cada turno e não altera o histórico.

#### `run.context`
`AgentContext.build` montou as system messages e as tools, antes do primeiro
turno.
- Modo: transform
- Aceita: `continue`, `modify` (`system`, `tools`)
- Payload: `{ system: LlmMessage[], tools: LlmTool[], denied: DeniedAction[], instructions: {name,text}[] }`
- Regras: um hook pode remover ou renomear tools e mudar a descrição delas.
  Adicionar uma tool exige que ela tenha executor, então só hooks que também
  tratam `tool.before` com `respond` podem adicionar tools ("tools virtuais",
  ver abaixo).
- Usos: injetar memória/RAG do usuário no system, data e hora atuais, perfil
  do usuário vindo de um CRM, esconder tools por plano/permissão, traduzir
  instruções.

#### `run.end`
Sempre dispara no fim, qualquer que seja o status, depois de gravar a run.
- Modo: observe
- Payload: `{ status, error: string | null, turns: number, usage: LlmUsage, durationMs: number, lastMessage: LlmMessage | null }`
- Usos: webhook "a run terminou", fechar trace, cobrança, avaliação offline
  (LLM-as-judge), enviar a resposta por e-mail, WhatsApp ou Slack.

#### `run.completed` / `run.failed` / `run.cancelled` / `run.maxTurns`
Atalhos de `run.end` filtrados por status, com payload igual mais um campo:
`run.failed` traz `{ error: { kind, message } }` com o erro bruto (o cliente
nunca vê esse erro, mas o hook vê).
- Modo: observe
- `run.maxTurns` também aceita (intercept) `{ action: "modify", payload: { extraTurns: n } }`
  para dar mais turnos uma vez, por exemplo quando um juiz decide que a tarefa
  está quase pronta.
- Usos: alertas de falha (PagerDuty), métricas de cancelamento, escalar para
  um humano quando o agente não termina.

### Turno

#### `turn.start`
Começo de cada iteração do loop, antes de montar as mensagens.
- Modo: intercept
- Aceita: `continue`, `stop`, `modify` (`inject`)
- Payload: `{ turn: number, maxTurns: number, history: LlmMessage[] }`
- `modify.inject`: mensagens adicionadas ao histórico deste ponto em diante
  (são salvas). Por exemplo, um lembrete "você já chamou 5 tools, conclua".
- `stop`: encerra a run com o status pedido (padrão `completed`).
- Usos: orçamento de custo ou tempo (para quando passa do limite), injetar
  observações de fontes externas entre turnos.

#### `turn.end`
Fim de cada turno, depois da resposta e das tools.
- Modo: intercept
- Aceita: `continue`, `stop`, `modify` (`continue: boolean`, `inject`)
- Payload: `{ turn, reply: LlmMessage, toolResults: LlmToolResultPart[], willContinue: boolean }`
- `modify.continue = true` com `inject` força mais um turno mesmo sem tool
  calls. Exemplo: um validador responde "a resposta não segue o formato pedido"
  como mensagem de usuário. `continue = false` para o loop mesmo havendo
  tool calls (as tools já executaram).
- Usos: auto-crítica e correção, validação de formato (JSON schema), parar
  cedo.

### LLM

#### `llm.request`
Antes de cada chamada à LLM.
- Modo: intercept
- Aceita: `continue`, `modify` (`messages`, `tools`, `targets`), `block`, `respond`
- Payload: `{ messages: LlmMessage[], tools?: LlmTool[], targets: { model, connectionId?, extraOptions? }[] }`
- `modify` vale só para esta chamada e não altera o histórico salvo.
- `respond` → `{ message: LlmMessage, usage? }`: usada como resposta da LLM,
  que não é chamada (cache semântico, replay em testes, mocks).
- `block` → a run falha com o `reason`.
- Usos: roteamento de modelo (pergunta simples vai para um modelo barato),
  trocar `extraOptions` (temperatura, `think`) por turno, janela deslizante,
  remover imagens para modelos sem visão, prompt caching, guardrail de
  prompt injection nos tool results, quota de tokens.

#### `llm.started`
O runner escolheu um target (evento `llm_started`).
- Modo: observe
- Payload: `{ model: string, attempt: number }`

#### `llm.skipped`
Um target falhou com erro de failover e o próximo vai ser tentado (evento
`llm_skipped`).
- Modo: observe
- Payload: `{ model: string, error: { kind, message } }`
- Usos: alertas de provedor fora do ar ou chave inválida, circuit breaker
  externo.

#### `llm.delta`
Cada pedaço de stream (`text_delta`, `thinking_delta`).
- Modo: transform, **só handlers internos e de código** (ver custos abaixo)
- Aceita: `continue`, `modify` (`text`), `block` (descarta o pedaço)
- Payload: `{ kind: "text" | "thinking", text: string }`
- Custos: dispara dezenas de vezes por segundo. Handler remoto (HTTP/gRPC)
  não pode ser síncrono aqui, só `async` e com envio em lote (por exemplo a
  cada 500 ms ou 1 KB).
- Atenção: o texto final salvo vem de `llm.response`. Um `modify` aqui só
  muda o que o cliente vê ao vivo. Para que o texto salvo bata com o exibido,
  o mesmo filtro tem que estar em `llm.response`. Handlers internos de
  redação fazem os dois.
- Usos: mascarar segredos ou PII ao vivo, esconder o pensamento do cliente,
  repassar o stream para outro canal (WebSocket, TTS).

#### `llm.toolCall`
A LLM pediu uma tool, ainda durante o stream (evento `tool_call`).
- Modo: observe
- Payload: `{ call: LlmToolCallPart }`
- Para alterar a chamada, use `tool.before`.

#### `llm.usage`
Contagem de tokens da chamada.
- Modo: observe (com `metadata`)
- Payload: `{ model: string, inputTokens: number, outputTokens: number }`
- Usos: cobrança, custo acumulado em `metadata.cost`, que `turn.start` lê para
  aplicar um orçamento.

#### `llm.response`
A mensagem completa da LLM, antes de ser salva e antes de executar as tools.
- Modo: transform
- Aceita: `continue`, `modify` (`message`), `block`, `stop`
- Payload: `{ model: string, message: LlmMessage, finishReason, usage }`
- `modify.message`: o que é salvo e o que segue no loop. Pode remover tool
  calls, adicionar outras ou reescrever o texto.
- `block` → descarta a resposta e refaz o turno com um aviso injetado
  (`reason` vira mensagem de sistema). Há um limite de tentativas por turno
  (`maxRetries`, padrão 1).
- Usos: guardrail de saída (moderação, vazamento de system prompt), validação
  de formato ou JSON, remover tool calls não permitidas, citar fontes,
  traduzir a resposta.

#### `llm.error`
A chamada falhou: `FailoverError` (todos os targets falharam) ou um erro sem
failover (`bad_request`, `context_too_long`, ...).
- Modo: intercept
- Aceita: `continue` (a run falha), `respond`, `modify` (`retry`)
- Payload: `{ error: { kind, message }, attempts: { model, error }[], request: { messages, tools, targets } }`
- `respond` → `{ message }`: resposta substituta, e a run segue. Exemplo:
  "estamos com instabilidade, tente mais tarde".
- `modify.retry = { messages?, targets?, delayMs? }`: tenta de novo uma vez com
  outro pedido. Exemplo: em `context_too_long`, compactar o histórico e tentar
  outra vez.
- Usos: fallback para outro provedor fora do agente, compactação automática,
  alerta.

### Tools

#### `tool.before`
Antes de executar cada tool call.
- Modo: intercept
- Aceita: `continue`, `modify` (`arguments`), `block`, `respond`
- Payload: `{ call: LlmToolCallPart, tool: { name, description, pluginConnectionId? } | null, known: boolean }`
- `modify.arguments`: a tool executa com esses argumentos. O tool_call salvo
  continua com os argumentos originais, e os novos ficam no debug.
- `block` → a tool não executa e o resultado vira
  `{ content: reason, isError: true }`. A LLM fica sabendo do bloqueio.
- `respond` → `{ content, isError? }`: resultado sem executar a tool. É o que
  permite **tools virtuais**: uma tool adicionada em `run.context` e
  respondida aqui.
- Usos: permissões finas (só deixar `delete_*` com aprovação), injetar
  credenciais ou ids do usuário nos argumentos (sem expor isso à LLM),
  validar argumentos, cache e mock de tools, dry-run, limite de chamadas por
  tool.

#### `tool.after`
Depois de executar a tool com sucesso (`isError: false`).
- Modo: transform
- Aceita: `continue`, `modify` (`content`, `isError`)
- Payload: `{ call, result: ActionResult, durationMs }`
- Usos: truncar ou resumir resultados enormes, redigir PII ou segredos,
  converter HTML em markdown, marcar conteúdo externo como não confiável
  (contra prompt injection).

#### `tool.error`
A tool falhou: lançou exceção, devolveu `isError: true`, é desconhecida ou
foi bloqueada por um hook.
- Modo: intercept
- Aceita: `continue`, `modify` (`content`, `isError`, `retry`)
- Payload: `{ call, result: ActionResult, reason: "thrown" | "error_result" | "unknown_tool" | "blocked" | "timeout", durationMs }`
- `modify.retry = { arguments?, delayMs? }`: executa de novo uma vez.
  `modify.isError = false` com `content` troca a falha por um resultado de
  fallback.
- Usos: retry com backoff em erros transitórios, mensagem de erro mais útil
  para a LLM, alerta de plugin quebrado.

### Mensagens

#### `message.beforeSave`
Antes de gravar qualquer mensagem (user, assistant, tool).
- Modo: transform
- Aceita: `continue`, `modify` (`parts`)
- Payload: `{ message: LlmMessage, model: string | null }`
- Muda **só o que é persistido** e enviado aos clientes. O loop continua com a
  versão original nesta run. Nas próximas runs o histórico vem do banco, ou
  seja, já redigido.
- Usos: redação de PII para conformidade, remover imagens grandes do
  armazenamento.

#### `message.saved`
Mensagem gravada (é o evento `message` do SSE).
- Modo: observe
- Payload: `{ message: AgentMessage }`
- Usos: espelhar a conversa em outro sistema (CRM, helpdesk), indexar para
  busca ou memória.

### Cancelamento

#### `run.cancelRequested`
Alguém pediu o cancelamento (`AgentRunService.cancel`), antes de abortar.
- Modo: intercept
- Aceita: `continue`, `block`
- Payload: `{ by: Owner }`
- Usos: impedir o cancelamento no meio de uma transação crítica.
- O `run.cancelled` (observe) dispara depois, quando a run de fato fecha.

---

## Possibilidades além do pedido

Coisas que o catálogo acima permite e que vale prever desde já:

- **Human-in-the-loop**: `tool.before` devolve
  `{ action: "pause", reason }`. A run vai para um status novo,
  `waiting_approval`, e um endpoint `POST /agent-runs/:id/resume` com
  `{ approve | deny | arguments }` retoma. Exige que o loop saiba retomar a
  partir do banco. É a maior mudança estrutural e fica para a fase 3.
- **Tools virtuais**: hooks que expõem tools sem plugin (`run.context` +
  `tool.before`/`respond`), como "consultar pedido" chamando uma API interna.
- **Memória de longo prazo**: `run.context` injeta memórias e `run.end` extrai
  e salva memórias novas.
- **Compactação automática**: `llm.error(context_too_long)` ou `run.history`
  com orçamento de tokens resume o começo da conversa.
- **Orçamento e quota**: `llm.usage` acumula em `metadata` e `turn.start`
  aplica `stop`. `run.beforeStart` bloqueia quem estourou a quota mensal.
- **Roteamento de modelo**: `llm.request` troca os `targets` pela dificuldade
  da pergunta.
- **Avaliação contínua**: `run.end` assíncrono manda a conversa para um juiz
  LLM e grava a nota em `metadata`.
- **Multiagente**: uma tool virtual que inicia uma run de outro agente
  (subagente) e devolve a resposta.
- **Replay e testes**: `llm.request`/`respond` e `tool.before`/`respond`
  alimentados por gravação. Permite reexecutar uma run do debug sem custo.
- **Canais externos**: `run.end` envia a resposta para WhatsApp, Slack ou
  e-mail e `session.created` cria a thread no canal.
- **Observabilidade**: um handler interno `otel` cria spans em `run.start`,
  `llm.request`/`llm.response`, `tool.before`/`tool.after` e `run.end`.

## Fora de escopo por enquanto

- Hooks fora do loop de agentes (CRUD de agentes, conexões, login).
- Hooks em `POST /llm/execute` (chamada direta de LLM, sem agente). Os hooks
  `llm.*` podem ser reaproveitados ali depois, porque o payload não depende da
  run.
