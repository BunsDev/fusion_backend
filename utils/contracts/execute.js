require("dotenv").config();
const ethers = require("ethers");
const { ethToErc20 } = require("../common");

const getGasEstimates = async (
  provider,
  forwarder,
  forwardRequest,
  currentChain
) => {
  const gasEstimate = Number(
    await forwarder.estimateGas.execute(
      forwardRequest,
      "0x0000000000000000000000000000000000000000",
      "0",
      "0",
      "0"
    )
  );

  const gasPrice = Number(await provider.getGasPrice());
  const baseGas = currentChain.baseGas;
  const estimateFees = (
    (gasEstimate + baseGas + currentChain.cautionGas) *
    gasPrice
  ).toFixed(0);

  return {
    gasEstimate,
    gasPrice,
    baseGas,
    estimateFees,
  };
};

const verifyExecutePayload = async (
  forwardRequest,
  forwarder,
  currentChain
) => {
  const constructedMessage = {
    from: forwardRequest.from,
    recipient: forwardRequest.recipient,
    deadline: forwardRequest.deadline,
    nonce: Number(await forwarder.nonces(forwardRequest.from)),
    gas: forwardRequest.gas,
    proof: forwardRequest.proof,
    to: forwardRequest.to,
    value: forwardRequest.value,
    data: forwardRequest.data,
  };

  const data712 = {
    types: {
      ForwardExecute: [
        { name: "from", type: "address" },
        { name: "recipient", type: "address" },
        { name: "deadline", type: "uint256" },
        { name: "nonce", type: "uint256" },
        { name: "gas", type: "uint256" },
        { name: "proof", type: "bytes" },
        { name: "to", type: "address" },
        { name: "value", type: "uint256" },
        { name: "data", type: "bytes" },
      ],
    },
    domain: {
      name: "Fusion Forwarder",
      version: "1",
      chainId: currentChain.chainId,
      verifyingContract: currentChain.addresses.FusionForwarder,
    },
    message: constructedMessage,
  };

  const isSignatureValid = ethers.utils.verifyTypedData(
    data712.domain,
    data712.types,
    data712.message,
    forwardRequest.signature
  );

  return isSignatureValid;
};

const getGasEstimatesErc20 = async (
  provider,
  forwarder,
  forwardRequest,
  currentChain,
  currentToken
) => {
  const gasEstimate = Number(
    await forwarder.estimateGas.execute(
      forwardRequest,
      currentToken.address,
      "0",
      "0",
      "0"
    )
  );

  const ethGas = Number(await provider.getGasPrice());
  const gasPrice = Number(await ethToErc20(currentToken, ethGas));
  const baseGas = currentChain.baseGas;
  const estimateFees = (
    (gasEstimate + baseGas + currentChain.cautionGas) *
    gasPrice
  ).toFixed(0);

  return {
    gasEstimate,
    gasPrice,
    ethGas,
    baseGas,
    estimateFees,
  };
};

const getGaslessEstimates = async (
  provider,
  forwarder,
  forwardRequest,
  currentChain
) => {
  const gasEstimate = Number(
    await forwarder.estimateGas.execute(
      forwardRequest,
      "0x0000000000000000000000000000000000000000",
      "0",
      "0",
      "0"
    )
  );

  const ethGas = Number(await provider.getGasPrice());
  const gasPrice = Number(
    await ethToErc20(
      {
        id: currentChain.id,
        convert_id: currentChain.convert_id,
      },
      ethGas
    )
  );
  const baseGas = currentChain.baseGas;
  const estimateFees = (
    (gasEstimate + baseGas + currentChain.cautionGas) *
    gasPrice
  ).toFixed(0);

  return {
    gasEstimate,
    gasPrice,
    ethGas,
    baseGas,
    estimateFees,
  };
};

module.exports = {
  getGasEstimates,
  verifyExecutePayload,
  getGasEstimatesErc20,
  getGaslessEstimates,
};
