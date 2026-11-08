# Frontend collaboration rules

- Follow `../../docs/frontend_plan.md` and the shared contract in `../../docs/project_level_plan.md`.
- Use Tailwind utility classes; `src/index.css` contains only the Tailwind import. Componentize UI and keep viewer code in `src/components/viewer/`.
- Keep changes in `frontend/`. Coordinate contract changes with the backend and update all shared plans together.
- Never expose backend credentials or log image payloads.
