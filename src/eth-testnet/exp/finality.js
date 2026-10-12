import http from 'k6/http';
import { sleep } from 'k6';
import { SharedArray } from 'k6/data';
import { Trend, Rate } from 'k6/metrics';
import exec from 'k6/execution';

// Ethereum PoS finality: from submitting a signed transaction to the point
// when the canonical block containing it is at or below the finalized head.
const rpcUrl = __ENV.RPC_URL;
if (!rpcUrl) throw new Error('RPC_URL is required');

const txsFile = __ENV.TXS_FILE || './finality_txs.json';
const signedTxs = new SharedArray('presigned ETH transfers', function () {
  const data = JSON.parse(open(txsFile));
  if (!Array.isArray(data) || data.length === 0) {
    throw new Error(`${txsFile} must contain a non-empty array`);
  }
  return data;
});

const pollSeconds = Math.max(1, Number(__ENV.POLL_SECONDS || 3));
const maxWaitSeconds = Math.max(30, Number(__ENV.MAX_WAIT_SECONDS || 1800));
const inclusionMs = new Trend('tx_inclusion_ms', true);
const finalityMs = new Trend('tx_finality_ms', true);
const inclusionSuccess = new Rate('tx_included');
const finalitySuccess = new Rate('tx_finalized');

export const options = {
  scenarios: {
    test: {
      executor: 'shared-iterations',
      vus: Number(5),
      iterations: 50,
      maxDuration: '200m',
    },
  },
  summaryTrendStats: ['avg', 'min', 'med', 'p(90)', 'p(95)', 'max'],
};

function rpc(method, params) {
  const response = http.post(rpcUrl, JSON.stringify({
    jsonrpc: '2.0', id: 1, method, params,
  }), {
    headers: { 'Content-Type': 'application/json' },
    timeout: '15s',
    tags: { rpc_method: method },
  });
  if (response.status !== 200) {
    throw new Error(`${method}: HTTP ${response.status}`);
  }
  let result;
  try { result = response.json(); } catch (e) {
    throw new Error(`${method}: invalid JSON`);
  }
  if (result.error) {
    throw new Error(`${method}: ${JSON.stringify(result.error)}`);
  }
  return result.result;
}

export default function () {
  const idx = exec.scenario.iterationInTest;
  const tx = signedTxs[idx];
  const start = Date.now();
  const deadline = start + maxWaitSeconds * 1000;
  let hash;
  let receipt = null;
  let inclusionRecorded = false;

  try {
    hash = rpc('eth_sendRawTransaction', [tx.raw]);
    if (!hash) throw new Error('empty transaction hash');
    console.log(`SENT nonce=${tx.nonce} hash=${hash}`);
  } catch (e) {
    inclusionSuccess.add(false);
    finalitySuccess.add(false);
    console.error(`SEND_FAILED nonce=${tx.nonce} ${e.message}`);
    return;
  }

  while (Date.now() < deadline) {
    try {
      if (!receipt) {
        const found = rpc('eth_getTransactionReceipt', [hash]);
        if (found && found.blockNumber && found.blockHash) {
          receipt = found;
          if (!inclusionRecorded) {
            const elapsed = Date.now() - start;
            inclusionMs.add(elapsed);
            inclusionSuccess.add(true);
            inclusionRecorded = true;
            console.log(`INCLUDED nonce=${tx.nonce} hash=${hash} block=${found.blockNumber} inclusion_ms=${elapsed} status=${found.status}`);
          }
        }
      }

      if (receipt) {
        const finalized = rpc('eth_getBlockByNumber', ['finalized', false]);
        if (finalized && finalized.number &&
            parseInt(finalized.number, 16) >= parseInt(receipt.blockNumber, 16)) {
          // Avoid mistaking a reorged receipt for canonical finality.
          const canonicalBlock = rpc('eth_getBlockByNumber', [receipt.blockNumber, false]);
          const currentReceipt = rpc('eth_getTransactionReceipt', [hash]);
          if (canonicalBlock && currentReceipt &&
              canonicalBlock.hash.toLowerCase() === receipt.blockHash.toLowerCase() &&
              currentReceipt.blockHash.toLowerCase() === receipt.blockHash.toLowerCase()) {
            const elapsed = Date.now() - start;
            finalityMs.add(elapsed);
            finalitySuccess.add(true);
            console.log(`FINALIZED nonce=${tx.nonce} hash=${hash} finality_ms=${elapsed} block=${receipt.blockNumber} status=${currentReceipt.status}`);
            return;
          }
          // Inclusion may have been reorged; seek the current receipt again.
          receipt = null;
        }
      }
    } catch (e) {
      console.warn(`POLL_WARNING nonce=${tx.nonce} ${e.message}`);
    }
    sleep(pollSeconds);
  }

  if (!inclusionRecorded) inclusionSuccess.add(false);
  finalitySuccess.add(false);
  console.error(`FINALITY_TIMEOUT nonce=${tx.nonce} hash=${hash} included=${inclusionRecorded} wait_s=${maxWaitSeconds}`);
}
