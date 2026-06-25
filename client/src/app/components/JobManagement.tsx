import { useState } from "react";
import { Search, Plus, Calendar, User, ChevronDown, Clock, AlertCircle, CheckCircle, Truck, Copy, Check, X, Layers, Package } from "lucide-react";

// Types
type JobType = "Sample" | "Production";
type JobStatus = "Pending" | "In Progress" | "QC Pending" | "Completed" | "Dispatched" | "Awaiting Approval" | "Rejected" | "Approved";

interface Job {
  id: string;
  jobType: JobType;
  title: string;
  client: string;
  type: string;
  status: JobStatus;
  priority: "High" | "Medium" | "Low";
  due: string;
  supervisor: string;
  machine: string;
  progress: number;
  value: string;
  created: string;
  // Sample-specific fields
  sampleQty?: number;
  sampleApproved?: boolean;
  parentSampleJobId?: string;
  // Production-specific fields
  quantity?: number;
  productionNotes?: string;
}

// Sample data with mixed job types
const jobs: Job[] = [
  // Sample Jobs
  {
    id: "SJ-0001",
    jobType: "Sample",
    title: "Label Sample - Apex Beverages",
    client: "Apex Beverages Ltd.",
    type: "Label Printing",
    status: "Awaiting Approval",
    priority: "High",
    due: "Jun 20, 2026",
    supervisor: "Ramesh Kumar",
    machine: "PM-3 (Offset)",
    progress: 0,
    value: "₹0",
    created: "Jun 15, 2026",
    sampleQty: 10,
    sampleApproved: false,
  },
  {
    id: "SJ-0002",
    jobType: "Sample",
    title: "Carton Box Sample - Metro Retail",
    client: "Metro Retail Group",
    type: "Carton Box",
    status: "Approved",
    priority: "Medium",
    due: "Jun 19, 2026",
    supervisor: "Suresh Patel",
    machine: "PM-1 (Offset)",
    progress: 0,
    value: "₹0",
    created: "Jun 13, 2026",
    sampleQty: 15,
    sampleApproved: true,
  },
  {
    id: "SJ-0003",
    jobType: "Sample",
    title: "Flexible Pack Sample - FreshFarm",
    client: "FreshFarm Foods",
    type: "Flexible Pack",
    status: "Rejected",
    priority: "Low",
    due: "Jun 18, 2026",
    supervisor: "Anita Singh",
    machine: "FM-2 (Flexo)",
    progress: 0,
    value: "₹0",
    created: "Jun 12, 2026",
    sampleQty: 8,
    sampleApproved: false,
  },
  // Production Jobs
  {
    id: "PJ-0001",
    jobType: "Production",
    title: "Label Printing - Apex Beverages",
    client: "Apex Beverages Ltd.",
    type: "Label Printing",
    status: "In Progress",
    priority: "High",
    due: "Jun 20, 2026",
    supervisor: "Ramesh Kumar",
    machine: "PM-3 (Offset)",
    progress: 65,
    value: "₹84,500",
    created: "Jun 15, 2026",
    parentSampleJobId: "SJ-0001",
    quantity: 5000,
  },
  {
    id: "PJ-0002",
    jobType: "Production",
    title: "Carton Box - Metro Retail",
    client: "Metro Retail Group",
    type: "Carton Box",
    status: "QC Pending",
    priority: "Medium",
    due: "Jun 19, 2026",
    supervisor: "Suresh Patel",
    machine: "PM-1 (Offset)",
    progress: 95,
    value: "₹1,32,000",
    created: "Jun 13, 2026",
    parentSampleJobId: "SJ-0002",
    quantity: 10000,
  },
  {
    id: "PJ-0003",
    jobType: "Production",
    title: "Blister Pack - Sunrise Pharma",
    client: "Sunrise Pharma",
    type: "Blister Pack",
    status: "In Progress",
    priority: "High",
    due: "Jun 22, 2026",
    supervisor: "Ramesh Kumar",
    machine: "BL-1 (Blister)",
    progress: 40,
    value: "₹2,18,000",
    created: "Jun 14, 2026",
    parentSampleJobId: null,
    quantity: 25000,
  },
  {
    id: "PJ-0004",
    jobType: "Production",
    title: "Gift Box - Classic Gifts",
    client: "Classic Gifts Co.",
    type: "Gift Box",
    status: "Pending",
    priority: "Low",
    due: "Jun 25, 2026",
    supervisor: "Pradeep Joshi",
    machine: "Unassigned",
    progress: 0,
    value: "₹45,000",
    created: "Jun 16, 2026",
    parentSampleJobId: null,
    quantity: 2000,
  },
];

