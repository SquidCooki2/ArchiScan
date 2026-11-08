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

## Fixtures, furniture look, stairs, and first-person walking

`npm test` passes 102 frontend tests and `npm test` in `backend/` passes 17. Lint and the production build are clean. Headless Chrome checks at 1440 × 900 and 390 × 844, on both saved samples:

- All 10 furniture types draw from their models with their own colors, on both floors of the house and in the apartment. Tests load the Kenney `.glb` files and check that every node merges, the result stands on the floor, centered, at its target size, and that the fixtures face `+Z`.
- A sink next to a toilet or bath draws as a basin, and a kitchen sink as a kitchen unit. A cut goes through furniture along with the walls.
- Stairs have a handrail on posts and no glass. Walking at a flight 30 degrees off its line climbs it from either side, comes down the same way, and is not held by walls beside it. The sample house's flight stands against an outside wall, which is the case that used to catch people.
- Starting a walk with a real click captures the pointer and hides the switch and panel. Moving the mouse turns the view, and W climbs the flight to Floor 2. Releasing the capture brings the panel back without leaving the walk, a click captures again, and a second Esc leaves.
- With touch emulation on the narrow screen, the arrows show, the pointer isn't captured, a drag turns the view, and there's no horizontal scroll or text under 12 px.

Pointer lock ran in headless Chrome with focus emulated, and the release was triggered from script, because automation can't press the browser's own Esc. The real Esc key, a physical mouse, Safari, Firefox, and real touch input still need a try by hand.

## Homely finish, bill of materials, and export

`npm test` passed 137 frontend tests at that point and `npm test` in `backend/` passes 17. Lint and the production build are clean. Headless Chrome checks ran at 1440 × 900, 820 × 1100, and 390 × 844 on both samples, with no horizontal scroll, no text under 12 px, and no console errors.

- The header shows a text wordmark. Tabs, roof choices, and cut buttons have no icons. New plan, the upload button, and the fire keep theirs.
- Furniture is settled clear of walls, the stairs, and other pieces in both samples, and routes and walking still work around it.
- Plaster, siding, planks, and shingles show in Explore, Walk, and the cuts, and escape mode keeps a plain floor with readable arrows. Zoomed captures show no seam lines on the siding.
- BoM totals were checked by hand against the sample house: 83.6 m of exterior wall is its 41.8 m perimeter on two floors, 212 m² gross matches 12.2 × 8.7 m twice, and the roof's slope area matches its 12.8 × 9.3 m plan over the cosine of 30 degrees. Tests confirm floors add up to the whole and schedules count every opening.
- All three exports downloaded from the real button. ezdxf 1.x read the DXF as valid R12 with 0 audit errors and closed outlines on the expected layers.

The DXF and CSV haven't been opened in AutoCAD, Revit, or Excel themselves. Assumed BoM rows use typical rules of thumb and haven't been reviewed by an estimator, and the checks are a first look against remembered 2021 IRC figures, not a code review. Depth precision relies on a logarithmic depth buffer, tested in headless Chrome's software renderer, not on a range of real graphics cards.

## Shorter BoM panel and prices

`npm test` passes 144 frontend tests. Lint and the production build are clean. Headless Chrome checks covered both samples from 360 to 1440 px wide, in metric and imperial, on all floors, with no horizontal scroll, no clipped tables, and no text under 12 px.

- The panel is 320 px wide on desktop, like the other tabs, and doesn't move the house when you switch to it. Sections open one at a time, and Enter opens one from the keyboard.
- Tests confirm every row in both samples has a price under every roof, floor, and unit choice, that each price is its amount to order times its unit price, and that section, door, window, and overall totals add up and match the CSV and JSON.
- The sample house comes to about $56,100 in metric and $55,900 in imperial, a difference caused only by rounding up each order in its own units.

Concrete, OSB sheathing, drywall, and shingles were compared with published 2026 figures on November 8, 2026, from sources of mixed quality. Everything else is a general estimate that hasn't been checked against a supplier. The total isn't a construction budget, because it leaves out labor, tax, delivery, roof framing, wiring, and HVAC.

## Expanding the plan thumbnail

`npm test` passes 150 frontend tests. Lint and the production build are clean. These checks ran in headless Chrome with real mouse and keyboard input, on both samples, at 1440 × 900 and 1024 × 700, with resizing down to 700 px wide while open.

- With the animation frozen at exact times on the sample house, the card starts at the thumbnail's exact position and size, and lands back on it to within 0.1 px. The image keeps its shape at every time checked and stays inside its card. Frame sampling on the apartment agrees.
- Closing partway through opening continues from exactly where it was, 0.00 px away.
- Click, Enter, Space, Esc, the Close button, the scrim, and the image all work, in all four tabs. Focus goes to Close on opening and back to the thumbnail on closing.
- The view opened 3 to 7 ms after the click, with no clicks lost in 12 tries. Closing and reopening at once stays open.
- Esc doesn't reach the app behind the open view, even after Tab moves focus out of the dialog, and works normally again after closing.
- Dragging a file in closes the view, so the drop feedback isn't hidden. With reduced motion on, the view opens and closes with no movement.

In one early run, a first Enter press didn't leave the view open. A late `close` event could have shut a reopened view, so that's now guarded, and it hasn't happened again in later runs, including 6 repeats of the same keys. The cause wasn't proven.

Smoothness itself wasn't measured. The headless browser draws the 3D scene in software at 6 or 7 frames per second, so it needs a look on a real graphics card. Safari, Firefox, and real touch weren't tested. The thumbnail still only shows from 1024 px wide, so phones and most tablets don't have this view.

## Opening a plan from JSON

`npm test` passes 158 frontend tests. Lint and the production build are clean. These checks ran in the real app in the dev server, with the backend not running and every `fetch` and `XMLHttpRequest` recorded.

- A backend-format file opened in 61 ms with no loading overlay and no calls to the backend. A drop event onto the window works the same way, as does a file with no type set by the browser.
- A model exported with a flat roof, then reopened after loading another plan, came back with its name and flat roof. Exporting it again gave byte-identical elements and the same estimated cost.
- Exported files skip furniture settling, because settling an already settled plan moved pieces by up to 3 cm on the sample apartment.
- With `?mock=1`, a JSON file opens the file itself rather than the sample, with no demo notice.
- Invalid JSON, no plan in the file, an empty file, no walls, a bad element, too many floors, an over-large plan, two files, and an image mixed with JSON each show their own message and leave the current model in place.
- All four tabs opened without errors on a plan with no drawing. That only checks they don't crash: routes and walking weren't run through on it, though neither depends on the drawing.

Not tested: a real file picker (the checks set the input's files from script), Safari, and Firefox. The backend's checks also accept alternative type names such as `sofa` and numbers written as strings. A JSON file doesn't get that leniency, so hand-written files need the exact format.
