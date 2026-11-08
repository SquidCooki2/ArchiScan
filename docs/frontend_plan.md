# Frontend Technical Plan

## 1. Goal & Aesthetic
The primary goal of the frontend is to deliver a highly polished, sleek, and impressive presentation. The UI must feel modern and minimal, allowing the 3D model to be the focal point. Transitions should be smooth, and user interactions (like uploading and slicing the model) must provide immediate visual feedback.

*   **Look:** a homely textured house on a dark drafting table (`#171c22`), with solid panels (`#20262e`). Drafting blue (`#7cb7ff`) marks cuts and selection only; green and orange appear only in escape mode. One typeface, Archivo. See `frontend/src/components/ui.jsx`.
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
├── App.jsx                   # owns app state; composes Header, Landing, Viewer, and the mode panels
├── api/
│   └── parseBlueprint.js     # fileToBase64 + POST to backend, returns walls[]
├── components/
│   ├── Header.jsx
│   ├── Landing.jsx           # first screen: upload and samples, with drop anywhere
│   ├── LoadingOverlay.jsx
│   ├── ErrorToast.jsx
│   ├── ExplorePanel.jsx      # floors, roof, cut slider, more options
│   ├── WalkPanel.jsx         # choosing a spot, then walking controls
│   ├── EvacuationPanel.jsx   # fire, person, and route
│   ├── BomPanel.jsx          # bill of materials and schedules
│   ├── ExportMenu.jsx        # downloads for other software
│   └── viewer/
│       ├── Viewer.jsx        # <Canvas>, lights, camera, controls, environment
│       ├── Walls.jsx         # maps walls[] -> meshes, centered group
│       ├── Floor.jsx         # ground plane / grid sized to model bounds
│       ├── surfaces.js       # plaster, siding, planks and shingles painted in the browser
│       ├── furnitureGeometry.js  # merges, colors and fits a furniture model
│       ├── fixtureFinishes.js    # porcelain, brass, oak and towels for the fixtures
│       └── SectionPlane.jsx  # (optional) translucent visual of the cut plane
├── lib/
│   ├── geometry.js           # computeBounds(walls), constants
│   ├── billOfMaterials.js    # quantities, schedules and checks from the plan
│   ├── exports.js            # CSV, DXF and JSON files
│   ├── prices.js             # rough unit prices for the bill
│   ├── settleFurniture.js    # moves or trims furniture clear of walls, stairs and each other
│   └── surfaceUv.js          # texture coordinates in meters
└── samples/
    └── sampleWalls.json      # hardcoded L-shaped plan for developing without the backend
```

## 4. Environment
`frontend/.env` (and a committed `.env.example`): `VITE_API_URL=http://localhost:3000`. Read via `import.meta.env.VITE_API_URL`. Dev server: `npm run dev` on port 5173 (required by the backend CORS config).

## 5. App State & Flow (`App.jsx`)
State: `status` (`'idle' | 'loading' | 'ready' | 'error'`), `walls` (array), `error` (string|null), `previewUrl` (object URL of the uploaded image), `clipEnabled` (bool), `clipHeight` (number, meters).

Flow:
1. `idle`: `Landing` beside a live 3D sample model that rises and slowly turns, showing what the product does.
2. User drops/selects a file. Validate on the client: type is `image/png|jpeg|webp|gif`, size ≤ 5 MB. Otherwise show an `ErrorToast` and stay `idle`.
3. `loading`: show `LoadingOverlay` (spinner + rotating status text like "Reading floorplan…", and the image thumbnail). Call the API.
4. `ready`: Landing gives way to the mode switch and a "New plan" button in the header; the model animates in (walls scale up on Y from 0 over ~600 ms, staggered); `SectionControls` appears.
5. `error`: toast with the backend's `error.message`; return to `idle`, keeping the previous model if one exists.

