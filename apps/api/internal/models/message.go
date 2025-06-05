package models

import (
	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

type MessageType string

const (
	MessageTypeText     MessageType = "text"
	MessageTypeImage    MessageType = "image"
	MessageTypeVideo    MessageType = "video"
	MessageTypeAudio    MessageType = "audio"
	MessageTypeFile     MessageType = "file"
	MessageTypeLocation MessageType = "location"
)

type Message struct {
	Base
	ConversationID    *uuid.UUID  `db:"conversation_id" json:"conversation_id,omitempty"`
	GroupID           *uuid.UUID  `db:"group_id" json:"group_id,omitempty"`
	SenderID          uuid.UUID   `db:"sender_id" json:"sender_id"`
	ReplyToID         *uuid.UUID  `db:"reply_to_id" json:"reply_to_id,omitempty"`
	Content           string      `db:"content" json:"content"`
	MessageType       MessageType `db:"message_type" json:"message_type"`
	MediaURL          *string     `db:"media_url" json:"media_url,omitempty"`
	MediaThumbnailURL *string     `db:"media_thumbnail_url" json:"media_thumbnail_url,omitempty"`
	MediaSize         *int        `db:"media_size" json:"media_size,omitempty"`
	MediaDuration     *int        `db:"media_duration" json:"media_duration,omitempty"`
	IsEdited          bool        `db:"is_edited" json:"is_edited"`
	IsDeleted         bool        `db:"is_deleted" json:"is_deleted"`
	Sender            *User       `db:"-" json:"sender,omitempty"`
	ReplyTo           *Message    `db:"-" json:"reply_to,omitempty"`
}

type MessageService struct {
	db *sqlx.DB
}

func NewMessageService(db *sqlx.DB) *MessageService {
	return &MessageService{db: db}
}

func (s *MessageService) Create(msg *Message) error {
	query := `
		INSERT INTO messages (
			conversation_id, group_id, sender_id, reply_to_id,
			content, message_type, media_url, media_thumbnail_url,
			media_size, media_duration
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
		RETURNING id, created_at, updated_at`

	return s.db.QueryRowx(query,
		msg.ConversationID,
		msg.GroupID,
		msg.SenderID,
		msg.ReplyToID,
		msg.Content,
		msg.MessageType,
		msg.MediaURL,
		msg.MediaThumbnailURL,
		msg.MediaSize,
		msg.MediaDuration,
	).StructScan(msg)
}

func (s *MessageService) GetByID(id uuid.UUID) (*Message, error) {
	msg := &Message{}
	err := s.db.Get(msg, `
		SELECT m.*, u.username, u.avatar_url
		FROM messages m
		JOIN users u ON u.id = m.sender_id
		WHERE m.id = $1 AND NOT m.is_deleted
	`, id)
	if err != nil {
		return nil, err
	}

	if msg.ReplyToID != nil {
		replyTo := &Message{}
		err = s.db.Get(replyTo, `
			SELECT m.*, u.username, u.avatar_url
			FROM messages m
			JOIN users u ON u.id = m.sender_id
			WHERE m.id = $1
		`, msg.ReplyToID)
		if err == nil {
			msg.ReplyTo = replyTo
		}
	}

	return msg, nil
}

func (s *MessageService) GetConversationMessages(conversationID uuid.UUID, limit, offset int) ([]Message, error) {
	messages := []Message{}
	err := s.db.Select(&messages, `
		SELECT m.*, u.username, u.avatar_url
		FROM messages m
		JOIN users u ON u.id = m.sender_id
		WHERE m.conversation_id = $1 AND NOT m.is_deleted
		ORDER BY m.created_at DESC
		LIMIT $2 OFFSET $3
	`, conversationID, limit, offset)
	return messages, err
}

func (s *MessageService) GetGroupMessages(groupID uuid.UUID, limit, offset int) ([]Message, error) {
	messages := []Message{}
	err := s.db.Select(&messages, `
		SELECT m.*, u.username, u.avatar_url
		FROM messages m
		JOIN users u ON u.id = m.sender_id
		WHERE m.group_id = $1 AND NOT m.is_deleted
		ORDER BY m.created_at DESC
		LIMIT $2 OFFSET $3
	`, groupID, limit, offset)
	return messages, err
}

func (s *MessageService) Update(msg *Message) error {
	_, err := s.db.Exec(`
		UPDATE messages
		SET content = $1, is_edited = true
		WHERE id = $2 AND sender_id = $3 AND NOT is_deleted
	`, msg.Content, msg.ID, msg.SenderID)
	return err
}

func (s *MessageService) Delete(id, userID uuid.UUID) error {
	_, err := s.db.Exec(`
		UPDATE messages
		SET is_deleted = true
		WHERE id = $1 AND sender_id = $2
	`, id, userID)
	return err
}

func (s *MessageService) UpdateMessageStatus(messageID, userID uuid.UUID, status string) error {
	_, err := s.db.Exec(`
		INSERT INTO message_status (message_id, user_id, status)
		VALUES ($1, $2, $3)
		ON CONFLICT (message_id, user_id) DO UPDATE
		SET status = EXCLUDED.status, updated_at = CURRENT_TIMESTAMP
	`, messageID, userID, status)
	return err
}
