/* tools/surfaces-studio/validate-manifest.js
   Quick sanity check: ensure manifest paths exist.
   Run with: node tools/surfaces-studio/validate-manifest.js
*/
import fs from 'fs';
import path from 'path';
const root = process.cwd();
const manPath = path.join(root, 'src/ui/manifest.json');
const man = JSON.parse(fs.readFileSync(manPath,'utf-8'));

function check(p){
  const full = path.join(root, p);
  if (!fs.existsSync(full)) return full;
  return null;
}

const missing = [];
for (const s of man.screens||[]){
  missing.push(check(s.surface));
  for (const c of (s.baseline_css||[])) missing.push(check(c));
  if (s.uplift){
    missing.push(check(s.uplift.css));
    missing.push(check(s.uplift.prompt));
    missing.push(check(s.uplift.contract));
  }
}
for (const u of man.ui_units||[]){
  if (u.prompt) missing.push(check(u.prompt));
  if (u.contract) missing.push(check(u.contract));
  if (u.baseline?.html) missing.push(check(u.baseline.html));
  if (u.uplift?.css) missing.push(check(u.uplift.css));
  if (u.uplift?.html) missing.push(check(u.uplift.html));
}
for (const m of man.mountables||[]){
  missing.push(check(m.entry));
}

const bad = missing.filter(Boolean);
if (bad.length){
  console.error('Missing paths:');
  for (const b of bad) console.error(' -', b);
  process.exit(1);
}
console.log('Manifest OK');
