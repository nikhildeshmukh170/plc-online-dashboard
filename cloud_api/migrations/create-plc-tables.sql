-- Migration script to create tags and history tables

CREATE TABLE IF NOT EXISTS plc_tags (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tag VARCHAR(100) NOT NULL UNIQUE,
  address INT NOT NULL,
  type VARCHAR(20) NOT NULL,
  `function` VARCHAR(20) NOT NULL,
  label VARCHAR(255) DEFAULT NULL,
  unit VARCHAR(50) DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS plc_data_history (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tag_id INT NULL,
  tag VARCHAR(100) NOT NULL,
  value VARCHAR(255) NULL,
  status VARCHAR(50) NULL,
  captured_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tag_id) REFERENCES plc_tags(id) ON DELETE SET NULL
);

-- existing plc_data table should retain last-known state
-- ensure unique tag index exists
ALTER TABLE plc_data
  ADD UNIQUE INDEX IF NOT EXISTS (tag);
