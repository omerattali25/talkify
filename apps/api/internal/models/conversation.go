package models

import (
	"database/sql"
	"errors"
	"fmt"
	"time"

	"talkify/apps/api/internal/encryption"
	"talkify/apps/api/internal/logger"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

var (
	ErrConversationNotFound = errors.New("conversation not found")
	ErrUserNotFound         = errors.New("user not found")
	ErrInvalidParticipant   = errors.New("invalid participant")
	ErrDuplicateParticipant = errors.New("users already have a conversation")
)

type Conversation struct {
	Base
	CreatedBy    uuid.UUID                 `db:"created_by" json:"created_by"`
	Type         string                    `db:"type" json:"type"`
	Name         *string                   `db:"name" json:"name,omitempty"`
	Participants []ConversationParticipant `db:"-" json:"participants"`
	LastMessage  *Message                  `db:"-" json:"last_message,omitempty"`
	UnreadCount  int                       `db:"-" json:"unread_count"`
}

type ConversationParticipant struct {
	ConversationID uuid.UUID `db:"conversation_id" json:"conversation_id"`
	UserID         uuid.UUID `db:"user_id" json:"user_id"`
	JoinedAt       time.Time `db:"joined_at" json:"joined_at"`
	LastReadAt     time.Time `db:"last_read_at" json:"last_read_at"`
	Role           string    `db:"role" json:"role"`
	User           *User     `db:"-" json:"user,omitempty"`
	// Embedded user fields from the query
	UserUsername  string     `db:"user_username" json:"-"`
	UserEmail     string     `db:"user_email" json:"-"`
	UserPhone     string     `db:"user_phone" json:"-"`
	UserStatus    string     `db:"user_status" json:"-"`
	UserLastSeen  *time.Time `db:"user_last_seen" json:"-"`
	UserIsOnline  bool       `db:"user_is_online" json:"-"`
	UserIsActive  bool       `db:"user_is_active" json:"-"`
	UserCreatedAt time.Time  `db:"user_created_at" json:"-"`
	UserUpdatedAt time.Time  `db:"user_updated_at" json:"-"`
}

type CreateConversationInput struct {
	UserIDs []uuid.UUID `json:"user_ids" binding:"required,min=1"`
	Name    *string     `json:"name,omitempty"`
}

type ConversationService struct {
	db        *sqlx.DB
	encryptor *encryption.Manager
}

func NewConversationService(db *sqlx.DB, encryptor *encryption.Manager) *ConversationService {
	return &ConversationService{
		db:        db,
		encryptor: encryptor,
	}
}

func (s *ConversationService) Create(creatorID uuid.UUID, input *CreateConversationInput) (*Conversation, error) {
	// Check if users exist
	userIDsWithCreator := append(input.UserIDs, creatorID)
	query, args, err := sqlx.In("SELECT COUNT(*) FROM users WHERE id IN (?)", userIDsWithCreator)
	if err != nil {
		return nil, fmt.Errorf("failed to create query: %w", err)
	}
	query = s.db.Rebind(query)

	var count int
	err = s.db.Get(&count, query, args...)
	if err != nil {
		return nil, fmt.Errorf("failed to check users: %w", err)
	}
	if count != len(userIDsWithCreator) {
		return nil, ErrUserNotFound
	}

	// For direct conversations, check if conversation already exists
	if len(input.UserIDs) == 1 {
		var existingCount int
		err = s.db.Get(&existingCount, `
			SELECT COUNT(*)
			FROM conversations c
			JOIN conversation_participants cp1 ON cp1.conversation_id = c.id AND cp1.user_id = $1
			JOIN conversation_participants cp2 ON cp2.conversation_id = c.id AND cp2.user_id = $2
			WHERE c.type = 'direct'
		`, creatorID, input.UserIDs[0])
		if err != nil {
			return nil, fmt.Errorf("failed to check existing conversation: %w", err)
		}
		if existingCount > 0 {
			return nil, ErrDuplicateParticipant
		}
	}

	tx, err := s.db.Beginx()
	if err != nil {
		return nil, fmt.Errorf("failed to start transaction: %w", err)
	}
	defer tx.Rollback()

	// Determine conversation type and name
	conversationType := "group"
	var conversationName *string
	if len(input.UserIDs) == 1 {
		conversationType = "direct"
		// For direct conversations, name is not used (UI shows other participant's name)
		conversationName = nil
	} else {
		// For group conversations, use provided name or generate one
		if input.Name != nil && *input.Name != "" {
			conversationName = input.Name
		} else {
			// Get usernames for default group name
			var usernames []string
			query, args, err = sqlx.In("SELECT username FROM users WHERE id IN (?) LIMIT 3", userIDsWithCreator)
			if err != nil {
				return nil, fmt.Errorf("failed to create username query: %w", err)
			}
			query = s.db.Rebind(query)
			err = s.db.Select(&usernames, query, args...)
			if err != nil {
				return nil, fmt.Errorf("failed to get usernames: %w", err)
			}
			defaultName := ""
			if len(usernames) > 2 {
				defaultName = fmt.Sprintf("%s, %s & %d others", usernames[0], usernames[1], len(userIDsWithCreator)-2)
			} else {
				defaultName = fmt.Sprintf("%s, %s", usernames[0], usernames[1])
			}
			conversationName = &defaultName
		}
	}

	// Log conversation creation details
	logger.Debug("Creating conversation", map[string]interface{}{
		"creator_id":        creatorID,
		"type":              conversationType,
		"name":              conversationName,
		"participant_count": len(userIDsWithCreator),
	})

	conv := &Conversation{}
	err = tx.QueryRowx(`
		INSERT INTO conversations (created_by, type, name)
		VALUES ($1, $2, $3)
		RETURNING id, created_at, updated_at, created_by, type, name
	`, creatorID, conversationType, conversationName).StructScan(conv)
	if err != nil {
		return nil, fmt.Errorf("failed to create conversation: %w", err)
	}

	// Add all participants including the creator
	for _, userID := range userIDsWithCreator {
		role := "member"
		if userID == creatorID {
			if conversationType == "group" {
				role = "owner"
			}
		}

		// Log participant role assignment
		logger.Debug("Adding participant", map[string]interface{}{
			"conversation_id": conv.ID,
			"user_id":         userID,
			"role":            role,
			"is_creator":      userID == creatorID,
		})

		// Explicitly set the role in the INSERT statement
		result, err := tx.Exec(`
			INSERT INTO conversation_participants (conversation_id, user_id, role)
			VALUES ($1, $2, $3)
		`, conv.ID, userID, role)
		if err != nil {
			return nil, fmt.Errorf("failed to add participant: %w", err)
		}

		// Verify the insert was successful
		rows, err := result.RowsAffected()
		if err != nil {
			return nil, fmt.Errorf("failed to get rows affected: %w", err)
		}
		if rows != 1 {
			return nil, fmt.Errorf("failed to add participant, expected 1 row affected, got %d", rows)
		}

		// Verify the role was set correctly
		var assignedRole string
		err = tx.Get(&assignedRole, `
			SELECT role FROM conversation_participants 
			WHERE conversation_id = $1 AND user_id = $2
		`, conv.ID, userID)
		if err != nil {
			return nil, fmt.Errorf("failed to verify participant role: %w", err)
		}
		if assignedRole != role {
			return nil, fmt.Errorf("role mismatch, expected %s but got %s", role, assignedRole)
		}
	}

	if err = tx.Commit(); err != nil {
		return nil, fmt.Errorf("failed to commit transaction: %w", err)
	}

	// Get participants with full details
	var participants []ConversationParticipant
	err = s.db.Select(&participants, `
		SELECT 
			cp.conversation_id,
			cp.user_id,
			cp.joined_at,
			cp.last_read_at,
			cp.role,
			u.id as user_id,
			u.username as user_username,
			u.email as user_email,
			u.phone as user_phone,
			u.status as user_status,
			u.last_seen as user_last_seen,
			u.is_online as user_is_online,
			u.is_active as user_is_active,
			u.created_at as user_created_at,
			u.updated_at as user_updated_at
		FROM conversation_participants cp
		JOIN users u ON u.id = cp.user_id AND u.is_active = true
		WHERE cp.conversation_id = $1
	`, conv.ID)
	if err != nil {
		return nil, fmt.Errorf("failed to get participants: %w", err)
	}

	// Log final participant roles
	for _, p := range participants {
		logger.Debug("Final participant role", map[string]interface{}{
			"conversation_id": conv.ID,
			"user_id":         p.UserID,
			"role":            p.Role,
			"is_creator":      p.UserID == creatorID,
		})
	}

	// Create User objects from the query results
	for i := range participants {
		participants[i].User = &User{
			ID:        participants[i].UserID,
			CreatedAt: participants[i].UserCreatedAt,
			UpdatedAt: participants[i].UserUpdatedAt,
			Username:  participants[i].UserUsername,
			Email:     participants[i].UserEmail,
			Phone:     participants[i].UserPhone,
			Status:    participants[i].UserStatus,
			LastSeen:  participants[i].UserLastSeen,
			IsOnline:  participants[i].UserIsOnline,
			IsActive:  participants[i].UserIsActive,
		}
	}
	conv.Participants = participants

	return conv, nil
}

func (s *ConversationService) GetByID(id uuid.UUID) (*Conversation, error) {
	conv := &Conversation{}
	err := s.db.Get(conv, `
		SELECT c.*
		FROM conversations c
		WHERE c.id = $1
		LIMIT 1
	`, id)
	if err == sql.ErrNoRows {
		return nil, ErrConversationNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("failed to get conversation: %w", err)
	}

	// Get participants with roles
	var participants []ConversationParticipant
	err = s.db.Select(&participants, `
		SELECT 
			cp.conversation_id,
			cp.user_id,
			cp.joined_at,
			cp.last_read_at,
			cp.role,
			u.id as user_id,
			u.username as user_username,
			u.email as user_email,
			u.phone as user_phone,
			u.status as user_status,
			u.last_seen as user_last_seen,
			u.is_online as user_is_online,
			u.is_active as user_is_active,
			u.created_at as user_created_at,
			u.updated_at as user_updated_at
		FROM conversation_participants cp
		JOIN users u ON u.id = cp.user_id AND u.is_active = true
		WHERE cp.conversation_id = $1
	`, id)
	if err != nil {
		return nil, fmt.Errorf("failed to get participants: %w", err)
	}

	// Ensure we have valid participants
	if len(participants) == 0 {
		return nil, ErrInvalidParticipant
	}

	// Create User objects from the query results
	for i := range participants {
		participants[i].User = &User{
			ID:        participants[i].UserID,
			CreatedAt: participants[i].UserCreatedAt,
			UpdatedAt: participants[i].UserUpdatedAt,
			Username:  participants[i].UserUsername,
			Email:     participants[i].UserEmail,
			Phone:     participants[i].UserPhone,
			Status:    participants[i].UserStatus,
			LastSeen:  participants[i].UserLastSeen,
			IsOnline:  participants[i].UserIsOnline,
			IsActive:  participants[i].UserIsActive,
		}
	}
	conv.Participants = participants

	return conv, nil
}

func (s *ConversationService) GetUserConversations(userID uuid.UUID) ([]Conversation, error) {
	// Verify user exists
	var exists bool
	err := s.db.Get(&exists, "SELECT EXISTS(SELECT 1 FROM users WHERE id = $1)", userID)
	if err != nil {
		logger.Error("Failed to check user existence", err, map[string]interface{}{
			"user_id": userID,
		})
		return nil, fmt.Errorf("failed to check user existence: %w", err)
	}
	if !exists {
		return nil, ErrUserNotFound
	}

	logger.Debug("Getting conversations", map[string]interface{}{
		"user_id": userID,
	})

	conversations := []Conversation{}
	err = s.db.Select(&conversations, `
		SELECT DISTINCT
			c.id,
			c.created_at,
			c.updated_at,
			c.created_by,
			c.type,
			c.name
		FROM conversations c
		INNER JOIN conversation_participants cp ON cp.conversation_id = c.id
		WHERE cp.user_id = $1
		ORDER BY c.updated_at DESC
	`, userID)

	// If there are no conversations or no rows, return empty array
	if err == sql.ErrNoRows || len(conversations) == 0 {
		logger.Debug("No conversations found", map[string]interface{}{
			"user_id": userID,
		})
		return []Conversation{}, nil
	}

	if err != nil {
		logger.Error("Failed to get conversations", err, map[string]interface{}{
			"user_id": userID,
		})
		return nil, fmt.Errorf("failed to get conversations: %w", err)
	}

	logger.Debug("Found conversations", map[string]interface{}{
		"user_id":            userID,
		"conversation_count": len(conversations),
	})

	// Get participants and last message for each conversation
	for i := range conversations {
		// Get participants with user data
		var participants []ConversationParticipant
		err = s.db.Select(&participants, `
			SELECT 
				cp.conversation_id,
				cp.user_id,
				cp.joined_at,
				cp.last_read_at,
				COALESCE(cp.role, 'member') as role,
				u.id as user_id,
				u.username as user_username,
				u.email as user_email,
				u.phone as user_phone,
				u.status as user_status,
				u.last_seen as user_last_seen,
				u.is_online as user_is_online,
				u.is_active as user_is_active,
				u.created_at as user_created_at,
				u.updated_at as user_updated_at
			FROM conversation_participants cp
			JOIN users u ON u.id = cp.user_id AND u.is_active = true
			WHERE cp.conversation_id = $1
		`, conversations[i].ID)
		if err != nil {
			logger.Error("Failed to get participants", err, map[string]interface{}{
				"user_id":         userID,
				"conversation_id": conversations[i].ID,
			})
			return nil, fmt.Errorf("failed to get participants for conversation %s: %w", conversations[i].ID, err)
		}

		// Create User objects from the query results
		for j := range participants {
			participants[j].User = &User{
				ID:        participants[j].UserID,
				CreatedAt: participants[j].UserCreatedAt,
				UpdatedAt: participants[j].UserUpdatedAt,
				Username:  participants[j].UserUsername,
				Email:     participants[j].UserEmail,
				Phone:     participants[j].UserPhone,
				Status:    participants[j].UserStatus,
				LastSeen:  participants[j].UserLastSeen,
				IsOnline:  participants[j].UserIsOnline,
				IsActive:  participants[j].UserIsActive,
			}
		}
		conversations[i].Participants = participants

		// Get last message
		var lastMessage Message
		err = s.db.Get(&lastMessage, `
			SELECT 
				m.*,
				u.username as sender_username,
				ARRAY_REMOVE(ARRAY_AGG(DISTINCT ms.user_id), NULL)::TEXT[] as read_by,
				COALESCE(
					json_agg(DISTINCT jsonb_build_object(
						'id', mr.id,
						'message_id', mr.message_id,
						'user_id', mr.user_id,
						'emoji', mr.emoji,
						'created_at', mr.created_at
					)) FILTER (WHERE mr.id IS NOT NULL),
					'[]'
				)::jsonb as reactions
			FROM messages m
			JOIN users u ON u.id = m.sender_id AND u.is_active = true
			LEFT JOIN message_status ms ON m.id = ms.message_id AND ms.status = 'read'
			LEFT JOIN message_reactions mr ON m.id = mr.message_id
			WHERE m.conversation_id = $1
			GROUP BY m.id, u.username
			ORDER BY m.created_at DESC
			LIMIT 1
		`, conversations[i].ID)
		if err != nil && err != sql.ErrNoRows {
			logger.Error("Failed to get last message", err, map[string]interface{}{
				"user_id":         userID,
				"conversation_id": conversations[i].ID,
			})
			return nil, fmt.Errorf("failed to get last message for conversation %s: %w", conversations[i].ID, err)
		}
		if err != sql.ErrNoRows {
			// Decrypt message content if encryption is enabled
			if s.encryptor != nil {
				content, err := s.encryptor.DecryptString(lastMessage.Content)
				if err != nil {
					logger.Error("Failed to decrypt message", err, map[string]interface{}{
						"user_id":         userID,
						"conversation_id": conversations[i].ID,
						"message_id":      lastMessage.ID,
					})
					return nil, fmt.Errorf("failed to decrypt message: %w", err)
				}
				lastMessage.Content = content
			}
			conversations[i].LastMessage = &lastMessage
		}

		// Get unread count
		var unreadCount int
		err = s.db.Get(&unreadCount, `
			SELECT COUNT(*)
			FROM messages m
			LEFT JOIN message_status ms ON ms.message_id = m.id AND ms.user_id = $1
			WHERE m.conversation_id = $2
			  AND m.sender_id != $1
			  AND (ms.status IS NULL OR ms.status = 'delivered')
		`, userID, conversations[i].ID)
		if err != nil {
			logger.Error("Failed to get unread count", err, map[string]interface{}{
				"user_id":         userID,
				"conversation_id": conversations[i].ID,
			})
			return nil, fmt.Errorf("failed to get unread count for conversation %s: %w", conversations[i].ID, err)
		}
		conversations[i].UnreadCount = unreadCount
	}

	return conversations, nil
}

func (s *ConversationService) UpdateLastRead(conversationID, userID uuid.UUID) error {
	result, err := s.db.Exec(`
		UPDATE conversation_participants
		SET last_read_at = CURRENT_TIMESTAMP
		WHERE conversation_id = $1 AND user_id = $2
	`, conversationID, userID)
	if err != nil {
		return fmt.Errorf("failed to update last read: %w", err)
	}

	rows, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("failed to get rows affected: %w", err)
	}
	if rows == 0 {
		return ErrInvalidParticipant
	}

	return nil
}

