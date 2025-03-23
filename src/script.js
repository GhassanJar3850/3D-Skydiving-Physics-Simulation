import "./style.css";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";
import "dat.gui";
import * as Constants from "./constants";
import * as Variables from "./variables";

// Variables
var initial_velocity = Variables.initial_velocity;
var interpolationFactor = 0;
var time = 0;
var loadHang = true;
var loadLanding = true;
var loadParachuteDeploy = true;
var tuckedIn = false;
var applyWind = true;

// Controlled
let Humidity_ratio = Variables.initial_Humidity_ratio;
let mass = Variables.initial_mass;
let Altitude = Variables.initial_Altitude;
let Area_of_the_body_Phase1 = Variables.initial_Area_of_the_body_Phase1;
let Drag_Coefficient_Phase1 = Variables.initial_Drag_Coefficient_Phase1;

let current_Area = Variables.initial_Area_of_the_body_Phase1;

let Area_of_the_body_Phase2 = Variables.initial_Area_of_the_body_Phase2;
let Drag_Coefficient_Phase2 = Variables.initial_Drag_Coefficient_Phase2;
let SimulationSpeed = Variables.SimulationSpeed;

// Vectors
let Weight = new THREE.Vector3(0, 0, 0);
let dragForce = new THREE.Vector3(0, 0, 0); // y
let velocity = new THREE.Vector3(0, initial_velocity, 0); //y and possibly x,z
let acceleration = new THREE.Vector3(0, 0, 0); //y and possibly x,z
let coriolisEffectVector = new THREE.Vector3(0, 0, 0);
let windEffectVector = new THREE.Vector3(0, 0, 0);

let is_deployed = false;
let is_dry = false;
let Temperature_sea_level = Variables.temperature; //10

/* /Variables */

/* Functions */

// interpolating the opening of the parachute
function interpolate(start, end, x) {
  // Sigmoid function
  return start + (end - start) * (1 / (1 + Math.exp(-5 * (x - 0.5))));
}

// function interpolateDeflection(height, maxHeight, maxDeflection) {
//   const factor = 1 - height / maxHeight;

//   const interpolatedDeflection = factor * maxDeflection;

//   return interpolatedDeflection;
// }

function get_current_phase_area(interpolationFactor, Ref_Area) {
  if (is_deployed) {
    if (Area_of_the_body_Phase1 < Area_of_the_body_Phase2) {
      current_Area = interpolate(
        Area_of_the_body_Phase1,
        Ref_Area,
        interpolationFactor
      );
    } else {
      current_Area = interpolate(
        Ref_Area,
        Area_of_the_body_Phase1,
        interpolationFactor
      );
    }
    if (tuckedIn) {
      return current_Area - 0.5;
    }
    return current_Area;
  } else {
    return Area_of_the_body_Phase1;
  }
}

function get_current_phase_drag_coeff(interpolationFactor) {
  if (is_deployed) {
    return interpolate(
      Drag_Coefficient_Phase1,
      Drag_Coefficient_Phase2,
      interpolationFactor
    );
  } else {
    return Drag_Coefficient_Phase1;
  }
}

// function toggle_gravity() {
//   if (!gravity_present) {
//     return 0;
//   } else {
//     return Constants.GRAVITY_ACC;
//   }
// }

function calc_airDensity(altitude, phi, temperature_sea_level) {
  const T0 = temperature_sea_level + 273.15; // K
  const L = 0.0065; // Temperature lapse rate K/m
  const P0 = 101325; // Pa
  const Md = 0.0289652; // mol | equation: M=m/n | dry air molar mass
  const Mv = 0.018016; // mol | water vapor molar mass
  const R = 8.31446; // J/(K*mol) |' universal gas constant

  let T = T0 - L * altitude; // K

  let Psat_exponent = (7.5 * T) / (T + 237.3);
  let Psat = 6.1078 * Math.pow(10, Psat_exponent); // hecto-Pa

  let Pv = phi * Psat; // Pa

  let P_exponent = (Constants.GRAVITY_ACC * Md) / (R * L) - 1;
  let P_base = 1 - (L * altitude) / T0;
  let P = P0 * Math.pow(P_base, P_exponent);

  return (P * Md + Pv * (Mv - Md)) / (R * T);
}

