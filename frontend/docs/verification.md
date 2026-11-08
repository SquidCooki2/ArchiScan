# Frontend verification — November 8, 2026

## Automated checks

- `npm run lint`: passed without warnings.
- `npm test`: all 43 geometry/navigation tests passed, including typed openings, section manipulation, collision constraints, walking vectors, and doorway traversal.
- `npm run build`: passed. Vite reports a large lazy-loaded viewer chunk (~1,013 kB minified / 278 kB gzip), which includes the 3D engine. Further bundle optimization is optional.
- `git diff --check`: passed.

## Browser checks

Verified with headless Chrome/Playwright against the local Vite server. Desktop viewport: 1440 × 1000. Narrow viewport: 390 × 844. All 23 checks passed using the saved backend apartment output:

1. Initial upload UI and WebGL canvas render.
2. Wrong file type displays an error toast.
3. Files over 5 MB are rejected.
4. Cancelled uploads cannot replace the scene later.
5. Mock uploads show loading, then a centered model and demo labeling.
6. Explicit whole-model mode retains the section toggle and height slider; horizontal caps appear at the selected height.
7. Reset, fit, orbit, and zoom work.
8. Narrow-screen controls stay inside the viewport without horizontal overflow.
9. The sample button works when a real API URL is configured.
10. Failed replacement uploads preserve sample metadata as well as geometry.
11. The real API path sends raw Base64 plus mediaType and accepts a valid wall array.
12. Backend error messages display while the previous model remains usable.
13. Malformed wall geometry is rejected before rendering.
14. Empty wall arrays display an actionable error.
15. Network failures display a connection error.
16. The 150-second timeout cancels the request and preserves the previous model.
17. Toasts dismiss automatically after six seconds.
18. Keyboard file selection and Escape cancellation work.
19. Drag-and-drop upload works.
20. The incoming plan-cut shortcut enables clipping at 1.2 m.
21. The uploaded thumbnail stays valid after a failed replacement.
22. Files dropped onto the viewer replace the model successfully.
23. The updated backend sample loads all 27 typed elements (17 walls, 6 windows, 4 doors) and its original 656 × 528 floorplan preview. The live API response path was also checked with this exact saved array.

Screenshots were visually reviewed for the upload screen, full-height model, capped section, and narrow-screen layout. No application console warnings or runtime errors remained. Software-GPU screenshot readback diagnostics were excluded from application-console checks.

API responses were intercepted for browser testing; this verifies the frontend request/response handling, not backend parsing quality. Test tooling and screenshots were kept under `/tmp`, outside the project dependency tree.

## Remaining integration work

The backend API was added in the merge. Live Claude parsing remains unverified, so Task 7 is still open. To verify it:

1. Configure `frontend/.env` using `.env.example`; restart Vite without `?mock=1`.
2. Start the backend on port 3000 with CORS allowing `http://localhost:5173`.
3. Upload genuine floorplans, including an asymmetric plan; compare the resulting layout, openings, scale, and orientation with the images.
4. Confirm the model is fitted automatically and the section slider remains smooth with real payloads.
5. Verify actual backend failures and CORS behavior. Mark Task 7 complete only after these checks pass.

## Merge verification

Preserved the incoming backend API and merged frontend features: the richer diagonal-wall sample, plan-cut shortcut, drop-anywhere uploads, upload thumbnail, section-plane visual, animated camera fitting, and reactive reduced-motion support. Kept strict API validation, cancellation/timeout handling, the Three.js compatibility pin, and actual horizontal cut caps.

Backend `npm test`: all ten tests passed with mocked Claude responses. The project M1 parallel-build milestone is complete; live Claude/floorplan integration remains open.

## Saved backend sample

The default sample now imports `sample_output/apartment_furnished_preview.walls.json` from the repository root. Its format already matches the shared contract; wall dimensions and rounded radians (including `1.571`) are preserved. The sample button shows the corresponding backend floorplan asset and labels the model as saved backend output. Mock image uploads use this same geometry with a demonstration disclaimer. The synthetic L-shaped sample remains solely for regression testing.

## Section-view extension

All 23 existing browser regression checks passed during this change, plus 12 focused cutting checks. The focused checks used the running scene to inspect actual material clipping planes and compared rendered WebGL pixels. They verified:

