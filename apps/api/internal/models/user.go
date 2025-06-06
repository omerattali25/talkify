package models

import (
	"talkify/apps/api/internal/encryption"
	"time"

	"fmt"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
	"golang.org/x/crypto/bcrypt"
)

type User struct {
	ID           uuid.UUID  `db:"id" json:"id"`
	Username     string     `db:"username" json:"username"`
	Email        string     `db:"email" json:"email"`
	Phone        string     `db:"phone" json:"phone"`
	PasswordHash string     `db:"password_hash" json:"-"`
	Status       string     `db:"status" json:"status"`
	LastSeen     *time.Time `db:"last_seen" json:"last_seen,omitempty"`
	IsOnline     bool       `db:"is_online" json:"is_online"`
	IsActive     bool       `db:"is_active" json:"is_active"`
	CreatedAt    time.Time  `db:"created_at" json:"created_at"`
	UpdatedAt    time.Time  `db:"updated_at" json:"updated_at"`
}

type UserService struct {
	db        *sqlx.DB
	encryptor *encryption.Manager
}

func NewUserService(db *sqlx.DB, encryptor *encryption.Manager) *UserService {
	return &UserService{
		db:        db,
		encryptor: encryptor,
	}
}

type CreateUserInput struct {
	Username string `json:"username" binding:"required"`
	Email    string `json:"email" binding:"required,email"`
	Phone    string `json:"phone" binding:"required"`
	Password string `json:"password" binding:"required,min=8"`
}

func (s *UserService) Create(input *CreateUserInput) (*User, error) {
	// Hash password
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(input.Password), bcrypt.DefaultCost)
	if err != nil {
		return nil, fmt.Errorf("failed to hash password: %v", err)
	}

	// Encrypt sensitive data
	encryptedEmail, err := s.encryptor.EncryptString(input.Email)
	if err != nil {
		return nil, fmt.Errorf("failed to encrypt email: %v", err)
	}

	encryptedPhone, err := s.encryptor.EncryptString(input.Phone)
	if err != nil {
		return nil, fmt.Errorf("failed to encrypt phone: %v", err)
	}

	user := &User{
		Username:     input.Username,
		Email:        encryptedEmail,
		Phone:        encryptedPhone,
		PasswordHash: string(hashedPassword),
		IsActive:     true,
		Status:       "Hey, I'm using Talkify!", // Default status
	}

	query := `
		INSERT INTO users (username, email, phone, password_hash, is_active, status)
		VALUES ($1, $2, $3, $4, $5, $6)
		RETURNING id, created_at, updated_at`

	err = s.db.QueryRowx(query,
		user.Username,
		user.Email,
		user.Phone,
		user.PasswordHash,
		user.IsActive,
		user.Status,
	).Scan(&user.ID, &user.CreatedAt, &user.UpdatedAt)

	if err != nil {
		return nil, fmt.Errorf("failed to create user: %v", err)
	}

	// Decrypt sensitive data for response
	user.Email, _ = s.encryptor.DecryptString(user.Email)
	user.Phone, _ = s.encryptor.DecryptString(user.Phone)

	return user, nil
}

type LoginInput struct {
	Username string `json:"username" binding:"required"`
	Password string `json:"password" binding:"required"`
}

func (s *UserService) Login(input *LoginInput) (*User, error) {
	user := &User{}
	err := s.db.Get(user, `
		SELECT * FROM users 
		WHERE username = $1 AND is_active = true
	`, input.Username)

	if err != nil {
		return nil, ErrNotFound
	}

	// Check password
	err = bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(input.Password))
	if err != nil {
		return nil, ErrUnauthorized
	}

	// Decrypt sensitive data
	var decryptErr error
	user.Email, decryptErr = s.encryptor.DecryptString(user.Email)
	if decryptErr != nil {
		return nil, fmt.Errorf("failed to decrypt email: %v", decryptErr)
	}

	user.Phone, decryptErr = s.encryptor.DecryptString(user.Phone)
	if decryptErr != nil {
		return nil, fmt.Errorf("failed to decrypt phone: %v", decryptErr)
	}

	// Update last seen and online status
	now := time.Now()
	user.LastSeen = &now
	user.IsOnline = true

	_, err = s.db.Exec(`
		UPDATE users 
		SET last_seen = CURRENT_TIMESTAMP, is_online = true 
		WHERE id = $1
	`, user.ID)

	if err != nil {
		return nil, fmt.Errorf("failed to update last seen: %v", err)
	}

	return user, nil
}

