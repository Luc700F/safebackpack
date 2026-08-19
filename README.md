# safebackpack

Travellers report safety incidents — robbery, theft, harassment, natural
hazards, unrest, scams — on a shared world map. Reports are filterable by
country, category and age, and are deleted automatically after six months.
No account required; an email verification keeps out spam.

## Getting started

```bash
npm install
npm run dev
```

The app runs at http://localhost:3000.

## Commands

| Command | Purpose |
|---|---|
| `npm run dev` | Development server |
| `npm run verify` | Lint, typecheck and unit tests — run before pushing |
| `npm run test` | Unit tests |
| `npm run test:watch` | Unit tests in watch mode |
| `npm run test:coverage` | Unit tests with the 80% coverage gate |
| `npm run test:e2e` | Playwright journeys (builds first) |
| `npm run build` | Production build |

## Where things live

- `src/app` — routes, kept thin
- `src/components` — UI, one folder per component with its own `.module.css`
- `src/lib` — all business logic, framework-free and fully unit-tested
- `src/styles/tokens.css` — every design value in the product
- `tests/e2e` — Playwright journeys
- `docs/` — [architecture](docs/architecture.md) and the [decision record](docs/decisions.md)

## Contributing

Read `docs/architecture.md` first. `npm run verify` must pass before pushing;
CI runs the same checks plus end-to-end tests, a dependency audit and CodeQL.

Security issues: see [SECURITY.md](SECURITY.md).
