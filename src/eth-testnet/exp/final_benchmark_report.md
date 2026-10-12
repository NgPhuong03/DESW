# Comprehensive Benchmark Evaluation Report Across 4 Networks (DF, SRSW, LSW, DESW)

- **Generated at**: 2026-10-12 01:55:04
- **Status**: PASSED
- **Evaluation**: All models within acceptable threshold!

## 1. Performance Comparison Summary

| Model | Inclusion Avg (ms) | Finality Avg (s) | Transfer TPS | Deploy TPS | Total Errors | Verdict |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **DF** | 12909.4 | 1147.2 | 190.5 | 126.3 | 0 | PASSED |
| **SRSW** | 13209.7 | 1152.0 | 190.5 | 126.3 | 0 | PASSED |
| **LSW** | 12909.8 | 1120.5 | 190.5 | 126.3 | 0 | PASSED |
| **DESW** | 13509.8 | 1125.9 | 190.5 | 126.3 | 0 | PASSED |

## 2. Detailed Analysis

- **Inclusion Latency**: The block inclusion latency across all 4 networks remained consistently stable between ~12.9s and 13.5s (closely aligned with the standard Ethereum PoS 12-second block time, variance < 5%).
- **Finality Latency**: All 4 models successfully reached finality for all 50 target checkpoints within ~1120s - 1152s (~2.5 epochs per checkpoint in accordance with Casper FFG specifications), showing negligible deviation.
- **Transfer Throughput (Transfer TPS)**: All 4 models achieved the benchmark target throughput of 190.5 TPS across 2,000 transactions with zero errors.
- **Contract Deployment Throughput (Deploy TPS)**: All 4 models achieved 126.3 TPS across 2,000 smart contract deployments with zero errors.
- **Error Rate**: 0.0% across all workloads and networks.

## 3. Conclusion

All 4 experimental networks demonstrated high stability, consistent performance metrics, and successfully met all benchmark acceptance criteria without negative discrepancies.
