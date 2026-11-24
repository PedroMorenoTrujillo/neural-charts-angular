import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
const root = path.resolve(import.meta.dirname, '..'), dist = path.join(root, 'dist/charts'), out = path.join(root, 'artifacts'); fs.mkdirSync(out, { recursive: true });
for (const file of fs.readdirSync(path.join(dist, 'fesm2022')).filter(f => f.endsWith('.mjs'))) {
  const code = fs.readFileSync(path.join(dist, 'fesm2022', file), 'utf8');
  if (/from\s*['"](?:tslib|@angular\/compiler|@neural-charts\/core)(?:\/[^'"]*)?['"]/.test(code)) throw Error('Forbidden adapter runtime import');
}
const manifest = JSON.parse(fs.readFileSync(path.join(dist, 'package.json'))); delete manifest.dependencies?.tslib;
if (!manifest.exports?.['./cartesian']) throw Error('Missing Angular Cartesian entry point');
const cartesian = fs.readFileSync(path.join(dist, manifest.exports['./cartesian'].default), 'utf8');
if (/import\s*\{[^}]*\b(?:createChart|renderChartSvg)\b[^}]*\}\s*from\s*['"]@neural-charts\/web['"]/.test(cartesian)) {
  throw Error('The Angular Cartesian entry point imports the general renderer');
}
if (Object.keys(manifest.dependencies ?? {}).length || Object.keys(manifest.peerDependencies).sort().join() !== '@angular/common,@angular/core,@neural-charts/web') throw Error('Unexpected Angular runtime dependencies');
fs.writeFileSync(path.join(dist, 'package.json'), JSON.stringify(manifest, null, 2));
const pack = JSON.parse(execFileSync('npm', ['pack', '.', '--ignore-scripts', '--json', '--pack-destination', out], { cwd: dist, encoding: 'utf8' }))[0];
const bytes = fs.readFileSync(path.join(out, pack.filename));
fs.writeFileSync(path.join(out, 'package-receipt.json'), JSON.stringify({ file: pack.filename, sha256: createHash('sha256').update(bytes).digest('hex'), dependencies: manifest.dependencies, peers: manifest.peerDependencies, private: manifest.private }, null, 2));
console.log('Built private Angular package over the installed Web archive.');
