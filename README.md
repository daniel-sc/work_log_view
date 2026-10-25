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

`mise.toml` pins Node 24 LTS and Bun 1.4 for both local development and CI.
Dependencies are installed from `bun.lock` without updating it. TypeScript stays
on 6.x for compatibility with Vue's type checker.

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
mise run check       # Non-mutating lint, tests, type check, and production build
mise run type-check  # Type check only
mise run lint        # Non-mutating lint only
mise run build       # Type check and build into dist/
mise run preview     # Serve dist/ locally, normally on port 4173
mise run test        # Run the CSV parser regression tests with Vitest
```

The parser tests use Vitest's Node environment, without a simulated browser.
Run `mise run test` for just the CSV parsing tests, including quoted and
multiline fields; `mise run check` includes them alongside lint and build checks.

Existing package scripts remain available through `mise exec -- bun run <script>`.
`bun run lint` applies ESLint fixes, and `bun run format` rewrites source formatting.

The GitHub Pages deployment builds with a repository-specific base path:

```sh
mise exec -- bun run build --base=/work_log_view/
```

GitHub Actions runs the checks on branch pushes and pull requests. Only successful
pushes to `master` deploy to GitHub Pages, using the artifact from that same run.
