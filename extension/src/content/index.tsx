// SlopSearch Content Script
// Google ve Bing arama sonuçlarında çalışır

interface BlocklistData {
  sites: string[]
  isEnabled: boolean
}

let blocklist: string[] = []
let isEnabled = true

// Blocklist'i background'dan al
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

// Domain'in engellenip engellenmediğini kontrol et
function isBlocked(url: string): boolean {
  if (!isEnabled) return false
  try {
    const domain = new URL(url).hostname.replace('www.', '')
    return blocklist.some(
      (blocked) => domain.includes(blocked) || blocked.includes(domain)
    )
  } catch {
    return false
  }
}

// URL'den domain çıkar
function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace('www.', '')
  } catch {
    return ''
  }
}

// Google arama sonuçlarını işle
function processGoogleResults(): void {
  const results = document.querySelectorAll('div.g')

  results.forEach((result) => {
    const link = result.querySelector('a[href^="http"]') as HTMLAnchorElement
    if (!link) return

    const url = link.href
    const domain = extractDomain(url)

    // Eğer zaten işlendiyse atla
    if (result.getAttribute('data-slopsearch-processed')) return
    result.setAttribute('data-slopsearch-processed', 'true')

    // Engelli mi kontrol et
    if (isBlocked(url)) {
      hideResult(result as HTMLElement, domain)
      return
    }

    // Block butonu ekle
    addBlockButton(result as HTMLElement, domain)
  })
}

// Bing arama sonuçlarını işle
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

// Sonucu gizle
function hideResult(element: HTMLElement, domain: string): void {
  element.style.display = 'none'

  // Gizlendi bilgisi ekle (opsiyonel göster butonu ile)
  const notice = document.createElement('div')
  notice.className = 'slopsearch-hidden-notice'
  notice.innerHTML = `
    <span>🚫 ${domain} engellendi</span>
    <button class="slopsearch-show-btn">Göster</button>
  `

  notice.querySelector('.slopsearch-show-btn')?.addEventListener('click', () => {
    element.style.display = ''
    notice.remove()
  })

  element.parentNode?.insertBefore(notice, element)
}

// Block butonu ekle
function addBlockButton(element: HTMLElement, domain: string): void {
  // Container bul veya oluştur
  const citeElement = element.querySelector('cite')
  if (!citeElement) return

  const btn = document.createElement('button')
  btn.className = 'slopsearch-block-btn'
  btn.textContent = '🚫'
  btn.title = `${domain} sitesini engelle`

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

// Ana işlem
async function init(): Promise<void> {
  await loadBlocklist()

  const isGoogle = window.location.hostname.includes('google')
  const isBing = window.location.hostname.includes('bing')

  const processResults = isGoogle ? processGoogleResults : isBing ? processBingResults : null

  if (processResults) {
    // İlk işlem
    processResults()

    // DOM değişikliklerini izle (infinite scroll, lazy load için)
    const observer = new MutationObserver(() => {
      processResults()
    })

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    })
  }
}

// Storage değişikliklerini dinle
chrome.storage.onChanged.addListener((changes) => {
  if (changes.blockedSites || changes.communitySites || changes.isEnabled) {
    loadBlocklist().then(() => {
      // Sayfayı yeniden işle
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

// Başlat
init()
