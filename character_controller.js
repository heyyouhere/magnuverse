import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement );

const ambientLight = new THREE.AmbientLight(0xFFFFFF); // Soft white light
const sunLight = new THREE.DirectionalLight(0xFFFFFF); // Soft white light
scene.add(ambientLight);
scene.add(sunLight);

scene.fog = new THREE.Fog( 0xCCCCCC, 10, 50 );
scene.background = new THREE.Color(0x9873FE);

var floor = new THREE.Mesh(
    new THREE.PlaneGeometry(1000,1000),
    new THREE.MeshBasicMaterial({color : 0xBAF22D, side : THREE.DoubleSide})
)
floor.rotation.x = Math.PI/2
scene.add(floor)

let gridHelper = new THREE.GridHelper( 40, 40 );
scene.add( gridHelper );


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
let robot = robot_glb.scene
scene.add(robot)


let mixer = new THREE.AnimationMixer(robot_glb.scene);
let idle_clip = robot_glb.animations.find(clip => clip.name == 'Idle')
let walk_clip = robot_glb.animations.find(clip => clip.name == 'Walk')

let idleAction = mixer.clipAction(idle_clip)
let walkAction = mixer.clipAction(walk_clip)




function playWalk(){
    console.log('playing walk')
    idleAction.fadeOut(0.1); // Fade out idle
    walkAction.reset().fadeIn(0.1); // Reset and fade in walk
    walkAction.play();
}

function playIdle(){
    console.log('playing idle')
    walkAction.fadeOut(0.1); // Fade out walk
    idleAction.reset().fadeIn(0.1); // Reset and fade in idle
    idleAction.play();
}




const keypressed = {}


window.onkeydown = (event) => {
    keypressed[event.key.toLowerCase()] = true
}
window.onkeyup = (event) => {
    keypressed[event.key.toLowerCase()] = false
    isWalking = false
}

let direction = new THREE.Vector3(0,0,1);
let temp = new THREE.Vector3();
let isWalking = false
const moveDistance = 0.05;

let currentTrack = 'Idle'
let lastTrack = 'Idle'
playIdle()
camera.position.y = 2
camera.position.z = 4
controls.target = new THREE.Vector3().copy(robot.position).add(new THREE.Vector3(0, 1, 0))
function handleMovement(){
    temp = new THREE.Vector3().copy(robot.position)
    temp.sub(camera.position)
    temp.y = 0;
    if (keypressed['w'] || keypressed['ц']){
        temp.normalize();
        direction = new THREE.Vector3().copy(direction).add(temp)
        isWalking = true
    }
    if (keypressed['s'] || keypressed['ы']){
        direction = new THREE.Vector3().copy(direction).add(temp.multiplyScalar(-1))
        isWalking = true
    }

    if (keypressed['a'] || keypressed['ф']){
        temp = new THREE.Vector3(-temp.z, 0, temp.x).multiplyScalar(-1)
        if (keypressed['s']){
            temp.multiplyScalar(-1)
        }
        direction = new THREE.Vector3().copy(direction).add(temp)
        isWalking = true
    }

    if (keypressed['d'] || keypressed['в']){
        temp = new THREE.Vector3(temp.z, 0, -temp.x).multiplyScalar(-1);
        if (keypressed['s']){
            temp.multiplyScalar(-1)
        }
        direction = new THREE.Vector3().copy(direction).add(temp)
        isWalking = true
    }

    if (isWalking){
        direction.normalize()
        robot.position.add(direction.multiplyScalar(moveDistance));
        camera.position.x += direction.x
        camera.position.z += direction.z
        controls.target = new THREE.Vector3().copy(robot.position).add(new THREE.Vector3(0, 1, 0))
        currentTrack = 'Walk'
    } else {
        currentTrack = 'Idle'
    }
    if (lastTrack !== currentTrack){
        if (currentTrack == 'Idle'){
            playIdle()
        }
        if (currentTrack == 'Walk'){
            playWalk()
        }
        lastTrack = currentTrack
    }

    robot.lookAt(new THREE.Vector3(robot.position.x + direction.x, 0, robot.position.z + direction.z))
}


function animate() {
    handleMovement()

    controls.update()
    renderer.render(scene, camera);
    if (mixer) {
        mixer.update(0.01);
    }
    requestAnimationFrame(animate);
}
animate();

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});
