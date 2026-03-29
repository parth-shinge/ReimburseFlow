import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { UserPlus, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../api';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASSWORD_REGEX = /\d/; // at least one number

const Signup = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    company_name: '',
    country: '',
    currency: '',
  });
  const [countries, setCountries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [touched, setTouched] = useState({});

  const { register, login } = useAuth();
  const navigate = useNavigate();

  // ── Fetch countries ──
  useEffect(() => {
    const fetchCountries = async () => {
      try {
        const res = await api.get('/countries/');
        const data = res.data || [];
        // restcountries shape: { name: { common }, currencies: { CODE: {...} } }
        const mapped = data.map((c) => {
          // Backend proxies restcountries and returns: { country, currencies: [{code, name}] }
          const countryName = c.country || c.name?.common || '';
          const currencyCode = c.currencies?.[0]?.code
            || (c.currencies && typeof c.currencies === 'object' && !Array.isArray(c.currencies)
              ? Object.keys(c.currencies)[0]
              : '')
            || '';
          return { name: countryName, currency: currencyCode };
        });
        // Sort and deduplicate by name
        const unique = mapped
          .filter((c) => c.name && c.currency)
          .sort((a, b) => a.name.localeCompare(b.name));
        setCountries(unique);
      } catch {
        setCountries([
          { name: 'United States', currency: 'USD' },
          { name: 'United Kingdom', currency: 'GBP' },
          { name: 'Ireland', currency: 'EUR' },
          { name: 'India', currency: 'INR' },
          { name: 'Australia', currency: 'AUD' },
        ]);
      }
    };
    fetchCountries();
  }, []);

  // ── Validation ──
  const errors = {};
  if (touched.name && formData.name.trim().length < 2) {
    errors.name = 'Name must be at least 2 characters';
  }
  if (touched.email && !EMAIL_REGEX.test(formData.email)) {
    errors.email = 'Please enter a valid email address';
  }
  if (touched.password && (formData.password.length < 8 || !PASSWORD_REGEX.test(formData.password))) {
    errors.password = 'Password must be at least 8 characters and contain a number';
  }
  if (touched.company_name && formData.company_name.trim().length < 2) {
    errors.company_name = 'Company name must be at least 2 characters';
  }
  if (touched.country && !formData.country) {
    errors.country = 'Please select a country';
  }

  const isFormEmpty =
    !formData.name.trim() ||
    !formData.email.trim() ||
    !formData.password.trim() ||
    !formData.company_name.trim() ||
    !formData.country;
  const hasErrors = Object.keys(errors).length > 0;

  const handleChange = (e) => {
    const { name, value } = e.target;

    if (name === 'country') {
      const selected = countries.find((c) => c.name === value);
      setFormData({
        ...formData,
        [name]: value,
        currency: selected ? selected.currency : formData.currency,
      });
    } else {
      setFormData({ ...formData, [name]: value });
    }
  };

  const handleBlur = (field) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Mark all as touched
    const allTouched = { name: true, email: true, password: true, company_name: true, country: true };
    setTouched(allTouched);

    // Re-validate with all touched
    if (
      formData.name.trim().length < 2 ||
      !EMAIL_REGEX.test(formData.email) ||
      formData.password.length < 8 ||
      !PASSWORD_REGEX.test(formData.password) ||
      formData.company_name.trim().length < 2 ||
      !formData.country
    ) {
      return;
    }

    setLoading(true);
    try {
      await register(formData);
      toast.success('Registration successful. Logging in...');
      await login(formData.email, formData.password);
      navigate('/dashboard');
    } catch (error) {
      const data = error.response?.data;
      if (data && typeof data === 'object') {
        const msgs = [];
        Object.entries(data).forEach(([key, val]) => {
          msgs.push(Array.isArray(val) ? val[0] : val);
        });
        toast.error(msgs[0] || 'Failed to register. Please try again.');
      } else {
        toast.error('Failed to register. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8 bg-white p-8 rounded-2xl shadow-xl shadow-slate-200/50 border border-slate-100">
        <div>
          <div className="mx-auto h-12 w-12 bg-indigo-100 rounded-full flex items-center justify-center">
            <UserPlus className="h-6 w-6 text-indigo-600" />
          </div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-slate-900">
            Create an account
          </h2>
          <p className="mt-2 text-center text-sm text-slate-600">
            Or{' '}
            <Link to="/login" className="font-medium text-indigo-600 hover:text-indigo-500 transition-colors">
              sign in to an existing account
            </Link>
          </p>
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="space-y-4">
            {/* Name */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Full Name</label>
              <input
                name="name"
                type="text"
                className={`input-field ${errors.name ? 'border-red-400 focus:ring-red-500' : ''}`}
                placeholder="Jane Doe"
                value={formData.name}
                onChange={handleChange}
                onBlur={() => handleBlur('name')}
              />
              {errors.name && (
                <p className="text-red-500 text-sm mt-1 flex items-center gap-1">
                  <AlertCircle size={14} /> {errors.name}
                </p>
              )}
            </div>

            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Email Address</label>
              <input
                name="email"
                type="email"
                className={`input-field ${errors.email ? 'border-red-400 focus:ring-red-500' : ''}`}
                placeholder="jane@company.com"
                value={formData.email}
                onChange={handleChange}
                onBlur={() => handleBlur('email')}
              />
              {errors.email && (
                <p className="text-red-500 text-sm mt-1 flex items-center gap-1">
                  <AlertCircle size={14} /> {errors.email}
                </p>
              )}
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
              <input
                name="password"
                type="password"
                className={`input-field ${errors.password ? 'border-red-400 focus:ring-red-500' : ''}`}
                placeholder="••••••••"
                value={formData.password}
                onChange={handleChange}
                onBlur={() => handleBlur('password')}
              />
              {errors.password && (
                <p className="text-red-500 text-sm mt-1 flex items-center gap-1">
                  <AlertCircle size={14} /> {errors.password}
                </p>
              )}
            </div>

            {/* Company Name */}
            <div className="pt-2 border-t border-slate-100">
              <label className="block text-sm font-medium text-slate-700 mb-1 mt-2">Company Name</label>
              <input
                name="company_name"
                type="text"
                className={`input-field ${errors.company_name ? 'border-red-400 focus:ring-red-500' : ''}`}
                placeholder="Acme Corp"
                value={formData.company_name}
                onChange={handleChange}
                onBlur={() => handleBlur('company_name')}
              />
              {errors.company_name && (
                <p className="text-red-500 text-sm mt-1 flex items-center gap-1">
                  <AlertCircle size={14} /> {errors.company_name}
                </p>
              )}
            </div>

            {/* Country + Currency */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Country</label>
                <select
                  name="country"
                  className={`input-field bg-white ${errors.country ? 'border-red-400 focus:ring-red-500' : ''}`}
                  value={formData.country}
                  onChange={handleChange}
                  onBlur={() => handleBlur('country')}
                >
                  <option value="" disabled>Select Country</option>
                  {countries.map((c, i) => (
                    <option key={i} value={c.name}>{c.name}</option>
                  ))}
                </select>
                {errors.country && (
                  <p className="text-red-500 text-sm mt-1 flex items-center gap-1">
                    <AlertCircle size={14} /> {errors.country}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Currency</label>
                <input
                  name="currency"
                  type="text"
                  readOnly
                  className="input-field bg-slate-50 text-slate-500 border-slate-200 cursor-not-allowed"
                  placeholder="Auto-filled"
                  value={formData.currency}
                />
              </div>
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={loading || isFormEmpty || hasErrors}
              className="w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-lg text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors disabled:opacity-70 disabled:cursor-not-allowed shadow-md shadow-indigo-600/20"
            >
              {loading ? 'Creating account...' : 'Create account'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Signup;
