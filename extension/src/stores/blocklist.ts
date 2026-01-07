import { create } from 'zustand'

interface BlocklistState {
  blockedSites: string[]
  blockedCount: number
  isEnabled: boolean
  isLoading: boolean
  error: string | null
  fetchBlocklist: () => Promise<void>
  toggleEnabled: () => void
  addToBlocklist: (domain: string) => Promise<void>
  removeFromBlocklist: (domain: string) => Promise<void>
  isBlocked: (domain: string) => boolean
}

const API_URL = 'https://api.slopsearch.deadnetguard.com'

export const useBlocklistStore = create<BlocklistState>((set, get) => ({
  blockedSites: [],
  blockedCount: 0,
  isEnabled: true,
  isLoading: false,
  error: null,

  fetchBlocklist: async () => {
    set({ isLoading: true, error: null })
    try {
      // Önce local storage'dan al
      const stored = await chrome.storage.local.get(['blockedSites', 'isEnabled'])
      const localSites = stored.blockedSites || []
      const isEnabled = stored.isEnabled !== false

      // API'den topluluk listesini al
      const response = await fetch(`${API_URL}/api/blocklist`)
      const data = await response.json()
      const communitySites = data.sites || []

      // Birleştir
      const allSites = [...new Set([...localSites, ...communitySites])]

      set({
        blockedSites: allSites,
        blockedCount: allSites.length,
        isEnabled,
        isLoading: false,
      })
    } catch (error) {
      // API başarısız olursa sadece local kullan
      const stored = await chrome.storage.local.get(['blockedSites', 'isEnabled'])
      set({
        blockedSites: stored.blockedSites || [],
        blockedCount: (stored.blockedSites || []).length,
        isEnabled: stored.isEnabled !== false,
        isLoading: false,
        error: 'API bağlantısı başarısız',
      })
    }
  },

  toggleEnabled: () => {
    const newEnabled = !get().isEnabled
    chrome.storage.local.set({ isEnabled: newEnabled })
    set({ isEnabled: newEnabled })
  },

  addToBlocklist: async (domain: string) => {
    const { blockedSites } = get()
    if (blockedSites.includes(domain)) return

    const newSites = [...blockedSites, domain]
    await chrome.storage.local.set({ blockedSites: newSites })
    set({ blockedSites: newSites, blockedCount: newSites.length })

    // API'ye de raporla
    try {
      await fetch(`${API_URL}/api/report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain }),
      })
    } catch {
      // API hatası kullanıcıyı etkilemesin
    }
  },

  removeFromBlocklist: async (domain: string) => {
    const { blockedSites } = get()
    const newSites = blockedSites.filter((s) => s !== domain)
    await chrome.storage.local.set({ blockedSites: newSites })
    set({ blockedSites: newSites, blockedCount: newSites.length })
  },

  isBlocked: (domain: string) => {
    const { blockedSites, isEnabled } = get()
    if (!isEnabled) return false
    return blockedSites.some((blocked) => domain.includes(blocked) || blocked.includes(domain))
  },
}))
