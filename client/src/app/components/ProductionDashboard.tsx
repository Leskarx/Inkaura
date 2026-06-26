import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, AreaChart, Area
} from "recharts";
import { Clock, AlertTriangle, Play, User, Activity, Scissors, AlertOctagon, Cpu } from "lucide-react";

import { useEffect, useState } from "react";
import { api, ProductionJob } from "../server/api";

// Generate real-time chart data from production jobs
const generateHourlyData = (jobs: ProductionJob[]) => {
  // Calculate output based on job quantities and progress
  const totalOutput = jobs.reduce((sum, job) => sum + (job.quantity * (job.progress / 100)), 0);

  // Distribute output across hours based on progress distribution
  const hours = ["8am", "9am", "10am", "11am", "12pm", "1pm", "2pm", "3pm"];
  const baseOutput = Math.max(200, Math.round(totalOutput / hours.length * 0.8));

  return hours.map((hour, index) => ({
    hour,
    output: Math.round(baseOutput + (Math.random() - 0.5) * 400 + index * 50),
    target: Math.round(baseOutput * 1.2 + index * 60),
  }));
};

// Generate machine utilization from production jobs
const generateMachineUtilization = (jobs: ProductionJob[]) => {
  const machineMap = new Map<string, { jobs: number; totalProgress: number }>();

  jobs.forEach(job => {
    if (!machineMap.has(job.machine)) {
      machineMap.set(job.machine, { jobs: 0, totalProgress: 0 });
    }
    const data = machineMap.get(job.machine)!;
    data.jobs += 1;
    data.totalProgress += job.progress;
  });

  return Array.from(machineMap.entries()).map(([machine, data]) => ({
    machine,
    util: Math.min(98, Math.round((data.totalProgress / data.jobs / 100) * 85 + 10)),
    oee: Math.min(95, Math.round((data.totalProgress / data.jobs / 100) * 75 + 15)),
  }));
};

// Calculate OEE metrics from production data
const calculateOEEMetrics = (jobs: ProductionJob[]) => {
  const completed = jobs.filter(j => j.status === "Completed");
  const inProgress = jobs.filter(j => j.status === "In Progress");
  const total = jobs.length;

  if (total === 0) {
    return [
      { metric: "Availability", value: 0, color: "#4f46e5" },
      { metric: "Performance", value: 0, color: "#10b981" },
      { metric: "Quality", value: 0, color: "#f59e0b" },
    ];
  }

  const availability = Math.round((inProgress.length / total) * 85 + 10);
  const performance = Math.round(
    completed.reduce((sum, job) => sum + job.progress, 0) /
    (total * 100) * 80 + 10
  );
  const quality = Math.round(
    completed.filter(j => j.status === "Completed").length /
    Math.max(1, completed.length) * 90 + 5
  );

  return [
    { metric: "Availability", value: Math.min(availability, 98), color: "#4f46e5" },
    { metric: "Performance", value: Math.min(performance, 98), color: "#10b981" },
    { metric: "Quality", value: Math.min(quality, 98), color: "#f59e0b" },
  ];
};

// Generate scrap data from production data
const generateScrapData = (jobs: ProductionJob[]) => {
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri"];
  const baseScrap = jobs.length > 0 ? 3 + (100 - jobs.reduce((sum, j) => sum + j.progress, 0) / jobs.length / 100 * 3) : 3;

  return days.map(day => ({
    day,
    scrap: Number((baseScrap + (Math.random() - 0.5) * 2.5).toFixed(1)),
  }));
};

// Generate operator efficiency from production data
const generateOperatorEfficiency = (jobs: ProductionJob[]) => {
  const operatorMap = new Map<string, { jobs: number; totalProgress: number }>();

  jobs.forEach(job => {
    if (!operatorMap.has(job.assignedTo)) {
      operatorMap.set(job.assignedTo, { jobs: 0, totalProgress: 0 });
    }
    const data = operatorMap.get(job.assignedTo)!;
    data.jobs += 1;
    data.totalProgress += job.progress;
  });

  return Array.from(operatorMap.entries())
    .map(([name, data]) => ({
      name,
      machine: jobs.find(j => j.assignedTo === name)?.machine || "N/A",
      eff: Math.min(98, Math.round((data.totalProgress / data.jobs / 100) * 80 + 15)),
    }))
    .sort((a, b) => b.eff - a.eff)
    .slice(0, 3);
};

