import { useState } from 'react';
import { createDownload } from '../api/api';

const VIDEO_QUALITIES = [
  { value: 'best', label: 'Best available' },
  { value: '2160', label: '2160p (4K)' },
  { value: '1440', label: '1440p' },
  { value: '1080', label: '1080p' },
  { value: '720', label: '720p' },
  { value: '480', label: '480p' },
  { value: '360', label: '360p' },
];

const AUDIO_QUALITIES = [
  { value: 'best', label: 'Best (VBR)' },
  { value: '320', label: '320 kbps' },
  { value: '256', label: '256 kbps' },
  { value: '192', label: '192 kbps' },
  { value: '128', label: '128 kbps' },
];

export default function DownloadForm({ onQueued }) {
  const [url, setUrl] = useState('');
  const [format, setFormat] = useState('mp4');
  const [quality, setQuality] = useState('best');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const qualityOptions = format === 'mp3' ? AUDIO_QUALITIES : VIDEO_QUALITIES;

  function handleFormatChange(next) {
    setFormat(next);
    setQuality('best'); // reset — video/audio quality scales don't share values
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (!url.trim()) {
      setError('Paste a video URL first.');
      return;
    }

    setSubmitting(true);
    try {
      const record = await createDownload(url.trim(), format, quality);
      onQueued(record);
      setUrl('');
    } catch (err) {
      const data = err?.response?.data;
      setError(data?.details || data?.error || 'Something went wrong starting the download.');
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
            onChange={() => handleFormatChange('mp4')}
          />
          MP4 (video)
        </label>
        <label>
          <input
            type="radio"
            name="format"
            value="mp3"
            checked={format === 'mp3'}
            onChange={() => handleFormatChange('mp3')}
          />
          MP3 (audio)
        </label>
      </div>

      <select
        className="quality-select"
        value={quality}
        onChange={(e) => setQuality(e.target.value)}
        disabled={submitting}
        aria-label="Quality"
      >
        {qualityOptions.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>

      <button type="submit" disabled={submitting}>
        {submitting ? 'Starting…' : 'Download'}
      </button>

      {error && <p className="error-text">{error}</p>}
    </form>
  );
}
