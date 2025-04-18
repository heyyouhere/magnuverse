package main

import (
	"fmt"
	"net/http"

	// "strings"
	"bytes"
	"encoding/binary"

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

const (
    MSG_WELCOME = iota
    MSG_JOINED
    MSG_LEFT
    MSG_MOVED
)

type WelcomeMessage struct{
    MessageType uint8
    PlayerId uint32
}

type JoinedMessage struct{
    MessageType uint8
    PlayerId uint32
    // isMoving bool
    // position [3]float32
    // directionVector [3]float32
}

type LeftdMessage struct{
    MessageType uint8
    PlayerId uint32
}
type MovedMessage struct{
    MessageType uint8
    PlayerId uint32
    IsMoving uint8 //should be bool, but golang has weird bools sizes
    DirectionSize uint8
    DirectionVector [3]float32

}

func handleConnection(w http.ResponseWriter, r *http.Request) {
    conn, err := upgrader.Upgrade(w, r, nil)
    if err != nil {
        fmt.Println("Error while upgrading connection:", err)
        return
    }

    defer delete(connections, conn)
    defer conn.Close()

    player := Player{
        position : Vec3 {0, 0, 0},
        conn : conn,
        color : "FFFFFF",
        id: currentId,
    }
    currentId++

    buf := bytes.Buffer{}
    welcomeMessage := WelcomeMessage{uint8(MSG_WELCOME), uint32(player.id)}
    binary.Write(&buf, binary.BigEndian, welcomeMessage)
    conn.WriteMessage(websocket.BinaryMessage, buf.Bytes())


    for connection, other_player := range connections{
        buf.Reset()
        joinedMessage := JoinedMessage{uint8(MSG_JOINED), uint32(other_player.id)}
        binary.Write(&buf, binary.BigEndian, joinedMessage)
        err = conn.WriteMessage(websocket.BinaryMessage, buf.Bytes())
        if err != nil{
            fmt.Printf("Could not write to ws conn %+v, cause of %s\n", conn, err)
        }
        fmt.Printf("Sended player_joined to %d player\n", player.id)

        buf.Reset()
        joinedMessage = JoinedMessage{uint8(MSG_JOINED), uint32(player.id)}
        binary.Write(&buf, binary.BigEndian, joinedMessage)
        err = connection.WriteMessage(websocket.BinaryMessage, buf.Bytes())
        if err != nil{
            fmt.Printf("Could not write to ws conn %+v, cause of %s\n", connection, err)
        }
        fmt.Printf("Sended player_joined to %d player\n", other_player.id)
    }
    connections[conn] = &player

    for {
        _, msg, err := conn.ReadMessage()
        if err != nil{
            fmt.Printf("%d closed connection\n", player.id)
            delete(connections, conn)
            var buff bytes.Buffer
            for connection, otherPlayer := range connections {
                leftMessage := LeftdMessage{uint8(MSG_LEFT), uint32(player.id)}
                binary.Write(&buff, binary.BigEndian, leftMessage)
                err = connection.WriteMessage(websocket.BinaryMessage, buff.Bytes())
                if err != nil{ fmt.Printf("Could not write to ws conn %d, cause of %s\n", otherPlayer.id, err) }
                fmt.Printf("Notified player %d that player %d has left\n", otherPlayer.id, player.id)
                buff.Reset()
            }
            conn.Close()
        }
        movedMessage := MovedMessage{}
        reader := bytes.NewReader(msg)
        err = binary.Read(reader, binary.BigEndian, &movedMessage)
        if err != nil {
            fmt.Println("Error reading binary data:", err)
            return
        }


        var buf bytes.Buffer
        binary.Write(&buf, binary.BigEndian, movedMessage)
        conn.WriteMessage(websocket.BinaryMessage, buf.Bytes())
        for connection, otherPlayer := range connections {
            if otherPlayer.id != player.id{
                connection.WriteMessage(websocket.BinaryMessage, buf.Bytes())
            }
        }

        // if err != nil {
        //     fmt.Println("Player left")
        //     delete(connections, conn)
        //     for _, other_player := range connections{
        //         fmt.Printf("Sending notications to id %d\n", other_player.id)
        //         err  = other_player.conn.WriteMessage(websocket.TextMessage,
        //                                             []byte(fmt.Sprintf("player_left:%d", player.id)))
        //         if err != nil {
        //             fmt.Println("This Error while writing message:", err)
        //             other_player.conn.Close()
        //         }
        //     }
        //     break
        // }
        // switch strings.Split(string(msg), ":")[1]{
        //     case "up":
        //         player.position.z += 1;
        //         break;
        //     case "back":
        //         player.position.z += -1;
        //         break;
        //     case "left":
        //         player.position.x += -1;
        //         break;
        //     case "right":
        //         player.position.x += 1;
        //         break;
        //     }
        // for _, other_player := range connections{
        //     fmt.Printf("Sending notications about movement to id %d\n", other_player.id)
        //     err  = other_player.conn.WriteMessage(websocket.TextMessage, msg)
        //     if err != nil {
        //         fmt.Println("This Error while writing message:", err)
        //     }
        // }
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
