# Claude Forge

An independent, browser-first coding workspace prototype with planned Windows and Android packages. It is not an official Claude product and does not bypass Anthropic access requirements.

## Run in a browser
The public web UI is deployed through GitHub Pages and requires no local installation. The hosted frontend is a UI shell; real Claude agent execution requires a separately hosted backend with valid, authorized Claude Agent SDK access.

## Local backend
- Node.js 20+
- Copy `.env.example` to `.env`
- Set `WORKSPACE_DIR` to a dedicated disposable project folder
- Run `npm install`, then `npm run dev`
- Open http://127.0.0.1:4173

Agent execution is disabled by default. Read SECURITY.md before enabling it. API access may cost money; a Claude chat subscription does not guarantee API credits.

## Builds
GitHub Actions workflows are provided for:
- GitHub Pages web UI
- Windows Electron package (.exe)
- Android APK (debug build)

Build artifacts are attached to workflow runs. Unsigned Windows builds may show a SmartScreen warning. Debug APKs are for testing, not Play Store distribution.

## Roadmap
1. Reliable streamed SDK events and session persistence.
2. Patch/diff review and safe accept/reject.
3. Sandboxed terminal with command allowlists and approvals.
4. Multi-agent planner/coder/tester/reviewer orchestration.
5. Git branch/diff/commit/rollback controls.
6. Signed releases and production backend deployment.
