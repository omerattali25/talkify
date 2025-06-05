package handlers

import (
	"fmt"
	"net/http"

	"talkify/apps/api/internal/logger"
	"talkify/apps/api/internal/models"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type UpdateUserRequest struct {
	Username string `json:"username" example:"johndoe"`
	Email    string `json:"email" binding:"omitempty,email" example:"john@example.com"`
	Phone    string `json:"phone" example:"+1234567890"`
	Status   string `json:"status" example:"Hello, I'm using Talkify!"`
}

func (h *Handler) RegisterUserRoutes(r *gin.RouterGroup) {
	r.Use(h.AuthMiddleware())
	r.GET("/me", h.GetCurrentUser)
	r.PUT("/me", h.UpdateUser)
	r.PUT("/me/password", h.ChangePassword)
	r.GET("/search", h.GetUserByUsername)
	r.GET("", h.GetUsers)
	r.GET("/:id", h.GetUser)
}

// @Summary Get user by ID
// @Description Get user details by their ID
// @Tags users
// @Accept json
// @Produce json
// @Param id path string true "User ID"
// @Success 200 {object} models.User
// @Failure 400 {object} ErrorResponse
// @Failure 404 {object} ErrorResponse
// @Security ApiKeyAuth
// @Router /users/{id} [get]
func (h *Handler) GetUser(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		h.respondWithError(c, http.StatusBadRequest, "Invalid user ID")
		return
	}

	userService := models.NewUserService(h.db, h.encryptor)
	user, err := userService.GetByID(id)
	if err != nil {
		if err == models.ErrNotFound {
			h.respondWithError(c, http.StatusNotFound, "User not found")
			return
		}
		h.respondWithError(c, http.StatusInternalServerError, "Failed to get user")
		return
	}

	h.respondWithSuccess(c, http.StatusOK, user)
}

type ChangePasswordInput struct {
	CurrentPassword string `json:"current_password" binding:"required"`
	NewPassword     string `json:"new_password" binding:"required,min=8"`
}

// @Summary Change user password
// @Description Change the password of the currently authenticated user
// @Tags users
// @Accept json
// @Produce json
// @Param passwords body ChangePasswordInput true "Password change info"
// @Success 200 {object} map[string]string
// @Failure 400 {object} ErrorResponse
// @Failure 401 {object} ErrorResponse
// @Failure 404 {object} ErrorResponse
// @Security ApiKeyAuth
// @Router /users/me/password [put]
func (h *Handler) ChangePassword(c *gin.Context) {
	var input ChangePasswordInput
	if err := c.ShouldBindJSON(&input); err != nil {
		h.respondWithError(c, http.StatusBadRequest, err.Error())
		return
	}

	userID, err := uuid.Parse(c.GetHeader("X-User-ID"))
	if err != nil {
		h.respondWithError(c, http.StatusBadRequest, "Invalid user ID")
		return
	}

	userService := models.NewUserService(h.db, h.encryptor)
	err = userService.UpdatePassword(userID, input.CurrentPassword, input.NewPassword)
	if err != nil {
		if err == models.ErrUnauthorized {
			h.respondWithError(c, http.StatusUnauthorized, "Current password is incorrect")
			return
		}
		if err == models.ErrNotFound {
			h.respondWithError(c, http.StatusNotFound, "User not found")
			return
		}
		h.respondWithError(c, http.StatusInternalServerError, "Failed to update password")
		return
	}

	h.respondWithSuccess(c, http.StatusOK, gin.H{"message": "Password updated successfully"})
}

// @Summary Get current user profile
// @Description Get the profile of the currently authenticated user
// @Tags users
// @Accept json
// @Produce json
// @Success 200 {object} models.User
// @Failure 400 {object} ErrorResponse
// @Failure 404 {object} ErrorResponse
// @Security ApiKeyAuth
// @Router /users/me [get]
func (h *Handler) GetCurrentUser(c *gin.Context) {
	userID, err := uuid.Parse(c.GetHeader("X-User-ID"))
	if err != nil {
		h.respondWithError(c, http.StatusBadRequest, "Invalid user ID")
		return
	}

	userService := models.NewUserService(h.db, h.encryptor)
	user, err := userService.GetByID(userID)
	if err != nil {
		if err == models.ErrNotFound {
			h.respondWithError(c, http.StatusNotFound, "User not found")
			return
		}
		h.respondWithError(c, http.StatusInternalServerError, "Failed to get user")
		return
	}

	h.respondWithSuccess(c, http.StatusOK, user)
}

