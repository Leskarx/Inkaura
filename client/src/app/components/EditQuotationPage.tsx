import React, { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../server/api";
import { 
  Plus, Trash2, Save, Send, AlertCircle, FileText, 
  ChevronRight, Box, Package, FileUp, Info, Search, ChevronDown
} from "lucide-react";

export function EditQuotationPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [loading, setLoading] = useState(false);
  const [customers, setCustomers] = useState<{id: string, name: string, contact_person: string}[]>([]);
  const [employees, setEmployees] = useState<{id: number, name: string}[]>([]);
  const [customerSearch, setCustomerSearch] = useState("");
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);

  // 1. Basic Info
  const [basicInfo, setBasicInfo] = useState({
    customer_id: "",
    created_by: 0,
    quotation_date: new Date().toISOString().split("T")[0],
    valid_until: new Date(new Date().setDate(new Date().getDate() + 15)).toISOString().split("T")[0],
    currency: "INR",
    reference_number: "",
  });

  // 3. Products
  const [products, setProducts] = useState([{
    id: 1,
    product_name: "",
    product_type: "Custom",
    production_quantity: 1000,
    sample_quantity: 0,
    material_type: "",
    paper_type: "",
    gsm: 0,
    thickness: "",
    width_mm: 0,
    height_mm: 0,
    depth_mm: 0,
    printing_technology: "Offset",
    front_colors: 4,
    back_colors: 0,
    spot_colors: 0,
    lamination: "",
    uv_coating: false,
    embossing: false,
    foiling: false,
    die_cutting: false,
    folding: false,
    binding: "",
    packaging_type: "",
    cartons: 0,
    special_instructions: "",
    // Temporary frontend price field to calculate commercials
    _frontend_price: 0 
  }]);

  // 2. Commercial Details (Auto-calculated mostly)
  const [commercials, setCommercials] = useState({
    gst_percentage: 18,
    discount: 0,
    packing_charges: 0,
    freight_charges: 0,
    other_charges: 0,
    advance_percentage: 50,
    payment_terms: "50% Advance, 50% Against Delivery"
  });

  // Calculate Subtotal & Total
  const subtotal = products.reduce((acc, p) => acc + (p._frontend_price || 0), 0);
  const gstAmount = subtotal * (commercials.gst_percentage / 100);
  const finalTotal = subtotal + gstAmount + commercials.packing_charges + commercials.freight_charges + commercials.other_charges - commercials.discount;
  const advanceAmount = finalTotal * (commercials.advance_percentage / 100);

  // 4. Cost Summary (Admin Only) - simple inputs for now
  const [costSummary, setCostSummary] = useState({
    material_cost: 0,
    ink_cost: 0,
    plate_cost: 0,
    machine_cost: 0,
    labour_cost: 0,
    packaging_cost: 0,
    delivery_cost: 0,
  });
  const totalEstimatedCost = Object.values(costSummary).reduce((a, b) => a + b, 0);
  const expectedProfit = finalTotal - totalEstimatedCost;
  const expectedProfitMargin = finalTotal > 0 ? ((expectedProfit / finalTotal) * 100).toFixed(1) : "0.0";

  // 5. Sample Requirements
  const [sampleReq, setSampleReq] = useState({
    required: false,
    quantity: 0,
    cost: 0,
    due_date: "",
  });

  // 6. Delivery Details
  const [delivery, setDelivery] = useState({
    expected_start: "",
    expected_delivery: "",
    address: "",
    method: "Road Transport",
    notes: ""
  });

  // 7. Notes
  const [notes, setNotes] = useState({
    customer_notes: "",
    internal_notes: "",
    artwork_instructions: ""
  });

  // Fetch dropdown data and initial quotation data
  useEffect(() => {
    const init = async () => {
      try {
        const [c, e] = await Promise.all([
          api.getCustomers(),
          api.getEmployees()
        ]);
        setCustomers(c.map(x => ({id: x.id, name: x.name, contact_person: (x as any).contact_person || ""})));
        setEmployees(e.map(x => ({id: Number(x.id), name: x.name})));

        if (id) {
          const q = await api.getQuotationForEdit(id);
          if (q) {
            setBasicInfo({
              customer_id: q.customer_id || "",
              created_by: q.created_by || 0,
              quotation_date: q.quotation_date ? new Date(q.quotation_date).toISOString().split("T")[0] : new Date().toISOString().split("T")[0],
              valid_until: q.delivery_date ? new Date(q.delivery_date).toISOString().split("T")[0] : "",
              currency: "INR",
              reference_number: "",
            });
            
            if (q.quotation_products && q.quotation_products.length > 0) {
              setProducts(q.quotation_products.map((p: any, idx: number) => ({
                id: p.quotation_product_id || idx,
                product_name: p.product_name || "",
                product_type: p.product_type || "Custom",
                production_quantity: p.production_quantity || 1000,
                sample_quantity: 0,
                material_type: p.material_type || "",
                paper_type: "",
                gsm: p.paper_gsm || 0,
                thickness: "",
                width_mm: (p.width_cm || 0) * 10,
                height_mm: (p.height_cm || 0) * 10,
                depth_mm: 0,
                printing_technology: p.printing_technology || "Offset",
                front_colors: p.color_type === 'CMYK' ? 4 : 1,
                back_colors: 0,
                spot_colors: 0,
                lamination: p.lamination || "",
                uv_coating: false,
                embossing: false,
                foiling: false,
                die_cutting: false,
                folding: false,
                binding: "",
                packaging_type: p.packaging_type || "",
                cartons: 0,
                special_instructions: "",
                _frontend_price: Number(q.total_payment) / q.quotation_products.length
              })));
            }

            setCommercials({
              payment_terms: `${q.advance_percentage || 50}% Advance, ${100 - (q.advance_percentage || 50)}% Against Delivery`,
              advance_percentage: q.advance_percentage || 50,
              gst_percentage: 18,
              discount: 0,
              freight_charges: 0,
              packing_charges: 0,
              other_charges: 0
            });
            
            let parsedCustomerNotes = q.notes || "";
            let parsedInternalNotes = "";
            
            if (parsedCustomerNotes.includes("---JSON_META_DATA---")) {
              const parts = parsedCustomerNotes.split("---JSON_META_DATA---");
              parsedCustomerNotes = parts[0].trim();
              try {
                const meta = JSON.parse(parts[1].trim());
                if (meta.sampleReq) setSampleReq(meta.sampleReq);
                if (meta.delivery) setDelivery(meta.delivery);
                if (meta.costSummary) setCostSummary(meta.costSummary);
              } catch (e) {}
            }
            
            if (parsedCustomerNotes.includes("Internal: ")) {
               const parts = parsedCustomerNotes.split("Internal: ");
               parsedCustomerNotes = parts[0].trim();
               parsedInternalNotes = parts[1].trim();
            }

            setNotes({
              customer_notes: parsedCustomerNotes,
              internal_notes: parsedInternalNotes,
              artwork_instructions: ""
            });
          }
        }
      } catch (err) {
        console.error("Failed to load edit data", err);
      }
    };
    init();
  }, [id]);

  const handleAddProduct = () => {
    setProducts([...products, {
      id: Date.now(),
      product_name: "", product_type: "Custom", production_quantity: 1000, sample_quantity: 0,
      material_type: "", paper_type: "", gsm: 0, thickness: "",
      width_mm: 0, height_mm: 0, depth_mm: 0,
      printing_technology: "Offset", front_colors: 4, back_colors: 0, spot_colors: 0,
      lamination: "", uv_coating: false, embossing: false, foiling: false, die_cutting: false, folding: false, binding: "",
      packaging_type: "", cartons: 0, special_instructions: "",
      _frontend_price: 0
    }]);
  };

  const handleRemoveProduct = (id: number) => {
    if (products.length > 1) {
      setProducts(products.filter(p => p.id !== id));
    }
  };

  const handleSave = async (status: 'Draft' | 'Pending' | 'Sent') => {
    if (!basicInfo.customer_id || !basicInfo.created_by) {
      alert("Please select a Customer and an Owner.");
      return;
    }
    setLoading(true);
    try {
      const payload = {
        customer_id: basicInfo.customer_id,
        created_by: basicInfo.created_by,
        quotation_date: basicInfo.quotation_date,
        total_payment: finalTotal,
        advance_required: advanceAmount > 0,
        advance_percentage: commercials.advance_percentage,
        advance_amount: advanceAmount,
        status: status,
        valid_until: basicInfo.valid_until,
        notes: notes.customer_notes + 
          (notes.internal_notes ? `\n\nInternal: ${notes.internal_notes}` : "") +
          `\n\n---JSON_META_DATA---\n${JSON.stringify({ sampleReq, delivery, costSummary })}`,
        products: products.map(p => ({
          product_name: p.product_name,
          product_type: p.product_type,
          production_quantity: p.production_quantity,
          sample_quantity: p.sample_quantity,
          material_type: p.material_type,
          paper_type: p.paper_type,
          gsm: p.gsm,
          width_mm: p.width_mm,
          height_mm: p.height_mm,
          depth_mm: p.depth_mm,
          printing_technology: p.printing_technology,
          front_colors: p.front_colors,
          back_colors: p.back_colors,
          lamination: p.lamination,
          packaging_type: p.packaging_type
        }))
      };

      if (!id) return;
      await api.updateQuotation(id, payload as any);
      navigate("/quotations");
    } catch (err) {
      console.error(err);
      alert("Failed to create quotation.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-8 pb-32">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Edit Quotation {id}</h1>
          <p className="text-slate-500 text-sm mt-1">Update pricing, products, and specifications.</p>
        </div>
        <button onClick={() => navigate("/quotations")} className="text-sm font-medium text-slate-500 hover:text-slate-800">
          Cancel & Go Back
        </button>
      </div>

      {/* 1. Basic Information */}
      <section className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
          <FileText size={18} className="text-indigo-500" /> Basic Information
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          <div className="relative">
            <label className="block text-xs font-semibold text-slate-700 mb-1">Customer</label>
            <div 
              className="w-full p-2.5 border border-slate-200 rounded-lg text-sm bg-white flex justify-between items-center cursor-pointer"
              onClick={() => setShowCustomerDropdown(!showCustomerDropdown)}
            >
              <span className={basicInfo.customer_id ? "text-slate-900" : "text-slate-400"}>
                {basicInfo.customer_id 
                  ? customers.find(c => c.id === basicInfo.customer_id)?.contact_person 
                    ? `${customers.find(c => c.id === basicInfo.customer_id)?.contact_person} (${customers.find(c => c.id === basicInfo.customer_id)?.name})`
                    : customers.find(c => c.id === basicInfo.customer_id)?.name
                  : "Search & Select Customer"}
              </span>
              <ChevronDown size={16} className="text-slate-400" />
            </div>
            {showCustomerDropdown && (
              <div className="absolute z-50 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden">
                <div className="p-2 border-b border-slate-100 flex items-center gap-2">
                  <Search size={14} className="text-slate-400" />
                  <input 
                    type="text" 
                    placeholder="Search by name or company..." 
                    className="w-full text-sm focus:outline-none"
                    value={customerSearch}
                    onChange={e => setCustomerSearch(e.target.value)}
                    autoFocus
                  />
                </div>
                <div className="max-h-60 overflow-y-auto">
                  {customers.filter(c => 
                    c.name.toLowerCase().includes(customerSearch.toLowerCase()) || 
                    c.contact_person.toLowerCase().includes(customerSearch.toLowerCase())
                  ).map(c => (
                    <div 
                      key={c.id} 
                      className="px-4 py-2 hover:bg-slate-50 cursor-pointer border-b border-slate-50 last:border-0"
                      onClick={() => {
                        setBasicInfo({...basicInfo, customer_id: c.id});
                        setShowCustomerDropdown(false);
                        setCustomerSearch("");
                      }}
                    >
                      <div className="text-sm font-semibold text-slate-800">{c.contact_person || c.name}</div>
                      {c.contact_person && <div className="text-xs text-slate-500">{c.name}</div>}
                    </div>
                  ))}
                  {customers.filter(c => c.name.toLowerCase().includes(customerSearch.toLowerCase()) || c.contact_person.toLowerCase().includes(customerSearch.toLowerCase())).length === 0 && (
                    <div className="px-4 py-3 text-sm text-slate-500 text-center">No customers found</div>
                  )}
                </div>
              </div>
            )}
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Owner (Employee)</label>
            <select className="w-full p-2.5 border border-slate-200 rounded-lg text-sm" value={basicInfo.created_by} onChange={e => setBasicInfo({...basicInfo, created_by: Number(e.target.value)})}>
              <option value="0">Select Owner</option>
              {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Currency</label>
            <select className="w-full p-2.5 border border-slate-200 rounded-lg text-sm" value={basicInfo.currency} onChange={e => setBasicInfo({...basicInfo, currency: e.target.value})}>
              <option value="INR">INR (₹)</option>
              <option value="USD">USD ($)</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Quotation Date</label>
            <input type="date" className="w-full p-2.5 border border-slate-200 rounded-lg text-sm" value={basicInfo.quotation_date} onChange={e => setBasicInfo({...basicInfo, quotation_date: e.target.value})} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Validity Until</label>
            <input type="date" className="w-full p-2.5 border border-slate-200 rounded-lg text-sm" value={basicInfo.valid_until} onChange={e => setBasicInfo({...basicInfo, valid_until: e.target.value})} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Customer Ref / PO</label>
            <input type="text" placeholder="Optional" className="w-full p-2.5 border border-slate-200 rounded-lg text-sm" value={basicInfo.reference_number} onChange={e => setBasicInfo({...basicInfo, reference_number: e.target.value})} />
          </div>
        </div>
      </section>

      {/* 3. Products Section */}
      <section className="space-y-4">
        <div className="flex justify-between items-center bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div>
            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <Box size={18} className="text-indigo-500" /> Products
            </h2>
          </div>
          <button onClick={handleAddProduct} className="flex items-center gap-1.5 text-sm font-medium text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-lg hover:bg-indigo-100 transition-colors">
            <Plus size={16} /> Add Product
          </button>
        </div>

        {products.map((p, index) => (
          <div key={p.id} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="bg-slate-50 px-6 py-3 border-b border-slate-200 flex justify-between items-center">
              <span className="font-semibold text-sm text-slate-800">Product {index + 1}</span>
              {products.length > 1 && (
                <button onClick={() => handleRemoveProduct(p.id)} className="text-red-500 hover:text-red-700 flex items-center gap-1 text-xs font-medium">
                  <Trash2 size={14} /> Remove
                </button>
              )}
            </div>
            
            <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Product Basic */}
              <div className="space-y-4 col-span-1 md:col-span-3">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="col-span-2">
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Product Name</label>
                    <input type="text" className="w-full p-2 border border-slate-200 rounded-lg text-sm" value={p.product_name} onChange={e => setProducts(products.map(x => x.id === p.id ? {...x, product_name: e.target.value} : x))} />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Production Qty</label>
                    <input type="number" className="w-full p-2 border border-slate-200 rounded-lg text-sm" value={p.production_quantity} onChange={e => setProducts(products.map(x => x.id === p.id ? {...x, production_quantity: Number(e.target.value)} : x))} />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Price / Value (Frontend only)</label>
                    <input type="number" className="w-full p-2 border border-slate-200 rounded-lg text-sm" value={p._frontend_price} onChange={e => setProducts(products.map(x => x.id === p.id ? {...x, _frontend_price: Number(e.target.value)} : x))} />
                  </div>
                </div>
              </div>

              {/* Material */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider border-b pb-1">Material</h4>
                <input type="text" placeholder="Material Type" className="w-full p-2 border border-slate-200 rounded-lg text-sm" value={p.material_type} onChange={e => setProducts(products.map(x => x.id === p.id ? {...x, material_type: e.target.value} : x))} />
                <input type="text" placeholder="Paper Type (e.g. Art Card)" className="w-full p-2 border border-slate-200 rounded-lg text-sm" value={p.paper_type} onChange={e => setProducts(products.map(x => x.id === p.id ? {...x, paper_type: e.target.value} : x))} />
                <div className="flex gap-2">
                  <input type="number" placeholder="GSM" className="w-full p-2 border border-slate-200 rounded-lg text-sm" value={p.gsm || ""} onChange={e => setProducts(products.map(x => x.id === p.id ? {...x, gsm: Number(e.target.value)} : x))} />
                  <input type="text" placeholder="Thickness" className="w-full p-2 border border-slate-200 rounded-lg text-sm" value={p.thickness} onChange={e => setProducts(products.map(x => x.id === p.id ? {...x, thickness: e.target.value} : x))} />
                </div>
              </div>

              {/* Dimensions & Print */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider border-b pb-1">Dimensions (mm) & Print</h4>
                <div className="flex gap-2">
                  <input type="number" placeholder="W" className="w-full p-2 border border-slate-200 rounded-lg text-sm" value={p.width_mm || ""} onChange={e => setProducts(products.map(x => x.id === p.id ? {...x, width_mm: Number(e.target.value)} : x))} />
                  <input type="number" placeholder="H" className="w-full p-2 border border-slate-200 rounded-lg text-sm" value={p.height_mm || ""} onChange={e => setProducts(products.map(x => x.id === p.id ? {...x, height_mm: Number(e.target.value)} : x))} />
                  <input type="number" placeholder="D" className="w-full p-2 border border-slate-200 rounded-lg text-sm" value={p.depth_mm || ""} onChange={e => setProducts(products.map(x => x.id === p.id ? {...x, depth_mm: Number(e.target.value)} : x))} />
                </div>
                <select className="w-full p-2 border border-slate-200 rounded-lg text-sm" value={p.printing_technology} onChange={e => setProducts(products.map(x => x.id === p.id ? {...x, printing_technology: e.target.value} : x))}>
                  <option value="Offset">Offset Printing</option>
                  <option value="Digital">Digital Printing</option>
                  <option value="Screen">Screen Printing</option>
                  <option value="Flexo">Flexography</option>
                </select>
                <div className="flex gap-2">
                  <input type="number" placeholder="Front Col" className="w-full p-2 border border-slate-200 rounded-lg text-sm" value={p.front_colors || ""} onChange={e => setProducts(products.map(x => x.id === p.id ? {...x, front_colors: Number(e.target.value)} : x))} title="Front Colors" />
                  <input type="number" placeholder="Back Col" className="w-full p-2 border border-slate-200 rounded-lg text-sm" value={p.back_colors || ""} onChange={e => setProducts(products.map(x => x.id === p.id ? {...x, back_colors: Number(e.target.value)} : x))} title="Back Colors" />
                  <input type="number" placeholder="Spot Col" className="w-full p-2 border border-slate-200 rounded-lg text-sm" value={p.spot_colors || ""} onChange={e => setProducts(products.map(x => x.id === p.id ? {...x, spot_colors: Number(e.target.value)} : x))} title="Spot Colors" />
                </div>
              </div>

              {/* Finishing */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider border-b pb-1">Finishing</h4>
                <select className="w-full p-2 border border-slate-200 rounded-lg text-sm" value={p.lamination} onChange={e => setProducts(products.map(x => x.id === p.id ? {...x, lamination: e.target.value} : x))}>
                  <option value="">No Lamination</option>
                  <option value="Gloss">Gloss</option>
                  <option value="Matte">Matte</option>
                  <option value="Soft Touch">Soft Touch</option>
                </select>
                <div className="grid grid-cols-2 gap-2 text-sm text-slate-700">
                  <label className="flex items-center gap-2"><input type="checkbox" checked={p.uv_coating} onChange={e => setProducts(products.map(x => x.id === p.id ? {...x, uv_coating: e.target.checked} : x))} /> UV Coating</label>
                  <label className="flex items-center gap-2"><input type="checkbox" checked={p.embossing} onChange={e => setProducts(products.map(x => x.id === p.id ? {...x, embossing: e.target.checked} : x))} /> Embossing</label>
                  <label className="flex items-center gap-2"><input type="checkbox" checked={p.foiling} onChange={e => setProducts(products.map(x => x.id === p.id ? {...x, foiling: e.target.checked} : x))} /> Foiling</label>
                  <label className="flex items-center gap-2"><input type="checkbox" checked={p.die_cutting} onChange={e => setProducts(products.map(x => x.id === p.id ? {...x, die_cutting: e.target.checked} : x))} /> Die Cutting</label>
                </div>
              </div>
            </div>
          </div>
        ))}
      </section>

      {/* 2. Commercial Details */}
      <section className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="bg-slate-800 px-6 py-3 border-b border-slate-700 flex justify-between items-center">
          <h2 className="text-base font-bold text-white flex items-center gap-2">Commercial Details</h2>
        </div>
        <div className="p-6 grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Payment Terms</label>
              <input type="text" className="w-full p-2.5 border border-slate-200 rounded-lg text-sm" value={commercials.payment_terms} onChange={e => setCommercials({...commercials, payment_terms: e.target.value})} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Advance Percentage (%)</label>
              <input type="number" className="w-full p-2.5 border border-slate-200 rounded-lg text-sm" value={commercials.advance_percentage} onChange={e => setCommercials({...commercials, advance_percentage: Number(e.target.value)})} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">GST (%)</label>
              <input type="number" className="w-full p-2.5 border border-slate-200 rounded-lg text-sm" value={commercials.gst_percentage} onChange={e => setCommercials({...commercials, gst_percentage: Number(e.target.value)})} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Discount Amount (₹)</label>
              <input type="number" className="w-full p-2.5 border border-slate-200 rounded-lg text-sm" value={commercials.discount} onChange={e => setCommercials({...commercials, discount: Number(e.target.value)})} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Freight Charges (₹)</label>
              <input type="number" className="w-full p-2.5 border border-slate-200 rounded-lg text-sm" value={commercials.freight_charges} onChange={e => setCommercials({...commercials, freight_charges: Number(e.target.value)})} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Other / Packing Charges (₹)</label>
              <input type="number" className="w-full p-2.5 border border-slate-200 rounded-lg text-sm" value={commercials.packing_charges + commercials.other_charges} onChange={e => setCommercials({...commercials, other_charges: Number(e.target.value)})} />
            </div>
          </div>
          
          <div className="bg-slate-50 p-5 rounded-xl border border-slate-100 space-y-3">
            <div className="flex justify-between text-sm text-slate-600">
              <span>Subtotal</span><span>₹{subtotal.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-sm text-slate-600">
              <span>GST ({commercials.gst_percentage}%)</span><span>+₹{gstAmount.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-sm text-slate-600">
              <span>Additional Charges</span><span>+₹{(commercials.packing_charges + commercials.freight_charges + commercials.other_charges).toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-sm text-emerald-600">
              <span>Discount</span><span>-₹{commercials.discount.toLocaleString()}</span>
            </div>
            <div className="pt-3 border-t border-slate-200 flex justify-between font-bold text-lg text-slate-900">
              <span>Total Payment</span><span>₹{finalTotal.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-sm font-semibold text-indigo-600 bg-indigo-50 p-2 rounded">
              <span>Advance Required</span><span>₹{advanceAmount.toLocaleString()}</span>
            </div>
          </div>
        </div>
      </section>

      {/* 4. Cost Summary (Admin Only) */}
      <section className="bg-amber-50 rounded-xl shadow-sm border border-amber-200 p-6">
        <h2 className="text-lg font-bold text-amber-900 mb-1 flex items-center gap-2">
          Cost Estimation Summary (Admin)
        </h2>
        <p className="text-xs text-amber-700 mb-4">Values here map to `cost_estimations`. Hidden from sales execs in production.</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs font-semibold text-amber-900 mb-1">Material Cost</label>
            <input type="number" className="w-full p-2 border border-amber-200 rounded-lg text-sm bg-white" value={costSummary.material_cost} onChange={e => setCostSummary({...costSummary, material_cost: Number(e.target.value)})} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-amber-900 mb-1">Ink / Plate Cost</label>
            <input type="number" className="w-full p-2 border border-amber-200 rounded-lg text-sm bg-white" value={costSummary.ink_cost + costSummary.plate_cost} onChange={e => setCostSummary({...costSummary, ink_cost: Number(e.target.value)})} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-amber-900 mb-1">Machine & Labour Cost</label>
            <input type="number" className="w-full p-2 border border-amber-200 rounded-lg text-sm bg-white" value={costSummary.machine_cost + costSummary.labour_cost} onChange={e => setCostSummary({...costSummary, machine_cost: Number(e.target.value)})} />
          </div>
          <div className="bg-amber-100 p-3 rounded-lg border border-amber-300">
             <p className="text-xs font-bold text-amber-900 mb-1">Expected Margin</p>
             <p className="text-lg font-black text-amber-700">{expectedProfitMargin}% (₹{expectedProfit.toLocaleString()})</p>
          </div>
        </div>
      </section>

      {/* 5, 6. Sample & Delivery */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <section className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h2 className="text-lg font-bold text-slate-800 mb-4">Sample Requirements</h2>
          <div className="space-y-4">
            <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 cursor-pointer">
              <input type="checkbox" className="w-4 h-4 text-indigo-600 rounded" checked={sampleReq.required} onChange={e => setSampleReq({...sampleReq, required: e.target.checked})} />
              Sample Required before Production?
            </label>
            {sampleReq.required && (
              <div className="grid grid-cols-2 gap-4 pt-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Sample Qty</label>
                  <input type="number" className="w-full p-2 border border-slate-200 rounded-lg text-sm" value={sampleReq.quantity} onChange={e => setSampleReq({...sampleReq, quantity: Number(e.target.value)})} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Sample Cost (₹)</label>
                  <input type="number" className="w-full p-2 border border-slate-200 rounded-lg text-sm" value={sampleReq.cost} onChange={e => setSampleReq({...sampleReq, cost: Number(e.target.value)})} />
                </div>
              </div>
            )}
          </div>
        </section>

        <section className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h2 className="text-lg font-bold text-slate-800 mb-4">Delivery Details</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">Delivery Address</label>
              <input type="text" className="w-full p-2 border border-slate-200 rounded-lg text-sm" value={delivery.address} onChange={e => setDelivery({...delivery, address: e.target.value})} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Exp. Prod Start</label>
              <input type="date" className="w-full p-2 border border-slate-200 rounded-lg text-sm" value={delivery.expected_start} onChange={e => setDelivery({...delivery, expected_start: e.target.value})} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Exp. Delivery</label>
              <input type="date" className="w-full p-2 border border-slate-200 rounded-lg text-sm" value={delivery.expected_delivery} onChange={e => setDelivery({...delivery, expected_delivery: e.target.value})} />
            </div>
          </div>
        </section>
      </div>

      {/* 7, 8. Notes & Attachments */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <section className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h2 className="text-lg font-bold text-slate-800 mb-4">Notes & Instructions</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Customer Notes (Visible on Quote)</label>
              <textarea rows={2} className="w-full p-2 border border-slate-200 rounded-lg text-sm" value={notes.customer_notes} onChange={e => setNotes({...notes, customer_notes: e.target.value})}></textarea>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Internal Notes (Hidden)</label>
              <textarea rows={2} className="w-full p-2 border border-slate-200 rounded-lg text-sm" value={notes.internal_notes} onChange={e => setNotes({...notes, internal_notes: e.target.value})}></textarea>
            </div>
          </div>
        </section>

        <section className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h2 className="text-lg font-bold text-slate-800 mb-4">Attachments</h2>
          <div className="border-2 border-dashed border-slate-300 rounded-xl p-8 flex flex-col items-center justify-center text-slate-500 bg-slate-50 hover:bg-slate-100 transition-colors cursor-pointer">
             <FileUp size={24} className="mb-2 text-indigo-400" />
             <p className="text-sm font-semibold">Upload Artwork & References</p>
             <p className="text-xs">Drag and drop or click to browse</p>
          </div>
        </section>
      </div>

      {/* 9. Workflow Preview */}
      <section className="bg-slate-900 rounded-xl shadow-sm border border-slate-800 p-6 text-white overflow-hidden relative">
        <div className="absolute top-0 right-0 p-6 opacity-10 pointer-events-none"><Package size={120} /></div>
        <h2 className="text-lg font-bold text-white mb-6">Estimated Workflow Path</h2>
        <div className="flex items-center gap-2 overflow-x-auto pb-2 text-sm font-medium">
          <div className="bg-indigo-500/20 text-indigo-300 px-4 py-2 rounded-lg border border-indigo-500/30 shrink-0">Quotation</div>
          <ChevronRight size={16} className="text-slate-600 shrink-0" />
          {sampleReq.required ? (
            <>
              <div className="bg-amber-500/20 text-amber-300 px-4 py-2 rounded-lg border border-amber-500/30 shrink-0">Sample Order</div>
              <ChevronRight size={16} className="text-slate-600 shrink-0" />
              <div className="bg-amber-500/20 text-amber-300 px-4 py-2 rounded-lg border border-amber-500/30 shrink-0">Sample Approval</div>
              <ChevronRight size={16} className="text-slate-600 shrink-0" />
            </>
          ) : (
            <>
              <div className="bg-slate-800 text-slate-400 px-4 py-2 rounded-lg border border-slate-700 border-dashed shrink-0 line-through">Skip Sample</div>
              <ChevronRight size={16} className="text-slate-600 shrink-0" />
            </>
          )}
          <div className="bg-emerald-500/20 text-emerald-300 px-4 py-2 rounded-lg border border-emerald-500/30 shrink-0">Production Order</div>
          <ChevronRight size={16} className="text-slate-600 shrink-0" />
          <div className="bg-blue-500/20 text-blue-300 px-4 py-2 rounded-lg border border-blue-500/30 shrink-0">Invoice & Closure</div>
        </div>
      </section>

      {/* 10. Actions Footer (Sticky) */}
      <div className="fixed bottom-0 left-0 lg:left-60 right-0 bg-white border-t border-slate-200 p-4 px-8 flex justify-between items-center z-40 shadow-[0_-4px_12px_rgba(0,0,0,0.05)]">
         <div className="flex items-center gap-2 text-sm text-slate-500 font-medium hidden sm:flex">
           <Info size={16} /> Ensure commercial details are accurate.
         </div>
         <div className="flex gap-3">
           <button 
             onClick={() => handleSave('Draft')} disabled={loading}
             className="px-5 py-2.5 rounded-lg text-sm font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors">
             Save as Draft
           </button>
           <button 
             onClick={() => handleSave('Approved')} disabled={loading}
             className="flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-semibold bg-indigo-600 text-white hover:bg-indigo-700 transition-colors shadow-sm">
             <Save size={16} /> Save & Mark Approved
           </button>
         </div>
      </div>
    </div>
  );
}
