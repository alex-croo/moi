// Mechanical exports of the approved transparent symbol; no generated redraws.
// Run from the repository root. --native also updates existing Capacitor assets.
import sharp from 'sharp';
import { mkdir, copyFile, writeFile, access } from 'node:fs/promises';
import { dirname } from 'node:path';

const root = 'logos';
const symbol = await sharp(`${root}/symbol.png`).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const white = Buffer.from(symbol.data);
for (let i = 0; i < white.length; i += 4) white.fill(255, i, i + 3);
const whitePng = await sharp(white, { raw: symbol.info }).png().toBuffer();
const clear = { r: 0, g: 0, b: 0, alpha: 0 };
async function icon(path, size, fraction, tile = false, monochrome = false) {
  const input = tile || monochrome ? whitePng : `${root}/symbol.png`;
  const foreground = await sharp(input).resize(Math.round(size * fraction), Math.round(size * fraction), { fit: 'contain', background: clear }).png().toBuffer();
  await mkdir(dirname(path), { recursive: true });
  let result = sharp({ create: { width: size, height: size, channels: 4, background: tile ? '#fa0081' : clear } }).composite([{ input: foreground, gravity: 'centre' }]);
  if (tile) result = result.removeAlpha();
  await result.png({ compressionLevel: 9 }).toFile(path);
}
for (const size of [32, 48, 192, 512]) await icon(`${root}/icon-${size}.png`, size, .82);
await icon(`${root}/icon-maskable-512.png`, 512, .62, true);
await icon(`${root}/apple-touch-icon.png`, 180, .62, true);
await icon(`${root}/app-icon-1024.png`, 1024, .62, true);
await mkdir('public/brand/tredmeal', { recursive: true });
for (const name of ['logo.png','symbol.png','icon-32.png','icon-48.png','icon-192.png','icon-512.png','icon-maskable-512.png','apple-touch-icon.png','app-icon-1024.png']) {
  await copyFile(`${root}/${name}`, `public/brand/tredmeal/${name}`);
}
if (process.argv.includes('--native')) {
  // Caller must preserve the existing native workspace before opting in.
  await access('apps/mobile/capacitor.config.ts');
  await mkdir('apps/mobile/public/brand/tredmeal', { recursive: true });
  for (const name of ['logo.png', 'icon-32.png']) await copyFile(`${root}/${name}`, `apps/mobile/public/brand/tredmeal/${name}`);
  const res = 'apps/mobile/android/app/src/main/res';
  for (const [density, size, adaptive] of [['mdpi',48,108],['hdpi',72,162],['xhdpi',96,216],['xxhdpi',144,324],['xxxhdpi',192,432]]) {
    const dir = `${res}/mipmap-${density}`;
    await icon(`${dir}/ic_launcher.png`, size, .62, true);
    await icon(`${dir}/ic_launcher_round.png`, size, .62, true);
    await icon(`${dir}/ic_launcher_foreground.png`, adaptive, 66 / 108, false, true);
  }
  await writeFile(`${res}/values/ic_launcher_background.xml`, '<?xml version="1.0" encoding="utf-8"?>\n<resources><color name="ic_launcher_background">#FA0081</color></resources>\n');
  await copyFile(`${root}/app-icon-1024.png`, 'apps/mobile/ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png');
}
console.log(`Brand icons generated${process.argv.includes('--native') ? ', including native resources' : ''}.`);
