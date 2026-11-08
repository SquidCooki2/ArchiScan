# Cutting the model

The Explore panel keeps one idea in front: a **Cut height** slider. At the top of its range it reads "Whole model" and nothing is cut, so there's no on/off switch.

- **See floor plan** jumps to a conventional cut 1.2 m above the floor on show.
- **Undo cut** removes the cut and any drawn area. It doesn't replace the loaded model.
- **Reset camera** frames the model in the space the panel leaves free.
- On a multi-floor model, **Floors** shows one floor and those below it, and hides the roof. The slider then covers only that floor. **All** brings everything back.

The cut plane also has a handle in the scene. Dragging it and moving the slider update the same state.

## More options

- **Cut from** chooses **Above**, **Side**, or **Front**. Changing direction starts the plane in the middle of the model or area.
- **Show the part above / Show the other side** flips which part stays. It's unavailable when nothing is cut.
- **Draw an area** cuts only part of the model. The roof and upper walls lift off while you draw, so the floor is in view. Drag on the floor or click two corners, and press Esc to cancel. The roof stays off while an area cut is active, because it would hide most of what the area reveals.
- With an area in place, drag a corner handle to resize it or the white center handle to move it. **Cut the whole model again** removes the area and keeps the cut.

Only geometry inside the chosen footprint is clipped, including walls crossing its boundary. Solid caps fill the cut faces, including through diagonal walls.

Picking individual elements and typing numeric bounds were removed on 2026-11-08 to keep this panel understandable. Whole-model cuts, side cuts, and drawn areas remain.

Walking and escape routes use their own plan view. The cut you set in Explore is kept and comes back when you return.

## Implementation

- `lib/useSection.js` owns the cut, the drawn area, and the slider range. It derives `cutting`, so a height cut at the top of its range counts as no cut.
- `lib/sections.js` calculates selection rectangles, bounded moves and resizes, cut ranges and coordinates, wall footprints, regional partitions, and solid caps.
- `RegionSelection.jsx` projects pointer rays onto the floor while drawing and onto a horizontal plane while moving or resizing.
- `CutPlaneHandle.jsx` projects pointer rays onto a camera-facing plane containing the cut axis.
- `useSceneDrag.js` provides pointer capture, orbit locking, and Esc rollback for scene handles.
- `Walls.jsx` splits crossing wall footprints into inside and outside prisms. Only inside pieces use clipping materials. Each piece carries its actual bottom and top height, including its floor, and those heights set the section caps.
- `useSectionClipping.js` gives the roof and floor slabs the same cut.
