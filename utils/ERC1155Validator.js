require('dotenv').config()
const ethers = require('ethers')

const ERC1155InterfaceID = require('../constants/1155_interfaceID_abi')

const provider = new ethers.providers.JsonRpcProvider(
  process.env.MAINNET_RPC,
  250,
)

const INTERFACEID = 0xd9b67a26

const isValidERC1155 = async (contractAddress) => {
  try {
    let testContract = new ethers.Contract(
      contractAddress,
      ERC1155InterfaceID.ABI,
      provider,
    )
    let is1155 = await testContract.supportsInterface(INTERFACEID)
    console.log(is1155)
    return is1155
  } catch (error) {
    console.log(false)
    return false
  }
}

module.exports = isValidERC1155
