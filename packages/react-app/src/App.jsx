import { Button, Col, Menu, Row, Alert, Select, notification } from "antd";
import "antd/dist/antd.css";
import {
  useBalance,
  useContractLoader,
  useContractReader,
  useGasPrice,
  useOnBlock,
  useUserProviderAndSigner,
} from "eth-hooks";
import { useExchangeEthPrice } from "eth-hooks/dapps/dex";
import { useEventListener } from "eth-hooks/events/";
import React, { useCallback, useEffect, useState } from "react";
import { Link, Route, Switch, useLocation } from "react-router-dom";
import "./App.css";
import {
  Account,
  Contract,
  Faucet,
  GasGauge,
  Header,
  Ramp,
  ThemeSwitch,
  NetworkDisplay,
  FaucetHint,
  NetworkSwitch,
  CreateMultiSigModal,
  ImportMultiSigModal,
} from "./components";
import { NETWORKS, ALCHEMY_KEY } from "./constants";
import externalContracts from "./contracts/external_contracts";
//import multiSigWalletABI from "./contracts/multi_sig_wallet";
// contracts
import deployedContracts from "./contracts/hardhat_contracts.json";
import multiSigWalletABI from "./contracts/multisig_abi";
import { Transactor, Web3ModalSetup } from "./helpers";
import { Home, Hints, Subgraph, CreateTransaction, Transactions } from "./views";
import { useStaticJsonRPC, useLocalStorage } from "./hooks";

import { Waku, WakuMessage, discovery, getPredefinedBootstrapNodes, utils } from "js-waku";
import protons from "protons";

const { Option } = Select;
const { ethers } = require("ethers");

/// 📡 What chain are your contracts deployed to?
const initialNetwork = NETWORKS.mainnet; // <------- select your target frontend network (localhost, rinkeby, xdai, mainnet)

// 😬 Sorry for all the console logging
const DEBUG = true;
const NETWORKCHECK = true;
const USE_BURNER_WALLET = true; // toggle burner wallet feature
const USE_NETWORK_SELECTOR = false;

const web3Modal = Web3ModalSetup();

const proto = protons(`
  message WakuTxMessage {
    required uint64 chainId = 1;
    required string address = 2;
    required uint64 nonce = 3;
    required string to = 4;
    required string amount = 5;
    required string data = 6;
    required string hash = 7;
    repeated string signatures = 8;
    repeated string signers = 9;
    required uint64 timestamp = 10;
    required uint32 done = 11;
  }
`);

const CONTENT_TOPIC = "/rugged-multisig/1/1.1/tx-history/proto";

// 🛰 providers
const providers = [
  "https://eth-mainnet.gateway.pokt.network/v1/lb/611156b4a585a20035148406",
  `https://eth-mainnet.alchemyapi.io/v2/${ALCHEMY_KEY}`,
  "https://rpc.scaffoldeth.io:48544",
];

