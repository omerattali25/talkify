package handlers

import (
	"net/http"

	"talkify/apps/api/internal/models"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type CreateUserRequest struct {
	Username string `json:"username" binding:"required" example:"johndoe"`
	Email    string `json:"email" binding:"required,email" example:"john@example.com"`
	Phone    string `json:"phone" binding:"required" example:"+1234567890"`
	Password string `json:"password" binding:"required,min=6" example:"secretpass123"`
}

type UpdateUserRequest struct {
	Username  string `json:"username" example:"johndoe"`
	Email     string `json:"email" binding:"omitempty,email" example:"john@example.com"`
	Phone     string `json:"phone" example:"+1234567890"`
	Status    string `json:"status" example:"Hello, I'm using Talkify!"`
	AvatarURL string `json:"avatar_url" example:"https://example.com/avatar.jpg"`
}

func (h *Handler) RegisterUserRoutes(r *gin.RouterGroup) {
	users := r.Group("/users")
	{
		// Auth endpoints
		users.POST("/", h.RegisterUser)   // Register: POST /api/users
		users.POST("/login", h.LoginUser) // Login: POST /api/users/login

		// User management endpoints
		users.GET("/me", h.AuthMiddleware(), h.GetCurrentUser)          // Get own profile: GET /api/users/me
		users.GET("/:id", h.AuthMiddleware(), h.GetUser)                // Get user: GET /api/users/:id
		users.PUT("/me", h.AuthMiddleware(), h.UpdateUser)              // Update own profile: PUT /api/users/me
		users.PUT("/me/password", h.AuthMiddleware(), h.ChangePassword) // Change password: PUT /api/users/me/password
	}
}

// @Summary Register a new user
// @Description Register a new user in the system
// @Tags users
// @Accept json
// @Produce json
// @Param user body models.CreateUserInput true "User registration info"
// @Success 201 {object} models.User
// @Failure 400 {object} ErrorResponse
// @Failure 500 {object} ErrorResponse
// @Router /users [post]
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

// @Summary Login user
// @Description Authenticate a user and return their details
// @Tags users
// @Accept json
// @Produce json
// @Param credentials body models.LoginInput true "Login credentials"
// @Success 200 {object} models.User
// @Failure 400 {object} ErrorResponse
// @Failure 401 {object} ErrorResponse
// @Failure 500 {object} ErrorResponse
// @Router /users/login [post]
func (h *Handler) LoginUser(c *gin.Context) {
	var input models.LoginInput
	if err := c.ShouldBindJSON(&input); err != nil {
		h.respondWithError(c, http.StatusBadRequest, err.Error())
		return
	}

	userService := models.NewUserService(h.db, h.encryptor)
	user, err := userService.Login(&input)
	if err != nil {
		if err == models.ErrNotFound {
			h.respondWithError(c, http.StatusUnauthorized, "Invalid credentials")
			return
		}
		if err == models.ErrUnauthorized {
			h.respondWithError(c, http.StatusUnauthorized, "Invalid credentials")
			return
		}
		h.respondWithError(c, http.StatusInternalServerError, "Login failed")
		return
	}

	h.respondWithSuccess(c, http.StatusOK, user)
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
// @Description Change the password of the authenticated user
// @Tags users
// @Accept json
// @Produce json
// @Param passwords body ChangePasswordInput true "Password change info"
// @Success 200 {object} map[string]string
// @Failure 400 {object} ErrorResponse
// @Failure 401 {object} ErrorResponse
// @Security ApiKeyAuth
// @Router /users/change-password [post]
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
// @Failure 401 {object} ErrorResponse
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

// @Summary Update current user
// @Description Update the profile of the currently authenticated user
// @Tags users
// @Accept json
// @Produce json
// @Param user body UpdateUserRequest true "User information"
// @Success 200 {object} models.User
// @Failure 400 {object} ErrorResponse
// @Failure 401 {object} ErrorResponse
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
	if req.AvatarURL != "" {
		user.AvatarURL = req.AvatarURL
	}

	if err := userService.Update(user); err != nil {
		h.respondWithError(c, http.StatusInternalServerError, "Failed to update user")
		return
	}

	h.respondWithSuccess(c, http.StatusOK, user)
}
