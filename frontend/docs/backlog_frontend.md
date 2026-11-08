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
- [x] Task 10: Escape route mode. Fire and person placement, floor arrows, backup route, written steps. See `docs/frontend_plan.md` section 9b.
- [ ] Task 11: Check the AI explanation against the live Claude API. It's only tested against a stubbed model so far.

- [x] Task 12: Merge main. Render multi-floor models: stacked walls, floor slabs, roof on the top floor, floor picker, one image per floor on upload.
- [x] Task 13: Clarity pass. One mode switch (Explore, Walk, Escape route), one panel per mode, simplified cuts and walk start, new visual design.
- [x] Task 14: Stairs. Procedurally generate 3D stepped geometry from `{ type: "stairs", floor, x, z, width, depth, rotation }` climbing from `floor` to `floor + 1`, cut the stairwell opening in `FloorSlabs.jsx`, and connect floors for walking and escape routes.
- [x] Task 15: Furniture rendering & scale normalization. Load the GLTF assets in `public/assets/furniture/` (plus procedural/fallback meshes for `fridge`, `sink`, `toilet`, `bath`), normalize their scale (~0.6x–0.65x or target bounding-box dimensions in meters since the raw GLTF units are ~1.5x oversized), orient them using `[0, 2π)` facing `rotation`, and attach section clipping planes.
- [x] Task 16: Replace procedural kitchen/bathroom fixtures (`fridge`, `sink`, `toilet`, `bath` in `viewer/Furniture.jsx` / `viewer/fixtureGeometry.js`) with the new Kenney `.glb` models in `public/assets/furniture/` (`fridge.glb`, `sink_kitchen.glb` / `sink_bathroom.glb`, `toilet.glb`, `bathtub.glb`), merging multi-node `.glb` meshes and normalizing their ~0.5x raw scale and corner-anchored origins to the target meter boxes in `lib/furniture.js`.
- [x] Task 17: Homely finish. Text-only wordmark and icon-free tabs, furniture settled clear of walls, warmer fixtures, and painted plaster, siding, plank and shingle textures with clean wall joins.
- [x] Task 18: Renamed to ArchiTech. BoM tab with quantities, schedules, and first-look checks. Export to CSV, DXF, and JSON.
- [x] Task 19: Shortened the BoM panel into folding sections at the usual panel width. Added estimated prices to the panel and exports.
- [x] Task 20: Clicking the plan thumbnail grows it into a large view, and closing shrinks it back to the same spot.
- [x] Task 21: Upload or drop a plan saved as JSON to open it in the browser without the backend. Files from the Export menu bring back their name and roof.
- [x] Task 22: Grass around the house. Floors follow the exterior walls instead of the plan's bounding rectangle, so the land outside them is lawn rather than wood.

See `verification.md` for checks and limitations, `section-view.md` for cuts, `human-perspective.md` for walking, and `architectural-elements.md` for windows and doors.
