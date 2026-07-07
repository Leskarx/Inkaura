import { useState, useEffect } from "react";
import {
    X, Check, AlertCircle, ChevronDown, ChevronUp,
    FileCheck, Printer, Save, Loader2
} from "lucide-react";
import { supabase, api } from "../server/api";

// ─── Types ──────────────────────────────────────────────────────
interface PrePressChecklistData {
    job_number_reference_id: string;
    product_name_variant: string;
    carton_type: string;
    size_dieline: boolean;
    brand_guidelines_received: boolean;
    final_artwork_correct_format: boolean;
    linked_images_embedded: boolean;
    text_converted_outlines: boolean;
    fonts_styles_verified: boolean;
    correct_layers_used: boolean;
    correct_dieline_approved: boolean;
    folds_cuts_glue_clearly_marked: boolean;
    bleed_applied_correctly: boolean;
    trim_lines_safety_margins: boolean;
    color_mode_cmyk_spot: boolean;
    pantone_spot_colors_defined: boolean;
    overprint_settings_checked: boolean;
    varnish_emboss_foil_labeled: boolean;
    legal_regulatory_text_present: boolean;
    multilingual_content_proofed: boolean;
    nutritional_info_verified: boolean;
    net_weight_volume_correct: boolean;
    images_high_resolution: boolean;
    correct_logo_brand_placement: boolean;
    barcode_tested_scanned: boolean;
    no_pixelation_low_res: boolean;
    soft_proof_sent_client: boolean;
    internal_qc_verify: boolean;
    proofread_completed: boolean;
    color_proof_signed_client: boolean;
    regulatory_legal_approval: boolean;
    print_ready_pdf_exported: boolean;
    output_settings_match: boolean;
    files_named_organized: boolean;
    files_uploaded_server: boolean;
    checker_name: string;
    checker_date: string;
    checker_notes: string;
    approver_name: string;
    approver_date: string;
    approver_notes: string;
}

const DEFAULT_CHECKLIST: PrePressChecklistData = {
    job_number_reference_id: "",
    product_name_variant: "",
    carton_type: "",
    size_dieline: false,
    brand_guidelines_received: false,
    final_artwork_correct_format: false,
    linked_images_embedded: false,
    text_converted_outlines: false,
    fonts_styles_verified: false,
    correct_layers_used: false,
    correct_dieline_approved: false,
    folds_cuts_glue_clearly_marked: false,
    bleed_applied_correctly: false,
    trim_lines_safety_margins: false,
    color_mode_cmyk_spot: false,
    pantone_spot_colors_defined: false,
    overprint_settings_checked: false,
    varnish_emboss_foil_labeled: false,
    legal_regulatory_text_present: false,
    multilingual_content_proofed: false,
    nutritional_info_verified: false,
    net_weight_volume_correct: false,
    images_high_resolution: false,
    correct_logo_brand_placement: false,
    barcode_tested_scanned: false,
    no_pixelation_low_res: false,
    soft_proof_sent_client: false,
    internal_qc_verify: false,
    proofread_completed: false,
    color_proof_signed_client: false,
    regulatory_legal_approval: false,
    print_ready_pdf_exported: false,
    output_settings_match: false,
    files_named_organized: false,
    files_uploaded_server: false,
    checker_name: "",
    checker_date: "",
    checker_notes: "",
    approver_name: "",
    approver_date: "",
    approver_notes: "",
};

// ─── Checklist Items ──────────────────────────────────────────
interface ChecklistItem {
    id: keyof PrePressChecklistData;
    label: string;
    category?: string;
}

