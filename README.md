# NoteSync

NoteSync, notlari cihazda sifreleyerek saklayan, istenirse hesap ile senkronize eden ve secili notlari guvenli baglantilarla paylasabilen local-first bir not platformudur.

## Proje Bilgileri

| Alan | Bilgi |
| --- | --- |
| Proje adi | NoteSync |
| Ogrenci adi | Asım Baki |
| Ogrenci soyadi | Demir |
| Ogrenci numarasi | 24010501040 |
| GitHub repo baglantisi | https://github.com/asim-bk/notesync.git |

## Projenin Amaci ve Kisa Aciklamasi

Bu projenin amaci, kullanicilarin notlarini cihaz bazli sifreleme ile guvenli sekilde saklayabilmesini, isterlerse hesaplariyla senkronize edebilmesini ve secili notlari kontrollu bicimde paylasabilmesini saglamaktir.

Cozulen temel problem:

- tam bulut tabanli not uygulamalarinda veri gizliligi riski bulunmasi
- sadece offline calisan uygulamalarda senkronizasyon ve paylasim imkaninin zayif kalmasi

NoteSync bu problemi hibrit veri modeli ile cozer:

- not icerigi once cihazda sifrelenir
- veri yerelde saklanir
- kullanici isterse API uzerinden hesap bagli senkronizasyon kullanir
- secili notlar paylasim baglantisi ile dis dunyaya acilabilir

## Hedef Kitle

- ogrenciler
- akademik veya profesyonel not tutan kullanicilar
- veri gizliligine onem veren bireyler
- ortak calisma yaparken secili icerikleri paylasmak isteyen ekipler

## Kullanilan Teknolojiler / Kutuphaneler

| Katman | Teknoloji / Kutuphane |
| --- | --- |
| Mobil istemci | React Native, Expo SDK 53, TypeScript |
| Web onizleme | react-native-web, React 19 |
| Yerel veri saklama | expo-sqlite |
| Guvenli cihaz depolamasi | expo-secure-store |
| API | Node.js, Fastify, TypeScript |
| Kimlik dogrulama | JWT tabanli access + refresh token yapisi |
| Veritabani | MySQL, Prisma |
| Sifreleme | AES-256-GCM |
| Dosya export | pdf-lib, docx |
| Paylasim araclari | expo-sharing, expo-clipboard |
| Monorepo ortak paketleri | packages/shared-types, packages/note-domain, packages/crypto-core |
| Yardimci araclar | Docker, EAS Build |

## Proje Mimarisi

Proje monorepo yapisinda organize edilmistir ve uc ana katmandan olusur:

1. `apps/mobile`
   React Native + Expo tabanli istemci uygulamasidir. Not olusturma, duzenleme, sifreleme, export ve paylasim islemleri bu katmanda baslar.
2. `apps/api`
   Fastify tabanli API katmanidir. Kullanici girisi, token yonetimi, paylasim endpointleri ve opsiyonel senkronizasyon islemlerini yonetir.
3. `packages/*`
   Ortak tipler, domain kurallari ve sifreleme yardimcilari burada tutulur.

Veri akisi ozetle su sekildedir:

`Kullanici -> Mobile/Web istemci -> Yerel sifreleme -> Yerel depolama -> Opsiyonel API senkronizasyonu -> MySQL`

### Mimari Bilesenler

- `apps/mobile`: istemci arayuzu, yerel veri saklama, export ve paylasim akislari
- `apps/api`: auth, sync, share ve veri erisim endpointleri
- `packages/shared-types`: ortak tipler ve API sozlesmeleri
- `packages/note-domain`: not kurallari ve domain mantigi
- `packages/crypto-core`: sifreleme / cozumleme yardimcilari

### Repo Yapisi

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

## Projenin Mevcut Durumu

Su anda calisan ana ozellikler:

- [x] not olusturma ve duzenleme
- [x] not icerigini cihazda sifreleyip saklama
- [x] native tarafta SQLite, web tarafinda local persistence kullanimi
- [x] register / login / refresh / logout akisi
- [x] hesap bagli manuel not senkronizasyonu
- [x] slug tabanli paylasim baglantisi olusturma
- [x] opsiyonel sifre korumali paylasim
- [x] PDF / DOCX / Markdown / HTML / RTF export
- [x] mobil odakli arayuz ve web onizleme

Sonraki asamaya kalan veya bu repoda olmayan kisimlar:

