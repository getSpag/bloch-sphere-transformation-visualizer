import { Complex, BlochAngles, BlochVector, QubitState, GateDefinition, GateId } from './types';

export const EPSILON = 1e-9;

// Complex Number Utilities
export const complex = (re = 0, im = 0): Complex => ({ re, im });

export const cAdd = (a: Complex, b: Complex): Complex => ({
  re: a.re + b.re,
  im: a.im + b.im,
});

export const cSub = (a: Complex, b: Complex): Complex => ({
  re: a.re - b.re,
  im: a.im - b.im,
});

export const cMul = (a: Complex, b: Complex): Complex => ({
  re: a.re * b.re - a.im * b.im,
  im: a.re * b.im + a.im * b.re,
});

export const cScale = (a: Complex, s: number): Complex => ({
  re: a.re * s,
  im: a.im * s,
});

export const cConj = (a: Complex): Complex => ({
  re: a.re,
  im: -a.im,
});

export const cAbs2 = (a: Complex): number => a.re * a.re + a.im * a.im;

export const cAbs = (a: Complex): number => Math.sqrt(cAbs2(a));

export const cArg = (a: Complex): number => Math.atan2(a.im, a.re);

export const cExp = (phase: number): Complex => ({
  re: Math.cos(phase),
  im: Math.sin(phase),
});

// Clamp helper
export const clamp = (val: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, val));

// Construct Qubit State from Polar Angles theta and phi
export function stateFromAngles(theta: number, phi: number): QubitState {
  // Normalize theta to [0, PI]
  const clampedTheta = clamp(theta, 0, Math.PI);
  // Normalize phi to [0, 2*PI)
  let normPhi = phi % (2 * Math.PI);
  if (normPhi < 0) normPhi += 2 * Math.PI;

  const halfTheta = clampedTheta / 2;
  const cosHalf = Math.cos(halfTheta);
  const sinHalf = Math.sin(halfTheta);

  const alpha: Complex = { re: cosHalf, im: 0 };
  const beta: Complex = {
    re: sinHalf * Math.cos(normPhi),
    im: sinHalf * Math.sin(normPhi),
  };

  const rx = Math.sin(clampedTheta) * Math.cos(normPhi);
  const ry = Math.sin(clampedTheta) * Math.sin(normPhi);
  const rz = Math.cos(clampedTheta);

  return {
    alpha,
    beta,
    theta: clampedTheta,
    phi: normPhi,
    vector: { x: rx, y: ry, z: rz },
  };
}

// Construct Qubit State from Cartesian Unit Vector [rx, ry, rz]
export function stateFromVector(x: number, y: number, z: number): QubitState {
  const len = Math.sqrt(x * x + y * y + z * z);
  const nx = len > EPSILON ? x / len : 0;
  const ny = len > EPSILON ? y / len : 0;
  const nz = len > EPSILON ? z / len : 1;

  // Polar angle theta from +Z: z = cos(theta)
  const theta = Math.acos(clamp(nz, -1, 1));

  // Azimuthal angle phi in XY plane: x = sin(theta)*cos(phi), y = sin(theta)*sin(phi)
  let phi = Math.atan2(ny, nx);
  if (phi < 0) phi += 2 * Math.PI;

  return stateFromAngles(theta, phi);
}

// Construct Qubit State from complex amplitudes alpha and beta
export function stateFromAmplitudes(alpha: Complex, beta: Complex): QubitState {
  const norm = Math.sqrt(cAbs2(alpha) + cAbs2(beta));
  if (norm < EPSILON) {
    return stateFromAngles(0, 0);
  }
  const aNorm = cScale(alpha, 1 / norm);
  const bNorm = cScale(beta, 1 / norm);

  // Eliminate global phase so alpha is real and non-negative
  const alphaPhase = cArg(aNorm);
  const phaseCorrector = cExp(-alphaPhase);
  const aClean = cMul(aNorm, phaseCorrector);
  const bClean = cMul(bNorm, phaseCorrector);

  const prob0 = cAbs2(aClean);
  const prob1 = cAbs2(bClean);

  const theta = 2 * Math.acos(clamp(Math.sqrt(prob0), 0, 1));
  let phi = cArg(bClean);
  if (phi < 0) phi += 2 * Math.PI;

  // If theta is near 0 or PI, phi is ill-defined, clamp to 0
  if (theta < 1e-6 || Math.abs(theta - Math.PI) < 1e-6) {
    phi = 0;
  }

  const rx = 2 * (aClean.re * bClean.re + aClean.im * bClean.im);
  const ry = 2 * (aClean.re * bClean.im - aClean.im * bClean.re);
  const rz = prob0 - prob1;

  return {
    alpha: aClean,
    beta: bClean,
    theta,
    phi,
    vector: { x: rx, y: ry, z: rz },
  };
}

