const { Noir } = require("@noir-lang/noir_js");
const { BarretenbergBackend } = require("@noir-lang/backend_barretenberg");
const signatureProve = require("../../lib/circuits/signature_prove.json");
const ethers = require("ethers");

const verify_signature = async (messageHash, hash, proof, address) => {
  const proveBackend = new BarretenbergBackend(signatureProve);
  const proveNoir = new Noir(signatureProve, proveBackend);

  const messageHashArray = Array.from(ethers.utils.arrayify(messageHash));
  let publicInputs = new Map();

  for (let i = 0; i < 32; i++) {
    publicInputs.set(
      i + 34,
      ethers.utils.hexZeroPad(ethers.utils.hexlify(messageHashArray[i]), 32)
    );
  }

  publicInputs.set(66, hash);

  const bytes32Address = ethers.utils.hexZeroPad(address, 32);
  publicInputs.set(67, bytes32Address);

  const isVerified = await proveNoir.verifyFinalProof({
    publicInputs,
    proof: Array.from(ethers.utils.arrayify(proof)),
  });

  return isVerified;
};

module.exports = {
  verify_signature,
};
