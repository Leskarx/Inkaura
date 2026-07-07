// JobSlipModal.tsx — Digital Factory Job Slip (Premium Redesign)
// Renders: Paper Issue Slip + Job Details to Machine Man + Post Press Division
import { useState, useEffect, useRef } from "react";
import { X, Printer, Loader2, Factory, User, Calendar, ClipboardList } from "lucide-react";
import { supabase } from "../server/api";

interface SlipData {
  job_id: string;
  job_type: "sample" | "production";
  product_name: string;
  customer_name: string;
  quantity: number;
  due_date: string;
  machine_name?: string;
  operator_name?: string;

  supervisor_to?: string;
  machine_man_to?: string;
  job_size?: string;
  inside_pages?: number;
  copies?: number;
  total_forms?: number;
  polymaster_plates?: number;
  plate_size?: string;
  inside_colors?: number;
  inside_color_names?: string;
  cover_colors?: number;
  cover_color_names?: string;
  inside_paper_name?: string;
  inside_total_sheets?: number;
  inside_additional_sheets?: number;
  cover_paper_name?: string;
  cover_total_sheets?: number;
  cover_additional_sheets?: number;
  boards_sheets?: number;
  cover_paper_sheets?: number;
  post_press_notes?: string;

  paper_gsm?: number;
  paper_type?: string;
  front_colors?: number;
  back_colors?: number;
  special_instructions?: string;
}

interface JobSlipModalProps {
  jobId: string;
  jobType: "sample" | "production";
  quotationId: string;
  customerName: string;
  productName: string;
  quantity: number;
  dueDate: string;
  machineName?: string;
  operatorName?: string;
  onClose: () => void;
}

