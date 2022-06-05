// deploy/00_deploy_your_contract.js

module.exports = async ({ getNamedAccounts, deployments }) => {
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  await deploy("MultiSigFactory", {
    from: deployer,
    log: true,
    waitConfirmations: 5,
  });
};

module.exports.tags = ["MultiSigFactory"];