function degreesToRadians(degrees) {
  var radians = degrees * (Math.PI / 180);
  return radians;
}

// function coriolis_velocity(time, latitude) {
//   // deflection = 1/3 sqrt(8 * h ^ 3 / g) * w * cos( lambda )

//   // let velocity_eastward =
//   //   4 * Constants.W * altitude * Math.abs(Math.sin(latitude));
//   let velocity_eastward =
//     Constants.W * Constants.GRAVITY_ACC * time ** 2 * Math.cos(latitude);

//   return velocity_eastward;
// }

// Wind Drift

// Constants

const v0 = 10; // sea level wind speed
const H = Altitude; // 1000
const alpha = Constants.alpha_coeff;
const d0 = 0; // initial angle of offset
const dA = 90; // angle of offset

// Wind speed function
function windSpeedAtAltitude(h) {
  return v0 * Math.pow(1 + h / H, alpha);
}

// Wind direction function
function windDirectionAtAltitude(h) {
  return d0 + (h / H) * (dA - d0);
}

// Turbulence function
function applyTurbulence(value, turbulenceFactor) {
  return value + (Math.random() * 2 - 1) * turbulenceFactor;
}

// Vertical wind speed function
function verticalWindSpeed(altitude) {
  return 0.1 * windSpeedAtAltitude(altitude);
}

let random_angle = Math.random() * (Math.PI / 2);

// Get wind drift vector
function getWindDriftVector(altitude) {
  // Get wind speeds
  let windSpeed = applyTurbulence(windSpeedAtAltitude(altitude), 0.1);
  let verticalSpeed = verticalWindSpeed(altitude);
  let windScale = 0.1;

  // Get wind direction and convert to radians
  let windRadians = random_angle;

  // Calculate vector components
  let x = windSpeed * Math.cos(windRadians) * windScale;
  let y = verticalSpeed * windScale;
  let z = windSpeed * Math.sin(windRadians) * windScale;

  // Create and return Vector3
  return new THREE.Vector3(x, y, z);
}

/////////////////////////////////////////////////////////////////////

const getElement = document.querySelector(".DataPanel");
const getShow = document.querySelector(".Circle");

getShow.addEventListener("click", function () {
  if (getElement.classList.contains("show")) {
    getElement.classList.add("remove");
    getElement.classList.remove("show");
  } else {
    getElement.classList.add("show");
    getElement.classList.remove("remove");
  }
});
// Cursor:
const cursor = {
  x: 0,
  y: 0,
};
// Sizes:
const sizes = {
  width: window.innerWidth,
  height: window.innerHeight,
};

window.addEventListener("mousemove", (event) => {
  cursor.x = event.clientX / sizes.width - 0.5;
  cursor.y = -(event.clientY / sizes.height - 0.5);
});

// Canvas:
const canvas = document.querySelector("canvas.webgl");

// Scene:
const scene = new THREE.Scene();

// Axes Helper:
const helper = new THREE.AxesHelper(18);
scene.add(helper);

// SkyBox:
const skyTexture = new THREE.CubeTextureLoader().load([
  "/Standard-Cube-Map/nz.png",
  "/Standard-Cube-Map/pz.png",
  "/Standard-Cube-Map/py.png",
  "/Standard-Cube-Map/ny.png",
  "/Standard-Cube-Map/px.png",
  "/Standard-Cube-Map/nx.png",
]);

const shader = THREE.ShaderLib["cube"];
shader.uniforms["tCube"].value = skyTexture;

const skyBoxMaterial = new THREE.ShaderMaterial({
  fragmentShader: shader.fragmentShader,
  vertexShader: shader.vertexShader,
  uniforms: shader.uniforms,
  depthWrite: false,
  side: THREE.BackSide,
  precision: "highp",
});

const skyBoxGeometry = new THREE.BoxGeometry(100000, 100000, 200000);
const skyBox = new THREE.Mesh(skyBoxGeometry, skyBoxMaterial);
skyBox.rotation.y = Math.PI / 2;
scene.add(skyBox);

