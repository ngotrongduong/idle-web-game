# Guildhall staging infrastructure

This is the first single-host deployment shape for M0.7:

- PostgreSQL 16 stores server-authoritative state.
- The Fastify server is private to the Compose network.
- Caddy is the only public entrypoint. It serves the Vite build and proxies `/api/*` plus `/health` to the server.
- PostgreSQL is not published to the host network.

## Local smoke run

```bash
cp infra/.env.example infra/.env
docker compose --env-file infra/.env -f infra/docker-compose.yml up --build
```

Open `http://localhost:8080`. The API health endpoint is available at `http://localhost:8080/health`.

Stop the stack with:

```bash
docker compose --env-file infra/.env -f infra/docker-compose.yml down
```

Add `-v` only when you intentionally want to delete the PostgreSQL and Caddy volumes.

## Staging / production

Set a strong URL-safe `POSTGRES_PASSWORD`, set `SITE_ADDRESS` to the real DNS name, and map `HTTP_PORT=80` / `HTTPS_PORT=443`. Caddy will manage TLS when DNS points at the host and ports 80/443 are reachable.

The server runs the idempotent M0 migration before starting. This is appropriate for the current single-server milestone. Before multiple server replicas or destructive migrations, move migration execution into a dedicated deploy step.

## Backup example

```bash
docker compose --env-file infra/.env -f infra/docker-compose.yml exec -T db \
  pg_dump -U guildhall -d guildhall -Fc > guildhall.dump
```

Do not commit `infra/.env` or real credentials.
