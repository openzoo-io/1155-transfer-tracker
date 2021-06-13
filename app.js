require('dotenv').config()
const mongoose = require('mongoose')

require('./models/erc1155contract')
require('./models/nftitems')
require('./models/erc1155holding')
require('./models/bannenft')

const trackNewERC1155 = require('./services/erc1155tracker')

const uri = process.env.DB_URL

mongoose.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true })
const db = mongoose.connection
db.on('error', console.error.bind(console, 'connection error:'))
db.once('open', async () => {
  console.log('nifty server has been connected to the db server')
  trackNewERC1155()
})
