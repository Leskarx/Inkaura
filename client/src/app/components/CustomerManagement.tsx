import { useState, useEffect } from "react";
import { Plus, Search, Mail, Phone, X, Eye, Edit2, Trash2, MapPin, Building, Calendar, FileText } from "lucide-react";
import { supabase } from "../../lib/supabase";

export interface Customer {
  customer_id: string;
  company_name: string;
  contact_person: string;
  phone_number: string;
  email: string;
  address: string;
  gst_number: string;
  created_at: string;
}

interface CustomerFormProps {
  initialData: Customer | null;
  onClose: () => void;
  onCustomerSaved: () => void;
}

function CustomerForm({ initialData, onClose, onCustomerSaved }: CustomerFormProps) {
  // Try to split the name into first/last for the inputs, or just keep it together.
  // Since we joined it before, we can just split by the first space.
  const nameParts = initialData?.contact_person ? initialData.contact_person.split(" ") : [""];
  const initialFirst = nameParts[0] || "";
  const initialLast = nameParts.slice(1).join(" ") || "";

  const [firstName, setFirstName] = useState(initialFirst);
  const [lastName, setLastName] = useState(initialLast);
  const [company, setCompany] = useState(initialData?.company_name || "");
  const [email, setEmail] = useState(initialData?.email || "");
  const [phone, setPhone] = useState(initialData?.phone_number || "");
  const [address, setAddress] = useState(initialData?.address || "");
  const [gstNumber, setGstNumber] = useState(initialData?.gst_number || "");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!firstName || !email) {
      alert("First Name and Email are required");
      return;
    }
    setLoading(true);

    const payload = {
      contact_person: `${firstName} ${lastName}`.trim(),
      company_name: company,
      email: email,
      phone_number: phone,
      address: address,
      gst_number: gstNumber
    };

    let error;

    if (initialData) {
      // Update
      const response = await supabase
        .from("customers")
        .update(payload)
        .eq("customer_id", initialData.customer_id);
      error = response.error;
    } else {
      // Insert
      const customerId = `C-${Math.floor(1000 + Math.random() * 9000)}`;
      const response = await supabase.from("customers").insert({
        customer_id: customerId,
        ...payload
      });
      error = response.error;
    }
    
    setLoading(false);

    if (error) {
      console.error("Error saving customer:", error);
      alert(`Failed to save customer: ${error.message}`);
    } else {
      onCustomerSaved();
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="text-slate-900 text-sm" style={{ fontWeight: 700 }}>
            {initialData ? "Edit Customer" : "Add New Customer"}
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
            <X size={18} />
          </button>
        </div>
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-slate-600 mb-1.5" style={{ fontWeight: 500 }}>First Name</label>
              <input value={firstName} onChange={e => setFirstName(e.target.value)} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400" placeholder="First name" />
            </div>
            <div>
              <label className="block text-xs text-slate-600 mb-1.5" style={{ fontWeight: 500 }}>Last Name</label>
              <input value={lastName} onChange={e => setLastName(e.target.value)} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400" placeholder="Last name" />
            </div>
          </div>
          <div>
            <label className="block text-xs text-slate-600 mb-1.5" style={{ fontWeight: 500 }}>Company Name</label>
            <input value={company} onChange={e => setCompany(e.target.value)} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400" placeholder="Company Pvt. Ltd." />
          </div>
          <div>
            <label className="block text-xs text-slate-600 mb-1.5" style={{ fontWeight: 500 }}>Email Address</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400" placeholder="email@company.com" />
          </div>
          <div>
            <label className="block text-xs text-slate-600 mb-1.5" style={{ fontWeight: 500 }}>Phone Number</label>
            <input value={phone} onChange={e => setPhone(e.target.value)} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400" placeholder="+91 XXXXX XXXXX" />
          </div>
          <div>
            <label className="block text-xs text-slate-600 mb-1.5" style={{ fontWeight: 500 }}>Address</label>
            <textarea value={address} onChange={e => setAddress(e.target.value)} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 resize-none" rows={2} placeholder="Full address" />
          </div>
          <div>
            <label className="block text-xs text-slate-600 mb-1.5" style={{ fontWeight: 500 }}>GST Number (Optional)</label>
            <input value={gstNumber} onChange={e => setGstNumber(e.target.value)} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400" placeholder="GSTIN" />
          </div>
        </div>
        <div className="flex gap-2 justify-end px-6 py-4 border-t border-slate-100 bg-slate-50 rounded-b-2xl">
          <button onClick={onClose} disabled={loading} className="px-4 py-2 text-sm border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-100 transition-colors disabled:opacity-50">
            Cancel
          </button>
          <button onClick={handleSubmit} disabled={loading} className="px-4 py-2 text-sm rounded-lg text-white transition-colors disabled:opacity-50" style={{ background: "#4f46e5", fontWeight: 500 }}>
            {loading ? "Saving..." : (initialData ? "Save Changes" : "Create Customer")}
          </button>
        </div>
      </div>
    </div>
  );
}