// Skydiver Model
var parachuteAnimationAction;
var model = new THREE.Group();
var parachute_model = new THREE.Group();
var model_loaded = false;
var parachute_translation_factor_y = 11.2;
var parachute_translation_factor_z = 2;

class LoadModel {
  constructor() {
    this._Initialize();
  }

  _Initialize() {
    this._mixers = [];
    this._previousRAF = null;

    this._LoadAnimatedModel();
    this._RAF();
  }

  _LoadAnimatedModel() {
    var delta = clock.getDelta();
    const loaderParachute = new FBXLoader();
    const loaderJump = new FBXLoader();
    const loaderHelicopter = new GLTFLoader();
    loaderParachute.setPath("models/");
    loaderHelicopter.setPath("models/");
    loaderJump.setPath("models/");

    loaderHelicopter.load("bell_huey_helicopter.glb", (glb) => {
      let helicopter = glb.scene;
      helicopter.position.y = Altitude;
      helicopter.scale.set(15, 15, 15);
      helicopter.rotateY(Math.PI / 2);
      helicopter.translateX(18);
      helicopter.translateY(12);
      helicopter.translateZ(-12);
      const m = new THREE.AnimationMixer(helicopter);
      this._mixers.push(m);
      m.clipAction(glb.animations[0]).play();
      m.update(delta);

      scene.add(helicopter);
    });

    loaderParachute.load(Variables.typeOfParachute, (fbx) => {
      fbx.scale.setScalar(0.1);
      fbx.rotateX(degreesToRadians(85));
      fbx.traverse((c) => {
        c.castShadow = true;
      });

      const m = new THREE.AnimationMixer(fbx);
      this._mixers.push(m);
      parachuteAnimationAction = m.clipAction(fbx.animations[0]);
      parachuteAnimationAction.timeScale = 0;
      parachuteAnimationAction.play();
      m.update(delta);

      parachute_model = fbx;
      scene.add(parachute_model);
    });

    loaderJump.load(
      "skydiver.fbx",
      (fbx) => {
        fbx.scale.setScalar(0.1);
        const anim = new FBXLoader();
        anim.setPath("models/");
        anim.load("fallingAnim.fbx", (anim) => {
          const m = new THREE.AnimationMixer(fbx);
          this._mixers.push(m);
          const falling = m.clipAction(anim.animations[0]);
          m.update(delta);
          falling.timeScale = 1.5;
          falling.play();
        });

        model = fbx;
        scene.add(model);
      },
      (progress) => {
        if (progress.loaded == progress.total) {
          setTimeout(() => {
            model_loaded = true;
          }, 1000);
        }
      }
    );
  }

  _RAF() {
    requestAnimationFrame((interpolationFactor) => {
      if (this._previousRAF === null) {
        this._previousRAF = interpolationFactor;
      }

      if (is_deployed && loadHang) {
        const anim = new FBXLoader();
        anim.setPath("models/");
        anim.load("HangingIdle.fbx", (anim) => {
          const m = new THREE.AnimationMixer(model);
          this._mixers.push(m);
          const idle = m.clipAction(anim.animations[0]);
          idle.play();
        });
        loadHang = false;
      }

      if (skydiver.position.y == 0 && loadLanding) {
        is_deployed = false;
        parachute_model.scale.set(0, 0, 0);
        const anim = new FBXLoader();
        anim.setPath("models/");
        anim.load("Falling To Roll.fbx", (anim) => {
          const m = new THREE.AnimationMixer(model);
          this._mixers.push(m);
          const idle = m.clipAction(anim.animations[0]);
          idle.play();
        });

        var self = this;
        setTimeout(() => {
          anim.load("Idle.fbx", (anim) => {
            const m = new THREE.AnimationMixer(model);
            self._mixers.push(m);
            const idle = m.clipAction(anim.animations[0]);
            idle.play();
            skydiver.position.z += 30;
          });
        }, 1774);

        loadLanding = false;
      }

      if (is_deployed && loadParachuteDeploy) {
        parachute_model.rotateX(degreesToRadians(-85));
        parachute_translation_factor_y += 3.5;
        parachute_translation_factor_z = 0.3;

        parachuteAnimationAction.timeScale = 1;
        parachuteAnimationAction.setLoop(THREE.LoopOnce);
        parachuteAnimationAction.play();

        loadParachuteDeploy = false;
      }

      model.castShadow = true;
      model.receiveShadow = true;
      model.position.copy(skydiver.position);
      parachute_model.position.set(
        skydiver.position.x,
        skydiver.position.y + parachute_translation_factor_y,
        skydiver.position.z + parachute_translation_factor_z
      );

      this._RAF();
      this._Step(interpolationFactor - this._previousRAF);
      this._previousRAF = interpolationFactor;
    });
  }

