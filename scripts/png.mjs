// A minimal 8-bit RGBA PNG reader/writer, enough to crop and downscale the
// IMPACT source icons without pulling an image library into the repo.
//
// It exists because the two things the sticker build needs are exactly the two
// things `sips` will not do: crop to a shape's own alpha bounding box (sips
// crops to a rectangle you name, centred), and downsample with alpha handled
// as premultiplied (sips fringes a die-cut sticker's white rim). Everything
// here is Node's own zlib plus arithmetic.
//
// Scope on purpose: bit depth 8, no interlace, colour type 6 (RGBA) or 3
// (palette + tRNS). The Canva export is all type 6; type 3 is what everything
// in `client/public` already is, including this file's own output, so reading
// it back is how you compare a shipped asset against its source. `decode`
// throws rather than guessing on anything else.

import fs from 'node:fs';
import zlib from 'node:zlib';

const SIG = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

// Paeth, spelled out rather than imported, because the unfilter loop below is
// the hot path and the whole decoder is one screen.
function paeth(a, b, c) {
  const pa = Math.abs(b - c), pb = Math.abs(a - c), pc = Math.abs(a + b - 2 * c);
  return (pa <= pb && pa <= pc) ? a : (pb <= pc ? b : c);
}

export function decode(file) {
  const buf = fs.readFileSync(file);
  if (!buf.subarray(0, 8).equals(SIG)) throw new Error(`${file}: not a PNG`);

  let p = 8, width = 0, height = 0, depth = 0, ctype = 0, interlace = 0;
  const idat = [];
  let plte = null, trns = null;
  while (p < buf.length) {
    const len = buf.readUInt32BE(p);
    const type = buf.toString('ascii', p + 4, p + 8);
    const data = buf.subarray(p + 8, p + 8 + len);
    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      depth = data[8];
      ctype = data[9];
      interlace = data[12];
    } else if (type === 'PLTE') plte = data;
    else if (type === 'tRNS') trns = data;
    else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
    p += 12 + len;
  }
  if (depth !== 8 || interlace !== 0 || (ctype !== 6 && ctype !== 3)) {
    throw new Error(`${file}: expected 8-bit RGBA or palette, non-interlaced, got depth ${depth} type ${ctype} interlace ${interlace}`);
  }
  if (ctype === 3 && !plte) throw new Error(`${file}: palette image with no PLTE`);

  // Palette rows are one byte per pixel, so both the stride and the filter's
  // "pixel to the left" distance change. Unfilter in the file's own units,
  // then expand to RGBA once.
  const bpp = ctype === 6 ? 4 : 1;
  const stride = width * bpp;
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const rows = Buffer.alloc(height * stride);
  let q = 0;
  for (let y = 0; y < height; y++) {
    const filter = raw[q++];
    const line = raw.subarray(q, q + stride);
    q += stride;
    const cur = rows.subarray(y * stride, (y + 1) * stride);
    const prev = y ? rows.subarray((y - 1) * stride, y * stride) : null;
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? cur[x - bpp] : 0;
      const b = prev ? prev[x] : 0;
      const c = prev && x >= bpp ? prev[x - bpp] : 0;
      let v = line[x];
      if (filter === 1) v += a;
      else if (filter === 2) v += b;
      else if (filter === 3) v += (a + b) >> 1;
      else if (filter === 4) v += paeth(a, b, c);
      cur[x] = v & 255;
    }
  }

  if (ctype === 6) return { width, height, px: rows };

  // tRNS is allowed to be shorter than the palette; entries past its end are
  // fully opaque.
  const px = Buffer.alloc(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    const idx = rows[i];
    px[i * 4] = plte[idx * 3];
    px[i * 4 + 1] = plte[idx * 3 + 1];
    px[i * 4 + 2] = plte[idx * 3 + 2];
    px[i * 4 + 3] = trns && idx < trns.length ? trns[idx] : 255;
  }
  return { width, height, px };
}

// The tightest rectangle holding anything visible. `threshold` ignores the
// near-transparent pixels an antialiased edge leaves behind, which otherwise
// pad every icon by a few pixels of nothing.
export function alphaBounds({ width, height, px }, threshold = 8) {
  let x0 = width, y0 = height, x1 = -1, y1 = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (px[(y * width + x) * 4 + 3] > threshold) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  if (x1 < 0) return { x: 0, y: 0, width, height };
  return { x: x0, y: y0, width: x1 - x0 + 1, height: y1 - y0 + 1 };
}

