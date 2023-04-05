import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import chai, { util } from "chai";
import { solidity } from "ethereum-waffle";
import { utils } from "ethers";
import { ethers } from "hardhat";
import Web3 from "web3"

import {
    Treasury,
    TreasuryFactory,
    Usdt,
    UsdtFactory
} from "../typechain";
import { createMessage, getMerkleProof, getMerkleRoot, hashMessage } from "../utils/util";


const { expect } = chai;
chai.use(solidity);

describe("Treasury Contract With Merkle Root", () => {
    let treasury: Treasury;
    let USDTToken: Usdt;

    let owner:SignerWithAddress,
        account1:SignerWithAddress,
        account2:SignerWithAddress,
        account3:SignerWithAddress

    let merkleRoot:string;
    let tokenAddress:string;
    const messages:string[] = []
    const hashes:BigInt[] = []

    const mintAmount = ethers.utils.parseUnits("2000", 18);
    const initialTransferAmount = ethers.utils.parseEther("100")
    const initialDepositAmount = ethers.utils.parseEther("50")
    const userBalance = initialTransferAmount.sub(initialDepositAmount)
    const contractBalance = ethers.utils.parseEther("200")
    const ipfsCID = "IPFS_CID"

    before(async () => {
        [owner, account1, account2,account3] = await ethers.getSigners();
        const accounts = await (await ethers.getSigners()).splice(0,4);
        const GammaxExchange = <TreasuryFactory>await ethers.getContractFactory("Treasury");
        const USDT = <UsdtFactory>await ethers.getContractFactory("USDT");
        
        // Deploy the contracts
        USDTToken = await USDT.deploy();
        treasury = await GammaxExchange.deploy();

        tokenAddress = USDTToken.address
    
        // mint 2000USDT for owner and transfer 10USDT to accounts 1 & 2
        await USDTToken.mint(owner.address, mintAmount);

        // Add USDT token to gammax
        await treasury._addCurrency(tokenAddress);

        for( let account of accounts){

            // Approve accounts
            await USDTToken
            .connect(account)
            .approve(
                treasury.address,
                ethers.constants.MaxUint256 // = 115792089237316195423570985008687907853269984665640564039457584007913129639935
            );
            
            // transfer from owner to other accounts
            if(accounts.indexOf(account)>0){
                await USDTToken.transfer(
                    account.address,
                    initialTransferAmount
                  )
            }

            // Make initial deposits
            await treasury
            .connect(account)
            .depositERC20(
                account.address,
                account.address,
                initialDepositAmount,
                tokenAddress)

            // Information to create initial state (merkle root)
            messages.push(
                createMessage(account.address,tokenAddress,initialDepositAmount.toString())
            )

            hashes.push(
                hashMessage(
                    createMessage(account.address,tokenAddress,initialDepositAmount.toString()) 
                )
            )

        }

        // Update the state to have merkle root of users accounts
        merkleRoot = getMerkleRoot(hashes).toString()
        
        await treasury.updateState(merkleRoot,ipfsCID)
        
    });

    describe("Updating state in Treasury", () => {

        it("Should have the correct state/merkle root", async() => {
            const root = await treasury.getRoot()
            expect(root[0]).to.be.equal(merkleRoot)
        })

        it("Should emit UpdateState event", async() => {
            await expect(treasury.updateState(merkleRoot,ipfsCID))
            .to.emit(treasury,"UpdateState")
        })

        it("Should revert if owner is not creating the transaction", async() => {
            await expect(treasury.connect(account1).updateState(merkleRoot,ipfsCID))
            .to.be.revertedWith("Ownable: caller is not the owner");
        })

    })

    describe("Depositing ERC20 token in Treasury", () => {

        it("User's ERC20 token balance should've reduced by 50USDT", async () => {
            expect((await USDTToken.balanceOf(account1.address)).toString())
            .to.be.equal(userBalance.toString())
            
            expect((await USDTToken.balanceOf(account2.address)).toString())
            .to.be.equal(userBalance.toString())
        })

        it("Treasury's ERC20 token balance should've increased to 200USDT", async () => {
            expect((await USDTToken.balanceOf(treasury.address)).toString())
            .to.be.equal(contractBalance.toString())
        })

        it("Should emit Deposited event", async () => {
            const depositAmount = ethers.utils.parseEther("1");
            expect (await treasury
            .connect(account1)
            .depositERC20(
                account1.address,
                account1.address,
                depositAmount,
                USDTToken.address)).to.emit(treasury,"Deposited");
        })

    })

    describe("Withdrawing ERC20 token in Treasury", () => {
        // Due to previous deposit actions, treasury balance is now 251USDT

        let message:string,
            invalidMessage:string,
            hash:string | null,
            signature:string
        const newContractBalance = ethers.utils.parseEther("251")
        // Add another user whose private key is known to merkle tree
        const newUserAddress = "0xc58F0E2007B4c52597042cB212a3683AF2ABDA06"
        const newUserKey = "0x426c827e026f44ac8d48ef941be8748e8c60e79a34f40e1d884354d01c6d767b"
        const invalidCurrency = "0xdAC17F958D2ee523a2206206994597C13D831ec7"
        
        before(async () => {
            // Make initial deposit for new user
            await treasury
            .connect(owner)
            .depositERC20(
                owner.address,
                newUserAddress,
                initialDepositAmount,
                tokenAddress)
            
            // Create message, hash and signature
            const web3 = new Web3()
            
            message = createMessage(newUserAddress,tokenAddress,initialDepositAmount.toString())
            
            // Message with unsupported currency
            invalidMessage = createMessage(newUserAddress,invalidCurrency,initialDepositAmount.toString())
             
            hash = web3.utils.sha3(message)

            signature = web3.eth.accounts.sign( (hash as string), newUserKey ).signature

            // NOTE: SINCE FOR THIS CASE VERIFICATION IS OFF-CHAIN
            // THIS USER HASN'T BEEN ADDED TO THE MERKLE TREE
            // HOWEVER THESE TESTS SHOW HOW THIS CASE WOULD BE HANDLED 
            // WE ASSUME SOME VERIFICATION AGAINST ON-CHAIN ROOT IS DONE OFF-CHAIN 
            // BY COMMITTEE MEMBERS

        })

        it("Treasury's ERC20 token balance should've increased to 251USDT", async () => {
            expect((await USDTToken.balanceOf(treasury.address)).toString())
            .to.be.equal(newContractBalance.toString())
        })

        it("Should revert if withdrawing more funds (100USDT) than in message/state (50USDT)", async () => {
            const amount = ethers.utils.parseEther("100")
            await expect(treasury.withdrawERC20(message,signature,amount))
            .to.be.revertedWith("Not enough balance");
        }) 

        it("Treasury's ERC20 token balance should reduce to 241USDT on withdraw of 10USDT and emit Withdrawn event", async () => {
            const amount = ethers.utils.parseEther("10")
            const reducedContractBalance = newContractBalance.sub(amount)
            expect(await treasury.withdrawERC20(message,signature,amount))
            .to.emit(treasury,"Withdrawn");

            expect((await USDTToken.balanceOf(treasury.address)).toString())
            .to.be.equal(reducedContractBalance.toString())
        })

        it("Should revert if user withdraws initial deposit amount (50USDT) after withdrawing 10USDT", async () => {
            // newUser is left with 40USDT in state
            const amount = ethers.utils.parseEther("50")
            await expect(treasury.withdrawERC20(message,signature,amount))
            .to.be.revertedWith("Not enough balance");
        })

        it("Should revert if owner is not creating the transaction", async () => {
            const amount = ethers.utils.parseEther("10")
            await expect(treasury.connect(account1).withdrawERC20(message,signature,amount))
            .to.be.revertedWith("Ownable: caller is not the owner");
        })

        

        it("Should revert if signer is not address in message", async () => {
            const amount = ethers.utils.parseEther("10")
            await expect(treasury.withdrawERC20(messages[0],signature,amount)) // using message from other user not signer
            .to.be.revertedWith("Invalid signature");
        })

        it("Should revert if currency is not supported", async () => {
            const amount = ethers.utils.parseEther("10")
            await expect(treasury.withdrawERC20(invalidMessage,signature,amount))
            .to.be.revertedWith("Currency not supported");
        })


    })


    describe("Forced withdraw ERC20 token in Treasury when paused", () => {
        // Due to previous withdraw actions, treasury balance is now 241USDT

        const newContractBalance = ethers.utils.parseEther("241")
        const invalidCurrency = "0xdAC17F958D2ee523a2206206994597C13D831ec7"
        const invalidStateAmount = ethers.utils.parseEther("55")

        let message:string,
            messageWithWrongCurrency:string,
            messageWithWrongAmount:string
        let proofs:string[] = []
        
        before(async () => {
            const accountIndex = 0 // owners index during creation of merkle tree/root
            message = messages[accountIndex]
            proofs = getMerkleProof(hashes,accountIndex).map( h => `0x${h.toString(16)}`)

            // Message with unsupported currency
            messageWithWrongCurrency = createMessage(owner.address,invalidCurrency,initialDepositAmount.toString())
            // Message with wrong state amount in merkle tree
            messageWithWrongAmount = createMessage(owner.address,invalidCurrency,invalidStateAmount.toString())

            //Pause the treasury contract
            await treasury._pause()
        })

        it("Treasury's ERC20 token balance should've reduced to 241USDT", async () => {
            expect((await USDTToken.balanceOf(treasury.address)).toString())
            .to.be.equal(newContractBalance.toString())
        })

        it("Should revert if withdrawing more funds (100USDT) than in message/state (40USDT)", async () => {
            const amount = ethers.utils.parseEther("100")
            await expect(treasury.forcedWithdraw(amount,message,proofs)) // Using other user's message
            .to.be.revertedWith("Not enough balance");
        })

        it("Treasury's ERC20 token balance should reduce to 240USDT on withdraw of 1USDT and emit Withdrawn event", async () => {
            const amount = ethers.utils.parseEther("1")

            const reducedContractBalance = newContractBalance.sub(amount)
            expect(await treasury.forcedWithdraw(amount,message,proofs))
            .to.emit(treasury,"Withdrawn");

            expect((await USDTToken.balanceOf(treasury.address)).toString())
            .to.be.equal(reducedContractBalance.toString())
        })

        it("Should revert if user withdraws initial deposit amount (50USDT) after withdrawing 1USDT", async () => {
            // user/owner is left with 49USDT in state
            const amount = ethers.utils.parseEther("50")

            await expect(treasury.forcedWithdraw(amount,message,proofs))
            .to.be.revertedWith("Not enough balance");
        })

        it("Should revert if wrong message (giving wrong hash) is passed", async () => {
            const amount = ethers.utils.parseEther("1")
            await expect(treasury.forcedWithdraw(amount,messages[1],proofs)) // Using other user's message
            .to.be.revertedWith("Invalid hash");
        })

        it("Should revert if message with wrong currency (giving wrong hash) is passed", async () => {
            const amount = ethers.utils.parseEther("1")
            await expect(treasury.forcedWithdraw(amount,messageWithWrongCurrency,proofs))
            .to.be.revertedWith("Invalid hash");
        })

        it("Should revert if message with wrong state amount (giving wrong hash) is passed", async () => {
            const amount = ethers.utils.parseEther("1")
            await expect(treasury.forcedWithdraw(amount,messageWithWrongAmount,proofs))
            .to.be.revertedWith("Invalid hash");
        })

        it("Should revert if user making transaction doesn't match address in message", async () => {
            const amount = ethers.utils.parseEther("1")
            // instead of owner, account1 is making transaction
            await expect(treasury.connect(account1).forcedWithdraw(amount,message,proofs)) 
            .to.be.revertedWith("Invalid user");
        })

    })

    describe("Adding currency to the contract", () => {
        const currencyToAdd = "0xdAC17F958D2ee523a2206206994597C13D831ec7"
        it("Only the owner can add currency", async () => {
          await expect(
            treasury
              .connect(account1)
              ._addCurrency(currencyToAdd)
          ).to.be.revertedWith("Ownable: caller is not the owner");
        })
    
        it("Emit AddCurrency event", async () => {
          await expect(
            treasury._addCurrency(currencyToAdd)
          ).to.emit(treasury, "AddCurrency");
        })
    
        it("Return true when checking added currency", async () => {
          await treasury._addCurrency(currencyToAdd)
          const newCurrency = await treasury.supportCurrency(
            currencyToAdd
          );
          expect(newCurrency).to.be.equal(true);
        })
    
      });

    describe("Removing currency to the contract", () => {
        const currencyToRemove = "0xdAC17F958D2ee523a2206206994597C13D831ec7"
        it("Only the owner can remove currency", async () => {
          await expect(
            treasury
              .connect(account1)
              ._removeCurrency(currencyToRemove)
          ).to.be.revertedWith("Ownable: caller is not the owner");
        })
    
        it("Emit RemoveCurrency event", async () => {
          await expect(
            treasury._removeCurrency(currencyToRemove)
          ).to.emit(treasury, "RemoveCurrency");
        })
    
        it("Return false when checking added currency thats been removed", async () => {
          await treasury._addCurrency(currencyToRemove)
          await treasury._removeCurrency(currencyToRemove)
          const removedCurrency = await treasury.supportCurrency(
            currencyToRemove
          );
          expect(removedCurrency).to.be.equal(false);
        })
    
      });


    describe("Pausing the contract", () => {

        it("Only the owner can pause", async () => {
          await expect(treasury.connect(account1)._pause()).to.be.revertedWith(
            "Ownable: caller is not the owner"
          );
        })
    
        it("Return paused as true once _pause call is made ", async () => {
          await expect(treasury._pause()).to.emit(treasury, "Paused");
          const paused = await treasury.paused();
          expect(paused).to.be.equal(true);
        })
    
      });


      describe("Unpausing the contract", () => {

        it("Only the owner can pause", async () => {
          await expect(treasury.connect(account1)._unpause()).to.be.revertedWith(
            "Ownable: caller is not the owner"
          );
        })
    
        it("Return paused as false once _unpause call is made ", async () => {
          await expect(treasury._unpause()).to.emit(treasury, "Unpaused");
          const paused = await treasury.paused();
          expect(paused).to.be.equal(false);
        })
    
      });

})