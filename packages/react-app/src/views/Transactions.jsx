import React, { useCallback, useEffect, useState } from "react";
import { Button, List, Divider, Input, Card, DatePicker, Slider, Switch, Progress, Spin } from "antd";
import { ConsoleSqlOutlined, SyncOutlined } from "@ant-design/icons";
import { parseEther, formatEther } from "@ethersproject/units";
import { ethers } from "ethers";
import { Address, AddressInput, Balance, Blockie, TransactionListItem } from "../components";
import { usePoller } from "eth-hooks";

const axios = require("axios");

const DEBUG = false;

export default function Transactions({
  poolServerUrl,
  contractName,
  signaturesRequired,
  address,
  nonce,
  userSigner,
  mainnetProvider,
  localProvider,
  yourLocalBalance,
  price,
  tx,
  readContracts,
  writeContracts,
  blockExplorer,
  wakuTransactions,
  wakuLightPush,
  contractAddress,
}) {
  const filterAndProcessTx = receivedTransactions => {
    // filter for the current contract
    console.log("current multisig", contractAddress, wakuTransactions);
    let txList = receivedTransactions.filter(tx => tx.address === contractAddress);
    // filter out the duplicate Tx keep the latest.
    let memTransactions = [];
    txList.map(transaction => {
      const duplicateIndex = memTransactions.findIndex(tx => tx.hash === transaction.hash);
      const hasDuplicate = duplicateIndex !== -1;
      if (hasDuplicate) {
        const duplicateTx = memTransactions[duplicateIndex];
        if (transaction.timestamp > duplicateTx.timestamp) memTransactions[duplicateIndex] = transaction;
      } else {
        memTransactions.push(transaction);
      }
    });
    // filter for not executed tx
    memTransactions = memTransactions.filter(tx => tx.done === 0);
    return memTransactions;
  };

  const getSortedSigList = async (allSigs, newHash) => {
    const sigList = [];
    for (const sig in allSigs) {
      const recover = await readContracts[contractName].recover(newHash, allSigs[sig]);
      sigList.push({ signature: allSigs[sig], signer: recover });
    }

    sigList.sort((a, b) => {
      return ethers.BigNumber.from(a.signer).sub(ethers.BigNumber.from(b.signer));
    });

    const finalSigList = [];
    const finalSigners = [];
    const used = {};
    for (const sig in sigList) {
      if (!used[sigList[sig].signature]) {
        finalSigList.push(sigList[sig].signature);
        finalSigners.push(sigList[sig].signer);
      }
      used[sigList[sig].signature] = true;
    }

    return [finalSigList, finalSigners];
  };

  if (!signaturesRequired) {
    return <Spin />;
  }
  const transactions = filterAndProcessTx(wakuTransactions);
  return (
    <div style={{ maxWidth: 850, margin: "auto", marginTop: 32, marginBottom: 200 }}>
      <h1>
        <b style={{ padding: 16 }}>#{nonce ? nonce.toNumber() : <Spin />}</b>
      </h1>

      <List
        bordered
        dataSource={transactions}
        renderItem={item => {
          const hasSigned = item.signers.indexOf(address) >= 0;
          const hasEnoughSignatures = item.signatures.length <= signaturesRequired.toNumber();
          return (
            <TransactionListItem
              item={item}
              mainnetProvider={mainnetProvider}
              blockExplorer={blockExplorer}
              price={price}
              readContracts={readContracts}
              contractName={contractName}
            >
              <div style={{ padding: 16 }}>
                <span style={{ padding: 4 }}>
                  {item.signatures.length}/{signaturesRequired.toNumber()} {hasSigned ? "✅" : ""}
                </span>
                <span style={{ padding: 4 }}>
                  <Button
                    type="secondary"
                    disabled={hasSigned}
                    onClick={async () => {
                      const newHash = await readContracts[contractName].getTransactionHash(
                        item.nonce,
                        item.to,
                        parseEther("" + parseFloat(item.amount).toFixed(12)),
                        item.data,
                      );

                      const signature = await userSigner?.signMessage(ethers.utils.arrayify(newHash));
                      const recover = await readContracts[contractName].recover(newHash, signature);
                      const isOwner = await readContracts[contractName].isOwner(recover);
                      if (isOwner) {
                        const [finalSigList, finalSigners] = await getSortedSigList(
                          [...item.signatures, signature],
                          newHash,
                        );
                        wakuLightPush({
                          ...item,
                          signatures: finalSigList,
                          signers: finalSigners,
                          timestamp: new Date(),
                        });
                      }
                    }}
                  >
                    Sign
                  </Button>
                  <Button
                    key={item.hash}
                    type={hasEnoughSignatures ? "primary" : "secondary"}
                    onClick={async () => {
                      const newHash = await readContracts[contractName].getTransactionHash(
                        item.nonce,
                        item.to,
                        parseEther("" + parseFloat(item.amount).toFixed(12)),
                        item.data,
                      );
                      const [finalSigList, finalSigners] = await getSortedSigList(item.signatures, newHash);
                      //TODO: find all tx with similar nonce;
                      const txWithSimilarNonce = transactions.filter(tx => tx.nonce === item.nonce);

                      tx(
                        writeContracts[contractName].executeTransaction(
                          item.to,
                          parseEther("" + parseFloat(item.amount).toFixed(12)),
                          item.data,
                          finalSigList,
                        ),
                        txResp => {
                          if (txResp.error) {
                            console.log("transaction error", txResp);
                            return;
                          }
                          txWithSimilarNonce.map(tx => {
                            return wakuLightPush({
                              ...tx,
                              done: 1,
                              timestamp: new Date(),
                            });
                          });
                        },
                      );
                    }}
                  >
                    Exec
                  </Button>
                </span>
              </div>
            </TransactionListItem>
          );
        }}
      />
    </div>
  );
}