## 6. API Layer (`api/parseBlueprint.js`)
*   `fileToBase64(file)`: use `FileReader.readAsDataURL`, then strip the `data:...;base64,` prefix. Return `{ image: base64, mediaType: file.type }`.
*   `parseBlueprint(files)`: accepts either a single `File` or an array of `File`s (ordered Floor 1, Floor 2, ..., up to 5). For a single file, sends `{ image, mediaType }`; for multiple files, sends `{ images: [{ image, mediaType }, ...] }` to `POST ${VITE_API_URL}/api/parse-blueprint`.
*   On `!res.ok`: parse JSON, throw `new Error(body.error?.message ?? 'Request failed')`. On network failure throw "Cannot reach the server".
*   Success returns the elements array. Check `Array.isArray` and non-empty before updating state.
*   Use an `AbortController` with a 150 s timeout (Claude Opus calls are slow).
*   While the backend is not built, `?mock=1` in the URL (or a missing `VITE_API_URL`) loads `samples/sampleWalls.json` after a 1.5 s artificial delay.

## 7. Data Contract & Coordinates (must match `docs/backend_plan.md` section 6)
Each element in the array is either a **sized structural element** (`{ type, floor, x, z, width, depth, rotation, sillHeight?, height? }` for `wall`, `window`, `door`, `stairs`) or a **furniture element** (`{ type, floor, x, z, rotation }`) in **meters**:
*   `type`:
    *   Structural: `"wall" | "window" | "door" | "stairs"` (treat missing `type` as `"wall"`).
    *   Furniture: `"couch" | "chair" | "fridge" | "sink" | "bed" | "wardrobe" | "cabinet" | "toilet" | "table" | "bath"`.
*   `floor`: non-negative integer (`0` = ground floor, `1` = second floor, etc.; treat missing `floor` as `0` for backwards compatibility).
*   `(x, z)` is the element's **center**; origin is the top-left of the plan, +X right, +Z down the image.
*   For `"wall"`, `"window"`, and `"door"`, `width` is length along local X; `depth` is thickness along local Z; `rotation` is radians around Y in `[0, π)`. `sillHeight` and `height` give vertical placement and height for `"window"` (default `0.9` and `1.2`) and `"door"` (default `0` and `2.1`). Full wall height per floor is `WALL_HEIGHT = 2.7`.
*   For `"stairs"`, `width` is the stair run length, `depth` is the tread width, and `rotation` is in `[0, 2π)` indicating the ascending (`UP`) direction (`0` = ascends `+Z`, `π/2` = ascends `+X`, `π` = ascends `-Z`, `3π/2` = ascends `-X`). Stairs climb from `floor * WALL_HEIGHT` to `(floor + 1) * WALL_HEIGHT`, and the upper floor slab at `floor + 1` can cut a stairwell opening over the `(x, z, width, depth, rotation)` rectangle.
*   For furniture elements, `width` and `depth` are omitted (the frontend places fixed-size 3D models at `[item.x, (item.floor ?? 0) * WALL_HEIGHT, item.z]`), and `rotation` is in `[0, 2π)` indicating facing direction (`0` = faces `+Z`, `π/2` = faces `+X`, `π` = faces `-Z`, `3π/2` = faces `-X`).
*   When computing model bounds in `computeBounds(elements)`, use `(w.width ?? 0) / 2` so furniture items without `width`/`depth` never produce `NaN`.

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
    *   `wallMaterial` (see Surfaces for its textures): `meshStandardMaterial({ color: '#e8e6e1', roughness: 0.85, metalness: 0, side: THREE.DoubleSide })`
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

