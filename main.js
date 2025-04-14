import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const controls = new OrbitControls( camera, renderer.domElement );

const ambientLight = new THREE.AmbientLight(0xFFFFFF); // Soft white light
const sunLight = new THREE.DirectionalLight(0xFFFFFF); // Soft white light
scene.add(ambientLight);
scene.add(sunLight);



let gridHelper = new THREE.GridHelper( 40, 40 );
scene.add( gridHelper );


function createTextSprite(message, color) {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    context.font = '24px Arial';
    context.fillStyle = color;
    const textWidth = context.measureText(message).width;
    context.fillText(message, textWidth, 24);

    const texture = new THREE.Texture(canvas);
    texture.needsUpdate = true;

    const spriteMaterial = new THREE.SpriteMaterial({ map: texture });
    const sprite = new THREE.Sprite(spriteMaterial);
    sprite.scale.set(70, 35, 70);

    return sprite;
}


function loadModel(url) {
    return new Promise((resolve, reject) => {
        const loader = new GLTFLoader();
        loader.load(url, (gltf) => {
                resolve(gltf);
            },
            undefined,
            (error) => {
                console.error('An error happened:', error);
                reject(error);
            }
        );
    });
}




let robot_glb = await loadModel('./flying_robot.glb')
let robot = robot_glb.scene.children[0]




camera.position.z = 10;

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

class Player{
    constructor(id, color, position, model) {
        this.id = id;
        this.color = color;
        this.position = position;
        const material = new THREE.MeshBasicMaterial({ color: color });
        this.model = model.clone();
        this.usernameSprite = createTextSprite(id, 'white');
        this.usernameSprite.position.set(0, 20, 0)
        this.model.add(this.usernameSprite)
        this.model.position.set(position.x, position.y, position.z)
    }
}



const ws = new WebSocket("ws://77.232.23.43:1580/ws");

let player;
ws.addEventListener('open', function (event) {
    console.log('WebSocket is connected.');

});


let players = new Map();


ws.addEventListener('message', function (event) {
    console.log(event.data)
    if (event.data.startsWith("id:")){
        let myId = event.data.split(':')[1]
        document.getElementById("player_id").innerText = myId
        player = new Player(myId, new THREE.Color(255, 0, 0), new THREE.Vector3(), robot);
        player.model.rotation.y = 3.14
        scene.add(player.model)

        function animate() {
            requestAnimationFrame(animate);
            renderer.render(scene, camera);
        }
        animate();

        function handleKeyDown(event) {
            let moveVector = new THREE.Vector3(0,0,0);
            let dir = 'up'
            switch (event.key) {
                case 'w':
                case 'W':
                case 'Ц':
                case 'ц':
                    moveVector = new THREE.Vector3(0,0,1);
                    player.model.rotation.y = 3.14
                    dir = 'up'
                    break
                case 'a':
                case 'A':
                case 'Ф':
                case 'ф':
                    moveVector = new THREE.Vector3(-1,0,0);
                    player.model.rotation.y = 3.14/2
                    dir = 'left'
                    break
                case 's':
                case 'S':
                case 'Ы':
                case 'ы':
                    moveVector = new THREE.Vector3(0,0,-1);
                    dir = 'back'
                    player.model.rotation.y = 0
                    break
                case 'd':
                case 'D':
                case 'В':
                case 'в':
                    moveVector = new THREE.Vector3(1,0,0);
                    player.model.rotation.y = -1 *3.14/2
                    dir = 'right'
                    break
            }
            ws.send(`move:${dir}:${player.id}`)
            player.model.position.add(moveVector);
            camera.position.add(moveVector);
            controls.update()
            controls.target = player.model.position
        }
        window.addEventListener('keydown', handleKeyDown);
    }
    if (event.data.startsWith('player_joined:')){
        let id = event.data.split(':')[1]
        let pos = new THREE.Vector3(parseInt(event.data.split(':')[2]), parseInt(event.data.split(':')[3]), parseInt(event.data.split(':')[4]))
        let new_player = new Player(id, new THREE.Color(0xAAAAAA), pos, robot);
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
        if (movedPlayerId != player.id && moved_player){
            switch (moveDirection) {
                case 'up':
                    moved_player.model.position.add(new THREE.Vector3(0,0,1));
                    moved_player.model.rotation.y = 3.14

                    break;
                case 'left':
                    moved_player.model.position.add(new THREE.Vector3(-1,0,0));
                    moved_player.model.rotation.y = 3.14/2
                    break;
                case 'back':
                    moved_player.model.position.add(new THREE.Vector3(0,0,-1));
                    moved_player.model.rotation.y = 0
                    break;
                case 'right':
                    moved_player.model.position.add(new THREE.Vector3(1,0,0));
                    moved_player.model.rotation.y =  -1 * 3.14/2
                    break;
            }
        }
    }
});


window.addEventListener('beforeunload', () => {
    ws.close()
});
