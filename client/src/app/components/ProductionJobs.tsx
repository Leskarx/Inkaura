import { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { QuotationViewModal } from "../components/QuotationViewModal";
import { JobSlipModal } from "../components/JobSlipModal";
import {
    Search, Calendar, User, Clock, AlertCircle, CheckCircle, Truck,
    Package, Settings, Eye, RefreshCw, AlertTriangle,
    Plus, Edit, Save, X as CloseIcon, ArrowRight, Factory, Users,
    ClipboardCheck, Play, Printer
} from "lucide-react";
import { api, ProductionJob, ProductionStatus, Priority, supabase } from "../server/api";

const statusConfig: Record<ProductionStatus, { label: string; bg: string; text: string; border: string; icon: React.ReactNode }> = {
    "Pending": {
        label: "Pending",
        bg: "bg-slate-50",
        text: "text-slate-600",
        border: "border-slate-200",
        icon: <Clock size={12} />
    },
    "In Progress": {
        label: "In Progress",
        bg: "bg-indigo-50",
        text: "text-indigo-700",
        border: "border-indigo-200",
        icon: <AlertCircle size={12} />
    },
    "QC Pending": {
        label: "QC Pending",
        bg: "bg-amber-50",
        text: "text-amber-700",
        border: "border-amber-200",
        icon: <AlertCircle size={12} />
    },
    "Completed": {
        label: "Completed",
        bg: "bg-green-50",
        text: "text-green-700",
        border: "border-green-200",
        icon: <CheckCircle size={12} />
    },
    "Dispatched": {
        label: "Dispatched",
        bg: "bg-purple-50",
        text: "text-purple-700",
        border: "border-purple-200",
        icon: <Truck size={12} />
    },
    "Packaged": {
        label: "Packaged",
        bg: "bg-emerald-50",
        text: "text-emerald-700",
        border: "border-emerald-200",
        icon: <Package size={12} />
    },
    "Rework Required": {
        label: "Rework Required",
        bg: "bg-red-50",
        text: "text-red-700",
        border: "border-red-200",
        icon: <AlertTriangle size={12} />
    },
    "Failed": {
        label: "Failed",
        bg: "bg-red-50",
        text: "text-red-700",
        border: "border-red-200",
        icon: <AlertCircle size={12} />
    },
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
    "Packaged": "bg-emerald-500",
    "Rework Required": "bg-red-500",
    "Failed": "bg-red-500",
};

export function ProductionJobs() {
    const navigate = useNavigate();
    const [productionJobs, setProductionJobs] = useState<ProductionJob[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState<"All" | ProductionStatus>("All");
    const [viewMode, setViewMode] = useState<"card" | "table">("card");
    const [selectedJob, setSelectedJob] = useState<ProductionJob | null>(null);
    const [showProgressModal, setShowProgressModal] = useState(false);
    const [showAssignModal, setShowAssignModal] = useState(false);
    const [progressValue, setProgressValue] = useState<number>(0);
    const [updating, setUpdating] = useState(false);

    // State for Quotation View Modal
    const [showQuotationView, setShowQuotationView] = useState(false);
    const [viewQuotationId, setViewQuotationId] = useState<string | null>(null);

    // State for Job Slip Modal
    const [showJobSlip, setShowJobSlip] = useState(false);
    const [jobSlipJob, setJobSlipJob] = useState<ProductionJob | null>(null);

    // Assignment form state
    const [assignmentData, setAssignmentData] = useState({
        machineId: 0,
        operatorId: 0,
    });
    const [machines, setMachines] = useState<{ id: number; name: string; type: string; status: string }[]>([]);
    const [employees, setEmployees] = useState<{ id: number; name: string; role: string }[]>([]);
    const [loadingDropdowns, setLoadingDropdowns] = useState(false);

    // Load production jobs
    const loadProductionJobs = async () => {
        try {
            setLoading(true);
            setError(null);
            const data = await api.getProductionJobs();
            // Filter out dispatched jobs - they should only be shown in Dispatch page
            const activeJobs = data.filter(job => job.status !== "Dispatched");
            setProductionJobs(activeJobs);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load production jobs');
        } finally {
            setLoading(false);
        }
    };

    // Load dropdown data
    const loadDropdownData = async () => {
        setLoadingDropdowns(true);
        try {
            const [machinesData, employeesData] = await Promise.all([
                api.getMachines(),
                api.getEmployees()
            ]);
            setMachines(machinesData);
            setEmployees(employeesData);
        } catch (err) {
            console.error('Error loading dropdown data:', err);
            setError('Failed to load machines or employees');
        } finally {
            setLoadingDropdowns(false);
        }
    };

    useEffect(() => {
        loadProductionJobs();
    }, []);

    const filtered = productionJobs.filter((job) => {
        // Only show non-dispatched jobs
        if (job.status === "Dispatched") return false;

        const matchesSearch = job.id.toLowerCase().includes(search.toLowerCase()) ||
            job.customer.toLowerCase().includes(search.toLowerCase()) ||
            job.product.toLowerCase().includes(search.toLowerCase()) ||
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

            // If moving to QC Pending, navigate to QC page
            if (status === "QC Pending") {
                alert("✅ Job sent to Quality Control! Redirecting to QC page...");
                navigate('/quality-control');
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to update status');
        } finally {
            setUpdating(false);
        }
    };

    // Assign machine and operator
    const handleAssign = async () => {
        if (!selectedJob) return;
        if (!assignmentData.machineId || assignmentData.machineId === 0) {
            setError('Please select a machine');
            return;
        }
        if (!assignmentData.operatorId || assignmentData.operatorId === 0) {
            setError('Please select an operator');
            return;
        }

        try {
            setUpdating(true);
            const { error } = await supabase
                .from('production_orders')
                .update({
                    machine_id: assignmentData.machineId,
                    assigned_to: assignmentData.operatorId,
                })
                .eq('production_order_id', selectedJob.id);

            if (error) throw error;

            await loadProductionJobs();
            setShowAssignModal(false);
            setSelectedJob(null);
            setAssignmentData({ machineId: 0, operatorId: 0 });
            alert('✅ Machine and operator assigned successfully!');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to assign machine and operator');
        } finally {
            setUpdating(false);
        }
    };

    // Open assign modal
    const openAssignModal = async (job: ProductionJob) => {
        setSelectedJob(job);
        await loadDropdownData();
        setAssignmentData({ machineId: 0, operatorId: 0 });
        setShowAssignModal(true);
    };

    // Get next status for workflow
    const getNextStatus = (currentStatus: ProductionStatus): ProductionStatus | null => {
        const workflow: Record<ProductionStatus, ProductionStatus | null> = {
            "Pending": "In Progress",
            "In Progress": "QC Pending",
            "QC Pending": "Completed",
            "Completed": null, // No more actions - dispatch handles it
            "Dispatched": null,
            "Packaged": null,
            "Rework Required": null,
            "Failed": null,
        };
        return workflow[currentStatus];
    };

    const getStatusActionLabel = (status: ProductionStatus): string => {
        const labels: Record<ProductionStatus, string> = {
            "Pending": "Start Production",
            "In Progress": "Send to QC",
            "QC Pending": "Complete QC",
            "Completed": "Ready for Dispatch",
            "Dispatched": "Dispatched ✓",
            "Packaged": "Packaged ✓",
            "Rework Required": "Rework Required",
            "Failed": "Failed",
        };
        return labels[status];
    };

    // Check if job has machine and operator assigned
    const isJobAssigned = (job: ProductionJob) => {
        return job.machine && job.machine !== 'Unassigned' && job.assignedTo && job.assignedTo !== 'Unassigned';
    };

    // Get icon for status action
    const getStatusActionIcon = (status: ProductionStatus) => {
        if (status === "In Progress") return <ClipboardCheck size={12} />;
        if (status === "Pending") return <Play size={12} />;
        return <ArrowRight size={12} />;
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
                        {productionJobs.filter(j => j.status === "Pending").length} pending assignment ·
                        {productionJobs.length} active
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
                        <button
                            onClick={() => setViewMode("card")}
                            className={`px-3 py-1.5 text-xs ${viewMode === "card" ? "bg-slate-100 text-slate-800" : "text-slate-500"}`}
                        >
                            Cards
                        </button>
                        <button
                            onClick={() => setViewMode("table")}
                            className={`px-3 py-1.5 text-xs ${viewMode === "table" ? "bg-slate-100 text-slate-800" : "text-slate-500"}`}
                        >
                            Table
                        </button>
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
                    <p className="text-slate-500 text-sm">No active production jobs found</p>
                    <p className="text-slate-400 text-xs mt-1">All jobs have been dispatched or none exist</p>
                </div>
            ) : viewMode === "card" ? (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {filtered.map((job) => {
                        const conf = statusConfig[job.status] || statusConfig["Pending"];
                        const isPending = job.status === "Pending";
                        const statusText = isPending ? "Pending Assignment" : conf.label;
                        const nextStatus = getNextStatus(job.status);
                        const canProgress = nextStatus !== null;
                        const isAssigned = isJobAssigned(job);
                        const showAssignButton = job.status === "Pending" && !isAssigned;
                        const isQCPending = job.status === "QC Pending";
                        const isCompleted = job.status === "Completed";

                        return (
                            <div key={job.id} className="bg-white border border-slate-200 rounded-xl p-5 hover:shadow-md transition-all">
                                <div className="flex items-start justify-between gap-2 mb-3">
                                    <div>
                                        <div className="flex items-center gap-2 mb-1">
                                            <p className="text-indigo-600 text-xs font-bold">{job.id}</p>
                                            <span className="text-xs text-slate-400">|</span>
                                            <p className="text-slate-500 text-xs">{job.quotationId}</p>
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
                                        className={`h-full rounded-full transition-all ${progressColors[job.status] || "bg-slate-300"}`}
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
                                        <span className="text-slate-700 truncate">{job.assignedTo || 'Not Assigned'}</span>
                                    </div>
                                    <div className="flex items-center gap-1.5 text-slate-500">
                                        <Factory size={11} />
                                        <span className="text-slate-700 truncate">{job.machine || 'Not Assigned'}</span>
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
                                    {showAssignButton && (
                                        <button
                                            onClick={() => openAssignModal(job)}
                                            className="flex-1 flex items-center justify-center gap-1 px-3 py-1.5 text-xs bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors font-medium"
                                        >
                                            <Users size={12} /> Assign Machine & Operator
                                        </button>
                                    )}

                                    {canProgress && isAssigned && !isQCPending && job.status !== "Completed" && (
                                        <button
                                            onClick={() => handleStatusUpdate(job.id, nextStatus)}
                                            disabled={updating}
                                            className="flex-1 flex items-center justify-center gap-1 px-3 py-1.5 text-xs bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            {getStatusActionIcon(job.status)} {getStatusActionLabel(job.status)}
                                        </button>
                                    )}

                                    {isQCPending && (
                                        <button
                                            onClick={() => navigate('/quality-control')}
                                            className="flex-1 flex items-center justify-center gap-1 px-3 py-1.5 text-xs bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors font-medium"
                                        >
                                            <ClipboardCheck size={12} /> Go to QC
                                        </button>
                                    )}

                                    {isCompleted && (
                                        <div className="flex-1 text-center py-2 px-3 rounded-lg text-xs bg-green-50 text-green-700 border border-green-200">
                                            ✅ Ready for Dispatch
                                        </div>
                                    )}

                                    {canProgress && !isAssigned && job.status === "Pending" && (
                                        <div className="flex-1 text-center text-xs text-amber-600">
                                            ⚠️ Assign machine & operator first
                                        </div>
                                    )}

                                    {/* View Quote Button */}
                                    <button
                                        onClick={() => {
                                            setViewQuotationId(job.quotationId);
                                            setShowQuotationView(true);
                                        }}
                                        className="flex items-center justify-center gap-1 px-3 py-1.5 text-xs bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100 transition-colors font-medium"
                                    >
                                        <Eye size={12} /> View Quote
                                    </button>

                                    {/* Job Slip Button */}
                                    <button
                                        onClick={() => {
                                            setJobSlipJob(job);
                                            setShowJobSlip(true);
                                        }}
                                        className="flex items-center justify-center gap-1 px-3 py-1.5 text-xs bg-slate-900 text-white rounded-lg hover:bg-slate-700 transition-colors font-medium"
                                        title="Print Factory Job Slip"
                                    >
                                        <Printer size={12} /> Job Slip
                                    </button>

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
                                    {["ID", "Quotation", "Product", "Customer", "Status", "Machine", "Operator", "Progress", "Due Date", "Value", "Actions"].map((h) => (
                                        <th key={h} className="text-left text-xs text-slate-500 px-4 py-2.5 whitespace-nowrap font-medium">{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.map((job) => {
                                    const conf = statusConfig[job.status] || statusConfig["Pending"];
                                    const nextStatus = getNextStatus(job.status);
                                    const canProgress = nextStatus !== null;
                                    const isAssigned = isJobAssigned(job);
                                    const showAssignButton = job.status === "Pending" && !isAssigned;
                                    const isQCPending = job.status === "QC Pending";
                                    const isCompleted = job.status === "Completed";

                                    return (
                                        <tr key={job.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                                            <td className="px-4 py-3">
                                                <p className="text-indigo-600 text-xs font-bold">{job.id}</p>
                                            </td>
                                            <td className="px-4 py-3 text-indigo-500 text-xs font-medium">{job.quotationId}</td>
                                            <td className="px-4 py-3 text-slate-800 text-xs max-w-[150px] truncate font-medium">{job.product}</td>
                                            <td className="px-4 py-3 text-slate-500 text-xs whitespace-nowrap">{job.customer}</td>
                                            <td className="px-4 py-3">
                                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs border ${conf.bg} ${conf.text} ${conf.border}`} style={{ fontWeight: 500 }}>
                                                    {conf.label}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-slate-600 text-xs whitespace-nowrap">{job.machine || 'Not Assigned'}</td>
                                            <td className="px-4 py-3 text-slate-600 text-xs whitespace-nowrap">{job.assignedTo || 'Not Assigned'}</td>
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-16 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                                                        <div className={`h-full rounded-full ${progressColors[job.status] || "bg-slate-300"}`} style={{ width: `${job.progress}%` }} />
                                                    </div>
                                                    <span className="text-xs text-slate-600 font-semibold">{job.progress}%</span>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-slate-500 text-xs whitespace-nowrap">{new Date(job.dueDate).toLocaleDateString()}</td>
                                            <td className="px-4 py-3 text-slate-800 text-xs font-bold">₹{job.value.toLocaleString()}</td>
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-1 flex-wrap">
                                                    {showAssignButton && (
                                                        <button
                                                            onClick={() => openAssignModal(job)}
                                                            className="px-2 py-1 text-xs bg-emerald-100 text-emerald-700 rounded hover:bg-emerald-200 transition-colors"
                                                        >
                                                            Assign
                                                        </button>
                                                    )}
                                                    {canProgress && isAssigned && !isQCPending && job.status !== "Completed" && (
                                                        <button
                                                            onClick={() => handleStatusUpdate(job.id, nextStatus)}
                                                            disabled={updating}
                                                            className="px-2 py-1 text-xs bg-indigo-100 text-indigo-700 rounded hover:bg-indigo-200 transition-colors disabled:opacity-50"
                                                        >
                                                            {getStatusActionLabel(job.status)}
                                                        </button>
                                                    )}
                                                    {isQCPending && (
                                                        <button
                                                            onClick={() => navigate('/quality-control')}
                                                            className="px-2 py-1 text-xs bg-amber-100 text-amber-700 rounded hover:bg-amber-200 transition-colors"
                                                        >
                                                            QC
                                                        </button>
                                                    )}
                                                    {isCompleted && (
                                                        <span className="px-2 py-1 text-xs bg-green-100 text-green-700 rounded">
                                                            Ready for Dispatch
                                                        </span>
                                                    )}
                                                    {/* View Quote Button in Table */}
                                                    <button
                                                        onClick={() => {
                                                            setViewQuotationId(job.quotationId);
                                                            setShowQuotationView(true);
                                                        }}
                                                        className="px-2 py-1 text-xs bg-indigo-50 text-indigo-600 rounded hover:bg-indigo-100 transition-colors"
                                                    >
                                                        <Eye size={12} />
                                                    </button>
                                                    {/* Job Slip Button in Table */}
                                                    <button
                                                        onClick={() => {
                                                            setJobSlipJob(job);
                                                            setShowJobSlip(true);
                                                        }}
                                                        className="px-2 py-1 text-xs bg-slate-900 text-white rounded hover:bg-slate-700 transition-colors"
                                                        title="Print Factory Job Slip"
                                                    >
                                                        <Printer size={12} />
                                                    </button>
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

            {/* Assign Machine & Operator Modal */}
            {showAssignModal && selectedJob && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                                <Users size={20} className="text-emerald-600" /> Assign Machine & Operator
                            </h3>
                            <button onClick={() => setShowAssignModal(false)} className="text-slate-400 hover:text-slate-600">
                                <CloseIcon size={20} />
                            </button>
                        </div>

                        <p className="text-sm text-slate-500 mb-4">
                            Assign resources for <span className="font-semibold text-slate-700">{selectedJob.id}</span>
                        </p>

                        <div className="bg-slate-50 rounded-lg p-3 mb-4 space-y-1">
                            <p className="text-xs text-slate-500">Product</p>
                            <p className="text-sm font-medium text-slate-900">{selectedJob.product}</p>
                            <p className="text-xs text-slate-500 mt-1">Customer</p>
                            <p className="text-sm text-slate-700">{selectedJob.customer}</p>
                            <p className="text-xs text-slate-500 mt-1">Quantity</p>
                            <p className="text-sm text-slate-700">{selectedJob.quantity.toLocaleString()} pcs</p>
                            <p className="text-xs text-slate-500 mt-1">Priority</p>
                            <p className={`text-sm font-semibold ${selectedJob.priority === 'High' ? 'text-red-600' : selectedJob.priority === 'Medium' ? 'text-amber-600' : 'text-slate-600'}`}>
                                {selectedJob.priority}
                            </p>
                        </div>

                        {loadingDropdowns ? (
                            <div className="text-center py-4">
                                <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto" />
                                <p className="text-xs text-slate-500 mt-2">Loading resources...</p>
                            </div>
                        ) : (
                            <>
                                {/* Machine Selection */}
                                <div className="mb-4">
                                    <label className="text-xs text-slate-500 block mb-1">Select Machine *</label>
                                    <select
                                        value={assignmentData.machineId}
                                        onChange={(e) => setAssignmentData({ ...assignmentData, machineId: Number(e.target.value) })}
                                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
                                    >
                                        <option value="0">Select a machine</option>
                                        {machines
                                            .filter(m => m.status === 'Active' || m.status === 'Setup')
                                            .map((m) => (
                                                <option key={m.id} value={m.id}>
                                                    {m.name} {m.type ? `(${m.type})` : ''} {m.status ? `- ${m.status}` : ''}
                                                </option>
                                            ))}
                                    </select>
                                </div>

                                {/* Operator Selection */}
                                <div className="mb-4">
                                    <label className="text-xs text-slate-500 block mb-1">Select Operator *</label>
                                    <select
                                        value={assignmentData.operatorId}
                                        onChange={(e) => setAssignmentData({ ...assignmentData, operatorId: Number(e.target.value) })}
                                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
                                    >
                                        <option value="0">Select an operator</option>
                                        {employees.map((e) => (
                                            <option key={e.id} value={e.id}>
                                                {e.name} {e.role ? `(${e.role})` : ''}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </>
                        )}

                        <div className="flex gap-2 mt-4">
                            <button
                                onClick={handleAssign}
                                disabled={updating || loadingDropdowns}
                                className="flex-1 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                {updating ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                        Assigning...
                                    </>
                                ) : (
                                    <>
                                        <Users size={16} /> Assign Resources
                                    </>
                                )}
                            </button>
                            <button
                                onClick={() => setShowAssignModal(false)}
                                className="px-4 py-2 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 transition-colors text-sm font-medium"
                            >
                                Cancel
                            </button>
                        </div>
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

            {/* Quotation View Modal */}
            {showQuotationView && viewQuotationId && (
                <QuotationViewModal
                    quotationId={viewQuotationId}
                    onClose={() => {
                        setShowQuotationView(false);
                        setViewQuotationId(null);
                    }}
                />
            )}

            {/* Job Slip Modal */}
            {showJobSlip && jobSlipJob && (
                <JobSlipModal
                    jobId={jobSlipJob.id}
                    jobType="production"
                    quotationId={jobSlipJob.quotationId}
                    customerName={jobSlipJob.customer}
                    productName={jobSlipJob.product}
                    quantity={jobSlipJob.quantity}
                    dueDate={jobSlipJob.dueDate}
                    machineName={jobSlipJob.machine}
                    operatorName={jobSlipJob.assignedTo}
                    onClose={() => {
                        setShowJobSlip(false);
                        setJobSlipJob(null);
                    }}
                />
            )}
        </div>
    );
}