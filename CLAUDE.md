# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository rules

- All code, SQL, config, scripts, and docs must be saved as UTF-8. This is explicitly required by `AGENTS.md`.
- Preserve org-scoping fields when touching backend request handling: `jgbh`, `zjgbh`, `zzbs`, `zzjgdmz`. Auth and data routing depend on them.

## Repo layout

- `client/`: React 17 + TypeScript + Vite frontend using AMIS for rendering page schemas.
- `server/`: Express backend, SQLite system database, optional Oracle/达梦 business datasources, Nunjucks-based schema generation, and MCP server support.
- `schema-builder/`: standalone prototype assets for schema/page editing; not part of the main runtime app.
- `docs/`: deployment and architecture notes.

## Common commands

### Frontend (`client`)

- Install deps: `cd client && npm install`
- Start dev server: `cd client && npm run dev`
- Build: `cd client && npm run build`
- Lint: `cd client && npm run lint`
- Preview production build: `cd client && npm run preview`
- Analyze bundle: `cd client && npm run build:analyze`

### Backend (`server`)

- Install deps: `cd server && npm install`
- Start server: `cd server && npm start`
- Start with auto-reload: `cd server && npm run dev`
- Run Jest tests: `cd server && npm test`
- Run a single test file: `cd server && npm test -- --runTestsByPath test/amis-variable-escape.test.js --runInBand`
- Run tests matching a name: `cd server && npm test -- --testNamePattern="transaction rollback"`
- Initialize SQLite DB: `cd server && npm run init-db`
- Run migrations: `cd server && npm run db:migrate`
- Initialize Oracle business DB: `cd server && npm run db:init:oracle`
- Initialize 达梦 business DB: `cd server && npm run db:init:dm`
- Check business standard consistency: `cd server && npm run check:ywbz`
- Run MCP server over stdio: `cd server && npm run mcp`

### Useful project-level workflow

- Main local dev setup: start backend on `3001`, then frontend on `3000`.
- Vite proxies `VITE_API_ROUTE_PREFIX` (default `/api`) to `http://localhost:3001`.

## Architecture overview

### Big picture

This repository is a schema-driven app builder for AMIS pages:

1. The frontend loads route metadata, menus, and page schemas from the backend.
2. The backend stores route/menu/page/template metadata in SQLite system tables.
3. Pages are rendered dynamically from `sys_page_template.schema_json`.
4. New pages can be generated either:
   - from stored Nunjucks templates via `/api/schema/*`, or
   - from Dify AI workflows via `/api/ai/*`.
5. Business data access is separate from the system DB: SQLite is the control plane, while Oracle/达梦 adapters handle tenant/business queries.

### Frontend flow

Key files:
- `client/src/main.tsx`: React 17 entrypoint, loads AMIS CSS, configures MobX isolation.
- `client/src/App.tsx`: mounts `BrowserRouter` with `VITE_BASE_PATH`.
- `client/src/routes/index.tsx`: route table.
- `client/src/layout/MainLayout.tsx`: fetches route metadata and menu tree, then renders sidebar + nested content.
- `client/src/pages/AutoDashboard.tsx`: core dynamic page loader.
- `client/src/pages/SystemConfig.tsx`: dedicated loader for the config page schema.
- `client/src/components/AuthGuard.tsx`: login gate + SSO flow.
- `client/src/utils/fetcher.ts`: central Axios/AMIS request adapter.

Important behavior:
- The main runtime route is `/:routeKey/:pageId` and always resolves through `AutoDashboard`.
- `AutoDashboard` first fetches menu data and verifies that `routeKey + pageId` is allowed before fetching `/api/page/:pageKey`.
- `MainLayout` separately fetches `/api/routes/:routeKey` and `/api/system/menu?route_key=...` to build the shell.
- `fetcher.ts` is the critical client integration point: it adds JWT, forwards gateway headers/body fields, rewrites `/api` to the configured API prefix, and handles file downloads.
- Unauthorized API responses clear local auth state and redirect to `/login`.

### Auth and gateway integration

Key files:
- `client/src/components/AuthGuard.tsx`
- `server/routes/http/auth.js`
- `server/middleware/auth.js`
- `server/services/gatewayService.js`

Important behavior:
- The app supports both local JWT auth and gateway/SSO-style login using URL params like `ticket`, `cheque`, `tyLoginToken`, `qycode`.
- `AuthGuard` prioritizes SSO if those params are present, even if a local token already exists.
- Successful login stores `auth_token`, `user_info`, and `gateway_info` in `localStorage`.
- Backend auth middleware also enforces org consistency by comparing request headers with JWT payload fields (`jgbh`, `zjgbh`).

### Backend HTTP server structure

Key files:
- `server/index.js`: HTTP entrypoint.
- `server/services/http-server.js`: Express app setup.
- `server/routes/http/index.js`: mounts all HTTP routes.
- `server/middleware/security.js`: helmet, rate limiting, SQL injection checks.
- `server/middleware/errorHandler.js`: not-found and error responses.

