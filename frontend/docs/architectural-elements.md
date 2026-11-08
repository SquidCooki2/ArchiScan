# Typed architectural elements

The saved backend sample and live API now return a bare array of `wall`, `window`, and `door` elements. The current apartment contains 27 elements: 17 walls, 6 windows, and 4 doors. The frontend imports the saved JSON directly and preserves its coordinates, dimensions, radians, sill heights, and opening heights.

## Geometry

`lib/elementParts.js` converts each entry into physical prisms before rendering or area partitioning.

- **Wall:** one full-height, 2.7 m solid segment. Missing `type` retains this legacy behavior.
- **Window:** solid host-wall infill from the floor to `sillHeight`, host-wall infill from the opening top to 2.7 m, side jambs, top/bottom frame rails, a center mullion, and two thin transparent blue panes. The opening between the wall bands remains a real gap; it is not a full-height solid box with a glass-colored face.
- **Door:** host-wall infill above the doorway (and below a raised sill if supplied), a frame, a wood-colored leaf, decorative face panels, and lever handles on both sides. Doors are displayed closed because the payload supplies no hinge side, swing angle, or open state.

All parts rotate with their source element using the same image-right/+X and image-down/+Z convention. Window glass uses a lightweight transparent standard material with opacity 0.35 and no depth writes or solid cast shadow. Frame, wood, and hardware surfaces have distinct colors/roughness/metalness. Materials remain shared across elements.

## Validation and defaults

`validateWalls` keeps its existing name for API compatibility, but accepts all three architectural types. Unknown types and invalid opening dimensions are rejected before rendering. Defaults match the backend:

| Element | Sill | Opening height |
| --- | --- | --- |
| Window | 0.9 m | 1.2 m |
| Door | 0 m | 2.1 m |

An opening must start at or above the floor and below 2.7 m. Its height must be positive; rendering clamps its top to the host wall height, matching backend normalization. Untyped wall-only responses remain supported.

## Selection and sections

The **Elements** tool selects an entire source wall/window/door even though each opening has several meshes. Area selection partitions every physical part at the selected region's boundary; all portions outside it stay intact. Selected parts retain their material behavior, so selected glazing remains transparent.

Each part carries its real bottom and top elevation. Horizontal caps appear only if the cut intersects that span; vertical caps extend only through that span. A cut through a window's glass zone therefore does not generate a solid wall cap across the aperture. Door panels, frames, handles, glazing, and structural infill all support horizontal and X/Z cuts and direct 3D manipulation.

The model summary reports wall, window, and door counts separately. The optional plan selector uses distinct colors for windows and doors. The source backend schema and files are unchanged by this frontend update.

## Verification

Nine added unit tests cover typed validation, opening defaults/clamping, window/door components, custom sill/height values, rotation, backwards compatibility, raised-prism volume, and caps that respect apertures. The geometry suite now contains 29 passing tests.

Focused browser checks inspect the real meshes/materials, review whole-model and window/door close-up screenshots, select and cut one window while preserving other elements, partition a window with a direct area cut, exercise the typed live API response path, and verify legacy/error responses. Existing direct-selection, mobile-touch, and upload/cutting regression suites remain covered.
