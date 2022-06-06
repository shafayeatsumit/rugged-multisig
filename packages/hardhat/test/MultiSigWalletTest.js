const { ethers } = require("hardhat");
const { expect } = require("chai");

describe("MultiSigWallet Test", () => {
  let MultiSigFactory;
  let MultiSigWallet;
  let owner;
  let addr1;
  let addr2;

  let provider;

  const CHAIN_ID = 1; // I guess this number doesn't really matter
  const signatureRequired = 1; // Starting with something straithforward

  let TestERC20Token;
  const TEST_ERC20_TOKEN_TOTAL_SUPPLY = "100";

  // Running this before each test
  // Deploys MultiSigWallet and sets up some addresses for easier testing
  beforeEach(async function () {
    [owner, addr1, addr2] = await ethers.getSigners();

    const MultiSigFactoryContractFactory = await ethers.getContractFactory(
      "MultiSigFactory"
    );
    MultiSigFactory = await MultiSigFactoryContractFactory.deploy();

    await MultiSigFactory.create(CHAIN_ID, [owner.address], signatureRequired);
    const [multiSigWalletAddress] = await MultiSigFactory.getMultiSig(0);

    const MultiSigWalletContractFactory = await ethers.getContractFactory(
      "MultiSigWallet"
    );
    MultiSigWallet = await MultiSigWalletContractFactory.attach(
      multiSigWalletAddress
    );

    await owner.sendTransaction({
      to: MultiSigWallet.address,
      value: ethers.utils.parseEther("1.0"),
    });

    provider = owner.provider;

    // Create TestERC20Token token, minting 100 for the multiSigWallet
    const TestERC20TokenContractFactory = await ethers.getContractFactory(
      "TestERC20Token"
    );
    TestERC20Token = await TestERC20TokenContractFactory.deploy(
      MultiSigWallet.address,
      ethers.utils.parseEther(TEST_ERC20_TOKEN_TOTAL_SUPPLY)
    );
  });

  describe("Deployment", () => {
    it("isOwner should return true for the deployer owner address", async () => {
      expect(await MultiSigWallet.isOwner(owner.address)).to.equal(true);
    });

    it("Multi Sig Wallet should own all the TestERC20Token token", async () => {
      const MultiSigWalletTestERC20TokenBalance =
        await TestERC20Token.balanceOf(MultiSigWallet.address);

      expect(MultiSigWalletTestERC20TokenBalance).to.equal(
        ethers.utils.parseEther(TEST_ERC20_TOKEN_TOTAL_SUPPLY)
      );
    });
  });

  describe("Testing MultiSigWallet functionality", () => {
    it("Adding and Removing signer", async () => {
      const newSigner = addr1.address;

      const nonce = await MultiSigWallet.nonce();
      const to = MultiSigWallet.address;
      const value = 0;

      let callData = MultiSigWallet.interface.encodeFunctionData("addSigner", [
        newSigner,
        2,
      ]);

      let hash = await MultiSigWallet.getTransactionHash(
        nonce,
        to,
        value,
        callData
      );
      const signature = await owner.provider.send("eth_sign", [
        owner.address,
        hash,
      ]);

      // Double checking if owner address is recovered properly, executeTransaction would fail anyways
      expect(await MultiSigWallet.recover(hash, signature)).to.equal(
        owner.address
      );

      await MultiSigWallet.executeTransaction(to, value, callData, [signature]);

      expect(await MultiSigWallet.isOwner(newSigner)).to.equal(true);
      expect(await MultiSigWallet.signaturesRequired()).to.equal(2);

      callData = MultiSigWallet.interface.encodeFunctionData("removeSigner", [
        newSigner,
        1,
      ]);

      hash = await MultiSigWallet.getTransactionHash(
        nonce + 1,
        to,
        value,
        callData
      );

      const signatureOld = await owner.provider.send("eth_sign", [
        owner.address,
        hash,
      ]);
      const signatureNew = await owner.provider.send("eth_sign", [
        newSigner,
        hash,
      ]);
      expect(await MultiSigWallet.recover(hash, signatureOld)).to.equal(
        owner.address
      );
      expect(await MultiSigWallet.recover(hash, signatureNew)).to.equal(
        newSigner
      );
      await MultiSigWallet.executeTransaction(to, value, callData, [
        signatureNew,
        signatureOld,
      ]);
      expect(await MultiSigWallet.isOwner(newSigner)).to.equal(false);
      expect(await MultiSigWallet.signaturesRequired()).to.equal(1);
    });

    // I think this is a bug in MultiSigWallet which should be fixed, same for addSigner/removeSigner where newSignaturesRequired is used
    it("Update Signatures Required to 2 - locking all the funds in the wallet, becasuse there is only 1 signer", async () => {
      const nonce = await MultiSigWallet.nonce();
      const to = MultiSigWallet.address;
      const value = 0;

      const callData = MultiSigWallet.interface.encodeFunctionData(
        "updateSignaturesRequired",
        [2]
      );

      const hash = await MultiSigWallet.getTransactionHash(
        nonce,
        to,
        value,
        callData
      );
      const signature = await owner.provider.send("eth_sign", [
        owner.address,
        hash,
      ]);

      // Double checking if owner address is recovered properly, executeTransaction would fail anyways
      expect(await MultiSigWallet.recover(hash, signature)).to.equal(
        owner.address
      );

      await MultiSigWallet.executeTransaction(to, value, callData, [signature]);

      expect(await MultiSigWallet.signaturesRequired()).to.equal(2);
    });

    it("Transferring 0.1 eth to addr1", async () => {
      const addr1BeforeBalance = await provider.getBalance(addr1.address);

      const nonce = await MultiSigWallet.nonce();
      const to = addr1.address;
      const value = ethers.utils.parseEther("0.1");

      const callData = "0x00"; // This can be anything, we could send a message

      const hash = await MultiSigWallet.getTransactionHash(
        nonce,
        to,
        value.toString(),
        callData
      );
      const signature = await owner.provider.send("eth_sign", [
        owner.address,
        hash,
      ]);

      await MultiSigWallet.executeTransaction(to, value.toString(), callData, [
        signature,
      ]);

      const addr1Balance = await provider.getBalance(addr1.address);

      expect(addr1Balance).to.equal(addr1BeforeBalance.add(value));
    });

    it("Allowing addr1 to spend 10 TestERC20Tokens. Then addr1 transfers the TestERC20Tokens to addr2", async () => {
      const amount = ethers.utils.parseEther("10");

      const nonce = await MultiSigWallet.nonce();
      const to = TestERC20Token.address;
      const value = 0;

      const callData = TestERC20Token.interface.encodeFunctionData("approve", [
        addr1.address,
        amount,
      ]);

      const hash = await MultiSigWallet.getTransactionHash(
        nonce,
        to,
        value.toString(),
        callData
      );
      const signature = await owner.provider.send("eth_sign", [
        owner.address,
        hash,
      ]);

      await MultiSigWallet.executeTransaction(to, value.toString(), callData, [
        signature,
      ]);

      const MultiSigWallet_addr1Allowance = await TestERC20Token.allowance(
        MultiSigWallet.address,
        addr1.address
      );
      expect(MultiSigWallet_addr1Allowance).to.equal(amount);

      await TestERC20Token.connect(addr1).transferFrom(
        MultiSigWallet.address,
        addr2.address,
        amount
      );

      const addr2TestERC20TokenBalance = await TestERC20Token.balanceOf(
        addr2.address
      );
      expect(addr2TestERC20TokenBalance).to.equal(amount);
    });
  });
});
