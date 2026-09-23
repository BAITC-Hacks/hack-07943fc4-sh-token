# syntax=docker/dockerfile:1
FROM node:22-bookworm-slim AS web-build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1 STRATA_STANDALONE=true
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM ghcr.io/astral-sh/uv:0.11.33 AS uv
FROM node:22-bookworm-slim AS runtime
RUN apt-get update && apt-get install -y --no-install-recommends python3 python3-venv ca-certificates && rm -rf /var/lib/apt/lists/*
COPY --from=uv /uv /usr/local/bin/uv
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 \
    HOSTNAME=0.0.0.0 PORT=3000 STRATA_PUBLIC_DEMO=true \
    UV_PYTHON_DOWNLOADS=never UV_LINK_MODE=copy \
    ORION_PYTHON=/app/pipeline/.venv/bin/python \
    PYTHONUNBUFFERED=1 PYTHONDONTWRITEBYTECODE=1 \
    OPENBLAS_NUM_THREADS=1 OMP_NUM_THREADS=1
COPY pipeline ./pipeline
RUN uv sync --project pipeline --locked --no-dev --python /usr/bin/python3 && uv cache clean
COPY --from=web-build --chown=node:node /app/.next/standalone ./
COPY --from=web-build --chown=node:node /app/.next/static ./.next/static
COPY --from=web-build --chown=node:node /app/public ./public
COPY --chown=node:node data ./data
COPY scripts/container-start.mjs ./scripts/container-start.mjs
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "scripts/container-start.mjs"]
