package handlers

import (
	"fmt"
	"net/http"

	"talkify/apps/api/internal/logger"
	"talkify/apps/api/internal/models"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/pkg/errors"
)

type CreateConversationRequest struct {
	UserIDs []uuid.UUID `json:"user_ids" binding:"required,min=1" example:"['123e4567-e89b-12d3-a456-426614174000']"`
	Name    *string     `json:"name,omitempty" example:"My Group Chat"`
}

type AddParticipantRequest struct {
	UserID uuid.UUID `json:"user_id" binding:"required" example:"123e4567-e89b-12d3-a456-426614174000"`
}

type UpdateParticipantRoleRequest struct {
	UserID uuid.UUID `json:"user_id" binding:"required" example:"123e4567-e89b-12d3-a456-426614174000"`
	Role   string    `json:"role" binding:"required" example:"admin"`
}

func (h *Handler) RegisterConversationRoutes(r *gin.RouterGroup) {
	r.Use(h.AuthMiddleware())
	{
		r.POST("", h.CreateConversation)
		r.GET("/:id", h.GetConversation)
		r.GET("", h.GetUserConversations)
		r.POST("/:id/read", h.MarkConversationRead)
		r.POST("/:id/participants", h.AddParticipant)
		r.DELETE("/:id/participants/:user_id", h.RemoveParticipant)
		r.PUT("/:id/participants/:user_id/role", h.UpdateParticipantRole)
	}
}

// @Summary Create a new conversation
// @Description Start a new conversation with one or more users. Creates a direct chat for one user, or a group chat for multiple users.
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

	// Validate that user is not trying to create a conversation with themselves
	for _, userID := range req.UserIDs {
		if userID == currentUserID {
			h.respondWithError(c, http.StatusBadRequest, "Cannot create a conversation with yourself")
			return
		}
	}

	input := &models.CreateConversationInput{
		UserIDs: req.UserIDs,
		Name:    req.Name,
	}

	conversationService := models.NewConversationService(h.db, h.encryptor)
	conversation, err := conversationService.Create(currentUserID, input)
	if err != nil {
		switch {
		case errors.Is(err, models.ErrUserNotFound):
			h.respondWithError(c, http.StatusNotFound, "One or more users not found")
		case errors.Is(err, models.ErrDuplicateParticipant):
			h.respondWithError(c, http.StatusConflict, "Direct conversation already exists with this user")
		default:
			h.respondWithError(c, http.StatusInternalServerError, "Failed to create conversation")
		}
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
	// Get current user ID from context
	userID, exists := c.Get("userID")
	if !exists {
		h.respondWithError(c, http.StatusUnauthorized, "User not found in context")
		return
	}
	currentUserID, ok := userID.(uuid.UUID)
	if !ok {
		h.respondWithError(c, http.StatusInternalServerError, "Invalid user ID type in context")
		return
	}

	// Parse conversation ID
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		h.respondWithError(c, http.StatusBadRequest, "Invalid conversation ID")
		return
	}

	// Create conversation service
	conversationService := models.NewConversationService(h.db, h.encryptor)

	// Get conversation
	conv, err := conversationService.GetByID(id)
	if err != nil {
		if errors.Is(err, models.ErrConversationNotFound) {
			h.respondWithError(c, http.StatusNotFound, "Conversation not found")
			return
		}
		if errors.Is(err, models.ErrInvalidParticipant) {
			h.respondWithError(c, http.StatusForbidden, "You don't have access to this conversation")
			return
		}
		h.respondWithError(c, http.StatusInternalServerError, "Failed to get conversation")
		return
	}

	// Check if current user is a participant
	isParticipant := false
	for _, p := range conv.Participants {
		if p.UserID == currentUserID && p.Role != "" {
			isParticipant = true
			break
		}
	}

	if !isParticipant {
		h.respondWithError(c, http.StatusForbidden, "You don't have access to this conversation")
		return
	}

	h.respondWithSuccess(c, http.StatusOK, conv)
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
		logger.Error("Failed to parse user ID", err, map[string]interface{}{
			"user_id": c.GetHeader("X-User-ID"),
		})
		h.respondWithError(c, http.StatusBadRequest, "Invalid user ID")
		return
	}

	logger.Debug("Getting conversations for user", map[string]interface{}{
		"user_id": userID,
	})

	conversationService := models.NewConversationService(h.db, h.encryptor)
	conversations, err := conversationService.GetUserConversations(userID)
	if err != nil {
		logger.Error("Failed to get user conversations", err, map[string]interface{}{
			"user_id": userID,
			"error":   err.Error(),
		})
		switch {
		case errors.Is(err, models.ErrUserNotFound):
			h.respondWithError(c, http.StatusNotFound, "User not found")
		default:
			h.respondWithError(c, http.StatusInternalServerError, fmt.Sprintf("Failed to get conversations: %v", err))
		}
		return
	}

	logger.Debug("Successfully retrieved conversations", map[string]interface{}{
		"user_id":            userID,
		"conversation_count": len(conversations),
	})

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

	conversationService := models.NewConversationService(h.db, h.encryptor)
	if err := conversationService.UpdateLastRead(conversationID, userID); err != nil {
		switch {
		case errors.Is(err, models.ErrInvalidParticipant):
			h.respondWithError(c, http.StatusForbidden, "User is not a participant in this conversation")
		default:
			h.respondWithError(c, http.StatusInternalServerError, "Failed to mark conversation as read")
		}
		return
	}

	h.respondWithSuccess(c, http.StatusOK, gin.H{"message": "Conversation marked as read"})
}

