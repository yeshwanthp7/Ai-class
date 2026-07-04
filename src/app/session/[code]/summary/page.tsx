"use client";

import { useSearchParams, useParams, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { AlertCircle, ArrowLeft, Brain, ShieldAlert, BarChart, Users, CheckCircle2, Clock, Sparkles, Download, Award, AlertTriangle } from "lucide-react";
import Link from "next/link";
import {
  subscribeToSession,
  subscribeToStudents,
  subscribeToKicked,
  Session,
  Student,
  KickedStudent
} from "@/lib/session-service";
import { subscribeToAuthChanges } from "@/lib/auth-service";

export default function SummaryPage() {
  const searchParams = useSearchParams();
  const params = useParams();
  const router = useRouter();
  
  const kicked = searchParams.get("kicked") === "true";
  const reason = searchParams.get("reason");
  const sessionCode = (params.code as string)?.toUpperCase() || "UNKNOWN";

  // Auth & Database states
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [studentsList, setStudentsList] = useState<Student[]>([]);
  const [kickedList, setKickedList] = useState<KickedStudent[]>([]);
  const [isTeacher, setIsTeacher] = useState(false);
  const [loading, setLoading] = useState(true);

  // Load auth state
  useEffect(() => {
    const unsubscribe = subscribeToAuthChanges((user) => {
      setCurrentUser(user);
    });
    return () => unsubscribe();
  }, []);

  // Load session & attendance lists
  useEffect(() => {
    if (!sessionCode) return;

    let unsubscribeSession = () => {};
    let unsubscribeStudents = () => {};
    let unsubscribeKicked = () => {};

    try {
      unsubscribeSession = subscribeToSession(
        sessionCode,
        (updatedSession) => {
          if (updatedSession) {
            setSession(updatedSession);
            setLoading(false);
          } else {
            setLoading(false);
          }
        },
        () => setLoading(false)
      );

      unsubscribeStudents = subscribeToStudents(
        sessionCode,
        (list) => {
          setStudentsList(list);
        }
      );

      unsubscribeKicked = subscribeToKicked(
        sessionCode,
        (list) => {
          setKickedList(list);
        }
      );
    } catch (e) {
      console.error(e);
      setLoading(false);
    }

    return () => {
      unsubscribeSession();
      unsubscribeStudents();
      unsubscribeKicked();
    };
  }, [sessionCode]);

  // Determine user role
  useEffect(() => {
    if (session && currentUser) {
      setIsTeacher(session.teacherId === currentUser.uid);
    } else if (session) {
      // Offline fallback check
      setIsTeacher(session.teacherId === "offline-teacher");
    } else {
      setIsTeacher(false);
    }
  }, [session, currentUser]);

  // Export Attendance CSV function
  const handleExportCSV = () => {
    try {
      const headers = ["Student Name", "Status", "Join Time", "Average Focus Score"];
      const rows = [
        ...studentsList.map(s => {
          const joinedTime = s.joinedAt?.seconds 
            ? new Date(s.joinedAt.seconds * 1000).toLocaleTimeString() 
            : "Unknown";
          return [s.name, s.status === "offline" ? "Left Class" : "Present", joinedTime, `${s.engagementScore}%`];
        }),
        ...kickedList.map(k => {
          const kickedTime = k.kickedAt?.seconds 
            ? new Date(k.kickedAt.seconds * 1000).toLocaleTimeString() 
            : "Unknown";
          return [k.name, "Kicked/Removed", kickedTime, "0%"];
        })
      ];

      const csvContent = "data:text/csv;charset=utf-8," 
        + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
      
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", `attendance_report_${sessionCode}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error("CSV export failed:", err);
    }
  };

  const formatTimestamp = (ts: any) => {
    if (!ts) {
      return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    }
    const date = ts.toDate 
      ? ts.toDate() 
      : ts.seconds 
        ? new Date(ts.seconds * 1000) 
        : new Date(ts);
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  // ─── LOADING SCREEN ───
  if (loading) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex flex-col items-center justify-center text-white font-sans">
        <div className="h-8 w-8 rounded-full border-2 border-purple-500 border-t-transparent animate-spin mb-4" />
        <p className="text-sm text-white/60">Loading session summary...</p>
      </div>
    );
  }

  // ─── TEACHER VIEW: ATTENDANCE REPORT ───
  if (isTeacher && session) {
    const totalAttendees = studentsList.length + kickedList.length;
    const avgFocusScore = studentsList.length > 0
      ? Math.floor(studentsList.reduce((acc, s) => acc + (s.engagementScore || 0), 0) / studentsList.length)
      : 0;

    return (
      <div className="min-h-screen bg-[#0A0A0A] text-white font-sans relative pb-12 flex flex-col z-10">
        {/* Glow */}
        <div className="absolute top-0 left-1/4 pointer-events-none -z-10 h-[500px] w-[500px] rounded-full bg-purple-500/5 blur-[120px]" />
        
        {/* Header Section */}
        <header className="h-16 border-b border-[#1a1a1a] bg-[#111111]/80 backdrop-blur-xl px-6 md:px-8 flex items-center justify-between sticky top-0 z-20">
          <div className="flex items-center gap-3">
            <Link href="/dashboard" className="p-2 rounded-xl border border-white/10 hover:bg-white/5 transition-all text-white/80 hover:text-white">
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <h1 className="text-sm md:text-base font-bold text-white tracking-tight flex items-center gap-2">
              <BarChart className="h-4 w-4 text-purple-400" />
              Attendance & Performance Report
            </h1>
          </div>
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 px-4 py-2 text-xs font-bold text-white shadow-sm shadow-purple-500/20 transition-all cursor-pointer"
          >
            <Download className="h-3.5 w-3.5" />
            Export CSV
          </button>
        </header>

        {/* Dashboard Content */}
        <main className="flex-1 p-6 md:p-8 space-y-8 max-w-5xl w-full mx-auto">
          {/* Session Overview Card */}
          <div className="bg-[#111113] border border-white/5 p-6 rounded-3xl space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <span className="text-[10px] text-purple-400 uppercase font-black tracking-widest font-mono">Session Summary</span>
                <h2 className="text-xl font-bold text-white mt-1">{session.title}</h2>
                <p className="text-xs text-white/40 mt-1">{session.subject} • {session.gradeLevel}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs font-semibold text-white/50 bg-[#1a1a1a] px-3.5 py-1.5 rounded-lg border border-white/5 font-mono">
                  CODE: {sessionCode}
                </span>
                <span className="text-xs font-semibold text-emerald-400 bg-emerald-500/10 px-3.5 py-1.5 rounded-lg border border-emerald-500/20 uppercase">
                  Concluded
                </span>
              </div>
            </div>
          </div>

          {/* Stats Row */}
          <section className="grid gap-4 grid-cols-2 lg:grid-cols-4">
            {/* Attendees */}
            <div className="bg-[#1a1a1a] rounded-xl border border-white/5 p-5">
              <div className="flex items-center justify-between text-white/40 mb-3">
                <span className="text-[10px] font-bold uppercase tracking-wider font-mono">Total Attendees</span>
                <Users className="h-4 w-4 text-purple-400" />
              </div>
              <h3 className="text-2xl font-bold text-white">{totalAttendees}</h3>
              <span className="text-[10px] text-white/30 font-medium">Students joined waitlist</span>
            </div>

            {/* Average Focus */}
            <div className="bg-[#1a1a1a] rounded-xl border border-white/5 p-5">
              <div className="flex items-center justify-between text-white/40 mb-3">
                <span className="text-[10px] font-bold uppercase tracking-wider font-mono">Avg Focus Score</span>
                <Brain className="h-4 w-4 text-purple-400" />
              </div>
              <h3 className="text-2xl font-bold text-white">{avgFocusScore}%</h3>
              <span className="text-[10px] text-emerald-400 font-medium">Class focus average</span>
            </div>

            {/* Present Now */}
            <div className="bg-[#1a1a1a] rounded-xl border border-white/5 p-5">
              <div className="flex items-center justify-between text-white/40 mb-3">
                <span className="text-[10px] font-bold uppercase tracking-wider font-mono">Present at Close</span>
                <CheckCircle2 className="h-4 w-4 text-purple-400" />
              </div>
              <h3 className="text-2xl font-bold text-white">
                {studentsList.filter(s => s.status !== "offline").length}
              </h3>
              <span className="text-[10px] text-white/30 font-medium">Active till the end</span>
            </div>

            {/* Kicked Blacklist */}
            <div className="bg-[#1a1a1a] rounded-xl border border-white/5 p-5">
              <div className="flex items-center justify-between text-white/40 mb-3">
                <span className="text-[10px] font-bold uppercase tracking-wider font-mono">Kicked/Dismissed</span>
                <ShieldAlert className="h-4 w-4 text-rose-500" />
              </div>
              <h3 className="text-2xl font-bold text-rose-400">{kickedList.length}</h3>
              <span className="text-[10px] text-white/30 font-medium">Removed for distraction</span>
            </div>
          </section>

          {/* Roster Table */}
          <div className="bg-[#1a1a1a] rounded-xl border border-white/5 overflow-hidden">
            <div className="px-6 py-5 border-b border-white/5 flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-white font-mono">Attendance Roster</h3>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[#242424] text-[9px] font-bold uppercase tracking-wider text-white/40 bg-black/10 font-mono">
                    <th className="px-6 py-3.5">Student Name</th>
                    <th className="px-4 py-3.5">Final Status</th>
                    <th className="px-4 py-3.5">Join Time</th>
                    <th className="px-6 py-3.5 text-right font-mono">Avg Focus Score</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#242424]">
                  {/* Active & Offline Students */}
                  {studentsList.map((student) => {
                    const focusColor = 
                      student.engagementScore >= 80 ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" :
                      student.engagementScore >= 65 ? "text-amber-400 bg-amber-500/10 border-amber-500/20" :
                      "text-rose-400 bg-rose-500/10 border-rose-500/20";
                    
                    return (
                      <tr key={student.id} className="text-xs hover:bg-white/[0.01] transition-colors">
                        <td className="px-6 py-4 font-semibold text-white/95">{student.name}</td>
                        <td className="px-4 py-4">
                          {student.status === "offline" ? (
                            <span className="inline-flex items-center rounded-full bg-white/5 border border-white/10 px-2 py-0.5 text-[9px] font-bold text-white/60 uppercase font-mono">
                              Left Class
                            </span>
                          ) : (
                            <span className="inline-flex items-center rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 text-[9px] font-bold text-emerald-400 uppercase font-mono">
                              Present
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-4 text-white/50">{formatTimestamp(student.joinedAt)}</td>
                        <td className="px-6 py-4 text-right font-mono">
                          <span className={`inline-flex px-2 py-0.5 rounded border text-[10px] font-bold ${focusColor}`}>
                            {student.engagementScore}%
                          </span>
                        </td>
                      </tr>
                    );
                  })}

                  {/* Kicked Students */}
                  {kickedList.map((kickedStud) => (
                    <tr key={kickedStud.id} className="text-xs hover:bg-white/[0.01] transition-colors bg-rose-950/5">
                      <td className="px-6 py-4 font-semibold text-rose-300/90">{kickedStud.name}</td>
                      <td className="px-4 py-4">
                        <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/10 border border-rose-500/20 px-2 py-0.5 text-[9px] font-bold text-rose-400 uppercase font-mono">
                          Kicked
                        </span>
                      </td>
                      <td className="px-4 py-4 text-white/50">{formatTimestamp(kickedStud.kickedAt)}</td>
                      <td className="px-6 py-4 text-right">
                        <span className="inline-flex px-2 py-0.5 rounded border border-rose-500/15 text-rose-400/50 bg-rose-500/5 text-[10px] font-bold font-mono">
                          --
                        </span>
                      </td>
                    </tr>
                  ))}

                  {studentsList.length === 0 && kickedList.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-6 py-8 text-center text-white/40 text-xs font-bold font-mono">
                        No students attended this session.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Navigation Button */}
          <div className="text-center pt-2">
            <button
              onClick={() => router.push("/dashboard")}
              className="px-6 py-3 bg-[#1a1a1a] hover:bg-[#242424] border border-white/5 rounded-xl text-xs font-bold text-white transition-all inline-flex items-center gap-2 cursor-pointer font-mono"
            >
              <ArrowLeft className="h-4 w-4" />
              Return to Dashboard
            </button>
          </div>
        </main>
      </div>
    );
  }

  // ─── STUDENT VIEW ───
  return (
    <div className="min-h-screen bg-[#0A0A0A] flex flex-col items-center justify-center text-white p-6 font-sans">
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff02_1px,transparent_1px),linear-gradient(to_bottom,#ffffff02_1px,transparent_1px)] bg-[size:48px_48px] pointer-events-none z-0" />
      
      <div className="max-w-md w-full relative z-10 bg-[#111111] border border-white/10 p-8 rounded-3xl shadow-2xl text-center space-y-6">
        {kicked ? (
          <>
            <div className="w-20 h-20 bg-rose-500/10 border border-rose-500/20 rounded-full flex items-center justify-center mx-auto mb-2 animate-pulse">
              <ShieldAlert className="w-10 h-10 text-rose-500" />
            </div>
            <h1 className="text-2xl font-black text-white">Removed from Session</h1>
            <p className="text-sm text-white/50 leading-relaxed">
              {reason === "out_of_frame" ? (
                <>You were automatically removed from <span className="font-mono text-rose-400">{sessionCode}</span> because the AI vision system detected you left the camera frame.</>
              ) : reason === "device_usage" ? (
                <>You were automatically removed from <span className="font-mono text-rose-400">{sessionCode}</span> because the AI vision system detected prohibited phone/tablet usage.</>
              ) : (
                <>You were automatically removed from <span className="font-mono text-rose-400">{sessionCode}</span> because the AI vision system detected you were away from your keyboard or deeply distracted for an extended period.</>
              )}
            </p>
          </>
        ) : (
          <>
            <div className="w-20 h-20 bg-purple-500/10 border border-purple-500/20 rounded-full flex items-center justify-center mx-auto mb-2">
              <BarChart className="w-10 h-10 text-purple-400" />
            </div>
            <h1 className="text-2xl font-black text-white font-mono">Session Concluded</h1>
            <p className="text-sm text-white/50 leading-relaxed">
              The lecture <span className="font-mono text-purple-400">{sessionCode}</span> has successfully ended. Your AI-generated performance summary and attendance metrics are being compiled.
            </p>
          </>
        )}

        <div className="pt-4 border-t border-white/10">
          <button
            onClick={() => router.push("/dashboard")}
            className="w-full py-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-sm font-bold text-white transition-all flex items-center justify-center gap-2 cursor-pointer font-mono"
          >
            <ArrowLeft className="w-4 h-4" />
            Return to Dashboard
          </button>
        </div>
      </div>
    </div>
  );
}