// IsParticipant checks if a user is a participant in a conversation
func (s *ConversationService) IsParticipant(conversationID, userID uuid.UUID) (bool, error) {
	var isParticipant bool
	err := s.db.Get(&isParticipant, `
		SELECT EXISTS(
			SELECT 1 FROM conversation_participants
			WHERE conversation_id = $1 AND user_id = $2
		)
	`, conversationID, userID)
	if err != nil {
		return false, fmt.Errorf("failed to check participant: %w", err)
	}
	return isParticipant, nil
}

// AddParticipant adds a user to a conversation
func (s *ConversationService) AddParticipant(conversationID, userID, adderID uuid.UUID) error {
	// Check if conversation exists and is a group
	var convType string
	err := s.db.Get(&convType, `
		SELECT type FROM conversations WHERE id = $1
	`, conversationID)
	if err == sql.ErrNoRows {
		return ErrConversationNotFound
	}
	if err != nil {
		return fmt.Errorf("failed to get conversation: %w", err)
	}
	if convType != "group" {
		return errors.New("cannot add participants to direct conversations")
	}

	// Check if adder is a participant with appropriate role
	var adderRole string
	err = s.db.Get(&adderRole, `
		SELECT role FROM conversation_participants
		WHERE conversation_id = $1 AND user_id = $2
	`, conversationID, adderID)
	if err == sql.ErrNoRows {
		return ErrInvalidParticipant
	}
	if err != nil {
		return fmt.Errorf("failed to check adder role: %w", err)
	}
	if adderRole != "admin" && adderRole != "owner" {
		return errors.New("insufficient permissions to add participants")
	}

	// Check if user exists
	var exists bool
	err = s.db.Get(&exists, "SELECT EXISTS(SELECT 1 FROM users WHERE id = $1)", userID)
	if err != nil {
		return fmt.Errorf("failed to check user existence: %w", err)
	}
	if !exists {
		return ErrUserNotFound
	}

	// Check if user is already a participant
	err = s.db.Get(&exists, `
		SELECT EXISTS(
			SELECT 1 FROM conversation_participants
			WHERE conversation_id = $1 AND user_id = $2
		)
	`, conversationID, userID)
	if err != nil {
		return fmt.Errorf("failed to check participant existence: %w", err)
	}
	if exists {
		return ErrDuplicateParticipant
	}

	// Add participant
	_, err = s.db.Exec(`
		INSERT INTO conversation_participants (conversation_id, user_id, role)
		VALUES ($1, $2, 'member')
	`, conversationID, userID)
	if err != nil {
		return fmt.Errorf("failed to add participant: %w", err)
	}

	return nil
}