  _Step(timeElapsed) {
    const timeElapsedS = timeElapsed * 0.001;
    if (this._mixers) {
      this._mixers.map((m) => m.update(timeElapsedS));
    }
  }
}

// Lighting
{
  let light = new THREE.DirectionalLight(0xffffff, 1);
  light.position.set(0.2, 1, 0.4);
  light.target.position.set(0, 0, 0);

  light.castShadow = true;
  light.shadow.bias = -0.001;

  light.shadow.mapSize.width = 2048;
  light.shadow.mapSize.height = 2048;

  light.shadow.camera.near = 0.1;
  light.shadow.camera.far = 1000.0;

  const shadowAmount = 100;

  light.shadow.camera.left = shadowAmount;
  light.shadow.camera.right = -shadowAmount;
  light.shadow.camera.top = shadowAmount;
  light.shadow.camera.bottom = -shadowAmount;
  scene.add(light);

  let Ambientlight = new THREE.AmbientLight(0xffffff, 0.2);
  scene.add(Ambientlight);
}

const earthRadius = 637813.7;
const land = new THREE.SphereGeometry(earthRadius, 1000, 1000);
var textureLoader = new THREE.TextureLoader();
var texture = textureLoader.load("texture/ny1.png", function (loadedTexture) {
  loadedTexture.wrapS = THREE.RepeatWrapping;
  loadedTexture.wrapT = THREE.RepeatWrapping;
  loadedTexture.repeat.set(2000, 2000); // Adjust the repeat values to control the texture repetition
});
const landMaterial = new THREE.MeshBasicMaterial({ map: texture });
const earth = new THREE.Mesh(land, landMaterial);
earth.position.y = -earthRadius;
earth.receiveShadow = true;
earth.castShadow = false;
scene.add(earth);

const skydiverGeometry = new THREE.BoxGeometry(1, 1, 1);
const skydiverMaterial = new THREE.MeshBasicMaterial({
  transparent: true,
  wireframe: true,
  opacity: 0,
});
const skydiver = new THREE.Mesh(skydiverGeometry, skydiverMaterial);
skydiver.position.y = Altitude;
scene.add(skydiver);

// Camera:
const camera = new THREE.PerspectiveCamera(
  75,
  sizes.width / sizes.height,
  0.1,
  1000000
);

camera.position.set(
  skydiver.position.x + 100,
  skydiver.position.y + 1,
  skydiver.position.z - 100
);
skyBox.position.set(camera.position.x, camera.position.y, camera.position.z);

window.addEventListener("resize", () => {
  sizes.width = window.innerWidth;
  sizes.height = window.innerHeight;

  camera.aspect = sizes.width / sizes.height;
  camera.updateProjectionMatrix();

  renderer.setSize(sizes.width, sizes.height);

  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
});

window.addEventListener("dblclick", () => {
  if (!document.fullscreenElement) {
    canvas.requestFullscreen();
  } else {
    document.exitFullscreen();
  }
});

// Renderer:
const renderer = new THREE.WebGLRenderer({
  canvas: canvas,
  antialias: true,
  precision: "highp",
  localClippingEnabled: false,
  powerPreference: "high-performance",
});
renderer.setSize(sizes.width, sizes.height);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

//control:
const controlsOrbit = new OrbitControls(camera, canvas);
controlsOrbit.enableDamping = true;
controlsOrbit.maxDistance = 80;
controlsOrbit.minDistance = 12;
controlsOrbit.target.setX(skydiver.position.x);
controlsOrbit.target.setY(skydiver.position.y);
controlsOrbit.target.setZ(skydiver.position.z);

