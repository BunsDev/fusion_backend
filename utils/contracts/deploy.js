require("dotenv").config();
const ethers = require("ethers");
const FusionProxyFactoryABI = require("../../lib/abi/FusionProxyFactory.json");
const FactoryForwarderABI = require("../../lib/abi/FactoryForwarder.json");
const FusionABI = require("../../lib/abi/Fusion.json");

const deployBase = async (currentChain, forwardRequest) => {
  const provider = new ethers.providers.JsonRpcProvider(currentChain.rpcUrl);

  const signer = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

  // Check if the domain is already taken
  const factory = new ethers.Contract(
    currentChain.addresses.FusionProxyFactory,
    FusionProxyFactoryABI,
    signer
  );

  const isDomainTaken = await checkDomain(factory, forwardRequest.domain);

  if (isDomainTaken) {
    throw new Error("Domain is already taken");
  }

  const forwarder = new ethers.Contract(
    currentChain.addresses.FactoryForwarder,
    FactoryForwarderABI,
    signer
  );

  // Encode the function data
  const data = forwarder.interface.encodeFunctionData("execute", [
    "0x",
    forwardRequest,
  ]);

  // Estimate Gas Price
  const gasPrice = Number(await provider.getGasPrice());

  const unSignedTx = {
    to: currentChain.addresses.FactoryForwarder,
    data,
    value: 0,
    gasLimit: 2000000,
    gasPrice,
  };

  const signedTx = await signer.sendTransaction(unSignedTx);

  const receipt = await signedTx.wait();

  return receipt;
};

const checkDomain = async (factory, domain) => {
  const isDomainTaken = await factory.domainExists(domain);

  return isDomainTaken;
};

const resolveHashAndNonce = async (
  baseFactory,
  chainDeployRequest,
  baseProvider
) => {
  const baseFusionAddress = await baseFactory.getFusionProxy(
    chainDeployRequest.domain
  );

  const baseFusion = new ethers.Contract(
    baseFusionAddress,
    FusionABI,
    baseProvider
  );

  const nonce = await baseFusion.getNonce();
  const messageHash = ethers.utils.hashMessage(nonce.toString());

  const hash = await baseFusion.TxHash();

  return {
    messageHash,
    hash,
    baseFusionAddress,
  };
};

const deployExternal = async (
  provider,
  currentChain,
  chainDeployRequest,
  serverProof
) => {
  const signer = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

  const forwarderExternal = new ethers.Contract(
    currentChain.addresses.FactoryForwarder,
    FactoryForwarderABI,
    signer
  );

  const message = {
    from: signer.address,
    recipient: currentChain.addresses.FusionProxyFactory,
    deadline: Number((Date.now() / 1000).toFixed(0)) + 2000,
    nonce: Number(await forwarderExternal.nonces(signer.address)),
    gas: 1000000,
    domain: chainDeployRequest.domain,
    initializer: chainDeployRequest.initializer,
  };

  const data712 = {
    types: {
      ForwardDeploy: [
        { name: "from", type: "address" },
        { name: "recipient", type: "address" },
        { name: "deadline", type: "uint48" },
        { name: "nonce", type: "uint256" },
        { name: "gas", type: "uint256" },
        { name: "domain", type: "string" },
        { name: "initializer", type: "bytes" },
      ],
    },
    domain: {
      name: "Fusion Forwarder",
      version: "1",
      chainId: currentChain.chainId,
      verifyingContract: currentChain.addresses.FactoryForwarder,
    },
    message: message,
  };

  const signature = await signer._signTypedData(
    data712.domain,
    data712.types,
    data712.message
  );

  const forwardRequest = {
    from: message.from,
    recipient: message.recipient,
    deadline: message.deadline,
    gas: message.gas,
    serverProof: message.serverProof,
    domain: message.domain,
    initializer: message.initializer,
    signature: signature,
  };

  const data = forwarderExternal.interface.encodeFunctionData("execute", [
    serverProof,
    forwardRequest,
  ]);

  // Estimate Gas Price
  const gasPrice = Number(await provider.getGasPrice());

  const unSignedTx = {
    to: currentChain.addresses.FactoryForwarder,
    data,
    value: 0,
    gasLimit: 2000000,
    gasPrice,
  };

  const signedTx = await signer.sendTransaction(unSignedTx);

  const receipt = await signedTx.wait();

  return receipt;
};

const deployRequest = async (
  provider,
  currentChain,
  chainDeployRequest,
  serverProof
) => {
  const signer = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

  const fusionProxyFactory = new ethers.Contract(
    currentChain.addresses.FusionProxyFactory,
    FusionProxyFactoryABI,
    signer
  );

  const data = fusionProxyFactory.interface.encodeFunctionData(
    "createProxyWithRequest",
    [serverProof, chainDeployRequest.domain, chainDeployRequest.initializer]
  );

  // Estimate Gas Price
  const gasPrice = Number(await provider.getGasPrice());

  const unSignedTx = {
    to: currentChain.addresses.FusionProxyFactory,
    data,
    value: 0,
    gasLimit:
      currentChain.chainId === 84532 || currentChain.chainId === 11155420
        ? null
        : 2000000,
    gasPrice:
      currentChain.chainId === 84532 || currentChain.chainId === 11155420
        ? gasPrice
        : null,
  };

  const signedTx = await signer.sendTransaction(unSignedTx);

  const receipt = await signedTx.wait();

  return receipt;
};

module.exports = {
  deployBase,
  checkDomain,
  resolveHashAndNonce,
  deployExternal,
  deployRequest,
};
