import { useState } from "react";
import {
  LayoutDashboard, ShoppingCart, Users, FileText, Briefcase,
  ClipboardList, Package, Cpu, CheckSquare, Truck, DollarSign,
  Bell, Search, ChevronDown, Settings, LogOut, Menu, X,
  Printer, ChevronRight, Moon, Sun, BarChart2, FlaskConical,
  Cog, Factory, Box, UserCog
} from "lucide-react";

export type Screen =
  | "admin" | "employees" | "sales" | "customers" | "quotations" | "jobs"
  | "supervisor" | "inventory" | "operator" | "qc" | "dispatch" | "finance"
  | "sample" | "machines" | "production" | "packaging" | "reports";

interface NavItem {
  id: Screen;
  label: string;
  icon: React.ReactNode;
  badge?: number;
}

const navGroups: { label: string; items: NavItem[] }[] = [
  {
    label: "Overview",
    items: [
      { id: "admin",     label: "Admin Dashboard",     icon: <LayoutDashboard size={15} /> },
      { id: "employees", label: "Employee Management", icon: <UserCog size={15} /> },
      { id: "reports",   label: "Reports & Analytics",  icon: <BarChart2 size={15} /> },
    ],
  },
  {
    label: "Sales & CRM",
    items: [
      { id: "sales",      label: "Sales Dashboard", icon: <ShoppingCart size={15} />, badge: 5 },
      { id: "customers",  label: "Customers",       icon: <Users size={15} /> },
      { id: "quotations", label: "Quotations",      icon: <FileText size={15} />, badge: 3 },
    ],
  },
  {
    label: "Job Management",
    items: [
      { id: "jobs",   label: "Job Management",  icon: <Briefcase size={15} />, badge: 12 },
      { id: "sample", label: "Sample Approval", icon: <FlaskConical size={15} />, badge: 4 },
    ],
  },
  {
    label: "Production",
    items: [
      { id: "supervisor",  label: "Supervisor Dashboard", icon: <ClipboardList size={15} /> },
      { id: "production",  label: "Production Floor",     icon: <Factory size={15} /> },
      { id: "machines",    label: "Machine Management",   icon: <Cog size={15} />, badge: 1 },
      { id: "operator",    label: "Machine Operator",     icon: <Cpu size={15} /> },
    ],
  },
  {
    label: "Quality & Packaging",
    items: [
      { id: "qc",        label: "Quality Control", icon: <CheckSquare size={15} />, badge: 4 },
      { id: "packaging", label: "Packaging",       icon: <Box size={15} /> },
    ],
  },
  {
    label: "Inventory & Dispatch",
    items: [
      { id: "inventory", label: "Inventory",   icon: <Package size={15} />, badge: 2 },
      { id: "dispatch",  label: "Dispatch",    icon: <Truck size={15} /> },
    ],
  },
  {
    label: "Finance",
    items: [
      { id: "finance", label: "Finance & Reports", icon: <DollarSign size={15} /> },
    ],
  },
];

interface LayoutProps {
  currentScreen: Screen;
  onNavigate: (screen: Screen) => void;
  onLogout: () => void;
  children: React.ReactNode;
}

const screenTitles: Record<Screen, string> = {
  admin:      "Admin Dashboard",
  employees:  "Employee Management",
  reports:    "Reports & Analytics",
  sales:      "Sales Dashboard",
  customers:  "Customer Management",
  quotations: "Quotation Management",
  jobs:       "Job Management",
  sample:     "Sample Approval",
  supervisor: "Supervisor Dashboard",
  production: "Production Floor",
  machines:   "Machine Management",
  operator:   "Machine Operator",
  qc:         "Quality Control",
  packaging:  "Packaging",
  inventory:  "Inventory Management",
  dispatch:   "Dispatch Management",
  finance:    "Finance & Reports",
};

