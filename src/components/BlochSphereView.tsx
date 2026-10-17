import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import {
  QubitState,
  BlochVector,
  GateDefinition,
  InteractionMode,
} from '../quantum/types';
import {
  blochToThreeCoords,
  threeToBlochCoords,
  stateFromVector,
  rotateVectorAroundAxis,
  formatAngle,
} from '../quantum/math';

// Reusable math objects at module scope to avoid GC allocations
const _vec3A = new THREE.Vector3();
const _vec3B = new THREE.Vector3();
const _vec3C = new THREE.Vector3();
const _raycaster = new THREE.Raycaster();
const _pointer = new THREE.Vector2();
const _sphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0), 2.5);
const _plane = new THREE.Plane();

interface BlochSphereViewProps {
  qubitState: QubitState;
  onVectorDrawn: (newState: QubitState) => void;
  animatingGate: {
    gate: GateDefinition;
    startVector: BlochVector;
    targetVector: BlochVector;
    progress: number; // 0 to 1
  } | null;
  interactionMode: InteractionMode;
  onInteractionModeChange: (mode: InteractionMode) => void;
  showProjections: boolean;
  showGridRings: boolean;
  showGateAxis: boolean;
  viewAnglePreset?: 'default' | 'top' | 'front' | 'side' | 'isometric';
}

// Generate high-resolution procedural text sprite for axis labels
function createTextSprite(text: string, color: string, subtext?: string): THREE.Sprite {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Pill background
    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.strokeStyle = color;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.roundRect(16, 16, 224, 96, 24);
    ctx.fill();
    ctx.stroke();

    // Text label
    ctx.font = 'bold 44px "SF Pro Display", system-ui, -apple-system, sans-serif';
    ctx.fillStyle = color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 128, subtext ? 52 : 64);

    if (subtext) {
      ctx.font = '500 22px system-ui, sans-serif';
      ctx.fillStyle = '#94a3b8';
      ctx.fillText(subtext, 128, 88);
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearFilter;
  const spriteMat = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthTest: false,
  });
  const sprite = new THREE.Sprite(spriteMat);
  sprite.scale.set(0.9, 0.45, 1);
  return sprite;
}

