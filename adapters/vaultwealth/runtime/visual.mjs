import fs from 'node:fs';
import { PNG } from 'pngjs';

export async function verifyLoginControl(page, reference, output, record = false) {
  const control = page.getByRole('button', { name: 'Continue', exact: true });
  const bytes = await control.screenshot({ animations: 'disabled' });
  fs.writeFileSync(output, bytes);
  if (record) {
    fs.writeFileSync(reference, bytes);
    return { referenceRecorded: true };
  }
  const actual = PNG.sync.read(bytes);
  const expected = PNG.sync.read(fs.readFileSync(reference));
  if (actual.width !== expected.width || actual.height !== expected.height)
    throw Error('Visual defect: control dimensions changed');
  let changed = 0;
  for (let i = 0; i < actual.data.length; i += 4) {
    if (Math.max(...[0, 1, 2].map((c) => Math.abs(actual.data[i + c] - expected.data[i + c]))) > 30) changed++;
  }
  const fraction = changed / (actual.width * actual.height);
  if (fraction > 0.02) throw Error(`Visual defect: ${(fraction * 100).toFixed(2)}% of Continue control pixels changed`);
  return { changedFraction: fraction };
}