// RemoveParticipant removes a user from a conversation
func (s *ConversationService) RemoveParticipant(conversationID, userID, removerID uuid.UUID) error {
	// Check if conversation exists and is a group
	var convType string
	err := s.db.Get(&convType, `
		SELECT type FROM conversations WHERE id = $1
	`, conversationID)
	if err == sql.ErrNoRows {
		return ErrConversationNotFound
	}
	if err != nil {
		return fmt.Errorf("failed to get conversation: %w", err)
	}
	if convType != "group" {
		return errors.New("cannot remove participants from direct conversations")
	}

	// Check if remover is a participant with appropriate role
	var removerRole string
	err = s.db.Get(&removerRole, `
		SELECT role FROM conversation_participants
		WHERE conversation_id = $1 AND user_id = $2
	`, conversationID, removerID)
	if err == sql.ErrNoRows {
		return ErrInvalidParticipant
	}
	if err != nil {
		return fmt.Errorf("failed to check remover role: %w", err)
	}
	if removerRole != "admin" && removerRole != "owner" {
		return errors.New("insufficient permissions to remove participants")
	}

	// Check if user is a participant
	var userRole string
	err = s.db.Get(&userRole, `
		SELECT role FROM conversation_participants
		WHERE conversation_id = $1 AND user_id = $2
	`, conversationID, userID)
	if err == sql.ErrNoRows {
		return ErrInvalidParticipant
	}
	if err != nil {
		return fmt.Errorf("failed to check user role: %w", err)
	}

	// Cannot remove owner
	if userRole == "owner" {
		return errors.New("cannot remove conversation owner")
	}

	// Remove participant
	result, err := s.db.Exec(`
		DELETE FROM conversation_participants
		WHERE conversation_id = $1 AND user_id = $2
	`, conversationID, userID)
	if err != nil {
		return fmt.Errorf("failed to remove participant: %w", err)
	}

	rows, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("failed to get rows affected: %w", err)
	}
	if rows == 0 {
		return ErrInvalidParticipant
	}

	return nil
}

