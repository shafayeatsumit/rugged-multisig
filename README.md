![multisig logo](public/multisig_logo.gif)

# 🚀 Rugged MultiSig

A minimal clone of [gnosis-safe](https://gnosis-safe.io/) with one key difference [Rugged Multisig](https://github.com/shafayeatsumit/rugged-multisig) uses [Waku Connect](https://our.status.im/waku-decentralized-communication-for-web3/) as its indexer.

The purpose of multisig wallets is to increase security by requiring multiple parties to agree on transactions before execution. Transactions can be executed only when confirmed by a predefined number of owners

## 💡what problem does it solve?

Typical multi-sig wallets are able to achieve gas-less signatures by running a centralized indexer, aka transaction history service.

This indexer is a centralized piece, critical to the wallet functionality. As of any centralized infrastructure, the indexer can be subject to censorship, DDOS attacks or hosting failure.

Replacing the indexer by the decentralized Waku network would mitigate such risks.

### 🛠 Waku Implementation Detail

This project integrates Waku to multisig wallet for initiating multi-party multi-signature transactions.
When an owner of a safe initiates a Safe transaction, the transaction data will be broadcast to the Waku network with **symmetric encryption**, instead of sending to the centralized server.
Other owners who need to confirm the transaction would either receive the request via:

- Waku Relay, if they were online when the request was originally made, or,
- Waku Store, if they were offline when the request was originall made.

The content topic is versioned so that this workflow can be upgraded anytime.

# 🏄‍♂️ Quick Start

Prerequisites: [Node (v16 LTS)](https://nodejs.org/en/download/) plus [Yarn](https://classic.yarnpkg.com/en/docs/install/) and [Git](https://git-scm.com/downloads)

> clone/fork :

```bash
https://github.com/shafayeatsumit/rugged-multisig.git
```

> install and start your 👷‍ Hardhat chain:

```bash
cd rugged-multisig
yarn install
yarn chain
```

> in a second terminal window, start your 📱 frontend:

```bash
cd rugged-multisig
yarn start
```

> in a third terminal window, 🛰 deploy your contract:

```bash
cd waku-multi-sig-wallet
yarn deploy
```

📱 Open http://localhost:3000 to see the app

# 🧪 Test Coverage:

```
----------------------|----------|----------|----------|----------|----------------|
File                  |  % Stmts | % Branch |  % Funcs |  % Lines |Uncovered Lines |
----------------------|----------|----------|----------|----------|----------------|
 contracts/           |    95.31 |       50 |      100 |    95.77 |                |
  MultiSigFactory.sol |      100 |       50 |      100 |      100 |                |
  MultiSigWallet.sol  |    94.23 |       50 |      100 |    94.83 |    116,117,121 |
  TestERC20Token.sol  |      100 |      100 |      100 |      100 |                |
----------------------|----------|----------|----------|----------|----------------|
All files             |    95.31 |       50 |      100 |    95.77 |                |
----------------------|----------|----------|----------|----------|----------------|
```

# 📣 Shout Out:

- Thse project is built on top of [Scaffold-Eth](https://github.com/scaffold-eth/scaffold-eth). This boilerplate helps developer to quickly experiment with Solidity using a frontend that adapts to your smart contract.
- 🙏 [dec3ntraliz3d](https://github.com/dec3ntraliz3d) [Daniel](https://github.com/danielkhoo), [Soptq](https://github.com/Soptq), [Steven Slade](https://github.com/stevenpslade), [Austin Griffith](https://github.com/austintgriffith).

# 💌 P.S.

🌍 You need an RPC key for testnets and production deployments, create an [Alchemy](https://www.alchemy.com/) account and replace the value of `ALCHEMY_KEY = xxx` in `packages/react-app/src/constants.js` with your new key.

📣 Make sure you update the `InfuraID` before you go to production. Huge thanks to [Infura](https://infura.io/) for our special account that fields 7m req/day!
