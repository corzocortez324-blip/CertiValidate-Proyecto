/**
 * Red blockchain de pruebas (E2): nodo Ethereum local (ganache) con el contrato
 * real CertiValidateRegistry.sol compilado con solc y desplegado por el emisor.
 * Deja el backend en BLOCKCHAIN_MODE = real apuntando a ese nodo.
 */
const fs = require('fs')
const net = require('net')
const path = require('path')

const CONTRATO = path.resolve(__dirname, '../../../blockchaincontracts/CertiValidateRegistry.sol')
const VARIABLES = ['BLOCKCHAIN_MODE', 'BLOCKCHAIN_RPC_URL', 'BLOCKCHAIN_PRIVATE_KEY', 'BLOCKCHAIN_CONTRACT_ADDRESS', 'BLOCKCHAIN_NETWORK', 'BLOCKCHAIN_EXPLORER_BASE_URL']

const puertoLibre = () => new Promise((resolve, reject) => {
  const srv = net.createServer()
  srv.once('error', reject)
  srv.listen(0, '127.0.0.1', () => { const { port } = srv.address(); srv.close(() => resolve(port)) })
})

const compilarContrato = () => {
  const solc = require('solc')
  const entrada = {
    language: 'Solidity',
    sources: { 'CertiValidateRegistry.sol': { content: fs.readFileSync(CONTRATO, 'utf8') } },
    settings: { optimizer: { enabled: true, runs: 200 }, evmVersion: 'paris', outputSelection: { '*': { '*': ['abi', 'evm.bytecode.object'] } } },
  }
  const salida = JSON.parse(solc.compile(JSON.stringify(entrada)))
  const errores = (salida.errors || []).filter((e) => e.severity === 'error')
  if (errores.length) throw new Error(errores.map((e) => e.formattedMessage).join('\n'))
  const c = salida.contracts['CertiValidateRegistry.sol'].CertiValidateRegistry
  return { abi: c.abi, bytecode: `0x${c.evm.bytecode.object}` }
}

let activa = null
/** Red local en curso (para consultar el contrato desde los pasos). */
const obtenerBlockchainLocal = () => activa

const iniciarBlockchainLocal = async () => {
  const ganache = require('ganache')
  const { ethers } = require('ethers')
  const anteriores = Object.fromEntries(VARIABLES.map((v) => [v, process.env[v]]))

  const port = await puertoLibre()
  const server = ganache.server({ wallet: { deterministic: true }, chain: { chainId: 1337 }, logging: { quiet: true } })
  await server.listen(port, '127.0.0.1')
  const rpcUrl = `http://127.0.0.1:${port}`

  const [cuenta] = Object.values(await server.provider.getInitialAccounts())
  const provider = new ethers.JsonRpcProvider(rpcUrl)
  const wallet = new ethers.Wallet(cuenta.secretKey, provider)
  const { abi, bytecode } = compilarContrato()
  const contrato = await new ethers.ContractFactory(abi, bytecode, wallet).deploy()
  await contrato.waitForDeployment()

  Object.assign(process.env, {
    BLOCKCHAIN_MODE: 'real',
    BLOCKCHAIN_RPC_URL: rpcUrl,
    BLOCKCHAIN_PRIVATE_KEY: cuenta.secretKey,
    BLOCKCHAIN_CONTRACT_ADDRESS: await contrato.getAddress(),
    BLOCKCHAIN_NETWORK: 'ganache-local',
    BLOCKCHAIN_EXPLORER_BASE_URL: `${rpcUrl}/tx/`,
  })

  activa = {
    rpcUrl,
    contractAddress: process.env.BLOCKCHAIN_CONTRACT_ADDRESS,
    contrato: new ethers.Contract(process.env.BLOCKCHAIN_CONTRACT_ADDRESS, abi, provider),
    detener: async () => {
      provider.destroy()
      await server.close()
      for (const [v, valor] of Object.entries(anteriores)) {
        if (valor === undefined) delete process.env[v]
        else process.env[v] = valor
      }
      activa = null
    },
  }
  return activa
}

module.exports = { iniciarBlockchainLocal, obtenerBlockchainLocal, compilarContrato }