export function crop(img, box) {
  const px = Buffer.alloc(box.width * box.height * 4);
  for (let y = 0; y < box.height; y++) {
    const from = ((y + box.y) * img.width + box.x) * 4;
    img.px.copy(px, y * box.width * 4, from, from + box.width * 4);
  }
  return { width: box.width, height: box.height, px };
}

// Box-filter downscale on PREMULTIPLIED alpha, then un-premultiply.
//
// Averaging straight RGBA is the classic way to fringe a die-cut sticker: the
// fully transparent pixels outside the white rim still carry a colour, and
// mixing them into an edge pixel drags a dark halo around the whole shape.
// Premultiplying first weights each pixel's colour by how present it is, which
// is the only correct way to average a partially transparent edge.
export function resize(img, targetMax) {
  const scale = targetMax / Math.max(img.width, img.height);
  if (scale >= 1) return img;
  const width = Math.max(1, Math.round(img.width * scale));
  const height = Math.max(1, Math.round(img.height * scale));
  const px = Buffer.alloc(width * height * 4);

  for (let y = 0; y < height; y++) {
    const sy0 = Math.floor((y * img.height) / height);
    const sy1 = Math.max(sy0 + 1, Math.floor(((y + 1) * img.height) / height));
    for (let x = 0; x < width; x++) {
      const sx0 = Math.floor((x * img.width) / width);
      const sx1 = Math.max(sx0 + 1, Math.floor(((x + 1) * img.width) / width));
      let r = 0, g = 0, b = 0, a = 0, n = 0;
      for (let sy = sy0; sy < sy1; sy++) {
        for (let sx = sx0; sx < sx1; sx++) {
          const i = (sy * img.width + sx) * 4;
          const al = img.px[i + 3] / 255;
          r += img.px[i] * al;
          g += img.px[i + 1] * al;
          b += img.px[i + 2] * al;
          a += img.px[i + 3];
          n++;
        }
      }
      const alpha = a / n;
      const o = (y * width + x) * 4;
      if (alpha > 0) {
        const k = 255 / alpha;
        px[o] = Math.min(255, Math.round((r / n) * k));
        px[o + 1] = Math.min(255, Math.round((g / n) * k));
        px[o + 2] = Math.min(255, Math.round((b / n) * k));
      }
      px[o + 3] = Math.round(alpha);
    }
  }
  return { width, height, px };
}

// Median-cut colour quantisation to a 256-entry RGBA palette.
//
// Every image already in `client/public` is a palette PNG (colour type 3 with
// a tRNS alpha table) — that is why the belt stickers are 8KB and a truecolour
// copy of the same art is 32KB. This is what puts the new set on the same
// footing rather than shipping 218 files four times heavier than the 35 they
// replace.
//
// Alpha is quantised as a fourth axis rather than thresholded, because these
// are die-cut stickers: the whole shape is an antialiased rim, and a hard
// alpha cut leaves a jagged white edge on every one of them. Boxes are split
// on the widest axis with alpha weighted double, so a semi-transparent edge
// never shares a palette entry with an opaque interior.
const ALPHA_WEIGHT = 2;

