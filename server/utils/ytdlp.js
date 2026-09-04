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

// Without a timeout, a hung yt-dlp process (bad network, YouTube throttling,
// or — commonly — COOKIES_FROM_BROWSER pointed at a browser that's still
// open and locking its cookie database) leaves the request hanging forever,
// which shows up in the UI as the submit button stuck on "Starting…". These
// give up and surface a real error instead. Override via .env if needed.
const INFO_TIMEOUT_MS = Number(process.env.INFO_TIMEOUT_MS) || 30_000; // 30s — just metadata
const DOWNLOAD_TIMEOUT_MS = Number(process.env.DOWNLOAD_TIMEOUT_MS) || 20 * 60_000; // 20min

function friendlyTimeoutError(err, seconds) {
  if (err?.timedOut || /timed out/i.test(err?.message || '')) {
    const cookieHint = process.env.COOKIES_FROM_BROWSER
      ? ` If COOKIES_FROM_BROWSER=${process.env.COOKIES_FROM_BROWSER} is set, make sure that browser is fully closed (yt-dlp needs to read its cookie file, and a running browser can lock it and hang).`
      : '';
    return new Error(`yt-dlp did not respond within ${seconds}s.${cookieHint}`);
  }
  return err;
}

// Allowed quality presets — validated here too (not just in the controller)
// since this is the layer that actually builds the yt-dlp command.
const VIDEO_QUALITIES = ['best', '2160', '1440', '1080', '720', '480', '360'];
const AUDIO_QUALITIES = ['best', '320', '256', '192', '128'];

/**
 * Build the yt-dlp -f/--format selector for a video download.
 * "best" (or anything unrecognized) means no height cap.
 */
function videoFormatSelector(quality) {
  const height = VIDEO_QUALITIES.includes(quality) && quality !== 'best' ? quality : null;
  if (!height) {
    return 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best';
  }
  return (
    `bestvideo[ext=mp4][height<=${height}]+bestaudio[ext=m4a]` +
    `/best[ext=mp4][height<=${height}]/best[height<=${height}]/best`
  );
}

/**
 * Build the yt-dlp --audio-quality value for an MP3 download.
 * "0" = best VBR; a specific bitrate like "192K" pins that bitrate.
 */
function audioQualityValue(quality) {
  if (!AUDIO_QUALITIES.includes(quality) || quality === 'best') {
    return 0;
  }
  return `${quality}K`;
}

/**
 * Fetch metadata for a URL without downloading anything.
 */
async function fetchInfo(url) {
  try {
    const info = await youtubedl(
      url,
      {
        dumpSingleJson: true,
        noWarnings: true,
        noCheckCertificate: true,
        preferFreeFormats: true,
        youtubeSkipDashManifest: true,
        ...authOptions(),
      },
      { timeout: INFO_TIMEOUT_MS }
    );
    return info;
  } catch (err) {
    throw friendlyTimeoutError(err, INFO_TIMEOUT_MS / 1000);
  }
}

/**
 * Download+convert a URL to the requested format inside DOWNLOAD_DIR.
 * Returns the resulting filename (relative to DOWNLOAD_DIR).
 *
 * jobId is used as a unique suffix so concurrent downloads never collide.
 */
async function downloadMedia(url, format, quality, jobId) {
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
          audioQuality: audioQualityValue(quality),
        }
      : {
          ...baseOptions,
          format: videoFormatSelector(quality),
          mergeOutputFormat: 'mp4',
        };

  try {
    await youtubedl(url, options, { timeout: DOWNLOAD_TIMEOUT_MS });
  } catch (err) {
    throw friendlyTimeoutError(err, DOWNLOAD_TIMEOUT_MS / 1000);
  }

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

module.exports = {
  fetchInfo,
  downloadMedia,
  getDownloadDir,
  VIDEO_QUALITIES,
  AUDIO_QUALITIES,
};