import { useState } from "react";
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

const screenComponents: Record<Screen, React.ReactNode> = {
  admin: <AdminDashboard />,
  employees: <EmployeeManagement />,
  reports: <ReportsAnalytics />,
  sales: <SalesDashboard />,
  customers: <CustomerManagement />,
  quotations: <QuotationManagement />,
  "sample-jobs": <SampleJobs />,
  "production-jobs": <ProductionJobs />,
  supervisor: <SupervisorDashboard />,
  production: <ProductionDashboard />,
  machines: <MachineManagement />,
  operator: <MachineOperator />,
  qc: <QualityControl />,
  packaging: <PackagingDashboard />,
  inventory: <InventoryManagement />,
  dispatch: <DispatchDashboard />,
  finance: <FinanceDashboard />,
};

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(() => !!localStorage.getItem("user"));
  const [currentScreen, setCurrentScreen] = useState<Screen>("admin");
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
          currentScreen={currentScreen}
          onNavigate={setCurrentScreen}
          onLogout={() => {
            localStorage.removeItem("user");
            setIsLoggedIn(false);
          }}
        >
          {screenComponents[currentScreen]}
        </Layout>
      )}
    </div>
  );
}