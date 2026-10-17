import React, { useState } from 'react';
import {
  GateId,
  GateDefinition,
  QubitState,
  CircuitStep,
  MultiShotResult,
} from '../quantum/types';
import {
  QUANTUM_GATES,
  STATE_PRESETS,
  createRotationGate,
  performMeasurement,
  runMultiShotExperiment,
  formatAngle,
} from '../quantum/math';
import {
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  Undo2,
  Redo2,
  Zap,
  BookmarkCheck,
  Activity,
  Code2,
  Compass,
  Sliders,
} from 'lucide-react';

interface ControlDockProps {
  qubitState: QubitState;
  onApplyGate: (gate: GateDefinition) => void;
  onSetPreset: (theta: number, phi: number) => void;
  onReset: () => void;
  circuitHistory: CircuitStep[];
  currentHistoryIndex: number;
  onUndo: () => void;
  onRedo: () => void;
  onPerformMeasurement: (basis: 'Z' | 'X' | 'Y') => void;
  isAnimating: boolean;
  animSpeed: number;
  onAnimSpeedChange: (speed: number) => void;
  showProjections: boolean;
  onToggleProjections: () => void;
  showGridRings: boolean;
  onToggleGridRings: () => void;
  showGateAxis: boolean;
  onToggleGateAxis: () => void;
  onManualAngleChange: (theta: number, phi: number) => void;
  onViewPresetChange: (view: 'default' | 'top' | 'front' | 'side' | 'isometric') => void;
}

type DockTab = 'gates' | 'presets' | 'measure' | 'circuit';