### Procedural Stairs (`lib/elementParts.js` / `Walls.jsx` & `FloorSlabs.jsx`)
*   **Stairs are generated procedurally by the frontend** (there is no static stair `.gltf` model).
*   For each element with `type === 'stairs'` (`{ type: 'stairs', floor, x, z, width, depth, rotation }`):
    *   `width` is the horizontal run length along the direction of ascent; `depth` is the tread width perpendicular to travel; `rotation` in `[0, 2π)` is the ascending (`UP`) direction (`0` = `+Z`, `π/2` = `+X`, `π` = `-Z`, `3π/2` = `-X`).
    *   Generate `N = Math.max(8, Math.round(WALL_HEIGHT / 0.18))` steps (15 for a 2.7 m story) climbing from `y = floor * WALL_HEIGHT` to `y = (floor + 1) * WALL_HEIGHT`. Each step `i` (`0..N-1`) is a solid prism of tread length `width / N` and height `(i + 1) * (WALL_HEIGHT / N)`, from `-width / 2` to `+width / 2` along the ascending axis. Prisms merge into one mesh per material, so a flight costs a few draw calls.
    *   Strings and a handrail on slim posts run up both sides, leaving the lowest 0.7 m of the flight open so one that lands against a wall can still be stepped off. The handrail is one prism with a `slope`, sheared to the pitch of the flight in `Walls.jsx`. A low curb, posts and a flat rail surround the stairwell upstairs, open at the head of the flight (`structuralElements`). None of it is glass.
    *   **Upper floor slab cutout:** `FloorSlabs.jsx` builds each slab as an extruded shape with one hole per flight arriving from below, held inside the slab's edge (`stairwellCorners`).
    *   **Walking (`lib/walkthrough.js`):** `buildWalkBuilding` makes one collision world per floor. `walkStep` moves between them past the middle of a flight, and `walkHeight` gives the height of the step underfoot, which the camera eases toward. Heading roughly along a flight, `walkStep` follows it and eases toward the middle, so a diagonal approach still climbs. Between a flight's sides only they collide, so a wall overlapping the flight by a few cm can't hold anyone. `stairHint` names the flight just ahead for the walking controls. Colliders make the flight a corridor, closed at the end you can't leave by on that floor. A flight with no floor above it is solid.

### Furniture Models & Sizing Caveat (`public/assets/furniture/`)
*   All 10 furniture and fixture types now have dedicated 3D models in `frontend/public/assets/furniture/` (see `public/assets/furniture/SOURCES.md`; procedural fixture geometry is no longer needed once wired to the `.glb` files):
    *   **KayKit Furniture Bits (`*.gltf` + `*.bin` + `furniturebits_texture.png`):**
        *   `"couch"` → `couch.gltf` (or `couch_pillows.gltf`), native bounding box `[3.0, 1.22, 1.6]`
        *   `"chair"` → `chair_A.gltf` (or `chair_A_wood.gltf`, `chair_B.gltf`, `armchair.gltf`), native bounding box `[0.75, 1.26, 0.85]`
        *   `"bed"` → `bed_double_A.gltf` / `bed_single_A.gltf`, native bounding box `[3.1, 1.0, 3.0]` (double)
        *   `"cabinet"` → `cabinet_medium.gltf` / `cabinet_small.gltf`, native bounding box `[2.0, 1.0, 1.0]`
        *   `"wardrobe"` → `cabinet_medium.gltf` stretched to 2 m tall. `shelf_A_big.gltf` is really a wall shelf of `[2.0, 0.4, 0.5]`, so it isn't used.
        *   `"table"` → `table_medium.gltf` / `table_medium_long.gltf` / `table_low.gltf`, native bounding box `[2.0, 1.0, 2.0]`
    *   **Kenney Kitchen & Bathroom Fixtures (`*.glb`):**
        *   `"fridge"` → `fridge.glb`, native bounding box `[0.52, 0.92, 0.41]`
        *   `"sink"` → `sink_kitchen.glb` (`[0.43, 0.49, 0.45]`) / `sink_bathroom.glb` (`[0.43, 0.58, 0.30]`)
        *   `"toilet"` → `toilet.glb`, native bounding box `[0.31, 0.45, 0.48]`
        *   `"bath"` → `bathtub.glb`, native bounding box `[1.19, 0.42, 0.56]`
