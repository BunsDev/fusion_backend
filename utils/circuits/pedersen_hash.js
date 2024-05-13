const { Noir } = require("@noir-lang/noir_js");
const { BarretenbergBackend } = require("@noir-lang/backend_barretenberg");
const pedersenHash = require("../../lib/circuits/pedersen_hash.json");

const pedersen_hash = async (x, y) => {
  const hashBackend = new BarretenbergBackend(pedersenHash);
  const hashNoir = new Noir(pedersenHash, hashBackend);

  const hashInputs = {
    x,
    y,
  };

  const hash = (await hashNoir.execute(hashInputs)).returnValue;

  return hash;
};

module.exports = {
  pedersen_hash,
};
