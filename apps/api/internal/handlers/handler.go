package handlers

import (
	"fmt"
	"net/http"
	"strings"

	"talkify/apps/api/internal/auth"
	"talkify/apps/api/internal/encryption"
	"talkify/apps/api/internal/models"
	"talkify/apps/api/internal/worker"

	"github.com/gin-gonic/gin"
	"github.com/jmoiron/sqlx"
)

type Handler struct {
	db           *sqlx.DB
	encryptor    *encryption.Manager
	workerPool   *worker.Pool
	tokenManager *auth.TokenManager
	hub          *Hub
}

func NewHandler(db *sqlx.DB, encryptor *encryption.Manager, workerPool *worker.Pool, tokenManager *auth.TokenManager) *Handler {
	hub := NewHub()
	go hub.Run() // Start the hub in a goroutine

	return &Handler{
		db:           db,
		encryptor:    encryptor,
		workerPool:   workerPool,
		tokenManager: tokenManager,
		hub:          hub,
	}
}

func (h *Handler) respondWithError(c *gin.Context, code int, message string) {
	c.JSON(code, gin.H{"error": message})
}

func (h *Handler) respondWithSuccess(c *gin.Context, code int, data interface{}) {
	c.JSON(code, data)
}

func (h *Handler) AuthMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		// Skip auth for login and register endpoints
		if c.Request.URL.Path == "/api/auth/login" || c.Request.URL.Path == "/api/auth/register" {
			c.Next()
			return
		}

		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			h.respondWithError(c, http.StatusUnauthorized, "Authorization header is required")
			c.Abort()
			return
		}

		// Check if the header has the Bearer prefix
		parts := strings.Split(authHeader, " ")
		if len(parts) != 2 || parts[0] != "Bearer" {
			h.respondWithError(c, http.StatusUnauthorized, "Invalid authorization header format")
			c.Abort()
			return
		}

		// Validate the token
		claims, err := h.tokenManager.ValidateToken(parts[1])
		if err != nil {
			h.respondWithError(c, http.StatusUnauthorized, fmt.Sprintf("Invalid token: %v", err))
			c.Abort()
			return
		}

		// Get full user object
		userService := models.NewUserService(h.db, h.encryptor)
		user, err := userService.GetByID(claims.UserID)
		if err != nil {
			if err == models.ErrNotFound {
				h.respondWithError(c, http.StatusUnauthorized, "User not found")
			} else {
				h.respondWithError(c, http.StatusInternalServerError, fmt.Sprintf("Failed to get user: %v", err))
			}
			c.Abort()
			return
		}

		// Check if user is active
		if !user.IsActive {
			h.respondWithError(c, http.StatusForbidden, "User account is inactive")
			c.Abort()
			return
		}

		// Set both user ID and full user object in context
		c.Set("userID", claims.UserID)
		c.Set("user", user)
		c.Request.Header.Set("X-User-ID", claims.UserID.String())

		// Submit user status update to worker pool
		h.submitTask("update_user_status", func() error {
			return userService.SetOnlineStatus(claims.UserID, true)
		})

		c.Next()
	}
}

func (h *Handler) submitTask(name string, task func() error) {
	h.workerPool.Submit(worker.Task{
		Name:    name,
		Handler: task,
	})
}
