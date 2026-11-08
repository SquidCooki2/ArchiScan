// Runs the real backend (in-process) against a floorplan image and saves the API response.
// Usage: node scripts/run-sample.js [imagePath] [outputName]
// Defaults: assets/apartment_furnished_preview.png -> ../sample_output/<outputName>.json
require('dotenv').config();
const fs = require('node:fs');
const path = require('node:path');
const { loadConfig } = require('../src/config');
const { createApp } = require('../src/app');
const { createClaudeService } = require('../src/services/claude');

const MEDIA_TYPES = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif' };

async function main() {
  const imagePath = path.resolve(process.argv[2] || path.join(__dirname, '../assets/apartment_furnished_preview.png'));
  const name = process.argv[3] || path.basename(imagePath, path.extname(imagePath));
  const outDir = path.resolve(__dirname, '../../sample_output');

  const config = loadConfig();
  const server = createApp({ config, claude: createClaudeService(config) }).listen(0);
  try {
    const mediaType = MEDIA_TYPES[path.extname(imagePath).toLowerCase()] || 'image/png';
    const image = fs.readFileSync(imagePath).toString('base64');
    console.log(`Sending ${path.basename(imagePath)} to model ${config.anthropicModel}...`);

    const res = await fetch(`http://localhost:${server.address().port}/api/parse-blueprint`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image, mediaType }),
    });
    const body = await res.json();

    fs.mkdirSync(outDir, { recursive: true });
    const file = path.join(outDir, res.ok ? `${name}.walls.json` : `${name}.error.json`);
    fs.writeFileSync(file, JSON.stringify(body, null, 2) + '\n');
    console.log(`HTTP ${res.status}: ${res.ok ? `${body.length} walls` : body.error.code + ' - ' + body.error.message}`);
    console.log(`Saved ${file}`);
    process.exitCode = res.ok ? 0 : 1;
  } finally {
    server.close();
  }
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
