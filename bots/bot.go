package main

import (
    "fmt"
    "log"
    "math/rand"
    "os"
    "os/signal"
    "strconv"
    "strings"
    "sync"
    "syscall"
    "time"

    "github.com/gorilla/websocket"
)

var directions = [...]string{"up", "back", "left", "right"}

func runBot(url string, wg *sync.WaitGroup, done chan struct{}) {
    defer wg.Done() // Notify that this goroutine is done when it returns

    conn, _, err := websocket.DefaultDialer.Dial(url, nil)
    if err != nil {
        log.Fatal("Error connecting to WebSocket server:", err)
    }
    defer conn.Close()

    _, msg, err := conn.ReadMessage()
    if err != nil {
        log.Println("Error reading message:", err)
        return
    }
    fmt.Printf("My id: %s\n", strings.Split(string(msg), ":")[1])
    myId, _ := strconv.Atoi(strings.Split(string(msg), ":")[1])

    fmt.Println("Connected to WebSocket server")
    message := []byte(fmt.Sprintf("move:up:%d", myId))
    err = conn.WriteMessage(websocket.TextMessage, message)
    if err != nil {
        log.Println("Error sending message:", err)
        return
    }

    rand.Seed(time.Now().UnixNano())
    for {
        select {
        case <-done:
            fmt.Println("Shutting down bot...")
            return
        default:
            randomIndex := rand.Intn(len(directions))
            message := []byte(fmt.Sprintf("move:%s:%d", directions[randomIndex], myId))
            err = conn.WriteMessage(websocket.TextMessage, message)
            if err != nil {
                log.Println("Error sending message:", err)
                return
            }
            fmt.Println("Sent message:", string(message))
            time.Sleep(time.Second * 2)
        }
    }
}

func main() {
    url := "ws://77.232.23.43:1580/ws"
    var wg sync.WaitGroup
    done := make(chan struct{})

    // Set up signal handling
    bots_amount := 100
    sigs := make(chan os.Signal, bots_amount)
    signal.Notify(sigs, syscall.SIGINT, syscall.SIGTERM)

    for i := 0; i < bots_amount; i++ {
        wg.Add(1) // Increment the WaitGroup counter
        go runBot(url, &wg, done)
    }

    // Wait for a signal
    <-sigs
    close(done) // Signal all goroutines to shut down

    wg.Wait() // Wait for all goroutines to finish
    fmt.Println("All bots have shut down gracefully.")
}
