import React, { useCallback, useEffect, useState } from "react";
import { useHistory } from "react-router-dom";
import { Select, Button, List, Divider, Input, Card, DatePicker, Slider, Switch, Progress, Spin } from "antd";
import { SyncOutlined } from "@ant-design/icons";
import { Address, AddressInput, Balance, Blockie } from "../components";
import { parseEther, formatEther } from "@ethersproject/units";
import { ethers } from "ethers";
import { useContractReader, useEventListener, useLocalStorage } from "../hooks";
const axios = require("axios");
const { Option } = Select;

export default function Owners({
  contractName,
  ownerEvents,
  signaturesRequired,
  address,
  nonce,
  userProvider,
  mainnetProvider,
  localProvider,
  yourLocalBalance,
  price,
  tx,
  readContracts,
  writeContracts,
  blockExplorer,
}) {
  const history = useHistory();

  const [to, setTo] = useLocalStorage("to");
  const [methodName, setMethodName] = useLocalStorage("methodName");
  const [newOwner, setNewOwner] = useLocalStorage("newOwner");
  const [newSignaturesRequired, setNewSignaturesRequired] = useLocalStorage("newSignaturesRequired");
  const [data, setData] = useLocalStorage("data", "0x");
  if (methodName === "transferFunds") setMethodName("addSigner");

  return (
    <div>
      <h2 style={{ marginTop: 32 }}>
        Signatures Required: {signaturesRequired ? signaturesRequired.toNumber() : <Spin></Spin>}
      </h2>
      <List
        style={{ maxWidth: 400, margin: "auto", marginTop: 32 }}
        bordered
        dataSource={ownerEvents}
        renderItem={(item, i) => {
          return (
            <List.Item key={"owner_" + i}>
              <Address
                address={item.args[0]}
                ensProvider={mainnetProvider}
                blockExplorer={blockExplorer}
                fontSize={32}
              />
              <div style={{ padding: 16 }}>{item.args[1] ? "👍" : "👎"}</div>
            </List.Item>
          );
        }}
      />

      <div style={{ border: "1px solid #cccccc", padding: 16, width: 400, margin: "auto", marginTop: 64 }}>
        <div style={{ margin: 8, padding: 8 }}>
          <Select value={methodName} style={{ width: "100%" }} onChange={setMethodName}>
            <Option key="addSigner">Add Signer</Option>
            <Option key="removeSigner">Remove Signer</Option>
          </Select>
        </div>
        <div style={{ margin: 8, padding: 8 }}>
          <AddressInput
            autoFocus
            ensProvider={mainnetProvider}
            placeholder="new owner address"
            value={newOwner}
            onChange={setNewOwner}
          />
        </div>
        <div style={{ margin: 8, padding: 8 }}>
          <Input
            placeholder="new # of signatures required"
            value={newSignaturesRequired}
            onChange={e => {
              setNewSignaturesRequired(e.target.value);
            }}
          />
        </div>
        <div style={{ margin: 8, padding: 8 }}>
          <Button
            onClick={() => {
              console.log("METHOD", setMethodName);
              let calldata = readContracts[contractName].interface.encodeFunctionData(methodName, [
                newOwner,
                newSignaturesRequired,
              ]);
              console.log("calldata", calldata);
              setData(calldata);
              setTo(readContracts[contractName].address);
              setTimeout(() => {
                history.push("/create");
              }, 500);
            }}
          >
            Create Tx
          </Button>
        </div>
      </div>
    </div>
  );
}
