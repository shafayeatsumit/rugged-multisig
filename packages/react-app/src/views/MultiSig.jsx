import React from "react";
import QRCode from "react-qr-code";
import { Balance, Address, TransactionList } from "../components";
import { List, Spin } from "antd";
import { getAbiFromEtherscan } from "../helpers";
import { ethers } from "ethers";
import { useEffect, useState } from "react";

function MultiSig({
  executeTransactionEvents,
  contractName,
  localProvider,
  readContracts,
  price,
  mainnetProvider,
  blockExplorer,
}) {
  let contractAddress = "";
  if (readContracts[contractName]) {
    contractAddress = readContracts[contractName].address;
  }

  return (
    <div style={{ padding: 32, maxWidth: 750, margin: "auto" }}>
      <div style={{ paddingBottom: 40 }}>
        <div>
          <Balance address={contractAddress} provider={localProvider} dollarMultiplier={price} fontSize={64} />
        </div>
        <div>
          <QRCode value={contractAddress} size={180} level="H" />
        </div>
        <div style={{ paddingTop: 20 }}>
          <Address
            address={contractAddress}
            ensProvider={mainnetProvider}
            blockExplorer={blockExplorer}
            fontSize={35}
          />
        </div>
      </div>
    </div>
  );
}
export default MultiSig;
