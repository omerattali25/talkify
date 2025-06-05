package main

import (
	"context"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"talkify/apps/api/internal/auth"
	"talkify/apps/api/internal/config"
	"talkify/apps/api/internal/encryption"
	"talkify/apps/api/internal/handlers"
	"talkify/apps/api/internal/logger"
	"talkify/apps/api/internal/worker"
	"time"

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

	// Initialize token manager
	tokenManager := auth.NewTokenManager(cfg.JWT.SecretKey)
	logger.Info("Successfully initialized token manager")

	// Initialize worker pool
	workerPool := worker.NewPool(0) // Use number of CPU cores
	workerPool.Start()
	defer workerPool.Stop()

	// Initialize Gin router
	gin.SetMode(gin.ReleaseMode)
	r := gin.New()

	// Configure CORS for development - allow everything
	r.Use(func(c *gin.Context) {
		c.Writer.Header().Set("Access-Control-Allow-Origin", "http://localhost:5173") // Vite's default port
		c.Writer.Header().Set("Access-Control-Allow-Credentials", "true")
		c.Writer.Header().Set("Access-Control-Allow-Headers", "Content-Type, Content-Length, Accept-Encoding, X-CSRF-Token, Authorization, X-User-ID, accept, origin, Cache-Control, X-Requested-With")
		c.Writer.Header().Set("Access-Control-Allow-Methods", "POST, OPTIONS, GET, PUT, DELETE")

		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(204)
			return
		}

		c.Next()
	})

	// Use our custom logger
	r.Use(logger.RequestLogger())
	r.Use(gin.Recovery())

	// Initialize handlers
	h := handlers.NewHandler(db, encryptor, workerPool, tokenManager)

	// API routes
	api := r.Group("/api")
	{
		// WebSocket endpoint
		api.GET("/ws", h.WebSocket)

		// Register other routes
		h.RegisterAuthRoutes(api.Group("/auth"))
		h.RegisterUserRoutes(api.Group("/users"))
		h.RegisterConversationRoutes(api.Group("/conversations"))
		h.RegisterMessageRoutes(api.Group("/messages"))

		// Swagger documentation
		api.GET("/swagger/*any", ginSwagger.WrapHandler(swaggerFiles.Handler))
	}

	// Create server
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	srv := &http.Server{
		Addr:    ":" + port,
		Handler: r,
	}

	// Start server in a goroutine
	go func() {
		logger.Info("Server starting", map[string]interface{}{
			"port": port,
			"mode": gin.Mode(),
		})

		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			logger.Fatal("Failed to start server", err, map[string]interface{}{
				"port": port,
			})
		}
	}()

	// Wait for interrupt signal to gracefully shutdown the server
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	logger.Info("Shutting down server...")

	// The context is used to inform the server it has 5 seconds to finish
	// the request it is currently handling
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := srv.Shutdown(ctx); err != nil {
		logger.Fatal("Server forced to shutdown", err)
	}

	logger.Info("Server exiting")
}
