require("@nomiclabs/hardhat-waffle");
require("dotenv").config();

/**
 * @type import('hardhat/config').HardhatUserConfig
 */
module.exports = {
  networks: {
    aurora: {
      url: `https://mainnet.aurora.dev/8XTRMXkMYkrLcLxvv3oKJeG4eTMCeYWcrbCKMzAkBQ3`,
      accounts: [process.env.privateKey],
      blockGasLimit: 200000,
      allowUnlimitedContractSize: true,
    },
    fantom: {
      url: `https://rpc.ftm.tools/`,
      accounts: [process.env.privateKey],
      allowUnlimitedContractSize: true,
      blockGasLimit: 200000,

    },
  },
  solidity: {
    compilers: [
      { version: "0.8.7" },
      { version: "0.7.6" },
      { version: "0.6.6" }
    ]
  },
};
