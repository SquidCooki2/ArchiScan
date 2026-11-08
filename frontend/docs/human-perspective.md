# Walk mode

## Start and move

Load a model and choose **Walk** at the top of the screen. The view looks down on one floor, cut at plan height, so the floor is easy to point at.

- Click clear floor to start walking there. A figure previews the spot as the pointer moves, and turns red with a short reason when the spot is inside a wall, on the stairs, blocked by furniture, or outside the building.
- **Start in the middle** picks the nearest clear spot to the middle of the plan. It's also the keyboard path into a walk.
- On a multi-floor model, **Floor** chooses which floor to start on. Walk up or down the stairs to change floors. The walking controls show the floor you're on.

While walking:

- **W A S D or arrow keys** move on the floor. Diagonal input is normalized.
- **Moving the mouse** looks around, as in a first-person game. The pointer is hidden, and the mode switch and panel step aside.
- **Q and E** turn, for anyone not using a mouse.
- **Esc** gives the pointer back and shows the panel. Click the view to carry on. **Esc** again, or choosing another mode, leaves the walk.
- **Pick another spot**, on the panel, returns to the plan view.
- On touch screens, drag to look and hold the on-screen arrows. If a browser refuses to capture the mouse, dragging to look works there too.

## Stairs

- Near the foot or head of a flight, the walking controls say where it goes, for example "Stairs up to Floor 2".
- Stairs don't need lining up. Heading roughly along a flight, you follow it and ease toward the middle, so walking at it on a diagonal still climbs.
- Between a flight's sides, only those sides stop you. Walls next to a flight can overlap it by a few cm, and they used to catch people.
- The lowest 0.7 m has no sides, so a flight that lands against a wall can still be stepped off to the side.

Entry uses a short fade into the validated position, respecting reduced motion. Resizing adjusts projection without moving the person.

Drag-to-place and typed coordinates were removed on 2026-11-08 to keep the start simple. Mouse capture came back later that day as the normal way to look around.

## Scale and assumptions

- Eye height: **1.65 m** above the floor you're on.
- Walking speed: **1.4 m/s**, with smooth acceleration/deceleration.
- Collision body: **1.8 m** tall, **0.2 m** horizontal radius.
- Perspective: a moderate **75° horizontal field of view**, capped at **65° vertical** on portrait screens. Overview camera fitting/view offsets are disabled in human view.
- Backend X/Z positions, rotations, widths, depths, and opening dimensions are used without rescaling.

**Scale is estimated.** The API returns meters but no confidence or calibration data, so the frontend doesn't present these dimensions as measured. Wall and ceiling height is an assumed **2.7 m**, which the start panel states, and flat floor and ceiling coverage is inferred from the plan's bounds.

Each floor is a separate walk, with an inferred ceiling shown only while walking. Incomplete walls and open edges are handled by keeping the person within the inferred floor boundary, rather than allowing a fall into missing geometry.

## Physical constraints

`lib/walkthrough.js` builds colliders dynamically from the same physical parts used to render walls, window glass/frames, and doors. An oriented-rectangle/circular-body test checks the whole standing body's vertical span. Glazing, wall infill, and low lintels block movement. A doorway must be both wide enough and tall enough.

Door leaves, panels, and handles swing 90° around a default hinge in placement and human modes, leaving clear passages. The rendering and collision geometry share this transform. No hinge/swing state is supplied by the backend, so the opening direction is a walkthrough convention; overview restores the original closed-door presentation without modifying the backend data.

Movement resolves in small substeps to prevent tunneling and separately along each axis to slide naturally against walls. Longer frames retain meter-per-second movement timing; blur/visibility changes clear input to avoid runaway movement. The eye remains at 1.65 m, so walking cannot pass through floors or the assumed ceiling. No flying/jumping is enabled.

## Integration

- `HumanPlacement.jsx` raycasts the pointer to the chosen floor, validates body clearance, and renders the preview figure.
- `HumanCamera.jsx` owns first-person input and projection while mounted. It records the overview camera and restores it on exit.
- `CameraRig.jsx` suspends fitting while walking and moves to the plan view while choosing a spot.
- `WalkPanel.jsx` supplies the start panel and the walking controls.
- `lib/walkthrough.js` builds colliders for one floor from the same parts `Walls.jsx` renders.

Static walkthrough shadows are cached until leaving the mode. Tests cover dimensions, rotated solids, door passages, tunneling, sliding, floor limits, per-floor collisions, and the suggested start. See `verification.md`.
