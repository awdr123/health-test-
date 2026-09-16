# WellPath Final Acceptance Check

Final verification date: 2026-09-16

## Summary

| Challenge dimension | Result | Primary evidence |
| --- | --- | --- |
| Backend engineering | ✅ | Five documented API operations, strict Zod schemas, consistent error handling |
| Database design | ✅ | PostgreSQL Prisma schema, three related models, unique user foreign keys, committed migrations |
| End-to-end logic | ✅ | Partial save/restore, server calculation, access gating, payment activation, concurrency regression |
| Tests and quality | ✅ | 41/41 tests, 97.21% line coverage, successful type-check/build, green GitHub Actions |
| AI effectiveness | ✅ | Detailed retrospective and a concrete rejected AI proposal |
| Delivery | ✅ | Render URL, GitHub repository, Mermaid schema, paid test credentials, replayable cURL |

No failed acceptance item remains.

## A. Backend Engineering ✅

### API contracts

| Method and route | Contract evidence | Response behavior |
| --- | --- | --- |
| `POST /api/progress` | [`app/api/progress/route.ts`](../app/api/progress/route.ts#L18) | Transactional user and health-record upserts; returns `{ record }` |
| `GET /api/progress?userId=` | [`app/api/progress/route.ts`](../app/api/progress/route.ts#L6) | Strict UUID query validation; returns `{ record }` |
| `POST /api/assessment` | [`app/api/assessment/route.ts`](../app/api/assessment/route.ts#L8) | Complete validation, server calculation, transactional persistence; returns `{ recordId }` |
| `GET /api/result?userId=` | [`app/api/result/route.ts`](../app/api/result/route.ts#L6) | `404` for incomplete records; redacted or complete result based on `Subscription` |
| `POST /api/pay` | [`app/api/pay/route.ts`](../app/api/pay/route.ts#L11) | Strict payment schema and subscription upsert; returns payment/subscription identifiers |

All API examples and replay instructions are documented in [`README.md`](../README.md#api-documentation). Validation failures are normalized by [`lib/api.ts`](../lib/api.ts).

### Zod validation and invalid-input evidence

[`lib/validation.ts`](../lib/validation.ts#L3) requires a UUID, integer step `0..6`, enumerated gender/goal/activity values, and bounded numeric measurements. Complete submissions require every assessment field. [`app/api/pay/route.ts`](../app/api/pay/route.ts#L6) independently validates payment input.

HTTP-level `400` regression tests in [`tests/api.integration.test.ts`](../tests/api.integration.test.ts#L161):

- ✅ `returns 400 for a malformed GET userId`: rejects a non-UUID query value.
- ✅ `returns 400 for invalid progress and assessment bodies`: rejects `step: 7`, the numeric-string injection `age: "30 OR 1=1"`, and `targetWeightKg: 251`.
- ✅ `returns 400 for an invalid payment body`: rejects `userId: "not-a-uuid"` and a too-short `sessionId`.

Schema-level boundary and injection tests in [`tests/validation.test.ts`](../tests/validation.test.ts#L6):

- ✅ `rejects a complete submission with missing fields`.
- ✅ `requires a target weight between 30 and 250 kg`: missing, `29`, `251`, and `"55 OR 1=1"` are rejected.
- ✅ `rejects string injection in age/heightCm/weightKg/targetWeightKg` (four parameterized cases).
- ✅ `rejects unsupported gender/goal/activity enum values` (three parameterized cases).

## B. Database Design ✅

- [`prisma/schema.prisma`](../prisma/schema.prisma#L5) uses `provider = "postgresql"`.
- The three models are `User`, `HealthRecord`, and `Subscription`.
- `HealthRecord.userId @unique` enforces one active record per user.
- `Subscription.userId @unique` gives a user zero or one subscription and makes that table the membership source of truth.
- Both child relations use `onDelete: Cascade`.
- `HealthRecord` includes `targetWeightKg`, `bodyType`, `lifestyle`, `activityLevel`, `metabolism`, and `weeklyProjection`.
- [`20260916033828_init_v2`](../prisma/migrations/20260916033828_init_v2/migration.sql) creates all three PostgreSQL tables and both unique indexes.
- [`20260916050000_add_health_projection`](../prisma/migrations/20260916050000_add_health_projection/migration.sql) adds the JSONB projection column.
- [`docs/schema.md`](schema.md) contains the complete Mermaid ER diagram: `User 1--1 HealthRecord` and `User 1--0..1 Subscription`.

Production migrations were previously applied to Neon with `npx prisma migrate deploy` and are exercised by the public Render service.

## C. End-to-End Logic ✅

Implementation evidence:

- [`app/api/progress/route.ts`](../app/api/progress/route.ts#L35) wraps `User.upsert` and `HealthRecord.upsert` in a Prisma transaction.
- [`app/api/assessment/route.ts`](../app/api/assessment/route.ts#L10) computes results only on the server and transactionally persists them.
- [`lib/health.ts`](../lib/health.ts#L80) is a pure calculation entry point with projection and profile rules.
- [`app/api/result/route.ts`](../app/api/result/route.ts#L11) reads `Subscription`, returns four premium fields as `null` for free users, and returns the complete result for active members.
- [`app/api/pay/route.ts`](../app/api/pay/route.ts#L14) transactionally upserts the subscription.

Named integration evidence in [`tests/api.integration.test.ts`](../tests/api.integration.test.ts#L53):

- ✅ `restores a partially saved assessment after interruption`.
- ✅ `restores the latest write when steps arrive out of order`.
- ✅ `keeps one record when the same step is submitted twice`.
- ✅ `keeps one record across ten concurrent progress updates`.
- ✅ `returns 404 when an incomplete user requests results`.
- ✅ `redacts premium fields, activates a subscription, then returns the complete result`.
- ✅ `returns 404 when payment is attempted for an unknown user`.

Health-logic evidence in [`tests/health.test.ts`](../tests/health.test.ts#L20) covers the 5 kg projection, 1 kg truncation, non-loss `null` projection, invalid measurements/targets, all BMI body types, and all activity/lifestyle/metabolism mappings.

## D. Tests and Quality ✅

Final local command:

```text
$ npm test -- --coverage
Test Files  3 passed (3)
Tests       41 passed (41)
All files: statements 97.21%, branches 86.66%, functions 100%, lines 97.21%
```

Core-module line coverage:

| Module | Lines |
| --- | ---: |
| `app/api/assessment/route.ts` | 100% |
| `app/api/pay/route.ts` | 100% |
| `app/api/progress/route.ts` | 95.55% |
| `app/api/result/route.ts` | 96.29% |
| `lib/health.ts` | 96% |
| `lib/validation.ts` | 100% |

Additional checks:

- ✅ `npx tsc --noEmit` completed with exit code `0`.
- ✅ `npm run build` completed successfully.
- ✅ GitHub Actions workflow runs install, generate Prisma, type-check, test, and build.
- ✅ Latest verified green run before this report: [Stabilize SQLite concurrency tests](https://github.com/awdr123/health-test-/actions/runs/35068089942), status `Success`.
- ✅ Workflow/run index: [CI on main](https://github.com/awdr123/health-test-/actions/workflows/ci.yml?query=branch%3Amain).

The SQLite test URL uses `connection_limit=1` so Promise-based concurrency is repeatable on Linux runners while the unique constraint and transactional upsert invariant remain under test.

## E. AI Effectiveness ✅

[`README.md` section 9](../README.md#ai-use-retrospective) explains how AI supported database modeling, representative mock data, the health algorithm, validation boundaries, and test-case discovery. It also records human review of security and premium-data boundaries.

The required rejection case is concrete and first-person: I rejected an AI proposal to add an optimistic-lock `version` field. Because the product has one active record per user and recovery reads that record, the version would add browser synchronization, retry UX, and write complexity without serving a real domain requirement. I selected `HealthRecord.userId @unique` plus transactional `User.upsert`/`HealthRecord.upsert`, which directly enforces idempotency and prevents duplicates.

## F. Delivery ✅

- ✅ Public application: https://health-test-bmw0.onrender.com
- ✅ GitHub repository: https://github.com/awdr123/health-test-
- ✅ Database diagram: [`docs/schema.md`](schema.md)
- ✅ Previously documented paid reviewer: `c16c5473-71f6-40f9-8ff8-ebd4bd5b96bc` / `render_review_0457a7adb7804bde876ae00e1a1d5f0f`
- ✅ Final-check paid reviewer: `c147f36e-2b88-4979-ab41-300cc5821bf2` / `final_check_8a65f192a32141a8828ec2084abb0b60`
- ✅ Replayable `/api/pay` cURL is in [`README.md`](../README.md#post-apipay).

```bash
curl -X POST https://health-test-bmw0.onrender.com/api/pay \
  -H "Content-Type: application/json" \
  -d '{"userId":"c16c5473-71f6-40f9-8ff8-ebd4bd5b96bc","sessionId":"render_review_0457a7adb7804bde876ae00e1a1d5f0f"}'
```

## Production Walkthrough ✅

Fresh production identity:

```text
URL=https://health-test-bmw0.onrender.com
userId=c147f36e-2b88-4979-ab41-300cc5821bf2
sessionId=final_check_8a65f192a32141a8828ec2084abb0b60
```

Observed results:

```text
STEP 1 progress-save HTTP=200
userId=c147f36e-2b88-4979-ab41-300cc5821bf2
recordId=cmu3s3q9d00022dno83zkix5q step=1 completed=false

STEP 2 progress-save HTTP=200
recordId=cmu3s3q9d00022dno83zkix5q step=6 weightKg=64 targetWeightKg=59

STEP 3 progress-restore HTTP=200
recordId=cmu3s3q9d00022dno83zkix5q step=6 weightKg=64 targetWeightKg=59

STEP 4 assessment HTTP=200
recordId=cmu3s3q9d00022dno83zkix5q

STEP 5 free-result HTTP=200
isMember=false bmi=22.7 dailyCalories=null weeklyProjection=null
lockedFields=dailyCalories,targetDate,weeklyProjection,plan

STEP 6 pay HTTP=200
paid=true sessionId=final_check_8a65f192a32141a8828ec2084abb0b60
subscriptionId=cmu3s3u60000b2dnomkmwifdy

STEP 7 member-result HTTP=200
isMember=true dailyCalories=1700
weeklyProjection=[{"week":1,"weight":63.25},{"week":2,"weight":62.5},{"week":3,"weight":61.75},{"week":4,"weight":61}]
planItems=3 lockedFields=0

STEP 8 refresh-persistence HTTP=200
samePayload=true isMember=true dailyCalories=1700 projectionPoints=4
```

The same `recordId` across both saves, restore, and assessment proves the one-record invariant. The second member GET exactly matched the first member response, proving persistence across refresh.

## Known Limitations and Tradeoffs

- **Render cold starts:** the free instance sleeps after about 15 minutes without traffic. Its first request can take roughly 30-50 seconds.
- **SQLite CI vs PostgreSQL production:** CI uses a temporary SQLite database for fast, hermetic runs, while production uses Neon PostgreSQL. Engine-specific locking, JSON, and type behavior are not identical; the public production walkthrough covers the PostgreSQL path.
- **No browser E2E suite:** route-handler integration tests and a production API walkthrough cover the highest-risk contracts, but automated click-through rendering and browser interaction are not yet covered.
- **No real payment provider:** `/api/pay` is an idempotent mock activation endpoint. It intentionally does not implement checkout, signatures, webhooks, refunds, or financial transactions.
