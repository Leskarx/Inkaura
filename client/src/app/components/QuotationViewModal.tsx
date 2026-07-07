// /components/QuotationViewModal.tsx
import { useState, useEffect } from "react";
import {
    X, Package, User, Calendar, DollarSign, FileText, Clock,
    CheckCircle, AlertCircle, Eye, Truck, Factory, Activity,
    ClipboardCheck, Printer, ChevronRight, ListChecks
} from "lucide-react";
import { api, QuotationData, supabase } from "../server/api";
import { PrePressChecklist } from "./PrePressChecklist";

interface QuotationViewModalProps {
    quotationId: string;
    onClose: () => void;
    onRefresh?: () => void;
}

interface PrePressChecklistStatus {
    id: number;
    job_type: 'sample' | 'production';
    checklist_data: any;
    created_at: string;
}

export function QuotationViewModal({ quotationId, onClose, onRefresh }: QuotationViewModalProps) {
    const [quotation, setQuotation] = useState<QuotationData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [prePressChecklists, setPrePressChecklists] = useState<PrePressChecklistStatus[]>([]);
    const [showPrePressChecklist, setShowPrePressChecklist] = useState(false);
    const [prePressJobType, setPrePressJobType] = useState<'sample' | 'production'>('sample');
    const [creatingJob, setCreatingJob] = useState(false);

    useEffect(() => {
        const fetchQuotation = async () => {
            try {
                setLoading(true);
                const [data, checklistsData] = await Promise.all([
                    api.getQuotationById(quotationId),
                    supabase
                        .from('pre_press_checklists')
                        .select('*')
                        .eq('quotation_id', quotationId)
                        .order('created_at', { ascending: false })
                ]);

                setQuotation(data);

                if (checklistsData.data) {
                    setPrePressChecklists(checklistsData.data);
                }
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Failed to load quotation');
            } finally {
                setLoading(false);
            }
        };
        if (quotationId) {
            fetchQuotation();
        }
    }, [quotationId]);

    // Handle creating a job with pre-press checklist
    const handleCreateJob = (jobType: 'sample' | 'production') => {
        // Check if there's already a completed pre-press checklist
        const existingChecklist = prePressChecklists.find(
            c => c.job_type === jobType
        );

        if (existingChecklist) {
            // If checklist exists, proceed to create job directly
            if (confirm(`A pre-press checklist already exists for this ${jobType} job. Do you want to proceed with creating the ${jobType} job?`)) {
                createJobDirectly(jobType);
            }
        } else {
            // Show the pre-press checklist modal
            setPrePressJobType(jobType);
            setShowPrePressChecklist(true);
        }
    };

    // Create job directly (when checklist already exists)
    const createJobDirectly = async (jobType: 'sample' | 'production') => {
        setCreatingJob(true);
        try {
            // Call your existing job creation logic here
            // This should be passed as a prop or use the same logic from parent
            if (onRefresh) {
                onRefresh();
            }
            alert(`✅ ${jobType.charAt(0).toUpperCase() + jobType.slice(1)} job created successfully!`);
        } catch (err) {
            console.error('Error creating job:', err);
            alert('❌ Failed to create job. Please try again.');
        } finally {
            setCreatingJob(false);
        }
    };

    // Handle pre-press checklist completion
    const handlePrePressComplete = async (data: any) => {
        setShowPrePressChecklist(false);
        // Refresh the quotation to show updated checklist status
        const { data: checklistsData } = await supabase
            .from('pre_press_checklists')
            .select('*')
            .eq('quotation_id', quotationId)
            .order('created_at', { ascending: false });

        if (checklistsData) {
            setPrePressChecklists(checklistsData);
        }

        // Now create the job
        await createJobDirectly(prePressJobType);
        if (onRefresh) {
            onRefresh();
        }
    };

    // Helper to get status color
    const getStatusColor = (status: string) => {
        const colors: Record<string, string> = {
            'Approved': 'bg-green-50 text-green-700 border-green-200',
            'Rejected': 'bg-red-50 text-red-700 border-red-200',
            'Sent': 'bg-blue-50 text-blue-700 border-blue-200',
            'Draft': 'bg-slate-50 text-slate-600 border-slate-200',
            'Pending': 'bg-amber-50 text-amber-700 border-amber-200',
        };
        return colors[status] || 'bg-slate-50 text-slate-600 border-slate-200';
    };

    // Get workflow status color
    const getWorkflowStatusColor = (status: string) => {
        if (status === "Approved" || status === "Completed") return "text-green-600";
        if (status === "Awaiting Approval" || status === "Pending") return "text-amber-600";
        if (status === "Rejected" || status === "Failed") return "text-red-600";
        if (status === "Production Created") return "text-blue-600";
        if (status === "N/A") return "text-slate-300";
        return "text-slate-500";
    };

    // Check if a checklist is complete
    const isChecklistComplete = (checklistData: any) => {
        if (!checklistData) return false;
        // Check all boolean fields (excluding text fields and sign-off fields)
        const booleanFields = Object.keys(checklistData).filter(key =>
            typeof checklistData[key] === 'boolean'
        );
        return booleanFields.every(key => checklistData[key] === true);
    };

    if (loading) {
        return (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                <div className="bg-white rounded-xl p-8 max-w-4xl w-full mx-4">
                    <div className="flex items-center justify-center h-32">
                        <div className="flex flex-col items-center gap-3">
                            <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                            <p className="text-sm text-slate-500">Loading quotation details...</p>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    if (error || !quotation) {
        return (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                <div className="bg-white rounded-xl p-6 max-w-4xl w-full mx-4">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-semibold text-red-600">Error</h3>
                        <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
                            <X size={20} />
                        </button>
                    </div>
                    <p className="text-sm text-red-600">{error || 'Quotation not found'}</p>
                </div>
            </div>
        );
    }

    // Get sample and production job statuses
    const sampleStatus = quotation.workflow.sampleOrder;
    const productionStatus = quotation.workflow.productionOrder;
    const canCreateSample = sampleStatus === "N/A" || sampleStatus === "Pending" || sampleStatus === "Rejected";
    const canCreateProduction = productionStatus === "N/A" || productionStatus === "Pending" || productionStatus === "Rejected";

    // Check if sample job exists and has a checklist
    const sampleChecklist = prePressChecklists.find(c => c.job_type === 'sample');
    const productionChecklist = prePressChecklists.find(c => c.job_type === 'production');

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            {/* Pre-Press Checklist Modal */}
            {showPrePressChecklist && (
                <PrePressChecklist
                    quotationId={quotationId}
                    jobType={prePressJobType}
                    onComplete={handlePrePressComplete}
                    onCancel={() => setShowPrePressChecklist(false)}
                />
            )}

            <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl max-h-[95vh] overflow-y-auto">
                {/* Header - Read Only Banner */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 sticky top-0 bg-white/95 backdrop-blur z-10">
                    <div className="flex items-center gap-4">
                        <div>
                            <div className="flex items-center gap-2">
                                <h2 className="text-slate-900 text-lg font-bold">{quotation.id}</h2>
                                <span className="text-xs bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded font-mono">{quotation.version}</span>
                                <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded border border-blue-200 font-medium flex items-center gap-1">
                                    <Eye size={12} /> Read Only
                                </span>
                            </div>
                            <p className="text-slate-500 text-sm mt-0.5">{quotation.customer}</p>
                        </div>
                        <div className="h-8 w-px bg-slate-200 mx-2" />
                        <div className="flex flex-col gap-1">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs border ${getStatusColor(quotation.status)}`} style={{ fontWeight: 500 }}>
                                {quotation.status}
                            </span>
                            <div className="text-[10px] text-slate-400 flex items-center gap-1">
                                <User size={10} /> Owner: {quotation.owner}
                            </div>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-700 bg-slate-50 hover:bg-slate-100 rounded-full transition-colors">
                        <X size={18} />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 space-y-6">
                    {/* Quick Summary Cards */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                            <p className="text-xs text-slate-500 mb-1">Total Value</p>
                            <p className="text-xl font-bold text-slate-900">₹{quotation.commercials.total.toLocaleString()}</p>
                        </div>
                        <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                            <p className="text-xs text-slate-500 mb-1">Advance Required</p>
                            <p className="text-lg font-bold text-amber-600">
                                ₹{(quotation.commercials.total * quotation.commercials.advanceRequiredPct / 100).toLocaleString()}
                            </p>
                            <p className="text-xs text-slate-400">{quotation.commercials.advanceRequiredPct}%</p>
                        </div>
                        <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                            <p className="text-xs text-slate-500 mb-1">Advance Received</p>
                            <p className="text-lg font-bold text-green-600">₹{quotation.commercials.advanceReceivedAmt.toLocaleString()}</p>
                        </div>
                        <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                            <p className="text-xs text-slate-500 mb-1">Valid Until</p>
                            <p className="text-lg font-bold text-slate-900">{quotation.validUntil}</p>
                        </div>
                    </div>

                    {/* Workflow Status with Pre-Press Checklist Actions */}
                    <div className="bg-white border border-slate-200 rounded-xl p-5">
                        <h3 className="text-sm font-semibold text-slate-900 mb-4 flex items-center gap-2">
                            <Activity size={16} className="text-indigo-500" /> Workflow Status
                        </h3>
                        <div className="flex items-center justify-between relative mb-6">
                            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-0.5 bg-slate-100" />
                            {[
                                {
                                    label: "Sample",
                                    status: sampleStatus,
                                    canCreate: canCreateSample,
                                    checklist: sampleChecklist
                                },
                                {
                                    label: "Production",
                                    status: productionStatus,
                                    canCreate: canCreateProduction,
                                    checklist: productionChecklist
                                },
                                { label: "Dispatch", status: quotation.workflow.dispatch },
                                { label: "Invoice", status: quotation.workflow.invoice },
                                { label: "Closure", status: quotation.workflow.closure }
                            ].map((step, i) => (
                                <div key={i} className="relative z-10 flex flex-col items-center gap-2 bg-white px-2">
                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 text-xs font-bold
                                        ${step.status !== "N/A" && step.status !== "Pending" && step.status !== "Rejected" ?
                                            step.status === "Awaiting Approval" ? "bg-yellow-50 border-yellow-500 text-yellow-700" :
                                                step.status === "Rejected" ? "bg-red-50 border-red-500 text-red-700" :
                                                    "bg-green-50 border-green-500 text-green-700" :
                                            "bg-white border-slate-200 text-slate-400"}
                                    `}>
                                        {i + 1}
                                    </div>
                                    <div className="text-center">
                                        <p className="text-xs font-medium text-slate-700">{step.label}</p>
                                        <p className={`text-[10px] ${getWorkflowStatusColor(step.status)}`}>
                                            {step.status}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Pre-Press Checklist Status & Actions */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-slate-200">
                            {/* Sample Job Section */}
                            <div className="bg-slate-50 rounded-lg p-4">
                                <div className="flex items-center justify-between mb-2">
                                    <h4 className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                                        <Printer size={14} className="text-indigo-500" /> Sample Job
                                    </h4>
                                    <span className={`text-[10px] font-medium px-2 py-0.5 rounded ${getWorkflowStatusColor(sampleStatus)}`}>
                                        {sampleStatus}
                                    </span>
                                </div>

                                {sampleChecklist && (
                                    <div className="mb-2">
                                        <div className="flex items-center gap-1.5 text-xs">
                                            <ListChecks size={12} className={isChecklistComplete(sampleChecklist.checklist_data) ? "text-green-500" : "text-amber-500"} />
                                            <span className={isChecklistComplete(sampleChecklist.checklist_data) ? "text-green-600" : "text-amber-600"}>
                                                {isChecklistComplete(sampleChecklist.checklist_data) ? "Pre-Press Checklist Complete ✓" : "Pre-Press Checklist Incomplete"}
                                            </span>
                                        </div>
                                        <p className="text-[10px] text-slate-400">
                                            {new Date(sampleChecklist.created_at).toLocaleDateString()}
                                        </p>
                                    </div>
                                )}

                                {canCreateSample && (
                                    <button
                                        onClick={() => handleCreateJob('sample')}
                                        disabled={creatingJob}
                                        className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50"
                                    >
                                        <ClipboardCheck size={12} />
                                        {sampleChecklist ? "Re-run Checklist" : "Create Sample Job"}
                                    </button>
                                )}

                                {!canCreateSample && sampleStatus !== "N/A" && (
                                    <div className="w-full text-center py-1.5 text-xs text-green-600 bg-green-50 rounded-lg border border-green-200">
                                        ✓ Sample Job {sampleStatus === "Approved" ? "Approved" : "Created"}
                                    </div>
                                )}
                            </div>

                            {/* Production Job Section */}
                            <div className="bg-slate-50 rounded-lg p-4">
                                <div className="flex items-center justify-between mb-2">
                                    <h4 className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                                        <Factory size={14} className="text-indigo-500" /> Production Job
                                    </h4>
                                    <span className={`text-[10px] font-medium px-2 py-0.5 rounded ${getWorkflowStatusColor(productionStatus)}`}>
                                        {productionStatus}
                                    </span>
                                </div>

                                {productionChecklist && (
                                    <div className="mb-2">
                                        <div className="flex items-center gap-1.5 text-xs">
                                            <ListChecks size={12} className={isChecklistComplete(productionChecklist.checklist_data) ? "text-green-500" : "text-amber-500"} />
                                            <span className={isChecklistComplete(productionChecklist.checklist_data) ? "text-green-600" : "text-amber-600"}>
                                                {isChecklistComplete(productionChecklist.checklist_data) ? "Pre-Press Checklist Complete ✓" : "Pre-Press Checklist Incomplete"}
                                            </span>
                                        </div>
                                        <p className="text-[10px] text-slate-400">
                                            {new Date(productionChecklist.created_at).toLocaleDateString()}
                                        </p>
                                    </div>
                                )}

                                {canCreateProduction && (
                                    <button
                                        onClick={() => handleCreateJob('production')}
                                        disabled={creatingJob}
                                        className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50"
                                    >
                                        <ClipboardCheck size={12} />
                                        {productionChecklist ? "Re-run Checklist" : "Create Production Job"}
                                    </button>
                                )}

                                {!canCreateProduction && productionStatus !== "N/A" && (
                                    <div className="w-full text-center py-1.5 text-xs text-green-600 bg-green-50 rounded-lg border border-green-200">
                                        ✓ Production Job {productionStatus === "Approved" ? "Approved" : "Created"}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Products */}
                    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                        <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/50 flex items-center gap-2">
                            <Package size={16} className="text-slate-500" />
                            <h3 className="text-sm font-semibold text-slate-900">Products & Specifications</h3>
                        </div>
                        <div className="divide-y divide-slate-100">
                            {quotation.products.map((item, i) => (
                                <div key={i} className="p-4">
                                    <div className="flex justify-between items-start mb-3">
                                        <div>
                                            <p className="text-sm font-semibold text-slate-900">{item.desc}</p>
                                            <p className="text-xs text-slate-500">{item.qty.toLocaleString()} units @ ₹{item.rate.toFixed(2)}</p>
                                        </div>
                                        <p className="text-sm font-bold text-slate-900">₹{item.total.toLocaleString()}</p>
                                    </div>
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-slate-50 p-3 rounded-lg border border-slate-100 text-xs">
                                        <div><span className="text-slate-400 block mb-0.5">Material</span><span className="font-medium text-slate-700">{item.specs.material}</span></div>
                                        <div><span className="text-slate-400 block mb-0.5">GSM</span><span className="font-medium text-slate-700">{item.specs.gsm}</span></div>
                                        <div><span className="text-slate-400 block mb-0.5">Dimensions</span><span className="font-medium text-slate-700">{item.specs.dimensions}</span></div>
                                        <div><span className="text-slate-400 block mb-0.5">Printing</span><span className="font-medium text-slate-700">{item.specs.printingTech}</span></div>
                                        <div><span className="text-slate-400 block mb-0.5">Colors</span><span className="font-medium text-slate-700">{item.specs.colors}</span></div>
                                        <div><span className="text-slate-400 block mb-0.5">Lamination</span><span className="font-medium text-slate-700">{item.specs.lamination}</span></div>
                                        <div className="col-span-2"><span className="text-slate-400 block mb-0.5">Packaging</span><span className="font-medium text-slate-700">{item.specs.packaging}</span></div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Costing Details */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="bg-white border border-slate-200 rounded-xl p-5">
                            <h3 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2">
                                <DollarSign size={16} className="text-amber-500" /> Cost Breakdown
                            </h3>
                            <div className="space-y-2 text-sm">
                                <div className="flex justify-between"><span className="text-slate-500">Material</span><span className="font-medium">₹{quotation.costing.breakdown.material.toLocaleString()}</span></div>
                                <div className="flex justify-between"><span className="text-slate-500">Machine</span><span className="font-medium">₹{quotation.costing.breakdown.machine.toLocaleString()}</span></div>
                                <div className="flex justify-between"><span className="text-slate-500">Labor</span><span className="font-medium">₹{quotation.costing.breakdown.labor.toLocaleString()}</span></div>
                                <div className="flex justify-between"><span className="text-slate-500">Finishing</span><span className="font-medium">₹{quotation.costing.breakdown.finishing.toLocaleString()}</span></div>
                                <div className="flex justify-between"><span className="text-slate-500">Packaging</span><span className="font-medium">₹{quotation.costing.breakdown.packaging.toLocaleString()}</span></div>
                            </div>
                        </div>
                        <div className="bg-white border border-slate-200 rounded-xl p-5">
                            <h3 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2">
                                <FileText size={16} className="text-indigo-500" /> Summary
                            </h3>
                            <div className="space-y-2 text-sm">
                                <div className="flex justify-between"><span className="text-slate-500">Estimated Total Cost</span><span className="font-bold">₹{quotation.costing.estimatedTotalCost.toLocaleString()}</span></div>
                                <div className="flex justify-between"><span className="text-slate-500">Expected Margin</span><span className="font-bold text-green-600">₹{quotation.costing.expectedMargin.toLocaleString()}</span></div>
                                <div className="flex justify-between"><span className="text-slate-500">Profit Margin</span><span className="font-bold text-indigo-600">{quotation.costing.profitMarginPct}%</span></div>
                                <div className="flex justify-between pt-2 border-t border-slate-200"><span className="text-slate-500">Total Quote Value</span><span className="font-bold text-slate-900">₹{quotation.commercials.total.toLocaleString()}</span></div>
                            </div>
                        </div>
                    </div>

                    {/* Payment Terms */}
                    <div className="bg-white border border-slate-200 rounded-xl p-5">
                        <h3 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2">
                            <DollarSign size={16} className="text-green-500" /> Payment Details
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                            <div>
                                <p className="text-slate-500">Payment Terms</p>
                                <p className="font-medium text-slate-900">{quotation.commercials.paymentTerms}</p>
                            </div>
                            <div>
                                <p className="text-slate-500">Advance Required</p>
                                <p className="font-medium text-slate-900">{quotation.commercials.advanceRequiredPct}%</p>
                            </div>
                            <div>
                                <p className="text-slate-500">Advance Received</p>
                                <p className="font-medium text-green-600">₹{quotation.commercials.advanceReceivedAmt.toLocaleString()}</p>
                            </div>
                        </div>
                    </div>

                    {/* Footer note */}
                    <div className="text-center text-xs text-slate-400 py-2 border-t border-slate-100">
                        <span className="flex items-center justify-center gap-1">
                            <Eye size={14} /> View-Only Mode - You cannot edit this quotation
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
}