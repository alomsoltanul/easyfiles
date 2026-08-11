/**
 * A minimal but standards-valid sRGB ICC v2 profile, generated at runtime.
 *
 * PDF/A requires every output intent to carry an embedded destination profile.
 * Rather than ship a licensed binary, this builds an RGB matrix/TRC display
 * profile from the published sRGB primaries (Bradford-adapted to the D50 PCS)
 * plus a 1024-point sampling of the sRGB transfer function.
 */

const D50 = { X: 0.9642, Y: 1.0, Z: 0.8249 };

// sRGB primaries adapted to D50 — the same matrix the reference profile uses.
const PRIMARIES = {
  r: { X: 0.4360747, Y: 0.2225045, Z: 0.0139322 },
  g: { X: 0.3850649, Y: 0.7168786, Z: 0.0971045 },
  b: { X: 0.1430804, Y: 0.0606169, Z: 0.7141733 },
};

const TRC_POINTS = 1024;

function s15Fixed16(value: number): number {
  return Math.round(value * 65536);
}

class Writer {
  private bytes: number[] = [];

  get length() {
    return this.bytes.length;
  }

  u8(v: number) { this.bytes.push(v & 0xff); return this; }

  u16(v: number) { this.bytes.push((v >> 8) & 0xff, v & 0xff); return this; }

  u32(v: number) {
    this.bytes.push((v >>> 24) & 0xff, (v >>> 16) & 0xff, (v >>> 8) & 0xff, v & 0xff);
    return this;
  }

  i32(v: number) { return this.u32(v >>> 0); }

  ascii(text: string) {
    for (let i = 0; i < text.length; i++) this.bytes.push(text.charCodeAt(i) & 0xff);
    return this;
  }

  zeros(n: number) {
    for (let i = 0; i < n; i++) this.bytes.push(0);
    return this;
  }

  padTo4() {
    while (this.bytes.length % 4 !== 0) this.bytes.push(0);
    return this;
  }

  toUint8Array() { return new Uint8Array(this.bytes); }
}

function xyzTag(x: number, y: number, z: number): Uint8Array {
  const w = new Writer();
  w.ascii('XYZ ').u32(0);
  w.i32(s15Fixed16(x)).i32(s15Fixed16(y)).i32(s15Fixed16(z));
  return w.toUint8Array();
}

/** IEC 61966-2-1 electro-optical transfer function. */
function srgbToLinear(v: number): number {
  return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
}

function curveTag(): Uint8Array {
  const w = new Writer();
  w.ascii('curv').u32(0).u32(TRC_POINTS);
  for (let i = 0; i < TRC_POINTS; i++) {
    const linear = srgbToLinear(i / (TRC_POINTS - 1));
    w.u16(Math.max(0, Math.min(65535, Math.round(linear * 65535))));
  }
  return w.toUint8Array();
}

function textTag(text: string): Uint8Array {
  const w = new Writer();
  w.ascii('text').u32(0).ascii(text).u8(0);
  return w.toUint8Array();
}

function descTag(text: string): Uint8Array {
  const w = new Writer();
  w.ascii('desc').u32(0);
  w.u32(text.length + 1).ascii(text).u8(0);
  w.u32(0).u32(0);          // Unicode language code + count
  w.u16(0).u8(0).zeros(67); // ScriptCode code, count and 67-byte buffer
  return w.toUint8Array();
}

export function buildSRGBProfile(): Uint8Array {
  const description = 'sRGB IEC61966-2.1';

  const tags: { sig: string; data: Uint8Array }[] = [
    { sig: 'desc', data: descTag(description) },
    { sig: 'wtpt', data: xyzTag(D50.X, D50.Y, D50.Z) },
    { sig: 'rXYZ', data: xyzTag(PRIMARIES.r.X, PRIMARIES.r.Y, PRIMARIES.r.Z) },
    { sig: 'gXYZ', data: xyzTag(PRIMARIES.g.X, PRIMARIES.g.Y, PRIMARIES.g.Z) },
    { sig: 'bXYZ', data: xyzTag(PRIMARIES.b.X, PRIMARIES.b.Y, PRIMARIES.b.Z) },
    { sig: 'rTRC', data: curveTag() },
    { sig: 'cprt', data: textTag('Public Domain') },
  ];

  // The three channels share one curve, which is legal and keeps the file small.
  const layout: { sig: string; offset: number; size: number }[] = [];

  const headerSize = 128;
  const tableSize = 4 + (tags.length + 2) * 12; // + the shared gTRC and bTRC entries
  const bodyStart = headerSize + tableSize;
  let cursor = bodyStart;

  const body = new Writer();
  for (const tag of tags) {
    const padding = (4 - (tag.data.length % 4)) % 4;
    layout.push({ sig: tag.sig, offset: cursor, size: tag.data.length });
    if (tag.sig === 'rTRC') {
      layout.push({ sig: 'gTRC', offset: cursor, size: tag.data.length });
      layout.push({ sig: 'bTRC', offset: cursor, size: tag.data.length });
    }
    for (const byte of tag.data) body.u8(byte);
    body.zeros(padding);
    cursor += tag.data.length + padding;
  }

  const total = cursor;
  const now = new Date();

  const header = new Writer();
  header.u32(total);
  header.ascii('ADBE');            // preferred CMM
  header.u32(0x02100000);          // ICC version 2.1
  header.ascii('mntr');            // display device class
  header.ascii('RGB ');
  header.ascii('XYZ ');
  header.u16(now.getUTCFullYear()).u16(now.getUTCMonth() + 1).u16(now.getUTCDate());
  header.u16(now.getUTCHours()).u16(now.getUTCMinutes()).u16(now.getUTCSeconds());
  header.ascii('acsp');
  header.u32(0);                   // platform
  header.u32(0);                   // flags
  header.u32(0);                   // device manufacturer
  header.u32(0);                   // device model
  header.u32(0).u32(0);            // device attributes
  header.u32(0);                   // rendering intent: perceptual
  header.i32(s15Fixed16(D50.X)).i32(s15Fixed16(D50.Y)).i32(s15Fixed16(D50.Z));
  header.u32(0);                   // profile creator
  header.zeros(16);                // profile id
  header.zeros(28);                // reserved

  const table = new Writer();
  table.u32(layout.length);
  for (const entry of layout) {
    table.ascii(entry.sig).u32(entry.offset).u32(entry.size);
  }
  table.padTo4();

  const out = new Uint8Array(total);
  out.set(header.toUint8Array(), 0);
  out.set(table.toUint8Array(), headerSize);
  out.set(body.toUint8Array(), bodyStart);

  return out;
}

export const SRGB_PROFILE_NAME = 'sRGB IEC61966-2.1';
