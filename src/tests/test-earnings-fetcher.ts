// test-earnings-fetcher.ts
// Tests for earnings data fetching and calculation

import EarningsFetcher, { EthTransaction, SolTransaction } from '../earnings/earnings-fetcher';
import EarningsCalculator from '../earnings/earnings-calculator';
import EarningsReport from '../earnings/earnings-report';

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeEthTx(overrides: Partial<EthTransaction> = {}): EthTransaction {
    return {
        hash: '0xabc',
        from: '0xfrom',
        to: '0xto',
        value: String(1e18),   // 1 ETH in wei
        gasUsed: '21000',
        gasPrice: String(20e9), // 20 gwei
        timeStamp: String(Math.floor(Date.now() / 1000)),
        isError: '0',
        blockNumber: '1000',
        ...overrides,
    };
}

function makeSolTx(overrides: Partial<SolTransaction> = {}): SolTransaction {
    return {
        signature: 'sig1',
        slot: 1,
        blockTime: Math.floor(Date.now() / 1000),
        status: 'Success',
        fee: 5000,
        lamport: 1e9, // 1 SOL
        signer: ['D1DYRrJqfuTnuTszWtv3nHChCcanGm7Q1eF2GUUQ2r3'],
        ...overrides,
    };
}

// Simple assertion helper
function assert(condition: boolean, message: string): void {
    if (!condition) throw new Error(`FAIL: ${message}`);
    console.log(`  PASS: ${message}`);
}

function assertClose(actual: number, expected: number, epsilon: number, message: string): void {
    assert(Math.abs(actual - expected) < epsilon, message);
}

// ── Calculator Tests ──────────────────────────────────────────────────────────

function testCrossExchangeProfit(): void {
    console.log('\n[EarningsCalculator] cross-exchange profit formula');
    const calc = new EarningsCalculator();

    const profit = calc.calculateCrossExchangeProfit(1.05, 0.97);
    assertClose(profit, 1.05 * 0.97 - 1, 1e-10, 'cross-exchange profit = rateAtoB * rateBtoA - 1');

    const noProfit = calc.calculateCrossExchangeProfit(1.0, 1.0);
    assertClose(noProfit, 0, 1e-10, 'equal rates → profit = 0');
}

function testTriangularProfit(): void {
    console.log('\n[EarningsCalculator] triangular arbitrage profit formula');
    const calc = new EarningsCalculator();

    const profit = calc.calculateTriangularProfit(1.05, 1.05, 0.92);
    assertClose(profit, 1.05 * 1.05 * 0.92 - 1, 1e-10, 'triangular profit = rateAtoB * rateBtoC * rateCtoA - 1');
}

function testEthProfits(): void {
    console.log('\n[EarningsCalculator] ETH profit calculation');
    const calc = new EarningsCalculator();

    // 1 successful tx: value=1 ETH, gas=21000 * 20gwei = 0.00042 ETH
    const txs = [makeEthTx()];
    const result = calc.calculateEthProfits(txs);

    assertClose(result.grossValueEth, 1, 1e-6, 'gross value = 1 ETH');
    assertClose(result.totalGasCostEth, 0.00042, 1e-8, 'gas cost = 21000 * 20gwei');
    assertClose(result.netProfitEth, 1 - 0.00042, 1e-8, 'net profit = gross - gas');
    assert(result.transactionCount === 1, 'transaction count = 1');

    // Error transactions should be excluded
    const errorTxs = [makeEthTx({ isError: '1' })];
    const errorResult = calc.calculateEthProfits(errorTxs);
    assert(errorResult.transactionCount === 0, 'error transactions excluded');
}

function testSolProfits(): void {
    console.log('\n[EarningsCalculator] Solana profit calculation');
    const calc = new EarningsCalculator();

    const txs = [makeSolTx()];
    const result = calc.calculateSolProfits(txs);

    assertClose(result.grossValueSol, 1, 1e-6, 'gross value = 1 SOL');
    assertClose(result.totalFeeSol, 5000 / 1e9, 1e-10, 'fee = 5000 lamports in SOL');
    assertClose(result.netProfitSol, 1 - 5000 / 1e9, 1e-10, 'net = gross - fee');

    const failedTx = [makeSolTx({ status: 'Fail' })];
    const failedResult = calc.calculateSolProfits(failedTx);
    assert(failedResult.transactionCount === 0, 'failed Solana transactions excluded');
}

function testEmptyTransactions(): void {
    console.log('\n[EarningsCalculator] empty transaction lists');
    const calc = new EarningsCalculator();

    const ethResult = calc.calculateEthProfits([]);
    assert(ethResult.netProfitEth === 0, 'empty ETH list → 0 profit');

    const solResult = calc.calculateSolProfits([]);
    assert(solResult.netProfitSol === 0, 'empty SOL list → 0 profit');
}

function testGasEstimation(): void {
    console.log('\n[EarningsCalculator] gas cost estimation');
    const calc = new EarningsCalculator();

    const cost = calc.estimateGasCostEth(21000, 20); // 21000 gas * 20 gwei
    assertClose(cost, 0.00042, 1e-8, '21000 gas @ 20 gwei = 0.00042 ETH');
}

function testIsProfitable(): void {
    console.log('\n[EarningsCalculator] profitability check');
    const calc = new EarningsCalculator();

    const isProfitable = calc.isCrossExchangeProfitable(1.05, 1.0, 1.0, 0.001);
    assert(isProfitable, 'profitable when gross > gas');

    const isNotProfitable = calc.isCrossExchangeProfitable(1.0, 1.0, 1.0, 0.001);
    assert(!isNotProfitable, 'not profitable when spread is zero');
}

function testEarningsSummary(): void {
    console.log('\n[EarningsCalculator] consolidated summary');
    const calc = new EarningsCalculator();

    const summary = calc.calculateEarningsSummary([makeEthTx()], [makeSolTx()]);
    assert(summary.eth.transactionCount === 1, 'ETH transaction in summary');
    assert(summary.sol.transactionCount === 1, 'SOL transaction in summary');
    assert(summary.calculatedAt instanceof Date, 'calculatedAt is a Date');
}

// ── Run All Tests ────────────────────────────────────────────────────────────

async function runTests(): Promise<void> {
    console.log('=== test-earnings-fetcher.ts ===');
    let passed = 0;
    let failed = 0;

    const tests = [
        testCrossExchangeProfit,
        testTriangularProfit,
        testEthProfits,
        testSolProfits,
        testEmptyTransactions,
        testGasEstimation,
        testIsProfitable,
        testEarningsSummary,
    ];

    for (const test of tests) {
        try {
            test();
            passed++;
        } catch (error) {
            console.error(`  ERROR in ${test.name}: ${error}`);
            failed++;
        }
    }

    console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
    if (failed > 0) process.exit(1);
}

runTests().catch((err) => {
    console.error('Test runner error:', err);
    process.exit(1);
});
