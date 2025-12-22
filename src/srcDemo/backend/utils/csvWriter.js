/**
 * CSV Writer Utility
 *
 * Utility to convert and save validator data to CSV files
 */

const fs = require("fs");
const path = require("path");

class CSVWriter {
  constructor() {
    this.csvDir = path.join(__dirname, "..", "data", "csv");
    this.ensureDirectoryExists(this.csvDir);
  }

  /**
   * Ensure directory exists
   */
  ensureDirectoryExists(dirPath) {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
  }

  /**
   * Escape CSV field if needed (if contains comma, quotes, or newline)
   */
  escapeCSVField(field) {
    if (field === null || field === undefined) {
      return "";
    }
    const str = String(field);
    if (str.includes(",") || str.includes('"') || str.includes("\n")) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  }

  /**
   * Convert validators data to CSV format
   */
  convertToCSV(validators, includeHeaders = true) {
    if (!Array.isArray(validators) || validators.length === 0) {
      return "";
    }

    const lines = [];

    // Header
    if (includeHeaders) {
      lines.push("address,tokens");
    }

    // Data rows
    validators.forEach((validator) => {
      const address = this.escapeCSVField(validator.address || "");
      const tokens = this.escapeCSVField(validator.tokens || 0);
      lines.push(`${address},${tokens}`);
    });

    return lines.join("\n");
  }

  /**
   * Save validators data to CSV file
   * @param {string} chainName - Blockchain name
   * @param {Array} validators - Array of validators
   * @param {string} timestamp - Timestamp (optional, will be auto-generated if not provided)
   * @returns {string} - Path to saved file
   */
  saveValidatorsToCSV(chainName, validators, timestamp = null) {
    try {
      if (!Array.isArray(validators) || validators.length === 0) {
        throw new Error("Invalid validators data: must be a non-empty array");
      }

      const ts = timestamp || new Date().toISOString();
      const date = new Date(ts);
      const dateStr = date.toISOString().replace(/[-:]/g, "").split(".")[0];
      const formattedDate = dateStr.replace("T", "_");

      const filename = `${chainName}_${formattedDate}.csv`;
      const filepath = path.join(this.csvDir, filename);

      const csvContent = this.convertToCSV(validators, true);
      fs.writeFileSync(filepath, csvContent, "utf8");

      console.log(
        `✅ Saved CSV: ${filepath} (${validators.length} validators)`
      );

      return filepath;
    } catch (error) {
      console.error(`❌ Error saving CSV for ${chainName}:`, error.message);
      throw error;
    }
  }

  /**
   * Save multiple chains data to separate CSV files
   * @param {Object} chainsData - Object containing data of multiple chains
   * @returns {Object} - Object containing saved file paths
   */
  saveMultipleChainsToCSV(chainsData) {
    const savedFiles = {};

    for (const [chainName, chainData] of Object.entries(chainsData)) {
      if (
        chainData.success &&
        Array.isArray(chainData.validators) &&
        chainData.validators.length > 0
      ) {
        try {
          const filepath = this.saveValidatorsToCSV(
            chainName,
            chainData.validators,
            chainData.timestamp
          );
          savedFiles[chainName] = {
            success: true,
            filepath: filepath,
            filename: path.basename(filepath),
            validators_count: chainData.validators.length,
          };
        } catch (error) {
          savedFiles[chainName] = {
            success: false,
            error: error.message,
          };
        }
      } else {
        savedFiles[chainName] = {
          success: false,
          error: "No valid validators data to save",
        };
      }
    }

    return savedFiles;
  }

  /**
   * Get list of saved CSV files
   * @param {string} chainName - Filter by chain name (optional)
   * @returns {Array} - Array of file info
   */
  listCSVFiles(chainName = null) {
    try {
      if (!fs.existsSync(this.csvDir)) {
        return [];
      }

      const files = fs.readdirSync(this.csvDir);
      const csvFiles = files
        .filter((file) => file.endsWith(".csv"))
        .map((file) => {
          const filepath = path.join(this.csvDir, file);
          const stats = fs.statSync(filepath);
          return {
            filename: file,
            filepath: filepath,
            size: stats.size,
            created: stats.birthtime,
            modified: stats.mtime,
          };
        })
        .filter((file) => {
          if (chainName) {
            return file.filename.startsWith(`${chainName}_`);
          }
          return true;
        })
        .sort((a, b) => b.modified - a.modified); // Sort by modified date, newest first

      return csvFiles;
    } catch (error) {
      console.error("Error listing CSV files:", error.message);
      return [];
    }
  }

  /**
   * Read CSV file and return data
   * @param {string} filename - CSV filename
   * @returns {Array} - Array of validators
   */
  readCSVFile(filename) {
    try {
      const filepath = path.join(this.csvDir, filename);
      if (!fs.existsSync(filepath)) {
        throw new Error(`File not found: ${filename}`);
      }

      const content = fs.readFileSync(filepath, "utf8");
      const lines = content.split("\n").filter((line) => line.trim() !== "");

      if (lines.length < 2) {
        return [];
      }

      const validators = [];
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        const parts = line.split(",");
        if (parts.length >= 2) {
          const address = parts[0].replace(/^"|"$/g, ""); // Remove quotes if any
          const tokens = parseInt(parts[1]) || 0;
          validators.push({ address, tokens });
        }
      }

      return validators;
    } catch (error) {
      console.error(`Error reading CSV file ${filename}:`, error.message);
      throw error;
    }
  }
}

module.exports = CSVWriter;
