# ArchiTech: Devpost submission kit

Everything below is ready to paste into the Devpost form. Images are in this folder.

---

## Elevator pitch
*(Devpost limit: 200 characters. This is 143.)*

> Drop in a 2D floorplan image. ArchiTech uses Claude's vision to trace every wall and builds a 3D model you can orbit and slice open in section.

---

## Thumbnail
`thumbnail.png` (2250 × 1500, 3:2)

---

## Project story
*(Paste everything between the lines into "About the project". Devpost renders Markdown.)*

---

## Inspiration

Floorplans are the most common way people describe a space, and one of the hardest to read. A flat drawing of black lines doesn't tell you how a hallway feels or how far the kitchen sits from the bedroom. Turning a plan into a 3D model has always needed CAD software, someone who knows how to use it, and hours of redrawing walls by hand.

We wanted that step to take seconds. Take a picture of a plan, from a listing, a lease, or a class handout, and walk around it in 3D right away.

## What it does

ArchiTech turns a 2D floorplan image into an interactive 3D model.

1. **Upload a plan.** Drag a PNG, JPEG, WebP, or GIF (up to 5 MB) onto the page, or click to browse.
2. **Claude reads it.** The image goes to Claude Opus, which acts as an architectural parser. It finds every wall and returns its position, length, thickness, and angle in meters. Doors and windows come back as gaps in the walls.
3. **Walk around it.** The walls rise out of the floor in a sweep across the plan, and the camera frames the model in the same orientation as your drawing. Drag to orbit and scroll to zoom.
4. **Cut it open.** A section slider slices the model horizontally at any height. One click sets the cut to 1.2 m, the height architects use for a standard floor plan. Cut faces fill solid blue, the way a cut wall is drawn in an architectural section, so the layout reads at a glance.

If something goes wrong (wrong file type, image too large, server down, or no walls found), ArchiTech says what happened and how to fix it.

## How we built it

We split the project into a **React frontend** and a **Node backend**. Before writing any code, we wrote one shared contract that both sides depend on:

```json
POST /api/parse-blueprint   { "image": "<base64>", "mediaType": "image/png" }
200 OK                      [{ "x": 2.5, "z": 0.1, "width": 5.0, "depth": 0.2, "rotation": 0 }]
```

Every wall is a box described by its center point `(x, z)`, its length, its thickness, and a rotation in radians. All units are meters, with the origin at the top-left corner of the plan. With that convention fixed, both halves could be built in parallel. The frontend ran against a bundled sample plan (`?mock=1`), and the backend against mocked Claude responses.

**Frontend:** React 19 and Vite, with **React Three Fiber** and **Drei** on top of **three.js** for the 3D viewer, and **Tailwind CSS v4** for the interface.

- Walls are extruded to a fixed 2.7 m height and recentered at the origin. All of them share one material.
- The section view uses a single `THREE.Plane` clipping plane shared by every wall. A second back-face material fills the cut faces with flat blue.
- A camera rig glides to frame each new model, and any drag from the user cancels the glide.

**Backend:** an **Express** service that keeps the Anthropic API key off the browser and sends the image to **Claude Opus** through the Anthropic SDK.

- The system prompt spells out the coordinate convention, the exact JSON schema, a worked example of a 4 × 3 m room, and the rule that doors and windows are gaps.
- Responses go through a JSON extractor and a validator that coerces numbers, normalizes rotations into `[0, π)`, and drops malformed walls. If the output can't be parsed, the backend retries once with a correction.
- Each failure (bad image, image too large, no walls found, rate limit, upstream timeout) maps to a clear error code that the frontend displays.

We also wrote per-layer rule files and backlogs (`docs/`, `frontend/docs/`, `backend/docs/`), so both human contributors and AI coding agents could pick up a task and know the conventions without asking.

## Challenges we ran into

- **Mirrored models.** Images put +Z pointing *down* the page, but three.js rotates around Y counterclockwise when seen from above. Left uncorrected, diagonal walls come out mirrored. We built a deliberately lopsided sample plan, an L-shape with one chamfered corner, so any mirroring is obvious. Negating the rotation keeps it the right way round.
- **Hollow cuts.** Slicing a box with a clipping plane leaves an open shell, so cut walls looked paper-thin. We draw each wall twice: once with a lit front-face material, and once with a flat back-face material clipped by the same plane. Where the wall is cut open, you see the back faces, which read as solid fill.
- **Shader recompiles.** Adding or removing a clipping plane forces three.js to recompile the wall shader. Instead of removing the plane when the section view is off, we park it far above the walls.
- **Waiting on a vision model.** Parsing a detailed plan can take most of a minute. Rather than show a bare spinner, the loading screen sweeps a scan line across your own image, shows elapsed time, and lets you cancel. The request has a 150-second timeout with a specific message if it runs out.
- **A contract a model can follow.** Getting reliable geometry out of a language model meant choosing conventions it can apply consistently: a center point instead of endpoints, an origin at the plan's corner instead of the image's, one rotation range, and a worked example in the prompt.
- **Not crashing offline.** The standard way to light the scene downloads an environment map from a CDN, and a failed download takes down the whole canvas. We replaced it with local light panels.

