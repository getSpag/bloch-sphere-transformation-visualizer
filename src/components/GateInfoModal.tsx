import React from 'react';
import { GateDefinition } from '../quantum/types';
import { formatComplex } from '../quantum/math';
import { X, BookOpen } from 'lucide-react';

interface GateInfoModalProps {
  gate: GateDefinition | null;
  onClose: () => void;
}

export const GateInfoModal: React.FC<GateInfoModalProps> = ({ gate, onClose }) => {
  if (!gate) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm select-none">
      <div className="w-full max-w-lg bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-800/40">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 font-bold font-mono flex items-center justify-center text-sm border border-amber-500/30">
              {gate.symbol}
            </div>
            <div>
              <h3 className="font-bold text-slate-100 text-sm">{gate.name}</h3>
              <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">
                {gate.category} Gate
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4 text-xs text-slate-300">
          <div>
            <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-1">
              Physical Interpretation
            </div>
            <p className="leading-relaxed bg-slate-950/60 p-3 rounded-xl border border-slate-800 text-slate-200">
              {gate.description}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
              <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-1">
                Bloch Rotation Axis [nx, ny, nz]
              </div>
              <div className="font-mono text-amber-300 text-sm">
                [{gate.rotationAxis.map((v) => v.toFixed(3)).join(', ')}]
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
              <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-1">
                Rotation Angle (γ)
              </div>
              <div className="font-mono text-emerald-300 text-sm">
                {((gate.angle * 180) / Math.PI).toFixed(1)}° ({(gate.angle / Math.PI).toFixed(2)}π rad)
              </div>
            </div>
          </div>

          {/* Unitary Matrix representation */}
          <div>
            <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-1.5">
              Unitary Matrix Representation U
            </div>
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-center font-mono text-sm">
              <div className="flex items-center gap-3">
                <span className="text-xl text-slate-400 font-light">[</span>
                <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-center">
                  <div className="text-amber-300">{formatComplex(gate.matrix[0][0])}</div>
                  <div className="text-amber-300">{formatComplex(gate.matrix[0][1])}</div>
                  <div className="text-amber-300">{formatComplex(gate.matrix[1][0])}</div>
                  <div className="text-amber-300">{formatComplex(gate.matrix[1][1])}</div>
                </div>
                <span className="text-xl text-slate-400 font-light">]</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 bg-slate-950/50 border-t border-slate-800 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
