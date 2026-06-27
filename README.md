# NoteSync

NoteSync, kullanicinin notlarini yerelde sifreleyip saklayan ve secilen icerikleri guvenli sekilde paylasabilen hibrit bir not platformudur.

Bu repo, projeyi `.NET MAUI` yerine `React Native` merkezli bir mimariyle baslatmak icin hazirlandi.

## Hedef Mimari

Ana kararlar:

- Mobil istemci: `React Native + Expo + TypeScript`
- API: `Node.js + Fastify + TypeScript`
- Yerel veritabani: `SQLite`
- Merkezi veritabani: `MySQL`
- Kimlik dogrulama: `JWT`
- Not sifreleme: `AES-256-GCM`
- Ortak is kurallari ve tipler: monorepo icindeki paylasilan paketler

## Mevcut Durum

Bu repo artik sadece iskelet degil. Su akislari calisir durumda:

- local encrypted note kaydi
- native `expo-sqlite` / web local persistence
- `expo-secure-store` ile device secret
- register / login / refresh / logout
- auth rate limit
- remote secure share olusturma ve slug + password ile acma
- Markdown / HTML / RTF format degistirme
- PDF / DOCX / Markdown / HTML / RTF export
- local sync queue ve manuel account sync
- Prisma + MySQL persistence path
- test ve CI workflow

## Neden MAUI Degil?

`React Native` tarafi, mobil gelistirme hizi, ekosistem ve ekip bulunabilirligi acisindan daha guclu bir tercih. Ancak burada bir teknik not var:

- `Android` ve `iOS` icin React Native cok uygun.
- `Windows` destegi gerekiyorsa iki yol var:
  - `React Native Windows`
  - ayri bir masaustu istemcisi (`Electron` veya `Tauri`) ve ortak domain paketleri

Bu repo icin mantikli ilk asama: mobil odakli bir cekirdek kurup backend ve sifreleme altyapisini dogru oturtmak.

## Klasor Yapisi

```text
.
├── apps
│   ├── api
│   └── mobile
├── packages
│   ├── crypto-core
│   ├── shared-types
│   └── note-domain
├── project.txt
└── docs
    └── architecture.md
```

## Katmanlar

### `apps/mobile`

Mobil uygulama su sorumluluklari tasir:

- not olusturma ve duzenleme
- offline veri erisimi
- cihaz bazli sifreleme
- paylasim akislari
- disa aktarma tetikleme

Onerilen kutuphaneler:

- `expo`
- `expo-sqlite`
- `expo-secure-store`
- `@react-navigation/native`
- `zustand`
- `react-hook-form`

### `apps/api`

API su gorevleri ustlenir:

- kullanici kimlik dogrulama
- paylasilan notlar icin link uretme
- sifre korumali erisim denetimi
- metadata senkronizasyonu
- audit/log kayitlari

Onerilen kutuphaneler:

- `fastify`
- `@fastify/jwt`
- `@fastify/cors`
- `prisma` veya `drizzle`

### `packages/shared-types`

API ve mobil istemci tarafinda ortak kullanilacak:

- DTO'lar
- paylasim modelleri
- auth tipleri
- not format enum'lari

### `packages/note-domain`

Is kurallari burada toplanir:

- not donusumleri
- paylasim politikasi
- versiyonlama mantigi
- editor bagimsiz veri modeli

### `packages/crypto-core`

Sifreleme mantigi tek yerde tutulur:

- anahtar turetme
- icerik sifreleme/cozme
- payload paketleme
- versiyonlanmis sifreleme semasi

## Veri Akisi

1. Kullanici notu cihazda olusturur.
2. Not icerigi cihaz anahtari ile sifrelenir.
3. Sifreli veri `SQLite` uzerine yazilir.
4. Kullanici paylasim isterse, API'ye yalnizca gerekli icerik/metaveri gonderilir.
5. API paylasim baglantisi ve ek sifre dogrulamasi uretir.
6. Alici, URL + sifre ile paylasilan notu acar.

## Yol Haritasi

1. Monorepo ve ortak tip paketlerini kur
2. Node.js API iskeletini kur
3. React Native mobil iskeletini kur
4. Yerel sifreleme ve SQLite katmanini ekle
5. Markdown/HTML/RTF not modelini netlestir
6. Paylasim linki ve JWT akisini ekle
7. PDF/Word export stratejisini tamamla

## Kritik Teknik Kararlar

- Notlari editor ham HTML'i olarak degil, normalize edilmis bir belge modeli olarak saklamak daha saglikli olur.
- AES tarafinda `AES-256-GCM` tercih edilmeli; yalniz `AES-256` ifadesi eksik bir tanimdir.
- Sifreleme anahtari dogrudan saklanmamali; cihaz guvenli alani + turetilmis anahtar modeli kullanilmali.
- Ilk surumde tam gercek zamanli ortak duzenleme yerine guvenli paylasim odakli gitmek kapsam riskini azaltir.

## Sonraki Adim

## Calistirma

### 1. Bagimliliklar

```bash
npm install
```

### 2. Sadece API

```bash
cp apps/api/.env.example apps/api/.env
npm --workspace @notesync/api run dev
```

### 3. MySQL + API (Docker ile)

```bash
docker compose up --build
```

### 4. Expo web

```bash
EXPO_PUBLIC_API_BASE_URL=http://localhost:4000 npm run dev:web
```

### 5. Testler

```bash
npm test
```

### 6. Build

```bash
npm run build
```

Detayli deployment notlari icin: `docs/deployment.md`
