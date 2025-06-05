package handlers

import (
	"net/http"

	"talkify/apps/api/internal/models"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type CreateConversationRequest struct {
	UserID uuid.UUID `json:"user_id" binding:"required" example:"123e4567-e89b-12d3-a456-426614174000"`
}

func (h *Handler) RegisterConversationRoutes(r *gin.RouterGroup) {
	conversations := r.Group("/conversations")
	conversations.Use(h.AuthMiddleware())
	{
		conversations.POST("", h.CreateConversation)
		conversations.GET("/:id", h.GetConversation)
		conversations.GET("", h.GetUserConversations)
		conversations.POST("/:id/read", h.MarkConversationRead)
	}
}

// @Summary Create a new conversation
// @Description Start a new conversation with another user
// @Tags conversations
// @Accept json
// @Produce json
// @Param conversation body CreateConversationRequest true "Conversation information"
// @Success 201 {object} models.Conversation
// @Failure 400 {object} ErrorResponse
// @Failure 500 {object} ErrorResponse
// @Security ApiKeyAuth
// @Router /conversations [post]
func (h *Handler) CreateConversation(c *gin.Context) {
	var req CreateConversationRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		h.respondWithError(c, http.StatusBadRequest, err.Error())
		return
	}

	currentUserID, err := uuid.Parse(c.GetHeader("X-User-ID"))
	if err != nil {
		h.respondWithError(c, http.StatusBadRequest, "Invalid user ID")
		return
	}

	conversationService := models.NewConversationService(h.db)
	conversation, err := conversationService.Create(currentUserID, req.UserID)
	if err != nil {
		h.respondWithError(c, http.StatusInternalServerError, "Failed to create conversation")
		return
	}

	// Get full conversation details including participants
	conversation, err = conversationService.GetByID(conversation.ID)
	if err != nil {
		h.respondWithError(c, http.StatusInternalServerError, "Failed to get conversation details")
		return
	}

	h.respondWithSuccess(c, http.StatusCreated, conversation)
}

// @Summary Get conversation by ID
// @Description Get conversation details including participants
// @Tags conversations
// @Accept json
// @Produce json
// @Param id path string true "Conversation ID"
// @Success 200 {object} models.Conversation
// @Failure 400 {object} ErrorResponse
// @Failure 404 {object} ErrorResponse
// @Security ApiKeyAuth
// @Router /conversations/{id} [get]
func (h *Handler) GetConversation(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		h.respondWithError(c, http.StatusBadRequest, "Invalid conversation ID")
		return
	}

	conversationService := models.NewConversationService(h.db)
	conversation, err := conversationService.GetByID(id)
	if err != nil {
		h.respondWithError(c, http.StatusNotFound, "Conversation not found")
		return
	}

	h.respondWithSuccess(c, http.StatusOK, conversation)
}

// @Summary Get user conversations
// @Description Get all conversations for the authenticated user
// @Tags conversations
// @Accept json
// @Produce json
// @Success 200 {array} models.Conversation
// @Failure 400 {object} ErrorResponse
// @Failure 500 {object} ErrorResponse
// @Security ApiKeyAuth
// @Router /conversations [get]
func (h *Handler) GetUserConversations(c *gin.Context) {
	userID, err := uuid.Parse(c.GetHeader("X-User-ID"))
	if err != nil {
		h.respondWithError(c, http.StatusBadRequest, "Invalid user ID")
		return
	}

	conversationService := models.NewConversationService(h.db)
	conversations, err := conversationService.GetUserConversations(userID)
	if err != nil {
		h.respondWithError(c, http.StatusInternalServerError, "Failed to get conversations")
		return
	}

	h.respondWithSuccess(c, http.StatusOK, conversations)
}

// @Summary Mark conversation as read
// @Description Mark all messages in a conversation as read for the authenticated user
// @Tags conversations
// @Accept json
// @Produce json
// @Param id path string true "Conversation ID"
// @Success 200 {object} map[string]string
// @Failure 400 {object} ErrorResponse
// @Failure 500 {object} ErrorResponse
// @Security ApiKeyAuth
// @Router /conversations/{id}/read [post]
func (h *Handler) MarkConversationRead(c *gin.Context) {
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

	conversationService := models.NewConversationService(h.db)
	if err := conversationService.UpdateLastRead(conversationID, userID); err != nil {
		h.respondWithError(c, http.StatusInternalServerError, "Failed to mark conversation as read")
		return
	}

	h.respondWithSuccess(c, http.StatusOK, gin.H{"message": "Conversation marked as read"})
}
