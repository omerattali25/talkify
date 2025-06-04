# syntax=docker/dockerfile:1

FROM golang:1.22-alpine

# Install Air for hot-reloading
RUN apk add --no-cache curl git && \
    go install github.com/cosmtrek/air@latest

WORKDIR /app

COPY . .

# Download Go modules
RUN go mod download

EXPOSE 8080

CMD ["air"]
