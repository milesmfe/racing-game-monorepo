# Racing Game Monorepo

A TypeScript monorepo for a real-time multiplayer racing game using WebSockets, built with Hono and Svelte.

## Project Structure

```
racing-game-monorepo/
├── packages/
│   └── core/
│       ├── src/
│       │   └── index.ts
│       ├── package.json
│       └── tsconfig.json
├── apps/
│   ├── server/
│   │   ├── src/
│   │   │   └── index.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   └── web-svelte/
│       ├── src/
│       │   ├── App.svelte
│       │   └── main.ts
│       ├── index.html
│       ├── package.json
│       ├── tsconfig.json
│       ├── vite.config.ts
│       └── svelte.config.js
├── package.json
└── tsconfig.json
```

## Getting Started

### Prerequisites

- Node.js 18+
- npm 7+ (for workspace support)

### Installation

1. Clone the repository:

```bash
git clone https://github.com/milesmfe/racing-game-monorepo.git
cd racing-game-monorepo
```

2. Install all dependencies:

```bash
npm install
```

This will install and hoist all dependencies to the root `node_modules` directory.

### Development

Run all services concurrently (recommended):

```bash
npm run dev
```

This command will:

1. Build the `@racing-game-mono/core` package
2. Start the core package in watch mode
3. Start the Hono server on `http://localhost:3000`
4. Start the Svelte dev server on `http://localhost:5173`

Or run services individually:

```bash
npm run dev:core     # Core package watch mode
npm run dev:server   # Server only
npm run dev:client   # Client only
```

### Building for Production

Build all packages:

```bash
npm run build
```

Build individual packages:

```bash
npm run build -w packages/core
npm run build -w apps/server
npm run build -w apps/web-svelte
```

### Running Production Build

Start the server:

```bash
npm run start -w apps/server
```

Preview the client:

```bash
npm run preview -w apps/web-svelte
```

## Packages

### `@racing-game-mono/core`

Shared TypeScript types and utilities used by both the server and client.

**Key exports:**

- `Player` - Player entity interface
- `GameState` - Game state interface
- `WSMessage` - WebSocket message types

### `@racing-game-mono/server`

Hono-based WebSocket server for real-time multiplayer game logic.

**Tech stack:**

- Hono - Fast web framework
- @hono/node-ws - WebSocket support for Node.js
- TypeScript

**Endpoints:**

- `GET /` - Health check
- `GET /ws` - WebSocket connection

### `@racing-game-mono/web-svelte`

Lightweight Svelte 5 client for the racing game.

**Tech stack:**

- Svelte 5 - Reactive UI framework
- Vite - Build tool and dev server
- TypeScript

## Scripts

### Root Scripts

- `npm run dev` - Run all services in development mode
- `npm run build` - Build all packages
- `npm run clean` - Remove all node_modules and dist folders
- `npm run typecheck` - Type check all packages

### Package Scripts

Each package has:

- `dev` - Development mode with hot reload
- `build` - Production build
- `typecheck` - TypeScript type checking

## Configuration

### TypeScript

The project uses TypeScript with a base configuration at the root that's extended by each package. All packages use ES modules.

### Workspaces

npm workspaces are configured to:

- Hoist shared dependencies to root `node_modules`
- Allow cross-package dependencies using `@racing-game-mono/*` scope
- Enable running scripts across all workspaces

### Dependency Management

Dependencies are automatically hoisted to the root. Only conflicting versions will create package-specific `node_modules` folders.

## WebSocket Communication

The client connects to the server via WebSocket at `ws://localhost:3000/ws`.

**Message Types:**

- `join` - Player joins the game
- `update` - Player position update
- `leave` - Player leaves the game

Example message:

```typescript
{
  type: 'join',
  playerId: 'player1'
}
```

## Development Notes

### Adding Dependencies

Add to root (shared dev dependencies):

```bash
npm install -D <package>
```

Add to specific workspace:

```bash
npm install <package> -w apps/server
npm install <package> -w apps/web-svelte
npm install <package> -w packages/core
```

### Creating New Workspaces

```bash
npm init -w packages/<name> --scope=@racing-game-mono -y
```

### Svelte 5 Note

This project uses Svelte 5 with the new `mount()` API instead of the legacy `new Component()` syntax.

## Troubleshooting

**Dependencies not found:**

```bash
npm run clean
npm install
```

**Type errors in imports:**

```bash
npm run build -w packages/core
npm run typecheck
```

**WebSocket connection issues:**
Ensure the server is running on port 3000 and the client is configured to connect to the correct WebSocket URL.

## Links

- Repository: https://github.com/milesmfe/racing-game-monorepo
- Issues: https://github.com/milesmfe/racing-game-monorepo/issues
