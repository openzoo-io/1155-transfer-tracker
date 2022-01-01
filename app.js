require('dotenv').config()

const trackNewERC1155 = require('./services/erc1155tracker')

process.on('unhandledRejection', (err) => {
  console.error(err);
  process.exit(1);
});

process.on('uncaughtException', (err) => {
  console.error(err);
  process.exit(1);
});

trackNewERC1155()
