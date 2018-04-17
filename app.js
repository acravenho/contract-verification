const Web3 = require('web3')
const solc = require('solc')
const express = require('express')
const PORT = process.env.PORT || 3333

var app = express()
app.use(express.json())

app.get('/api/token_balance', function (req, res) {
  var contractABI = require('./contracts/erc20.json')
  var contractAddress = req.query.contract
  var address = req.query.address
  var provider = req.query.provider
  var prov
  if (provider === 'sokol') {
    prov = 'https://sokol.poa.network'
  } else if (provider === 'core') {
    prov = 'https://core.poa.network'
  }

  var web3 = new Web3(new Web3.providers.HttpProvider(prov))
  if (!contractAddress) {
    res.send('No contract address sent')
  }
  if (!address) {
    res.send('No address sent')
  }
  var tokenContract = new web3.eth.Contract(contractABI, contractAddress)
  tokenContract.methods.balanceOf(address).call(function (err, balance) {
    if (err) {
      res.send(err)
    }
    var data = {
      'balance': balance,
      'address': address,
      'contractAddress': contractAddress
    }
    res.send(data)
  })
})

app.get('/api/token', function (req, res) {
  var contractABI = require('./contracts/erc20.json')
  var provider = req.query.provider
  var contractAddress = req.query.contract
  var prov
  if (provider === 'sokol') {
    prov = 'https://sokol.poa.network'
  } else if (provider === 'core') {
    prov = 'https://core.poa.network'
  }

  var web3 = new Web3(new Web3.providers.HttpProvider(prov))

  if (!contractAddress) {
    res.send('No contract address sent')
  }
  var tokenContract = new web3.eth.Contract(contractABI, contractAddress)
  tokenContract.methods.totalSupply().call(function (err, totalSupply) {
    if (err) {
      res.send(err)
    }
    tokenContract.methods.decimals().call(function (err, decimals) {
      if (err) {
        res.send(err)
      }
      tokenContract.methods.name().call(function (err, name) {
        if (err) {
          res.send(err)
        }
        tokenContract.methods.symbol().call(function (err, symbol) {
          if (err) {
            res.send(err)
          }
          var data = {
            'tokenName': name,
            'decimals': decimals,
            'totalSupply': totalSupply,
            'symbol': symbol,
            'contractAddress': contractAddress
          }
          res.send(data)
        })
      })
    })
  })
})

app.post('/api/verify', function (req, res) {
  var address = req.body.address
  var version = req.body.version
  var name = req.body.name
  var provider = req.body.provider
  var optimization = req.body.optimization
  var sourceCode = req.body.source
  /*
  var address = '0x37536bc1088010081691eec2ea6ae5c93533ed24'
  var version = 'v0.4.21+commit.dfe3193c'
  var name = 'HelloWorld'
  var provider = 'https://core.poa.network:443'
  var optimization = 0
  var sourceCode = 'dafdf'
  */
  var web3 = new Web3(new Web3.providers.HttpProvider(provider))
  web3.eth.getCode(address).then(function (bytecode) {
    if (bytecode.substring(0, 2) === '0x') {
      bytecode = bytecode.substring(2)
      var last = bytecode.substr(bytecode.length - 4)
      if (last === '0029') {
        var bytecodeCompare = bytecode.substring(0, bytecode.length - 68)
        var swarm = bytecode.substring(bytecode.length - 68, bytecode.length - 4)
      }
    }

    var data = {
      'verified': '',
      'error': '',
      'address': address,
      'compilerVersion': version,
      'optimization': optimization,
      'contractName': name,
      'sourceCode': sourceCode,
      'swarm': 'bzzr://' + swarm,
      'bytecode': bytecode,
      'comparableBytecode': bytecodeCompare,
      'last': last
    }

    if (!address || !version || !name || !provider || !sourceCode) {
      data.verified = 'no'
      res.send(data)
    }

    if (!bytecode) {
      data.verified = 'no'
      res.send(data)
    }

    try {
      if (version.substr(version.length - 8) === '(latest)') {
        var output = solc.compile(data.sourceCode, data.optimization)
        var send = ValidateCode(output, data, bytecodeCompare, res)
        res.send(send)
      } else {
        solc.loadRemoteVersion(data.compilerVersion, function (err, solcV) {
          if (!err) {
            var output = solcV.compile(data.sourceCode, data.optimization)
            var send = ValidateCode(output, data, bytecodeCompare, res)
            res.send(send)
          } else {
            data.verified = 'no'
            data.error = err
            res.send(data)
          }
        })
      }
      return
    } catch (e) {
      data.verified = 'no'
      data.error = e.stack
      res.send(data)
    }
  })
})

app.listen(PORT, () => console.log('Listening on port ' + PORT))

var ValidateCode = function (output, data, bytecode, response) {
  if (!output.contracts || !output.contracts[data.contractName]) {
    data.verified = 'no'
    data.error = 'Contract does not exist or name does not match'
    return data
  } else {
    var runtime = output.contracts[data.contractName].runtimeBytecode
    var dataBytecode = output.contracts[data.contractName].bytecode
    runtime = runtime.substring(0, runtime.length - 68)
    data.runtime = runtime
    data.compiledBytecode = dataBytecode
    if (runtime.indexOf(bytecode) > -1) {
      data.verified = 'yes'
      data.abi = output.contracts[data.contractName].interface
      return data
    } else {
      data.verified = 'no'
      data.error = 'Bytecode does not match'
      return data
    }
  }
}