// Convert Bloch coordinate system to Three.js world space
// Bloch: +Z is Up (North), +X is Right, +Y is Out/Depth
// Three: +Y is Up, +X is Right, -Z is +Y_bloch
export function blochToThreeCoords(x: number, y: number, z: number): [number, number, number] {
  return [x, z, -y];
}

export function threeToBlochCoords(tx: number, ty: number, tz: number): [number, number, number] {
  return [tx, -tz, ty];
}

// Rodrigues' rotation formula: rotate vector v around unit axis n by angle angleRad
export function rotateVectorAroundAxis(
  v: BlochVector,
  axis: [number, number, number],
  angleRad: number
): BlochVector {
  const [nx, ny, nz] = axis;
  const axisLen = Math.sqrt(nx * nx + ny * ny + nz * nz);
  if (axisLen < EPSILON) return { ...v };

  const ux = nx / axisLen;
  const uy = ny / axisLen;
  const uz = nz / axisLen;

  const cosA = Math.cos(angleRad);
  const sinA = Math.sin(angleRad);
  const dot = v.x * ux + v.y * uy + v.z * uz;

  // Cross product u x v
  const crossX = uy * v.z - uz * v.y;
  const crossY = uz * v.x - ux * v.z;
  const crossZ = ux * v.y - uy * v.x;

  return {
    x: v.x * cosA + crossX * sinA + ux * dot * (1 - cosA),
    y: v.y * cosA + crossY * sinA + uy * dot * (1 - cosA),
    z: v.z * cosA + crossZ * sinA + uz * dot * (1 - cosA),
  };
}

// Predefined Quantum Gates
const INV_SQRT2 = 1 / Math.SQRT2;

