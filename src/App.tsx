import React, { useEffect, useRef, useState } from 'react';
import { 
  Sliders, 
  Volume2, 
  VolumeX, 
  Sparkles, 
  HelpCircle, 
  X, 
  RotateCcw, 
  Download,
  Info
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// --- TS Types ---
type PaletteId = 'aurora' | 'cosmos' | 'sunset';

interface Palette {
  name: string;
  colors: string[]; // for display indicators or gradients
}

interface Star {
  x: number; // percentage of screen width (0 to 100)
  y: number; // percentage of screen height (0 to 100)
  size: number;
  phase: number;
  speed: number;
}

// --- Color Palettes Config ---
const PALETTES: Record<PaletteId, Palette> = {
  aurora: {
    name: '极光之约',
    colors: ['#10b981', '#06b6d4', '#8b5cf6'],
  },
  cosmos: {
    name: '谧夜星河',
    colors: ['#4e54c8', '#7952b3', '#8a2be2'],
  },
  sunset: {
    name: '余晖暖阳',
    colors: ['#ff8c00', '#e03131', '#ff007f'],
  }
};

// --- Web Audio Procedural Ocean Wave Synthesizer ---
class ProceduralWaves {
  private ctx: AudioContext | null = null;
  private isPlaying = false;
  private gainNode: GainNode | null = null;
  private filterNode: BiquadFilterNode | null = null;
  private noiseNode: AudioBufferSourceNode | null = null;
  private oscGain: OscillatorNode | null = null;
  private oscFilter: OscillatorNode | null = null;

  start() {
    if (this.isPlaying) return;

    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;

      this.ctx = new AudioCtx();
      
      // 1. Create a 2-second buffer of white noise which we can loop
      const bufferSize = this.ctx.sampleRate * 2;
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }

      this.noiseNode = this.ctx.createBufferSource();
      this.noiseNode.buffer = buffer;
      this.noiseNode.loop = true;

      // 2. Add Bandpass and Lowpass cascade to filter noise into deep pink/brown ocean rumbles
      this.filterNode = this.ctx.createBiquadFilter();
      this.filterNode.type = 'lowpass';
      // Lower base cutoff represents a softer, deeper rumbling wave
      this.filterNode.frequency.value = 240; 
      this.filterNode.Q.value = 1.2;

      // 3. Create Gain node for volume control
      this.gainNode = this.ctx.createGain();
      this.gainNode.gain.setValueAtTime(0.0, this.ctx.currentTime);

      // Connect standard graph: Noise Source -> LowPass Filter -> Output Gain -> Host Speakers
      this.noiseNode.connect(this.filterNode);
      this.filterNode.connect(this.gainNode);
      this.gainNode.connect(this.ctx.destination);

      // 4. Modulate Volume dynamically to create "Breathing Tides" (Inhale swells up, Exhale quietens)
      // Standard human cycle period is approx 6 seconds (frequency ~ 0.16Hz)
      this.oscGain = this.ctx.createOscillator();
      this.oscGain.type = 'sine';
      this.oscGain.frequency.value = 0.15; // Slow sweep rate

      const oscillGainAmt = this.ctx.createGain();
      oscillGainAmt.gain.value = 0.08; // volume fluctuation amount (+/- 0.08 scaling)

      this.oscGain.connect(oscillGainAmt);
      oscillGainAmt.connect(this.gainNode.gain);

      // 5. Modulate the low-pass frequency slightly different cycle to give a natural wave swept sound
      this.oscFilter = this.ctx.createOscillator();
      this.oscFilter.type = 'sine';
      this.oscFilter.frequency.value = 0.11; // Off-rhythm sweep prevents mechanical cycle sensation

      const oscillFilterAmt = this.ctx.createGain();
      oscillFilterAmt.gain.value = 140; // Frequency fluctuation (+/- 140Hz)

      this.oscFilter.connect(oscillFilterAmt);
      oscillFilterAmt.connect(this.filterNode.frequency);

      // Trigger start
      this.noiseNode.start();
      this.oscGain.start();
      this.oscFilter.start();

      this.isPlaying = true;

      // Fade-in volume safely to prevent startling
      this.gainNode.gain.setTargetAtTime(0.12, this.ctx.currentTime, 1.2);
    } catch (e) {
      console.error('Failed to trigger audio synth:', e);
    }
  }

  setVolume(vol: number) {
    if (this.gainNode && this.ctx) {
      this.gainNode.gain.setTargetAtTime(vol, this.ctx.currentTime, 0.1);
    }
  }

  stop() {
    if (!this.isPlaying) return;
    
    // Slow fade-out to prevent sharp sound cut-off
    if (this.gainNode && this.ctx) {
      this.gainNode.gain.setTargetAtTime(0, this.ctx.currentTime, 0.3);
    }

    setTimeout(() => {
      try {
        this.noiseNode?.stop();
        this.oscGain?.stop();
        this.oscFilter?.stop();
      } catch (e) {}

      this.noiseNode = null;
      this.oscGain = null;
      this.oscFilter = null;
      this.filterNode = null;
      this.gainNode = null;
      this.ctx?.close();
      this.ctx = null;
    }, 400);

    this.isPlaying = false;
  }
}

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const synthRef = useRef<ProceduralWaves | null>(null);
  const brownAudioRef = useRef<HTMLAudioElement | null>(null);

  // --- Aesthetic and Physical Pref States ---
  const [paletteId, setPaletteId] = useState<PaletteId>('aurora');
  const [breatheSpeed, setBreatheSpeed] = useState<number>(5.5); // cycle duration in seconds
  const [lineDensity, setLineDensity] = useState<number>(90); // default balanced density (90 arcs)
  const [soundEnabled, setSoundEnabled] = useState<boolean>(false);
  const [soundMode, setSoundMode] = useState<'brown' | 'meditation'>('brown');
  const [soundVolume, setSoundVolume] = useState<number>(0.15);
  const [turbulenceScale, setTurbulenceScale] = useState<number>(0.2); // global touch ripple strength

  // --- Interactive/PWA panel States ---
  const [showSettings, setShowSettings] = useState<boolean>(false);
  const [showOnboarding, setShowOnboarding] = useState<boolean>(true);
  const [isDeferredPrompt, setIsDeferredPrompt] = useState<boolean>(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  // --- Real-time Interaction refs to keep canvas loop clean and lag-free ---
  const touchState = useRef({
    isInteracting: false,
    screenX: 0,
    screenY: 0,
    factor: 0.0 // interpolated turbulence value (0 to 1)
  });

  // --- Deceleration Inertia reference from Code A ---
  const isPressingRef = useRef(false);
  const dragRef = useRef(1.0); // 1.0 = normal flow, ~0.08 = high peaceful drag (time deceleration)

  // --- Starfield Constellation reference from Code A ---
  const starfieldRef = useRef<Star[]>([]);


  // --- Setup starfield constellation on mount ---
  useEffect(() => {
    const stars: Star[] = [];
    for (let i = 0; i < 75; i++) {
      stars.push({
        x: Math.random() * 100,
        y: Math.random() * 100,
        size: 0.3 + Math.random() * 1.3,
        phase: Math.random() * Math.PI * 2,
        speed: 0.005 + Math.random() * 0.015,
      });
    }
    starfieldRef.current = stars;
  }, []);

  // --- Setup PWA Install triggers ---
  useEffect(() => {
    const handleInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setIsDeferredPrompt(true);
    };

    window.addEventListener('beforeinstallprompt', handleInstallPrompt);
    return () => {
      window.removeEventListener('beforeinstallprompt', handleInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    console.log(`Install outcome: ${outcome}`);
    setDeferredPrompt(null);
    setIsDeferredPrompt(false);
  };

  // --- Ambient Prompt and Fade-in support ---
  const [showAmbientPrompt, setShowAmbientPrompt] = useState<boolean>(true);

  useEffect(() => {
    if (!showOnboarding) {
      // Automatically hide after 5.0 seconds from the moment onboarding is completed
      const timer = setTimeout(() => {
        setShowAmbientPrompt(false);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [showOnboarding]);

  // Hide immediate when sound is enabled otherwise
  useEffect(() => {
    if (soundEnabled) {
      setShowAmbientPrompt(false);
    }
  }, [soundEnabled]);

  const triggerSoundWithFadeIn = () => {
    setShowAmbientPrompt(false);
    setSoundEnabled(true);
    
    // Smooth volume fade-in
    const targetVol = 0.20;
    let currentVol = 0.01;
    setSoundVolume(currentVol);
    
    const steps = 15;
    const intervalTime = 100; // 1.5s fade sequence
    const increment = (targetVol - currentVol) / steps;
    
    const interval = setInterval(() => {
      currentVol += increment;
      if (currentVol >= targetVol) {
        setSoundVolume(targetVol);
        clearInterval(interval);
      } else {
        setSoundVolume(parseFloat(currentVol.toFixed(3)));
      }
    }, intervalTime);
  };

  // --- Handle Audio activation / volume sync ---
  useEffect(() => {
    // Instantiate lazy audio objects safely
    if (!synthRef.current) {
      synthRef.current = new ProceduralWaves();
    }
    if (!brownAudioRef.current) {
      brownAudioRef.current = new Audio('https://raw.githubusercontent.com/hcicilee-stack/FlowSpace/main/brown-noise.MP3');
      brownAudioRef.current.loop = true;
    }

    if (soundEnabled) {
      if (soundMode === 'meditation') {
        // Pause brown noise if it is playing
        if (brownAudioRef.current && !brownAudioRef.current.paused) {
          brownAudioRef.current.pause();
        }
        // Start and set volume of procedural waves
        synthRef.current.start();
        synthRef.current.setVolume(soundVolume * 0.8);
      } else {
        // Stop procedural waves if it is running
        synthRef.current.stop();
        // Play and modulate brown noise audio volume
        if (brownAudioRef.current) {
          brownAudioRef.current.volume = soundVolume;
          if (brownAudioRef.current.paused) {
            brownAudioRef.current.play().catch(e => console.log('Audio autoplay prevented:', e));
          }
        }
      }
    } else {
      synthRef.current.stop();
      if (brownAudioRef.current && !brownAudioRef.current.paused) {
        brownAudioRef.current.pause();
      }
    }
  }, [soundEnabled, soundMode, soundVolume]);

  // Handle ultimate unmount cleanup
  useEffect(() => {
    return () => {
      synthRef.current?.stop();
      if (brownAudioRef.current) {
        brownAudioRef.current.pause();
      }
    };
  }, []);

  // Autoclose onboarding helper screen after 5 seconds of touching or 8 seconds idle
  useEffect(() => {
    const timer = setTimeout(() => {
      setShowOnboarding(false);
    }, 8000);
    return () => clearTimeout(timer);
  }, []);

  // --- Core HTML5 Canvas Drawing Loop ---
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animFrameId: number;
    let timeAccumulator = 0;
    let lastTime = performance.now();

    // Keep canvas responsive with clean, high-performance window event listeners (avoids recursive ResizeObserver loops)
    const resizeCanvas = () => {
      if (!canvas) return;
      const width = window.innerWidth;
      const height = window.innerHeight;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.scale(dpr, dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
    };

    window.addEventListener('resize', resizeCanvas);
    window.addEventListener('orientationchange', resizeCanvas);
    resizeCanvas(); // initial draw sizing

    // Local 3D state coordinates tracking
    let globalRotationX = 0.5;
    let globalRotationY = 0.5;
    let globalRotationZ = 0.0;

    const render = (now: number) => {
      const delta = now - lastTime;
      lastTime = now;

      // Limit large deltas during background tab sleep to avoid glitches
      const dt = Math.min(30, delta);

      // --- Deceleration Inertia calculations from Code A ---
      const targetDrag = isPressingRef.current ? 0.08 : 1.0;
      dragRef.current += (targetDrag - dragRef.current) * 0.06;

      const dtScaled = dt * dragRef.current;
      timeAccumulator += dtScaled;

      const width = canvas.width / (window.devicePixelRatio || 1);
      const height = canvas.height / (window.devicePixelRatio || 1);

      const cx = width / 2;
      const cy = height / 2;
      const maxDim = Math.min(width, height);
      
      // Responsive base sphere radius (optimized for mobile/desktop viewports)
      const baseSphereRadius = Math.max(100, Math.min(maxDim * 0.38, 220));

      // 2. Compute smooth breathing pacing expansion (Guideline and pacing logic)
      // Convert state duration to frequency
      const breatheFrequency = (2 * Math.PI) / (breatheSpeed * 1000);
      const breatheWave = Math.sin(timeAccumulator * breatheFrequency);
      
      // Map wave to safe scale multiplier [0.86, 1.14]
      const currentBreatheScale = 1.0 + breatheWave * 0.14;
      const sphereRadius = baseSphereRadius * currentBreatheScale;

      // (High-frequency state synchronization removed from frame loop to prevent recursive React renders and Safari memory crashes)

      // Intercept and update active touch factor (gradual glide transitions)
      const t = touchState.current;
      if (t.isInteracting) {
        t.factor = Math.min(1.0, t.factor + 0.06); // fluid rise
      } else {
        t.factor = Math.max(0.0, t.factor - 0.03); // calm decay
      }

      // Draw serene background (Deep space radial core fading to dark velvet midnight ink)
      const maxRadius = Math.max(width, height);
      const bgGrad = ctx.createRadialGradient(cx, cy, maxRadius * 0.1, cx, cy, maxRadius * 0.85);
      bgGrad.addColorStop(0, '#0a122e');    // Deep rich space blue core
      bgGrad.addColorStop(0.55, '#040918'); // Perfect midnight transit
      bgGrad.addColorStop(1, '#02040a');    // Beautiful outer velvet black canvas
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, width, height);

      // Render Twinkling Stars from Code A
      ctx.save();
      starfieldRef.current.forEach((star) => {
        // Star twinkling cycle speed is modulated by current drag viscosity
        star.phase += star.speed * dragRef.current;
        const starOpacity = 0.05 + 0.42 * Math.sin(star.phase);
        ctx.fillStyle = `rgba(230, 243, 255, ${Math.max(0, starOpacity)})`;

        const sx = (star.x / 100) * width;
        const sy = (star.y / 100) * height;

        ctx.beginPath();
        ctx.arc(sx, sy, star.size, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.restore();

      // Soft backplate visual nebula reflecting selected color
      const spherePlate = ctx.createRadialGradient(cx, cy, 0, cx, cy, sphereRadius * 1.1);
      if (paletteId === 'aurora') {
        spherePlate.addColorStop(0, 'rgba(16, 185, 129, 0.12)');
        spherePlate.addColorStop(0.5, 'rgba(6, 182, 212, 0.04)');
        spherePlate.addColorStop(1, 'rgba(2, 4, 10, 0)');
      } else if (paletteId === 'cosmos') {
        spherePlate.addColorStop(0, 'rgba(121, 82, 179, 0.12)');
        spherePlate.addColorStop(0.5, 'rgba(78, 84, 200, 0.04)');
        spherePlate.addColorStop(1, 'rgba(2, 4, 10, 0)');
      } else {
        spherePlate.addColorStop(0, 'rgba(255, 140, 0, 0.12)');
        spherePlate.addColorStop(0.5, 'rgba(255, 0, 127, 0.04)');
        spherePlate.addColorStop(1, 'rgba(2, 4, 10, 0)');
      }
      ctx.fillStyle = spherePlate;
      ctx.beginPath();
      ctx.arc(cx, cy, sphereRadius * 1.05, 0, Math.PI * 2);
      ctx.fill();

      // Soft circular lock plate backing (reassures positive circles, minimum cognitive search load)
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.038)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(cx, cy, sphereRadius, 0, Math.PI * 2);
      ctx.stroke();

      // 3. Compute 3D Rotations
      // Slow breathing amplitude multiplier for lines structure
      globalRotationX += dtScaled * 0.00018;
      globalRotationY += dtScaled * 0.00015;
      globalRotationZ += dtScaled * 0.00008;

      const lineMultiplier = (0.2 + Math.cos(timeAccumulator * 0.00035) * 0.45);

      // Enable screen blending for radiant, overlapping lighting elements
      ctx.globalCompositeOperation = 'screen';

      const N = lineDensity; // density selection
      const K = 32; // steps per semicircle curve

      // Touch coordinates relative to the sphere's actual physical center
      const touchRelX = t.screenX - cx;
      const touchRelY = t.screenY - cy;

      const timeSecs = timeAccumulator * 0.0004;

      // 4. Iterate over lines (N slices) to compute and plot the sphere curves
      for (let i = 0; i <= N; i++) {
        const sliceRatio = i / N;
        const latitudeAngle = sliceRatio * Math.PI;
        const sliceRadius = sphereRadius * Math.sin(latitudeAngle);
        const sliceZ = sphereRadius * Math.cos(latitudeAngle);

        // Local rotational twist of this specific slice (creates the weave dynamics)
        const alpha = (i - N / 2) * 0.12 * lineMultiplier;

        // Skip drawing when the slice has negligible radius
        if (sliceRadius < 1.0) continue;

        // Establish soft, organic depth alpha blending (varying transparency based on latitude)
        const depthAlpha = 0.08 + Math.sin(latitudeAngle) * 0.35;

        // Calculate a sliding wave phase across the sphere's shell
        const sliceOsc = Math.sin(sliceRatio * Math.PI * 4.5 - timeAccumulator * 0.0018);
        const sliceBaseOpacity = (0.35 + 0.65 * (sliceOsc * 0.5 + 0.5)) * depthAlpha;

        // --- Custom Aesthetic RGB Gradients based on Palette Choice ---
        // Interpolating beautiful glowing neon palettes
        let r = 0, g = 0, b = 0;
        if (paletteId === 'aurora') {
          // Deep Emerald (16, 185, 129) to Cosmic Teal (6, 182, 212) to Starry Violet/Blue (139, 92, 246)
          if (sliceRatio < 0.45) {
            const k = sliceRatio / 0.45;
            r = 16 + (6 - 16) * k;
            g = 185 + (182 - 185) * k;
            b = 129 + (212 - 129) * k;
          } else {
            const k = (sliceRatio - 0.45) / 0.55;
            r = 6 + (100 - 6) * k;
            g = 182 + (110 - 182) * k;
            b = 212 + (245 - 212) * k;
          }
        } else if (paletteId === 'cosmos') {
          // Royal Blue (78, 84, 200) to Deep Purple (121, 82, 179) to Cosmic Fuchsia/Violet (138, 43, 226)
          if (sliceRatio < 0.45) {
            const k = sliceRatio / 0.45;
            r = 78 + (121 - 78) * k;
            g = 84 + (82 - 84) * k;
            b = 200 + (179 - 200) * k;
          } else {
            const k = (sliceRatio - 0.45) / 0.55;
            r = 121 + (224 - 121) * k;
            g = 82 + (50 - 82) * k;
            b = 179 + (255 - 179) * k;
          }
        } else { // sunset
          // Golden Amber (255, 140, 0) to Deep Coral Rose (224, 49, 49) to Neon Pink (255, 0, 127)
          if (sliceRatio < 0.45) {
            const k = sliceRatio / 0.45;
            r = 255;
            g = 140 + (49 - 140) * k;
            b = 0 + (49 - 0) * k;
          } else {
            const k = (sliceRatio - 0.45) / 0.55;
            r = 224 + (255 - 224) * k;
            g = 49 + (0 - 49) * k;
            b = 49 + (127 - 49) * k;
          }
        }

        ctx.beginPath();
        let drewFirst = false;

        // Generate points along the semicirclar slice
        for (let j = 0; j <= K; j++) {
          const longitudeAngle = (j * Math.PI) / K;

          // Local XY coordinates inside the flat slice
          const lx = sliceRadius * Math.cos(longitudeAngle);
          const ly = sliceRadius * Math.sin(longitudeAngle);
          const lz = sliceZ;

          // Apply local slice rotation around Z axis
          const xr = lx * Math.cos(alpha) - ly * Math.sin(alpha);
          const yr = lx * Math.sin(alpha) + ly * Math.cos(alpha);
          const zr = lz;

          // Apply global 3D rotations (Orthographic projection for center-anchored stability)
          // Rotate around X
          const x1 = xr;
          const y1 = yr * Math.cos(globalRotationX) - zr * Math.sin(globalRotationX);
          const z1 = yr * Math.sin(globalRotationX) + zr * Math.cos(globalRotationX);

          // Rotate around Y
          const x2 = x1 * Math.cos(globalRotationY) + z1 * Math.sin(globalRotationY);
          const y2 = y1;
          const z2 = -x1 * Math.sin(globalRotationY) + z1 * Math.cos(globalRotationY);

          // Rotate around Z
          let x3 = x2 * Math.cos(globalRotationZ) - y2 * Math.sin(globalRotationZ);
          let y3 = x2 * Math.sin(globalRotationZ) + y2 * Math.cos(globalRotationZ);
          const z3 = z2;

          // 5. Apply Liquid Turbulence wiggles modulated down 30% for a gentle ADHD experience
          if (t.factor > 0.005) {
            // Fast atmospheric molecular tremblings (wiggleAmount down 30%: 7 * 0.7 = 4.9)
            const wiggleTime = now * 0.022;
            const wiggleAmount = 4.9 * t.factor * turbulenceScale;

            const wiggleX = Math.sin(y3 * 0.05 + wiggleTime) * Math.cos(z3 * 0.03);
            const wiggleY = Math.cos(x3 * 0.05 + wiggleTime) * Math.sin(z3 * 0.03);

            x3 += wiggleX * wiggleAmount;
            y3 += wiggleY * wiggleAmount;
          }

          // Lock projection to screen center coordinates
          const screenX = cx + x3;
          const screenY = cy + y3;

          if (!drewFirst) {
            ctx.moveTo(screenX, screenY);
            drewFirst = true;
          } else {
            ctx.lineTo(screenX, screenY);
          }
        }

        // --- Double-Pass Rendering for Ultimate Premium Glow Fidelity (replaces Code B solid lines) ---
        // Pass 1: Semi-transparent thick volumetric blur envelope (soft outer colorful neon glow)
        ctx.strokeStyle = `rgba(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}, ${sliceBaseOpacity * 0.35})`;
        ctx.lineWidth = i % 2 === 0 ? 3.0 : 2.2;
        ctx.stroke();

        // Pass 2: High-contrast bright, clean core thread (crisp neon inner filament)
        ctx.strokeStyle = `rgba(238, 246, 255, ${sliceBaseOpacity * 0.82})`;
        ctx.lineWidth = 0.95;
        ctx.stroke();
      }

      // Restore normal composite operations
      ctx.globalCompositeOperation = 'source-over';

      // 6. Draw central micro stardust point (stabilizes the gaze, ADHD-friendly absolute anchor)
      ctx.fillStyle = 'rgba(255, 255, 255, 0.48)';
      ctx.beginPath();
      ctx.arc(cx, cy, 1.8, 0, Math.PI * 2);
      ctx.fill();

      animFrameId = requestAnimationFrame(render);
    };

    animFrameId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animFrameId);
      window.removeEventListener('resize', resizeCanvas);
      window.removeEventListener('orientationchange', resizeCanvas);
    };
  }, [paletteId, breatheSpeed, lineDensity, turbulenceScale]);

  // --- Capture and bind Pointer touch coordinates natively ---
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    // Do not trigger full screen touch interaction if interacting with UI overlay components
    if (
      target.closest('.preferences-panel') || 
      target.closest('#onboarding-modal-container') || 
      target.closest('#btn-onboarding-help') || 
      target.closest('#btn-settings-toggle') ||
      target.closest('#btn-desktop-install')
    ) {
      return;
    }

    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();

    isPressingRef.current = true;
    touchState.current.isInteracting = true;
    touchState.current.screenX = e.clientX - rect.left;
    touchState.current.screenY = e.clientY - rect.top;
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isPressingRef.current) return;
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();

    touchState.current.screenX = e.clientX - rect.left;
    touchState.current.screenY = e.clientY - rect.top;
  };

  const handlePointerUpOrLeave = () => {
    isPressingRef.current = false;
    touchState.current.isInteracting = false;
  };

  const restoreSereneDefaults = () => {
    setPaletteId('aurora');
    setBreatheSpeed(5.5);
    setLineDensity(90);
    setTurbulenceScale(0.2);
    setSoundMode('brown');
    setSoundVolume(0.15);
  };

  return (
    <div 
      ref={containerRef}
      id="viewport-main"
      className="absolute inset-0 w-full h-full overflow-hidden bg-[#02040a] font-sans text-slate-100 select-none touch-none animate-fade-in"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUpOrLeave}
      onPointerLeave={handlePointerUpOrLeave}
    >
      {/* Background stardust stars (visual relaxation backing) */}
      <div className="absolute inset-0 pointer-events-none opacity-40 bg-[radial-gradient(#ffffff0a_1px,transparent_1px)] [background-size:16px_16px]"></div>

      {/* --- CENTRAL INTERACTIVE CANVAS --- */}
      <div className="absolute inset-0 z-0">
        <canvas ref={canvasRef} id="mindful-fluid-sphere-canvas" className="w-full h-full block cursor-none" />
      </div>

      {/* --- HEADER ZONE --- */}
      <header className="absolute top-0 left-0 right-0 p-6 flex items-center justify-end z-40">
        {/* Right PWA Install trigger banner */}
        <div 
          className="flex items-center gap-2 pointer-events-auto"
          onPointerDown={(e) => e.stopPropagation()}
        >
          {isDeferredPrompt && (
            <button
              onClick={handleInstallClick}
              id="btn-desktop-install"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border border-teal-500/25 bg-[#0a122c] text-teal-300 hover:bg-teal-950/40 duration-200 transition-all cursor-pointer"
            >
              <Download size={13} />
              <span>安装至桌面</span>
            </button>
          )}

          <button
            onClick={() => setShowOnboarding(true)}
            aria-label="查看指南"
            id="btn-onboarding-help"
            className="w-8 h-8 rounded-full flex items-center justify-center border border-slate-800 bg-[#090d1f] text-slate-400 hover:text-slate-100 duration-200 transition-all cursor-pointer"
          >
            <HelpCircle size={15} />
          </button>
        </div>
      </header>

      {/* --- ONBOARDING MODAL OR HELPER BANNER --- */}
      <AnimatePresence>
        {showOnboarding && (
          <div 
            className="absolute inset-0 z-50 bg-slate-950/80 flex items-center justify-center p-6 pointer-events-auto"
            onPointerDown={(e) => e.stopPropagation()}
          >
            <motion.div
              initial={{ scale: 0.96, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.96, opacity: 0 }}
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              className="w-full max-w-xs rounded-2xl border border-slate-800 bg-[#05081c]/95 p-6 flex flex-col items-center text-center text-slate-100 shadow-2xl relative"
              id="onboarding-modal-container"
            >
              <button
                onClick={() => setShowOnboarding(false)}
                className="absolute top-4 right-4 w-6 h-6 rounded-full flex items-center justify-center bg-white/[0.03] border border-white/[0.05] text-slate-400 hover:text-slate-100 duration-200 transition-colors"
              >
                <X size={11} />
              </button>

              <div className="flex flex-col items-center gap-4 my-4">
                <div className="w-12 h-12 rounded-full bg-teal-500/10 border border-teal-500/20 flex items-center justify-center text-teal-300/90 animate-pulse">
                  <Sparkles size={20} />
                </div>
                <div className="space-y-1">
                  <h3 className="text-sm font-medium tracking-widest text-[#a5b4fc]">
                    极简视觉呼吸器
                  </h3>
                  <p className="text-[10px] font-mono text-slate-400 uppercase tracking-widest leading-relaxed">
                    YOUR SERENE SANCTUARY
                  </p>
                </div>
                <p className="text-[11px] text-slate-400/80 leading-relaxed font-sans max-w-[200px] mt-1">
                  按住屏幕以注入阻力慢放时间
                  捕捉指尖下平静的微澜颤动
                </p>
              </div>

              <button
                onClick={() => setShowOnboarding(false)}
                className="w-full mt-2 py-2 rounded-xl bg-white/[0.08] hover:bg-white/[0.12] active:bg-white/[0.15] border border-white/[0.1] text-teal-300 font-medium duration-200 transition-all text-xs cursor-pointer tracking-wider"
              >
                开启宁静呼吸
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* --- FLOATING CENTER AMBIENT PROMPT --- */}
      <AnimatePresence>
        {!showOnboarding && showAmbientPrompt && !soundEnabled && (
          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            className="absolute bottom-[28%] left-1/2 -translate-x-1/2 z-40 pointer-events-auto"
            onPointerDown={(e) => e.stopPropagation()}
          >
            <button
              onClick={triggerSoundWithFadeIn}
              className="px-6 py-2.5 rounded-full border border-teal-500/25 bg-[#0d1635] hover:bg-teal-950/40 text-teal-300 text-xs font-medium tracking-widest shadow-lg transition-all duration-300 cursor-pointer flex items-center gap-2 animate-pulse hover:animate-none"
            >
              <Volume2 size={12} className="text-teal-300/80 animate-bounce" />
              <span>开启环境音</span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* --- FLOATING CONTROLS PANEL SLIDER BUTTON --- */}
      <div 
        className="absolute bottom-10 right-5 sm:bottom-6 sm:right-6 z-40 pointer-events-auto"
        onPointerDown={(e) => e.stopPropagation()}
      >
        <button
          onClick={() => setShowSettings(!showSettings)}
          id="btn-settings-toggle"
          className={`h-11 px-4 rounded-full flex items-center gap-2 border duration-300 transition-all shadow-lg cursor-pointer ${
            showSettings 
              ? 'border-teal-500/40 bg-teal-500/20 text-teal-300' 
              : 'border-slate-800 bg-[#0a0f26] text-slate-400 hover:text-slate-200 hover:scale-102'
          }`}
        >
          <Sliders size={15} />
          <span className="text-xs font-semibold">偏好调节与音效</span>
        </button>
      </div>

      {/* --- SETTINGS GLASSBOARD PREFERENCES DRAWER --- */}
      <AnimatePresence>
        {showSettings && (
          <motion.div
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            id="preferences-overlay-panel"
            className="absolute bottom-24 left-4 right-4 sm:left-auto sm:right-6 sm:bottom-20 sm:w-80 z-40 border border-slate-800 bg-slate-950/90 backdrop-blur-md rounded-2xl p-5 shadow-2xl preferences-panel flex flex-col gap-4.5 pointer-events-auto max-h-[60vh] sm:max-h-[75vh] overflow-y-auto"
            onPointerDown={(e) => e.stopPropagation()}
          >
          {/* Title / Header of panel */}
            <div className="flex items-center justify-between border-b border-white/5 pb-2.5">
              <div className="flex items-center gap-1.5 text-slate-200">
                <Sliders size={14} className="text-teal-400" />
                <h4 className="text-xs font-bold tracking-wider uppercase">
                  疗愈偏好调节
                </h4>
              </div>
              
              <div className="flex items-center gap-2">
                <button
                  onClick={restoreSereneDefaults}
                  title="恢复默认"
                  className="p-1 rounded-md text-slate-500 hover:text-slate-300 duration-150"
                  id="btn-reset-preferences"
                >
                  <RotateCcw size={12} />
                </button>
                <button
                  onClick={() => setShowSettings(false)}
                  className="p-1 rounded-md text-slate-500 hover:text-slate-300 duration-150"
                >
                  <X size={12} />
                </button>
              </div>
            </div>

            {/* Config Sliders */}
            <div className="flex flex-col gap-4 text-xs">
              
              {/* Theme Color Selector */}
              <div className="flex flex-col gap-1.5">
                <span className="text-slate-400 font-medium">色彩星境 Color Theme</span>
                <div className="grid grid-cols-3 gap-1.5">
                  {(Object.keys(PALETTES) as PaletteId[]).map((pid) => (
                    <button
                      key={pid}
                      onClick={() => setPaletteId(pid)}
                      className={`py-1.5 px-2 rounded-lg border text-[11px] font-medium transition-all duration-200 cursor-pointer text-center ${
                        paletteId === pid
                          ? 'border-teal-500/30 bg-teal-500/10 text-teal-300'
                          : 'border-slate-900 bg-slate-950/40 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {PALETTES[pid].name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Ambient Sound Preferences Selector */}
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 font-medium">疗愈音效 Ambient Sound</span>
                  <button
                    onClick={() => setSoundEnabled(!soundEnabled)}
                    className={`text-[10px] px-2 py-0.5 rounded-full transition-colors cursor-pointer ${
                      soundEnabled 
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' 
                        : 'bg-slate-900 text-slate-500 border border-slate-800'
                    }`}
                  >
                    {soundEnabled ? '已开启' : '已关闭'}
                  </button>
                </div>
                
                {/* Mode Toggles */}
                <div className="grid grid-cols-2 gap-1.5 mt-0.5">
                  <button
                    onClick={() => {
                      setSoundMode('brown');
                      if (!soundEnabled) setSoundEnabled(true);
                    }}
                    className={`py-1.5 px-2 rounded-lg border text-[10px] font-medium transition-all duration-200 cursor-pointer text-center leading-normal ${
                      soundMode === 'brown' && soundEnabled
                        ? 'border-teal-500/30 bg-teal-500/10 text-teal-300'
                        : 'border-slate-900 bg-slate-950/40 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    布朗噪音（专注模式）
                  </button>
                  <button
                    onClick={() => {
                      setSoundMode('meditation');
                      if (!soundEnabled) setSoundEnabled(true);
                    }}
                    className={`py-1.5 px-2 rounded-lg border text-[10px] font-medium transition-all duration-200 cursor-pointer text-center leading-normal ${
                      soundMode === 'meditation' && soundEnabled
                        ? 'border-teal-500/30 bg-teal-500/10 text-teal-300'
                        : 'border-slate-900 bg-slate-950/40 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    海浪呼吸白噪音（冥想模式）
                  </button>
                </div>
                
                {/* Volume slider */}
                <div className="flex items-center gap-3 mt-1">
                  <button
                    onClick={() => setSoundEnabled(!soundEnabled)}
                    className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200 cursor-pointer"
                  >
                    {soundEnabled ? <Volume2 size={13} /> : <VolumeX size={13} />}
                  </button>
                  <input
                    type="range"
                    min="0.01"
                    max="0.45"
                    step="0.01"
                    value={soundVolume}
                    disabled={!soundEnabled}
                    onChange={(e) => setSoundVolume(parseFloat(e.target.value))}
                    className="flex-1 accent-teal-400 h-1 bg-slate-900 rounded-lg appearance-none cursor-pointer disabled:opacity-40"
                  />
                  <span className="font-mono text-[10px] text-slate-500 w-6 text-right">
                    {Math.round(soundVolume * 100)}%
                  </span>
                </div>
              </div>

              {/* Breathe cycle duration slide */}
              <div className="flex flex-col gap-1.5">
                <div className="flex justify-between">
                  <span className="text-slate-400 font-medium">呼吸速率 (单次循环时长)</span>
                  <span className="text-teal-400 font-mono font-medium">{breatheSpeed.toFixed(1)}秒</span>
                </div>
                <input
                  type="range"
                  min="3.0"
                  max="10.0"
                  step="0.1"
                  value={breatheSpeed}
                  onChange={(e) => setBreatheSpeed(parseFloat(e.target.value))}
                  className="w-full accent-teal-400 h-1 bg-slate-900 rounded-lg appearance-none cursor-pointer"
                />
                <div className="flex justify-between text-[9px] text-slate-500 font-mono">
                  <span>快速降压 (3s)</span>
                  <span>深度放松 (10s)</span>
                </div>
              </div>

              {/* Turbulence displacement scale selector */}
              <div className="flex flex-col gap-1.5">
                <div className="flex justify-between">
                  <span className="text-slate-400 font-medium">触压水波振荡强度</span>
                  <span className="text-teal-400 font-mono font-medium">{Math.round(turbulenceScale * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0.2"
                  max="2.0"
                  step="0.1"
                  value={turbulenceScale}
                  onChange={(e) => setTurbulenceScale(parseFloat(e.target.value))}
                  className="w-full accent-teal-400 h-1 bg-slate-900 rounded-lg appearance-none cursor-pointer"
                />
                <div className="flex justify-between text-[9px] text-slate-500 font-mono">
                  <span>微澜 (20%)</span>
                  <span>清风 (200%)</span>
                </div>
              </div>

              {/* Line density choices */}
              <div className="flex flex-col gap-1.5">
                <span className="text-slate-400 font-medium">环线密度 (运行性能微调)</span>
                <div className="grid grid-cols-3 gap-1.5">
                  {[
                    { label: '极简 (40条)', val: 40 },
                    { label: '平衡 (90条)', val: 90 },
                    { label: '丰盈 (140条)', val: 140 }
                  ].map((density) => (
                    <button
                      key={density.val}
                      onClick={() => setLineDensity(density.val)}
                      className={`py-1 rounded-lg border text-[10px] font-medium transition-all duration-150 cursor-pointer text-center ${
                        lineDensity === density.val
                          ? 'border-teal-500/30 bg-teal-500/10 text-teal-300'
                          : 'border-slate-900 bg-slate-950/40 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {density.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
