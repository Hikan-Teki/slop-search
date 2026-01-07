const express = require('express')
const { prisma } = require('../prisma')
const { checkAutoBan } = require('./blocklist')

const router = express.Router()

// Domain validation regex - allows subdomains, TLDs, no protocol/path
const DOMAIN_REGEX = /^(?!-)[a-zA-Z0-9-]{1,63}(?<!-)(\.[a-zA-Z0-9-]{1,63})*\.[a-zA-Z]{2,}$/

// Validate and clean domain
function validateDomain(domain) {
  if (!domain || typeof domain !== 'string') return null

  // Remove protocol if present
  let clean = domain.replace(/^https?:\/\//, '')
  // Remove path, query, fragment
  clean = clean.split('/')[0].split('?')[0].split('#')[0]
  // Remove www prefix and lowercase
  clean = clean.toLowerCase().replace(/^www\./, '').trim()

  // Check length and format
  if (clean.length > 253 || !DOMAIN_REGEX.test(clean)) return null

  return clean
}

// POST /api/report - Report a site
router.post('/', async (req, res) => {
  try {
    const { domain, reason, url } = req.body
    const fingerprint = req.headers['x-fingerprint'] || req.ip

    // Validate domain
    const cleanDomain = validateDomain(domain)
    if (!cleanDomain) {
      return res.status(400).json({ error: 'Invalid domain format' })
    }

    // Validate reason length
    if (reason && (typeof reason !== 'string' || reason.length > 500)) {
      return res.status(400).json({ error: 'Reason too long (max 500 chars)' })
    }

    // Validate URL length
    if (url && (typeof url !== 'string' || url.length > 2000)) {
      return res.status(400).json({ error: 'URL too long (max 2000 chars)' })
    }

    // Find or create site
    const existingSite = await prisma.blockedSite.findUnique({
      where: { domain: cleanDomain },
    })

    if (existingSite) {
      // Check if already reported by this user
      const existingReport = await prisma.report.findFirst({
        where: {
          siteId: existingSite.id,
          fingerprint,
        },
      })

      if (existingReport) {
        return res.status(409).json({ error: 'You already reported this site' })
      }

      // Add new report
      await prisma.report.create({
        data: {
          siteId: existingSite.id,
          fingerprint,
          reason,
          url,
        },
      })

      // Increment report count
      const updated = await prisma.blockedSite.update({
        where: { id: existingSite.id },
        data: { reportCount: { increment: 1 } },
      })

      // Check for auto-ban
      await checkAutoBan(existingSite.id)

      return res.json({
        success: true,
        message: 'Report added',
        reportCount: updated.reportCount,
      })
    }

    // Create new site
    const newSite = await prisma.blockedSite.create({
      data: {
        domain: cleanDomain,
        reason,
        reports: {
          create: {
            fingerprint,
            reason,
            url,
          },
        },
      },
    })

    res.status(201).json({
      success: true,
      message: 'Site reported',
      id: newSite.id,
    })
  } catch (error) {
    console.error('Report error:', error)
    res.status(500).json({ error: 'Report failed' })
  }
})

// GET /api/report/my - Get user's reports
router.get('/my', async (req, res) => {
  try {
    const fingerprint = req.headers['x-fingerprint'] || req.ip

    const reports = await prisma.report.findMany({
      where: { fingerprint },
      include: {
        site: {
          select: {
            domain: true,
            reportCount: true,
            isBanned: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    res.json({ reports })
  } catch (error) {
    console.error('My reports error:', error)
    res.status(500).json({ error: 'Failed to fetch reports' })
  }
})

// DELETE /api/report/:id - Delete own report
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params
    const fingerprint = req.headers['x-fingerprint'] || req.ip

    const report = await prisma.report.findFirst({
      where: { id, fingerprint },
    })

    if (!report) {
      return res.status(404).json({ error: 'Report not found' })
    }

    await prisma.report.delete({ where: { id } })

    // Decrement report count
    await prisma.blockedSite.update({
      where: { id: report.siteId },
      data: { reportCount: { decrement: 1 } },
    })

    res.json({ success: true })
  } catch (error) {
    console.error('Delete report error:', error)
    res.status(500).json({ error: 'Delete failed' })
  }
})

module.exports = router
