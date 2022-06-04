// deploy/00_deploy_your_contract.js

module.exports = async ({ getNamedAccounts, deployments, getChainId }) => {
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();
  const chainId = await getChainId();

  await deploy("MultiSigWallet", {
    from: deployer,
    // args: [chainId, ["your contract address"], number_of_signers],
    args: [chainId, ["0x13E19A5B1AFAAF6Ca59E3FeaBaC71c46F123471f"], 1],
    log: true,
    waitConfirmations: 5,
  });
};
module.exports.tags = ["MultiSigWallet"];
