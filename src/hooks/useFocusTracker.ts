import { useEffect, useRef, useState, useCallback } from "react";

// ─── Public Types ───────────────────────────────────────────────────────────
export interface FocusMetrics {
  score: number;
  status: "focused" | "distracted" | "away" | "offline" | "sleeping" | "phone";
  gazeDirection: "center" | "left" | "right" | "up" | "down" | "unknown";
  faceDetected: boolean;
  eyesOpen: boolean;
  /** Head rotation around vertical axis (left/right turn), degrees */
  headYaw: number;
  /** Head rotation around horizontal axis (nod up/down), degrees */
  headPitch: number;
  /** Head rotation around depth axis (tilt left/right), degrees */
  headRoll: number;
  /** True when mouth is open wide (yawning) */
  yawning: boolean;
  /** Blinks detected per minute (rolling) */
  blinkRate: number;
  /** 3D gaze yaw from iris vector (degrees, positive = looking right) */
  gazeYaw: number;
  /** 3D gaze pitch from iris vector (degrees, positive = looking down) */
  gazePitch: number;
  /** Pupil engagement index (0–100) derived from relative iris diameter */
  irisEngagement: number;
  /** Combined head+gaze deviation from screen center (degrees) */
  effectiveDeviation: number;
  /** True when a cell phone, laptop, or tablet is detected in frame */
  phoneDetected: boolean;
}

interface UseFocusTrackerOptions {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  onFocusUpdate?: (metrics: FocusMetrics) => void;
  enabled?: boolean;
}

// ─── One-Euro Filter ────────────────────────────────────────────────────────
// Lightweight adaptive low-pass filter. Low jitter when still, low latency
// when moving. No external dependency needed.
class OneEuroFilter {
  private minCutoff: number;
  private beta: number;
  private dCutoff: number;
  private xPrev: number;
  private dxPrev: number;
  private tPrev: number;
  private initialized: boolean;

  constructor(minCutoff = 1.0, beta = 0.007, dCutoff = 1.0) {
    this.minCutoff = minCutoff;
    this.beta = beta;
    this.dCutoff = dCutoff;
    this.xPrev = 0;
    this.dxPrev = 0;
    this.tPrev = 0;
    this.initialized = false;
  }

  private smoothingFactor(cutoff: number, dt: number): number {
    const tau = 1.0 / (2 * Math.PI * cutoff);
    return 1.0 / (1.0 + tau / dt);
  }

  filter(value: number, timestamp: number): number {
    if (!this.initialized) {
      this.xPrev = value;
      this.dxPrev = 0;
      this.tPrev = timestamp;
      this.initialized = true;
      return value;
    }

    const dt = Math.max(timestamp - this.tPrev, 1e-6);
    this.tPrev = timestamp;

    // Derivative
    const dx = (value - this.xPrev) / dt;
    const alphaDx = this.smoothingFactor(this.dCutoff, dt);
    const dxFiltered = alphaDx * dx + (1 - alphaDx) * this.dxPrev;
    this.dxPrev = dxFiltered;

    // Adaptive cutoff
    const cutoff = this.minCutoff + this.beta * Math.abs(dxFiltered);
    const alpha = this.smoothingFactor(cutoff, dt);

    // Filtered value
    const filtered = alpha * value + (1 - alpha) * this.xPrev;
    this.xPrev = filtered;

    return filtered;
  }

  reset(): void {
    this.initialized = false;
  }
}

// ─── Constants ──────────────────────────────────────────────────────────────

/** Camera capture dimensions — higher = more precise landmarks */
const CAPTURE_WIDTH = 640;
const CAPTURE_HEIGHT = 480;

/** Eye Aspect Ratio thresholds */
const EAR_CLOSED_THRESHOLD = 0.15;
/** Duration (ms) below which a closure is just a natural blink */
const BLINK_MAX_DURATION_MS = 350;
/** If blinks/minute exceed this, student is fatigued */
const BLINK_RATE_FATIGUE = 25;

/** Mouth Aspect Ratio — sustained opening above this = yawn */
const MAR_YAWN_THRESHOLD = 0.55;
/** Duration (ms) of sustained mouth-open before counting as yawn */
const YAWN_MIN_DURATION_MS = 1800;

