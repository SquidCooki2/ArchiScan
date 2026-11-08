# ArchiScan frontend

React 19 / Vite / Tailwind v4 / React Three Fiber. Turns the shared wall-array contract into an interactive 3D model with a horizontal section view.

## Start locally

Use Node.js 22.12+ or Node.js 24 LTS with npm.

```sh
cd frontend
npm install
npm run dev
```

Open http://localhost:5173. Without `VITE_API_URL`, uploads use demonstration geometry after a short delay. “Try a sample space” works in either mode. Demo geometry is clearly labeled and does not represent the uploaded image.

## Connect the backend

```sh
cp .env.example .env
```

Set `VITE_API_URL=http://localhost:3000` and restart Vite. The backend must allow `http://localhost:5173` via CORS. The server port is strict so Vite cannot silently switch to a disallowed port. Add `?mock=1` to force mock mode even with the backend configured.

The frontend sends `POST /api/parse-blueprint` with `{ image: "<raw base64>", mediaType: "image/png" }`. It expects a nonempty wall array and surfaces the backend's `error.message`. There is a 150-second timeout, cancellation, and validation of both images and returned geometry. A failed replacement upload preserves the previous model.

Environment values are embedded at build time. Set `VITE_API_URL` before `npm run build` for a real API deployment. Keep credentials on the backend; no secrets belong in `VITE_*` variables.

## Controls

- Drag to orbit, scroll/pinch to zoom, right-drag/two-finger drag to pan. Drop a replacement image anywhere in the window.
- Enable **Section view**, then adjust the height, or use **Plan cut at 1.2 m**. Accent-colored horizontal caps fill cut walls.
- **Reset section** restores 2.70 m and disables clipping; **Fit to view** restores the fitted camera.
- **New upload** replaces the model only after successful parsing. Cancel a request with the button or Escape.

## Checks

```sh
npm run lint
npm test
npm run build
npm run preview
```

Geometry tests cover rotated bounds, sample orientation, and malformed server data. See [verification.md](docs/verification.md) for browser checks and the remaining integration step.

Three.js is pinned to 0.182.0 because R3F 9.8 uses `THREE.Clock`, which is deprecated in r183+. The viewer explicitly selects PCF shadows and creates its environment locally, avoiding an external HDR download. Revisit the pin when R3F adopts the new timer API.
