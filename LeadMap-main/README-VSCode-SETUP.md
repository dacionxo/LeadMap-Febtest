# VS Code quick setup (Node versions & tasks)

Quick steps to get the workspace running in VS Code:

- Use a Node version manager (nvm, nvm-windows, or Volta). Two projects require different Node majors:
  - `postiz-app` recommends Node 22: see `postiz-app/.nvmrc`.
  - `portal-backend` recommends Node 20: see `portal-backend/.nvmrc`.

- Recommended commands (nvm on macOS/Linux):

```bash
# in postiz-app folder
cd postiz-app
nvm install
nvm use
pnpm install
pnpm run dev

# in portal-backend folder (new terminal)
cd portal-backend
nvm install
nvm use
npm install
npm run dev
```

- If you use Volta, run `volta pin node@<version>` inside each project directory.

- You can run the workspace tasks from VS Code: open Command Palette → `Tasks: Run Task` → choose `postiz: install`, `portal: install`, `postiz: dev`, `portal: dev`.

If you want, I can try to start the dev servers again after you confirm which Node switching tool you prefer.
