import { copyFileSync } from 'node:fs';

for (const file of ['LICENSE', 'README.md']) {
  copyFileSync(new URL('../' + file, import.meta.url), new URL('../dist/charts/' + file, import.meta.url));
}
