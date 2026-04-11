FROM oven/bun:1.3.3-alpine

WORKDIR /app

RUN apk add --no-cache openssl
RUN bun install sqlite3
COPY build/ .

CMD ["sh", "run.sh"]