export const ControlDock: React.FC<ControlDockProps> = ({
  qubitState,
  onApplyGate,
  onSetPreset,
  onReset,
  circuitHistory,
  currentHistoryIndex,
  onUndo,
  onRedo,
  onPerformMeasurement,
  isAnimating,
  animSpeed,
  onAnimSpeedChange,
  showProjections,
  onToggleProjections,
  showGridRings,
  onToggleGridRings,
  showGateAxis,
  onToggleGateAxis,
  onManualAngleChange,
  onViewPresetChange,
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [activeTab, setActiveTab] = useState<DockTab>('gates');
  const [rotationAngleDeg, setRotationAngleDeg] = useState(90);
  const [measurementBasis, setMeasurementBasis] = useState<'Z' | 'X' | 'Y'>('Z');
  const [multiShotData, setMultiShotData] = useState<MultiShotResult | null>(null);
  const [copiedExport, setCopiedExport] = useState(false);

  // Apply parameterized rotation
  const handleApplyRotation = (type: 'Rx' | 'Ry' | 'Rz') => {
    const rad = (rotationAngleDeg * Math.PI) / 180;
    const gate = createRotationGate(type, rad);
    onApplyGate(gate);
  };

  // Run multi-shot experiment
  const handleRunShots = (shots: number) => {
    const res = runMultiShotExperiment(qubitState, measurementBasis, shots);
    setMultiShotData(res);
  };

  // Generate OpenQASM 2.0 representation
  const generateQasm = () => {
    let qasm = 'OPENQASM 2.0;\ninclude "qelib1.inc";\nqreg q[1];\ncreg c[1];\n\n// Initial state preparation\n';
    qasm += `// Initial angles: theta=${qubitState.theta.toFixed(3)}, phi=${qubitState.phi.toFixed(3)}\n`;
    circuitHistory.slice(0, currentHistoryIndex + 1).forEach((step) => {
      const g = step.gate;
      if (g.id === 'Rx') qasm += `rx(${g.angle.toFixed(3)}) q[0];\n`;
      else if (g.id === 'Ry') qasm += `ry(${g.angle.toFixed(3)}) q[0];\n`;
      else if (g.id === 'Rz') qasm += `rz(${g.angle.toFixed(3)}) q[0];\n`;
      else if (g.id === 'Sdg') qasm += `sdg q[0];\n`;
      else if (g.id === 'Tdg') qasm += `tdg q[0];\n`;
      else qasm += `${g.id.toLowerCase()} q[0];\n`;
    });
    qasm += `measure q[0] -> c[0];\n`;
    return qasm;
  };

  const copyQasm = () => {
    navigator.clipboard.writeText(generateQasm());
    setCopiedExport(true);
    setTimeout(() => setCopiedExport(false), 2000);
  };

  return (
    <div
      onPointerDown={(e) => e.stopPropagation()}
      className={`fixed top-5 right-5 bottom-5 z-20 w-80 sm:w-92 max-w-[calc(100vw-2.5rem)] flex flex-col transition-transform duration-300 ease-out select-none ${
        isCollapsed ? 'translate-x-[calc(100%+1.5rem)]' : 'translate-x-0'
      }`}
    >
      {/* Collapse / Expand Toggle Tab on the left edge */}
      <button
        type="button"
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="absolute -left-8 top-1/2 -translate-y-1/2 py-3 px-1 rounded-l-xl bg-slate-900 border-l border-y border-slate-700/80 text-slate-300 hover:text-white hover:bg-slate-800 shadow-2xl flex flex-col items-center gap-1.5 cursor-pointer transition-colors"
        title={isCollapsed ? 'Show Controls Panel' : 'Hide Controls Panel'}
      >
        {isCollapsed ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
        <span className="[writing-mode:vertical-lr] rotate-180 text-[10px] uppercase font-bold tracking-widest text-slate-400">
          {isCollapsed ? 'Controls' : 'Collapse'}
        </span>
      </button>

      {/* Main Vertical Glassmorphic Panel */}
      <div className="h-full flex flex-col bg-slate-900/95 border border-slate-800 rounded-2xl shadow-2xl backdrop-blur-xl overflow-hidden">
        {/* Top Header: Title & Quick History Controls */}
        <div className="px-4 py-3 border-b border-slate-800 bg-slate-800/40 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-400 flex items-center justify-center">
              <Zap size={15} />
            </div>
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200">
                Quantum Controls
              </h3>
              <span className="text-[10px] text-slate-400 font-mono">
                Gate & State Operations
              </span>
            </div>
          </div>

          {/* Quick Undo / Redo / Reset */}
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={onUndo}
              disabled={currentHistoryIndex < 0 || isAnimating}
              className="p-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              title="Undo last gate"
            >
              <Undo2 size={14} />
            </button>
            <button
              type="button"
              onClick={onRedo}
              disabled={currentHistoryIndex >= circuitHistory.length - 1 || isAnimating}
              className="p-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              title="Redo next gate"
            >
              <Redo2 size={14} />
            </button>
            <button
              type="button"
              onClick={onReset}
              disabled={isAnimating}
              className="p-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-rose-400 hover:bg-slate-700 disabled:opacity-30 transition-colors"
              title="Reset to initial drawn state"
            >
              <RotateCcw size={14} />
            </button>
          </div>
        </div>

        {/* Tab Navigation Chips */}
        <div className="p-2 border-b border-slate-800 bg-slate-950/60 grid grid-cols-4 gap-1">
          <button
            type="button"
            onClick={() => setActiveTab('gates')}
            className={`flex flex-col items-center justify-center py-1.5 px-1 rounded-lg text-[10px] font-semibold transition-all ${
              activeTab === 'gates'
                ? 'bg-amber-500 text-slate-950 font-bold shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Zap size={13} className="mb-0.5" />
            <span>Gates</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('presets')}
            className={`flex flex-col items-center justify-center py-1.5 px-1 rounded-lg text-[10px] font-semibold transition-all ${
              activeTab === 'presets'
                ? 'bg-amber-500 text-slate-950 font-bold shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <BookmarkCheck size={13} className="mb-0.5" />
            <span>Presets</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('measure')}
            className={`flex flex-col items-center justify-center py-1.5 px-1 rounded-lg text-[10px] font-semibold transition-all ${
              activeTab === 'measure'
                ? 'bg-amber-500 text-slate-950 font-bold shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Activity size={13} className="mb-0.5" />
            <span>Measure</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('circuit')}
            className={`flex flex-col items-center justify-center py-1.5 px-1 rounded-lg text-[10px] font-semibold transition-all ${
              activeTab === 'circuit'
                ? 'bg-amber-500 text-slate-950 font-bold shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Code2 size={13} className="mb-0.5" />
            <span>Circuit</span>
          </button>
        </div>

        {/* Scrollable Content Body */}
        <div className="flex-1 overflow-y-auto p-3.5 space-y-3.5 text-xs">
          {/* TAB 1: QUANTUM GATES */}
          {activeTab === 'gates' && (
            <div className="space-y-3">
              {/* Pauli Gates */}
              <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800">
                <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                  <span>Pauli Inversions (180°)</span>
                  <span className="text-[9px] text-slate-400 font-mono">SO(3) π-rotations</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => onApplyGate(QUANTUM_GATES.X)}
                    disabled={isAnimating}
                    className="flex flex-col items-center justify-center py-2.5 rounded-lg bg-rose-950/40 border border-rose-800/60 hover:bg-rose-900/60 text-rose-300 active:scale-95 transition-all disabled:opacity-40"
                    title={QUANTUM_GATES.X.description}
                  >
                    <span className="text-base font-bold">X</span>
                    <span className="text-[9px] text-rose-400/80 mt-0.5">Bit-Flip</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => onApplyGate(QUANTUM_GATES.Y)}
                    disabled={isAnimating}
                    className="flex flex-col items-center justify-center py-2.5 rounded-lg bg-emerald-950/40 border border-emerald-800/60 hover:bg-emerald-900/60 text-emerald-300 active:scale-95 transition-all disabled:opacity-40"
                    title={QUANTUM_GATES.Y.description}
                  >
                    <span className="text-base font-bold">Y</span>
                    <span className="text-[9px] text-emerald-400/80 mt-0.5">Bit+Phase</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => onApplyGate(QUANTUM_GATES.Z)}
                    disabled={isAnimating}
                    className="flex flex-col items-center justify-center py-2.5 rounded-lg bg-sky-950/40 border border-sky-800/60 hover:bg-sky-900/60 text-sky-300 active:scale-95 transition-all disabled:opacity-40"
                    title={QUANTUM_GATES.Z.description}
                  >
                    <span className="text-base font-bold">Z</span>
                    <span className="text-[9px] text-sky-400/80 mt-0.5">Phase-Flip</span>
                  </button>
                </div>
              </div>

              {/* Clifford & Phase Gates */}
              <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800">
                <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                  <span>Clifford & Phase Gates</span>
                  <span className="text-[9px] text-slate-400 font-mono">Superposition</span>
                </div>
                <div className="grid grid-cols-5 gap-1.5">
                  <button
                    type="button"
                    onClick={() => onApplyGate(QUANTUM_GATES.H)}
                    disabled={isAnimating}
                    className="flex flex-col items-center justify-center py-2.5 rounded-lg bg-amber-950/40 border border-amber-800/60 hover:bg-amber-900/60 text-amber-300 active:scale-95 transition-all disabled:opacity-40"
                    title={QUANTUM_GATES.H.description}
                  >
                    <span className="text-sm font-bold">H</span>
                    <span className="text-[8px] text-amber-400/80 mt-0.5">Hadamard</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => onApplyGate(QUANTUM_GATES.S)}
                    disabled={isAnimating}
                    className="flex flex-col items-center justify-center py-2.5 rounded-lg bg-blue-950/40 border border-blue-800/60 hover:bg-blue-900/60 text-blue-300 active:scale-95 transition-all disabled:opacity-40"
                    title={QUANTUM_GATES.S.description}
                  >
                    <span className="text-sm font-bold">S</span>
                    <span className="text-[8px] text-blue-400/80 mt-0.5">+π/2</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => onApplyGate(QUANTUM_GATES.Sdg)}
                    disabled={isAnimating}
                    className="flex flex-col items-center justify-center py-2.5 rounded-lg bg-blue-950/40 border border-blue-800/60 hover:bg-blue-900/60 text-blue-300 active:scale-95 transition-all disabled:opacity-40"
                    title={QUANTUM_GATES.Sdg.description}
                  >
                    <span className="text-sm font-bold">S†</span>
                    <span className="text-[8px] text-blue-400/80 mt-0.5">-π/2</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => onApplyGate(QUANTUM_GATES.T)}
                    disabled={isAnimating}
                    className="flex flex-col items-center justify-center py-2.5 rounded-lg bg-purple-950/40 border border-purple-800/60 hover:bg-purple-900/60 text-purple-300 active:scale-95 transition-all disabled:opacity-40"
                    title={QUANTUM_GATES.T.description}
                  >
                    <span className="text-sm font-bold">T</span>
                    <span className="text-[8px] text-purple-400/80 mt-0.5">+π/4</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => onApplyGate(QUANTUM_GATES.Tdg)}
                    disabled={isAnimating}
                    className="flex flex-col items-center justify-center py-2.5 rounded-lg bg-purple-950/40 border border-purple-800/60 hover:bg-purple-900/60 text-purple-300 active:scale-95 transition-all disabled:opacity-40"
                    title={QUANTUM_GATES.Tdg.description}
                  >
                    <span className="text-sm font-bold">T†</span>
                    <span className="text-[8px] text-purple-400/80 mt-0.5">-π/4</span>
                  </button>
                </div>
              </div>

              {/* Parameterized Rotations Rx, Ry, Rz */}
              <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  <span>Rotations: {rotationAngleDeg}°</span>
                  <div className="flex gap-1 text-[9px]">
                    {[30, 45, 90, 180].map((ang) => (
                      <button
                        key={ang}
                        type="button"
                        onClick={() => setRotationAngleDeg(ang)}
                        className={`px-1.5 py-0.5 rounded transition-colors ${
                          rotationAngleDeg === ang
                            ? 'bg-amber-500 text-slate-950 font-bold'
                            : 'bg-slate-800 text-slate-300 hover:text-white'
                        }`}
                      >
                        {ang}°
                      </button>
                    ))}
                  </div>
                </div>

                <input
                  type="range"
                  min={-180}
                  max={180}
                  step={5}
                  value={rotationAngleDeg}
                  onChange={(e) => setRotationAngleDeg(Number(e.target.value))}
                  className="w-full accent-amber-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                />

                <div className="grid grid-cols-3 gap-1.5 pt-1">
                  <button
                    type="button"
                    onClick={() => handleApplyRotation('Rx')}
                    disabled={isAnimating}
                    className="py-2 rounded-lg bg-rose-950/30 border border-rose-800/50 hover:bg-rose-900/50 text-rose-300 text-xs font-semibold active:scale-95 transition-all disabled:opacity-40"
                  >
                    Rx({rotationAngleDeg}°)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApplyRotation('Ry')}
                    disabled={isAnimating}
                    className="py-2 rounded-lg bg-emerald-950/30 border border-emerald-800/50 hover:bg-emerald-900/50 text-emerald-300 text-xs font-semibold active:scale-95 transition-all disabled:opacity-40"
                  >
                    Ry({rotationAngleDeg}°)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApplyRotation('Rz')}
                    disabled={isAnimating}
                    className="py-2 rounded-lg bg-sky-950/30 border border-sky-800/50 hover:bg-sky-900/50 text-sky-300 text-xs font-semibold active:scale-95 transition-all disabled:opacity-40"
                  >
                    Rz({rotationAngleDeg}°)
                  </button>
                </div>
              </div>

              {/* Overlays & Visual Settings */}
              <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 space-y-2">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Visual Overlays & Geodesics
                </div>
                <div className="grid grid-cols-3 gap-2 text-[11px] text-slate-300">
                  <label className="flex items-center gap-1.5 cursor-pointer hover:text-white">
                    <input
                      type="checkbox"
                      checked={showProjections}
                      onChange={onToggleProjections}
                      className="rounded accent-amber-500"
                    />
                    <span>Arcs</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer hover:text-white">
                    <input
                      type="checkbox"
                      checked={showGateAxis}
                      onChange={onToggleGateAxis}
                      className="rounded accent-purple-500"
                    />
                    <span>Gate Axis</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer hover:text-white">
                    <input
                      type="checkbox"
                      checked={showGridRings}
                      onChange={onToggleGridRings}
                      className="rounded accent-sky-500"
                    />
                    <span>Rings</span>
                  </label>
                </div>

                {/* Animation Speed Selector */}
                <div className="flex items-center justify-between pt-1 border-t border-slate-800 text-[11px] text-slate-400">
                  <span>Speed:</span>
                  <div className="flex gap-1">
                    {[0.5, 1, 2, 0].map((spd) => (
                      <button
                        key={spd}
                        type="button"
                        onClick={() => onAnimSpeedChange(spd)}
                        className={`px-2 py-0.5 rounded text-[10px] font-semibold transition-all ${
                          animSpeed === spd
                            ? 'bg-amber-500 text-slate-950 font-bold'
                            : 'bg-slate-800 text-slate-300 hover:text-white'
                        }`}
                      >
                        {spd === 0 ? 'Instant' : `${spd}x`}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: PRESETS & ANGLES */}
          {activeTab === 'presets' && (
            <div className="space-y-3">
              {/* Standard Quantum State Presets */}
              <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                  Eigenstate Presets
                </div>
                <div className="grid grid-cols-4 gap-1.5">
                  {STATE_PRESETS.map((preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => onSetPreset(preset.theta, preset.phi)}
                      disabled={isAnimating}
                      className="p-2 rounded-lg bg-slate-900 border border-slate-800 hover:border-amber-500/50 hover:bg-slate-800/80 transition-all text-center group disabled:opacity-40"
                      title={preset.description}
                    >
                      <span className="block text-sm font-bold text-amber-300 group-hover:scale-105 transition-transform">
                        {preset.label}
                      </span>
                      <span className="block text-[8px] text-slate-400 truncate mt-0.5">
                        {preset.name.split(' ')[0]}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Direct Numeric Sliders for Theta and Phi */}
              <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 space-y-3">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Manual Angle Tuning
                </div>

                {/* Theta slider */}
                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-amber-300 font-semibold">Polar θ (Colatitude):</span>
                    <span className="font-mono text-amber-200">
                      {((qubitState.theta * 180) / Math.PI).toFixed(1)}°
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={180}
                    step={1}
                    value={(qubitState.theta * 180) / Math.PI}
                    onChange={(e) => {
                      const newTheta = (Number(e.target.value) * Math.PI) / 180;
                      onManualAngleChange(newTheta, qubitState.phi);
                    }}
                    className="w-full accent-amber-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                  />
                  <div className="flex justify-between text-[9px] text-slate-400 font-mono">
                    <span>0° (|0⟩)</span>
                    <span>90°</span>
                    <span>180° (|1⟩)</span>
                  </div>
                </div>

                {/* Phi slider */}
                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-emerald-300 font-semibold">Azimuthal φ (Phase):</span>
                    <span className="font-mono text-emerald-200">
                      {((qubitState.phi * 180) / Math.PI).toFixed(1)}°
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={360}
                    step={1}
                    value={(qubitState.phi * 180) / Math.PI}
                    onChange={(e) => {
                      const newPhi = (Number(e.target.value) * Math.PI) / 180;
                      onManualAngleChange(qubitState.theta, newPhi);
                    }}
                    className="w-full accent-emerald-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                  />
                  <div className="flex justify-between text-[9px] text-slate-400 font-mono">
                    <span>0° (|+⟩)</span>
                    <span>90° (|+i⟩)</span>
                    <span>180°</span>
                    <span>270°</span>
                  </div>
                </div>
              </div>

              {/* Camera Presets */}
              <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 space-y-2">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <Compass size={13} />
                  <span>Camera Viewpoints</span>
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  {[
                    { label: 'Default', key: 'default' },
                    { label: 'Top (+Z)', key: 'top' },
                    { label: 'Front (XY)', key: 'front' },
                    { label: 'Side (YZ)', key: 'side' },
                    { label: 'Isometric', key: 'isometric' },
                  ].map((v) => (
                    <button
                      key={v.key}
                      type="button"
                      onClick={() => onViewPresetChange(v.key as any)}
                      className="py-1.5 px-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs text-center border border-slate-800 transition-colors"
                    >
                      {v.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: MEASUREMENT */}
          {activeTab === 'measure' && (
            <div className="space-y-3">
              {/* Single Shot Measurement */}
              <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Single-Shot Collapse
                  </div>
                  <div className="flex gap-1">
                    {(['Z', 'X', 'Y'] as const).map((b) => (
                      <button
                        key={b}
                        type="button"
                        onClick={() => setMeasurementBasis(b)}
                        className={`px-2 py-0.5 rounded text-[10px] font-semibold transition-all ${
                          measurementBasis === b
                            ? 'bg-sky-500 text-slate-950 font-bold'
                            : 'bg-slate-800 text-slate-300'
                        }`}
                      >
                        {b}-Basis
                      </button>
                    ))}
                  </div>
                </div>

                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Projectively measures along {measurementBasis}-axis. Superposition collapses to an
                  eigenstate per Born's rule.
                </p>

                <button
                  type="button"
                  onClick={() => onPerformMeasurement(measurementBasis)}
                  disabled={isAnimating}
                  className="w-full py-2.5 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white font-bold text-xs shadow-lg active:scale-98 transition-all flex items-center justify-center gap-2 disabled:opacity-40"
                >
                  <Activity size={15} />
                  <span>Measure & Collapse ({measurementBasis})</span>
                </button>
              </div>

              {/* Multi-Shot Monte Carlo */}
              <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Monte Carlo Sampling
                  </div>
                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleRunShots(100)}
                      className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-semibold transition-colors"
                    >
                      100 Shots
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRunShots(1000)}
                      className="px-2 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-[10px] font-bold transition-colors"
                    >
                      1000 Shots
                    </button>
                  </div>
                </div>

                {multiShotData ? (
                  <div className="space-y-2 pt-1 font-mono text-xs">
                    <div>
                      <div className="flex justify-between text-[11px] mb-1">
                        <span className="text-sky-400 font-bold">
                          |0⟩: {multiShotData.counts[0]} (
                          {(multiShotData.probabilities[0] * 100).toFixed(1)}%)
                        </span>
                        <span className="text-slate-400 text-[10px]">
                          Theory: {(multiShotData.theoretical[0] * 100).toFixed(1)}%
                        </span>
                      </div>
                      <div className="h-2.5 bg-slate-900 rounded-full overflow-hidden border border-slate-800">
                        <div
                          className="h-full bg-sky-500 transition-all duration-300"
                          style={{ width: `${multiShotData.probabilities[0] * 100}%` }}
                        />
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between text-[11px] mb-1">
                        <span className="text-rose-400 font-bold">
                          |1⟩: {multiShotData.counts[1]} (
                          {(multiShotData.probabilities[1] * 100).toFixed(1)}%)
                        </span>
                        <span className="text-slate-400 text-[10px]">
                          Theory: {(multiShotData.theoretical[1] * 100).toFixed(1)}%
                        </span>
                      </div>
                      <div className="h-2.5 bg-slate-900 rounded-full overflow-hidden border border-slate-800">
                        <div
                          className="h-full bg-rose-500 transition-all duration-300"
                          style={{ width: `${multiShotData.probabilities[1] * 100}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="h-20 flex items-center justify-center text-center text-slate-400 text-[11px] border border-dashed border-slate-800 rounded-lg p-2">
                    Run 100 or 1000 shots to observe statistical convergence
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 4: CIRCUIT & EXPORT */}
          {activeTab === 'circuit' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Gate Sequence ({circuitHistory.length})
                </div>
                <button
                  type="button"
                  onClick={copyQasm}
                  className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-300 text-[10px] font-semibold transition-colors flex items-center gap-1"
                >
                  <Code2 size={12} />
                  <span>{copiedExport ? 'Copied!' : 'Copy QASM'}</span>
                </button>
              </div>

              {/* Steps timeline chips */}
              <div className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800 overflow-x-auto flex items-center gap-1.5 min-h-[50px]">
                <div className="px-2 py-1 rounded bg-slate-800 border border-slate-700 text-slate-300 font-mono text-[11px] whitespace-nowrap">
                  |ψ₀⟩
                </div>
                {circuitHistory.length === 0 ? (
                  <span className="text-[11px] text-slate-400 italic px-2">No gates applied yet</span>
                ) : (
                  circuitHistory.map((step, idx) => (
                    <React.Fragment key={step.id}>
                      <span className="text-slate-400 font-mono text-[10px]">→</span>
                      <div
                        className={`px-2 py-1 rounded font-mono text-[11px] font-bold border whitespace-nowrap ${
                          idx === currentHistoryIndex
                            ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-sm'
                            : 'bg-slate-800 text-slate-300 border-slate-700'
                        }`}
                      >
                        {step.gate.symbol}
                      </div>
                    </React.Fragment>
                  ))
                )}
              </div>

              {/* QASM Code preview */}
              <pre className="p-2.5 rounded-xl bg-slate-950 font-mono text-[10px] text-emerald-400/90 overflow-x-auto max-h-48 border border-slate-800 leading-relaxed">
                {generateQasm()}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
