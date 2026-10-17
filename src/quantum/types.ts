export interface Complex {
  re: number;
  im: number;
}

export interface BlochAngles {
  theta: number; // Polar angle in radians [0, PI] (colatitude from +Z)
  phi: number;   // Azimuthal angle in radians [0, 2*PI) (from +X in XY plane)
}

export interface BlochVector {
  x: number; // rx
  y: number; // ry
  z: number; // rz
}

export interface QubitState {
  alpha: Complex; // Amplitudes: |psi> = alpha|0> + beta|1>
  beta: Complex;
  theta: number;  // 0 to PI
  phi: number;    // 0 to 2*PI
  vector: BlochVector;
}

export type GateId =
  | 'X'
  | 'Y'
  | 'Z'
  | 'H'
  | 'S'
  | 'Sdg'
  | 'T'
  | 'Tdg'
  | 'Rx'
  | 'Ry'
  | 'Rz'
  | 'U';

export interface GateDefinition {
  id: GateId;
  name: string;
  symbol: string;
  description: string;
  category: 'pauli' | 'clifford' | 'rotation' | 'universal';
  rotationAxis: [number, number, number]; // [nx, ny, nz] in Bloch coordinate space
  angle: number; // Rotation angle in radians
  matrix: [[Complex, Complex], [Complex, Complex]];
  matrixLatex?: string;
}

export interface CircuitStep {
  id: string;
  gate: GateDefinition;
  angleParam?: number; // for parameterized gates like Rx(angle)
  prevState: QubitState;
  nextState: QubitState;
  timestamp: number;
}

export type InteractionMode = 'draw' | 'orbit';

export interface MeasurementResult {
  basis: 'Z' | 'X' | 'Y';
  outcome: 0 | 1;
  prob0: number;
  prob1: number;
  collapsedState: QubitState;
}

export interface MultiShotResult {
  shots: number;
  counts: { 0: number; 1: number };
  probabilities: { 0: number; 1: number };
  theoretical: { 0: number; 1: number };
}
