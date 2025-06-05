# Talkify - Modern Chat Application

Talkify is a robust chat application backend built with Go, featuring PostgreSQL for data persistence and a RESTful API architecture. This application supports real-time messaging, group chats, and multimedia message types.

## Features

- **User Management**
  - User registration and profile management
  - Status updates and avatar support
  - Last seen tracking

- **Messaging Capabilities**
  - Direct messaging
  - Group chats
  - Multiple message types support:
    - Text messages
    - Image sharing
    - Video sharing
    - Audio messages
    - File attachments
    - Location sharing

- **Advanced Chat Features**
  - Message read receipts
  - Message editing and deletion
  - Reply to specific messages
  - Media preview and thumbnails
  - Message status tracking (sent/delivered/read)

- **Conversation Management**
  - Create and manage conversations
  - Group chat administration
  - Conversation archiving
  - Read/unread status tracking

## Technology Stack

- **Backend**: Go (1.21+)
- **Database**: PostgreSQL
- **API Documentation**: Swagger/OpenAPI
- **Container Runtime**: Docker & Docker Compose
- **Dependencies**: 
  - gin-gonic/gin (Web framework)
  - lib/pq (PostgreSQL driver)
  - jmoiron/sqlx (Database operations)
  - swaggo/swag (API documentation)
  - google/uuid (UUID handling)

## Project Structure

```
apps/api/
├── cmd/
│   └── main.go           # Application entry point
├── internal/
│   ├── config/          # Configuration management
│   ├── handlers/        # API endpoint handlers
│   ├── models/          # Data models and database operations
│   └── middleware/      # Custom middleware
├── docs/                # API documentation
├── migrations/          # Database migrations
└── docker-compose.yml   # Container orchestration
```

## Getting Started

### Prerequisites

- Go 1.21 or higher
- Docker and Docker Compose
- PostgreSQL 13 or higher
- Make (optional, for using Makefile commands)

### Environment Setup

1. Clone the repository:
```bash
git clone <repository-url>
cd talkify
```

2. Create a `.env` file in the `apps/api` directory:
```env
PORT=8080
DB_HOST=localhost
DB_PORT=5432
DB_USER=talkify
DB_PASSWORD=your_secure_password
DB_NAME=talkify
DB_SSL_MODE=disable
```

3. Start the database using Docker Compose:
```bash
docker-compose up -d
```

4. Run database migrations:
```bash
# Command will be added once migrations are set up
```

5. Start the application:
```bash
cd apps/api
go run cmd/main.go
```

### API Documentation

Once the application is running, you can access the Swagger documentation at:
```
http://localhost:8080/swagger/index.html
```

## API Authentication

The API uses a simple header-based authentication system. Include the following header in your requests:

```
X-User-ID: <user-uuid>
```

## Development

### Building the Project

```bash
cd apps/api
go build -o talkify cmd/main.go
```

### Running Tests

```bash
go test ./...
```

### Generating API Documentation

```bash
swag init -g cmd/main.go -o docs
```

## Message Types

The application supports various message types:

- `text`: Regular text messages
- `image`: Image attachments
- `video`: Video attachments
- `audio`: Audio messages
- `file`: File attachments
- `location`: Location sharing

## Security Considerations

- All passwords should be properly hashed before storage
- Use environment variables for sensitive configuration
- Implement rate limiting for API endpoints
- Regular security audits recommended
- Keep dependencies updated

## Contributing

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Create a new Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

For support and questions, please open an issue in the repository.