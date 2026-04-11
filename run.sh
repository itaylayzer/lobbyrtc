openssl genpkey -algorithm RSA -out private.pem -pkeyopt rsa_keygen_bits:3072
bun run server.js