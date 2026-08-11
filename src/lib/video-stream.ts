/**
 * Turns a ResolvedDownload into a streaming HTTP Response.
 *
 * - proxy: pipes the CDN response straight through (Range-aware)
 * - merge: muxes a video-only and an audio-only stream with ffmpeg (-c copy)
 * - mp3:   transcodes the best audio stream to MP3 with ffmpeg
 *
 * Everything is fetched in ranged chunks. YouTube throttles a plain unranged
 * GET on its DASH streams to a few hundred KB/s, while the same stream pulled
 * as ~10 MB ranges runs 20x faster, so chunking is what makes HD downloads
 * finish inside the function timeout.
 *
 * Nothing is buffered on the server: bytes flow CDN → (ffmpeg) → browser.
 */

import { spawn } from 'child_process';
import { Readable } from 'stream';
import { contentDisposition } from './video-security';
import { getFfmpegPath, VideoError, type ResolvedDownload } from './video-downloader';

const CHUNK_SIZE = 10 * 1024 * 1024;

interface ChunkedSource {
  stream: ReadableStream<Uint8Array>;
  total?: number;
  contentType?: string;
}

function parseTotal(contentRange: string | null): number | undefined {
  const total = contentRange?.split('/')[1];
  return total && /^\d+$/.test(total) ? Number(total) : undefined;
}

/**
 * Streams `url` by walking it in ranged chunks. Falls back to a single plain
 * response if the server ignores the Range header.
 */
async function openChunked(url: string, headers: Record<string, string>, start = 0): Promise<ChunkedSource> {
  const first = await fetch(url, {
    headers: { ...headers, Range: `bytes=${start}-${start + CHUNK_SIZE - 1}` },
    cache: 'no-store',
  });

  if (!first.ok || !first.body) {
    throw new VideoError(
      'UPSTREAM_FAILED',
      `The source refused the download (HTTP ${first.status}). The link may have expired — fetch the video info again.`,
      502,
    );
  }

  const total =
    parseTotal(first.headers.get('content-range')) ??
    (first.status === 200 ? Number(first.headers.get('content-length')) || undefined : undefined);
  const rangeSupported = first.status === 206;

  let position = start;
  let reader: ReadableStreamDefaultReader<Uint8Array> | null = first.body.getReader();

  const stream = new ReadableStream<Uint8Array>({
    async pull(controller) {
      while (true) {
        if (!reader) {
          if (!rangeSupported || (total !== undefined && position >= total)) {
            controller.close();
            return;
          }
          const next = await fetch(url, {
            headers: { ...headers, Range: `bytes=${position}-${position + CHUNK_SIZE - 1}` },
            cache: 'no-store',
          });
          if (!next.ok || !next.body) {
            if (next.status === 416) {
              controller.close();
              return;
            }
            controller.error(new Error(`Upstream chunk failed with HTTP ${next.status}`));
            return;
          }
          reader = next.body.getReader();
        }

        const { done, value } = await reader.read();
        if (done) {
          reader = null;
          continue;
        }
        position += value.byteLength;
        controller.enqueue(value);
        return;
      }
    },
    cancel(reason) {
      reader?.cancel(reason).catch(() => undefined);
      reader = null;
    },
  });

  return { stream, total, contentType: first.headers.get('content-type') ?? undefined };
}

function baseHeaders(resolved: ResolvedDownload): Record<string, string> {
  return {
    'Content-Type': resolved.mime,
    'Content-Disposition': contentDisposition(resolved.fileName),
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  };
}

async function proxyResponse(resolved: Extract<ResolvedDownload, { mode: 'proxy' }>, range: string | null): Promise<Response> {
  // A ranged request from the browser (resume / seek) is passed straight through.
  if (range) {
    const upstream = await fetch(resolved.url, { headers: { ...resolved.headers, Range: range }, cache: 'no-store' });
    if (!upstream.ok || !upstream.body) {
      throw new VideoError('UPSTREAM_FAILED', `The source refused the download (HTTP ${upstream.status}).`, 502);
    }
    const headers = baseHeaders(resolved);
    const contentLength = upstream.headers.get('content-length');
    if (contentLength) headers['Content-Length'] = contentLength;
    const contentRange = upstream.headers.get('content-range');
    if (contentRange) headers['Content-Range'] = contentRange;
    headers['Accept-Ranges'] = 'bytes';
    return new Response(upstream.body, { status: upstream.status === 206 ? 206 : 200, headers });
  }

  const source = await openChunked(resolved.url, resolved.headers);
  const headers = baseHeaders(resolved);
  if (source.total) headers['Content-Length'] = String(source.total);
  headers['Accept-Ranges'] = 'bytes';

  return new Response(source.stream, { status: 200, headers });
}

