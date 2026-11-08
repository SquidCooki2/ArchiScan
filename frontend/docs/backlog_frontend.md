# Frontend backlog

- [x] Task 0: Tailwind v4 Vite plugin, remove starter assets/styles, environment example.
- [x] Task 1: Header, accessible upload zone, floating controls, app state and replacement uploads.
- [x] Task 2: Base64 conversion, API adapter, mock mode, cancellation, timeout, response validation.
- [x] Task 3: R3F canvas, local environment, lights, floor/grid, orbit/zoom, camera auto-fit.
- [x] Task 4: Centered wall geometry, shared material, staggered entrance animation, asymmetric sample and orientation verification.
- [x] Task 5: Horizontal clipping, toggle, slider, meters readout, reset and fit controls.
- [x] Task 6: Toasts, loading preview, transitions, horizontal wall caps, narrow-screen checks.
- [ ] Task 7: Real-backend end-to-end test with actual floorplans. Backend API arrived in the merge; live Claude integration still needs verification.
- [x] Task 8: Roofs. Flat, gable, and hip, chosen with a picker (default gable), generated from the walls. Section cuts reach the ridge and follow every cut target. See `docs/frontend_plan.md` section 9a.
- [x] Task 9: Windows and doors render per `docs/frontend_plan.md` section 8: sill, glass or door panel, and lintel, with caps on each part.

See `verification.md` for checks and limitations. The requested section-view extension adds X/Z cuts, direction reversal, selected walls, and precise rectangular area cuts; see `section-view.md`.
