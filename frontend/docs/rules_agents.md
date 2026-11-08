# Frontend Agent Instructions

- Prefer React Three Fiber declarative JSX over imperative three.js. Imperative code is fine only for per-frame animation (`useFrame`) and shared objects such as the clipping plane and materials.
- Develop against mock data: open `http://localhost:5173/?mock=1`, or leave `VITE_API_URL` unset, and uploads resolve to `src/samples/sampleWalls.json` after 1.5 s. "View a sample model" loads it instantly.
- The sample is an asymmetric L with a chamfered top-right corner. If the chamfer appears anywhere but top-right, wall rotation is mirrored (see `Walls.jsx`, `rotation={[0, -w.rotation, 0]}`).
- Run `npm run lint` and `npm run build` before declaring a task done. Check the browser console for errors and warnings.
