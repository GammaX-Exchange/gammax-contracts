import { Usdt } from "../typechain/Usdt";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import chai from "chai";
import { solidity } from "ethereum-waffle";
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
  const etherAddress = "0x0000000000000000000000000000000000000000";

  const mintAmount = ethers.utils.parseUnits("2000", 18);

  before(async () => {
    [owner, account1, account2, truthHolder, opAccount, counterParty] =
      await ethers.getSigners();
  });

  beforeEach(async () => {
    const GammaxExchange = <GammaxExchangeTreasuryFactory>(
      await ethers.getContractFactory("GammaxExchangeTreasury")
    );
    const USDT = <UsdtFactory>await ethers.getContractFactory("USDT");
    USDTToken = await USDT.deploy();
    gammaxTreasury = await GammaxExchange.deploy(counterParty.address);
    const latestTime = await getLatestBlockTimestamp();
    await USDTToken.connect(account2).approve(
      gammaxTreasury.address,
      ethers.constants.MaxUint256
    );
    await USDTToken.mint(gammaxTreasury.address, mintAmount);

    await USDTToken.mint(account2.address, mintAmount);
    await gammaxTreasury.deposit(etherAddress, ethers.utils.parseEther("3.0"), {
      value: ethers.utils.parseEther("3.0"),
    });
  });

  it("Trasfer token or eth to CounterParty", async () => {
    const oldBalance = await ethers.provider.getBalance(counterParty.address);
    const oldTokenBalance = await USDTToken.balanceOf(counterParty.address);
    await expect(
      gammaxTreasury
        .connect(account1)
        .transferToCounterParty(USDTToken.address, ethers.utils.parseEther("1"))
    ).to.be.revertedWith("Ownable: caller is not the owner");
    await expect(
      gammaxTreasury.transferToCounterParty(
        USDTToken.address,
        ethers.utils.parseEther("10000")
      )
    ).to.be.revertedWith("not enough currency balance");
    await gammaxTreasury.transferToCounterParty(
      etherAddress,
      ethers.utils.parseEther("1")
    );
    const newBalance = await ethers.provider.getBalance(counterParty.address);
    await expect(
      gammaxTreasury.transferToCounterParty(
        USDTToken.address,
        ethers.utils.parseUnits("10000")
      )
    ).to.be.revertedWith("not enough currency balance");
    await gammaxTreasury.transferToCounterParty(
      USDTToken.address,
      ethers.utils.parseEther("1000")
    );
    const newTokenBalance = await USDTToken.balanceOf(counterParty.address);

    expect(newTokenBalance.sub(oldTokenBalance)).to.be.equal(
      ethers.utils.parseEther("1000")
    );
  });

  it("Deposit", async () => {
    await expect(
      gammaxTreasury.deposit(
        USDTToken.address,
        ethers.utils.parseUnits("10000")
      )
    ).to.be.revertedWith("currency not support");
    await gammaxTreasury._addCurrency(USDTToken.address);
    await gammaxTreasury
      .connect(account2)
      .deposit(USDTToken.address, ethers.utils.parseUnits("1000"));
    const dAmount = await gammaxTreasury.userBalance(
      account2.address,
      USDTToken.address
    );
    expect(dAmount).to.be.equal(ethers.utils.parseUnits("1000"));
    await expect(
      gammaxTreasury
        .connect(account2)
        .deposit(etherAddress, ethers.utils.parseEther("0.1"), {
          value: ethers.utils.parseEther("0.2"),
        })
    ).to.be.revertedWith("the amount should be the same.");
    await gammaxTreasury
      .connect(account2)
      .deposit(etherAddress, ethers.utils.parseEther("0.1"), {
        value: ethers.utils.parseEther("0.1"),
      });
    const eAmount = await gammaxTreasury.userBalance(
      account2.address,
      etherAddress
    );
    expect(eAmount).to.be.equal(ethers.utils.parseEther("0.1"));
  });

  it("Claim", async () => {
    await expect(
      gammaxTreasury.claim(
        account1.address,
        USDTToken.address,
        ethers.utils.parseUnits("10000")
      )
    ).to.be.revertedWith("currency not support");
    await gammaxTreasury._addCurrency(USDTToken.address);
    await expect(
      gammaxTreasury.claim(
        account1.address,
        USDTToken.address,
        ethers.utils.parseUnits("10000")
      )
    ).to.be.revertedWith("insuffcient fund");
    await expect(
      gammaxTreasury
        .connect(account2)
        .deposit(USDTToken.address, ethers.utils.parseUnits("1000"))
    ).to.emit(gammaxTreasury, "Deposited");
    await expect(
      gammaxTreasury
        .connect(account2)
        .claim(
          account1.address,
          USDTToken.address,
          ethers.utils.parseUnits("500")
        )
    ).to.be.revertedWith("Ownable: caller is not the owner");
    await expect(
      gammaxTreasury.claim(
        account2.address,
        USDTToken.address,
        ethers.utils.parseUnits("500")
      )
    ).to.emit(gammaxTreasury, "Claimed");

    const dAmount = await gammaxTreasury.userBalance(
      account2.address,
      USDTToken.address
    );
    expect(dAmount).to.be.equal(ethers.utils.parseUnits("500"));
    const wAmount = await USDTToken.balanceOf(gammaxTreasury.address);
    expect(wAmount).to.be.equal(ethers.utils.parseUnits("2500"));
    await expect(
      gammaxTreasury
        .connect(account2)
        .deposit(etherAddress, ethers.utils.parseEther("1"), {
          value: ethers.utils.parseEther("1.0"),
        })
    ).to.emit(gammaxTreasury, "Deposited");
    await expect(
      gammaxTreasury.claim(
        account2.address,
        etherAddress,
        ethers.utils.parseEther("0.5")
      )
    ).to.emit(gammaxTreasury, "Claimed");
    const dBalance = await gammaxTreasury.userBalance(
      account2.address,
      etherAddress
    );
    expect(dBalance).to.be.equal(ethers.utils.parseEther("0.5"));
    await gammaxTreasury._pause();
    await expect(
      gammaxTreasury.claim(
        account2.address,
        USDTToken.address,
        ethers.utils.parseUnits("100")
      )
    ).to.be.revertedWith("paused");
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
