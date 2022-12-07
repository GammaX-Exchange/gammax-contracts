import { Usdt } from "../typechain/Usdt";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import chai, { util } from "chai";
import { solidity } from "ethereum-waffle";
import { utils } from "ethers";
import { ethers } from "hardhat";

import {
  GammaxExchangeTreasury,
  GammaxExchangeTreasuryFactory,
} from "../typechain";
import { UsdtFactory } from "../typechain/UsdtFactory";
import { getLatestBlockTimestamp } from "../utils/util";

const { expect } = chai;
chai.use(solidity);

describe("Gammax Treasury Wallet", () => {
  let gammaxTreasury: GammaxExchangeTreasury;
  let USDTToken: Usdt;

  let owner,
    account1,
    account2,
    truthHolder,
    opAccount,
    counterParty: SignerWithAddress;
  let msg, signature, signature1, tokenMsg, msgHash, tokenMsgHash;
  const duration = 604800;
  const depositAmount = ethers.utils.parseUnits("100", 18);
  const swapAmount = ethers.utils.parseUnits("50", 18);
  const swapedAmount = ethers.utils.parseUnits("20", 18);

  const mintAmount = ethers.utils.parseUnits("2000", 18);
  const operator = before(async () => {
    [owner, account1, account2, truthHolder, opAccount, counterParty] =
      await ethers.getSigners();
  });

  beforeEach(async () => {
    const GammaxExchange = <GammaxExchangeTreasuryFactory>(
      await ethers.getContractFactory("GammaxExchangeTreasury")
    );
    const USDT = <UsdtFactory>await ethers.getContractFactory("USDT");
    USDTToken = await USDT.deploy();
    gammaxTreasury = await GammaxExchange.deploy(
      truthHolder.address,
      opAccount.address,
      counterParty.address
    );
    const latestTime = await getLatestBlockTimestamp();
    msg = ethers.utils.solidityPack(
      ["uint256", "address", "bool", "address", "uint256", "uint256"],
      [
        0,
        account1.address,
        true,
        "0xdAC17F958D2ee523a2206206994597C13D831ec7",
        ethers.utils.parseEther("0.5"),
        latestTime + duration,
      ]
    );
    msgHash = ethers.utils.solidityKeccak256(
      ["uint256", "address", "bool", "address", "uint256", "uint256"],
      [
        0,
        account1.address,
        true,
        "0xdAC17F958D2ee523a2206206994597C13D831ec7",
        ethers.utils.parseEther("0.5"),
        latestTime + duration,
      ]
    );
    tokenMsg = ethers.utils.solidityPack(
      ["uint256", "address", "bool", "address", "uint256", "uint256"],
      [
        1,
        account1.address,
        false,
        USDTToken.address,
        ethers.utils.parseUnits("100"),
        latestTime,
      ]
    );
    tokenMsgHash = ethers.utils.solidityKeccak256(
      ["uint256", "address", "bool", "address", "uint256", "uint256"],
      [
        0,
        account1.address,
        false,
        USDTToken.address,
        ethers.utils.parseUnits("100"),
        latestTime,
      ]
    );
    signature = await truthHolder.signMessage(utils.arrayify(msgHash));
    signature1 = await truthHolder.signMessage(utils.arrayify(tokenMsgHash));
    await USDTToken.mint(gammaxTreasury.address, mintAmount);
    await USDTToken.approve(
      gammaxTreasury.address,
      ethers.constants.MaxUint256
    );
    await owner.sendTransaction({
      to: gammaxTreasury.address,
      value: ethers.utils.parseEther("3.0"), // Sends exactly 1.0 ether
    });
    // notSignature = await account1.signMessage(utils.arrayify(msg));
  });
  it("Decode Account", async () => {
    const acc = await gammaxTreasury.source(msg, signature);
    expect(acc).to.be.equal(truthHolder.address);
  });
  it("Trasfer token or eth to CounterParty", async () => {
    const oldBalance = await ethers.provider.getBalance(counterParty.address);
    const oldTokenBalance = await USDTToken.balanceOf(counterParty.address);
    await expect(
      gammaxTreasury
        .connect(account1)
        .transferToCounterParty(
          true,
          USDTToken.address,
          ethers.utils.parseEther("1")
        )
    ).to.be.revertedWith("only operator can call");
    await expect(
      gammaxTreasury
        .connect(opAccount)
        .transferToCounterParty(
          true,
          USDTToken.address,
          ethers.utils.parseEther("10000")
        )
    ).to.be.revertedWith("not enough ether balance");
    await gammaxTreasury
      .connect(opAccount)
      .transferToCounterParty(
        true,
        USDTToken.address,
        ethers.utils.parseEther("1")
      );
    const newBalance = await ethers.provider.getBalance(counterParty.address);
    await expect(
      gammaxTreasury
        .connect(opAccount)
        .transferToCounterParty(
          false,
          USDTToken.address,
          ethers.utils.parseUnits("10000")
        )
    ).to.be.revertedWith("not enough currency balance");
    await gammaxTreasury
      .connect(opAccount)
      .transferToCounterParty(
        false,
        USDTToken.address,
        ethers.utils.parseEther("1000")
      );
    const newTokenBalance = await USDTToken.balanceOf(counterParty.address);

    expect(newTokenBalance.sub(oldTokenBalance)).to.be.equal(
      ethers.utils.parseEther("1000")
    );
  });
  it("Claim", async () => {
    await expect(gammaxTreasury.claim(msgHash, signature)).to.be.revertedWith(
      "only accept truthHolder signed message"
    );
    const latestTime = await getLatestBlockTimestamp();
    const msgData = await gammaxTreasury.encodeMessage(
      0,
      account1.address,
      true,
      "0xdAC17F958D2ee523a2206206994597C13D831ec7",
      ethers.utils.parseEther("0.5"),
      latestTime + duration
    );
    const sigData = await truthHolder.signMessage(
      utils.arrayify(utils.solidityKeccak256(["bytes"], [msgData]))
    );
    const msgData1 = await gammaxTreasury.encodeMessage(
      1,
      account1.address,
      false,
      USDTToken.address,
      ethers.utils.parseEther("0.5"),
      latestTime
    );

    const sigData1 = await truthHolder.signMessage(
      utils.arrayify(utils.solidityKeccak256(["bytes"], [msgData1]))
    );
    await expect(gammaxTreasury.claim(msgData, sigData)).to.emit(
      gammaxTreasury,
      "Claimed"
    );
    await expect(gammaxTreasury.claim(msgData, sigData)).to.be.revertedWith(
      "already claimed"
    );
    await expect(gammaxTreasury.claim(msgData1, sigData1)).to.be.revertedWith(
      "currency not support"
    );
    await gammaxTreasury._addCurrency(USDTToken.address);
    await expect(gammaxTreasury.claim(msgData1, sigData1)).to.be.revertedWith(
      "already passed deadline"
    );
    await gammaxTreasury._pause();
    await expect(gammaxTreasury.claim(msgHash, signature)).to.be.revertedWith(
      "paused"
    );
    await expect(gammaxTreasury.claim(msgHash, signature)).to.be.revertedWith(
      "paused"
    );
    // const acc = await gammaxTreasury.source(msg, signature);
    // expect(acc).to.be.equal(truthHolder.address);
  });
  it("Pause", async () => {
    await expect(gammaxTreasury.connect(account1)._pause()).to.be.revertedWith(
      "Ownable: caller is not the owner"
    );
    await expect(gammaxTreasury._pause()).to.emit(gammaxTreasury, "Paused");
    const paused = await gammaxTreasury.paused();
    expect(paused).to.be.equal(true);
  });
  it("UnPause", async () => {
    await expect(
      gammaxTreasury.connect(account1)._unpause()
    ).to.be.revertedWith("Ownable: caller is not the owner");
    await expect(gammaxTreasury._pause()).to.emit(gammaxTreasury, "Paused");
    await expect(gammaxTreasury._unpause()).to.emit(gammaxTreasury, "Unpaused");
    const paused = await gammaxTreasury.paused();
    expect(paused).to.be.equal(false);
  });
  it("Change Truth Holder", async () => {
    await expect(
      gammaxTreasury
        .connect(account1)
        ._changeTruthHolder("0x903e3E9b3F9bC6401Ad77ec8953Eb2FB6fEFC3a3")
    ).to.be.revertedWith("Ownable: caller is not the owner");
    const oldHolder = await gammaxTreasury.truthHolder();
    expect(oldHolder).to.be.equal(truthHolder.address);
    await expect(
      gammaxTreasury._changeTruthHolder(
        "0x903e3E9b3F9bC6401Ad77ec8953Eb2FB6fEFC3a3"
      )
    ).to.emit(gammaxTreasury, "NewTruthHolder");
    const newHolder = await gammaxTreasury.truthHolder();
    expect(newHolder).to.be.equal("0x903e3E9b3F9bC6401Ad77ec8953Eb2FB6fEFC3a3");
  });
  it("Set Operator", async () => {
    await expect(
      gammaxTreasury
        .connect(account1)
        ._setOperator("0x903e3E9b3F9bC6401Ad77ec8953Eb2FB6fEFC3a3")
    ).to.be.revertedWith("Ownable: caller is not the owner");
    const oldOperator = await gammaxTreasury.operator();
    expect(oldOperator).to.be.equal(opAccount.address);
    await expect(
      gammaxTreasury._setOperator("0x903e3E9b3F9bC6401Ad77ec8953Eb2FB6fEFC3a3")
    ).to.emit(gammaxTreasury, "NewOperator");
    const newOperator = await gammaxTreasury.operator();
    expect(newOperator).to.be.equal(
      "0x903e3E9b3F9bC6401Ad77ec8953Eb2FB6fEFC3a3"
    );
  });
  it("Set CounterParty", async () => {
    await expect(
      gammaxTreasury
        .connect(account1)
        ._setCounterParty("0x903e3E9b3F9bC6401Ad77ec8953Eb2FB6fEFC3a3")
    ).to.be.revertedWith("Ownable: caller is not the owner");
    const oldCounterParty = await gammaxTreasury.counterParty();
    expect(oldCounterParty).to.be.equal(counterParty.address);
    await expect(
      gammaxTreasury._setCounterParty(
        "0x903e3E9b3F9bC6401Ad77ec8953Eb2FB6fEFC3a3"
      )
    ).to.emit(gammaxTreasury, "NewCounterParty");
    const newCounterParty = await gammaxTreasury.counterParty();
    expect(newCounterParty).to.be.equal(
      "0x903e3E9b3F9bC6401Ad77ec8953Eb2FB6fEFC3a3"
    );
  });
  it("Add new currency", async () => {
    await expect(
      gammaxTreasury
        .connect(account1)
        ._addCurrency("0xdAC17F958D2ee523a2206206994597C13D831ec7")
    ).to.be.revertedWith("Ownable: caller is not the owner");
    await expect(
      gammaxTreasury._addCurrency("0xdAC17F958D2ee523a2206206994597C13D831ec7")
    ).to.emit(gammaxTreasury, "AddCurrency");
    const newCurrency = await gammaxTreasury.supportCurrency(
      "0xdAC17F958D2ee523a2206206994597C13D831ec7"
    );
    expect(newCurrency).to.be.equal(true);
  });
  it("remove currency", async () => {
    await expect(
      gammaxTreasury
        .connect(account1)
        ._removeCurrency("0xdAC17F958D2ee523a2206206994597C13D831ec7")
    ).to.be.revertedWith("Ownable: caller is not the owner");
    await expect(
      gammaxTreasury._addCurrency("0xdAC17F958D2ee523a2206206994597C13D831ec7")
    ).to.emit(gammaxTreasury, "AddCurrency");
    await expect(
      gammaxTreasury._removeCurrency(
        "0xdAC17F958D2ee523a2206206994597C13D831ec7"
      )
    ).to.emit(gammaxTreasury, "RemoveCurrency");
    const deletedCurrency = await gammaxTreasury.supportCurrency(
      "0xdAC17F958D2ee523a2206206994597C13D831ec7"
    );
    expect(deletedCurrency).to.be.equal(false);
  });
});
