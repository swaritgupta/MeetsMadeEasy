FROM node:22-bookworm-slim AS builder

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends build-essential wget ca-certificates \
  && rm -rf /var/lib/apt/lists/*

ARG WHISPER_MODEL=medium.en

COPY meets-made-easy/package*.json ./
RUN npm ci

COPY meets-made-easy/ ./
RUN if [ "$(uname -m)" = "aarch64" ]; then \
    make -C node_modules/whisper-node/lib/whisper.cpp \
      CFLAGS='-I. -O3 -DNDEBUG -std=c11 -fPIC -D_XOPEN_SOURCE=600 -D_GNU_SOURCE -pthread -U__ARM_FEATURE_FP16_VECTOR_ARITHMETIC -U__ARM_FEATURE_FMA' \
      CXXFLAGS='-I. -I./examples -O3 -DNDEBUG -std=c++11 -fPIC -D_XOPEN_SOURCE=600 -D_GNU_SOURCE -pthread -U__ARM_FEATURE_FP16_VECTOR_ARITHMETIC -U__ARM_FEATURE_FMA'; \
  else \
    make -C node_modules/whisper-node/lib/whisper.cpp; \
  fi \
  && bash node_modules/whisper-node/lib/whisper.cpp/models/download-ggml-model.sh "${WHISPER_MODEL}" \
  && npm run build \
  && npm prune --omit=dev

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
