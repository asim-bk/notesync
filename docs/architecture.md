# NoteSync Architecture

## 1. Product Scope

NoteSync, yerel odakli calisan ve secili icerikleri kontrollu bicimde paylasan bir not platformudur.

Ilk surum kapsamı:

- offline not alma
- sifreli yerel depolama
- Markdown tabanli cekirdek not destegi
- guvenli paylasim baglantilari
- kullanici girisi ve JWT tabanli oturum

Ikinci asama:

- RTF/HTML gelismis editor
- PDF/Word export
- Windows istemcisi
- daha kapsamli senkronizasyon

## 2. Recommended Architecture

### Client side

`apps/mobile`

- `Expo + React Native + TypeScript`
- state yonetimi: `zustand`
- navigation: `React Navigation`
- local db: `expo-sqlite`
- secure storage: `expo-secure-store`

### Server side

`apps/api`

- `Fastify + TypeScript`
- ORM: `Prisma`
- auth: `JWT`
- DB: `MySQL`

### Shared packages

`packages/shared-types`
- api contracts
- enums
- payload interfaces

`packages/note-domain`
- note entity
- serializer/parser contracts
- share policy rules

`packages/crypto-core`
- encrypt/decrypt helpers
- key derivation contracts
- encrypted payload envelope

## 3. Storage Model

### Local device

- encrypted note content
- local metadata
- pending sync records
- cached share history

### Server

- users
- shared_notes
- share_access_logs
- refresh/session records

Sunucu tarafinda yalnizca paylasilan veya senkronize edilmesi secilen veri tutulmali.

## 4. Security Model

- content encryption: `AES-256-GCM`
- key derivation: `PBKDF2` veya `Argon2` tabanli model
- token auth: access + refresh token yapisi
- share protection: short-lived token + optional password
- auditability: share access logs

## 5. Editor Strategy

Tek seferde Markdown, RTF ve HTML'yi birinci sinif editor olarak desteklemek maliyetli.

Daha saglam baslangic:

1. canonical format olarak `Markdown`
2. ic temsil olarak normalize belge modeli
3. export/import katmanlari ile `HTML` ve `RTF`

Bu yaklasim veri karmasasini ciddi bicimde azaltir.

## 6. Platform Strategy

Kullanici hedeflerinde Windows var. React Native ile bunun iki gercekci yolu var:

1. `React Native` ile mobil odakli basla, sonra `React Native Windows` ekle
2. mobil icin `React Native`, masaustu icin `Electron` kullan; ortak domain paketlerini paylastir

Ilk teslim icin 1. veya 2. yol secilebilir, ama mobili oncelemek daha dusuk riskli.

## 7. Suggested First Milestone

Ilk milestone su olmali:

- auth endpointleri
- local encrypted note repository
- note list + note editor ekranlari
- secure share creation endpointi
- shared note view
