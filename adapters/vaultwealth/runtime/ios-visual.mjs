import fs from 'node:fs';
import { PNG } from 'pngjs';
const flatten = (ns) => ns.flatMap((n) => [n, ...flatten(n.children ?? [])]);
export function verifyNoDevRefreshOverlay(file) {
  const png = PNG.sync.read(fs.readFileSync(file));
  let blueRows = 0;
  for (let y = 0; y < png.height; y++) {
    let blue = 0;
    for (let x = 0; x < png.width; x++) {
      const i = (y * png.width + x) * 4;
      if (png.data[i] < 30 && png.data[i + 1] > 100 && png.data[i + 1] < 180 && png.data[i + 2] > 230) blue++;
    }
    if (blue / png.width > 0.9) blueRows++;
  }
  if (blueRows > (20 * png.width) / 402)
    throw Error(`Visual environment failure: ${blueRows} full-width refresh-blue rows`);
  return { refreshBlueRows: blueRows };
}
export function verifyNativeControl(actualImage, actualTree, referenceDir) {
  const actual = PNG.sync.read(fs.readFileSync(actualImage));
  const expected = PNG.sync.read(fs.readFileSync(referenceDir + '/initial.png'));
  const frame = (tree) =>
    flatten(tree).find(
      (n) => n.AXUniqueId === 'login-email-continue' && n.frame.x >= 0 && n.frame.y >= 0 && n.frame.y < 874,
    )?.frame;
  const af = frame(actualTree),
    ef = frame(JSON.parse(fs.readFileSync(referenceDir + '/initial.json')));
  if (!af || !ef) throw Error('Visual checkpoint has no visible Continue frame');
  const scale = actual.width / 402,
    es = expected.width / 402;
  if (scale !== es) throw Error('Native screenshot scale differs');
  const width = Math.round(ef.width * scale),
    height = Math.round(ef.height * scale);
  const ax = Math.round(af.x * scale),
    ay = Math.round(af.y * scale),
    ex = Math.round(ef.x * scale),
    ey = Math.round(ef.y * scale);
  let changed = 0;
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const ai = ((ay + y) * actual.width + ax + x) * 4,
        ei = ((ey + y) * expected.width + ex + x) * 4;
      if (Math.max(...[0, 1, 2].map((c) => Math.abs(actual.data[ai + c] - expected.data[ei + c]))) > 30) changed++;
    }
  const fraction = changed / (width * height);
  if (fraction > 0.02) throw Error(`Visual defect: ${(100 * fraction).toFixed(2)}% of native Continue pixels changed`);
  return { changedFraction: fraction };
}
