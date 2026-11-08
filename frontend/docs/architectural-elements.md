# Typed architectural & furniture elements

The saved backend samples (`sample_output/apartment_furnished_preview.walls.json` and `sample_output/house1_2floors.walls.json`) and live API return a bare flat array containing structural elements (`wall`, `window`, `door`, `stairs`) and furniture/fixtures (`couch`, `chair`, `fridge`, `sink`, `bed`, `wardrobe`, `cabinet`, `toilet`, `table`, `bath`) tagged with `floor` (`0`, `1`, ...).

## Structural Geometry (`wall`, `window`, `door`, `stairs`)

`lib/elementParts.js` converts each structural entry into physical prisms before rendering or area partitioning:

- **Wall (`"wall"`):** one full-height, 2.7 m solid segment. Missing `type` retains this legacy behavior.
- **Window (`"window"`):** solid host-wall infill from the floor to `sillHeight`, host-wall infill from the opening top to 2.7 m, side jambs, top/bottom frame rails, a center mullion, and two thin transparent blue panes. The opening between the wall bands remains a real gap; it is not a full-height solid box with a glass-colored face.
- **Door (`"door"`):** host-wall infill above the doorway (and below a raised sill if supplied), a frame, a wood-colored leaf, decorative face panels, and lever handles on both sides. Doors are displayed closed in overview and open 90° in Human Perspective / Escape Route mode.
- **Stairs (`"stairs"` — procedurally generated on the frontend):**
  - Stairs are **not** loaded from a `.gltf` asset; they are generated procedurally by the frontend from `{ type: "stairs", floor, x, z, width, depth, rotation }`.
  - Only emitted on the lower floor where the stairs ascend (`UP`); `DN` stairs on upper floors are omitted by the backend so the staircase is not duplicated in the same stairwell.
  - `width` is the stair run length along the ascending direction, `depth` is the tread width perpendicular to travel, and `rotation` in `[0, 2π)` is the ascending (`UP`) direction (`0` = `+Z`/down image, `π/2` = `+X`/right, `π` = `-Z`/up image, `3π/2` = `-X`/left).
  - The frontend generates stepped prism geometry climbing from `y = floor * 2.7` m to `y = (floor + 1) * 2.7` m and cuts a matching stairwell opening in the upper floor slab (`FloorSlabs.jsx` at `floor + 1`).

All structural parts rotate with their source element using the same image-right/+X and image-down/+Z convention.

## Furniture Models & Sizing Caveat (`public/assets/furniture/`)

Furniture items have the schema `{ type, floor, x, z, rotation }` (no `width` or `depth` in the JSON) with `rotation` in `[0, 2π)` indicating the direction the **front** of the item faces (`0` = `+Z`/down, `π/2` = `+X`/right, `π` = `-Z`/up, `3π/2` = `-X`/left).

### Asset Mapping (`frontend/public/assets/furniture/`)
The KayKit Furniture Bits `.gltf` + `.bin` + `furniturebits_texture.png` assets are stored in `frontend/public/assets/furniture/`:
- `"couch"` → `couch.gltf` / `couch_pillows.gltf` (native size `3.0 × 1.22 × 1.6`)
- `"chair"` → `chair_A.gltf` / `chair_A_wood.gltf` / `chair_B.gltf` / `armchair.gltf` (native size `0.75 × 1.26 × 0.85`)
- `"bed"` → `bed_double_A.gltf` / `bed_single_A.gltf` (native size `3.1 × 1.0 × 3.0` double)
- `"cabinet"` → `cabinet_medium.gltf` / `cabinet_small.gltf` (native size `2.0 × 1.0 × 1.0`)
- `"wardrobe"` → `shelf_A_big.gltf` / `cabinet_medium.gltf` (native size `2.0 × 2.0 × 0.75`)
- `"table"` → `table_medium.gltf` / `table_medium_long.gltf` / `table_low.gltf` (native size `2.0 × 1.0 × 2.0`)
- `"fridge"`, `"sink"`, `"toilet"`, `"bath"` → Not included as dedicated meshes in the KayKit pack; rendered using procedural Three.js geometry (or fallback cabinet/shelf GLTFs) in the same architectural palette.

### Sizing & Scale Normalization (Important)
- **Raw GLTF dimensions are oversized relative to meter-scale rooms:** The `.gltf` files in `public/assets/furniture/` are authored in stylized game units roughly **1.4× to 1.6× larger than real-world meters** (for example, `bed_double_A.gltf` is `3.1 × 3.0` units and `couch.gltf` is `3.0 × 1.6` units, whereas rooms and `WALL_HEIGHT = 2.7` m are in true meters).
- If rendered at `scale = 1`, furniture will appear too large and clip into walls or block doorways.
- The frontend renderer must normalize each model's scale (either by applying a uniform `~0.6`–`0.65` scale factor or normalizing the cloned GLTF scene's `THREE.Box3` bounding box to a per-type target height/width in meters) and ensure the bottom of the bounding box sits flush on `y = floor * 2.7`.

## Validation and defaults

| Element | Required JSON fields | Rotation range | Vertical defaults |
| --- | --- | --- | --- |
| `wall` | `x, z, width, depth, rotation` | `[0, π)` | `0` to `2.7 m` |
| `window` | `x, z, width, depth, rotation` | `[0, π)` | `sillHeight: 0.9 m`, `height: 1.2 m` |
| `door` | `x, z, width, depth, rotation` | `[0, π)` | `sillHeight: 0 m`, `height: 2.1 m` |
| `stairs` | `x, z, width, depth, rotation` | `[0, 2π)` (UP direction) | `floor * 2.7 m` to `(floor + 1) * 2.7 m` |
| Furniture (10 types) | `x, z, rotation` | `[0, 2π)` (front facing) | Placed at `y = floor * 2.7 m` |

## Selection and sections

Area selection and section planes clip structural parts, procedurally generated stairs, and cloned furniture GLTF materials alike. Each part carries its real bottom and top elevation so horizontal and vertical cuts behave consistently across multi-story models.
