import { Connection, Keypair, VersionedTransaction, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { Wallet } from '@project-serum/anchor';
import getCurrentFee from './solana_network_fee.js';
import bs58 from 'bs58';
import dotenv from 'dotenv';
dotenv.config();

const solana_network = 'https://api.mainnet-beta.solana.com';
const connection = new Connection(solana_network);

const privateKey = process.env.PRIVATE_KEY;
const keypair = Keypair.fromSecretKey(bs58.decode(privateKey));
const wallet = new Wallet(keypair);

// Get quotes using Jupiter API
async function getQuote(inputMint, outputMint, amount, slippageBps) {
    const response = await fetch(`https://quote-api.jup.ag/v6/quote?inputMint=${inputMint}&outputMint=${outputMint}&amount=${amount}&slippageBps=${slippageBps}`);
    const data = await response.json();
    return data;
}

async function getAllQuotes(token_1, token_2, token_3, init_amount, slippageBps) {
    try {
        const quote1 = await getQuote(token_1, token_2, init_amount, slippageBps);
        const quote2 = await getQuote(token_2, token_3, quote1.outAmount, slippageBps);
        const quote3 = await getQuote(token_3, token_1, quote2.outAmount, slippageBps);
            return {quote1, quote2, quote3}
    } catch (error) {
        console.error(`Error getting best routes: ${error.message}`);
        throw error;
    }
}
async function executeSwap(quoteResponse) {
    const { swapTransaction } = await (
      await fetch('https://quote-api.jup.ag/v6/swap', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          quoteResponse, // quoteResponse from /quote api
          userPublicKey: wallet.publicKey.toString(), // user public key to be used for the swap
          wrapAndUnwrapSol: true,
        })
      })
    ).json();
    
    console.log(`Request Wallet: ${wallet.publicKey.toString()}`)
    
    // deserialize the transaction
    const swapTransactionBuf = Buffer.from(swapTransaction, 'base64');
    var transaction = VersionedTransaction.deserialize(swapTransactionBuf);
    console.log(transaction)

    transaction.sign([wallet.payer]);    // sign the transaction
    const rawTransaction = transaction.serialize()
    const txid = await connection.sendRawTransaction(rawTransaction, {skipPreflight: true, maxRetries: 2});
    await connection.confirmTransaction(txid);    // Execute the transaction
    console.log(`https://solscan.io/tx/${txid}`);
}

async function triangularArbitrage() {
  const token_1 = 'So11111111111111111111111111111111111111112'; //SOL
  const token_2 = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'; //USDC
  const token_3 = 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB'; //USDT
  const initialTradeSize = LAMPORTS_PER_SOL * 0.01; // 0.01 SOL in lamports
  const target_profit = 0.005 // 0.5%
  const slippageBps = 50;

  try {
    const currentNetworkFee = await getCurrentFee(solana_network);
    console.log(`Current Network Fee: ${currentNetworkFee}`);

    let currentBalance = await connection.getBalance(wallet.publicKey) / LAMPORTS_PER_SOL;
    console.log(`Current SOL balance: ${currentBalance}`);

    const {quote1, quote2, quote3} = await getAllQuotes(token_1, token_2, token_3, initialTradeSize, slippageBps)
    const profit = (quote3.outAmount - initialTradeSize) / LAMPORTS_PER_SOL;
    console.log(`potential profit: ${profit} SOL`);

    if (profit > initialTradeSize * target_profit + currentNetworkFee * 3) {
      console.log(`Profitable triangular arbitrage opportunity found!`);
      
      for (const Txn of [quote1, quote2, quote3]) {
        await executeSwap(Txn);
        }
        console.log(`Profit: ${profit} SOL`);
    } else {
        console.log('Triangular arbitrage not profitable');
        console.log(`Waiting 1 minute before trying again...`);
        await new Promise((resolve) => setTimeout(resolve, 60000)); // Wait for 1 minute
        await triangularArbitrage();
    }
    } catch (error) {
        console.error(`Error executing triangular arbitrage: ${error.message}`);
        console.log(`Waiting 1 minute before trying again...`);
        await new Promise((resolve) => setTimeout(resolve, 60000)); // Wait for 1 minute
        await triangularArbitrage();
  }
}

triangularArbitrage();
