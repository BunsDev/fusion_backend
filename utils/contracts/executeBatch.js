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
    await forwarder.estimateGas.executeBatch(
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

const verifyExecuteBatchPayload = async (
  forwardRequest,
  forwarder,
  currentChain
) => {
  const to = forwardRequest.to;
  let toHash = ethers.constants.HashZero;
  for (let i = 0; i < to.length; i++) {
    toHash = ethers.utils.keccak256(
      ethers.utils.solidityPack(["bytes32", "address"], [toHash, to[i]])
    );
  }

  const value = forwardRequest.value;
  let valueHash = ethers.constants.HashZero;
  for (let i = 0; i < value.length; i++) {
    valueHash = ethers.utils.keccak256(
      ethers.utils.solidityPack(["bytes32", "uint256"], [valueHash, value[i]])
    );
  }

  const dataArray = forwardRequest.data;
  let dataHash = ethers.constants.HashZero;
  for (let i = 0; i < dataArray.length; i++) {
    dataHash = ethers.utils.keccak256(
      ethers.utils.solidityPack(
        ["bytes32", "bytes32"],
        [dataHash, ethers.utils.keccak256(dataArray[i])]
      )
    );
  }

  const constructedMessage = {
    from: forwardRequest.from,
    recipient: forwardRequest.recipient,
    deadline: forwardRequest.deadline,
    nonce: Number(await forwarder.nonces(forwardRequest.from)),
    gas: forwardRequest.gas,
    proof: forwardRequest.proof,
    to: toHash,
    value: valueHash,
    data: dataHash,
  };

  const data712 = {
    types: {
      ForwardExecuteBatch: [
        { name: "from", type: "address" },
        { name: "recipient", type: "address" },
        { name: "deadline", type: "uint256" },
        { name: "nonce", type: "uint256" },
        { name: "gas", type: "uint256" },
        { name: "proof", type: "bytes" },
        { name: "to", type: "bytes32" },
        { name: "value", type: "bytes32" },
        { name: "data", type: "bytes32" },
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
    await forwarder.estimateGas.executeBatch(
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
    await forwarder.estimateGas.executeBatch(
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
  verifyExecuteBatchPayload,
  getGasEstimatesErc20,
  getGaslessEstimates,
};