/**
 * Runs ffmpeg with inputs fed through extra pipes (fd 3, fd 4) so the HTTP
 * fetching stays in Node, where ranged chunking is under our control.
 */
function ffmpegResponse(
  resolved: ResolvedDownload,
  args: string[],
  inputs: ReadableStream<Uint8Array>[],
  signal: AbortSignal | undefined,
): Response {
  const ffmpegPath = getFfmpegPath();
  if (!ffmpegPath) {
    throw new VideoError('FFMPEG_MISSING', 'This conversion needs ffmpeg, which is not available on this server.', 503);
  }

  const stdio: ('ignore' | 'pipe')[] = ['ignore', 'pipe', 'pipe', ...inputs.map(() => 'pipe' as const)];
  const child = spawn(ffmpegPath, args, { stdio });
  let stderrTail = '';

  child.stderr?.on('data', (chunk: Buffer) => {
    stderrTail = (stderrTail + chunk.toString()).slice(-2000);
  });

  // fd 3 and up carry the media inputs
  inputs.forEach((input, index) => {
    const target = child.stdio[3 + index] as NodeJS.WritableStream | null;
    if (!target) return;
    const source = Readable.fromWeb(input as Parameters<typeof Readable.fromWeb>[0]);
    source.on('error', () => child.kill('SIGKILL'));
    target.on('error', () => {
      // ffmpeg closed this input (normal once it has what it needs)
      source.destroy();
    });
    source.pipe(target);
  });

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;
      const finish = (error?: Error) => {
        if (closed) return;
        closed = true;
        if (error) controller.error(error);
        else controller.close();
      };

      child.stdout?.on('data', (chunk: Buffer) => {
        controller.enqueue(new Uint8Array(chunk));
      });
      child.on('error', (error) => finish(error as Error));
      child.on('close', (code) => {
        if (code === 0) finish();
        else finish(new Error(`ffmpeg exited with code ${code}: ${stderrTail.split('\n').slice(-3).join(' ')}`));
      });

      signal?.addEventListener('abort', () => {
        child.kill('SIGKILL');
        finish();
      });
    },
    cancel() {
      child.kill('SIGKILL');
    },
  });

  return new Response(stream, { status: 200, headers: baseHeaders(resolved) });
}

export async function streamDownload(resolved: ResolvedDownload, request: Request): Promise<Response> {
  if (resolved.mode === 'proxy') {
    return proxyResponse(resolved, request.headers.get('range'));
  }

  if (resolved.mode === 'merge') {
    const [video, audio] = await Promise.all([
      openChunked(resolved.videoUrl, resolved.headers),
      openChunked(resolved.audioUrl, resolved.headers),
    ]);

    const args = [
      '-hide_banner',
      '-loglevel', 'error',
      '-nostdin',
      '-i', 'pipe:3',
      '-i', 'pipe:4',
      '-map', '0:v:0',
      '-map', '1:a:0',
      '-c:v', 'copy',
      '-c:a', resolved.copyAudio ? 'copy' : 'aac',
      ...(resolved.copyAudio ? [] : ['-b:a', '192k']),
      // Fragmented MP4: writable without seeking back to patch the header
      '-movflags', 'frag_keyframe+empty_moov+default_base_moof',
      '-f', 'mp4',
      'pipe:1',
    ];

    return ffmpegResponse(resolved, args, [video.stream, audio.stream], request.signal);
  }

  const audio = await openChunked(resolved.url, resolved.headers);
  const args = [
    '-hide_banner',
    '-loglevel', 'error',
    '-nostdin',
    '-i', 'pipe:3',
    '-vn',
    '-c:a', 'libmp3lame',
    '-q:a', '2',
    '-f', 'mp3',
    'pipe:1',
  ];

  return ffmpegResponse(resolved, args, [audio.stream], request.signal);
}
