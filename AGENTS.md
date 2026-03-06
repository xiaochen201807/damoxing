# Repository Guidelines
所有代码、SQL、配置文件、脚本、文档的新增、修改和保存都必须使用 UTF-8 字符集编码处理。
如无特殊说明，统一使用 UTF-8；避免因编码不一致导致中文乱码。

## Project Structure & Module Organization
- `client/`: Vite + React + TypeScript frontend. Main code lives in `client/src/`, static assets in `client/public/`.
- `server/`: Express backend, HTTP routes in `server/routes/http/`, shared utilities in `server/utils/`, Nunjucks page templates in `server/templates/`, and Jest tests in `server/test/`.
- `schema-builder/`: standalone HTML-based schema editing prototypes.
- `docs/`: deployment and architecture notes. `logs/` is runtime output and should not be edited by hand.

## Build, Test, and Development Commands
- Frontend dev: `cd client && npm run dev` — starts the Vite dev server.
- Frontend build: `cd client && npm run build` — runs TypeScript build then bundles production assets.
- Frontend lint: `cd client && npm run lint` — runs ESLint on the frontend.
- Backend dev: `cd server && npm run dev` — runs the API server with `nodemon`.
- Backend start: `cd server && npm start` — starts the backend in normal mode.
- Backend tests: `cd server && npm test` — runs Jest tests.
- DB setup: `cd server && npm run init-db` or `npm run migrate` — initializes or migrates local data.

## Coding Style & Naming Conventions
- Use existing file style: 4 spaces in backend/template JSON blocks, and preserve surrounding formatting.
- Keep backend modules small and route-focused; place reusable helpers in `server/utils/`.
- Use descriptive names: `camelCase` for variables/functions, `PascalCase` for React components, and lowercase paths for route files like `server/routes/http/cxgzkz.js`.
- Run `client` lint before submitting frontend changes. Avoid unrelated refactors.

## Testing Guidelines
- Backend tests use Jest with `supertest` where HTTP behavior matters.
- Place tests in `server/test/` and prefer names ending in `.test.js`.
- Start with focused tests for changed routes/utilities before broader regression checks.
- If changing template-driven pages, verify both rendered behavior and related API responses.

## Commit & Pull Request Guidelines
- Follow the repository’s existing commit style: short, direct summaries, often in Chinese, e.g. `增加任务项目接口` or `处理子机构问题`.
- Keep each commit scoped to one change.
- PRs should include: purpose, affected paths, test results, config or data impact, and screenshots for UI/template changes.

## Security & Configuration Tips
- Do not commit real secrets from `.env.production` or database exports.
- Preserve org-scoping fields such as `jgbh` and `zjgbh` when modifying backend routes.
- Treat files under `server/exports/` and runtime databases as sensitive; use sanitized samples only.
