# ArchiTech

See the devpost: https://devpost.com/software/archiscan

Upload a floor plan and get a 3D building you can cut open, walk through, plan an escape route in, and price up. The backend reads the drawing with the Claude API. A plan saved as JSON opens without it.

## Run it

Needs Node.js 22.12+ and an Anthropic API key for reading images. The samples and JSON plans work without the backend.

```bash
cd backend && cp .env.example .env && npm install && npm run dev
```

```bash
cd frontend && cp .env.example .env && npm install && npm run dev
```

Add your key to `backend/.env`, then open http://localhost:5173.

## Files

```
backend/        Node API: turns a floor plan image into a list of building elements
  src/routes/   API endpoints
  src/services/ Claude API calls
  src/lib/      validation of what comes back
frontend/       React and React Three Fiber app
  src/components/ interface panels, with the 3D scene in viewer/
  src/lib/      geometry, roofs, escape routes, bill of materials, exports
  src/api/      calls to the backend
  tests/        frontend tests
docs/           project plans and backlog
sample_output/  saved floor plans as JSON
```

More detail is in [frontend/README.md](frontend/README.md).