export const QUANTUM_GATES: Record<GateId, GateDefinition> = {
  X: {
    id: 'X',
    name: 'Pauli-X (NOT)',
    symbol: 'X',
    description: '180° rotation around the X-axis. Inverts |0⟩ ↔ |1⟩.',
    category: 'pauli',
    rotationAxis: [1, 0, 0],
    angle: Math.PI,
    matrix: [
      [complex(0, 0), complex(1, 0)],
      [complex(1, 0), complex(0, 0)],
    ],
    matrixLatex: '\\begin{pmatrix} 0 & 1 \\\\ 1 & 0 \\end{pmatrix}',
  },
  Y: {
    id: 'Y',
    name: 'Pauli-Y',
    symbol: 'Y',
    description: '180° rotation around the Y-axis. Swaps basis with phase flip.',
    category: 'pauli',
    rotationAxis: [0, 1, 0],
    angle: Math.PI,
    matrix: [
      [complex(0, 0), complex(0, -1)],
      [complex(0, 1), complex(0, 0)],
    ],
    matrixLatex: '\\begin{pmatrix} 0 & -i \\\\ i & 0 \\end{pmatrix}',
  },
  Z: {
    id: 'Z',
    name: 'Pauli-Z (Phase Flip)',
    symbol: 'Z',
    description: '180° rotation around the Z-axis. Flips relative phase of |1⟩.',
    category: 'pauli',
    rotationAxis: [0, 0, 1],
    angle: Math.PI,
    matrix: [
      [complex(1, 0), complex(0, 0)],
      [complex(0, 0), complex(-1, 0)],
    ],
    matrixLatex: '\\begin{pmatrix} 1 & 0 \\\\ 0 & -1 \\end{pmatrix}',
  },
  H: {
    id: 'H',
    name: 'Hadamard (H)',
    symbol: 'H',
    description: '180° rotation around (X+Z)/√2 axis. Creates equal superposition from |0⟩ or |1⟩.',
    category: 'clifford',
    rotationAxis: [INV_SQRT2, 0, INV_SQRT2],
    angle: Math.PI,
    matrix: [
      [complex(INV_SQRT2, 0), complex(INV_SQRT2, 0)],
      [complex(INV_SQRT2, 0), complex(-INV_SQRT2, 0)],
    ],
    matrixLatex: '\\frac{1}{\\sqrt{2}}\\begin{pmatrix} 1 & 1 \\\\ 1 & -1 \\end{pmatrix}',
  },
  S: {
    id: 'S',
    name: 'Phase Gate (S / √Z)',
    symbol: 'S',
    description: '90° (π/2) rotation around Z-axis. Adds a +i phase to |1⟩.',
    category: 'clifford',
    rotationAxis: [0, 0, 1],
    angle: Math.PI / 2,
    matrix: [
      [complex(1, 0), complex(0, 0)],
      [complex(0, 0), complex(0, 1)],
    ],
    matrixLatex: '\\begin{pmatrix} 1 & 0 \\\\ 0 & i \\end{pmatrix}',
  },
  Sdg: {
    id: 'Sdg',
    name: 'S-Dagger (S†)',
    symbol: 'S†',
    description: '-90° (-π/2) rotation around Z-axis. Inverse of S gate.',
    category: 'clifford',
    rotationAxis: [0, 0, 1],
    angle: -Math.PI / 2,
    matrix: [
      [complex(1, 0), complex(0, 0)],
      [complex(0, 0), complex(0, -1)],
    ],
    matrixLatex: '\\begin{pmatrix} 1 & 0 \\\\ 0 & -i \\end{pmatrix}',
  },
  T: {
    id: 'T',
    name: 'T Gate (π/8)',
    symbol: 'T',
    description: '45° (π/4) rotation around Z-axis. Key non-Clifford gate for universal quantum computation.',
    category: 'clifford',
    rotationAxis: [0, 0, 1],
    angle: Math.PI / 4,
    matrix: [
      [complex(1, 0), complex(0, 0)],
      [complex(0, 0), complex(INV_SQRT2, INV_SQRT2)],
    ],
    matrixLatex: '\\begin{pmatrix} 1 & 0 \\\\ 0 & e^{i\\pi/4} \\end{pmatrix}',
  },
  Tdg: {
    id: 'Tdg',
    name: 'T-Dagger (T†)',
    symbol: 'T†',
    description: '-45° (-π/4) rotation around Z-axis. Inverse of T gate.',
    category: 'clifford',
    rotationAxis: [0, 0, 1],
    angle: -Math.PI / 4,
    matrix: [
      [complex(1, 0), complex(0, 0)],
      [complex(0, 0), complex(INV_SQRT2, -INV_SQRT2)],
    ],
    matrixLatex: '\\begin{pmatrix} 1 & 0 \\\\ 0 & e^{-i\\pi/4} \\end{pmatrix}',
  },
  Rx: {
    id: 'Rx',
    name: 'Rx(θ)',
    symbol: 'Rx',
    description: 'Arbitrary angle rotation around the X-axis.',
    category: 'rotation',
    rotationAxis: [1, 0, 0],
    angle: Math.PI / 2, // default 90 deg
    matrix: [
      [complex(INV_SQRT2, 0), complex(0, -INV_SQRT2)],
      [complex(0, -INV_SQRT2), complex(INV_SQRT2, 0)],
    ],
    matrixLatex: 'e^{-i\\theta X / 2}',
  },
  Ry: {
    id: 'Ry',
    name: 'Ry(θ)',
    symbol: 'Ry',
    description: 'Arbitrary angle rotation around the Y-axis.',
    category: 'rotation',
    rotationAxis: [0, 1, 0],
    angle: Math.PI / 2,
    matrix: [
      [complex(INV_SQRT2, 0), complex(-INV_SQRT2, 0)],
      [complex(INV_SQRT2, 0), complex(INV_SQRT2, 0)],
    ],
    matrixLatex: 'e^{-i\\theta Y / 2}',
  },
  Rz: {
    id: 'Rz',
    name: 'Rz(θ)',
    symbol: 'Rz',
    description: 'Arbitrary angle rotation around the Z-axis.',
    category: 'rotation',
    rotationAxis: [0, 0, 1],
    angle: Math.PI / 2,
    matrix: [
      [complex(INV_SQRT2, -INV_SQRT2), complex(0, 0)],
      [complex(0, 0), complex(INV_SQRT2, INV_SQRT2)],
    ],
    matrixLatex: 'e^{-i\\theta Z / 2}',
  },
  U: {
    id: 'U',
    name: 'Universal Gate U(θ,φ,λ)',
    symbol: 'U',
    description: 'Universal single-qubit rotation parameterizable across full SU(2).',
    category: 'universal',
    rotationAxis: [0, 1, 0],
    angle: Math.PI / 2,
    matrix: [
      [complex(INV_SQRT2, 0), complex(-INV_SQRT2, 0)],
      [complex(INV_SQRT2, 0), complex(INV_SQRT2, 0)],
    ],
    matrixLatex: 'U(\\theta, \\phi, \\lambda)',
  },
};

