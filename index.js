const Web3 = require("web3");
const HDWalletProvider = require("@truffle/hdwallet-provider");
const { getAbi, getAddress } = require("@uma/core");
const { parseFixed } = require("@ethersproject/bignumber");

// Optional arguments:
// --url: node url, by default points at http://localhost:8545.
// --mnemonic: an account mnemonic you'd like to use. The script will default to using the node's unlocked accounts.
// Mandatory arguments:
// --gasprice: gas price to use in GWEI
// --priceFeedIdentifier: price identifier to use.
// --collateralAddress: collateral token address.
// --expirationTimestamp: timestamp that the contract will expire at.
// --syntheticName: long name.
// --syntheticSymbol: short name.
// --minSponsorTokens: minimum sponsor position size
// --libraryAddress: post expiration financial product library address
// --liveness: liquidation and withdrawal liveness should be > (expiry timestamp - deploymenet timestamp)

const argv = require("minimist")(process.argv.slice(), {
  string: ["url", "mnemonic", "priceFeedIdentifier", "collateralAddress", "expirationTimestamp", "syntheticName", "syntheticSymbol", "minSponsorTokens", "libraryAddress", "liveness"]
});
if (!argv.priceFeedIdentifier) throw "--priceFeedIdentifier required";
if (!argv.collateralAddress) throw "--collateralAddress required";
if (!argv.expirationTimestamp) throw "--expirationTimestamp required";
if (!argv.syntheticName) throw "--syntheticName required";
if (!argv.syntheticSymbol) throw "--syntheticSymbol required";
if (!argv.minSponsorTokens) throw "--minSponsorTokens required";
if (!argv.gasprice) throw "--gasprice required (in GWEI)";
if (typeof argv.gasprice !== "number") throw "--gasprice must be a number";
if (argv.gasprice < 1 || argv.gasprice > 1000) throw "--gasprice must be between 1 and 1000 (GWEI)";
const libraryAddress = argv.libraryAddress ? argv.libraryAddress : "0xreplace";
const liveness = argv.liveness ? argv.liveness : 315360000; // ten years in seconds

// Wrap everything in an async function to allow the use of async/await.
(async () => {
  const url = argv.url || "http://localhost:8545";

  // See HDWalletProvider documentation: https://www.npmjs.com/package/@truffle/hdwallet-provider.
  const hdwalletOptions = {
    mnemonic: {
      phrase: argv.mnemonic,
    },
    providerOrUrl: url,
    addressIndex: 0, // Change this to use the nth account.
  };

  // Initialize web3 with an HDWalletProvider if a mnemonic was provided. Otherwise, just give it the url.
  const web3 = new Web3(argv.mnemonic ? new HDWalletProvider(hdwalletOptions) : url);
  const { toWei, utf8ToHex, padRight } = web3.utils;

  const accounts = await web3.eth.getAccounts();
  if (!accounts || accounts.length === 0)
    throw "No accounts. Must provide mnemonic or node must have unlocked accounts.";
  const account = accounts[0];
  const networkId = await web3.eth.net.getId();

  // Grab collateral decimals.
  const collateral = new web3.eth.Contract(
    getAbi("IERC20Standard"),
    argv.collateralAddress
  );
  const decimals = (await collateral.methods.decimals().call()).toString();


  // EMP Parameters. Pass in arguments to customize these.
  const empParams = {
    expirationTimestamp: argv.expirationTimestamp.toString(), // Timestamp that the contract will expire at.
    collateralAddress: argv.collateralAddress.toString(), // Collateral token address.
    priceFeedIdentifier: padRight(utf8ToHex(argv.priceFeedIdentifier.toString()), 64), // Price identifier to use.
    syntheticName: argv.syntheticName, // Long name.
    syntheticSymbol: argv.syntheticSymbol, // Short name.

    collateralRequirement: { rawValue: web3.utils.toBN(toWei("1")).addn(1).toString() }, // 100% collateral req is possible because position is always backed by 1 unit of collateral, as
                                                     // before expiry, as defined in the financialProductLibrary
    disputeBondPercentage: { rawValue: toWei("0.1") }, // 10% dispute bond.
    sponsorDisputeRewardPercentage: { rawValue: toWei("0.99999") }, // 100% reward for sponsors who are disputed invalidly (sponsors should never be disputed)
    disputerDisputeRewardPercentage: { rawValue: "0" }, // 0% reward for correct disputes (disputes should always be right).
    minSponsorTokens: { rawValue: parseFixed(argv.minSponsorTokens.toString(), decimals) }, // Minimum sponsor position size.
    liquidationLiveness: liveness, // 60 day default liquidation liveness.
    withdrawalLiveness: liveness, // 60 day default withdrawal liveness.
    financialProductLibraryAddress: libraryAddress, // this is required for covered calls
  };

  const empCreator = new web3.eth.Contract(
    getAbi("ExpiringMultiPartyCreator"),
    getAddress("ExpiringMultiPartyCreator", networkId)
  );

  // Transaction parameters
  const transactionOptions = {
    gas: 9000000, // 9MM is high. Set this lower if you only have < 2 ETH or so in your wallet.
    gasPrice: argv.gasprice * 1000000000, // gasprice arg * 1 GWEI
    from: account,
  };

  // Simulate transaction to test before sending to the network.
  // console.log("Simulating Deployment...");
  // const address = await empCreator.methods.createExpiringMultiParty(empParams).call(transactionOptions);
  // console.log("Simulation successful. Expected Address:", address);

  // Since the simulated transaction succeeded, send the real one to the network.
  const { transactionHash } = await empCreator.methods.createExpiringMultiParty(empParams).send(transactionOptions);
  console.log("Deployed in transaction:", transactionHash);
  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1); // Exit with a nonzero exit code to signal failure.
});
