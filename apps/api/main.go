package main

import (
    "fmt"
    "net/http"
)

func main() {
    http.HandleFunc("/api/hello", func(w http.ResponseWriter, r *http.Request) {
        fmt.Fprintln(w, "Hello from Go!")
    })

    fmt.Println("Server running on http://localhost:8080")
    http.ListenAndServe(":8080", nil)
}
