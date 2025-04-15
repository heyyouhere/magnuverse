import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
document.body.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement );

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

let cube = new THREE.Mesh(
    new THREE.BoxGeometry(),
    new THREE.MeshBasicMaterial({color : 0xFFFFFF, side : THREE.DoubleSide})
)

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
    constructor(glb, ws, text= 'test', isPlayer = false ) {
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

        if (keyStateChanged) {
            this.prevKeypressed = new Set(this.keypressed); // Update previous keys
            return [currentKeys, this.direction]
        }
        return null
    }
    applyUpdate(update){
        console.log(update)
        this.keypressed = new Set(update[0])
        if (this.keypressed.has('w') || this.keypressed.has('a') || this.keypressed.has('s') || this.keypressed.has('d')){
            this.direction = update[1]
            this.isWalking = true
        } else {
            this.direction = new THREE.Vector3()
            this.isWalking = false
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


let player = new Player(robot_glb, "Player", true)
scene.add(player.scene)
const ws = new WebSocket("ws://77.232.23.43:1580/ws");


ws.addEventListener('open', () => {
    player.ws = ws
});

ws.addEventListener('message', (event) => {
    console.log(event.data)
})

let player2 = new Player(robot_glb, "Dummy")
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

let temp = new THREE.Vector3();

player.playIdle()
camera.position.y = 2
camera.position.z = 4
controls.target = new THREE.Vector3().copy(player.scene.position).add(new THREE.Vector3(0, 1, 0))

let clock = new THREE.Clock();
function animate() {
    document.getElementById("fps").innerText = Math.floor(1/clock.getDelta()) + 'fps'
    player.handleMovement()
    player2.update()
    let update = player.sendUpdate()
    if (update){
        player2.applyUpdate(update)
    }
    controls.update()
    renderer.render(scene, camera);
    if (player.mixer) {
        player.mixer.update(0.01);
    }
    if (player2.mixer) {
        player2.mixer.update(0.01);
    }
    requestAnimationFrame(animate);
}
animate();

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});
