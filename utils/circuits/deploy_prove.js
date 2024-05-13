const { Noir } = require("@noir-lang/noir_js");
const { BarretenbergBackend } = require("@noir-lang/backend_barretenberg");
const deployProve = require("../../lib/circuits/deploy_prove.json");
require("dotenv").config();
const ethers = require("ethers");

const deploy_prove = async (provider, domain, serverHash, chainId) => {
  const deployBackend = new BarretenbergBackend(deployProve);
  const deployNoir = new Noir(deployProve, deployBackend);

  const signer = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
  const bytes32Address = ethers.utils.hexZeroPad(signer.address, 32);

  const deployInputs = {
    reqDomain: ethers.utils.hexZeroPad(
      ethers.utils
        .arrayify(ethers.utils.keccak256(ethers.utils.toUtf8Bytes(domain)))
        .slice(0, 4),
      32
    ),
    passcode: ethers.utils.hexlify(
      ethers.utils.toUtf8Bytes(process.env.PASSCODE)
    ),
    serverHash,
    domain: ethers.utils.hexZeroPad(
      ethers.utils
        .arrayify(ethers.utils.keccak256(ethers.utils.toUtf8Bytes(domain)))
        .slice(0, 4),
      32
    ),
    chainId: ethers.utils.hexZeroPad(chainId, 32),
    signing_address: bytes32Address,
    proving_address: bytes32Address,
  };

  const serverProof = ethers.utils.hexlify(
    (await deployNoir.generateFinalProof(deployInputs)).proof
  );

  return serverProof;
};

module.exports = {
  deploy_prove,
};