*   **IMPORTANT — Model Sizing & Pivot Normalization:**
    *   **KayKit `.gltf` models** are authored roughly **1.5–2× larger than real-world meters** (scale down `~0.55×`), while **Kenney `.glb` fixture models** (`fridge.glb`, `sink_kitchen.glb`, `sink_bathroom.glb`, `toilet.glb`, `bathtub.glb`) are roughly **half real-world size** (scale up `~2×`, e.g., `fridge.glb` is `0.92 m` tall as shipped) and have corner-anchored origins (`x` in `[-width, 0]`).
    *   `lib/furniture.js` lists a real-world target box in meters per type, and `viewer/Furniture.jsx` fits each loaded GLTF/GLB model's geometry (recursively merging child meshes when a `.glb` has multiple nodes like `doorLeft`/`doorRight` on `fridge.glb` or `cover` on `toilet.glb`) to that box: recentered in plan, standing on `y = 0`, and scaled per axis.
*   **Rendering (`viewer/Furniture.jsx`, `viewer/furnitureGeometry.js`):** one `instancedMesh` per kind. `furnitureGeometry` merges every node of a model, bakes each vertex's color from its texture or material, and fits the result to the target box, standing on `y = 0` and centered in plan. Target boxes stay close to each model's own proportions so nothing is squashed. Colors are softened and pulled a little toward a warm wood tone (`FURNITURE` in `viewer/colors.js`) so the two packs read as a set, and saturated blue stays with the cut tools. The Kenney fixtures also take a finish from `viewer/fixtureFinishes.js`: ivory porcelain, brass taps, oak where a home would have it, plus towels, a toilet roll and a pot plant merged into the same geometry. The Kenney fixtures are authored facing `-Z`, so `lib/furniture.js` gives them a half turn. `drawnModel` picks `sink_bathroom.glb` for a sink with a toilet or bath within 3 m and no wall between them, and `sink_kitchen.glb` otherwise. Boxes at the final size stand in while models load, and stay if they can't load. The shared material uses the same clipping planes as the slabs, so every cut applies. Model front is `+Z`; `rotation.y = item.rotation`.
*   **Settling (`lib/settleFurniture.js`):** plans place furniture by its center, so pieces can land inside walls, stairs or each other. `App.jsx` runs `settleFurniture` once on every model that loads. It nudges each piece clear of walls, openings, the stairs and their landing, and other pieces, with the smaller piece moving more and chairs allowed to tuck under tables. Whatever still doesn't fit is trimmed through `fitWidth` and `fitDepth` (no less than 70 percent). Drawing, walking and escape routes all read the settled result, through `furnitureRect`. Non-furniture elements are untouched.
*   **Explore** has a Furniture switch. Walking and escape routes always show furniture, since it's in the way.

### Surfaces (`viewer/surfaces.js`, `lib/surfaceUv.js`)
*   Plaster, weatherboard siding, oak planks and roof shingles are painted once onto canvases in the browser, so the model needs no image downloads. `surfaceUvs` gives every triangle texture coordinates in meters, so a pattern keeps its scale and runs on across pieces.
*   Walls are plaster inside and siding outside: `Walls.jsx` sorts each piece's faces by whether they look out of the building, and gives each set its own material. Floors and stair treads are planks. Roof slopes are shingles and gable ends are siding. Escape mode keeps a plain floor so the route arrows stay readable.
*   **Clean joins:** `elementParts` squares quarter turns stored as `1.571`, corners are welded to a 0.1 mm grid, and a slightly slimmer hidden core reaches past each wall piece and stair side to fill the gaps plans leave by rounding to the centimeter. `Viewer.jsx` uses a logarithmic depth buffer, because otherwise the hidden end faces at each join show through as hairlines. That also means `polygonOffset` has no effect, and the ground's shadow plane must not write depth or it hides the grid.

