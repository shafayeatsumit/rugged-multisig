import React, { useState } from "react";
import { Button, List } from "antd";
import { Address, Balance, Blockie, TransactionDetailsModal } from ".";
import { EllipsisOutlined } from "@ant-design/icons";
import { parseEther } from "@ethersproject/units";
import { ethers } from "ethers";

const TransactionList = function ({
  // item,
  parsedTxnData, //parsed transaction data
  mainnetProvider,
  blockExplorer,
  price,
  transactionHash,
  addressFrom,
  addressedTo,
  nonce,
  value,
  children,
}) {
  // Props thats needed to populate transaction

  // parsedTransactionData, mainnet provider, price, hash, to, value

  const [isModalVisible, setIsModalVisible] = useState(false);

  const showModal = () => {
    setIsModalVisible(true);
  };
  const handleOk = () => {
    setIsModalVisible(false);
  };

  return (
    <>
      <TransactionDetailsModal
        addressFrom={addressFrom}
        addressedTo={addressedTo}
        value={value}
        visible={isModalVisible}
        txnInfo={parsedTxnData}
        handleOk={handleOk}
        mainnetProvider={mainnetProvider}
        price={price}
      />
      <List.Item key={transactionHash} style={{ position: "relative" }}>
        <div
          style={{
            position: "absolute",
            top: 55,
            fontSize: 12,
            opacity: 0.5,
            display: "flex",
            flexDirection: "row",
            width: "90%",
            justifyContent: "space-between",
          }}
        >
          <p>
            <b>Event Name :&nbsp;</b>
            {parsedTxnData ? parsedTxnData?.functionFragment?.name : "Transfer Funds"}&nbsp;
          </p>
          <p>
            <b>Addressed to :&nbsp;</b>
            {addressedTo}
          </p>
        </div>
        {<b style={{ padding: 16 }}>#{nonce}</b>}
        <span>
          <Blockie size={4} scale={8} address={transactionHash} /> {transactionHash.substr(0, 6)}
        </span>
        <Address address={addressedTo} ensProvider={mainnetProvider} blockExplorer={blockExplorer} fontSize={16} />
        <Balance
          balance={ethers.BigNumber.isBigNumber(value) ? value : parseEther("" + parseFloat(value).toFixed(12))}
          dollarMultiplier={price}
        />
        <>{children}</>
        <Button onClick={showModal}>
          <EllipsisOutlined />
        </Button>
      </List.Item>
    </>
  );
};
export default TransactionList;
