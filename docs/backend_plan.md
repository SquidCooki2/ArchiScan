# Backend Technical Plan

## 1. Goal & Architecture
The backend serves as a secure, fast bridge between the frontend and the Claude Vision API. Its primary responsibility is to keep the API key hidden from the browser, process the incoming image, instruct the high-tier Claude Opus model to act as an architectural parser, and guarantee a cleanly formatted JSON response.

```text
Browser --POST /api/parse-blueprint {image, mediaType}--> Express
   Express: validate -> call Claude (vision) -> extract JSON -> validate/normalize walls
Browser <--200 [ {x,z,width,depth,rotation}, ... ] -------- Express
```

## 2. Tech Stack
*   **Runtime:** Node.js (v20+; installed: v26) with Express 5, CommonJS (`"type": "commonjs"`).
*   **Middleware:** `cors` for cross-origin requests, `express.json({ limit: '50mb' })` to handle large Base64 image payloads.
*   **AI SDK:** `@anthropic-ai/sdk`.
*   **Config:** `dotenv`. No other runtime dependencies are needed. Use the built-in `node:test` runner for tests (no Jest).

> [!NOTE]
> Express 5 differs from v4: async handler errors propagate to error middleware automatically, and wildcard routes must be named (`/*splat`). Check installed versions in `package.json` and the SDK README before coding against the SDK.

## 3. File Layout (`backend/`)
```text
backend/
├── .env                  # git-ignored, real secrets
├── .env.example          # committed, placeholders only
├── .gitignore            # node_modules, .env
├── package.json          # add "start": "node src/server.js", "dev": "node --watch src/server.js", "test": "node --test"
├── docs/
└── src/
    ├── server.js         # loads env, builds app, listens on PORT
    ├── app.js            # express app factory (exported for tests): cors, json, routes, error handler
    ├── config.js         # reads + validates env, exports a frozen config object
    ├── routes/
    │   └── parseBlueprint.js   # POST /api/parse-blueprint handler
    ├── services/
    │   └── claude.js     # Anthropic client + parseBlueprintImage(base64, mediaType) -> raw text
    ├── prompts/
    │   └── blueprintPrompt.js  # exported SYSTEM_PROMPT and USER_PROMPT strings
    ├── lib/
    │   ├── extractJson.js      # pulls a JSON array out of model text
    │   ├── validateWalls.js    # schema check + normalization
    │   └── errors.js           # HttpError class + helpers
    └── __tests__/              # node:test unit tests (extractJson, validateWalls, route with mocked claude service)
```

## 4. Environment Variables (`.env.example`)
```text
PORT=3000
ANTHROPIC_API_KEY=sk-ant-...
ANTHROPIC_MODEL=<highest-tier Opus model id>   # check the Anthropic models docs for the current id
CORS_ORIGIN=http://localhost:5173
MAX_IMAGE_BYTES=5242880                         # 5 MB decoded; Anthropic's per-image limit
```
`config.js` must fail fast on startup (clear message, `process.exit(1)`) if `ANTHROPIC_API_KEY` or `ANTHROPIC_MODEL` is missing. Never log the key.

## 5. API Contract
### `GET /api/health`
Returns `200 { "status": "ok" }`. Used for smoke tests and for the frontend to verify connectivity.

### `POST /api/parse-blueprint`
**Request** (`Content-Type: application/json`):
Accepts either a single floor image or an `images` array for multi-floor buildings (ordered bottom-to-top, up to `MAX_FLOORS = 5`):
```json
// Single floor:
{ "image": "<raw base64, no data: prefix>", "mediaType": "image/png" }

// Multi-floor (each entry may be { image, mediaType } or a raw base64/data-URL string):
{ "images": [{ "image": "<floor 0 base64>", "mediaType": "image/png" }, { "image": "<floor 1 base64>", "mediaType": "image/png" }] }
```
*   `image`: required string (or inside each entry of `images`). If it begins with `data:`, strip the prefix and derive `mediaType` from it (be lenient). Also sniff the magic bytes so mismatched extensions (e.g. WebP named `.png`) are corrected automatically.
*   `mediaType`: one of `image/png`, `image/jpeg`, `image/webp`, `image/gif`. Default `image/png` if omitted and not derivable.
*   Multi-floor processing: parse all floor images in parallel via `Promise.all`, tagging each floor's validated elements with `"floor": floorIndex` (`0`, `1`, ...) before flattening into a single array.

