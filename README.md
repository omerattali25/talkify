# Talkify Monorepo

A fullstack monorepo using **Golang (Gin)** for the API and **React** for the frontend.

---

## 🧱 Tech Stack

- **Backend:** Go + Gin (in `apps/api`)
- **Frontend:** React + Vite (in `apps/web`)
- **Hot Reload:** [`air`](https://github.com/cosmtrek/air)
- **Monorepo Tooling:** Yarn Workspaces (optional)
- **Containerization:** Docker + Docker Compose

---

## 📦 Monorepo Structure

talkify/
├── apps/
│ ├── api/ # Go backend
│ └── web/ # React frontend
├── .gitignore
├── docker-compose.yml
├── README.md
└── yarn.lock # (optional) for managing workspace dependencies


---

## 🚀 Getting Started

### 1. Clone the repository

```bash
git clone https://github.com/your-username/talkify.git
cd talkify
```

2. Set up the Go API
Prerequisites:
    Go >= 1.21
    Air for hot reloading:
    go install github.com/cosmtrek/air@latest

    Make sure $GOPATH/bin is in your $PATH.
    Run the API:

    ```bash
    cd apps/api
    air
    ```
✅ The server will start and reload on file changes.

If you don't have .air.toml, here's a minimal version:
# apps/api/.air.toml
```bash
    root = "."
    tmp_dir = "tmp"

    [build]
    cmd = "go run cmd/api/main.go"
    bin = "tmp/main"
    delay = 1000
    exclude_dir = ["tmp", "node_modules"]

    [log]
    time = true
```

3. Set up the Frontend (Optional)
Prerequisites:
    Node.js >= 18
    Yarn (npm install -g yarn)

Install dependencies:
    ```bash
    cd apps/web
    yarn
    ```

Run dev server:
    ``` bash
    yarn dev
    ```
Frontend runs on http://localhost:5173 (Vite default)