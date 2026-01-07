import { useEffect, useState } from 'react'
import { useBlocklistStore } from '../stores/blocklist'

function App() {
  const { blockedCount, isEnabled, toggleEnabled, fetchBlocklist } = useBlocklistStore()
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const init = async () => {
      await fetchBlocklist()
      setLoading(false)
    }
    init()
  }, [fetchBlocklist])

  if (loading) {
    return (
      <div className="popup-container">
        <div className="loading">Yükleniyor...</div>
      </div>
    )
  }

  return (
    <div className="popup-container">
      <header className="popup-header">
        <h1>SlopSearch</h1>
        <p className="tagline">AI Slop Temizleyici</p>
      </header>

      <main className="popup-main">
        <div className="toggle-section">
          <label className="toggle">
            <input
              type="checkbox"
              checked={isEnabled}
              onChange={toggleEnabled}
            />
            <span className="slider"></span>
          </label>
          <span className="toggle-label">
            {isEnabled ? 'Aktif' : 'Pasif'}
          </span>
        </div>

        <div className="stats">
          <div className="stat-item">
            <span className="stat-value">{blockedCount}</span>
            <span className="stat-label">Engelli Site</span>
          </div>
        </div>
      </main>

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
