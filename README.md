# NoteSync

NoteSync, notlari cihazda sifreleyerek saklayan, istenirse hesap ile senkronize eden ve secili notlari guvenli linklerle paylasabilen local-first bir not platformudur.


## Proje Ozeti

Hedef problem:

- tam bulut tabanli not uygulamalarinda veri gizliligi riski
- sadece offline calisan uygulamalarda paylasim ve es zamanlama eksikligi

NoteSync bu problemi hibrit veri modeli ile cozer:

- not icerigi once cihazda sifrelenir ve yerelde saklanir
- kullanici isterse hesaba bagli senkronizasyon kullanir
- secili notlar guvenli API uzerinden link ile paylasilabilir

Hedef kullanicilar:

- ogrenciler
- akademik veya profesyonel calisma yurutup not tutanlar
- veri gizliligine onem veren bireyler

## Mevcut Teknoloji Yigini

Projede su anda kullanilan teknoloji:

- mobil istemci: `React Native`, `Expo SDK 53`, `TypeScript`
- web onizleme: `react-native-web`
- yerel veri: native tarafta `expo-sqlite`, web tarafinda browser local persistence
- cihaz sirri: `expo-secure-store`
- API: `Node.js`, `Fastify`, `TypeScript`
- kimlik dogrulama: `JWT` tabanli access + refresh token akisi
- merkezi veritabani: `MySQL` + `Prisma`
- sifreleme: `AES-256-GCM`
- belge export: `pdf-lib`, `docx`
- paylasim/kopyalama: `expo-sharing`, `expo-clipboard`
- ortak paketler:
  - `packages/shared-types`
  - `packages/note-domain`
  - `packages/crypto-core`

Not:

- Proje `React Native / Expo` tabanlidir.
- `project.txt` icinde gecen mobil odak korunmustur.
- Windows masaustu istemcisi bu repoda yoktur; ikinci asama hedefi olarak dusunulmelidir.

## Repo Yapisi

```text
.
├── apps
│   ├── api
│   └── mobile
├── packages
│   ├── crypto-core
│   ├── note-domain
│   └── shared-types
├── docs
│   ├── architecture.md
│   ├── deployment.md
│   └── implementation-plan.md
└── project.txt
```

## Project.txt ile Uyumlu Mevcut Durum

Su anda calisan ana ozellikler:

- [x] Markdown, HTML ve RTF formatinda not olusturma ve duzenleme
- [x] not icerigini cihazda `AES-256-GCM` ile sifreleyip saklama
- [x] native SQLite / web local persistence
- [x] register / login / refresh / logout akisi
- [x] hesap bagli manuel not senkronizasyonu
- [x] uzaktan paylasim icin slug tabanli link uretimi
- [x] opsiyonel sifre korumali paylasim
- [x] paylasim gecmisi, link kopyalama ve sistem paylasim diyalogu
- [x] PDF / DOCX / Markdown / HTML / RTF export
- [x] not silme
- [x] mobil odakli arayuz, not gridi ve animasyonlu yan menu
- [x] Expo web uzerinden Android SDK olmadan onizleme

Henuz bu repoda olmayan veya sonraki asamaya kalan kisimlar:

- [ ] masaustu istemcisi
- [ ] gelismis catisma cozum arayuzu
- [ ] gercek zamanli ortak duzenleme
- [ ] ileri seviye paylasim politikalarinin UI tarafinda genisletilmesi

## Guvenlik Modeli

`project.txt` icindeki guvenlik hedeflerine uygun mevcut model:

- not icerigi once cihazda sifrelenir
- paylasilmayan veri kullanicinin cihazinda kalir
- hesap senkronizasyonunda sunucuya duz metin degil sifreli icerik gider
- paylasilan notlar slug ile erisilir, UI uzerinden opsiyonel sifre korumasi eklenebilir
- API tarafinda JWT tabanli oturum yonetimi vardir
- cihaz anahtari native ortamda `expo-secure-store` ile tutulur

## Tasarim ve UX Notlari

Mevcut mobil uygulama:

- koyu gri tonlarda bir shell
- kagit renginde not kartlari
- mobil onceleyen ana not gridi
- animasyonlu side drawer
- editor icinden hizli paylasim ve silme
- `Shared` ekranindan not secip paylasma ve gecmis linkleri kopyalama

Bu, `project.txt` icindeki dark mode, minimalist ve fonksiyon odakli tasarim niyetine yakindir; ancak bugunku uygulama klasik mavi/lacivert yerine koyu gri + kagit tonlariyla ilerlemektedir.

## Gelistirme Ortami

Gerekenler:

- Node.js
- npm
- Docker (kolay MySQL + API ayagi icin, opsiyonel)

Native build icin ayrica:

- Android Studio / Android SDK veya
- Xcode / iOS toolchain

Sadece web onizleme icin bunlar zorunlu degildir.

## Kurulum

### 1. Bagimliliklar

```bash
npm install
```

### 2. En hizli baslangic: Docker ile API + MySQL

Bu akista MySQL, Prisma migration ve demo seed birlikte ayaga kalkar:

```bash
docker compose up --build
```

API varsayilan olarak:

- `http://localhost:4000`

### 3. API'yi Docker olmadan calistirma

Ornek ortam dosyasini olustur:

```bash
cp apps/api/.env.example apps/api/.env
```

Iki secenek var:

1. Hafiza tabanli gelistirme:

- `STORE_PROVIDER=memory`
- sonra:

```bash
npm --workspace @notesync/api run dev
```

2. MySQL + Prisma:

- `STORE_PROVIDER=prisma`
- `DATABASE_URL` degerini ayarla
- sonra:

```bash
npm --workspace @notesync/api run prisma:deploy
npm --workspace @notesync/api run seed
npm --workspace @notesync/api run dev
```

### 4. Mobil uygulamayi webde acma

Android SDK olmadan web onizleme icin:

```bash
EXPO_PUBLIC_API_BASE_URL=http://localhost:4000 npm run dev:web
```

### 5. Expo gelistirme sunucusu

Mobil preview icin:

```bash
npm run dev:mobile
```

### 6. Testler

```bash
npm test
```

Bu komut sunlari calistirir:

- domain testleri
- API testleri
- mobile local persistence testleri

### 7. Build

Monorepo build:

```bash
npm run build
```

Not:

- root `build` komutu ortak paketleri ve API'yi derler
- mobile workspace icindeki `build` script'i native release bundle uretmez
- native release icin `EAS Build` veya `expo prebuild` gerekir

### 8. Web export

Statik web paketi almak icin:

```bash
cd apps/mobile
npx expo export --platform web --output-dir .expo/web-export
```

## Demo Hesap

Seed calistirildiginda varsayilan demo hesap:

- email: `demo@notesync.local`
- password: `DemoPass123!`

## Gelistirme Scriptleri

Root seviyesinde sik kullanilan komutlar:

```bash
npm run dev:api
npm run dev:mobile
npm run dev:web
npm test
npm run build
```

## Dokumantasyon

- mimari: [docs/architecture.md](docs/architecture.md)
- deployment: [docs/deployment.md](docs/deployment.md)
- uygulama plani: [docs/implementation-plan.md](docs/implementation-plan.md)
- kaynak on rapor: [project.txt](project.txt)

## Yol Haritasi

`project.txt` dogrultusunda sonraki mantikli adimlar:

1. sync conflict ekranlarini gelistirmek
2. paylasim politikalarini zenginlestirmek
3. masaustu istemcisi stratejisini netlestirmek
4. daha guclu audit/log ve operasyonel izleme eklemek
