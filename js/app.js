import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const container = document.getElementById('renderer');
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0b1020);

const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 2000);
camera.position.set(0, 0, 2.5);

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NoToneMapping;
renderer.toneMappingExposure = 1.0;
container.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.target.set(0, 0, 0); // Always rotate around globe center
controls.enablePan = false;

// Uniform illumination: bright ambient only
scene.add(new THREE.AmbientLight(0xffffff, 1.0));

const R = 1;
const loader = new THREE.TextureLoader();

// Available textures from assets folder
const availableTextures = [
	'earth_vegitation.jpg',
	'earth_temperature.png',
	'earth_temperature_descrete.png',
	'earth_pollution.png',
	'earth_precipitation.png',
	'pollution_combined.png',
	'precipitation_combined.png'
];

// Load initial texture (earth_vegetation.jpg)
let currentTexture = loader.load('assets/earth_vegitation.jpg');
currentTexture.colorSpace = THREE.SRGBColorSpace;

const globeMaterial = new THREE.MeshBasicMaterial({ map: currentTexture });
const globe = new THREE.Mesh(
	new THREE.SphereGeometry(R, 128, 128),
	globeMaterial
);
scene.add(globe);

// Function to switch texture
function switchTexture(textureFilename) {
	const newTexture = loader.load(`assets/${textureFilename}`);
	newTexture.colorSpace = THREE.SRGBColorSpace;
	
	// Update the material's map
	globeMaterial.map = newTexture;
	globeMaterial.needsUpdate = true;
	
	// Dispose of the old texture to free memory
	if (currentTexture !== newTexture) {
		currentTexture.dispose();
	}
	currentTexture = newTexture;
}

let gratLines = new THREE.Group();
scene.add(gratLines);
function buildGraticule() {
	gratLines.clear();
	const material = new THREE.LineBasicMaterial({ color: 0x88ccff, transparent: true, opacity: 0.3 });
	const deg2rad = Math.PI / 180;
	for (let lat = -75; lat <= 75; lat += 15) {
		const pts = [];
		for (let lon = -180; lon <= 180; lon += 1) {
			const la = lat * deg2rad, lo = lon * deg2rad;
			const x = R * Math.cos(la) * Math.cos(lo);
			const y = R * Math.sin(la);
			const z = R * Math.cos(la) * Math.sin(lo);
			pts.push(new THREE.Vector3(x, y, z));
		}
		const geo = new THREE.BufferGeometry().setFromPoints(pts);
		gratLines.add(new THREE.Line(geo, material));
	}
	for (let lon = -180; lon < 180; lon += 15) {
		const pts = [];
		for (let lat = -89.5; lat <= 89.5; lat += 1) {
			const la = lat * deg2rad, lo = lon * deg2rad;
			const x = R * Math.cos(la) * Math.cos(lo);
			const y = R * Math.sin(la);
			const z = R * Math.cos(la) * Math.sin(lo);
			pts.push(new THREE.Vector3(x, y, z));
		}
		const geo = new THREE.BufferGeometry().setFromPoints(pts);
		gratLines.add(new THREE.Line(geo, material));
	}
}
buildGraticule();

let pointsObj = null;
const MAX_POINTS = 1_200_000;

function estimateCounts(stepDeg) {
	const latCount = Math.floor(180 / stepDeg) + 1;
	const lonCount = Math.floor(360 / stepDeg);
	const total = latCount * lonCount;
	return { latCount, lonCount, total };
}

