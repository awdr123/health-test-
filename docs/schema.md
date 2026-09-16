# WellPath Database Schema

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

`HealthRecord.userId` and `Subscription.userId` are unique foreign keys. Deleting a user cascades to both related records. A user owns exactly one active health record in the application model and may have zero or one subscription.
