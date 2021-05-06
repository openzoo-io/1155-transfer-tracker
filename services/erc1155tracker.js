require('dotenv').config()
const ethers = require('ethers')
const mongoose = require('mongoose')
const ERC1155CONTRACT = mongoose.model('ERC1155CONTRACT')
const Category = mongoose.model('Category')
const ERC1155TOKEN = mongoose.model('ERC1155TOKEN')

const SimplifiedERC1155ABI = require('../constants/simplified1155abi')
const isValidERC1155 = require('../utils/ERC1155Validator')

const provider = new ethers.providers.JsonRpcProvider(
  process.env.MAINNET_RPC,
  parseInt(process.env.MAINNET_CHAINID),
)

let remainder = process.env.REMAINDER

const handleSingleTransfer = async (
  operator,
  from,
  to,
  id,
  value,
  contract,
) => {
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
}

const erc1155EventHandler = async (address) => {
  let abi = SimplifiedERC1155ABI
  let contract = new ethers.Contract(address, abi, provider)
  contract.on('TransferSingle', async (operator, from, to, id, value) => {
    await handleSingleTransfer(operator, from, to, id, value, contract)
  })
  contract.on('TransferBatch', async (operator, from, to, ids, values) => {
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
  })
  contract.on('URI', async (value, id) => {})
}

const trackERC1155 = async (tnx) => {
  console.log(tnx)
  let contractAddress = tnx.creates
  let erc1155 = await ERC1155CONTRACT.findOne({ address: contractAddress })
  if (!erc1155) {
    let minter = new ERC1155CONTRACT()
    minter.address = contractAddress
    minter.name = 'name'
    minter.symbol = 'symbol'
    await minter.save()
    let category = new Category()
    category.minterAddress = contractAddress
    category.type = 1155
    await category.save()
    await erc1155EventHandler(contractAddress)
  }
  //   save new contract and start tracking
}

const trackNewERC1155 = async () => {
  provider.on('block', async (blockNumber) => {
    let _remainder = blockNumber % 6
    if (_remainder == remainder) {
      let block = await provider.getBlockWithTransactions(blockNumber)
      let tnxs = block.transactions
      if (tnxs.length > 0) {
        let promises = tnxs.map(async (tnx) => {
          if (tnx.creates != null) {
            let contractAddress = tnx.creates
            let isERC1155 = await isValidERC1155(contractAddress)
            if (isERC1155) {
              await trackERC1155(tnx)
            }
          }
        })

        Promise.all(promises)
      }
    }
  })
}

module.exports = trackNewERC1155
