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
		users.POST("", h.CreateUser)
		users.GET("/:id", h.AuthMiddleware(), h.GetUser)
		users.PUT("/:id", h.AuthMiddleware(), h.UpdateUser)
		users.DELETE("/:id", h.AuthMiddleware(), h.DeleteUser)
	}
}

// @Summary Create a new user
// @Description Register a new user in the system
// @Tags users
// @Accept json
// @Produce json
// @Param user body CreateUserRequest true "User information"
// @Success 201 {object} models.User
// @Failure 400 {object} ErrorResponse
// @Failure 500 {object} ErrorResponse
// @Router /users [post]
func (h *Handler) CreateUser(c *gin.Context) {
	var req CreateUserRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		h.respondWithError(c, http.StatusBadRequest, err.Error())
		return
	}

	userService := models.NewUserService(h.db)
	user := &models.User{
		Username:     req.Username,
		Email:        req.Email,
		Phone:        req.Phone,
		PasswordHash: req.Password, // TODO: Hash password
	}

	if err := userService.Create(user); err != nil {
		h.respondWithError(c, http.StatusInternalServerError, "Failed to create user")
		return
	}

	h.respondWithSuccess(c, http.StatusCreated, user)
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

	userService := models.NewUserService(h.db)
	user, err := userService.GetByID(id)
	if err != nil {
		h.respondWithError(c, http.StatusNotFound, "User not found")
		return
	}

	h.respondWithSuccess(c, http.StatusOK, user)
}

// @Summary Update user
// @Description Update user information
// @Tags users
// @Accept json
// @Produce json
// @Param id path string true "User ID"
// @Param user body UpdateUserRequest true "User information"
// @Success 200 {object} models.User
// @Failure 400 {object} ErrorResponse
// @Failure 404 {object} ErrorResponse
// @Failure 500 {object} ErrorResponse
// @Security ApiKeyAuth
// @Router /users/{id} [put]
func (h *Handler) UpdateUser(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		h.respondWithError(c, http.StatusBadRequest, "Invalid user ID")
		return
	}

	var req UpdateUserRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		h.respondWithError(c, http.StatusBadRequest, err.Error())
		return
	}

	userService := models.NewUserService(h.db)
	user, err := userService.GetByID(id)
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

// @Summary Delete user
// @Description Soft delete a user
// @Tags users
// @Accept json
// @Produce json
// @Param id path string true "User ID"
// @Success 200 {object} map[string]string
// @Failure 400 {object} ErrorResponse
// @Failure 500 {object} ErrorResponse
// @Security ApiKeyAuth
// @Router /users/{id} [delete]
func (h *Handler) DeleteUser(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		h.respondWithError(c, http.StatusBadRequest, "Invalid user ID")
		return
	}

	userService := models.NewUserService(h.db)
	if err := userService.Delete(id); err != nil {
		h.respondWithError(c, http.StatusInternalServerError, "Failed to delete user")
		return
	}

	h.respondWithSuccess(c, http.StatusOK, gin.H{"message": "User deleted successfully"})
}
