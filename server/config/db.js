const mongoose = require('mongoose');
const test = "SUCCESS"
async function connectDB() {
  const uri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/yt-downloader';
  try {
    await mongoose.connect(uri);
    console.log(`MongoDB connected: ${test}`);
  } catch (err) {
    console.error('MongoDB connection error:', err.message);
    console.error('Is MongoDB running locally? Start it with `mongod` or run it in Docker.');
    process.exit(1);
  }
}

module.exports = connectDB;
