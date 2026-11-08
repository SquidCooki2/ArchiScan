# Frontend Backlog

- [x] Task 0: Configure Tailwind v4 via `@tailwindcss/vite`, strip Vite demo code, add `.env.example`.
- [x] Task 1: Scaffold UI layout (Header, Upload Zone, Floating Controls) with the app state machine in `App.jsx`.
- [x] Task 2: Implement Base64 image conversion and API fetch logic (`api/parseBlueprint.js`, with mock mode and error handling).
- [x] Task 3: Set up R3F `<Canvas>`, lighting, floor/grid, and camera controls with auto-fit.
- [x] Task 4: Map JSON payload to 3D BoxGeometries (centered group, shared material, entrance animation); verify orientation against the sample.
- [x] Task 5: Implement clipping plane slider logic (toggle, slider, height readout).
- [x] Task 6: Polish: error toast, loading overlay, hover/transition effects, wall caps, responsive check.
- [ ] Task 7: End-to-end test with the real backend and real floorplans.
- [x] Task 8: Roofs: Flat / Gable / Hip picker (default Gable), generated from the footprint, clipped by the section plane. See `docs/frontend_plan.md` section 9a.

## Notes
- `THREE.Clock` deprecation warning in the console comes from `@react-three/fiber` 9.8.2 itself with three 0.187; it goes away when R3F updates.
- Environment lighting uses local `Lightformer`s instead of `preset="city"` so the viewer never depends on a CDN download.
