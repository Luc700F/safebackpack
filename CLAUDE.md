# safebackpack

Read `docs/architecture.md` and `docs/decisions.md` before making changes.

## Non-negotiables

- **`src/lib` never imports React or Next.js.** Business logic stays framework-free.
  Dependencies point one way: `app` → `components` → `lib`.
- **No utility-class framework, no inline `style` for design values.** Every colour,
  spacing, radius, shadow and font size comes from a token in `src/styles/tokens.css`.
  Styling lives in `.module.css` files beside the component.
- **Every function in `src/lib` has unit tests**, including its failure paths. Update
  the tests in the same change as the code, never afterwards.
- **The retention period exists in exactly one place**: `RETENTION_DAYS` in
  `src/lib/reports/retention.ts`.
- **Category ids are permanent.** They are stored in the database and appear in URLs.
  Labels may change freely; ids may not.
- Interface language is **English**. Keep user-facing strings translatable — no
  concatenated sentences.

## Before pushing

```
npm run verify
```

## Watch out

- Next.js 16 renamed `middleware` to `proxy`, and Turbopack is the default.
  Consult `node_modules/next/dist/docs/` rather than older knowledge.
- This checkout lives inside a synced cloud folder. Never commit `node_modules`.

@AGENTS.md
