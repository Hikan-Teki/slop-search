const express = require('express')
const { PrismaClient } = require('@prisma/client')

const router = express.Router()
const prisma = new PrismaClient()

// Oy ver
router.post('/', async (req, res) => {
  try {
    const { siteId, domain, isUpvote } = req.body
    const fingerprint = req.headers['x-fingerprint'] || req.ip

    // siteId veya domain ile site bul
    let site
    if (siteId) {
      site = await prisma.blockedSite.findUnique({ where: { id: siteId } })
    } else if (domain) {
      const cleanDomain = domain.toLowerCase().replace(/^www\./, '').trim()
      site = await prisma.blockedSite.findUnique({ where: { domain: cleanDomain } })
    }

    if (!site) {
      return res.status(404).json({ error: 'Site bulunamadı' })
    }

    // Daha önce oy kullanmış mı?
    const existingVote = await prisma.vote.findUnique({
      where: {
        siteId_fingerprint: {
          siteId: site.id,
          fingerprint,
        },
      },
    })

    if (existingVote) {
      // Oy değiştir
      if (existingVote.isUpvote === isUpvote) {
        // Aynı oy, sil (toggle)
        await prisma.vote.delete({ where: { id: existingVote.id } })

        await prisma.blockedSite.update({
          where: { id: site.id },
          data: isUpvote
            ? { upvotes: { decrement: 1 } }
            : { downvotes: { decrement: 1 } },
        })

        return res.json({ success: true, action: 'removed' })
      }

      // Farklı oy, güncelle
      await prisma.vote.update({
        where: { id: existingVote.id },
        data: { isUpvote },
      })

      await prisma.blockedSite.update({
        where: { id: site.id },
        data: isUpvote
          ? { upvotes: { increment: 1 }, downvotes: { decrement: 1 } }
          : { upvotes: { decrement: 1 }, downvotes: { increment: 1 } },
      })

      return res.json({ success: true, action: 'changed' })
    }

    // Yeni oy
    await prisma.vote.create({
      data: {
        siteId: site.id,
        fingerprint,
        isUpvote,
      },
    })

    await prisma.blockedSite.update({
      where: { id: site.id },
      data: isUpvote
        ? { upvotes: { increment: 1 } }
        : { downvotes: { increment: 1 } },
    })

    res.json({ success: true, action: 'created' })
  } catch (error) {
    console.error('Vote hatası:', error)
    res.status(500).json({ error: 'Oylama başarısız' })
  }
})

// Kullanıcının oylarını getir
router.get('/my', async (req, res) => {
  try {
    const fingerprint = req.headers['x-fingerprint'] || req.ip

    const votes = await prisma.vote.findMany({
      where: { fingerprint },
      include: {
        site: {
          select: {
            domain: true,
            upvotes: true,
            downvotes: true,
          },
        },
      },
    })

    res.json({ votes })
  } catch (error) {
    console.error('My votes hatası:', error)
    res.status(500).json({ error: 'Oylar alınamadı' })
  }
})

module.exports = router
