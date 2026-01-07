const express = require('express')
const { prisma } = require('../index')
const { checkAutoBan } = require('./blocklist')

const router = express.Router()

// POST /api/vote - Vote on a site
router.post('/', async (req, res) => {
  try {
    const { siteId, domain, value } = req.body // value: 1 (AI slop) or -1 (not AI slop)
    const fingerprint = req.headers['x-fingerprint'] || req.ip

    // Validate vote value
    if (value !== 1 && value !== -1) {
      return res.status(400).json({ error: 'Invalid vote value. Use 1 (AI slop) or -1 (not AI slop)' })
    }

    // Find site by ID or domain
    let site
    if (siteId) {
      site = await prisma.blockedSite.findUnique({ where: { id: siteId } })
    } else if (domain) {
      const cleanDomain = domain.toLowerCase().replace(/^www\./, '').trim()
      site = await prisma.blockedSite.findUnique({ where: { domain: cleanDomain } })
    }

    if (!site) {
      return res.status(404).json({ error: 'Site not found' })
    }

    // Check for existing vote
    const existingVote = await prisma.vote.findUnique({
      where: {
        siteId_fingerprint: {
          siteId: site.id,
          fingerprint,
        },
      },
    })

    if (existingVote) {
      if (existingVote.value === value) {
        // Same vote, remove it (toggle off)
        await prisma.vote.delete({ where: { id: existingVote.id } })

        await prisma.blockedSite.update({
          where: { id: site.id },
          data: { score: { decrement: value } },
        })

        return res.json({ success: true, action: 'removed' })
      }

      // Different vote, change it
      await prisma.vote.update({
        where: { id: existingVote.id },
        data: { value },
      })

      // Score change: remove old vote and add new vote
      // If old was 1 and new is -1: score changes by -2
      // If old was -1 and new is 1: score changes by +2
      const scoreDelta = value - existingVote.value
      await prisma.blockedSite.update({
        where: { id: site.id },
        data: { score: { increment: scoreDelta } },
      })

      // Check for auto-ban
      await checkAutoBan(site.id)

      return res.json({ success: true, action: 'changed' })
    }

    // New vote
    await prisma.vote.create({
      data: {
        siteId: site.id,
        fingerprint,
        value,
      },
    })

    await prisma.blockedSite.update({
      where: { id: site.id },
      data: { score: { increment: value } },
    })

    // Check for auto-ban
    await checkAutoBan(site.id)

    res.json({ success: true, action: 'created' })
  } catch (error) {
    console.error('Vote error:', error)
    res.status(500).json({ error: 'Vote failed' })
  }
})

// GET /api/vote/my - Get user's votes
router.get('/my', async (req, res) => {
  try {
    const fingerprint = req.headers['x-fingerprint'] || req.ip

    const votes = await prisma.vote.findMany({
      where: { fingerprint },
      include: {
        site: {
          select: {
            domain: true,
            score: true,
            isBanned: true,
          },
        },
      },
    })

    res.json({ votes })
  } catch (error) {
    console.error('My votes error:', error)
    res.status(500).json({ error: 'Failed to fetch votes' })
  }
})

module.exports = router
