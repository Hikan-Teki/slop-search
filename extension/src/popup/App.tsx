import { useEffect, useState } from 'react'

type TabType = 'status' | 'blocklist'

function App() {
  const [activeTab, setActiveTab] = useState<TabType>('status')
  const [isEnabled, setIsEnabled] = useState(true)
  const [blockedSites, setBlockedSites] = useState<string[]>([])
  const [communitySites, setCommunitySites] = useState<string[]>([])
  const [newSite, setNewSite] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      const data = await chrome.storage.local.get(['blockedSites', 'communitySites', 'isEnabled'])
      setBlockedSites(data.blockedSites || [])
      setCommunitySites(data.communitySites || [])
      setIsEnabled(data.isEnabled !== false)
    } catch (error) {
      console.error('Failed to load data:', error)
    } finally {
      setLoading(false)
    }
  }

  const toggleEnabled = async () => {
    const newValue = !isEnabled
    setIsEnabled(newValue)
    await chrome.storage.local.set({ isEnabled: newValue })
  }

  const addSite = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newSite.trim()) return

    const domain = newSite.toLowerCase().replace(/^(https?:\/\/)?(www\.)?/, '').replace(/\/.*$/, '').trim()
    if (!domain || blockedSites.includes(domain)) {
      setNewSite('')
      return
    }

    const updatedSites = [...blockedSites, domain]
    setBlockedSites(updatedSites)
    await chrome.storage.local.set({ blockedSites: updatedSites })
    setNewSite('')

    // API'ye raporla
    try {
      await fetch('https://api.slopsearch.deadnetguard.com/api/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain }),
      })
    } catch {
      // Sessizce başarısız ol
    }
  }

  const removeSite = async (domain: string) => {
    const updatedSites = blockedSites.filter(s => s !== domain)
    setBlockedSites(updatedSites)
    await chrome.storage.local.set({ blockedSites: updatedSites })
  }

  if (loading) {
    return (
      <div className="popup-container">
        <div className="loading">Loading</div>
      </div>
    )
  }

  const totalBlocked = new Set([...blockedSites, ...communitySites]).size

  return (
    <div className="popup-container">
      <header className="popup-header">
        <div className="logo">
          <span className="logo-text">SlopSearch</span>
        </div>
        <p className="tagline">AI Slop Cleaner</p>
      </header>

      <div className="tabs">
        <button
          className={`tab ${activeTab === 'status' ? 'active' : ''}`}
          onClick={() => setActiveTab('status')}
        >
          Status
        </button>
        <button
          className={`tab ${activeTab === 'blocklist' ? 'active' : ''}`}
          onClick={() => setActiveTab('blocklist')}
        >
          Blocked Sites
        </button>
      </div>

      <div className="tab-content">
        {activeTab === 'status' && (
          <div className="status-section">
            <div className="toggle-card">
              <span className="toggle-label">Protection</span>
              <label className="toggle">
                <input
                  type="checkbox"
                  checked={isEnabled}
                  onChange={toggleEnabled}
                />
                <span className="slider"></span>
              </label>
            </div>

            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-value">{blockedSites.length}</div>
                <div className="stat-label">Personal List</div>
              </div>
              <div className="stat-card">
                <div className="stat-value">{communitySites.length}</div>
                <div className="stat-label">Community List</div>
              </div>
              <div className="stat-card" style={{ gridColumn: 'span 2' }}>
                <div className="stat-value">{totalBlocked}</div>
                <div className="stat-label">Total Blocked Sites</div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'blocklist' && (
          <div className="blocklist-section">
            <form className="add-site-form" onSubmit={addSite}>
              <input
                type="text"
                className="add-site-input"
                placeholder="site.com"
                value={newSite}
                onChange={(e) => setNewSite(e.target.value)}
              />
              <button type="submit" className="add-site-btn">Add</button>
            </form>

            <div className="blocklist-header">
              <span className="blocklist-title">My Blocklist</span>
              <span className="blocklist-count">{blockedSites.length} sites</span>
            </div>

            <div className="blocklist-items">
              {blockedSites.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-icon">🔍</div>
                  <div className="empty-text">No sites blocked yet</div>
                </div>
              ) : (
                blockedSites.map((domain) => (
                  <div key={domain} className="blocklist-item">
                    <span className="site-domain">{domain}</span>
                    <button
                      className="remove-btn"
                      onClick={() => removeSite(domain)}
                      title="Remove from blocklist"
                    >
                      ×
                    </button>
                  </div>
                ))
              )}
            </div>

            {communitySites.length > 0 && (
              <>
                <div className="blocklist-header" style={{ marginTop: '16px' }}>
                  <span className="blocklist-title">Community List</span>
                  <span className="blocklist-count">{communitySites.length} sites</span>
                </div>
                <div className="blocklist-items">
                  {communitySites.slice(0, 10).map((domain) => (
                    <div key={domain} className="blocklist-item">
                      <span className="site-domain">{domain}</span>
                    </div>
                  ))}
                  {communitySites.length > 10 && (
                    <div className="empty-state" style={{ padding: '12px' }}>
                      <div className="empty-text">+{communitySites.length - 10} more</div>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      <footer className="popup-footer">
        <a
          href="https://slopsearch.deadnetguard.com"
          target="_blank"
          rel="noopener noreferrer"
        >
          slopsearch.deadnetguard.com
        </a>
      </footer>
    </div>
  )
}

export default App
