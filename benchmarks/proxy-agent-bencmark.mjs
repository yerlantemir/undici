import { ProxyAgent, request } from 'undici'
import { createServer } from 'http'
import { createProxy } from 'proxy'
import { HttpsProxyAgent } from 'https-proxy-agent'
import axios from 'axios'

const server = await buildServer()
const proxyServer = await buildProxy()

const serverUrl = `http://localhost:${server.address().port}`
const proxyUrl = `http://username:password@localhost:${
  proxyServer.address().port
}`

server.on('request', (req, res) => {
  res.setHeader('content-type', 'application/json')
  res.end(JSON.stringify({ hello: 'world' }))
})

const undiciProxyAgent = new ProxyAgent(proxyUrl, {
  connections: 50,
  keepAliveTimeout: 30 * 1000,
  bodyTimeout: 30 * 1000,
  headersTimeout: 30 * 1000,
  proxyTls: {
    rejectUnauthorized: false,
    keepAlive: true,
    timeout: 30 * 1000,
    sessionTimeout: 5
  },
  requestTls: {
    rejectUnauthorized: false,
    keepAlive: true,
    timeout: 30 * 1000,
    sessionTimeout: 5
  }
})
const axiosHttpsProxyAgent = new HttpsProxyAgent(proxyUrl, {
  rejectUnauthorized: false,
  keepAlive: true,
  maxSockets: 100,
  keepAliveMsecs: 30 * 1000,
  sessionTimeout: 5,
  scheduling: 'lifo'
})

function buildServer () {
  return new Promise((resolve, reject) => {
    const server = createServer()
    server.listen(0, () => resolve(server))
  })
}

function buildProxy () {
  return new Promise((resolve, reject) => {
    const server = createProxy(createServer())
    server.listen(0, () => resolve(server))
  })
}

const makeUndiciRequest = async () => {
  const response = await request(serverUrl + '/hello?foo=bar', {
    method: 'GET',
    dispatcher: undiciProxyAgent
  })
  await response.body.dump()
}

const makeAxiosRequest = async () => {
  await axios.get(serverUrl + '/hello?foo=bar', {
    httpsAgent: axiosHttpsProxyAgent
  })
}

const runTest = async (totalRequests, clientType) => {
  const start = Date.now()

  const makeRequest =
    clientType === 'axios' ? makeAxiosRequest : makeUndiciRequest
  for (let i = 0; i < totalRequests; i++) {
    await makeRequest()
  }

  const end = Date.now()
  return end - start
}
const main = async () => {
  const totalRequests = 10000

  console.log('Results for', totalRequests, 'requests')
  const result = await Promise.all([
    runTest(totalRequests, 'axios'),
    runTest(totalRequests, 'undici')
  ])

  console.log('axios', result[0], 'ms')
  console.log('undici', result[1], 'ms')

  server.close()
  proxyServer.close()
  undiciProxyAgent.close()
}

main()
