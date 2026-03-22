FROM node:22-bookworm-slim AS builder

WORKDIR /app

COPY meets-made-easy/package*.json ./
RUN npm ci

COPY meets-made-easy/ ./
RUN npm run build && npm prune --omit=dev

FROM node:22-bookworm-slim AS runner

RUN apt-get update \
  && apt-get install -y --no-install-recommends ffmpeg \
  && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000
ENV BANNER="Meets Made Easy"

WORKDIR /app

COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist

RUN mkdir -p data src/backend/llm/outputs

EXPOSE 3000

CMD ["node", "dist/main"]
