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


  beforeEach(async () => {
    const GammaxExchange = <GammaxExchangeTreasuryFactory>(
      await ethers.getContractFactory("GammaxExchangeTreasury")
    );
  });

  it("Gammax Treasury Token", async () => {

    expect(true).to.be.equal(true);
  });
});
