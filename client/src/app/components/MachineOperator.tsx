import { useState, useEffect } from "react";
import { Play, Pause, AlertTriangle, CheckCircle, Clock, ChevronDown, X, Cpu, RefreshCw, FlaskConical, Factory, Package, Trash2, Edit3, MessageSquare, FileText, Eye } from "lucide-react";
import { api, ProductionJob, ProductionStatus, SampleJob, SampleStatus } from "../server/api";
import { supabase } from "../server/api";

const issueTypes = ["Registration problem", "Color inconsistency", "Paper jam", "Ink drying issue", "Machine vibration", "Other"];
const pauseReasons = ["Material shortage", "Machine maintenance", "Operator break", "Quality check", "Customer approval needed", "Other"];

interface AssignedJob {
  id: string;
  type: 'sample' | 'production';
  product: string;
  customer: string;
  quantity: number;
  assignedTo: string;
  machine: string;
  priority: 'High' | 'Medium' | 'Low';
  status: string;
  progress: number;
  dueDate: string;
  createdDate: string;
  value: number;
  sampleJobId?: string;
  productionJobId?: string;
  quotationId?: string;
  materialUsed?: number;
  materialWaste?: number;
  materialUnit?: string;
  materialName?: string;
  qcFeedback?: string;
  qcDefects?: string;
  qcReworkInstructions?: string;
}

interface InventoryItem {
  id: number;
  item: string;
  category: string;
  current: number;
  min: number;
  max: number;
  unit: string;
  unitcost: number;
  supplier: string;
  lastorder?: string;
  created_at?: string;
  updated_at?: string;
}

interface QualityCheckReport {
  qc_id: number;
  production_order_id: string;
  check_type: string;
  check_date: string;
  checked_by_name: string;
  color_accuracy: string;
  print_quality: string;
  binding_quality: string;
  material_quality: string;
  dimensional_accuracy: string;
  finishing_quality: string;
  overall_status: string;
  defect_type?: string;
  defect_quantity: number;
  defect_description?: string;
  rework_required: boolean;
  rework_description?: string;
  notes?: string;
  created_at: string;
  customer_name: string;
  product_name: string;
}

interface JobCardProps {
  job: AssignedJob;
  onStatusUpdate: () => void;
  inventoryItems: InventoryItem[];
  onInventoryUpdate: () => void;
  currentEmployee: string;
}

