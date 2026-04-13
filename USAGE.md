# LobbyRTC — usage

This document describes how to run the server and how to call every HTTP endpoint: what to send, what you get back, and how clients are expected to behave.

## Base URLs

| Service | Default URL | Notes |
|--------|-------------|--------|
| Main API + PeerJS | `http://localhost:8080` | Set `WEB_PORT` to change. |
| Dashboard (UI + JSON) | `http://localhost:9000` | Set `DASHBOARD_PORT` to change. |

CORS is enabled on the main app with **`Access-Control-Allow-Origin: *`**.

All JSON APIs expect **`Content-Type: application/json`** on requests with a body.

---

## Concepts

### Game id (`:game`)

Routes use a **numeric game id** (e.g. `1`, `2`). This is the **`game.id`** row in SQLite, not the game name. For a new database, ids usually follow the order of entries in `config/config.json`. Use the **dashboard overview** (below) to see actual ids, names, and `maxPlayers`.

### Lobby token (`:token`)

A short string (default length **6**, alphanumeric) returned when a lobby is created. It identifies the room together with the game id.

### `webRTCId`

The **PeerJS id** (or analogous signaling id) that other players should use to connect to the host. You store whatever string your client obtained from PeerJS (or your WebRTC layer). The server does not validate the format beyond “non-empty string.”

### `playersCount`

An integer the **host** maintains:

- Should reflect how many players are in the room (or a policy your product defines).
- Used for **visible lobby lists** and **quick play**: only lobbies with **`0 < playersCount < maxPlayers`** are join candidates (`maxPlayers` comes from the `game` row).
- Setting **`playersCount` to `0`** via `PUT /lobbies/players` **deletes** the lobby.

Keep this updated while players join or leave so matchmaking stays accurate.

### `visible`

Boolean (default **true** if omitted on create). **Hidden** lobbies (`visible: false`) do **not** appear in `GET .../visibles` or `GET .../quick-play`, but can still be opened if you know the **token** (`GET .../:token`).

### `accessToken`

Returned on **create lobby**. It is a **JWT** (RS384, signed with `private.pem`, **2-hour** expiry) whose payload contains `{ token, game }` (lobby token + game id).

You need it for:

- `PUT /lobbies/players`
- `DELETE /lobbies/`

Treat it as a **host secret**. Clients that should not control the room must not receive it.

### Password-protected lobbies

Optional `password` on create (plain string stored server-side).

- **Listing** (`visibles`): each row may include `"password": "true"` (literal string) to mean “protected,” not the secret itself.
- **Quick play** only considers lobbies **without** a password.
- **Fetch by token** (`GET .../:token`): if a password is set, the server requires **`Authorization: Basic ...`**. It decodes Base64 credentials as `user:password` and compares **`password`** to the stored lobby password (see examples below).

Avoid colon characters in the password if you rely on simple `split(':')` parsing on the client side; the server uses the same split for the Basic payload.

---

## PeerJS signaling

The PeerJS server is attached to the **same HTTP server** as the REST API, under **`/peer`**.

