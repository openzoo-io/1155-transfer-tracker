require('dotenv').config()
const { default: axios } = require('axios')
const ethers = require('ethers')

const SimplifiedERC1155ABI = require('../constants/simplified1155abi')

// store trackedAddresses
const trackedAddresses = []
const trackedContracts = []

const apiEndPoint = process.env.API_ENDPOINT
const provider = new ethers.providers.JsonRpcProvider(
  process.env.NETWORK_RPC,
  parseInt(process.env.NETWORK_CHAINID),
)

const callAPI = async (endpoint, data) => {
  console.log(data)
  await axios({
    method: 'post',
    url: apiEndPoint + endpoint,
    data,
  })
}

const trackSingleNewERC1155 = async () => {
  try {
    let response = await axios.get(`${apiEndPoint}getTrackable1155Contracts`)
    if (response) {
      let data = response.data
      if (data.status == 'success') {
        data = data.data
        data.map((address) => {
          if (!trackedAddresses.includes(address)) {
            let sc = new ethers.Contract(
              address,
              SimplifiedERC1155ABI,
              provider,
            )
            trackedAddresses.push(address)
            trackedContracts.push(sc)
            sc.on('TransferSingle', async (operator, from, to, id, value) => {
              id = parseInt(id.toString())
              value = parseInt(value.toString())
              callAPI('handle1155SingleTransfer', {
                address,
                from,
                to,
                id,
                value,
              })
            })
            sc.on(
              'TransferBatch',
              async (operator, from, to, ids, values) => {
                
              },
            )
            sc.on('URI', async (value, id) => {
              id = parseInt(id.toString())
            })
          }
        })
      }
    }
  } catch (error) {}
}

const trackNewERC1155 = async () => {
  const func = async () => {
    try {
      await trackSingleNewERC1155()
      setTimeout(async () => {
        await func()
      }, 1000 * 5)
    } catch (error) {}
  }
  await func()
}

module.exports = trackNewERC1155
