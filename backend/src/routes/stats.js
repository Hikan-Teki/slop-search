const express = require('express')
const { prisma } = require('../index')

const router = express.Router()

// GET /api/stats - Public stats
router.get('/', async (_req, res) => {
  try {
    const [totalSites, bannedSites, totalReports, totalVotes] = await Promise.all([
      prisma.blockedSite.count(),
      prisma.blockedSite.count({ where: { isBanned: true } }),
      prisma.report.count(),
      prisma.vote.count()
    ])

    res.json({
      totalSites,
      bannedSites,
      totalReports,
      totalVotes,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch stats' })
  }
})

module.exports = router
