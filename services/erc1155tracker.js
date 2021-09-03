require('dotenv').config()
const { default: axios } = require('axios')
const ethers = require('ethers')
const mongoose = require('mongoose')
const ERC1155CONTRACT = mongoose.model('ERC1155CONTRACT')
const NFTITEM = mongoose.model('NFTITEM')
const ERC1155HOLDING = mongoose.model('ERC1155HOLDING')
const Like = mongoose.model('Like')

const SimplifiedERC1155ABI = require('../constants/simplified1155abi')

const provider = new ethers.providers.JsonRpcProvider(
  process.env.NETWORK_RPC,
  parseInt(process.env.NETWORK_CHAINID),
)

const toLowerCase = (val) => {
  if (val) return val.toLowerCase()
  else return val
}

const loadedContracts = new Map()

const bannedCollections = new Map()

const isBannedCollection = async (contractAddress) => {
  let isBanned = bannedCollections.get(contractAddress)
  if (isBanned) return true
  try {
    let contract_721 = await ERC1155CONTRACT.findOne({
      address: contractAddress,
    })
    if (contract_721) {
      bannedCollections.set(contractAddress, true)
      return true
    } else {
      bannedCollections.set(contractAddress, false)
      return false
    }
  } catch (error) {
    return false
  }
}

const getTokenUri = async (contractAddress, tokenID) => {
  let sc = loadedContracts.get(contractAddress)
  if (sc) {
    let uri = await sc.uri(tokenID)
    return uri
  } else {
    sc = new ethers.Contract(contractAddress, SimplifiedERC1155ABI, provider)
    loadedContracts.set(contractAddress, sc)
    let uri = await sc.uri(tokenID)
    return uri
  }
}

const getSupply = async (contractAddress, tokenID, ownerAddress) => {
  let sc = loadedContracts.get(contractAddress)
  if (sc) {
    let balance = await sc.balanceOf(ownerAddress, tokenID)
    console.log(`balance of ${ownerAddress} is ${balance}`)
    return balance
  } else {
    sc = new ethers.Contract(contractAddress, SimplifiedERC1155ABI, provider)
    loadedContracts.set(contractAddress, sc)
    let balance = await sc.balanceOf(ownerAddress, tokenID)
    console.log(`balance of ${ownerAddress} is ${balance}`)
    return balance
  }
}

