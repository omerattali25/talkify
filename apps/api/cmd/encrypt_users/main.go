package main

import (
	"fmt"
	"log"
	"os"
	"talkify/apps/api/internal/config"
	"talkify/apps/api/internal/encryption"

	"github.com/jmoiron/sqlx"
	_ "github.com/lib/pq"
)

func main() {
	// Load config
	cfg, err := config.LoadConfig()
	if err != nil {
		log.Fatalf("Failed to load config: %v", err)
	}

	// Connect to database
	db, err := sqlx.Connect("postgres", cfg.Database.DSN())
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}
	defer db.Close()

	// Initialize key manager
	keyManager, err := encryption.NewKeyManager(cfg.Encryption.KeyFile)
	if err != nil {
		log.Fatalf("Failed to initialize key manager: %v", err)
	}

	// Initialize encryption manager
	encryptor, err := encryption.NewManager(keyManager.GetKey())
	if err != nil {
		log.Fatalf("Failed to initialize encryption: %v", err)
	}

	// Get all users
	type User struct {
		ID    string
		Email string
		Phone string
	}
	var users []User
	err = db.Select(&users, "SELECT id, email, phone FROM users")
	if err != nil {
		log.Fatalf("Failed to get users: %v", err)
	}

	// Begin transaction
	tx, err := db.Beginx()
	if err != nil {
		log.Fatalf("Failed to start transaction: %v", err)
	}
	defer tx.Rollback()

	// Update each user with encrypted data
	for _, user := range users {
		encryptedEmail, err := encryptor.EncryptString(user.Email)
		if err != nil {
			log.Fatalf("Failed to encrypt email for user %s: %v", user.ID, err)
		}

		encryptedPhone, err := encryptor.EncryptString(user.Phone)
		if err != nil {
			log.Fatalf("Failed to encrypt phone for user %s: %v", user.ID, err)
		}

		_, err = tx.Exec(`
			UPDATE users 
			SET email = $1, phone = $2 
			WHERE id = $3
		`, encryptedEmail, encryptedPhone, user.ID)
		if err != nil {
			log.Fatalf("Failed to update user %s: %v", user.ID, err)
		}

		fmt.Printf("Encrypted data for user %s\n", user.ID)
	}

	// Commit transaction
	err = tx.Commit()
	if err != nil {
		log.Fatalf("Failed to commit transaction: %v", err)
	}

	fmt.Printf("Successfully encrypted data for %d users\n", len(users))
	os.Exit(0)
}
