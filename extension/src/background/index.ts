// SlopSearch Background Service Worker

const API_URL = 'https://api.slopsearch.deadnetguard.com'

// Extension kurulduğunda
chrome.runtime.onInstalled.addListener(async () => {
  console.log('SlopSearch kuruldu!')

  // Varsayılan ayarları kaydet
  await chrome.storage.local.set({
    isEnabled: true,
    blockedSites: [],
  })

  // İlk blocklist'i çek
  try {
    const response = await fetch(`${API_URL}/api/blocklist`)
    const data = await response.json()
    if (data.sites) {
      await chrome.storage.local.set({ communitySites: data.sites })
    }
  } catch (error) {
    console.error('Blocklist çekilemedi:', error)
  }
})

// Content script'ten gelen mesajları dinle
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'GET_BLOCKLIST') {
    chrome.storage.local.get(['blockedSites', 'communitySites', 'isEnabled']).then((data) => {
      const allSites = [
        ...(data.blockedSites || []),
        ...(data.communitySites || []),
      ]
      sendResponse({
        sites: [...new Set(allSites)],
        isEnabled: data.isEnabled !== false,
      })
    })
    return true // async response
  }

  if (message.type === 'BLOCK_SITE') {
    const { domain } = message
    chrome.storage.local.get(['blockedSites']).then(async (data) => {
      const sites = data.blockedSites || []
      if (!sites.includes(domain)) {
        sites.push(domain)
        await chrome.storage.local.set({ blockedSites: sites })

        // API'ye raporla
        try {
          await fetch(`${API_URL}/api/report`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ domain }),
          })
        } catch {
          // Sessizce başarısız ol
        }
      }
      sendResponse({ success: true })
    })
    return true
  }

  if (message.type === 'UNBLOCK_SITE') {
    const { domain } = message
    chrome.storage.local.get(['blockedSites']).then(async (data) => {
      const sites = (data.blockedSites || []).filter((s: string) => s !== domain)
      await chrome.storage.local.set({ blockedSites: sites })
      sendResponse({ success: true })
    })
    return true
  }
})

// Periyodik olarak topluluk listesini güncelle (her 6 saatte bir)
chrome.alarms.create('updateBlocklist', { periodInMinutes: 360 })

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'updateBlocklist') {
    try {
      const response = await fetch(`${API_URL}/api/blocklist`)
      const data = await response.json()
      if (data.sites) {
        await chrome.storage.local.set({ communitySites: data.sites })
      }
    } catch (error) {
      console.error('Blocklist güncellenemedi:', error)
    }
  }
})