export function JobSlipModal({
  jobId,
  jobType,
  quotationId,
  customerName,
  productName,
  quantity,
  dueDate,
  machineName,
  operatorName,
  onClose,
}: JobSlipModalProps) {
  const [slip, setSlip] = useState<SlipData | null>(null);
  const [loading, setLoading] = useState(true);
  const [slipNo] = useState(
    Math.floor(2000 + Math.random() * 1000).toString()
  );
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchSlipData();
  }, [quotationId]);

  const fetchSlipData = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("quotation_products")
        .select("*")
        .eq("quotation_id", quotationId)
        .limit(1)
        .single();

      const base: SlipData = {
        job_id: jobId,
        job_type: jobType,
        product_name: productName,
        customer_name: customerName,
        quantity,
        due_date: dueDate,
        machine_name: machineName,
        operator_name: operatorName,
      };

      if (!error && data) {
        // Machine man: prioritize the actual assigned operator from the job
        const resolvedMachineMan = operatorName && operatorName !== "Unassigned"
          ? operatorName
          : data.machine_man_to || "";

        setSlip({
          ...base,
          supervisor_to: data.supervisor_to || "",
          machine_man_to: resolvedMachineMan,
          job_size: data.job_size || "",
          inside_pages: data.inside_pages ?? 0,
          copies: data.copies ?? data.production_quantity ?? quantity,
          total_forms: data.total_forms ?? 0,
          polymaster_plates: data.polymaster_plates ?? 0,
          plate_size: data.plate_size || "",
          inside_colors: data.inside_colors ?? data.front_colors ?? 4,
          inside_color_names: data.inside_color_names || "",
          cover_colors: data.cover_colors ?? data.back_colors ?? 0,
          cover_color_names: data.cover_color_names || "",
          inside_paper_name:
            data.inside_paper_name ||
            (data.paper_type
              ? `${data.paper_type}${data.paper_gsm ? ` ${data.paper_gsm}gsm` : ""}`
              : ""),
          inside_total_sheets: data.inside_total_sheets ?? 0,
          inside_additional_sheets: data.inside_additional_sheets ?? 0,
          cover_paper_name: data.cover_paper_name || "",
          cover_total_sheets: data.cover_total_sheets ?? 0,
          cover_additional_sheets: data.cover_additional_sheets ?? 0,
          boards_sheets: data.boards_sheets ?? 0,
          cover_paper_sheets: data.cover_paper_sheets ?? 0,
          post_press_notes:
            data.post_press_notes || data.special_instructions || "",
          paper_gsm: data.paper_gsm,
          paper_type: data.paper_type,
          front_colors: data.front_colors,
          back_colors: data.back_colors,
          special_instructions: data.special_instructions,
        });
      } else {
        setSlip({
          ...base,
          machine_man_to: operatorName && operatorName !== "Unassigned" ? operatorName : "",
        });
      }
    } catch {
      setSlip({
        job_id: jobId,
        job_type: jobType,
        product_name: productName,
        customer_name: customerName,
        quantity,
        due_date: dueDate,
        machine_name: machineName,
        operator_name: operatorName,
        machine_man_to: operatorName && operatorName !== "Unassigned" ? operatorName : "",
      });
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    if (!printRef.current) return;
    const win = window.open("", "_blank", "width=900,height=1100");
    if (!win) return;
    const content = printRef.current.innerHTML;
    win.document.write(`
      <!DOCTYPE html><html><head>
        <title>Job Slip – ${jobId}</title>
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { font-family: Arial, sans-serif; font-size: 11px; background: white; padding: 12px; }
          .slip-wrapper { max-width: 780px; margin: 0 auto; }
          .section { border: 1.5px solid #000; margin-bottom: 0; page-break-inside: avoid; }
          .section + .section { border-top: none; }
          .section-header { background: #000; color: #fff; text-align: center; font-weight: bold; font-size: 11px; padding: 4px; text-transform: uppercase; letter-spacing: 1px; }
          .section-body { padding: 8px 10px; }
          .row { display: flex; align-items: flex-end; gap: 4px; margin-bottom: 7px; }
          .row .label { white-space: nowrap; font-size: 10px; }
          .row .line { flex: 1; border-bottom: 1px solid #000; min-width: 40px; padding-bottom: 1px; font-size: 10px; }
          .row .line.bold { font-weight: bold; }
          .divider { border-top: 1px dashed #000; margin: 8px 0; }
          .top-row { display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 8px; }
          .slno { font-size: 18px; font-weight: bold; }
          .colour-row { display: flex; align-items: center; gap: 6px; margin-bottom: 7px; font-size: 10px; }
          .colour-options { font-weight: bold; font-size: 11px; }
          .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 7px; }
          @media print { body { padding: 4px; } .section { page-break-inside: avoid; } }
        </style>
      </head><body>
        <div class="slip-wrapper">${content}</div>
        <script>window.onload = () => window.print();<\/script>
      </body></html>
    `);
    win.document.close();
  };

  const today = new Date().toLocaleDateString("en-IN");

  // ── Field row for the print-view layout ──
  const Field = ({
    label,
    value,
    flex,
    bold,
  }: {
    label: string;
    value?: string | number;
    flex?: number;
    bold?: boolean;
  }) => (
    <div className={`flex items-end gap-1 ${flex ? "" : "flex-1"}`} style={flex ? { flex } : {}}>
      <span className="text-[10px] whitespace-nowrap text-gray-700 leading-tight font-medium">
        {label}
      </span>
      <span
        className={`border-b border-gray-800 flex-1 text-[10px] pb-0.5 min-w-[40px] ${bold ? "font-bold" : ""}`}
      >
        {value ?? ""}
      </span>
    </div>
  );

  const isProduction = jobType === "production";

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-3">
      <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[95vh] overflow-hidden shadow-2xl flex flex-col border border-slate-200">

        {/* ── Modal Header ─────────────────────────────────────── */}
        <div className="bg-gradient-to-r from-slate-900 to-slate-800 px-5 py-3 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center">
              <Printer size={17} className="text-white" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">Factory Job Slip</h2>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs text-slate-400">{jobId}</span>
                <span className="w-1 h-1 rounded-full bg-slate-600" />
                <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${isProduction ? "bg-emerald-500/20 text-emerald-300" : "bg-amber-500/20 text-amber-300"}`}>
                  {isProduction ? "Production" : "Sample"}
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              disabled={loading}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold bg-white text-slate-900 rounded-lg hover:bg-slate-100 transition-colors disabled:opacity-50 shadow-sm"
            >
              <Printer size={14} /> Print
            </button>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 transition-colors"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* ── Meta Info Bar ─────────────────────────────────────── */}
        {!loading && slip && (
          <div className="bg-slate-50 border-b border-slate-200 px-5 py-2.5 flex items-center gap-4 flex-shrink-0">
            <div className="flex items-center gap-1.5 text-xs text-slate-600">
              <User size={11} className="text-slate-400" />
              <span className="font-medium">{slip.customer_name}</span>
            </div>
            <div className="w-px h-3 bg-slate-300" />
            <div className="flex items-center gap-1.5 text-xs text-slate-600">
              <ClipboardList size={11} className="text-slate-400" />
              <span>{slip.product_name}</span>
            </div>
            <div className="w-px h-3 bg-slate-300" />
            <div className="flex items-center gap-1.5 text-xs text-slate-600">
              <Calendar size={11} className="text-slate-400" />
              <span>Due: {new Date(slip.due_date).toLocaleDateString()}</span>
            </div>
            {slip.machine_name && slip.machine_name !== "Unassigned" && (
              <>
                <div className="w-px h-3 bg-slate-300" />
                <div className="flex items-center gap-1.5 text-xs text-slate-600">
                  <Factory size={11} className="text-slate-400" />
                  <span>{slip.machine_name}</span>
                </div>
              </>
            )}
            <div className="ml-auto text-xs text-slate-400">
              Slip #{slipNo}
            </div>
          </div>
        )}

        {/* ── Slip Body ─────────────────────────────────────────── */}
        {loading ? (
          <div className="flex-1 flex items-center justify-center py-16 gap-3">
            <Loader2 size={22} className="animate-spin text-slate-400" />
            <span className="text-sm text-slate-500">Loading slip data…</span>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto">
            <div className="p-5 font-mono text-xs" ref={printRef}>

              {/* ══ SECTION 1 — PAPER ISSUE SLIP TO FACTORY SUPERVISOR ══ */}
              <div className="border-2 border-gray-900 rounded-t-sm overflow-hidden mb-0">
                <div className="bg-gray-900 text-white text-center font-bold text-[11px] py-2 tracking-widest uppercase">
                  Paper Issue Slip to Factory Supervisor
                </div>
                <div className="p-4 space-y-2.5 bg-white">
                  {/* To + Sl.no */}
                  <div className="flex items-end gap-4">
                    <Field label="To" value={slip?.supervisor_to} flex={2} bold />
                    <div className="flex items-end gap-1.5 flex-shrink-0">
                      <span className="text-[10px] text-gray-600">Sl.no.</span>
                      <span className="font-black text-xl leading-tight text-gray-900 border-b-2 border-gray-800 px-3">{slipNo}</span>
                    </div>
                  </div>
                  {/* Date */}
                  <div className="flex items-end gap-2">
                    <span className="text-[10px] text-gray-600 whitespace-nowrap font-medium">Date :</span>
                    <span className="border-b border-gray-800 flex-1 text-[10px] pb-0.5 font-medium">{today}</span>
                  </div>

                  <div className="border-t border-dashed border-gray-300 my-2" />

                  <Field label="Name of the Job :" value={slip?.product_name} bold />
                  <Field label="Party Name :" value={slip?.customer_name} />
                  <Field label="Name of Inside used Paper :" value={slip?.inside_paper_name} />

                  <div className="flex items-end gap-3">
                    <Field label="No. Of Total Sheets :" value={slip?.inside_total_sheets || ""} flex={2} />
                    <Field label="Additional" value={slip?.inside_additional_sheets || ""} flex={1} />
                  </div>

                  <Field label="Name of Paper for Cover Pages :" value={slip?.cover_paper_name} />

                  <div className="flex items-end gap-3">
                    <Field label="No. Of Total Sheets :" value={slip?.cover_total_sheets || ""} flex={2} />
                    <Field label="Additional" value={slip?.cover_additional_sheets || ""} flex={1} />
                  </div>

                  <div className="flex items-end gap-3">
                    <Field label="Boards" value={slip?.boards_sheets || ""} flex={1} />
                    <span className="text-[10px] text-gray-600 font-medium">Sheets</span>
                    <Field label="Cover Paper" value={slip?.cover_paper_sheets || ""} flex={1} />
                    <span className="text-[10px] text-gray-600 font-medium">Sheets</span>
                  </div>
                </div>
              </div>

              {/* ══ SECTION 2 — JOB DETAILS TO MACHINE MAN ══ */}
              <div className="border-2 border-t-0 border-gray-900 overflow-hidden">
                <div className="bg-gray-900 text-white text-center font-bold text-[11px] py-2 tracking-widest uppercase">
                  Job Details to Machine Man
                </div>
                <div className="p-4 space-y-2.5 bg-white">
                  {/* To + Sl.no */}
                  <div className="flex items-end gap-4">
                    <Field
                      label="To"
                      value={slip?.machine_man_to || slip?.operator_name || ""}
                      flex={2}
                      bold
                    />
                    <div className="flex items-end gap-1.5 flex-shrink-0">
                      <span className="text-[10px] text-gray-600">Sl.no.</span>
                      <span className="font-black text-xl leading-tight text-gray-900 border-b-2 border-gray-800 px-3">{slipNo}</span>
                    </div>
                  </div>
                  {/* Date */}
                  <div className="flex items-end gap-2">
                    <span className="text-[10px] text-gray-600 whitespace-nowrap font-medium">Date :</span>
                    <span className="border-b border-gray-800 flex-1 text-[10px] pb-0.5 font-medium">{today}</span>
                  </div>

                  <div className="border-t border-dashed border-gray-300 my-2" />

                  <Field label="Name of the Job :" value={slip?.product_name} bold />

                  <div className="flex items-end gap-3">
                    <Field label="Size of the Job :" value={slip?.job_size} flex={2} />
                    <Field label="Inside Pages" value={slip?.inside_pages || ""} flex={1} />
                  </div>

                  <div className="flex items-end gap-3">
                    <Field label="No. of Copies :" value={slip?.copies || slip?.quantity} flex={2} />
                    <Field label="Total Forma" value={slip?.total_forms || ""} flex={1} />
                  </div>

                  <div className="flex items-end gap-3">
                    <Field label="No. of Polymaster / PS Plates" value={slip?.polymaster_plates || ""} flex={2} />
                    <Field label="Size :" value={slip?.plate_size} flex={1} />
                  </div>

                  {/* Colour row */}
                  <div className="flex items-end gap-2">
                    <span className="text-[10px] text-gray-600 whitespace-nowrap font-medium">
                      Colour : <span className="font-bold text-gray-900">1 / 2 / 3 / 4</span>
                    </span>
                    <Field label="Name of the Colours" value={slip?.inside_color_names} />
                    {slip?.inside_colors !== undefined && slip.inside_colors > 0 && (
                      <span className="border-b border-gray-800 px-2 text-[10px] font-bold text-gray-900">
                        {slip.inside_colors}
                      </span>
                    )}
                  </div>

                  {/* Cover colour row */}
                  <div className="flex items-end gap-2">
                    <span className="text-[10px] text-gray-600 whitespace-nowrap font-medium">
                      Cover Colour : <span className="font-bold text-gray-900">1 / 2 / 3 / 4</span>
                    </span>
                    <Field label="Name of the Colours" value={slip?.cover_color_names} />
                    {slip?.cover_colors !== undefined && slip.cover_colors > 0 && (
                      <span className="border-b border-gray-800 px-2 text-[10px] font-bold text-gray-900">
                        {slip.cover_colors}
                      </span>
                    )}
                  </div>

                  {/* Machine info */}
                  {slip?.machine_name && slip.machine_name !== "Unassigned" && (
                    <Field label="Machine :" value={slip.machine_name} />
                  )}
                </div>
              </div>

              {/* ══ SECTION 3 — POST PRESS DIVISION ══ */}
              <div className="border-2 border-t-0 border-gray-900 rounded-b-sm overflow-hidden">
                <div className="bg-gray-900 text-white text-center font-bold text-[11px] py-2 tracking-widest uppercase">
                  Post Press Division
                </div>
                <div className="p-4 bg-white">
                  <div className="flex items-end gap-4 mb-3">
                    <div className="flex items-end gap-1.5 flex-shrink-0">
                      <span className="text-[10px] text-gray-600 font-medium">Sl.no.</span>
                      <span className="border-b border-gray-800 px-4 text-[10px] pb-0.5">{slipNo}</span>
                    </div>
                    <div className="flex items-end gap-1.5 flex-1">
                      <span className="text-[10px] text-gray-600 font-medium">Date :</span>
                      <span className="border-b border-gray-800 flex-1 text-[10px] pb-0.5">{today}</span>
                    </div>
                  </div>
                  {slip?.post_press_notes ? (
                    <div className="border border-gray-200 rounded-lg p-3 min-h-[80px] text-[10px] text-gray-800 whitespace-pre-wrap bg-gray-50 leading-relaxed">
                      {slip.post_press_notes}
                    </div>
                  ) : (
                    <div className="space-y-5">
                      <div className="h-4 border-b border-gray-300 w-full" />
                      <div className="h-4 border-b border-gray-300 w-full" />
                      <div className="h-4 border-b border-gray-300 w-full" />
                    </div>
                  )}
                </div>
              </div>

              {/* Footer (screen only) */}
              <div className="mt-4 pt-3 border-t border-slate-200 text-[10px] text-slate-400 text-center">
                Generated: {new Date().toLocaleString()} · {jobType === "sample" ? "Sample Order" : "Production Order"} · {jobId}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
