import React from 'react';
import { Link } from 'react-router-dom';
import { FileQuestion } from 'lucide-react';

const NotFound = () => {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="mx-auto w-24 h-24 bg-indigo-50 rounded-full flex items-center justify-center mb-6">
        <FileQuestion size={48} className="text-indigo-400" />
      </div>
      <h1 className="text-4xl font-bold text-slate-900 mb-4">Page Not Found</h1>
      <p className="text-lg text-slate-500 mb-8 max-w-md">
        The page you are looking for doesn't exist or has been moved.
      </p>
      <Link to="/dashboard" className="btn-primary px-6 py-3 text-base">
        Go to Dashboard
      </Link>
    </div>
  );
};

export default NotFound;
