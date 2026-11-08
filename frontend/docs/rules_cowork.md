# Frontend Collaboration Rules

- Style with Tailwind utility classes only. `src/index.css` holds `@import "tailwindcss"` plus a single `@theme` block of design tokens (font, blueprint colour scale, scan keyframes). Add new tokens there; never add selectors or component CSS.
- Componentize cleanly and follow the file layout in `docs/frontend_plan.md` section 3. `App.jsx` owns state; components receive props.
- Don't change the data contract or coordinate convention without updating `docs/project_level_plan.md`, `docs/backend_plan.md`, and `backend/docs/` in the same change.
- Design language: near-black canvas, glass panels (`bg-white/5 backdrop-blur-xl border-white/10 rounded-2xl`), one accent: the cyanotype `blueprint-*` scale. Blueprint is reserved for the section cut, focus rings, and active states. Archivo is the only typeface.
- Every interactive element needs a visible `focus-visible` outline, `cursor-pointer`, and a 300 ms ease-out transition. Respect `prefers-reduced-motion` (`motion-reduce:` variants, `useReducedMotion` in 3D).
- Copy is sentence case and plain. Errors say what happened and how to fix it.
