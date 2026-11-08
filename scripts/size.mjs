import { readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';

const files = ['packages/settle-ui/dist/index.js', 'packages/settle-ui/dist/settle.css'];

for (const file of files) {
  const buf = readFileSync(file);
  console.log(`${file}  ${buf.length} bytes  ${gzipSync(buf).length} gzip`);
}
