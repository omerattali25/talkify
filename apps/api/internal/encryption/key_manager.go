package encryption

import (
	"crypto/rand"
	"encoding/base64"
	"errors"
	"os"
	"sync"
)

var (
	ErrKeyGeneration = errors.New("failed to generate key")
	ErrKeyNotFound   = errors.New("encryption key not found")
)

// KeyManager handles encryption key management
type KeyManager struct {
	mu       sync.RWMutex
	mainKey  []byte
	keyFile  string
	fallback bool
}

// NewKeyManager creates a new key manager instance
func NewKeyManager(keyFile string) (*KeyManager, error) {
	km := &KeyManager{
		keyFile:  keyFile,
		fallback: false,
	}

	// Try to load existing key
	if err := km.loadKey(); err != nil {
		// If key doesn't exist, generate a new one
		if err := km.generateAndSaveKey(); err != nil {
			return nil, err
		}
	}

	return km, nil
}

// GetKey returns the current encryption key
func (km *KeyManager) GetKey() []byte {
	km.mu.RLock()
	defer km.mu.RUnlock()
	return km.mainKey
}

// RotateKey generates a new key and saves it
func (km *KeyManager) RotateKey() error {
	return km.generateAndSaveKey()
}

// generateAndSaveKey creates a new encryption key and saves it
func (km *KeyManager) generateAndSaveKey() error {
	km.mu.Lock()
	defer km.mu.Unlock()

	// Generate new key
	key := make([]byte, 32) // AES-256 requires 32 bytes
	if _, err := rand.Read(key); err != nil {
		return ErrKeyGeneration
	}

	// Save key to file
	encoded := base64.StdEncoding.EncodeToString(key)
	if err := os.WriteFile(km.keyFile, []byte(encoded), 0600); err != nil {
		if !km.fallback {
			// If we can't save the key but don't have a fallback, use the generated key in memory
			km.mainKey = key
			km.fallback = true
			return nil
		}
		return err
	}

	km.mainKey = key
	return nil
}

// loadKey reads the encryption key from file
func (km *KeyManager) loadKey() error {
	km.mu.Lock()
	defer km.mu.Unlock()

	data, err := os.ReadFile(km.keyFile)
	if err != nil {
		return err
	}

	decoded, err := base64.StdEncoding.DecodeString(string(data))
	if err != nil {
		return err
	}

	if len(decoded) != 32 {
		return ErrInvalidKeySize
	}

	km.mainKey = decoded
	return nil
}
