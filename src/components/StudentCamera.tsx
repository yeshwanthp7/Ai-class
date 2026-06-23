"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import { useFocusTracker } from "@/hooks/useFocusTracker";
import { updateStudentEngagement } from "@/lib/session-service";

interface Props {
  sessionCode: string;
  studentId: string;
  enabled: boolean;
  isGridMode?: boolean;
  onLocalFocusUpdate?: (metrics: { score: number; status: "focused" | "distracted" | "away" | "offline" }) => void;
  onStreamReady?: (stream: MediaStream) => void;
}

export default function StudentCamera({ sessionCode, studentId, enabled, isGridMode, onLocalFocusUpdate, onStreamReady }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [denied, setDenied] = useState(false);
  const [active, setActive] = useState(false);
  const [warningLevel, setWarningLevel] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const handleFocusUpdate = useCallback(async (m: { score: number; status: "focused" | "distracted" | "away" | "offline" }) => {
    if (onLocalFocusUpdate) onLocalFocusUpdate(m);
    try {
      await updateStudentEngagement(sessionCode, studentId, m.score, m.status as any);
    } catch (e) {
      console.warn("Engagement update failed:", e);
    }
  }, [sessionCode, studentId, onLocalFocusUpdate]);

  const metrics = useFocusTracker({ videoRef, onFocusUpdate: handleFocusUpdate, enabled: enabled && active });

  useEffect(() => {
    if (!enabled) return;
    const start = async () => {
      // Wait for video ref to be ready
      if (!videoRef.current) {
        console.warn("Video ref not ready, retrying...");
        setTimeout(start, 500);
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 320, height: 240, facingMode: "user" } });
        videoRef.current.srcObject = stream;
        setActive(true);
        console.log("Camera started successfully");
        if (onStreamReady) onStreamReady(stream);
      } catch (err) {
        console.error("Camera failed:", err);
        setDenied(true);
      }
    };
    start();
    return () => {
      if (videoRef.current?.srcObject) {
        (videoRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop());
      }
    };
  }, [enabled]);

  useEffect(() => {
    if (!enabled || !active) return;
    if (metrics.status === "distracted" && warningLevel === 0) {
      timerRef.current = setTimeout(() => setWarningLevel(1), 10000);
    } else if (metrics.status === "distracted" && warningLevel === 1) {
      timerRef.current = setTimeout(() => setWarningLevel(2), 20000);
    } else if (metrics.status === "away" && warningLevel < 3) {
      timerRef.current = setTimeout(() => setWarningLevel(3), 30000);
    } else if (warningLevel === 3 && metrics.status === "away") {
      timerRef.current = setTimeout(() => {
        // Kick: redirect to session summary
        window.location.href = `/session/${sessionCode}/summary?kicked=true`;
      }, 60000);
    } else if (metrics.status === "focused" && warningLevel > 0) {
      if (timerRef.current) clearTimeout(timerRef.current);
      setWarningLevel(0);
    }
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [metrics.status, warningLevel, enabled, active]);

  if (denied) {
    return (
      <div className="absolute inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-rose-500/10 backdrop-blur-md border border-rose-500/20 rounded-xl p-4 text-xs text-rose-400 text-center max-w-xs shadow-2xl">
          <p className="font-bold text-sm mb-1 text-rose-300">Camera Blocked</p>
          <p className="text-rose-400/80 mb-2">Focus tracking is disabled.</p>
          <p className="text-rose-400/90 font-medium bg-rose-500/20 p-2 rounded-lg text-[10px] leading-relaxed">
            If you opened this link from <b>WhatsApp</b> or <b>Instagram</b>, your camera is blocked by the app. Please tap the menu (⋮) and select <b>"Open in Chrome/Safari"</b>.
          </p>
        </div>
      </div>
    );
  }

  const warnings: Record<number, { text: string; color: string }> = {
    1: { text: "👋 Heads up! Try to keep your eyes on the screen.", color: "border-amber-500/30 bg-amber-500/10 text-amber-300" },
    2: { text: "⚠️ Focus needed. The lesson will pause if you don't re-engage.", color: "border-amber-500/50 bg-amber-500/20 text-amber-200" },
    3: { text: "🔒 Lesson paused. Take a breath, then click Resume to continue.", color: "border-rose-500/30 bg-rose-500/10 text-rose-300" },
  };

  return (
    <>
      <video 
        ref={videoRef} 
        autoPlay 
        playsInline 
        muted 
        className={isGridMode 
          ? `absolute inset-0 w-full h-full object-cover z-0 transition-all duration-300 pointer-events-none ${active && enabled ? 'opacity-100' : 'opacity-0'}`
          : `fixed bottom-24 right-6 w-48 h-36 object-cover rounded-2xl border-2 border-white/10 shadow-2xl z-40 transition-all duration-300 pointer-events-none ${active && enabled ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`
        } 
        width={320} 
        height={240} 
      />
      {active && enabled && (
        <div className={isGridMode 
          ? "absolute top-2 right-2 z-10 flex items-center gap-1.5 bg-black/60 backdrop-blur-md px-2 py-1 rounded-full border border-white/10"
          : "fixed bottom-[216px] right-8 z-50 flex items-center gap-2 bg-black/80 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10 animate-in fade-in slide-in-from-bottom-2"
        }>
          <div className={`w-2 h-2 rounded-full animate-pulse ${
            metrics.status === "focused" ? "bg-emerald-400" :
            metrics.status === "distracted" ? "bg-amber-400" :
            metrics.status === "away" ? "bg-rose-400" : "bg-gray-400"
          }`} />
          <span className="text-xs text-white/70 font-mono">{metrics.score}%</span>
          <span className="text-[10px] text-white/40 uppercase tracking-wider">{metrics.status}</span>
        </div>
      )}
      {warningLevel > 0 && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className={`max-w-md mx-4 rounded-2xl border p-6 text-center animate-in fade-in zoom-in duration-300 ${warnings[warningLevel].color}`}>
            <p className="text-lg font-semibold mb-2">{warnings[warningLevel].text}</p>
            <p className="text-sm opacity-70">Focus score: {metrics.score}%</p>
            {warningLevel === 3 && (
              <button onClick={() => setWarningLevel(0)} className="mt-4 px-6 py-2 rounded-xl bg-white/10 hover:bg-white/20 transition-colors text-sm font-medium">
                Resume Learning
              </button>
            )}
          </div>
        </div>
      )}
    </>
  );
}
