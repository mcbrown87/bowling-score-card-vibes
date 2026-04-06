# Data Model

This document describes the persisted data model in Prisma/Postgres and the JSON shape stored inside bowling score records.

## Relational Model

```mermaid
erDiagram
    User {
        string id PK
        string email UK
        string passwordHash
        string name
        string image
        datetime emailVerified
        datetime createdAt
        datetime updatedAt
    }

    Account {
        string id PK
        string userId FK
        string type
        string provider
        string providerAccountId
        string refreshToken
        string accessToken
        int expiresAt
        string tokenType
        string scope
        string idToken
        string sessionState
    }

    Session {
        string id PK
        string sessionToken UK
        string userId FK
        datetime expires
    }

    VerificationToken {
        string identifier
        string token UK
        datetime expires
    }

    StoredImage {
        string id PK
        string userId FK
        string bucket
        string objectKey
        string originalFileName
        string contentType
        int sizeBytes
        datetime createdAt
        datetime updatedAt
    }

    BowlingScore {
        string id PK
        string storedImageId FK
        string llmRequestId FK
        int gameIndex
        string playerName
        int totalScore
        json frames
        json tenthFrame
        string provider
        boolean isEstimate
        string rawText
        datetime createdAt
        datetime updatedAt
    }

    LLMRequest {
        string id PK
        string storedImageId FK
        string promptId FK
        string provider
        string model
        datetime startedAt
        datetime completedAt
        int durationMs
        string status
        string errorMessage
        json rawRequest
        json rawResponse
        string rawText
        datetime createdAt
        datetime updatedAt
    }

    Prompt {
        string id PK
        string version UK
        string content
        datetime createdAt
        datetime updatedAt
    }

    User ||--o{ Account : has
    User ||--o{ Session : has
    User ||--o{ StoredImage : owns
    StoredImage ||--o{ BowlingScore : produces
    StoredImage ||--o{ LLMRequest : triggers
    Prompt ||--o{ LLMRequest : versions
    LLMRequest o|--o{ BowlingScore : generated
```

## Bowling Score JSON Payload

`BowlingScore.frames` stores frames 1 through 9 as JSON. `BowlingScore.tenthFrame` stores frame 10 separately.

```mermaid
classDiagram
    class Roll {
      +number pins
    }

    class Frame {
      +Roll[] rolls
      +number score
      +boolean isStrike
      +boolean isSpare
    }

    class TenthFrame {
      +Roll[] rolls
      +number score
      +boolean isStrike
      +boolean isSpare
    }

    class GamePayload {
      +Frame[] frames
      +TenthFrame tenthFrame
      +number totalScore
      +string playerName
      +boolean isEstimate
    }

    GamePayload "1" *-- "9" Frame
    GamePayload "1" *-- "1" TenthFrame
    Frame "1" *-- "1..2" Roll
    TenthFrame "1" *-- "1..3" Roll
```

## Notes

- `StoredImage` is the root record for one uploaded scorecard image stored in object storage.
- `BowlingScore` keeps one row per parsed game variant. The `(storedImageId, gameIndex, isEstimate)` unique key allows both estimated and corrected versions of the same game index.
- `LLMRequest.status` is currently used as a free-form string, but the code path uses `queued`, `pending`, `succeeded`, and `failed`.
- `BowlingScore.llmRequestId` is nullable because manually corrected scores can outlive or detach from the generating request.
- `StoredImage` API responses expose derived fields such as `previewUrl`, `isProcessingEstimate`, and `lastEstimateError`; those are serializer outputs, not database columns.