- [ ] Windows masaustu istemcisi
- [ ] gelismis catisma cozum arayuzu
- [ ] gercek zamanli ortak duzenleme
- [ ] daha gelismis paylasim politikasi ekrani

## Guvenlik Modeli

- not icerigi once cihazda sifrelenir
- paylasilmayan veri kullanicinin cihazinda kalir
- senkronizasyon sirasinda sunucuya sifreli icerik gonderilir
- paylasilan notlar baglanti ile acilir, opsiyonel sifre korumasi eklenebilir
- API tarafinda JWT tabanli oturum yonetimi kullanilir
- cihaz sirlari native ortamda `expo-secure-store` ile tutulur

## Kurulum Adimlari

### Gereksinimler

- Node.js
- npm
- Docker (opsiyonel ama hizli kurulum icin onerilir)

Native build icin ek olarak:

- Android Studio / Android SDK veya
- Xcode / iOS toolchain

### 1. Bagimliliklari kurma

```bash
npm install
```

### 2. Docker ile hizli kurulum

MySQL, Prisma migration ve demo seed birlikte ayaga kalkar:

```bash
docker compose up --build
```

API varsayilan olarak su adreste calisir:

- `http://localhost:4000`

### 3. API'yi Docker olmadan kurma

Ornek ortam dosyasini olustur:

```bash
cp apps/api/.env.example apps/api/.env
```

Iki farkli secenek vardir:

1. Hafiza tabanli gelistirme:

```bash
npm --workspace @notesync/api run dev
```

`apps/api/.env` dosyasinda:

```env
STORE_PROVIDER=memory
```

2. MySQL + Prisma:

```bash
npm --workspace @notesync/api run prisma:deploy
npm --workspace @notesync/api run seed
npm --workspace @notesync/api run dev
```

Bu senaryoda `apps/api/.env` icinde `STORE_PROVIDER=prisma` ve gecerli bir `DATABASE_URL` tanimli olmalidir.

## Calistirma / Kullanim Talimatlari

### Web onizleme

Android SDK olmadan web uzerinden calistirmak icin:

```bash
EXPO_PUBLIC_API_BASE_URL=http://localhost:4000 npm run dev:web
```

### Mobil preview

Expo gelistirme sunucusunu baslatmak icin:

```bash
npm run dev:mobile
```

### Testler

```bash
npm test
```

Bu komut su testleri calistirir:

- domain testleri
- API testleri
- mobile local persistence testleri

### Build

Monorepo build icin:

```bash
npm run build
```

Native release icin `EAS Build` veya `expo prebuild` kullanilmalidir.

### Ornek Kullanim Akisi

1. API'yi ayaga kaldir.
2. Mobil uygulamayi veya web onizlemeyi baslat.
3. Kullanici kaydi olustur veya mevcut hesapla giris yap.
4. Yeni not ekle, not icerigini kaydet ve yerel sifreleme ile sakla.
5. Istenirse notu senkronize et veya paylasim baglantisi olustur.
6. Istenirse notu PDF, DOCX, Markdown, HTML veya RTF olarak disa aktar.

### Demo Hesap

Seed verisi calistirildiginda varsayilan demo hesap:

- email: `demo@notesync.local`
- password: `DemoPass123!`

## Varsa Ekran Goruntuleri

- Ana ekran:
- Not editoru:
- Paylasim ekrani:
- Export ekrani:

## Gelistirici Notlari

- Proje local-first yaklasimla tasarlanmistir.
- Mobil istemci `Expo` uzerinden hem cihazda hem web onizlemede test edilebilir.
- Windows masaustu istemcisi bu repoda bulunmamaktadir; sonraki asama hedefidir.
- Ek mimari ve deployment notlari `docs/` klasoru altinda tutulmaktadir.
- Odev tesliminde istenirse bu dokuman ayri olarak `ogrencino.md` adiyla kopyalanabilir.

## Kaynakca veya Yararlanilan Baglantilar

- GitHub repo: https://github.com/asim-bk/notesync.git
- On rapor: [project.txt](project.txt)
- Mimari dokumani: [docs/architecture.md](docs/architecture.md)
- Deployment notlari: [docs/deployment.md](docs/deployment.md)
- Uygulama plani: [docs/implementation-plan.md](docs/implementation-plan.md)
- Expo dokumantasyonu: https://docs.expo.dev/
- React Native dokumantasyonu: https://reactnative.dev/
- Fastify dokumantasyonu: https://fastify.dev/
- Prisma dokumantasyonu: https://www.prisma.io/docs