/** Head pose penalty thresholds (degrees) */
const ROLL_THRESHOLD = 20;

/** Dead zone for effective deviation (degrees) — no penalty inside this */
const DEVIATION_DEAD_ZONE = 10;
/** Points deducted per degree of effective deviation beyond dead zone */
const DEVIATION_PENALTY_PER_DEG = 2;

/** 3D gaze: Z-offset to approximate eyeball center behind iris (normalised coords) */
const EYEBALL_Z_OFFSET = 0.035;

/** Iris engagement: rolling window size */
const IRIS_ENGAGEMENT_WINDOW = 30;

/** Smoothing */
const EMA_ALPHA = 0.15;
const HISTORY_SIZE = 30;

/** Sustained-distraction decay — if EMA stays < this for SUSTAIN_TIME_MS, extra decay applies */
const SUSTAIN_SCORE_THRESHOLD = 50;
const SUSTAIN_TIME_MS = 5_000;
const SUSTAIN_DECAY_PER_SEC = 2;

/** Status thresholds */
const STATUS_FOCUSED_MIN = 70;
const STATUS_DISTRACTED_MIN = 35;

/** How often (ms) we push updates to Firestore */
const FIRESTORE_PUSH_INTERVAL_MS = 3_000;

// ─── MediaPipe landmark indices ─────────────────────────────────────────────
// EAR landmarks — six points per eye (inner, upper‑outer, upper‑inner, outer, lower‑inner, lower‑outer)
const LEFT_EYE_EAR = [33, 160, 158, 133, 153, 144];
const RIGHT_EYE_EAR = [362, 385, 387, 263, 380, 373];

// Iris landmarks (available with refineLandmarks: true)
// Left iris: 468 (center), 469 (right), 470 (top), 471 (left), 472 (bottom)
const LEFT_IRIS_CENTER = 468;
const LEFT_IRIS_RING = [469, 470, 471, 472];
// Right iris: 473 (center), 474 (left), 475 (top), 476 (right), 477 (bottom)
const RIGHT_IRIS_CENTER = 473;
const RIGHT_IRIS_RING = [474, 475, 476, 477];

// Eye contour landmarks for eyeball center approximation
// Left eye full contour (upper + lower)
const LEFT_EYE_CONTOUR = [33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246];
// Right eye full contour (upper + lower)
const RIGHT_EYE_CONTOUR = [362, 382, 381, 380, 374, 373, 390, 249, 263, 466, 388, 387, 386, 385, 384, 398];

// Eye corner landmarks for gaze direction classification
const LEFT_EYE_INNER = 133;
const LEFT_EYE_OUTER = 33;
const RIGHT_EYE_INNER = 362;
const RIGHT_EYE_OUTER = 263;

// Eye upper/lower for vertical gaze normalisation & iris height measurement
const LEFT_EYE_TOP = 159;
const LEFT_EYE_BOTTOM = 145;
const RIGHT_EYE_TOP = 386;
const RIGHT_EYE_BOTTOM = 374;

// Head-pose landmarks
const NOSE_TIP = 1;
const FOREHEAD = 10;
const CHIN = 152;
const LEFT_CHEEK = 234;
const RIGHT_CHEEK = 454;
const LEFT_EYE_CENTER_LM = 33;
const RIGHT_EYE_CENTER_LM = 263;

// Mouth landmarks for MAR
const MOUTH_TOP = 13;
const MOUTH_BOTTOM = 14;
const MOUTH_LEFT = 78;
const MOUTH_RIGHT = 308;