// UpdateParticipantRole updates a participant's role in a conversation
func (s *ConversationService) UpdateParticipantRole(conversationID, userID, updaterID uuid.UUID, newRole string) error {
	// Validate role
	if newRole != "member" && newRole != "admin" {
		return errors.New("invalid role")
	}

	// Check if conversation exists and is a group
	var convType string
	err := s.db.Get(&convType, `
		SELECT type FROM conversations WHERE id = $1
	`, conversationID)
	if err == sql.ErrNoRows {
		return ErrConversationNotFound
	}
	if err != nil {
		return fmt.Errorf("failed to get conversation: %w", err)
	}
	if convType != "group" {
		return errors.New("cannot update roles in direct conversations")
	}

	// Check if updater is a participant with appropriate role
	var updaterRole string
	err = s.db.Get(&updaterRole, `
		SELECT role FROM conversation_participants
		WHERE conversation_id = $1 AND user_id = $2
	`, conversationID, updaterID)
	if err == sql.ErrNoRows {
		return ErrInvalidParticipant
	}
	if err != nil {
		return fmt.Errorf("failed to check updater role: %w", err)
	}
	if updaterRole != "owner" {
		return errors.New("only owner can update roles")
	}

	// Check if user is a participant
	var userRole string
	err = s.db.Get(&userRole, `
		SELECT role FROM conversation_participants
		WHERE conversation_id = $1 AND user_id = $2
	`, conversationID, userID)
	if err == sql.ErrNoRows {
		return ErrInvalidParticipant
	}
	if err != nil {
		return fmt.Errorf("failed to check user role: %w", err)
	}

	// Cannot change owner's role
	if userRole == "owner" {
		return errors.New("cannot change owner's role")
	}

	// Update role
	result, err := s.db.Exec(`
		UPDATE conversation_participants
		SET role = $3
		WHERE conversation_id = $1 AND user_id = $2
	`, conversationID, userID, newRole)
	if err != nil {
		return fmt.Errorf("failed to update role: %w", err)
	}

	rows, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("failed to get rows affected: %w", err)
	}
	if rows == 0 {
		return ErrInvalidParticipant
	}

	return nil
}
