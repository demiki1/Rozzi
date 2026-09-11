const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const copies = [
  ['.env.example', '.env'],
  ['backend/.env.example', 'backend/.env'],
  ['apps/admin/.env.example', 'apps/admin/.env.local'],
  ['apps/customer/.env.example', 'apps/customer/.env.local'],
  ['apps/vendor/.env.example', 'apps/vendor/.env.local'],
  ['apps/rider/.env.example', 'apps/rider/.env.local'],
];
for (const [src, dest] of copies) {
  const from = path.join(root, src), to = path.join(root, dest);
  if (!fs.existsSync(to)) {
    fs.copyFileSync(from, to);
    console.log(`Created ${dest}`);
  } else console.log(`Exists   ${dest}`);
}
console.log('\nLocal env files are ready. Review .env and backend/.env before starting.');
