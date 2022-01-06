require('dotenv').config()
const Web3 = require('web3');
const SimplifiedERC1155ABI = require('./constants/simplified1155abi');
const { default: axios } = require('axios')
const ethers = require('ethers')
const sleep = require('ko-sleep');

const apiEndPoint = process.env.API_ENDPOINT

const web3 = new Web3(new Web3.providers.HttpProvider(process.env.NETWORK_RPC));

const callAPI = async (endpoint, data) => {
  console.log('call api with', data);
  let times = 0;
  while(times < 100) {
    try {
      let ret = await axios({
        method: 'post',
        url: apiEndPoint + endpoint,
        data,
      });
      return ret;
    } catch (err) {
      console.error('[callAPI error] failed for: ', {data});
      console.error(err.message);
      console.log(`retry after ${5*times} seconds.`)
      await sleep(5000*times);
      times++;
    }
  }
}

async function main() {
  const scAddr = '0xBA024F4dae28569D7ee48A9db249965D8299110e';
  let sc = new web3.eth.Contract(SimplifiedERC1155ABI, scAddr);
  let ret = await sc.getPastEvents('TransferSingle', {
    fromBlock: 	18465000,
    toBlock: 'latest',
  });
  // console.log('TransferSingle', ret.length);
  // for (let i=0; i<ret.length; i++) {
  //   let id = ret[i].returnValues._id;
  //   let value = ret[i].returnValues._value;
  //   let address = scAddr;
  //   let from = ret[i].returnValues._from;
  //   let to = ret[i].returnValues._to;
  //   try {
  //     id = parseInt(id.toString())
  //     value = parseInt(value.toString())
  //     await callAPI('handle1155SingleTransfer', {
  //       address,
  //       from,
  //       to,
  //       id,
  //       value,
  //     })
  //   } catch (error) {
  //     console.log(error);
  //   }
  // }

  ret = await sc.getPastEvents('URI', {
    fromBlock: 	18465000,
    toBlock: 'latest',
  });

  console.log('URI', ret.length);
  for (let i=0; i<ret.length; i++) {
    let id = ret[i].returnValues._id;
    let value = ret[i].returnValues._value;
    let address = scAddr;
    
    try {
      id = parseInt(id.toString())
      await callAPI('handle1155URI', {
        address,
        id,
        value,
      })
    } catch (error) {
      console.log(error);
    }
  }
}

main();