// Create parameterized rotation gate
export function createRotationGate(type: 'Rx' | 'Ry' | 'Rz', angleRad: number): GateDefinition {
  const base = QUANTUM_GATES[type];
  const halfA = angleRad / 2;
  const cos = Math.cos(halfA);
  const sin = Math.sin(halfA);

  let matrix: [[Complex, Complex], [Complex, Complex]];
  if (type === 'Rx') {
    matrix = [
      [complex(cos, 0), complex(0, -sin)],
      [complex(0, -sin), complex(cos, 0)],
    ];
  } else if (type === 'Ry') {
    matrix = [
      [complex(cos, 0), complex(-sin, 0)],
      [complex(sin, 0), complex(cos, 0)],
    ];
  } else {
    // Rz
    matrix = [
      [complex(Math.cos(-halfA), Math.sin(-halfA)), complex(0, 0)],
      [complex(0, 0), complex(Math.cos(halfA), Math.sin(halfA))],
    ];
  }

  return {
    ...base,
    angle: angleRad,
    matrix,
  };
}

// Apply Gate to Qubit State
export function applyGateToState(state: QubitState, gate: GateDefinition): QubitState {
  // Rotate Bloch vector directly using exact 3D SO(3) Rodrigues rotation
  const rotatedVector = rotateVectorAroundAxis(state.vector, gate.rotationAxis, gate.angle);
  return stateFromVector(rotatedVector.x, rotatedVector.y, rotatedVector.z);
}

// Standard Quantum State Presets
export interface StatePreset {
  label: string;
  name: string;
  theta: number;
  phi: number;
  description: string;
}

export const STATE_PRESETS: StatePreset[] = [
  { label: '|0⟩', name: 'Ground State |0⟩', theta: 0, phi: 0, description: 'North pole (+Z). Computational 0.' },
  { label: '|1⟩', name: 'Excited State |1⟩', theta: Math.PI, phi: 0, description: 'South pole (-Z). Computational 1.' },
  { label: '|+⟩', name: 'Superposition |+⟩', theta: Math.PI / 2, phi: 0, description: 'Positive X-axis: (|0⟩ + |1⟩)/√2.' },
  { label: '|−⟩', name: 'Superposition |−⟩', theta: Math.PI / 2, phi: Math.PI, description: 'Negative X-axis: (|0⟩ - |1⟩)/√2.' },
  { label: '|i⟩', name: 'Phase State |+i⟩', theta: Math.PI / 2, phi: Math.PI / 2, description: 'Positive Y-axis: (|0⟩ + i|1⟩)/√2.' },
  { label: '|−i⟩', name: 'Phase State |−i⟩', theta: Math.PI / 2, phi: 3 * Math.PI / 2, description: 'Negative Y-axis: (|0⟩ - i|1⟩)/√2.' },
  { label: 'Magic', name: 'Magic State (T)', theta: Math.acos(1 / Math.sqrt(3)), phi: Math.PI / 4, description: 'Equidistant from X, Y, and Z axes.' },
];

// Calculate Density Matrix rho = |psi><psi|
export function computeDensityMatrix(state: QubitState): {
  rho00: Complex;
  rho01: Complex;
  rho10: Complex;
  rho11: Complex;
} {
  const { alpha, beta } = state;
  const betaConj = cConj(beta);
  const alphaConj = cConj(alpha);

  return {
    rho00: complex(cAbs2(alpha), 0),
    rho01: cMul(alpha, betaConj),
    rho10: cMul(beta, alphaConj),
    rho11: complex(cAbs2(beta), 0),
  };
}

