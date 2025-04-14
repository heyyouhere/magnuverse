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

/*
message:
    header
        version - 8
        payloads_count - 8
        ---------
        payloads:
            type - 8
            player_joined:
                id 8
            player_left:
                id 8
            player_moved:
                id 8
                direction
        ---------
*/


var currentId = 0
var connections = make(map[*websocket.Conn]*Player)
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
                    other_player.conn.Close()
                }
            }
            break
        }
        switch strings.Split(string(msg), ":")[1]{
            case "up":
                player.position.z += 1;
                break;
            case "back":
                player.position.z += -1;
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

func redirectToVite(w http.ResponseWriter, r *http.Request) {
    http.Redirect(w, r, "http://77.232.23.43:1581", 301)
}


func main(){
    // fs := http.FileServer(http.Dir("./"))
    http.HandleFunc("/", redirectToVite)
    http.HandleFunc("/ws", handleConnection)
    fmt.Println("Server started on :1580")
    if err := http.ListenAndServe("0.0.0.0:1580", nil); err != nil {
        fmt.Println("Error starting server:", err)
    }
}
