# Frontend Technical Plan

## 1. Goal & Aesthetic
The primary goal of the frontend is to deliver a highly polished, sleek, and impressive presentation. The UI must feel modern and minimal, allowing the 3D model to be the focal point. Transitions should be smooth, and user interactions (like uploading and slicing the model) must provide immediate visual feedback.

*   **Look:** dark, near-black background (`bg-neutral-950`) with a subtle radial gradient; glass panels (`bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl`); one accent colour (e.g. `indigo-400`); light type (`font-light`, `tracking-tight`).
*   **Motion:** `transition-all duration-300 ease-out` on interactive elements; fade/scale-in for panels.

## 2. Tech Stack
*   **Framework:** React 19 via Vite (JavaScript, `.jsx`). Already scaffolded in `frontend/`.
*   **3D Engine:** React Three Fiber (R3F) v9 + Drei v10 + `three`.
*   **Styling:** Tailwind CSS v4 (installed). 
*   **State:** React `useState` / `useRef`. No state libraries.
*   **Lint:** `npm run lint` (oxlint).

### Tailwind v4 setup (do this first; the `tailwindcss init` step no longer exists)
1. `npm install -D @tailwindcss/vite`
2. In `vite.config.js`: `import tailwindcss from '@tailwindcss/vite'` and `plugins: [react(), tailwindcss()]`.
3. Replace the contents of `src/index.css` with `@import "tailwindcss";`. Delete `src/App.css` and the default Vite demo markup/assets.
4. `postcss` and `autoprefixer` are installed but unused with the Vite plugin; leave them.

## 3. File Layout (`frontend/src/`)
```text
src/
├── main.jsx
├── index.css                 # only @import "tailwindcss";
├── App.jsx                   # owns app state; composes Header, UploadZone, Viewer, SectionControls
├── api/
│   └── parseBlueprint.js     # fileToBase64 + POST to backend, returns walls[]
├── components/
│   ├── Header.jsx
│   ├── UploadZone.jsx        # drag-and-drop + click-to-browse
│   ├── LoadingOverlay.jsx
│   ├── ErrorToast.jsx
│   ├── SectionControls.jsx   # floating glass panel with slider + toggle + reset
│   └── viewer/
│       ├── Viewer.jsx        # <Canvas>, lights, camera, controls, environment
│       ├── Walls.jsx         # maps walls[] -> meshes, centered group
│       ├── Floor.jsx         # ground plane / grid sized to model bounds
│       └── SectionPlane.jsx  # (optional) translucent visual of the cut plane
├── lib/
│   └── geometry.js           # computeBounds(walls), constants
└── samples/
    └── sampleWalls.json      # hardcoded L-shaped plan for developing without the backend
```

## 4. Environment
`frontend/.env` (and a committed `.env.example`): `VITE_API_URL=http://localhost:3000`. Read via `import.meta.env.VITE_API_URL`. Dev server: `npm run dev` on port 5173 (required by the backend CORS config).

## 5. App State & Flow (`App.jsx`)
State: `status` (`'idle' | 'loading' | 'ready' | 'error'`), `walls` (array), `error` (string|null), `previewUrl` (object URL of the uploaded image), `clipEnabled` (bool), `clipHeight` (number, meters).

Flow:
1. `idle`: full-screen centered `UploadZone`; the canvas shows an empty grid behind it (blurred) so the transition feels continuous.
2. User drops/selects a file. Validate on the client: type is `image/png|jpeg|webp|gif`, size ≤ 5 MB. Otherwise show an `ErrorToast` and stay `idle`.
3. `loading`: show `LoadingOverlay` (spinner + rotating status text like "Reading floorplan…", and the image thumbnail). Call the API.
4. `ready`: UploadZone collapses to a small "New upload" button in the header; the model animates in (walls scale up on Y from 0 over ~600 ms, staggered); `SectionControls` appears.
5. `error`: toast with the backend's `error.message`; return to `idle`, keeping the previous model if one exists.

## 6. API Layer (`api/parseBlueprint.js`)
*   `fileToBase64(file)`: use `FileReader.readAsDataURL`, then strip the `data:...;base64,` prefix. Return `{ image: base64, mediaType: file.type }`.
*   `parseBlueprint(files)`: accepts either a single `File` or an array of `File`s (ordered Floor 1, Floor 2, ..., up to 5). For a single file, sends `{ image, mediaType }`; for multiple files, sends `{ images: [{ image, mediaType }, ...] }` to `POST ${VITE_API_URL}/api/parse-blueprint`.
*   On `!res.ok`: parse JSON, throw `new Error(body.error?.message ?? 'Request failed')`. On network failure throw "Cannot reach the server".
*   Success returns the elements array. Check `Array.isArray` and non-empty before updating state.
*   Use an `AbortController` with a 150 s timeout (Claude Opus calls are slow).
*   While the backend is not built, `?mock=1` in the URL (or a missing `VITE_API_URL`) loads `samples/sampleWalls.json` after a 1.5 s artificial delay.