function ViewCustomerModal({ customer, onClose }: { customer: Customer, onClose: () => void }) {
  const sinceDate = new Date(customer.created_at).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  
  return (
    <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="text-slate-900 text-sm" style={{ fontWeight: 700 }}>Customer Details</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
            <X size={18} />
          </button>
        </div>
        <div className="p-6 space-y-5">
          <div className="flex items-center gap-4">
             <div className="w-12 h-12 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 text-lg flex-shrink-0" style={{ fontWeight: 600 }}>
                {(customer.contact_person || "?").charAt(0).toUpperCase()}
             </div>
             <div>
                <h3 className="text-slate-900 text-base" style={{ fontWeight: 700 }}>{customer.contact_person || "Unknown"}</h3>
                <p className="text-slate-500 text-sm flex items-center gap-1"><Building size={12}/> {customer.company_name || "No Company"}</p>
             </div>
          </div>
          
          <div className="bg-slate-50 p-4 rounded-xl space-y-3">
             <div className="flex items-start gap-2.5">
                <Mail size={14} className="text-slate-400 mt-0.5" />
                <div>
                   <p className="text-xs text-slate-500" style={{ fontWeight: 500 }}>Email Address</p>
                   <p className="text-sm text-slate-800">{customer.email || "-"}</p>
                </div>
             </div>
             <div className="flex items-start gap-2.5">
                <Phone size={14} className="text-slate-400 mt-0.5" />
                <div>
                   <p className="text-xs text-slate-500" style={{ fontWeight: 500 }}>Phone Number</p>
                   <p className="text-sm text-slate-800">{customer.phone_number || "-"}</p>
                </div>
             </div>
             <div className="flex items-start gap-2.5">
                <MapPin size={14} className="text-slate-400 mt-0.5" />
                <div>
                   <p className="text-xs text-slate-500" style={{ fontWeight: 500 }}>Address</p>
                   <p className="text-sm text-slate-800">{customer.address || "-"}</p>
                </div>
             </div>
             <div className="flex items-start gap-2.5">
                <FileText size={14} className="text-slate-400 mt-0.5" />
                <div>
                   <p className="text-xs text-slate-500" style={{ fontWeight: 500 }}>GST Number</p>
                   <p className="text-sm text-slate-800">{customer.gst_number || "-"}</p>
                </div>
             </div>
             <div className="flex items-start gap-2.5">
                <Calendar size={14} className="text-slate-400 mt-0.5" />
                <div>
                   <p className="text-xs text-slate-500" style={{ fontWeight: 500 }}>Customer Since</p>
                   <p className="text-sm text-slate-800">{sinceDate}</p>
                </div>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function CustomerManagement() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  
  // Modals
  const [showForm, setShowForm] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [viewingCustomer, setViewingCustomer] = useState<Customer | null>(null);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  const fetchCustomers = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("customers")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching customers:", error);
    } else {
      setCustomers(data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchCustomers();
  }, []);

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to delete ${name}? This action cannot be undone.`)) {
      return;
    }
    const { error } = await supabase.from("customers").delete().eq("customer_id", id);
    if (error) {
      alert(`Failed to delete: ${error.message}`);
    } else {
      fetchCustomers();
    }
  };

  const filtered = customers.filter((c) => {
    const fullName = (c.contact_person || "").toLowerCase();
    const companyName = (c.company_name || "").toLowerCase();
    return (
      fullName.includes(search.toLowerCase()) ||
      companyName.includes(search.toLowerCase()) ||
      (c.email && c.email.toLowerCase().includes(search.toLowerCase()))
    );
  });

  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const paginatedCustomers = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  // Reset to page 1 if search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [search]);

  return (
    <div className="p-6 space-y-6">
      {/* Modals */}
      {(showForm || editingCustomer) && (
        <CustomerForm
          initialData={editingCustomer}
          onClose={() => {
            setShowForm(false);
            setEditingCustomer(null);
          }}
          onCustomerSaved={fetchCustomers}
        />
      )}
      {viewingCustomer && (
        <ViewCustomerModal
          customer={viewingCustomer}
          onClose={() => setViewingCustomer(null)}
        />
      )}

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-slate-900" style={{ fontSize: "1.25rem", fontWeight: 700 }}>Customer Management</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            {customers.length} customers · {customers.length} active
          </p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg text-white transition-colors"
          style={{ background: "#4f46e5", fontWeight: 500 }}
        >
          <Plus size={14} /> Add Customer
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total Customers", value: customers.length.toString(), sub: "All time" },
          { label: "Active", value: customers.length.toString(), sub: "Current status" },
          { label: "Total Revenue", value: `₹0`, sub: "All time" },
          { label: "Avg. Order Value", value: `₹0`, sub: "Per order" },
        ].map((s) => (
          <div key={s.label} className="bg-card border border-border rounded-xl p-4">
            <p className="text-slate-900 mb-0.5" style={{ fontSize: "1.25rem", fontWeight: 700 }}>{s.value}</p>
            <p className="text-slate-700 text-xs" style={{ fontWeight: 500 }}>{s.label}</p>
            <p className="text-slate-400 text-xs mt-0.5">{s.sub}</p>
          </div>
        ))}
      </div>

      {/* Table Area */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="flex items-center gap-3 p-5 border-b border-border flex-wrap">
          <div className="relative flex-1 min-w-44">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search customers by name, company, or email..."
              className="pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg w-full focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
            />
          </div>
        </div>

        <div className="overflow-x-auto min-h-[200px]">
          {loading ? (
            <div className="flex items-center justify-center h-48 text-slate-500 text-sm">
              Loading customers...
            </div>
          ) : customers.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-slate-500 text-sm">
              <p>No customers found.</p>
              <button onClick={() => setShowForm(true)} className="mt-2 text-indigo-600 hover:underline">Add your first customer</button>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-border">
                  {["Customer", "Company", "Contact", "Orders", "Revenue", "Since", "Status", "Actions"].map((h) => (
                    <th key={h} className="text-left text-xs text-slate-500 px-5 py-2.5 whitespace-nowrap" style={{ fontWeight: 500 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paginatedCustomers.map((c) => {
                  const fullName = c.contact_person || "Unknown";
                  const sinceDate = new Date(c.created_at).toLocaleDateString("en-US", { month: "short", year: "numeric" });
                  return (
                    <tr key={c.customer_id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 text-xs flex-shrink-0" style={{ fontWeight: 600 }}>
                            {fullName.charAt(0).toUpperCase() || "?"}
                          </div>
                          <div>
                            <p className="text-slate-800 text-xs whitespace-nowrap" style={{ fontWeight: 500 }}>{fullName}</p>
                            <p className="text-slate-400 text-xs">{c.customer_id.slice(0, 8)}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3 text-slate-600 text-xs whitespace-nowrap">{c.company_name || "-"}</td>
                      <td className="px-5 py-3">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-1 text-xs text-slate-500">
                            <Mail size={10} /> {c.email || "-"}
                          </div>
                          <div className="flex items-center gap-1 text-xs text-slate-500">
                            <Phone size={10} /> {c.phone_number || "-"}
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3 text-slate-800 text-xs" style={{ fontWeight: 600 }}>0</td>
                      <td className="px-5 py-3 text-slate-800 text-xs" style={{ fontWeight: 600 }}>₹0</td>
                      <td className="px-5 py-3 text-slate-500 text-xs">{sinceDate}</td>
                      <td className="px-5 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs border bg-green-50 text-green-700 border-green-200`} style={{ fontWeight: 500 }}>
                          Active
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <button onClick={() => setViewingCustomer(c)} className="text-slate-400 hover:text-indigo-600 transition-colors" title="View Details"><Eye size={14} /></button>
                          <button onClick={() => setEditingCustomer(c)} className="text-slate-400 hover:text-amber-600 transition-colors" title="Edit Customer"><Edit2 size={14} /></button>
                          <button onClick={() => handleDelete(c.customer_id, fullName)} className="text-slate-400 hover:text-red-600 transition-colors" title="Delete Customer"><Trash2 size={14} /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
        <div className="flex items-center justify-between px-5 py-3 bg-slate-50 border-t border-border">
          <p className="text-xs text-slate-500">
            Showing {filtered.length > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0} to {Math.min(currentPage * itemsPerPage, filtered.length)} of {filtered.length} customers
          </p>
          <div className="flex gap-1">
            <button 
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-2 py-1 rounded text-xs text-slate-500 hover:bg-slate-100 disabled:opacity-50 transition-colors"
            >
              Prev
            </button>
            {Array.from({ length: totalPages }).map((_, i) => {
              const p = i + 1;
              return (
                <button 
                  key={p} 
                  onClick={() => setCurrentPage(p)}
                  className={`w-6 h-6 rounded text-xs transition-colors ${p === currentPage ? "bg-indigo-600 text-white" : "text-slate-500 hover:bg-slate-100"}`}
                >
                  {p}
                </button>
              );
            })}
            <button 
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages || totalPages === 0}
              className="px-2 py-1 rounded text-xs text-slate-500 hover:bg-slate-100 disabled:opacity-50 transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
