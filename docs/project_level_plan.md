# Project Level Planning & Initialization

## 1. Project Overview
This project is a rapid-prototype web application that takes 2D floorplan images and generates interactive 3D models with section-view capabilities. Its primary blueprint parser is a specialized Convolutional Neural Network (**Mask R-CNN** trained on the open-source **CubiCasa5k** floorplan dataset) that performs pixel-level classification into per-class binary masks (walls, windows, doors, stairs, and furniture/fixtures) and vectorizes connected mask regions into meter-space 3D geometry. If the local CNN weights file (`CNN_WEIGHTS_PATH`) is not present on disk, the backend automatically falls back to Claude's highest-tier Opus vision model.

## 2. Folder Structure
The repository is split into distinct environments for separation of concerns, with documentation folders at every layer for AI agents and human contributors.

```text
/ (Root)
├── docs/                     # Top-level project rules and backlogs
│   ├── rules_cowork.md       # Global collaboration rules
│   ├── backlog_project.md    # High-level epic tracking
│   └── rules_agents.md       # Global instructions for AI agents
├── frontend/                 # React/Three.js application
│   ├── docs/                 # Frontend-specific rules/backlogs
│   ├── src/
│   └── package.json
└── backend/                  # API and Claude Integration
    ├── docs/                 # Backend-specific rules/backlogs
    ├── src/
    └── package.json
```

## 3. First Build Instructions
To initialize the workspace for all contributors, run the following commands in the terminal:

1. **Create Root & Docs:**
   ```bash
   mkdir -p docs frontend/docs backend/docs
   touch docs/rules_cowork.md docs/backlog_project.md docs/rules_agents.md
   ```
2. **Initialize Frontend:**
   ```bash
   cd frontend
   npm create vite@latest . -- --template react
   npm install three @react-three/fiber @react-three/drei tailwindcss postcss autoprefixer
   touch docs/rules_cowork.md docs/backlog_frontend.md docs/rules_agents.md
   cd ..
   ```
3. **Initialize Backend:**
   ```bash
   cd backend
   npm init -y
   npm install express cors dotenv @anthropic-ai/sdk
   touch docs/rules_cowork.md docs/backlog_backend.md docs/rules_agents.md
   cd ..
   ```

> [!NOTE]
> **Setup status / gotchas (Windows):** Steps 1-3 above have already been run; `frontend/` and `backend/` are scaffolded with dependencies installed (Node v26, npm 11). `npm create vite` refuses to run in a non-empty folder (`frontend/docs/` counts), so the scaffold was generated in a temp folder and copied in. In PowerShell, use `npm.cmd` if script execution is disabled, and `New-Item -ItemType File` instead of `touch`. Tailwind v4 has no `init` command; see `frontend/docs/` and `docs/frontend_plan.md` section 2 for the Vite plugin setup.

## 4. Frontend-Backend Integration Guide
To ensure seamless operation between the two layers:
*   **CORS:** The backend must be configured with a CORS policy that explicitly allows requests from the frontend's local development port (usually `http://localhost:5173`).
*   **API Contract:** The frontend will send a `POST` request to `/api/parse-blueprint` containing either a single Base64 image (`{ image, mediaType }`) or an ordered array of floor images (`{ images: [{ image, mediaType }, ...] }`).
*   **Data Format:** The backend must return a strict JSON array of objects representing structural elements (`wall`, `window`, `door`, `stairs`) and furniture (`couch`, `chair`, `fridge`, `sink`, `bed`, `wardrobe`, `cabinet`, `toilet`, `table`, `bath`) across all floors.
*   **Environment Variables:** The frontend will use `VITE_API_URL=http://localhost:3000` to locate the backend. The backend will use `ANTHROPIC_API_KEY` to securely communicate with Claude.

## 5. Authoritative Contract (single source of truth)
Detailed plans: [frontend_plan.md](frontend_plan.md) and [backend_plan.md](backend_plan.md). If they ever disagree with this section, update all three together.