- Clicking the Section view label enables a visible interior cut at 1.2 m.
- Horizontal cuts retain either the lower or upper portion, and slider changes update the live plane.
- Vertical X and Z cuts use plan-sized position ranges and retain either side.
- A 3D-picked wall receives the cut while the other 16 sample walls remain intact.
- Wall-list selection, clear selection, select-all, and empty-selection prompts work.
- Area cuts split crossing walls and apply clipping only to geometry inside the rectangle.
- Drawing an area, numeric bounds, clearing an area, and reset update the scene correctly.
- Desktop and mobile camera fitting reserve space for the controls; the mobile panel scrolls without hiding the model.

No application console warnings or runtime errors were observed. Desktop/mobile screenshots were reviewed. The nine added geometry tests cover cut defaults/ranges, both plane signs on every axis, rotated footprints, precise regional partitioning and area conservation, missing/disjoint areas, watertight prism winding/volume, horizontal/vertical caps, and regional/diagonal intersections. See `section-view.md` for interaction and implementation details. The backend data contract remains unchanged.

## Direct 3D selection workflow

Area selection is now the default, with no global cut until explicitly requested. The primary interaction takes place in the 3D viewer; the earlier plan/numeric editor remains an optional alternative. Selection options collapse after an area is drawn so live cut controls remain visible, especially on mobile.

All 23 application regression checks and all 12 preserved cutting-tool checks passed. Twelve additional direct-interaction browser checks passed (47 browser checks total), verifying:

1. Dragging on the actual model floor creates a highlighted custom region and immediately activates its local cut, without an Apply step.
2. The 3D horizontal cut-plane handle updates height while selection and camera stay fixed.
3. Escape cancels a plane drag and restores its previous position.
4. Vertical X plane dragging uses the selected region's limits.
5. Vertical Z plane dragging updates continuously while every clipped fragment stays inside the region.
6. The white handle moves the region while retaining its size and local clipping.
7. Corner handles resize it while retaining the opposite corner.
8. Cancelling a selection manipulation restores the region and cut position.
9. Two clicks draw a different region; cancelling redraw retains the original region.
10. Clearing a region restores the house; enabling section view without a region opens selection instead of applying a global cut.
11. Mobile users select with two taps, see the first-corner marker, and drag a cut plane with touch. Orbit resumes afterward.
12. Reset clears exploration state and returns to direct region selection without replacing the loaded model.

Scene-level checks inspected actual clipped mesh bounds/materials and projected the real handles for pointer/touch events. No application console warnings or runtime errors were observed. Five added unit tests bring the geometry suite to 20 tests, covering the selection-first default, rectangle bounds, bounded movement, non-inverting resizing, and selection-local cut ranges. Desktop and mobile screenshots were reviewed.

## Updated typed sample: windows and doors

The current sample contains 27 architectural elements: 17 walls, 6 windows, and 4 doors. The frontend renders their supplied `type`, `sillHeight`, and `height` instead of treating every entry as a full-height wall. The summary and element-selection list report the types correctly. Whole-model and close-up screenshots of the windows and doors were visually reviewed.

Nine new unit tests bring the suite to 29 passing tests. Eight focused browser checks passed in addition to the 47 application/cutting/direct-selection checks (55 browser checks total):

1. All 27 elements render with the expected 17/6/4 breakdown.
2. Windows have transparent thin panes, frames, mullions, and actual gaps between lower and upper wall infill.
3. Doors have wood leaves, decorative panels, handles, frames, and lintels.
4. Selecting a window clips only that element; a horizontal cut through the opening does not produce a solid wall cap across it.
5. Direct 3D area cuts partition frame/glass geometry and preserve opening portions outside the selection.
6. The live API response path preserves opening types and dimensions.
7. Legacy untyped wall-only responses retain full-height geometry.
8. Invalid opening dimensions display an error and preserve the prior model.

The direct-selection suite also passed with the updated geometry on desktop and mobile touch. No application console warnings or runtime errors were observed. Glazing uses the lightweight transparent standard material specified in the frontend plan. Doors are closed by default because no swing/hinge state is supplied. See `architectural-elements.md` for geometry and validation details. The backend schema and sample artifact were not modified.

