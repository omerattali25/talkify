package handlers

import (
	"database/sql"
	"net/http"
	"strconv"

	"talkify/apps/api/internal/models"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// CreateMessageRequest represents the request body for creating a message
type CreateMessageRequest struct {
	ConversationID    uuid.UUID          `json:"conversation_id" example:"123e4567-e89b-12d3-a456-426614174000"`
	Content           string             `json:"content" binding:"required" example:"Hello, how are you?"`
	MessageType       models.MessageType `json:"message_type,omitempty" example:"text"`
	Type              models.MessageType `json:"type,omitempty" example:"text"`
	ReplyToID         *uuid.UUID         `json:"reply_to_id" example:"123e4567-e89b-12d3-a456-426614174000"`
	MediaURL          *string            `json:"media_url" example:"https://example.com/image.jpg"`
	MediaThumbnailURL *string            `json:"media_thumbnail_url" example:"https://example.com/thumbnail.jpg"`
	MediaSize         *int               `json:"media_size" example:"1024"`
	MediaDuration     *int               `json:"media_duration" example:"60"`
}

type UpdateMessageRequest struct {
	Content string `json:"content" binding:"required" example:"Updated message content"`
}

type BatchUpdateMessageStatusRequest struct {
	MessageIDs []uuid.UUID          `json:"message_ids" binding:"required"`
	Status     models.MessageStatus `json:"status" binding:"required,oneof=sending sent delivered read failed"`
}

func (h *Handler) RegisterMessageRoutes(r *gin.RouterGroup) {
	r.Use(h.AuthMiddleware())
	{
		r.POST("", h.CreateMessage)
		r.GET("/conversation/:id", h.GetConversationMessages)
		r.PUT("/:id", h.UpdateMessage)
		r.DELETE("/:id", h.DeleteMessage)
		r.POST("/:id/status", h.UpdateMessageStatus)
		r.POST("/status/batch", h.BatchUpdateMessageStatus)
		r.POST("/:id/reactions", h.AddMessageReaction)
		r.DELETE("/:id/reactions/:emoji", h.RemoveMessageReaction)
	}
}

// @Summary Create a new message
// @Description Create a new message in a conversation
// @Tags messages
// @Accept json
// @Produce json
// @Param message body CreateMessageRequest true "Message information"
// @Success 201 {object} models.Message
// @Failure 400 {object} ErrorResponse
// @Failure 500 {object} ErrorResponse
// @Security ApiKeyAuth
// @Router /messages [post]
func (h *Handler) CreateMessage(c *gin.Context) {
	var req CreateMessageRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		h.respondWithError(c, http.StatusBadRequest, err.Error())
		return
	}

	// Use MessageType if provided, otherwise use Type
	messageType := req.MessageType
	if messageType == "" {
		messageType = req.Type
	}

	if messageType == "" {
		h.respondWithError(c, http.StatusBadRequest, "message_type or type is required")
		return
	}

	senderID, err := uuid.Parse(c.GetHeader("X-User-ID"))
	if err != nil {
		h.respondWithError(c, http.StatusBadRequest, "Invalid user ID")
		return
	}

	// Check if user is a participant in the conversation with a valid role
	var participantRole string
	err = h.db.Get(&participantRole, `
		SELECT role FROM conversation_participants
			WHERE conversation_id = $1 AND user_id = $2
	`, req.ConversationID, senderID)
	if err == sql.ErrNoRows {
		h.respondWithError(c, http.StatusForbidden, "Not a participant in this conversation")
		return
	}
	if err != nil {
		h.respondWithError(c, http.StatusInternalServerError, "Failed to check conversation access")
		return
	}

	// Verify the role is valid
	if participantRole == "" {
		h.respondWithError(c, http.StatusForbidden, "Invalid participant role")
		return
	}

	messageService := models.NewMessageService(h.db, h.encryptor)
	message := &models.Message{
		ConversationID:    req.ConversationID,
		SenderID:          senderID,
		ReplyToID:         req.ReplyToID,
		Content:           req.Content,
		MessageType:       string(messageType),
		MediaURL:          req.MediaURL,
		MediaThumbnailURL: req.MediaThumbnailURL,
		MediaSize:         req.MediaSize,
		MediaDuration:     req.MediaDuration,
	}

	if err := messageService.Create(message); err != nil {
		h.respondWithError(c, http.StatusInternalServerError, "Failed to create message")
		return
	}

	h.respondWithSuccess(c, http.StatusCreated, message)
}

