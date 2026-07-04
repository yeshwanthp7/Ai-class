"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { useFocusTracker, FocusMetrics } from "@/hooks/useFocusTracker";
import { updateStudentEngagement, kickStudent } from "@/lib/session-service";
import { Hand, AlertTriangle, Lock, Eye, EyeOff, Brain, ScanEye } from "lucide-react";

// ─── Constants ──────────────────────────────────────────────────────────────
const CAMERA_WIDTH = 640;
const CAMERA_HEIGHT = 480;

/** Warning escalation timings (ms) — stricter than before */
const WARNING_1_DELAY = 5_000;   // was 10s → now 5s
const WARNING_2_DELAY = 12_000;  // was 20s → now 12s
const WARNING_3_DELAY = 20_000;  // was 30s → now 20s
const AUTO_KICK_DELAY = 45_000;  // was 60s → now 45s

// ─── Component ──────────────────────────────────────────────────────────────

interface Props {
  sessionCode: string;
  studentId: string;
  enabled: boolean;
  isGridMode?: boolean;
  onLocalFocusUpdate?: (metrics: FocusMetrics) => void;
  onStreamReady?: (stream: MediaStream) => void;
}

export default function StudentCamera({
  sessionCode,
  studentId,
  enabled,
  isGridMode,
  onLocalFocusUpdate,
  onStreamReady,
}: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [denied, setDenied] = useState(false);
  const [active, setActive] = useState(false);
  const [warningLevel, setWarningLevel] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Out of frame tracking
  const outOfFrameTimerRef = useRef<NodeJS.Timeout | null>(null);
  const outOfFrameIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [outOfFrameSecondsLeft, setOutOfFrameSecondsLeft] = useState<number | null>(null);
  
  const [phoneWarningCount, setPhoneWarningCount] = useState(0);
  const [showPhoneWarning, setShowPhoneWarning] = useState(false);

  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  // ── Focus update → push to Firestore ──
  const handleFocusUpdate = useCallback(
    async (m: FocusMetrics) => {
      if (onLocalFocusUpdate) onLocalFocusUpdate(m);
      try {
        await updateStudentEngagement(sessionCode, studentId, m.score, m.status);
      } catch {
        // Silently ignore transient network failures
      }
    },
    [sessionCode, studentId, onLocalFocusUpdate],
  );

  const metrics = useFocusTracker({
    videoRef,
    onFocusUpdate: handleFocusUpdate,
    enabled: enabled && active,
  });

  // ── Camera initialisation ──
  useEffect(() => {
    if (!enabled) return;
    let currentStream: MediaStream | null = null;

    const start = async () => {
      if (!videoRef.current) {
        setTimeout(start, 500);
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: CAMERA_WIDTH },
            height: { ideal: CAMERA_HEIGHT },
            facingMode: "user",
          },
        });
        currentStream = stream;
        videoRef.current!.srcObject = stream;
        setActive(true);
        if (onStreamReady) onStreamReady(stream);
      } catch {
        setDenied(true);
      }
    };

    start();

    return () => {
      if (currentStream) currentStream.getTracks().forEach(t => t.stop());
      if (videoRef.current?.srcObject) {
        (videoRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop());
      }
    };
  }, [enabled]);

  // ── Warning escalation engine ──
  useEffect(() => {
    if (!enabled || !active) return;

    const clearPending = () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };

    // Reset when student re-focuses
    if (metrics.status === "focused" && warningLevel > 0) {
      clearPending();
      setWarningLevel(0);
      return;
    }

    // Escalate through warning levels
    if (metrics.status === "distracted" && warningLevel === 0) {
      clearPending();
      timerRef.current = setTimeout(() => setWarningLevel(1), WARNING_1_DELAY);
    } else if (metrics.status === "distracted" && warningLevel === 1) {
      clearPending();
      timerRef.current = setTimeout(() => setWarningLevel(2), WARNING_2_DELAY);
    } else if (metrics.status === "away" && warningLevel < 3) {
      clearPending();
      timerRef.current = setTimeout(() => setWarningLevel(3), WARNING_3_DELAY);
    } else if (warningLevel === 3 && metrics.status === "away") {
      clearPending();
      timerRef.current = setTimeout(async () => {
        const storedName = typeof window !== "undefined" ? localStorage.getItem("studentName") || "Unknown" : "Unknown";
        await kickStudent(sessionCode, studentId, storedName);
        window.location.href = `/session/${sessionCode}/summary?kicked=true`;
      }, AUTO_KICK_DELAY);
    }

    return clearPending;
  }, [metrics.status, warningLevel, enabled, active, sessionCode]);

  // ── Out of frame auto-kick engine ──
  useEffect(() => {
    if (!enabled || !active) return;

    const clearOutOfFrameTimers = () => {
      if (outOfFrameTimerRef.current) {
        clearTimeout(outOfFrameTimerRef.current);
        outOfFrameTimerRef.current = null;
      }
      if (outOfFrameIntervalRef.current) {
        clearInterval(outOfFrameIntervalRef.current);
        outOfFrameIntervalRef.current = null;
      }
      setOutOfFrameSecondsLeft(null);
    };

    if (metrics.faceDetected) {
      clearOutOfFrameTimers();
      return;
    }

    // Start 5-second countdown to auto-kick if not in frame
    setOutOfFrameSecondsLeft(5);

    outOfFrameIntervalRef.current = setInterval(() => {
      setOutOfFrameSecondsLeft(prev => {
        if (prev === null) return null;
        return prev > 1 ? prev - 1 : 0;
      });
    }, 1000);

    outOfFrameTimerRef.current = setTimeout(async () => {
      const storedName = typeof window !== "undefined" ? localStorage.getItem("studentName") || "Unknown" : "Unknown";
      await kickStudent(sessionCode, studentId, storedName);
      window.location.href = `/session/${sessionCode}/summary?kicked=true&reason=out_of_frame`;
    }, 5000);

    return clearOutOfFrameTimers;
  }, [metrics.faceDetected, enabled, active, sessionCode]);

  // ── Phone usage auto-kick engine ──
  useEffect(() => {
    if (!enabled || !active) return;
    
    if (metrics.phoneDetected) {
      setPhoneWarningCount(prev => {
        const next = prev + 1;
        if (next >= 3) {
          const kickAsync = async () => {
            const storedName = typeof window !== "undefined" ? localStorage.getItem("studentName") || "Unknown" : "Unknown";
            await kickStudent(sessionCode, studentId, storedName);
            window.location.href = `/session/${sessionCode}/summary?kicked=true&reason=device_usage`;
          };
          kickAsync();
        }
        return next;
      });
      setShowPhoneWarning(true);
    } else {
      setPhoneWarningCount(0);
      setShowPhoneWarning(false);
    }
  }, [metrics.phoneDetected, enabled, active, sessionCode, studentId]);

  // ── Camera denied fallback ──
  if (denied) {
    return (
      <div className="absolute inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-rose-500/10 backdrop-blur-md border border-rose-500/20 rounded-xl p-4 text-xs text-rose-400 text-center max-w-xs shadow-2xl">
          <p className="font-bold text-sm mb-1 text-rose-300">Camera Blocked</p>
          <p className="text-rose-400/80 mb-2">Focus tracking is disabled.</p>
          <p className="text-rose-400/90 font-medium bg-rose-500/20 p-2 rounded-lg text-[10px] leading-relaxed">
            If you opened this link from <b>WhatsApp</b> or <b>Instagram</b>, your camera is blocked
            by the app. Please tap the menu and select <b>&quot;Open in Chrome/Safari&quot;</b>.
          </p>
        </div>
      </div>
    );
  }

  // ── Warning overlays ──
  const warningConfig: Record<number, { icon: React.ReactNode; text: string; color: string }> = {
    1: {
      icon: <Hand className="h-6 w-6 text-amber-300 mx-auto mb-2" />,
      text: "Heads up! Try to keep your eyes on the screen.",
      color: "border-amber-500/30 bg-amber-500/10 text-amber-300",
    },
    2: {
      icon: <AlertTriangle className="h-6 w-6 text-amber-200 mx-auto mb-2" />,
      text: "Focus needed. The lesson will pause if you don't re-engage.",
      color: "border-amber-500/50 bg-amber-500/20 text-amber-200",
    },
    3: {
      icon: <Lock className="h-6 w-6 text-rose-300 mx-auto mb-2" />,
      text: "Lesson paused. Take a breath, then click Resume to continue.",
      color: "border-rose-500/30 bg-rose-500/10 text-rose-300",
    },
  };

  // Status dot and detail label
  const statusDotColor =
    metrics.status === "focused" ? "bg-emerald-400" :
    metrics.status === "distracted" ? "bg-amber-400" :
    metrics.status === "away" ? "bg-rose-400" : "bg-gray-400";

  const detailLabel = (() => {
    if (!metrics.faceDetected) return "No face";
    if (metrics.yawning) return "Yawning";
    if (!metrics.eyesOpen) return "Eyes closed";
    if (metrics.gazeDirection !== "center" && metrics.gazeDirection !== "unknown") {
      const deg = Math.round(metrics.effectiveDeviation);
      return `Gaze ${metrics.gazeDirection} ${deg}°`;
    }
    return metrics.status;
  })();

  // Iris engagement label & color
  const irisColor =
    metrics.irisEngagement >= 60 ? "text-emerald-400/60" :
    metrics.irisEngagement >= 40 ? "text-amber-400/60" : "text-rose-400/60";

  return (
    <>
      {/* Webcam video element */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className={
          isGridMode
            ? `absolute inset-0 w-full h-full object-cover z-0 transition-all duration-300 pointer-events-none ${active && enabled ? "opacity-100" : "opacity-0"}`
            : `fixed bottom-24 right-6 w-48 h-36 object-cover rounded-2xl border-2 border-white/10 shadow-2xl z-40 transition-all duration-300 pointer-events-none ${active && enabled ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`
        }
        width={CAMERA_WIDTH}
        height={CAMERA_HEIGHT}
      />

      {/* Focus HUD overlay */}
      {active && enabled && (
        <div
          className={
            isGridMode
              ? "absolute top-2 right-2 z-10 flex items-center gap-1.5 bg-black/60 backdrop-blur-md px-2 py-1 rounded-full border border-white/10"
              : "fixed bottom-[216px] right-8 z-50 flex items-center gap-2 bg-black/80 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10 animate-in fade-in slide-in-from-bottom-2"
          }
        >
          <div className={`w-2 h-2 rounded-full animate-pulse ${statusDotColor}`} />
          <span className="text-xs text-white/70 font-mono">{metrics.score}%</span>
          <span className="text-[10px] text-white/40 uppercase tracking-wider">{detailLabel}</span>
          {/* Eye state indicator */}
          {metrics.eyesOpen ? (
            <Eye className="h-3 w-3 text-white/25" />
          ) : (
            <EyeOff className="h-3 w-3 text-rose-400/60" />
          )}
          {/* Iris engagement indicator */}
          {metrics.eyesOpen && metrics.faceDetected && (
            <ScanEye className={`h-3 w-3 ${irisColor}`} />
          )}
          {/* Yawn indicator */}
          {metrics.yawning && (
            <Brain className="h-3 w-3 text-amber-400/70" />
          )}
        </div>
      )}

      {/* Portalled overlays to render on top of all page elements */}
      {mounted && typeof document !== "undefined" && (
        <>
          {/* Warning modal overlay */}
          {warningLevel > 0 && warningConfig[warningLevel] &&
            createPortal(
              <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-md">
                <div
                  className={`max-w-md mx-4 rounded-2xl border p-6 text-center animate-in fade-in zoom-in duration-300 ${warningConfig[warningLevel].color}`}
                >
                  {warningConfig[warningLevel].icon}
                  <p className="text-lg font-semibold mb-2">{warningConfig[warningLevel].text}</p>
                  <p className="text-sm opacity-70">Focus score: {metrics.score}%</p>
                  {warningLevel === 3 && (
                    <button
                      onClick={() => setWarningLevel(0)}
                      className="mt-4 px-6 py-2 rounded-xl bg-white/10 hover:bg-white/20 transition-colors text-sm font-medium cursor-pointer"
                    >
                      Resume Learning
                    </button>
                  )}
                </div>
              </div>,
              document.body
            )
          }

          {/* Out of frame overlay */}
          {outOfFrameSecondsLeft !== null &&
            createPortal(
              <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/70 backdrop-blur-md animate-in fade-in duration-200">
                <div className="max-w-md mx-4 rounded-2xl border border-rose-500/30 bg-[#1A0B0C]/90 p-6 text-center animate-in zoom-in duration-300 text-rose-300 shadow-2xl">
                  <Lock className="h-10 w-10 text-rose-400 mx-auto mb-3 animate-bounce" />
                  <p className="text-xl font-bold mb-2">Face Not Detected</p>
                  <p className="text-sm opacity-90 mb-5">
                    Please align your face within the camera frame.
                  </p>
                  <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-rose-500/20 border border-rose-500/40 mb-5 shadow-[0_0_20px_rgba(239,68,68,0.2)]">
                    <span className="text-3xl font-mono font-black text-rose-400">{outOfFrameSecondsLeft}s</span>
                  </div>
                  <p className="text-xs text-rose-400/60 leading-relaxed">
                    You will be automatically removed from the session in {outOfFrameSecondsLeft} seconds.
                  </p>
                </div>
              </div>,
              document.body
            )
          }

          {/* Phone / Tablet Warning overlay */}
          {showPhoneWarning && phoneWarningCount < 3 &&
            createPortal(
              <div className="fixed inset-0 z-[10001] flex items-center justify-center bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
                <div className="max-w-md mx-4 rounded-2xl border border-rose-500/30 bg-[#1A0B0C]/90 p-6 text-center animate-in zoom-in duration-300 text-rose-300 shadow-2xl">
                  <AlertTriangle className="h-10 w-10 text-rose-400 mx-auto mb-3 animate-bounce" />
                  <p className="text-xl font-bold mb-2">Device Usage Detected</p>
                  <p className="text-sm opacity-90 mb-5">
                    Using phones, tablets, or other secondary screens is strictly prohibited.
                  </p>
                  <div className="inline-flex items-center justify-center px-4 py-2 rounded-lg bg-rose-500/20 border border-rose-500/40 mb-5">
                    <span className="text-sm font-mono font-bold text-rose-400">Warning {phoneWarningCount} of 3</span>
                  </div>
                  <p className="text-xs text-rose-400/60 leading-relaxed">
                    You will be automatically removed from the session if detected 3 times consecutively.
                  </p>
                </div>
              </div>,
              document.body
            )
          }
        </>
      )}
    </>
  );
}
