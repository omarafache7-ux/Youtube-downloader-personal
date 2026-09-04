const fs = require('fs');
const path = require('path');
const Download = require('../models/Download');
const {
  fetchInfo,
  downloadMedia,
  getDownloadDir,
  VIDEO_QUALITIES,
  AUDIO_QUALITIES,
} = require('../utils/ytdlp');

/**
 * Runs the whole job in the background — metadata lookup first, then the
 * actual download — updating the DB record at each step. Deliberately NOT
 * awaited by the route handler: yt-dlp can take a minute or more (cookie
 * decryption, throttling), and blocking the HTTP response on that is what
 * made the UI look frozen on "Starting…".
 */
async function processDownload(recordId, url, format, quality) {
  const jobId = recordId.toString();
  try {
    await Download.findByIdAndUpdate(recordId, { status: 'processing' });

    // Metadata is a nice-to-have (title/thumbnail/duration for the UI), not
    // a prerequisite. If it fails or times out we keep going — the download
    // itself is the real test, and its error is the more useful one.
    try {
      const info = await fetchInfo(url);
      await Download.findByIdAndUpdate(recordId, {
        title: info.title || '',
        thumbnail: info.thumbnail || '',
        durationSeconds: info.duration || 0,
      });
    } catch (err) {
      console.warn(`Job ${jobId}: metadata lookup failed, continuing anyway:`, err.message);
    }

    const filename = await downloadMedia(url, format, quality, jobId);
    const filePath = path.join(getDownloadDir(), filename);
    const stats = fs.statSync(filePath);

    await Download.findByIdAndUpdate(recordId, {
      status: 'completed',
      filename,
      fileSizeBytes: stats.size,
    });
  } catch (err) {
    console.error(`Download job ${jobId} failed:`, err.message);
    await Download.findByIdAndUpdate(recordId, {
      status: 'failed',
      error: err.message?.slice(0, 500) || 'Unknown error',
    });
  }
}

// POST /api/downloads
exports.createDownload = async (req, res) => {
  try {
    const { url, format, quality = 'best' } = req.body;

    if (!url || typeof url !== 'string') {
      return res.status(400).json({ error: 'A valid "url" is required.' });
    }
    if (!['mp3', 'mp4'].includes(format)) {
      return res.status(400).json({ error: '"format" must be "mp3" or "mp4".' });
    }
    const allowedQualities = format === 'mp3' ? AUDIO_QUALITIES : VIDEO_QUALITIES;
    if (!allowedQualities.includes(quality)) {
      return res.status(400).json({
        error: `"quality" must be one of: ${allowedQualities.join(', ')}`,
      });
    }

    // Create the record and respond straight away (milliseconds). Title and
    // thumbnail get filled in by the background job once yt-dlp reports them,
    // so the item shows up in the UI immediately instead of the user staring
    // at a stuck button while yt-dlp works.
    const record = await Download.create({
      sourceUrl: url,
      format,
      quality,
      status: 'pending',
    });

    // Fire and forget — status is tracked in Mongo and polled by the client.
    // The .catch() guard matters: an unhandled rejection here would take the
    // whole Node process down.
    processDownload(record._id, url, format, quality).catch((err) =>
      console.error('processDownload crashed:', err)
    );

    res.status(202).json(record);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Unexpected server error', details: err.message });
  }
};

// GET /api/downloads
exports.listDownloads = async (req, res) => {
  const records = await Download.find().sort({ createdAt: -1 }).limit(100);
  res.json(records);
};

// GET /api/downloads/:id
exports.getDownload = async (req, res) => {
  const record = await Download.findById(req.params.id);
  if (!record) return res.status(404).json({ error: 'Not found' });
  res.json(record);
};

// GET /api/downloads/:id/file
exports.serveFile = async (req, res) => {
  const record = await Download.findById(req.params.id);
  if (!record) return res.status(404).json({ error: 'Not found' });
  if (record.status !== 'completed' || !record.filename) {
    return res.status(409).json({ error: 'File is not ready yet.' });
  }

  const filePath = path.join(getDownloadDir(), record.filename);
  if (!fs.existsSync(filePath)) {
    return res.status(410).json({ error: 'File is no longer on disk.' });
  }

  res.download(filePath, record.filename);
};

// DELETE /api/downloads/:id
exports.deleteDownload = async (req, res) => {
  const record = await Download.findById(req.params.id);
  if (!record) return res.status(404).json({ error: 'Not found' });

  if (record.filename) {
    const filePath = path.join(getDownloadDir(), record.filename);
    fs.existsSync(filePath) && fs.unlinkSync(filePath);
  }

  await record.deleteOne();
  res.status(204).send();
};