export const BlochSphereView: React.FC<BlochSphereViewProps> = ({
  qubitState,
  onVectorDrawn,
  animatingGate,
  interactionMode,
  onInteractionModeChange,
  showProjections,
  showGridRings,
  showGateAxis,
  viewAnglePreset,
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const hasMovedRef = useRef(false);

  // Live drawing angles overlay for tooltip HUD
  const [dragOverlay, setDragOverlay] = useState<{
    active: boolean;
    x: number;
    y: number;
    theta: number;
    phi: number;
  } | null>(null);

  // References to keep updated Three.js scene elements
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);

  // Mesh refs for dynamic updates
  const vectorShaftRef = useRef<THREE.Mesh | null>(null);
  const vectorTipRef = useRef<THREE.Mesh | null>(null);
  const vectorGlowBallRef = useRef<THREE.Mesh | null>(null);
  const projDropLineRef = useRef<THREE.Line | null>(null);
  const projDiskLineRef = useRef<THREE.Line | null>(null);
  const projDiskDotRef = useRef<THREE.Mesh | null>(null);
  const thetaArcLineRef = useRef<THREE.Line | null>(null);
  const phiArcLineRef = useRef<THREE.Line | null>(null);
  const gateAxisLineRef = useRef<THREE.Line | null>(null);
  const gateAxisRingRef = useRef<THREE.Line | null>(null);
  const trajectoryLineRef = useRef<THREE.Line | null>(null);
  const gridRingsGroupRef = useRef<THREE.Group | null>(null);
  const projectionsGroupRef = useRef<THREE.Group | null>(null);

  const SPHERE_RADIUS = 2.5;

  // Initialize Three.js scene
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth;
    const height = container.clientHeight;

    // 1. Scene & Background
    const scene = new THREE.Scene();
    sceneRef.current = scene;
    scene.background = new THREE.Color(0x060913); // Deep cosmic navy
    scene.fog = new THREE.FogExp2(0x060913, 0.045);

    // 2. Camera
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    camera.position.set(4.8, 3.2, 5.8);
    cameraRef.current = camera;

    // 3. Renderer with PBR standard setup
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    rendererRef.current = renderer;
    container.appendChild(renderer.domElement);

    // 4. Studio Environment
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    pmremGenerator.dispose();

    // 5. OrbitControls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.minDistance = 3.2;
    controls.maxDistance = 15;
    controls.target.set(0, 0, 0);
    controls.enabled = interactionMode === 'orbit';
    controlsRef.current = controls;

    // 6. Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    const hemiLight = new THREE.HemisphereLight(0x93c5fd, 0x1e1b4b, 0.7);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0x60a5fa, 1.8);
    keyLight.position.set(6, 8, 5);
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0xec4899, 1.0);
    fillLight.position.set(-6, -4, -5);
    scene.add(fillLight);

    const rimLight = new THREE.PointLight(0x38bdf8, 2.5, 20);
    rimLight.position.set(0, 6, -5);
    scene.add(rimLight);

    // 7. Ground Contact Pedestal & Ambient Glow
    const pedestalGeo = new THREE.CylinderGeometry(3.2, 3.6, 0.15, 64);
    const pedestalMat = new THREE.MeshStandardMaterial({
      color: 0x0b1120,
      roughness: 0.7,
      metalness: 0.3,
    });
    const pedestal = new THREE.Mesh(pedestalGeo, pedestalMat);
    pedestal.position.set(0, -3.2, 0);
    scene.add(pedestal);

    const pedestalRimGeo = new THREE.TorusGeometry(3.2, 0.03, 16, 64);
    const pedestalRimMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.6 });
    const pedestalRim = new THREE.Mesh(pedestalRimGeo, pedestalRimMat);
    pedestalRim.rotation.x = Math.PI / 2;
    pedestalRim.position.set(0, -3.12, 0);
    scene.add(pedestalRim);

    // 8. The Glass Bloch Sphere
    const sphereGeo = new THREE.SphereGeometry(SPHERE_RADIUS, 64, 48);
    const sphereMat = new THREE.MeshPhysicalMaterial({
      color: 0x1e293b,
      transparent: true,
      opacity: 0.18,
      roughness: 0.1,
      metalness: 0.1,
      transmission: 0.85,
      ior: 1.45,
      thickness: 0.8,
      depthWrite: false,
    });
    const sphereMesh = new THREE.Mesh(sphereGeo, sphereMat);
    scene.add(sphereMesh);

    // 9. Grid Rings & Equator Group
    const gridRingsGroup = new THREE.Group();
    gridRingsGroupRef.current = gridRingsGroup;
    scene.add(gridRingsGroup);

    // Equator Ring (Highlighted Cyan)
    const equatorGeo = new THREE.TorusGeometry(SPHERE_RADIUS, 0.018, 16, 100);
    const equatorMat = new THREE.MeshStandardMaterial({
      color: 0x06b6d4,
      emissive: 0x06b6d4,
      emissiveIntensity: 0.6,
      roughness: 0.2,
      metalness: 0.8,
    });
    const equatorMesh = new THREE.Mesh(equatorGeo, equatorMat);
    equatorMesh.rotation.x = Math.PI / 2;
    gridRingsGroup.add(equatorMesh);

    // Subtle equatorial disk with polar grid lines
    const diskGeo = new THREE.CircleGeometry(SPHERE_RADIUS, 64);
    const diskMat = new THREE.MeshBasicMaterial({
      color: 0x0284c7,
      transparent: true,
      opacity: 0.06,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const diskMesh = new THREE.Mesh(diskGeo, diskMat);
    diskMesh.rotation.x = Math.PI / 2;
    gridRingsGroup.add(diskMesh);

    // Meridian X-Z (Meridian 0° / 180°)
    const meridianXZGeo = new THREE.TorusGeometry(SPHERE_RADIUS, 0.008, 16, 100);
    const meridianMat = new THREE.MeshBasicMaterial({
      color: 0x475569,
      transparent: true,
      opacity: 0.45,
    });
    const meridianXZ = new THREE.Mesh(meridianXZGeo, meridianMat);
    gridRingsGroup.add(meridianXZ);

    // Meridian Y-Z (Meridian 90° / 270°)
    const meridianYZGeo = new THREE.TorusGeometry(SPHERE_RADIUS, 0.008, 16, 100);
    const meridianYZ = new THREE.Mesh(meridianYZGeo, meridianMat);
    meridianYZ.rotation.y = Math.PI / 2;
    gridRingsGroup.add(meridianYZ);

    // Latitude Tropics (+45° and -45°)
    const tropicRadius = SPHERE_RADIUS * Math.cos(Math.PI / 4);
    const tropicHeight = SPHERE_RADIUS * Math.sin(Math.PI / 4);
    const tropicMat = new THREE.MeshBasicMaterial({
      color: 0x334155,
      transparent: true,
      opacity: 0.35,
    });

    const northTropic = new THREE.Mesh(
      new THREE.TorusGeometry(tropicRadius, 0.006, 16, 80),
      tropicMat
    );
    northTropic.rotation.x = Math.PI / 2;
    northTropic.position.y = tropicHeight;
    gridRingsGroup.add(northTropic);

    const southTropic = new THREE.Mesh(
      new THREE.TorusGeometry(tropicRadius, 0.006, 16, 80),
      tropicMat
    );
    southTropic.rotation.x = Math.PI / 2;
    southTropic.position.y = -tropicHeight;
    gridRingsGroup.add(southTropic);

    // 10. Coordinate Axes (Bloch: Z is vertical up/down, X is right/left, Y is depth)
    const axesGroup = new THREE.Group();
    scene.add(axesGroup);

    const AXIS_LEN = 3.3;
    const AXIS_RADIUS = 0.02;

    // Helper to create an axis with arrowheads on both ends
    const createAxis = (dir: THREE.Vector3, color: number, emissive: number) => {
      const group = new THREE.Group();
      const geom = new THREE.CylinderGeometry(AXIS_RADIUS, AXIS_RADIUS, AXIS_LEN * 2, 24);
      const mat = new THREE.MeshStandardMaterial({
        color,
        emissive,
        emissiveIntensity: 0.5,
        roughness: 0.3,
        metalness: 0.7,
      });
      const cyl = new THREE.Mesh(geom, mat);

      // Align cylinder with direction vector
      const up = new THREE.Vector3(0, 1, 0);
      cyl.quaternion.setFromUnitVectors(up, dir);
      group.add(cyl);

      // Cone tips at + and -
      const coneGeo = new THREE.ConeGeometry(0.08, 0.22, 24);
      const conePlus = new THREE.Mesh(coneGeo, mat);
      conePlus.position.copy(dir.clone().multiplyScalar(AXIS_LEN));
      conePlus.quaternion.setFromUnitVectors(up, dir);
      group.add(conePlus);

      const coneMinus = new THREE.Mesh(coneGeo, mat);
      coneMinus.position.copy(dir.clone().multiplyScalar(-AXIS_LEN));
      coneMinus.quaternion.setFromUnitVectors(up, dir.clone().negate());
      group.add(coneMinus);

      return group;
    };

    // Z-Axis (Vertical: |0⟩ North, |1⟩ South) -> Sky Blue
    axesGroup.add(createAxis(new THREE.Vector3(0, 1, 0), 0x38bdf8, 0x0284c7));
    // X-Axis (Horizontal: |+⟩ right, |−⟩ left) -> Rose Red
    axesGroup.add(createAxis(new THREE.Vector3(1, 0, 0), 0xf43f5e, 0xbe123c));
    // Y-Axis (Depth: |+i⟩ forward, |−i⟩ backward) -> Emerald Green (Bloch +Y is Three -Z)
    axesGroup.add(createAxis(new THREE.Vector3(0, 0, -1), 0x10b981, 0x047857));

    // Axis Pole Labels
    const label0 = createTextSprite('|0⟩', '#38bdf8', '+Z (North)');
    label0.position.set(0, AXIS_LEN + 0.35, 0);
    scene.add(label0);

    const label1 = createTextSprite('|1⟩', '#38bdf8', '-Z (South)');
    label1.position.set(0, -AXIS_LEN - 0.35, 0);
    scene.add(label1);

    const labelPlus = createTextSprite('|+⟩', '#f43f5e', '+X');
    labelPlus.position.set(AXIS_LEN + 0.35, 0, 0);
    scene.add(labelPlus);

    const labelMinus = createTextSprite('|−⟩', '#f43f5e', '-X');
    labelMinus.position.set(-AXIS_LEN - 0.35, 0, 0);
    scene.add(labelMinus);

    const labelPlusI = createTextSprite('|+i⟩', '#10b981', '+Y');
    labelPlusI.position.set(0, 0, -AXIS_LEN - 0.35);
    scene.add(labelPlusI);

    const labelMinusI = createTextSprite('|−i⟩', '#10b981', '-Y');
    labelMinusI.position.set(0, 0, AXIS_LEN + 0.35);
    scene.add(labelMinusI);

    // 11. State Vector 3D Mesh
    const vectorGroup = new THREE.Group();
    scene.add(vectorGroup);

    // Vector Shaft: Metallic gold cylinder
    const shaftGeo = new THREE.CylinderGeometry(0.045, 0.045, SPHERE_RADIUS, 24);
    // Shift geometry so origin is at base
    shaftGeo.translate(0, SPHERE_RADIUS / 2, 0);
    const shaftMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      emissive: 0xd97706,
      emissiveIntensity: 0.5,
      metalness: 0.9,
      roughness: 0.15,
    });
    const shaft = new THREE.Mesh(shaftGeo, shaftMat);
    vectorShaftRef.current = shaft;
    vectorGroup.add(shaft);

    // Vector Arrow Tip: Sharp cone
    const tipGeo = new THREE.ConeGeometry(0.12, 0.32, 24);
    tipGeo.translate(0, 0.16, 0);
    const tipMat = new THREE.MeshStandardMaterial({
      color: 0xfbbf24,
      emissive: 0xf59e0b,
      emissiveIntensity: 0.7,
      metalness: 0.95,
      roughness: 0.1,
    });
    const tip = new THREE.Mesh(tipGeo, tipMat);
    vectorTipRef.current = tip;
    vectorGroup.add(tip);

    // Glowing tip sphere handle (Interactive target that user can grab)
    const glowBallGeo = new THREE.SphereGeometry(0.15, 24, 24);
    const glowBallMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0xf59e0b,
      emissiveIntensity: 1.2,
      roughness: 0.1,
      metalness: 0.2,
    });
    const glowBall = new THREE.Mesh(glowBallGeo, glowBallMat);
    vectorGlowBallRef.current = glowBall;
    vectorGroup.add(glowBall);

    // 12. Projections and Angle Arcs
    const projectionsGroup = new THREE.Group();
    projectionsGroupRef.current = projectionsGroup;
    scene.add(projectionsGroup);

    // Vertical drop line from vector tip to equator plane (dotted)
    const dropLineMat = new THREE.LineDashedMaterial({
      color: 0x94a3b8,
      dashSize: 0.08,
      gapSize: 0.05,
      transparent: true,
      opacity: 0.75,
    });
    const dropLineGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, 0, 0),
    ]);
    const dropLine = new THREE.Line(dropLineGeo, dropLineMat);
    dropLine.computeLineDistances();
    projDropLineRef.current = dropLine;
    projectionsGroup.add(dropLine);

    // Equatorial projection line from origin to (x, y) on equator
    const diskLineMat = new THREE.LineBasicMaterial({
      color: 0x38bdf8,
      linewidth: 2,
      transparent: true,
      opacity: 0.8,
    });
    const diskLineGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, 0, 0),
    ]);
    const diskLine = new THREE.Line(diskLineGeo, diskLineMat);
    projDiskLineRef.current = diskLine;
    projectionsGroup.add(diskLine);

    // Dot at the equator projection point
    const diskDotGeo = new THREE.SphereGeometry(0.06, 16, 16);
    const diskDotMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
    const diskDot = new THREE.Mesh(diskDotGeo, diskDotMat);
    projDiskDotRef.current = diskDot;
    projectionsGroup.add(diskDot);

    // Theta arc (from +Z down towards the state vector)
    const thetaArcMat = new THREE.LineBasicMaterial({
      color: 0xfbbf24,
      linewidth: 3,
      transparent: true,
      opacity: 0.9,
    });
    const thetaArcGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0)]);
    const thetaArc = new THREE.Line(thetaArcGeo, thetaArcMat);
    thetaArcLineRef.current = thetaArc;
    projectionsGroup.add(thetaArc);

    // Phi arc (from +X around equator towards projection)
    const phiArcMat = new THREE.LineBasicMaterial({
      color: 0x34d399,
      linewidth: 3,
      transparent: true,
      opacity: 0.9,
    });
    const phiArcGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0)]);
    const phiArc = new THREE.Line(phiArcGeo, phiArcMat);
    phiArcLineRef.current = phiArc;
    projectionsGroup.add(phiArc);

    // 13. Gate Rotation Axis Indicator & Trajectory Path
    const gateAxisMat = new THREE.LineDashedMaterial({
      color: 0xa855f7,
      dashSize: 0.1,
      gapSize: 0.08,
      transparent: true,
      opacity: 0.9,
    });
    const gateAxisGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, 0, 0),
    ]);
    const gateAxisLine = new THREE.Line(gateAxisGeo, gateAxisMat);
    gateAxisLineRef.current = gateAxisLine;
    gateAxisLine.visible = false;
    scene.add(gateAxisLine);

    // Gate rotation indicator ring around axis
    const gateRingGeo = new THREE.BufferGeometry();
    const gateRingMat = new THREE.LineBasicMaterial({
      color: 0xc084fc,
      linewidth: 2,
      transparent: true,
      opacity: 0.85,
    });
    const gateAxisRing = new THREE.Line(gateRingGeo, gateRingMat);
    gateAxisRingRef.current = gateAxisRing;
    gateAxisRing.visible = false;
    scene.add(gateAxisRing);

    // Trajectory path line (arc trail)
    const trajMat = new THREE.LineBasicMaterial({
      color: 0xf59e0b,
      linewidth: 4,
      transparent: true,
      opacity: 0.85,
    });
    const trajGeo = new THREE.BufferGeometry();
    const trajLine = new THREE.Line(trajGeo, trajMat);
    trajectoryLineRef.current = trajLine;
    scene.add(trajLine);

    // 14. Resize Handler
    const handleResize = () => {
      if (!container || !renderer || !camera) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    // 15. Animation Loop
    let animationFrameId: number;
    let clock = new THREE.Clock();

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      const delta = clock.getDelta();

      // Damped controls
      controls.update();

      // Subtle pulse on tip glowing ball
      if (vectorGlowBallRef.current) {
        const t = clock.getElapsedTime();
        const pulse = 1.0 + 0.15 * Math.sin(t * 4);
        vectorGlowBallRef.current.scale.set(pulse, pulse, pulse);
      }

      renderer.render(scene, camera);
    };

    animate();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
      renderer.dispose();
      controls.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  // Update State Vector orientation and projections in 3D scene
  const updateSceneVector = useCallback(
    (currentVec: BlochVector, theta: number, phi: number) => {
      const [tx, ty, tz] = blochToThreeCoords(currentVec.x, currentVec.y, currentVec.z);
      const targetDir = _vec3A.set(tx, ty, tz).normalize();

      // 1. Position vector shaft & tip
      if (vectorShaftRef.current && vectorTipRef.current && vectorGlowBallRef.current) {
        const up = _vec3B.set(0, 1, 0);
        const quat = new THREE.Quaternion().setFromUnitVectors(up, targetDir);

        vectorShaftRef.current.quaternion.copy(quat);

        const tipPos = targetDir.clone().multiplyScalar(SPHERE_RADIUS);
        vectorTipRef.current.position.copy(tipPos);
        vectorTipRef.current.quaternion.copy(quat);

        vectorGlowBallRef.current.position.copy(tipPos);
      }

      // 2. Projections
      // Drop line: from tip (tx, ty, tz) * R to equator plane (tx, 0, tz) * R
      const tipPos = targetDir.clone().multiplyScalar(SPHERE_RADIUS);
      const equatorProj = new THREE.Vector3(tipPos.x, 0, tipPos.z);

      if (projDropLineRef.current) {
        projDropLineRef.current.geometry.setFromPoints([tipPos, equatorProj]);
        projDropLineRef.current.computeLineDistances();
      }

      if (projDiskLineRef.current) {
        projDiskLineRef.current.geometry.setFromPoints([new THREE.Vector3(0, 0, 0), equatorProj]);
      }

      if (projDiskDotRef.current) {
        projDiskDotRef.current.position.copy(equatorProj);
      }

      // 3. Theta Arc: in the vertical plane containing +Z and the state vector
      if (thetaArcLineRef.current) {
        const arcPoints: THREE.Vector3[] = [];
        const ARC_R = SPHERE_RADIUS * 0.75;
        const steps = 30;
        for (let i = 0; i <= steps; i++) {
          const t = (i / steps) * theta;
          // Interpolate from (0, 1, 0) towards targetDir
          const p = new THREE.Vector3(0, 1, 0).lerp(targetDir, Math.sin(t) / Math.max(1e-4, Math.sin(theta)));
          p.normalize().multiplyScalar(ARC_R);
          arcPoints.push(p);
        }
        thetaArcLineRef.current.geometry.setFromPoints(arcPoints);
      }

      // 4. Phi Arc: around the equator from +X (1, 0, 0) to equator projection
      if (phiArcLineRef.current) {
        const phiPoints: THREE.Vector3[] = [];
        const PHI_R = SPHERE_RADIUS * 0.55;
        const steps = 30;
        for (let i = 0; i <= steps; i++) {
          const a = (i / steps) * phi;
          // In Three.js: +X is (1, 0, 0), +Y_bloch is (0, 0, -1)
          const px = Math.cos(a) * PHI_R;
          const pz = -Math.sin(a) * PHI_R;
          phiPoints.push(new THREE.Vector3(px, 0, pz));
        }
        phiArcLineRef.current.geometry.setFromPoints(phiPoints);
      }
    },
    [SPHERE_RADIUS]
  );

  // Synchronize with state changes (static or during animation)
  useEffect(() => {
    if (animatingGate) {
      // Gate is animating: smoothly rotate along exact gate axis
      const { gate, startVector, progress } = animatingGate;
      const curAngle = gate.angle * progress;
      const intermediateVector = rotateVectorAroundAxis(startVector, gate.rotationAxis, curAngle);
      const intermediateState = stateFromVector(intermediateVector.x, intermediateVector.y, intermediateVector.z);

      updateSceneVector(intermediateVector, intermediateState.theta, intermediateState.phi);

      // Highlight gate rotation axis line
      if (gateAxisLineRef.current && showGateAxis) {
        const [gx, gy, gz] = blochToThreeCoords(
          gate.rotationAxis[0],
          gate.rotationAxis[1],
          gate.rotationAxis[2]
        );
        const axisDir = _vec3A.set(gx, gy, gz).normalize();
        const axisP1 = axisDir.clone().multiplyScalar(SPHERE_RADIUS * 1.35);
        const axisP2 = axisDir.clone().multiplyScalar(-SPHERE_RADIUS * 1.35);
        gateAxisLineRef.current.geometry.setFromPoints([axisP2, axisP1]);
        gateAxisLineRef.current.computeLineDistances();
        gateAxisLineRef.current.visible = true;

        // Rotation arc around gate axis
        if (gateAxisRingRef.current) {
          const ringPoints: THREE.Vector3[] = [];
          const ringR = 0.8;
          // Build perpendicular basis
          const perp1 = new THREE.Vector3(1, 0, 0);
          if (Math.abs(axisDir.dot(perp1)) > 0.9) perp1.set(0, 1, 0);
          const u = new THREE.Vector3().crossVectors(axisDir, perp1).normalize();
          const v = new THREE.Vector3().crossVectors(axisDir, u).normalize();

          const totalAng = gate.angle;
          const steps = 32;
          for (let i = 0; i <= steps; i++) {
            const a = (i / steps) * totalAng;
            const p = u.clone().multiplyScalar(Math.cos(a) * ringR).add(v.clone().multiplyScalar(Math.sin(a) * ringR));
            ringPoints.push(p);
          }
          gateAxisRingRef.current.geometry.setFromPoints(ringPoints);
          gateAxisRingRef.current.visible = true;
        }
      }

      // Draw trajectory arc from startVector up to current progress
      if (trajectoryLineRef.current) {
        const trajPoints: THREE.Vector3[] = [];
        const steps = 40;
        for (let i = 0; i <= steps; i++) {
          const a = gate.angle * progress * (i / steps);
          const v = rotateVectorAroundAxis(startVector, gate.rotationAxis, a);
          const [px, py, pz] = blochToThreeCoords(v.x, v.y, v.z);
          trajPoints.push(new THREE.Vector3(px, py, pz).normalize().multiplyScalar(SPHERE_RADIUS * 1.002));
        }
        trajectoryLineRef.current.geometry.setFromPoints(trajPoints);
        trajectoryLineRef.current.visible = true;
      }
    } else {
      // Static state
      updateSceneVector(qubitState.vector, qubitState.theta, qubitState.phi);

      // Hide gate axis and trajectory if not animating
      if (gateAxisLineRef.current && !showGateAxis) {
        gateAxisLineRef.current.visible = false;
      }
      if (gateAxisRingRef.current) {
        gateAxisRingRef.current.visible = false;
      }
    }
  }, [qubitState, animatingGate, showGateAxis, updateSceneVector, SPHERE_RADIUS]);

  // Toggle visibility of rings and projections
  useEffect(() => {
    if (projectionsGroupRef.current) {
      projectionsGroupRef.current.visible = showProjections;
    }
  }, [showProjections]);

  useEffect(() => {
    if (gridRingsGroupRef.current) {
      gridRingsGroupRef.current.visible = showGridRings;
    }
  }, [showGridRings]);

  // Camera presets
  useEffect(() => {
    if (!viewAnglePreset || !cameraRef.current || !controlsRef.current) return;
    const camera = cameraRef.current;
    const controls = controlsRef.current;

    switch (viewAnglePreset) {
      case 'top':
        camera.position.set(0.01, 8.5, 0);
        break;
      case 'front':
        camera.position.set(0, 0, 8.5);
        break;
      case 'side':
        camera.position.set(8.5, 0, 0);
        break;
      case 'isometric':
        camera.position.set(5.5, 5.5, 5.5);
        break;
      case 'default':
      default:
        camera.position.set(4.8, 3.2, 5.8);
        break;
    }
    controls.target.set(0, 0, 0);
    controls.update();
  }, [viewAnglePreset]);

  // Synchronize controls with interaction mode
  useEffect(() => {
    if (controlsRef.current) {
      controlsRef.current.enabled = interactionMode === 'orbit';
    }
  }, [interactionMode]);

  // Raycasting on sphere for Drawing interaction
  const getSpherePointFromEvent = useCallback(
    (e: React.PointerEvent<HTMLDivElement>): { x: number; y: number; z: number } | null => {
      const container = mountRef.current;
      const camera = cameraRef.current;
      if (!container || !camera) return null;

      const rect = container.getBoundingClientRect();
      _pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      _pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      _raycaster.setFromCamera(_pointer, camera);

      // 1. Raycast with Sphere
      const hitPoint = _vec3A;
      const hit = _raycaster.ray.intersectSphere(_sphere, hitPoint);

      if (hit) {
        // Point is directly on front face of sphere
        const [bx, by, bz] = threeToBlochCoords(hitPoint.x, hitPoint.y, hitPoint.z);
        return { x: bx, y: by, z: bz };
      }

      // 2. If ray misses the sphere (e.g. pointer dragged slightly outside silhouette),
      // intersect with the camera-facing plane through origin and normalize to unit sphere!
      const cameraDir = _vec3B;
      camera.getWorldDirection(cameraDir);
      _plane.setFromNormalAndCoplanarPoint(cameraDir.negate(), new THREE.Vector3(0, 0, 0));

      const planeHit = _vec3C;
      if (_raycaster.ray.intersectPlane(_plane, planeHit)) {
        planeHit.normalize().multiplyScalar(SPHERE_RADIUS);
        const [bx, by, bz] = threeToBlochCoords(planeHit.x, planeHit.y, planeHit.z);
        return { x: bx, y: by, z: bz };
      }

      return null;
    },
    [SPHERE_RADIUS]
  );

  // Mouse / Pointer Event Handlers for Direct Drawing
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    // Only handle primary button for aiming
    if (e.button !== 0) return;

    dragStartRef.current = { x: e.clientX, y: e.clientY };
    hasMovedRef.current = false;

    // Check if clicked the vector tip sphere handle directly
    const container = mountRef.current;
    const camera = cameraRef.current;
    if (container && camera && vectorGlowBallRef.current) {
      const rect = container.getBoundingClientRect();
      _pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      _pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      _raycaster.setFromCamera(_pointer, camera);
      const intersects = _raycaster.intersectObject(vectorGlowBallRef.current);
      if (intersects.length > 0) {
        // User grabbed tip handle directly! Switch to drawing mode immediately
        isDraggingRef.current = true;
        if (controlsRef.current) controlsRef.current.enabled = false;
        container.setPointerCapture(e.pointerId);
        return;
      }
    }

    if (interactionMode === 'draw') {
      // In draw mode, disable OrbitControls and capture pointer
      isDraggingRef.current = true;
      if (controlsRef.current) controlsRef.current.enabled = false;
      container?.setPointerCapture(e.pointerId);

      // Start aiming immediately
      const point = getSpherePointFromEvent(e);
      if (point) {
        const newState = stateFromVector(point.x, point.y, point.z);
        updateSceneVector(newState.vector, newState.theta, newState.phi);
        setDragOverlay({
          active: true,
          x: e.clientX,
          y: e.clientY,
          theta: newState.theta,
          phi: newState.phi,
        });
      }
    } else {
      // In orbit mode: ensure orbit controls are enabled
      if (controlsRef.current) {
        controlsRef.current.enabled = true;
      }
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current) return;

    const dx = Math.abs(e.clientX - dragStartRef.current.x);
    const dy = Math.abs(e.clientY - dragStartRef.current.y);
    if (dx > 3 || dy > 3) {
      hasMovedRef.current = true;
    }

    const point = getSpherePointFromEvent(e);
    if (point) {
      const newState = stateFromVector(point.x, point.y, point.z);
      // Immediately update 3D scene smoothly in real-time
      updateSceneVector(newState.vector, newState.theta, newState.phi);

      setDragOverlay({
        active: true,
        x: e.clientX,
        y: e.clientY,
        theta: newState.theta,
        phi: newState.phi,
      });
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isDraggingRef.current) {
      isDraggingRef.current = false;
      if (mountRef.current?.hasPointerCapture(e.pointerId)) {
        mountRef.current.releasePointerCapture(e.pointerId);
      }

      // Re-enable orbit controls if in orbit mode
      if (controlsRef.current) {
        controlsRef.current.enabled = interactionMode === 'orbit';
      }

      // Commit final drawn vector
      const point = getSpherePointFromEvent(e);
      if (point) {
        const finalState = stateFromVector(point.x, point.y, point.z);
        onVectorDrawn(finalState);
      }

      setDragOverlay(null);
    }
  };

  return (
    <div
      ref={mountRef}
      className={`relative w-full h-full overflow-hidden select-none ${
        interactionMode === 'draw' ? 'cursor-crosshair' : 'cursor-grab active:cursor-grabbing'
      }`}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      {/* Top Floating Control Bar: Interaction Mode Toggle */}
      <div
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
        className="absolute top-5 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1.5 p-1.5 bg-slate-900/90 backdrop-blur-md rounded-2xl border border-slate-700/80 shadow-2xl"
      >
        <button
          type="button"
          onClick={() => onInteractionModeChange('draw')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold tracking-wide transition-all ${
            interactionMode === 'draw'
              ? 'bg-amber-500 text-slate-950 shadow-md font-bold'
              : 'text-slate-300 hover:text-white hover:bg-slate-800/80'
          }`}
          title="Click and drag anywhere on the sphere to aim the state vector"
        >
          <span className="text-sm">✏️</span>
          <span>Draw Vector Mode</span>
        </button>

        <button
          type="button"
          onClick={() => onInteractionModeChange('orbit')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold tracking-wide transition-all ${
            interactionMode === 'orbit'
              ? 'bg-sky-500 text-slate-950 shadow-md font-bold'
              : 'text-slate-300 hover:text-white hover:bg-slate-800/80'
          }`}
          title="Drag anywhere to rotate camera view. Tip handle is still draggable."
        >
          <span className="text-sm">🔄</span>
          <span>Orbit Camera Mode</span>
        </button>
      </div>

      {/* Real-time Drag Tooltip / HUD badge near cursor */}
      {dragOverlay && dragOverlay.active && (
        <div
          className="pointer-events-none fixed z-30 transform -translate-x-1/2 -translate-y-16 px-3.5 py-2 rounded-xl bg-slate-950/95 border border-amber-500/60 shadow-2xl text-xs font-mono text-amber-300 flex items-center gap-3 backdrop-blur-md"
          style={{ left: dragOverlay.x, top: dragOverlay.y }}
        >
          <div className="flex flex-col">
            <span className="text-[10px] uppercase font-sans tracking-wider text-slate-400">Aiming Qubit</span>
            <span className="font-bold text-amber-200">
              θ = {formatAngle(dragOverlay.theta).degrees} ({formatAngle(dragOverlay.theta).piFraction})
            </span>
            <span className="font-bold text-emerald-300">
              φ = {formatAngle(dragOverlay.phi).degrees} ({formatAngle(dragOverlay.phi).piFraction})
            </span>
          </div>
          <div className="text-[10px] text-slate-400 italic border-l border-slate-700 pl-2">
            Release to set
          </div>
        </div>
      )}
    </div>
  );
};
