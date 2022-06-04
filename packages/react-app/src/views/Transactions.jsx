import React, { useState } from "react";
import { Button, List, Spin } from "antd";
import { ethers } from "ethers";
import { usePoller } from "../hooks";
import { TransactionList } from "../components";

const axios = require("axios");

export default function Transactions({
  poolServerUrl,
  contractName,
  signaturesRequired,
  address,
  multiSigContractAddress,
  nonce,
  mainnetProvider,
  localProvider,
  price,
  tx,
  readContracts,
  writeContracts,
  blockExplorer,
  userSigner,
  selectedChainId,
}) {
  const [transactions, setTransactions] = useState();
  const transactionId = multiSigContractAddress + "_" + selectedChainId;

  const updateTransaction = async hash => {
    const res = await axios.put(poolServerUrl + transactionId, { hash });
    console.log("res", res);
  };

  usePoller(() => {
    const getTransactions = async () => {
      const res = await axios.get(poolServerUrl + readContracts[contractName]?.address + "_" + selectedChainId);
      const newTransactions = [];
      for (const i in res.data) {
        if (!res.data[i].executed) {
          const validSignatures = [];
          for (const s in res.data[i].signatures) {
            // console.log("RECOVER:",res.data[i].signatures[s],res.data[i].hash)
            const signer = await readContracts[contractName].recover(res.data[i].hash, res.data[i].signatures[s]);
            const isOwner = await readContracts[contractName].isOwner(signer);
            if (signer && isOwner) {
              validSignatures.push({ signer, signature: res.data[i].signatures[s] });
            }
          }
          const update = { ...res.data[i], validSignatures };
          // console.log("update",update)
          newTransactions.push(update);
        }
      }
      setTransactions(newTransactions);
      console.log("Loaded", newTransactions.length);
    };
    if (readContracts) getTransactions();
  }, 3777);

  const getSortedSigList = async (allSigs, newHash) => {
    console.log("allSigs", allSigs);

    const sigList = [];
    for (const s in allSigs) {
      console.log("SIG", allSigs[s]);
      const recover = await readContracts[contractName].recover(newHash, allSigs[s]);
      sigList.push({ signature: allSigs[s], signer: recover });
    }

    sigList.sort((a, b) => {
      return ethers.BigNumber.from(a.signer).sub(ethers.BigNumber.from(b.signer));
    });

    console.log("SORTED SIG LIST:", sigList);

    const finalSigList = [];
    const finalSigners = [];
    const used = {};
    for (const s in sigList) {
      if (!used[sigList[s].signature]) {
        finalSigList.push(sigList[s].signature);
        finalSigners.push(sigList[s].signer);
      }
      used[sigList[s].signature] = true;
    }

    console.log("FINAL SIG LIST:", finalSigList);
    return [finalSigList, finalSigners];
  };

  const checkOwnership = async (newHash, signature) => {
    const recover = await readContracts[contractName].recover(newHash, signature);
    console.log("recover--->", recover);

    const isOwner = await readContracts[contractName].isOwner(recover);
    console.log("isOwner", isOwner);
    return isOwner;
  };

  const getHash = async item => {
    const newHash = await readContracts[contractName].getTransactionHash(
      item.nonce,
      item.to,
      ethers.utils.parseEther("" + parseFloat(item.amount).toFixed(12)),
      item.data,
    );
    return newHash;
  };

  const getSignature = async newHash => {
    const signature = await userSigner?.signMessage(ethers.utils.arrayify(newHash));
    return signature;
  };

  if (!signaturesRequired) {
    return <Spin />;
  }
  console.log("transactions", transactions);
  return (
    <div style={{ maxWidth: 750, margin: "auto", marginTop: 32, marginBottom: 32 }}>
      <h1>
        <b style={{ padding: 16 }}>#{nonce ? nonce.toNumber() : <Spin />}</b>
      </h1>

      <List
        bordered
        dataSource={transactions}
        renderItem={item => {
          const hasSigned = item.signers.indexOf(address) >= 0;
          const hasEnoughSignatures = item.signatures.length >= signaturesRequired.toNumber();
          return (
            <TransactionList
              parsedTxnData={item.parsedTxnData}
              mainnetProvider={mainnetProvider}
              blockExplorer={blockExplorer}
              price={price}
              transactionHash={item.hash}
              addressedTo={item.to}
              addressFrom={item.address}
              nonce={item.nonce}
              value={item.amount}
            >
              <span>
                {item.signatures.length}/{signaturesRequired.toNumber()} {hasSigned ? "✅" : ""}
              </span>
              <Button
                onClick={async () => {
                  const newHash = await getHash(item);
                  const signature = await getSignature(newHash);
                  const isOwner = await checkOwnership(newHash, signature);
                  if (isOwner) {
                    const [finalSigList, finalSigners] = await getSortedSigList(
                      [...item.signatures, signature],
                      newHash,
                    );
                    const res = await axios.post(poolServerUrl, {
                      ...item,
                      signatures: finalSigList,
                      signers: finalSigners,
                    });
                  }
                }}
                type="secondary"
                disabled={hasSigned}
              >
                Sign
              </Button>
              <Button
                key={item.hash}
                onClick={async () => {
                  const newHash = await getHash(item);
                  const signature = await getSignature(newHash);
                  const isOwner = await checkOwnership(newHash, signature);
                  if (isOwner) {
                    const [finalSigList, finalSigners] = await getSortedSigList(item.signatures, newHash);
                    tx(
                      writeContracts[contractName].executeTransaction(
                        item.to,
                        ethers.utils.parseEther("" + parseFloat(item.amount).toFixed(12)),
                        item.data,
                        finalSigList,
                      ),
                      resp => {
                        if (!resp.error) updateTransaction(newHash);
                      },
                    );
                  }
                }}
                type={hasEnoughSignatures ? "primary" : "secondary"}
                disabled={!hasEnoughSignatures}
              >
                Exec
              </Button>
            </TransactionList>
          );
        }}
      />
    </div>
  );
}
