import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { sites } from "./sites.js";
import defaultModelUrl from "../assets/3d-logo.glb?url";

const canvas = document.querySelector("#scene-canvas");
const siteList = document.querySelector("#site-list");
const siteSearch = document.querySelector("#site-search");

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
camera.position.set(0, 0, 9.5);

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.setClearColor("#ffffff", 0);

const ambientLight = new THREE.AmbientLight(0xffffff, 1.45);
const keyLight = new THREE.DirectionalLight(0xffffff, 2.2);
keyLight.position.set(3.5, 2.5, 6);
const fillLight = new THREE.DirectionalLight(0xffd7d7, 0.9);
fillLight.position.set(-2.5, -1, 2.5);
scene.add(ambientLight, keyLight, fillLight);

const pivot = new THREE.Group();
scene.add(pivot);

const loader = new GLTFLoader();
const clock = new THREE.Clock();

let modelRoot = null;
let loadingToken = 0;
let scrollBoost = 0;
const baseSpinSpeed = 0.55;
const modelColor = new THREE.Color("#b01217");
const defaultModel = "3d-logo.glb";

function formatUrl(url) {
  return url.trim().replace(/^https?:\/\//i, "");
}

function disposeObject(object) {
  object.traverse((child) => {
    if (!child.isMesh) {
      return;
    }

    child.geometry?.dispose();

    const materials = Array.isArray(child.material) ? child.material : [child.material];
    materials.forEach((mat) => mat?.dispose());
  });
}

function setModelColor() {
  if (!modelRoot) {
    return;
  }

  modelRoot.traverse((child) => {
    if (!child.isMesh) {
      return;
    }

    child.material = new THREE.MeshStandardMaterial({
      color: modelColor,
      emissive: modelColor,
      emissiveIntensity: 0.08,
      metalness: 0.1,
      roughness: 0.34
    });
  });
}

function centerAndScaleModel(root) {
  const bounds = new THREE.Box3().setFromObject(root);
  const size = bounds.getSize(new THREE.Vector3());
  const maxAxis = Math.max(size.x, size.y, size.z) || 1;

  const targetSize = 4.15;
  const scale = targetSize / maxAxis;
  root.scale.setScalar(scale);

  const scaledBounds = new THREE.Box3().setFromObject(root);
  const scaledCenter = scaledBounds.getCenter(new THREE.Vector3());
  root.position.sub(scaledCenter);

  root.rotation.set(0, 0, 0);
}

function loadModel(fileName) {
  const token = ++loadingToken;

  loader.load(
    defaultModelUrl,
    (gltf) => {
      if (token !== loadingToken) {
        return;
      }

      if (modelRoot) {
        pivot.remove(modelRoot);
        disposeObject(modelRoot);
      }

      modelRoot = gltf.scene;
      centerAndScaleModel(modelRoot);
      pivot.add(modelRoot);
      setModelColor();
    },
    undefined,
    (error) => {
      console.error(`Could not load ${fileName}`, error);
    }
  );
}

function renderSites(filteredSites = sites) {
  const markup = filteredSites.map((site) => {
    const name = site.name.trim();
    const campus = site.campus.trim();
    const year = site.year.trim();
    const website = site.website.trim();
    const displayUrl = formatUrl(website);

    return `
      <li class="site-row">
        <span class="site-name">${name}</span>
        <span class="site-campus">${campus}</span>
        <span class="site-year">${year}</span>
        <a class="site-url-link" href="${website}" target="_blank" rel="noreferrer">${displayUrl}</a>
      </li>
    `;
  }).join("");

  siteList.innerHTML = markup || "<li class=\"site-empty\">No matching sites.</li>";
}

function configureSearch() {
  siteSearch.addEventListener("input", () => {
    const query = siteSearch.value.trim().toLowerCase();

    if (!query) {
      renderSites(sites);
      return;
    }

    const filtered = sites.filter((site) => {
      const haystack = `${site.name} ${site.campus} ${site.year} ${site.website}`.toLowerCase();
      return haystack.includes(query);
    });

    renderSites(filtered);
  });
}

function resizeRenderer() {
  const width = canvas.clientWidth || 1;
  const height = canvas.clientHeight || 1;
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}

let lastScrollY = window.scrollY;

window.addEventListener("wheel", (event) => {
  const intensity = Math.min(Math.abs(event.deltaY), 250);
  scrollBoost = Math.min(scrollBoost + intensity * 0.0035, 8);
}, { passive: true });

window.addEventListener("scroll", () => {
  const delta = Math.abs(window.scrollY - lastScrollY);
  lastScrollY = window.scrollY;
  scrollBoost = Math.min(scrollBoost + delta * 0.012, 8);
}, { passive: true });

window.addEventListener("resize", () => {
  resizeRenderer();
});

function tick() {
  const dt = clock.getDelta();

  scrollBoost *= Math.exp(-2.1 * dt);
  const spinSpeed = baseSpinSpeed + scrollBoost;

  // Lock rotations
  pivot.rotation.x = 0;
  pivot.rotation.z = 0;
  pivot.rotation.y += spinSpeed * dt;

  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}

resizeRenderer();
renderSites();
configureSearch();
loadModel(defaultModel);
tick();