// @Summary Get conversation messages
// @Description Get messages from a specific conversation with pagination
// @Tags messages
// @Accept json
// @Produce json
// @Param id path string true "Conversation ID"
// @Param limit query int false "Number of messages to return (default: 50)"
// @Param offset query int false "Number of messages to skip (default: 0)"
// @Success 200 {array} models.Message
// @Failure 400 {object} ErrorResponse
// @Failure 500 {object} ErrorResponse
// @Security ApiKeyAuth
// @Router /messages/conversation/{id} [get]
func (h *Handler) GetConversationMessages(c *gin.Context) {
	conversationID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		h.respondWithError(c, http.StatusBadRequest, "Invalid conversation ID")
		return
	}

	userID, err := uuid.Parse(c.GetHeader("X-User-ID"))
	if err != nil {
		h.respondWithError(c, http.StatusBadRequest, "Invalid user ID")
		return
	}

	// Check if user is a participant in the conversation
	var isParticipant bool
	err = h.db.Get(&isParticipant, `
		SELECT EXISTS(
			SELECT 1 FROM conversation_participants
			WHERE conversation_id = $1 AND user_id = $2
		)
	`, conversationID, userID)
	if err != nil {
		h.respondWithError(c, http.StatusInternalServerError, "Failed to check conversation access")
		return
	}
	if !isParticipant {
		h.respondWithError(c, http.StatusNotFound, "Conversation not found")
		return
	}

	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))

	// Validate pagination parameters
	if limit < 1 || limit > 100 {
		h.respondWithError(c, http.StatusBadRequest, "Invalid limit. Must be between 1 and 100")
		return
	}
	if offset < 0 {
		h.respondWithError(c, http.StatusBadRequest, "Invalid offset. Must be non-negative")
		return
	}

	messageService := models.NewMessageService(h.db, h.encryptor)
	messages, err := messageService.GetConversationMessages(conversationID, limit, offset)
	if err != nil {
		h.respondWithError(c, http.StatusInternalServerError, "Failed to get messages")
		return
	}

	h.respondWithSuccess(c, http.StatusOK, messages)
}

// @Summary Update message
// @Description Update the content of an existing message
// @Tags messages
// @Accept json
// @Produce json
// @Param id path string true "Message ID"
// @Param message body UpdateMessageRequest true "Updated message content"
// @Success 200 {object} models.Message
// @Failure 400 {object} ErrorResponse
// @Failure 500 {object} ErrorResponse
// @Security ApiKeyAuth
// @Router /messages/{id} [put]
func (h *Handler) UpdateMessage(c *gin.Context) {
	messageID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		h.respondWithError(c, http.StatusBadRequest, "Invalid message ID")
		return
	}

	var req UpdateMessageRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		h.respondWithError(c, http.StatusBadRequest, err.Error())
		return
	}

	userID, err := uuid.Parse(c.GetHeader("X-User-ID"))
	if err != nil {
		h.respondWithError(c, http.StatusBadRequest, "Invalid user ID")
		return
	}

	messageService := models.NewMessageService(h.db, h.encryptor)
	message := &models.Message{
		ID:       messageID,
		SenderID: userID,
		Content:  req.Content,
	}

	if err := messageService.Update(message); err != nil {
		h.respondWithError(c, http.StatusInternalServerError, "Failed to update message")
		return
	}

	h.respondWithSuccess(c, http.StatusOK, message)
}

// @Summary Delete message
// @Description Soft delete a message
// @Tags messages
// @Accept json
// @Produce json
// @Param id path string true "Message ID"
// @Success 200 {object} map[string]string
// @Failure 400 {object} ErrorResponse
// @Failure 500 {object} ErrorResponse
// @Security ApiKeyAuth
// @Router /messages/{id} [delete]
func (h *Handler) DeleteMessage(c *gin.Context) {
	messageID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		h.respondWithError(c, http.StatusBadRequest, "Invalid message ID")
		return
	}

	userID, err := uuid.Parse(c.GetHeader("X-User-ID"))
	if err != nil {
		h.respondWithError(c, http.StatusBadRequest, "Invalid user ID")
		return
	}

	messageService := models.NewMessageService(h.db, h.encryptor)
	if err := messageService.Delete(messageID, userID); err != nil {
		h.respondWithError(c, http.StatusInternalServerError, "Failed to delete message")
		return
	}

	h.respondWithSuccess(c, http.StatusOK, gin.H{"message": "Message deleted successfully"})
}

