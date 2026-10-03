# Ludo

pnpm workspace for the Ludo project.

## Workspace packages

- `packages/engine` — shared TypeScript engine and its Vitest tests
- `apps/client` — client application workspace
- `apps/server` — server application workspace

## Getting started

Run `pnpm install` to install dependencies, then `pnpm dev` to launch the local
pass-and-play client. Use `pnpm test`, `pnpm lint`, `pnpm typecheck`, and
`pnpm build` from the repository root to validate the engine and client.

See the [client documentation](apps/client/README.md) for phone access, local
gameplay, and the controller/store architecture.

See the [engine documentation](packages/engine/README.md) for rules, board
coordinates, the action API, and deterministic replay.
