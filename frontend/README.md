# ArchiScan frontend

React 19 / Vite / Tailwind v4 / React Three Fiber. Turns the shared wall-array contract into an interactive 3D model with horizontal and vertical section views and targeted cuts.

## Start locally

Use Node.js 22.12+ or Node.js 24 LTS with npm.

```sh
cd frontend
npm install
npm run dev
```

Open http://localhost:5173. Click **Explore the backend sample** to view the saved apartment response and its source image without calling the API. This works with or without a configured backend.

The demo reads `../sample_output/apartment_furnished_preview.walls.json` directly: 27 architectural elements: 17 walls, 6 windows, and 4 doors. The backend format is `{ type, x, z, width, depth, rotation, sillHeight?, height? }`. Its reference floorplan is `../backend/assets/apartment_furnished_preview.png`. These assets are bundled at build time, so the built frontend does not need access to those directories at runtime. The original synthetic L-shaped fixture remains in `src/samples/sampleWalls.json` for geometry regression tests.

Without `VITE_API_URL` (or with `?mock=1`), image uploads also return this saved apartment geometry after a short delay. These uploads are labeled as demonstrations rather than reconstructions of the selected image. With a real API URL and no mock flag, the viewer renders the backend response for the uploaded image using the same wall-array format.

## Connect the backend

```sh
cp .env.example .env
```

Set `VITE_API_URL=http://localhost:3000` and restart Vite. The backend must allow `http://localhost:5173` via CORS. The server port is strict so Vite cannot silently switch to a disallowed port. Add `?mock=1` to force mock mode even with the backend configured.

The frontend sends `POST /api/parse-blueprint` with `{ image: "<raw base64>", mediaType: "image/png" }`. It expects a nonempty architectural-element array and surfaces the backend's `error.message`. There is a 150-second timeout, cancellation, and validation of both images and returned geometry. A failed replacement upload preserves the previous model.

Environment values are embedded at build time. Set `VITE_API_URL` before `npm run build` for a real API deployment. Keep credentials on the backend; no secrets belong in `VITE_*` variables.

## Controls

- Drag to orbit, scroll/pinch to zoom, right-drag/two-finger drag to pan. Drop a replacement image anywhere in the window.
- Click **Select area in 3D**, then drag over the model floor or click two corners. The region is highlighted immediately and its cut becomes live when the selection is completed. No Apply step is required. With no region selected, **Section view** opens the selection tool instead of cutting the whole model.
- Drag the selected region's corner handles to resize it, or its white center handle to move it. Open **Edit selection** for **Redraw area in 3D** and **Clear area**. Escape cancels an active drawing or manipulation.
- Choose **Horizontal** or **Vertical** (X/Z). Drag the labeled cut-plane handle directly in 3D, or use the position slider. Vertical position ranges follow the selected region. Changes are live and only wall portions inside the selected region are clipped; surrounding geometry stays intact.
- Individual **Elements** picking (walls, windows, and doors) and whole-model cuts remain available as alternative tools. The optional **Plan and numeric bounds** panel provides a keyboard-accessible way to refine the region.
- **Plan cut at 1.2 m** restores a conventional horizontal cut while preserving the chosen target.
- **Reset section** restores 2.70 m, disables clipping, and clears selected walls/area; **Fit to view** restores the fitted camera.
- **New upload** replaces the model only after successful parsing. Cancel a request with the button or Escape.

## Windows and doors

`type` determines the rendered element. Untyped entries retain the original full-height wall behavior.

- Windows use their `sillHeight` and `height`, with solid wall infill below/above, a frame and center mullion, and two thin transparent blue glass panes.
- Doors have an upper wall lintel, a frame, a thin wood leaf, decorative panels, and handles on both sides. They are rendered closed because the JSON does not specify a hinge side or swing angle.
- Missing opening dimensions use the backend defaults (window: 0.9 m sill / 1.2 m height; door: 0 m / 2.1 m). Heights stop at the 2.7 m wall top.
- Every physical part supports area selection and horizontal/vertical cuts. Caps use each part's true bottom/top so a window opening is not filled with a solid wall cap.

## Checks

```sh
npm run lint
npm test
npm run build
npm run preview
```

Geometry tests cover rotated bounds, sample orientation, malformed server data, cut directions, watertight prism winding, solid caps, exact area partitioning, drawn-region limits, movement/resizing, and selection-local cut ranges. See [section-view.md](docs/section-view.md) for cutting controls and implementation details. See [verification.md](docs/verification.md) for browser checks and the remaining integration step.

Three.js is pinned to 0.182.0 because R3F 9.8 uses `THREE.Clock`, which is deprecated in r183+. The viewer explicitly selects PCF shadows and creates its environment locally, avoiding an external HDR download. Revisit the pin when R3F adopts the new timer API.