// @Summary Update message status
// @Description Update the delivery/read status of a message
// @Tags messages
// @Accept json
// @Produce json
// @Param id path string true "Message ID"
// @Param status query string true "Message status (sending, sent, delivered, read, failed)"
// @Success 200 {object} map[string]string
// @Failure 400 {object} ErrorResponse
// @Failure 500 {object} ErrorResponse
// @Security ApiKeyAuth
// @Router /messages/{id}/status [post]
func (h *Handler) UpdateMessageStatus(c *gin.Context) {
	messageID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		h.respondWithError(c, http.StatusBadRequest, "Invalid message ID")
		return
	}

	userID, err := uuid.Parse(c.GetHeader("X-User-ID"))
	if err != nil {
		h.respondWithError(c, http.StatusBadRequest, "Invalid user ID")
		return
	}

	status := models.MessageStatus(c.Query("status"))
	if status != models.StatusSending &&
		status != models.StatusSent &&
		status != models.StatusDelivered &&
		status != models.StatusRead &&
		status != models.StatusFailed {
		h.respondWithError(c, http.StatusBadRequest, "Invalid status. Must be 'sending', 'sent', 'delivered', 'read', or 'failed'")
		return
	}

	messageService := models.NewMessageService(h.db, h.encryptor)
	if err := messageService.UpdateMessageStatus(messageID, userID, status); err != nil {
		h.respondWithError(c, http.StatusInternalServerError, "Failed to update message status")
		return
	}

	h.respondWithSuccess(c, http.StatusOK, gin.H{"message": "Message status updated successfully"})
}

// @Summary Batch update message status
// @Description Update the status of multiple messages at once
// @Tags messages
// @Accept json
// @Produce json
// @Param request body BatchUpdateMessageStatusRequest true "Message IDs and status"
// @Success 200 {object} map[string]string
// @Failure 400 {object} ErrorResponse
// @Failure 500 {object} ErrorResponse
// @Security ApiKeyAuth
// @Router /messages/status/batch [post]
func (h *Handler) BatchUpdateMessageStatus(c *gin.Context) {
	var req BatchUpdateMessageStatusRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		h.respondWithError(c, http.StatusBadRequest, err.Error())
		return
	}

	userID, err := uuid.Parse(c.GetHeader("X-User-ID"))
	if err != nil {
		h.respondWithError(c, http.StatusBadRequest, "Invalid user ID")
		return
	}

	messageService := models.NewMessageService(h.db, h.encryptor)
	if err := messageService.BatchUpdateMessageStatus(req.MessageIDs, userID, req.Status); err != nil {
		h.respondWithError(c, http.StatusInternalServerError, "Failed to update message status")
		return
	}

	h.respondWithSuccess(c, http.StatusOK, gin.H{"message": "Message status updated successfully"})
}

// @Summary Add reaction to message
// @Description Add an emoji reaction to a message
// @Tags messages
// @Accept json
// @Produce json
// @Param id path string true "Message ID"
// @Param reaction body AddReactionRequest true "Reaction information"
// @Success 201 {object} MessageReaction
// @Failure 400 {object} ErrorResponse
// @Failure 500 {object} ErrorResponse
// @Security ApiKeyAuth
// @Router /messages/{id}/reactions [post]
func (h *Handler) AddMessageReaction(c *gin.Context) {
	messageID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		h.respondWithError(c, http.StatusBadRequest, "Invalid message ID")
		return
	}

	var req struct {
		Emoji string `json:"emoji" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		h.respondWithError(c, http.StatusBadRequest, err.Error())
		return
	}

	userID, err := uuid.Parse(c.GetHeader("X-User-ID"))
	if err != nil {
		h.respondWithError(c, http.StatusBadRequest, "Invalid user ID")
		return
	}

	messageService := models.NewMessageService(h.db, h.encryptor)
	err = messageService.AddReaction(messageID, userID, req.Emoji)
	if err != nil {
		h.respondWithError(c, http.StatusInternalServerError, "Failed to add reaction")
		return
	}

	h.respondWithSuccess(c, http.StatusCreated, gin.H{"message": "Reaction added successfully"})
}

// @Summary Remove reaction from message
// @Description Remove an emoji reaction from a message
// @Tags messages
// @Accept json
// @Produce json
// @Param id path string true "Message ID"
// @Param emoji path string true "Emoji to remove"
// @Success 200 {object} map[string]string
// @Failure 400 {object} ErrorResponse
// @Failure 500 {object} ErrorResponse
// @Security ApiKeyAuth
// @Router /messages/{id}/reactions/{emoji} [delete]
func (h *Handler) RemoveMessageReaction(c *gin.Context) {
	messageID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		h.respondWithError(c, http.StatusBadRequest, "Invalid message ID")
		return
	}

	emoji := c.Param("emoji")
	if emoji == "" {
		h.respondWithError(c, http.StatusBadRequest, "Emoji parameter is required")
		return
	}

	userID, err := uuid.Parse(c.GetHeader("X-User-ID"))
	if err != nil {
		h.respondWithError(c, http.StatusBadRequest, "Invalid user ID")
		return
	}

	messageService := models.NewMessageService(h.db, h.encryptor)
	err = messageService.RemoveReaction(messageID, userID, emoji)
	if err != nil {
		h.respondWithError(c, http.StatusInternalServerError, "Failed to remove reaction")
		return
	}

	h.respondWithSuccess(c, http.StatusOK, gin.H{"message": "Reaction removed successfully"})
}
