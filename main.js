import * as THREE from 'three';

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// Add a simple cube
const geometry = new THREE.BoxGeometry();


function createPlayer(){
}

camera.position.z = 5;


let clock = new THREE.Clock();


window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});


class Player{
    constructor(id, color, position) {
        this.id = id;
        this.color = color;
        this.position = position;
        const material = new THREE.MeshBasicMaterial({ color: color });
        this.model = new THREE.Mesh(geometry, material);
        this.model.position.set(position.x, position.y, position.z)
    }
}



function animate() {
        requestAnimationFrame(animate);
        renderer.render(scene, camera);
}
animate();


const ws = new WebSocket("ws://77.232.23.43:1580/ws");

let player;
ws.addEventListener('open', function (event) {
    console.log(event)
    console.log('WebSocket is connected.');

});


let players = new Map();


ws.addEventListener('message', function (event) {
    console.log(event.data)
    if (event.data.startsWith("id:")){
        let myId = event.data.split(':')[1]
        document.getElementById("player_id").innerText = myId
        player = new Player(myId, new THREE.Color(255, 0, 0), new THREE.Vector3());
        scene.add(player.model)
        function handleKeyDown(event) {
            switch (event.key) {
                case 'w':
                case 'W':
                    player.model.position.add(new THREE.Vector3(0,1,0));
                    ws.send(`move:up:${player.id}`)
                    break;
                case 'a':
                case 'A':
                    player.model.position.add(new THREE.Vector3(-1,0,0));
                    ws.send(`move:left:${player.id}`)
                    break;
                case 's':
                case 'S':
                    player.model.position.add(new THREE.Vector3(0,-1,0));
                    ws.send(`move:back:${player.id}`)
                    break;
                case 'd':
                case 'D':
                    player.model.position.add(new THREE.Vector3(1,0,0));
                    ws.send(`move:right:${player.id}`)
                    break;
            }
        }
        window.addEventListener('keydown', handleKeyDown);
    }
    if (event.data.startsWith('player_joined:')){
        let id = event.data.split(':')[1]
        let pos = new THREE.Vector3(parseInt(event.data.split(':')[2]), parseInt(event.data.split(':')[3]), parseInt(event.data.split(':')[4]))
        let new_player = new Player(id, new THREE.Color(0xAAAAAA), pos);
        console.log(new_player.model.position)
        players.set(id, new_player);
        scene.add(new_player.model);
    }
    if (event.data.startsWith('player_left:')){
        let left_id = event.data.split(':')[1]
        let left_player = players.get(left_id)
        scene.remove(left_player.model)
        players.delete(left_id)
    }
    if (event.data.startsWith('move:')){
        let movedPlayerId = event.data.split(':')[2]
        let moveDirection = event.data.split(':')[1]
        let moved_player = players.get(movedPlayerId)
        if (movedPlayerId != player.id){
            switch (moveDirection) {
                case 'up':
                    moved_player.model.position.add(new THREE.Vector3(0,1,0));
                    break;
                case 'left':
                    moved_player.model.position.add(new THREE.Vector3(-1,0,0));
                    break;
                case 'back':
                    moved_player.model.position.add(new THREE.Vector3(0,-1,0));
                    break;
                case 'right':
                    moved_player.model.position.add(new THREE.Vector3(1,0,0));
                    break;
            }
        }
    }
});


window.addEventListener('beforeunload', (event) => {
    ws.close()
});
