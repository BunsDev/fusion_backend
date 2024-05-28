const express = require("express");
const router = express.Router();
require("dotenv").config();
const ethers = require("ethers");
const addressManager = require("../../lib/AddressManager.json");
const FusionProxyFactoryABI = require("../../lib/abi/FusionProxyFactory.json");
const { default: axios } = require("axios");

router.get("/:chainId/:domain", async (req, res) => {
  try {
    const { chainId, domain } = req.params;

    const currentChain = addressManager.find(
      (chain) => chain.chainId === Number(chainId)
    );

    if (!currentChain) {
      throw new Error("Chain not found");
    }

    const provider = new ethers.providers.JsonRpcProvider(currentChain.rpcUrl);

    const factory = new ethers.Contract(
      currentChain.addresses.FusionProxyFactory,
      FusionProxyFactoryABI,
      provider
    );

    const fusionProxy = await factory.getFusionProxy(domain);

    if (!fusionProxy || fusionProxy === ethers.constants.AddressZero) {
      throw new Error("Fusion Proxy not found");
    }

    const normalTx = await axios.get(
      currentChain.transactions.apiUrl +
        "?module=account&action=txlist&address=" +
        fusionProxy +
        "&startblock=0&endblock=99999999999999&page=1&offset=10&sort=asc&apikey=" +
        currentChain.transactions.apiKey
    );

    const internalTx = await axios.get(
      currentChain.transactions.apiUrl +
        "?module=account&action=txlistinternal&address=" +
        fusionProxy +
        "&startblock=0&endblock=99999999999999&page=1&offset=10&sort=asc&apikey=" +
        currentChain.transactions.apiKey
    );

    let erc20Tx = [];

    await Promise.all(
      currentChain.tokens.map(async (token) => {
        const tx = await axios.get(
          currentChain.transactions.apiUrl +
            "?module=account&action=tokentx&contractaddress=" +
            token.address +
            "&address=" +
            fusionProxy +
            "&startblock=0&endblock=99999999999999&page=1&offset=10&sort=asc&apikey=" +
            currentChain.transactions.apiKey
        );

        erc20Tx = [...tx.data.result, ...erc20Tx];
      })
    );

    let transactions = normalTx.data.result.concat(internalTx.data.result);
    transactions = transactions.concat(erc20Tx);

    const filteredTx = transactions.filter((tx) => {
      return tx.to !== null
        ? tx.to !== currentChain.addresses.FusionGasTank.toLowerCase() &&
            tx.to !== currentChain.addresses.PasswordVerifier.toLowerCase() &&
            tx.to !== currentChain.addresses.SignatureVerifier.toLowerCase() &&
            tx.from !== currentChain.addresses.FusionProxyFactory.toLowerCase()
        : false;
    });

    const sortedTx = filteredTx.sort(
      (a, b) => new Date(b.timestamp) - new Date(a.timestamp)
    );

    res.json(sortedTx);
  } catch (error) {
    console.error(error);
    res.json({ success: false, error: error.message });
  }
});

module.exports = router;