export function quantize({ width, height, px }, maxColors = 256) {
  const counts = new Map();
  for (let i = 0; i < width * height; i++) {
    const o = i * 4;
    const a = px[o + 3];
    // Fully transparent pixels keep a colour in the source that nothing will
    // ever see. Collapsing them to one key stops dozens of invisible variants
    // eating palette entries that the visible art needs.
    const r = a === 0 ? 0 : px[o];
    const g = a === 0 ? 0 : px[o + 1];
    const b = a === 0 ? 0 : px[o + 2];
    const key = ((r << 24) | (g << 16) | (b << 8) | a) >>> 0;
    counts.set(key, (counts.get(key) || 0) + 1);
  }

  const colors = [];
  for (const [key, n] of counts) {
    colors.push({ r: (key >>> 24) & 255, g: (key >>> 16) & 255, b: (key >>> 8) & 255, a: key & 255, n });
  }

  const axes = ['r', 'g', 'b', 'a'];
  const spread = (box) => {
    let best = 0, axis = 'r';
    for (const k of axes) {
      let lo = 255, hi = 0;
      for (const c of box) { if (c[k] < lo) lo = c[k]; if (c[k] > hi) hi = c[k]; }
      const range = (hi - lo) * (k === 'a' ? ALPHA_WEIGHT : 1);
      if (range > best) { best = range; axis = k; }
    }
    return { range: best, axis };
  };

  let boxes = [colors];
  while (boxes.length < maxColors) {
    // Split the box that is both wide and populous: range alone chases a
    // handful of outlier pixels, population alone never fixes a gradient.
    let pick = -1, score = 0, axis = 'r';
    for (let i = 0; i < boxes.length; i++) {
      if (boxes[i].length < 2) continue;
      const s = spread(boxes[i]);
      const weight = s.range * Math.log2(1 + boxes[i].reduce((sum, c) => sum + c.n, 0));
      if (weight > score) { score = weight; pick = i; axis = s.axis; }
    }
    if (pick < 0) break;

    const box = boxes[pick].slice().sort((x, y) => x[axis] - y[axis]);
    const total = box.reduce((sum, c) => sum + c.n, 0);
    let acc = 0, cut = 1;
    for (let i = 0; i < box.length - 1; i++) {
      acc += box[i].n;
      if (acc * 2 >= total) { cut = i + 1; break; }
    }
    // A SPLIT THAT PEELS ONE COLOUR OFF AN END IS NOT A SPLIT, and left alone
    // it is self-sustaining: the remainder keeps the same skew, so it happens
    // again on the next pass and the one after. Six of the fifty-four ninja
    // files came out of this loop with 254 of their 255 splits shaped that
    // way — 254 palette entries spent on single outlier pixels and the whole
    // subject averaged into the one entry left, which renders as a flat
    // silhouette. They were shipped like that.
    //
    // It happens when one entry holds most of a box's pixels, which is the
    // normal shape of this art: a ninja is a large field of near-black on a
    // transparent ground. Falling back to the middle of the colour run keeps
    // variety on both sides, and it only fires when the population median has
    // already failed, so a legitimately skewed box still splits where its
    // pixels are.
    if (cut === 1 || cut === box.length - 1) cut = box.length >> 1;
    boxes.splice(pick, 1, box.slice(0, cut), box.slice(cut));
  }

  // A box's colour is its pixels' average, with RGB weighted by alpha as well
  // as by count. Averaging RGB straight lets the invisible pixels at an edge
  // drag the entry toward black.
  const palette = boxes.map((box) => {
    let wr = 0, wg = 0, wb = 0, wa = 0, n = 0, aw = 0;
    for (const c of box) {
      const w = c.n * c.a;
      wr += c.r * w; wg += c.g * w; wb += c.b * w;
      aw += w;
      wa += c.a * c.n;
      n += c.n;
    }
    return aw > 0
      ? { r: Math.round(wr / aw), g: Math.round(wg / aw), b: Math.round(wb / aw), a: Math.round(wa / n) }
      : { r: 0, g: 0, b: 0, a: 0 };
  });

  // Palette ORDER is a compression decision, not bookkeeping.
  //
  // Transparent entries lead so tRNS can stop at the last one that is not
  // fully opaque instead of carrying 256 bytes of 255. Within one alpha,
  // entries are ordered by luminance, which is what deflate actually rewards:
  // the index row is filtered against the pixel to its left, and neighbouring
  // pixels in this art are neighbouring shades, so putting similar colours at
  // similar indices turns those deltas into small numbers. Sorting by alpha
  // alone scattered a gradient across the whole palette and cost 59% on the
  // ninja art before this line existed.
  const lum = (c) => 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
  palette.sort((x, y) => x.a - y.a || lum(x) - lum(y));

  const nearest = new Map();
  const pick = (r, g, b, a) => {
    let best = 0, bd = Infinity;
    for (let i = 0; i < palette.length; i++) {
      const p = palette[i];
      const da = (p.a - a) * ALPHA_WEIGHT;
      // Below the rim, colour barely reads; matching alpha is what matters.
      const k = Math.min(a, p.a) / 255;
      const d = da * da + k * ((p.r - r) ** 2 + (p.g - g) ** 2 + (p.b - b) ** 2);
      if (d < bd) { bd = d; best = i; }
    }
    return best;
  };

  const indices = Buffer.alloc(width * height);
  for (let i = 0; i < width * height; i++) {
    const o = i * 4;
    const a = px[o + 3];
    const r = a === 0 ? 0 : px[o];
    const g = a === 0 ? 0 : px[o + 1];
    const b = a === 0 ? 0 : px[o + 2];
    const key = ((r << 24) | (g << 16) | (b << 8) | a) >>> 0;
    let idx = nearest.get(key);
    if (idx === undefined) { idx = pick(r, g, b, a); nearest.set(key, idx); }
    indices[i] = idx;
  }

  return { width, height, indices, palette };
}

