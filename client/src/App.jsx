import { useEffect, useRef, useState } from 'react';
import DownloadForm from './components/DownloadForm';
import HistoryList from './components/HistoryList';
import { listDownloads, getDownload } from './api/api';
import './index.css';

const ACTIVE_STATUSES = new Set(['pending', 'processing']);

export default function App() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const pollTimer = useRef(null);

  useEffect(() => {
    refreshAll();
    return () => clearTimeout(pollTimer.current);
  }, []);

  async function refreshAll() {
    try {
      const data = await listDownloads();
      setItems(data);
    } finally {
      setLoading(false);
    }
  }

  // Poll any item that's still pending/processing until it settles.
  useEffect(() => {
    const active = items.filter((i) => ACTIVE_STATUSES.has(i.status));
    if (active.length === 0) return;

    pollTimer.current = setTimeout(async () => {
      try {
        const updates = await Promise.all(active.map((i) => getDownload(i._id)));
        setItems((prev) =>
          prev.map((item) => updates.find((u) => u._id === item._id) || item)
        );
      } catch (err) {
        // A single failed poll (backend restarting, brief network blip) must
        // not kill the loop: without this, the effect never re-runs and the
        // UI silently freezes on "Queued…" forever. Nudge state so the
        // effect fires again and we retry on the next tick.
        console.error('Status poll failed, will retry:', err);
        setItems((prev) => [...prev]);
      }
    }, 2000);

    return () => clearTimeout(pollTimer.current);
  }, [items]);

  function handleQueued(record) {
    setItems((prev) => [record, ...prev]);
  }

  function handleRemoved(id) {
    setItems((prev) => prev.filter((i) => i._id !== id));
  }

  return (
    <div className="app">
      <header>
        <h1>Personal Media Downloader</h1>
        <p className="subtitle">
          For your own use, on content you have the rights to save. 
        </p>
      </header>

      <DownloadForm onQueued={handleQueued} />

      <section className="history-section">
        <h2>History</h2>
        {loading ? <p>Loading…</p> : <HistoryList items={items} onRemoved={handleRemoved} />}
      </section>
    </div>
  );
}
