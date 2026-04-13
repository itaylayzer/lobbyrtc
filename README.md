# LobbyRTC

HTTP API and [PeerJS](https://peerjs.com/) signaling server for game lobbies. Clients register a lobby with a WebRTC / PeerJS id, share a short lobby code, and update player counts so matchmaking and “quick play” can pick a suitable room.

If you want to see a live site that talks to this kind of backend, open **[itaylayzer.github.io/catan.io/](https://itaylayzer.github.io/catan.io/)**.

## What you get

- **REST API** under `/lobbies` for creating, listing, fetching, updating, and deleting lobbies.
- **PeerJS** signaling on the same HTTP port, mounted at **`/peer`**.
- **SQLite** persistence (`lobbies.sql` in the working directory).
- **Operator dashboard** on a separate port (default **9000**): web UI plus a JSON overview API.
- **JWT access tokens** (RS384, 2-hour expiry) for host-only operations (update players, delete lobby).

## Requirements

- [Bun](https://bun.sh/) (runtime and package manager)
- `openssl` (once) to generate `private.pem` used to sign access tokens

## Quick start

There is **no** `config.ts` (or other generated config module) in this project. The server loads games from a JSON file: **`config/config.json`**. That file is **not guaranteed to be in the repository** (many deployments keep it private or create it per environment), so **you create and maintain it yourself** before the first run.

### 1. Create `config/config.json`

Create the directory `config/` in the project root and add `config.json`. It must be a **JSON array** (possibly empty is invalid—the server will exit if there are no games). Each element describes one game row to ensure exists in the database.

| Key          | Required | Meaning                                                                                                                                    | What to put                                                                                                                         |
| ------------ | -------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| `name`       | **yes**  | Stable internal name for the game (unique in the DB). Shown in logs and the dashboard.                                                     | A short string, e.g. `"catan"`. Avoid changing names casually if you rely on stable DB ids.                                         |
| `maxPlayers` | no       | Upper bound for lobby size used by the API: lobbies appear in **visible lists** and **quick play** only while `playersCount < maxPlayers`. | A positive integer, e.g. `6` for Catan. If you omit this key, new games get the schema default **8** when the row is first created. |

Example for one game:

```json
[{ "name": "catan", "maxPlayers": 6 }]
```

Example for several games (first start on an empty DB usually assigns ids `1`, `2`, … in array order):

```json
[
    { "name": "catan", "maxPlayers": 6 },
    { "name": "another-game", "maxPlayers": 4 }
]
```

On startup, the server **inserts missing games** by `name`. If a `name` already exists, that entry is left as-is (no update of `maxPlayers` from the file). **Numeric ids** in URLs (`/lobbies/:game/...`) are these rows’ database ids—use the dashboard’s overview or your DB to see them after the first run.

### 2. Generate `private.pem`

In the project root (or run the provided script):

```bash
openssl genpkey -algorithm RSA -out private.pem -pkeyopt rsa_keygen_bits:3072
```

The server exits on startup if `private.pem` is missing or unreadable. This key signs **host** JWTs (`accessToken` on lobby create).

### 3. Install and run

```bash
bun install
bun run dev
```

### 4. Defaults and optional `.env`

Set these in the process environment or in a **`.env`** file in the working directory (loaded via `dotenv`).

| Variable             | Meaning                                                              | What to fill                                        |
| -------------------- | -------------------------------------------------------------------- | --------------------------------------------------- |
| `WEB_PORT`           | TCP port for `/lobbies`, `/sys`, and PeerJS **`/peer`**.             | Integer; default **`8080`**.                        |
| `DASHBOARD_PORT`     | TCP port for the operator UI and **`/api/overview`**.                | Integer; default **`9000`**.                        |
| `HOST` or `HOSTNAME` | Host string printed in startup logs only (does not control binding). | Optional; e.g. `localhost` or your public hostname. |

If you omit the port variables, the defaults above apply.

After `bun run dev`:

- Main API + PeerJS: **http://localhost:8080** (or `WEB_PORT`)
- Dashboard: **http://localhost:9000** (or `DASHBOARD_PORT`)

## Production build

```bash
bun run build
bun run start
```

The build outputs `build/server.js` and copies `public/` and `run.sh` into `build/`. Run from `build/` with `private.pem` and `config/config.json` available (paths are relative to the process working directory).

## Documentation

- **[USAGE.md](./USAGE.md)** — endpoints, request/response shapes, PeerJS usage, dashboard, and operational notes.

## Tests

```bash
bun test
```
