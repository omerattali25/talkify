package main

import (
	"log"
	"os"

	"talkify/apps/api/internal/config"
	"talkify/apps/api/internal/handlers"

	"github.com/gin-gonic/gin"
	"github.com/jmoiron/sqlx"
	_ "github.com/lib/pq"
	swaggerFiles "github.com/swaggo/files"
	ginSwagger "github.com/swaggo/gin-swagger"

	_ "talkify/apps/api/docs" // This will be generated
)

// @title           Talkify API
// @version         1.0
// @description     A modern chat application API with support for direct messages and group chats.
// @termsOfService  http://swagger.io/terms/

// @contact.name   API Support
// @contact.url    http://www.swagger.io/support
// @contact.email  support@talkify.com

// @license.name  MIT
// @license.url   https://opensource.org/licenses/MIT

// @host      localhost:8080
// @BasePath  /api

// @securityDefinitions.apikey ApiKeyAuth
// @in header
// @name X-User-ID
func main() {
	// Initialize database configuration
	dbConfig := config.NewDatabaseConfig()

	// Connect to the database
	db, err := sqlx.Connect("postgres", dbConfig.DSN())
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}
	defer db.Close()

	// Initialize Gin router
	r := gin.Default()

	// Initialize handlers
	h := handlers.NewHandler(db)

	// API routes
	api := r.Group("/api")
	{
		// Register routes
		h.RegisterUserRoutes(api)
		h.RegisterConversationRoutes(api)
		h.RegisterMessageRoutes(api)
	}

	// Swagger documentation
	r.GET("/swagger/*any", ginSwagger.WrapHandler(swaggerFiles.Handler))

	// Start server
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	log.Printf("Server starting on port %s", port)
	if err := r.Run(":" + port); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}
