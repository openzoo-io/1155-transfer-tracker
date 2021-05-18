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

const toLowerCase = (val) => {
  if (val) return val.toLowerCase()
  else return val
}

const validatorAddress = '0x0000000000000000000000000000000000000000'
// store trackedAddresses
const trackedAddresses = []
const trackedSCs = []

const trackNewERC1155 = async () => {
  const func = async () => {
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
              console.log('transfer single')
              operator = toLowerCase(operator)
              from = toLowerCase(from)
              to = toLowerCase(to)
              id = parseFloat(id.toString())
              value = parseFloat(value.toString())
              try {
                if (from == validatorAddress) {
                  // this is a new mint
                  let newTk = new ERC1155TOKEN()
                  let ownerMap = new Map()
                  ownerMap.set(to, value)
                  newTk.owner = ownerMap
                  newTk.contractAddress = address
                  newTk.tokenID = id
                  newTk.supply = value
                  newTk.tokenURI = 'https://'
                  await newTk.save()
                } else {
                  let tk = await ERC1155TOKEN.findOne({
                    contractAddress: operator,
                    tokenID: id,
                  })
                  if (tk) {
                    //add value to the receiver
                    let ownerMap = tk.owner
                    if (ownerMap) {
                      try {
                        let senderValue = ownerMap.get(from)
                        let remainingBalance = parseFloat(senderValue) - value
                        if (remainingBalance == 0) {
                          ownerMap.delete(from)
                        } else {
                          ownerMap.set(from, remainingBalance)
                        }
                        //deduct value from sender
                        let receiverValue = ownerMap.get(to)
                        receiverValue = receiverValue + value
                        ownerMap.set(to, receiverValue)
                        tk.owner = ownerMap
                        await tk.save()
                      } catch (error) {
                        console.log('in save while there is a tk')
                        console.log(error)
                      }
                    } else {
                      console.log('else')
                    }
                  }
                }
              } catch (error) {
                console.log('overall handle single transfer function')
                console.log(error)
              }
            },
          )
          contract.on(
            'TransferBatch',
            async (operator, from, to, ids, values) => {
              let promises = ids.map(async (_, index) => {
                operator = toLowerCase(operator)
                from = toLowerCase(from)
                to = toLowerCase(to)
                let id = ids[index]
                id = parseFloat(id.toString())
                let value = values[index]
                value = parseFloat(value.toString())
                try {
                  if (from == validatorAddress) {
                    // this is a new mint
                    let newTk = new ERC1155TOKEN()
                    let ownerMap = new Map()
                    ownerMap.set(to, value)
                    newTk.owner = ownerMap
                    newTk.contractAddress = address
                    newTk.tokenID = id
                    newTk.supply = value
                    newTk.tokenURI = 'https://'
                    await newTk.save()
                  } else {
                    let tk = await ERC1155TOKEN.findOne({
                      contractAddress: operator,
                      tokenID: id,
                    })
                    if (tk) {
                      //add value to the receiver
                      let ownerMap = tk.owner
                      if (ownerMap) {
                        try {
                          let senderValue = ownerMap.get(from)
                          let remainingBalance = parseFloat(senderValue) - value
                          if (remainingBalance == 0) {
                            ownerMap.delete(from)
                          } else {
                            ownerMap.set(from, remainingBalance)
                          }
                          //deduct value from sender
                          let receiverValue = ownerMap.get(to)
                          receiverValue = receiverValue + value
                          ownerMap.set(to, receiverValue)
                          tk.owner = ownerMap
                          await tk.save()
                        } catch (error) {
                          console.log('in save while there is a tk')
                          console.log(error)
                        }
                      } else {
                        console.log('else')
                      }
                    }
                  }
                } catch (error) {
                  console.log('overall handle single transfer function')
                  console.log(error)
                }
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
          contract.on('URI', async (value, id) => {
            console.log('uri 1')
            setTimeout(async () => {
              id = parseFloat(id.toString())
              let tk = await ERC1155TOKEN.findOne({ tokenID: id })
              console.log('uri 2', tk.tokenURI)
              tk.tokenURI = value
              await tk.save()
            }, 1000)
          })
        })
        await Promise.all(promise)
      }
      setTimeout(async () => {
        await func()
      }, 1000 * 10)
    } catch (error) {
      console.log('error in tracking new 1155')
      console.log(error)
    }
  }
  await func()
}

module.exports = trackNewERC1155
