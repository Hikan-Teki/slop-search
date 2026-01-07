const express = require('express')
const { PrismaClient } = require('@prisma/client')

const router = express.Router()
const prisma = new PrismaClient()

// Yeni site raporla
router.post('/', async (req, res) => {
  try {
    const { domain, reason, url } = req.body
    const fingerprint = req.headers['x-fingerprint'] || req.ip

    if (!domain) {
      return res.status(400).json({ error: 'Domain gerekli' })
    }

    // Domain'i temizle
    const cleanDomain = domain.toLowerCase().replace(/^www\./, '').trim()

    // Var olan siteyi bul veya oluştur
    const existingSite = await prisma.blockedSite.findUnique({
      where: { domain: cleanDomain },
    })

    if (existingSite) {
      // Bu kullanıcı daha önce raporlamış mı?
      const existingReport = await prisma.report.findFirst({
        where: {
          siteId: existingSite.id,
          fingerprint,
        },
      })

      if (existingReport) {
        return res.status(409).json({ error: 'Bu siteyi zaten raporladınız' })
      }

      // Yeni rapor ekle
      await prisma.report.create({
        data: {
          siteId: existingSite.id,
          fingerprint,
          reason,
          url,
        },
      })

      // Report count'u artır
      await prisma.blockedSite.update({
        where: { id: existingSite.id },
        data: { reportCount: { increment: 1 } },
      })

      return res.json({
        success: true,
        message: 'Rapor eklendi',
        reportCount: existingSite.reportCount + 1,
      })
    }

    // Yeni site oluştur
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
      message: 'Site raporlandı',
      id: newSite.id,
    })
  } catch (error) {
    console.error('Report hatası:', error)
    res.status(500).json({ error: 'Raporlama başarısız' })
  }
})

// Kullanıcının kendi raporlarını getir
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
            isVerified: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    res.json({ reports })
  } catch (error) {
    console.error('My reports hatası:', error)
    res.status(500).json({ error: 'Raporlar alınamadı' })
  }
})

// Raporu sil (sadece kendi raporunu)
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params
    const fingerprint = req.headers['x-fingerprint'] || req.ip

    const report = await prisma.report.findFirst({
      where: { id, fingerprint },
    })

    if (!report) {
      return res.status(404).json({ error: 'Rapor bulunamadı' })
    }

    await prisma.report.delete({ where: { id } })

    // Report count'u azalt
    await prisma.blockedSite.update({
      where: { id: report.siteId },
      data: { reportCount: { decrement: 1 } },
    })

    res.json({ success: true })
  } catch (error) {
    console.error('Delete report hatası:', error)
    res.status(500).json({ error: 'Silme başarısız' })
  }
})

module.exports = router
