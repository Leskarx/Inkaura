import { useState } from "react";
import { LoginPage }          from "./components/LoginPage";
import { Layout, Screen }     from "./components/Layout";
import { AdminDashboard }     from "./components/AdminDashboard";
import { SalesDashboard }     from "./components/SalesDashboard";
import { CustomerManagement } from "./components/CustomerManagement";
import { QuotationManagement } from "./components/QuotationManagement";
import { JobManagement }      from "./components/JobManagement";
import { SupervisorDashboard } from "./components/SupervisorDashboard";
import { InventoryManagement } from "./components/InventoryManagement";
import { MachineOperator }    from "./components/MachineOperator";
import { QualityControl }     from "./components/QualityControl";
import { DispatchDashboard }  from "./components/DispatchDashboard";
import { FinanceDashboard }   from "./components/FinanceDashboard";
import { SampleApproval }     from "./components/SampleApproval";
import { MachineManagement }  from "./components/MachineManagement";
import { ProductionDashboard } from "./components/ProductionDashboard";
import { PackagingDashboard }    from "./components/PackagingDashboard";
import { ReportsAnalytics }      from "./components/ReportsAnalytics";
import { EmployeeManagement }    from "./components/EmployeeManagement";

const screenComponents: Record<Screen, React.ReactNode> = {
  admin:      <AdminDashboard />,
  employees:  <EmployeeManagement />,
  reports:    <ReportsAnalytics />,
  sales:      <SalesDashboard />,
  customers:  <CustomerManagement />,
  quotations: <QuotationManagement />,
  jobs:       <JobManagement />,
  sample:     <SampleApproval />,
  supervisor: <SupervisorDashboard />,
  production: <ProductionDashboard />,
  machines:   <MachineManagement />,
  operator:   <MachineOperator />,
  qc:         <QualityControl />,
  packaging:  <PackagingDashboard />,
  inventory:  <InventoryManagement />,
  dispatch:   <DispatchDashboard />,
  finance:    <FinanceDashboard />,
};

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(() => !!localStorage.getItem("user"));
  const [currentScreen, setCurrentScreen] = useState<Screen>("admin");

  return (
    /* MARKER-MAKE-KIT-INVOKED */
    <div className={`size-full`} style={{ colorScheme: "light" }}>
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
