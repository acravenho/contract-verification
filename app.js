const Web3 = require('web3')
const solc = require('solc')
const express = require('express')
const PORT = process.env.PORT || 3333

var app = express()
app.use(express.json())

app.post('/api/verify', function (req, res) {
  var address = req.body.address
  var version = req.body.version
  var name = req.body.name
  var provider = req.body.provider
  var optimization = req.body.optimization
  var sourceCode = req.body.source

  var web3 = new Web3(new Web3.providers.HttpProvider(provider))
  web3.eth.getCode(address).then(function (bytecode) {
    if (bytecode.substring(0, 2) === '0x') {
      bytecode = bytecode.substring(2)
      var bytecodeCompare = bytecode.substring(0, bytecode.length - 68)
      var swarm = bytecode.substring(bytecode.length - 68, bytecode.length - 4)
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
      'comparableBytecode': bytecodeCompare
      // 'sourceCode': 'pragma solidity 0.4.21;contract Test {int private count = 0;function getCount() public constant returns (int) {return count;}}'
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
    runtime = runtime.substring(0, runtime.length - 68)
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