const CHECKLIST_ITEMS: ChecklistItem[] = [
    // Job Details
    { id: "job_number_reference_id", label: "Job number or reference ID" },
    { id: "product_name_variant", label: "Product name & variant" },
    { id: "carton_type", label: "Carton Type (RTI, STI, CLB, SLB)" },

    // Artwork Preparation
    { id: "size_dieline", label: "Size & dieline" },
    { id: "brand_guidelines_received", label: "Brand guidelines received" },
    { id: "final_artwork_correct_format", label: "Final artwork in correct file format (AI, PDF, etc.)" },
    { id: "linked_images_embedded", label: "Linked images embedded or included" },
    { id: "text_converted_outlines", label: "Text converted to outlines" },
    { id: "fonts_styles_verified", label: "All fonts and styles verified" },
    { id: "correct_layers_used", label: "Correct layers used (dieline, creasing, artwork, varnish, emboss, etc.)" },

    // Dieline & Bleed
    { id: "correct_dieline_approved", label: "Correct dieline used and approved by client" },
    { id: "folds_cuts_glue_clearly_marked", label: "All folds, cuts, glue flaps clearly marked" },
    { id: "bleed_applied_correctly", label: "Bleed applied correctly (typically 2–3mm)" },
    { id: "trim_lines_safety_margins", label: "Trim lines and safety margins applied" },

    // Color & Print
    { id: "color_mode_cmyk_spot", label: "Color mode: CMYK / Spot colors as per print requirement" },
    { id: "pantone_spot_colors_defined", label: "Pantone/spot colors correctly defined" },
    { id: "overprint_settings_checked", label: "Overprint settings checked (e.g., Black on overprint)" },
    { id: "varnish_emboss_foil_labeled", label: "Varnish, emboss, foil layers labeled properly" },

    // Content & Compliance
    { id: "legal_regulatory_text_present", label: "All legal/regulatory text present (FSSAI, FDA, barcode, etc.)" },
    { id: "multilingual_content_proofed", label: "Multilingual content proofed (if applicable)" },
    { id: "nutritional_info_verified", label: "Nutritional info, ingredients, warnings verified" },
    { id: "net_weight_volume_correct", label: "Net weight / volume correct" },

    // Quality Control
    { id: "images_high_resolution", label: "Images are high resolution (300 DPI)" },
    { id: "correct_logo_brand_placement", label: "Correct placement of logos and brand elements" },
    { id: "barcode_tested_scanned", label: "Barcode tested/scanned for readability" },
    { id: "no_pixelation_low_res", label: "No pixelation or low-res graphics" },
    { id: "soft_proof_sent_client", label: "Soft proof sent for client approval" },
    { id: "internal_qc_verify", label: "Internal QC (a) QC supervisor Verify" },
    { id: "proofread_completed", label: "(b) Proofread completed" },
    { id: "color_proof_signed_client", label: "Color proof signed by client" },
    { id: "regulatory_legal_approval", label: "Approval from regulatory or legal team (if required)" },

    // Final Output
    { id: "print_ready_pdf_exported", label: "Print-ready PDF exported with bleed & register marks" },
    { id: "output_settings_match", label: "Output settings match with Printing requirements" },
    { id: "files_named_organized", label: "Files named and organized as per pre-press standard" },
    { id: "files_uploaded_server", label: "Files uploaded to correct FTP / Server folder" },
];

interface PrePressChecklistProps {
    quotationId: string;
    jobType: 'sample' | 'production';
    onComplete: (data: any) => void;
    onCancel: () => void;
    initialData?: Partial<PrePressChecklistData>;
}

