require('dotenv').config()
const mongoose = require('mongoose')

require('./models/account')
require('./models/bundle')
require('./models/event')
require('./models/tradehistory')
require('./models/collection')
require('./models/abi')
require('./models/listing')
require('./models/notification')
require('./models/bid')
require('./models/highestblock')
require('./models/offer')
require('./models/category')
require('./models/erc1155contract')
require('./models/erc1155token')
require('./models/auction')
require('./models/erc1155holding')

const trackNewERC1155 = require('./services/erc1155tracker')

const uri = process.env.DB_URL

mongoose.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true })
const db = mongoose.connection
db.on('error', console.error.bind(console, 'connection error:'))
db.once('open', async () => {
  console.log('nifty server has been connected to the db server')
  trackNewERC1155()
})