## 7. Data Contract & Coordinates (must match `docs/backend_plan.md` section 6)
Each element in the array has `{ type, floor, x, z, width, depth, rotation, sillHeight?, height? }` in **meters**:
*   `type`: `"wall" | "window" | "door"` (treat missing `type` as `"wall"`).
*   `floor`: non-negative integer (`0` = ground floor, `1` = second floor, etc.; treat missing `floor` as `0` for backwards compatibility).
*   `(x, z)` is the element's **center**; `width` is length along local X; `depth` is thickness along local Z; `rotation` is radians around Y. Origin is the top-left of the plan, +X right, +Z down the image.
*   `sillHeight` and `height`: vertical placement and height in meters for `"window"` (default `0.9` and `1.2`) and `"door"` (default `0` and `2.1`). Full wall height per floor is `WALL_HEIGHT = 2.7`. 

## 8. 3D Viewer
### Canvas & camera
`<Canvas shadows camera={{ position: [10, 10, 10], fov: 45 }} gl={{ localClippingEnabled: true }}>`. Full-bleed: wrapper `fixed inset-0`. `localClippingEnabled` is **required** for per-material clipping planes.

### Lighting & environment
`<ambientLight intensity={0.4} />`, a `<directionalLight castShadow position={[8, 12, 6]} intensity={1.5} shadow-mapSize={[2048, 2048]} />`, and Drei `<Environment preset="city" />` for reflections. Optional `<ContactShadows>` under the model.

### Controls
Drei `<OrbitControls makeDefault enableDamping maxPolarAngle={Math.PI / 2 - 0.05} />` (prevents going below the floor). After walls load, fit the camera: compute bounds, then set the controls target to the model center and position the camera at about `maxDim * 1.5` away. Use Drei `<Bounds fit clip observe>` as a simple alternative.

### Walls, Windows & Doors (`Walls.jsx`)
*   Constants in `lib/geometry.js`: `WALL_HEIGHT = 2.7`.
*   `computeBounds(elements)` returns `{ minX, maxX, minZ, maxZ, cx, cz, size }` using element centers ± `width/2` (rough extent is fine).
*   Render `<group position={[-cx, 0, -cz]}>` so the model is centered at the world origin.
*   Create shared materials (`useMemo`) that all reference `clippingPlanes={[plane]}` and `clipShadows`:
    *   `wallMaterial`: `meshStandardMaterial({ color: '#e8e6e1', roughness: 0.85, metalness: 0, side: THREE.DoubleSide })`
    *   `windowMaterial`: `meshStandardMaterial({ color: '#93c5fd', transparent: true, opacity: 0.35, roughness: 0.1, metalness: 0.1, side: THREE.DoubleSide })`
    *   `doorMaterial`: `meshStandardMaterial({ color: '#8b5a2b', roughness: 0.65, metalness: 0.05, side: THREE.DoubleSide })`
*   For each element `w` (defaulting `w.type ?? 'wall'`):
    *   **`"wall"`**: a single full-height box at `[w.x, WALL_HEIGHT / 2, w.z]` with size `[w.width, WALL_HEIGHT, w.depth]` and `wallMaterial`.
    *   **`"window"`** (`sill = w.sillHeight ?? 0.9`, `h = w.height ?? 1.2`, `topH = Math.max(0, WALL_HEIGHT - (sill + h))`):
        *   Sill wall (if `sill > 0`): box `[w.width, sill, w.depth]` at `y = sill / 2` using `wallMaterial`.
        *   Header/lintel wall (if `topH > 0`): box `[w.width, topH, w.depth]` at `y = sill + h + topH / 2` using `wallMaterial`.
        *   Glass pane: box `[w.width, h, Math.min(w.depth * 0.25, 0.04)]` at `y = sill + h / 2` using `windowMaterial`.
    *   **`"door"`** (`sill = w.sillHeight ?? 0`, `h = w.height ?? 2.1`, `topH = Math.max(0, WALL_HEIGHT - (sill + h))`):
        *   Header/lintel wall (if `topH > 0`): box `[w.width, topH, w.depth]` at `y = sill + h + topH / 2` using `wallMaterial`.
        *   Door panel: box `[w.width, h, Math.min(w.depth * 0.4, 0.06)]` at `y = sill + h / 2` using `doorMaterial`.
*   Apply `const floorY = (w.floor ?? 0) * WALL_HEIGHT` and `rotation={[0, -w.rotation, 0]}` on each element's `<group position={[w.x, floorY, w.z]} rotation={[0, -w.rotation, 0]}>` so child meshes only need local `[0, y, 0]` positions and multi-floor elements stack automatically.
*   If the payload contains upper floors (`maxFloor > 0`), render a thin translucent floor slab at `y = f * WALL_HEIGHT` for each upper floor `f = 1..maxFloor` sized to that floor's bounds, clipped by the same section plane.
*   Use `key={index}`.