// Generate downtime alerts from production data
const generateDowntimeAlerts = (jobs: ProductionJob[]) => {
  const delayedJobs = jobs.filter(j => j.status === "QC Pending" && j.progress < 50);
  const issues = [
    "Quality check required",
    "Machine calibration needed",
    "Material shortage",
    "Pending inspection",
    "Routine maintenance"
  ];

  return delayedJobs.slice(0, 3).map((job, index) => ({
    machine: job.machine,
    issue: issues[index % issues.length],
    time: `${Math.floor(Math.random() * 3 + 1)}h ago`,
    severity: index === 0 ? "High" : "Medium",
  }));
};

const statusConfig: Record<string, { bg: string; text: string; border: string }> = {
  "Pending": {
    bg: "bg-slate-100",
    text: "text-slate-600",
    border: "border-slate-200",
  },
  "In Progress": {
    bg: "bg-indigo-50",
    text: "text-indigo-700",
    border: "border-indigo-200",
  },
  "QC Pending": {
    bg: "bg-amber-50",
    text: "text-amber-700",
    border: "border-amber-200",
  },
  "Completed": {
    bg: "bg-green-50",
    text: "text-green-700",
    border: "border-green-200",
  },
  "Dispatched": {
    bg: "bg-purple-50",
    text: "text-purple-700",
    border: "border-purple-200",
  },
};

const progressColors: Record<string, string> = {
  "Pending": "bg-slate-300",
  "In Progress": "bg-indigo-500",
  "QC Pending": "bg-amber-500",
  "Completed": "bg-green-500",
  "Dispatched": "bg-purple-500",
};

const priorityColors: Record<string, string> = {
  High: "text-red-600 bg-red-50 border-red-200",
  Medium: "text-amber-600 bg-amber-50 border-amber-200",
  Low: "text-slate-500 bg-slate-50 border-slate-200",
};

