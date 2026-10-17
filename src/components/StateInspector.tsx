import React, { useState } from 'react';
import { QubitState } from '../quantum/types';
import {
  formatComplex,
  formatAngle,
  computeDensityMatrix,
  cAbs2,
} from '../quantum/math';
import {
  ChevronDown,
  ChevronUp,
  Atom,
  Binary,
  Layers,
  Sparkles,
  Info,
} from 'lucide-react';

interface StateInspectorProps {
  qubitState: QubitState;
  onOpenGateInfo?: () => void;
}

export const StateInspector: React.FC<StateInspectorProps> = ({ qubitState }) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const [showDensityMatrix, setShowDensityMatrix] = useState(false);

  const prob0 = cAbs2(qubitState.alpha);
  const prob1 = cAbs2(qubitState.beta);

  const thetaFmt = formatAngle(qubitState.theta, 'θ');
  const phiFmt = formatAngle(qubitState.phi, 'φ');

  const alphaStr = formatComplex(qubitState.alpha);
  const betaStr = formatComplex(qubitState.beta);

  const density = computeDensityMatrix(qubitState);

  return (
    <div
      onPointerDown={(e) => e.stopPropagation()}
      className="absolute top-5 left-5 z-20 w-80 max-w-[calc(100vw-2.5rem)] select-none"
    >
      <div className="bg-slate-900/90 border border-slate-800/90 rounded-2xl shadow-2xl backdrop-blur-md overflow-hidden transition-all duration-300">
        {/* Header bar */}
        <div
          onClick={() => setIsExpanded(!isExpanded)}
          className="px-4 py-3 bg-slate-800/50 flex items-center justify-between cursor-pointer border-b border-slate-800 hover:bg-slate-800/80 transition-colors"
        >
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Atom size={16} />
            </div>
            <div>
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-200">
                Quantum State Inspector
              </h2>
              <span className="text-[10px] text-slate-400 font-mono">
                |ψ⟩ = α|0⟩ + β|1⟩
              </span>
            </div>
          </div>
          <button
            type="button"
            className="p-1 text-slate-400 hover:text-slate-200 rounded-lg hover:bg-slate-700/50 transition-colors"
            aria-label={isExpanded ? 'Collapse inspector' : 'Expand inspector'}
          >
            {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        </div>

        {/* Collapsible Content */}
        {isExpanded && (
          <div className="p-4 space-y-4 text-xs font-sans">
            {/* Dirac State Formulation */}
            <div className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800/80 font-mono text-center">
              <div className="text-[10px] uppercase font-sans tracking-wider text-slate-400 mb-1">
                State Vector |ψ⟩
              </div>
              <div className="text-sm font-semibold text-amber-300 break-words leading-relaxed">
                <span className="text-slate-200">({alphaStr})</span>|0⟩ +{' '}
                <span className="text-slate-200">({betaStr})</span>|1⟩
              </div>
            </div>

            {/* Measurement Probabilities */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center text-[11px] text-slate-300">
                <span className="font-semibold flex items-center gap-1.5 text-sky-400">
                  <Binary size={13} /> P(|0⟩): {(prob0 * 100).toFixed(1)}%
                </span>
                <span className="font-semibold text-rose-400">
                  P(|1⟩): {(prob1 * 100).toFixed(1)}%
                </span>
              </div>
              <div className="h-2.5 w-full bg-slate-950 rounded-full overflow-hidden flex border border-slate-800">
                <div
                  className="bg-sky-500 transition-all duration-300"
                  style={{ width: `${Math.max(0, Math.min(100, prob0 * 100))}%` }}
                />
                <div
                  className="bg-rose-500 transition-all duration-300"
                  style={{ width: `${Math.max(0, Math.min(100, prob1 * 100))}%` }}
                />
              </div>
            </div>

            {/* Spherical & Bloch Coordinates Grid */}
            <div className="grid grid-cols-2 gap-2">
              <div className="p-2.5 rounded-xl bg-slate-950/50 border border-slate-800">
                <div className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">
                  Polar Angle θ
                </div>
                <div className="text-sm font-bold text-amber-400 font-mono mt-0.5">
                  {thetaFmt.degrees}
                </div>
                <div className="text-[10px] text-slate-400 font-mono">
                  {thetaFmt.piFraction}
                </div>
              </div>

              <div className="p-2.5 rounded-xl bg-slate-950/50 border border-slate-800">
                <div className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">
                  Azimuthal Angle φ
                </div>
                <div className="text-sm font-bold text-emerald-400 font-mono mt-0.5">
                  {phiFmt.degrees}
                </div>
                <div className="text-[10px] text-slate-400 font-mono">
                  {phiFmt.piFraction}
                </div>
              </div>
            </div>

            {/* Cartesian Bloch Vector [rx, ry, rz] */}
            <div className="p-2.5 rounded-xl bg-slate-950/50 border border-slate-800">
              <div className="flex justify-between items-center text-[10px] text-slate-400 uppercase tracking-wider font-semibold mb-1">
                <span>Bloch Coordinates [rx, ry, rz]</span>
                <span className="font-mono text-emerald-400">|r| = 1.0</span>
              </div>
              <div className="grid grid-cols-3 gap-1.5 font-mono text-center">
                <div className="bg-rose-950/30 border border-rose-900/40 rounded p-1 text-rose-300">
                  <span className="text-[9px] text-slate-400 block">X</span>
                  {qubitState.vector.x.toFixed(3)}
                </div>
                <div className="bg-emerald-950/30 border border-emerald-900/40 rounded p-1 text-emerald-300">
                  <span className="text-[9px] text-slate-400 block">Y</span>
                  {qubitState.vector.y.toFixed(3)}
                </div>
                <div className="bg-sky-950/30 border border-sky-900/40 rounded p-1 text-sky-300">
                  <span className="text-[9px] text-slate-400 block">Z</span>
                  {qubitState.vector.z.toFixed(3)}
                </div>
              </div>
            </div>

            {/* Collapsible Density Matrix */}
            <div>
              <button
                type="button"
                onClick={() => setShowDensityMatrix(!showDensityMatrix)}
                className="w-full flex items-center justify-between text-[11px] text-slate-400 hover:text-slate-200 py-1"
              >
                <span className="flex items-center gap-1.5">
                  <Layers size={13} />
                  <span>Density Matrix ρ = |ψ⟩⟨ψ|</span>
                </span>
                <span>{showDensityMatrix ? '−' : '+'}</span>
              </button>

              {showDensityMatrix && (
                <div className="mt-2 p-2.5 rounded-xl bg-slate-950 border border-slate-800 font-mono text-[11px]">
                  <div className="grid grid-cols-2 gap-2 text-center">
                    <div className="p-1.5 rounded bg-slate-900 border border-slate-800 text-slate-200">
                      {formatComplex(density.rho00, 2)}
                    </div>
                    <div className="p-1.5 rounded bg-slate-900 border border-slate-800 text-slate-300">
                      {formatComplex(density.rho01, 2)}
                    </div>
                    <div className="p-1.5 rounded bg-slate-900 border border-slate-800 text-slate-300">
                      {formatComplex(density.rho10, 2)}
                    </div>
                    <div className="p-1.5 rounded bg-slate-900 border border-slate-800 text-slate-200">
                      {formatComplex(density.rho11, 2)}
                    </div>
                  </div>
                  <div className="text-[9px] text-slate-400 text-center mt-1.5">
                    Tr(ρ) = 1.00 • Pure State (Tr(ρ²) = 1)
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
