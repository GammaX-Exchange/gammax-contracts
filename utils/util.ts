import { BigNumber, BigNumberish } from "ethers";
import hre, { ethers } from "hardhat";

const { keccak256,AbiCoder } = ethers.utils
const abiCoder = new AbiCoder()


export async function mineBlock(): Promise<void> {
  await hre.network.provider.request({
    method: "evm_mine",
  });
}

export async function setNextBlockTimestamp(timestamp: number): Promise<void> {
  await hre.network.provider.request({
    method: "evm_setNextBlockTimestamp",
    params: [timestamp],
  });
}

export async function getLatestBlockTimestamp(): Promise<number> {
  return (await ethers.provider.getBlock("latest")).timestamp;
}

export async function mineBlockTo(blockNumber: number): Promise<void> {
  for (
    let i = await ethers.provider.getBlockNumber();
    i < blockNumber;
    i += 1
  ) {
    await mineBlock();
  }
}

export async function latest(): Promise<BigNumber> {
  const block = await ethers.provider.getBlock("latest");
  return BigNumber.from(block.timestamp);
}

export async function advanceTime(time: number): Promise<void> {
  await ethers.provider.send("evm_increaseTime", [time]);
}

export async function advanceTimeAndBlock(time: number): Promise<void> {
  await advanceTime(time);
  await mineBlock();
}

export const duration = {
  seconds(val: BigNumberish): BigNumber {
    return BigNumber.from(val);
  },
  minutes(val: BigNumberish): BigNumber {
    return BigNumber.from(val).mul(this.seconds("60"));
  },
  hours(val: BigNumberish): BigNumber {
    return BigNumber.from(val).mul(this.minutes("60"));
  },
  days(val: BigNumberish): BigNumber {
    return BigNumber.from(val).mul(this.hours("24"));
  },
  weeks(val: BigNumberish): BigNumber {
    return BigNumber.from(val).mul(this.days("7"));
  },
  years(val: BigNumberish): BigNumber {
    return BigNumber.from(val).mul(this.days("365"));
  },
};

// Defaults to e18 using amount * 10^18
export function getBigNumber(amount: BigNumberish, decimals = 18): BigNumber {
  return BigNumber.from(amount).mul(BigNumber.from(10).pow(decimals));
}

// MERKLE ROOT IMPLEMENTATIONS

// Creating merkle tree hash
const hash = (x:BigInt) => BigInt( keccak256(
  abiCoder.encode(["uint"],[x])
))

const pairHash = (a:BigInt, b:BigInt) => hash(hash(a) ^ hash(b))


// The value to denote that a certain branch is empty
const empty = 0n

// Calculate one level up the tree of a hash array by taking the hash of 
// each pair in sequence
const oneLevelUp = (data:BigInt[]) => {
    var result = []
    var inp = [...data]    // To avoid over writing the input

    // Add an empty value if necessary (we need all the leaves to be
    // paired)
    if (inp.length % 2 === 1)
        inp.push(empty)

    for(var i=0; i<inp.length; i+=2)
        result.push(pairHash(inp[i],inp[i+1]))

    return result
} 

// Get the merkle root of a hashArray
export const getMerkleRoot = (data:BigInt[]) => {
  var result

  result = [...data]
  
  while(result.length > 1)
      result = oneLevelUp(result)

  return result[0]
}

export const getMerkleProof = (data:BigInt[], n:number):BigInt[] => {
  var result = [], currentLayer = [...data], currentN = n

  // Until we reach the top
  while (currentLayer.length > 1) {
      // No odd length layers
      if (currentLayer.length % 2)
          currentLayer.push(empty)

      result.push(currentN % 2    
             // If currentN is odd, add the value before it
          ? currentLayer[currentN-1] 
             // If it is even, add the value after it
          : currentLayer[currentN+1])

      // Move to the next layer up
      currentN = Math.floor(currentN/2)
      currentLayer = oneLevelUp(currentLayer)
  }   // while currentLayer.length > 1

  return result
} 

// Verify a merkle proof that nValueHash is in the merkle tree
export const verifyMerkleProof = (root:BigInt, nValueHash:BigInt, proof:BigInt[]) => {
  var hashVal = nValueHash // The hash for this layer

  // For every tree layer
  for(let layer=0; layer<proof.length; layer++)
      hashVal = pairHash(proof[layer],hashVal)

  return root === hashVal
} 


//Creates message to be hashed
export const createMessage  = (address:string,currency:string,amount:string):string => {
  return abiCoder.encode(
    ["address","address","uint256"],
    [address,currency,amount]
  )
}

//Creates message to be hashed
export const hashMessage = (message:string):BigInt => {
  return BigInt(keccak256(message))
}