function generateGrid(stepDeg) {
	if (pointsObj) { scene.remove(pointsObj); pointsObj.geometry.dispose(); pointsObj.material.dispose(); pointsObj = null; }
	const { latCount, lonCount, total } = estimateCounts(stepDeg);
	let skip = 1; let used = total;
	if (total > MAX_POINTS) { skip = Math.ceil(total / MAX_POINTS); used = Math.ceil(total / skip); }
	const positions = new Float32Array(used * 3);
	const deg2rad = Math.PI / 180;
	let i = 0; let count = 0;
	for (let li = 0; li < latCount; li++) {
		const lat = -90 + li * stepDeg; const la = lat * deg2rad; const cla = Math.cos(la); const sla = Math.sin(la);
		for (let lj = 0; lj < lonCount; lj++) {
			const idx = li * lonCount + lj; if (idx % skip !== 0) continue;
			const lon = -180 + lj * stepDeg; const lo = lon * deg2rad;
			const x = (R + 0.002) * cla * Math.cos(lo);
			const y = (R + 0.002) * sla;
			const z = (R + 0.002) * cla * Math.sin(lo);
			positions[i++] = x; positions[i++] = y; positions[i++] = z; count++;
		}
	}
	const geo = new THREE.BufferGeometry();
	geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
	const mat = new THREE.PointsMaterial({ size: 0.004, sizeAttenuation: true, color: 0xffff88, transparent: true, opacity: 0.8 });
	pointsObj = new THREE.Points(geo, mat);
	scene.add(pointsObj);
	document.getElementById('ptCount').textContent = `Points: ${count.toLocaleString()}`;
	const bytes = positions.byteLength;
	document.getElementById('mem').textContent = `Approx VRAM: ${(bytes / (1024*1024)).toFixed(1)} MB`;
}

// UI wiring (bottom toolbar)
const stepSelect = document.getElementById('stepSelect');
const renderBtn = document.getElementById('renderBtn');
const coarseToggle = document.getElementById('coarseToggle');
const gridToggle = document.getElementById('gridToggle');
const zoomInBtn = document.getElementById('zoomIn');
const zoomOutBtn = document.getElementById('zoomOut');
const resetBtn = document.getElementById('reset');

// UI wiring (texture selector)
const textureSelect = document.getElementById('textureSelect');

let currentStepDeg = 3;
let needsRender = false;
function startSpinner() { const s = document.getElementById('spinner'); if (s) s.hidden = false; }
function stopSpinner() { const s = document.getElementById('spinner'); if (s) s.hidden = true; }
function refresh() { startSpinner(); requestAnimationFrame(() => { generateGrid(currentStepDeg); stopSpinner(); }); }

refresh();

if (stepSelect) {
	stepSelect.addEventListener('change', () => {
		currentStepDeg = parseFloat(stepSelect.value);
		needsRender = true;
		if (renderBtn) renderBtn.disabled = false;
	});
}

if (textureSelect) {
	textureSelect.addEventListener('change', () => {
		const selectedTexture = textureSelect.value;
		switchTexture(selectedTexture);
	});
}

if (renderBtn) {
	renderBtn.addEventListener('click', () => {
		refresh();
		renderBtn.disabled = true;
		needsRender = false;
	});
}

if (coarseToggle) coarseToggle.addEventListener('change', () => { gratLines.visible = coarseToggle.checked; });
if (gridToggle) gridToggle.addEventListener('change', () => { if (pointsObj) pointsObj.visible = gridToggle.checked; });

if (zoomInBtn) zoomInBtn.addEventListener('click', () => { 
	const scale = 0.85;
	camera.position.multiplyScalar(scale);
	controls.update();
});
if (zoomOutBtn) zoomOutBtn.addEventListener('click', () => { 
	const scale = 1.18;
	camera.position.multiplyScalar(scale);
	controls.update();
});
if (resetBtn) resetBtn.addEventListener('click', () => { 
	camera.position.set(0, 0, 2.5); 
	controls.target.set(0,0,0); 
	controls.update();
});

// Disable right-click context menu on canvas
container.addEventListener('contextmenu', (e) => e.preventDefault());

function fitGlobe() {
	const h = container.clientHeight;
	const fov = camera.fov * Math.PI / 180;
	const desired = 0.7;
	const dist = (R / Math.sin(fov/2)) / (desired/2);
	camera.position.set(0, 0, dist);
	controls.target.set(0,0,0);
}
function onResize() {
	const w = container.clientWidth; const h = container.clientHeight;
	camera.aspect = w / h; camera.updateProjectionMatrix(); renderer.setSize(w, h);
}
const ro = new ResizeObserver(onResize); ro.observe(container); onResize();



(function animate() { requestAnimationFrame(animate); controls.update(); renderer.render(scene, camera); })();


