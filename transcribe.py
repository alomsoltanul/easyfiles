#!/usr/bin/env python3
"""
Video-to-MP3 + English Transcription Script
============================================
A standalone Python script that:
1. Downloads a video (or accepts a local file)
2. Extracts audio to MP3
3. Transcribes English speech to text using OpenAI Whisper
4. Saves both the MP3 and a .txt transcript

REQUIREMENTS:
    pip install openai-whisper yt-dlp

    You also need FFmpeg installed on your system:
    - macOS:   brew install ffmpeg
    - Ubuntu:  sudo apt install ffmpeg
    - Windows: https://ffmpeg.org/download.html

USAGE:
    python transcribe.py "https://www.youtube.com/watch?v=..."
    python transcribe.py "./my-video.mp4"

The script will create:
    ./transcribe_output/
        ├── audio.mp3
        └── transcript.txt
"""

import argparse
import os
import re
import subprocess
import sys
from pathlib import Path
from urllib.parse import urlparse

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
OUTPUT_DIR = Path("transcribe_output")
WHISPER_MODEL = "base"          # Options: tiny, base, small, medium, large
WHISPER_LANGUAGE = "en"       # English
MP3_BITRATE = "192k"

# ---------------------------------------------------------------------------
# Security helpers (basic – this is a local one-time script)
# ---------------------------------------------------------------------------
ALLOWED_HOSTS = {
    "youtube.com", "www.youtube.com", "youtu.be", "m.youtube.com",
    "music.youtube.com",
    "facebook.com", "www.facebook.com", "fb.watch", "m.facebook.com",
    "instagram.com", "www.instagram.com",
    "twitter.com", "www.twitter.com", "mobile.twitter.com",
    "x.com", "www.x.com", "mobile.x.com",
}


def is_allowed_url(url: str) -> bool:
    """Basic allowlist to prevent accidental misuse."""
    try:
        parsed = urlparse(url.strip())
        if parsed.scheme not in ("http", "https"):
            return False
        hostname = parsed.hostname.lower() if parsed.hostname else ""
        # Reject IPs
        if re.match(r"^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$", hostname):
            return False
        # Check allowed hosts
        if hostname not in ALLOWED_HOSTS:
            return False
        return True
    except Exception:
        return False


def sanitize_filename(name: str) -> str:
    """Remove dangerous characters from a filename."""
    name = re.sub(r'[<>:|*?"\\/\x00-\x1f]', "_", name)
    name = name.strip("._")
    return name[:100] or "audio"


# ---------------------------------------------------------------------------
# Step 1: Download / extract audio to MP3
# ---------------------------------------------------------------------------
def extract_audio_to_mp3(source: str, output_mp3: Path) -> None:
    """
    If *source* is a URL → download best audio via yt-dlp and convert to MP3.
    If *source* is a local file → extract audio via ffmpeg.
    """
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    if source.startswith("http://") or source.startswith("https://"):
        print("[1/3] Downloading audio via yt-dlp ...")
        if not is_allowed_url(source):
            print("ERROR: URL is not in the allowed list.", file=sys.stderr)
            print("Allowed platforms: YouTube, Facebook, Instagram, X", file=sys.stderr)
            sys.exit(1)

        cmd = [
            sys.executable, "-m", "yt_dlp",
            "--no-warnings",
            "--no-call-home",
            "--extract-audio",
            "--audio-format", "mp3",
            "--audio-quality", MP3_BITRATE,
            "--ffmpeg-location", "ffmpeg",
            "--output", str(output_mp3.with_suffix(".%(ext)s")),
            source,
        ]
    else:
        local_path = Path(source)
        if not local_path.exists():
            print(f"ERROR: File not found: {source}", file=sys.stderr)
            sys.exit(1)
        print("[1/3] Extracting audio via ffmpeg ...")
        cmd = [
            "ffmpeg",
            "-y",                       # overwrite
            "-i", str(local_path),     # input
            "-vn",                     # no video
            "-ar", "44100",            # sample rate
            "-ac", "2",                # stereo
            "-b:a", MP3_BITRATE,
            "-f", "mp3",
            str(output_mp3),
        ]

    result = subprocess.run(cmd, capture_output=True, text=True)

    if result.returncode != 0:
        print("ERROR: Audio extraction failed.", file=sys.stderr)
        print(result.stderr, file=sys.stderr)
        sys.exit(1)

    # yt-dlp may rename the file with the video title; find the real MP3
    if source.startswith("http") and not output_mp3.exists():
        candidates = list(OUTPUT_DIR.glob("*.mp3"))
        if candidates:
            # rename the newest mp3 to our target name
            newest = max(candidates, key=lambda p: p.stat().st_mtime)
            newest.rename(output_mp3)

    if not output_mp3.exists():
        print("ERROR: MP3 was not created.", file=sys.stderr)
        sys.exit(1)

    size_mb = output_mp3.stat().st_size / (1024 * 1024)
    print(f"        → MP3 saved: {output_mp3} ({size_mb:.1f} MB)")


