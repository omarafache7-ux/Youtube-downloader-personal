require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');
const downloadRoutes = require('./routes/downloadRoutes');

const app = express();

connectDB();

const corsOrigin = process.env.CORS_ORIGIN || 'http://localhost:5173';
app.use(cors({ origin: corsOrigin }));
app.use(express.json());

app.get('/', (req, res) => {
  res.json({ status: 'ok', message: 'YT Downloader API (personal use) is running.' });
});

app.use('/api/downloads', downloadRoutes);

// Basic error handler as a safety net
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Backend listening on http://localhost:${PORT}`);
});
