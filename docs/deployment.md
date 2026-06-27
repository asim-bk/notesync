# Deployment and Release Notes

## Local infrastructure

Start MySQL and the API together:

```bash
docker compose up --build
```

The compose stack does three things on startup:

1. starts MySQL 8
2. runs Prisma migrations
3. seeds a demo user and launches the API on `http://localhost:4000`

## Local API without Docker

1. Copy `apps/api/.env.example` to `apps/api/.env`
2. Set `STORE_PROVIDER=prisma`
3. Point `DATABASE_URL` to a running MySQL instance
4. Run:

```bash
npm --workspace @notesync/api run prisma:deploy
npm --workspace @notesync/api run seed
npm --workspace @notesync/api run dev
```

## Mobile / web client

For Expo web:

```bash
EXPO_PUBLIC_API_BASE_URL=http://localhost:4000 npm run dev:web
```

For native preview builds:

```bash
npx eas build --platform android --profile preview
npx eas build --platform ios --profile preview
```

## CI

GitHub Actions workflow: `.github/workflows/ci.yml`

It runs:

- monorepo build
- mobile TypeScript check
- domain tests
- API integration tests
- mobile persistence helper tests

## Seeded demo account

Default demo credentials created by `npm --workspace @notesync/api run seed`:

- email: `demo@notesync.local`
- password: `DemoPass123!`

Override with:

- `SEED_DEMO_EMAIL`
- `SEED_DEMO_PASSWORD`
- `SEED_DEMO_NAME`
