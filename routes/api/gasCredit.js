const express = require("express");
const router = express.Router();
require("dotenv").config();
const ethers = require("ethers");
const addressManager = require("../../lib/AddressManager.json");
const FusionVaultABI = require("../../lib/abi/FusionVault.json");
const FusionProxyFactoryABI = require("../../lib/abi/FusionProxyFactory.json");

const {
  getDomainBalance,
  depositAndIndex,
  checkValidTx,
} = require("../../utils/subchain");

router.post("/native/verify/:chainId", async (req, res) => {
  try {
    const chainId = req.params.chainId;

    if (!chainId) {
      return res.json({
        success: false,
        error: "Chain ID is required",
      });
    }

    const tx = req.query.tx;

    if (!tx) {
      return res.json({
        success: false,
        error: "Transaction hash is required",
      });
    }

    const domain = req.query.domain;

    if (!domain) {
      return res.json({
        success: false,
        error: "Domain is required",
      });
    }

    const currentChain = addressManager.find(
      (chain) => chain.chainId === Number(chainId)
    );

    if (!currentChain) {
      return res.json({
        success: false,
        error: "Chain not found",
      });
    }

    // Check if transaction is already registered
    const isTxRegisted = checkValidTx(tx, Number(chainId));

    if (isTxRegisted) {
      return res.json({
        success: false,
        error: "Transaction already registered",
      });
    }

    const provider = new ethers.providers.JsonRpcProvider(currentChain.rpcUrl);

    let factory = new ethers.Contract(
      currentChain.addresses.FusionProxyFactory,
      FusionProxyFactoryABI,
      provider
    );

    // Get Fusion proxy address
    const FusionAddress = await factory.getFusionProxy(domain);

    if (!FusionAddress) {
      return res.json({
        success: false,
        error: "Fusion proxy not found in this chain",
      });
    }

    // Get transaction details
    const transaction = await provider.getTransaction(tx);

    if (!transaction) {
      return res.json({ success: false, error: "Transaction not found" });
    }

    const block = await provider.getBlock(transaction.blockHash);

    const FusionVault = new ethers.Contract(
      currentChain.addresses.FusionVault,
      FusionVaultABI,
      provider
    );

    const snapshotTime = await FusionVault.snapshotTime();

    if (Number(block.timestamp) < Number(snapshotTime)) {
      return res.json({
        success: false,
        error: "Transaction is before snapshot time",
      });
    }

    const receipt = await provider.getTransactionReceipt(tx);

    const iface = new ethers.utils.Interface(FusionVaultABI);
    // Parse logs
    const event = receipt.logs.find(
      (log) => log.address === currentChain.addresses.FusionVault
    );

    if (!event) {
      return res.json({
        success: false,
        error: "Invalid Fusion vault address",
      });
    }

    // Find DepositReceived event
    const requiredEvent = {
      parsedLog: iface.parseLog(event),
      address: event.address,
    };

    if (requiredEvent.parsedLog.name !== "DepositReceived") {
      return res.json({
        success: false,
        error: "No DepositReceived event found",
      });
    }

    // Get event details
    const { tokenAddress, sender, amount } = {
      tokenAddress: requiredEvent.parsedLog.args[0],
      sender: requiredEvent.parsedLog.args[1],
      amount: Number(requiredEvent.parsedLog.args[2]),
    };

    if (tokenAddress !== ethers.constants.AddressZero) {
      return res.json({
        success: false,
        error: "Invalid token address",
      });
    }

    // Check if amount is valid
    if (
      amount !== currentChain.creditCost &&
      !(
        amount > currentChain.creditCost &&
        amount % currentChain.creditCost === 0
      )
    ) {
      return res.json({
        success: false,
        error: "Invalid gas credit amount",
      });
    }

    // Check if sender address is valid
    if (sender !== FusionAddress) {
      return res.json({
        success: false,
        error: "Invalid sender address",
      });
    }

    await depositAndIndex(
      domain,
      chainId,
      tx,
      amount / currentChain.creditCost
    );

    return res.json({
      success: true,
      message: "Transaction verified",
    });
  } catch (err) {
    console.error(err);
    res.json({ success: false, error: err.message });
  }
});

router.get("/balance/:domain", async (req, res) => {
  try {
    const domain = req.params.domain;

    if (!domain) {
      return res.json({
        success: false,
        error: "Domain is required",
      });
    }

    const senderBalance = await getDomainBalance(domain);

    return res.json({
      success: true,
      senderBalance: Number(senderBalance),
    });
  } catch (err) {
    console.error(err);
    res.json({ success: false, error: err.message });
  }
});

