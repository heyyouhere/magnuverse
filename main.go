package main

import (
	"fmt"
	"net/http"

	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
    CheckOrigin: func(r *http.Request) bool {
        return true // Allow all origins for this example
    },
}

var ids = 1;



type Vec3 struct{
    x float32
    y float32
    z float32
}
type Color = string


type Player struct{
    Position Vec3
    conn *websocket.Conn
    color Color
}

var players = []Player{}

func handleConnection(w http.ResponseWriter, r *http.Request) {
    conn, err := upgrader.Upgrade(w, r, nil)
    if err != nil {
        fmt.Println("Error while upgrading connection:", err)
        return
    }
    defer conn.Close()

    player := Player{
        Position : Vec3 {0, 0, 0},
        conn : conn,
        color : "FFFFFF",
    }



    conn.WriteMessage(websocket.TextMessage, []byte(fmt.Sprintf("id: %d", len(players))))

    for _, player := range players{
        player.conn.WriteMessage(websocket.TextMessage, []byte("player_joined"))
    }
    players = append(players, player)



    for {
        _, msg, err := conn.ReadMessage()
        if err != nil {
            fmt.Println("Error while reading message:", err)
            break
        }
        fmt.Printf("Received: %s\n", msg)

        if err != nil {
            fmt.Println("Error while writing message:", err)
            break
        }
    }
}


func main(){
    http.HandleFunc("/ws", handleConnection)
    fmt.Println("Server started on :6969")
    if err := http.ListenAndServe(":6969", nil); err != nil {
        fmt.Println("Error starting server:", err)
    }
}
