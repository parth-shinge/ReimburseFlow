import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import {
  Camera,
  Upload,
  Loader2,
  CheckCircle,
  DollarSign,
  ArrowRightLeft,
  Calendar,
  FileText,
  Tag,
  Send,
  AlertCircle,
  Sparkles,
  X,
} from 'lucide-react';

const CATEGORIES = ['TRAVEL', 'FOOD', 'ACCOMMODATION', 'EQUIPMENT', 'OTHER'];

const SubmitExpense = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const fileInputRef = useRef(null);
  const dropZoneRef = useRef(null);

  const companyCurrency = user?.company?.currency || null;

  // Form state
  const [form, setForm] = useState({
    amount: '',
    currency: '',
    category: 'TRAVEL',
    description: '',
    date: '',
    receipt: null,
  });

  // UI state
  const [currencies, setCurrencies] = useState([]);
  const [currencyLoading, setCurrencyLoading] = useState(true);
  const [currencyError, setCurrencyError] = useState(null);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrDone, setOcrDone] = useState(false);
  const [receiptPreview, setReceiptPreview] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [convertedAmount, setConvertedAmount] = useState(null);
  const [convertLoading, setConvertLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});

  // ── Fetch currencies from /api/countries/ ──
  useEffect(() => {
    const fetchCurrencies = async () => {
      setCurrencyLoading(true);
      setCurrencyError(null);
      try {
        const res = await api.get('/countries/');
        const data = res.data || [];
        // Extract unique currency codes from { currencies: [{code, name}] } backend format
        const codeSet = new Set();
        data.forEach((country) => {
          const currArr = country.currencies || [];
          if (Array.isArray(currArr)) {
            currArr.forEach((c) => {
              if (c.code && c.code.length === 3) codeSet.add(c.code);
            });
          } else if (typeof currArr === 'object') {
            Object.keys(currArr).forEach((code) => {
              if (code && code.length === 3) codeSet.add(code);
            });
          }
        });
        const sorted = [...codeSet].sort();
        setCurrencies(sorted);
        // Default to company currency if available
        if (companyCurrency && sorted.includes(companyCurrency)) {
          setForm((f) => ({ ...f, currency: companyCurrency }));
        } else if (sorted.length > 0) {
          setForm((f) => ({ ...f, currency: sorted[0] }));
        }
      } catch (err) {
        setCurrencyError('Failed to load currencies. Please reload.');
        toast.error('Failed to load currencies');
      } finally {
        setCurrencyLoading(false);
      }
    };
    fetchCurrencies();
  }, [companyCurrency]);

  // ── Live currency conversion with debounce ──
  const fetchConversion = useCallback(async () => {
    if (
      !form.amount ||
      !form.currency ||
      !companyCurrency ||
      form.currency === companyCurrency ||
      parseFloat(form.amount) <= 0
    ) {
      setConvertedAmount(null);
      return;
    }
    setConvertLoading(true);
    try {
      const res = await api.get('/currency/convert/', {
        params: {
          from_currency: form.currency,
          to_currency: companyCurrency,
          amount: form.amount,
        },
      });
      setConvertedAmount(res.data.converted_amount);
    } catch {
      setConvertedAmount(null);
    } finally {
      setConvertLoading(false);
    }
  }, [form.amount, form.currency, companyCurrency]);

  useEffect(() => {
    const timer = setTimeout(fetchConversion, 500);
    return () => clearTimeout(timer);
  }, [fetchConversion]);

  // ── Form change handler ──
  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
    // Clear field error on edit
    setFieldErrors((prev) => ({ ...prev, [name]: undefined }));
  };

  // ── OCR file handling ──
  const processOcrFile = async (file) => {
    if (!file || !file.type.startsWith('image/')) {
      toast.error('Please upload an image file');
      return;
    }

    setReceiptPreview(URL.createObjectURL(file));
    setForm((f) => ({ ...f, receipt: file }));
    setOcrLoading(true);
    setOcrDone(false);

    const formData = new FormData();
    formData.append('receipt', file);

    try {
      const res = await api.post('/ocr/scan/', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const parsed = res.data.parsed || {};

      setForm((f) => ({
        ...f,
        amount: parsed.amount || f.amount,
        date: parsed.date || f.date,
        description: parsed.merchant || f.description,
        category: CATEGORIES.includes(parsed.description) ? parsed.description : f.category,
        receipt: file,
      }));

      setOcrDone(true);
      toast.success('Receipt scanned — fields auto-filled!');
    } catch (err) {
      toast.error(err?.response?.data?.error || 'OCR scan failed. Enter details manually.');
    } finally {
      setOcrLoading(false);
    }
  };

  const handleOcrFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (file) processOcrFile(file);
  };

  // ── Drag and drop ──
  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processOcrFile(file);
  };

  // ── Submit ──
  const handleSubmit = async (e) => {
    e.preventDefault();
    setFieldErrors({});
    setSubmitting(true);

    try {
      const payload = new FormData();
      payload.append('amount', form.amount);
      payload.append('currency', form.currency);
      payload.append('category', form.category);
      payload.append('description', form.description);
      payload.append('date', form.date);
      if (form.receipt) payload.append('receipt', form.receipt);

      await api.post('/expenses/', payload, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      toast.success('Expense submitted!');
      navigate('/expenses');
    } catch (err) {
      const data = err?.response?.data;
      if (data && typeof data === 'object') {
        // Extract field-level errors
        const errors = {};
        Object.entries(data).forEach(([key, val]) => {
          errors[key] = Array.isArray(val) ? val[0] : val;
        });
        setFieldErrors(errors);
        toast.error('Please fix the errors below');
      } else {
        toast.error('Failed to submit expense');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const today = new Date().toISOString().split('T')[0];

  const formatNumber = (num) => {
    return parseFloat(num).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Submit Expense</h1>
        <p className="text-sm text-slate-500 mt-1">
          Scan a receipt or fill in the details manually
        </p>
      </div>

      {/* ── OCR Section ── */}
      <div className="card bg-gradient-to-br from-indigo-50 to-violet-50 border-indigo-200">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-indigo-100 rounded-lg">
            <Sparkles size={20} className="text-indigo-600" />
          </div>
          <div>
            <h2 className="font-semibold text-slate-800">Smart Receipt Scanner</h2>
            <p className="text-xs text-slate-500">AI-powered OCR auto-fills your expense form</p>
          </div>
        </div>

        {ocrLoading ? (
          <div className="flex items-center justify-center gap-3 py-8 border-2 border-dashed border-indigo-300 rounded-lg bg-white/60">
            <Loader2 size={24} className="animate-spin text-indigo-500" />
            <span className="text-sm font-medium text-indigo-600">Scanning receipt...</span>
          </div>
        ) : ocrDone && receiptPreview ? (
          <div className="flex items-center gap-4 p-4 border-2 border-dashed border-emerald-300 rounded-lg bg-white/60">
            <img
              src={receiptPreview}
              alt="Scanned receipt"
              className="h-16 w-16 rounded-lg object-cover border border-slate-200"
            />
            <div className="flex-1">
              <p className="text-sm font-medium text-emerald-700 flex items-center gap-1.5">
                <CheckCircle size={16} />
                Receipt scanned — fields auto-filled
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setReceiptPreview(null);
                setForm((f) => ({ ...f, receipt: null }));
                setOcrDone(false);
              }}
              className="p-1.5 hover:bg-slate-100 rounded-lg"
            >
              <X size={16} className="text-slate-400" />
            </button>
          </div>
        ) : (
          <div
            ref={dropZoneRef}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`flex flex-col items-center justify-center gap-2 py-8 border-2 border-dashed rounded-lg cursor-pointer transition-all ${
              isDragging
                ? 'border-indigo-500 bg-indigo-50'
                : 'border-slate-300 bg-white/60 hover:border-indigo-400 hover:bg-white/80'
            }`}
          >
            <Camera size={28} className={isDragging ? 'text-indigo-500' : 'text-slate-400'} />
            <p className="text-sm text-slate-500">
              <span className="font-medium text-indigo-600">Drag & drop receipt</span> or click to scan
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleOcrFileSelect}
            />
          </div>
        )}
      </div>

      {/* ── Expense Form ── */}
      <form onSubmit={handleSubmit} className="card space-y-5">
        {/* Amount + Currency */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              <DollarSign size={14} className="inline mr-1" />
              Amount *
            </label>
            <input
              type="number"
              name="amount"
              value={form.amount}
              onChange={handleChange}
              placeholder="0.00"
              step="0.01"
              min="0.01"
              className={`input-field ${fieldErrors.amount ? 'border-red-400 focus:ring-red-500' : ''}`}
              required
            />
            {fieldErrors.amount && (
              <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                <AlertCircle size={12} /> {fieldErrors.amount}
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              <ArrowRightLeft size={14} className="inline mr-1" />
              Currency *
            </label>
            {currencyLoading ? (
              <div className="input-field flex items-center gap-2 text-slate-400">
                <Loader2 size={14} className="animate-spin" /> Loading currencies...
              </div>
            ) : currencyError ? (
              <div className="input-field text-red-500 text-sm">{currencyError}</div>
            ) : (
              <select
                name="currency"
                value={form.currency}
                onChange={handleChange}
                className={`input-field ${fieldErrors.currency ? 'border-red-400 focus:ring-red-500' : ''}`}
                required
              >
                <option value="" disabled>Select currency</option>
                {currencies.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            )}
            {fieldErrors.currency && (
              <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                <AlertCircle size={12} /> {fieldErrors.currency}
              </p>
            )}
          </div>
        </div>

        {/* Live conversion preview */}
        {form.amount && form.currency && companyCurrency && form.currency !== companyCurrency && (
          <div className="flex items-center gap-2 px-4 py-2.5 bg-violet-50 border border-violet-200 rounded-lg text-sm">
            <ArrowRightLeft size={16} className="text-violet-500 flex-shrink-0" />
            {convertLoading ? (
              <span className="text-violet-600 flex items-center gap-1.5">
                <Loader2 size={14} className="animate-spin" /> Converting...
              </span>
            ) : convertedAmount != null ? (
              <span className="text-violet-700">
                ≈ <span className="font-bold text-violet-900">{formatNumber(convertedAmount)} {companyCurrency}</span>
              </span>
            ) : (
              <span className="text-violet-400">Conversion unavailable</span>
            )}
          </div>
        )}

        {/* Category */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">
            <Tag size={14} className="inline mr-1" />
            Category *
          </label>
          <select
            name="category"
            value={form.category}
            onChange={handleChange}
            className={`input-field ${fieldErrors.category ? 'border-red-400 focus:ring-red-500' : ''}`}
            required
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>{c.charAt(0) + c.slice(1).toLowerCase()}</option>
            ))}
          </select>
          {fieldErrors.category && (
            <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
              <AlertCircle size={12} /> {fieldErrors.category}
            </p>
          )}
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">
            <FileText size={14} className="inline mr-1" />
            Description *
          </label>
          <textarea
            name="description"
            value={form.description}
            onChange={handleChange}
            rows={3}
            minLength={10}
            placeholder="What was this expense for? (min 10 characters)"
            className={`input-field resize-none ${fieldErrors.description ? 'border-red-400 focus:ring-red-500' : ''}`}
            required
          />
          {fieldErrors.description && (
            <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
              <AlertCircle size={12} /> {fieldErrors.description}
            </p>
          )}
        </div>

        {/* Date */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">
            <Calendar size={14} className="inline mr-1" />
            Date *
          </label>
          <input
            type="date"
            name="date"
            value={form.date}
            onChange={handleChange}
            max={today}
            className={`input-field ${fieldErrors.date ? 'border-red-400 focus:ring-red-500' : ''}`}
            required
          />
          {fieldErrors.date && (
            <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
              <AlertCircle size={12} /> {fieldErrors.date}
            </p>
          )}
        </div>

        {/* Manual receipt upload (if no OCR was done) */}
        {!receiptPreview && (
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              <Upload size={14} className="inline mr-1" />
              Attach Receipt (optional)
            </label>
            <label className="flex items-center justify-center gap-2 py-5 border-2 border-dashed border-slate-300 rounded-lg cursor-pointer hover:bg-slate-50 hover:border-indigo-400 transition-colors text-sm text-slate-500">
              <Upload size={18} />
              Click to upload receipt image
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    setReceiptPreview(URL.createObjectURL(file));
                    setForm((f) => ({ ...f, receipt: file }));
                  }
                }}
              />
            </label>
          </div>
        )}

        {/* Receipt preview (manual upload, not OCR) */}
        {receiptPreview && !ocrDone && (
          <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
            <img src={receiptPreview} alt="Receipt" className="h-14 w-14 rounded-lg object-cover border" />
            <div className="flex-1">
              <p className="text-sm font-medium text-slate-700">Receipt attached</p>
              <button
                type="button"
                className="text-xs text-red-500 hover:text-red-700 mt-0.5"
                onClick={() => {
                  setReceiptPreview(null);
                  setForm((f) => ({ ...f, receipt: null }));
                }}
              >
                Remove
              </button>
            </div>
          </div>
        )}

        {/* General errors */}
        {fieldErrors.detail && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex items-center gap-2">
            <AlertCircle size={16} /> {fieldErrors.detail}
          </div>
        )}
        {fieldErrors.non_field_errors && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex items-center gap-2">
            <AlertCircle size={16} /> {fieldErrors.non_field_errors}
          </div>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={submitting || currencyLoading}
          className="w-full btn-primary flex items-center justify-center gap-2 py-3 text-base disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting ? (
            <><Loader2 size={20} className="animate-spin" /> Submitting...</>
          ) : (
            <><Send size={20} /> Submit Expense</>
          )}
        </button>
      </form>
    </div>
  );
};

export default SubmitExpense;