## Accomplishments that we're proud of

- The shared contract let the frontend and backend be built at the same time, without either waiting on the other.
- The section cut. Dragging a slider down through a model and watching the rooms open up, with the cut faces in blueprint blue, is the moment the project clicks.
- Models come out in the same orientation as the drawing, verified against an asymmetric plan.
- The polish beyond the core feature: keyboard-accessible upload and controls, reduced-motion support, clear error messages, and a layout that works on a phone.

## What we learned

- Agreeing on the data format first is the fastest way to let two people (or two agents) build in parallel.
- Vision models are very good at understanding the structure of a drawing, but turning that into dependable geometry takes a strict schema, validation, and a retry path.
- 3D coordinate conventions bite. Image space, three.js space, and "rotation" all mean slightly different things until you pin them down in writing.
- Long waits are a design problem. Showing people their own input being worked on makes a 60-second wait feel shorter than a spinner does.

## What's next for ArchiTech

- **Real openings:** doors with headers and windows with sills, instead of full-height gaps.
- **Scale calibration:** click a dimension on the plan to lock in the real-world scale.
- **Rooms:** read labels and areas from the plan and float them over the model.
- **More cuts:** vertical sections along X and Z, and a first-person walkthrough mode.
- **Export:** download the model as glTF or OBJ for Blender, SketchUp, or a game engine.
- **Multi-floor plans:** stack levels from a set of drawings.

---

## Built with
*(Add these as tags.)*

`javascript` `react` `vite` `three.js` `react-three-fiber` `drei` `webgl` `tailwindcss` `node.js` `express.js` `anthropic` `claude` `claude-opus` `computer-vision` `oxlint`

---

## "Try it out" links

| Label | URL |
|---|---|
| Source code | https://github.com/SquidCooki2/ArchiScan |
| Live demo | *(add once deployed)* |

The repository is private right now (it returns a 404 when signed out), so judges won't be able to open it. Make it public before submitting, or leave the link off.

---

## Image gallery
*(Upload in this order. Devpost lets you add a caption to each one.)*

| File | Caption |
|---|---|
| `04-section-cut.png` | A floorplan cut at 1.2 m, the standard plan height. Cut walls fill solid blueprint blue. |
| `02-scanning.png` | Claude reads the uploaded plan while a scan line sweeps across it. |
| `03-model.png` | The finished model, framed in the same orientation as the drawing. |
| `05-orbit-cut.png` | Orbit to any angle and drag the cut lower to see how the rooms connect. |
| `01-upload.png` | Drop a PNG, JPEG, WebP, or GIF floorplan to start. |
| `sample-floorplan.png` | The 2D plan used in these screenshots. |
| `06-mobile.png` | The viewer and section controls work on a phone. |

`06-mobile.png` is portrait, so Devpost will letterbox it in the 3:2 gallery. Leave it out if that looks off.

---

## Video demo
*(Devpost wants a YouTube, Vimeo, or Youku link. Aim for 1.5 to 2 minutes.)*

**Recording:** on a Mac, QuickTime Player → File → New Screen Recording, or press ⌘⇧5. Upload to YouTube as Unlisted and paste the link. Use `sample-floorplan.png` as the plan in the demo, or a real one once the backend is running.

| Time | On screen | Say |
|---|---|---|
| 0:00–0:12 | Upload screen | "Floorplans are everywhere, but hard to picture in 3D. ArchiTech turns one into a model you can walk around." |
| 0:12–0:30 | Drag the floorplan in; scan overlay plays | "I'll drop in a plan. Claude Opus reads the image and traces every wall: position, length, thickness, angle, in meters." |
| 0:30–0:50 | Walls rise; camera settles; orbit and zoom | "The walls rise straight out of the drawing, in the same orientation as the plan. I can orbit and zoom anywhere." |
| 0:50–1:15 | Turn on Section cut; click Plan cut; drag the slider down slowly | "This is the section view. Architects draw plans as if the building were sliced at 1.2 m. ArchiTech does that live, and the cut walls fill in blue the way they would on a drawing." |
| 1:15–1:35 | Quick view of the architecture diagram or the JSON contract | "Under the hood: React Three Fiber on the front, Express on the back, and one shared wall format so both halves could be built in parallel." |
| 1:35–1:50 | Click New upload; end on the model | "Next up: real door and window openings, scale calibration, and glTF export. That's ArchiTech." |