const handleTransferSingle = async (
  from,
  to,
  contractAddress,
  tokenID,
  value,
) => {
  try {
    from = toLowerCase(from)
    to = toLowerCase(to)
    contractAddress = toLowerCase(contractAddress)
    tokenID = parseInt(tokenID.toString())
    value = parseInt(value.toString())
    let tk = await NFTITEM.findOne({
      contractAddress: contractAddress,
      tokenID: tokenID,
    })
    let fromSupply = await getSupply(contractAddress, tokenID, from)
    let db_fromSupply = await ERC1155HOLDING.findOne({
      contractAddress: contractAddress,
      tokenID: tokenID,
      holderAddress: from,
    })
    if (!db_fromSupply) {
      console.log('no from supply')
      return
    }
    db_fromSupply = parseInt(db_fromSupply.supplyPerHolder)
    if (db_fromSupply == fromSupply) {
      console.log('already same')
      return
    }
    if (to == validatorAddress) {
      // burn -- only when token already exists
      if (tk) {
        let supply = tk.supply
        if (supply == value) {
          // this is the final burn
          try {
            await tk.remove()
            await ERC1155HOLDING.deleteMany({
              contractAddress: contractAddress,
              tokenID: tokenID,
            })
            await Like.deleteMany({
              contractAddress: contractAddress,
              tokenID: tokenID,
            })
          } catch (error) {
            console.log('1')
            console.log(error)
          }
        } else {
          // now remove the supply
          supply = supply - value
          tk.supply = supply
          await tk.save()
          let holding = await ERC1155HOLDING.findOne({
            contractAddress: contractAddress,
            tokenID: tokenID,
            holderAddress: from,
          })
          holding = parseInt(holding.supplyPerHolder) - value
          await holding.save()
        }
      } else {
        // already burnt, do nothing
      }
    } else if (from == validatorAddress) {
      // mint
      let toSupply = await getSupply(contractAddress, tokenID, to)
      let db_toSupply = await ERC1155HOLDING.findOne({
        contractAddress: contractAddress,
        tokenID: tokenID,
        holderAddress: to,
      })
      if (db_toSupply) {
        if (db_toSupply.supplyPerHolder != toSupply) {
          db_toSupply.supplyPerHolder = toSupply
          await db_toSupply.save()
        }
      } else {
        // this is a new mint
        let tk = await NFTITEM.findOne({
          contractAddress: contractAddress,
          tokenID: tokenID,
        })
        if (!tk) {
          try {
            let newTk = new NFTITEM()
            newTk.contractAddress = contractAddress
            newTk.tokenID = tokenID
            newTk.supply = value
            newTk.createdAt = new Date()
            let tokenUri = await getTokenUri(contractAddress, tokenID)
            newTk.tokenURI = tokenUri ? tokenUri : 'https://'
            newTk.tokenType = 1155
            let isBanned = await isBannedCollection(contractAddress)
            newTk.isAppropriate = !isBanned
            await newTk.save()
          } catch (error) {
            console.log('2')
            console.log(error)
          }
        }
        let holding = await ERC1155HOLDING.findOne({
          contractAddress: contractAddress,
          tokenID: tokenID,
          holderAddress: to,
        })
        if (!holding) {
          try {
            // now update the holdings collection
            let holding = new ERC1155HOLDING()
            holding.contractAddress = contractAddress
            holding.tokenID = tokenID
            holding.holderAddress = to
            holding.supplyPerHolder = value
            await holding.save()
          } catch (error) {
            console.log('3')
            console.log(error)
          }
        }
      }
    } else {
      // transfer
      let fromSupply = await getSupply(contractAddress, tokenID, from)
      let toSupply = await getSupply(contractAddress, tokenID, to)
      let db_fromSupply = await ERC1155HOLDING.findOne({
        contractAddress: contractAddress,
        tokenID: tokenID,
        holderAddress: from,
      })
      let db_toSupply = await ERC1155HOLDING.findOne({
        contractAddress: contractAddress,
        tokenID: tokenID,
        holderAddress: to,
      })
      console.log('this is a transfer')
      console.log(from, to, contractAddress, tokenID, value)
      console.log('onchain from Supply', fromSupply)
      console.log('onchain to supply', toSupply)
      if (db_fromSupply) {
        try {
          if (parseInt(db_fromSupply.supplyPerHolder) != fromSupply) {
            db_fromSupply.supplyPerHolder = fromSupply
            await db_fromSupply.save()
          }
        } catch (error) {
          console.log('4')
          console.log(error)
        }
      }
      if (db_toSupply) {
        try {
          if (parseInt(db_toSupply.supplyPerHolder) != toSupply) {
            db_toSupply.supplyPerHolder = toSupply
            await db_toSupply.save()
          }
        } catch (error) {
          console.log('5')
          console.log(error)
        }
      } else {
        try {
          // now update the holdings collection
          let holding = new ERC1155HOLDING()
          holding.contractAddress = contractAddress
          holding.tokenID = tokenID
          holding.holderAddress = to
          holding.supplyPerHolder = toSupply
          console.log('transfer to non-holder', toSupply)
          await holding.save()
        } catch (error) {
          console.log('6')
          console.log(error)
        }
      }
    }
  } catch (error) {
    console.log('7')
    console.log(error)
  }
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
              await handleTransferSingle(from, to, address, id, value)
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
                await handleTransferSingle(from, to, address, id, value)
              })
              Promise.all(promises)
            },
          )
          contract.on('URI', async (value, id) => {
            console.log('uri 1')
            setTimeout(async () => {
              id = parseFloat(id.toString())
              let tk = await NFTITEM.findOne({
                contractAddress: address,
                tokenID: id,
              })
              if (!tk) {
              } else {
                let _tkURI = tk.tokenURI
                if (_tkURI == 'https://') {
                  tk.tokenURI = value
                }
                try {
                  let metadata = await axios.get(_tkURI)
                  let name = metadata.data.name
                  let imageURL = metadata.data.image
                  tk.imageURL = imageURL
                  tk.name = name
                  tk.thumbnailPath = '-'
                } catch (error) {
                  tk.name = ''
                }
                await tk.save()
              }
            }, 1000)
          })
        })
        await Promise.all(promise)
      }
      setTimeout(async () => {
        await func()
      }, 1000 * 10)
    } catch (error) {
      console.log('8')
      console.log(error)
    }
  }
  await func()
}

module.exports = trackNewERC1155
