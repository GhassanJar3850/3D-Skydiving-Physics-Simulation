import * as THREE from "three";

const url = new URLSearchParams(window.location.search);

let parachuteShape = url.get("options");

console.log(parachuteShape);

let deployDrag = null;
if (parachuteShape == "Circular" || parachuteShape == null) {
  deployDrag = 0.78;
  parachuteShape = "parachute.fbx";
} else if (parachuteShape == "Arch") {
  deployDrag = 0.73;
  parachuteShape = "arch parachute.fbx";
}

const Temperature = url.get("Temperature");
const Altitude = url.get("Altitude");
const Mass = url.get("Mass");
const ParachuteCrossSectionalArea = url.get("ParachuteArea");
const Humidity = url.get("Humidity");
const InitialVelocity = url.get("InitialVelocity");
const latitudeValue = url.get("latitude");
const SkydiverCS = url.get("SkydiverCS");

// initialization
export let initial_Humidity_ratio =
  Humidity.length == 0 ? 0 : parseFloat(Humidity) / 100;

export let initial_mass = Mass.length == 0 ? 80 : parseFloat(Mass);

export let initial_Altitude = Altitude.length == 0 ? 1000 : parseFloat(Altitude);
export let initial_velocity =
  InitialVelocity.length == 0 ? 0 : parseFloat(InitialVelocity);
export let latitude =
  latitudeValue.length == 0
    ? Math.PI / 4
    : THREE.MathUtils.degToRad(parseFloat(latitudeValue));
export let temperature = Temperature.length == 0 ? 15 : parseFloat(Temperature);
export let initial_Area_of_the_body_Phase2 =
  ParachuteCrossSectionalArea.length == 0
    ? 1.5
    : parseFloat(ParachuteCrossSectionalArea);
export let initial_Drag_Coefficient_Phase2 = deployDrag;
export let typeOfParachute = parachuteShape;

export let initial_Drag_Coefficient_Phase1 = 0.5;
export let initial_Area_of_the_body_Phase1 = SkydiverCS.length == 0 ? 0.6 : parseFloat(SkydiverCS);


console.log('initial_Humidity_ratio', initial_Humidity_ratio);
console.log('initial_mass',initial_mass);
console.log('initial_Altitude',initial_Altitude);
console.log('initial_velocity',initial_velocity);
console.log('latitude',latitude);
console.log('temperature',temperature);
console.log('initial_Area_of_the_body_Phase2',initial_Area_of_the_body_Phase2);
console.log('initial_Area_of_the_body_Phase1',initial_Area_of_the_body_Phase1);


// Simulation Speed:
export const SimulationSpeed = 0.004; // 0.004 calculation frequency
