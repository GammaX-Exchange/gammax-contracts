import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import chai from "chai";
import { solidity } from "ethereum-waffle";
import { ethers } from "hardhat";

import {
  GammaxExchangeTreasury,
  GammaxExchangeTreasuryFactory,
} from "../typechain";
import { advanceTimeAndBlock, getLatestBlockTimestamp } from "../utils/util";

const { expect } = chai;
chai.use(solidity);

describe("Gammax Treasury Wallet", () => {
  let gammaxTreasury: GammaxExchangeTreasury;

  let owner: SignerWithAddress;
  let account1, account2, account3: any;

  const duration = 604800;
  const depositAmount = ethers.utils.parseUnits("100", 18);
  const swapAmount = ethers.utils.parseUnits("50", 18);
  const swapedAmount = ethers.utils.parseUnits("20", 18);

  const mintAmount = ethers.utils.parseUnits("2000", 18);
  const operator = before(async () => {
    [owner] = await ethers.getSigners();
    account1 = await ethers.getImpersonatedSigner(
      "0x3122c212889A19e9035B25117Ac9DF7FbB58FADD"
    );
    account2 = await ethers.getImpersonatedSigner(
      "0xB7180670fc3e7a4Ccd8fE4bcBEcAe2bEaA7d92E0"
    );
    account3 = await ethers.getImpersonatedSigner(
      "0xF62A9568a6aD03c96812E3C7D5879f6D5c1a14Fe"
    );
  });

  beforeEach(async () => {
    const GammaxExchange = <GammaxExchangeTreasuryFactory>(
      await ethers.getContractFactory("GammaxExchangeTreasury")
    );
  });

  it("Gammax Treasury Token", async () => {
    expect(true).to.be.equal(true);
  });
});