function App(props) {
  // specify all the chains your app is available on. Eg: ['localhost', 'mainnet', ...otherNetworks ]
  // reference './constants.js' for other networks
  const networkOptions = [initialNetwork.name, "mainnet", "rinkeby"];

  const [injectedProvider, setInjectedProvider] = useState();
  const [address, setAddress] = useState();
  const [selectedNetwork, setSelectedNetwork] = useState(networkOptions[0]);
  const [waku, setWaku] = useState(undefined);
  const [transactions, setTransactions] = useState([]);
  const [wakuStatus, setWakuStatus] = useState("None");
  const location = useLocation();

  const cachedNetwork = window.localStorage.getItem("network");
  let targetNetwork = NETWORKS[cachedNetwork || "mainnet"];

  if (!targetNetwork) targetNetwork = NETWORKS["localhost"];

  // 🔭 block explorer URL
  const blockExplorer = targetNetwork.blockExplorer;

  // load all your providers
  const localProvider = useStaticJsonRPC([
    process.env.REACT_APP_PROVIDER ? process.env.REACT_APP_PROVIDER : targetNetwork.rpcUrl,
  ]);
  const mainnetProvider = useStaticJsonRPC(providers);

  const logoutOfWeb3Modal = async () => {
    await web3Modal.clearCachedProvider();
    if (injectedProvider && injectedProvider.provider && typeof injectedProvider.provider.disconnect == "function") {
      await injectedProvider.provider.disconnect();
    }
    setTimeout(() => {
      window.location.reload();
    }, 1);
  };

  /* 💵 This hook will get the price of ETH from 🦄 Uniswap: */
  const price = useExchangeEthPrice(targetNetwork, mainnetProvider);

  /* 🔥 This hook will get the price of Gas from ⛽️ EtherGasStation */
  const gasPrice = useGasPrice(targetNetwork, "fast");
  // Use your injected provider from 🦊 Metamask or if you don't have it then instantly generate a 🔥 burner wallet.
  const userProviderAndSigner = useUserProviderAndSigner(injectedProvider, localProvider, USE_BURNER_WALLET);
  const userSigner = userProviderAndSigner.signer;

  useEffect(() => {
    async function getAddress() {
      if (userSigner) {
        const newAddress = await userSigner.getAddress();
        setAddress(newAddress);
      }
    }
    getAddress();
  }, [userSigner]);
  // You can warn the user if you would like them to be on a specific network
  const localChainId = localProvider && localProvider._network && localProvider._network.chainId;
  const selectedChainId =
    userSigner && userSigner.provider && userSigner.provider._network && userSigner.provider._network.chainId;

  // For more hooks, check out 🔗eth-hooks at: https://www.npmjs.com/package/eth-hooks

  // The transactor wraps transactions and provides notificiations
  const tx = Transactor(userSigner, gasPrice);

  // 🏗 scaffold-eth is full of handy hooks like this one to get your balance:
  const yourLocalBalance = useBalance(localProvider, address);

  // Just plug in different 🛰 providers to get your balance on different chains:
  const yourMainnetBalance = useBalance(mainnetProvider, address);

  // const contractConfig = useContractConfig();

  // const contractConfig = useContractConfig();

  const contractConfig = { deployedContracts: deployedContracts || {}, externalContracts: externalContracts || {} };

  // Load in your local 📝 contract and read a value from it:
  const readContracts = useContractLoader(localProvider, contractConfig);

  // If you want to make 🔐 write transactions to your contracts, use the userSigner:
  const writeContracts = useContractLoader(userSigner, contractConfig, localChainId);

  // const [readContracts, setReadContracts] = useState(readContractsSetup);

  const contractName = "MultiSigWallet";
  const contractAddress = readContracts?.MultiSigWallet?.address;

  //📟 Listen for broadcast events

  // MultiSigFactory Events:
  const ownersMultiSigEvents = useEventListener(readContracts, "MultiSigFactory", "Owners", localProvider, 1);
  if (DEBUG) console.log("📟 ownersMultiSigEvents:", ownersMultiSigEvents);

  const [multiSigs, setMultiSigs] = useState([]);
  const [currentMultiSigAddress, setCurrentMultiSigAddress] = useState();

  const [importedMultiSigs] = useLocalStorage("importedMultiSigs");

  const decodeWakuMessage = useCallback(wakuMessage => {
    if (!wakuMessage.payload) return;
    const decodedTx = proto.WakuTxMessage.decode(wakuMessage.payload);
    return decodedTx;
  }, []);

  const wakuLightPush = async message => {
    const encodedMessage = proto.WakuTxMessage.encode(message);
    const wakuMessage = await WakuMessage.fromBytes(encodedMessage, CONTENT_TOPIC, {
      symKey: utils.hexToBytes(utils.keccak256Buf(Buffer.from(CONTENT_TOPIC, "utf-8"))),
    });
    const resp = await waku.lightPush.push(wakuMessage);
    if (!resp?.isSuccess) {
      notification.open({
        message: "🛑 Error Proposing Transaction To Waku Network",
        description: <>{message.toString()} (check console)</>,
      });
    }
  };

  React.useEffect(() => {
    if (!waku) return;
    if (!currentMultiSigAddress) return;
    // We do not handle disconnection/re-connection in this example
    if (wakuStatus === "Connected") return;

    waku.waitForRemotePeer().then(() => {
      // We are now connected to a store node
      setWakuStatus("Connected");
    });
  }, [waku, wakuStatus, currentMultiSigAddress]);

  React.useEffect(() => {
    if (!currentMultiSigAddress) return;
    if (wakuStatus !== "None") return;

    setWakuStatus("Starting");

    Waku.create({
      bootstrap: {
        peers: getPredefinedBootstrapNodes(discovery.predefined.Fleet.Prod),
      },
      decryptionKeys: [utils.hexToBytes(utils.keccak256Buf(Buffer.from(CONTENT_TOPIC, "utf-8")))],
    }).then(waku => {
      setWaku(waku);
      setWakuStatus("Connecting");
    });
  }, [waku, wakuStatus, currentMultiSigAddress]);

  const addNewTransaction = useCallback(
    wakuMessage => {
      const newTx = decodeWakuMessage(wakuMessage);
      if (newTx) setTransactions(txs => [...txs, newTx]);
    },
    [decodeWakuMessage],
  );

  React.useEffect(() => {
    if (!waku) return;

    // Pass the content topic to only process messages related to your dApp

    waku.relay.addObserver(addNewTransaction, [CONTENT_TOPIC]);

    if (wakuStatus === "Connected") {
      const processWakuStoreMessages = retrievedMessages => {
        const retrievedTxs = retrievedMessages.map(decodeWakuMessage).filter(Boolean);
        console.log("==> retrievedMessages", retrievedTxs);
        setTransactions(txs => [...txs, ...retrievedTxs]);
      };
      waku.store.queryHistory([CONTENT_TOPIC], { callback: processWakuStoreMessages }).catch(e => {
        console.log("==> Failed to retrieve messages", e);
        notification.open({
          message: "🛑 Failed to retrieve messages",
          description: <>{e}</>,
        });
      });
    }

    // `cleanUp` is called when the component is unmounted, see ReactJS doc.
    return function cleanUp() {
      waku.relay.deleteObserver(addNewTransaction, [CONTENT_TOPIC]);
    };
  }, [waku, wakuStatus]);

  useEffect(() => {
    if (address) {
      let multiSigsForUser = ownersMultiSigEvents.reduce((filtered, createEvent) => {
        if (createEvent.args.owners.includes(address) && !filtered.includes(createEvent.args.contractAddress)) {
          filtered.push(createEvent.args.contractAddress);
        }

        return filtered;
      }, []);

      if (importedMultiSigs && importedMultiSigs[targetNetwork.name]) {
        multiSigsForUser = [...new Set([...importedMultiSigs[targetNetwork.name], ...multiSigsForUser])];
      }

      if (multiSigsForUser.length > 0 && multiSigsForUser.length !== multiSigs.length) {
        const recentMultiSigAddress = multiSigsForUser[multiSigsForUser.length - 1];
        if (recentMultiSigAddress !== currentMultiSigAddress) setContractNameForEvent(null);
        setCurrentMultiSigAddress(recentMultiSigAddress);
        setMultiSigs(multiSigsForUser);
      }
    }
  }, [ownersMultiSigEvents, address]);

  const [signaturesRequired, setSignaturesRequired] = useState();
  const [nonce, setNonce] = useState(0);

  const signaturesRequiredContract = useContractReader(readContracts, contractName, "signaturesRequired");
  const nonceContract = useContractReader(readContracts, contractName, "nonce");
  useEffect(() => {
    setSignaturesRequired(signaturesRequiredContract);
    setNonce(nonceContract);
  }, [signaturesRequiredContract, nonceContract]);

  const [contractNameForEvent, setContractNameForEvent] = useState();

  useEffect(() => {
    async function getContractValues() {
      const latestSignaturesRequired = await readContracts.MultiSigWallet.signaturesRequired();
      setSignaturesRequired(latestSignaturesRequired);

      const nonce = await readContracts.MultiSigWallet.nonce();
      setNonce(nonce);
    }

    if (currentMultiSigAddress) {
      readContracts.MultiSigWallet = new ethers.Contract(currentMultiSigAddress, multiSigWalletABI, localProvider);
      writeContracts.MultiSigWallet = new ethers.Contract(currentMultiSigAddress, multiSigWalletABI, userSigner);

      setContractNameForEvent("MultiSigWallet");
      getContractValues();
    }
  }, [currentMultiSigAddress, readContracts, writeContracts]);

  // MultiSigWallet Events:
  const allExecuteTransactionEvents = useEventListener(
    currentMultiSigAddress ? readContracts : null,
    contractNameForEvent,
    "ExecuteTransaction",
    localProvider,
    1,
  );
  if (DEBUG) console.log("📟 executeTransactionEvents:", allExecuteTransactionEvents);

  const allOwnerEvents = useEventListener(
    currentMultiSigAddress ? readContracts : null,
    contractNameForEvent,
    "Owner",
    localProvider,
    1,
  );
  if (DEBUG) console.log("📟 ownerEvents:", allOwnerEvents);

  const [ownerEvents, setOwnerEvents] = useState();
  const [executeTransactionEvents, setExecuteTransactionEvents] = useState();

  useEffect(() => {
    setOwnerEvents(allOwnerEvents.filter(contractEvent => contractEvent.address === currentMultiSigAddress));
  }, [allOwnerEvents, currentMultiSigAddress]);

  useEffect(() => {
    const filteredEvents = allExecuteTransactionEvents.filter(
      contractEvent => contractEvent.address === currentMultiSigAddress,
    );
    const nonceNum = typeof nonce === "number" ? nonce : nonce?.toNumber();
    if (nonceNum === filteredEvents.length) {
      setExecuteTransactionEvents(filteredEvents.reverse());
    }
  }, [allExecuteTransactionEvents, currentMultiSigAddress, nonce]);

  // EXTERNAL CONTRACT EXAMPLE:
  // If you want to bring in the mainnet DAI contract it would look like:
  const mainnetContracts = useContractLoader(mainnetProvider, contractConfig);

  // If you want to call a function on a new block
  useOnBlock(mainnetProvider, () => {
    console.log(`⛓ A new mainnet block is here: ${mainnetProvider._lastBlockNumber}`);
  });

  // Then read your DAI balance like:
  const myMainnetDAIBalance = useContractReader(mainnetContracts, "DAI", "balanceOf", [
    "0x34aA3F359A9D614239015126635CE7732c18fDF3",
  ]);

  /*
  const addressFromENS = useResolveName(mainnetProvider, "austingriffith.eth");
  console.log("🏷 Resolved austingriffith.eth as:",addressFromENS)
  */

  const loadWeb3Modal = useCallback(async () => {
    const provider = await web3Modal.connect();
    setInjectedProvider(new ethers.providers.Web3Provider(provider));

    provider.on("chainChanged", chainId => {
      console.log(`chain changed to ${chainId}! updating providers`);
      setInjectedProvider(new ethers.providers.Web3Provider(provider));
    });

    provider.on("accountsChanged", () => {
      console.log(`account changed!`);
      setInjectedProvider(new ethers.providers.Web3Provider(provider));
    });

    // Subscribe to session disconnection
    provider.on("disconnect", (code, reason) => {
      console.log(code, reason);
      logoutOfWeb3Modal();
    });
    // eslint-disable-next-line
  }, [setInjectedProvider]);

  useEffect(() => {
    if (web3Modal.cachedProvider) {
      loadWeb3Modal();
    }
  }, [loadWeb3Modal]);

  const faucetAvailable = localProvider && localProvider.connection && targetNetwork.name.indexOf("local") !== -1;

  const userHasMultiSigs = currentMultiSigAddress ? true : false;

  const handleMultiSigChange = value => {
    setContractNameForEvent(null);
    setCurrentMultiSigAddress(value);
  };

  const [isCreateModalVisible, setIsCreateModalVisible] = useState(false);

  const selectNetworkOptions = [];
  for (const id in NETWORKS) {
    selectNetworkOptions.push(
      <Select.Option key={id} value={NETWORKS[id].name}>
        <span style={{ color: NETWORKS[id].color }}>{NETWORKS[id].name}</span>
      </Select.Option>,
    );
  }

  const networkSelect = (
    <Select
      defaultValue={targetNetwork.name}
      style={{ textAlign: "left", width: 170 }}
      onChange={value => {
        if (targetNetwork.chainId != NETWORKS[value].chainId) {
          window.localStorage.setItem("network", value);
          setTimeout(() => {
            window.location.reload();
          }, 1);
        }
      }}
    >
      {selectNetworkOptions}
    </Select>
  );
  return (
    <div className="App">
      <Header>
        {/* 👨‍💼 Your account is in the top right with a wallet at connect options */}
        <div style={{ position: "relative" }}>
          <div style={{ display: "flex", flex: 1, alignItems: "center", padding: "0.5rem 0" }}>
            {USE_NETWORK_SELECTOR && (
              <div style={{ marginRight: 20 }}>
                <NetworkSwitch
                  networkOptions={networkOptions}
                  selectedNetwork={selectedNetwork}
                  setSelectedNetwork={setSelectedNetwork}
                />
              </div>
            )}
            <Account
              useBurner={USE_BURNER_WALLET}
              address={address}
              localProvider={localProvider}
              userSigner={userSigner}
              mainnetProvider={mainnetProvider}
              price={price}
              web3Modal={web3Modal}
              loadWeb3Modal={loadWeb3Modal}
              logoutOfWeb3Modal={logoutOfWeb3Modal}
              blockExplorer={blockExplorer}
            />
          </div>
          {yourLocalBalance.lte(ethers.BigNumber.from("0")) && (
            <FaucetHint localProvider={localProvider} targetNetwork={targetNetwork} address={address} />
          )}
        </div>
      </Header>
      <NetworkDisplay
        NETWORKCHECK={NETWORKCHECK}
        localChainId={localChainId}
        selectedChainId={selectedChainId}
        targetNetwork={targetNetwork}
        logoutOfWeb3Modal={logoutOfWeb3Modal}
        USE_NETWORK_SELECTOR={USE_NETWORK_SELECTOR}
      />
      <div style={{ position: "relative" }}>
        <div style={{ position: "absolute", left: 20, display: "flex", flexDirection: "column", alignItems: "start" }}>
          <div>
            <CreateMultiSigModal
              price={price}
              selectedChainId={selectedChainId}
              mainnetProvider={mainnetProvider}
              address={address}
              tx={tx}
              writeContracts={writeContracts}
              contractName={"MultiSigFactory"}
              isCreateModalVisible={isCreateModalVisible}
              setIsCreateModalVisible={setIsCreateModalVisible}
            />
            <Select
              value={[currentMultiSigAddress]}
              style={{ width: 120, marginRight: 5 }}
              onChange={handleMultiSigChange}
            >
              {multiSigs.map((address, index) => (
                <Option key={index} value={address}>
                  {address}
                </Option>
              ))}
            </Select>
            {networkSelect}
            <Button style={{ marginLeft: 10 }}>waku:{wakuStatus}</Button>
          </div>
          <ImportMultiSigModal
            mainnetProvider={mainnetProvider}
            targetNetwork={targetNetwork}
            networkOptions={selectNetworkOptions}
            multiSigs={multiSigs}
            setMultiSigs={setMultiSigs}
            setCurrentMultiSigAddress={setCurrentMultiSigAddress}
            multiSigWalletABI={multiSigWalletABI}
            localProvider={localProvider}
          />
        </div>
      </div>
      <Menu
        disabled={!userHasMultiSigs}
        style={{ textAlign: "center", marginTop: 40 }}
        selectedKeys={[location.pathname]}
        mode="horizontal"
      >
        <Menu.Item key="/">
          <Link to="/">MultiSig</Link>
        </Menu.Item>
        <Menu.Item key="/create">
          <Link to="/create">Propose Transaction</Link>
        </Menu.Item>
        <Menu.Item key="/pool">
          <Link to="/pool">Pool</Link>
        </Menu.Item>
      </Menu>

      <Switch>
        <Route exact path="/">
          {!userHasMultiSigs ? (
            <Row style={{ marginTop: 40 }}>
              <Col span={12} offset={6}>
                <Alert
                  message={
                    <>
                      ✨{" "}
                      <Button onClick={() => setIsCreateModalVisible(true)} type="link" style={{ padding: 0 }}>
                        Create
                      </Button>{" "}
                      or select your Multi-Sig ✨
                    </>
                  }
                  type="info"
                />
              </Col>
            </Row>
          ) : (
            <Home
              contractAddress={currentMultiSigAddress}
              localProvider={localProvider}
              price={price}
              mainnetProvider={mainnetProvider}
              blockExplorer={blockExplorer}
              executeTransactionEvents={executeTransactionEvents}
              contractName={contractName}
              readContracts={readContracts}
              ownerEvents={ownerEvents}
              signaturesRequired={signaturesRequired}
            />
          )}
        </Route>
        <Route path="/create">
          <CreateTransaction
            contractName={contractName}
            contractAddress={contractAddress}
            mainnetProvider={mainnetProvider}
            localProvider={localProvider}
            price={price}
            tx={tx}
            readContracts={readContracts}
            userSigner={userSigner}
            DEBUG={DEBUG}
            nonce={nonce}
            blockExplorer={blockExplorer}
            signaturesRequired={signaturesRequired}
            wakuLightPush={wakuLightPush}
          />
        </Route>
        <Route path="/pool">
          <Transactions
            contractName={contractName}
            address={address}
            userSigner={userSigner}
            mainnetProvider={mainnetProvider}
            localProvider={localProvider}
            yourLocalBalance={yourLocalBalance}
            price={price}
            tx={tx}
            writeContracts={writeContracts}
            readContracts={readContracts}
            blockExplorer={blockExplorer}
            nonce={nonce}
            wakuLightPush={wakuLightPush}
            contractAddress={currentMultiSigAddress}
            signaturesRequired={signaturesRequired}
            wakuTransactions={transactions}
          />
        </Route>
        <Route exact path="/debug">
          <Contract
            name={"MultiSigFactory"}
            price={price}
            signer={userSigner}
            provider={localProvider}
            address={address}
            blockExplorer={blockExplorer}
            contractConfig={contractConfig}
          />
        </Route>
        <Route path="/hints">
          <Hints
            address={address}
            yourLocalBalance={yourLocalBalance}
            mainnetProvider={mainnetProvider}
            price={price}
          />
        </Route>
        <Route path="/mainnetdai">
          <Contract
            name="DAI"
            customContract={mainnetContracts && mainnetContracts.contracts && mainnetContracts.contracts.DAI}
            signer={userSigner}
            provider={mainnetProvider}
            address={address}
            blockExplorer="https://etherscan.io/"
            contractConfig={contractConfig}
            chainId={1}
          />
          {/*
            <Contract
              name="UNI"
              customContract={mainnetContracts && mainnetContracts.contracts && mainnetContracts.contracts.UNI}
              signer={userSigner}
              provider={mainnetProvider}
              address={address}
              blockExplorer="https://etherscan.io/"
            />
            */}
        </Route>
        <Route path="/subgraph">
          <Subgraph
            subgraphUri={props.subgraphUri}
            tx={tx}
            writeContracts={writeContracts}
            mainnetProvider={mainnetProvider}
          />
        </Route>
      </Switch>

      {/* 🗺 Extra UI like gas price, eth price, faucet, and support: */}
      <div style={{ position: "fixed", textAlign: "left", left: 0, bottom: 20, padding: 10 }}>
        <Row align="middle" gutter={[4, 4]}>
          <Col span={8}>
            <Ramp price={price} address={address} networks={NETWORKS} />
          </Col>

          <Col span={8} style={{ textAlign: "center", opacity: 0.8 }}>
            <GasGauge gasPrice={gasPrice} />
          </Col>
          <Col span={8} style={{ textAlign: "center", opacity: 1 }}>
            <Button
              onClick={() => {
                window.open("https://t.me/joinchat/KByvmRe5wkR-8F_zz6AjpA");
              }}
              size="large"
              shape="round"
            >
              <span style={{ marginRight: 8 }} role="img" aria-label="support">
                💬
              </span>
              Support
            </Button>
          </Col>
        </Row>

        <Row align="middle" gutter={[4, 4]}>
          <Col span={24}>
            {
              /*  if the local provider has a signer, let's show the faucet:  */
              faucetAvailable ? (
                <Faucet localProvider={localProvider} price={price} ensProvider={mainnetProvider} />
              ) : (
                ""
              )
            }
          </Col>
        </Row>
      </div>
    </div>
  );
}

export default App;
