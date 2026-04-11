FROM oven/bun:1.3.3-alpine

WORKDIR /app

RUN bun install sqlite3
COPY build/ .

CMD ["bash", "generate-key.sh;", "bun", "run", "server.js"]