// ─── Hook ───────────────────────────────────────────────────────────────────
export function useFocusTracker({ videoRef, onFocusUpdate, enabled = true }: UseFocusTrackerOptions) {
  const [metrics, setMetrics] = useState<FocusMetrics>({
    score: 100,
    status: "focused",
    gazeDirection: "unknown",
    faceDetected: false,
    eyesOpen: true,
    headYaw: 0,
    headPitch: 0,
    headRoll: 0,
    yawning: false,
    blinkRate: 0,
    gazeYaw: 0,
    gazePitch: 0,
    irisEngagement: 50,
    effectiveDeviation: 0,
    phoneDetected: false,
  });

  // Refs for tracking state across frames without causing re-renders
  const lastPushRef = useRef<number>(0);
  const historyRef = useRef<number[]>([]);
  const emaRef = useRef<number>(100);

  // Blink tracking
  const eyeClosedSinceRef = useRef<number | null>(null);
  const blinkTimestampsRef = useRef<number[]>([]);

  // Yawn tracking
  const mouthOpenSinceRef = useRef<number | null>(null);
  const isYawningRef = useRef(false);

  // Sustained distraction tracking
  const lowScoreSinceRef = useRef<number | null>(null);
  const consecutiveMissedFacesRef = useRef(0);

  // One-Euro Filters for gaze smoothing
  const gazeYawFilterRef = useRef(new OneEuroFilter(1.0, 0.007, 1.0));
  const gazePitchFilterRef = useRef(new OneEuroFilter(1.0, 0.007, 1.0));

  // Iris engagement tracking
  const irisRatioHistoryRef = useRef<number[]>([]);
  const baselineIrisRatioRef = useRef<number | null>(null);

  // ── Euclidean distance helper ──
  const dist3d = useCallback((lm: any, i1: number, i2: number): number => {
    const dx = lm[i1].x - lm[i2].x;
    const dy = lm[i1].y - lm[i2].y;
    const dz = (lm[i1].z ?? 0) - (lm[i2].z ?? 0);
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }, []);

  // ── Eye Aspect Ratio ──
  const calculateEAR = useCallback((lm: any): number => {
    const earSingle = (pts: number[]) => {
      const v1 = dist3d(lm, pts[1], pts[5]);
      const v2 = dist3d(lm, pts[2], pts[4]);
      const h = dist3d(lm, pts[0], pts[3]);
      return h > 0 ? (v1 + v2) / (2 * h) : 0;
    };
    return (earSingle(LEFT_EYE_EAR) + earSingle(RIGHT_EYE_EAR)) / 2;
  }, [dist3d]);

  // ── Mouth Aspect Ratio ──
  const calculateMAR = useCallback((lm: any): number => {
    const vertical = dist3d(lm, MOUTH_TOP, MOUTH_BOTTOM);
    const horizontal = dist3d(lm, MOUTH_LEFT, MOUTH_RIGHT);
    return horizontal > 0 ? vertical / horizontal : 0;
  }, [dist3d]);

  // ── Head Pose (yaw, pitch, roll) ──
  const estimateHeadPose = useCallback((lm: any): { yaw: number; pitch: number; roll: number } => {
    // Yaw — nose tip offset from midpoint of cheeks
    const cheekMidX = (lm[LEFT_CHEEK].x + lm[RIGHT_CHEEK].x) / 2;
    const cheekSpan = Math.abs(lm[LEFT_CHEEK].x - lm[RIGHT_CHEEK].x);
    const yaw = cheekSpan > 0 ? ((lm[NOSE_TIP].x - cheekMidX) / cheekSpan) * 90 : 0;

    // Pitch — nose tip Y relative to forehead↔chin span (calibrated so looking straight is ~0 degrees)
    const foreheadChinSpan = Math.abs(lm[FOREHEAD].y - lm[CHIN].y);
    const midY = (lm[FOREHEAD].y + lm[CHIN].y) / 2;
    const rawPitch = foreheadChinSpan > 0 ? ((lm[NOSE_TIP].y - midY) / foreheadChinSpan) * 90 : 0;
    // Offset pitch by 12 degrees to calibrate nose tip being naturally below face center midpoint
    const pitch = rawPitch - 12;

    // Roll — angle of the line connecting eye centres
    const dx = lm[RIGHT_EYE_CENTER_LM].x - lm[LEFT_EYE_CENTER_LM].x;
    const dy = lm[RIGHT_EYE_CENTER_LM].y - lm[LEFT_EYE_CENTER_LM].y;
    const roll = Math.atan2(dy, dx) * (180 / Math.PI);

    return { yaw, pitch, roll };
  }, []);

  // ── 3D Gaze Vector from Iris ──
  // Computes the actual direction the pupil/iris is pointing by constructing
  // a vector from the estimated eyeball center to the iris center landmark.
  const compute3DGaze = useCallback((lm: any, timestamp: number): { gazeYaw: number; gazePitch: number; rawGazeYaw: number; rawGazePitch: number } => {
    // --- Left eye ---
    // Approximate eyeball center: average of contour landmarks with Z offset
    let lCx = 0, lCy = 0, lCz = 0;
    for (const idx of LEFT_EYE_CONTOUR) {
      lCx += lm[idx].x;
      lCy += lm[idx].y;
      lCz += (lm[idx].z ?? 0);
    }
    const lN = LEFT_EYE_CONTOUR.length;
    lCx /= lN; lCy /= lN; lCz /= lN;
    // Push eyeball center behind the surface
    lCz -= EYEBALL_Z_OFFSET;

    // Iris center
    const lIris = lm[LEFT_IRIS_CENTER];
    const lIx = lIris.x, lIy = lIris.y, lIz = lIris.z ?? 0;

    // Gaze vector (iris - eyeball center)
    const lVx = lIx - lCx;
    const lVy = lIy - lCy;
    const lVz = lIz - lCz;

    // --- Right eye ---
    let rCx = 0, rCy = 0, rCz = 0;
    for (const idx of RIGHT_EYE_CONTOUR) {
      rCx += lm[idx].x;
      rCy += lm[idx].y;
      rCz += (lm[idx].z ?? 0);
    }
    const rN = RIGHT_EYE_CONTOUR.length;
    rCx /= rN; rCy /= rN; rCz /= rN;
    rCz -= EYEBALL_Z_OFFSET;

    const rIris = lm[RIGHT_IRIS_CENTER];
    const rIx = rIris.x, rIy = rIris.y, rIz = rIris.z ?? 0;

    const rVx = rIx - rCx;
    const rVy = rIy - rCy;
    const rVz = rIz - rCz;

    // Average gaze vector from both eyes
    const avgVx = (lVx + rVx) / 2;
    const avgVy = (lVy + rVy) / 2;
    const avgVz = (lVz + rVz) / 2;

    // Decompose into yaw (horizontal) and pitch (vertical) angles
    // Note: in MediaPipe's coordinate system, X increases to the right,
    // Y increases downward, Z increases toward the camera.
    // We negate X to correct for the mirrored webcam feed.
    const rawGazeYaw = Math.atan2(-avgVx, avgVz + 1e-9) * (180 / Math.PI);
    const rawGazePitch = Math.atan2(avgVy, avgVz + 1e-9) * (180 / Math.PI);

    // Apply One-Euro filter for temporal smoothing
    const gazeYaw = gazeYawFilterRef.current.filter(rawGazeYaw, timestamp);
    const gazePitch = gazePitchFilterRef.current.filter(rawGazePitch, timestamp);

    return { gazeYaw, gazePitch, rawGazeYaw, rawGazePitch };
  }, []);

  // ── Gaze direction classification from 3D gaze angles ──
  const classifyGazeDirection = useCallback((gazeYaw: number, gazePitch: number): FocusMetrics["gazeDirection"] => {
    // Thresholds for direction classification (degrees)
    const H_THRESHOLD = 12;
    const V_THRESHOLD = 10;

    // Vertical takes priority for strong deviations
    if (gazePitch < -V_THRESHOLD) return "up";
    if (gazePitch > V_THRESHOLD) return "down";
    if (gazeYaw < -H_THRESHOLD) return "left";
    if (gazeYaw > H_THRESHOLD) return "right";
    return "center";
  }, []);

  // ── Pupil Engagement Signal ──
  // Computes relative iris diameter normalised by eye opening height.
  // Tracks rolling average to detect engagement changes.
  const computeIrisEngagement = useCallback((lm: any): number => {
    // Compute iris diameter for each eye using the ring landmarks
    const irisDiam = (center: number, ring: number[]): number => {
      let totalDist = 0;
      for (const idx of ring) {
        const dx = lm[idx].x - lm[center].x;
        const dy = lm[idx].y - lm[center].y;
        const dz = (lm[idx].z ?? 0) - (lm[center].z ?? 0);
        totalDist += Math.sqrt(dx * dx + dy * dy + dz * dz);
      }
      return totalDist / ring.length;
    };

    const leftIrisDiam = irisDiam(LEFT_IRIS_CENTER, LEFT_IRIS_RING);
    const rightIrisDiam = irisDiam(RIGHT_IRIS_CENTER, RIGHT_IRIS_RING);
    const avgIrisDiam = (leftIrisDiam + rightIrisDiam) / 2;

    // Normalise by eye opening height (distance between upper and lower lid)
    const leftEyeH = dist3d(lm, LEFT_EYE_TOP, LEFT_EYE_BOTTOM);
    const rightEyeH = dist3d(lm, RIGHT_EYE_TOP, RIGHT_EYE_BOTTOM);
    const avgEyeH = (leftEyeH + rightEyeH) / 2;

    const irisRatio = avgEyeH > 0 ? avgIrisDiam / avgEyeH : 0;

    // Add to rolling window
    irisRatioHistoryRef.current.push(irisRatio);
    if (irisRatioHistoryRef.current.length > IRIS_ENGAGEMENT_WINDOW) {
      irisRatioHistoryRef.current.shift();
    }

    // Establish baseline from first batch of measurements
    if (baselineIrisRatioRef.current === null && irisRatioHistoryRef.current.length >= 10) {
      baselineIrisRatioRef.current = irisRatioHistoryRef.current.reduce((a, b) => a + b, 0) / irisRatioHistoryRef.current.length;
    }

    if (baselineIrisRatioRef.current === null) return 50; // Neutral until baseline established

    // Current average
    const currentAvg = irisRatioHistoryRef.current.reduce((a, b) => a + b, 0) / irisRatioHistoryRef.current.length;

    // Deviation from baseline as percentage (dilation > baseline = more engaged)
    const deviationPct = ((currentAvg - baselineIrisRatioRef.current) / (baselineIrisRatioRef.current + 1e-9)) * 100;

    // Map to 0-100 range: +20% deviation → 100, -20% → 0, baseline → 50
    return Math.max(0, Math.min(100, Math.round(50 + deviationPct * 2.5)));
  }, [dist3d]);

  // ── Score computation with head-gaze fusion ──
  const computeFusedScore = useCallback(
    (
      faceDetected: boolean,
      eyesOpen: boolean,
      isDrowsy: boolean,
      headYaw: number,
      headPitch: number,
      headRoll: number,
      gazeYaw: number,
      gazePitch: number,
      isYawning: boolean,
      blinkRate: number,
      irisEngagement: number,
    ): { score: number; effectiveDeviation: number } => {
      if (!faceDetected) return { score: 0, effectiveDeviation: 90 };
      if (!eyesOpen && isDrowsy) return { score: 15, effectiveDeviation: 0 };

      let score = 100;

      // ── Head-Gaze Fusion ──
      // Signed addition: if head turns left (-yaw) but eyes look right (+gazeYaw),
      // they cancel out → student is compensating to look at the screen.
      const effectiveYaw = headYaw + gazeYaw;
      const effectivePitch = headPitch + gazePitch;
      const effectiveDeviation = Math.sqrt(effectiveYaw * effectiveYaw + effectivePitch * effectivePitch);

      // Continuous angular penalty with dead zone
      if (effectiveDeviation > DEVIATION_DEAD_ZONE) {
        const excessDeg = effectiveDeviation - DEVIATION_DEAD_ZONE;
        score -= Math.round(excessDeg * DEVIATION_PENALTY_PER_DEG);
      }

      // Roll penalty (head tilt — not compensable by eye movement)
      if (Math.abs(headRoll) > ROLL_THRESHOLD) score -= 20;

      // Yawn penalty
      if (isYawning) score -= 25;

      // High blink-rate fatigue penalty
      if (blinkRate > BLINK_RATE_FATIGUE) score -= 15;

      // Iris engagement bonus/penalty (±5 points)
      // 50 = neutral baseline, >50 = engaged (bonus), <50 = disengaged (penalty)
      const engagementDelta = Math.round((irisEngagement - 50) / 10);
      score += engagementDelta;

      return {
        score: Math.max(0, Math.min(100, Math.round(score))),
        effectiveDeviation: Math.round(effectiveDeviation * 10) / 10,
      };
    },
    [],
  );

  // ─── Main effect — initialise MediaPipe ───────────────────────────────────
  useEffect(() => {
    if (!enabled || !videoRef.current) return;
    const video = videoRef.current;

    let faceMesh: any;
    let camera: any;
    let isCancelled = false;
    let model: any = null;
    let phoneDetected = false;
    let lastDetectionTime = 0;

    const initTracker = async () => {
      try {
        // Load TFJS & COCO-SSD dynamically
        try {
          const loadScript = (src: string): Promise<void> => {
            return new Promise((resolve, reject) => {
              if (document.querySelector(`script[src="${src}"]`)) {
                resolve();
                return;
              }
              const script = document.createElement("script");
              script.src = src;
              script.onload = () => resolve();
              script.onerror = (err) => reject(err);
              document.head.appendChild(script);
            });
          };

          await loadScript("https://cdn.jsdelivr.net/npm/@tensorflow/tfjs");
          await loadScript("https://cdn.jsdelivr.net/npm/@tensorflow-models/coco-ssd");

          const cocoSsd = (window as any).cocoSsd;
          if (cocoSsd) {
            model = await cocoSsd.load();
            console.log("COCO-SSD model loaded successfully!");
          }
        } catch (e) {
          console.warn("Failed to load TFJS or COCO-SSD:", e);
        }

        const faceMeshMod = await import("@mediapipe/face_mesh");
        const cameraUtilsMod = await import("@mediapipe/camera_utils");

        const FaceMeshConstructor = faceMeshMod.FaceMesh || (window as any).FaceMesh;
        const CameraConstructor = cameraUtilsMod.Camera || (window as any).Camera;

        faceMesh = new FaceMeshConstructor({
          locateFile: (file: string) =>
            `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`,
        });

        faceMesh.setOptions({
          maxNumFaces: 1,
          refineLandmarks: true,          // CRITICAL: needed for iris landmarks (468–477)
          minDetectionConfidence: 0.6,
          minTrackingConfidence: 0.6,
        });

        faceMesh.onResults((results: any) => {
          if (isCancelled) return;
          const now = Date.now();

          // Check phone detection status first
          if (phoneDetected) {
            const m: FocusMetrics = {
              score: 0,
              status: "away",
              gazeDirection: "unknown",
              faceDetected: true,
              eyesOpen: true,
              headYaw: 0,
              headPitch: 0,
              headRoll: 0,
              yawning: false,
              blinkRate: 0,
              gazeYaw: 0,
              gazePitch: 0,
              irisEngagement: 0,
              effectiveDeviation: 90,
              phoneDetected: true,
            };
            emaRef.current = 0;
            historyRef.current = [];
            lowScoreSinceRef.current = lowScoreSinceRef.current ?? now;
            setMetrics(m);
            if (onFocusUpdate && now - lastPushRef.current > FIRESTORE_PUSH_INTERVAL_MS) {
              onFocusUpdate(m);
              lastPushRef.current = now;
            }
            return;
          }

          // ── No face detected ──────────────────────────────────────────
          if (!results.multiFaceLandmarks?.length) {
            consecutiveMissedFacesRef.current += 1;
            // Frame-level debounce to prevent flicker on temporary camera glitches (approx 2s at 30fps).
            if (consecutiveMissedFacesRef.current < 60) {
              return;
            }

            const m: FocusMetrics = {
              score: 0,
              status: "away",
              gazeDirection: "unknown",
              faceDetected: false,
              eyesOpen: false,
              headYaw: 0,
              headPitch: 0,
              headRoll: 0,
              yawning: false,
              blinkRate: 0,
              gazeYaw: 0,
              gazePitch: 0,
              irisEngagement: 0,
              effectiveDeviation: 90,
              phoneDetected: false,
            };
            emaRef.current = 0;
            historyRef.current = [];
            lowScoreSinceRef.current = lowScoreSinceRef.current ?? now;
            setMetrics(m);
            if (onFocusUpdate && now - lastPushRef.current > FIRESTORE_PUSH_INTERVAL_MS) {
              onFocusUpdate(m);
              lastPushRef.current = now;
            }
            return;
          }

          const lm = results.multiFaceLandmarks[0];

          // ── Validate face completeness inside visible camera bounds ──
          const criticalLandmarks = [
            NOSE_TIP,
            FOREHEAD,
            CHIN,
            LEFT_CHEEK,
            RIGHT_CHEEK,
          ];

          let faceFullyInFrame = true;
          for (const idx of criticalLandmarks) {
            const pt = lm[idx];
            if (!pt || pt.x < 0.03 || pt.x > 0.97 || pt.y < 0.03 || pt.y > 0.97) {
              faceFullyInFrame = false;
              break;
            }
          }

          if (!faceFullyInFrame) {
            consecutiveMissedFacesRef.current += 1;
            // Frame-level debounce to prevent flicker on temporary camera glitches (approx 2s at 30fps).
            if (consecutiveMissedFacesRef.current < 60) {
              return;
            }

            const m: FocusMetrics = {
              score: 0,
              status: "away",
              gazeDirection: "unknown",
              faceDetected: false,
              eyesOpen: false,
              headYaw: 0,
              headPitch: 0,
              headRoll: 0,
              yawning: false,
              blinkRate: 0,
              gazeYaw: 0,
              gazePitch: 0,
              irisEngagement: 0,
              effectiveDeviation: 90,
              phoneDetected: false,
            };
            emaRef.current = 0;
            historyRef.current = [];
            lowScoreSinceRef.current = lowScoreSinceRef.current ?? now;
            setMetrics(m);
            if (onFocusUpdate && now - lastPushRef.current > FIRESTORE_PUSH_INTERVAL_MS) {
              onFocusUpdate(m);
              lastPushRef.current = now;
            }
            return;
          }

          consecutiveMissedFacesRef.current = 0;

          // ── EAR & blink/drowsy detection ──────────────────────────────
          const ear = calculateEAR(lm);
          const rawEyesClosed = ear < EAR_CLOSED_THRESHOLD;

          let isDrowsy = false;
          let eyesOpen = true;

          if (rawEyesClosed) {
            if (eyeClosedSinceRef.current === null) {
              eyeClosedSinceRef.current = now;
            }
            const closedDuration = now - eyeClosedSinceRef.current;

            if (closedDuration > BLINK_MAX_DURATION_MS) {
              // Sustained closure = drowsy
              isDrowsy = true;
              eyesOpen = false;
            }
            // else: still within natural blink window — don't penalise yet
          } else {
            // Eyes reopened
            if (eyeClosedSinceRef.current !== null) {
              const closedDuration = now - eyeClosedSinceRef.current;
              if (closedDuration <= BLINK_MAX_DURATION_MS) {
                // It was a natural blink — record it
                blinkTimestampsRef.current.push(now);
              }
              eyeClosedSinceRef.current = null;
            }
          }

          // Calculate blink rate (blinks per minute over last 60s window)
          const oneMinuteAgo = now - 60_000;
          blinkTimestampsRef.current = blinkTimestampsRef.current.filter(t => t > oneMinuteAgo);
          const blinkRate = blinkTimestampsRef.current.length;

          // ── Mouth / yawn detection ────────────────────────────────────
          const mar = calculateMAR(lm);
          if (mar > MAR_YAWN_THRESHOLD) {
            if (mouthOpenSinceRef.current === null) mouthOpenSinceRef.current = now;
            if (now - mouthOpenSinceRef.current > YAWN_MIN_DURATION_MS) {
              isYawningRef.current = true;
            }
          } else {
            mouthOpenSinceRef.current = null;
            isYawningRef.current = false;
          }

          // ── Head pose ─────────────────────────────────────────────────
          const head = estimateHeadPose(lm);

          // ── 3D Gaze Vector (retinal tracking) ─────────────────────────
          const gaze3D = eyesOpen
            ? compute3DGaze(lm, now / 1000)
            : { gazeYaw: 0, gazePitch: 0, rawGazeYaw: 0, rawGazePitch: 0 };

          // ── Gaze direction classification ─────────────────────────────
          const gazeDir = eyesOpen
            ? classifyGazeDirection(gaze3D.gazeYaw, gaze3D.gazePitch)
            : "unknown" as FocusMetrics["gazeDirection"];

          // ── Iris engagement ────────────────────────────────────────────
          const irisEngagement = eyesOpen ? computeIrisEngagement(lm) : 50;

          // ── Fused score (head + gaze) ──────────────────────────────────
          const { score: raw, effectiveDeviation } = computeFusedScore(
            true,
            eyesOpen,
            isDrowsy,
            head.yaw,
            head.pitch,
            head.roll,
            gaze3D.gazeYaw,
            gaze3D.gazePitch,
            isYawningRef.current,
            blinkRate,
            irisEngagement,
          );

          // ── EMA smoothing ─────────────────────────────────────────────
          emaRef.current = EMA_ALPHA * raw + (1 - EMA_ALPHA) * emaRef.current;

          // History for additional averaging stability
          historyRef.current.push(emaRef.current);
          if (historyRef.current.length > HISTORY_SIZE) historyRef.current.shift();
          let smoothed = Math.round(
            historyRef.current.reduce((a, b) => a + b, 0) / historyRef.current.length,
          );

          // ── Sustained distraction decay ───────────────────────────────
          if (smoothed < SUSTAIN_SCORE_THRESHOLD) {
            if (lowScoreSinceRef.current === null) {
              lowScoreSinceRef.current = now;
            } else {
              const sustained = now - lowScoreSinceRef.current;
              if (sustained > SUSTAIN_TIME_MS) {
                const extraDecay = Math.floor((sustained - SUSTAIN_TIME_MS) / 1000) * SUSTAIN_DECAY_PER_SEC;
                smoothed = Math.max(0, smoothed - extraDecay);
              }
            }
          } else {
            lowScoreSinceRef.current = null;
          }

          // ── Status classification ─────────────────────────────────────
          let status: FocusMetrics["status"] = "focused";
          if (phoneDetected) {
            status = "phone";
            smoothed = Math.max(0, smoothed - 40);
          } else if (isDrowsy && eyeClosedSinceRef.current !== null && (now - eyeClosedSinceRef.current > 3000)) {
            status = "sleeping";
            smoothed = Math.max(0, smoothed - 50);
          } else if (smoothed < STATUS_DISTRACTED_MIN) {
            status = "away";
          } else if (smoothed < STATUS_FOCUSED_MIN) {
            status = "distracted";
          }

          // ── Build metrics ─────────────────────────────────────────────
          const m: FocusMetrics = {
            score: smoothed,
            status,
            gazeDirection: gazeDir,
            faceDetected: true,
            eyesOpen,
            headYaw: Math.round(head.yaw * 10) / 10,
            headPitch: Math.round(head.pitch * 10) / 10,
            headRoll: Math.round(head.roll * 10) / 10,
            yawning: isYawningRef.current,
            blinkRate,
            gazeYaw: Math.round(gaze3D.gazeYaw * 10) / 10,
            gazePitch: Math.round(gaze3D.gazePitch * 10) / 10,
            irisEngagement,
            effectiveDeviation,
            phoneDetected: false,
          };

          setMetrics(m);

          if (onFocusUpdate && now - lastPushRef.current > FIRESTORE_PUSH_INTERVAL_MS) {
            onFocusUpdate(m);
            lastPushRef.current = now;
          }
        });

        // ── Start camera ────────────────────────────────────────────────
        camera = new CameraConstructor(video, {
          onFrame: async () => {
            if (isCancelled || !faceMesh) return;
            try {
              await faceMesh.send({ image: video });
              
              // Run phone detection check every 1200ms
              const now = Date.now();
              if (model && now - lastDetectionTime > 1200) {
                lastDetectionTime = now;
                const predictions = await model.detect(video);
                const forbiddenObjects = ["cell phone", "laptop", "tablet"];
                phoneDetected = predictions.some((p: any) => 
                  forbiddenObjects.includes(p.class) && p.score > 0.40
                );
              }
            } catch (err) {
              console.warn("Phone detection frame error:", err);
            }
          },
          width: CAPTURE_WIDTH,
          height: CAPTURE_HEIGHT,
        });

        camera.start();
      } catch (err) {
        console.error("Failed to load MediaPipe:", err);
      }
    };

    initTracker();

    return () => {
      isCancelled = true;
      if (camera) camera.stop();
      if (faceMesh) {
        try { faceMesh.close(); } catch { /* ignore */ }
      }
    };
  }, [enabled, videoRef, onFocusUpdate, calculateEAR, calculateMAR, estimateHeadPose, compute3DGaze, classifyGazeDirection, computeIrisEngagement, computeFusedScore]);

  return metrics;
}
