# WellPath Health Assessment

[![CI](https://github.com/awdr123/health-test-/actions/workflows/ci.yml/badge.svg)](https://github.com/awdr123/health-test-/actions/workflows/ci.yml?query=branch%3Amain)

## Live Review

- Public URL: https://health-test-bmw0.onrender.com
- Paid test `userId`: `c16c5473-71f6-40f9-8ff8-ebd4bd5b96bc`
- Paid test `sessionId`: `render_review_0457a7adb7804bde876ae00e1a1d5f0f`

Render's free tier sleeps after 15 minutes without traffic. The first request after sleeping can take about 30-50 seconds to cold start; this is expected.

## Contents

1. [Project Overview](#project-overview)
2. [Quick Start](#quick-start)
3. [Database Schema](#database-schema)
4. [API Documentation](#api-documentation)
5. [Testing](#testing)
6. [CI Status](#ci-status)
7. [Deployment](#deployment)
8. [AI Use Retrospective](#ai-use-retrospective)

## Project Overview

WellPath is a mobile-friendly health assessment application. It saves an anonymous user's progress, calculates BMI, calorie targets, profile classifications, and a four-week weight projection on the server, then redacts premium fields until the mock subscription is active. Progress and payment writes use Prisma transactions and idempotent `upsert` operations.

### Technology Stack

- Next.js 14 App Router and React 18
- TypeScript
- Prisma ORM with PostgreSQL 16
- Zod request validation
- Vitest with a temporary SQLite integration-test database
- GitHub Actions CI
- Render web hosting and Neon serverless PostgreSQL

## Quick Start

Prerequisites: Node.js 20+ and a reachable PostgreSQL database.

```bash
npm install
```

Create `.env` and point `DATABASE_URL` at PostgreSQL:

```dotenv
DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/DATABASE?sslmode=require"
```

Apply the committed migrations and start the development server:

```bash
npx prisma migrate deploy
npm run dev
```

Open `http://localhost:3000`.

## Database Schema

The source diagram is also available in [`docs/schema.md`](docs/schema.md).

```mermaid
erDiagram
    User ||--|| HealthRecord : owns
    User ||--o| Subscription : subscribes

    User {
        String id PK
        DateTime createdAt
        DateTime updatedAt
    }

    HealthRecord {
        String id PK
        String userId FK,UK
        Int step
        String gender
        String goal
        Int age
        Float heightCm
        Float weightKg
        Float targetWeightKg
        String bodyType
        String lifestyle
        String activityLevel
        String metabolism
        String activity
        Float bmi
        Int dailyCalories
        DateTime targetDate
        Json weeklyProjection
        Boolean completed
        DateTime createdAt
        DateTime updatedAt
    }

    Subscription {
        String id PK
        String userId FK,UK
        String status
        String plan
        DateTime createdAt
        DateTime updatedAt
    }
```

`HealthRecord.userId` enforces one active assessment record per user. `Subscription.userId` enforces an optional one-to-one subscription, which is the only source of truth for membership status.

## API Documentation

All request and response bodies are JSON. Invalid UUIDs, enum values, steps, types, and numeric ranges return `400`.

### `POST /api/progress`

Incrementally creates or updates a user's single health record. Fields other than `userId` and `step` are optional.

Request:

```json
{
  "userId": "c16c5473-71f6-40f9-8ff8-ebd4bd5b96bc",
  "step": 3,
  "gender": "female",
  "goal": "lose",
  "age": 30,
  "targetWeightKg": 55
}
```

Response `200`:

```json
{
  "record": {
    "id": "cmu3rdhs4000bprqpknrmioif",
    "userId": "c16c5473-71f6-40f9-8ff8-ebd4bd5b96bc",
    "step": 3,
    "completed": false
  }
}
```

### `GET /api/progress?userId={uuid}`

Restores the user's latest saved progress.

Response `200`:

```json
{
  "record": {
    "userId": "c16c5473-71f6-40f9-8ff8-ebd4bd5b96bc",
    "step": 3,
    "age": 30,
    "targetWeightKg": 55
  }
}
```

### `POST /api/assessment`

Validates the complete assessment, calculates the result, stores the profile and weekly projection, and marks the record complete.

Request:

```json
{
  "userId": "c16c5473-71f6-40f9-8ff8-ebd4bd5b96bc",
  "step": 6,
  "gender": "female",
  "goal": "lose",
  "age": 30,
  "heightCm": 165,
  "weightKg": 60,
  "targetWeightKg": 55,
  "activity": "moderate"
}
```

Response `200`:

```json
{ "recordId": "cmu3rdhs4000bprqpknrmioif" }
```

### `GET /api/result?userId={uuid}`

Returns profile fields for every completed assessment. For a free user, premium fields are explicitly `null`:

```json
{
  "isMember": false,
  "bmi": 22,
  "bmiLabel": "Within the typical range",
  "bodyType": "Mesomorph",
  "lifestyle": "Active",
  "activityLevel": "Intermediate",
  "metabolism": "Slow",
  "dailyCalories": null,
  "targetDate": null,
  "weeklyProjection": null,
  "plan": null,
  "lockedFields": ["dailyCalories", "targetDate", "weeklyProjection", "plan"]
}
```

After payment, the same endpoint returns the complete result:

```json
{
  "isMember": true,
  "bmi": 22,
  "dailyCalories": 1650,
  "weeklyProjection": [
    { "week": 1, "weight": 59.25 },
    { "week": 2, "weight": 58.5 },
    { "week": 3, "weight": 57.75 },
    { "week": 4, "weight": 57 }
  ],
  "lockedFields": []
}
```

An incomplete or unknown assessment returns `404`.

### `POST /api/pay`

Activates an idempotent mock monthly subscription for an existing user. This endpoint does not charge money or contact a payment provider.

Request:

```json
{
  "userId": "c16c5473-71f6-40f9-8ff8-ebd4bd5b96bc",
  "sessionId": "render_review_0457a7adb7804bde876ae00e1a1d5f0f"
}
```

Response `200`:

```json
{
  "paid": true,
  "sessionId": "render_review_0457a7adb7804bde876ae00e1a1d5f0f",
  "subscriptionId": "cmu3rdklz000kprqp0dkiyc1k"
}
```

Replay the paid test account:

```bash
curl -X POST https://health-test-bmw0.onrender.com/api/pay \
  -H "Content-Type: application/json" \
  -d '{"userId":"c16c5473-71f6-40f9-8ff8-ebd4bd5b96bc","sessionId":"render_review_0457a7adb7804bde876ae00e1a1d5f0f"}'
```

## Testing

Run the complete suite with one command:

```bash
npm test
```

Generate the coverage report:

```bash
npm test -- --coverage
```

### Coverage Matrix

| Scenario group | Test file | Cases |
| --- | --- | ---: |
| Health calculations, projection boundaries, invalid measurements, and all profile mappings | `tests/health.test.ts` | 21 |
| Partial/complete schemas, target-weight bounds, string injection, and invalid enums | `tests/validation.test.ts` | 10 |
| Progress restore/order/replay/concurrency, result redaction, payment, and API errors | `tests/api.integration.test.ts` | 10 |
| **Total** | **3 test files** | **41** |

### Current Coverage

| Module | Statements | Branches | Functions | Lines |
| --- | ---: | ---: | ---: | ---: |
| All core modules | 97.21% | 86.66% | 100% | 97.21% |
| `app/api/assessment/route.ts` | 100% | 75% | 100% | 100% |
| `app/api/pay/route.ts` | 100% | 100% | 100% | 100% |
| `app/api/progress/route.ts` | 95.55% | 87.5% | 100% | 95.55% |
| `app/api/result/route.ts` | 96.29% | 63.63% | 100% | 96.29% |
| `lib/health.ts` | 96% | 91.48% | 100% | 96% |
| `lib/validation.ts` | 100% | 100% | 100% | 100% |

### What Is Covered

The suite exercises the pure health algorithm, validation boundaries, direct route-handler calls, real database persistence, partial-save recovery, out-of-order and duplicate writes, ten concurrent progress requests, free/member result differences, subscription activation, and error responses. Integration tests use an isolated temporary SQLite database and clean their own users.

### Why These Tests

The highest-risk behavior is server-owned: numerical health calculations, strict input validation, one-record-per-user persistence, and premium-field redaction. Testing these layers directly gives fast, deterministic feedback while still executing Prisma queries and complete API handler logic. Boundary and adversarial inputs receive more coverage than visual happy paths because incorrect acceptance or premium-data leakage has the larger impact.

### What Is Not Covered Yet

- Browser-level E2E is not included. The UI is intentionally low risk relative to the server contracts, and the current suite avoids browser-driver cost and flakiness.
- PostgreSQL concurrency is not exercised in CI. CI uses temporary SQLite so it needs no external service; therefore engine-specific lock scheduling and isolation behavior remain a production smoke-test concern.
- SQLite and PostgreSQL do not have identical JSON, locking, and type-coercion behavior. The tradeoff is a fast, hermetic CI suite plus an explicit Render/Neon public smoke flow, rather than a slower external database dependency on every push.
- The mock payment route does not test a real provider signature, webhook replay, or financial transaction because the project deliberately contains no external payment service.

## CI Status

CI runs on every push and pull request using Node.js 20:

1. `npm ci`
2. `npx prisma generate`
3. `npx tsc --noEmit`
4. `npm test`
5. `npm run build`

- [Latest `main` workflow runs](https://github.com/awdr123/health-test-/actions/workflows/ci.yml?query=branch%3Amain)
- [Workflow definition](.github/workflows/ci.yml)

CI sets a placeholder PostgreSQL URL for Prisma generation, while integration tests generate a dedicated SQLite Prisma client and temporary database. No PostgreSQL service is required in CI.

## Deployment

- **Application:** Render Free Web Service at https://health-test-bmw0.onrender.com
- **Database:** Neon serverless PostgreSQL, connected through a secret Render `DATABASE_URL` with `sslmode=require`
- **Build command:** `npm install && npm run build`
- **Start command:** `npm run start`
- **Schema deployment:** committed Prisma migrations applied with `npx prisma migrate deploy`
- **Images:** Next.js `remotePatterns` permits optimized images from `images.unsplash.com`

Render automatically builds `main`. The database credential is stored only as an environment secret and is not committed to Git.

## AI Use Retrospective

I used AI as an implementation and review partner rather than as an unquestioned code generator. For database modeling, it helped enumerate the one-to-one relationships among `User`, `HealthRecord`, and `Subscription`, compare ownership rules, and identify that membership must have one source of truth. For mock data, it proposed representative users across BMI bands, goals, activity levels, and paid/free states so the examples exercise meaningful branches instead of repeating one happy path. For the health algorithm, it helped decompose BMI, calorie adjustment, profile classification, and the capped 0.75 kg weekly interpolation into pure functions with explicit bounds. For testing, it generated an initial edge-case inventory that I refined into missing fields, non-numeric injection strings, invalid enums, +/-50 kg target differences, partial recovery, out-of-order writes, duplicate submissions, ten concurrent requests, and premium-data redaction.

### A Proposal I Rejected

AI once suggested adding an optimistic-lock `version` field to `HealthRecord` and rejecting updates when the submitted version was stale. I rejected that design. WellPath intentionally has one active health record per anonymous user, and restoring progress always means reading that same latest record; there is no business requirement to preserve or merge competing historical versions. A version column would force the browser to carry synchronization state, add retry/error UX, and complicate every partial save without improving the product model. I instead used a unique constraint on `HealthRecord.userId` and wrapped `User.upsert` plus `HealthRecord.upsert` in a Prisma transaction. That makes repeated and concurrent saves naturally idempotent, prevents duplicate active records at the database boundary, and keeps recovery as a single lookup by `userId`. The decision is smaller, easier to test, and aligned with the actual invariant rather than a generic concurrency pattern.

AI output was also reviewed for security boundaries. In particular, premium values are removed by the result API for free users rather than merely hidden in React, and subscription state is read only from `Subscription`. The calculations are estimates for a coding demonstration and are not medical advice.