# ---------------------------------------------------------------------------
# Step 2: Transcribe with Whisper
# ---------------------------------------------------------------------------
def transcribe_audio(audio_path: Path, transcript_path: Path, model_name: str = WHISPER_MODEL) -> None:
    """Run OpenAI Whisper locally and save the transcript."""
    print(f"[2/3] Loading Whisper model ('{model_name}') ...")
    try:
        import whisper
    except ImportError:
        print("ERROR: 'openai-whisper' is not installed.", file=sys.stderr)
        print("Run: pip install openai-whisper", file=sys.stderr)
        sys.exit(1)

    model = whisper.load_model(model_name)

    print("[3/3] Transcribing audio (this may take a while) ...")
    result = model.transcribe(
        str(audio_path),
        language=WHISPER_LANGUAGE,
        fp16=False,                 # safer for CPU-only machines
    )

    text = result.get("text", "").strip()
    segments = result.get("segments", [])

    # Build a nicely formatted transcript with timestamps
    lines = []
    lines.append("=" * 60)
    lines.append("TRANSCRIPTION")
    lines.append(f"Model: Whisper ({model_name})")
    lines.append(f"Language: {WHISPER_LANGUAGE}")
    lines.append(f"Source:  {audio_path}")
    lines.append("=" * 60)
    lines.append("")

    for seg in segments:
        start = seg.get("start", 0)
        end = seg.get("end", 0)
        seg_text = seg.get("text", "").strip()
        if seg_text:
            lines.append(f"[{format_time(start)} -> {format_time(end)}] {seg_text}")

    lines.append("")
    lines.append("=" * 60)
    lines.append("FULL TEXT (no timestamps)")
    lines.append("=" * 60)
    lines.append("")
    lines.append(text)
    lines.append("")

    transcript_content = "\n".join(lines)
    transcript_path.write_text(transcript_content, encoding="utf-8")

    print(f"        → Transcript saved: {transcript_path}")
    print(f"        → Detected language: {result.get('language', 'unknown')}")
    print(f"        → Total segments: {len(segments)}")
    print(f"        → Total duration: {format_time(segments[-1]['end']) if segments else 'N/A'}")


def format_time(seconds: float) -> str:
    """Convert seconds to MM:SS or HH:MM:SS."""
    seconds = int(seconds)
    h, rem = divmod(seconds, 3600)
    m, s = divmod(rem, 60)
    if h:
        return f"{h:02d}:{m:02d}:{s:02d}"
    return f"{m:02d}:{s:02d}"


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
def main():
    parser = argparse.ArgumentParser(
        description="Download a video, extract MP3 audio, and transcribe English speech to text."
    )
    parser.add_argument("source", help="Video URL (YouTube, FB, IG, X) or local file path")
    parser.add_argument(
        "--model",
        default=WHISPER_MODEL,
        choices=["tiny", "base", "small", "medium", "large"],
        help="Whisper model size (default: base)",
    )
    parser.add_argument(
        "--output-dir",
        default=str(OUTPUT_DIR),
        help="Output directory (default: ./transcribe_output)",
    )
    args = parser.parse_args()

    output_dir = Path(args.output_dir)
    model_name = args.model

    mp3_path = output_dir / "audio.mp3"
    transcript_path = output_dir / "transcript.txt"

    print("=" * 60)
    print("VIDEO → MP3 + ENGLISH TRANSCRIPTION")
    print("=" * 60)
    print(f"Source:      {args.source}")
    print(f"Output dir:  {output_dir.resolve()}")
    print(f"Whisper:     {model_name} model")
    print("=" * 60)
    print()

    extract_audio_to_mp3(args.source, mp3_path)
    print()
    transcribe_audio(mp3_path, transcript_path, model_name)

    print()
    print("=" * 60)
    print("DONE!")
    print(f"  MP3:        {mp3_path.resolve()}")
    print(f"  Transcript: {transcript_path.resolve()}")
    print("=" * 60)


if __name__ == "__main__":
    main()
