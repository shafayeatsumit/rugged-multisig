import React from "react";
import { Modal } from "antd";
import Address from "./Address";
import Balance from "./Balance";
import { ethers } from "ethers";
import { parseEther } from "@ethersproject/units";
const TransactionDetailsModal = function ({
  addressFrom,
  addressedTo,
  value,
  visible,
  handleOk,
  mainnetProvider,
  price,
  txnInfo = null,
}) {
  return (
    <Modal
      title="Transaction Details"
      visible={visible}
      onCancel={handleOk}
      destroyOnClose
      onOk={handleOk}
      footer={null}
      closable
      maskClosable
    >
      {txnInfo ? (
        <div>
          <p>
            <b>Event Name :</b> {txnInfo.functionFragment.name}
          </p>
          <p>
            <b>Function Signature :</b> {txnInfo.signature}
          </p>
          <h4>Arguments :&nbsp;</h4>
          {txnInfo.functionFragment.inputs.map((element, index) => {
            if (element.type === "address") {
              return (
                <div
                  key={element.name}
                  style={{ display: "flex", flexDirection: "row", alignItems: "center", justifyContent: "left" }}
                >
                  <b>{element.name} :&nbsp;</b>
                  <Address fontSize={16} address={txnInfo.args[index]} ensProvider={mainnetProvider} />
                </div>
              );
            }
            if (element.type === "uint256") {
              return (
                <p key={element.name}>
                  {element.name === "value" ? (
                    <>
                      <b>{element.name} : </b>
                      <Balance
                        fontSize={16}
                        balance={ethers.BigNumber.from(txnInfo.args[index])}
                        dollarMultiplier={price}
                      />
                    </>
                  ) : (
                    <>
                      <b>{element.name} : </b>
                      {txnInfo.args[index] && ethers.BigNumber.from(txnInfo.args[index]).toString()}
                    </>
                  )}
                </p>
              );
            }
          })}
          <p>
            <b>SigHash : &nbsp;</b>
            {txnInfo.sighash}
          </p>
        </div>
      ) : (
        <div>
          <p>
            <b>Event Name :</b> Transfer Fund
          </p>
          <p>
            <b>From :</b> {addressFrom}
          </p>

          <p>
            <b>To :</b> {addressedTo}
          </p>

          <p>
            <b>Amount :</b>
            <Balance
              balance={ethers.BigNumber.isBigNumber(value) ? value : parseEther("" + parseFloat(value).toFixed(12))}
              dollarMultiplier={price}
            />
          </p>
        </div>
      )}
    </Modal>
  );
};

export default TransactionDetailsModal;