func (s *UserService) GetByID(id uuid.UUID) (*User, error) {
	user := &User{}
	err := s.db.Get(user, `
		SELECT * FROM users 
		WHERE id = $1 AND is_active = true
	`, id)

	if err != nil {
		return nil, ErrNotFound
	}

	// Decrypt sensitive data
	user.Email, _ = s.encryptor.DecryptString(user.Email)
	user.Phone, _ = s.encryptor.DecryptString(user.Phone)

	return user, nil
}

func (s *UserService) UpdatePassword(userID uuid.UUID, currentPassword, newPassword string) error {
	user := &User{}
	err := s.db.Get(user, "SELECT password_hash FROM users WHERE id = $1", userID)
	if err != nil {
		return ErrNotFound
	}

	// Verify current password
	err = bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(currentPassword))
	if err != nil {
		return ErrUnauthorized
	}

	// Hash new password
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(newPassword), bcrypt.DefaultCost)
	if err != nil {
		return err
	}

	// Update password
	_, err = s.db.Exec(`
		UPDATE users 
		SET password_hash = $1, updated_at = CURRENT_TIMESTAMP 
		WHERE id = $2
	`, string(hashedPassword), userID)

	return err
}

func (s *UserService) GetByUsername(username string) (*User, error) {
	var user User
	err := s.db.Get(&user, "SELECT * FROM users WHERE username = $1", username)
	if err != nil {
		return nil, err
	}
	return &user, nil
}

func (s *UserService) Update(user *User) error {
	query := `
		UPDATE users 
		SET username = $1, email = $2, phone = $3, status = $4, is_online = $5
		WHERE id = $6
		RETURNING updated_at`

	return s.db.QueryRowx(query,
		user.Username,
		user.Email,
		user.Phone,
		user.Status,
		user.IsOnline,
		user.ID,
	).Scan(&user.UpdatedAt)
}

func (s *UserService) Delete(id uuid.UUID) error {
	_, err := s.db.Exec("UPDATE users SET is_active = false WHERE id = $1", id)
	return err
}

func (s *UserService) UpdateLastSeen(id uuid.UUID) error {
	_, err := s.db.Exec("UPDATE users SET last_seen = CURRENT_TIMESTAMP WHERE id = $1", id)
	return err
}

func (s *UserService) SetOnlineStatus(id uuid.UUID, isOnline bool) error {
	_, err := s.db.Exec("UPDATE users SET is_online = $1, last_seen = CURRENT_TIMESTAMP WHERE id = $2", isOnline, id)
	return err
}

func (s *UserService) GetAll() ([]*User, error) {
	var users []*User
	err := s.db.Select(&users, `
		SELECT * FROM users 
		WHERE is_active = true
		ORDER BY username ASC
	`)
	if err != nil {
		return nil, fmt.Errorf("failed to get users: %v", err)
	}

	if len(users) == 0 {
		return []*User{}, nil // Return empty slice instead of nil
	}

	// Decrypt sensitive data for each user
	for _, user := range users {
		var decryptErr error
		user.Email, decryptErr = s.encryptor.DecryptString(user.Email)
		if decryptErr != nil {
			return nil, fmt.Errorf("failed to decrypt email for user %s: %v", user.Username, decryptErr)
		}

		user.Phone, decryptErr = s.encryptor.DecryptString(user.Phone)
		if decryptErr != nil {
			return nil, fmt.Errorf("failed to decrypt phone for user %s: %v", user.Username, decryptErr)
		}
	}

	return users, nil
}