Important behavior:
- The backend loads `.env`, trusts a reverse proxy, enables CORS, gzip, request logging, global rate limiting, and SQL-injection protection.
- `/health` and `/api/auth/login` are public; most other routes are mounted behind `authenticateToken`.
- MCP HTTP/SSE endpoints under `/api/mcp` are intentionally not JWT-protected; they use separate MCP auth.
- There is still one legacy inline route in `server/routes/http/index.js` for `GET /api/page/:pageKey`; most other APIs are modularized under `server/routes/http/`.

### Data model split: system DB vs business DB

Key files:
- `server/db.js`
- `server/db_sqlite.js`
- `server/db_oracle.js`
- `server/db_dm.js`
- `server/config/datasources.json`

Important behavior:
- SQLite is the default system database and stores routes, menus, templates, Dify config, component library, etc.
- `server/db.js` is a unified adapter facade:
  - `db.all/get/run/exec/transaction` go to SQLite.
  - `db.getByJgbh(jgbh)` selects an Oracle/达梦 adapter for tenant/business queries based on `config/datasources.json`.
- Multi-datasource routing is initialized at startup and can be strict (`strict_routing`) or fallback to the default datasource.
- When changing business-query code, prefer `db.getByJgbh(...)` over legacy `db.oracle.*` access.

### Dynamic routes, menus, and page rendering

Key files:
- `server/routes/http/routes.js`
- `server/routes/http/menu.js`
- `server/routes/http/page-template.js`
- `server/routes/http/index.js` (inline `/api/page/:pageKey` route)

Important behavior:
- `sys_routes` controls top-level route groups (`route_key`, title, layout type).
- `sys_menu` controls sidebar entries and maps them to `page_key` plus `route_key`.
- Active frontend navigation menus are filtered by joining `sys_menu` with active rows in `sys_page_template`.
- Page schemas are stored in `sys_page_template.schema_json`; the frontend renders them through AMIS.
- `menu.js` has separate behavior for end-user navigation vs admin views (`include_inactive=true`).

### Schema/template generation subsystem

Key files:
- `server/routes/http/schema.js`
- `server/templates/`
- `server/test/amis-variable-escape.test.js`

This is one of the most important subsystems in the repo.

Important behavior:
- Page templates are stored in `sys_page_templates_config` and rendered through Nunjucks templates under `server/templates/`.
- `/api/schema/wizard` returns a full AMIS wizard schema, not just data. The frontend/admin UI can embed this directly.
- `/api/schema/template-form/:templateId` converts JSON-schema-like template params into AMIS form fields, including grouped fieldsets and array editors.
- `/api/schema/preview` renders a template without saving.
- `/api/schema/save` renders the template, validates the generated JSON, versions the page in `sys_page_template`, deactivates the old active version, and keeps limited history.
- `source_template_id` and `source_params` are persisted so a saved page can later be reopened in edit mode.
- `sanitizeParams` / `escapeParamsForFrontend` protect AMIS variable syntax during round-trips; be careful when editing template rendering logic.

### AI / Dify integration

Key files:
- `server/routes/http/ai.js`
- `server/routes/http/dify-config.js`

Important behavior:
- `/api/ai/generate` calls Dify chat APIs and expects the result to be JSON that can be rendered as AMIS schema.
- `/api/ai/generate-page` calls Dify workflows and unwraps/normalizes returned JSON, including MCP-style wrapped outputs.
- Per-page Dify config is stored in `sys_dify_config`; env vars are only fallback defaults.
- If no Dify config/API key is present, some AI endpoints intentionally return mock AMIS content instead of failing.
- AI responses are cached.

### MCP support

Key files:
- `server/mcp-server.js`
- `server/services/mcp-server.js`
- `server/routes/mcp/`
- `server/routes/http/mcp-sse.js`

Important behavior:
- The repo supports both a standalone MCP stdio server (`npm run mcp`) and HTTP/SSE MCP endpoints for external integrations.
- In stdio mode, logging must not write to stdout; `server/mcp-server.js` and `services/mcp-server.js` are careful about this.

## Testing notes

- Backend Jest config is in `server/jest.config.cjs` and matches `server/test/**/*.test.js`.
- Representative tests cover AMIS variable escaping, transaction rollback, Oracle placeholder behavior, export security, and the 达梦 adapter.
- There is no root package.json; run npm commands inside `client/` or `server/`.

## Files worth reading before major changes

- `AGENTS.md`
- `README.md`
- `server/routes/http/index.js`
- `server/routes/http/schema.js`
- `server/routes/http/ai.js`
- `server/db.js`
- `client/src/utils/fetcher.ts`
- `client/src/components/AuthGuard.tsx`
- `client/src/pages/AutoDashboard.tsx`
- `client/src/layout/MainLayout.tsx`
