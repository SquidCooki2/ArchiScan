# Backend Backlog
*   [x] Task 1: Set up Express server and CORS (`app.js`, `server.js`, `/api/health`, npm scripts, `.gitignore`).
*   [x] Task 2: Configure `.env`/`.env.example`, `config.js` with fail-fast validation, and initialize the Anthropic SDK in `services/claude.js`.
*   [x] Task 3: Write the `/api/parse-blueprint` endpoint (request validation, size check, media type handling).
*   [x] Task 4: Claude Vision prompt, `extractJson`, `validateWalls` with unit tests and the single retry. (Prompt still needs tuning against real floorplans in Task 6.)
*   [x] Task 5: Full error table and error middleware, plus route tests with a mocked claude service.
*   [ ] Task 6: End-to-end check with real floorplans together with the frontend; tune prompt and scale handling. Requires a real `ANTHROPIC_API_KEY`.
