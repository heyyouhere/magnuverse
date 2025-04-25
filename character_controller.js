import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import * as greachabuf from 'grechabuf'
import nipplejs from 'nipplejs';



const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
document.getElementById('game_canvas').appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement );
controls.enableZoom = false; // Set to false if you want to disable zoom
controls.enablePan = false; // Set to false if you want to disable panning
// controls.enableRotate = false;
controls.screenSpacePanning = false; // Disable panning in screen space
controls.maxPolarAngle = Math.PI / 2; // Limit vertical rotation
controls.minPolarAngle = 0; // Limit vertical rotation


const ambientLight = new THREE.AmbientLight(0xFFFFFF); // Soft white light
scene.add(ambientLight);


const light = new THREE.HemisphereLight();
scene.add(light);

scene.fog = new THREE.Fog( 0xCCCCCC, 10, 50 );
scene.background = new THREE.Color(0x9873FE);

let floor = new THREE.Mesh(
    new THREE.PlaneGeometry(1000,1000),
    new THREE.MeshStandardMaterial({color : 0xBAF22D, side : THREE.DoubleSide})
)
floor.receiveShadow = true;
floor.rotation.x = Math.PI/2
scene.add(floor)


const players = new Map();

const WSMessageType = Object.freeze({
    PLAYER_WELCOME: 0,
    PLAYER_JOIN: 1,
    PLAYER_LEFT: 2,
    PLAYER_MOVE: 3,
});
const moveMessageStruct = greachabuf.createStruct({
    msgType : greachabuf.u8(),
    id : greachabuf.u32(),
    moving : greachabuf.bool(),
    direction : greachabuf.array(
        greachabuf.f32(),
        greachabuf.f32(),
        greachabuf.f32(),
    ),
})
let gridHelper = new THREE.GridHelper( 40, 40 );
scene.add(gridHelper);


function onProgress(p){
    console.log(Math.floor(p.loaded/ p.total) * 100 + "%")
}

function loadModel(url) {
    return new Promise((resolve, reject) => {
        const loader = new GLTFLoader();
        loader.load(url, (gltf) => {
                resolve(gltf);
            },
            onProgress,
            (error) => {
                console.error('An error happened:', error);
                reject(error);
            }
        );
    });
}

let robot_glb = await loadModel('./models/walking.glb')
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
    sprite.scale.set(2, 1, 2);

    return sprite;
}


class Player{
    constructor(glb, ws, text='test', isPlayer=false ) {
        this.id = null
        this.ws = ws
        this.isPlayer = isPlayer
        this.scene = SkeletonUtils.clone(glb.scene); // https://discourse.threejs.org/t/how-to-clone-a-gltf/78858/4
        this.scene.castShadows = true;
        this.mixer = new THREE.AnimationMixer(this.scene)
        this.idleAction = this.mixer.clipAction(
            robot_glb.animations.find(clip => clip.name == 'Idle')
        )
        this.walkAction = this.mixer.clipAction(
            robot_glb.animations.find(clip => clip.name == 'Walk')
        )
        this.isWalking = false
        this.speed = 0.03
        this.lastTrack = this.lastTrack
        this.currentTrack = 'Idle'
        this.direction = new THREE.Vector3(0,0,1);
        this.sprite = createTextSprite(text)
        this.sprite.position.set(0, 1.5, 0)
        this.scene.add(this.sprite)
        this.prevKeypressed = new Set()
        this.keypressed = new Set()
    }

    playWalk(){
        this.idleAction.fadeOut(0.1);
        this.walkAction.reset().fadeIn(0.1);
        this.walkAction.play();
    }

    playIdle(){
        this.walkAction.fadeOut(0.1);
        this.idleAction.reset().fadeIn(0.1);
        this.idleAction.play();
    }

