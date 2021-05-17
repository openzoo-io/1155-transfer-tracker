require('dotenv').config()
const ethers = require('ethers')
const mongoose = require('mongoose')
const ERC1155CONTRACT = mongoose.model('ERC1155CONTRACT')
const ERC1155TOKEN = mongoose.model('ERC1155TOKEN')

const SimplifiedERC1155ABI = require('../constants/simplified1155abi')

const provider = new ethers.providers.JsonRpcProvider(
  process.env.MAINNET_RPC,
  parseInt(process.env.MAINNET_CHAINID),
)
// store trackedAddresses
const trackedAddresses = []
const trackedSCs = []

const handleSingleTransfer = async (
  operator,
  from,
  to,
  id,
  value,
  contract,
) => {
  try {
    let tk = await ERC1155TOKEN.find({ contractAddress: operator, tokenID: id })
    if (tk) {
      //add value to the receiver
      let ownerMap = tk.owner
      if (ownerMap) {
        try {
          let senderValue = ownerMap.get(from)
          if (senderValue >= value) {
            senderValue = senderValue - value
            if (senderValue == value) {
              ownerMap.delete(from)
            } else {
              ownerMap.set(from, senderValue)
            }
          }
          //deduct value from sender
          let receiverValue = ownerMap.get(to)
          receiverValue = receiverValue + value
          ownerMap.set(to, receiverValue)
          tk.owner = ownerMap
          await tk.save()
        } catch (error) {}
      } else {
        // ???
      }
    } else {
      // this is new mint
      // add new token
      let newTk = new ERC1155TOKEN()
      let ownerMap = new Map()
      ownerMap.set(to, value)
      newTk.owner = ownerMap
      newTk.contractAddress = operator
      newTk.tokenID = id
      let uri = await contract.uri(id)
      newTk.tokenURI = uri
      await newTk.save()
    }
  } catch (error) {
    console.log('overall handle single transfer function')
    console.log(error)
  }
}
const trackNewERC1155 = async () => {
  const func = async () => {
    console.log('tracked addresses are ')
    console.log(trackedAddresses)
    try {
      let untrackedSCs = await ERC1155CONTRACT.find({
        address: { $nin: trackedAddresses },
      })
      if (untrackedSCs) {
        // when there are some untracked addresses
        let promise = untrackedSCs.map(async (sc) => {
          let address = sc.address
          trackedAddresses.push(address)
          let abi = SimplifiedERC1155ABI
          let contract = new ethers.Contract(address, abi, provider)
          trackedSCs.push(contract)
          // register tracker here
          contract.on(
            'TransferSingle',
            async (operator, from, to, id, value) => {
              await handleSingleTransfer(
                operator,
                from,
                to,
                id,
                value,
                contract,
              )
            },
          )
          contract.on(
            'TransferBatch',
            async (operator, from, to, ids, values) => {
              let promises = ids.map(async (_, index) => {
                await handleSingleTransfer(
                  operator,
                  from,
                  to,
                  ids[index],
                  values[index],
                  contract,
                )
              })
              Promise.all(promises)
            },
          )
          contract.on('URI', async (value, id) => {})
        })
        await Promise.all(promise)
      }
      setTimeout(async () => {
        await func()
      }, 1000 * 1)
    } catch (error) {
      console.log('error in tracking new 1155')
      console.log(error)
    }
  }
  await func()
}

module.exports = trackNewERC1155
