import { useState } from 'react';
import { deleteDownload, fileUrl } from '../api/api';

const STATUS_LABEL = {
  pending: 'Queued…',
  processing: 'Downloading…',
  completed: 'Ready',
  failed: 'Failed',
};

function formatDuration(seconds) {
  if (!seconds) return '';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60)
    .toString()
    .padStart(2, '0');
  return `${m}:${s}`;
}

function formatSize(bytes) {
  if (!bytes) return '';
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(1)} MB`;
}

function formatQuality(item) {
  if (!item.quality || item.quality === 'best') return '';
  return item.format === 'mp3' ? `${item.quality} kbps` : `${item.quality}p`;
}

// Chromium browsers (Chrome, Edge, Brave, Opera) support a native "Save As"
// dialog via the File System Access API. Firefox/Safari don't, so we fall
// back to a plain navigation, which triggers the browser's normal download
// behavior (respecting its own "always ask where to save" setting).
const supportsSavePicker = typeof window !== 'undefined' && 'showSaveFilePicker' in window;

export default function HistoryList({ items, onRemoved }) {
  const [savingId, setSavingId] = useState(null);

  async function handleDelete(id) {
    await deleteDownload(id);
    onRemoved(id);
  }

  async function handleSave(item) {
    const url = fileUrl(item._id);
    const suggestedName = item.filename || `${item.title || 'download'}.${item.format}`;

    if (!supportsSavePicker) {
      // No native picker available — let the browser handle it normally.
      window.location.href = url;
      return;
    }

    setSavingId(item._id);
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Server responded ${response.status}`);
      const blob = await response.blob();

      const handle = await window.showSaveFilePicker({
        suggestedName,
        types: [
          {
            description: item.format.toUpperCase(),
            accept: {
              [item.format === 'mp3' ? 'audio/mpeg' : 'video/mp4']: [`.${item.format}`],
            },
          },
        ],
      });
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
    } catch (err) {
      // AbortError just means the user closed the save dialog — not a failure.
      if (err.name !== 'AbortError') {
        console.error('Save failed:', err);
        alert(`Couldn't save the file: ${err.message}`);
      }
    } finally {
      setSavingId(null);
    }
  }

  if (items.length === 0) {
    return <p className="empty-state">No downloads yet — paste a link above to get started.</p>;
  }

  return (
    <ul className="history-list">
      {items.map((item) => (
        <li key={item._id} className={`history-item status-${item.status}`}>
          {item.thumbnail ? (
            <img src={item.thumbnail} alt="" className="thumb" />
          ) : (
            <div className="thumb thumb-placeholder" />
          )}

          <div className="history-info">
            <p className="title">{item.title || item.sourceUrl}</p>
            <p className="meta">
              {item.format.toUpperCase()}
              {formatQuality(item) ? ` · ${formatQuality(item)}` : ''}
              {item.durationSeconds ? ` · ${formatDuration(item.durationSeconds)}` : ''}
              {item.fileSizeBytes ? ` · ${formatSize(item.fileSizeBytes)}` : ''}
            </p>
            <p className="status">
              {STATUS_LABEL[item.status] || item.status}
              {item.status === 'failed' && item.error ? `: ${item.error}` : ''}
            </p>
          </div>

          <div className="history-actions">
            {item.status === 'completed' && (
              <button
                className="btn"
                onClick={() => handleSave(item)}
                disabled={savingId === item._id}
              >
                {savingId === item._id ? 'Saving…' : 'Save file'}
              </button>
            )}
            <button className="btn btn-danger" onClick={() => handleDelete(item._id)}>
              Remove
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
}
