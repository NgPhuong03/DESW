/**
 * Blockchain Data Collection Service
 *
 * Collect real validator data from blockchains
 * Integrated from analysis_chains project
 */

const axios = require("axios");
const CSVWriter = require("../utils/csvWriter");
require("dotenv").config();

class BlockchainDataService {
  constructor() {
    this.supportedChains = [
      "ethereum",
      "aptos",
      "axelar",
      "celestia",
      "celo",
      "injective",
      "polygon",
      "sui",
    ];
    this.csvWriter = new CSVWriter();
  }

  /**
   * Collect Ethereum data from Dune Analytics
   */
  async fetchEthereumData() {
    try {
      const apiKey = process.env.DUNE_API_KEY;
      if (!apiKey) {
        throw new Error("DUNE_API_KEY not configured");
      }

      const response = await axios.get(
        "https://api.dune.com/api/v1/query/3383110/results",
        {
          headers: {
            "X-Dune-API-Key": apiKey,
          },
          params: {
            limit: 1000,
          },
        }
      );

      if (response.status !== 200) {
        throw new Error(`Dune API error: ${response.status}`);
      }

      const rows = response.data?.result?.rows || [];

      // Group by entity_just_name and sum amount_staked
      const grouped = {};
      rows.forEach((row) => {
        const entity = row.entity_just_name;
        const stake = parseFloat(row.amount_staked) || 0;

        if (grouped[entity]) {
          grouped[entity] += stake;
        } else {
          grouped[entity] = stake;
        }
      });

      // Convert to array format
      const validators = Object.entries(grouped)
        .map(([address, tokens]) => ({
          address,
          tokens: Math.floor(tokens),
        }))
        .filter((v) => v.tokens > 0) // Filter out validators with stake <= 0
        .sort((a, b) => b.tokens - a.tokens);

      const result = {
        success: true,
        blockchain: "ethereum",
        validators,
        total_validators: validators.length,
        total_stake: validators.reduce((sum, v) => sum + v.tokens, 0),
        timestamp: new Date().toISOString(),
      };

      this.saveToCSV(result);

      return result;
    } catch (error) {
      console.error("Error fetching Ethereum data:", error.message);
      return {
        success: false,
        blockchain: "ethereum",
        error: error.message,
        validators: [],
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Collect Aptos data from Google Storage + RPC
   */
  async fetchAptosData() {
    try {
      console.log("Fetching Aptos validators data...");

      // Step 1: Get validators list from Google Storage
      const validatorsResponse = await axios.get(
        "https://storage.googleapis.com/aptos-mainnet/explorer/validator_stats_v2.json",
        {
          params: { "cache-version": "0" },
          timeout: 10000,
        }
      );

      if (!Array.isArray(validatorsResponse.data)) {
        throw new Error("Invalid validators data format");
      }

      const validatorsList = validatorsResponse.data;
      const validators = [];

      for (const validator of validatorsList) {
        const ownerAddress = validator.owner_address;
        if (!ownerAddress) continue;

        try {
          const tokens = await this.getAptosTokens(ownerAddress);
          if (tokens !== null && tokens !== undefined && tokens > 0) {
            validators.push({
              address: ownerAddress,
              tokens: tokens,
            });
          }
        } catch (error) {
          console.warn(
            `Failed to get tokens for ${ownerAddress}:`,
            error.message
          );
        }
      }

      // Sort by tokens descending
      validators.sort((a, b) => b.tokens - a.tokens);

      const result = {
        success: true,
        blockchain: "aptos",
        validators: validators,
        total_validators: validators.length,
        total_stake: validators.reduce((sum, v) => sum + v.tokens, 0),
        timestamp: new Date().toISOString(),
      };

      this.saveToCSV(result);

      return result;
    } catch (error) {
      console.error("Error fetching Aptos data:", error.message);
      return {
        success: false,
        blockchain: "aptos",
        error: error.message,
        validators: [],
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Get tokens for specific Aptos validator
   * Returns null on error, not 0 (matches Python behavior)
   */
  async getAptosTokens(address) {
    try {
      const response = await axios.get(
        `https://fullnode.mainnet.aptoslabs.com/v1/accounts/${address}/resource/0x1::stake::StakePool`,
        {
          headers: { Accept: "application/json" },
          timeout: 5000,
        }
      );

      if (response.status !== 200) {
        return null;
      }

      const activeValue = response.data?.data?.active?.value;
      if (activeValue !== null && activeValue !== undefined) {
        return parseInt(activeValue);
      } else {
        return null;
      }
    } catch (error) {
      return null;
    }
  }

  /**
   * Collect Celestia data from Explorer API
   */
  async fetchCelestiaData() {
    try {
      console.log("Fetching Celestia validators data...");

      const response = await axios.get(
        "https://celestia.api.explorers.guru/api/v1/validators",
        { timeout: 10000 }
      );

      if (!Array.isArray(response.data)) {
        throw new Error("Invalid validators data format");
      }

      const validators = response.data
        .map((validator) => ({
          address: validator.moniker || validator.operator_address || null,
          tokens: parseInt(validator.tokens || 0),
        }))
        .filter((v) => v.tokens > 0)
        .sort((a, b) => b.tokens - a.tokens);

      const result = {
        success: true,
        blockchain: "celestia",
        validators,
        total_validators: validators.length,
        total_stake: validators.reduce((sum, v) => sum + v.tokens, 0),
        timestamp: new Date().toISOString(),
      };

      this.saveToCSV(result);

      return result;
    } catch (error) {
      console.error("Error fetching Celestia data:", error.message);
      return {
        success: false,
        blockchain: "celestia",
        error: error.message,
        validators: [],
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Collect Polygon data from Validator.info API
   */
  async fetchPolygonData() {
    try {
      console.log("Fetching Polygon validators data...");

      const response = await axios.get(
        "https://validator.info/api/polygon/validators",
        {
          params: {
            timeframe: "week",
            nameContains: "",
            activeValidators: true,
          },
          timeout: 10000,
        }
      );

      const validatorsList = response.data?.list || [];
      if (!Array.isArray(validatorsList)) {
        throw new Error("Invalid validators data format");
      }

      const validators = validatorsList
        .map((validator) => ({
          address: validator.name || validator.address || "",
          tokens: parseInt(validator.totalStaked || 0),
        }))
        .filter((v) => v.tokens > 0)
        .sort((a, b) => b.tokens - a.tokens);

      const result = {
        success: true,
        blockchain: "polygon",
        validators,
        total_validators: validators.length,
        total_stake: validators.reduce((sum, v) => sum + v.tokens, 0),
        timestamp: new Date().toISOString(),
      };

      this.saveToCSV(result);

      return result;
    } catch (error) {
      console.error("Error fetching Polygon data:", error.message);
      return {
        success: false,
        blockchain: "polygon",
        error: error.message,
        validators: [],
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Collect Sui data from JSON-RPC API
   */
  async fetchSuiData() {
    try {
      console.log("Fetching Sui validators data...");

      const response = await axios.post(
        "https://fullnode.mainnet.sui.io",
        {
          jsonrpc: "2.0",
          id: 1,
          method: "suix_getLatestSuiSystemState",
          params: [],
        },
        {
          headers: { "Content-Type": "application/json" },
          timeout: 10000,
        }
      );

      const activeValidators = response.data?.result?.activeValidators || [];
      if (!Array.isArray(activeValidators)) {
        throw new Error("Invalid validators data format");
      }

      const validators = activeValidators
        .map((validator) => ({
          address: validator.name || validator.suiAddress || "",
          tokens: parseInt(validator.stakingPoolSuiBalance || 0),
        }))
        .filter((v) => v.tokens > 0)
        .sort((a, b) => b.tokens - a.tokens);

      const result = {
        success: true,
        blockchain: "sui",
        validators,
        total_validators: validators.length,
        total_stake: validators.reduce((sum, v) => sum + v.tokens, 0),
        timestamp: new Date().toISOString(),
      };

      this.saveToCSV(result);

      return result;
    } catch (error) {
      console.error("Error fetching Sui data:", error.message);
      return {
        success: false,
        blockchain: "sui",
        error: error.message,
        validators: [],
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Collect Injective data from LCD API
   */
  async fetchInjectiveData() {
    try {
      console.log("Fetching Injective validators data...");

      const response = await axios.get(
        "https://lcd.injective.network/cosmos/base/tendermint/v1beta1/validatorsets/latest",
        { timeout: 10000 }
      );

      const validatorsList = response.data?.validators || [];
      if (!Array.isArray(validatorsList)) {
        throw new Error("Invalid validators data format");
      }

      const validators = validatorsList
        .map((validator) => ({
          address: validator.address || null,
          tokens: parseInt(validator.voting_power || 0),
        }))
        .filter((v) => v.tokens > 0)
        .sort((a, b) => b.tokens - a.tokens);

      const result = {
        success: true,
        blockchain: "injective",
        validators,
        total_validators: validators.length,
        total_stake: validators.reduce((sum, v) => sum + v.tokens, 0),
        timestamp: new Date().toISOString(),
      };

      this.saveToCSV(result);

      return result;
    } catch (error) {
      console.error("Error fetching Injective data:", error.message);
      return {
        success: false,
        blockchain: "injective",
        error: error.message,
        validators: [],
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Collect Celo data from TheCelo API
   */
  async fetchCeloData() {
    try {
      console.log("Fetching Celo validators data...");

      const response = await axios.get("https://thecelo.com/api/v0.1", {
        params: { method: "groups" },
        timeout: 10000,
      });

      const groups = response.data?.groups || {};
      if (typeof groups !== "object") {
        throw new Error("Invalid validators data format");
      }

      const validators = Object.entries(groups)
        .map(([address, group]) => {
          const tokensFloat = parseFloat(group[1] || 0);
          return {
            address: address,
            tokens: Math.floor(tokensFloat),
          };
        })
        .filter((v) => v.tokens > 0)
        .sort((a, b) => b.tokens - a.tokens);

      const result = {
        success: true,
        blockchain: "celo",
        validators,
        total_validators: validators.length,
        total_stake: validators.reduce((sum, v) => sum + v.tokens, 0),
        timestamp: new Date().toISOString(),
      };

      this.saveToCSV(result);

      return result;
    } catch (error) {
      console.error("Error fetching Celo data:", error.message);
      return {
        success: false,
        blockchain: "celo",
        error: error.message,
        validators: [],
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Collect Axelar data from RPC API
   */
  async fetchAxelarData() {
    try {
      console.log("Fetching Axelar validators data...");

      const response = await axios.get(
        "https://rpc-axelar.imperator.co/dump_consensus_state",
        { timeout: 10000 }
      );

      const validatorsList =
        response.data?.result?.round_state?.validators?.validators || [];
      if (!Array.isArray(validatorsList)) {
        throw new Error("Invalid validators data format");
      }

      const validators = validatorsList
        .map((validator) => ({
          address: validator.address || "Unknown",
          tokens: parseInt(validator.voting_power || 0),
        }))
        .filter((v) => v.tokens > 0)
        .sort((a, b) => b.tokens - a.tokens);

      const result = {
        success: true,
        blockchain: "axelar",
        validators,
        total_validators: validators.length,
        total_stake: validators.reduce((sum, v) => sum + v.tokens, 0),
        timestamp: new Date().toISOString(),
      };

      this.saveToCSV(result);

      return result;
    } catch (error) {
      console.error("Error fetching Axelar data:", error.message);
      return {
        success: false,
        blockchain: "axelar",
        error: error.message,
        validators: [],
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Generate mock data for demonstration
   */
  generateMockValidators(chainName) {
    const baseCount = Math.floor(Math.random() * 50) + 20; // 20-70 validators
    const validators = [];

    for (let i = 0; i < baseCount; i++) {
      // Generate realistic stake distribution (Pareto-like)
      const rank = i + 1;
      const baseStake = 1000000; // 1M base stake
      const stake = Math.floor(
        (baseStake / Math.pow(rank, 0.8)) * (0.5 + Math.random())
      );

      validators.push({
        address: `${chainName}_validator_${i + 1}`,
        tokens: stake,
      });
    }

    return validators.sort((a, b) => b.tokens - a.tokens);
  }

  /**
   * Collect data from all chains
   */
  async fetchAllChainsData(selectedChains) {
    const chainsToFetch =
      Array.isArray(selectedChains) && selectedChains.length > 0
        ? selectedChains
        : this.supportedChains;

    const results = {};
    const promises = [];

    // Map each chain to its specific fetch method
    const chainMethods = {
      ethereum: () => this.fetchEthereumData(),
      aptos: () => this.fetchAptosData(),
      celestia: () => this.fetchCelestiaData(),
      polygon: () => this.fetchPolygonData(),
      sui: () => this.fetchSuiData(),
      injective: () => this.fetchInjectiveData(),
      celo: () => this.fetchCeloData(),
      axelar: () => this.fetchAxelarData(),
    };

    for (const chain of chainsToFetch) {
      const fetchMethod = chainMethods[chain];
      if (fetchMethod) {
        promises.push(
          fetchMethod().then((result) => {
            results[chain] = result;
          })
        );
      } else {
        // Fallback to mock data if method not implemented
        promises.push(
          Promise.resolve().then(() => {
            results[chain] = {
              success: false,
              blockchain: chain,
              error: "API not implemented yet",
              validators: [],
              timestamp: new Date().toISOString(),
            };
          })
        );
      }
    }

    await Promise.all(promises);

    const result = {
      success: true,
      chains: results,
      timestamp: new Date().toISOString(),
      summary: {
        total_chains: chainsToFetch.length,
        successful_chains: Object.values(results).filter((r) => r.success)
          .length,
        failed_chains: Object.values(results).filter((r) => !r.success).length,
      },
    };

    this.saveMultipleChainsToCSV(results);

    return result;
  }

  /**
   * Get data for a specific chain
   */
  async fetchSingleChain(chainName) {
    if (!this.supportedChains.includes(chainName)) {
      throw new Error(`Unsupported blockchain: ${chainName}`);
    }

    // Map each chain to its specific fetch method
    const chainMethods = {
      ethereum: () => this.fetchEthereumData(),
      aptos: () => this.fetchAptosData(),
      celestia: () => this.fetchCelestiaData(),
      polygon: () => this.fetchPolygonData(),
      sui: () => this.fetchSuiData(),
      injective: () => this.fetchInjectiveData(),
      celo: () => this.fetchCeloData(),
      axelar: () => this.fetchAxelarData(),
    };

    const fetchMethod = chainMethods[chainName];
    if (fetchMethod) {
      return await fetchMethod();
    } else {
      throw new Error(`API not implemented for ${chainName}`);
    }
  }

  /**
   * Save chain data to CSV file
   * @param {Object} chainData - Fetched chain data
   */
  saveToCSV(chainData) {
    try {
      if (
        chainData.success &&
        Array.isArray(chainData.validators) &&
        chainData.validators.length > 0
      ) {
        const filepath = this.csvWriter.saveValidatorsToCSV(
          chainData.blockchain,
          chainData.validators,
          chainData.timestamp
        );
        chainData.csv_file = {
          saved: true,
          filepath: filepath,
          filename: require("path").basename(filepath),
        };
      }
    } catch (error) {
      console.error(
        `Error saving CSV for ${chainData.blockchain}:`,
        error.message
      );
    }
  }

  /**
   * Save multiple chains data to CSV files
   * @param {Object} chainsData - Object containing data of multiple chains
   */
  saveMultipleChainsToCSV(chainsData) {
    try {
      const savedFiles = this.csvWriter.saveMultipleChainsToCSV(chainsData);
      console.log(
        `✅ Saved ${
          Object.keys(savedFiles).filter((k) => savedFiles[k].success).length
        } CSV files`
      );
    } catch (error) {
      console.error("Error saving multiple CSV files:", error.message);
    }
  }

  /**
   * Validate chain data format
   */
  validateChainData(data) {
    if (!data || !Array.isArray(data.validators)) {
      return false;
    }

    return data.validators.every(
      (validator) =>
        validator.address &&
        typeof validator.tokens === "number" &&
        validator.tokens >= 0
    );
  }
}

module.exports = BlockchainDataService;