function JobCard({ job, onStatusUpdate, inventoryItems, onInventoryUpdate, currentEmployee }: JobCardProps) {
  const [running, setRunning] = useState(job.status === "In Progress");
  const [showIssue, setShowIssue] = useState(false);
  const [issueDesc, setIssueDesc] = useState("");
  const [issueType, setIssueType] = useState("");
  const [updating, setUpdating] = useState(false);
  const [showPauseModal, setShowPauseModal] = useState(false);
  const [pauseReason, setPauseReason] = useState("");
  const [pauseNote, setPauseNote] = useState("");
  const [materialUsed, setMaterialUsed] = useState(job.materialUsed || 0);
  const [materialWaste, setMaterialWaste] = useState(job.materialWaste || 0);
  const [showMaterialModal, setShowMaterialModal] = useState(false);
  const [selectedInventoryItem, setSelectedInventoryItem] = useState<string>("");
  const [materialQuantity, setMaterialQuantity] = useState(0);
  const [wasteQuantity, setWasteQuantity] = useState(0);
  const [materialNote, setMaterialNote] = useState("");
  const [showDoneModal, setShowDoneModal] = useState(false);
  const [doneNote, setDoneNote] = useState("");

  // QC Report state
  const [showQCReportModal, setShowQCReportModal] = useState(false);
  const [qcReport, setQcReport] = useState<QualityCheckReport | null>(null);
  const [reworkNote, setReworkNote] = useState("");
  const [loadingReport, setLoadingReport] = useState(false);

  const progress = job.quantity > 0 ? Math.round((job.progress || 0)) : 0;
  const isSample = job.type === 'sample';
  const isProduction = job.type === 'production';
  const isReworkRequired = job.status === "Rework Required" || job.status === "Failed";

  const availableInventory = inventoryItems.filter(item => item.current > 0);

  // Fetch QC report when job status is "Rework Required" or "Failed"
  useEffect(() => {
    const fetchQCReport = async () => {
      if (isReworkRequired && isProduction) {
        setLoadingReport(true);
        try {
          const { data: qcData, error: qcError } = await supabase
            .from('quality_checks')
            .select(`
              *,
              checked_by_emp:checked_by (full_name)
            `)
            .eq('production_order_id', job.id)
            .order('created_at', { ascending: false })
            .limit(1);

          if (qcError) {
            console.error('Error fetching QC report:', qcError);
            setLoadingReport(false);
            return;
          }

          if (qcData && qcData.length > 0) {
            const qc = qcData[0];
            setQcReport({
              qc_id: qc.qc_id,
              production_order_id: qc.production_order_id,
              check_type: qc.check_type || 'N/A',
              check_date: qc.check_date || qc.created_at,
              checked_by_name: qc.checked_by_emp?.full_name || 'QC Team',
              color_accuracy: qc.color_accuracy || 'NA',
              print_quality: qc.print_quality || 'NA',
              binding_quality: qc.binding_quality || 'NA',
              material_quality: qc.material_quality || 'NA',
              dimensional_accuracy: qc.dimensional_accuracy || 'NA',
              finishing_quality: qc.finishing_quality || 'NA',
              overall_status: qc.overall_status || 'Failed',
              defect_type: qc.defect_type,
              defect_quantity: qc.defect_quantity || 0,
              defect_description: qc.defect_description,
              rework_required: qc.rework_required || false,
              rework_description: qc.rework_description,
              notes: qc.notes,
              created_at: qc.created_at,
              customer_name: job.customer || 'Unknown',
              product_name: job.product || 'Unknown'
            });
          }
        } catch (err) {
          console.error('Failed to fetch QC report:', err);
        } finally {
          setLoadingReport(false);
        }
      }
    };

    fetchQCReport();
  }, [job.id, isReworkRequired, isProduction]);

  const handleStartWork = async () => {
    try {
      setUpdating(true);
      if (isSample) {
        await supabase
          .from('sample_orders')
          .update({ status: 'In Progress' })
          .eq('sample_order_id', job.id);
      } else {
        const updateData: any = { status: 'In Progress' };
        if (job.status === "Rework Required" || job.status === "Failed") {
          await supabase
            .from('job_activity_logs')
            .insert([{
              job_id: job.id,
              job_type: job.type,
              activity_type: 'rework_started',
              reason: 'Rework started after QC failure',
              notes: 'Operator started rework',
              timestamp: new Date().toISOString()
            }]);
        }
        await supabase
          .from('production_orders')
          .update(updateData)
          .eq('production_order_id', job.id);
      }
      setRunning(true);
      onStatusUpdate();
    } catch (err) {
      console.error("Failed to start work:", err);
      alert("Failed to start. Please try again.");
    } finally {
      setUpdating(false);
    }
  };

  const handlePauseWork = async () => {
    if (!pauseReason) {
      alert("Please select a reason for pausing");
      return;
    }

    try {
      setUpdating(true);
      if (isSample) {
        await supabase
          .from('sample_orders')
          .update({ status: 'Pending' })
          .eq('sample_order_id', job.id);
      } else {
        await supabase
          .from('production_orders')
          .update({ status: 'Pending' })
          .eq('production_order_id', job.id);
      }
      setRunning(false);
      setShowPauseModal(false);
      setPauseReason("");
      setPauseNote("");

      await supabase
        .from('job_activity_logs')
        .insert([{
          job_id: job.id,
          job_type: job.type,
          activity_type: 'paused',
          reason: pauseReason,
          notes: pauseNote,
          timestamp: new Date().toISOString()
        }]);

      onStatusUpdate();
      alert(`Job paused. Reason: ${pauseReason}`);
    } catch (err) {
      console.error("Failed to pause:", err);
      alert("Failed to pause. Please try again.");
    } finally {
      setUpdating(false);
    }
  };

  const handleSubmitMaterialUsage = async () => {
    if (!selectedInventoryItem) {
      alert("Please select a material");
      return;
    }
    if (materialQuantity <= 0) {
      alert("Please enter quantity used");
      return;
    }

    try {
      setUpdating(true);

      const inventoryItem = inventoryItems.find(item => String(item.id) === selectedInventoryItem);
      if (!inventoryItem) {
        alert("Inventory item not found");
        return;
      }

      if (inventoryItem.current < materialQuantity) {
        alert(`Not enough stock. Available: ${inventoryItem.current} ${inventoryItem.unit}`);
        return;
      }

      const newQuantity = inventoryItem.current - materialQuantity;

      // Update inventory
      const { error: updateError } = await supabase
        .from('inventory')
        .update({ current: newQuantity, updated_at: new Date().toISOString() })
        .eq('id', inventoryItem.id);

      if (updateError) throw updateError;

      // Create usage log
      const { error: logError } = await supabase
        .from('material_usage_logs')
        .insert([{
          job_id: job.id,
          job_type: job.type,
          inventory_item_id: inventoryItem.id,
          quantity_used: materialQuantity,
          quantity_waste: wasteQuantity || 0,
          notes: materialNote,
          timestamp: new Date().toISOString()
        }]);

      if (logError) throw logError;

      // Update job with material usage
      await supabase
        .from(job.type === 'sample' ? 'sample_orders' : 'production_orders')
        .update({
          material_used: materialQuantity,
          material_waste: wasteQuantity || 0,
          material_used_at: new Date().toISOString()
        })
        .eq(job.type === 'sample' ? 'sample_order_id' : 'production_order_id', job.id);

      setMaterialUsed(materialQuantity);
      setMaterialWaste(wasteQuantity || 0);

      setSelectedInventoryItem("");
      setMaterialQuantity(0);
      setWasteQuantity(0);
      setMaterialNote("");
      setShowMaterialModal(false);

      // IMPORTANT: Refresh inventory and jobs to reflect changes
      onInventoryUpdate();
      onStatusUpdate();

      alert(`✅ Material usage recorded successfully!\nUsed: ${materialQuantity} ${inventoryItem.unit}\nWaste: ${wasteQuantity || 0} ${inventoryItem.unit}`);
    } catch (err) {
      console.error("Failed to record material usage:", err);
      alert("Failed to record material usage. Please try again.");
    } finally {
      setUpdating(false);
    }
  };

  const handleMarkDone = async () => {
    try {
      setUpdating(true);
      if (isSample) {
        await supabase
          .from('sample_orders')
          .update({ status: 'QC Pending' })
          .eq('sample_order_id', job.id);

        await supabase
          .from('job_activity_logs')
          .insert([{
            job_id: job.id,
            job_type: job.type,
            activity_type: 'completed',
            reason: 'Sample completed - sent for QC',
            notes: doneNote || 'Sample work completed',
            timestamp: new Date().toISOString()
          }]);

        alert("✅ Sample job completed! Sent to Quality Control.");
      } else {
        await supabase
          .from('production_orders')
          .update({
            status: 'QC Pending',
            progress: 100
          })
          .eq('production_order_id', job.id);

        await supabase
          .from('job_activity_logs')
          .insert([{
            job_id: job.id,
            job_type: job.type,
            activity_type: 'completed',
            reason: 'Production completed - sent to QC',
            notes: doneNote || 'Production work completed',
            timestamp: new Date().toISOString()
          }]);

        alert("✅ Production job completed! Sent to Quality Control for inspection.");
      }
      setShowDoneModal(false);
      setDoneNote("");
      onStatusUpdate();
    } catch (err) {
      console.error("Failed to mark as done:", err);
      alert("Failed to mark job as done. Please try again.");
    } finally {
      setUpdating(false);
    }
  };

  const handleMarkComplete = async () => {
    if (isReworkRequired && isProduction) {
      if (!qcReport) {
        try {
          const { data } = await supabase
            .from('quality_checks')
            .select(`
              *,
              checked_by_emp:checked_by (full_name)
            `)
            .eq('production_order_id', job.id)
            .order('created_at', { ascending: false })
            .limit(1);

          if (data && data.length > 0) {
            const qc = data[0];
            setQcReport({
              qc_id: qc.qc_id,
              production_order_id: qc.production_order_id,
              check_type: qc.check_type || 'N/A',
              check_date: qc.check_date || qc.created_at,
              checked_by_name: qc.checked_by_emp?.full_name || 'QC Team',
              color_accuracy: qc.color_accuracy || 'NA',
              print_quality: qc.print_quality || 'NA',
              binding_quality: qc.binding_quality || 'NA',
              material_quality: qc.material_quality || 'NA',
              dimensional_accuracy: qc.dimensional_accuracy || 'NA',
              finishing_quality: qc.finishing_quality || 'NA',
              overall_status: qc.overall_status || 'Failed',
              defect_type: qc.defect_type,
              defect_quantity: qc.defect_quantity || 0,
              defect_description: qc.defect_description,
              rework_required: qc.rework_required || false,
              rework_description: qc.rework_description,
              notes: qc.notes,
              created_at: qc.created_at,
              customer_name: job.customer || 'Unknown',
              product_name: job.product || 'Unknown'
            });
            setShowQCReportModal(true);
            return;
          }
        } catch (err) {
          console.error('Failed to fetch QC report:', err);
        }
      }

      if (qcReport) {
        setShowQCReportModal(true);
        return;
      }
    }
    setShowDoneModal(true);
  };

  const handleStartRework = async () => {
    try {
      setUpdating(true);

      await supabase
        .from('production_orders')
        .update({
          status: 'In Progress',
          progress: 0
        })
        .eq('production_order_id', job.id);

      await supabase
        .from('job_activity_logs')
        .insert([{
          job_id: job.id,
          job_type: job.type,
          activity_type: 'rework_started',
          reason: 'Rework started after QC feedback',
          notes: reworkNote || 'Rework initiated',
          timestamp: new Date().toISOString()
        }]);

      setShowQCReportModal(false);
      setReworkNote("");
      setRunning(true);
      alert("✅ Rework started! Please address the QC feedback and complete the job again.");
      onStatusUpdate();
    } catch (err) {
      console.error("Failed to start rework:", err);
      alert("Failed to start rework. Please try again.");
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
      await supabase
        .from('job_issue_logs')
        .insert([{
          job_id: job.id,
          job_type: job.type,
          issue_type: issueType,
          description: issueDesc,
          reported_by: currentEmployee,
          timestamp: new Date().toISOString()
        }]);

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
    if (job.status === "Awaiting Approval") return "bg-yellow-50 text-yellow-700 border-yellow-200";
    if (job.status === "QC Pending") return "bg-amber-50 text-amber-700 border-amber-200";
    if (job.status === "Completed") return "bg-green-50 text-green-700 border-green-200";
    if (job.status === "Approved") return "bg-green-50 text-green-700 border-green-200";
    if (job.status === "Production Created") return "bg-purple-50 text-purple-700 border-purple-200";
    if (job.status === "In Progress") return "bg-indigo-50 text-indigo-700 border-indigo-200";
    if (job.status === "Rework Required" || job.status === "Failed") return "bg-red-50 text-red-700 border-red-200";
    return "bg-slate-100 text-slate-600 border-slate-200";
  };

  const getStatusDisplay = () => {
    if (running && job.status === "In Progress") return "Running";
    if (job.status === "Awaiting Approval") return "⏳ Awaiting Approval";
    if (job.status === "In Progress" && !running) return "Paused";
    if (job.status === "Rework Required" || job.status === "Failed") return "⚠️ Rework Required";
    return job.status;
  };

  const getRatingBadge = (rating: string) => {
    const map: Record<string, string> = {
      Excellent: "bg-green-100 text-green-700 border-green-200",
      Good: "bg-blue-100 text-blue-700 border-blue-200",
      Fair: "bg-amber-100 text-amber-700 border-amber-200",
      Poor: "bg-red-100 text-red-700 border-red-200",
      NA: "bg-slate-100 text-slate-500 border-slate-200",
    };
    return (
      <span className={`inline-flex px-2 py-0.5 rounded border text-xs font-medium ${map[rating] ?? map.NA}`}>
        {rating}
      </span>
    );
  };

  return (
    <div className={`bg-card border rounded-xl overflow-hidden ${running ? "border-indigo-200" : isReworkRequired ? "border-red-200" : "border-slate-200"}`}>
      {running && <div className="h-1 bg-indigo-600" />}
      {isReworkRequired && <div className="h-1 bg-red-500" />}

      <div className="p-5">
        {/* QC Report Modal */}
        {showQCReportModal && qcReport && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                  <AlertTriangle size={20} className="text-red-500" />
                  QC Report #{qcReport.qc_id} - Failed
                </h3>
                <button onClick={() => setShowQCReportModal(false)} className="text-slate-400 hover:text-slate-600">
                  <X size={20} />
                </button>
              </div>

              <p className="text-sm text-slate-500 mb-4">
                {qcReport.production_order_id} · {qcReport.customer_name}
              </p>

              {/* Job Info */}
              <div className="grid grid-cols-3 gap-3 text-xs mb-4">
                <div className="bg-slate-50 rounded-lg p-2.5">
                  <p className="text-slate-400 mb-0.5">Product</p>
                  <p className="text-slate-800 font-semibold truncate">{qcReport.product_name}</p>
                </div>
                <div className="bg-slate-50 rounded-lg p-2.5">
                  <p className="text-slate-400 mb-0.5">Check Type</p>
                  <p className="text-slate-800 font-semibold">{qcReport.check_type}</p>
                </div>
                <div className="bg-slate-50 rounded-lg p-2.5">
                  <p className="text-slate-400 mb-0.5">Quantity</p>
                  <p className="text-slate-800 font-semibold">{job.quantity.toLocaleString()} pcs</p>
                </div>
                <div className="bg-slate-50 rounded-lg p-2.5">
                  <p className="text-slate-400 mb-0.5">Inspector</p>
                  <p className="text-slate-800 font-semibold">{qcReport.checked_by_name}</p>
                </div>
                <div className="bg-slate-50 rounded-lg p-2.5">
                  <p className="text-slate-400 mb-0.5">Check Date</p>
                  <p className="text-slate-800 font-semibold">{new Date(qcReport.check_date).toLocaleDateString()}</p>
                </div>
                <div className="bg-slate-50 rounded-lg p-2.5">
                  <p className="text-slate-400 mb-0.5">QC Result</p>
                  <span className="inline-flex px-2 py-0.5 rounded border text-xs font-medium bg-red-50 text-red-700 border-red-200">
                    {qcReport.overall_status}
                  </span>
                </div>
              </div>

              {/* Quality Ratings */}
              <div className="mb-4">
                <p className="text-xs font-semibold text-slate-700 mb-2">Quality Ratings</p>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: "Color Accuracy", value: qcReport.color_accuracy },
                    { label: "Print Quality", value: qcReport.print_quality },
                    { label: "Material Quality", value: qcReport.material_quality },
                    { label: "Dimensional Accuracy", value: qcReport.dimensional_accuracy },
                    { label: "Finishing Quality", value: qcReport.finishing_quality },
                    { label: "Binding Quality", value: qcReport.binding_quality },
                  ].map((r) => (
                    <div key={r.label} className="flex items-center justify-between p-2.5 bg-slate-50 rounded-lg border border-slate-100">
                      <span className="text-xs text-slate-600">{r.label}</span>
                      {getRatingBadge(r.value)}
                    </div>
                  ))}
                </div>
              </div>

              {/* Defects */}
              {(qcReport.defect_description || qcReport.defect_quantity > 0) && (
                <div className="p-3 bg-red-50 border border-red-100 rounded-lg mb-4 space-y-1.5">
                  <p className="text-xs font-semibold text-red-800">Defects Found</p>
                  {qcReport.defect_type && (
                    <p className="text-xs text-red-700">Type: <span className="font-medium">{qcReport.defect_type}</span></p>
                  )}
                  {qcReport.defect_quantity > 0 && (
                    <p className="text-xs text-red-700">Quantity: <span className="font-medium">{qcReport.defect_quantity} pcs</span></p>
                  )}
                  {qcReport.defect_description && (
                    <p className="text-xs text-red-700 whitespace-pre-wrap">{qcReport.defect_description}</p>
                  )}
                </div>
              )}

              {/* Rework Instructions */}
              {qcReport.rework_description && (
                <div className="p-3 bg-orange-50 border border-orange-100 rounded-lg mb-4">
                  <p className="text-xs font-semibold text-orange-800 mb-1">Rework Instructions</p>
                  <p className="text-xs text-orange-700 whitespace-pre-wrap">{qcReport.rework_description}</p>
                </div>
              )}

              {/* Notes */}
              {qcReport.notes && (
                <div className="p-3 bg-slate-50 border border-slate-100 rounded-lg mb-4">
                  <p className="text-xs font-semibold text-slate-700 mb-1">Inspector Notes</p>
                  <p className="text-xs text-slate-600">{qcReport.notes}</p>
                </div>
              )}

              <div className="mb-4">
                <label className="text-xs text-slate-500 block mb-1">Rework Notes (Optional)</label>
                <textarea
                  value={reworkNote}
                  onChange={(e) => setReworkNote(e.target.value)}
                  placeholder="Add notes about the rework..."
                  rows={2}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
                />
              </div>

              <div className="flex gap-2">
                <button
                  onClick={handleStartRework}
                  disabled={updating}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {updating ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Play size={16} />
                  )}
                  {updating ? "Processing..." : "Start Rework"}
                </button>
                <button
                  onClick={() => setShowQCReportModal(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 transition-colors text-sm font-medium"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {showDoneModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl p-6 max-w-md w-full">
              <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2 mb-2">
                <CheckCircle size={20} className="text-green-500" />
                Mark Job as Done
              </h3>
              <p className="text-sm text-slate-500 mb-4">
                {isSample
                  ? "Sample job will be sent to Quality Control for inspection."
                  : "Production job will be sent to Quality Control for inspection."}
              </p>
              <div className="bg-slate-50 rounded-lg p-3 mb-4 space-y-1">
                <p className="text-xs text-slate-500">Job</p>
                <p className="text-sm font-medium text-slate-900">{job.id}</p>
                <p className="text-xs text-slate-500 mt-1">Product</p>
                <p className="text-sm font-medium text-slate-900">{job.product}</p>
                <p className="text-xs text-slate-500 mt-1">Quantity</p>
                <p className="text-sm font-medium text-slate-900">{job.quantity.toLocaleString()} units</p>
              </div>
              <div className="mb-4">
                <label className="text-xs text-slate-500 block mb-1">Completion Notes (Optional)</label>
                <textarea
                  value={doneNote}
                  onChange={(e) => setDoneNote(e.target.value)}
                  placeholder="Add any completion notes..."
                  rows={2}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleMarkDone}
                  disabled={updating}
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {updating ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <CheckCircle size={16} />
                  )}
                  {updating ? "Processing..." : isSample ? "Send to QC" : "Confirm Done"}
                </button>
                <button
                  onClick={() => { setShowDoneModal(false); setDoneNote(""); }}
                  className="px-4 py-2 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 transition-colors text-sm font-medium"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              {isSample ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-amber-50 text-amber-700 border border-amber-200">
                  <FlaskConical size={10} /> Sample
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-indigo-50 text-indigo-700 border border-indigo-200">
                  <Factory size={10} /> Production
                </span>
              )}
              <p className="text-indigo-600 text-xs" style={{ fontWeight: 600 }}>{job.id}</p>
              <span className={`inline-flex px-2 py-0.5 rounded border text-xs ${job.priority === "High" ? "bg-red-50 text-red-700 border-red-200" :
                job.priority === "Medium" ? "bg-amber-50 text-amber-700 border-amber-200" :
                  "bg-slate-50 text-slate-600 border-slate-200"
                }`} style={{ fontWeight: 500 }}>{job.priority} Priority</span>
              {isReworkRequired && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-red-100 text-red-700 border border-red-200">
                  <AlertTriangle size={10} /> Rework
                </span>
              )}
            </div>
            <h3 className="text-slate-900 text-sm" style={{ fontWeight: 700 }}>{job.product}</h3>
            <p className="text-slate-500 text-xs mt-0.5">{job.customer} · {job.machine}</p>
          </div>
          <span className={`inline-flex px-2 py-0.5 rounded border text-xs flex-shrink-0 ${getStatusColor()}`} style={{ fontWeight: 500 }}>
            {getStatusDisplay()}
          </span>
        </div>

        {(materialUsed > 0 || materialWaste > 0) && (
          <div className="bg-slate-50 rounded-lg p-2 mb-3 flex items-center gap-4 text-xs">
            {materialUsed > 0 && (
              <span className="flex items-center gap-1">
                <Package size={12} className="text-green-600" />
                Used: <span className="font-semibold">{materialUsed} units</span>
              </span>
            )}
            {materialWaste > 0 && (
              <span className="flex items-center gap-1">
                <Trash2 size={12} className="text-red-500" />
                Waste: <span className="font-semibold text-red-600">{materialWaste} units</span>
              </span>
            )}
          </div>
        )}

        <div className="mb-4">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs text-slate-500">Progress</span>
            <span className="text-xs text-slate-800" style={{ fontWeight: 700 }}>{job.quantity.toLocaleString()} units ({progress}%)</span>
          </div>
          <div className="h-2.5 rounded-full bg-slate-100 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${running ? "bg-indigo-500" : isReworkRequired ? "bg-red-400" : "bg-slate-400"}`}
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

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

        <div className="flex items-center gap-4 text-xs text-slate-500 mb-4">
          <span className="flex items-center gap-1"><Clock size={11} /> Created: <span className="text-slate-700" style={{ fontWeight: 500 }}>{new Date(job.createdDate).toLocaleDateString()}</span></span>
          <span className="flex items-center gap-1"><Clock size={11} /> Due by: <span className="text-slate-700" style={{ fontWeight: 500 }}>{new Date(job.dueDate).toLocaleDateString()}</span></span>
        </div>

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
        ) : showMaterialModal ? (
          <div className="border border-green-200 rounded-xl p-4 bg-green-50">
            <div className="flex items-center justify-between mb-3">
              <p className="text-green-700 text-xs" style={{ fontWeight: 600 }}>Record Material Usage</p>
              <button onClick={() => setShowMaterialModal(false)} disabled={updating}>
                <X size={14} className="text-green-400" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-green-700 mb-1" style={{ fontWeight: 500 }}>Material</label>
                <select
                  value={selectedInventoryItem}
                  onChange={(e) => setSelectedInventoryItem(e.target.value)}
                  className="w-full text-xs border border-green-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-green-500/20"
                >
                  <option value="">Select material...</option>
                  {availableInventory.map((item) => (
                    <option key={item.id} value={String(item.id)}>
                      {item.item} ({item.current} {item.unit} available)
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-green-700 mb-1" style={{ fontWeight: 500 }}>Quantity Used</label>
                  <input
                    type="number"
                    value={materialQuantity}
                    onChange={(e) => setMaterialQuantity(parseFloat(e.target.value) || 0)}
                    className="w-full text-xs border border-green-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-green-500/20"
                    placeholder="0"
                    min="0"
                  />
                </div>
                <div>
                  <label className="block text-xs text-green-700 mb-1" style={{ fontWeight: 500 }}>Waste</label>
                  <input
                    type="number"
                    value={wasteQuantity}
                    onChange={(e) => setWasteQuantity(parseFloat(e.target.value) || 0)}
                    className="w-full text-xs border border-green-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-green-500/20"
                    placeholder="0"
                    min="0"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs text-green-700 mb-1" style={{ fontWeight: 500 }}>Notes</label>
                <input
                  type="text"
                  value={materialNote}
                  onChange={(e) => setMaterialNote(e.target.value)}
                  className="w-full text-xs border border-green-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-green-500/20"
                  placeholder="Optional notes..."
                />
              </div>
              <button
                onClick={handleSubmitMaterialUsage}
                disabled={updating}
                className="w-full text-xs text-white bg-green-600 hover:bg-green-700 rounded-lg py-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ fontWeight: 500 }}
              >
                {updating ? "Recording..." : "Record Usage"}
              </button>
            </div>
          </div>
        ) : showPauseModal ? (
          <div className="border border-amber-200 rounded-xl p-4 bg-amber-50">
            <div className="flex items-center justify-between mb-3">
              <p className="text-amber-700 text-xs" style={{ fontWeight: 600 }}>Pause Job</p>
              <button onClick={() => setShowPauseModal(false)} disabled={updating}>
                <X size={14} className="text-amber-400" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-amber-700 mb-1" style={{ fontWeight: 500 }}>Pause Reason</label>
                <select
                  value={pauseReason}
                  onChange={(e) => setPauseReason(e.target.value)}
                  className="w-full text-xs border border-amber-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                >
                  <option value="">Select reason...</option>
                  {pauseReasons.map((r) => <option key={r}>{r}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-amber-700 mb-1" style={{ fontWeight: 500 }}>Additional Notes</label>
                <textarea
                  value={pauseNote}
                  onChange={(e) => setPauseNote(e.target.value)}
                  className="w-full text-xs border border-amber-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 resize-none"
                  rows={2}
                  placeholder="Optional notes..."
                />
              </div>
              <button
                onClick={handlePauseWork}
                disabled={updating}
                className="w-full text-xs text-white bg-amber-600 hover:bg-amber-700 rounded-lg py-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ fontWeight: 500 }}
              >
                {updating ? "Pausing..." : "Confirm Pause"}
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {/* Show "View QC Report" button for rework jobs */}
            {isReworkRequired && (
              <button
                onClick={() => {
                  if (!qcReport) {
                    const fetchReport = async () => {
                      try {
                        const { data } = await supabase
                          .from('quality_checks')
                          .select(`
                            *,
                            checked_by_emp:checked_by (full_name)
                          `)
                          .eq('production_order_id', job.id)
                          .order('created_at', { ascending: false })
                          .limit(1);

                        if (data && data.length > 0) {
                          const qc = data[0];
                          setQcReport({
                            qc_id: qc.qc_id,
                            production_order_id: qc.production_order_id,
                            check_type: qc.check_type || 'N/A',
                            check_date: qc.check_date || qc.created_at,
                            checked_by_name: qc.checked_by_emp?.full_name || 'QC Team',
                            color_accuracy: qc.color_accuracy || 'NA',
                            print_quality: qc.print_quality || 'NA',
                            binding_quality: qc.binding_quality || 'NA',
                            material_quality: qc.material_quality || 'NA',
                            dimensional_accuracy: qc.dimensional_accuracy || 'NA',
                            finishing_quality: qc.finishing_quality || 'NA',
                            overall_status: qc.overall_status || 'Failed',
                            defect_type: qc.defect_type,
                            defect_quantity: qc.defect_quantity || 0,
                            defect_description: qc.defect_description,
                            rework_required: qc.rework_required || false,
                            rework_description: qc.rework_description,
                            notes: qc.notes,
                            created_at: qc.created_at,
                            customer_name: job.customer || 'Unknown',
                            product_name: job.product || 'Unknown'
                          });
                          setShowQCReportModal(true);
                        } else {
                          alert('No QC report available for this job. Please check with your supervisor.');
                        }
                      } catch (err) {
                        console.error('Failed to fetch QC report:', err);
                        alert('Failed to load QC report. Please try again.');
                      }
                    };
                    fetchReport();
                  } else {
                    setShowQCReportModal(true);
                  }
                }}
                disabled={updating}
                className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs text-white bg-red-600 hover:bg-red-700 transition-colors disabled:opacity-50"
                style={{ fontWeight: 600 }}
              >
                <Eye size={13} /> View QC Report
              </button>
            )}

            {/* Show "Start" button for non-rework jobs that are Pending or In Progress */}
            {(job.status === "Pending" || job.status === "In Progress") && !isReworkRequired && (
              <button
                onClick={running ? () => setShowPauseModal(true) : handleStartWork}
                disabled={updating}
                className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs text-white transition-colors ${running ? "bg-amber-500 hover:bg-amber-600" : "bg-indigo-600 hover:bg-indigo-700"} disabled:opacity-50 disabled:cursor-not-allowed`}
                style={{ fontWeight: 600 }}
              >
                {updating ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : running ? (
                  <><Pause size={13} /> Pause</>
                ) : (
                  <><Play size={13} /> Start</>
                )}
              </button>
            )}

            {/* Material button - only when running */}
            {running && (
              <button
                onClick={() => setShowMaterialModal(true)}
                disabled={updating}
                className="px-3 py-2 rounded-lg text-xs text-green-600 border border-green-200 hover:bg-green-50 transition-colors flex items-center gap-1"
                style={{ fontWeight: 500 }}
              >
                <Package size={13} /> Material
              </button>
            )}

            {/* Send to QC / Done button */}
            {(job.status === "In Progress" || job.status === "Pending" || job.status === "Rework Required") &&
              !isSample &&
              !(job.status === "QC Pending") &&
              !(job.status === "Completed") &&
              !(job.status === "Dispatched") &&
              !(job.status === "Approved") &&
              !(job.status === "Production Created") &&
              !(job.status === "Awaiting Approval") && (
                <>
                  <button
                    onClick={() => setShowIssue(true)}
                    disabled={updating}
                    className="px-3 py-2 rounded-lg text-xs text-red-600 border border-red-200 hover:bg-red-50 transition-colors flex items-center gap-1 disabled:opacity-50"
                    style={{ fontWeight: 500 }}
                  >
                    <AlertTriangle size={13} /> Issue
                  </button>

                  <button
                    onClick={handleMarkComplete}
                    disabled={updating}
                    className="px-3 py-2 rounded-lg text-xs text-green-700 border border-green-200 bg-green-50 hover:bg-green-100 transition-colors flex items-center gap-1 disabled:opacity-50"
                    style={{ fontWeight: 500 }}
                  >
                    {updating ? (
                      <div className="w-4 h-4 border-2 border-green-700 border-t-transparent rounded-full animate-spin" />
                    ) : isReworkRequired ? (
                      <><CheckCircle size={13} /> Send to QC (Rework)</>
                    ) : (
                      <><CheckCircle size={13} /> Send to QC</>
                    )}
                  </button>
                </>
              )}

            {/* For sample jobs - show Done button */}
            {isSample &&
              job.status !== "QC Pending" &&
              job.status !== "Awaiting Approval" &&
              job.status !== "Production Created" &&
              job.status !== "Completed" &&
              job.status !== "Approved" && (
                <button
                  onClick={handleMarkComplete}
                  disabled={updating}
                  className="px-3 py-2 rounded-lg text-xs text-green-700 border border-green-200 bg-green-50 hover:bg-green-100 transition-colors flex items-center gap-1 disabled:opacity-50"
                  style={{ fontWeight: 500 }}
                >
                  {updating ? (
                    <div className="w-4 h-4 border-2 border-green-700 border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <><CheckCircle size={13} /> Send to QC</>
                  )}
                </button>
              )}

            {/* QC Pending status indicator */}
            {job.status === "QC Pending" && (
              <div className="flex-1 text-center py-2 px-3 rounded-lg text-xs bg-amber-50 text-amber-700 border border-amber-200">
                🔍 In Quality Control - Awaiting Inspection
              </div>
            )}

            {/* Sample awaiting approval */}
            {isSample && job.status === "Awaiting Approval" && (
              <div className="flex-1 text-center py-2 px-3 rounded-lg text-xs bg-yellow-50 text-yellow-700 border border-yellow-200">
                ⏳ Sent to Supervisor
              </div>
            )}

            {/* Production completed */}
            {!isSample && job.status === "Completed" && (
              <div className="flex-1 text-center py-2 px-3 rounded-lg text-xs bg-green-50 text-green-700 border border-green-200">
                ✅ Completed
              </div>
            )}

            {/* Rework required helper message */}
            {isReworkRequired && (
              <div className="w-full text-center py-1.5 px-3 rounded-lg text-xs bg-red-50 text-red-600 border border-red-200">
                ⚠️ After rework, click "Send to QC (Rework)" above
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export function MachineOperator() {
  const [assignedJobs, setAssignedJobs] = useState<AssignedJob[]>([]);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [operatorName, setOperatorName] = useState("Loading...");
  const [operatorMachine, setOperatorMachine] = useState("Loading...");
  const [shift, setShift] = useState("Morning Shift");
  const [currentEmployee, setCurrentEmployee] = useState("");

  const loadInventory = async () => {
    try {
      const { data, error } = await supabase
        .from('inventory')
        .select('*')
        .order('item');

      if (error) {
        console.error("Inventory fetch error:", error);
        if (error.code === 'PGRST204') {
          setInventoryItems([]);
          return;
        }
        throw error;
      }
      if (data) {
        const mappedData: InventoryItem[] = data.map((item: any) => ({
          id: item.id,
          item: item.item,
          category: item.category,
          current: item.current,
          min: item.min,
          max: item.max,
          unit: item.unit,
          unitcost: item.unitcost,
          supplier: item.supplier,
          lastorder: item.lastorder,
          created_at: item.created_at,
          updated_at: item.updated_at,
        }));
        setInventoryItems(mappedData);
      }
    } catch (err) {
      console.error("Failed to load inventory:", err);
      setInventoryItems([]);
    }
  };

  const loadJobs = async () => {
    try {
      setLoading(true);
      setError(null);

      const productionData = await api.getProductionJobs();
      const sampleData = await api.getSampleJobs();

      const emp = await api.getCurrentEmployee();
      if (emp) {
        setCurrentEmployee(emp.full_name || "");
        setOperatorName(emp.full_name || "Admin User");
      }

      await loadInventory();

      const combined: AssignedJob[] = [];

      // Add production jobs that are not completed or dispatched
      productionData.forEach(job => {
        if (job.status !== "Completed" && job.status !== "Dispatched") {
          combined.push({
            id: job.id,
            type: 'production',
            product: job.product,
            customer: job.customer,
            quantity: job.quantity,
            assignedTo: job.assignedTo,
            machine: job.machine,
            priority: job.priority,
            status: job.status,
            progress: job.progress,
            dueDate: job.dueDate,
            createdDate: job.createdDate,
            value: job.value,
            productionJobId: job.id,
            quotationId: job.quotationId,
            materialUsed: 0,
            materialWaste: 0,
          });
        }
      });

      // Add sample jobs that are not Production Created
      sampleData.forEach(job => {
        if (job.status !== "Production Created") {
          combined.push({
            id: job.id,
            type: 'sample',
            product: job.product,
            customer: job.customer,
            quantity: job.sampleQuantity,
            assignedTo: job.assignedTo,
            machine: 'Sample',
            priority: 'Medium',
            status: job.status,
            progress: 0,
            dueDate: job.dueDate,
            createdDate: job.createdDate,
            value: job.sampleCost,
            sampleJobId: job.id,
            quotationId: job.quotationId,
            materialUsed: 0,
            materialWaste: 0,
          });
        }
      });

      setAssignedJobs(combined);

      if (combined.length > 0 && combined[0].assignedTo) {
        setOperatorMachine(combined[0].machine || 'Sample');
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

    // Set up real-time subscription for inventory changes
    const inventorySubscription = supabase
      .channel('operator_inventory_changes')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'inventory',
        },
        () => {
          // Refresh inventory when any inventory item is updated
          loadInventory();
        }
      )
      .subscribe();

    // Set up real-time subscription for material usage logs
    const usageSubscription = supabase
      .channel('operator_usage_changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'material_usage_logs',
        },
        () => {
          // Refresh inventory when a new usage log is created
          loadInventory();
        }
      )
      .subscribe();

    return () => {
      inventorySubscription.unsubscribe();
      usageSubscription.unsubscribe();
    };
  }, []);

  const totalJobs = assignedJobs.length;
  const runningJobs = assignedJobs.filter(j => j.status === "In Progress").length;
  const pendingJobs = assignedJobs.filter(j => j.status === "Pending").length;
  const awaitingApproval = assignedJobs.filter(j => j.status === "Awaiting Approval").length;
  const reworkJobs = assignedJobs.filter(j => j.status === "Rework Required" || j.status === "Failed").length;
  const totalUnits = assignedJobs.reduce((sum, j) => sum + j.quantity, 0);
  const completedUnits = assignedJobs.reduce((sum, j) => sum + (j.quantity * (j.progress / 100)), 0);

  const avgProgress = assignedJobs.length > 0
    ? Math.round(assignedJobs.reduce((sum, j) => sum + j.progress, 0) / assignedJobs.length)
    : 0;

  const sampleJobs = assignedJobs.filter(j => j.type === 'sample');
  const productionJobs = assignedJobs.filter(j => j.type === 'production');

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

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "My Jobs Today", value: totalJobs, sub: `${runningJobs} running, ${pendingJobs} pending`, color: "text-indigo-600 bg-indigo-50" },
          { label: "Units Completed", value: Math.round(completedUnits).toLocaleString(), sub: `of ${totalUnits.toLocaleString()} total`, color: "text-green-600 bg-green-50" },
          { label: "Avg Progress", value: `${avgProgress}%`, sub: "Across all jobs", color: "text-purple-600 bg-purple-50" },
          { label: "Rework Required", value: reworkJobs, sub: "Jobs needing rework", color: "text-red-600 bg-red-50" },
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

      {sampleJobs.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-slate-700 text-sm flex items-center gap-2" style={{ fontWeight: 600 }}>
              <FlaskConical size={16} className="text-amber-500" /> Sample Jobs
            </h2>
            <span className="text-xs text-slate-400">{sampleJobs.length} jobs</span>
          </div>
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            {sampleJobs.map((job) => (
              <JobCard
                key={job.id}
                job={job}
                onStatusUpdate={loadJobs}
                inventoryItems={inventoryItems}
                onInventoryUpdate={loadInventory}
                currentEmployee={currentEmployee}
              />
            ))}
          </div>
        </div>
      )}

      {productionJobs.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-slate-700 text-sm flex items-center gap-2" style={{ fontWeight: 600 }}>
              <Factory size={16} className="text-indigo-500" /> Production Jobs
            </h2>
            <span className="text-xs text-slate-400">{productionJobs.length} jobs</span>
          </div>
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            {productionJobs.map((job) => (
              <JobCard
                key={job.id}
                job={job}
                onStatusUpdate={loadJobs}
                inventoryItems={inventoryItems}
                onInventoryUpdate={loadInventory}
                currentEmployee={currentEmployee}
              />
            ))}
          </div>
        </div>
      )}

      {sampleJobs.length === 0 && productionJobs.length === 0 && (
        <div className="text-center py-12 bg-card border border-border rounded-xl">
          <div className="text-slate-400 mb-2">
            <Cpu size={48} className="mx-auto" />
          </div>
          <p className="text-slate-500 text-sm">No jobs assigned</p>
          <p className="text-slate-400 text-xs mt-1">Check back later for new assignments</p>
        </div>
      )}
    </div>
  );
}