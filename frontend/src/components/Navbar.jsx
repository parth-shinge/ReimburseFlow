import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LogOut, User as UserIcon, Menu, X } from 'lucide-react';

const Navbar = () => {
  const { user, logout, isAdmin, isManager } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);

  const handleLogout = () => {
    logout();
    setIsOpen(false);
    navigate('/login');
  };

  const navLinkClass = (path) => {
    const isActive = location.pathname === path;
    return `px-3 py-2 rounded-md font-medium text-sm transition-colors ${
      isActive 
        ? 'bg-indigo-50 text-indigo-700' 
        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
    }`;
  };

  const mobileNavLinkClass = (path) => {
    const isActive = location.pathname === path;
    return `block px-3 py-2 rounded-md font-medium text-base ${
      isActive
        ? 'bg-indigo-50 text-indigo-700'
        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
    }`;
  };

  return (
    <nav className="bg-white border-b border-slate-200 sticky top-0 z-10 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Main nav items */}
          <div className="flex items-center space-x-8">
            <Link to="/dashboard" className="flex items-center" onClick={() => setIsOpen(false)}>
              <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-violet-600">
                ReimburseFlow
              </span>
            </Link>
            
            <div className="hidden md:flex space-x-4">
              <Link to="/dashboard" className={navLinkClass('/dashboard')}>Dashboard</Link>
              <Link to="/expenses/new" className={navLinkClass('/expenses/new')}>Submit Expense</Link>
              <Link to="/expenses" className={navLinkClass('/expenses')}>History</Link>
              
              {(isManager || isAdmin) && (
                <Link to="/approvals" className={navLinkClass('/approvals')}>Approvals</Link>
              )}
              
              {isAdmin && (
                <>
                  <Link to="/admin/users" className={navLinkClass('/admin/users')}>Users</Link>
                  <Link to="/admin/rules" className={navLinkClass('/admin/rules')}>Rules</Link>
                </>
              )}
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            <div className="hidden md:flex items-center space-x-4">
              <div className="flex items-center space-x-2 bg-slate-50 px-3 py-1.5 rounded-full border border-slate-100">
                <div className="bg-indigo-100 p-1 rounded-full">
                  <UserIcon size={16} className="text-indigo-700" />
                </div>
                <span className="text-sm font-medium text-slate-700">{user?.name || user?.email || 'User'}</span>
                <span className="px-2 py-0.5 text-xs font-semibold bg-violet-100 text-violet-700 rounded-full">
                  {user?.role || 'Guest'}
                </span>
              </div>
              
              <button 
                onClick={handleLogout}
                className="p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors flex items-center justify-center tooltip-trigger"
                title="Logout"
              >
                <LogOut size={20} />
              </button>
            </div>

            {/* Mobile menu button */}
            <div className="md:hidden flex items-center">
              <button
                onClick={() => setIsOpen(!isOpen)}
                className="p-2 text-slate-500 hover:text-slate-900 rounded-md focus:outline-none"
              >
                {isOpen ? <X size={24} /> : <Menu size={24} />}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      {isOpen && (
        <div className="md:hidden border-t border-slate-200 bg-white">
          <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3 shadow-lg">
            <Link to="/dashboard" onClick={() => setIsOpen(false)} className={mobileNavLinkClass('/dashboard')}>Dashboard</Link>
            <Link to="/expenses/new" onClick={() => setIsOpen(false)} className={mobileNavLinkClass('/expenses/new')}>Submit Expense</Link>
            <Link to="/expenses" onClick={() => setIsOpen(false)} className={mobileNavLinkClass('/expenses')}>History</Link>
            
            {(isManager || isAdmin) && (
              <Link to="/approvals" onClick={() => setIsOpen(false)} className={mobileNavLinkClass('/approvals')}>Approvals</Link>
            )}
            
            {isAdmin && (
              <>
                <Link to="/admin/users" onClick={() => setIsOpen(false)} className={mobileNavLinkClass('/admin/users')}>Users</Link>
                <Link to="/admin/rules" onClick={() => setIsOpen(false)} className={mobileNavLinkClass('/admin/rules')}>Rules</Link>
              </>
            )}
            
            <button
              onClick={handleLogout}
              className="w-full text-left block px-3 py-2 mt-2 border-t border-slate-100 rounded-md font-medium text-base text-red-600 hover:bg-red-50"
            >
              Logout
            </button>
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navbar;
