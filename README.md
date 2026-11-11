# Fullstack Web Development Template

## Getting Started

This project needs to be executed in a Unix-like environment (e.g., Linux, macOS, or Windows WSL2) with an `sh`-compatible shell.

### Prerequisites

- **Node.js** (v20.0.0+) and **npm**

  ```sh
  npm install npm@latest -g
  ```

- Add local Node modules to `PATH` (optional for direct CLI execution)

  ```sh
  export PATH=$PATH:./node_modules/.bin
  ```

### Installation & Quick Start

1. Clone the repository

   ```sh
   git clone https://...
   cd ...
   ```

2. Install all workspace dependencies

   ```sh
   npm install
   ```

3. Build the project

   ```sh
   npm run build
   ```

4. Start the Express web server on port `8080`

   ```sh
   npm start
   ```

   Open `http://localhost:8080` in your Browser.

## Project Structure

This repository is configured as an **npm workspaces** monorepo:

```text
├── package.json          # Monorepo root configuration, shared devDependencies & lifecycle scripts
├── lib/                  # Shared commons workspace used across client and server
│   ├── package.json      # Package definition for shared module
│   ├── src/              # Reusable ES module logic
│   └── test/             # Unit tests for shared common utilities (Mocha)
├── webapp/               # Client-side browser application
│   ├── package.json      # Webapp workspace scripts, build tooling & dependencies
│   ├── src/
│   │   ├── index.html    # Single HTML entry point for the browser application
│   │   ├── assets/       # Static frontend assets
│   │   ├── styles/       # Less stylesheets (compiled to dist/main.css)
│   │   └── js/           # Modular ES6+ client code (bundled to dist/bundle.js)
│   ├── test/             # Unit and component tests for frontend modules (Mocha)
│   └── dist/             # Generated static build artifacts
└── server/               # Server-side Node.js & Express application
    ├── package.json      # Server workspace configuration, Express dependency & start scripts
    ├── src/
    │   └── js/           # Express HTTP server, static file hosting & REST endpoints
    └── test/             # Integration and API route tests for backend services (Mocha)
```

## Development Scripts

All primary commands should be executed from the **root directory**:

- `npm run lint` – Checks all JS files (`semistandard`) and Less files (`lesshint`) across `webapp` and `server`.
- `npm run format` – Automatically fixes formatting issues via `semistandard --fix`.
- `npm test` – Runs Mocha unit tests across all workspaces.
- `npm run debug` – Lints the code and builds the unminified project into `webapp/dist`.
- `npm run build` – Lints the code and builds the minified & obfuscated production bundle into `webapp/dist`.
- `npm start` – Starts the Express HTTP server on default port `8080`.
- `node server/src/js/Server.mjs <port>` – Starts the Express HTTP server on a custom port (e.g., `9090`).
- `npm run clean` – Removes all generated build files (`dist`) and downloaded dependencies (`node_modules`).

## Development Guidelines

- **Code Style:** All JavaScript files (`.mjs`) must strictly adhere to `semistandard` rules. Both `npm run debug` and `npm run build` will abort automatically if any linting errors are detected.
- **Tech Stack Restrictions:** Do **not** use TypeScript or any frontend frameworks/libraries such as Angular, React, Vue.js, or jQuery.
- **Modularization:** Use native ES modules (`import`/`export`) in `webapp/src/js/` and bundle them via `esbuild`.
