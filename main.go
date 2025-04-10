package main

import (
	"fmt"
	"net/http"
	"strings"

	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
    CheckOrigin: func(r *http.Request) bool {
        return true // Allow all origins for this example
    },
}

var ids = 1;



type Vec3 struct{
    x int
    y int
    z int
}
type Color = string


type Player struct{
    id int
    position Vec3
    conn *websocket.Conn
    color Color
}

var connections = make(map[*websocket.Conn]*Player)
var currentId = 0

func handleConnection(w http.ResponseWriter, r *http.Request) {
    conn, err := upgrader.Upgrade(w, r, nil)
    if err != nil {
        fmt.Println("Error while upgrading connection:", err)
        return
    }
    defer conn.Close()

    player := Player{
        position : Vec3 {0, 0, 0},
        conn : conn,
        color : "FFFFFF",
        id: currentId,
    }
    currentId++
    conn.WriteMessage(websocket.TextMessage, []byte(fmt.Sprintf("id:%d", player.id)))

    for connection, other_player := range connections{
        fmt.Printf("%s", other_player.position)
        conn.WriteMessage(websocket.TextMessage, []byte(fmt.Sprintf("player_joined:%d:%d:%d:%d", other_player.id, other_player.position.x, other_player.position.y, other_player.position.z)))
        connection.WriteMessage(websocket.TextMessage, []byte(fmt.Sprintf("player_joined:%d:%d:%d:%d", player.id, player.position.x, player.position.y, player.position.z)))
    }
    connections[conn] = &player

    for {
        _, msg, err := conn.ReadMessage()
        if err != nil {
            fmt.Println("Player left")
            delete(connections, conn)
            for _, other_player := range connections{
                fmt.Printf("Sending notications to id %d\n", other_player.id)
                err  = other_player.conn.WriteMessage(websocket.TextMessage,
                                                    []byte(fmt.Sprintf("player_left:%d", player.id)))
                if err != nil {
                    fmt.Println("This Error while writing message:", err)
                }
            }
            break
        }
        switch strings.Split(string(msg), ":")[1]{
            case "up":
                player.position.y += 1;
                break;
            case "back":
                player.position.y += -1;
                break;
            case "left":
                player.position.x += -1;
                break;
            case "right":
                player.position.x += 1;
                break;
            }
        for _, other_player := range connections{
            fmt.Printf("Sending notications about movement to id %d\n", other_player.id)
            err  = other_player.conn.WriteMessage(websocket.TextMessage, msg)
            if err != nil {
                fmt.Println("This Error while writing message:", err)
            }
        }
    }
}


func main(){
    http.HandleFunc("/ws", handleConnection)
    fmt.Println("Server started on :1580")
    if err := http.ListenAndServe("0.0.0.0:1580", nil); err != nil {
        fmt.Println("Error starting server:", err)
    }
}
