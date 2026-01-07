const express = require('express')
const { PrismaClient } = require('@prisma/client')

const router = express.Router()
const prisma = new PrismaClient()

// Topluluk engelleme listesini getir
router.get('/', async (req, res) => {
  try {
    const sites = await prisma.blockedSite.findMany({
      where: {
        OR: [
          { isVerified: true },
          { reportCount: { gte: 3 } }, // En az 3 rapor
          { upvotes: { gte: 5 } }, // Veya 5 upvote
        ],
      },
      select: {
        domain: true,
        pattern: true,
      },
      orderBy: {
        reportCount: 'desc',
      },
    })

    res.json({
      sites: sites.map(s => s.domain),
      count: sites.length,
    })
  } catch (error) {
    console.error('Blocklist getirme hatası:', error)
    res.status(500).json({ error: 'Liste alınamadı' })
  }
})

// İstatistikleri getir
router.get('/stats', async (req, res) => {
  try {
    const totalSites = await prisma.blockedSite.count()
    const verifiedSites = await prisma.blockedSite.count({
      where: { isVerified: true },
    })
    const totalReports = await prisma.report.count()

    res.json({
      totalSites,
      verifiedSites,
      totalReports,
    })
  } catch (error) {
    console.error('Stats hatası:', error)
    res.status(500).json({ error: 'İstatistikler alınamadı' })
  }
})

// Belirli bir domain'i kontrol et
router.get('/check/:domain', async (req, res) => {
  try {
    const { domain } = req.params

    const site = await prisma.blockedSite.findUnique({
      where: { domain },
      select: {
        domain: true,
        reportCount: true,
        upvotes: true,
        downvotes: true,
        isVerified: true,
      },
    })

    if (!site) {
      return res.json({ blocked: false })
    }

    const isBlocked = site.isVerified || site.reportCount >= 3 || site.upvotes >= 5

    res.json({
      blocked: isBlocked,
      ...site,
    })
  } catch (error) {
    console.error('Check hatası:', error)
    res.status(500).json({ error: 'Kontrol yapılamadı' })
  }
})

module.exports = router
