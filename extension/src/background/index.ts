// SlopSearch Background Service Worker

const API_URL = 'https://api.slopsearch.deadnetguard.com'

// Domain validation regex
const DOMAIN_REGEX = /^(?!-)[a-zA-Z0-9-]{1,63}(?<!-)(\.[a-zA-Z0-9-]{1,63})*\.[a-zA-Z]{2,}$/

// Validate domain format
function isValidDomain(domain: unknown): domain is string {
  if (typeof domain !== 'string') return false
  const clean = domain.toLowerCase().replace(/^www\./, '').trim()
  return clean.length <= 253 && DOMAIN_REGEX.test(clean)
}

// Validate sender is from our extension
function isValidSender(sender: chrome.runtime.MessageSender): boolean {
  return sender.id === chrome.runtime.id
}

// Validate API response
function isValidBlocklistResponse(data: unknown): data is { sites: string[] } {
  if (!data || typeof data !== 'object') return false
  const obj = data as Record<string, unknown>
  if (!Array.isArray(obj.sites)) return false
  return obj.sites.every((s) => typeof s === 'string' && isValidDomain(s))
}

// When extension is installed
chrome.runtime.onInstalled.addListener(async () => {
  // Save default settings
  await chrome.storage.local.set({
    isEnabled: true,
    blockedSites: [],
  })

  // Fetch initial blocklist
  try {
    const response = await fetch(`${API_URL}/api/blocklist`)
    if (!response.ok) throw new Error('API error')
    const data = await response.json()
    if (isValidBlocklistResponse(data)) {
      await chrome.storage.local.set({ communitySites: data.sites })
    }
  } catch {
    // Silently fail on initial fetch
  }
})

// Listen to messages from content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Validate sender
  if (!isValidSender(sender)) {
    sendResponse({ error: 'Invalid sender' })
    return false
  }

  if (message.type === 'GET_BLOCKLIST') {
    chrome.storage.local.get(['blockedSites', 'communitySites', 'isEnabled']).then((data) => {
      const blockedSites = Array.isArray(data.blockedSites) ? data.blockedSites.filter(isValidDomain) : []
      const communitySites = Array.isArray(data.communitySites) ? data.communitySites.filter(isValidDomain) : []
      const allSites = [...blockedSites, ...communitySites]
      sendResponse({
        sites: [...new Set(allSites)],
        isEnabled: data.isEnabled !== false,
      })
    })
    return true // async response
  }

  if (message.type === 'BLOCK_SITE') {
    const { domain } = message

    // Validate domain
    if (!isValidDomain(domain)) {
      sendResponse({ error: 'Invalid domain' })
      return false
    }

    const cleanDomain = domain.toLowerCase().replace(/^www\./, '').trim()

    chrome.storage.local.get(['blockedSites']).then(async (data) => {
      const sites = Array.isArray(data.blockedSites) ? data.blockedSites.filter(isValidDomain) : []
      if (!sites.includes(cleanDomain)) {
        sites.push(cleanDomain)
        await chrome.storage.local.set({ blockedSites: sites })

        // Report to API
        try {
          await fetch(`${API_URL}/api/report`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ domain: cleanDomain }),
          })
        } catch {
          // Silently fail
        }
      }
      sendResponse({ success: true })
    })
    return true
  }

  if (message.type === 'UNBLOCK_SITE') {
    const { domain } = message

    // Validate domain
    if (!isValidDomain(domain)) {
      sendResponse({ error: 'Invalid domain' })
      return false
    }

    const cleanDomain = domain.toLowerCase().replace(/^www\./, '').trim()

    chrome.storage.local.get(['blockedSites']).then(async (data) => {
      const sites = Array.isArray(data.blockedSites)
        ? data.blockedSites.filter((s: string) => isValidDomain(s) && s !== cleanDomain)
        : []
      await chrome.storage.local.set({ blockedSites: sites })
      sendResponse({ success: true })
    })
    return true
  }

  return false
})

// Periodically update community list (every 6 hours)
chrome.alarms.create('updateBlocklist', { periodInMinutes: 360 })

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'updateBlocklist') {
    try {
      const response = await fetch(`${API_URL}/api/blocklist`)
      if (!response.ok) throw new Error('API error')
      const data = await response.json()
      if (isValidBlocklistResponse(data)) {
        await chrome.storage.local.set({ communitySites: data.sites })
      }
    } catch {
      // Silently fail
    }
  }
})
