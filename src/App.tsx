/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useCallback } from 'react';
import { BlochSphereView } from './components/BlochSphereView';
import { StateInspector } from './components/StateInspector';
import { ControlDock } from './components/ControlDock';
import { DrawGuideOverlay } from './components/DrawGuideOverlay';
import { GateInfoModal } from './components/GateInfoModal';
import {
  QubitState,
  BlochVector,
  GateDefinition,
  CircuitStep,
  InteractionMode,
} from './quantum/types';
import {
  stateFromAngles,
  applyGateToState,
  performMeasurement,
} from './quantum/math';
import { playSoftClick, playGateSound, playMeasurementSound } from './quantum/audio';
import { Sparkles, CheckCircle2, AlertCircle } from 'lucide-react';

export default function App() {
  // Current Qubit State (Default to superposed state or ground state |0⟩)
  // Let's initialize to a nice distinct state so both theta and phi are visible, e.g. theta = pi/3 (60°), phi = pi/4 (45°)
  const [qubitState, setQubitState] = useState<QubitState>(() =>
    stateFromAngles(Math.PI / 3, Math.PI / 4)
  );

  // Store the initial state drawn by the user so they can reset back to it
  const [initialDrawnState, setInitialDrawnState] = useState<QubitState>(() =>
    stateFromAngles(Math.PI / 3, Math.PI / 4)
  );

  // Circuit history
  const [circuitHistory, setCircuitHistory] = useState<CircuitStep[]>([]);
  const [currentHistoryIndex, setCurrentHistoryIndex] = useState<number>(-1);

  // Interaction Mode ('draw' or 'orbit')
  const [interactionMode, setInteractionMode] = useState<InteractionMode>('draw');

  // Animation state for Gate transitions
  const [animatingGate, setAnimatingGate] = useState<{
    gate: GateDefinition;
    startVector: BlochVector;
    targetVector: BlochVector;
    progress: number;
  } | null>(null);

  const [animSpeed, setAnimSpeed] = useState<number>(1); // 0.5x, 1x, 2x, 0 (instant)
  const animFrameRef = useRef<number | null>(null);

  // View settings
  const [showProjections, setShowProjections] = useState<boolean>(true);
  const [showGridRings, setShowGridRings] = useState<boolean>(true);
  const [showGateAxis, setShowGateAxis] = useState<boolean>(true);
  const [viewPreset, setViewPreset] = useState<'default' | 'top' | 'front' | 'side' | 'isometric'>('default');

  // Active Gate details modal
  const [activeGateInfo, setActiveGateInfo] = useState<GateDefinition | null>(null);

  // Measurement Flash Toast
  const [measurementToast, setMeasurementToast] = useState<{
    basis: 'Z' | 'X' | 'Y';
    outcome: 0 | 1;
    prob: number;
  } | null>(null);

  // Handler: User drew a new vector by clicking and dragging on the sphere
  const handleVectorDrawn = useCallback((newState: QubitState) => {
    playSoftClick();
    setQubitState(newState);
    setInitialDrawnState(newState);
    // Clear future history on new branch
    setCircuitHistory([]);
    setCurrentHistoryIndex(-1);
  }, []);

  // Handler: User sets a predefined state preset
  const handleSetPreset = useCallback(
    (theta: number, phi: number) => {
      playSoftClick();
      const newState = stateFromAngles(theta, phi);
      setQubitState(newState);
      setInitialDrawnState(newState);
      setCircuitHistory([]);
      setCurrentHistoryIndex(-1);
    },
    []
  );

  // Handler: Manual slider changes for theta / phi
  const handleManualAngleChange = useCallback((theta: number, phi: number) => {
    const newState = stateFromAngles(theta, phi);
    setQubitState(newState);
  }, []);

  // Handler: Apply Quantum Gate
  const handleApplyGate = useCallback(
    (gate: GateDefinition) => {
      if (animatingGate) return; // Prevent concurrent animations

      playGateSound(gate.category);
      const nextState = applyGateToState(qubitState, gate);

      // Record in circuit history
      const newStep: CircuitStep = {
        id: `${gate.id}-${Date.now()}`,
        gate,
        prevState: qubitState,
        nextState,
        timestamp: Date.now(),
      };

      const truncatedHistory = circuitHistory.slice(0, currentHistoryIndex + 1);
      const updatedHistory = [...truncatedHistory, newStep];

      if (animSpeed === 0) {
        // Instant mode
        setQubitState(nextState);
        setCircuitHistory(updatedHistory);
        setCurrentHistoryIndex(updatedHistory.length - 1);
        return;
      }

      // Smooth Gate Animation along geodesic rotation arc
      const durationMs = 700 / animSpeed;
      const startTime = performance.now();
      const startVector = { ...qubitState.vector };
      const targetVector = { ...nextState.vector };

      setAnimatingGate({
        gate,
        startVector,
        targetVector,
        progress: 0,
      });

      const step = (currentTime: number) => {
        const elapsed = currentTime - startTime;
        const rawProgress = Math.min(1, elapsed / durationMs);

        // Smooth cubic ease-in-out
        const progress =
          rawProgress < 0.5
            ? 4 * rawProgress * rawProgress * rawProgress
            : 1 - Math.pow(-2 * rawProgress + 2, 3) / 2;

        setAnimatingGate({
          gate,
          startVector,
          targetVector,
          progress,
        });

        if (rawProgress < 1) {
          animFrameRef.current = requestAnimationFrame(step);
        } else {
          // Animation complete
          setAnimatingGate(null);
          setQubitState(nextState);
          setCircuitHistory(updatedHistory);
          setCurrentHistoryIndex(updatedHistory.length - 1);
        }
      };

      animFrameRef.current = requestAnimationFrame(step);
    },
    [qubitState, animatingGate, animSpeed, circuitHistory, currentHistoryIndex]
  );

  // Handler: Undo Gate
  const handleUndo = useCallback(() => {
    if (currentHistoryIndex < 0) return;
    const prevIndex = currentHistoryIndex - 1;
    if (prevIndex >= 0) {
      setQubitState(circuitHistory[prevIndex].nextState);
    } else {
      setQubitState(circuitHistory[0].prevState);
    }
    setCurrentHistoryIndex(prevIndex);
    playSoftClick();
  }, [circuitHistory, currentHistoryIndex]);

  // Handler: Redo Gate
  const handleRedo = useCallback(() => {
    if (currentHistoryIndex >= circuitHistory.length - 1) return;
    const nextIndex = currentHistoryIndex + 1;
    setQubitState(circuitHistory[nextIndex].nextState);
    setCurrentHistoryIndex(nextIndex);
    playSoftClick();
  }, [circuitHistory, currentHistoryIndex]);

  // Handler: Reset to initial drawn state
  const handleReset = useCallback(() => {
    playSoftClick();
    setQubitState(initialDrawnState);
    setCircuitHistory([]);
    setCurrentHistoryIndex(-1);
    setAnimatingGate(null);
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
  }, [initialDrawnState]);

  // Handler: Perform Measurement & Wavefunction Collapse
  const handlePerformMeasurement = useCallback(
    (basis: 'Z' | 'X' | 'Y') => {
      const { outcome, prob0, prob1, collapsedState } = performMeasurement(qubitState, basis);
      playMeasurementSound(outcome);

      const prob = outcome === 0 ? prob0 : prob1;
      setMeasurementToast({ basis, outcome, prob });

      // Animate collapse
      const durationMs = 450;
      const startTime = performance.now();
      const startVector = { ...qubitState.vector };
      const targetVector = { ...collapsedState.vector };

      const fakeGate: GateDefinition = {
        id: 'U',
        name: `Collapse ${basis}`,
        symbol: `M_${basis}`,
        description: `Measurement collapse onto eigenstate`,
        category: 'universal',
        rotationAxis: [0, 1, 0],
        angle: 0,
        matrix: [
          [{ re: 1, im: 0 }, { re: 0, im: 0 }],
          [{ re: 0, im: 0 }, { re: 1, im: 0 }],
        ],
      };

      setAnimatingGate({
        gate: fakeGate,
        startVector,
        targetVector,
        progress: 0,
      });

      const step = (curTime: number) => {
        const elapsed = curTime - startTime;
        const progress = Math.min(1, elapsed / durationMs);

        setAnimatingGate({
          gate: fakeGate,
          startVector,
          targetVector,
          progress,
        });

        if (progress < 1) {
          animFrameRef.current = requestAnimationFrame(step);
        } else {
          setAnimatingGate(null);
          setQubitState(collapsedState);
        }
      };

      animFrameRef.current = requestAnimationFrame(step);

      // Auto dismiss toast after 3.5 seconds
      setTimeout(() => {
        setMeasurementToast(null);
      }, 3500);
    },
    [qubitState]
  );

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-slate-950 font-sans text-slate-100">
      {/* 3D Bloch Sphere Viewport */}
      <BlochSphereView
        qubitState={qubitState}
        onVectorDrawn={handleVectorDrawn}
        animatingGate={animatingGate}
        interactionMode={interactionMode}
        onInteractionModeChange={setInteractionMode}
        showProjections={showProjections}
        showGridRings={showGridRings}
        showGateAxis={showGateAxis}
        viewAnglePreset={viewPreset}
      />

      {/* Floating State Inspector (Top-Left) */}
      <StateInspector qubitState={qubitState} />

      {/* Drawing Instructions Guide Overlay (Top-Center) */}
      <DrawGuideOverlay
        interactionMode={interactionMode}
        onSwitchMode={setInteractionMode}
      />

      {/* Measurement Collapse Toast Notification */}
      {measurementToast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 animate-in slide-in-from-bottom-4 fade-in duration-300">
          <div className="p-3.5 bg-slate-900/95 border border-sky-500/50 rounded-2xl shadow-2xl backdrop-blur-md flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-sky-500/20 text-sky-400 flex items-center justify-center font-bold text-base border border-sky-500/40">
              |{measurementToast.outcome}⟩
            </div>
            <div>
              <div className="text-xs font-bold text-sky-300">
                Wavefunction Collapsed ({measurementToast.basis}-Basis)
              </div>
              <div className="text-[11px] text-slate-300 font-mono mt-0.5">
                Outcome: |{measurementToast.outcome}⟩ • P(observed) = {(measurementToast.prob * 100).toFixed(1)}%
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Unified Bottom Control Dock */}
      <ControlDock
        qubitState={qubitState}
        onApplyGate={handleApplyGate}
        onSetPreset={handleSetPreset}
        onReset={handleReset}
        circuitHistory={circuitHistory}
        currentHistoryIndex={currentHistoryIndex}
        onUndo={handleUndo}
        onRedo={handleRedo}
        onPerformMeasurement={handlePerformMeasurement}
        isAnimating={!!animatingGate}
        animSpeed={animSpeed}
        onAnimSpeedChange={setAnimSpeed}
        showProjections={showProjections}
        onToggleProjections={() => setShowProjections((v) => !v)}
        showGridRings={showGridRings}
        onToggleGridRings={() => setShowGridRings((v) => !v)}
        showGateAxis={showGateAxis}
        onToggleGateAxis={() => setShowGateAxis((v) => !v)}
        onManualAngleChange={handleManualAngleChange}
        onViewPresetChange={(view) => setViewPreset(view)}
      />

      {/* Gate Information Modal */}
      <GateInfoModal gate={activeGateInfo} onClose={() => setActiveGateInfo(null)} />
    </div>
  );
}
