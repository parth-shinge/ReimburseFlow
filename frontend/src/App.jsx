import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import RoleGuard from './components/RoleGuard';
import Navbar from './components/Navbar';
import { Toaster } from 'react-hot-toast';

// Pages
import Login from './pages/Login';
import Signup from './pages/Signup';
import Dashboard from './pages/Dashboard';
import SubmitExpense from './pages/SubmitExpense';
import ExpenseHistory from './pages/ExpenseHistory';
import ApprovalQueue from './pages/ApprovalQueue';
import AdminUsers from './pages/AdminUsers';
import ManageRules from './pages/ManageRules';

const ProtectedLayout = ({ children }) => (
  <div className="min-h-screen bg-slate-50">
    <Navbar />
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {children}
    </main>
  </div>
);

function App() {
  return (
    <AuthProvider>
      <Toaster position="top-right" />
      <Router>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />

          {/* Protected Routes */}
          <Route path="/dashboard" element={
            <RoleGuard>
              <ProtectedLayout><Dashboard /></ProtectedLayout>
            </RoleGuard>
          } />

          <Route path="/expenses/new" element={
            <RoleGuard allowedRoles={['EMPLOYEE', 'ADMIN', 'MANAGER']}>
              <ProtectedLayout><SubmitExpense /></ProtectedLayout>
            </RoleGuard>
          } />

          <Route path="/expenses" element={
            <RoleGuard>
              <ProtectedLayout><ExpenseHistory /></ProtectedLayout>
            </RoleGuard>
          } />

          <Route path="/approvals" element={
            <RoleGuard allowedRoles={['MANAGER', 'ADMIN']}>
              <ProtectedLayout><ApprovalQueue /></ProtectedLayout>
            </RoleGuard>
          } />

          <Route path="/admin/users" element={
            <RoleGuard allowedRoles={['ADMIN']}>
              <ProtectedLayout><AdminUsers /></ProtectedLayout>
            </RoleGuard>
          } />

          <Route path="/admin/rules" element={
            <RoleGuard allowedRoles={['ADMIN']}>
              <ProtectedLayout><ManageRules /></ProtectedLayout>
            </RoleGuard>
          } />

          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
