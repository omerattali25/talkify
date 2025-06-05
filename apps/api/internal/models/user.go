package models

import (
	"time"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

type User struct {
	Base
	Username     string    `db:"username" json:"username"`
	Email        string    `db:"email" json:"email"`
	Phone        string    `db:"phone" json:"phone"`
	Status       string    `db:"status" json:"status"`
	LastSeen     time.Time `db:"last_seen" json:"last_seen"`
	AvatarURL    string    `db:"avatar_url" json:"avatar_url"`
	IsOnline     bool      `db:"is_online" json:"is_online"`
	IsActive     bool      `db:"is_active" json:"is_active"`
	PasswordHash string    `db:"password_hash" json:"-"`
}

type UserService struct {
	db *sqlx.DB
}

func NewUserService(db *sqlx.DB) *UserService {
	return &UserService{db: db}
}

func (s *UserService) Create(user *User) error {
	query := `
		INSERT INTO users (username, email, phone, password_hash, status, avatar_url)
		VALUES ($1, $2, $3, $4, $5, $6)
		RETURNING id, created_at, updated_at`

	return s.db.QueryRowx(query,
		user.Username,
		user.Email,
		user.Phone,
		user.PasswordHash,
		user.Status,
		user.AvatarURL,
	).Scan(&user.ID, &user.CreatedAt, &user.UpdatedAt)
}

func (s *UserService) GetByID(id uuid.UUID) (*User, error) {
	var user User
	err := s.db.Get(&user, "SELECT * FROM users WHERE id = $1", id)
	if err != nil {
		return nil, err
	}
	return &user, nil
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
		SET username = $1, email = $2, phone = $3, status = $4, avatar_url = $5, is_online = $6
		WHERE id = $7
		RETURNING updated_at`

	return s.db.QueryRowx(query,
		user.Username,
		user.Email,
		user.Phone,
		user.Status,
		user.AvatarURL,
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