const statusConfig: Record<string, { label: string; bg: string; text: string; border: string; icon: React.ReactNode }> = {
  "Pending": { label: "Pending", bg: "bg-slate-50", text: "text-slate-600", border: "border-slate-200", icon: <Clock size={12} /> },
  "In Progress": { label: "In Progress", bg: "bg-indigo-50", text: "text-indigo-700", border: "border-indigo-200", icon: <AlertCircle size={12} /> },
  "QC Pending": { label: "QC Pending", bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200", icon: <AlertCircle size={12} /> },
  "Completed": { label: "Completed", bg: "bg-green-50", text: "text-green-700", border: "border-green-200", icon: <CheckCircle size={12} /> },
  "Dispatched": { label: "Dispatched", bg: "bg-purple-50", text: "text-purple-700", border: "border-purple-200", icon: <Truck size={12} /> },
  "Awaiting Approval": { label: "Awaiting Approval", bg: "bg-yellow-50", text: "text-yellow-700", border: "border-yellow-200", icon: <Clock size={12} /> },
  "Approved": { label: "Approved", bg: "bg-green-50", text: "text-green-700", border: "border-green-200", icon: <CheckCircle size={12} /> },
  "Rejected": { label: "Rejected", bg: "bg-red-50", text: "text-red-700", border: "border-red-200", icon: <X size={12} /> },
};

const priorityColors: Record<string, string> = {
  High: "text-red-600 bg-red-50 border-red-200",
  Medium: "text-amber-600 bg-amber-50 border-amber-200",
  Low: "text-slate-500 bg-slate-50 border-slate-200",
};

const progressColors: Record<string, string> = {
  "Pending": "bg-slate-300",
  "In Progress": "bg-indigo-500",
  "QC Pending": "bg-amber-500",
  "Completed": "bg-green-500",
  "Dispatched": "bg-purple-500",
  "Awaiting Approval": "bg-yellow-500",
  "Approved": "bg-green-500",
  "Rejected": "bg-red-500",
};

export function JobManagement() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [jobTypeFilter, setJobTypeFilter] = useState<"All" | "Sample" | "Production">("All");
  const [viewMode, setViewMode] = useState<"card" | "table">("card");

  const filtered = jobs.filter((j) => {
    const matchesSearch = j.title.toLowerCase().includes(search.toLowerCase()) ||
      j.client.toLowerCase().includes(search.toLowerCase()) ||
      j.id.includes(search);
    const matchesStatus = statusFilter === "All" || j.status === statusFilter;
    const matchesJobType = jobTypeFilter === "All" || j.jobType === jobTypeFilter;
    return matchesSearch && matchesStatus && matchesJobType;
  });

  const statusCounts = {
    Pending: jobs.filter((j) => j.status === "Pending").length,
    "In Progress": jobs.filter((j) => j.status === "In Progress").length,
    "QC Pending": jobs.filter((j) => j.status === "QC Pending").length,
    Completed: jobs.filter((j) => j.status === "Completed").length,
    Dispatched: jobs.filter((j) => j.status === "Dispatched").length,
    "Awaiting Approval": jobs.filter((j) => j.status === "Awaiting Approval").length,
    Approved: jobs.filter((j) => j.status === "Approved").length,
    Rejected: jobs.filter((j) => j.status === "Rejected").length,
  };

  const getParentSample = (job: Job) => {
    if (job.parentSampleJobId) {
      return jobs.find(j => j.id === job.parentSampleJobId);
    }
    return null;
  };

  const handleApproveSample = (jobId: string) => {
    // In real implementation, this would update the backend
    console.log(`Approving sample job: ${jobId}`);
    // Create production job from sample
    const sampleJob = jobs.find(j => j.id === jobId);
    if (sampleJob) {
      const newProductionJob: Job = {
        ...sampleJob,
        id: `PJ-${String(jobs.filter(j => j.jobType === "Production").length + 1).padStart(4, '0')}`,
        jobType: "Production",
        status: "Pending",
        progress: 0,
        value: "₹0",
        parentSampleJobId: sampleJob.id,
        quantity: 1000, // Default quantity
        sampleQty: undefined,
        sampleApproved: undefined,
      };
      console.log("Creating production job:", newProductionJob);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-slate-900" style={{ fontSize: "1.25rem", fontWeight: 700 }}>Job Management</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            {jobs.length} total jobs · {jobs.filter(j => j.jobType === "Production" && j.status === "In Progress").length} in production
          </p>
        </div>
        <button className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg text-white transition-colors" style={{ background: "#4f46e5", fontWeight: 500 }}>
          <Plus size={14} /> New Sample Job
        </button>
      </div>

      {/* Job Type Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-2">
        {[
          { label: "All Jobs", value: "All", count: jobs.length },
          { label: "Sample Jobs", value: "Sample", count: jobs.filter(j => j.jobType === "Sample").length },
          { label: "Production Jobs", value: "Production", count: jobs.filter(j => j.jobType === "Production").length }
        ].map(({ label, value, count }) => {
          const active = jobTypeFilter === value;
          return (
            <button
              key={value}
              onClick={() => setJobTypeFilter(value as any)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border transition-all ${active
                  ? "bg-indigo-600 text-white border-indigo-600"
                  : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"
                }`}
              style={{ fontWeight: active ? 600 : 400 }}
            >
              {value === "Sample" && <Layers size={12} />}
              {value === "Production" && <Package size={12} />}
              {label}
              <span className={`px-1.5 rounded-full text-xs ${active ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500"}`} style={{ fontWeight: 600 }}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Status tabs */}
      <div className="flex flex-wrap gap-2">
        {[{ label: "All", count: jobs.filter(j => jobTypeFilter === "All" || j.jobType === jobTypeFilter).length }, ...Object.entries(statusCounts).map(([k, v]) => ({ label: k, count: v }))].map(({ label, count }) => {
          const conf = label !== "All" ? statusConfig[label] : null;
          const active = statusFilter === label;
          const filteredCount = jobs.filter(j => {
            const matchesType = jobTypeFilter === "All" || j.jobType === jobTypeFilter;
            const matchesStatus = label === "All" || j.status === label;
            return matchesType && matchesStatus;
          }).length;

          if (filteredCount === 0 && label !== "All") return null;

          return (
            <button
              key={label}
              onClick={() => setStatusFilter(label)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border transition-all ${active
                  ? "bg-indigo-600 text-white border-indigo-600"
                  : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"
                }`}
              style={{ fontWeight: active ? 600 : 400 }}
            >
              {conf && !active && <span className={conf.text}>{conf.icon}</span>}
              {label}
              <span className={`px-1.5 rounded-full text-xs ${active ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500"}`} style={{ fontWeight: 600 }}>
                {filteredCount}
              </span>
            </button>
          );
        })}
        <div className="flex-1" />
        <div className="relative">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search jobs..."
            className="pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg w-44 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
          />
        </div>
        <div className="flex border border-slate-200 rounded-lg overflow-hidden">
          <button onClick={() => setViewMode("card")} className={`px-3 py-1.5 text-xs ${viewMode === "card" ? "bg-slate-100 text-slate-800" : "text-slate-500"}`}>Cards</button>
          <button onClick={() => setViewMode("table")} className={`px-3 py-1.5 text-xs ${viewMode === "table" ? "bg-slate-100 text-slate-800" : "text-slate-500"}`}>Table</button>
        </div>
      </div>

      {viewMode === "card" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((job) => {
            const conf = statusConfig[job.status];
            const parentSample = getParentSample(job);
            const isSample = job.jobType === "Sample";
            const isAwaitingApproval = job.status === "Awaiting Approval";

            return (
              <div key={job.id} className="bg-card border border-border rounded-xl p-5 hover:shadow-md transition-all cursor-pointer">
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div>
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className={`text-xs px-1.5 py-0.5 rounded ${isSample ? 'bg-blue-50 text-blue-600' : 'bg-purple-50 text-purple-600'}`} style={{ fontWeight: 600 }}>
                        {job.jobType === "Sample" ? "Sample" : "Production"}
                      </span>
                      <p className="text-indigo-600 text-xs" style={{ fontWeight: 600 }}>{job.id}</p>
                    </div>
                    <p className="text-slate-900 text-sm leading-snug" style={{ fontWeight: 600 }}>{job.title}</p>
                    <p className="text-slate-500 text-xs mt-0.5">{job.client}</p>
                    {parentSample && (
                      <p className="text-xs text-indigo-500 mt-0.5">
                        Created from: {parentSample.id}
                      </p>
                    )}
                  </div>
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs border flex-shrink-0 ${conf.bg} ${conf.text} ${conf.border}`} style={{ fontWeight: 500 }}>
                    {conf.icon} {conf.label}
                  </span>
                </div>

                {isSample && (
                  <div className="bg-slate-50 rounded-lg p-3 mb-3">
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="text-xs text-slate-500">Sample Quantity</p>
                        <p className="text-sm text-slate-900" style={{ fontWeight: 600 }}>{job.sampleQty} pieces</p>
                      </div>
                      {isAwaitingApproval && (
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleApproveSample(job.id)}
                            className="px-2 py-1 text-xs bg-green-500 text-white rounded hover:bg-green-600 transition-colors"
                          >
                            <Check size={14} /> Approve
                          </button>
                          <button className="px-2 py-1 text-xs bg-red-500 text-white rounded hover:bg-red-600 transition-colors">
                            <X size={14} /> Reject
                          </button>
                        </div>
                      )}
                      {job.status === "Approved" && (
                        <span className="text-xs text-green-600 bg-green-50 px-2 py-1 rounded" style={{ fontWeight: 500 }}>
                          ✓ Approved
                        </span>
                      )}
                      {job.status === "Rejected" && (
                        <span className="text-xs text-red-600 bg-red-50 px-2 py-1 rounded" style={{ fontWeight: 500 }}>
                          ✗ Rejected
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {!isSample && (
                  <>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs text-slate-500">Progress</span>
                      <span className="text-xs text-slate-700" style={{ fontWeight: 600 }}>{job.progress}%</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden mb-4">
                      <div
                        className={`h-full rounded-full transition-all ${progressColors[job.status]}`}
                        style={{ width: `${job.progress}%` }}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs mb-3">
                      <div className="flex items-center gap-1.5 text-slate-500">
                        <Calendar size={11} />
                        <span>Due: <span className="text-slate-700">{job.due}</span></span>
                      </div>
                      <div className="flex items-center gap-1.5 text-slate-500">
                        <User size={11} />
                        <span className="text-slate-700 truncate">{job.supervisor}</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded border text-xs ${priorityColors[job.priority]}`} style={{ fontWeight: 500 }}>
                        {job.priority} Priority
                      </span>
                      <span className="text-slate-900 text-sm" style={{ fontWeight: 700 }}>{job.value}</span>
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-border">
                  {["ID", "Type", "Title", "Client", "Status", "Priority", "Due Date", "Supervisor", "Progress", "Value"].map((h) => (
                    <th key={h} className="text-left text-xs text-slate-500 px-4 py-2.5 whitespace-nowrap" style={{ fontWeight: 500 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((job) => {
                  const conf = statusConfig[job.status];
                  const parentSample = getParentSample(job);
                  return (
                    <tr key={job.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className={`text-xs px-1.5 py-0.5 rounded ${job.jobType === "Sample" ? 'bg-blue-50 text-blue-600' : 'bg-purple-50 text-purple-600'}`} style={{ fontWeight: 600 }}>
                            {job.jobType === "Sample" ? "S" : "P"}
                          </span>
                          <span className="text-indigo-600 text-xs" style={{ fontWeight: 600 }}>{job.id}</span>
                        </div>
                        {parentSample && (
                          <div className="text-[10px] text-indigo-400">From: {parentSample.id}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-600 text-xs whitespace-nowrap">{job.jobType}</td>
                      <td className="px-4 py-3 text-slate-800 text-xs max-w-[180px] truncate" style={{ fontWeight: 500 }}>{job.title}</td>
                      <td className="px-4 py-3 text-slate-500 text-xs whitespace-nowrap">{job.client}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs border ${conf.bg} ${conf.text} ${conf.border}`} style={{ fontWeight: 500 }}>
                          {conf.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-1.5 py-0.5 rounded text-xs border ${priorityColors[job.priority]}`} style={{ fontWeight: 500 }}>{job.priority}</span>
                      </td>
                      <td className="px-4 py-3 text-slate-500 text-xs whitespace-nowrap">{job.due}</td>
                      <td className="px-4 py-3 text-slate-600 text-xs whitespace-nowrap">{job.supervisor}</td>
                      <td className="px-4 py-3">
                        {job.jobType === "Production" ? (
                          <div className="flex items-center gap-2">
                            <div className="w-16 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                              <div className={`h-full rounded-full ${progressColors[job.status]}`} style={{ width: `${job.progress}%` }} />
                            </div>
                            <span className="text-xs text-slate-600" style={{ fontWeight: 600 }}>{job.progress}%</span>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-800 text-xs" style={{ fontWeight: 600 }}>{job.value}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}