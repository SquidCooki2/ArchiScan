# Section views

## Controls

Click anywhere on the **Section view** row to toggle cutting. Enabling a cut at a model boundary moves the plane to a useful interior position: 1.2 m for horizontal sections, or the middle of the plan for vertical sections. The row explicitly shows On/Off.

- **Horizontal** cuts at a height in meters. Keep the portion below or above the plane.
- **Vertical** offers **Across width · X** and **Along depth · Z**. Slide the position from the left/top edge of the plan and choose which side to keep. Changing axis starts at an interior position and the default retained side.
- **Plan cut at 1.2 m** restores a horizontal cut below that height while preserving the current target.
- **Reset section** removes the cut, restores the full 2.7 m height, clears selected walls and area, and returns to the entire-model target.
- **Fit to view** frames the model in the space left free by the controls. Dragging still orbits; scroll/pinch zooms.

## Cut targets

**Entire model** applies one plane to all walls.

**Walls** allows multiple wall segments to be selected by clicking/tapping in the viewer. Selected walls are highlighted. A drag remains an orbit gesture. The checkbox list provides a keyboard-accessible alternative, including select-all and clear-selection actions. An empty selection clips nothing and shows a prompt. Clipped-away wall surfaces do not intercept selection clicks.

**Area** uses a rectangular region drawn on the top-down floorplan. A central-area preset and numeric left/right/top/bottom bounds provide alternatives to dragging. Bounds are measured in meters from the plan's left/top extent. The region appears on the scene floor and restricts the plane guide. Only the wall portions inside the rectangle receive the cut; a wall crossing the boundary retains its full height/shape outside the rectangle. Clearing the area restores the walls. An empty area does not fall back to a global cut.

Targets can be changed before or after enabling a cut. A successful replacement upload clears cuts and selections; a failed upload preserves them with the existing model.

The backend supplies wall segments, not room identifiers. Wall and rectangular-area selection work directly with that data and do not infer semantic room boundaries.

## Implementation

The shared backend wall contract is unchanged. `lib/sections.js` calculates centered wall footprints, cut coordinates, plane normals, solid cap intersections, and rectangular footprint partitions.

`Walls.jsx` uses shared materials for intact, clipped, selected, and selected/clipped walls. Clipped materials always reference one mutable Three.js plane, updated in a layout effect. Toggling section view switches between intact and clipped materials; it does not depend on dynamically recompiling a material's clipping configuration. Every plane retains points whose signed distance is nonnegative.

Closed prisms represent the wall footprints. For area cuts, sequential half-plane clipping partitions each crossing footprint into disjoint inside/outside pieces. Only inside pieces use the cut material. Prisms are rebuilt when the region changes; moving a cut plane updates its uniform and the cap geometry. Both horizontal and vertical intersections get actual flat cap polygons, including intersections through diagonal walls.

The translucent plane guide and region floor highlight do not intercept pointer picking. Wall picking checks drag distance and the actual clipping plane before accepting a hit. Animation, reduced-motion support, shadows, API handling, and the saved backend sample remain available.

## Verification

Geometry tests cover plane signs on all three axes, both retained sides, rotated footprints, exact area conservation across rotated walls, missing/disjoint regions, closed-prism volume/winding, horizontal/vertical caps, and regional cap bounds.

Chrome checks inspect the running scene's clipping planes and compare rendered pixels. They cover label-click activation, both horizontal directions, live sliders, X/Z cuts and reversals, 3D wall selection, unselected-wall preservation, checkbox selection, exact area isolation, drawn/numeric areas, reset, and mobile layout. The original upload/API/error regression checks also pass. No live Claude calls are required for these checks.
