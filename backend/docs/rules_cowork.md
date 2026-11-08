# Backend Cowork Rules
*   All secrets come from environment variables (`backend/.env`). Never commit `.env`; only `.env.example`.
*   Never log full Base64 strings (or the API key) to the console. Log image byte length only.
*   Keep the Anthropic SDK import isolated in `src/services/claude.js`.
*   Don't change the coordinate convention or API contract without updating `docs/project_level_plan.md`, `docs/backend_plan.md`, and `frontend/docs/`.