// @Summary Add participant to conversation
// @Description Add a new participant to a group conversation
// @Tags conversations
// @Accept json
// @Produce json
// @Param id path string true "Conversation ID"
// @Param participant body AddParticipantRequest true "Participant information"
// @Success 200 {object} map[string]string
// @Failure 400 {object} ErrorResponse
// @Failure 403 {object} ErrorResponse
// @Failure 404 {object} ErrorResponse
// @Security ApiKeyAuth
// @Router /conversations/{id}/participants [post]
func (h *Handler) AddParticipant(c *gin.Context) {
	conversationID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		h.respondWithError(c, http.StatusBadRequest, "Invalid conversation ID")
		return
	}

	var req AddParticipantRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		h.respondWithError(c, http.StatusBadRequest, err.Error())
		return
	}

	adderID, err := uuid.Parse(c.GetHeader("X-User-ID"))
	if err != nil {
		h.respondWithError(c, http.StatusBadRequest, "Invalid user ID")
		return
	}

	conversationService := models.NewConversationService(h.db, h.encryptor)
	err = conversationService.AddParticipant(conversationID, req.UserID, adderID)
	if err != nil {
		switch {
		case errors.Is(err, models.ErrConversationNotFound):
			h.respondWithError(c, http.StatusNotFound, "Conversation not found")
		case errors.Is(err, models.ErrUserNotFound):
			h.respondWithError(c, http.StatusNotFound, "User not found")
		case errors.Is(err, models.ErrInvalidParticipant):
			h.respondWithError(c, http.StatusForbidden, "Not authorized to add participants")
		case errors.Is(err, models.ErrDuplicateParticipant):
			h.respondWithError(c, http.StatusConflict, "User is already a participant")
		case err.Error() == "cannot add participants to direct conversations":
			h.respondWithError(c, http.StatusBadRequest, err.Error())
		case err.Error() == "insufficient permissions to add participants":
			h.respondWithError(c, http.StatusForbidden, err.Error())
		default:
			h.respondWithError(c, http.StatusInternalServerError, "Failed to add participant")
		}
		return
	}

	h.respondWithSuccess(c, http.StatusOK, gin.H{"message": "Participant added successfully"})
}

