import { Button, Input } from "antd";
import WalletConnect from "@walletconnect/client";
import { useState, useEffect } from "react";
import { useLocalStorage } from "../hooks";
import { getAbiFromEtherscan } from "../helpers";
import { ethers } from "ethers";
import CalldataModal from "./CalldataModal";
import QrReader from "react-qr-reader";
import { ScanOutlined } from "@ant-design/icons";
import { WaletConnectScanner } from ".";

/**
  ~ What it does? ~
  Displays a walletconnect input field where users can paste walletconnect URL from a dapp
  and then perform transaction. This component is specially designed just to get calldata 
  from a dapp and not actual walletconnect transaction. Usecases include meta multisig transaction
  where you want to connect your multisig wallet to a dapp and propose transaction.

  ~ How can I use? ~
  <WalletConnectInput
    chainId={localProvider?._network.chainId}
    address={multiSigContractAddress}
    transaction={transaction}
    updateWalletConnectTxnData={updateWalletConnectTxnData}
    confirmTransaction={confirmTransaction}
  />

  ~ Features ~

    - transaction: This is an object that represents a transaction { to, amount, data, parsedTxnData } . 
    For parsedTxnData , check https://docs.ethers.io/v5/api/utils/abi/interface/#Interface--parsing . 
    parsedTxnData is only used for display/UX purposes and not needed for actual transaction.
    - updateWalletConnectTxnData is a function to update parent's state variables from this component. Lifting
    states up :)
    - confirmTransaction is a function passed from parent component and is called when user
    confirms walletConnect calldata. 
**/

const WalletConnectInput = ({ chainId, address, transaction, updateWalletConnectTxnData, confirmTransaction }) => {
  const [walletConnectConnector, setWalletConnectConnector] = useLocalStorage("walletConnectConnector");
  const [walletConnectUri, setWalletConnectUri] = useLocalStorage("walletConnectUri", "");
  const [isConnected, setIsConnected] = useLocalStorage("isConnected", false);
  const [peerMeta, setPeerMeta] = useLocalStorage("peerMeta");
  const [isModalVisible, setIsModalVisible] = useState(false);

  useEffect(() => {
    if (walletConnectUri) {
      setupAndSubscribe();
    }
  }, [walletConnectUri]);

  const setupAndSubscribe = () => {
    const connector = setupConnector();
    if (connector) {
      subscribeToEvents(connector);
      setWalletConnectConnector(connector);
    }
  };

  const setupConnector = () => {
    let connector;
    try {
      connector = new WalletConnect({
        uri: walletConnectUri,
        clientMeta: {
          description: "Multisig Wallet",
          url: "https://multisig-kovan.surge.sh",
          icons: ["https://walletconnect.org/walletconnect-logo.png"],
          name: "Meta Multisig",
        },
      });
      return connector;
    } catch (error) {
      alert(error);
      setWalletConnectUri("");
      return connector;
    }
  };

  const subscribeToEvents = connector => {
    connector.on("session_request", (error, payload) => {
      if (error) {
        throw error;
      }
      console.log("Event: session_request", payload);
      setPeerMeta(payload.params[0].peerMeta);

      connector.approveSession({
        accounts: [address],
        chainId,
      });

      if (connector.connected) {
        setIsConnected(true);
        console.log("Session successfully connected.");
      }
    });

    connector.on("call_request", (error, payload) => {
      if (error) {
        throw error;
      }

      console.log("Event: call_request", payload);
      parseCallRequest(payload);
    });

    connector.on("disconnect", (error, payload) => {
      console.log("Event: disconnect", payload);

      if (error) {
        console.log("Error: disconnect event");
        throw error;
      }

      resetConnection();
    });
  };

  const parseCallRequest = async payload => {
    const { value, to, data } = payload.params[0];
    const parsedTxnData = await decodeFunctionData(data, to);
    const amount = value ? ethers.utils.formatEther(value) : "0.0";
    updateWalletConnectTxnData({
      to,
      amount,
      data,
      parsedTxnData,
    });
    setIsModalVisible(true);
  };

  const decodeFunctionData = async (data, to) => {
    try {
      const abi = await getAbiFromEtherscan(to, chainId);
      const iface = new ethers.utils.Interface(abi);
      return iface.parseTransaction({ data });
    } catch (error) {
      console.log(error);
      // If unable to decode funtion signature using etherscan.
      return null;
    }
  };

  const killSession = () => {
    console.log("ACTION", "killSession");
    if (walletConnectConnector.connected) {
      walletConnectConnector.killSession();
    }
  };

  const hideModal = () => setIsModalVisible(false);

  const resetConnection = () => {
    setWalletConnectUri("");
    setIsConnected(false);
    setWalletConnectConnector(null);
    updateWalletConnectTxnData({
      to: null,
      amount: null,
      data: null,
      parsedTxnData: null,
    });
  };

  const handleOnScan = uri => {
    setWalletConnectUri(uri);
  };

  return (
    <div style={{ width: 600, margin: "auto" }}>
      <div style={{ display: "flex", alignItems: "center", width: 400, margin: "auto" }}>
        <Input
          bordered
          placeholder="Paste wc: uri"
          disabled={isConnected}
          value={walletConnectUri}
          onChange={e => setWalletConnectUri(e.target.value)}
          addonBefore={<img src="wc-logo.svg" style={{ height: 20, width: 20 }} />}
        />
        <WaletConnectScanner handleOnScan={handleOnScan} />
      </div>
      {isConnected && (
        <div style={{ marginTop: 10 }}>
          <img src={peerMeta.icons[0]} style={{ width: 25, height: 25 }} />
          <p>{peerMeta.url}</p>
        </div>
      )}
      {isModalVisible && (
        <CalldataModal
          parsedTransactionData={transaction.parsedTxnData}
          isModalVisible={isModalVisible}
          hideModal={hideModal}
          handleOk={confirmTransaction}
          value={transaction.amount}
          appUrl={peerMeta.url}
          data={transaction.data}
          appIcon={peerMeta.icons[0]}
        />
      )}

      {isConnected && (
        <Button onClick={killSession} type="primary">
          Disconnect
        </Button>
      )}
    </div>
  );
};
export default WalletConnectInput;
