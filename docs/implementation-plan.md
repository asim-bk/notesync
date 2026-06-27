# NoteSync Validation and Implementation Plan

## Progress Update

Applied in the current repo during this implementation pass:

- `Phase 1 foundation`: local repository moved from in-memory toward persistent storage with `expo-sqlite` integration on native targets, web persistence fallback, local schema creation, pending sync queue, note version history, and device secret bootstrap through `expo-secure-store`
- `Phase 2 foundation`: Prisma schema, initial migration SQL, store abstraction, and Prisma-backed API store implementation with memory fallback

Still pending from the full plan:

- full SQLite behavior validation on physical mobile devices
- real MySQL instance connection and migration execution
- auth hardening
- real share retrieval UI
- HTML / RTF
- PDF / Word export
- sync engine
- test / CI / deployment phases

## 1. Validation Against `project.txt`

Status labels:

- `Done`: implemented in the current repo at a functional prototype level
- `Partial`: scaffolded or demonstrated, but not production-ready and not fully aligned with the requirement
- `Not Started`: not implemented yet

### 1.1 Product Scope

| Requirement | Status | Notes |
| --- | --- | --- |
| Secure note-taking platform | `Partial` | Core note creation/edit flow exists in the mobile UI, but only as a local prototype. |
| Markdown support | `Done` | Current editor flow is Markdown-first. |
| HTML support | `Not Started` | Types exist for `html`, but no editor/import/export implementation. |
| RTF support | `Not Started` | Types exist for `rtf`, but no editor/import/export implementation. |
| Device-based encryption | `Partial` | AES-256-GCM helpers exist in shared crypto code, but mobile runtime currently uses a simplified web/mobile helper and no device secure storage integration yet. |
| Local storage | `Partial` | A local repository abstraction exists, but it is in-memory, not SQLite-backed yet. |
| Secure API sharing | `Partial` | API endpoints and share flow exist, but they use an in-memory store, not persistent DB-backed infrastructure. |

### 1.2 UX / UI

| Requirement | Status | Notes |
| --- | --- | --- |
| Modern card-based UI | `Done` | The current mobile/web UI is card-based and structured around note, security, and share surfaces. |
| Minimal steps for note creation and sharing | `Partial` | Flow is compact, but real sharing and persistence are still prototype-level. |
| AI-assisted design without Figma | `Done` | Current UI is code-first and directly implemented in React Native. |
| Dark mode | `Done` | Implemented. |
| Blue/navy palette from the original report | `Partial` | Repo originally used a blue-dark palette, but the current UI was intentionally shifted to dark gray by the latest request. |

### 1.3 Technology Stack

| Requirement | Status | Notes |
| --- | --- | --- |
| React Native / Expo client | `Done` | Implemented. |
| Node.js API | `Done` | Fastify-based API scaffold exists and builds successfully. |
| MySQL central DB | `Not Started` | No MySQL integration yet. |
| SQLite local DB | `Not Started` | No SQLite integration yet. |
| AES-256-GCM | `Partial` | Encryption algorithm and payload model exist, but end-to-end production key management is incomplete. |
| Android / iOS target | `Partial` | Expo app exists, but no device build validation, native permissions review, or release setup yet. |
| Windows second phase support | `Not Started` | No React Native Windows or Electron/Tauri work yet. |

### 1.4 Security and Privacy

| Requirement | Status | Notes |
| --- | --- | --- |
| AES protection for user notes | `Partial` | Implemented in helper code, not yet integrated with secure device key storage and SQLite persistence. |
| Unshared data stays on device | `Partial` | Intended architecture matches this, but current prototype is in-memory rather than persisted locally. |
| Shared notes protected by URL + password | `Partial` | Implemented in API logic and mobile share preview model, but not connected to persistent backend or public share UI. |
| JWT-based auth | `Partial` | Register/login and JWT issuance exist, but sessions, refresh rotation, revocation, and user persistence are not production-ready. |

### 1.5 Outputs and Expected Features

| Requirement | Status | Notes |
| --- | --- | --- |
| PDF export | `Not Started` | No implementation yet. |
| Word export | `Not Started` | No implementation yet. |
| Cross-platform synchronized hybrid note platform | `Not Started` | No sync engine or central note sync yet. |
| Offline performance optimization with SQLite | `Not Started` | Not implemented. |
| High concurrency through Node.js API | `Partial` | Framework choice supports it, but the current in-memory store is not sufficient for real concurrency claims. |
| Microservice-compatible extensibility | `Partial` | Monorepo boundaries and packages are a good base, but no actual service decomposition or infrastructure contracts yet. |

## 2. What Is Implemented Today

### Implemented

- React Native / Expo mobile client structure
- Mobile-first responsive UI with note list, editor, security panel, and share panel
- Shared types package
- Shared note-domain package
- Shared crypto package with AES-256-GCM helpers
- Fastify API with health, auth, notes, and share endpoints
- JWT issuance in the API
- Monorepo workspace structure and build pipeline

### Implemented but only as prototype/scaffold

- Local repository abstraction
- Encryption flow inside the client
- Share creation and access flow
- User authentication
- Web preview support through Expo

## 3. Main Gaps

These are the biggest differences between the report and the actual implementation:

1. No SQLite persistence
2. No MySQL persistence
3. No real user/account database
4. No production secure key storage on the device
5. No real mobile share retrieval flow
6. No HTML/RTF support
7. No PDF/Word export
8. No sync layer between local and central data
9. No tests for critical security and data flows
10. No deployment/release configuration

## 4. Detailed Implementation Plan

## Phase 1: Local-First Mobile Foundation

Goal: turn the client from an in-memory prototype into a real offline-capable secure notes app.