**Success `200`:** a bare JSON array of architectural and furniture elements (`"wall"`, `"window"`, `"door"`, plus the 10 furniture types, with `"floor": 0, 1, ...`, units in **meters**, see Coordinate Convention):
```json
[
  { "type": "wall", "floor": 0, "x": 0.95, "z": 0.12, "width": 1.9, "depth": 0.24, "rotation": 0 },
  { "type": "window", "floor": 0, "x": 2.9, "z": 0.12, "width": 2.0, "depth": 0.24, "rotation": 0, "sillHeight": 0.9, "height": 1.2 },
  { "type": "door", "floor": 1, "x": 6.0, "z": 0.12, "width": 0.9, "depth": 0.24, "rotation": 0, "sillHeight": 0, "height": 2.1 },
  { "type": "couch", "floor": 0, "x": 2.4, "z": 3.1, "rotation": 1.571 }
]
```
**Error responses** always use the shape `{ "error": { "code": "<MACHINE_CODE>", "message": "<human text>" } }`:

| Status | code | When |
|---|---|---|
| 400 | `INVALID_REQUEST` | missing/non-string `image`, bad base64, unsupported `mediaType` |
| 413 | `IMAGE_TOO_LARGE` | decoded image exceeds `MAX_IMAGE_BYTES` (also map express body-parser `entity.too.large`) |
| 422 | `NO_WALLS_FOUND` | model returned an empty array or the image is not a floorplan |
| 502 | `MODEL_OUTPUT_INVALID` | model output could not be parsed/validated even after one retry |
| 429 | `RATE_LIMITED` | Anthropic returned 429 (forward `retry-after` if present) |
| 502 | `UPSTREAM_AUTH` | Anthropic 401/403 (misconfigured key; do not reveal details to client) |
| 504 | `UPSTREAM_TIMEOUT` | Anthropic call timed out |
| 500 | `INTERNAL` | anything else |