// @Summary Update current user profile
// @Description Update the profile of the currently authenticated user
// @Tags users
// @Accept json
// @Produce json
// @Param user body UpdateUserRequest true "User information"
// @Success 200 {object} models.User
// @Failure 400 {object} ErrorResponse
// @Failure 404 {object} ErrorResponse
// @Security ApiKeyAuth
// @Router /users/me [put]
func (h *Handler) UpdateUser(c *gin.Context) {
	var req UpdateUserRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		h.respondWithError(c, http.StatusBadRequest, err.Error())
		return
	}

	userID, err := uuid.Parse(c.GetHeader("X-User-ID"))
	if err != nil {
		h.respondWithError(c, http.StatusBadRequest, "Invalid user ID")
		return
	}

	userService := models.NewUserService(h.db, h.encryptor)
	user, err := userService.GetByID(userID)
	if err != nil {
		h.respondWithError(c, http.StatusNotFound, "User not found")
		return
	}

	if req.Username != "" {
		user.Username = req.Username
	}
	if req.Email != "" {
		user.Email = req.Email
	}
	if req.Phone != "" {
		user.Phone = req.Phone
	}
	if req.Status != "" {
		user.Status = req.Status
	}

	if err := userService.Update(user); err != nil {
		h.respondWithError(c, http.StatusInternalServerError, "Failed to update user")
		return
	}

	h.respondWithSuccess(c, http.StatusOK, user)
}

// @Summary Get all users
// @Description Get a list of all active users
// @Tags users
// @Accept json
// @Produce json
// @Success 200 {array} models.User
// @Failure 500 {object} ErrorResponse
// @Security ApiKeyAuth
// @Router /users [get]
func (h *Handler) GetUsers(c *gin.Context) {
	userService := models.NewUserService(h.db, h.encryptor)
	users, err := userService.GetAll()
	if err != nil {
		logger.Error("Failed to get users", err, nil)
		h.respondWithError(c, http.StatusInternalServerError, fmt.Sprintf("Failed to get users: %v", err))
		return
	}

	// Don't include the current user in the list
	currentUserID, err := uuid.Parse(c.GetHeader("X-User-ID"))
	if err != nil {
		logger.Error("Failed to parse user ID", err, map[string]interface{}{
			"user_id": c.GetHeader("X-User-ID"),
		})
		h.respondWithError(c, http.StatusBadRequest, "Invalid user ID")
		return
	}

	filteredUsers := make([]*models.User, 0)
	for _, user := range users {
		if user.ID != currentUserID {
			filteredUsers = append(filteredUsers, user)
		}
	}

	logger.Debug("Retrieved users", map[string]interface{}{
		"total_users":    len(users),
		"filtered_users": len(filteredUsers),
		"current_user":   currentUserID,
	})

	h.respondWithSuccess(c, http.StatusOK, filteredUsers)
}

// @Summary Get user by username
// @Description Get user details by their username
// @Tags users
// @Accept json
// @Produce json
// @Param username query string true "Username to search for"
// @Success 200 {object} models.User
// @Failure 404 {object} ErrorResponse
// @Failure 500 {object} ErrorResponse
// @Security ApiKeyAuth
// @Router /users/search [get]
func (h *Handler) GetUserByUsername(c *gin.Context) {
	username := c.Query("username")
	if username == "" {
		h.respondWithError(c, http.StatusBadRequest, "Username is required")
		return
	}

	userService := models.NewUserService(h.db, h.encryptor)
	user, err := userService.GetByUsername(username)
	if err != nil {
		h.respondWithError(c, http.StatusNotFound, "User not found")
		return
	}

	h.respondWithSuccess(c, http.StatusOK, user)
}
