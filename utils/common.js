require("dotenv").config();
const ethers = require("ethers");
const axios = require("axios");

const ethToErc20 = async (currentToken, amount) => {
  const headers = {
    "X-CMC_PRO_API_KEY": process.env.COIN_MARKET_CAP_API_KEY,
  };

  const formatAmount = ethers.utils.formatEther(amount);

  const response = await axios.get(
    `https://pro-api.coinmarketcap.com/v2/tools/price-conversion?amount=1&convert_id=${currentToken.convert_id}&id=${currentToken.id}`,
    { headers }
  );

  if (response.data.status.error_code !== 0) {
    throw new Error("Error converting ETH to ERC20");
  }

  return (
    response.data.data.quote[currentToken.convert_id].price *
    Number(formatAmount) *
    10 ** 18
  ).toFixed(0);
};

module.exports = {
  ethToErc20,
};