const direction = new THREE.Vector3();

// Set up the keyboard event handlers:
document.addEventListener("keydown", (event) => {
  switch (event.code) {
    case "ArrowUp":
      direction.z = -1;
      break;
    case "ArrowLeft":
      direction.x = -1;
      break;
    case "ArrowDown":
      direction.z = 1;
      break;
    case "ArrowRight":
      direction.x = 1;
      break;
    case "KeyQ":
      direction.y = -1;
      if (is_deployed) {
        parachute_model.scale.setScalar(0.08);
        tuckedIn = true;
      }
      break;
    case "KeyE":
      direction.y = 1;
      break;
    case "KeyT":
      is_deployed = true;
      break;
    case "KeyW":
      break;
    case "KeyH":
      is_dry = !is_dry;
      break;
  }
});

document.addEventListener("keyup", (event) => {
  switch (event.code) {
    case "ArrowUp":
      direction.z = 0;
      break;
    case "ArrowLeft":
      direction.x = 0;
      break;
    case "ArrowDown":
      direction.z = 0;
      break;
    case "ArrowRight":
      direction.x = 0;
      break;
    case "KeyQ":
      if (is_deployed) {
        direction.y = 0;
        parachute_model.scale.setScalar(0.1);
        tuckedIn = false;
      }
      break;
    case "KeyE":
      direction.y = 0;
      break;
    case "KeyW":
      break;
  }
});

// Set up the animation loop:
let prevTime = Date.now();
let coriolisDeflection = 0;
let overallCoriolisDeflection = 0;

if (Constants.GRAVITY_ACC != 0) {
  overallCoriolisDeflection =
    (1 / 3) *
    Math.sqrt((8 * Math.pow(Altitude, 3)) / Constants.GRAVITY_ACC) *
    Constants.W *
    Math.cos(Variables.latitude);
} else {
  overallCoriolisDeflection = 0;
}

Weight.setY(Constants.GRAVITY_ACC * mass);

function calc_WindDrift(windVelocity, height, interpolationFactor) {
  let Wd =
    (1 / (2 * mass * Constants.GRAVITY_ACC)) *
    windVelocity *
    calc_airDensity(Altitude - height, Humidity_ratio, Temperature_sea_level) *
    get_current_phase_drag_coeff(interpolationFactor) *
    get_current_phase_area(interpolationFactor, Area_of_the_body_Phase2) *
    height;

  console.log(Wd);
  return Wd;
}

let mainCamera = controlsOrbit;
let dragForceVector = dragForce;
let weightVector = Weight;

