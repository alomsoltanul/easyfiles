/**
 * Prebuild script: ensure the correct yt-dlp and ffmpeg binaries are available.
 *
 * On Linux/serverless (Vercel) we need the compiled yt-dlp binary (yt-dlp_linux),
 * not the Python script, because the serverless runtime has no Python.
 *
 * yt-dlp is also re-downloaded when the cached copy is stale: the extractors
 * break every few weeks when YouTube changes, so an old binary means broken
 * downloads in production.
 */

const { existsSync, createWriteStream, copyFileSync, statSync, mkdirSync } = require('fs');
const { mkdir, chmod } = require('fs/promises');
const { join } = require('path');
const { pipeline } = require('stream/promises');

const YOUTUBE_DL_DIR = join(__dirname, '..', 'node_modules', 'youtube-dl-exec', 'bin');
const YOUTUBE_DL_FILE = process.platform === 'linux' ? 'yt-dlp_linux' : 'yt-dlp';
const YOUTUBE_DL_PATH = join(YOUTUBE_DL_DIR, YOUTUBE_DL_FILE);
const MAX_BINARY_AGE_MS = 14 * 24 * 60 * 60 * 1000; // 14 days

function isFresh(path) {
  try {
    const age = Date.now() - statSync(path).mtimeMs;
    return age < MAX_BINARY_AGE_MS;
  } catch {
    return false;
  }
}

async function ensureYtDlp() {
  if (existsSync(YOUTUBE_DL_PATH) && isFresh(YOUTUBE_DL_PATH)) {
    console.log(`[prebuild] yt-dlp is present and recent: ${YOUTUBE_DL_PATH}`);
    return;
  }

  console.log(`[prebuild] Downloading latest ${YOUTUBE_DL_FILE}...`);
  const releaseUrl = `https://github.com/yt-dlp/yt-dlp/releases/latest/download/${YOUTUBE_DL_FILE}`;

  try {
    const response = await fetch(releaseUrl);
    if (!response.ok) {
      throw new Error(`${response.status} ${response.statusText}`);
    }

    await mkdir(YOUTUBE_DL_DIR, { recursive: true });
    await pipeline(response.body, createWriteStream(YOUTUBE_DL_PATH));
    await chmod(YOUTUBE_DL_PATH, 0o755);
    console.log(`[prebuild] Downloaded yt-dlp to ${YOUTUBE_DL_PATH}`);
  } catch (error) {
    if (existsSync(YOUTUBE_DL_PATH)) {
      // Keep building with the stale binary rather than failing the deploy
      console.warn(`[prebuild] Could not refresh yt-dlp (${error.message}); using existing binary`);
      return;
    }
    throw error;
  }
}

function ensureFfmpeg() {
  // Copy the ffmpeg-static binary to a stable path that survives bundling.
  const ffmpegStaticPath = join(__dirname, '..', 'node_modules', 'ffmpeg-static', 'ffmpeg');
  const dest = join(__dirname, '..', 'bin', 'ffmpeg');

  if (!existsSync(ffmpegStaticPath)) {
    console.log('[prebuild] ffmpeg-static not found, skipping');
    return;
  }

  try {
    mkdirSync(join(dest, '..'), { recursive: true });
    copyFileSync(ffmpegStaticPath, dest);
    chmod(dest, 0o755);
    console.log(`[prebuild] Copied ffmpeg to ${dest}`);
  } catch (err) {
    console.log(`[prebuild] Could not copy ffmpeg to ${dest}: ${err.message}`);
  }
}

async function main() {
  await ensureYtDlp();
  ensureFfmpeg();
}

main().catch((err) => {
  console.error('[prebuild] Error:', err.message);
  process.exit(1);
});
