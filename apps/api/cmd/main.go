package main

import (
	"os"
	"talkify/apps/api/internal/config"
	"talkify/apps/api/internal/encryption"
	"talkify/apps/api/internal/handlers"
	"talkify/apps/api/internal/logger"

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
	// Initialize logger
	logger.InitLogger(true) // true for development mode

	// Initialize configuration
	cfg, err := config.LoadConfig()
	if err != nil {
		logger.Fatal("Failed to load config", err)
	}

	// Initialize database
	db, err := sqlx.Connect("postgres", cfg.Database.DSN())
	if err != nil {
		logger.Fatal("Failed to connect to database", err, map[string]interface{}{
			"dsn": cfg.Database.DSN(),
		})
	}
	defer db.Close()

	logger.Info("Successfully connected to database", map[string]interface{}{
		"host": cfg.Database.Host,
		"port": cfg.Database.Port,
		"name": cfg.Database.DBName,
	})

	// Initialize encryption manager
	keyManager, err := encryption.NewKeyManager(cfg.Encryption.KeyFile)
	if err != nil {
		logger.Fatal("Failed to initialize key manager", err, map[string]interface{}{
			"keyFile": cfg.Encryption.KeyFile,
		})
	}

	encryptor, err := encryption.NewManager(keyManager.GetKey())
	if err != nil {
		logger.Fatal("Failed to initialize encryption manager", err)
	}

	logger.Info("Successfully initialized encryption manager")

	// Initialize Gin router
	gin.SetMode(gin.ReleaseMode)
	r := gin.New() // Use New() instead of Default() to avoid using the default logger

	// Use our custom logger
	r.Use(logger.RequestLogger())
	r.Use(gin.Recovery()) // Keep the recovery middleware

	// Initialize handlers
	h := handlers.NewHandler(db, encryptor)

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

	logger.Info("Server starting", map[string]interface{}{
		"port": port,
		"mode": gin.Mode(),
	})

	if err := r.Run(":" + port); err != nil {
		logger.Fatal("Failed to start server", err, map[string]interface{}{
			"port": port,
		})
	}
}
