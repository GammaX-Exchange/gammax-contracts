import { ethers } from "hardhat";
const hre = require("hardhat");

async function main() {
  const currentTimestampInSeconds = Math.round(Date.now() / 1000);
  const ONE_YEAR_IN_SECS = 365 * 24 * 60 * 60;
  const unlockTime = currentTimestampInSeconds + ONE_YEAR_IN_SECS;

  const lockedAmount = ethers.utils.parseEther("1");
  const GammaxExchange = await ethers.getContractFactory(
    "GammaxExchangeTreasury"
  );
  const treasury = await GammaxExchange.deploy(
    "0x3122c212889A19e9035B25117Ac9DF7FbB58FADD",
    "0xB7180670fc3e7a4Ccd8fE4bcBEcAe2bEaA7d92E0",
    "0xF62A9568a6aD03c96812E3C7D5879f6D5c1a14Fe"
  );
  console.log("address:", treasury.address);
  // await hre.run("verify:verify", {
  //   address: treasury.address,
  //   constructorArguments: [
  //     "0x3122c212889A19e9035B25117Ac9DF7FbB58FADD",
  //     "0xB7180670fc3e7a4Ccd8fE4bcBEcAe2bEaA7d92E0",
  //     "0xF62A9568a6aD03c96812E3C7D5879f6D5c1a14Fe",
  //   ],
  // });
  // console.log("address:", treasury.address);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