**Request:** `POST {VITE_API_URL}/api/parse-blueprint`, `Content-Type: application/json`
```json
// Single floor (backwards-compatible):
{ "image": "<raw base64 or data: URL>", "mediaType": "image/png" }

// Multi-floor (ordered bottom-to-top: index 0 = ground floor, up to 5 floors):
{ "images": [{ "image": "<floor 0 base64>", "mediaType": "image/png" }, { "image": "<floor 1 base64>", "mediaType": "image/png" }] }
```
**Success (200):**
```json
[
  { "type": "wall", "floor": 0, "x": 0.95, "z": 0.12, "width": 1.9, "depth": 0.24, "rotation": 0 },
  { "type": "window", "floor": 0, "x": 2.9, "z": 0.12, "width": 2.0, "depth": 0.24, "rotation": 0, "sillHeight": 0.9, "height": 1.2 },
  { "type": "door", "floor": 1, "x": 6.0, "z": 0.12, "width": 0.9, "depth": 0.24, "rotation": 0, "sillHeight": 0, "height": 2.1 },
  { "type": "stairs", "floor": 0, "x": 11.45, "z": 5.8, "width": 3.4, "depth": 1.1, "rotation": 3.142 },
  { "type": "couch", "floor": 0, "x": 2.4, "z": 3.1, "rotation": 1.571 }
]
```
*   `type`:
    *   Walls/Windows/Doors: `"wall" | "window" | "door"` (defaults to `"wall"` if omitted for backwards compatibility). Includes `width`, `depth`, and `rotation` in `[0, PI)`.
    *   Stairs: `"stairs"`. **Procedurally generated by the frontend** (not a static GLTF model) from `{ type: "stairs", floor, x, z, width, depth, rotation }`. Emitted only on the lower floor from which the staircase ascends (`UP`); `"DN"` stairs on upper floors are ignored to avoid duplicating the staircase in the same shaft. Includes `width` (stair run length along direction of travel), `depth` (tread width), and `rotation` in `[0, 2*PI)` indicating the ascending (`UP`) direction (`0` = `+Z`/down, `PI/2` = `+X`/right, `PI` = `-Z`/up, `3*PI/2` = `-X`/left).
    *   Furniture: `"couch" | "chair" | "fridge" | "sink" | "bed" | "wardrobe" | "cabinet" | "toilet" | "table" | "bath"`. All 10 types use pre-authored 3D models in `frontend/public/assets/furniture/` (KayKit `.gltf` models for `couch`, `chair`, `bed`, `cabinet`, `wardrobe`, `table`, and Kenney `.glb` models `fridge.glb`, `sink_kitchen.glb` / `sink_bathroom.glb`, `toilet.glb`, `bathtub.glb`), so `width` and `depth` are omitted from the JSON; `rotation` is in `[0, 2*PI)` indicating the direction the front of the item faces (`0` = `+Z`/down, `PI/2` = `+X`/right, `PI` = `-Z`/up, `3*PI/2` = `-X`/left). **Sizing note:** KayKit `.gltf` models are ~1.5–2× real-world size (scale down `~0.55x`) while Kenney `.glb` fixtures are ~0.5× real-world size with corner origins (scale up `~2x` and recenter via `THREE.Box3`).
*   `floor`: non-negative integer (`0` = ground floor, `1` = second floor, etc.; defaults to `0` if omitted for backwards compatibility).
*   `sillHeight` and `height` (meters): included on `"window"` (default `0.9` / `1.2`) and `"door"` (default `0` / `2.1`). Full wall height per floor is a frontend constant of `2.7` m.

**Error:** `{ "error": { "code": "INVALID_REQUEST", "message": "..." } }` with status 400/413/422/429/502/504/500 (full table in `backend_plan.md` section 5). The frontend displays `error.message`.

