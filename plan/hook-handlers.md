# Handlers de hooks

O que executa um hook. Um ponto de hook ([hooks.md](./hooks.md)) só define
quando dispara e o que pode devolver. O **handler** define o que acontece:
uma função interna do Snipet, uma chamada HTTP ou gRPC, um código do usuário,
uma action de plugin, uma LLM, uma fila...

Todos os handlers falam o mesmo protocolo: recebem o `HookEvent` e devolvem um
`HookResult` (os dois definidos em [hooks.md](./hooks.md#envelope-de-entrada)).
Para o loop não importa quem respondeu.

## Arquitetura: reaproveitar manifests e drivers

O Snipet já resolve o problema "algo configurável, com segredos, executado por
um driver" para plugins e LLMs:

- **manifest** JSON (`plugin/manifests`, `llm/manifests` e os diretórios
  `PLUGINS_DIR`/`LLMS_DIR`) com o JSON Schema da conexão e, por capability, o
  driver e as opções (`{{ connection.x }}`).
- **connection**: instância configurada, com segredos mascarados
  (`ConnectionService`).
- **DriverRegistry**: drivers por capability, com opções validadas por zod.

Os hooks seguem o mesmo modelo:

| Peça          | Plugins hoje                      | Hooks                                     |
| ------------- | --------------------------------- | ----------------------------------------- |
| Manifest      | `plugin/manifests/*.json`         | `hook/manifests/*.json` + `HOOKS_DIR`     |
| Capability    | `actions`, `instructions`         | `handle`                                  |
| Driver        | `mcp`, `static`                   | `builtin`, `http`, `grpc`, `code`, ...    |
| Connection    | `plugin_connections`              | `hook_connections`                        |
| Vínculo       | `agent_plugin_connections` (grant) | `agent_hooks` (evento, ordem, filtro)     |

```ts
// apps/api/src/hook/driver.ts
export interface HookDriver<Opts = unknown> extends BaseDriver<Opts> {
  /** Modes this driver can serve; llm.delta only takes in-process drivers. */
  readonly modes: HookMode[];
  readonly inProcess: boolean;
  handle(event: HookEvent<unknown>, options: Opts, signal: AbortSignal): Promise<HookResult<unknown, unknown>>;
}
export type HookDrivers = { handle: HookDriver; healthCheck: HealthCheckDriver };
```

Exemplo de manifest (webhook genérico):

```json
{
  "key": "webhook",
  "name": "Webhook",
  "description": "Sends the hook event to a URL and uses its JSON reply.",
  "connection": {
    "type": "object",
    "properties": {
      "url": { "type": "string", "title": "URL" },
      "secret": { "type": "string", "secret": true, "format": "password", "title": "Signing secret" }
    },
    "required": ["url"]
  },
  "handle": {
    "driver": "http",
    "options": { "url": "{{ connection.url }}", "signingSecret": "{{ connection.secret }}" }
  }
}
```

Manifests prontos também podem fixar o destino, por exemplo
`slack-notify.json` (http para o webhook do Slack, só observe) ou
`langfuse.json` (builtin `otel`/http com a chave do projeto).

## Configuração

### `hook_connections`

Igual a `plugin_connections`: `{ id, hookKey, name, config (segredos cifrados/mascarados), enabled }`.
Um usuário cria, por exemplo, "Webhook do CRM" a partir do manifest `webhook`.

### `agent_hooks` (vínculo)

```ts
{
  id: uuid;
  agentId: uuid | null; // null = global, vale para todos os agentes
  hookConnectionId: uuid;
  hooks: HookName[]; // ex.: ["tool.before", "tool.error"]
  order: number;
  match?: { tools?: string[]; models?: string[]; statuses?: AgentRunStatus[]; roles?: LlmRole[] }; // globs
  timeoutMs?: number; // padrão: 5000 síncrono, 30000 async
  onError: "continue" | "fail"; // padrão: continue
  async: boolean; // não espera o retorno
  include?: ("messages" | "tools" | "toolArguments" | "toolResults" | "metadata")[]; // ver Segurança
  enabled: boolean;
}
```

Hooks globais rodam antes dos do agente, cada grupo pela sua `order`. Na
UI do agente entra uma aba "Hooks", parecida com a de plugins: escolher a
conexão, os pontos de hook e as opções.

### Hooks de app

Apps (integrações com `appId`) podem querer hooks próprios, como "me avise
quando a run do meu usuário terminar". Fase 2: `agent_hooks.appId` com o
mesmo modelo, disparando só para runs daquele app.

## Execução

`HookDispatcher` (novo, em `modules/agent-run` ou `hook/`):

```ts
dispatch<P, R>(hook: HookName, payload: P, ctx: RunHookContext): Promise<HookOutcome<P, R>>
```

1. Busca os vínculos do agente e os globais para o hook, filtra por `match` e
   ordena. Os vínculos são carregados uma vez por run, em `run.start`, e não
   a cada disparo.
2. **observe** e os `async: true`: dispara todos sem `await` (em paralelo) e
   loga as falhas.
3. **intercept/transform**: executa em sequência. Cada `modify` atualiza o
   payload do próximo handler. `block`, `respond` e `stop` encerram a cadeia.
4. Valida o retorno com zod contra as ações que o hook aceita. Retorno
   inválido ou timeout segue `onError`.
5. Registra no `Debugger` da run (`d.append("hooks", { hook, handler, durationMs, action, error })`).
   O debug passa a mostrar a linha do tempo dos hooks.

O runner troca pontos fixos por chamadas ao dispatcher, por exemplo:

```ts
const before = await hooks.dispatch("tool.before", { call, tool, known }, ctx);
const result = before.respond ?? (before.block ? blocked(before.block) : await context.call(before.payload.call));
```

Agentes sem hooks não pagam nada: `dispatch` retorna na hora quando não há
vínculos para aquele hook.

## Handlers

### 1. `builtin`: funções internas do Snipet

Código TypeScript no próprio Snipet, registrado por nome. Roda no mesmo
processo, sem rede, e é o único tipo (junto com `code`) permitido em
`llm.delta`.

```json
{ "driver": "builtin", "options": { "name": "redact-pii", "config": { "entities": ["email", "cpf", "phone"] } } }
```

Catálogo inicial sugerido:

| Nome                | Hooks                                     | Faz                                                    |
| ------------------- | ----------------------------------------- | ------------------------------------------------------ |
| `redact-pii`        | `llm.delta`, `llm.response`, `message.beforeSave`, `tool.after` | Mascara e-mail, CPF, telefone, cartão (regex)          |
| `redact-secrets`    | idem                                      | Mascara chaves de API e tokens conhecidos              |
| `truncate-tool-result` | `tool.after`                           | Corta resultados acima de N caracteres e avisa a LLM   |
| `inject-datetime`   | `run.context`                             | Adiciona data, hora e fuso atuais ao system            |
| `token-budget`      | `llm.usage`, `turn.start`                 | Acumula tokens em `metadata` e para a run no limite    |
| `tool-rate-limit`   | `tool.before`                             | Máximo de N chamadas por tool por run                  |
| `tool-allowlist`    | `run.context`, `tool.before`              | Esconde ou bloqueia tools por padrão de nome           |
| `hide-thinking`     | `llm.delta`, `message.beforeSave`         | Não mostra nem salva o pensamento                      |
| `json-output`       | `llm.response`, `turn.end`                | Valida a resposta contra um JSON Schema e pede correção |
| `compact-history`   | `run.history`, `llm.error`                | Resume as mensagens antigas com uma LLM barata         |
| `otel`              | todos (observe)                           | Spans OpenTelemetry da run, turnos, LLM e tools        |
| `log`               | todos (observe)                           | Loga o evento (útil para depurar hooks)                |

Novos builtins são classes registradas num `BuiltinHookRegistry`, com
`configSchema` em zod. Esse schema vira JSON Schema para o formulário da UI.

### 2. `http`: webhook

```json
{
  "driver": "http",
  "options": {
    "url": "https://example.com/snipet-hook",
    "method": "POST",
    "headers": { "Authorization": "Bearer {{ connection.token }}" },
    "signingSecret": "{{ connection.secret }}",
    "retries": 3
  }
}
```

- Envia `HookEvent` em JSON com `Content-Type: application/json`.
- Assinatura: `X-Snipet-Signature: t=<unix>,v1=<hmac-sha256(secret, t + "." + body)>`
  (no estilo do Stripe), mais `X-Snipet-Event-Id` (o `id` do evento) para
  idempotência.
- Resposta: `2xx` com corpo `HookResult`. `204` ou corpo vazio é `continue`.
  Status não-2xx ou JSON inválido é erro (segue `onError`).
- `retries` com backoff exponencial **só em async/observe**. Em síncrono a
  run não espera retry: um timeout já é erro.
- Reaproveita a lógica de headers e timeout do `HttpHealthCheckDriver`
  (`manifest/drivers/http.health.ts`).

### 3. `grpc`

Para quem já tem serviços gRPC e quer menor latência que HTTP/JSON em hooks
síncronos.

```proto
syntax = "proto3";
package snipet.hooks.v1;
import "google/protobuf/struct.proto";

service HookService {
  rpc Handle(HookRequest) returns (HookResponse);
}
message HookRequest {
  string id = 1;
  string hook = 2;
  string mode = 3;
  google.protobuf.Struct event = 4; // HookEvent completo
}
message HookResponse {
  string action = 1; // continue | modify | block | respond | stop
  google.protobuf.Struct payload = 2;
  google.protobuf.Struct result = 3;
  string reason = 4;
  google.protobuf.Struct metadata = 5;
}
```

- Opções: `address`, `tls` (`insecure` | `system` | `ca`), `metadata`
  (headers gRPC), `deadlineMs`.
- O `.proto` fixo vai em `apps/api/src/hook/proto/`. O payload em `Struct`
  evita versionar um proto por hook.
- Dependência nova: `@grpc/grpc-js` + `@grpc/proto-loader`. Fica para a fase 2.

### 4. `code`: código do usuário em sandbox

Um trecho de JavaScript ou TypeScript escrito na UI, para lógica pequena sem
precisar subir um serviço:

```js
// tool.before
export default function (event) {
  if (event.payload.call.name.startsWith("delete_")) {
    return { action: "block", reason: "deletions are disabled for this agent" };
  }
  return { action: "continue" };
}
```

- **Nunca `node:vm`**: ele não é fronteira de segurança. Opções:
  - `quickjs-emscripten` (QuickJS em WASM): isolamento real, limite de memória
    e de tempo, sem acesso a rede ou disco. Recomendado.
  - `isolated-vm` (V8 isolate): mais rápido, mas é módulo nativo e complica
    o build e as imagens.
- Limites: CPU (`timeoutMs`), memória (ex.: 32 MB), tamanho do código.
- APIs expostas: só funções puras (JSON, regex, datas) e, opcionalmente, um
  `fetch` controlado pelo Snipet (com allowlist de hosts) quando o vínculo
  liberar.
- O código fica na conexão (`config.source`), versionado pelo `updatedAt`.
  Ele é compilado uma vez e o resultado vai para cache.

### 5. `command`: processo local

Executa um binário com o `HookEvent` no stdin e lê o `HookResult` do stdout
(modelo dos hooks do Claude Code e do git).

- Só para instalações self-hosted, desligado por padrão
  (`HOOKS_COMMAND_ENABLED=false`), e só administradores configuram.
- `command` e `args` fixos no manifest, nunca montados a partir do payload
  (evita injeção de shell). `execFile`, sem shell.
- Timeout com `kill` do processo e limite do tamanho do stdout.

### 6. `plugin-action`: action de um plugin existente

Usa uma action de uma `plugin_connection` já configurada (por exemplo uma tool
MCP) como handler. Reaproveita `PluginConnectionService.executeAction`.

```json
{ "driver": "plugin-action", "options": { "pluginConnectionId": "…", "action": "moderate_text", "argumentsTemplate": { "text": "{{ payload.message.parts.0.text }}" } } }
```

- O resultado (`ActionResult.content`) tem que ser um `HookResult` em JSON
  quando o hook é intercept/transform. Em observe ele é ignorado.
- Permite usar MCP servers de moderação, CRM e memória sem escrever
  integração nova.

### 7. `llm`: um modelo decide

Uma chamada à LLM com prompt próprio, útil para guardrails e juízes:

```json
{
  "driver": "llm",
  "options": {
    "target": { "model": "ollama/llama3.2", "connectionId": "…" },
    "prompt": "Responda JSON {\"allow\": bool, \"reason\": string}. A mensagem viola a política?\n\n{{ payload.message }}",
    "map": { "allow=false": { "action": "block", "reason": "{{ output.reason }}" } }
  }
}
```

- Usa `LLMRunner.generate` (com failover).
- `map` traduz a saída estruturada em `HookResult`. Sem `map`, a LLM tem que
  devolver o `HookResult` diretamente (com `response_format`/`format` JSON).
- Custo e latência: mais indicado em `run.end` (async) ou `llm.response`.

### 8. `queue`: publicar em fila ou barramento

Só observe. Publica o `HookEvent` para consumo assíncrono.

- **Redis** (`ioredis` já está nas dependências): `XADD` num stream ou
  `PUBLISH` num canal. Configuração: `url`, `stream`/`channel`, `maxLen`.
- Depois: SQS, Kafka, NATS e Google Pub/Sub, cada um como um driver.
- Útil para pipelines de analytics e para desacoplar consumidores lentos.

### 9. `agent`: outro agente (fase 3)

Inicia uma run de outro agente com o evento como input e usa a resposta
final (JSON) como `HookResult`. Serve para revisão por um agente
especialista. Precisa de proteção contra recursão: um contador de profundidade
em `metadata`, com limite de 3.

## Segurança

- **Dados enviados**: o evento pode conter a conversa inteira, argumentos e
  resultados de tools e dados do usuário. `include` no vínculo define o que
  sai para handlers externos. O padrão para http/grpc/queue é **sem**
  `messages` e `toolResults`, a menos que o vínculo inclua explicitamente.
  Builtins sempre recebem tudo.
- **Segredos**: campos `secret: true` da conexão mascarados como hoje
  (`ConnectionService.mask`). Nunca entram no `HookEvent` nem no debug.
- **SSRF**: http e grpc bloqueiam IPs privados, loopback e metadata de cloud
  (`169.254.169.254`) por padrão. Uma env `HOOKS_ALLOW_PRIVATE_NETWORK=true`
  libera para self-hosted, quando o serviço do hook roda na mesma rede.
- **Assinatura**: HMAC obrigatório quando `signingSecret` está definido. A
  documentação traz um exemplo de verificação.
- **Limites**: tamanho máximo do payload enviado e da resposta (ex.: 1 MB),
  `timeoutMs` máximo (ex.: 30 s síncrono), número máximo de hooks por ponto.
- **Fail-open vs fail-closed**: guardrails de segurança devem usar
  `onError: "fail"`. Se o serviço de moderação cair, a run falha em vez de
  passar sem filtro. A UI mostra o aviso.
- **Respostas de hooks são dados não confiáveis**: o `modify` passa pelo mesmo
  zod que valida o payload. Por exemplo, um `modify.messages` com role
  inválida é rejeitado.
- **Quem configura**: hooks globais e `command` só para admin. Hooks de agente
  seguem a mesma permissão de editar o agente.

## Observabilidade dos próprios hooks

- Linha do tempo no debug da run (já existe `DebugService`/`Debugger`).
- Métricas por vínculo: execuções, erros, timeouts, p95 de latência. Fase 2:
  tabela `hook_executions` com retenção curta, ou só logs.
- Botão "testar" na UI: dispara um evento de exemplo para o handler e mostra
  a resposta, como o health check das conexões.

## Fases

1. **Fundação**
   - Tipos `HookEvent`/`HookResult`/`HookName` em `packages/shared`.
   - `HookDispatcher` e os pontos no `AgentRunner`/`AgentRunService`.
   - Manifests e drivers `builtin` + `http`.
   - Tabelas `hook_connections` e `agent_hooks`, com migração.
   - `metadata` na run e a linha do tempo no debug.
   - Hooks da fase 1: `run.*`, `turn.*`, `llm.request`, `llm.response`,
     `llm.error`, `llm.usage`, `tool.*`, `message.saved`, `session.*`.
2. **Mais handlers e pontos**
   - `code` (QuickJS), `queue` (Redis), `plugin-action`, `llm`, `grpc`.
   - `llm.delta` e `message.beforeSave`.
   - Hooks de app e UI de métricas.
3. **Estruturais**
   - Human-in-the-loop (`pause`/`resume`, status `waiting_approval`).
   - Handler `agent`.
   - `command` para self-hosted.
   - Replay de runs a partir do debug.

## Questões em aberto

- Hooks globais vêm só da UI (banco) ou também de arquivo (`HOOKS_DIR` com
  vínculos, para deploy declarativo)?
- `llm.delta` com `modify` exige que o texto ao vivo e o salvo concordem.
  Aplicar automaticamente o mesmo filtro em `llm.response` ou deixar a cargo
  de quem configura?
- Async com retry precisa sobreviver a restart (outbox no banco ou stream
  Redis) ou retry em memória basta na fase 1?
- `tool.before` com `modify.arguments`: salvar os argumentos alterados no
  tool_call persistido (o que a LLM vê no próximo turno) ou só no debug?