function insideAnimate(loaded) {
  if (loaded) {
    let prevCoordinates = new THREE.Vector3().copy(skydiver.position);

    if (skydiver.position.y > 0) {
      if (Constants.GRAVITY_ACC != 0) {
        coriolisDeflection =
          (1 / 3) *
          Math.sqrt(
            (8 * Math.pow(Math.abs(Altitude - skydiver.position.y), 3)) /
              Constants.GRAVITY_ACC
          ) *
          Constants.W *
          Math.cos(Variables.latitude);
      } else {
        coriolisDeflection = 0;
      }

      // interpolate to the next phase
      if (is_deployed && current_Area < Area_of_the_body_Phase2) {
        interpolationFactor += 0.003;
      }

      let velocity_squared = Math.pow(velocity.y, 2);

      // Drag Force
      dragForce.setY(
        0.5 *
          calc_airDensity(
            skydiver.position.y,
            Humidity_ratio,
            Temperature_sea_level
          ) *
          velocity_squared *
          get_current_phase_drag_coeff(interpolationFactor) *
          get_current_phase_area(interpolationFactor, Area_of_the_body_Phase2)
      );
      console.log(
        "drag coeff: " + get_current_phase_drag_coeff(interpolationFactor)
      );
      console.log(
        "CSA: " +
          get_current_phase_area(interpolationFactor, Area_of_the_body_Phase2)
      );
      // Acceleration
      acceleration.setY((Weight.y - dragForce.y) / mass);

      // Velocity (V)
      velocity.y += acceleration.y * SimulationSpeed;

      // Velocity (H)
      coriolisEffectVector.z = coriolisDeflection;

      let windVector = getWindDriftVector(skydiver.position.y);

      let windeffectX = calc_WindDrift(
        windVector.x,
        skydiver.position.y,
        interpolationFactor
      );
      let windeffectY = calc_WindDrift(
        windVector.y,
        skydiver.position.y,
        interpolationFactor
      );
      let windeffectZ = calc_WindDrift(
        windVector.z,
        skydiver.position.y,
        interpolationFactor
      );

      if (applyWind) {
        windEffectVector.add(
          new THREE.Vector3(
            windeffectX * SimulationSpeed,
            windeffectY * SimulationSpeed,
            windeffectZ * SimulationSpeed
          )
        );
      }
      console.log(windEffectVector);
      // windEffectVector.multiplyScalar(SimulationSpeed);
      velocity.z = coriolisEffectVector.z + windEffectVector.z;
      skydiver.position.x = windEffectVector.x;
      skydiver.position.y -= velocity.y * SimulationSpeed; //+ windEffectVector.y;
      skydiver.position.z = velocity.z;

      document.getElementById("compass").style.transform = `rotate(${
        controlsOrbit.getAzimuthalAngle() + (3 * Math.PI) / 4
      }rad)`;

      let changeVector = new THREE.Vector3();
      camera.position.add(
        changeVector.subVectors(skydiver.position, prevCoordinates)
      );
      camera.lookAt(skydiver.position);
      controlsOrbit.target.setX(skydiver.position.x);
      controlsOrbit.target.setY(skydiver.position.y);
      controlsOrbit.target.setZ(skydiver.position.z);

      // Injecting the Values into the Panel!
      {
        document.getElementById("weight").innerText = Weight.y.toPrecision(4);
        document.getElementById("drag").innerText = dragForce.y.toPrecision(4);
        document.getElementById("acceleration").innerText =
          acceleration.y.toPrecision(4);
        document.getElementById("velocity").innerText =
          velocity.y.toPrecision(4);
        document.getElementById("altitude").innerText =
          skydiver.position.y.toPrecision(5);
        document.getElementById("time").innerText = time.toPrecision(4);
        document.getElementById("deflection").innerText =
          coriolisDeflection.toPrecision(4);
        document.getElementById("air_density").innerText = calc_airDensity(
          skydiver.position.y,
          Humidity_ratio,
          Temperature_sea_level
        ).toPrecision(4);
        document.getElementById("wind_draft").innerText =
          "x = " +
          windEffectVector.x.toPrecision(2) +
          "\nz = " +
          windEffectVector.z.toPrecision(2);
        document.getElementById("Cross-Sectional_Area").innerText =
          get_current_phase_area(
            interpolationFactor,
            Area_of_the_body_Phase2
          ).toPrecision(4);
      }
      time += SimulationSpeed;
    } else {
      skydiver.position.y = 0;
      document.getElementById("compass").style.transform = `rotate(${
        controlsOrbit.getAzimuthalAngle() + (3 * Math.PI) / 4
      }rad)`;
    }
    controlsOrbit.target.setY(skydiver.position.y + 10);
  }
}

setInterval(() => {
  insideAnimate(model_loaded);
}, 1000 * SimulationSpeed);

const animate = () => {
  requestAnimationFrame(animate);

  const currentTime = Date.now();
  const delta = currentTime - prevTime;
  prevTime = currentTime;

  controlsOrbit.update(delta);

  // clearInterval(timespeed2);

  renderer.render(scene, camera);
};

window.addEventListener("DOMContentLoaded", () => {
  new LoadModel();
  animate();
});

//////////////////////////////////////////////////////////////////////////////////////////////////////

const sceneVecRep = new THREE.Scene();

//Sizes
const sizesVecRep = {
  width: window.innerWidth,
  height: window.innerHeight,
};

//Camera
const cameraVecRep = new THREE.PerspectiveCamera(
  75,
  sizesVecRep.width / sizesVecRep.height
);
cameraVecRep.position.z = 100;
sceneVecRep.add(cameraVecRep);

//Renderer
const canvasVecRep = document.querySelector(".vectorRepresentation");

