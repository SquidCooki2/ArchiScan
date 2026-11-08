# ArchiScan frontend

React 19 + Vite + React Three Fiber + Tailwind v4. Turns the backend's wall list into an orbitable 3D model with a section cut.

```bash
npm install
npm run dev     # http://localhost:5173
npm run lint
npm run build
```

Copy `.env.example` to `.env` to point at the backend. Without `VITE_API_URL` (or with `?mock=1`) the app runs on the bundled sample plan.

Plans and rules: `../docs/frontend_plan.md`, `docs/`.
