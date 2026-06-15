FROM node:22-alpine AS web-builder

RUN corepack enable && corepack prepare pnpm@10.26.0 --activate

WORKDIR /app/web

COPY web/package.json web/pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY web/ ./
RUN pnpm build

FROM golang:1.26-alpine AS api-builder

RUN apk add --no-cache ca-certificates git

WORKDIR /app

COPY go.mod go.sum ./
RUN go mod download

COPY . .
COPY --from=web-builder /app/web/dist ./web/dist

RUN CGO_ENABLED=0 GOOS=linux go build -ldflags "-s -w" -o /api ./cmd/api

FROM alpine:3.21

RUN apk add --no-cache ca-certificates \
    && addgroup -S app \
    && adduser -S -G app app

WORKDIR /app

COPY --from=api-builder /api ./api
COPY migrations ./migrations

USER app

EXPOSE 8852

ENV ENV=production

ENTRYPOINT ["./api"]
