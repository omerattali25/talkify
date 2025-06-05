package models

import (
	"talkify/apps/api/internal/encryption"
	"time"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

// MessageType represents the type of message
type MessageType string

const (
	TextMessage     MessageType = "text"
	ImageMessage    MessageType = "image"
	VideoMessage    MessageType = "video"
	AudioMessage    MessageType = "audio"
	FileMessage     MessageType = "file"
	LocationMessage MessageType = "location"
)

// MessageStatus represents the delivery status of a message
type MessageStatus string

const (
	StatusSending   MessageStatus = "sending"
	StatusSent      MessageStatus = "sent"
	StatusDelivered MessageStatus = "delivered"
	StatusRead      MessageStatus = "read"
	StatusFailed    MessageStatus = "failed"
)

// Message represents a chat message
type Message struct {
	Base
	ConversationID    uuid.UUID     `db:"conversation_id" json:"conversation_id"`
	SenderID          uuid.UUID     `db:"sender_id" json:"sender_id"`
	ReplyToID         *uuid.UUID    `db:"reply_to_id" json:"reply_to_id,omitempty"`
	Content           string        `db:"content" json:"content"`
	MessageType       MessageType   `db:"message_type" json:"message_type"`
	MediaURL          *string       `db:"media_url" json:"media_url,omitempty"`
	MediaThumbnailURL *string       `db:"media_thumbnail_url" json:"media_thumbnail_url,omitempty"`
	MediaSize         *int          `db:"media_size" json:"media_size,omitempty"`
	MediaDuration     *int          `db:"media_duration" json:"media_duration,omitempty"`
	IsEdited          bool          `db:"is_edited" json:"is_edited"`
	IsDeleted         bool          `db:"is_deleted" json:"is_deleted"`
	SenderUsername    string        `db:"sender_username" json:"sender_username"`
	ReplyTo           *Message      `db:"-" json:"reply_to,omitempty"`
	Status            MessageStatus `db:"-" json:"status"`
	ReadBy            []uuid.UUID   `db:"-" json:"read_by,omitempty"`
}

// MessageService handles message-related database operations
type MessageService struct {
	db        *sqlx.DB
	encryptor *encryption.Manager
}

// NewMessageService creates a new message service
func NewMessageService(db *sqlx.DB, encryptor *encryption.Manager) *MessageService {
	return &MessageService{
		db:        db,
		encryptor: encryptor,
	}
}

// Create creates a new message
func (s *MessageService) Create(message *Message) error {
	// Start transaction
	tx, err := s.db.Beginx()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	// Encrypt message content if encryption is enabled
	if s.encryptor != nil {
		encryptedContent, err := s.encryptor.EncryptString(message.Content)
		if err != nil {
			return err
		}
		message.Content = encryptedContent
	}

	// Insert message
	query := `
		INSERT INTO messages (
			conversation_id, sender_id, reply_to_id,
			content, message_type, media_url, media_thumbnail_url,
			media_size, media_duration, is_edited, is_deleted
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
		RETURNING id, created_at, updated_at`

	err = tx.QueryRowx(
		query,
		message.ConversationID,
		message.SenderID,
		message.ReplyToID,
		message.Content,
		message.MessageType,
		message.MediaURL,
		message.MediaThumbnailURL,
		message.MediaSize,
		message.MediaDuration,
		message.IsEdited,
		message.IsDeleted,
	).StructScan(message)

	if err != nil {
		return err
	}

	// Set initial message status as sent
	_, err = tx.Exec(`
		INSERT INTO message_status (message_id, user_id, status)
		VALUES ($1, $2, $3)
	`, message.ID, message.SenderID, StatusSent)

	if err != nil {
		return err
	}

	return tx.Commit()
}

// GetByID retrieves a message by ID with its status
func (s *MessageService) GetByID(id uuid.UUID) (*Message, error) {
	message := &Message{}
	err := s.db.Get(message, `
		SELECT m.*, u.username as sender_username
		FROM messages m
		JOIN users u ON u.id = m.sender_id
		WHERE m.id = $1 AND NOT m.is_deleted
	`, id)

	if err != nil {
		return nil, err
	}

	// Get message status
	var status string
	err = s.db.Get(&status, `
		SELECT status FROM message_status 
		WHERE message_id = $1 
		ORDER BY updated_at DESC 
		LIMIT 1
	`, id)
	if err == nil {
		message.Status = MessageStatus(status)
	}

	// Get read by users
	err = s.db.Select(&message.ReadBy, `
		SELECT user_id FROM message_status 
		WHERE message_id = $1 AND status = 'read'
	`, id)
	if err != nil {
		return nil, err
	}

	// Decrypt message content if encryption is enabled
	if s.encryptor != nil {
		content, err := s.encryptor.DecryptString(message.Content)
		if err != nil {
			return nil, err
		}
		message.Content = content
	}

	if message.ReplyToID != nil {
		replyTo := &Message{}
		err = s.db.Get(replyTo, `
			SELECT m.*, u.username as sender_username
			FROM messages m
			JOIN users u ON u.id = m.sender_id
			WHERE m.id = $1
		`, message.ReplyToID)
		if err == nil {
			message.ReplyTo = replyTo
		}
	}

	return message, nil
}

// GetConversationMessages retrieves messages for a specific conversation with their status
func (s *MessageService) GetConversationMessages(conversationID uuid.UUID, limit, offset int) ([]Message, error) {
	messages := []Message{}
	err := s.db.Select(&messages, `
		SELECT m.*, u.username as sender_username
		FROM messages m
		JOIN users u ON u.id = m.sender_id
		WHERE m.conversation_id = $1 AND NOT m.is_deleted
		ORDER BY m.created_at DESC
		LIMIT $2 OFFSET $3
	`, conversationID, limit, offset)

	if err != nil {
		return nil, err
	}

	// Get status and read_by for each message
	for i := range messages {
		// Get latest status
		var status string
		err = s.db.Get(&status, `
			SELECT status FROM message_status 
			WHERE message_id = $1 
			ORDER BY updated_at DESC 
			LIMIT 1
		`, messages[i].ID)
		if err == nil {
			messages[i].Status = MessageStatus(status)
		}

		// Get read by users
		err = s.db.Select(&messages[i].ReadBy, `
			SELECT user_id FROM message_status 
			WHERE message_id = $1 AND status = 'read'
		`, messages[i].ID)
		if err != nil {
			return nil, err
		}

		// Decrypt message content if encryption is enabled
		if s.encryptor != nil {
			content, err := s.encryptor.DecryptString(messages[i].Content)
			if err != nil {
				return nil, err
			}
			messages[i].Content = content
		}
	}

	return messages, nil
}

// GetGroupMessages retrieves messages for a specific group
func (s *MessageService) GetGroupMessages(groupID uuid.UUID, limit, offset int) ([]Message, error) {
	messages := []Message{}
	err := s.db.Select(&messages, `
		SELECT m.*, u.username as sender_username
		FROM messages m
		JOIN users u ON u.id = m.sender_id
		WHERE m.group_id = $1 AND NOT m.is_deleted
		ORDER BY m.created_at DESC
		LIMIT $2 OFFSET $3
	`, groupID, limit, offset)

	if err != nil {
		return nil, err
	}

	// Decrypt messages if encryption is enabled
	if s.encryptor != nil {
		for i := range messages {
			content, err := s.encryptor.DecryptString(messages[i].Content)
			if err != nil {
				return nil, err
			}
			messages[i].Content = content
		}
	}

	return messages, nil
}

// Update updates a message
func (s *MessageService) Update(message *Message) error {
	// Encrypt message content if encryption is enabled
	if s.encryptor != nil {
		encryptedContent, err := s.encryptor.EncryptString(message.Content)
		if err != nil {
			return err
		}
		message.Content = encryptedContent
	}

	result, err := s.db.Exec(`
		UPDATE messages
		SET content = $1, is_edited = true, updated_at = $2
		WHERE id = $3 AND sender_id = $4 AND NOT is_deleted
	`, message.Content, time.Now(), message.ID, message.SenderID)

	if err != nil {
		return err
	}

	rows, err := result.RowsAffected()
	if err != nil {
		return err
	}

	if rows == 0 {
		return ErrNotFound
	}

	return nil
}

// Delete soft deletes a message
func (s *MessageService) Delete(messageID, userID uuid.UUID) error {
	result, err := s.db.Exec(`
		UPDATE messages
		SET is_deleted = true, updated_at = $1
		WHERE id = $2 AND sender_id = $3 AND NOT is_deleted
	`, time.Now(), messageID, userID)

	if err != nil {
		return err
	}

	rows, err := result.RowsAffected()
	if err != nil {
		return err
	}

	if rows == 0 {
		return ErrNotFound
	}

	return nil
}

// UpdateMessageStatus updates the delivery/read status of a message
func (s *MessageService) UpdateMessageStatus(messageID, userID uuid.UUID, status MessageStatus) error {
	result, err := s.db.Exec(`
		INSERT INTO message_status (message_id, user_id, status)
		VALUES ($1, $2, $3)
		ON CONFLICT (message_id, user_id) DO UPDATE
		SET status = EXCLUDED.status, updated_at = CURRENT_TIMESTAMP
	`, messageID, userID, status)

	if err != nil {
		return err
	}

	rows, err := result.RowsAffected()
	if err != nil {
		return err
	}

	if rows == 0 {
		return ErrNotFound
	}

	return nil
}

// BatchUpdateMessageStatus updates the status of multiple messages at once
func (s *MessageService) BatchUpdateMessageStatus(messageIDs []uuid.UUID, userID uuid.UUID, status MessageStatus) error {
	query, args, err := sqlx.In(`
		INSERT INTO message_status (message_id, user_id, status)
		VALUES (:message_id, :user_id, :status)
		ON CONFLICT (message_id, user_id) DO UPDATE
		SET status = EXCLUDED.status, updated_at = CURRENT_TIMESTAMP
	`, messageIDs)

	if err != nil {
		return err
	}

	query = s.db.Rebind(query)
	_, err = s.db.Exec(query, args...)
	return err
}
