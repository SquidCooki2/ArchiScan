# Frontend verification — November 8, 2026

## Automated checks

- `npm run lint`: passed without warnings.
- `npm test`: four geometry tests passed (rotated bounds, asymmetric sample orientation, invalid payloads, empty scene).
- `npm run build`: passed. Vite reports a large lazy-loaded viewer chunk (~964 kB minified / 263 kB gzip), which includes the 3D engine. Further bundle optimization is optional.
- `git diff --check`: passed.

## Browser checks

Verified with headless Chrome/Playwright against the local Vite server. Desktop viewport: 1440 × 1000. Narrow viewport: 390 × 844. All 19 checks passed:

1. Initial upload UI and WebGL canvas render.
2. Wrong file type displays an error toast.
3. Files over 5 MB are rejected.
4. Cancelled uploads cannot replace the scene later.
5. Mock uploads show loading, then a centered model and demo labeling.
6. Section toggle and slider cut the model; horizontal caps appear at the selected height.
7. Reset, fit, orbit, and zoom work.
8. Narrow-screen controls stay inside the viewport without horizontal overflow.
9. The sample button works when a real API URL is configured.
10. Failed replacement uploads preserve sample metadata as well as geometry.
11. The real API path sends raw Base64 plus mediaType and accepts a valid wall array.
12. Backend error messages display while the previous model remains usable.
13. Malformed wall geometry is rejected before rendering.
14. Empty wall arrays display an actionable error.
15. Network failures display a connection error.
16. The 150-second timeout cancels the request and preserves the previous model.
17. Toasts dismiss automatically after six seconds.
18. Keyboard file selection and Escape cancellation work.
19. Drag-and-drop upload works.

Screenshots were visually reviewed for the upload screen, full-height model, capped section, and narrow-screen layout. No application console warnings or runtime errors remained. Software-GPU screenshot readback diagnostics were excluded from application-console checks.

API responses were intercepted for browser testing; this verifies the frontend request/response handling, not backend parsing quality. Test tooling and screenshots were kept under `/tmp`, outside the project dependency tree.

## Remaining integration work

The backend currently has no API implementation, so Task 7 remains open. Once it is ready:

1. Configure `frontend/.env` using `.env.example`; restart Vite without `?mock=1`.
2. Start the backend on port 3000 with CORS allowing `http://localhost:5173`.
3. Upload genuine floorplans, including an asymmetric plan; compare the resulting layout, openings, scale, and orientation with the images.
4. Confirm the model is fitted automatically and the section slider remains smooth with real payloads.
5. Verify actual backend failures and CORS behavior. Mark Task 7 complete only after these checks pass.

No backend or shared-contract files were changed.
