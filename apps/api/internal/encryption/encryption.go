package encryption

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"encoding/base64"
	"errors"
	"io"
)

var (
	// ErrInvalidKeySize is returned when the encryption key size is invalid
	ErrInvalidKeySize = errors.New("invalid key size: key must be 32 bytes for AES-256")
	// ErrEncryption is returned when encryption fails
	ErrEncryption = errors.New("encryption failed")
	// ErrDecryption is returned when decryption fails
	ErrDecryption = errors.New("decryption failed")
)

// Manager handles encryption and decryption operations
type Manager struct {
	key []byte
}

// NewManager creates a new encryption manager with the given key
func NewManager(key []byte) (*Manager, error) {
	if len(key) != 32 {
		return nil, ErrInvalidKeySize
	}
	return &Manager{key: key}, nil
}

// Encrypt encrypts data using AES-GCM
func (m *Manager) Encrypt(plaintext []byte) (string, error) {
	block, err := aes.NewCipher(m.key)
	if err != nil {
		return "", ErrEncryption
	}

	// Never use more than 2^32 random nonces with a given key
	nonce := make([]byte, 12)
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return "", ErrEncryption
	}

	aesgcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", ErrEncryption
	}

	// Encrypt and append nonce
	ciphertext := aesgcm.Seal(nil, nonce, plaintext, nil)
	encryptedData := append(nonce, ciphertext...)

	// Convert to base64 for storage
	return base64.StdEncoding.EncodeToString(encryptedData), nil
}

// Decrypt decrypts data using AES-GCM
func (m *Manager) Decrypt(encryptedString string) ([]byte, error) {
	// Decode base64
	encryptedData, err := base64.StdEncoding.DecodeString(encryptedString)
	if err != nil {
		return nil, ErrDecryption
	}

	if len(encryptedData) < 12 {
		return nil, ErrDecryption
	}

	block, err := aes.NewCipher(m.key)
	if err != nil {
		return nil, ErrDecryption
	}

	aesgcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, ErrDecryption
	}

	// Extract nonce and ciphertext
	nonce := encryptedData[:12]
	ciphertext := encryptedData[12:]

	// Decrypt
	plaintext, err := aesgcm.Open(nil, nonce, ciphertext, nil)
	if err != nil {
		return nil, ErrDecryption
	}

	return plaintext, nil
}

// EncryptString is a helper function to encrypt string data
func (m *Manager) EncryptString(plaintext string) (string, error) {
	return m.Encrypt([]byte(plaintext))
}

// DecryptString is a helper function to decrypt string data
func (m *Manager) DecryptString(encryptedString string) (string, error) {
	decrypted, err := m.Decrypt(encryptedString)
	if err != nil {
		return "", err
	}
	return string(decrypted), nil
}
