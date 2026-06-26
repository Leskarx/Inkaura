import { useState, useEffect } from "react";
import {
  Cog, AlertTriangle, CheckCircle, Clock, Wrench, Activity,
  Calendar, Plus, ChevronRight, X, Save, RotateCcw, Eye, CalendarPlus
} from "lucide-react";
import { api, supabase } from "../server/api";

// Types
interface Machine {
  machine_id: number;
  machine_code: string;
  machine_name: string;
  machine_type: string;
  status: string;
  is_operational: boolean;
  current_utilization_percent: number;
  max_production_per_hour: number;
  last_maintenance_date: string;
  next_maintenance_date: string;
  model?: string;
  manufacturer?: string;
  purchase_date?: string;
  installation_date?: string;
}

interface MaintenanceLog {
  machine: string;
  type: string;
  date: string;
  notes: string;
  assignedTo: string;
}

const statusColors: Record<string, { bg: string; text: string; border: string; dot: string }> = {
  'Active': { bg: "bg-green-50", text: "text-green-700", border: "border-green-200", dot: "bg-green-500" },
  'Idle': { bg: "bg-slate-50", text: "text-slate-600", border: "border-slate-200", dot: "bg-slate-400" },
  'Maintenance': { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200", dot: "bg-amber-500" },
  'Breakdown': { bg: "bg-red-50", text: "text-red-700", border: "border-red-200", dot: "bg-red-500" },
  'Setup': { bg: "bg-sky-50", text: "text-sky-700", border: "border-sky-200", dot: "bg-sky-500" },
  'Inactive': { bg: "bg-slate-100", text: "text-slate-500", border: "border-slate-200", dot: "bg-slate-300" },
};

export function MachineManagement() {
  const [machines, setMachines] = useState<Machine[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<"grid" | "table">("grid");
  const [filter, setFilter] = useState("All");
  const [maintenanceLogs, setMaintenanceLogs] = useState<MaintenanceLog[]>([]);

  // Add Machine Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    machine_code: "",
    machine_name: "",
    machine_type: "",
    status: "Active",
    is_operational: true,
    max_production_per_hour: 0,
    manufacturer: "",
    model: "",
    purchase_date: "",
    installation_date: "",
  });

  // Details Modal State
  const [selectedMachine, setSelectedMachine] = useState<Machine | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);

  // Schedule PM Modal State
  const [scheduleMachine, setScheduleMachine] = useState<Machine | null>(null);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [scheduleDate, setScheduleDate] = useState("");
  const [scheduleNotes, setScheduleNotes] = useState("");
  const [scheduling, setScheduling] = useState(false);

  // Function to generate next machine code
  const generateMachineCode = (existingMachines: Machine[]): string => {
    const machineCodes = existingMachines
      .filter(m => m.machine_code && m.machine_code.startsWith('M-'))
      .map(m => {
        const num = parseInt(m.machine_code.replace('M-', ''));
        return isNaN(num) ? 0 : num;
      })
      .filter(num => num > 0);

    const maxNum = machineCodes.length > 0 ? Math.max(...machineCodes) : 0;
    const nextNum = maxNum + 1;

    return `M-${String(nextNum).padStart(3, '0')}`;
  };

  // Fetch machines from API
  const loadMachines = async () => {
    try {
      setLoading(true);
      setError(null);

      const machinesData = await api.getMachines();

      const mappedMachines: Machine[] = machinesData.map((m: any) => ({
        machine_id: m.id,
        machine_code: m.code || `M-${String(m.id).padStart(3, '0')}`,
        machine_name: m.name,
        machine_type: m.type || 'General',
        status: m.status || 'Active',
        is_operational: m.isOperational !== undefined ? m.isOperational : true,
        current_utilization_percent: 0,
        max_production_per_hour: 0,
        last_maintenance_date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        next_maintenance_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        model: m.model,
        manufacturer: m.manufacturer,
      }));

      setMachines(mappedMachines);

      // If add modal is open, update the generated machine code
      if (showAddModal) {
        const newCode = generateMachineCode(mappedMachines);
        setFormData(prev => ({ ...prev, machine_code: newCode }));
      }

      // Try to fetch production jobs to calculate utilization
      try {
        const productionJobs = await api.getProductionJobs();
        const updatedMachines = mappedMachines.map(machine => {
          const machineJobs = productionJobs.filter(job => job.machine === machine.machine_name);
          const totalProgress = machineJobs.reduce((sum, job) => sum + job.progress, 0);
          const avgProgress = machineJobs.length > 0 ? totalProgress / machineJobs.length : 0;

          return {
            ...machine,
            current_utilization_percent: Math.round(avgProgress * 0.8 + 10),
          };
        });
        setMachines(updatedMachines);
      } catch (prodErr) {
        console.warn('Could not fetch production data for utilization:', prodErr);
      }

    } catch (err) {
      console.error('Failed to load machines:', err);
      setError('Failed to load machine data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMachines();
  }, []);

  // Generate maintenance logs from machine data
  useEffect(() => {
    const logs: MaintenanceLog[] = [];

    machines.forEach(machine => {
      const now = new Date();
      const nextMaintenance = new Date(machine.next_maintenance_date);
      const daysUntilMaintenance = Math.ceil((nextMaintenance.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

      if (daysUntilMaintenance < 0) {
        logs.push({
          machine: machine.machine_code,
          type: 'Overdue',
          date: machine.next_maintenance_date,
          notes: `${machine.machine_name} - Maintenance overdue by ${Math.abs(daysUntilMaintenance)} days`,
          assignedTo: 'Schedule maintenance',
        });
      } else if (daysUntilMaintenance < 7) {
        logs.push({
          machine: machine.machine_code,
          type: 'Preventive',
          date: machine.next_maintenance_date,
          notes: `${machine.machine_name} - Maintenance due in ${daysUntilMaintenance} days`,
          assignedTo: 'Schedule maintenance',
        });
      }
    });

    setMaintenanceLogs(logs.slice(0, 5));
  }, [machines]);

  // Handle Add Machine
  const handleAddMachine = async () => {
    if (!formData.machine_name.trim()) {
      alert('Machine Name is required');
      return;
    }
    if (!formData.machine_type.trim()) {
      alert('Machine Type is required');
      return;
    }

    try {
      setSubmitting(true);

      const { data, error } = await supabase
        .from('machines')
        .insert([{
          machine_code: formData.machine_code,
          machine_name: formData.machine_name,
          machine_type: formData.machine_type,
          status: formData.status,
          is_operational: formData.is_operational,
          max_production_per_hour: formData.max_production_per_hour || null,
          manufacturer: formData.manufacturer || null,
          model: formData.model || null,
          purchase_date: formData.purchase_date || null,
          installation_date: formData.installation_date || null,
          current_utilization_percent: 0,
          last_maintenance_date: new Date().toISOString().split('T')[0],
          next_maintenance_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        }])
        .select();

      if (error) {
        console.error('Error adding machine:', error);
        if (error.code === '23505') {
          const newCode = generateMachineCode(machines);
          setFormData(prev => ({ ...prev, machine_code: newCode }));
          alert('Machine code already exists. A new code has been generated. Please try again.');
        } else {
          alert('Failed to add machine: ' + error.message);
        }
        return;
      }

      setFormData({
        machine_code: "",
        machine_name: "",
        machine_type: "",
        status: "Active",
        is_operational: true,
        max_production_per_hour: 0,
        manufacturer: "",
        model: "",
        purchase_date: "",
        installation_date: "",
      });
      setShowAddModal(false);

      await loadMachines();
      alert('Machine added successfully!');

    } catch (err) {
      console.error('Error adding machine:', err);
      alert('Failed to add machine. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Schedule PM
  const handleSchedulePM = async () => {
    if (!scheduleMachine) return;
    if (!scheduleDate) {
      alert('Please select a maintenance date');
      return;
    }

    try {
      setScheduling(true);

      const { error } = await supabase
        .from('machines')
        .update({
          next_maintenance_date: scheduleDate,
          last_maintenance_date: new Date().toISOString().split('T')[0],
          maintenance_notes: scheduleNotes || null,
        })
        .eq('machine_id', scheduleMachine.machine_id);

      if (error) {
        console.error('Error scheduling maintenance:', error);
        alert('Failed to schedule maintenance: ' + error.message);
        return;
      }

      setShowScheduleModal(false);
      setScheduleDate("");
      setScheduleNotes("");
      setScheduleMachine(null);

      await loadMachines();
      alert('Maintenance scheduled successfully!');

    } catch (err) {
      console.error('Error scheduling maintenance:', err);
      alert('Failed to schedule maintenance. Please try again.');
    } finally {
      setScheduling(false);
    }
  };

  const openAddModal = () => {
    const newCode = generateMachineCode(machines);
    setFormData(prev => ({
      ...prev,
      machine_code: newCode,
    }));
    setShowAddModal(true);
  };

  const openDetailsModal = (machine: Machine) => {
    setSelectedMachine(machine);
    setShowDetailsModal(true);
  };

  const openScheduleModal = (machine: Machine) => {
    setScheduleMachine(machine);
    setScheduleDate(machine.next_maintenance_date || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
    setScheduleNotes("");
    setShowScheduleModal(true);
  };

  const filtered = machines.filter((m) => filter === "All" || m.status === filter);
  const running = machines.filter((m) => m.status === "Active" && m.is_operational).length;
  const alerts = machines.filter((m) => {
    const nextMaintenance = new Date(m.next_maintenance_date);
    const now = new Date();
    return nextMaintenance < now || !m.is_operational;
  }).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-slate-500">Loading machines...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col justify-center items-center h-96">
        <div className="text-red-600 text-lg mb-4">⚠️ {error}</div>
        <button
          onClick={loadMachines}
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Add Machine Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 sticky top-0 bg-white">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Cog size={20} className="text-indigo-600" /> Add New Machine
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Machine Code <span className="text-green-500 text-xs">(Auto-generated)</span>
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={formData.machine_code}
                      readOnly
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 text-slate-600 cursor-not-allowed"
                    />
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      <span className="text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded-full">Auto</span>
                    </div>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">Machine code is automatically generated</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Machine Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.machine_name}
                    onChange={(e) => setFormData({ ...formData, machine_name: e.target.value })}
                    placeholder="e.g., Heidelberg SM 52"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Machine Type <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.machine_type}
                    onChange={(e) => setFormData({ ...formData, machine_type: e.target.value })}
                    placeholder="e.g., Offset, Digital, Flexo"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Manufacturer</label>
                  <input
                    type="text"
                    value={formData.manufacturer}
                    onChange={(e) => setFormData({ ...formData, manufacturer: e.target.value })}
                    placeholder="e.g., Heidelberg, Komori"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Model</label>
                  <input
                    type="text"
                    value={formData.model}
                    onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                    placeholder="e.g., SM 52-4"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Max Production (per hour)</label>
                  <input
                    type="number"
                    value={formData.max_production_per_hour || ''}
                    onChange={(e) => setFormData({ ...formData, max_production_per_hour: parseInt(e.target.value) || 0 })}
                    placeholder="e.g., 15000"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
                  >
                    <option value="Active">Active</option>
                    <option value="Idle">Idle</option>
                    <option value="Setup">Setup</option>
                    <option value="Maintenance">Maintenance</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Operational Status</label>
                  <select
                    value={formData.is_operational ? "true" : "false"}
                    onChange={(e) => setFormData({ ...formData, is_operational: e.target.value === "true" })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
                  >
                    <option value="true">Operational</option>
                    <option value="false">Non-Operational</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Purchase Date</label>
                  <input
                    type="date"
                    value={formData.purchase_date}
                    onChange={(e) => setFormData({ ...formData, purchase_date: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Installation Date</label>
                  <input
                    type="date"
                    value={formData.installation_date}
                    onChange={(e) => setFormData({ ...formData, installation_date: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
                  />
                </div>
              </div>

              <div className="mt-6 flex justify-end gap-3 border-t border-slate-100 pt-4">
                <button
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddMachine}
                  disabled={submitting}
                  className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {submitting ? (
                    <>
                      <RotateCcw size={16} className="animate-spin" />
                      Adding...
                    </>
                  ) : (
                    <>
                      <Save size={16} /> Add Machine
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Machine Details Modal */}
      {showDetailsModal && selectedMachine && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 sticky top-0 bg-white">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Cog size={20} className="text-indigo-600" /> Machine Details
              </h3>
              <button
                onClick={() => setShowDetailsModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-50 rounded-lg p-4">
                  <p className="text-xs text-slate-500">Machine Code</p>
                  <p className="text-lg font-bold text-slate-900">{selectedMachine.machine_code}</p>
                </div>
                <div className="bg-slate-50 rounded-lg p-4">
                  <p className="text-xs text-slate-500">Status</p>
                  <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded border text-xs ${statusColors[selectedMachine.status]?.bg} ${statusColors[selectedMachine.status]?.text} ${statusColors[selectedMachine.status]?.border}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${statusColors[selectedMachine.status]?.dot}`} />
                    {selectedMachine.status}
                  </span>
                </div>
                <div className="bg-slate-50 rounded-lg p-4">
                  <p className="text-xs text-slate-500">Machine Name</p>
                  <p className="text-sm font-semibold text-slate-900">{selectedMachine.machine_name}</p>
                </div>
                <div className="bg-slate-50 rounded-lg p-4">
                  <p className="text-xs text-slate-500">Machine Type</p>
                  <p className="text-sm font-semibold text-slate-900">{selectedMachine.machine_type}</p>
                </div>
                <div className="bg-slate-50 rounded-lg p-4">
                  <p className="text-xs text-slate-500">Manufacturer</p>
                  <p className="text-sm font-semibold text-slate-900">{selectedMachine.manufacturer || 'N/A'}</p>
                </div>
                <div className="bg-slate-50 rounded-lg p-4">
                  <p className="text-xs text-slate-500">Model</p>
                  <p className="text-sm font-semibold text-slate-900">{selectedMachine.model || 'N/A'}</p>
                </div>
                <div className="bg-slate-50 rounded-lg p-4">
                  <p className="text-xs text-slate-500">Max Production</p>
                  <p className="text-sm font-semibold text-slate-900">{selectedMachine.max_production_per_hour || 'N/A'}/hr</p>
                </div>
                <div className="bg-slate-50 rounded-lg p-4">
                  <p className="text-xs text-slate-500">Operational</p>
                  <p className={`text-sm font-semibold ${selectedMachine.is_operational ? 'text-green-600' : 'text-red-600'}`}>
                    {selectedMachine.is_operational ? '✅ Yes' : '❌ No'}
                  </p>
                </div>
                <div className="bg-slate-50 rounded-lg p-4">
                  <p className="text-xs text-slate-500">Last Maintenance</p>
                  <p className="text-sm font-semibold text-slate-900">{new Date(selectedMachine.last_maintenance_date).toLocaleDateString()}</p>
                </div>
                <div className="bg-slate-50 rounded-lg p-4">
                  <p className="text-xs text-slate-500">Next Maintenance</p>
                  <p className="text-sm font-semibold text-slate-900">{new Date(selectedMachine.next_maintenance_date).toLocaleDateString()}</p>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  onClick={() => setShowDetailsModal(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  Close
                </button>
                <button
                  onClick={() => {
                    setShowDetailsModal(false);
                    openScheduleModal(selectedMachine);
                  }}
                  className="px-4 py-2 text-sm font-medium text-white bg-amber-600 rounded-lg hover:bg-amber-700 transition-colors flex items-center gap-2"
                >
                  <CalendarPlus size={16} /> Schedule PM
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Schedule PM Modal */}
      {showScheduleModal && scheduleMachine && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <CalendarPlus size={20} className="text-amber-600" /> Schedule Maintenance
              </h3>
              <button
                onClick={() => setShowScheduleModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="bg-slate-50 rounded-lg p-3">
                <p className="text-xs text-slate-500">Machine</p>
                <p className="font-semibold text-slate-900">{scheduleMachine.machine_code} - {scheduleMachine.machine_name}</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Maintenance Date *</label>
                <input
                  type="date"
                  value={scheduleDate}
                  onChange={(e) => setScheduleDate(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Notes (Optional)</label>
                <textarea
                  value={scheduleNotes}
                  onChange={(e) => setScheduleNotes(e.target.value)}
                  placeholder="Enter maintenance notes..."
                  rows={3}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  onClick={() => setShowScheduleModal(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSchedulePM}
                  disabled={scheduling}
                  className="px-4 py-2 text-sm font-medium text-white bg-amber-600 rounded-lg hover:bg-amber-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {scheduling ? (
                    <>
                      <RotateCcw size={16} className="animate-spin" />
                      Scheduling...
                    </>
                  ) : (
                    <>
                      <Save size={16} /> Schedule
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-slate-900" style={{ fontSize: "1.25rem", fontWeight: 700 }}>Machine Management</h1>
          <p className="text-slate-500 text-sm mt-0.5">Fleet of {machines.length} machines · {running} currently running</p>
        </div>
        <div className="flex gap-2">
          <button className="px-3 py-1.5 text-xs border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 transition-colors">
            Schedule Maintenance
          </button>
          <button
            onClick={openAddModal}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg text-white hover:bg-indigo-700 transition-colors"
            style={{ background: "#4f46e5", fontWeight: 500 }}
          >
            <Plus size={13} /> Add Machine
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Running", value: running, icon: <Activity size={16} />, color: "text-green-600 bg-green-50" },
          { label: "Idle / Setup", value: machines.filter(m => m.status === "Idle" || m.status === "Setup").length, icon: <Clock size={16} />, color: "text-slate-500 bg-slate-100" },
          { label: "Under Maintenance", value: machines.filter(m => m.status === "Maintenance").length, icon: <Wrench size={16} />, color: "text-amber-600 bg-amber-50" },
          { label: "Maintenance Alerts", value: alerts, icon: <AlertTriangle size={16} />, color: "text-red-600 bg-red-50" },
        ].map((s) => (
          <div key={s.label} className="bg-card border border-border rounded-xl p-4">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-3 ${s.color}`}>{s.icon}</div>
            <p className="text-slate-900 mb-0.5" style={{ fontSize: "1.25rem", fontWeight: 700 }}>{s.value}</p>
            <p className="text-slate-600 text-xs" style={{ fontWeight: 500 }}>{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filters + view toggle */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex border border-slate-200 rounded-lg overflow-hidden">
          {["All", "Active", "Idle", "Maintenance", "Setup", "Inactive"].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 text-xs transition-colors ${filter === f ? "bg-indigo-600 text-white" : "text-slate-600 hover:bg-slate-50"}`}
              style={{ fontWeight: filter === f ? 600 : 400 }}
            >
              {f}
            </button>
          ))}
        </div>
        <div className="flex-1" />
        <div className="flex border border-slate-200 rounded-lg overflow-hidden">
          <button onClick={() => setView("grid")} className={`px-3 py-1.5 text-xs ${view === "grid" ? "bg-slate-100 text-slate-800" : "text-slate-500"}`}>Grid</button>
          <button onClick={() => setView("table")} className={`px-3 py-1.5 text-xs ${view === "table" ? "bg-slate-100 text-slate-800" : "text-slate-500"}`}>Table</button>
        </div>
      </div>

      {view === "grid" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {filtered.map((m) => {
            const sc = statusColors[m.status] || statusColors['Inactive'];
            const isAlert = new Date(m.next_maintenance_date) < new Date() || !m.is_operational;

            return (
              <div key={m.machine_id} className={`bg-card border rounded-xl p-4 ${isAlert ? "border-red-200" : "border-border"}`}>
                {isAlert && (
                  <div className="flex items-center gap-1.5 text-xs text-red-600 bg-red-50 border border-red-100 px-2 py-1 rounded-lg mb-3">
                    <AlertTriangle size={11} /> {!m.is_operational ? 'Machine Inactive' : 'Maintenance overdue!'}
                  </div>
                )}
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div>
                    <p className="text-slate-900 text-sm" style={{ fontWeight: 700 }}>{m.machine_code}</p>
                    <p className="text-slate-500 text-xs">{m.machine_name}</p>
                    <p className="text-slate-400 text-xs">{m.machine_type}</p>
                  </div>
                  <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded border text-xs flex-shrink-0 ${sc.bg} ${sc.text} ${sc.border}`} style={{ fontWeight: 500 }}>
                    <span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />
                    {m.status}
                  </span>
                </div>

                <div className="mb-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-slate-500">Utilization</span>
                    <span className="text-xs text-slate-700" style={{ fontWeight: 600 }}>{m.current_utilization_percent}%</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${m.current_utilization_percent > 70 ? "bg-green-500" : m.current_utilization_percent > 30 ? "bg-amber-500" : "bg-slate-300"}`}
                      style={{ width: `${m.current_utilization_percent}%` }}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs mb-3">
                  <div className="bg-slate-50 rounded-lg p-2">
                    <p className="text-slate-400">Max Output</p>
                    <p className="text-slate-700" style={{ fontWeight: 600 }}>{m.max_production_per_hour || 'N/A'}/hr</p>
                  </div>
                  <div className="bg-slate-50 rounded-lg p-2">
                    <p className="text-slate-400">Status</p>
                    <p className={`${m.is_operational ? 'text-green-600' : 'text-red-600'}`} style={{ fontWeight: 600 }}>
                      {m.is_operational ? 'Operational' : 'Down'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-3">
                  <Calendar size={10} />
                  <span>Next PM: <span className="text-slate-700" style={{ fontWeight: 500 }}>{new Date(m.next_maintenance_date).toLocaleDateString()}</span></span>
                </div>

                <div className="flex gap-1.5">
                  <button
                    onClick={() => openDetailsModal(m)}
                    className="flex-1 text-xs border border-slate-200 rounded-lg py-1.5 text-slate-600 hover:bg-slate-50 transition-colors flex items-center justify-center gap-1"
                  >
                    <Eye size={12} /> Details
                  </button>
                  <button
                    onClick={() => openScheduleModal(m)}
                    className="flex-1 text-xs border border-amber-200 rounded-lg py-1.5 text-amber-700 hover:bg-amber-50 transition-colors flex items-center justify-center gap-1"
                  >
                    <CalendarPlus size={12} /> Schedule PM
                  </button>
                </div>
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
                  {["ID", "Machine", "Type", "Status", "Utilization", "Max Output", "Operational", "Next PM", "Actions"].map((h) => (
                    <th key={h} className="text-left text-xs text-slate-500 px-4 py-2.5 whitespace-nowrap" style={{ fontWeight: 500 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((m) => {
                  const sc = statusColors[m.status] || statusColors['Inactive'];
                  const isAlert = new Date(m.next_maintenance_date) < new Date() || !m.is_operational;

                  return (
                    <tr key={m.machine_id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                      <td className="px-4 py-3 text-indigo-600 text-xs" style={{ fontWeight: 700 }}>{m.machine_code}</td>
                      <td className="px-4 py-3">
                        <p className="text-slate-800 text-xs" style={{ fontWeight: 600 }}>{m.machine_name}</p>
                      </td>
                      <td className="px-4 py-3 text-slate-500 text-xs">{m.machine_type}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded border text-xs ${sc.bg} ${sc.text} ${sc.border}`} style={{ fontWeight: 500 }}>
                          <span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />{m.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-14 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                            <div className={`h-full rounded-full ${m.current_utilization_percent > 70 ? "bg-green-500" : m.current_utilization_percent > 30 ? "bg-amber-500" : "bg-slate-300"}`} style={{ width: `${m.current_utilization_percent}%` }} />
                          </div>
                          <span className="text-xs text-slate-600" style={{ fontWeight: 600 }}>{m.current_utilization_percent}%</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-600 text-xs">{m.max_production_per_hour || 'N/A'}/hr</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs ${m.is_operational ? 'text-green-600' : 'text-red-600'}`} style={{ fontWeight: 600 }}>
                          {m.is_operational ? '✅ Yes' : '❌ No'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-500 text-xs">{new Date(m.next_maintenance_date).toLocaleDateString()}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => openDetailsModal(m)}
                            className="px-2 py-1 text-xs bg-slate-100 text-slate-600 rounded hover:bg-slate-200 transition-colors flex items-center gap-1"
                          >
                            <Eye size={10} /> View
                          </button>
                          <button
                            onClick={() => openScheduleModal(m)}
                            className="px-2 py-1 text-xs bg-amber-100 text-amber-700 rounded hover:bg-amber-200 transition-colors flex items-center gap-1"
                          >
                            <CalendarPlus size={10} /> PM
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

      {/* Maintenance Schedule */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h3 className="text-slate-900 text-sm" style={{ fontWeight: 600 }}>Maintenance Schedule</h3>
          <button className="text-xs text-indigo-600 hover:text-indigo-700 flex items-center gap-1" style={{ fontWeight: 500 }}>
            Full calendar <ChevronRight size={12} />
          </button>
        </div>
        <div className="divide-y divide-slate-50">
          {maintenanceLogs.length > 0 ? (
            maintenanceLogs.map((log, i) => (
              <div key={i} className="flex items-center gap-4 px-5 py-3 hover:bg-slate-50 transition-colors">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${log.type === "Overdue" ? "bg-red-50 text-red-600" : "bg-indigo-50 text-indigo-600"}`}>
                  <Wrench size={14} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-indigo-600 text-xs" style={{ fontWeight: 600 }}>{log.machine}</p>
                    <span className={`text-xs px-1.5 py-0.5 rounded ${log.type === "Overdue" ? "bg-red-50 text-red-700" : "bg-indigo-50 text-indigo-700"}`} style={{ fontWeight: 500 }}>
                      {log.type}
                    </span>
                  </div>
                  <p className="text-slate-500 text-xs mt-0.5">{log.notes}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-slate-700 text-xs" style={{ fontWeight: 500 }}>{log.date}</p>
                  <p className="text-slate-400 text-xs">{log.assignedTo}</p>
                </div>
              </div>
            ))
          ) : (
            <div className="px-5 py-8 text-center text-slate-400 text-sm">
              No maintenance tasks scheduled. All machines are up to date.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}