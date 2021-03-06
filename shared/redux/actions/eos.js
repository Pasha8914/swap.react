import config from 'app-config'
import { getState } from 'redux/core'
import reducers from 'redux/core/reducers'
import constants from 'helpers/constants'
import actions from 'redux/actions'

import { eos, ecc } from 'helpers/eos'
import { Keygen } from 'eosjs-keygen'

const generateAccountName = (publicKey) => {
  const account = Array.prototype.map.call(
    publicKey.substr(0, 12).toLowerCase(),
    (char) => (Number.isNaN(Number.parseInt(char, 10)) || char < 5) ? char : char - 4
  ).join('')

  return account
}

const register = async (accountName, activePrivateKey) => {
  const eosInstance = await eos.getInstance()
  const eccInstance = await ecc.getInstance()
  const { permissions } = await eosInstance.getAccount(accountName)

  const activePublicKey = eccInstance.privateToPublic(activePrivateKey)

  const requiredPublicKey =
    permissions.find(item => item.perm_name === 'active')
      .required_auth.keys[0].key

  if (activePublicKey != requiredPublicKey)
    throw new Error(`${activePublicKey} is not equal to ${requiredPublicKey}`)

  localStorage.setItem(constants.privateKeyNames.eos, activePrivateKey)
  localStorage.setItem(constants.privateKeyNames.eosAccount, accountName)
  localStorage.setItem(constants.localStorage.eosAccountActivated, true)

  await login(accountName, activePrivateKey)
}

const loginWithNewAccount = async () => {
  const eccInstance = await ecc.getInstance()

  const keys = await Keygen.generateMasterKeys()

  const { privateKeys: { active: activePrivateKey }, publicKeys: { active: activePublicKey }} = keys

  const accountName = generateAccountName(activePublicKey)

  localStorage.setItem(constants.privateKeyNames.eos, activePrivateKey)
  localStorage.setItem(constants.privateKeyNames.eosAccount, accountName)
  localStorage.setItem(constants.localStorage.eosAccountActivated, false)

  await login(accountName, activePrivateKey)
}

const login = async (accountName, activePrivateKey) => {
  const eccInstance = await ecc.getInstance()

  const activePublicKey = eccInstance.privateToPublic(activePrivateKey)

  reducers.user.setAuthData({ name: 'eosData', data: { activePrivateKey, activePublicKey, address: accountName } })
}

const buyAccount = async () => {
  const eosPrivateKey = localStorage.getItem(constants.privateKeyNames.eos)
  const accountName = localStorage.getItem(constants.privateKeyNames.eosAccount)
  let paymentTx = localStorage.getItem(constants.localStorage.eosActivationPayment)

  const eccInstance = await ecc.getInstance()
  const eosPublicKey = eccInstance.privateToPublic(eosPrivateKey)

  const { user: { btcData }} = getState()
  const btcAddress = btcData.address
  const btcPrivateKey = btcData.privateKey

  if (!paymentTx) {
    paymentTx = await sendActivationPayment({ from: btcAddress })
    localStorage.setItem(constants.localStorage.eosActivationPayment, paymentTx)
  }

  const message = `${accountName}:${eosPublicKey}`
  const signature = await actions.btc.signMessage(message, btcPrivateKey)

  await activateAccount({
    accountName, eosPublicKey, btcAddress, signature, paymentTx
  })

  localStorage.setItem(constants.localStorage.eosAccountActivated, true)
}

const sendActivationPayment = async ({ from }) => {
  const { buyAccountPriceInBTC, buyAccountPaymentRecipient } = config.api.eos

  const txid = await actions.btc.send(from, buyAccountPaymentRecipient, buyAccountPriceInBTC)

  return txid.getId()
}

const activateAccount = async ({ accountName, eosPublicKey, btcAddress, signature, paymentTx }) => {
  const { registerEndpoint } = config.api.eos

  const response = await fetch(registerEndpoint, {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      publicKey: eosPublicKey,
      accountName: accountName,
      address: btcAddress,
      signature: signature,
      txid: paymentTx
    }),
  })

  const { transaction_id } = await response.json()

  return transaction_id
}

const getBalance = async () => {
  const { user: { eosData: { address } } } = getState()

  if (typeof address !== 'string') return

  const eosInstance = await eos.getInstance()
  const balance = await eosInstance.getCurrencyBalance({
    code: 'eosio.token',
    symbol: 'EOS',
    account: address,
  })

  const amount = Number.parseFloat(balance[0]) || 0

  reducers.user.setBalance({ name: 'eosData', amount })

  return amount
}

const send = async (from, to, amount) => {
  const { user: { eosData: { address } } } = getState()

  if (typeof address !== 'string') return

  const eosInstance = await eos.getInstance()
  const transfer = await eosInstance.transaction(
    {
      actions: [{
        account: 'eosio.token',
        name: 'transfer',
        authorization: [{
          actor: from,
          permission: 'active',
        }],
        data: {
          from,
          to: to.trim(),
          quantity: `${amount}.0000 EOS`,
          memo: '',
        },
      }],
    }
  )
}

export default {
  login,
  loginWithNewAccount,
  register,
  getBalance,
  send,
  buyAccount
}