**Coordinates:** meters; top-down; origin at top-left of the plan's outer extent; +X = image right; +Z = image down; `(x, z)` = element center; `width` = length along local X, `depth` = thickness; `rotation` = radians about Y in `[0, PI)` (0 = runs along X). Walls are split around openings, and `"window"` / `"door"` elements are placed in those openings with matching `depth` and `rotation`.

**Limits:** images up to 5 MB (png/jpeg/webp/gif); request body up to 50 MB; frontend timeout 150 s.

## 5a. Evacuation Brief Contract
Optional AI explanation of an escape route. The frontend computes the route; this endpoint only writes about it. Routes cover every floor and follow the `stairs` elements down. `facts.outcome` is `route`, `window`, or `shelter`; someone upstairs who is told to signal from a window counts as `shelter`.

**Request:** `POST {VITE_API_URL}/api/evacuation-brief`
```json
{
  "facts": {
    "outcome": "route | window | shelter",
    "rooms": [{ "id": 0, "name": "Room 1", "areaSquareMeters": 34.5, "acrossPlan": 0.51, "downPlan": 0.22 }],
    "fire": { "roomId": 0, "acrossPlan": 0.83, "downPlan": 0.12 },
    "person": { "roomId": 1, "nextToFire": false, "acrossPlan": 0.19, "downPlan": 0.68 },
    "route": { "meters": 7.0, "exit": "door | opening | window", "closestMetersToFire": 4.13, "passesThroughFireRoom": true },
    "outsideDoorsCutOff": 0,
    "backupWindowMeters": 2.33,
    "steps": ["Walk 2.4 m to the door. Go through it and close it behind you."]
  },
  "image": "<optional raw base64 of the floorplan>",
  "mediaType": "image/png"
}
```
**Success (200):** `{ "brief": "Leave by the door...", "roomNames": [{ "id": 0, "name": "Living / Kitchen" }] }`

**Error:** same format as section 5. `route` is `null` when `outcome` is `shelter`.

## 6. Local Development
| Item | Value |
|---|---|
| Backend | `cd backend && npm run dev` (port 3000) |
| Frontend | `cd frontend && npm run dev` (port 5173) |
| Backend env | `backend/.env`: `PORT`, `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL`, `CORS_ORIGIN`, `MAX_IMAGE_BYTES` |
| Frontend env | `frontend/.env`: `VITE_API_URL=http://localhost:3000` |
| Health check | `GET http://localhost:3000/api/health` returns `{ "status": "ok" }` |

Both apps can be built in parallel: the frontend develops against `?mock=1` sample data and the backend against curl plus mocked Claude responses.

## 7. Git & Secrets
*   Add a root `.gitignore` covering `node_modules/`, `.env`, `dist/`, and logs. `.env.example` files are committed; real `.env` files never are.
*   Never log or commit the API key or full Base64 payloads.
*   Small, focused commits per backlog task.

## 8. Milestones
1. **M0 Setup (done):** folders, dependencies, docs.
2. **M1 Parallel build:** frontend Tasks 0-5 against mock data; backend Tasks 1-5 with tests.
3. **M2 Integration:** both servers running, real floorplan uploads end to end (frontend Task 7, backend Task 6); tune the prompt.
4. **M3 Polish:** wall caps, animations, responsive checks.

## 9. Project Definition of Done
*   Uploading a floorplan image returns a 3D model that matches the plan's layout and orientation within a reasonable tolerance.
*   The section slider cuts the model smoothly from the top down.
*   Errors (bad file, server down, API failure) surface as clear messages with no crashes.
*   `npm run build` and `npm run lint` pass in `frontend/`; `npm test` passes in `backend/`.

## 10. Agent Instructions
*   Pick one app (frontend or backend), read its plan in `docs/` plus its `rules_*.md` and `backlog_*.md` under `<app>/docs/`, and work through the backlog in order, ticking items off as you finish them.
*   Stay inside your app's folder unless changing the shared contract; if you must, update this section and both plan files in the same change.
*   Update `docs/backlog_project.md` when a milestone is reached.