export function Layout({ currentScreen, onNavigate, onLogout, children }: LayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [notifOpen, setNotifOpen]     = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const notifications = [
    { id: 1, text: "Job #JB-0042 ready for QC inspection",       time: "2m ago",  type: "info" },
    { id: 2, text: "Low stock alert: Cyan Ink (12 units left)",   time: "15m ago", type: "warning" },
    { id: 3, text: "Quotation #QT-0089 approved by client",       time: "1h ago",  type: "success" },
    { id: 4, text: "Machine PM-3 scheduled maintenance overdue",  time: "3h ago",  type: "error" },
    { id: 5, text: "Sample #SMP-0012 approved by Apex Beverages", time: "5h ago",  type: "success" },
  ];

  return (
    <div className="flex h-full bg-background overflow-hidden">
      {/* Sidebar */}
      <aside
        className={`flex flex-col flex-shrink-0 transition-all duration-300 ${sidebarOpen ? "w-60" : "w-14"}`}
        style={{ background: "var(--sidebar)", borderRight: "1px solid var(--sidebar-border)" }}
      >
        {/* Logo */}
        <div
          className="flex items-center gap-3 px-3 h-14 flex-shrink-0"
          style={{ borderBottom: "1px solid var(--sidebar-border)" }}
        >
          <div className="flex items-center justify-center w-8 h-8 rounded-lg flex-shrink-0" style={{ background: "#6366f1" }}>
            <Printer size={15} className="text-white" />
          </div>
          {sidebarOpen && (
            <div className="min-w-0">
              <p className="text-white text-sm leading-tight truncate" style={{ fontWeight: 700 }}>PrintFlow ERP</p>
              <p className="text-xs truncate" style={{ color: "var(--sidebar-foreground)", opacity: 0.5 }}>Enterprise Edition</p>
            </div>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-4">
          {navGroups.map((group) => (
            <div key={group.label}>
              {sidebarOpen && (
                <p className="text-xs px-2 mb-1.5 uppercase tracking-wider" style={{ color: "var(--sidebar-foreground)", opacity: 0.35, fontWeight: 600 }}>
                  {group.label}
                </p>
              )}
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const active = currentScreen === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => onNavigate(item.id)}
                      className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-lg transition-all duration-150 text-left relative"
                      style={{
                        background: active ? "#6366f1" : "transparent",
                        color: active ? "#fff" : "var(--sidebar-foreground)",
                      }}
                      title={!sidebarOpen ? item.label : undefined}
                      onMouseEnter={(e) => { if (!active) (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.06)"; }}
                      onMouseLeave={(e) => { if (!active) (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                    >
                      <span className="flex-shrink-0" style={{ opacity: active ? 1 : 0.75 }}>{item.icon}</span>
                      {sidebarOpen && (
                        <>
                          <span className="flex-1 text-xs truncate" style={{ fontWeight: active ? 600 : 400 }}>{item.label}</span>
                          {item.badge && (
                            <span className="text-xs px-1.5 py-0.5 rounded-full min-w-[1.25rem] text-center" style={{
                              background: active ? "rgba(255,255,255,0.22)" : "rgba(99,102,241,0.25)",
                              color: active ? "#fff" : "#a5b4fc",
                              fontWeight: 700, fontSize: "10px",
                            }}>
                              {item.badge}
                            </span>
                          )}
                        </>
                      )}
                      {!sidebarOpen && item.badge && (
                        <span className="absolute top-0.5 right-0.5 w-2 h-2 rounded-full bg-indigo-400" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Bottom user */}
        <div className="flex-shrink-0 p-2" style={{ borderTop: "1px solid var(--sidebar-border)" }}>
          <div
            className={`flex items-center gap-2.5 p-2 rounded-lg cursor-pointer transition-colors ${!sidebarOpen ? "justify-center" : ""}`}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.06)"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
          >
            <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: "#6366f1" }}>
              <span className="text-white text-xs" style={{ fontWeight: 700 }}>A</span>
            </div>
            {sidebarOpen && (
              <div className="min-w-0 flex-1">
                <p className="text-xs truncate" style={{ color: "var(--sidebar-accent-foreground)", fontWeight: 600 }}>Admin User</p>
                <p className="text-xs truncate" style={{ color: "var(--sidebar-foreground)", opacity: 0.45 }}>admin@printflow.com</p>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Main area */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        {/* Topbar */}
        <header className="flex items-center gap-3 px-5 h-14 bg-card border-b border-border flex-shrink-0">
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="text-slate-500 hover:text-slate-800 transition-colors flex-shrink-0">
            <Menu size={17} />
          </button>

          <div className="flex items-center gap-1.5 text-xs min-w-0">
            <span className="text-slate-400 flex-shrink-0">PrintFlow</span>
            <ChevronRight size={12} className="text-slate-300 flex-shrink-0" />
            <span className="text-slate-800 truncate" style={{ fontWeight: 600 }}>{screenTitles[currentScreen]}</span>
          </div>

          <div className="flex-1" />

          <div className="relative hidden md:block">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search jobs, customers, invoices..."
              className="pl-8 pr-4 py-1.5 text-xs bg-slate-100 border border-slate-200 rounded-lg w-56 focus:outline-none focus:border-indigo-400 transition-all"
            />
          </div>



          {/* Notifications */}
          <div className="relative flex-shrink-0">
            <button
              onClick={() => { setNotifOpen(!notifOpen); setUserMenuOpen(false); }}
              className="relative flex items-center justify-center w-8 h-8 rounded-lg border border-slate-200 text-slate-500 hover:text-indigo-600 hover:border-indigo-300 transition-all"
            >
              <Bell size={14} />
              <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-red-500" />
            </button>
            {notifOpen && (
              <div className="absolute right-0 top-10 w-80 bg-card border border-border rounded-xl shadow-xl z-50 overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                  <p className="text-sm text-slate-900" style={{ fontWeight: 600 }}>Notifications</p>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-indigo-600" style={{ fontWeight: 500 }}>Mark all read</span>
                    <button onClick={() => setNotifOpen(false)}><X size={14} className="text-slate-400" /></button>
                  </div>
                </div>
                {notifications.map((n) => (
                  <div key={n.id} className="flex gap-3 px-4 py-3 hover:bg-slate-50 border-b border-border cursor-pointer transition-colors">
                    <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${
                      n.type === "warning" ? "bg-amber-500" : n.type === "success" ? "bg-green-500" : n.type === "error" ? "bg-red-500" : "bg-indigo-500"
                    }`} />
                    <div className="min-w-0">
                      <p className="text-xs text-slate-700 leading-relaxed">{n.text}</p>
                      <p className="text-xs text-slate-400 mt-0.5">{n.time}</p>
                    </div>
                  </div>
                ))}
                <div className="px-4 py-2.5">
                  <button className="text-xs text-indigo-600 hover:text-indigo-700" style={{ fontWeight: 500 }}>View all notifications</button>
                </div>
              </div>
            )}
          </div>

          {/* User menu */}
          <div className="relative flex-shrink-0">
            <button
              onClick={() => { setUserMenuOpen(!userMenuOpen); setNotifOpen(false); }}
              className="flex items-center gap-2 pl-1 pr-2 py-1 rounded-lg hover:bg-slate-100 transition-colors"
            >
              <div className="w-7 h-7 rounded-full flex items-center justify-center" style={{ background: "#6366f1" }}>
                <span className="text-white text-xs" style={{ fontWeight: 700 }}>A</span>
              </div>
              <span className="text-xs text-slate-700 hidden sm:block" style={{ fontWeight: 500 }}>Admin</span>
              <ChevronDown size={12} className="text-slate-400" />
            </button>
            {userMenuOpen && (
              <div className="absolute right-0 top-10 w-44 bg-card border border-border rounded-xl shadow-xl z-50 overflow-hidden py-1">
                <button className="flex items-center gap-2.5 w-full px-4 py-2 text-xs text-slate-700 hover:bg-slate-50 transition-colors">
                  <Settings size={13} className="text-slate-400" /> Settings
                </button>
                <div className="border-t border-border my-1" />
                <button
                  onClick={onLogout}
                  className="flex items-center gap-2.5 w-full px-4 py-2 text-xs text-red-600 hover:bg-red-50 transition-colors"
                >
                  <LogOut size={13} /> Sign out
                </button>
              </div>
            )}
          </div>
        </header>

        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
