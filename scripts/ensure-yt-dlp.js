/**
 * Prebuild script: ensure the correct yt-dlp binary is available.
 * On Linux/serverless (Vercel), we need the compiled binary (yt-dlp_linux),
 * not the Python script, because the serverless runtime doesn't include Python.
 */

const { existsSync, createWriteStream, copyFileSync } = require('fs');
const { mkdir, chmod } = require('fs/promises');
const { join } = require('path');
const { pipeline } = require('stream/promises');

const YOUTUBE_DL_DIR = join(__dirname, '..', 'node_modules', 'youtube-dl-exec', 'bin');
const YOUTUBE_DL_FILE = process.platform === 'linux' ? 'yt-dlp_linux' : 'yt-dlp';
const YOUTUBE_DL_PATH = join(YOUTUBE_DL_DIR, YOUTUBE_DL_FILE);

async function ensureYtDlp() {
  if (existsSync(YOUTUBE_DL_PATH)) {
    console.log(`[prebuild] yt-dlp already exists: ${YOUTUBE_DL_PATH}`);
    return;
  }

  console.log(`[prebuild] Downloading ${YOUTUBE_DL_FILE}...`);

  const releaseUrl = `https://github.com/yt-dlp/yt-dlp/releases/latest/download/${YOUTUBE_DL_FILE}`;

  const response = await fetch(releaseUrl);
  if (!response.ok) {
    throw new Error(`Failed to download ${YOUTUBE_DL_FILE}: ${response.status} ${response.statusText}`);
  }

  await mkdir(YOUTUBE_DL_DIR, { recursive: true });
  await pipeline(response.body, createWriteStream(YOUTUBE_DL_PATH));
  await chmod(YOUTUBE_DL_PATH, 0o755);

  console.log(`[prebuild] Downloaded yt-dlp to ${YOUTUBE_DL_PATH}`);
}

function ensureFfmpeg() {
  // Copy ffmpeg-static binary to a reliable location that survives bundling
  const ffmpegStaticPath = join(__dirname, '..', 'node_modules', 'ffmpeg-static', 'ffmpeg');
  const fallbackPaths = [
    join(__dirname, '..', 'bin', 'ffmpeg'),
    join(process.cwd(), 'bin', 'ffmpeg'),
  ];

  if (!existsSync(ffmpegStaticPath)) {
    console.log('[prebuild] ffmpeg-static not found, skipping');
    return;
  }

  for (const dest of fallbackPaths) {
    try {
      const destDir = join(dest, '..');
      if (!existsSync(destDir)) {
        require('fs').mkdirSync(destDir, { recursive: true });
      }
      copyFileSync(ffmpegStaticPath, dest);
      chmod(dest, 0o755);
      console.log(`[prebuild] Copied ffmpeg to ${dest}`);
      return;
    } catch (err) {
      console.log(`[prebuild] Could not copy ffmpeg to ${dest}: ${err.message}`);
    }
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
