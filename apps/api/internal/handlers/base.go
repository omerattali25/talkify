package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/jmoiron/sqlx"
)

type ErrorResponse struct {
	Error string `json:"error"`
}

type Handler struct {
	db *sqlx.DB
}

func NewHandler(db *sqlx.DB) *Handler {
	return &Handler{db: db}
}

func (h *Handler) respondWithError(c *gin.Context, code int, message string) {
	c.JSON(code, ErrorResponse{Error: message})
}

func (h *Handler) respondWithSuccess(c *gin.Context, code int, data interface{}) {
	c.JSON(code, data)
}

// Middleware to check if user is authenticated
func (h *Handler) AuthMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		// TODO: Implement proper authentication
		// For now, we'll just check if the user ID is in the header
		userID := c.GetHeader("X-User-ID")
		if userID == "" {
			h.respondWithError(c, http.StatusUnauthorized, "Unauthorized")
			c.Abort()
			return
		}
		c.Next()
	}
}