function chunk(type, data) {
  const out = Buffer.alloc(data.length + 12);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, 'ascii');
  data.copy(out, 8);
  out.writeInt32BE(crc(out.subarray(4, 8 + data.length)), 8 + data.length);
  return out;
}

const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 255] ^ (c >>> 8);
  return c ^ -1;
}

// Adaptive filtering, the standard minimum-sum-of-absolute-differences pick:
// filter each row all five ways, keep whichever leaves the smallest signed
// magnitude, and let deflate work on that. On this art (soft gradients inside
// a hard die-cut rim) it is worth about a third of the file over any single
// fixed filter, which across 218 stickers is the difference between a page
// that loads and one that does not.
function filterRows(px, stride, height, bpp) {
  const raw = Buffer.alloc(height * (stride + 1));
  const cand = [0, 0, 0, 0, 0].map(() => Buffer.alloc(stride));

  for (let y = 0; y < height; y++) {
    const cur = px.subarray(y * stride, (y + 1) * stride);
    const prev = y ? px.subarray((y - 1) * stride, y * stride) : null;
    const scores = [0, 0, 0, 0, 0];

    for (let x = 0; x < stride; x++) {
      const v = cur[x];
      const a = x >= bpp ? cur[x - bpp] : 0;
      const b = prev ? prev[x] : 0;
      const c = prev && x >= bpp ? prev[x - bpp] : 0;
      const f = [v, v - a, v - b, v - ((a + b) >> 1), v - paeth(a, b, c)];
      for (let k = 0; k < 5; k++) {
        const byte = f[k] & 255;
        cand[k][x] = byte;
        // Signed magnitude: a byte over 127 is a small negative delta.
        scores[k] += byte < 128 ? byte : 256 - byte;
      }
    }

    let best = 0;
    for (let k = 1; k < 5; k++) if (scores[k] < scores[best]) best = k;
    const o = y * (stride + 1);
    raw[o] = best;
    cand[best].copy(raw, o + 1);
  }
  return raw;
}

// Filter byte 0 in front of every row, the raw indices behind it.
function unfilteredRows(px, width, height) {
  const raw = Buffer.alloc(height * (width + 1));
  for (let y = 0; y < height; y++) {
    px.copy(raw, y * (width + 1) + 1, y * width, (y + 1) * width);
  }
  return raw;
}

function ihdrChunk(width, height, colorType) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = colorType;
  return chunk('IHDR', ihdr);
}

export function encode({ width, height, px }) {
  return Buffer.concat([
    SIG,
    ihdrChunk(width, height, 6),
    chunk('IDAT', zlib.deflateSync(filterRows(px, width * 4, height, 4), { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// Colour type 3: PLTE holds the RGB, tRNS holds the alpha for as many leading
// entries as are not fully opaque. `quantize` sorts the palette by alpha for
// exactly this reason, so tRNS is usually a few dozen bytes rather than 256.
//
// NO FILTERING, deliberately, and do not "improve" this by reusing the
// adaptive `filterRows` above. A palette index is a label, not a magnitude:
// subtracting the index to the left is arithmetic on two arbitrary names and
// it turns a field of repeated bytes into noise, which is exactly what deflate
// cannot pack. Running the adaptive filter here cost 59% on the ninja art
// (54KB against 34KB for a file of identical dimensions and palette size)
// before this was tracked down. The PNG spec says the same thing in one line:
// filtering is for continuous-tone images.
export function encodeIndexed({ width, height, indices, palette }) {
  const plte = Buffer.alloc(palette.length * 3);
  palette.forEach((c, i) => { plte[i * 3] = c.r; plte[i * 3 + 1] = c.g; plte[i * 3 + 2] = c.b; });

  let opaqueFrom = palette.length;
  while (opaqueFrom > 0 && palette[opaqueFrom - 1].a === 255) opaqueFrom--;
  const trns = Buffer.from(palette.slice(0, opaqueFrom).map((c) => c.a));

  return Buffer.concat([
    SIG,
    ihdrChunk(width, height, 3),
    chunk('PLTE', plte),
    ...(trns.length ? [chunk('tRNS', trns)] : []),
    chunk('IDAT', zlib.deflateSync(unfilteredRows(indices, width, height), { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}
