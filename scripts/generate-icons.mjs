/**
 * Generates every icon the app needs from one source SVG.
 *
 * Run with `pnpm icons`. Output goes to public/, which Vite copies verbatim into the build,
 * so nothing here runs in the browser and neither sharp nor sharp-ico ships.
 *
 * Why a script rather than committed binaries: the artwork is the source of truth, and a
 * reviewer can read it. Regenerating after a colour change is one command.
 *
 * sharp is a native module and is the one heavy addition in this repo. It is dev-only and the
 * production bundle is unaffected, which `pnpm build` confirms.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import sharpIco from 'sharp-ico';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = join(root, 'icon-source.svg');
const publicDir = join(root, 'public');

/** Plain icons, used for the manifest and favicon. */
const PNG = [
  { name: 'icon-192.png', size: 192 },
  { name: 'icon-512.png', size: 512 },
  { name: 'apple-touch-icon.png', size: 180 },
  { name: 'favicon-32.png', size: 32 },
  { name: 'favicon-16.png', size: 16 },
];

/**
 * Maskable icons need their own artwork: Android may crop them to any shape and will zoom in,
 * so the safe zone has to be respected. The source already keeps everything inside the central
 * 60%, which is well within the 80% safe circle, so the same image is reused with a full-bleed
 * background rather than a second drawing to drift out of sync.
 */
const MASKABLE = [
  { name: 'icon-maskable-192.png', size: 192 },
  { name: 'icon-maskable-512.png', size: 512 },
];

async function render(svg, size, outPath) {
  await sharp(svg, { density: 384 })
    .resize(size, size, { fit: 'cover' })
    .png({ compressionLevel: 9 })
    .toFile(outPath);
}

async function main() {
  await mkdir(publicDir, { recursive: true });
  const svg = await readFile(source);

  for (const { name, size } of [...PNG, ...MASKABLE]) {
    await render(svg, size, join(publicDir, name));
    process.stdout.write(`public/${name} (${size}x${size})\n`);
  }

  // favicon.ico, assembled from the rasterised sizes. sharp-ico takes PNG buffers, and its
  // entry point is encode(), not createICO().
  const sizes = [16, 32, 48];
  const buffers = await Promise.all(
    sizes.map((size) =>
      sharp(svg, { density: 384 }).resize(size, size, { fit: 'cover' }).png().toBuffer(),
    ),
  );
  await writeFile(join(publicDir, 'favicon.ico'), sharpIco.encode(buffers));
  process.stdout.write(`public/favicon.ico (${sizes.join(', ')})\n`);

  // A copy of the source as the SVG favicon, so a browser with SVG support skips the rasters.
  await writeFile(join(publicDir, 'icon.svg'), svg);
  process.stdout.write('public/icon.svg\n');
}

main().catch((error) => {
  process.stderr.write(`icon generation failed: ${error?.message ?? error}\n`);
  process.exitCode = 1;
});