## Human Perspective Mode

Fourteen new unit tests cover human dimensions/FOV, rotated-wall and corner collisions, matching rendered/collidable door swings, short/narrow openings, actual glazing, normalized walking speed, tunneling prevention, wall sliding, inferred floor bounds, undersized floors, rotated doors, and all internal door passages in the backend sample. The unit suite now totals 43 passing tests.

All 55 existing browser regression checks passed again. Eleven new walkthrough checks also passed (66 total):

1. Floor-level human previews reject solid intersections, and entering placement suspends cuts without resetting the model.
2. Human view uses a 1.65 m eye height, centered moderate perspective, inferred floor/ceiling, and visible unverified-scale labeling.
3. WASD and arrow movement uses model meters and stops at solid interior walls, including under slow software rendering.
4. Backward movement and mouse drag-to-look work without pointer lock.
5. Exit restores overview position, orientation, orbit target, and exact prior section settings.
6. Native avatar drag-and-drop enters at the chosen floor location.
7. Movement traverses an actual dynamically reconstructed, visibly opened doorway.
8. Repositioning returns to the saved overview and can be cancelled.
9. Optional pointer lock allows mouse look; Escape releases it and returns to overview.
10. Mobile touch supports avatar dragging, view rotation, on-screen walking buttons, and exit without horizontal overflow.
11. Normal-motion fade entry and viewport resizing preserve eye height and return correctly to overview.

No application console warnings or runtime errors were observed. Placement, first-person interior, and mobile screenshots were reviewed. Walking retains meter-scale timing on longer frames using collision substeps, and static walkthrough shadows are cached. The implementation adds no runtime dependency and does not change the backend schema. Scale remains explicitly unverified; flat floor/ceiling coverage and 2.7 m wall height are inferred assumptions. See `human-perspective.md`.
## Roofs, openings, and escape route mode

`npm test` passes 36 frontend tests and `npm test` in `backend/` passes 14. Lint and the production build are clean. Headless Chrome checks on the saved apartment, at 1440 × 960 and 390 × 844:

- Flat, gable, and hip roofs render, and the cut slider reaches the ridge. Windows and doors show as sill, opening, and lintel.
- Placing the fire and the person by clicking the floor, with Esc to cancel and a message for clicks outside the building.
- Fire in the kitchen, person in Bedroom 1: 7.0 m through both doors, staying 3.9 m or more from the fire.
- Dragging the fire to the outside door switches the route to a window and marks the door as cut off.
- Leaving and returning to the mode keeps the plan. There's no horizontal scroll on the narrow screen.

The AI explanation ran through the real frontend and backend route against a stubbed model. It has not run against the live Claude API, because no API key was available (Task 11).

## Multi-floor and the redesign

`npm test` passes 86 frontend tests and `npm test` in `backend/` passes 17. Lint and the production build are clean. Headless Chrome checks at 1440 × 900 and 390 × 844, on both saved samples:

- The landing page shows the two-floor house rising, then both samples open from it.
- Floors stack, the roof sits on the top floor, and the floor picker isolates a floor and limits the slider to it.
- See floor plan, Undo cut, side cuts, and drawing an area all work with the roof in place.
- Clicking the floor starts a walk, Start in the middle works on both floors, W moves forward, and Esc returns to Explore.
- Walking from the foot of the sample house's flight climbs it, changes to Floor 2 at the middle, and carries on through a door upstairs. Tests also walk back down.
- A route from Floor 2 runs down the flight to the outside door. A fire at the foot of the stairs sends someone upstairs to a window to signal instead.
- Stairs cut correctly in plan view, a side cut through the flight runs without errors, the stairwell opening shows on Floor 2, and furniture appears at real size on both samples, follows cuts, and has an on-off switch.
- There's no horizontal scroll on the narrow screen, and no text under 12 px.

The touch-only wording and on-screen arrows weren't exercised with real touch input. The only console message is a `THREE.Clock` deprecation warning from the pinned three.js version.

Two floor images were also uploaded through the real frontend and backend route against a stubbed model. Neither that path nor the AI explanation has run against the live Claude API (Task 11).
