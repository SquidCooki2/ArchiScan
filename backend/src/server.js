require('dotenv').config();
const { loadConfig } = require('./config');
const { createApp } = require('./app');
const { createClaudeService } = require('./services/claude');

let config;
try {
  config = loadConfig();
} catch (err) {
  console.error(err.message);
  process.exit(1);
}

const app = createApp({ config, claude: createClaudeService(config) });
app.listen(config.port, () => {
  console.log(`Listening on http://localhost:${config.port}`);
});
