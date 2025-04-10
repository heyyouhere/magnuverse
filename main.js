import * as THREE from 'three';

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// Add a simple cube
const geometry = new THREE.BoxGeometry();
const material = new THREE.MeshBasicMaterial({ color: 0x00ff00 });


function createPlayer(){
    const cube = new THREE.Mesh(geometry, material);
    scene.add(cube);
    return cube
}

camera.position.z = 5;


let clock = new THREE.Clock();


window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});






const ws = new WebSocket("ws://127.0.0.1:6969/ws");
let my_id = -1;

let player = createPlayer();
ws.addEventListener('open', function (event) {
    console.log(event)
    console.log('WebSocket is connected.');

    function animate() {
            requestAnimationFrame(animate);
            player.rotation.x += 0.01;
            player.rotation.y += 0.01;
            // console.log(clock.getDelta())
            renderer.render(scene, camera);
    }
    animate();
    function handleKeyDown(event) { switch (event.key) {
            case 'w':
            case 'W':
                player.position.add(new THREE.Vector3(0,1,0));
                ws.send("move_up")
                break;
            case 'a':
            case 'A':
                player.position.add(new THREE.Vector3(-1,0,0));
                ws.send("move_left")
                break;
            case 's':
            case 'S':
                player.position.add(new THREE.Vector3(0,-1,0));
                ws.send("move_back")
                break;
            case 'd':
            case 'D':
                player.position.add(new THREE.Vector3(1,0,0));
                ws.send("move_right")
                break;
        }
    }
    window.addEventListener('keydown', handleKeyDown);
});

ws.addEventListener('message', function (event) {
    console.log("id: ", event.data)
    if (toString(event.data).startsWith("welcome")){
        player = createPlayer();
    }
});
