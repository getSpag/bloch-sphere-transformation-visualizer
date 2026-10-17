import React, { useState } from 'react';
import { InteractionMode } from '../quantum/types';
import { MousePointerClick, X, Sparkles, Orbit } from 'lucide-react';

interface DrawGuideOverlayProps {
  interactionMode: InteractionMode;
  onSwitchMode: (mode: InteractionMode) => void;
}

export const DrawGuideOverlay: React.FC<DrawGuideOverlayProps> = ({
  interactionMode,
  onSwitchMode,
}) => {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  return (
    <div
      onPointerDown={(e) => e.stopPropagation()}
      className="absolute top-20 left-1/2 -translate-x-1/2 z-10 max-w-md w-[90vw] select-none pointer-events-auto"
    >
      <div className="p-3 bg-slate-900/90 border border-amber-500/40 rounded-2xl shadow-2xl backdrop-blur-md flex items-center justify-between gap-3 text-xs text-slate-200">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
            {interactionMode === 'draw' ? <MousePointerClick size={18} /> : <Orbit size={18} />}
          </div>
          <div>
            <div className="font-bold text-amber-300">
              {interactionMode === 'draw'
                ? 'Interactive Drawing Mode Active'
                : 'Orbit Camera Mode Active'}
            </div>
            <div className="text-[11px] text-slate-300 leading-tight mt-0.5">
              {interactionMode === 'draw'
                ? 'Click & drag anywhere on the 3D sphere to aim the state vector. Release to set angles θ and φ.'
                : 'Drag to orbit camera view, or grab the glowing tip handle to redraw state vector.'}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onSwitchMode(interactionMode === 'draw' ? 'orbit' : 'draw')}
            className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-300 font-semibold text-[11px] transition-colors whitespace-nowrap"
          >
            Switch to {interactionMode === 'draw' ? 'Orbit' : 'Draw'}
          </button>
          <button
            type="button"
            onClick={() => setDismissed(true)}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
            title="Dismiss guide"
          >
            <X size={14} />
          </button>
        </div>
      </div>
    </div>
  );
};