export function PrePressChecklist({
    quotationId,
    jobType,
    onComplete,
    onCancel,
    initialData
}: PrePressChecklistProps) {
    const [checklist, setChecklist] = useState<PrePressChecklistData>({
        ...DEFAULT_CHECKLIST,
        ...initialData,
        job_number_reference_id: initialData?.job_number_reference_id || quotationId || "",
    });
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [loadingProduct, setLoadingProduct] = useState(true);

    // Fetch product name from quotation
    useEffect(() => {
        const fetchProductName = async () => {
            try {
                setLoadingProduct(true);
                const quotation = await api.getQuotationById(quotationId);
                if (quotation && quotation.products && quotation.products.length > 0) {
                    const productName = quotation.products[0].desc;
                    // Only set if not already set by initialData
                    if (!initialData?.product_name_variant && !checklist.product_name_variant) {
                        setChecklist(prev => ({
                            ...prev,
                            product_name_variant: productName
                        }));
                    }
                }
            } catch (err) {
                console.error("Failed to fetch product name:", err);
            } finally {
                setLoadingProduct(false);
            }
        };

        fetchProductName();
    }, [quotationId]);

    // Calculate progress - only count boolean fields
    const booleanItems = CHECKLIST_ITEMS.filter(item =>
        typeof DEFAULT_CHECKLIST[item.id] === 'boolean'
    );
    const totalItems = booleanItems.length;
    const completedItems = booleanItems.filter(
        item => checklist[item.id] === true
    ).length;
    const progressPercentage = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;

    // Check if all required fields are filled
    const isComplete = () => {
        // All boolean items must be checked
        const allBooleanChecked = booleanItems.every(item => checklist[item.id] === true);

        // Required text fields
        const jobRefFilled = checklist.job_number_reference_id.trim() !== '';
        const productNameFilled = checklist.product_name_variant.trim() !== '';
        const cartonTypeFilled = checklist.carton_type.trim() !== '';
        const checkerNameFilled = checklist.checker_name.trim() !== '';
        const checkerDateFilled = checklist.checker_date.trim() !== '';
        const approverNameFilled = checklist.approver_name.trim() !== '';
        const approverDateFilled = checklist.approver_date.trim() !== '';

        return allBooleanChecked &&
            jobRefFilled &&
            productNameFilled &&
            cartonTypeFilled &&
            checkerNameFilled &&
            checkerDateFilled &&
            approverNameFilled &&
            approverDateFilled;
    };

    const handleSubmit = async () => {
        if (!isComplete()) {
            setError("Please complete all checklist items and sign-off fields before proceeding.");
            return;
        }

        setSaving(true);
        setError(null);

        try {
            // Save the checklist to the database
            const { data, error: saveError } = await supabase
                .from('pre_press_checklists')
                .insert([{
                    quotation_id: quotationId,
                    job_type: jobType,
                    checklist_data: checklist,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                }])
                .select()
                .single();

            if (saveError) throw saveError;

            // Update quotation status
            await supabase
                .from('quotations')
                .update({
                    pre_press_completed: true,
                    pre_press_checklist_id: data.id,
                    updated_at: new Date().toISOString()
                })
                .eq('quotation_id', quotationId);

            onComplete({ checklistId: data.id, data: checklist });
        } catch (err) {
            console.error("Error saving pre-press checklist:", err);
            setError("Failed to save checklist. Please try again.");
        } finally {
            setSaving(false);
        }
    };

    // Helper to render checkbox item
    const renderCheckboxItem = (item: ChecklistItem, index: number) => {
        if (typeof DEFAULT_CHECKLIST[item.id] !== 'boolean') {
            // Text input for string fields
            const value = checklist[item.id] as string || '';
            const isProductName = item.id === 'product_name_variant';
            const isCartonType = item.id === 'carton_type';

            return (
                <div key={item.id} className="flex items-center gap-3 p-2 rounded-lg bg-slate-50/50">
                    <div className="flex-1 min-w-0">
                        <label className="text-xs font-medium text-slate-700">
                            {item.label}
                            {item.id === 'job_number_reference_id' ||
                                item.id === 'product_name_variant' ||
                                item.id === 'carton_type' ? (
                                <span className="text-red-500 ml-1">*</span>
                            ) : null}
                            {isProductName && loadingProduct && (
                                <span className="text-xs text-slate-400 ml-2">(Loading...)</span>
                            )}
                            {isProductName && !loadingProduct && value && (
                                <span className="text-xs text-green-600 ml-2">✓ Auto-filled</span>
                            )}
                        </label>
                    </div>
                    {isCartonType ? (
                        <select
                            value={value}
                            onChange={(e) => setChecklist({ ...checklist, [item.id]: e.target.value })}
                            className="px-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 w-48 bg-white"
                        >
                            <option value="">Select...</option>
                            <option value="RTI">RTI</option>
                            <option value="STI">STI</option>
                            <option value="CLB">CLB</option>
                            <option value="SLB">SLB</option>
                        </select>
                    ) : (
                        <input
                            type="text"
                            value={value}
                            onChange={(e) => setChecklist({ ...checklist, [item.id]: e.target.value })}
                            className={`px-3 py-1.5 text-xs border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 w-48 ${isProductName && !loadingProduct && value
                                    ? 'border-green-300 bg-green-50/50'
                                    : 'border-slate-200 bg-white'
                                }`}
                            placeholder={`Enter ${item.label.toLowerCase()}...`}
                            readOnly={isProductName}
                        />
                    )}
                </div>
            );
        }

        // Boolean checkbox
        const isChecked = checklist[item.id] === true;
        return (
            <div
                key={item.id}
                className={`flex items-center gap-3 p-2 rounded-lg border transition-all cursor-pointer ${isChecked
                        ? "bg-green-50 border-green-200"
                        : "bg-white border-slate-100 hover:border-slate-200"
                    }`}
                onClick={() => setChecklist({ ...checklist, [item.id]: !isChecked })}
            >
                <div className={`w-5 h-5 rounded flex items-center justify-center flex-shrink-0 border-2 transition-all ${isChecked
                        ? "bg-green-500 border-green-500 text-white"
                        : "bg-white border-slate-300"
                    }`}>
                    {isChecked && <Check size={12} strokeWidth={3} />}
                </div>
                <span className={`text-xs ${isChecked ? "text-green-800" : "text-slate-700"}`}>
                    {item.label}
                </span>
            </div>
        );
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[70] p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[95vh] flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-indigo-50/50 rounded-t-2xl flex-shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center">
                            <Printer size={20} className="text-indigo-600" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-slate-900">PRE-PRESS NEW DEVELOPMENT CHECKLIST</h2>
                            <p className="text-xs text-slate-500">
                                {jobType === 'sample' ? 'Sample Job' : 'Production Job'} · {quotationId}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onCancel}
                        className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Progress Bar */}
                <div className="px-6 py-3 border-b border-slate-100 bg-slate-50/50 flex-shrink-0">
                    <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-medium text-slate-600">Checklist Progress</span>
                        <span className="text-xs font-bold text-indigo-600">{completedItems}/{totalItems} items</span>
                    </div>
                    <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                        <div
                            className={`h-full rounded-full transition-all duration-500 ${progressPercentage === 100 ? 'bg-green-500' : 'bg-indigo-500'
                                }`}
                            style={{ width: `${progressPercentage}%` }}
                        />
                    </div>
                    {progressPercentage === 100 && (
                        <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
                            <FileCheck size={12} /> All items verified!
                        </p>
                    )}
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-6 space-y-4">
                    {error && (
                        <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
                            <AlertCircle size={16} className="text-red-500 flex-shrink-0 mt-0.5" />
                            <p className="text-sm text-red-600">{error}</p>
                        </div>
                    )}

                    {/* Job Details Section */}
                    <div className="bg-slate-50/50 rounded-xl border border-slate-200 overflow-hidden">
                        <div className="px-4 py-2 bg-slate-100/50 border-b border-slate-200">
                            <h4 className="text-xs font-bold text-slate-600 uppercase tracking-wider">Job Details</h4>
                        </div>
                        <div className="p-4 space-y-2">
                            {CHECKLIST_ITEMS.filter(item =>
                                item.id === 'job_number_reference_id' ||
                                item.id === 'product_name_variant' ||
                                item.id === 'carton_type'
                            ).map((item, idx) => renderCheckboxItem(item, idx))}
                        </div>
                    </div>

                    {/* Artwork Preparation Section */}
                    <div className="bg-slate-50/50 rounded-xl border border-slate-200 overflow-hidden">
                        <div className="px-4 py-2 bg-slate-100/50 border-b border-slate-200">
                            <h4 className="text-xs font-bold text-slate-600 uppercase tracking-wider">Artwork Preparation</h4>
                        </div>
                        <div className="p-4 space-y-2">
                            {CHECKLIST_ITEMS.filter(item =>
                                ['size_dieline', 'brand_guidelines_received', 'final_artwork_correct_format',
                                    'linked_images_embedded', 'text_converted_outlines', 'fonts_styles_verified',
                                    'correct_layers_used'].includes(item.id)
                            ).map((item, idx) => renderCheckboxItem(item, idx))}
                        </div>
                    </div>

                    {/* Dieline & Bleed Section */}
                    <div className="bg-slate-50/50 rounded-xl border border-slate-200 overflow-hidden">
                        <div className="px-4 py-2 bg-slate-100/50 border-b border-slate-200">
                            <h4 className="text-xs font-bold text-slate-600 uppercase tracking-wider">Dieline & Bleed</h4>
                        </div>
                        <div className="p-4 space-y-2">
                            {CHECKLIST_ITEMS.filter(item =>
                                ['correct_dieline_approved', 'folds_cuts_glue_clearly_marked',
                                    'bleed_applied_correctly', 'trim_lines_safety_margins'].includes(item.id)
                            ).map((item, idx) => renderCheckboxItem(item, idx))}
                        </div>
                    </div>

                    {/* Color & Print Section */}
                    <div className="bg-slate-50/50 rounded-xl border border-slate-200 overflow-hidden">
                        <div className="px-4 py-2 bg-slate-100/50 border-b border-slate-200">
                            <h4 className="text-xs font-bold text-slate-600 uppercase tracking-wider">Color & Print Specifications</h4>
                        </div>
                        <div className="p-4 space-y-2">
                            {CHECKLIST_ITEMS.filter(item =>
                                ['color_mode_cmyk_spot', 'pantone_spot_colors_defined',
                                    'overprint_settings_checked', 'varnish_emboss_foil_labeled'].includes(item.id)
                            ).map((item, idx) => renderCheckboxItem(item, idx))}
                        </div>
                    </div>

                    {/* Content & Compliance Section */}
                    <div className="bg-slate-50/50 rounded-xl border border-slate-200 overflow-hidden">
                        <div className="px-4 py-2 bg-slate-100/50 border-b border-slate-200">
                            <h4 className="text-xs font-bold text-slate-600 uppercase tracking-wider">Content & Compliance</h4>
                        </div>
                        <div className="p-4 space-y-2">
                            {CHECKLIST_ITEMS.filter(item =>
                                ['legal_regulatory_text_present', 'multilingual_content_proofed',
                                    'nutritional_info_verified', 'net_weight_volume_correct'].includes(item.id)
                            ).map((item, idx) => renderCheckboxItem(item, idx))}
                        </div>
                    </div>

                    {/* Quality Control Section */}
                    <div className="bg-slate-50/50 rounded-xl border border-slate-200 overflow-hidden">
                        <div className="px-4 py-2 bg-slate-100/50 border-b border-slate-200">
                            <h4 className="text-xs font-bold text-slate-600 uppercase tracking-wider">Quality Control</h4>
                        </div>
                        <div className="p-4 space-y-2">
                            {CHECKLIST_ITEMS.filter(item =>
                                ['images_high_resolution', 'correct_logo_brand_placement',
                                    'barcode_tested_scanned', 'no_pixelation_low_res',
                                    'soft_proof_sent_client', 'internal_qc_verify',
                                    'proofread_completed', 'color_proof_signed_client',
                                    'regulatory_legal_approval'].includes(item.id)
                            ).map((item, idx) => renderCheckboxItem(item, idx))}
                        </div>
                    </div>

                    {/* Final Output Section */}
                    <div className="bg-slate-50/50 rounded-xl border border-slate-200 overflow-hidden">
                        <div className="px-4 py-2 bg-slate-100/50 border-b border-slate-200">
                            <h4 className="text-xs font-bold text-slate-600 uppercase tracking-wider">Final Output</h4>
                        </div>
                        <div className="p-4 space-y-2">
                            {CHECKLIST_ITEMS.filter(item =>
                                ['print_ready_pdf_exported', 'output_settings_match',
                                    'files_named_organized', 'files_uploaded_server'].includes(item.id)
                            ).map((item, idx) => renderCheckboxItem(item, idx))}
                        </div>
                    </div>

                    {/* Sign-off Section */}
                    <div className="bg-slate-50/50 rounded-xl border border-slate-200 overflow-hidden">
                        <div className="px-4 py-2 bg-slate-100/50 border-b border-slate-200">
                            <h4 className="text-xs font-bold text-slate-600 uppercase tracking-wider">Sign-off</h4>
                        </div>
                        <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <h5 className="text-xs font-semibold text-slate-700 mb-2">Checker Sign with Date</h5>
                                <div className="space-y-2">
                                    <input
                                        type="text"
                                        value={checklist.checker_name}
                                        onChange={(e) => setChecklist({ ...checklist, checker_name: e.target.value })}
                                        placeholder="Checker Name *"
                                        className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
                                    />
                                    <input
                                        type="date"
                                        value={checklist.checker_date}
                                        onChange={(e) => setChecklist({ ...checklist, checker_date: e.target.value })}
                                        className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
                                    />
                                    <textarea
                                        value={checklist.checker_notes}
                                        onChange={(e) => setChecklist({ ...checklist, checker_notes: e.target.value })}
                                        placeholder="Checker Notes..."
                                        rows={2}
                                        className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 resize-none"
                                    />
                                </div>
                            </div>
                            <div>
                                <h5 className="text-xs font-semibold text-slate-700 mb-2">Approver Sign with Date</h5>
                                <div className="space-y-2">
                                    <input
                                        type="text"
                                        value={checklist.approver_name}
                                        onChange={(e) => setChecklist({ ...checklist, approver_name: e.target.value })}
                                        placeholder="Approver Name *"
                                        className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
                                    />
                                    <input
                                        type="date"
                                        value={checklist.approver_date}
                                        onChange={(e) => setChecklist({ ...checklist, approver_date: e.target.value })}
                                        className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
                                    />
                                    <textarea
                                        value={checklist.approver_notes}
                                        onChange={(e) => setChecklist({ ...checklist, approver_notes: e.target.value })}
                                        placeholder="Approver Notes..."
                                        rows={2}
                                        className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 resize-none"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 bg-slate-50 rounded-b-2xl flex-shrink-0">
                    <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${isComplete() ? 'bg-green-500' : 'bg-amber-500'}`} />
                        <span className="text-xs text-slate-500">
                            {isComplete()
                                ? "All items verified. Ready to create job!"
                                : `${completedItems}/${totalItems} items completed. Complete all to proceed.`}
                        </span>
                    </div>
                    <div className="flex gap-3">
                        <button
                            onClick={onCancel}
                            className="px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleSubmit}
                            disabled={saving || !isComplete()}
                            className="px-6 py-2 text-sm font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                        >
                            {saving ? (
                                <><Loader2 size={16} className="animate-spin" /> Saving...</>
                            ) : (
                                <><Save size={16} /> Create {jobType === 'sample' ? 'Sample' : 'Production'} Job</>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}