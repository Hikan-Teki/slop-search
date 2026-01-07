const express = require('express')
const bcrypt = require('bcrypt')
const crypto = require('crypto')
const { prisma } = require('../index')

const router = express.Router()

const BCRYPT_ROUNDS = 12

// Hash password
async function hashPassword(password) {
  return bcrypt.hash(password, BCRYPT_ROUNDS)
}

// Verify password
async function verifyPassword(password, hash) {
  return bcrypt.compare(password, hash)
}

// Admin auth middleware
async function requireAdmin(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '')

  if (!token) {
    return res.status(401).json({ error: 'No token provided' })
  }

  try {
    const session = await prisma.adminSession.findUnique({
      where: { token }
    })

    if (!session || session.expiresAt < new Date()) {
      if (session) {
        await prisma.adminSession.delete({ where: { id: session.id } })
      }
      return res.status(401).json({ error: 'Invalid or expired token' })
    }

    req.adminUsername = session.username
    next()
  } catch (error) {
    return res.status(401).json({ error: 'Session verification failed' })
  }
}

// POST /api/admin/login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' })
    }

    const admin = await prisma.admin.findUnique({
      where: { username }
    })

    if (!admin) {
      return res.status(401).json({ error: 'Invalid credentials' })
    }

    const isValid = await verifyPassword(password, admin.password)
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid credentials' })
    }

    const token = crypto.randomBytes(32).toString('hex')
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours

    await prisma.adminSession.create({
      data: { token, username, expiresAt }
    })

    // Clean up expired sessions
    await prisma.adminSession.deleteMany({
      where: { expiresAt: { lt: new Date() } }
    })

    res.json({ token, expiresAt })
  } catch (error) {
    console.error('Login error:', error)
    res.status(500).json({ error: 'Login failed' })
  }
})

// POST /api/admin/logout
router.post('/logout', async (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '')
  if (token) {
    try {
      await prisma.adminSession.delete({ where: { token } })
    } catch {
      // Ignore
    }
  }
  res.json({ success: true })
})

// GET /api/admin/verify
router.get('/verify', requireAdmin, (_req, res) => {
  res.json({ valid: true })
})

// POST /api/admin/setup - Create initial admin (only if no admins exist)
router.post('/setup', async (req, res) => {
  try {
    const { username, password } = req.body

    if (!username || !password || username.length < 3 || password.length < 8) {
      return res.status(400).json({ error: 'Username (min 3 chars) and password (min 8 chars) required' })
    }

    const adminCount = await prisma.admin.count()
    if (adminCount > 0) {
      return res.status(400).json({ error: 'Admin already exists' })
    }

    const hashedPassword = await hashPassword(password)
    await prisma.admin.create({
      data: { username, password: hashedPassword }
    })

    res.json({ success: true, message: 'Admin created' })
  } catch (error) {
    console.error('Setup error:', error)
    res.status(500).json({ error: 'Setup failed' })
  }
})

// GET /api/admin/sites - Get all sites (for admin panel)
router.get('/sites', requireAdmin, async (req, res) => {
  try {
    const { filter } = req.query

    const where = filter === 'banned' ? { isBanned: true } :
                  filter === 'pending' ? { isBanned: false, reportCount: { gte: 1 } } :
                  {}

    const sites = await prisma.blockedSite.findMany({
      where,
      orderBy: [
        { isBanned: 'desc' },
        { score: 'desc' },
        { reportCount: 'desc' }
      ],
      include: {
        _count: {
          select: { reports: true, votes: true }
        }
      }
    })

    res.json({
      count: sites.length,
      sites: sites.map(site => ({
        id: site.id,
        domain: site.domain,
        reason: site.reason,
        reportCount: site.reportCount,
        score: site.score,
        isBanned: site.isBanned,
        reports: site._count.reports,
        votes: site._count.votes,
        createdAt: site.createdAt,
        updatedAt: site.updatedAt
      }))
    })
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch sites' })
  }
})

// POST /api/admin/ban/:siteId
router.post('/ban/:siteId', requireAdmin, async (req, res) => {
  try {
    const site = await prisma.blockedSite.update({
      where: { id: req.params.siteId },
      data: { isBanned: true }
    })

    res.json({
      success: true,
      site: {
        id: site.id,
        domain: site.domain,
        isBanned: site.isBanned
      }
    })
  } catch (error) {
    res.status(500).json({ error: 'Failed to ban site' })
  }
})

// POST /api/admin/unban/:siteId
router.post('/unban/:siteId', requireAdmin, async (req, res) => {
  try {
    const site = await prisma.blockedSite.update({
      where: { id: req.params.siteId },
      data: { isBanned: false }
    })

    res.json({
      success: true,
      site: {
        id: site.id,
        domain: site.domain,
        isBanned: site.isBanned
      }
    })
  } catch (error) {
    res.status(500).json({ error: 'Failed to unban site' })
  }
})

// DELETE /api/admin/site/:siteId
router.delete('/site/:siteId', requireAdmin, async (req, res) => {
  try {
    await prisma.blockedSite.delete({
      where: { id: req.params.siteId }
    })

    res.json({ success: true })
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete site' })
  }
})

// GET /api/admin/reports/:siteId
router.get('/reports/:siteId', requireAdmin, async (req, res) => {
  try {
    const reports = await prisma.report.findMany({
      where: { siteId: req.params.siteId },
      orderBy: { createdAt: 'desc' }
    })

    res.json({ reports })
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch reports' })
  }
})

// POST /api/admin/change-password
router.post('/change-password', requireAdmin, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body

    if (!currentPassword || !newPassword || newPassword.length < 8) {
      return res.status(400).json({ error: 'Valid passwords required' })
    }

    const admin = await prisma.admin.findUnique({ where: { username: req.adminUsername } })
    if (!admin) {
      return res.status(404).json({ error: 'Admin not found' })
    }

    const isValid = await verifyPassword(currentPassword, admin.password)
    if (!isValid) {
      return res.status(401).json({ error: 'Current password is incorrect' })
    }

    const hashedPassword = await hashPassword(newPassword)
    await prisma.admin.update({
      where: { username: req.adminUsername },
      data: { password: hashedPassword }
    })

    // Invalidate all sessions
    await prisma.adminSession.deleteMany({ where: { username: req.adminUsername } })

    res.json({ success: true, message: 'Password changed. Please login again.' })
  } catch (error) {
    res.status(500).json({ error: 'Failed to change password' })
  }
})

module.exports = router
