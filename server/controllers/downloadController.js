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
 * Kicks off the actual download in the background and updates the DB
 * record as it progresses. Not awaited by the route handler so the
 * client gets an immediate response and can poll for status.
 */
async function processDownload(recordId, url, format, quality) {
  const jobId = recordId.toString();
  try {
    await Download.findByIdAndUpdate(recordId, { status: 'processing' });

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

    let info = {};
    try {
      info = await fetchInfo(url);
    } catch (err) {
      return res.status(422).json({
        error: 'Could not read info for that URL. Check the link and that yt-dlp is installed.',
        details: err.message,
      });
    }

    const record = await Download.create({
      sourceUrl: url,
      format,
      quality,
      title: info.title || '',
      thumbnail: info.thumbnail || '',
      durationSeconds: info.duration || 0,
      status: 'pending',
    });

    // Fire and forget — status is tracked in Mongo and polled by the client.
    processDownload(record._id, url, format, quality);

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