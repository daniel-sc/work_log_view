# work_log_view

This is a viewer for [WorkLog](https://github.com/daniel-sc/work_log).
It is a browser-only Vue 3 + TypeScript app, built with Vite and using D3 for charts.
No backend, database, or environment variables are required. Uploaded CSV data is
cached in the browser; display preferences are stored in local storage.

## Development

Install [mise](https://mise.jdx.dev/), then run:

```sh
mise trust
mise install
mise run install
mise run dev
```

`mise.toml` pins Node 22 (matching the TypeScript configuration) and Bun 1.2
(matching the release line used by the GitHub Pages workflow). Dependencies are
installed from `bun.lock` without updating it.

Open the URL printed by Vite, normally <http://localhost:5173>. Drag a WorkLog CSV
onto the page to view weekly activity. Use localhost or HTTPS: CSV persistence
uses the browser Cache API, which requires a secure context.

For a remote development environment, forward port 5173 to localhost. If your
forwarding setup requires listening on all interfaces, run:

```sh
mise run dev -- --host 0.0.0.0
```

## Checks and builds

```sh
mise run check       # Non-mutating lint, type check, and production build
mise run type-check  # Type check only
mise run lint        # Non-mutating lint only
mise run build       # Type check and build into dist/
mise run preview     # Serve dist/ locally, normally on port 4173
mise run test        # Run the CSV parser regression tests with Vitest
```

The repository uses Vitest with jsdom. Run `mise run test` separately from
`mise run check` to check CSV parsing, including quoted and multiline fields.

Existing package scripts remain available through `mise exec -- bun run <script>`.
`bun run lint` applies ESLint fixes, and `bun run format` rewrites source formatting.

The GitHub Pages deployment builds with a repository-specific base path:

```sh
mise exec -- bun run build --base=/work_log_view/
```
