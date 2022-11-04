import { createSelector } from "@reduxjs/toolkit"
import { RootState } from ".."
import { isDefined } from "../../lib/utils/type-guards"
import { KeyringAccountSigner } from "../../services/keyring"
import { LedgerAccountSigner } from "../../services/ledger"
import { AccountSigner, ReadOnlyAccountSigner } from "../../services/signing"
import { HexString } from "../../types"
import getAllAddresses from "./accounts/getAllAddresses"
import { selectKeyringsByAddresses } from "./keyringsSelectors"
import { selectCurrentAccount } from "./uiSelectors"

export const selectAccountSignersByAddress = createSelector(
  getAllAddresses,
  (state: RootState) => state.ledger.devices,
  selectKeyringsByAddresses,
  (allAddresses, ledgerDevices, keyringsByAddress) => {
    const allAccountsSeen = new Set<string>()
    const ledgerEntries = Object.values(ledgerDevices).flatMap((device) =>
      Object.values(device.accounts).flatMap(
        (account): [[HexString, LedgerAccountSigner]] | [] => {
          if (account.address === null) return []

          allAccountsSeen.add(account.address)
          return [
            [
              account.address,
              { type: "ledger", deviceID: device.id, path: account.path },
            ],
          ]
        }
      )
    )

    const keyringEntries = Object.entries(keyringsByAddress)
      .map(
        ([address, keyring]): [HexString, KeyringAccountSigner] | undefined => {
          if (keyring.id === null) {
            return undefined
          }

          allAccountsSeen.add(address)

          return [
            address,
            {
              type: "keyring",
              keyringID: keyring.id,
            },
          ]
        }
      )
      .filter(isDefined)

    const readOnlyEntries: [string, typeof ReadOnlyAccountSigner][] =
      allAddresses
        .filter((address) => !allAccountsSeen.has(address))
        .map((address) => [address, ReadOnlyAccountSigner])

    const entriesByPriority: [string, AccountSigner][] = [
      ...readOnlyEntries,
      ...ledgerEntries,
      // Give priority to keyring over Ledger, if an address is signable by
      // both.
      ...keyringEntries,
    ]

    return Object.fromEntries(entriesByPriority)
  }
)

export const selectCurrentAccountSigner = createSelector(
  selectAccountSignersByAddress,
  selectCurrentAccount,
  (signingAccounts, selectedAccount) => signingAccounts[selectedAccount.address]
)
