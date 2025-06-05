package config

import (
	"fmt"
	"os"
	"path/filepath"

	"github.com/joho/godotenv"
)

// DatabaseConfig holds database connection settings
type DatabaseConfig struct {
	Host     string
	Port     string
	User     string
	Password string
	DBName   string
	SSLMode  string
}

// EncryptionConfig holds encryption settings
type EncryptionConfig struct {
	KeyFile string
}

// JWTConfig holds JWT settings
type JWTConfig struct {
	SecretKey string
}

// Config holds all configuration settings
type Config struct {
	Database   DatabaseConfig
	Encryption EncryptionConfig
	JWT        JWTConfig
}

// LoadConfig loads configuration from environment variables
func LoadConfig() (*Config, error) {
	// Load .env file if it exists
	godotenv.Load()

	// Create data directory if it doesn't exist
	dataDir := "data"
	if err := os.MkdirAll(dataDir, 0700); err != nil {
		return nil, fmt.Errorf("failed to create data directory: %w", err)
	}

	return &Config{
		Database: DatabaseConfig{
			Host:     getEnv("DB_HOST", "localhost"),
			Port:     getEnv("DB_PORT", "5433"),
			User:     getEnv("DB_USER", "talkify_user"),
			Password: getEnv("DB_PASSWORD", "talkify_password"),
			DBName:   getEnv("DB_NAME", "talkify_db"),
			SSLMode:  getEnv("DB_SSL_MODE", "disable"),
		},
		Encryption: EncryptionConfig{
			KeyFile: filepath.Join(dataDir, "encryption.key"),
		},
		JWT: JWTConfig{
			SecretKey: getEnv("JWT_SECRET_KEY", "your-256-bit-secret"),
		},
	}, nil
}

// DSN returns the database connection string
func (c *DatabaseConfig) DSN() string {
	return fmt.Sprintf("host=%s port=%s user=%s password=%s dbname=%s sslmode=%s",
		c.Host, c.Port, c.User, c.Password, c.DBName, c.SSLMode)
}

// getEnv gts an environment variable or returns a default value
func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}