## 6. Coordinate Convention (shared with the frontend, authoritative)
*   Units: **meters**, top-down view. Image-right = **+X**, image-down = **+Z**. Y (up) is never output.
*   Origin: the **top-left corner of the floorplan's outer extent** (not the image corner) is `(0, 0)`. Coordinates are therefore non-negative. The frontend recenters the model.
*   Each wall is described by its **center point** `(x, z)`, plus `width` (extent along its local X axis, i.e. its length), `depth` (thickness, extent along local Z), and `rotation`.
*   `rotation` is in **radians** around the Y axis, applied to the box after placing it at its center. `0` = wall runs along X (horizontal in the image); `Math.PI / 2` = runs along Z (vertical in the image). Allowed range `[0, π)`. (Frontend applies it as `rotation-y={-rotation}` if needed so the image's clockwise matches the 3D view; verify visually with a known L-shaped plan and fix on the frontend side only.)
*   **Scale:** if the plan shows dimensions or a scale bar, use them. Otherwise assume a typical interior wall thickness of 0.15–0.25 m, an overall plan that fits a plausible house size, and scale everything consistently.
*   Full wall height is **not** part of the payload; the frontend uses a constant (`WALL_HEIGHT = 2.7` m).
*   **Element types (`type`):**
    *   `"wall"`: solid full-height wall segment. If `type` is omitted, `validateWalls` defaults it to `"wall"`.
    *   `"window"`: placed in the opening between wall segments, matching the host wall's `depth` and `rotation`. Includes `sillHeight` (default `0.9` m) and `height` (default `1.2` m).
    *   `"door"`: placed in the doorway opening between wall segments, matching the host wall's `depth` and `rotation`. Includes `sillHeight` (default `0` m) and `height` (default `2.1` m).
    *   **Furniture (`"couch" | "chair" | "fridge" | "sink" | "bed" | "wardrobe" | "cabinet" | "toilet" | "table" | "bath"`):** placed at center `(x, z)` on `floor`. Because the frontend renders fixed-size 3D models, furniture items omit `width` and `depth`. Their `rotation` is normalized into `[0, 2π)` indicating the direction the front of the item faces (`0` = `+Z`/down, `π/2` = `+X`/right, `π` = `-Z`/up, `3π/2` = `-X`/left). Common aliases (`"cabinets"`, `"bathtub"`, `"sofa"`, `"closet"`, etc.) are mapped to their canonical type in `validateWalls`.

## 7. Claude Integration (`services/claude.js`)
*   Instantiate once: `new Anthropic({ apiKey: config.anthropicApiKey, timeout: 120000, maxRetries: 2 })`.
*   Call `client.messages.create({ model, max_tokens: 8192, temperature: 0, system: SYSTEM_PROMPT, messages: [{ role: 'user', content: [ { type: 'image', source: { type: 'base64', media_type, data } }, { type: 'text', text: USER_PROMPT } ] }] })`. Put the image block **before** the text block.
*   Return the concatenated text of all `content` blocks of type `text`.
*   Do not rely on assistant-message prefill; some current models don't support it. Rely on the prompt plus `extractJson`.
*   Keep this module the **only** place that imports the SDK so tests can mock it.

### Prompt strategy (`prompts/blueprintPrompt.js`)
The system prompt must, in order:
1. Define the role: "You are an architectural floorplan parser."
2. State the coordinate convention from section 6 verbatim, including units, origin, rotation, and the door/window gap rule.
3. State the output rule: "Respond with ONLY a JSON array. No prose, no markdown fences, no comments."
4. Give the exact schema for `"wall"`, `"window"`, and `"door"` objects (including `sillHeight` and `height` for windows and doors), all numbers finite.
5. Include one worked example for a simple 4x3 m rectangular room with a window and a door so the model sees the convention applied.
6. Say: "If the image is not a floorplan, respond with `[]`."
7. Ask it to merge collinear wall segments of the same type and omit furniture, labels, dimensions text, and hatching.

The user text prompt is short: "Parse this floorplan into walls, windows, and doors using the specified JSON format."

## 8. Output Parsing & Validation
*   `extractJson(text)`: try `JSON.parse(text.trim())`; on failure strip ```` ``` ```` fences; on failure take the substring from the first `[` to the last `]`. Throw if none parse to an array.
*   `validateWalls(arr)`: every element must be an object with `type` in `{"wall", "window", "door"}` (defaulting to `"wall"` if omitted) and finite numbers for `x, z, width, depth, rotation`; `width > 0`, `depth > 0`; for `"window"` and `"door"`, validate/default `sillHeight` (`>= 0`, `< 2.7`) and `height` (`> 0`, clamped so `sillHeight + height <= 2.7`); coerce numeric strings; drop unknown keys; round to 3 decimals; normalize `rotation` into `[0, π)`. Reject (throw) if more than 20% of items are invalid, otherwise drop the invalid ones. Cap at 500 elements.
*   If extraction or validation fails, **retry the Claude call once**, appending a follow-up user turn "Your previous output was not valid JSON per the schema. Output only the JSON array." Then fail with `MODEL_OUTPUT_INVALID`.
*   Empty array after validation maps to `NO_WALLS_FOUND`.

## 9. Express Setup (`app.js`)
*   `cors({ origin: config.corsOrigin })` (single explicit origin; no `*`).
*   `express.json({ limit: '50mb' })`.
*   Mount `GET /api/health` and `POST /api/parse-blueprint`.
*   Final error middleware: converts `HttpError` and known SDK errors (`Anthropic.APIError` subclasses, check `err.status`) to the error table in section 5. Unknown errors log `err.message` + stack (never request bodies) and return `INTERNAL`.
*   `server.js` listens on `PORT` (default 3000) and logs one line: `Listening on http://localhost:3000`.
*   Request log: method, path, status, duration, and image byte length only.

## 10. Verification
*   Unit tests (`npm test`): `extractJson` (plain, fenced, prose-wrapped, garbage), `validateWalls` (valid, invalid, rotation normalization), route tests using `supertest`-free `fetch` against `app.listen(0)` with the claude service mocked, covering each row of the error table.
*   Manual: `curl -X POST http://localhost:3000/api/parse-blueprint -H "Content-Type: application/json" -d @sample.json` with a real floorplan image; confirm output renders sensibly in the frontend.
*   Save 2-3 sample floorplans in `backend/docs/samples/` (not in git if large) for repeatable prompt tuning.

## 11. Definition of Done
*   Server starts with a valid `.env` and exits with a clear message without one.
*   All error table cases return the specified status and shape.
*   `npm test` passes; no Base64 or API key ever appears in logs.
*   A real floorplan returns a valid wall array within ~60 seconds.

## 12. Docs Folder Setup (`backend/docs/`)
*   `rules_cowork.md`: Enforce environment variable usage for all secrets. Do not log full Base64 strings to the console to prevent terminal spam. Never commit `.env`. Keep the SDK import isolated in `services/claude.js`. Don't change the coordinate convention or API contract without updating `docs/project_level_plan.md` and `frontend/docs/`.
*   `rules_agents.md`: Instruct agents to focus on rigorous error handling and strict JSON validation before sending responses to the client. Run `npm test` before declaring a task done. Follow the file layout in section 3.
*   `backlog_backend.md`:
    *   [ ] Task 1: Set up Express server and CORS (`app.js`, `server.js`, `/api/health`, npm scripts, `.gitignore`).
    *   [ ] Task 2: Configure `.env`/`.env.example`, `config.js` with fail-fast validation, and initialize the Anthropic SDK in `services/claude.js`.
    *   [ ] Task 3: Write the `/api/parse-blueprint` endpoint (request validation, size check, media type handling).
    *   [ ] Task 4: Craft and test the Claude Vision prompt (section 7) for optimal JSON extraction; implement `extractJson` and `validateWalls` with unit tests and the single retry.
    *   [ ] Task 5: Implement the full error table and error middleware (section 5), plus route tests with a mocked claude service.
    *   [ ] Task 6: End-to-end check with real floorplans together with the frontend; tune prompt and scale handling.
