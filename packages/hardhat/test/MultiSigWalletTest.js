const { ethers } = require("hardhat");
const { expect } = require("chai");

const unorderedSigException =
  "VM Exception while processing transaction: reverted with reason string 'executeTransaction: duplicate or unordered signatures";

describe("MultiSigWallet Test", () => {
  let metaMultiSigWallet;
  let owner;
  let addr1;
  let addr2;
  let addr3;
  let addrs;

  let provider;
  let signer;
  let multiSigWallet;
  const CHAIN_ID = 1;
  const signatureRequired = 1; // Starting with something straithforward

  beforeEach(async () => {
    [owner, addr1, addr2, addr3, ...addrs] = await ethers.getSigners();
    const multiSigWalletFactory = await ethers.getContractFactory(
      "MultiSigWallet"
    );
    console.log("owner address", owner.address);
    multiSigWallet = await multiSigWalletFactory.deploy(
      CHAIN_ID,
      [owner.address],
      signatureRequired
    );

    await owner.sendTransaction({
      to: multiSigWallet.address,
      value: ethers.utils.parseEther("1.0"),
    });
    provider = owner.provider;
  });

  describe("Testing MultiSigWallet", () => {
    it("isSigner should return true for the owner address", async () => {
      expect(await multiSigWallet.isOwner(owner.address)).to.equal(true);
    });
  });
  describe("Testing MetaMultiSigWallet functionality", () => {
    it("Adding and Remove signer", async () => {
      const newSigner = addr1.address;
      let nonce = await multiSigWallet.nonce();
      const to = multiSigWallet.address;
      const value = 0;
      console.log("nonce", nonce);

      let callData = multiSigWallet.interface.encodeFunctionData("addSigner", [
        newSigner,
        2,
      ]);
      let hash = await multiSigWallet.getTransactionHash(
        nonce,
        to,
        value,
        callData
      );

      const signature = await owner._signer.signMessage(
        ethers.utils.arrayify(hash)
      );

      const ownerAddress = await multiSigWallet.recover(hash, signature);
      expect(ownerAddress).to.equal(owner.address);

      await multiSigWallet.executeTransaction(
        multiSigWallet.address,
        value,
        callData,
        [signature]
      );
      expect(await multiSigWallet.isOwner(newSigner)).to.equal(true);
      expect(await multiSigWallet.signaturesRequired()).to.equal(2);
      // remove signer
      callData = multiSigWallet.interface.encodeFunctionData("removeSigner", [
        newSigner,
        1,
      ]);

      nonce = await multiSigWallet.nonce();
      hash = await multiSigWallet.getTransactionHash(
        nonce,
        to,
        value,
        callData
      );

      const ownerSignature = await owner._signer.signMessage(
        ethers.utils.arrayify(hash)
      );
      const newSignerSignature = await addr1._signer.signMessage(
        ethers.utils.arrayify(hash)
      );

      // test unordered sig exception
      await expect(
        multiSigWallet.executeTransaction(
          multiSigWallet.address,
          value,
          callData,
          [ownerSignature, newSignerSignature]
        )
      ).to.be.revertedWith(unorderedSigException);

      await multiSigWallet.executeTransaction(
        multiSigWallet.address,
        value,
        callData,
        [newSignerSignature, ownerSignature]
      );

      expect(await multiSigWallet.isOwner(newSigner)).to.equal(false);
      expect(await multiSigWallet.signaturesRequired()).to.equal(1);
    });
  });
});
