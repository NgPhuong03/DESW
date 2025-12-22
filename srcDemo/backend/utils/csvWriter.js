/**
 * CSV Writer Utility
 *
 * Utility để convert và lưu dữ liệu validators thành CSV files
 */

const fs = require("fs");
const path = require("path");

class CSVWriter {
  constructor() {
    // Tạo thư mục data/csv nếu chưa tồn tại
    this.csvDir = path.join(__dirname, "..", "data", "csv");
    this.ensureDirectoryExists(this.csvDir);
  }

  /**
   * Đảm bảo thư mục tồn tại
   */
  ensureDirectoryExists(dirPath) {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
  }

  /**
   * Escape CSV field nếu cần (nếu có dấu phẩy, dấu ngoặc kép, hoặc xuống dòng)
   */
  escapeCSVField(field) {
    if (field === null || field === undefined) {
      return "";
    }
    const str = String(field);
    // Nếu có dấu phẩy, dấu ngoặc kép, hoặc xuống dòng thì cần wrap trong dấu ngoặc kép
    if (str.includes(",") || str.includes('"') || str.includes("\n")) {
      // Escape dấu ngoặc kép bằng cách double nó
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  }

  /**
   * Convert validators data thành CSV format
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
   * Lưu validators data thành CSV file
   * @param {string} chainName - Tên blockchain
   * @param {Array} validators - Mảng validators
   * @param {string} timestamp - Timestamp (optional, sẽ tự tạo nếu không có)
   * @returns {string} - Đường dẫn file đã lưu
   */
  saveValidatorsToCSV(chainName, validators, timestamp = null) {
    try {
      if (!Array.isArray(validators) || validators.length === 0) {
        throw new Error("Invalid validators data: must be a non-empty array");
      }

      // Tạo timestamp nếu chưa có
      const ts = timestamp || new Date().toISOString();
      // Format timestamp thành filename-friendly format: YYYYMMDD_HHMMSS
      const date = new Date(ts);
      const dateStr = date.toISOString().replace(/[-:]/g, "").split(".")[0]; // YYYYMMDDTHHMMSS
      const formattedDate = dateStr.replace("T", "_"); // YYYYMMDD_HHMMSS

      // Tạo filename: {chainName}_{timestamp}.csv
      const filename = `${chainName}_${formattedDate}.csv`;
      const filepath = path.join(this.csvDir, filename);

      // Convert và lưu CSV
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
   * Lưu nhiều chains data thành các CSV files riêng biệt
   * @param {Object} chainsData - Object chứa data của nhiều chains
   * @returns {Object} - Object chứa file paths đã lưu
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
   * Lấy danh sách CSV files đã lưu
   * @param {string} chainName - Filter theo chain name (optional)
   * @returns {Array} - Mảng các file info
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
   * Đọc CSV file và trả về data
   * @param {string} filename - Tên file CSV
   * @returns {Array} - Mảng validators
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
        return []; // Chỉ có header hoặc empty
      }

      // Skip header
      const validators = [];
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        // Parse CSV line (xử lý đơn giản, có thể cần cải thiện nếu có edge cases)
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
