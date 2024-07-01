import { Connection } from '@solana/web3.js';

async function getCurrentFee(endpoint) {
  try {
    const connection = new Connection(endpoint, 'confirmed');
    const feeCalculator = (await connection.getRecentBlockhash()).feeCalculator;
    const lamportsPerSignature = feeCalculator.lamportsPerSignature;
    const fee = lamportsPerSignature / 1e9; // Convert lamports to SOL
    return fee;
  } catch (error) {
    console.error('Error getting current fee:', error);
    throw error;
  }
}

// module.exports = { getCurrentFee };
export default getCurrentFee;
// // Usage example
// const solanaEndpoint = 'https://api.mainnet-beta.solana.com';
// getCurrentFee(solanaEndpoint)
//   .then((fee) => {
//     console.log(`Current network fee: ${fee} SOL`);
//   })
//   .catch((error) => {
//     console.error('Error:', error);
//   });
