# Direct 3D section exploration

## Select in the model

A new model starts in **Area** mode with no cut. Click **Select area in 3D**, then drag across the model floor or click two opposite corners. A live volume outline previews the selection, and the first corner is marked for two-click/touch selection. The selection can be any rectangular footprint within the model; it is not a predefined room or wall group.

Completing the selection activates the current cut automatically. The selected wall portions are tinted, and a visible 3D box outlines the full selected volume. There is no Apply button. Clicking **Section view** with no area selected starts the drawing tool rather than clipping the entire house.

Selection options collapse after completion so the live cut controls are immediately available. Open **Edit selection** for redraw/clear actions and alternative selection tools; the 3D move/resize handles remain available without reopening the panel.

- Drag a corner handle to resize the selected region. The opposite corner remains fixed.
- Drag the white center handle to move it. Its dimensions stay the same and movement stops at the model boundary.
- **Redraw area in 3D** selects a different location. Escape or **Cancel drawing** preserves the prior selection and cut.
- **Clear area** restores the affected geometry and removes the selection.
- Escape also cancels an active handle drag, restoring its initial selection/plane position.

Drawing and handle manipulation temporarily pause OrbitControls; ordinary drag-to-orbit, zoom, and pan resume afterward. Handles keep a consistent pixel size while zooming and include a larger invisible hit region for touch. The same two-corner workflow works with two taps on mobile.

## Cut the selection

- **Horizontal** cuts at a height in meters; choose to keep the part below or above the plane.
- **Vertical** supports **Across width · X** and **Along depth · Z**; choose the retained side. The slider range follows the selected region, measured from the full plan's left/top extent.
- Drag the labeled cut-plane handle directly in the scene, or use the slider. Both update the same position state in real time.
- Changing axis starts the plane inside the current selection with the default retained side.
- **Plan cut at 1.2 m** is a height shortcut that preserves the selected target.
- **Section view** toggles the cut without discarding the selected region.
- **Reset section** removes cuts and selections and returns to Area mode. It does not replace the loaded model.
- **Fit to view** frames the model in the space left free by the controls.

Only architectural geometry inside the chosen footprint is clipped, including walls crossing its boundary. Other wall portions remain full height and are not assigned a clipping material. Solid cap polygons fill horizontal and vertical intersections, including diagonal walls.

## Other tools and accessibility

Individual **Elements** selection and explicit **Entire model** cutting remain available. Element picking supports walls, windows, and doors and a checkbox list. Empty selections clip nothing.

The optional **Plan and numeric bounds** disclosure retains the earlier floorplan selector and precise numeric bounds as an alternative to spatial dragging. The main workflow uses the model itself. The backend supplies typed architectural elements, not room identifiers; no semantic room classification or predefined sections are required.

A successful replacement upload clears exploration state. Failed or cancelled uploads preserve the previous model, selection, and cut. No backend contract or API changes are needed.

Human Perspective temporarily shows the full building and hides section handles so the rendered structure matches the walking collision geometry. The selection and cut settings are retained and restored when returning to overview; they are not reset by a walkthrough.

## Implementation

- `RegionSelection.jsx` projects pointer rays onto the model's floor while drawing and onto a horizontal manipulation plane while moving/resizing. Coordinates are clamped to the centered model bounds. It renders the volume outline, floor tint, corner handles, and move handle.
- `CutPlaneHandle.jsx` projects pointer rays onto a camera-facing plane containing the chosen cut axis. Axis displacement updates the shared cut position, constrained to the relevant range.
- `useSceneDrag.js` provides pointer capture, orbit locking, completion, and Escape/pointer-cancel rollback for scene handles.
- `lib/sections.js` calculates selection rectangles, bounded translation/resizing, cut ranges/coordinates, wall footprints, regional partitions, and solid caps.
- `Walls.jsx` partitions crossing wall footprints into disjoint inside/outside prisms. Only inside pieces use clipping materials; those pieces also receive the selection tint. One shared mutable plane drives active cut materials. Typed windows and doors are decomposed into infill bands, frames, glass, and door parts before area partitioning. Each piece carries its actual bottom/top height, which is used for section caps.

The backend's coordinates, radians, wall dimensions, image orientation, lighting, shadow behavior, reduced-motion support, and saved sample remain unchanged. No external runtime dependencies were added.

## Verification

Twenty-nine geometry tests cover the shared contract and bounds, plane signs, exact area partitions, watertight winding/volume, cap intersections, free selection bounds, movement/resizing constraints, and local slider ranges.

Browser checks cover direct 3D drawing, two-corner selection, visible highlighting, all three draggable cut axes, local geometry isolation, move/resize handles, Escape rollback, clearing/reset, normal orbit restoration, and mobile two-tap/drag behavior. The original upload/API/error checks and the whole-model/wall/optional-plan cutting checks remain covered. See `verification.md` for results and the remaining live-Claude integration step.
