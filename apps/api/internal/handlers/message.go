package handlers

import (
	"net/http"
	"strconv"

	"talkify/apps/api/internal/models"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type CreateMessageRequest struct {
	ConversationID    *uuid.UUID         `json:"conversation_id" example:"123e4567-e89b-12d3-a456-426614174000"`
	GroupID           *uuid.UUID         `json:"group_id" example:"123e4567-e89b-12d3-a456-426614174000"`
	Content           string             `json:"content" binding:"required" example:"Hello, how are you?"`
	MessageType       models.MessageType `json:"message_type" binding:"required" example:"text"`
	ReplyToID         *uuid.UUID         `json:"reply_to_id" example:"123e4567-e89b-12d3-a456-426614174000"`
	MediaURL          *string            `json:"media_url" example:"https://example.com/image.jpg"`
	MediaThumbnailURL *string            `json:"media_thumbnail_url" example:"https://example.com/thumbnail.jpg"`
	MediaSize         *int               `json:"media_size" example:"1024"`
	MediaDuration     *int               `json:"media_duration" example:"60"`
}

type UpdateMessageRequest struct {
	Content string `json:"content" binding:"required" example:"Updated message content"`
}

func (h *Handler) RegisterMessageRoutes(r *gin.RouterGroup) {
	messages := r.Group("/messages")
	messages.Use(h.AuthMiddleware())
	{
		messages.POST("", h.CreateMessage)
		messages.GET("/conversation/:id", h.GetConversationMessages)
		messages.GET("/group/:id", h.GetGroupMessages)
		messages.PUT("/:id", h.UpdateMessage)
		messages.DELETE("/:id", h.DeleteMessage)
		messages.POST("/:id/status", h.UpdateMessageStatus)
	}
}

// @Summary Create a new message
// @Description Send a new message in a conversation or group
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

	if req.ConversationID == nil && req.GroupID == nil {
		h.respondWithError(c, http.StatusBadRequest, "Either conversation_id or group_id must be provided")
		return
	}

	if req.ConversationID != nil && req.GroupID != nil {
		h.respondWithError(c, http.StatusBadRequest, "Cannot specify both conversation_id and group_id")
		return
	}

	senderID, err := uuid.Parse(c.GetHeader("X-User-ID"))
	if err != nil {
		h.respondWithError(c, http.StatusBadRequest, "Invalid user ID")
		return
	}

	messageService := models.NewMessageService(h.db, h.encryptor)
	message := &models.Message{
		ConversationID:    req.ConversationID,
		GroupID:           req.GroupID,
		SenderID:          senderID,
		ReplyToID:         req.ReplyToID,
		Content:           req.Content,
		MessageType:       req.MessageType,
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

	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))

	messageService := models.NewMessageService(h.db, h.encryptor)
	messages, err := messageService.GetConversationMessages(conversationID, limit, offset)
	if err != nil {
		h.respondWithError(c, http.StatusInternalServerError, "Failed to get messages")
		return
	}

	h.respondWithSuccess(c, http.StatusOK, messages)
}

// @Summary Get group messages
// @Description Get messages from a specific group with pagination
// @Tags messages
// @Accept json
// @Produce json
// @Param id path string true "Group ID"
// @Param limit query int false "Number of messages to return (default: 50)"
// @Param offset query int false "Number of messages to skip (default: 0)"
// @Success 200 {array} models.Message
// @Failure 400 {object} ErrorResponse
// @Failure 500 {object} ErrorResponse
// @Security ApiKeyAuth
// @Router /messages/group/{id} [get]
func (h *Handler) GetGroupMessages(c *gin.Context) {
	groupID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		h.respondWithError(c, http.StatusBadRequest, "Invalid group ID")
		return
	}

	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))

	messageService := models.NewMessageService(h.db, h.encryptor)
	messages, err := messageService.GetGroupMessages(groupID, limit, offset)
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
		Base:     models.Base{ID: messageID},
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
// @Param status query string false "Message status (delivered or read, default: read)"
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

	status := c.DefaultQuery("status", "read")
	if status != "delivered" && status != "read" {
		h.respondWithError(c, http.StatusBadRequest, "Invalid status. Must be 'delivered' or 'read'")
		return
	}

	messageService := models.NewMessageService(h.db, h.encryptor)
	if err := messageService.UpdateMessageStatus(messageID, userID, status); err != nil {
		h.respondWithError(c, http.StatusInternalServerError, "Failed to update message status")
		return
	}

	h.respondWithSuccess(c, http.StatusOK, gin.H{"message": "Message status updated successfully"})
}
