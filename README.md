# Snipet

**Build AI agents that work across all your apps.**

Snipet is an open-source, self-hosted platform. Connect agents to the tools you already use and call them from anywhere: your product, your backend, and soon the channels your users live in.

[Website](https://snipet.dev) · [Documentation](https://snipet.dev/docs/) · [Your first agent](https://snipet.dev/docs/get-started/first-agent/)

## Run it locally

You need [Docker](https://docs.docker.com/get-docker/) with Compose.

```sh
curl -O https://raw.githubusercontent.com/usesnipet/snipet/main/docker-compose.yml
docker compose up -d
```

Open [localhost:8852](http://localhost:8852) and sign in with the username `admin` and the password `admin`.

Before putting Snipet on a network, set your own `ROOT_PASSWORD`, `JWT_SECRET` and `ENCRYPTION_KEY`. The defaults are public. See [Run Snipet](https://snipet.dev/docs/get-started/install/) for all the settings.

## How it works

```
Model ──┐
        ├──▶ Agent ──▶ App ──▶ API, chat widget and, soon, more channels
Plugins ┘
```

- **Models:** OpenAI, Google Gemini, Mistral AI, Groq, DeepSeek, xAI, Cerebras, Fireworks AI, OpenRouter and any OpenAI-compatible API, plus local models in Ollama or LM Studio.
- **Plugins:** GitHub, Linear, Stripe, Supabase, Neon and more from the catalog, or any MCP server by its URL.
- **Agents:** a prompt, the models it runs on and the plugin actions it may call.
- **Apps:** where your users meet your agents. An app holds the API keys and decides who may chat.

## Call your agents from anywhere

- **Available now:** the API, and an embeddable chat widget for any site, React or Angular.
- **Coming next:** WhatsApp, Telegram, Slack and Discord.

The widget is just the first channel.

## Develop

You need Node.js 22 or later, [pnpm](https://pnpm.io) and Docker for Postgres.

```sh
git clone https://github.com/usesnipet/snipet.git
cd snipet
cp .env.example .env
docker compose -f docker-compose.dev.yml up -d db
pnpm install
pnpm dev
```

The web app opens at [localhost:5173](http://localhost:5173). Sign in as `admin` with the password `admin`.

| Path | What it is |
| --- | --- |
| [`apps/api`](apps/api) | The server, a NestJS API |
| [`apps/web`](apps/web) | The admin web app |
| [`apps/widget`](apps/widget) | The embeddable chat widget |
| [`apps/site`](apps/site) | The website and documentation |
| [`packages/react-widget`](packages/react-widget), [`packages/angular-widget`](packages/angular-widget) | Widget libraries for React and Angular |
| [`packages/client`](packages/client) | Typed client for the API |
| [`packages/shared`](packages/shared), [`packages/server-common`](packages/server-common), [`packages/ui`](packages/ui) | Shared schemas, server helpers and UI components |

## License

[Apache-2.0](LICENSE)
