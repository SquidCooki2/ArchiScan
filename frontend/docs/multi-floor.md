# Multi-floor buildings

The primary fixture is `sample_output/house1_2floors.walls.json`. It is a bare array of 80 architectural elements, not a nested building object. Each element has a zero-based `floor` index, X/Z coordinates and dimensions in meters, rotation in radians, and optionally opening dimensions. Floor 0 contains 22 walls, 9 windows, and 3 doors; floor 1 contains 30 walls, 10 windows, and 6 doors.

There are no elevation, floor-height, room, stair, slab, or floor-polygon records in this output. Following the shared contract, floor elevation is `floor * 2.7` m, and walls are 2.7 m tall. The sample therefore has bases at 0 and 2.7 m and a top at 5.4 m. Window/door dimensions are relative to their floor. A missing floor defaults to 0; invalid, negative, nonnumeric, or fractional indices are rejected before rendering. Floors are grouped and sorted dynamically; indices are preserved even when there are gaps. There is no two-floor limit.

## Navigation and cuts

The two-floor sample initially opens in **Entire building**. **View floor** isolates any floor and refits the camera around its X/Z bounds and actual vertical extent. Returning to **Entire building** restores every floor in the original shared image coordinate system. Legacy single-floor responses open directly with the cutting tools available.

Choose a floor before drawing an arbitrary 3D region, selecting elements, or changing its horizontal/X/Z cut. Each floor retains its own selected region, selected element indices, cut orientation, retained side, position, and enabled state. Switching floors saves/restores those edits. Complete-building view displays the independently configured cuts. **Reset section** only resets the active floor. Heights in the cutting controls are relative to the chosen floor; an upper-floor cut at 1.2 m is at world Y = 3.9 m. All clipping planes are translated to world space, including differing floor footprint centers.

The floor selector shares the cutting sheet to preserve model space on mobile. Thin translucent slabs use each floor's inferred bounding rectangle; area and whole-floor cuts also clip those slabs. These are visual aids, not backend-provided room or slab geometry.

## Human Perspective

Select a floor, then enter Human Perspective. Placement rays intersect that floor's elevation, avatar feet sit at its base, and eyes remain 1.65 m above it (1.65 m / 4.35 m for this fixture). Collision geometry comes only from the isolated floor. Movement, mouse/touch look, open doors, Escape, and exact overview/section restoration are retained. Starting Human Perspective from complete-building view chooses the lowest available floor; return to overview to switch levels. No stairs or inter-floor walking routes are invented.

## Assets and samples

Vite preview imports come from `src/assets/samples/`. The previous apartment import failed because the backend image moved into `backend/assets/house0/`, leaving its former import path nonexistent. Frontend-owned preview copies now bundle independently of backend directory moves. Geometry still imports the committed backend JSON fixtures directly. The landing-page example selector offers both the two-floor house and legacy furnished apartment; mock uploads use the primary house fixture.

## Validation

`floors.test.js` checks the actual two-floor fixture, element association/counts, stack elevations and bounds, backward compatibility, sparse/arbitrary indices, invalid floor metadata, and floor-specific collision worlds. Browser verification covers real scene meshes and world-space bounds, dynamic floor navigation, camera targets, direct area drawing, horizontal and X/Z cuts, draggable cut/selection handles on the upper floor, independent edit restoration, both walkthrough eye heights, mobile layout, and the legacy apartment. See `verification.md` for results and remaining live backend integration work.
