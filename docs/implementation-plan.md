# NoteSync Validation and Implementation Plan

## Progress Update

Applied in the current repo during this implementation pass:

- `Phase 1 foundation`: local repository moved from in-memory toward persistent storage with `expo-sqlite` integration on native targets, web persistence fallback, local schema creation, pending sync queue, note version history, and device secret bootstrap through `expo-secure-store`
- `Phase 2 foundation`: Prisma schema, initial migration SQL, store abstraction, environment-driven store selection, and Prisma-backed API store implementation with memory fallback
- `Phase 3 implementation`: password hashing moved away from raw SHA-256 to salted `scrypt`, refresh token rotation and revocation were added, auth/email validation was tightened, and auth/share rate limiting was added
- `Phase 4 implementation`: the mobile client now talks to the live API for account auth, note sync, secure share creation, and protected share retrieval
- `Phase 5 and 6 implementation`: Markdown, HTML, and RTF conversion UX now exists, and PDF/DOCX/HTML/RTF/Markdown export flows were added
- `Phase 7 foundation`: manual sync push/pull flow, queue consumption, conflict deferral, and sync-enabled note behavior were added
- `Phase 8 implementation`: unit/integration tests and CI workflow were added
- `Phase 9 foundation`: Docker/MySQL, Prisma deploy/seed scripts, EAS configuration, Expo release metadata, and deployment docs were added

Important current limitation:

- native device validation and EAS release execution were not run in this session
- Prisma/MySQL deployment config exists, but a real database migration was not executed as part of this repo-only implementation pass
- sync currently runs as an explicit user action; there is no background worker yet

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
| Secure note-taking platform | `Done` | Local encrypted notes, account auth, sync, share, and export flows all exist at functional prototype level. |
| Markdown support | `Done` | Current editor flow is Markdown-first. |
| HTML support | `Done` | HTML conversion, editing selection, and export flow are implemented. |
| RTF support | `Done` | RTF conversion, editing selection, and export flow are implemented. |
| Device-based encryption | `Partial` | AES-256-GCM, SecureStore bootstrap, and manual device-key rotation exist, but recovery policy is still limited. |
| Local storage | `Partial` | SQLite-backed local persistence and web fallback exist, plaintext preview was removed, but native validation is still pending. |
| Secure API sharing | `Done` | Mobile client now creates live shares, and protected share retrieval/decryption flow exists. |

### 1.2 UX / UI

| Requirement | Status | Notes |
| --- | --- | --- |
| Modern card-based UI | `Done` | The current mobile/web UI is card-based and structured around note, security, and share surfaces. |
| Minimal steps for note creation and sharing | `Done` | Save, sync, share creation, and share access are available directly in the main surfaces. |
| AI-assisted design without Figma | `Done` | Current UI is code-first and directly implemented in React Native. |
| Dark mode | `Done` | Implemented. |
| Blue/navy palette from the original report | `Partial` | Repo originally used a blue-dark palette, but the current UI was intentionally shifted to dark gray by the latest request. |

### 1.3 Technology Stack

| Requirement | Status | Notes |
| --- | --- | --- |
| React Native / Expo client | `Done` | Implemented. |
| Node.js API | `Done` | Fastify-based API scaffold exists and builds successfully. |
| MySQL central DB | `Partial` | Prisma schema, migration SQL, docker-compose, seed flow, and deploy scripts exist, but a real DB rollout was not executed in this session. |
| SQLite local DB | `Partial` | `expo-sqlite` integration, schema versioning, queue/history/archive support, and secure summaries exist, but device validation is still pending. |
| AES-256-GCM | `Partial` | Encryption, decryption, device secret bootstrap, share-password encryption, and manual key rotation exist, but full recovery policy is still incomplete. |
| Android / iOS target | `Partial` | Expo app exists, but no device build validation, native permissions review, or release setup yet. |
| Windows second phase support | `Not Started` | No React Native Windows or Electron/Tauri work yet. |

