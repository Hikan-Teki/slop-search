require('dotenv').config()

const express = require('express')
const cors = require('cors')
const helmet = require('helmet')
const rateLimit = require('express-rate-limit')
const { prisma } = require('./prisma')

const blocklistRoutes = require('./routes/blocklist')
const reportRoutes = require('./routes/report')
const voteRoutes = require('./routes/vote')
const adminRoutes = require('./routes/admin')
const statsRoutes = require('./routes/stats')

const app = express()
const PORT = process.env.PORT || 3002

// Trust proxy for rate limiting behind nginx
app.set('trust proxy', 1)

// Rate limiters
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  message: { error: 'Too many requests, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
  validate: false
})

const strictLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30,
  message: { error: 'Too many requests, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
  validate: false
})

const loginLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5,
  message: { error: 'Too many login attempts, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
  validate: false
})

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false,
}))

// CORS configuration
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, etc.)
    if (!origin) return callback(null, true)

    // Allow chrome extensions
    if (origin.startsWith('chrome-extension://')) {
      return callback(null, true)
    }

    // Allow specific domains
    const allowedOrigins = [
      'https://slopsearch.deadnetguard.com',
      'https://www.slopsearch.deadnetguard.com',
      'https://api.slopsearch.deadnetguard.com',
      'https://deadnetguard.com',
    ]

    // Allow localhost in development
    if (process.env.NODE_ENV !== 'production') {
      allowedOrigins.push('http://localhost:5173', 'http://localhost:3000', 'http://localhost:3002')
    }

    if (allowedOrigins.includes(origin)) {
      return callback(null, true)
    }

    callback(null, true) // Allow all for now
  },
  credentials: true
}))

// Body parser with size limit
app.use(express.json({ limit: '10kb' }))
app.use(express.urlencoded({ extended: true, limit: '10kb' }))

// Apply general rate limit
app.use(generalLimiter)

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// API Routes
app.use('/api/blocklist', blocklistRoutes)
app.use('/api/report', strictLimiter, reportRoutes)
app.use('/api/vote', strictLimiter, voteRoutes)
app.use('/api/admin/login', loginLimiter)
app.use('/api/admin', adminRoutes)
app.use('/api/stats', statsRoutes)

// Root
app.get('/', (_req, res) => {
  res.json({
    name: 'SlopSearch API',
    version: '1.0.0',
    endpoints: {
      blocklist: '/api/blocklist',
      report: '/api/report',
      vote: '/api/vote',
      stats: '/api/stats'
    }
  })
})

// 404 handler
app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' })
})

// Error handler
app.use((err, _req, res, _next) => {
  if (process.env.NODE_ENV !== 'production') {
    console.error('Error:', err.message)
  }

  if (err.message === 'Not allowed by CORS') {
    return res.status(403).json({ error: 'Forbidden' })
  }

  res.status(500).json({ error: 'Internal server error' })
})

// Start server
async function main() {
  try {
    await prisma.$connect()
    console.log('Database connected')

    app.listen(PORT, () => {
      console.log(`SlopSearch API running on port ${PORT}`)
      if (process.env.NODE_ENV === 'production') {
        console.log('Running in production mode')
      }
    })
  } catch (error) {
    console.error('Failed to start server:', error)
    process.exit(1)
  }
}

main()

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully')
  await prisma.$disconnect()
  process.exit(0)
})

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully')
  await prisma.$disconnect()
  process.exit(0)
})
