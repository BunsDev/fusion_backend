const express = require("express");
const router = express.Router();
require("dotenv").config();
const ethers = require("ethers");
const addressManager = require("../../lib/AddressManager.json");
const FusionProxyFactoryABI = require("../../lib/abi/FusionProxyFactory.json");
const {
  deployBase,
  checkDomain,
  resolveHashAndNonce,
  deployExternal,
  deployRequest,
} = require("../../utils/contracts/deploy");
const { verify_password } = require("../../utils/circuits/password_prove");
const { pedersen_hash } = require("../../utils/circuits/pedersen_hash");
const { deploy_prove } = require("../../utils/circuits/deploy_prove");
const { verify_signature } = require("../../utils/circuits/signature_prove");

router.post("/:chainId", async (req, res) => {
  try {
    const { chainId } = req.params;

    if (!chainId) {
      return res.json({ success: false, error: "chainId is required" });
    }

    const currentChain = addressManager.find(
      (chain) => chain.chainId === Number(chainId)
    );

    if (!currentChain) {
      return res.json({ success: false, error: "Chain not found" });
    }

    // Check if the chain is the base chain
    const isBase = currentChain.isBase;

    if (isBase) {
      const forwardRequest = req.body.forwardRequest;

      if (!forwardRequest) {
        return res.json({
          success: false,
          error: "forwardRequest is required",
        });
      }

      const receipt = await deployBase(currentChain, forwardRequest);

      res.json({ success: true, receipt });
    } else {
      const chainDeployRequest = req.body.chainDeployRequest;

      if (!chainDeployRequest) {
        return res.json({
          success: false,
          error: "chainDeployRequest is required",
        });
      }

      const currentChain = addressManager.find(
        (chain) => chain.chainId === Number(chainId)
      );

      const provider = new ethers.providers.JsonRpcProvider(
        currentChain.rpcUrl
      );

      const factory = new ethers.Contract(
        currentChain.addresses.FusionProxyFactory,
        FusionProxyFactoryABI,
        provider
      );

      const isDomainTaken = await checkDomain(
        factory,
        chainDeployRequest.domain
      );

      if (isDomainTaken) {
        return res.json({ success: false, error: "Domain is already taken" });
      }

      const baseChain = addressManager.find((chain) => chain.isBase);

      const baseProvider = new ethers.providers.JsonRpcProvider(
        baseChain.rpcUrl
      );

      const baseFactory = new ethers.Contract(
        baseChain.addresses.FusionProxyFactory,
        FusionProxyFactoryABI,
        baseProvider
      );

      const isBaseDomainTaken = await checkDomain(
        baseFactory,
        chainDeployRequest.domain
      );

      if (!isBaseDomainTaken) {
        return res.json({
          success: false,
          error: "Domain is not taken on base chain",
        });
      }

      const { messageHash, hash } = await resolveHashAndNonce(
        baseFactory,
        chainDeployRequest,
        baseProvider
      );

      let isVerified;

      if (chainDeployRequest.type === "password") {
        isVerified = await verify_password(
          messageHash,
          hash,
          chainDeployRequest.proof,
          chainDeployRequest.address
        );
      } else {
        isVerified = await verify_signature(
          messageHash,
          hash,
          chainDeployRequest.proof,
          chainDeployRequest.address
        );
      }

      if (!isVerified) {
        return res.json({ success: false, error: "Proof is invalid" });
      }

      const serverHash = await pedersen_hash(
        ethers.utils.hexlify(ethers.utils.toUtf8Bytes(process.env.PASSCODE)),
        ethers.utils.hexZeroPad(currentChain.chainId, 32)
      );

      const serverProof = await deploy_prove(
        provider,
        chainDeployRequest.domain,
        serverHash,
        currentChain.chainId
      );

      const receipt = await deployExternal(
        provider,
        currentChain,
        chainDeployRequest,
        serverProof
      );

      res.json({ success: true, receipt });
    }
  } catch (err) {
    console.log(err);
    res.json({ success: false, error: err.message });
  }
});