### Tasks

1. Add `expo-sqlite`
2. Add `expo-secure-store`
3. Create a local schema:
   - `notes`
   - `note_versions`
   - `pending_sync_queue`
   - `share_history`
4. Replace `LocalNoteRepository` in-memory Map with SQLite-backed reads/writes
5. Store a device-scoped encryption secret in SecureStore
6. Encrypt note content before local persistence
7. Keep note metadata queryable without decrypting full content where possible

### Deliverables

- SQLite-backed `LocalNoteRepository`
- Device key bootstrap flow
- Local encrypted note create/update/list/read support

### Acceptance Criteria

- Notes remain after app restart
- Unshared content is stored only as encrypted payload locally
- App can list notes offline without hitting the API

## Phase 2: Real Backend Persistence

Goal: replace the in-memory API store with durable central persistence.

### Tasks

1. Add `Prisma`
2. Configure MySQL connection
3. Create schema tables:
   - `users`
   - `notes_metadata`
   - `shared_notes`
   - `share_access_logs`
   - `refresh_sessions`
4. Replace `MemoryStore` with repository/services
5. Add migration scripts
6. Add environment validation

### Deliverables

- Prisma schema
- MySQL-backed auth, note metadata, and sharing services
- Migration files and seed data

### Acceptance Criteria

- Restarting the API does not lose users or shares
- Share access logs persist
- JWT login/register works against the database

## Phase 3: Authentication Hardening

Goal: make auth closer to production quality.

### Tasks

1. Replace raw SHA-256 password hashing with `argon2` or `bcrypt`
2. Add refresh token rotation
3. Add session revocation and logout
4. Add email uniqueness and validation constraints
5. Add rate limiting on auth and share endpoints

### Deliverables

- Secure password storage
- Session lifecycle management
- Abuse protection

### Acceptance Criteria

- Passwords are not stored with plain SHA-256
- Refresh tokens can be rotated and revoked
- Repeated invalid logins are throttled

## Phase 4: Share Flow Completion

Goal: move from share preview to real secure share consumption.

### Tasks

1. Add mobile API client layer
2. Submit real share creation requests from the app
3. Build a share access screen for slug + password
4. Add expiry and max-view enforcement in the UI
5. Record access logs in backend persistence

### Deliverables

- Real share creation from client to API
- Public/shared note view flow
- Password-protected access flow

### Acceptance Criteria

- A note can be shared from the app
- Shared content can be opened with valid password and slug
- Expired or exhausted shares are blocked

## Phase 5: Multi-Format Notes

Goal: satisfy the report’s Markdown / HTML / RTF note requirement.

### Tasks

1. Keep Markdown as canonical editing model for v1
2. Define an internal document model
3. Add HTML import/export converters
4. Add RTF import/export converters
5. Add format selector and conversion UX

### Deliverables

- Canonical note document model
- Markdown, HTML, and RTF conversions
- UI support for choosing and converting formats

### Acceptance Criteria

- User can create Markdown notes
- User can import/export HTML
- User can import/export RTF

## Phase 6: Export Features

Goal: meet the PDF/Word output requirement.

### Tasks

1. Choose export strategy:
   - HTML to PDF pipeline
   - HTML/Markdown to DOCX pipeline
2. Add export service in the client or backend
3. Add export UI in the app
4. Handle typography and page layout templates

### Deliverables

- PDF export flow
- Word/DOCX export flow

### Acceptance Criteria

- User can export a selected note to PDF
- User can export a selected note to Word/DOCX

## Phase 7: Sync Architecture

Goal: implement the hybrid data model promised in the report.

### Tasks

1. Define what syncs and what stays local-only
2. Add a local sync queue
3. Add note metadata sync endpoints
4. Add conflict detection/versioning
5. Add sync status states in the UI

### Deliverables

- Sync contract between mobile and API
- Background/foreground sync operations
- Conflict handling rules

### Acceptance Criteria

- Local-only notes remain device-local
- Selected/sync-enabled notes can sync metadata or payload according to product rules
- Sync conflicts are surfaced predictably

## Phase 8: Testing and Quality

Goal: make the codebase dependable.

### Tasks

1. Add unit tests for crypto helpers
2. Add API integration tests for auth/share
3. Add repository tests for local persistence
4. Add UI smoke tests for core screens
5. Add CI build/test workflow

### Deliverables

- Test suite
- CI pipeline

### Acceptance Criteria

- Encryption/decryption paths are covered
- Auth/share APIs are covered
- Build and test run in CI

## Phase 9: Release and Deployment

Goal: make the project deployable and distributable.

### Tasks

1. Add production environment handling
2. Add API deployment target
3. Add Expo/EAS configuration
4. Add mobile app icons, splash, and release metadata
5. Add operational docs

### Deliverables

- Deployable API
- Installable mobile build configuration
- Release checklist

### Acceptance Criteria

- API can run in a hosted environment
- Mobile builds can be generated for Android/iOS

## 5. Recommended Execution Order

Recommended order for efficient delivery:

1. Phase 1: Local-First Mobile Foundation
2. Phase 2: Real Backend Persistence
3. Phase 3: Authentication Hardening
4. Phase 4: Share Flow Completion
5. Phase 5: Multi-Format Notes
6. Phase 6: Export Features
7. Phase 7: Sync Architecture
8. Phase 8: Testing and Quality
9. Phase 9: Release and Deployment

## 6. Immediate Next Sprint

The most valuable next sprint is:

1. add `expo-sqlite`
2. add `expo-secure-store`
3. persist encrypted notes locally
4. add Prisma + MySQL schema
5. replace API in-memory store

This sprint closes the biggest gap between the report and the current prototype.