    handleMovement(){
        temp = new THREE.Vector3().copy(this.scene.position)
        temp.sub(camera.position)
        temp.y = 0;
        if (this.keypressed.has('w') || this.keypressed.has('ц')){
            temp.normalize();
            this.direction = new THREE.Vector3().copy(this.direction).add(temp)
            this.isWalking = true
        }
        if (this.keypressed.has('s') || this.keypressed.has('ы')){
            this.direction = new THREE.Vector3().copy(this.direction).add(temp.multiplyScalar(-1))
            this.isWalking = true
        }

        if (this.keypressed.has('a') || this.keypressed.has('ф')){
            temp = new THREE.Vector3(-temp.z, 0, temp.x).multiplyScalar(-1)
            if (this.keypressed.has('s')){
                temp.multiplyScalar(-1)
            }
            this.direction = new THREE.Vector3().copy(this.direction).add(temp)
            this.isWalking = true
        }

        if (this.keypressed.has('d') || this.keypressed.has('в')){
            temp = new THREE.Vector3(temp.z, 0, -temp.x).multiplyScalar(-1);
            if (this.keypressed.has('s')){
                temp.multiplyScalar(-1)
            }
            this.direction = new THREE.Vector3().copy(this.direction).add(temp)
            this.isWalking = true
        }

        if (this.isWalking){
            this.direction.normalize()
            this.scene.position.add(this.direction.multiplyScalar(this.speed));
            if (this.isPlayer){
                camera.position.x += this.direction.x
                camera.position.z += this.direction.z
                controls.target = new THREE.Vector3().copy(this.scene.position).add(new THREE.Vector3(0, 1, 0))
            }
            this.currentTrack = 'Walk'
        } else {
            this.currentTrack = 'Idle'
        }
        if (this.lastTrack !== this.currentTrack){
            if (this.currentTrack == 'Idle'){
                this.playIdle()
            }
            if (this.currentTrack == 'Walk'){
                this.playWalk()
            }
            this.lastTrack = this.currentTrack
        }

        this.scene.lookAt(new THREE.Vector3(this.scene.position.x + this.direction.x, 0, this.scene.position.z + this.direction.z))
    }

    sendUpdate(){
        const currentKeys = Array.from(this.keypressed);
        const previousKeys = Array.from(this.prevKeypressed);

        const keyStateChanged = currentKeys.length !== previousKeys.length ||
            currentKeys.some(key => !previousKeys.includes(key)) ||
            previousKeys.some(key => !currentKeys.includes(key));


        let payload = moveMessageStruct.serialize({
            msgType : WSMessageType.PLAYER_MOVE,
            id : this.id,
            moving: this.isWalking,
            direction : [this.direction.x, this.direction.y, this.direction.z],
        })

        if (keyStateChanged) {
            this.prevKeypressed = new Set(this.keypressed); // Update previous keys
            // let directionBytes = new Float32Array([...this.direction]).buffer
            // console.log(directionBytes, payload)
            if (this.ws){
                this.ws.send(payload)
            }
        }
        // return [currentKeys, this.direction]
        return payload
    }


/**
 * @param {DataView} payload
 */
    applyUpdate(payload){
        let update = moveMessageStruct.deserialize(payload)
        console.log(update)
        this.isWalking = update.moving
        if (this.isWalking){
            this.direction = new THREE.Vector3(...update.direction)
        } else {
            this.direction = new THREE.Vector3()
        }
    }

    update(){
        if (this.isWalking){
            this.scene.lookAt(new THREE.Vector3(this.scene.position.x + this.direction.x, 0, this.scene.position.z + this.direction.z))
            this.direction.normalize()
            this.scene.position.add(this.direction.multiplyScalar(this.speed));
            this.currentTrack = 'Walk'
        } else {
            this.currentTrack = 'Idle'
        }
        if (this.lastTrack !== this.currentTrack){
            if (this.currentTrack == 'Idle'){
                this.playIdle()
            }
            if (this.currentTrack == 'Walk'){
                this.playWalk()
            }
            this.lastTrack = this.currentTrack
        }
    }


}


let player = new Player(robot_glb, null,  "Player", true)
scene.add(player.scene)

let player2 = new Player(robot_glb, null, "Dummy")
player2.scene.position.add(new THREE.Vector3(-2, 0, -2))
scene.add(player2.scene)
player2.playIdle()



window.onkeydown = (event) => {
    player.keypressed.add(event.key.toLowerCase())
}
window.onkeyup = (event) => {
    player.keypressed.delete(event.key.toLowerCase())
    player.isWalking = false
}


