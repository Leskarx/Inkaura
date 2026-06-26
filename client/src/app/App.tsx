import { useState } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { LoginPage } from "./components/LoginPage";
import { Layout, Screen } from "./components/Layout";
import { AdminDashboard } from "./components/AdminDashboard";
import { SalesDashboard } from "./components/SalesDashboard";
import { CustomerManagement } from "./components/CustomerManagement";
import { QuotationManagement } from "./components/QuotationManagement";
import { SampleJobs } from "./components/SampleJobs";
import { ProductionJobs } from "./components/ProductionJobs";
import { SupervisorDashboard } from "./components/SupervisorDashboard";
import { InventoryManagement } from "./components/InventoryManagement";
import { MachineOperator } from "./components/MachineOperator";
import { QualityControl } from "./components/QualityControl";
import { DispatchDashboard } from "./components/DispatchDashboard";
import { FinanceDashboard } from "./components/FinanceDashboard";
import { MachineManagement } from "./components/MachineManagement";
import { ProductionDashboard } from "./components/ProductionDashboard";
import { PackagingDashboard } from "./components/PackagingDashboard";
import { ReportsAnalytics } from "./components/ReportsAnalytics";
import { EmployeeManagement } from "./components/EmployeeManagement";
import { CreateQuotationPage } from "./components/CreateQuotationPage";
import { EditQuotationPage } from "./components/EditQuotationPage";

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(() => !!localStorage.getItem("user"));
  const [darkMode, setDarkMode] = useState(false);

  return (
    /* MARKER-MAKE-KIT-INVOKED */
    <div className={`size-full ${darkMode ? "dark" : ""}`} style={{ colorScheme: darkMode ? "dark" : "light" }}>
      {!isLoggedIn ? (
        <LoginPage
          onLogin={() => setIsLoggedIn(true)}
        />
      ) : (
        <Layout
            onLogout={() => {
              localStorage.removeItem("user");
              setIsLoggedIn(false);
            }}
          >
            <Routes>
              <Route path="/" element={<Navigate to="/admin" replace />} />
              <Route path="/admin" element={<AdminDashboard />} />
              <Route path="/employees" element={<EmployeeManagement />} />
              <Route path="/reports" element={<ReportsAnalytics />} />
              <Route path="/sales" element={<SalesDashboard />} />
              <Route path="/customers" element={<CustomerManagement />} />
              <Route path="/quotations" element={<QuotationManagement />} />
              <Route path="/quotations/create" element={<CreateQuotationPage />} />
              <Route path="/quotations/edit/:id" element={<EditQuotationPage />} />
              <Route path="/sample-jobs" element={<SampleJobs />} />
              <Route path="/production-jobs" element={<ProductionJobs />} />
              <Route path="/supervisor" element={<SupervisorDashboard />} />
              <Route path="/production" element={<ProductionDashboard />} />
              <Route path="/machines" element={<MachineManagement />} />
              <Route path="/operator" element={<MachineOperator />} />
              <Route path="/qc" element={<QualityControl />} />
              <Route path="/packaging" element={<PackagingDashboard />} />
              <Route path="/inventory" element={<InventoryManagement />} />
              <Route path="/dispatch" element={<DispatchDashboard />} />
              <Route path="/finance" element={<FinanceDashboard />} />
            </Routes>
          </Layout>
      )}
    </div>
  );
}