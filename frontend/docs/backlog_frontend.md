# Frontend backlog

- [x] Task 0: Tailwind v4 Vite plugin, remove starter assets/styles, environment example.
- [x] Task 1: Header, accessible upload zone, floating controls, app state and replacement uploads.
- [x] Task 2: Base64 conversion, API adapter, mock mode, cancellation, timeout, response validation.
- [x] Task 3: R3F canvas, local environment, lights, floor/grid, orbit/zoom, camera auto-fit.
- [x] Task 4: Centered wall geometry, shared material, staggered entrance animation, asymmetric sample and orientation verification.
- [x] Task 5: Horizontal clipping, toggle, slider, meters readout, reset and fit controls.
- [x] Task 6: Toasts, loading preview, transitions, horizontal wall caps, narrow-screen checks.
- [ ] Task 7: Real-backend end-to-end test with actual floorplans. Backend API arrived in the merge; live Claude integration still needs verification.

See `verification.md` for checks and limitations. The requested section-view extension adds X/Z cuts, direction reversal, selected walls, and precise rectangular area cuts; see `section-view.md`.

The updated backend sample's typed walls/windows/doors are supported, including actual window apertures, framed glass, door leaves and handles, and section caps respecting each part's vertical span. See `architectural-elements.md`.

- [x] Human Perspective: floor-validated avatar placement via drag/drop, click/confirm, and touch.
- [x] Meter-scale first-person camera, WASD/arrows, mouse capture/drag look, and touch navigation.
- [x] Dynamic wall/glass/door collisions, doorway clearance, wall sliding, and inferred floor limits.
- [x] Overview/section preservation, contextual open doors, scale-assumption labeling, and normal/reduced-motion entry.
- [x] Walkthrough verification: 14 navigation unit tests and 11 browser interaction checks; all prior regression suites pass.

See `human-perspective.md` for physical assumptions and implementation details.
