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
            sc.on('TransferSingle', (operator, from, to, id, value) => {
              try {
                id = parseInt(id.toString())
                value = parseInt(value.toString())
                callAPI('handle1155SingleTransfer', {
                  address,
                  from,
                  to,
                  id,
                  value,
                })
              } catch (error) {}
            })
            sc.on('TransferBatch', (operator, from, to, _ids, _values) => {
              try {
                let ids = []
                let values = []
                _ids.map((_, index) => {
                  let id = _ids[index]
                  id = parseInt(id.toString())
                  ids.push(id)
                  let value = _values[index]
                  value = parseInt(value.toString())
                  values.push(value)
                })
                ids = ids.join()
                values = values.join()
                callAPI('handle1155BatchTransfer', {
                  address,
                  from,
                  to,
                  id: ids,
                  value: values,
                })
              } catch (error) {}
            })
            sc.on('URI', async (value, id) => {
              try {
                id = parseInt(id.toString())
                callAPI('handle1155URI', {
                  address,
                  id,
                  value,
                })
              } catch (error) {}
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
      }, 1000 * 10)
    } catch (error) {}
  }
  await func()
}

module.exports = trackNewERC1155
