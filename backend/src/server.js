require('dotenv').config();
const { loadConfig } = require('./config');
const { createApp } = require('./app');
const { createClaudeService } = require('./services/claude');
const { createMaskRcnnService } = require('./services/maskRcnn');

let config;
try {
  config = loadConfig();
} catch (err) {
  console.error(err.message);
  process.exit(1);
}

const maskRcnn = createMaskRcnnService(config);
const claude = createClaudeService(config);
const app = createApp({ config, claude, maskRcnn });
app.listen(config.port, () => {
  console.log(`Listening on http://localhost:${config.port}`);
});
