package handlers

import (
	"fmt"
	"net/http"
	"talkify/apps/api/internal/models"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

func (h *Handler) RegisterAuthRoutes(r *gin.RouterGroup) {
	r.POST("/login", h.LoginUser)
	r.POST("/register", h.RegisterUser)
	r.POST("/refresh", h.RefreshToken)
}

func (h *Handler) RegisterUser(c *gin.Context) {
	var input models.CreateUserInput
	if err := c.ShouldBindJSON(&input); err != nil {
		h.respondWithError(c, http.StatusBadRequest, err.Error())
		return
	}

	userService := models.NewUserService(h.db, h.encryptor)
	user, err := userService.Create(&input)
	if err != nil {
		h.respondWithError(c, http.StatusInternalServerError, "Failed to create user")
		return
	}

	h.respondWithSuccess(c, http.StatusCreated, user)
}

func (h *Handler) LoginUser(c *gin.Context) {
	var input models.LoginInput
	if err := c.ShouldBindJSON(&input); err != nil {
		h.respondWithError(c, http.StatusBadRequest, err.Error())
		return
	}

	userService := models.NewUserService(h.db, h.encryptor)
	user, err := userService.Login(&input)
	if err != nil {
		if err == models.ErrNotFound || err == models.ErrUnauthorized {
			h.respondWithError(c, http.StatusUnauthorized, "Invalid credentials")
			return
		}
		h.respondWithError(c, http.StatusInternalServerError, "Login failed")
		return
	}

	token, err := h.tokenManager.GenerateToken(user.ID)
	if err != nil {
		h.respondWithError(c, http.StatusInternalServerError, "Failed to generate token")
		return
	}

	h.respondWithSuccess(c, http.StatusOK, gin.H{
		"user":  user,
		"token": token,
	})
}

func (h *Handler) RefreshToken(c *gin.Context) {
	userID, err := h.getUserIDFromToken(c)
	if err != nil {
		h.respondWithError(c, http.StatusUnauthorized, "Invalid token")
		return
	}

	token, err := h.tokenManager.GenerateToken(userID)
	if err != nil {
		h.respondWithError(c, http.StatusInternalServerError, "Failed to generate token")
		return
	}

	h.respondWithSuccess(c, http.StatusOK, gin.H{"token": token})
}

func (h *Handler) getUserIDFromToken(c *gin.Context) (uuid.UUID, error) {
	userID, exists := c.Get("userID")
	if !exists {
		return uuid.Nil, fmt.Errorf("user ID not found in context")
	}

	id, ok := userID.(uuid.UUID)
	if !ok {
		return uuid.Nil, fmt.Errorf("invalid user ID type in context")
	}

	return id, nil
}