### Bill of materials (`lib/billOfMaterials.js`, `BomPanel.jsx`)
*   The BoM tab turns the loaded plan into a takeoff. `measureBuilding` does the slow measuring once per model, using the same floor grid and room numbers as the escape route. `billOfMaterials` then applies the chosen floor and roof, and `displayQuantity` and `orderQuantity` apply metric or imperial.
*   **Measured from the plan:** gross and net floor area, exterior and interior wall lengths and areas less openings, wall types by side and thickness, door and window schedules, a room schedule with glass to floor ratio, stair geometry, fixtures and furniture counts, and the roof for the chosen type. A piece is exterior when most of its length has the outside of the building on one side.
*   **Assumed:** a plan doesn't say what a building is made of, so framing, sheathing, boards, paint and the slab apply a typical light-frame house to those measurements. Each row's detail line says how it was worked out. Rows are grouped by MasterFormat division. "To order" adds a waste factor per material and rounds up to whole units or sheets.
*   **Layout:** the panel is the same width as the other tabs. It shows the estimated cost, floor areas, and anything to look at. Materials, wall types, doors and windows, and rooms each fold away, and opening one closes the last.
*   **Prices (`lib/prices.js`):** rough US retail prices, kept in one table so they're easy to change. A row's price is its rounded-up amount to order times its unit price, so the figures multiply out. That means totals can differ slightly between metric and imperial. Doors have a flat price by side of the building, and windows price by their glass. The total covers only the listed items, with no labor, tax, delivery, roof framing, wiring, or HVAC. Concrete, sheathing, drywall, and shingles were compared with published 2026 figures; the rest are general estimates.
*   **Schedules:** door and window sizes group to the nearest 50 mm, since plans round to the centimeter and would otherwise list a 1.33 m and a 1.34 m window as different marks. Marks stay the same on every floor.
*   **Worth checking:** daylight, exit door width and stair rise, going and width against 2021 IRC figures, shown as a first look and not a code review.

### Export (`lib/exports.js`, `ExportMenu.jsx`)
*   The Export button in the header downloads, for the whole building: a CSV of the bill and schedules (Excel, Google Sheets, Numbers), a DXF of the floor plans (R12, AIA layer names, meters, floors side by side, for AutoCAD, Revit, SketchUp, ArchiCAD), and a JSON of the elements and quantities. The CSV uses the chosen units and roof, and guards against spreadsheet formula injection from file names.

### Floor (`Floor.jsx`)
A `<mesh rotation-x={-Math.PI / 2}>` plane at `y = 0` slightly larger than the bounds (`size + 4`), dark material that receives shadows, plus Drei `<Grid infiniteGrid fadeDistance={40} cellColor="#333" sectionColor="#555" />`.

## 9. Section View (clipping plane)
*   Compute `totalHeight = (maxFloor + 1) * WALL_HEIGHT` (where `maxFloor = Math.max(0, ...walls.map(w => w.floor ?? 0))`).
*   Create one plane: `const plane = useMemo(() => new THREE.Plane(new THREE.Vector3(0, -1, 0), clipHeight), [])` and update `plane.constant = clipHeight` in `useEffect`/`useFrame` when state changes. A normal of `(0, -1, 0)` keeps everything **below** `y = clipHeight`; the plane is `-y + constant >= 0` so `constant = clipHeight` cuts at that height.
*   Slider: `<input type="range" min={0.1} max={totalHeight} step={0.01}>` in `ExplorePanel`, default value `totalHeight` (no cut). Show the current height as `1.35 m` text (and optionally quick-jump floor buttons when `maxFloor > 0`). A "Section view" toggle sets `clipEnabled`; when disabled, pass `clippingPlanes={[]}`.
*   The slider lives in `ExplorePanel`, with `accent` set to drafting blue.
*   Clipped walls appear hollow when cut. Provide a cap: render each wall also with a `BackSide` material in a flat accent colour (`side: THREE.BackSide`, same clipping plane) so the cut interior reads as a solid fill. Do this once the basics work (stretch goal).
*   Optional stretch: a second slider or buttons to cut along X or Z axes.

