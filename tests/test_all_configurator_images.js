const fs = require('fs');
const path = require('path');

const js = fs.readFileSync('js/app.js', 'utf8');
const match = js.match(/const sphereRecommendations = {([\s\S]*?)};\s*function updateConfiguratorRecommendation/);
if (!match) {
  console.error('Could not find sphereRecommendations in app.js');
  process.exit(1);
}

const recs = eval('({' + match[1] + '})');
console.log(`Checking ${Object.keys(recs).length} recommendations...`);

let hasError = false;
for (const [key, item] of Object.entries(recs)) {
  const imgPath = path.join(__dirname, '..', item.image);
  const exists = fs.existsSync(imgPath);
  console.log(`[${exists ? 'OK' : 'MISSING'}] ${key.padEnd(16)}: ${item.name.padEnd(35)} -> ${item.image}`);
  if (!exists) hasError = true;
}

if (hasError) {
  console.error('TEST FAILED: Some images are missing!');
  process.exit(1);
} else {
  console.log('ALL CONFIGURATOR IMAGES EXIST ON DISK AND ARE 100% VALID!');
}