When configuring a PeerJS client, use the **same host and port** as `WEB_PORT`, and set the client **`path`** option to match the mount (**`/peer`**). Consult the [PeerJS client docs](https://peerjs.com/docs/) for the exact options for your version.

The server logs Peer connect/disconnect and errors on the “peer” logger.

---

## System routes (`/sys`)

### `GET /sys/healthz`

Liveness probe.

- **Response:** `200` with body `ok` (plain text).

### `GET /sys/readyz`

Readiness: all flags in `global.readiness` must be true.

- **Response `200`:** JSON object, e.g. `{ "dataSource": true, "peer": true, "web": true, "games": true, "cleaner": true }`.
- **Response `500`:** same shape, with at least one `false` — server is not fully ready.

---

## Lobby routes (`/lobbies`)

Unless noted, errors may return JSON like:

```json
{ "error": "message" }
```

or, on some failures:

```json
{ "error": "Internal server error", "errorDetails": ... }
```

### `POST /lobbies/:game`

Create a lobby.

**Path**

- `:game` — positive integer game id.

**Body (JSON)**

| Field | Required | Type | Notes |
|-------|----------|------|--------|
| `webRTCId` | yes | string | Non-empty. |
| `visible` | no | boolean | Default `true`. |
| `playersCount` | no | number | Default `1`. |
| `password` | no | string | If non-empty, lobby is password-protected. |

**Responses**

- **`201`** — JSON:

  ```json
  { "token": "ABC12D", "accessToken": "<jwt>" }
  ```

- **`400`** — invalid game id, or missing `webRTCId`.
- **`500`** — server error.

**Your responsibilities:** persist `accessToken` securely on the host; broadcast `token` (and game id) to guests as needed; keep `playersCount` updated via `PUT /lobbies/players`.

---

### `GET /lobbies/:game/visibles`

List **visible** lobbies that are not full and have at least one player, for matchmaking UIs.

**Path**

- `:game` — positive integer game id.

**Responses**

- **`200`** — JSON array of objects:

  ```json
  [
    { "token": "ABC12D", "playersCount": 3 },
    { "token": "XYZ99Z", "playersCount": 2, "password": "true" }
  ]
  ```

  - `password` is the string `"true"` when a password is set; otherwise the field is omitted.
  - Hidden lobbies never appear.

- **`400`** — invalid game id.
- **`500`** — server error.

**Side effect:** If the query finds visible lobbies that are **not** join candidates (e.g. `playersCount === 0` or full), the server may **delete** those rows via an internal cleanup path (`emptyLobbies`). Design clients so abandoned lobbies are removed or updated, not left at `playersCount === 0` indefinitely.

---

### `GET /lobbies/:game/quick-play`

Pick a **random** visible, **unpassworded** lobby among those with **`0 < playersCount < maxPlayers`**. Among eligible lobbies, those with the **minimum** `playersCount` are preferred; one is chosen at random from that tier.

**Path**

- `:game` — positive integer game id.

**Responses**

- **`200`** — JSON:

  ```json
  {
    "webRTCId": "<peer-id>",
    "token": "ABC12D",
    "playersCount": 2
  }
  ```

- **`404`** — no suitable visible lobby (`{ "error": "No visible lobbies" }`).
- **`400`** — invalid game id.
- **`500`** — server error.

Same **side effect** as visibles regarding cleaning non-candidate visible lobbies.

---

### `GET /lobbies/:game/:token`

Fetch connection info for a known lobby.

**Path**

- `:game` — positive integer game id.
- `:token` — lobby token string.

**Headers (password lobbies only)**

- `Authorization: Basic <base64("anyUser:" + password)>`  
  Example: user `u` and password `secret` → `Authorization: Basic dTpzZWNyZXQ=`

**Responses**

- **`200`** — JSON:

  ```json
  { "webRTCId": "<peer-id>", "playersCount": 4 }
  ```

  The response does **not** include the password.

- **`401`** — password required but header missing or not `Basic ...`.
- **`403`** — wrong password.
- **`404`** — lobby not found.
- **`400`** — missing/invalid game or token parameters.
- **`500`** — server error.

---

### `PUT /lobbies/players`

Update `playersCount` or delete the lobby by setting count to **0**.

**Body (JSON)**

| Field | Required | Type | Notes |
|-------|----------|------|--------|
| `accessToken` | yes | string | JWT from create. |
| `playersCount` | yes | number | If `0`, lobby is **deleted**. |

**Responses**

- **`200`** — empty body on success.
- **`400`** — missing/invalid `accessToken` or invalid `playersCount`.
- **`404`** — lobby not found for token/game in JWT.
- **`500`** — server error (invalid/expired JWT may surface here).

---

### `DELETE /lobbies/`

Delete a lobby (host operation).

**Body (JSON)**

| Field | Required | Type |
|-------|----------|------|
| `accessToken` | yes | string |

**Responses**

- **`200`** — empty body.
- **`400`** — missing `accessToken`.
- **`404`** — lobby not found.
- **`500`** — server error.

---

## Dashboard

The dashboard is a **separate Express app** (default port **9000**).

### `GET /`

Serves the static dashboard UI (`public/index.html`): games, lobbies, server stats, cleaner schedule (as implemented in the page).

### `GET /api/overview`

JSON snapshot for monitoring.

**Response `200`** — JSON with roughly:

- `server` — `uptimeSec`, `cpuUsage`, `memoryUsage`, `now`, `readiness` flags.
- `usage` — cumulative counters such as `httpRequestsTotal`, `lobbiesRequestsTotal`.
- `games` — array of games with `id`, `name`, `maxPlayers`, lobby aggregates, and per-lobby `token`, `playersCount`, `visible`, `webRTCId`.
- `cleaner` — `lastDeletedCount`, `previous` / `next` ISO timestamps for the cleanup interval.

---

## Storage and housekeeping

- **Database:** SQLite file **`lobbies.sql`** in the process working directory (TypeORM `synchronize: true` — schema is managed automatically).
- **Periodic cleaner:** Every **15 minutes**, lobbies with **`updatedAt` older than 30 minutes** are deleted. Keep `playersCount` (and thus lobby activity) honest, or refresh lobbies as your product requires.
- **Access tokens** expire after **2 hours**. After expiry, `PUT`/`DELETE` with that JWT will fail; the host may need to recreate the lobby or you may extend your product to refresh tokens if you add that server-side.

---

## Example flow (public lobby)

1. Host opens PeerJS, gets id `my-host-peer-id`.
2. `POST /lobbies/2` with `{ "webRTCId": "my-host-peer-id", "playersCount": 1 }` → save `accessToken`, share `token` with friends (game `2` is your Catan id, for example).
3. Guest `GET /lobbies/2/ABC12D` → read `webRTCId`, connect with PeerJS.
4. As people join, host repeatedly `PUT /lobbies/players` with increasing `playersCount`.
5. When the room ends, host `PUT` with `playersCount: 0` or `DELETE /lobbies/` with `accessToken`.

---

## Example flow (quick play)

1. Guest `GET /lobbies/2/quick-play` → receives `token`, `webRTCId`, `playersCount`.
2. Guest connects to `webRTCId`; optionally joins the lobby token in your game logic.
3. Host is responsible for incrementing `playersCount` when this guest is admitted.

This matches how a public web client such as **[itaylayzer.github.io/catan.io/](https://itaylayzer.github.io/catan.io/)** would discover a room, with this repo providing the backend API and signaling.
