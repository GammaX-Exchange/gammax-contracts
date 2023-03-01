import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import chai, { util } from "chai";
import { solidity } from "ethereum-waffle";
import { utils } from "ethers";
import { ethers } from "hardhat";

import {
  GammaxExchangeTreasury,
  GammaxExchangeTreasuryFactory,
  Usdt,
  UsdtFactory
} from "../typechain";

import { getLatestBlockTimestamp } from "../utils/util";

const { expect } = chai;
chai.use(solidity);

describe("Gammax Treasury", () => {
  let gammaxTreasury: GammaxExchangeTreasury;
  let USDTToken: Usdt;

  let owner:SignerWithAddress,
    account1:SignerWithAddress,
    account2:SignerWithAddress

  const mintAmount = ethers.utils.parseUnits("2000", 18);

  beforeEach(async () => {
    [owner, account1, account2] = await ethers.getSigners();
    const GammaxExchange = <GammaxExchangeTreasuryFactory>await ethers.getContractFactory("GammaxExchangeTreasury");
    const USDT = <UsdtFactory>await ethers.getContractFactory("USDT");
    
    
    // Deploy the contracts
    USDTToken = await USDT.deploy();
    gammaxTreasury = await GammaxExchange.deploy();

    // mint 2000USDT for owner and transfer 10USDT to accounts 1 & 2
    await USDTToken.mint(owner.address, mintAmount);
    await USDTToken.approve(
      gammaxTreasury.address,
      ethers.constants.MaxUint256
      );
      
    await USDTToken.transfer(
      account1.address,
      ethers.utils.parseEther("10")
    )

    await USDTToken.transfer(
      account2.address,
      ethers.utils.parseEther("10")
    )

    // Approve owner 
    await USDTToken.approve(
      gammaxTreasury.address,
      ethers.constants.MaxUint256 // = 115792089237316195423570985008687907853269984665640564039457584007913129639935
    );

    // Approve account 1
    await USDTToken
      .connect(account1)
      .approve(
        gammaxTreasury.address,
        ethers.constants.MaxUint256
      );
        
    // Approve account 2
    await USDTToken
    .connect(account2)
    .approve(
      gammaxTreasury.address,
      ethers.constants.MaxUint256
    );

    // Add USDT token to gammax
    await gammaxTreasury._addCurrency(USDTToken.address);


    await owner.sendTransaction({
      to: gammaxTreasury.address,
      value: ethers.utils.parseEther("3.0"), // Sends exactly 1.0 ether
    });
    // notSignature = await account1.signMessage(utils.arrayify(msg));
  });


  // Tests for state
  describe("Updating user balances from state", () => {
    it("Should add user balance to 1 on deposit", async () => {
      const depositAmount = ethers.utils.parseEther("1");
      await gammaxTreasury
      .connect(account1)
      .depositERC20(
        account1.address,
        account1.address,
        depositAmount,
        USDTToken.address)
        expect(await gammaxTreasury
          .connect(account1)
          .getBalance(account1.address,USDTToken.address))
          .to.be.equal(depositAmount);
        
    })

  })


  // Tests for depositing ERC20
  describe("Depositing ERC20 token in Treasury", () => {

    it("Should emit Deposited event", async () => {
      const depositAmount = ethers.utils.parseEther("1");
      expect (await gammaxTreasury
      .connect(account1)
      .depositERC20(
        account1.address,
        account1.address,
        depositAmount,
        USDTToken.address)).to.emit(gammaxTreasury,"Deposited");
    })

    it("Should decrease USDT amount by 1USDT", async () => {
      const oldBalance = await USDTToken
                          .connect(account1)
                          .balanceOf(account1.address)
      const depositAmount = ethers.utils.parseEther("1");
      await gammaxTreasury
      .connect(account1)
      .depositERC20(
        account1.address,
        account1.address,
        depositAmount,
        USDTToken.address)
      const newBalance = await USDTToken
                          .connect(account1)
                          .balanceOf(account1.address)
      expect( oldBalance.sub(newBalance)
      ).to.be.equal(depositAmount);

    })

    it("Should make initial deposit of 5USDT from owners account to account 1", async () => {
      const depositAmount = ethers.utils.parseEther("5");
      await gammaxTreasury
        .depositERC20(
          owner.address,
          account1.address,
          depositAmount,
          USDTToken.address)
        expect(await gammaxTreasury
          .connect(account1)
          .getBalance(account1.address,USDTToken.address))
          .to.be.equal(depositAmount);
    })

    it("Should revert if currency has not been added", async () => {
      const currency = "0xdAC17F958D2ee523a2206206994597C13D831ec7"
      const depositAmount = ethers.utils.parseEther("1");
      await expect( gammaxTreasury
        .depositERC20(
          owner.address,
          account1.address,
          depositAmount,
          currency) 
      ).to.be.revertedWith("Currency not supported");
    })

  })
  // Tests for depositing Eth
  
  
  // Tests for withdrawing ERC20
  describe("Withdrawing ERC20 token in Treasury", () => {

    it("Should emit Withdrawn event", async () => {
      const depositAmount = ethers.utils.parseEther("1");
      await gammaxTreasury
      .depositERC20(
        account1.address,
        account1.address,
        depositAmount,
        USDTToken.address)
      const withdrawAmount = ethers.utils.parseEther("1");
      expect (await gammaxTreasury
      .withdrawERC20(
        account1.address,
          withdrawAmount,
          USDTToken.address)).to.emit(gammaxTreasury,"Withdrawn");
    })

    it("Should increase USDT amount by 1USDT", async () => {
      // First deposit
      const depositAmount = ethers.utils.parseEther("1");
      await gammaxTreasury
      .connect(account1)
      .depositERC20(
        account1.address,
        account1.address,
        depositAmount,
        USDTToken.address)
      // Stored reduced balance 
      const oldBalance = await USDTToken
        .connect(account1)
        .balanceOf(account1.address)
      // Then withdraw
      const withdrawAmount = ethers.utils.parseEther("1");
      await gammaxTreasury
        .withdrawERC20(
          account1.address,
            withdrawAmount,
            USDTToken.address)
      // store increased balance
      const newBalance = await USDTToken
                          .connect(account1)
                          .balanceOf(account1.address)
      expect( newBalance.sub(oldBalance)
      ).to.be.equal(withdrawAmount);

    })

    it("Should revert if owner is not creating the transaction", async () => {
      const depositAmount = ethers.utils.parseEther("1");
      await gammaxTreasury
      .depositERC20(
        account1.address,
        account1.address,
        depositAmount,
        USDTToken.address)
      const withdrawAmount = ethers.utils.parseEther("1");
      await expect( gammaxTreasury
        .connect(account1)
        .withdrawERC20(
          account1.address,
          withdrawAmount,
          USDTToken.address) 
      ).to.be.revertedWith("Ownable: caller is not the owner");
    })

    it("Should revert if currency has not been added", async () => {
      const currency = "0xdAC17F958D2ee523a2206206994597C13D831ec7"
      const depositAmount = ethers.utils.parseEther("1");
      await gammaxTreasury
      .depositERC20(
        account1.address,
        account1.address,
        depositAmount,
        USDTToken.address)
      const withdrawAmount = ethers.utils.parseEther("1");
      await expect( gammaxTreasury
        .withdrawERC20(
          account1.address,
          withdrawAmount,
          currency) 
      ).to.be.revertedWith("Currency not supported");
    })

  })
  // Tests for withdrawing Eth



  // Tests for adding currency to contract
  describe("Adding currency to the contract", () => {
    const currencyToAdd = "0xdAC17F958D2ee523a2206206994597C13D831ec7"
    it("Only the owner can add currency", async () => {
      await expect(
        gammaxTreasury
          .connect(account1)
          ._addCurrency(currencyToAdd)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    })

    it("Emit AddCurrency event", async () => {
      await expect(
        gammaxTreasury._addCurrency(currencyToAdd)
      ).to.emit(gammaxTreasury, "AddCurrency");
    })

    it("Return true when checking added currency", async () => {
      await gammaxTreasury._addCurrency(currencyToAdd)
      const newCurrency = await gammaxTreasury.supportCurrency(
        currencyToAdd
      );
      expect(newCurrency).to.be.equal(true);
    })

  });

  // Tests for removing currency to contract
  describe("Removing currency to the contract", () => {
    const currencyToRemove = "0xdAC17F958D2ee523a2206206994597C13D831ec7"
    it("Only the owner can remove currency", async () => {
      await expect(
        gammaxTreasury
          .connect(account1)
          ._removeCurrency(currencyToRemove)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    })

    it("Emit RemoveCurrency event", async () => {
      await expect(
        gammaxTreasury._removeCurrency(currencyToRemove)
      ).to.emit(gammaxTreasury, "RemoveCurrency");
    })

    it("Return false when checking added currency thats been removed", async () => {
      await gammaxTreasury._addCurrency(currencyToRemove)
      await gammaxTreasury._removeCurrency(currencyToRemove)
      const removedCurrency = await gammaxTreasury.supportCurrency(
        currencyToRemove
      );
      expect(removedCurrency).to.be.equal(false);
    })

  });


  // Tests for pausing the contract
  describe("Pausing the contract", () => {

    it("Only the owner can pause", async () => {
      await expect(gammaxTreasury.connect(account1)._pause()).to.be.revertedWith(
        "Ownable: caller is not the owner"
      );
    })

    it("Return paused as true once _pause call is made ", async () => {
      await expect(gammaxTreasury._pause()).to.emit(gammaxTreasury, "Paused");
      const paused = await gammaxTreasury.paused();
      expect(paused).to.be.equal(true);
    })

  });


  // Tests for unpausing the contract
  describe("Unpausing the contract", () => {

    it("Only the owner can pause", async () => {
      await expect(gammaxTreasury.connect(account1)._unpause()).to.be.revertedWith(
        "Ownable: caller is not the owner"
      );
    })

    it("Return paused as false once _unpause call is made ", async () => {
      await expect(gammaxTreasury._unpause()).to.emit(gammaxTreasury, "Unpaused");
      const paused = await gammaxTreasury.paused();
      expect(paused).to.be.equal(false);
    })

  });


});