const directions = {
    'up':    'w',
    'right': 'd',
    'left':  'a',
    'down':  's',
}

if (/Mobi|Android/i.test(navigator.userAgent)){
// if (true){
    const zone_el =  document.getElementById("joystick_container");
    zone_el.hidden = false;
    var options = {
        zone: zone_el,                   // active zone
        color: "#171717FF",
        size: 400,
        // threshold: 0.1,               // before triggering a directional event
        // fadeTime: Integer,              // transition time
        multitouch: false,
        // maxNumberOfNipples: 2,     // when multitouch, what is too many?
        dataOnly: false,              // no dom element whatsoever
        position: {left : "50%", top: "50%"},               // preset position for 'static' mode
        mode: 'static',                   // 'dynamic', 'static' or 'semi'
        // restJoystick: Boolean|Object,   // Re-center joystick on rest state
        // restOpacity: Number,            // opacity when not 'dynamic' and rested
        // lockX: Boolean,                 // only move on the X axis
        // lockY: Boolean,                 // only move on the Y axis
        // catchDistance: Number,          // distance to recycle previous joystick in
        //                                 // 'semi' mode
        shape: "circle",                  // 'circle' or 'square'
        dynamicPage: false,           // Enable if the page has dynamically visible elements
        follow: false,                // Makes the joystick follow the thumbstick
    };

    var nipple = nipplejs.create(options);
    let prev_dir = null;
    nipple.on('dir', (_, data) => {
        console.log(data)
        if (prev_dir != directions[data.direction.angle]){
            player.keypressed.delete(prev_dir)
            player.keypressed.add(directions[data.direction.angle])
            prev_dir = directions[data.direction.angle]
        }
    }).on('end', () => {
        player.keypressed.delete(prev_dir)
        player.isWalking = false
    })
}

let temp = new THREE.Vector3();
player.playIdle()
camera.position.y = 2
camera.position.z = 4
controls.target = new THREE.Vector3().copy(player.scene.position).add(new THREE.Vector3(0, 1, 0))

let clock = new THREE.Clock();
function animate() {
    // document.getElementById("fps").innerText = Math.floor(1/clock.getDelta()) + 'fps'
    player.handleMovement()
    player.mixer.update(0.01)
    player.sendUpdate()


    players.forEach((p) => {
        p.mixer.update(0.01);
        p.update()
    });

    controls.update()
    renderer.render(scene, camera);
    requestAnimationFrame(animate);
}
animate();

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

console.log(renderer.domElement)
renderer.domElement.addEventListener("blur", function(event) {
    console.log(event)
    console.log("Tab is not focused");
    player.keypressed.clear()
});

const ws = new WebSocket("ws://77.232.23.43:1580/ws");


ws.addEventListener('open', () => {
    player.ws = ws
});

/**
 * @param {ArrayBuffer} arrayBuffer
 */
function parse_ws_message(arrayBuffer){
    let view = new DataView(arrayBuffer)
    switch (view.getUint8()){
        case WSMessageType.PLAYER_WELCOME:
            player.id = view.getUint32(1)
            console.log("Setting my id to:", player.id)
            break
        case WSMessageType.PLAYER_JOIN:
            const joined_id = view.getUint32(1)
            console.log("player joined")
            if (joined_id != player.id){
                let new_player = new Player(robot_glb, null, joined_id)
                players.set(joined_id, new_player);
                scene.add(new_player.scene)
            }
            break
        case WSMessageType.PLAYER_LEFT:
            const left_id = view.getUint32(1)
            console.log("player left", left_id)
            let left_player = players.get(left_id)
            scene.remove(left_player.scene)
            players.delete(left_id)
            break

        case WSMessageType.PLAYER_MOVE:
            const moved_id = view.getUint32(1)
            if (moved_id != player.id){
                let moved_player = players.get(moved_id)
                moved_player.applyUpdate(view)
            }
            break

        default:
            console.log("buffer:", view)
            console.error("unknown command byte:", view.getUint8())
            break

    }

}

ws.addEventListener('message', (event) => {
    const blob = event.data;
    blob.arrayBuffer()
        .then(arrayBuffer => {
            parse_ws_message(arrayBuffer)
        })
        .catch(error => {
            console.error(error);
        });
})