## 9a. Roofs (frontend only; no API change)
*   The user picks **Flat**, **Gable**, or **Hip** in the controls panel (`RoofPicker.jsx`); the default is `DEFAULT_ROOF = 'gable'` in `lib/roof.js`.
*   `computeRoofPlan(elements)` (in `lib/roof.js`) derives roof pieces from every element (walls, windows, doors):
    1. Find the dominant wall direction so rotated plans still work.
    2. Rasterize the elements at 0.1 m, close gaps up to ~1.2 m (doorways), flood-fill from outside to get the footprint.
    3. Cover the footprint with up to 12 overlapping rectangles, largest first. Same-pitch roofs on overlapping rectangles meet in natural valleys (L-shaped houses).
    4. If the outline isn't closed, fall back to one roof over the plan's bounds.
*   `buildRoofGeometry(type, rect)` builds one closed solid per piece: 30° pitch, 0.3 m overhang, flat slabs 0.3 m thick. Gable ends use the wall material.
*   `Roof.jsx` renders the pieces in the walls' centered group, sitting on `WALL_HEIGHT`, using the shared clipping plane plus a blueprint back-face cap. It drops in after the walls finish rising.
*   The section slider's maximum is the top of the roof (`roofTopHeight(plan, type)`), so the cut can slice through the roof; the 1.2 m plan cut removes it entirely.

## 9b. Escape Route Mode
A mode beside Explore that answers "there's a fire here and I'm there, how do I get out?" with arrows on the floor.
*   **Route (`lib/evacuation.js`, no AI, no network):** Dijkstra over a 0.1 m floor grid built from the elements. Walls and windows block; doors and gaps are open; openings narrower than 0.36 m aren't walkable. Fire spreads by walking distance, so walls shelter what's behind them. The route never comes within 1.5 m of the fire by walking distance and prefers to stay 6 m away.
*   **Exits:** leaving the building footprint (the same footprint the roof uses), so plans without typed doors still work. A window takes over when the doors are cut off, or when the door route passes closer than 2.5 m and the window doesn't. With neither, the plan is to stay put and signal.
*   **Rooms:** connected floor regions with doors as barriers, numbered largest first until the AI explanation reads their names from the drawing.
*   **Scene (`viewer/EvacuationScene.jsx`):** forces a plan cut at 1.2 m without touching the user's section state, opens the doors, and tilts the camera up. Chevrons sit on the floor and a pulse of light runs toward the exit (steady under reduced motion). Dim chevrons show the backup way out.
*   **Input:** click the floor, drag the markers, or choose a room from a list for keyboard use. Esc cancels placing.
*   **AI (`POST /api/evacuation-brief`):** Claude writes the finished route in plain words and reads room names from the drawing. It receives the route's facts and never changes them; the route stands without it, and the button is hidden in mock mode.
*   **Furniture:** fixed pieces block routes; chairs don't, since people push them aside. A window behind a desk still counts, standing beside the desk in the same room. If furniture is all that stands in the way, the route goes past it and the panel says so.
*   **Floors and stairs:** `buildEvacuationBuilding` makes one map per floor, numbers rooms across the building, and finds a landing at each end of each flight, which is an obstacle on both floors it touches. `computeFireFields` carries the fire's walking distance between floors only through the stairs. `planEscape` returns one route in 3D, with `y` and `floor` on each point, and `stepGroups` for the steps per floor.
*   **Routes only go down.** Climbing away from a fire leaves someone further from the way out with it between them. Upstairs, if every flight down is within 1.5 m of the fire on the way, the plan is `signal`: go to a window on this floor and call for help. Otherwise that window is the backup.
*   **Limits:** floors are viewed one at a time. Stairs are straight flights between two adjacent floors, as the contract gives them.

## 10. UI Components
*   **Header:** the wordmark as plain text, the mode switch once a model is loaded (Explore, Walk, Escape route, BoM), Export, and "New plan". While walking only the mode switch stays, and it goes too while the mouse is captured, so the view stays clear.
*   **Landing:** one primary upload button, with a full-window overlay while a file is dragged over the page. The hidden `<input type="file" multiple>` takes up to 5 images, one per floor, sorted by file name.
*   **LoadingOverlay:** shows the uploaded plan with a scan line, and says how many floors are being read.
*   **ErrorToast:** says what went wrong and how to fix it, auto-dismisses after 6 s, and has a close button.
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
