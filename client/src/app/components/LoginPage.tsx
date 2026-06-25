import { useState } from "react";
import { Printer, Eye, EyeOff, Lock, Mail, Moon, Sun } from "lucide-react";
import { supabase } from "@/lib/supabase";

interface LoginPageProps {
  onLogin: () => void;
}

export function LoginPage({ onLogin }: LoginPageProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!email || !password) { setError("Please enter your credentials."); return; }
    setLoading(true);
    try {
      const { data: authData, error: authError } =
        await supabase.auth.signInWithPassword({
          email,
          password,
        });

      if (authError) {
        setError("Invalid email or password.");
        setLoading(false);
        return;
      }

      const userId = authData.user.id;

      const { data: profile, error: profileError } =
        await supabase
          .from("users")
          .select("*")
          .eq("id", userId)
          .single();

      if (profileError || !profile) {
        setError("User profile not found.");
        setLoading(false);
        return;
      }

      if (!profile.is_active) {
        setError("Account is disabled.");
        setLoading(false);
        return;
      }

      localStorage.setItem("user", JSON.stringify(profile));

      setLoading(false);
      onLogin();
    } catch {
      setError("Cannot connect to server.");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-full flex bg-slate-50">
      {/* Left panel */}
      <div
        className="hidden lg:flex flex-col justify-between w-[42%] p-12 relative overflow-hidden"
        style={{ background: "linear-gradient(135deg, #0f0c29 0%, #1e1b4b 55%, #4f46e5 100%)" }}
      >
        {/* Grid pattern */}
        <div className="absolute inset-0 opacity-10">
          <svg width="100%" height="100%">
            <defs>
              <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="white" strokeWidth="0.5" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)" />
          </svg>
        </div>
        {/* Floating orbs */}
        <div className="absolute top-20 right-10 w-56 h-56 rounded-full opacity-20" style={{ background: "radial-gradient(circle, #818cf8, transparent)" }} />
        <div className="absolute bottom-32 left-8 w-40 h-40 rounded-full opacity-15" style={{ background: "radial-gradient(circle, #a78bfa, transparent)" }} />

        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-16">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "rgba(255,255,255,0.12)" }}>
              <Printer size={20} className="text-white" />
            </div>
            <div>
              <p className="text-white text-lg" style={{ fontWeight: 700 }}>PrintFlow ERP</p>
              <p className="text-indigo-300 text-xs">Job Management System</p>
            </div>
          </div>

          <h1 className="text-white mb-4" style={{ fontSize: "2.25rem", fontWeight: 800, lineHeight: 1.2 }}>
            Streamline Your<br />
            <span style={{ color: "#a5b4fc" }}>Print Operations</span>
          </h1>
          <p className="text-slate-300 text-sm leading-relaxed max-w-xs">
            Manage jobs, track inventory, monitor production, and optimize delivery — all in one unified ERP platform.
          </p>
        </div>

        <div className="relative z-10 space-y-3">
          {[
            { label: "Active Jobs Today", value: "48" },
            { label: "On-Time Delivery Rate", value: "96.4%" },
            { label: "Machines Online", value: "12 / 14" },
          ].map((stat) => (
            <div key={stat.label} className="flex items-center justify-between p-3 rounded-xl" style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.1)" }}>
              <span className="text-slate-300 text-sm">{stat.label}</span>
              <span className="text-white text-sm" style={{ fontWeight: 700 }}>{stat.value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center p-6 lg:p-16 relative">


        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="flex items-center gap-3 mb-8 lg:hidden">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "#4f46e5" }}>
              <Printer size={17} className="text-white" />
            </div>
            <div>
              <p className="text-slate-900 text-base" style={{ fontWeight: 700 }}>PrintFlow ERP</p>
              <p className="text-slate-400 text-xs">Job Management System</p>
            </div>
          </div>

          <div className="mb-8">
            <h2 className="text-slate-900 mb-1" style={{ fontSize: "1.5rem", fontWeight: 700 }}>Welcome back</h2>
            <p className="text-slate-500 text-sm">Sign in to your account to continue</p>
          </div>

          {error && (
            <div className="mb-4 px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs text-slate-700 mb-1.5" style={{ fontWeight: 500 }}>Email address</label>
              <div className="relative">
                <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none transition-all"
                  style={{ "--tw-ring-color": "rgba(99,102,241,0.2)" } as React.CSSProperties}
                  placeholder="you@company.com"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs text-slate-700 mb-1.5" style={{ fontWeight: 500 }}>Password</label>
              <div className="relative">
                <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-9 pr-10 py-2.5 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none transition-all"
                  placeholder="Enter your password"
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors">
                  {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="w-4 h-4 rounded border-slate-300 accent-indigo-600" />
                <span className="text-xs text-slate-600">Remember me</span>
              </label>
              <button type="button" className="text-xs text-indigo-600 hover:text-indigo-700 transition-colors" style={{ fontWeight: 500 }}>
                Forgot password?
              </button>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-lg text-sm text-white transition-all duration-150 disabled:opacity-70"
              style={{ background: loading ? "#6366f1" : "#4f46e5", fontWeight: 600 }}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                  </svg>
                  Signing in...
                </span>
              ) : "Sign in to PrintFlow"}
            </button>
          </form>

          {/* Removed demo credentials section */}

          <p className="mt-8 text-xs text-slate-400 text-center">© 2026 PrintFlow ERP. All rights reserved.</p>
        </div>
      </div>
    </div>
  );
}