router.post("/erc20/verify/:chainId", async (req, res) => {
  try {
    const chainId = req.params.chainId;

    if (!chainId) {
      return res.json({
        success: false,
        error: "Chain ID is required",
      });
    }

    const erc20Address = req.query.address;

    if (!erc20Address) {
      return res.json({
        success: false,
        error: "ERC20 address is required",
      });
    }

    const tx = req.query.tx;

    if (!tx) {
      return res.json({
        success: false,
        error: "Transaction hash is required",
      });
    }

    const domain = req.query.domain;

    if (!domain) {
      return res.json({
        success: false,
        error: "Domain is required",
      });
    }

    const currentChain = addressManager.find(
      (chain) => chain.chainId === Number(chainId)
    );

    if (!currentChain) {
      return res.json({
        success: false,
        error: "Chain not found",
      });
    }

    const currentToken = currentChain.tokens.find(
      (token) => token.address === erc20Address
    );

    if (!currentToken) {
      return res.json({
        success: false,
        error: "Invalid token address",
      });
    }

    // Check if transaction is already registered
    const isTxRegisted = checkValidTx(tx, Number(chainId));

    if (isTxRegisted) {
      return res.json({
        success: false,
        error: "Transaction already registered",
      });
    }

    const provider = new ethers.providers.JsonRpcProvider(currentChain.rpcUrl);

    let factory = new ethers.Contract(
      currentChain.addresses.FusionProxyFactory,
      FusionProxyFactoryABI,
      provider
    );

    // Get Fusion proxy address
    const FusionAddress = await factory.getFusionProxy(domain);

    if (!FusionAddress) {
      return res.json({
        success: false,
        error: "Fusion proxy not found in this chain",
      });
    }

    // Get transaction details
    const transaction = await provider.getTransaction(tx);

    const block = await provider.getBlock(transaction.blockHash);

    const FusionVault = new ethers.Contract(
      currentChain.addresses.FusionVault,
      FusionVaultABI,
      provider
    );

    const snapshotTime = await FusionVault.snapshotTime();

    if (Number(block.timestamp) < Number(snapshotTime)) {
      return res.json({
        success: false,
        error: "Transaction is before snapshot time",
      });
    }

    if (!transaction) {
      return res.json({ success: false, error: "Transaction not found" });
    }

    const receipt = await provider.getTransactionReceipt(tx);

    const iface = new ethers.utils.Interface(FusionVaultABI);
    // Parse logs
    const event = receipt.logs.find(
      (log) => log.address === currentChain.addresses.FusionVault
    );

    if (!event) {
      return res.json({
        success: false,
        error: "Invalid Fusion vault address",
      });
    }

    // Find DepositReceived event
    const requiredEvent = {
      parsedLog: iface.parseLog(event),
      address: event.address,
    };

    if (requiredEvent.parsedLog.name !== "DepositReceived") {
      return res.json({
        success: false,
        error: "No DepositReceived event found",
      });
    }

    // Get event details
    const { tokenAddress, sender, amount } = {
      tokenAddress: requiredEvent.parsedLog.args[0],
      sender: requiredEvent.parsedLog.args[1],
      amount: Number(requiredEvent.parsedLog.args[2]),
    };

    if (tokenAddress !== currentToken.address) {
      return res.json({
        success: false,
        error: "Invalid token address",
      });
    }

    // Check if amount is valid
    if (
      amount !== currentToken.creditCost &&
      !(
        amount > currentToken.creditCost &&
        amount % currentToken.creditCost === 0
      )
    ) {
      return res.json({
        success: false,
        error: "Invalid gas credit amount",
      });
    }

    // Check if sender address is valid
    if (sender !== FusionAddress) {
      return res.json({
        success: false,
        error: "Invalid sender address",
      });
    }

    // Update sender balance
    await depositAndIndex(
      domain,
      chainId,
      tx,
      amount / currentToken.creditCost
    );

    return res.json({
      success: true,
      senderBalance: {
        domain: senderBalance.domain,
        balance: senderBalance.balance,
      },
    });
  } catch (err) {
    console.error(err);
    res.json({ success: false, error: err.message });
  }
});

router.get("/getPrice", (req, res) => {
  let updates = addressManager.map((chain) => {
    let tokens = chain.tokens.map((token) => {
      return {
        address: token.address,
        creditCost: token.creditCost,
      };
    });

    tokens.push({
      address: null,
      creditCost: chain.creditCost,
    });

    return {
      chainId: chain.chainId,
      creditPertx: chain.creditPerTx,
      tokens: tokens,
    };
  });

  res.json({ success: true, updates });
});

module.exports = router;
