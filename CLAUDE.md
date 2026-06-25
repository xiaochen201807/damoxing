# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository rules

- All code, SQL, config, scripts, and docs must be saved as UTF-8. This is explicitly required by `AGENTS.md`.
- Preserve org-scoping fields when touching backend request handling: `jgbh`, `zjgbh`, `zzbs`, `zzjgdmz`. Auth and data routing depend on them.

## Repo layout

- `client/`: React 17 + TypeScript + Vite frontend using AMIS for rendering page schemas.
- `server/`: Express backend, SQLite system database, optional Oracle/达梦/PostgreSQL/GaussDB/Kingbase business datasources, Nunjucks-based schema generation, and MCP server support.
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
- Initialize cxgzkz control table (multi-datasource): `cd server && npm run db:init:cxgzkz`
- Verify cxgzkz table structure and CRUD: `cd server && npm run db:verify:cxgzkz`
- Check business standard consistency: `cd server && npm run check:ywbz`
- Run MCP server over stdio: `cd server && npm run mcp`

### PowerShell usage

- All commands should use `pwsh` (PowerShell 7) on Windows, not bash or cmd.
- Navigate directories with `cd` and run npm commands normally.

### Useful project-level workflow

- Main local dev setup: start backend on `3001`, then frontend on `3000`.
- Vite proxies `VITE_API_ROUTE_PREFIX` (default `/api`) to `http://localhost:3001`.
- Node.js `>=20.0.0` required for both `client/` and `server/`.
- Backend API route prefix is controlled by `API_ROUTE_PREFIX` env var (default `/api`).

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
  - `db.getByJgbh(jgbh)` selects a business adapter (Oracle, 达梦, PostgreSQL, GaussDB, or Kingbase) for tenant/business queries based on `config/datasources.json`.
- Multi-datasource routing is initialized at startup and can be strict (`strict_routing`) or fallback to the default datasource.
- `db.oracle` is a legacy alias for `defaultAdapter`; prefer `db.getByJgbh(...)` in all new code.
- `DB_PATH` env var controls the SQLite file path; `SQLITE_READONLY=true` disables write transactions.

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

## Commit style

- Short, direct summaries, often in Chinese (e.g. `增加任务项目接口`, `处理子机构问题`).
- Keep each commit scoped to one change.

## Project-specific skills

### `/setup-beibei-entry` - 配置贝贝入口

插入PT_JG_SX_CSH表的关键数据算法相关记录。

**依赖**：使用新的 `@damoxing/datasource-manager` 进行多数据源路由。

使用方法:
```bash
/setup-beibei-entry <机构编号> [基础域名]
```

示例:
```bash
/setup-beibei-entry 2301110003
/setup-beibei-entry 2301110003 https://custom.domain.com
```

工作流程:
1. 等待 datasource manager 初始化完成
2. 根据机构编号查询PT_JG_SX_CSH表中的"对象定义"记录，获取ZXJSID
3. 插入四条关键数据算法相关的记录：
   - 关键数据计算模型
   - 公积金关键数据计算模型配置
   - 公积金业务标准库
   - 程序规则控制管理
4. 验证插入结果并显示统计信息

注意事项:
- 需要在 `server/config/datasources.json` 中正确配置该机构的数据源
- 该机构必须已存在"对象定义"属性记录
- 如果记录已存在会自动跳过，不会重复插入（通过 jgbh + sxmc 判断）
- 所有数据库类型统一使用 `f_newid()` 函数生成ID（已在各数据库中自定义）
- SXBS 字段自动从数据库查询最大值 +1，无需手动指定
- Skill 会调用 `db.ready()` 等待数据源管理器初始化完成后再执行操作

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
