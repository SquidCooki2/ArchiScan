// Runs the real backend (in-process) against one or more floorplan images and saves the API response.
// Usage:
//   Single floor: node scripts/run-sample.js [imagePath] [outputName]
//   Multi-floor:  node scripts/run-sample.js floor0.png floor1.png [--out multi_name]
require('dotenv').config();
const fs = require('node:fs');
const path = require('node:path');
const { loadConfig } = require('../src/config');
const { createApp } = require('../src/app');
const { createClaudeService } = require('../src/services/claude');

const MEDIA_TYPES = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif' };

function parseCliArgs(argv) {
  const args = argv.slice(2);
  let outName;
  const outIdx = args.indexOf('--out');
  if (outIdx !== -1 && args[outIdx + 1]) {
    outName = args[outIdx + 1];
    args.splice(outIdx, 2);
  }
  if (args.length === 0) {
    const defaultImg = path.join(__dirname, '../assets/apartment_furnished_preview.png');
    return { imagePaths: [defaultImg], name: outName || path.basename(defaultImg, path.extname(defaultImg)) };
  }
  // Backwards-compatible: if 2 args and the 2nd does not look like a file with extension, treat 2nd as outputName
  if (args.length === 2 && !path.extname(args[1]) && !fs.existsSync(args[1])) {
    return { imagePaths: [path.resolve(args[0])], name: outName || args[1] };
  }
  const imagePaths = args.map((p) => path.resolve(p));
  const defaultName = path.basename(imagePaths[0], path.extname(imagePaths[0])) + (imagePaths.length > 1 ? `_${imagePaths.length}floors` : '');
  return { imagePaths, name: outName || defaultName };
}

async function main() {
  const { imagePaths, name } = parseCliArgs(process.argv);
  const outDir = path.resolve(__dirname, '../../sample_output');

  const config = loadConfig();
  const server = createApp({ config, claude: createClaudeService(config) }).listen(0);
  try {
    const payloadImages = imagePaths.map((p) => ({
      image: fs.readFileSync(p).toString('base64'),
      mediaType: MEDIA_TYPES[path.extname(p).toLowerCase()] || 'image/png',
    }));
    const reqBody = payloadImages.length === 1 ? payloadImages[0] : { images: payloadImages };
    console.log(
      `Sending ${imagePaths.length} floor image(s) (${imagePaths.map((p) => path.basename(p)).join(', ')}) to model ${config.anthropicModel}...`
    );

    const res = await fetch(`http://localhost:${server.address().port}/api/parse-blueprint`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(reqBody),
    });
    const body = await res.json();

    fs.mkdirSync(outDir, { recursive: true });
    const file = path.join(outDir, res.ok ? `${name}.walls.json` : `${name}.error.json`);
    fs.writeFileSync(file, JSON.stringify(body, null, 2) + '\n');
    console.log(`HTTP ${res.status}: ${res.ok ? `${body.length} elements` : body.error.code + ' - ' + body.error.message}`);
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