### Floor (`Floor.jsx`)
A `<mesh rotation-x={-Math.PI / 2}>` plane at `y = 0` slightly larger than the bounds (`size + 4`), dark material that receives shadows, plus Drei `<Grid infiniteGrid fadeDistance={40} cellColor="#333" sectionColor="#555" />`.

## 9. Section View (clipping plane)
*   Compute `totalHeight = (maxFloor + 1) * WALL_HEIGHT` (where `maxFloor = Math.max(0, ...walls.map(w => w.floor ?? 0))`).
*   Create one plane: `const plane = useMemo(() => new THREE.Plane(new THREE.Vector3(0, -1, 0), clipHeight), [])` and update `plane.constant = clipHeight` in `useEffect`/`useFrame` when state changes. A normal of `(0, -1, 0)` keeps everything **below** `y = clipHeight`; the plane is `-y + constant >= 0` so `constant = clipHeight` cuts at that height.
*   Slider: `<input type="range" min={0.1} max={totalHeight} step={0.01}>` in `SectionControls`, default value `totalHeight` (no cut). Show the current height as `1.35 m` text (and optionally quick-jump floor buttons when `maxFloor > 0`). A "Section view" toggle sets `clipEnabled`; when disabled, pass `clippingPlanes={[]}`.
*   Style the slider via Tailwind (`accent-indigo-400 w-full`), in a floating glass panel `fixed bottom-6 left-1/2 -translate-x-1/2 w-80`.
*   Clipped walls appear hollow when cut. Provide a cap: render each wall also with a `BackSide` material in a flat accent colour (`side: THREE.BackSide`, same clipping plane) so the cut interior reads as a solid fill. Do this once the basics work (stretch goal).
*   Optional stretch: a second slider or buttons to cut along X or Z axes.

## 10. UI Components
*   **Header:** fixed top bar, app name "ArchiScan", glass style, "New upload" button when `status === 'ready'`.
*   **UploadZone:** dashed border `border-white/20`, `hover:border-indigo-400/60 hover:bg-white/10`, highlights on `dragover`. Hidden `<input type="file" accept="image/*">`; the whole zone is clickable and keyboard accessible (`role="button"`, `tabIndex={0}`, Enter/Space opens the dialog).
*   **LoadingOverlay:** `fixed inset-0 backdrop-blur-md bg-black/40`, spinner via Tailwind `animate-spin`.
*   **ErrorToast:** top-right, red-tinted glass, auto-dismiss after 6 s, with a close button.
*   Responsive: works at 1280 px and above; the controls panel should remain usable on narrow screens (`max-w-[90vw]`).

## 11. Verification
*   `npm run build` and `npm run lint` pass with no errors.
*   With `?mock=1` (or the backend running): upload, loading, model appearance, orbit/zoom, and slider cut all work, and the model is centered and visible without manual camera moves.
*   A known asymmetric L-shaped sample renders with the same orientation as the source image (not mirrored).
*   Error paths: wrong file type, a file over 5 MB, backend offline, and a backend error response each display a toast and do not crash.
*   Run with the real backend end to end using a real floorplan image.

## 12. Definition of Done
All backlog tasks are checked, section 11 passes, no console errors or warnings in the browser, no custom CSS beyond `@import "tailwindcss"`, and no leftover Vite demo code.

## 13. Docs Folder Setup (`frontend/docs/`)
*   `rules_cowork.md`: Enforce strict Tailwind utility class usage. No custom CSS unless absolutely necessary. Componentize UI elements cleanly. Follow the file layout in section 3. Don't change the data contract or coordinate convention without updating `docs/project_level_plan.md` and `backend/docs/`.
*   `rules_agents.md`: Instruct agents to prioritize React Three Fiber declarative syntax over vanilla Three.js imperative code. Develop against `?mock=1` so frontend work is not blocked on the backend. Run `npm run lint` and `npm run build` before declaring a task done.
*   `backlog_frontend.md`:
    *   [ ] Task 0: Configure Tailwind v4 via `@tailwindcss/vite`, strip Vite demo code, add `.env.example`.
    *   [ ] Task 1: Scaffold UI layout (Header, Upload Zone, Floating Controls) with the app state machine in `App.jsx`.
    *   [ ] Task 2: Implement Base64 image conversion and API fetch logic (`api/parseBlueprint.js`, with mock mode and error handling).
    *   [ ] Task 3: Set up R3F `<Canvas>`, lighting, floor/grid, and camera controls with auto-fit.
    *   [ ] Task 4: Map JSON payload to 3D BoxGeometries (centered group, shared material, entrance animation); verify orientation against the sample.
    *   [ ] Task 5: Implement clipping plane slider logic (toggle, slider, height readout).
    *   [ ] Task 6: Polish: error toast, loading overlay, hover/transition effects, optional wall caps, responsive check.
    *   [ ] Task 7: End-to-end test with the real backend and real floorplans.
