# Personal Media Downloader (MERN)

A small MERN-stack app for saving video (MP4) or audio (MP3) from links to your
own machine, using [yt-dlp](https://github.com/yt-dlp/yt-dlp) under the hood.

## Stack

- **M**ongoDB — stores download history/status
- **E**xpress — REST API, kicks off yt-dlp jobs in the background
- **R**eact (Vite) — form + history UI, polls for job status
- **N**ode.js — runs it all

## Prerequisites

Install these on your machine before running the app:

1. **Node.js** npm
2. **MongoDB** running locally (`mongod`) or a connection string to any Mongo instance
3. **yt-dlp** — the actual download/convert engine. Install it and make sure it's
   on your `PATH`:
   - macOS: `brew install yt-dlp`
   - Windows: `winget install yt-dlp` (or download the binary from the yt-dlp releases page)
   - Linux: `pip install -U yt-dlp` or your distro's package manager
4. **ffmpeg** — required for MP3 extraction and MP4 muxing:
   - macOS: `brew install ffmpeg`
   - Windows: `winget install ffmpeg`
   - Linux: `apt install ffmpeg` (or equivalent)

Verify both are installed:

```bash
yt-dlp --version
ffmpeg -version
```

## Setup

### 1. Backend

The backend calls your system-installed `yt-dlp` directly (see Prerequisites
above) — it doesn't download its own copy — so install `yt-dlp`/`ffmpeg`
*before* running `npm install` here, and set the `YOUTUBE_DL_SKIP_DOWNLOAD`
env var so the `youtube-dl-exec` package's postinstall script doesn't try to
fetch a redundant binary from GitHub (that download is a common source of
`ECONNRESET`/network errors on `npm install`, especially on flaky or
proxied connections):

```bash
cd backend
cp .env.example .env      # adjust MONGO_URI / PORT if needed

# macOS/Linux:
YOUTUBE_DL_SKIP_DOWNLOAD=true npm install

# Windows PowerShell:
$env:YOUTUBE_DL_SKIP_DOWNLOAD="true"; npm install

# Windows cmd.exe:
set YOUTUBE_DL_SKIP_DOWNLOAD=true && npm install

npm run dev                # or: npm start
```

If `yt-dlp` isn't on your `PATH`, set `YTDLP_PATH` in `.env` to its full
path instead (e.g. `C:\tools\yt-dlp.exe`).

The API starts on `http://localhost:5000`. Downloaded files are written to
`backend/downloads/` (gitignored).

### 2. Frontend

In a second terminal:

```bash
cd frontend
cp .env.example .env      # points at the backend API
npm install
npm run dev
```

Open the URL Vite prints (default `http://localhost:5173`).

## How it works

1. You paste a link and pick **MP4** or **MP3** and submit.
2. The backend looks up metadata (title, thumbnail, duration) with yt-dlp,
   creates a `Download` record in MongoDB with status `pending`, and responds
   immediately.
3. In the background, yt-dlp downloads and (for MP3) extracts audio via
   ffmpeg. The record's status moves to `processing`, then `completed` or
   `failed`.
4. The frontend polls every 2 seconds while any job is active and updates the
   history list. Once a job is `completed`, a **Save file** link streams the
   file from the server to your browser's downloads folder.
5. **Remove** deletes both the DB record and the file on disk.

## API reference

| Method | Route                  | Description                              |
| ------ | ----------------------- | ----------------------------------------- |
| POST   | `/api/downloads`        | Body `{ url, format }` — queues a job     |
| GET    | `/api/downloads`        | List recent jobs (newest first)           |
| GET    | `/api/downloads/:id`    | Get one job's current status              |
| GET    | `/api/downloads/:id/file` | Stream the finished file for download   |
| DELETE | `/api/downloads/:id`    | Delete the record and its file            |

## Notes / things to try next

- Add a max-concurrency queue (e.g. `p-queue`) if you plan to run several jobs at once.
- Add a quality/resolution picker by exposing yt-dlp's `-f` format list per URL.
- Swap polling for a WebSocket/Server-Sent-Events progress stream for a nicer UX.
- Add authentication if more than one person on your network will use this.
