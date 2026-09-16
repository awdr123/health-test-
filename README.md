# WellPath health assessment

A full-stack, mobile-friendly health quiz that persists progress, calculates a server-side health snapshot, gates premium fields by subscription status, and includes a replayable mock payment flow.

## Stack

- Next.js 14 App Router + TypeScript
- Prisma with PostgreSQL 16
- Zod validation at every write boundary
- Vitest for calculation and validation tests

## Run locally

```bash
npm install
copy .env.example .env
docker compose up -d --wait
npx prisma migrate dev
npm run dev
```

Open `http://localhost:3000`.

## API

| Method | Route | Purpose |
| --- | --- | --- |
| `GET` | `/api/progress?userId=...` | Restore the latest quiz record |
| `POST` | `/api/progress` | Incrementally save a partial quiz |
| `POST` | `/api/assessment` | Validate, calculate and complete an assessment |
| `GET` | `/api/result?userId=...` | Return a redacted or complete result based on subscription status |
| `POST` | `/api/pay` | Replayable mock payment; requires `userId` and a unique-looking `sessionId` |

Example payment replay:

```bash
curl -X POST http://localhost:3000/api/pay \
  -H "Content-Type: application/json" \
  -d '{"userId":"YOUR_UUID","sessionId":"demo_checkout_123456"}'
```

## Data model

- `User`: stable anonymous ID
- `HealthRecord`: partial answers, progress step, completed assessment and calculated outputs
- `Subscription`: plan and status, linked one-to-one with a user

## Test coverage

Run `npm test`.

Run the API concurrency check while the development server is running:

```bash
npm run test:concurrency
```

Covered scenarios:

- BMI, calorie target and milestone calculation
- Goal-based calorie adjustment
- Invalid, missing, extreme and non-numeric measurements
- Partial-save acceptance and one-record-per-user concurrency enforcement
- Complete-submission enforcement
- Enum and injection-style input rejection
- SQLite-backed API integration, subscription gating and concurrent upserts

The API also ensures premium fields are omitted at the server boundary for free users. A production project should add authentication, rate limiting, a real payment signature check, and Playwright end-to-end coverage.

## AI use review

AI was used to shape the schema, enumerate edge cases, draft the calculation layer and tests, and review responsive states. The proposed flow was adjusted so premium data is removed by the API rather than merely hidden in the browser. The generated calorie figures are estimates for a coding demonstration, not medical guidance.

## Deployment

The repository is deployment-ready for a standard Next.js host after configuring a persistent PostgreSQL database. A public URL is not included because this environment has no deployment account or credentials.
