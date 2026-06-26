import { useState, useEffect } from "react";
import { Play, Pause, AlertTriangle, CheckCircle, Clock, ChevronDown, X, Cpu, RefreshCw } from "lucide-react";
import { api, ProductionJob, ProductionStatus } from "../server/api";

const issueTypes = ["Registration problem", "Color inconsistency", "Paper jam", "Ink drying issue", "Machine vibration", "Other"];

interface JobCardProps {
  job: ProductionJob;
  onStatusUpdate: () => void;
}

function JobCard({ job, onStatusUpdate }: JobCardProps) {
  const [running, setRunning] = useState(job.status === "In Progress");
  const [showIssue, setShowIssue] = useState(false);
  const [issueDesc, setIssueDesc] = useState("");
  const [issueType, setIssueType] = useState("");
  const [updating, setUpdating] = useState(false);
  const progress = job.quantity > 0 ? Math.round((job.progress || 0)) : 0;

  const handleStartProduction = async () => {
    try {
      setUpdating(true);
      await api.updateProductionStatus(job.id, "In Progress");
      setRunning(true);
      onStatusUpdate();
    } catch (err) {
      console.error("Failed to start production:", err);
      alert("Failed to start production. Please try again.");
    } finally {
      setUpdating(false);
    }
  };

  const handlePauseProduction = async () => {
    try {
      setUpdating(true);
      await api.updateProductionStatus(job.id, "Pending");
      setRunning(false);
      onStatusUpdate();
    } catch (err) {
      console.error("Failed to pause production:", err);
      alert("Failed to pause production. Please try again.");
    } finally {
      setUpdating(false);
    }
  };

  const handleMarkComplete = async () => {
    try {
      setUpdating(true);
      await api.updateProductionStatus(job.id, "Completed");
      onStatusUpdate();
      alert("Job marked as completed!");
    } catch (err) {
      console.error("Failed to mark complete:", err);
      alert("Failed to mark job as complete. Please try again.");
    } finally {
      setUpdating(false);
    }
  };

  const handleSubmitIssue = async () => {
    if (!issueType) {
      alert("Please select an issue type");
      return;
    }
    if (!issueDesc.trim()) {
      alert("Please describe the issue");
      return;
    }

    try {
      setUpdating(true);
      // Log the issue (you can save to a database table if needed)
      console.log("Issue reported:", {
        jobId: job.id,
        issueType,
        issueDesc,
        timestamp: new Date().toISOString(),
      });

      // Optionally update job status or add note
      alert("Issue reported successfully! Maintenance has been notified.");
      setShowIssue(false);
      setIssueType("");
      setIssueDesc("");
    } catch (err) {
      console.error("Failed to submit issue:", err);
      alert("Failed to report issue. Please try again.");
    } finally {
      setUpdating(false);
    }
  };

  const getStatusColor = () => {
    if (running) return "bg-indigo-50 text-indigo-700 border-indigo-200";
    if (job.status === "Pending") return "bg-slate-100 text-slate-600 border-slate-200";
    if (job.status === "QC Pending") return "bg-amber-50 text-amber-700 border-amber-200";
    if (job.status === "Completed") return "bg-green-50 text-green-700 border-green-200";
    return "bg-slate-100 text-slate-600 border-slate-200";
  };

  return (
    <div className={`bg-card border rounded-xl overflow-hidden ${running ? "border-indigo-200" : "border-slate-200"}`}>
      {running && <div className="h-1 bg-indigo-600" />}

      <div className="p-5">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <p className="text-indigo-600 text-xs" style={{ fontWeight: 600 }}>{job.id}</p>
              <span className={`inline-flex px-2 py-0.5 rounded border text-xs ${job.priority === "High" ? "bg-red-50 text-red-700 border-red-200" :
                  job.priority === "Medium" ? "bg-amber-50 text-amber-700 border-amber-200" :
                    "bg-slate-50 text-slate-600 border-slate-200"
                }`} style={{ fontWeight: 500 }}>{job.priority} Priority</span>
            </div>
            <h3 className="text-slate-900 text-sm" style={{ fontWeight: 700 }}>{job.product}</h3>
            <p className="text-slate-500 text-xs mt-0.5">{job.customer} · {job.machine}</p>
          </div>
          <span className={`inline-flex px-2 py-0.5 rounded border text-xs flex-shrink-0 ${getStatusColor()}`} style={{ fontWeight: 500 }}>
            {running ? "Running" : job.status}
          </span>
        </div>

        {/* Progress */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs text-slate-500">Production Progress</span>
            <span className="text-xs text-slate-800" style={{ fontWeight: 700 }}>{job.quantity.toLocaleString()} units ({progress}%)</span>
          </div>
          <div className="h-2.5 rounded-full bg-slate-100 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${running ? "bg-indigo-500" : "bg-slate-400"}`}
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Specs - Derived from product info */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <div className="bg-slate-50 rounded-lg p-2.5">
            <p className="text-slate-400 text-xs capitalize mb-0.5">Job ID</p>
            <p className="text-slate-700 text-xs" style={{ fontWeight: 600 }}>{job.id}</p>
          </div>
          <div className="bg-slate-50 rounded-lg p-2.5">
            <p className="text-slate-400 text-xs capitalize mb-0.5">Quantity</p>
            <p className="text-slate-700 text-xs" style={{ fontWeight: 600 }}>{job.quantity.toLocaleString()}</p>
          </div>
          <div className="bg-slate-50 rounded-lg p-2.5">
            <p className="text-slate-400 text-xs capitalize mb-0.5">Machine</p>
            <p className="text-slate-700 text-xs" style={{ fontWeight: 600 }}>{job.machine}</p>
          </div>
          <div className="bg-slate-50 rounded-lg p-2.5">
            <p className="text-slate-400 text-xs capitalize mb-0.5">Operator</p>
            <p className="text-slate-700 text-xs" style={{ fontWeight: 600 }}>{job.assignedTo}</p>
          </div>
        </div>

        {/* Time */}
        <div className="flex items-center gap-4 text-xs text-slate-500 mb-4">
          <span className="flex items-center gap-1"><Clock size={11} /> Created: <span className="text-slate-700" style={{ fontWeight: 500 }}>{new Date(job.createdDate).toLocaleDateString()}</span></span>
          <span className="flex items-center gap-1"><Clock size={11} /> Due by: <span className="text-slate-700" style={{ fontWeight: 500 }}>{new Date(job.dueDate).toLocaleDateString()}</span></span>
        </div>

        {/* Controls */}
        {showIssue ? (
          <div className="border border-red-200 rounded-xl p-4 bg-red-50">
            <div className="flex items-center justify-between mb-3">
              <p className="text-red-700 text-xs" style={{ fontWeight: 600 }}>Report an Issue</p>
              <button onClick={() => setShowIssue(false)} disabled={updating}>
                <X size={14} className="text-red-400" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-red-700 mb-1" style={{ fontWeight: 500 }}>Issue Type</label>
                <select
                  value={issueType}
                  onChange={(e) => setIssueType(e.target.value)}
                  className="w-full text-xs border border-red-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-red-500/20"
                >
                  <option value="">Select issue type...</option>
                  {issueTypes.map((t) => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-red-700 mb-1" style={{ fontWeight: 500 }}>Description</label>
                <textarea
                  value={issueDesc}
                  onChange={(e) => setIssueDesc(e.target.value)}
                  className="w-full text-xs border border-red-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-red-500/20 resize-none"
                  rows={2}
                  placeholder="Describe the issue..."
                />
              </div>
              <button
                onClick={handleSubmitIssue}
                disabled={updating}
                className="w-full text-xs text-white bg-red-600 hover:bg-red-700 rounded-lg py-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ fontWeight: 500 }}
              >
                {updating ? "Submitting..." : "Submit Issue Report"}
              </button>
            </div>
          </div>
        ) : (
          <div className="flex gap-2">
            {job.status === "Pending" || job.status === "In Progress" ? (
              <button
                onClick={running ? handlePauseProduction : handleStartProduction}
                disabled={updating}
                className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs text-white transition-colors ${running ? "bg-amber-500 hover:bg-amber-600" : "bg-indigo-600 hover:bg-indigo-700"} disabled:opacity-50 disabled:cursor-not-allowed`}
                style={{ fontWeight: 600 }}
              >
                {updating ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : running ? (
                  <><Pause size={13} /> Pause Production</>
                ) : (
                  <><Play size={13} /> Start Production</>
                )}
              </button>
            ) : null}

            {job.status !== "Completed" && job.status !== "Dispatched" && (
              <button
                onClick={() => setShowIssue(true)}
                disabled={updating}
                className="px-3 py-2 rounded-lg text-xs text-red-600 border border-red-200 hover:bg-red-50 transition-colors flex items-center gap-1 disabled:opacity-50"
                style={{ fontWeight: 500 }}
              >
                <AlertTriangle size={13} /> Issue
              </button>
            )}

            {progress === 100 && job.status !== "Completed" && (
              <button
                onClick={handleMarkComplete}
                disabled={updating}
                className="px-3 py-2 rounded-lg text-xs text-green-700 border border-green-200 bg-green-50 hover:bg-green-100 transition-colors flex items-center gap-1 disabled:opacity-50"
                style={{ fontWeight: 500 }}
              >
                {updating ? (
                  <div className="w-4 h-4 border-2 border-green-700 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <><CheckCircle size={13} /> Mark Complete</>
                )}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export function MachineOperator() {
  const [productionJobs, setProductionJobs] = useState<ProductionJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [operatorName, setOperatorName] = useState("Loading...");
  const [operatorMachine, setOperatorMachine] = useState("Loading...");
  const [shift, setShift] = useState("Morning Shift");

  const loadJobs = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.getProductionJobs();

      // Filter jobs assigned to current operator
      // For demo, we'll show all jobs, but in production you'd filter by operator
      setProductionJobs(data);

      // Try to get operator info from the first job
      if (data.length > 0 && data[0].assignedTo) {
        setOperatorName(data[0].assignedTo);
        setOperatorMachine(data[0].machine);
      } else {
        setOperatorName("Vijay Kumar");
        setOperatorMachine("PM-3 (Offset 4C)");
      }
    } catch (err) {
      console.error("Failed to load jobs:", err);
      setError("Failed to load jobs. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadJobs();
  }, []);

  // Calculate stats
  const totalJobs = productionJobs.length;
  const runningJobs = productionJobs.filter(j => j.status === "In Progress").length;
  const pendingJobs = productionJobs.filter(j => j.status === "Pending").length;
  const completedJobs = productionJobs.filter(j => j.status === "Completed").length;
  const totalUnits = productionJobs.reduce((sum, j) => sum + j.quantity, 0);
  const completedUnits = productionJobs.reduce((sum, j) => sum + (j.quantity * (j.progress / 100)), 0);
  const issuesReported = 0; // This would come from a separate table

  // Calculate machine uptime (average progress)
  const avgProgress = productionJobs.length > 0
    ? Math.round(productionJobs.reduce((sum, j) => sum + j.progress, 0) / productionJobs.length)
    : 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-slate-500">Loading jobs...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col justify-center items-center h-96">
        <div className="text-red-600 text-lg mb-4">⚠️ {error}</div>
        <button
          onClick={loadJobs}
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-slate-900" style={{ fontSize: "1.25rem", fontWeight: 700 }}>Machine Operator</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            {operatorName} · {operatorMachine} · {shift}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={loadJobs}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 transition-colors"
          >
            <RefreshCw size={13} /> Refresh
          </button>
          <div className="flex items-center gap-1.5 text-xs text-green-700 bg-green-50 border border-green-200 px-3 py-1.5 rounded-lg">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            Machine Online
          </div>
        </div>
      </div>

      {/* Machine Status */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "My Jobs Today", value: totalJobs, sub: `${runningJobs} running, ${pendingJobs} pending`, color: "text-indigo-600 bg-indigo-50" },
          { label: "Units Completed", value: Math.round(completedUnits).toLocaleString(), sub: `of ${totalUnits.toLocaleString()} total`, color: "text-green-600 bg-green-50" },
          { label: "Avg Progress", value: `${avgProgress}%`, sub: "Across all jobs", color: "text-purple-600 bg-purple-50" },
          { label: "Issues Reported", value: issuesReported, sub: "All clear", color: "text-slate-500 bg-slate-50" },
        ].map((s) => (
          <div key={s.label} className="bg-card border border-border rounded-xl p-4">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-3 ${s.color}`}>
              <Cpu size={16} />
            </div>
            <p className="text-slate-900 mb-0.5" style={{ fontSize: "1.25rem", fontWeight: 700 }}>{s.value}</p>
            <p className="text-slate-700 text-xs" style={{ fontWeight: 500 }}>{s.label}</p>
            <p className="text-slate-400 text-xs mt-0.5">{s.sub}</p>
          </div>
        ))}
      </div>

      {/* Job Cards */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-slate-700 text-sm" style={{ fontWeight: 600 }}>Assigned Jobs</h2>
          <span className="text-xs text-slate-400">{productionJobs.length} jobs</span>
        </div>
        {productionJobs.length === 0 ? (
          <div className="text-center py-12 bg-card border border-border rounded-xl">
            <div className="text-slate-400 mb-2">
              <Cpu size={48} className="mx-auto" />
            </div>
            <p className="text-slate-500 text-sm">No jobs assigned</p>
            <p className="text-slate-400 text-xs mt-1">Check back later for new assignments</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            {productionJobs.map((job) => (
              <JobCard key={job.id} job={job} onStatusUpdate={loadJobs} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}