const express = require('express')
const { prisma } = require('../index')

const router = express.Router()

// Threshold for community auto-ban
const BAN_THRESHOLD_REPORTS = 5
const BAN_THRESHOLD_SCORE = 3

// GET /api/blocklist - Get all banned sites (for extension)
router.get('/', async (_req, res) => {
  try {
    const sites = await prisma.blockedSite.findMany({
      where: { isBanned: true },
      select: {
        domain: true
      }
    })

    res.json({
      version: Date.now(),
      count: sites.length,
      sites: sites.map(s => s.domain)
    })
  } catch (error) {
    console.error('Error fetching blocklist:', error)
    res.status(500).json({ error: 'Failed to fetch blocklist' })
  }
})

// GET /api/blocklist/version - Check if blocklist updated
router.get('/version', async (_req, res) => {
  try {
    const latest = await prisma.blockedSite.findFirst({
      where: { isBanned: true },
      orderBy: { updatedAt: 'desc' },
      select: { updatedAt: true }
    })

    res.json({
      version: latest?.updatedAt?.getTime() || 0
    })
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch version' })
  }
})

// GET /api/blocklist/pending - Get sites pending review
router.get('/pending', async (_req, res) => {
  try {
    const sites = await prisma.blockedSite.findMany({
      where: {
        isBanned: false,
        reportCount: { gte: 1 }
      },
      orderBy: [
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
        reports: site._count.reports,
        votes: site._count.votes,
        createdAt: site.createdAt
      }))
    })
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch pending sites' })
  }
})

// GET /api/blocklist/check/:domain - Check if domain is blocked
router.get('/check/:domain', async (req, res) => {
  try {
    const { domain } = req.params

    const site = await prisma.blockedSite.findUnique({
      where: { domain },
      select: {
        domain: true,
        reportCount: true,
        score: true,
        isBanned: true,
      },
    })

    if (!site) {
      return res.json({ blocked: false })
    }

    res.json({
      blocked: site.isBanned,
      ...site,
    })
  } catch (error) {
    res.status(500).json({ error: 'Check failed' })
  }
})

// Check if site should be auto-banned
async function checkAutoBan(siteId) {
  const site = await prisma.blockedSite.findUnique({
    where: { id: siteId }
  })

  if (!site) return

  if (site.reportCount >= BAN_THRESHOLD_REPORTS && site.score >= BAN_THRESHOLD_SCORE) {
    await prisma.blockedSite.update({
      where: { id: siteId },
      data: { isBanned: true }
    })
    console.log(`Site ${site.domain} auto-banned (reports: ${site.reportCount}, score: ${site.score})`)
  }
}

module.exports = router
module.exports.checkAutoBan = checkAutoBan
