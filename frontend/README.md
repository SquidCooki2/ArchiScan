# ArchiScan frontend

React 19 / Vite / Tailwind v4 / React Three Fiber. Turns the shared wall-array contract into a 3D model you can cut open, walk through, and plan an escape route in.

## Start locally

Use Node.js 22.12+ or Node.js 24 LTS with npm.

```sh
cd frontend
npm install
npm run dev
```

Open http://localhost:5173. Under **Or try a sample**, choose **Two-floor house** or **Apartment** to open saved backend output and its source images without calling the API. This works with or without a configured backend.

The samples read `../sample_output/house1_2floors.walls.json` (80 elements on 2 floors) and `../sample_output/apartment_furnished_preview.walls.json` (27 elements) directly. The backend format is `{ type, floor?, x, z, width, depth, rotation, sillHeight?, height? }`. Their source drawings are copied to `src/assets/samples/`. These assets are bundled at build time, so the built frontend does not need access to those directories at runtime. The original synthetic L-shaped fixture remains in `src/samples/sampleWalls.json` for geometry regression tests.

Without `VITE_API_URL` (or with `?mock=1`), image uploads also return this saved apartment geometry after a short delay. These uploads are labeled as demonstrations rather than reconstructions of the selected image. With a real API URL and no mock flag, the viewer renders the backend response for the uploaded image using the same wall-array format.

## Connect the backend

```sh
cp .env.example .env
```

Set `VITE_API_URL=http://localhost:3000` and restart Vite. The backend must allow `http://localhost:5173` via CORS. The server port is strict so Vite cannot silently switch to a disallowed port. Add `?mock=1` to force mock mode even with the backend configured.

The frontend sends `POST /api/parse-blueprint` with `{ image: "<raw base64>", mediaType: "image/png" }`, or `{ images: [{ image, mediaType }, ...] }` for up to 5 floors in file-name order, ground floor first. It expects a nonempty architectural-element array and surfaces the backend's `error.message`. There is a 150-second timeout, cancellation, and validation of both images and returned geometry. A failed replacement upload preserves the previous model.

Environment values are embedded at build time. Set `VITE_API_URL` before `npm run build` for a real API deployment. Keep credentials on the backend; no secrets belong in `VITE_*` variables.

## Controls

The switch at the top chooses what you're doing with the model.

- **Explore:** drag to orbit, scroll or pinch to zoom, right-drag to pan. Choose a floor and a roof, move **Cut height**, or press **See floor plan**. **More options** has side cuts and drawing an area. See `docs/section-view.md`.
- **Walk:** click the floor to start walking there. Use W A S D or the arrow keys, and drag to look. See `docs/human-perspective.md`.
- **Escape route:** set where the fire and the person are, by room or by clicking. Arrows on the floor show the way out. Routes cover the ground floor.

Drop an image anywhere to build a new model. For more than one floor, select one image per floor.

## Windows and doors

`type` determines the rendered element. Untyped entries retain the original full-height wall behavior.

- Windows use their `sillHeight` and `height`, with solid wall infill below/above, a frame and center mullion, and two thin transparent blue glass panes.
- Doors have an upper wall lintel, a frame, a thin wood leaf, decorative panels, and handles on both sides. Overview shows them closed; Human Perspective opens them using a default hinge convention because the JSON does not specify swing state.
- Missing opening dimensions use the backend defaults (window: 0.9 m sill / 1.2 m height; door: 0 m / 2.1 m). Heights stop at the 2.7 m wall top.
- Every physical part supports area selection and horizontal/vertical cuts. Caps use each part's true bottom/top so a window opening is not filled with a solid wall cap.

## Human Perspective

Choose **Human Perspective** (or **Walk** on mobile), then drag the person onto clear model floor and drop to enter. You can also click a location, preview the floor-level avatar, and press **Enter Human Perspective**. Blocked positions cannot be entered.

Use WASD/arrows to walk and mouse/touch drag to look. Mouse capture is optional; touch devices have on-screen walking buttons. **Exit Human Perspective** or Escape restores the overview camera and prior section configuration. **Choose another starting point** returns to placement.

Eye height is 1.65 m and walking speed is 1.4 m/s. Walls, glazing, and solid parts have collision checks; doorways open for walking. The UI labels model scale as unverified, with an assumed 2.7 m wall/ceiling and floor coverage inferred from plan bounds. See [human-perspective.md](docs/human-perspective.md) for controls, physical constraints, and scale details.

## Checks

```sh
npm run lint
npm test
npm run build
npm run preview
```

Geometry tests cover rotated bounds, sample orientation, malformed server data, cut directions, watertight prism winding, solid caps, exact area partitioning, drawn-region limits, movement/resizing, and selection-local cut ranges. See [section-view.md](docs/section-view.md) for cutting controls and implementation details. See [verification.md](docs/verification.md) for browser checks and the remaining integration step.

Three.js is pinned to 0.182.0 because R3F 9.8 uses `THREE.Clock`, which is deprecated in r183+. The viewer explicitly selects PCF shadows and creates its environment locally, avoiding an external HDR download. Revisit the pin when R3F adopts the new timer API.
