const mongoose = require('mongoose');

const downloadSchema = new mongoose.Schema(
  {
    sourceUrl: { type: String, required: true, trim: true },
    format: { type: String, enum: ['mp3', 'mp4'], required: true },
    quality: { type: String, default: 'best' },
    title: { type: String, default: '' },
    thumbnail: { type: String, default: '' },
    durationSeconds: { type: Number, default: 0 },
    filename: { type: String, default: '' },
    fileSizeBytes: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ['pending', 'processing', 'completed', 'failed'],
      default: 'pending',
    },
    error: { type: String, default: '' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Download', downloadSchema);