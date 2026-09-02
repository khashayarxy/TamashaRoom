# Database Schema

## Entity Relationship Diagram

```mermaid
erDiagram
    USER ||--o{ ROOM : owns
    USER ||--o{ ROOM_MEMBER : joins
    USER ||--o{ CHAT_MESSAGE : sends
    USER ||--o{ MESSAGE_REPORT : reports
    USER ||--o{ SUBTITLE_TRACK : uploads

    ROOM ||--o{ ROOM_MEMBER : has
    ROOM ||--o{ CHAT_MESSAGE : contains
    ROOM ||--o{ SUBTITLE_TRACK : has
    ROOM ||--o{ AUDIT_LOG : generates

    CHAT_MESSAGE ||--o{ MESSAGE_REPORT : reported_in

    USER {
        int id PK
        string name
        string email UK
        string password
        timestamp created_at
    }

    ROOM {
        int id PK
        string code UK
        string name
        int owner_id FK
        boolean is_locked
        string video_url
        float position_seconds
        timestamp created_at
    }

    ROOM_MEMBER {
        int id PK
        int room_id FK
        int user_id FK
        string presence_status
        timestamp last_seen_at
    }

    CHAT_MESSAGE {
        int id PK
        int room_id FK
        int user_id FK
        text body
        timestamp created_at
    }

    MESSAGE_REPORT {
        int id PK
        int message_id FK
        int reporter_id FK
        string reason
        timestamp created_at
    }

    SUBTITLE_TRACK {
        int id PK
        int room_id FK
        int user_id FK
        string label
        string file_path
        boolean is_default
        timestamp created_at
    }

    AUDIT_LOG {
        int id PK
        int user_id FK
        string action
        string auditable_type
        int auditable_id
        json context
        timestamp created_at
    }
```

## Table Descriptions

### users
Authenticated users. Guest users are created temporarily for anonymous room joins.

### rooms
Watch-party rooms. Each room has a unique 6-character code for sharing.

### room_members
Junction table for users in rooms. Tracks presence status (online/offline) and last heartbeat.

### chat_messages
Chat messages within a room. Soft-deleted when removed by owner/moderator.

### message_reports
User-submitted reports for inappropriate messages. Unique constraint prevents duplicate reports.

### subtitle_tracks
Uploaded subtitle files (SRT/VTT) for a room. One can be marked as default.

### audit_logs
Immutable log of sensitive actions (delete, kick, transfer, report, settings change) for security forensics.