// @Summary Remove participant from conversation
// @Description Remove a participant from a group conversation
// @Tags conversations
// @Accept json
// @Produce json
// @Param id path string true "Conversation ID"
// @Param user_id path string true "User ID"
// @Success 200 {object} map[string]string
// @Failure 400 {object} ErrorResponse
// @Failure 403 {object} ErrorResponse
// @Failure 404 {object} ErrorResponse
// @Security ApiKeyAuth
// @Router /conversations/{id}/participants/{user_id} [delete]
func (h *Handler) RemoveParticipant(c *gin.Context) {
	conversationID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		h.respondWithError(c, http.StatusBadRequest, "Invalid conversation ID")
		return
	}

	userID, err := uuid.Parse(c.Param("user_id"))
	if err != nil {
		h.respondWithError(c, http.StatusBadRequest, "Invalid user ID")
		return
	}

	removerID, err := uuid.Parse(c.GetHeader("X-User-ID"))
	if err != nil {
		h.respondWithError(c, http.StatusBadRequest, "Invalid user ID")
		return
	}

	conversationService := models.NewConversationService(h.db, h.encryptor)
	err = conversationService.RemoveParticipant(conversationID, userID, removerID)
	if err != nil {
		switch {
		case errors.Is(err, models.ErrConversationNotFound):
			h.respondWithError(c, http.StatusNotFound, "Conversation not found")
		case errors.Is(err, models.ErrInvalidParticipant):
			h.respondWithError(c, http.StatusForbidden, "Not authorized to remove participants")
		case err.Error() == "cannot remove participants from direct conversations":
			h.respondWithError(c, http.StatusBadRequest, err.Error())
		case err.Error() == "insufficient permissions to remove participants":
			h.respondWithError(c, http.StatusForbidden, err.Error())
		case err.Error() == "cannot remove conversation owner":
			h.respondWithError(c, http.StatusForbidden, err.Error())
		default:
			h.respondWithError(c, http.StatusInternalServerError, "Failed to remove participant")
		}
		return
	}

	h.respondWithSuccess(c, http.StatusOK, gin.H{"message": "Participant removed successfully"})
}

// @Summary Update participant role
// @Description Update a participant's role in a group conversation
// @Tags conversations
// @Accept json
// @Produce json
// @Param id path string true "Conversation ID"
// @Param user_id path string true "User ID"
// @Param role body UpdateParticipantRoleRequest true "Role information"
// @Success 200 {object} map[string]string
// @Failure 400 {object} ErrorResponse
// @Failure 403 {object} ErrorResponse
// @Failure 404 {object} ErrorResponse
// @Security ApiKeyAuth
// @Router /conversations/{id}/participants/{user_id}/role [put]
func (h *Handler) UpdateParticipantRole(c *gin.Context) {
	conversationID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		h.respondWithError(c, http.StatusBadRequest, "Invalid conversation ID")
		return
	}

	userID, err := uuid.Parse(c.Param("user_id"))
	if err != nil {
		h.respondWithError(c, http.StatusBadRequest, "Invalid user ID")
		return
	}

	var req UpdateParticipantRoleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		h.respondWithError(c, http.StatusBadRequest, err.Error())
		return
	}

	updaterID, err := uuid.Parse(c.GetHeader("X-User-ID"))
	if err != nil {
		h.respondWithError(c, http.StatusBadRequest, "Invalid user ID")
		return
	}

	conversationService := models.NewConversationService(h.db, h.encryptor)
	err = conversationService.UpdateParticipantRole(conversationID, userID, updaterID, req.Role)
	if err != nil {
		switch {
		case errors.Is(err, models.ErrConversationNotFound):
			h.respondWithError(c, http.StatusNotFound, "Conversation not found")
		case errors.Is(err, models.ErrInvalidParticipant):
			h.respondWithError(c, http.StatusForbidden, "Not authorized to update roles")
		case err.Error() == "invalid role":
			h.respondWithError(c, http.StatusBadRequest, err.Error())
		case err.Error() == "cannot update roles in direct conversations":
			h.respondWithError(c, http.StatusBadRequest, err.Error())
		case err.Error() == "only owner can update roles":
			h.respondWithError(c, http.StatusForbidden, err.Error())
		case err.Error() == "cannot change owner's role":
			h.respondWithError(c, http.StatusForbidden, err.Error())
		default:
			h.respondWithError(c, http.StatusInternalServerError, "Failed to update role")
		}
		return
	}

	h.respondWithSuccess(c, http.StatusOK, gin.H{"message": "Role updated successfully"})
}
