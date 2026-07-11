import { execFile } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { promisify } from 'node:util'
import {
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
} from '@solana/web3.js'

const rpcUrl = process.env.SOLANA_RPC_URL ?? 'https://api.devnet.solana.com'
const proofPath = process.env.INTENT_PROOF_PATH ?? 'docs/devnet-transaction-proof.json'
const memoProgram = new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr')
const execFileAsync = promisify(execFile)
const payer = Keypair.generate()
const recipient = Keypair.generate().publicKey

async function rpc(method, params) {
  const body = JSON.stringify({ id: 1, jsonrpc: '2.0', method, params })
  const { stdout } = await execFileAsync('curl', [
    '--connect-timeout', '10',
    '--max-time', '30',
    '--silent',
    '--show-error',
    '--header', 'content-type: application/json',
    '--data', body,
    rpcUrl,
  ])
  const response = JSON.parse(stdout)
  if (response.error) throw new Error(`${method}: ${response.error.message}`)
  return response.result
}

async function waitForConfirmation(signature) {
  for (let attempt = 0; attempt < 24; attempt += 1) {
    const result = await rpc('getSignatureStatuses', [[signature], { searchTransactionHistory: true }])
    const status = result.value[0]
    if (status?.err) throw new Error(`Transaction ${signature} failed: ${JSON.stringify(status.err)}`)
    if (status?.confirmationStatus === 'confirmed' || status?.confirmationStatus === 'finalized') return
    await new Promise((resolve) => setTimeout(resolve, 1_250))
  }
  throw new Error(`Timed out waiting for ${signature} to reach confirmed status.`)
}

async function main() {
  const airdropSignature = await rpc('requestAirdrop', [payer.publicKey.toBase58(), 0.02 * LAMPORTS_PER_SOL])
  await waitForConfirmation(airdropSignature)

  const transaction = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: payer.publicKey,
      lamports: 0.001 * LAMPORTS_PER_SOL,
      toPubkey: recipient,
    }),
    new TransactionInstruction({
      data: Buffer.from('IntentProof: automated Devnet transfer verification'),
      keys: [],
      programId: memoProgram,
    }),
  )
  const latestBlockhash = await rpc('getLatestBlockhash', [{ commitment: 'confirmed' }])
  transaction.feePayer = payer.publicKey
  transaction.recentBlockhash = latestBlockhash.value.blockhash
  transaction.sign(payer)

  const signature = await rpc('sendTransaction', [transaction.serialize().toString('base64'), {
    encoding: 'base64',
    preflightCommitment: 'confirmed',
  }])
  await waitForConfirmation(signature)
  const proof = {
    airdropSignature,
    commitment: 'confirmed',
    explorerUrl: `https://explorer.solana.com/tx/${signature}?cluster=devnet`,
    memo: 'IntentProof: automated Devnet transfer verification',
    payer: payer.publicKey.toBase58(),
    recipient: recipient.toBase58(),
    rpcUrl,
    signature,
    transferLamports: 0.001 * LAMPORTS_PER_SOL,
    verifiedAt: new Date().toISOString(),
  }

  await mkdir(dirname(proofPath), { recursive: true })
  await writeFile(proofPath, `${JSON.stringify(proof, null, 2)}\n`)
  console.log(JSON.stringify(proof, null, 2))
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
