// SlopSearch Content Script
// Works on Google and Bing search results

interface BlocklistData {
  sites: string[]
  isEnabled: boolean
}

let blocklist: string[] = []
let isEnabled = true

// Get blocklist from background
async function loadBlocklist(): Promise<void> {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type: 'GET_BLOCKLIST' }, (response: BlocklistData) => {
      if (response) {
        blocklist = response.sites || []
        isEnabled = response.isEnabled
      }
      resolve()
    })
  })
}

// Check if domain is blocked (exact match or subdomain)
function isBlocked(url: string): boolean {
  if (!isEnabled) return false
  try {
    const domain = new URL(url).hostname.replace(/^www\./, '').toLowerCase()
    return blocklist.some((blocked) => {
      const blockedClean = blocked.toLowerCase()
      // Exact match or subdomain match (e.g., blocked "example.com" matches "sub.example.com")
      return domain === blockedClean || domain.endsWith('.' + blockedClean)
    })
  } catch {
    return false
  }
}

// Extract domain from URL
function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace('www.', '')
  } catch {
    return ''
  }
}

// Process Google search results
function processGoogleResults(): void {
  // Google's main search result links: links with jsname="UWckNb"
  const links = document.querySelectorAll('a[jsname="UWckNb"]') as NodeListOf<HTMLAnchorElement>

  links.forEach((link) => {
    if (!link.href.startsWith('http')) return

    // Skip Google's own links
    if (link.href.includes('google.com')) return

    const url = link.href
    const domain = extractDomain(url)
    if (!domain) return

    // Find the closest parent container
    let container = link.closest('[data-hveid]') || link.parentElement?.parentElement?.parentElement
    if (!container) return

    // Skip Google image carousel (not a search result)
    if (container.closest('[data-lpage]') || container.closest('#imagebox_bigimages')) return

    // Skip results without h3 heading (thumbnails, snippets, etc.)
    if (!container.querySelector('h3')) return

    // Skip if already processed
    if (link.getAttribute('data-slopsearch-processed')) return
    link.setAttribute('data-slopsearch-processed', 'true')

    // Check if blocked
    if (isBlocked(url)) {
      hideResult(container as HTMLElement, domain)
      return
    }

    // Add block button to top-right corner of container
    if (!container.querySelector('.slopsearch-block-btn')) {
      addBlockButtonToContainer(container as HTMLElement, domain)
    }
  })
}

// Add block button to container (top-right corner)
function addBlockButtonToContainer(container: HTMLElement, domain: string): void {
  // Make container relative if static
  const computedStyle = window.getComputedStyle(container)
  if (computedStyle.position === 'static') {
    (container as HTMLElement).style.position = 'relative'
  }

  const btn = document.createElement('button')
  btn.className = 'slopsearch-block-btn'
  btn.textContent = '🚫'
  btn.title = `Block ${domain}`

  btn.addEventListener('click', async (e) => {
    e.preventDefault()
    e.stopPropagation()

    chrome.runtime.sendMessage({ type: 'BLOCK_SITE', domain }, () => {
      blocklist.push(domain)
      hideResult(container, domain)
    })
  })

  container.appendChild(btn)
}

// Process Bing search results
function processBingResults(): void {
  const results = document.querySelectorAll('li.b_algo')

  results.forEach((result) => {
    const link = result.querySelector('a') as HTMLAnchorElement
    if (!link) return

    const url = link.href
    const domain = extractDomain(url)

    if (result.getAttribute('data-slopsearch-processed')) return
    result.setAttribute('data-slopsearch-processed', 'true')

    if (isBlocked(url)) {
      hideResult(result as HTMLElement, domain)
      return
    }

    addBlockButton(result as HTMLElement, domain)
  })
}

// Sanitize domain for display (prevent XSS)
function sanitizeDomain(domain: string): string {
  // Only allow valid domain characters
  return domain.replace(/[^a-zA-Z0-9.-]/g, '')
}

// Hide result
function hideResult(element: HTMLElement, domain: string): void {
  element.style.display = 'none'

  // Add hidden notice with optional show button (using safe DOM API)
  const notice = document.createElement('div')
  notice.className = 'slopsearch-hidden-notice'

  const span = document.createElement('span')
  span.textContent = `🚫 ${sanitizeDomain(domain)} blocked`

  const showBtn = document.createElement('button')
  showBtn.className = 'slopsearch-show-btn'
  showBtn.textContent = 'Show'
  showBtn.addEventListener('click', () => {
    element.style.display = ''
    notice.remove()
  })

  notice.appendChild(span)
  notice.appendChild(showBtn)
  element.parentNode?.insertBefore(notice, element)
}

// Add block button
function addBlockButton(element: HTMLElement, domain: string): void {
  // Find or create container
  const citeElement = element.querySelector('cite')
  if (!citeElement) return

  const btn = document.createElement('button')
  btn.className = 'slopsearch-block-btn'
  btn.textContent = '🚫'
  btn.title = `Block ${domain}`

  btn.addEventListener('click', async (e) => {
    e.preventDefault()
    e.stopPropagation()

    chrome.runtime.sendMessage({ type: 'BLOCK_SITE', domain }, () => {
      blocklist.push(domain)
      hideResult(element, domain)
    })
  })

  citeElement.parentNode?.insertBefore(btn, citeElement.nextSibling)
}

// Main process
async function init(): Promise<void> {
  await loadBlocklist()

  const isGoogle = window.location.hostname.includes('google')
  const isBing = window.location.hostname.includes('bing')

  const processResults = isGoogle ? processGoogleResults : isBing ? processBingResults : null

  if (processResults) {
    // Initial process
    processResults()

    // Watch for DOM changes (infinite scroll, lazy load)
    const observer = new MutationObserver(() => {
      processResults()
    })

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    })
  }
}

// Listen for storage changes
chrome.storage.onChanged.addListener((changes) => {
  if (changes.blockedSites || changes.communitySites || changes.isEnabled) {
    loadBlocklist().then(() => {
      // Re-process the page
      document.querySelectorAll('[data-slopsearch-processed]').forEach((el) => {
        el.removeAttribute('data-slopsearch-processed')
      })
      document.querySelectorAll('.slopsearch-hidden-notice').forEach((el) => el.remove())
      document.querySelectorAll('.slopsearch-block-btn').forEach((el) => el.remove())

      if (window.location.hostname.includes('google')) {
        processGoogleResults()
      } else if (window.location.hostname.includes('bing')) {
        processBingResults()
      }
    })
  }
})

// Start
init()
