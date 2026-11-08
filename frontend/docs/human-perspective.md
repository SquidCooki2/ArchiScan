# Human Perspective Mode

## Enter and explore

Load a model, then choose **Human Perspective** in the header (**Walk** on narrow screens). The model returns to its full structure for placement; current section settings are kept for overview.

- Drag the person from the placement panel onto clear model floor. The full-size ghost figure and clearance ring preview the position; a valid drop enters the walkthrough.
- Alternatively click a floor point, inspect the preview/status, and select **Enter Human Perspective**.
- The figure turns red and entry stays disabled when the body intersects a solid object or the inferred floor boundary. Its feet start at floor height, not at the wall surface under the cursor.
- The optional numeric inputs set a position in model meters from the plan's left/top extent. This provides a keyboard-accessible alternative to dragging.

In human view:

- **WASD / arrow keys** move on the floor. Diagonal input is normalized.
- Drag to look, or select **Enable mouse look** / click the scene for optional pointer lock and unrestricted mouse movement.
- On touch screens, drag to look and use the on-screen walking arrows. Dragging the person from the panel also works with touch.
- **Exit Human Perspective** or **Escape** returns to overview. Unlocking pointer capture also exits safely.
- **Choose another starting point** restores the overview for repositioning. Cancelling placement preserves the original model and cut settings.

Entry uses a short fade into the validated position, respecting reduced motion. The camera does not fly through walls to reach the floor. Resizing the viewport adjusts projection without moving the person.

## Scale and assumptions

- Eye height: **1.65 m** above the selected floor base at Y = `(floor ?? 0) * 2.7`.
- Walking speed: **1.4 m/s**, with smooth acceleration/deceleration.
- Collision body: **1.8 m** tall, **0.2 m** horizontal radius.
- Perspective: a moderate **75° horizontal field of view**, capped at **65° vertical** on portrait screens. Overview camera fitting/view offsets are disabled in human view.
- Backend X/Z positions, rotations, widths, depths, and opening dimensions are used without rescaling.

**Scale is labeled unverified.** The current API provides meter-valued geometry but no measurement-confidence or calibration metadata. The frontend cannot claim that AI-estimated dimensions are verified real-world measurements. Wall/ceiling height is the existing assumed **2.7 m**, and flat floor/ceiling coverage is inferred from the plan's bounds. These assumptions are shown in the placement and walkthrough UI.

The current data identifies levels using element `floor` indices. There are no stair or floor-polygon records; choose a floor in overview to walk on that level. Eye heights are 1.65 m / 4.35 m on the two-floor fixture; see `multi-floor.md`. The walkthrough does not invent stairs. An inferred ceiling is displayed only in human view. Incomplete walls/open edges are handled by keeping the person within the inferred floor boundary, rather than allowing a fall into missing geometry.

## Physical constraints

`lib/walkthrough.js` builds colliders dynamically from the same physical parts used to render walls, window glass/frames, and doors. An oriented-rectangle/circular-body test checks the whole standing body's vertical span. Glazing, wall infill, and low lintels block movement. A doorway must be both wide enough and tall enough.

Door leaves, panels, and handles swing 90° around a default hinge in placement and human modes, leaving clear passages. The rendering and collision geometry share this transform. No hinge/swing state is supplied by the backend, so the opening direction is a walkthrough convention; overview restores the original closed-door presentation without modifying the backend data.

Movement resolves in small substeps to prevent tunneling and separately along each axis to slide naturally against walls. Longer frames retain meter-per-second movement timing; blur/visibility changes clear input to avoid runaway movement. The eye remains at 1.65 m above the selected floor, so walking cannot pass through floors or the assumed ceiling. No flying/jumping is enabled.

## Integration

- `HumanPlacement.jsx` raycasts pointer/drop locations to the floor, validates body clearance, and renders the human marker. A ref API connects DOM drag/touch controls to the R3F scene.
- `HumanCamera.jsx` owns first-person input and projection while active. It records overview position/orientation, FOV, view offset, near/far planes, zoom, and orbit target, then restores them on exit.
- `CameraRig.jsx` suspends fitting while placing/walking. It preserves the restored view on return, refitting when the model or viewport changed.
- `HumanPerspectiveControls.jsx` supplies placement, navigation, instructions, and scale labeling.
- `elementParts.js` supports the contextual open-door transform; `Walls.jsx` renders the same parts used by collision checks.

The underlying model, selection, and section configuration stay unchanged. Cuts and selection handles are suspended during placement/walking so visible structure matches collision geometry; they return on exit. Static walkthrough shadows are cached until leaving the mode. No additional runtime dependencies or backend API changes were introduced.

## Verification

Fourteen navigation tests cover dimensions/FOV, rotated solids, corner clearance, open/closed doors, short/narrow doorways, actual glazing, normalized movement, tunneling, sliding, incomplete floor bounds, undersized floors, rotated doors, and all internal door passages in the saved backend sample. Together with existing geometry tests, all 43 unit tests pass.

Browser checks cover valid/blocked placement, floor-level previews, native avatar drag-and-drop, human eye height/projection, WASD/arrows, wall collisions, actual doorway traversal, drag look, pointer capture/Escape, overview/section restoration, reposition/cancel, mobile touch placement/navigation, normal-motion entry, and resizing. See `verification.md` for the complete check record.
