require('dotenv').config()

const express = require('express')
const cors = require('cors')
const helmet = require('helmet')
const rateLimit = require('express-rate-limit')

const blocklistRoutes = require('./routes/blocklist')
const reportRoutes = require('./routes/report')
const voteRoutes = require('./routes/vote')

const app = express()
const PORT = process.env.PORT || 3001

// Security middleware
app.use(helmet())

// CORS configuration
const corsOrigins = (process.env.CORS_ORIGIN || '').split(',').map(s => s.trim())
app.use(cors({
  origin: (origin, callback) => {
    // Chrome extension veya tanımlı originler
    if (!origin || corsOrigins.some(o => {
      if (o.includes('*')) {
        const pattern = o.replace(/\*/g, '.*')
        return new RegExp(pattern).test(origin)
      }
      return o === origin
    })) {
      callback(null, true)
    } else {
      callback(null, true) // Development için açık bırak
    }
  },
  credentials: true,
}))

// Body parser
app.use(express.json())

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 dakika
  max: 100, // IP başına limit
  message: { error: 'Çok fazla istek, lütfen bekleyin.' },
})
app.use('/api/', limiter)

// Stricter rate limit for report/vote
const strictLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 saat
  max: 20,
  message: { error: 'Raporlama limiti aşıldı.' },
})

// Routes
app.use('/api/blocklist', blocklistRoutes)
app.use('/api/report', strictLimiter, reportRoutes)
app.use('/api/vote', strictLimiter, voteRoutes)

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'slopsearch-api' })
})

// Root
app.get('/', (req, res) => {
  res.json({
    name: 'SlopSearch API',
    version: '1.0.0',
    docs: '/api',
  })
})

// 404
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint bulunamadı' })
})

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack)
  res.status(500).json({ error: 'Sunucu hatası' })
})

app.listen(PORT, () => {
  console.log(`SlopSearch API çalışıyor: http://localhost:${PORT}`)
})
