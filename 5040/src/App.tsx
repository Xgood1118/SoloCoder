import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Layout from './components/layout/Layout';
import Dashboard from './pages/Dashboard';
import PropertyList from './pages/Properties/PropertyList';
import PropertyForm from './pages/Properties/PropertyForm';
import TenantList from './pages/Tenants/TenantList';
import TenantForm from './pages/Tenants/TenantForm';
import ContractList from './pages/Contracts/ContractList';
import ContractForm from './pages/Contracts/ContractForm';
import FinancePage from './pages/Finance';
import HandoverPage from './pages/Handover';

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="properties" element={<PropertyList />} />
          <Route path="properties/new" element={<PropertyForm />} />
          <Route path="properties/:id" element={<PropertyForm />} />
          <Route path="tenants" element={<TenantList />} />
          <Route path="tenants/new" element={<TenantForm />} />
          <Route path="tenants/:id" element={<TenantForm />} />
          <Route path="contracts" element={<ContractList />} />
          <Route path="contracts/new" element={<ContractForm />} />
          <Route path="contracts/:id" element={<ContractForm />} />
          <Route path="finance" element={<FinancePage />} />
          <Route path="handover" element={<HandoverPage />} />
        </Route>
      </Routes>
    </Router>
  );
}
