# SlopSearch

> Google/Bing arama sonuçlarından AI slop içerikleri temizleyen tarayıcı eklentisi

**DeadNetGuard** projesinin 2. adımı. SEO için yapay zekaya yazdırılmış anlamsız makale sitelerini (özellikle yemek tarifleri, basit nasıl yapılır rehberleri) otomatik olarak arama sonuçlarından siler.

## Özellikler

- **Otomatik Filtreleme**: AI tarafından üretilen düşük kaliteli içerikleri tespit eder
- **Tek Tıkla Engelleme**: Arama sonuçlarında istemediğin siteleri anında engelle
- **Topluluk Blocklist**: Diğer kullanıcıların raporladığı siteler otomatik engellenir
- **Kişisel Blocklist**: Kendi engelleme listen tamamen sana ait
- **Google & Bing Desteği**: Her iki arama motorunda da çalışır
- **Gizlilik Odaklı**: Kişisel veri toplamaz

## Proje Yapısı

```
slop-search/
├── extension/          # Chrome eklentisi (React + TypeScript + Vite)
├── backend/            # API sunucusu (Node.js + Express + Prisma)
├── website/            # Landing sayfası
└── assets/             # Logo ve görseller
```

## Tech Stack

### Extension
- React 18
- TypeScript
- Vite + CRXJS
- Zustand (state management)

### Backend
- Node.js
- Express
- PostgreSQL
- Prisma ORM

### Website
- HTML5 / CSS3 / JavaScript
- Retro Y2K tasarım (DeadNetGuard ile uyumlu)

## Kurulum

### Extension (Development)
```bash
cd extension
npm install
npm run dev
```

### Backend
```bash
cd backend
npm install
cp .env.example .env
npx prisma migrate dev
npm run dev
```

## API Endpoints

| Method | Endpoint | Açıklama |
|--------|----------|----------|
| GET | `/api/blocklist` | Topluluk engelleme listesi |
| POST | `/api/report` | Site raporlama |
| POST | `/api/vote` | Raporlanan sitelere oy verme |

## İlgili Projeler

- [DeadNetGuard](https://github.com/Hikan-Teki/deadnetguard) - YouTube AI slop filtreleme

## Lisans

MIT License - detaylar için [LICENSE](LICENSE) dosyasına bakın.
