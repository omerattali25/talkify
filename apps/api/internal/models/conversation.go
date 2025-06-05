package models

import (
	"time"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

type Conversation struct {
	Base
	Participants []ConversationParticipant `db:"-" json:"participants"`
}

type ConversationParticipant struct {
	ConversationID uuid.UUID `db:"conversation_id" json:"conversation_id"`
	UserID         uuid.UUID `db:"user_id" json:"user_id"`
	JoinedAt       time.Time `db:"joined_at" json:"joined_at"`
	LastReadAt     time.Time `db:"last_read_at" json:"last_read_at"`
	User           *User     `db:"-" json:"user,omitempty"`
}

type ConversationService struct {
	db *sqlx.DB
}

func NewConversationService(db *sqlx.DB) *ConversationService {
	return &ConversationService{db: db}
}

func (s *ConversationService) Create(userID1, userID2 uuid.UUID) (*Conversation, error) {
	tx, err := s.db.Beginx()
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()

	conv := &Conversation{}
	err = tx.QueryRowx(`
		INSERT INTO conversations DEFAULT VALUES
		RETURNING id, created_at, updated_at
	`).StructScan(conv)
	if err != nil {
		return nil, err
	}

	// Add participants
	_, err = tx.Exec(`
		INSERT INTO conversation_participants (conversation_id, user_id)
		VALUES ($1, $2), ($1, $3)
	`, conv.ID, userID1, userID2)
	if err != nil {
		return nil, err
	}

	if err = tx.Commit(); err != nil {
		return nil, err
	}

	return conv, nil
}

func (s *ConversationService) GetByID(id uuid.UUID) (*Conversation, error) {
	conv := &Conversation{}
	err := s.db.Get(conv, "SELECT * FROM conversations WHERE id = $1", id)
	if err != nil {
		return nil, err
	}

	// Get participants
	participants := []ConversationParticipant{}
	err = s.db.Select(&participants, `
		SELECT cp.*, u.username, u.avatar_url, u.is_online
		FROM conversation_participants cp
		JOIN users u ON u.id = cp.user_id
		WHERE cp.conversation_id = $1
	`, id)
	if err != nil {
		return nil, err
	}

	conv.Participants = participants
	return conv, nil
}

func (s *ConversationService) GetUserConversations(userID uuid.UUID) ([]Conversation, error) {
	conversations := []Conversation{}
	err := s.db.Select(&conversations, `
		SELECT c.*
		FROM conversations c
		JOIN conversation_participants cp ON cp.conversation_id = c.id
		WHERE cp.user_id = $1
		ORDER BY c.updated_at DESC
	`, userID)
	if err != nil {
		return nil, err
	}

	// Get participants for each conversation
	for i := range conversations {
		participants := []ConversationParticipant{}
		err = s.db.Select(&participants, `
			SELECT cp.*, u.username, u.avatar_url, u.is_online
			FROM conversation_participants cp
			JOIN users u ON u.id = cp.user_id
			WHERE cp.conversation_id = $1
		`, conversations[i].ID)
		if err != nil {
			return nil, err
		}
		conversations[i].Participants = participants
	}

	return conversations, nil
}

func (s *ConversationService) UpdateLastRead(conversationID, userID uuid.UUID) error {
	_, err := s.db.Exec(`
		UPDATE conversation_participants
		SET last_read_at = CURRENT_TIMESTAMP
		WHERE conversation_id = $1 AND user_id = $2
	`, conversationID, userID)
	return err
}