const rendererVecRep = new THREE.WebGLRenderer({
  canvas: canvasVecRep,
  antialias: true,
  alpha: true,
});
rendererVecRep.setSize(sizesVecRep.width, sizesVecRep.height);
rendererVecRep.render(sceneVecRep, cameraVecRep);

// Controls
const controls = new OrbitControls(cameraVecRep, canvasVecRep);
controls.enableDamping = true;
controls.maxDistance = 2;
controls.minDistance = 2;
controls.enableZoom = false;
// controls.maxPolarAngle = Math.PI / 2;
// controls.minPolarAngle = Math.PI / 2;

//Clock
const clock = new THREE.Clock();

///////////////////////////////////////////////////////////////////////////////////////////////////////////////**

//forces sphere
const compassMaterial = new THREE.MeshBasicMaterial({
  color: 0xffffff,
  wireframe: false,
  transparent: true,
  opacity: 0.05,
});

//compass body
const sgeometry = new THREE.SphereGeometry(2, 16, 16);
const compassBody = new THREE.Mesh(sgeometry, compassMaterial);
compassBody.position.set(0, 0, 0);
sceneVecRep.add(compassBody);

//////////////////////////////////////////////////////////////////////////////////////////////////////////////**

//Intro
const Intro = () => {};

//forces
const driftForce = new THREE.ArrowHelper(
  new THREE.Vector3(0, 0, 0),
  compassBody.position,
  0,
  0xdc2626,
  0,
  20
);
sceneVecRep.add(driftForce);

const weightVecRep = new THREE.ArrowHelper(
  new THREE.Vector3(0, 0, 0),
  compassBody.position,
  0,
  0x4caf50,
  0,
  20
);
sceneVecRep.add(weightVecRep);

const coriolisVecRep = new THREE.ArrowHelper(
  new THREE.Vector3(0, 0, 0),
  compassBody.position,
  0,
  0x008eff,
  0,
  20
);
sceneVecRep.add(coriolisVecRep);

const windVecRep = new THREE.ArrowHelper(
  new THREE.Vector3(0, 0, 0),
  compassBody.position,
  0,
  0xffca28,
  0,
  20
);
sceneVecRep.add(windVecRep);

const tick = () => {
  //time
  const elapsedTime = clock.getElapsedTime();

  // Update controls

  var spherical = new THREE.Spherical();
  spherical.radius = mainCamera.getDistance();
  spherical.phi = mainCamera.getPolarAngle();
  spherical.theta = mainCamera.getAzimuthalAngle();

  // Update the camera position.
  controls.object.position.setFromSpherical(spherical);
  controls.update();

  // Draw Forces

  // Weight
  let lengthWeightTemp = new THREE.Vector3().copy(weightVector);

  let lengthWeight = lengthWeightTemp.multiplyScalar(-1);
  weightVecRep.setDirection(lengthWeight.normalize());
  weightVecRep.setLength(lengthWeight.length());
  sceneVecRep.add(weightVecRep);

  // Drift
  let lengthDrift = new THREE.Vector3().copy(dragForceVector);

  let ratio = lengthDrift.length() / weightVector.y;
  driftForce.setDirection(lengthDrift.normalize());
  driftForce.setLength(ratio);
  sceneVecRep.add(driftForce);

  // Coriolis
  let lengthCoriolis = new THREE.Vector3().copy(coriolisEffectVector);
  let ratio_of_coriolis_to_deflection =
    lengthCoriolis.length() / overallCoriolisDeflection;
  coriolisVecRep.setDirection(lengthCoriolis.normalize());
  coriolisVecRep.setLength(ratio_of_coriolis_to_deflection);
  sceneVecRep.add(coriolisVecRep);

  // Wind
  let lengthWind = new THREE.Vector3().copy(windEffectVector);
  let windDeflection = 5;
  let ratio_of_wind_drift = lengthWind.length() / windDeflection;
  windVecRep.setDirection(lengthWind.normalize());
  windVecRep.setLength(ratio_of_wind_drift);
  sceneVecRep.add(windVecRep);

  //Render
  rendererVecRep.render(sceneVecRep, cameraVecRep);

  window.requestAnimationFrame(tick);
};

tick();
