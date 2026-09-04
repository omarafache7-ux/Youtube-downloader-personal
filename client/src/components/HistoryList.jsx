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

export default function HistoryList({ items, onRemoved }) {
  async function handleDelete(id) {
    await deleteDownload(id);
    onRemoved(id);
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
              <a className="btn" href={fileUrl(item._id)}>
                Save file
              </a>
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