### 1.4 Security and Privacy

| Requirement | Status | Notes |
| --- | --- | --- |
| AES protection for user notes | `Partial` | Note payloads stay encrypted locally and previews are no longer stored in plaintext, but title metadata remains queryable by design. |
| Unshared data stays on device | `Done` | Notes default to local-only mode and only sync/share when explicitly enabled by the user. |
| Shared notes protected by URL + password | `Done` | Share creation re-encrypts content with the share password, and retrieval requires slug + password. |
| JWT-based auth | `Done` | Register/login, access tokens, refresh rotation, logout, revocation, email validation, and rate limiting exist. |

### 1.5 Outputs and Expected Features

| Requirement | Status | Notes |
| --- | --- | --- |
| PDF export | `Done` | Client-side PDF export flow exists. |
| Word export | `Done` | Client-side DOCX export flow exists. |
| Cross-platform synchronized hybrid note platform | `Partial` | Manual sync queue push/pull exists, but background sync and richer conflict UX are still pending. |
| Offline performance optimization with SQLite | `Partial` | SQLite foundation exists, but no performance validation, indexing review beyond basic indices, or device profiling has been done yet. |
| High concurrency through Node.js API | `Partial` | Framework choice and Prisma store abstraction support the direction, but there is no production deployment, rate limiting, or load validation yet. |
| Microservice-compatible extensibility | `Partial` | Monorepo boundaries, store abstraction, and shared packages are a good base, but there is no actual service decomposition or infrastructure contract layer yet. |

## 2. What Is Implemented Today

### Implemented

- React Native / Expo mobile client structure
- Mobile-first responsive UI with note list, editor, security panel, and share panel
- Native local storage foundation with `expo-sqlite`
- Device secret bootstrap with `expo-secure-store`
- Shared types package
- Shared note-domain package
- Shared crypto package with AES-256-GCM helpers
- Fastify API with health, auth, notes, and share endpoints
- JWT issuance in the API
- Prisma schema, migration SQL, and store abstraction
- Monorepo workspace structure and build pipeline

### Implemented but only as prototype/scaffold

- Local encrypted note persistence
- Encryption flow inside the client
- Share creation and access flow
- User authentication and persistence strategy
- Prisma-backed API persistence path
- Web preview support through Expo

## 3. Main Gaps

These are the biggest differences between the report and the actual implementation:

1. Native Android/iOS validation and release execution have not been run yet
2. MySQL/Prisma deployment config exists, but a real database rollout was not executed in this session
3. Device-key recovery policy is still limited to local rotation; there is no account-based key recovery
4. Sync is manual and defers conflicts instead of offering a full merge/resolution UX
5. Windows second-phase support is still not implemented

## 4. Detailed Implementation Plan

## Phase 1: Local-First Mobile Foundation

Status: `Partial`

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

### Completed in code

- `expo-sqlite` added
- `expo-secure-store` added
- local schema created for `notes`, `note_versions`, `pending_sync_queue`, and `share_history`
- `LocalNoteRepository` moved away from in-memory-only behavior
- device secret bootstrap implemented
- encrypted content is persisted locally
- pending sync queue records are written
- plaintext preview storage removed from active persistence path
- archive/history/all-note repository methods added
- local schema metadata and manual device-key rotation added

### Still missing

- validate native SQLite behavior on Android and iOS
- expand recovery handling for corrupted local rows or device-loss scenarios

### Deliverables

- SQLite-backed `LocalNoteRepository`
- Device key bootstrap flow
- Local encrypted note create/update/list/read support

### Acceptance Criteria

- Notes remain after app restart
- Unshared content body is stored only as encrypted payload locally
- App can list notes offline without hitting the API

## Phase 2: Real Backend Persistence

Status: `Partial`

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

### Completed in code

