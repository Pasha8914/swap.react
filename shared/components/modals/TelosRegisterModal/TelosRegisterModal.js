import React from 'react'

import { Modal } from 'components/modal'
import { Button } from 'components/controls'
import { FieldLabel, Input } from 'components/forms'

import Link from 'sw-valuelink'

import actions from 'redux/actions'
import { constants } from 'helpers'

import cssModules from 'react-css-modules'
import styles from './TelosRegisterModal.scss'
import Tooltip from 'components/ui/Tooltip/Tooltip'


@cssModules(styles)
export default class TelosRegisterModal extends React.Component {

  state = {
    accountName: '',
    privateKey: '',
    error: '',
  }

  handleSubmit = async () => {
    const { accountName, privateKey } = this.state

    actions.loader.show(true)

    try {
      await actions.tlos.register(accountName, privateKey)
      await actions.tlos
        .getBalance()

      actions.modals.close(constants.modals.TelosRegister)
    } catch (e) {
      console.error(e)
      this.setState({ error: e.toString() })
    }

    actions.loader.hide()
  }

  render() {
    const { accountName, privateKey, error } = this.state
    const { name } = this.props

    const linked = Link.all(this, 'accountName', 'privateKey')
    const isDisabled = !accountName || !privateKey

    return (
      <Modal name={name} title="TELOS Login">
        <FieldLabel inRow>Account name <Tooltip text="Enter TELOS account name"/></FieldLabel>
        <Input valueLink={linked.accountName} />
        <FieldLabel inRow>Private key <Tooltip text="Enter your TELOS secret key"/></FieldLabel>
        <Input valueLink={linked.privateKey} />
        { error && (
          <div styleName="error">Sorry, error occured during activation</div>
        )
        }
        <Button
          styleName="button"
          brand
          fullWidth
          disabled={isDisabled}
          onClick={this.handleSubmit}
        >
          Login
        </Button>
      </Modal>
    )
  }
}