router.post("request/:chainId", async (req, res) => {
  try {
    const { chainId } = req.params;

    if (!chainId) {
      return res.json({ success: false, error: "chainId is required" });
    }

    const currentChain = addressManager.find(
      (chain) => chain.chainId === Number(chainId)
    );

    // Check if the chain is the base chain
    const isBase = currentChain.isBase;

    if (isBase) {
      return res.json({ success: false, error: "Base chain cannot request" });
    }

    const chainDeployRequest = req.body.chainDeployRequest;

    if (!chainDeployRequest) {
      return res.json({
        success: false,
        error: "chainDeployRequest is required",
      });
    }

    const provider = new ethers.providers.JsonRpcProvider(currentChain.rpcUrl);

    const factory = new ethers.Contract(
      currentChain.addresses.FusionProxyFactory,
      FusionProxyFactoryABI,
      provider
    );

    const isDomainTaken = await checkDomain(factory, chainDeployRequest.domain);

    if (isDomainTaken) {
      return res.json({ success: false, error: "Domain is already taken" });
    }

    const baseChain = addressManager.find((chain) => chain.isBase);

    const baseProvider = new ethers.providers.JsonRpcProvider(baseChain.rpcUrl);

    const baseFactory = new ethers.Contract(
      baseChain.addresses.FusionProxyFactory,
      FusionProxyFactoryABI,
      baseProvider
    );

    const isBaseDomainTaken = await checkDomain(
      baseFactory,
      chainDeployRequest.domain
    );

    if (!isBaseDomainTaken) {
      return res.json({
        success: false,
        error: "Domain is not taken on base chain",
      });
    }

    const { messageHash, hash } = await resolveHashAndNonce(
      baseFactory,
      chainDeployRequest,
      baseProvider
    );

    let isVerified;

    if (chainDeployRequest.type === "password") {
      isVerified = await verify_password(
        messageHash,
        hash,
        chainDeployRequest.proof,
        chainDeployRequest.address
      );
    } else {
      isVerified = await verify_signature(
        messageHash,
        hash,
        chainDeployRequest.proof,
        chainDeployRequest.address
      );
    }

    if (!isVerified) {
      return res.json({ success: false, error: "Proof is invalid" });
    }

    const serverHash = await pedersen_hash(
      ethers.utils.hexlify(ethers.utils.toUtf8Bytes(process.env.PASSCODE)),
      ethers.utils.hexZeroPad(currentChain.chainId, 32)
    );

    const serverProof = await deploy_prove(
      provider,
      chainDeployRequest.domain,
      serverHash,
      currentChain.chainId
    );

    const receipt = await deployRequest(
      provider,
      currentChain,
      chainDeployRequest,
      serverProof
    );

    res.json({ success: true, receipt });
  } catch (err) {
    console.log(err);
    res.json({ success: false, error: err.message });
  }
});

router.get("/getHash/:chainId", async (req, res) => {
  const chainId = req.params.chainId;

  const serverHash = await pedersen_hash(
    ethers.utils.hexlify(ethers.utils.toUtf8Bytes(process.env.PASSCODE)),
    ethers.utils.hexZeroPad(Number(chainId), 32)
  );

  return res.json({ success: true, serverHash });
});

router.get("/getAddress/:domain", async (req, res) => {
  try {
    const domain = req.params.domain;

    if (!domain) {
      return res.json({ success: false, error: "domain is required" });
    }

    const baseChain = addressManager.find((chain) => chain.isBase);

    if (!baseChain) {
      return res.json({ success: false, error: "Base chain not found" });
    }

    const provider = new ethers.providers.JsonRpcProvider(baseChain.rpcUrl);

    const factory = new ethers.Contract(
      baseChain.addresses.FusionProxyFactory,
      FusionProxyFactoryABI,
      provider
    );

    const walletAddress = await factory.callStatic.createProxyWithDomain(
      domain,
      "0x"
    );

    return res.json({ success: true, walletAddress });
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

module.exports = router;