- Prisma package and client integration added
- MySQL schema file added
- initial migration SQL added
- store abstraction added
- Prisma-backed store implemented
- environment-driven store provider selection added
- docker-compose, Prisma deploy, and seed flow added
- runtime store healthcheck added

### Still missing

- actual migration execution against a database
- hosted environment verification in `STORE_PROVIDER=prisma` mode

### Deliverables

- Prisma schema
- MySQL-backed auth, note metadata, and sharing services
- Migration files and seed data

### Acceptance Criteria

- Restarting the API does not lose users or shares
- Share access logs persist
- JWT login/register works against the database

## Phase 3: Authentication Hardening

Status: `Done`

Goal: make auth closer to production quality.

### Tasks

1. Replace raw SHA-256 password hashing with a modern salted password hash
2. Add refresh token rotation
3. Add session revocation and logout
4. Add email uniqueness and validation constraints
5. Add rate limiting on auth and share endpoints

### Deliverables

- Secure password storage (`scrypt`)
- Session lifecycle management
- Abuse protection

### Acceptance Criteria

- Passwords are not stored with plain SHA-256
- Refresh tokens can be rotated and revoked
- Repeated invalid logins are throttled

## Phase 4: Share Flow Completion

Status: `Done`

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

Status: `Done`

Goal: satisfy the report’s Markdown / HTML / RTF note requirement.

### Tasks

1. Keep Markdown as canonical editing model for v1
2. Define an internal document model
3. Add HTML import/export converters
4. Add RTF import/export converters
5. Add format selector and conversion UX

### Deliverables

- Markdown, HTML, and RTF conversions
- UI support for choosing and converting formats

### Acceptance Criteria

- User can create Markdown notes
- User can import/export HTML
- User can import/export RTF

## Phase 6: Export Features

Status: `Done`

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

Status: `Partial`

Goal: implement the hybrid data model promised in the report.

### Tasks

1. Define what syncs and what stays local-only
2. Add a local sync queue
3. Add note metadata sync endpoints
4. Add conflict detection/versioning
5. Add sync status states in the UI

### Completed in code

- local pending sync queue table exists
- sync state values exist in shared types and UI
- manual sync queue consumer exists
- mobile push/pull sync flow exists
- sync-enabled note model exists
- basic conflict deferral exists

### Still missing

- automatic background/foreground sync scheduling
- richer conflict resolution UI beyond deferral

### Deliverables

- Sync contract between mobile and API
- Background/foreground sync operations
- Conflict handling rules

### Acceptance Criteria

- Local-only notes remain device-local
- Selected/sync-enabled notes can sync metadata or payload according to product rules
- Sync conflicts are surfaced predictably

## Phase 8: Testing and Quality

Status: `Partial`

Goal: make the codebase dependable.

### Tasks

1. Add unit tests for core domain and conversion helpers
2. Add API integration tests for auth/share
3. Add repository-adjacent tests for local web persistence helpers
4. Add UI smoke tests for core screens
5. Add CI build/test workflow

### Deliverables

- Test suite
- CI pipeline

### Acceptance Criteria

- Auth/share APIs are covered
- Build and test run in CI

## Phase 9: Release and Deployment

Status: `Partial`

Goal: make the project deployable and distributable.

### Tasks

1. Add production environment handling
2. Add API deployment target
3. Add Expo/EAS configuration
4. Add mobile app icons, splash, and release metadata
5. Add operational docs

### Deliverables

- Deployable API configuration
- Installable mobile build configuration
- Release and deployment docs

### Acceptance Criteria

- API can run from the provided Docker/Prisma deployment path
- Mobile builds can be generated from the provided Expo/EAS configuration

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

1. run Prisma migrations against a real MySQL instance
2. validate Android and iOS native device behavior for SQLite, sharing, and export
3. add background sync scheduling and richer conflict handling UX
4. define longer-term account-based recovery strategy for device key loss
5. decide whether title metadata should remain queryable locally or move to an encrypted index strategy

This sprint closes the biggest gap between the report and the current prototype.
