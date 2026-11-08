# Frontend agent rules

- Prefer declarative React Three Fiber components. Use engine mutations only where required for camera controls, clipping, and animation.
- Develop using `?mock=1`; the frontend must remain usable without a backend.
- Preserve the image-space coordinate convention: +X right, +Z down, wall centers in meters, image rotation rendered as negative Y rotation.
- Validate API payloads before rendering and preserve the previous model on upload failures.
- Run `npm run lint`, `npm test`, and `npm run build` before marking work complete. Record unverified integration steps honestly.
