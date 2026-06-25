import { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import {
    Search, Calendar, User, Clock, AlertCircle, CheckCircle, Truck,
    Package, Settings, Eye, RefreshCw, AlertTriangle,
    Plus, Edit, Save, X as CloseIcon, ArrowRight
} from "lucide-react";
import { api, ProductionJob, ProductionStatus, Priority } from "../server/api";

const statusConfig: Record<ProductionStatus, { label: string; bg: string; text: string; border: string; icon: React.ReactNode }> = {
    "Pending": { label: "Pending", bg: "bg-slate-50", text: "text-slate-600", border: "border-slate-200", icon: <Clock size={12} /> },
    "In Progress": { label: "In Progress", bg: "bg-indigo-50", text: "text-indigo-700", border: "border-indigo-200", icon: <AlertCircle size={12} /> },
    "QC Pending": { label: "QC Pending", bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200", icon: <AlertCircle size={12} /> },
    "Completed": { label: "Completed", bg: "bg-green-50", text: "text-green-700", border: "border-green-200", icon: <CheckCircle size={12} /> },
    "Dispatched": { label: "Dispatched", bg: "bg-purple-50", text: "text-purple-700", border: "border-purple-200", icon: <Truck size={12} /> },
};

const priorityColors: Record<Priority, string> = {
    High: "text-red-600 bg-red-50 border-red-200",
    Medium: "text-amber-600 bg-amber-50 border-amber-200",
    Low: "text-slate-500 bg-slate-50 border-slate-200",
};

const progressColors: Record<ProductionStatus, string> = {
    "Pending": "bg-slate-300",
    "In Progress": "bg-indigo-500",
    "QC Pending": "bg-amber-500",
    "Completed": "bg-green-500",
    "Dispatched": "bg-purple-500",
};

export function ProductionJobs() {
    const location = useLocation();
    const [productionJobs, setProductionJobs] = useState<ProductionJob[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState<"All" | ProductionStatus>("All");
    const [viewMode, setViewMode] = useState<"card" | "table">("card");
    const [selectedJob, setSelectedJob] = useState<ProductionJob | null>(null);
    const [showProgressModal, setShowProgressModal] = useState(false);
    const [progressValue, setProgressValue] = useState<number>(0);
    const [updating, setUpdating] = useState(false);

    // Load production jobs
    const loadProductionJobs = async () => {
        try {
            setLoading(true);
            setError(null);
            const data = await api.getProductionJobs();
            setProductionJobs(data);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load production jobs');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadProductionJobs();
    }, []);

    // Handle navigation from sample approval
    useEffect(() => {
        if (location.state?.sampleJobId) {
            // Auto-refresh to show new production job
            loadProductionJobs();
        }
    }, [location.state]);

    const filtered = productionJobs.filter((job) => {
        const matchesSearch = job.id.toLowerCase().includes(search.toLowerCase()) ||
            job.customer.toLowerCase().includes(search.toLowerCase()) ||
            job.product.toLowerCase().includes(search.toLowerCase()) ||
            job.sampleJobId.toLowerCase().includes(search.toLowerCase()) ||
            job.quotationId.toLowerCase().includes(search.toLowerCase());
        const matchesStatus = statusFilter === "All" || job.status === statusFilter;
        return matchesSearch && matchesStatus;
    });

    const statusCounts = {
        All: productionJobs.length,
        "Pending": productionJobs.filter(j => j.status === "Pending").length,
        "In Progress": productionJobs.filter(j => j.status === "In Progress").length,
        "QC Pending": productionJobs.filter(j => j.status === "QC Pending").length,
        "Completed": productionJobs.filter(j => j.status === "Completed").length,
        "Dispatched": productionJobs.filter(j => j.status === "Dispatched").length,
    };

    // Update progress
    const handleUpdateProgress = async () => {
        if (!selectedJob) return;

        try {
            setUpdating(true);
            await api.updateProductionProgress(selectedJob.id, progressValue);
            await loadProductionJobs();
            setShowProgressModal(false);
            setSelectedJob(null);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to update progress');
        } finally {
            setUpdating(false);
        }
    };

    // Update status
    const handleStatusUpdate = async (jobId: string, status: ProductionStatus) => {
        try {
            setUpdating(true);
            await api.updateProductionStatus(jobId, status);
            await loadProductionJobs();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to update status');
        } finally {
            setUpdating(false);
        }
    };

    // Get next status for workflow
    const getNextStatus = (currentStatus: ProductionStatus): ProductionStatus | null => {
        const workflow: Record<ProductionStatus, ProductionStatus | null> = {
            "Pending": "In Progress",
            "In Progress": "QC Pending",
            "QC Pending": "Completed",
            "Completed": "Dispatched",
            "Dispatched": null,
        };
        return workflow[currentStatus];
    };

    const getStatusActionLabel = (status: ProductionStatus): string => {
        const labels: Record<ProductionStatus, string> = {
            "Pending": "Start Production",
            "In Progress": "Send to QC",
            "QC Pending": "Complete QC",
            "Completed": "Dispatch",
            "Dispatched": "Dispatched ✓",
        };
        return labels[status];
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="flex flex-col items-center gap-3">
                    <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                    <p className="text-sm text-slate-500">Loading production jobs...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="p-6 space-y-6">
            {/* Error toast */}
            {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-center gap-2">
                    <AlertTriangle size={16} className="text-red-500 flex-shrink-0" />
                    <p className="text-sm text-red-600 flex-1">{error}</p>
                    <button onClick={() => setError(null)} className="text-red-500 hover:text-red-700">
                        <CloseIcon size={14} />
                    </button>
                </div>
            )}

            {/* Header */}
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                    <h1 className="text-slate-900 text-xl font-bold">Production Jobs</h1>
                    <p className="text-slate-500 text-sm mt-0.5">
                        {productionJobs.filter(j => j.status === "In Progress").length} in production ·
                        {productionJobs.filter(j => j.status === "QC Pending").length} in QC ·
                        {productionJobs.length} total
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={loadProductionJobs}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors font-medium"
                        disabled={loading}
                    >
                        <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
                    </button>
                    <div className="flex border border-slate-200 rounded-lg overflow-hidden">
                        <button onClick={() => setViewMode("card")} className={`px-3 py-1.5 text-xs ${viewMode === "card" ? "bg-slate-100 text-slate-800" : "text-slate-500"}`}>Cards</button>
                        <button onClick={() => setViewMode("table")} className={`px-3 py-1.5 text-xs ${viewMode === "table" ? "bg-slate-100 text-slate-800" : "text-slate-500"}`}>Table</button>
                    </div>
                </div>
            </div>

            {/* Status Filters */}
            <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-4">
                {Object.entries(statusCounts).map(([key, count]) => {
                    const label = key === "All" ? "All Production" : key;
                    const active = statusFilter === key;
                    const conf = key !== "All" ? statusConfig[key as ProductionStatus] : null;
                    return (
                        <button
                            key={key}
                            onClick={() => setStatusFilter(key as any)}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border transition-all ${active
                                ? "bg-indigo-600 text-white border-indigo-600"
                                : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"
                                }`}
                            style={{ fontWeight: active ? 600 : 400 }}
                        >
                            {conf && !active && <span className={conf.text}>{conf.icon}</span>}
                            {label}
                            <span className={`px-1.5 rounded-full text-xs ${active ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500"}`} style={{ fontWeight: 600 }}>
                                {count}
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
                        placeholder="Search production..."
                        className="pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg w-44 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
                    />
                </div>
            </div>

            {filtered.length === 0 ? (
                <div className="text-center py-12">
                    <div className="text-slate-400 mb-2">
                        <Package size={48} className="mx-auto" />
                    </div>
                    <p className="text-slate-500 text-sm">No production jobs found</p>
                    <p className="text-slate-400 text-xs mt-1">Try adjusting your search or filters</p>
                </div>
            ) : viewMode === "card" ? (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {filtered.map((job) => {
                        const conf = statusConfig[job.status];
                        const isPending = job.status === "Pending";
                        const statusText = isPending ? "Waiting for Machine" : conf.label;
                        const nextStatus = getNextStatus(job.status);
                        const canProgress = nextStatus !== null;

                        return (
                            <div key={job.id} className="bg-white border border-slate-200 rounded-xl p-5 hover:shadow-md transition-all">
                                <div className="flex items-start justify-between gap-2 mb-3">
                                    <div>
                                        <div className="flex items-center gap-2 mb-1">
                                            <p className="text-indigo-600 text-xs font-bold">{job.id}</p>
                                            <span className="text-xs text-slate-400">|</span>
                                            <p className="text-slate-500 text-xs">{job.quotationId}</p>
                                            <span className="text-xs text-slate-400">|</span>
                                            <div className="flex items-center gap-1">
                                                <span className="text-[10px] text-slate-400">Sample:</span>
                                                <p className="text-indigo-500 text-xs font-medium">{job.sampleJobId}</p>
                                            </div>
                                        </div>
                                        <p className="text-slate-900 text-sm font-semibold leading-snug">{job.product}</p>
                                        <p className="text-slate-500 text-xs mt-0.5">{job.customer}</p>
                                    </div>
                                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs border flex-shrink-0 ${conf.bg} ${conf.text} ${conf.border}`} style={{ fontWeight: 500 }}>
                                        {conf.icon} {statusText}
                                    </span>
                                </div>

                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-xs text-slate-500">Progress</span>
                                    <span className="text-xs text-slate-700 font-semibold">{job.progress}%</span>
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
                                        <span>Due: <span className="text-slate-700">{new Date(job.dueDate).toLocaleDateString()}</span></span>
                                    </div>
                                    <div className="flex items-center gap-1.5 text-slate-500">
                                        <User size={11} />
                                        <span className="text-slate-700 truncate">{job.assignedTo}</span>
                                    </div>
                                    <div className="flex items-center gap-1.5 text-slate-500">
                                        <Package size={11} />
                                        <span className="text-slate-700 truncate">{job.machine}</span>
                                    </div>
                                    <div className="flex items-center gap-1.5 text-slate-500">
                                        <Settings size={11} />
                                        <span className="text-slate-700">{job.quantity.toLocaleString()} pcs</span>
                                    </div>
                                </div>

                                <div className="flex items-center justify-between gap-2">
                                    <span className={`inline-flex items-center px-2 py-0.5 rounded border text-xs ${priorityColors[job.priority]}`} style={{ fontWeight: 500 }}>
                                        {job.priority} Priority
                                    </span>
                                    <span className="text-slate-900 text-sm font-bold">₹{job.value.toLocaleString()}</span>
                                </div>

                                <div className="flex items-center gap-2 mt-3 pt-3 border-t border-slate-100">
                                    {canProgress && (
                                        <button
                                            onClick={() => handleStatusUpdate(job.id, nextStatus)}
                                            disabled={updating}
                                            className="flex-1 flex items-center justify-center gap-1 px-3 py-1.5 text-xs bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            <ArrowRight size={12} /> {getStatusActionLabel(job.status)}
                                        </button>
                                    )}
                                    <button
                                        onClick={() => {
                                            setSelectedJob(job);
                                            setProgressValue(job.progress);
                                            setShowProgressModal(true);
                                        }}
                                        className="flex items-center justify-center gap-1 px-3 py-1.5 text-xs bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 transition-colors font-medium"
                                    >
                                        <Edit size={12} /> Update Progress
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            ) : (
                <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="bg-slate-50 border-b border-slate-200">
                                    {["ID", "Sample", "Product", "Customer", "Status", "Machine", "Assigned To", "Progress", "Due Date", "Value", "Actions"].map((h) => (
                                        <th key={h} className="text-left text-xs text-slate-500 px-4 py-2.5 whitespace-nowrap font-medium">{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.map((job) => {
                                    const conf = statusConfig[job.status];
                                    const nextStatus = getNextStatus(job.status);
                                    const canProgress = nextStatus !== null;

                                    return (
                                        <tr key={job.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                                            <td className="px-4 py-3">
                                                <p className="text-indigo-600 text-xs font-bold">{job.id}</p>
                                                <p className="text-[10px] text-slate-400">{job.quotationId}</p>
                                            </td>
                                            <td className="px-4 py-3 text-indigo-500 text-xs font-medium">{job.sampleJobId}</td>
                                            <td className="px-4 py-3 text-slate-800 text-xs max-w-[150px] truncate font-medium">{job.product}</td>
                                            <td className="px-4 py-3 text-slate-500 text-xs whitespace-nowrap">{job.customer}</td>
                                            <td className="px-4 py-3">
                                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs border ${conf.bg} ${conf.text} ${conf.border}`} style={{ fontWeight: 500 }}>
                                                    {conf.label}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-slate-600 text-xs whitespace-nowrap">{job.machine}</td>
                                            <td className="px-4 py-3 text-slate-600 text-xs whitespace-nowrap">{job.assignedTo}</td>
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-16 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                                                        <div className={`h-full rounded-full ${progressColors[job.status]}`} style={{ width: `${job.progress}%` }} />
                                                    </div>
                                                    <span className="text-xs text-slate-600 font-semibold">{job.progress}%</span>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-slate-500 text-xs whitespace-nowrap">{new Date(job.dueDate).toLocaleDateString()}</td>
                                            <td className="px-4 py-3 text-slate-800 text-xs font-bold">₹{job.value.toLocaleString()}</td>
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-1">
                                                    {canProgress && (
                                                        <button
                                                            onClick={() => handleStatusUpdate(job.id, nextStatus)}
                                                            disabled={updating}
                                                            className="px-2 py-1 text-xs bg-indigo-100 text-indigo-700 rounded hover:bg-indigo-200 transition-colors disabled:opacity-50"
                                                        >
                                                            {getStatusActionLabel(job.status)}
                                                        </button>
                                                    )}
                                                    <button
                                                        onClick={() => {
                                                            setSelectedJob(job);
                                                            setProgressValue(job.progress);
                                                            setShowProgressModal(true);
                                                        }}
                                                        className="px-2 py-1 text-xs bg-slate-100 text-slate-600 rounded hover:bg-slate-200 transition-colors"
                                                    >
                                                        Progress
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Update Progress Modal */}
            {showProgressModal && selectedJob && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-semibold text-slate-900">Update Progress</h3>
                            <button onClick={() => setShowProgressModal(false)} className="text-slate-400 hover:text-slate-600">
                                <CloseIcon size={20} />
                            </button>
                        </div>

                        <p className="text-sm text-slate-500 mb-4">
                            Update progress for <span className="font-semibold text-slate-700">{selectedJob.id}</span>
                        </p>

                        <div className="bg-slate-50 rounded-lg p-3 mb-4 space-y-1">
                            <p className="text-xs text-slate-500">Product</p>
                            <p className="text-sm font-medium text-slate-900">{selectedJob.product}</p>
                            <p className="text-xs text-slate-500 mt-1">Current Progress</p>
                            <p className="text-sm font-semibold text-slate-900">{selectedJob.progress}%</p>
                        </div>

                        <div className="mb-4">
                            <label className="text-xs text-slate-500 block mb-1">New Progress *</label>
                            <input
                                type="number"
                                min="0"
                                max="100"
                                value={progressValue}
                                onChange={(e) => setProgressValue(parseInt(e.target.value) || 0)}
                                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
                            />
                            <div className="mt-1">
                                <input
                                    type="range"
                                    min="0"
                                    max="100"
                                    value={progressValue}
                                    onChange={(e) => setProgressValue(parseInt(e.target.value))}
                                    className="w-full"
                                />
                                <div className="flex justify-between text-xs text-slate-400">
                                    <span>0%</span>
                                    <span>50%</span>
                                    <span>100%</span>
                                </div>
                            </div>
                        </div>

                        <div className="flex gap-2">
                            <button
                                onClick={handleUpdateProgress}
                                disabled={updating}
                                className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {updating ? 'Updating...' : 'Update Progress'}
                            </button>
                            <button
                                onClick={() => setShowProgressModal(false)}
                                className="px-4 py-2 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 transition-colors text-sm font-medium"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}