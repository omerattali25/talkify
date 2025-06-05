package logger

import (
	"fmt"
	"os"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/rs/zerolog"
	"github.com/rs/zerolog/log"
)

var Logger zerolog.Logger

// InitLogger initializes the global logger with pretty console output
func InitLogger(isDevelopment bool) {
	// Set up pretty console writer
	output := zerolog.ConsoleWriter{
		Out:        os.Stdout,
		TimeFormat: time.RFC3339,
		FormatLevel: func(i interface{}) string {
			return fmt.Sprintf("| %-6s|", i)
		},
		FormatMessage: func(i interface{}) string {
			return fmt.Sprintf("| %s |", i)
		},
		FormatFieldName: func(i interface{}) string {
			return fmt.Sprintf("%s:", i)
		},
		FormatFieldValue: func(i interface{}) string {
			return fmt.Sprintf("%s", i)
		},
	}

	// Set global log level based on environment
	logLevel := zerolog.InfoLevel
	if isDevelopment {
		logLevel = zerolog.DebugLevel
	}

	// Initialize logger with pretty console output
	Logger = zerolog.New(output).
		Level(logLevel).
		With().
		Timestamp().
		Caller().
		Logger()

	// Set as default logger for package-level functions
	log.Logger = Logger
}

// RequestLogger returns middleware for logging HTTP requests
func RequestLogger() gin.HandlerFunc {
	return func(c *gin.Context) {
		start := time.Now()

		// Process request
		c.Next()

		// Log request details
		latency := time.Since(start)
		status := c.Writer.Status()
		path := c.Request.URL.Path
		method := c.Request.Method
		ip := c.ClientIP()
		userAgent := c.Request.UserAgent()

		// Determine log level based on status code
		logEvent := Logger.Info()
		if status >= 400 && status < 500 {
			logEvent = Logger.Warn()
		} else if status >= 500 {
			logEvent = Logger.Error()
		}

		logEvent.
			Str("method", method).
			Str("path", path).
			Int("status", status).
			Dur("latency", latency).
			Str("ip", ip).
			Str("user_agent", userAgent).
			Msg("HTTP Request")
	}
}

// Example logging functions with different levels and structured data

func Info(msg string, fields ...map[string]interface{}) {
	event := Logger.Info()
	addFields(event, fields...)
	event.Msg(msg)
}

func Debug(msg string, fields ...map[string]interface{}) {
	event := Logger.Debug()
	addFields(event, fields...)
	event.Msg(msg)
}

func Warn(msg string, fields ...map[string]interface{}) {
	event := Logger.Warn()
	addFields(event, fields...)
	event.Msg(msg)
}

func Error(msg string, err error, fields ...map[string]interface{}) {
	event := Logger.Error()
	if err != nil {
		event = event.Err(err)
	}
	addFields(event, fields...)
	event.Msg(msg)
}

func Fatal(msg string, err error, fields ...map[string]interface{}) {
	event := Logger.Fatal()
	if err != nil {
		event = event.Err(err)
	}
	addFields(event, fields...)
	event.Msg(msg)
}

// Helper function to add fields to log events
func addFields(event *zerolog.Event, fields ...map[string]interface{}) {
	for _, field := range fields {
		for k, v := range field {
			event = event.Interface(k, v)
		}
	}
}
