import { useState } from 'react';
import { createDownload } from '../api/api';

export default function DownloadForm({ onQueued }) {
  const [url, setUrl] = useState('');
  const [format, setFormat] = useState('mp4');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (!url.trim()) {
      setError('Paste a video URL first.');
      return;
    }

    setSubmitting(true);
    try {
      const record = await createDownload(url.trim(), format);
      onQueued(record);
      setUrl('');
    } catch (err) {
      setError(err?.response?.data?.error || 'Something went wrong starting the download.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="download-form" onSubmit={handleSubmit}>
      <input
        type="text"
        placeholder="Paste a video URL"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        disabled={submitting}
      />

      <div className="format-toggle">
        <label>
          <input
            type="radio"
            name="format"
            value="mp4"
            checked={format === 'mp4'}
            onChange={() => setFormat('mp4')}
          />
          MP4 (video)
        </label>
        <label>
          <input
            type="radio"
            name="format"
            value="mp3"
            checked={format === 'mp3'}
            onChange={() => setFormat('mp3')}
          />
          MP3 (audio)
        </label>
      </div>

      <button type="submit" disabled={submitting}>
        {submitting ? 'Starting…' : 'Download'}
      </button>

      {error && <p className="error-text">{error}</p>}
    </form>
  );
}
