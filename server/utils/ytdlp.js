const path = require('path');
const fs = require('fs');

// Use the yt-dlp binary already installed on this machine (see README
// prerequisites) instead of the copy youtube-dl-exec tries to download
// during `npm install`. This avoids the postinstall download failing on
// flaky connections/proxies, and means there's only one yt-dlp to keep
// updated. Override YTDLP_PATH if `yt-dlp` isn't on your PATH.
const { create: createYoutubeDl } = require('youtube-dl-exec');
const youtubedl = createYoutubeDl(process.env.YTDLP_PATH || 'yt-dlp');

const DOWNLOAD_DIR = path.resolve(process.env.DOWNLOAD_DIR || './downloads');

if (!fs.existsSync(DOWNLOAD_DIR)) {
  fs.mkdirSync(DOWNLOAD_DIR, { recursive: true });
}

// YouTube increasingly challenges requests that don't look like they come
// from a real signed-in browser ("Sign in to confirm you're not a bot").
// Passing cookies from an actual logged-in browser session (or a cookies
// file) gets past this. Set COOKIES_FROM_BROWSER (e.g. "chrome", "firefox",
// "edge") or COOKIES_FILE in your .env — see the README troubleshooting
// section. Treat whichever you use as sensitive: it's tied to your account.
function authOptions() {
  if (process.env.COOKIES_FROM_BROWSER) {
    return { cookiesFromBrowser: process.env.COOKIES_FROM_BROWSER };
  }
  if (process.env.COOKIES_FILE) {
    return { cookies: process.env.COOKIES_FILE };
  }
  return {};
}

/**
 * Fetch metadata for a URL without downloading anything.
 */
async function fetchInfo(url) {
  const info = await youtubedl(url, {
    dumpSingleJson: true,
    noWarnings: true,
    noCheckCertificate: true,
    preferFreeFormats: true,
    youtubeSkipDashManifest: true,
    ...authOptions(),
  });
  return info;
}

/**
 * Download+convert a URL to the requested format inside DOWNLOAD_DIR.
 * Returns the resulting filename (relative to DOWNLOAD_DIR).
 *
 * jobId is used as a unique suffix so concurrent downloads never collide.
 */
async function downloadMedia(url, format, jobId) {
  const outputTemplate = path.join(DOWNLOAD_DIR, `%(title).80s-${jobId}.%(ext)s`);

  const baseOptions = {
    output: outputTemplate,
    noCheckCertificate: true,
    noWarnings: true,
    preferFreeFormats: true,
    restrictFilenames: true,
    ...authOptions(),
  };

  const options =
    format === 'mp3'
      ? {
          ...baseOptions,
          extractAudio: true,
          audioFormat: 'mp3',
          audioQuality: 0, // best
        }
      : {
          ...baseOptions,
          format: 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best',
          mergeOutputFormat: 'mp4',
        };

  await youtubedl(url, options);

  const match = fs
    .readdirSync(DOWNLOAD_DIR)
    .find((f) => f.includes(`-${jobId}.`));

  if (!match) {
    throw new Error('Download finished but the output file could not be located.');
  }

  return match;
}

function getDownloadDir() {
  return DOWNLOAD_DIR;
}

module.exports = { fetchInfo, downloadMedia, getDownloadDir };
