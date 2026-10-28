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
import { getFfmpegPath, VideoError, waitUntilAvailable, type ResolvedDownload } from './video-downloader';

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

async function fetchChunkWithRetry(
  url: string,
  headers: Record<string, string>,
  rangeHeader: string,
): Promise<Response> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await fetch(url, {
        headers: { ...headers, Range: rangeHeader },
        cache: 'no-store',
      });
      if (response.status < 500 || attempt === 1) {
        return response;
      }
      await response.arrayBuffer().catch(() => undefined);
    } catch (err) {
      lastError = err;
      if (attempt === 1) throw err;
    }
  }
  throw lastError ?? new Error('Chunk fetch failed');
}

/**
 * Streams `url` by walking it in ranged chunks. Falls back to a single plain
 * response if the server ignores the Range header.
 */
async function openChunked(url: string, headers: Record<string, string>, start = 0): Promise<ChunkedSource> {
  const first = await fetchChunkWithRetry(url, headers, `bytes=${start}-${start + CHUNK_SIZE - 1}`);

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
          const next = await fetchChunkWithRetry(url, headers, `bytes=${position}-${position + CHUNK_SIZE - 1}`);
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

function ffmpegHeaderArg(headers: Record<string, string>): string {
  return Object.entries(headers)
    .filter(([key, value]) => key && value && !/[\r\n]/.test(value))
    .map(([key, value]) => `${key}: ${value}\r\n`)
    .join('');
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
  const sources: Readable[] = [];

  child.stderr?.on('data', (chunk: Buffer) => {
    stderrTail = (stderrTail + chunk.toString()).slice(-2000);
  });

  // fd 3 and up carry the media inputs
  inputs.forEach((input, index) => {
    const target = child.stdio[3 + index] as NodeJS.WritableStream | null;
    if (!target) return;
    const source = Readable.fromWeb(input as Parameters<typeof Readable.fromWeb>[0]);
    sources.push(source);
    source.on('error', () => child.kill('SIGKILL'));
    target.on('error', () => {
      // ffmpeg closed this input (normal once it has what it needs)
      source.destroy();
    });
    source.pipe(target);
  });

  const cleanupInputs = () => {
    for (const source of sources) {
      if (!source.destroyed) source.destroy();
    }
  };

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;
      const finish = (error?: Error) => {
        if (closed) return;
        closed = true;
        cleanupInputs();
        if (error) controller.error(error);
        else controller.close();
      };

      child.stdout?.on('data', (chunk: Buffer) => {
        if (closed) return;
        controller.enqueue(new Uint8Array(chunk));
        if ((controller.desiredSize ?? 1) <= 0) {
          child.stdout?.pause();
        }
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
    pull() {
      child.stdout?.resume();
    },
    cancel() {
      cleanupInputs();
      child.kill('SIGKILL');
    },
  });

  return new Response(stream, { status: 200, headers: baseHeaders(resolved) });
}

export async function streamDownload(resolved: ResolvedDownload, request: Request): Promise<Response> {
  await waitUntilAvailable(resolved.availableAt, request.signal);
  if (request.signal?.aborted) {
    throw new VideoError('ABORTED', 'Download cancelled.', 499);
  }

  if (resolved.mode === 'proxy') {
    return proxyResponse(resolved, request.headers.get('range'));
  }

  if (resolved.mode === 'merge') {
    const pipeInputs: ReadableStream<Uint8Array>[] = [];
    const inputArgs: string[] = [];

    if (resolved.videoIsHls) {
      const hdr = ffmpegHeaderArg(resolved.videoHeaders);
      if (hdr) inputArgs.push('-headers', hdr);
      inputArgs.push('-i', resolved.videoUrl);
    } else {
      const video = await openChunked(resolved.videoUrl, resolved.videoHeaders);
      const fd = 3 + pipeInputs.length;
      pipeInputs.push(video.stream);
      inputArgs.push('-i', `pipe:${fd}`);
    }

    if (resolved.audioUrl) {
      const audioHeaders = resolved.audioHeaders ?? resolved.videoHeaders;
      if (resolved.audioIsHls) {
        const hdr = ffmpegHeaderArg(audioHeaders);
        if (hdr) inputArgs.push('-headers', hdr);
        inputArgs.push('-i', resolved.audioUrl);
      } else {
        const audio = await openChunked(resolved.audioUrl, audioHeaders);
        const fd = 3 + pipeInputs.length;
        pipeInputs.push(audio.stream);
        inputArgs.push('-i', `pipe:${fd}`);
      }

      const args = [
        '-hide_banner',
        '-loglevel', 'error',
        '-nostdin',
        ...inputArgs,
        '-map', '0:v:0',
        '-map', '1:a:0',
        '-c:v', resolved.transcodeVideo ? 'libx264' : 'copy',
        ...(resolved.transcodeVideo ? ['-preset', 'ultrafast', '-crf', '23'] : []),
        '-c:a', resolved.copyAudio ? 'copy' : 'aac',
        ...(resolved.copyAudio ? [] : ['-b:a', '192k']),
        // Fragmented MP4: writable without seeking back to patch the header
        '-movflags', 'frag_keyframe+empty_moov+default_base_moof',
        '-f', 'mp4',
        'pipe:1',
      ];

      return ffmpegResponse(resolved, args, pipeInputs, request.signal);
    }

    // Single input transcode / remux (e.g. HLS progressive or VP9/AV1 progressive to H.264)
    const args = [
      '-hide_banner',
      '-loglevel', 'error',
      '-nostdin',
      ...inputArgs,
      '-map', '0:v:0',
      '-map', '0:a:0?',
      '-c:v', resolved.transcodeVideo ? 'libx264' : 'copy',
      ...(resolved.transcodeVideo ? ['-preset', 'ultrafast', '-crf', '23'] : []),
      '-c:a', resolved.copyAudio ? 'copy' : 'aac',
      ...(resolved.copyAudio ? [] : ['-b:a', '192k']),
      '-movflags', 'frag_keyframe+empty_moov+default_base_moof',
      '-f', 'mp4',
      'pipe:1',
    ];

    return ffmpegResponse(resolved, args, pipeInputs, request.signal);
  }

  const pipeInputs: ReadableStream<Uint8Array>[] = [];
  const inputArgs: string[] = [];
  if (resolved.isHls) {
    const hdr = ffmpegHeaderArg(resolved.headers);
    if (hdr) inputArgs.push('-headers', hdr);
    inputArgs.push('-i', resolved.url);
  } else {
    const audio = await openChunked(resolved.url, resolved.headers);
    pipeInputs.push(audio.stream);
    inputArgs.push('-i', 'pipe:3');
  }

  const args = [
    '-hide_banner',
    '-loglevel', 'error',
    '-nostdin',
    ...inputArgs,
    '-vn',
    '-c:a', 'libmp3lame',
    '-q:a', '2',
    '-f', 'mp3',
    'pipe:1',
  ];

  return ffmpegResponse(resolved, args, pipeInputs, request.signal);
}
