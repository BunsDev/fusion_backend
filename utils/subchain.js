const ethers = require("ethers");
const subchain = require("../lib/subchain.json");
const BalanceHandlerABI = require("../lib/abi/BalanceHandler.json");
const IndexerProxyFactoryABI = require("../lib/abi/IndexerProxyFactory.json");
const IndexerABI = require("../lib/abi/Indexer.json");

const getDomainBalance = async (domain) => {
  const provider = new ethers.providers.JsonRpcProvider(subchain.rpcUrl);

  const balanceHandler = new ethers.Contract(
    subchain.addresses.BalanceHandler,
    BalanceHandlerABI,
    provider
  );

  const domainBalance = await balanceHandler.checkBalance(domain);

  return Number(domainBalance);
};

const depositAndIndex = async (domain, chainId, txHash) => {
  const provider = new ethers.providers.JsonRpcProvider(subchain.rpcUrl);

  const balanceHandler = new ethers.Contract(
    subchain.addresses.BalanceHandler,
    BalanceHandlerABI,
    provider
  );

  const keypair = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

  const data = balanceHandler.interface.encodeFunctionData("DepositAndIndex", [
    domain,
    chainId,
    txHash,
  ]);

  const unSignedTx = {
    to: subchain.addresses.BalanceHandler,
    data,
    value: 0,
    gasLimit: 2000000,
  };

  const signedTx = await keypair.sendTransaction(unSignedTx);

  const receipt = await signedTx.wait();

  return receipt;
};

const withdrawFees = async (domain, estimateFees) => {
  const provider = new ethers.providers.JsonRpcProvider(subchain.rpcUrl);

  const balanceHandler = new ethers.Contract(
    subchain.addresses.BalanceHandler,
    BalanceHandlerABI,
    provider
  );

  const keypair = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

  const data = balanceHandler.interface.encodeFunctionData("WithdrawFees", [
    domain,
    Number(estimateFees).toFixed(0),
  ]);

  const unSignedTx = {
    to: subchain.addresses.BalanceHandler,
    data,
    value: 0,
    gasLimit: 2000000,
  };

  const signedTx = await keypair.sendTransaction(unSignedTx);

  const receipt = await signedTx.wait();

  return receipt;
};

const checkValidTx = async (txHash, chainId) => {
  const provider = new ethers.providers.JsonRpcProvider(subchain.rpcUrl);

  const indexerProxyFactory = new ethers.Contract(
    subchain.addresses.IndexerProxyFactory,
    IndexerProxyFactoryABI,
    provider
  );

  const keypair = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

  const indexer = await indexerProxyFactory.getIndexerProxy(
    chainId,
    keypair.address
  );

  if (indexer === ethers.constants.AddressZero) {
    throw new Error("Indexer not found");
  }

  const indexerContract = new ethers.Contract(indexer, IndexerABI, provider);

  const isValid = await indexerContract.isTxDuplicate(txHash);

  if (isValid) {
    throw new Error("Transaction is already indexed");
  }

  return isValid;
};

module.exports = {
  getDomainBalance,
  depositAndIndex,
  withdrawFees,
  checkValidTx,
};