// Simulate Quantum Measurement
export function performMeasurement(state: QubitState, basis: 'Z' | 'X' | 'Y' = 'Z'): {
  outcome: 0 | 1;
  prob0: number;
  prob1: number;
  collapsedState: QubitState;
} {
  let prob0 = 0;
  let prob1 = 0;

  if (basis === 'Z') {
    prob0 = cAbs2(state.alpha);
    prob1 = cAbs2(state.beta);
  } else if (basis === 'X') {
    // Project onto |+> and |->
    prob0 = 0.5 * (1 + state.vector.x);
    prob1 = 0.5 * (1 - state.vector.x);
  } else {
    // Y basis
    prob0 = 0.5 * (1 + state.vector.y);
    prob1 = 0.5 * (1 - state.vector.y);
  }

  // Ensure robust numerical bounds [0, 1]
  prob0 = clamp(prob0, 0, 1);
  prob1 = clamp(1 - prob0, 0, 1);

  const rand = Math.random();
  const outcome: 0 | 1 = rand < prob0 ? 0 : 1;

  let collapsedState: QubitState;
  if (basis === 'Z') {
    collapsedState = outcome === 0 ? stateFromAngles(0, 0) : stateFromAngles(Math.PI, 0);
  } else if (basis === 'X') {
    collapsedState = outcome === 0 ? stateFromAngles(Math.PI / 2, 0) : stateFromAngles(Math.PI / 2, Math.PI);
  } else {
    collapsedState = outcome === 0 ? stateFromAngles(Math.PI / 2, Math.PI / 2) : stateFromAngles(Math.PI / 2, 3 * Math.PI / 2);
  }

  return { outcome, prob0, prob1, collapsedState };
}

// Simulate Multi-shot measurements (e.g. 1000 shots)
export function runMultiShotExperiment(state: QubitState, basis: 'Z' | 'X' | 'Y' = 'Z', shots = 1000) {
  let p0 = 0;
  if (basis === 'Z') {
    p0 = cAbs2(state.alpha);
  } else if (basis === 'X') {
    p0 = 0.5 * (1 + state.vector.x);
  } else {
    p0 = 0.5 * (1 + state.vector.y);
  }
  p0 = clamp(p0, 0, 1);
  const p1 = 1 - p0;

  let count0 = 0;
  for (let i = 0; i < shots; i++) {
    if (Math.random() < p0) count0++;
  }
  const count1 = shots - count0;

  return {
    shots,
    counts: { 0: count0, 1: count1 },
    probabilities: { 0: count0 / shots, 1: count1 / shots },
    theoretical: { 0: p0, 1: p1 },
  };
}

// Format complex number nicely for UI
export function formatComplex(c: Complex, decimals = 3): string {
  const re = Math.abs(c.re) < 1e-4 ? 0 : Number(c.re.toFixed(decimals));
  const im = Math.abs(c.im) < 1e-4 ? 0 : Number(c.im.toFixed(decimals));

  if (im === 0) return `${re}`;
  if (re === 0) {
    if (im === 1) return 'i';
    if (im === -1) return '-i';
    return `${im}i`;
  }
  const sign = im > 0 ? '+' : '-';
  const absIm = Math.abs(im) === 1 ? '' : Math.abs(im);
  return `${re} ${sign} ${absIm}i`;
}

// Format angle in degrees and pi fractions
export function formatAngle(rad: number, symbol = 'θ'): { degrees: string; piFraction: string } {
  const deg = (rad * 180) / Math.PI;
  const frac = rad / Math.PI;
  let piStr = `${frac.toFixed(2)}π`;
  if (Math.abs(frac) < 1e-3) piStr = '0';
  else if (Math.abs(frac - 0.5) < 1e-3) piStr = 'π/2';
  else if (Math.abs(frac - 1.0) < 1e-3) piStr = 'π';
  else if (Math.abs(frac - 1.5) < 1e-3) piStr = '3π/2';
  else if (Math.abs(frac - 2.0) < 1e-3) piStr = '2π';
  else if (Math.abs(frac - 0.25) < 1e-3) piStr = 'π/4';
  else if (Math.abs(frac - 0.75) < 1e-3) piStr = '3π/4';

  return {
    degrees: `${deg.toFixed(1)}°`,
    piFraction: piStr,
  };
}