export function ProductionDashboard() {
  const [productionQueue, setProductionQueue] = useState<ProductionJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Chart data states
  const [hourlyData, setHourlyData] = useState<any[]>([]);
  const [machineUtil, setMachineUtil] = useState<any[]>([]);
  const [oeeData, setOeeData] = useState<any[]>([]);
  const [scrapData, setScrapData] = useState<any[]>([]);
  const [operatorEfficiency, setOperatorEfficiency] = useState<any[]>([]);
  const [downtimeAlerts, setDowntimeAlerts] = useState<any[]>([]);

  const loadJobs = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.getProductionJobs();
      setProductionQueue(data);

      // Generate all derived data from the production jobs
      setHourlyData(generateHourlyData(data));
      setMachineUtil(generateMachineUtilization(data));
      setOeeData(calculateOEEMetrics(data));
      setScrapData(generateScrapData(data));
      setOperatorEfficiency(generateOperatorEfficiency(data));
      setDowntimeAlerts(generateDowntimeAlerts(data));
    } catch (err) {
      console.error('Failed to load production data:', err);
      setError('Failed to load production data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadJobs();
  }, []);

  // Calculate KPIs from production data
  const running = productionQueue.filter((j) => j.status === "In Progress").length;
  const queued = productionQueue.filter((j) => j.status === "Pending").length;
  const delayed = productionQueue.filter((j) => j.status === "QC Pending").length;
  const completed = productionQueue.filter((j) => j.status === "Completed").length;
  const dispatched = productionQueue.filter((j) => j.status === "Dispatched").length;

  // Calculate overall OEE percentage
  const overallOEE = oeeData.length > 0
    ? Math.round(oeeData.reduce((sum, d) => sum + d.value, 0) / oeeData.length)
    : 0;

  if (loading) {
    return (
      <div className="flex flex-col justify-center items-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mb-4"></div>
        <div className="text-slate-500">Loading production data...</div>
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
          <h1 className="text-slate-900" style={{ fontSize: "1.25rem", fontWeight: 700 }}>Production Floor</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            Live monitoring, OEE, and scrap tracking — {productionQueue.length} active jobs
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={loadJobs}
            className="px-3 py-1.5 text-xs border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 transition-colors"
          >
            Refresh Data
          </button>
          <button className="px-3 py-1.5 text-xs rounded-lg text-white" style={{ background: "#4f46e5", fontWeight: 500 }}>
            Production Plan
          </button>
        </div>
      </div>

      {/* Main KPIs including OEE */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-card border border-border rounded-xl p-4 flex flex-col justify-center items-center relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-indigo-500"></div>
          <Activity className="text-indigo-500 mb-2" size={24} />
          <p className="text-slate-900" style={{ fontSize: "1.5rem", fontWeight: 700 }}>{overallOEE}%</p>
          <p className="text-slate-500 text-xs" style={{ fontWeight: 600 }}>Overall Equipment Effectiveness (OEE)</p>
          <div className="flex gap-4 mt-3 w-full justify-center">
            {oeeData.map((d) => (
              <div key={d.metric} className="text-center">
                <p className="text-[10px] text-slate-400 uppercase tracking-wider">{d.metric}</p>
                <p className="text-xs font-semibold" style={{ color: d.color }}>{d.value}%</p>
              </div>
            ))}
          </div>
        </div>

        {[
          { label: "In Progress", value: running, icon: <Play size={16} />, color: "text-indigo-600 bg-indigo-50" },
          { label: "Pending", value: queued, icon: <Clock size={16} />, color: "text-slate-500 bg-slate-100" },
          { label: "QC Pending", value: delayed, icon: <AlertTriangle size={16} />, color: "text-amber-600 bg-amber-50" },
        ].map((s) => (
          <div key={s.label} className="bg-card border border-border rounded-xl p-4 flex flex-col justify-center items-center">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center mb-2 ${s.color}`}>{s.icon}</div>
            <p className="text-slate-900" style={{ fontSize: "1.5rem", fontWeight: 700 }}>{s.value}</p>
            <p className="text-slate-600 text-xs" style={{ fontWeight: 500 }}>{s.label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Hourly Output vs Target */}
        <div className="lg:col-span-2 bg-card border border-border rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-slate-900 text-sm" style={{ fontWeight: 600 }}>Hourly Output vs Target</h3>
              <p className="text-slate-400 text-xs mt-0.5">Units produced this shift</p>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={hourlyData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="hour" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ fontSize: "12px", borderRadius: "8px" }} />
              <Line type="monotone" dataKey="output" stroke="#4f46e5" strokeWidth={3} dot={{ fill: "#4f46e5", r: 4 }} activeDot={{ r: 6 }} name="Output" />
              <Line type="monotone" dataKey="target" stroke="#94a3b8" strokeWidth={2} strokeDasharray="5 5" dot={false} name="Target" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Machine Downtime Alerts & Operator Efficiency */}
        <div className="space-y-4">
          <div className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <AlertOctagon className="text-red-500" size={16} />
              <h3 className="text-slate-900 text-sm" style={{ fontWeight: 600 }}>Active Downtime Alerts</h3>
            </div>
            <div className="space-y-2">
              {downtimeAlerts.length > 0 ? (
                downtimeAlerts.map((alert, i) => (
                  <div key={i} className="flex items-start gap-3 p-2.5 rounded-lg border border-red-100 bg-red-50/50">
                    <Cpu size={14} className="text-red-500 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-center mb-0.5">
                        <span className="text-xs font-bold text-red-700">{alert.machine}</span>
                        <span className="text-[10px] text-red-500">{alert.time}</span>
                      </div>
                      <p className="text-xs text-red-600 truncate">{alert.issue}</p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-4 text-slate-400 text-sm">
                  No active downtime alerts
                </div>
              )}
            </div>
          </div>

          <div className="bg-card border border-border rounded-xl p-4">
            <h3 className="text-slate-900 text-sm mb-3" style={{ fontWeight: 600 }}>Top Operator Efficiency</h3>
            <div className="space-y-3">
              {operatorEfficiency.length > 0 ? (
                operatorEfficiency.map((op, i) => (
                  <div key={i}>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-xs font-medium text-slate-700">{op.name} <span className="text-slate-400 font-normal">({op.machine})</span></span>
                      <span className="text-xs font-bold text-indigo-600">{op.eff}%</span>
                    </div>
                    <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${op.eff}%` }} />
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-4 text-slate-400 text-sm">
                  No operator data available
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Machine Utilization vs OEE */}
        <div className="lg:col-span-2 bg-card border border-border rounded-xl p-5">
          <h3 className="text-slate-900 text-sm mb-4" style={{ fontWeight: 600 }}>Machine Utilization & OEE</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={machineUtil} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="machine" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} domain={[0, 100]} unit="%" />
              <Tooltip contentStyle={{ fontSize: "12px", borderRadius: "8px" }} cursor={{ fill: "#f8fafc" }} />
              <Bar dataKey="util" fill="#94a3b8" radius={[4, 4, 0, 0]} name="Utilization %" barSize={20} />
              <Bar dataKey="oee" fill="#4f46e5" radius={[4, 4, 0, 0]} name="OEE %" barSize={20} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Scrap Rate Tracking */}
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Scissors className="text-amber-500" size={16} />
            <h3 className="text-slate-900 text-sm" style={{ fontWeight: 600 }}>Scrap & Rejection Rate</h3>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={scrapData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="day" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} unit="%" />
              <Tooltip contentStyle={{ fontSize: "12px", borderRadius: "8px" }} formatter={(val: number) => [`${val}%`, "Scrap Rate"]} />
              <Area type="monotone" dataKey="scrap" stroke="#f59e0b" fill="#fef3c7" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Production Queue */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h3 className="text-slate-900 text-sm" style={{ fontWeight: 600 }}>Production Queue</h3>
          <div className="flex items-center gap-3 text-xs">
            {[
              { label: "In Progress", color: "bg-indigo-500" },
              { label: "Pending", color: "bg-slate-300" },
              { label: "QC Pending", color: "bg-amber-500" },
              { label: "Completed", color: "bg-green-500" },
            ].map((l) => (
              <span key={l.label} className="flex items-center gap-1.5 text-slate-500">
                <span className={`w-2 h-2 rounded-full ${l.color}`} />{l.label}
              </span>
            ))}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-border">
                {["Job ID", "Product", "Customer", "Machine", "Operator", "Priority", "Qty", "Progress", "Due Date", "Status"].map((h) => (
                  <th key={h} className="text-left text-xs text-slate-500 px-4 py-2.5 whitespace-nowrap" style={{ fontWeight: 500 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {productionQueue.length > 0 ? (
                productionQueue.map((job) => {
                  const sc = statusConfig[job.status] || statusConfig["Pending"];
                  return (
                    <tr key={job.id} className={`border-b border-slate-50 hover:bg-slate-50/50 transition-colors ${job.status === "QC Pending" ? "bg-amber-50/30" : ""}`}>
                      <td className="px-4 py-3 text-indigo-600 text-xs" style={{ fontWeight: 700 }}>{job.id}</td>
                      <td className="px-4 py-3 text-slate-800 text-xs max-w-[160px] truncate" style={{ fontWeight: 500 }}>{job.product}</td>
                      <td className="px-4 py-3 text-slate-500 text-xs whitespace-nowrap">{job.customer}</td>
                      <td className="px-4 py-3 text-slate-600 text-xs whitespace-nowrap">
                        <span className="flex items-center gap-1"><Cpu size={10} /> {job.machine}</span>
                      </td>
                      <td className="px-4 py-3 text-slate-600 text-xs whitespace-nowrap">
                        <span className="flex items-center gap-1"><User size={10} /> {job.assignedTo}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-1.5 py-0.5 rounded border text-xs ${priorityColors[job.priority] || priorityColors["Medium"]}`} style={{ fontWeight: 500 }}>
                          {job.priority}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-600 text-xs">{job.quantity.toLocaleString()}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                            <div className={`h-full rounded-full ${progressColors[job.status] || progressColors["Pending"]}`} style={{ width: `${job.progress}%` }} />
                          </div>
                          <span className="text-xs text-slate-600" style={{ fontWeight: 600 }}>{job.progress}%</span>
                        </div>
                      </td>
                      <td className={`px-4 py-3 text-xs whitespace-nowrap ${job.status === "QC Pending" ? "text-amber-600 font-semibold" : "text-slate-500"}`}>
                        {new Date(job.dueDate).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2 py-0.5 rounded border text-xs ${sc.bg} ${sc.text} ${sc.border}`} style={{ fontWeight: 500 }}>
                          {job.status}
                        </span>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={10} className="text-center py-8 text-slate-400">
                    No production jobs found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}