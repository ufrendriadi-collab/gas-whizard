'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Fuel, RefreshCw, Bell, X, Zap, Activity, Sun, Moon } from 'lucide-react';

export default function GasWizard() {
  const [gasPrice, setGasPrice] = useState<string>('...');
  const [ethPrice, setEthPrice] = useState<number>(0);
  const [ethPriceUSD, setEthPriceUSD] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [isCached, setIsCached] = useState(false);
  const [cacheAge, setCacheAge] = useState(0);
  const [currency, setCurrency] = useState<'IDR' | 'USD'>('IDR');
  const [pulse, setPulse] = useState(false);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  const [showAlertModal, setShowAlertModal] = useState(false);
  const [alertThreshold, setAlertThreshold] = useState<number>(15);
  const [alertEnabled, setAlertEnabled] = useState(false);
  const [telegramEnabled, setTelegramEnabled] = useState(false);
  const [lastAlertTime, setLastAlertTime] = useState<number>(0);
  const [notifStatus, setNotifStatus] = useState<'idle' | 'denied'>('idle');

  const alertEnabledRef = useRef(alertEnabled);
  const telegramEnabledRef = useRef(telegramEnabled);
  const alertThresholdRef = useRef(alertThreshold);
  const lastAlertTimeRef = useRef(lastAlertTime);

  useEffect(() => { alertEnabledRef.current = alertEnabled; }, [alertEnabled]);
  useEffect(() => { telegramEnabledRef.current = telegramEnabled; }, [telegramEnabled]);
  useEffect(() => { alertThresholdRef.current = alertThreshold; }, [alertThreshold]);
  useEffect(() => { lastAlertTimeRef.current = lastAlertTime; }, [lastAlertTime]);

  useEffect(() => {
    const savedCurrency = localStorage.getItem('currency') as 'IDR' | 'USD' | null;
    if (savedCurrency) setCurrency(savedCurrency);
    const savedTheme = localStorage.getItem('theme') as 'dark' | 'light' | null;
    if (savedTheme) setTheme(savedTheme);
    const savedThreshold = localStorage.getItem('alertThreshold');
    const savedAlertEnabled = localStorage.getItem('alertEnabled');
    const savedTelegramEnabled = localStorage.getItem('telegramEnabled');
    if (savedThreshold) setAlertThreshold(parseFloat(savedThreshold));
    if (savedAlertEnabled) setAlertEnabled(savedAlertEnabled === 'true');
    if (savedTelegramEnabled) setTelegramEnabled(savedTelegramEnabled === 'true');
    if (typeof Notification !== 'undefined' && Notification.permission === 'denied') {
      setNotifStatus('denied');
    }
  }, []);

  useEffect(() => { localStorage.setItem('currency', currency); }, [currency]);
  useEffect(() => { localStorage.setItem('theme', theme); }, [theme]);
  useEffect(() => {
    localStorage.setItem('alertThreshold', alertThreshold.toString());
    localStorage.setItem('alertEnabled', alertEnabled.toString());
    localStorage.setItem('telegramEnabled', telegramEnabled.toString());
  }, [alertThreshold, alertEnabled, telegramEnabled]);

  const fetchEthPrice = async () => {
    try {
      const res = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=idr,usd');
      const data = await res.json();
      if (data.ethereum?.idr) setEthPrice(data.ethereum.idr);
      if (data.ethereum?.usd) setEthPriceUSD(data.ethereum.usd);
    } catch (e) { console.error('Price error', e); }
  };

  const checkAlert = useCallback(async (currentGwei: number) => {
    const isAlertOn = alertEnabledRef.current;
    const isTelegramOn = telegramEnabledRef.current;
    const threshold = alertThresholdRef.current;
    const lastTime = lastAlertTimeRef.current;
    if (!isAlertOn && !isTelegramOn) return;
    const now = Date.now();
    if (now - lastTime < 5 * 60 * 1000) return;
    if (currentGwei <= threshold) {
      setLastAlertTime(now);
      lastAlertTimeRef.current = now;
      if (isAlertOn && typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        new Notification('⚡ GasWizard Alert', {
          body: `Gas dropped to ${currentGwei.toFixed(2)} Gwei! Below your ${threshold} Gwei threshold.`,
          icon: '/favicon.ico',
          tag: 'gas-alert',
        });
      }
      if (isTelegramOn) {
        try {
          await fetch('/api/telegram', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ gasPrice: currentGwei.toFixed(2), threshold }),
          });
        } catch (err) { console.error('Telegram error', err); }
      }
    }
  }, []);

  const fetchGas = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/gas');
      if (res.status === 429) {
        const data = await res.json();
        setGasPrice('Limit');
        setTimeout(fetchGas, (data.retryAfter || 60) * 1000);
        setLoading(false);
        return;
      }
      const data = await res.json();
      if (data.result) {
        const gwei = parseInt(data.result, 16) / 1e9;
        setGasPrice(gwei.toFixed(3));
        setIsCached(data.cached || false);
        setCacheAge(data.cacheAge || 0);
        setPulse(true);
        setTimeout(() => setPulse(false), 600);
        checkAlert(gwei);
      } else {
        setGasPrice('Error');
      }
    } catch (e) {
      console.error('Fetch error', e);
      setGasPrice('Error');
    }
    setLoading(false);
  }, [checkAlert]);

  const enableAlert = async () => {
    if (typeof Notification === 'undefined') { alert('Not supported.'); return; }
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      setAlertEnabled(true);
      setNotifStatus('idle');
    } else {
      setNotifStatus('denied');
      alert('Notifications blocked. Please enable them in browser settings.');
    }
  };

  useEffect(() => {
    fetchGas();
    fetchEthPrice();
    const g = setInterval(fetchGas, 30000);
    const e = setInterval(fetchEthPrice, 60000);
    return () => { clearInterval(g); clearInterval(e); };
  }, [fetchGas]);

  const calculateCost = (gasUnits: number, multiplier: number = 1) => {
    const g = parseFloat(gasPrice);
    const p = currency === 'IDR' ? ethPrice : ethPriceUSD;
    if (isNaN(g) || g === 0 || p === 0) return 0;
    return (g * multiplier * gasUnits / 1e9) * p;
  };

  const formatCurrency = (amount: number) => {
    if (currency === 'IDR') return `Rp ${amount.toLocaleString('id-ID', { maximumFractionDigits: 0 })}`;
    return `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 6 })}`;
  };

  const getGasStatus = () => {
    const v = parseFloat(gasPrice);
    if (isNaN(v)) return { label: 'Unknown', color: 'text-slate-400', dot: 'bg-slate-400' };
    if (v < 10) return { label: 'Very Low', color: 'text-emerald-500', dot: 'bg-emerald-400' };
    if (v < 20) return { label: 'Low', color: 'text-green-500', dot: 'bg-green-400' };
    if (v < 40) return { label: 'Normal', color: 'text-blue-500', dot: 'bg-blue-400' };
    if (v < 80) return { label: 'High', color: 'text-amber-500', dot: 'bg-amber-400' };
    return { label: 'Very High', color: 'text-red-500', dot: 'bg-red-400' };
  };

  const status = getGasStatus();
  const alertActive = alertEnabled || telegramEnabled;
  const isDark = theme === 'dark';

  const t = {
    bg:           isDark ? '#080b14'                      : '#f0f4ff',
    surface:      isDark ? 'rgba(255,255,255,0.03)'       : 'rgba(255,255,255,0.9)',
    border:       isDark ? 'rgba(255,255,255,0.08)'       : 'rgba(0,0,0,0.08)',
    borderAccent: isDark ? 'rgba(59,130,246,0.35)'        : 'rgba(59,130,246,0.45)',
    text:         isDark ? '#e2e8f0'                      : '#0f172a',
    textMuted:    isDark ? '#64748b'                      : '#64748b',
    textSubtle:   isDark ? '#334155'                      : '#94a3b8',
    modalBg:      isDark ? '#0d1117'                      : '#ffffff',
    gridColor:    isDark ? 'rgba(59,130,246,0.04)'        : 'rgba(59,130,246,0.07)',
    topGlow:      isDark
      ? 'radial-gradient(ellipse 60% 40% at 50% 0%, rgba(59,130,246,0.08) 0%, transparent 70%)'
      : 'radial-gradient(ellipse 60% 40% at 50% 0%, rgba(99,153,255,0.14) 0%, transparent 70%)',
    heroGlow:     isDark
      ? 'radial-gradient(ellipse 50% 60% at 50% 100%, rgba(59,130,246,0.06) 0%, transparent 70%)'
      : 'radial-gradient(ellipse 50% 60% at 50% 100%, rgba(59,130,246,0.07) 0%, transparent 70%)',
    shadowGlow:   isDark
      ? '0 0 40px rgba(59,130,246,0.15), 0 0 80px rgba(59,130,246,0.05)'
      : '0 0 40px rgba(59,130,246,0.10), 0 4px 24px rgba(0,0,0,0.06)',
    shadowCard:   isDark ? '0 8px 32px rgba(0,0,0,0.4)' : '0 4px 20px rgba(0,0,0,0.07)',
    headerBg:     isDark ? 'rgba(8,11,20,0.85)'          : 'rgba(240,244,255,0.88)',
    inputBg:      isDark ? 'rgba(255,255,255,0.05)'      : 'rgba(0,0,0,0.04)',
    chipBg:       isDark ? 'rgba(255,255,255,0.05)'      : 'rgba(0,0,0,0.05)',
    gasColor:     isDark ? '#ffffff'                      : '#0f172a',
  };

  return (
    // FIX: overflow-x-hidden prevents horizontal scroll on mobile
    <div
      className="min-h-screen overflow-x-hidden transition-colors duration-300"
      style={{ background: t.bg, color: t.text, fontFamily: "'DM Sans', system-ui, sans-serif" }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;700&family=Syne:wght@700;800&display=swap');
        .gas-number { font-family: 'Syne', sans-serif; font-weight: 800; }
        .grid-bg {
          background-image:
            linear-gradient(${t.gridColor} 1px, transparent 1px),
            linear-gradient(90deg, ${t.gridColor} 1px, transparent 1px);
          background-size: 40px 40px;
        }
        .card-hover { transition: all 0.2s ease; }
        .card-hover:hover { transform: translateY(-3px); }
        @keyframes pulse-dot {
          0%, 100% { opacity: 0.6; transform: scale(0.9); }
          50% { opacity: 1; transform: scale(1.1); }
        }
        .pulse-dot { animation: pulse-dot 2s ease-in-out infinite; }
        @keyframes fade-in {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .fade-in { animation: fade-in 0.4s ease forwards; }
        @keyframes number-pop {
          0% { transform: scale(1); }
          50% { transform: scale(1.03); }
          100% { transform: scale(1); }
        }
        .number-pop { animation: number-pop 0.5s ease; }
        .theme-btn { transition: all 0.25s ease; }
        .theme-btn:hover { transform: rotate(15deg) scale(1.15); }
        .modal-backdrop { backdrop-filter: blur(8px); }
      `}</style>

      <div className="fixed inset-0 grid-bg pointer-events-none" />
      <div className="fixed inset-0 pointer-events-none" style={{ background: t.topGlow }} />

      {/* ── Header ── */}
      <header
        className="relative z-20 flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 sticky top-0"
        style={{ borderBottom: `1px solid ${t.border}`, background: t.headerBg, backdropFilter: 'blur(14px)' }}
      >
        {/* Logo */}
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <div className="relative flex-shrink-0">
            <div className="w-8 h-8 sm:w-9 sm:h-9 bg-blue-500 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/30">
              <Fuel className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
            </div>
            {alertActive && (
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-400 rounded-full border-2" style={{ borderColor: t.bg }} />
            )}
          </div>
          {/* FIX: truncate logo text on very small screens */}
          <div className="min-w-0">
            <span className="gas-number text-base sm:text-lg tracking-tight truncate" style={{ color: t.text }}>GasWizard</span>
            <span className="ml-1.5 text-[9px] sm:text-[10px] text-blue-400 bg-blue-400/10 px-1.5 py-0.5 rounded-full font-semibold uppercase tracking-wider">ETH</span>
          </div>
        </div>

        {/* Controls — FIX: tighter gap, smaller buttons on mobile */}
        <div className="flex items-center gap-1.5 sm:gap-3 flex-shrink-0">
          {/* ETH Price - desktop only */}
          <div className="hidden md:flex flex-col items-end mr-1">
            <span className="text-[10px] uppercase tracking-widest font-semibold" style={{ color: t.textMuted }}>ETH</span>
            <span className="text-sm font-bold" style={{ color: t.text }}>
              {currency === 'IDR'
                ? (ethPrice > 0 ? `Rp ${ethPrice.toLocaleString('id-ID')}` : '—')
                : (ethPriceUSD > 0 ? `$${ethPriceUSD.toLocaleString('en-US', { minimumFractionDigits: 2 })}` : '—')}
            </span>
          </div>

          {/* Currency toggle */}
          <div className="flex items-center rounded-full p-0.5 sm:p-1 gap-0.5"
            style={{ background: t.chipBg, border: `1px solid ${t.border}` }}>
            {(['IDR', 'USD'] as const).map(c => (
              <button key={c} onClick={() => setCurrency(c)}
                className="px-2 sm:px-2.5 py-1 rounded-full text-[10px] sm:text-xs font-bold transition-all"
                style={{ background: currency === c ? '#3b82f6' : 'transparent', color: currency === c ? '#fff' : t.textMuted }}>
                {c}
              </button>
            ))}
          </div>

          {/* Theme toggle */}
          <button
            onClick={() => setTheme(isDark ? 'light' : 'dark')}
            className="theme-btn w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center rounded-full flex-shrink-0"
            style={{ background: t.chipBg, border: `1px solid ${t.border}` }}
          >
            {isDark ? <Sun className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-amber-400" /> : <Moon className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-slate-500" />}
          </button>

          {/* Alert button — icon only on mobile */}
          <button
            onClick={() => setShowAlertModal(true)}
            className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-full text-xs font-semibold transition-all flex-shrink-0"
            style={{
              background: alertActive ? 'rgba(52,211,153,0.1)' : t.chipBg,
              border: `1px solid ${alertActive ? 'rgba(52,211,153,0.3)' : t.border}`,
              color: alertActive ? '#34d399' : t.textMuted,
            }}
          >
            <Bell className="w-3 h-3 sm:w-3.5 sm:h-3.5 flex-shrink-0" />
            <span className="hidden sm:inline whitespace-nowrap">{alertActive ? 'Alert On' : 'Set Alert'}</span>
            {alertActive && <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-emerald-400 rounded-full animate-pulse flex-shrink-0" />}
          </button>
        </div>
      </header>

      {/* ── Main ── */}
      {/* FIX: px-4 on mobile instead of px-6 */}
      <main className="relative z-10 container mx-auto px-4 sm:px-6 py-6 sm:py-10 max-w-4xl">

        {/* Hero card */}
        <div className="fade-in mb-6 sm:mb-8">
          <div className="relative rounded-2xl sm:rounded-3xl overflow-hidden p-5 sm:p-12"
            style={{ background: t.surface, border: `1px solid ${t.border}`, boxShadow: t.shadowGlow }}>
            <div className="absolute inset-0 pointer-events-none" style={{ background: t.heroGlow }} />
            <div className="relative text-center">

              {/* Status badge */}
              <div className="inline-flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-full mb-4 sm:mb-6"
                style={{ background: t.chipBg, border: `1px solid ${t.border}` }}>
                <span className={`w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full pulse-dot ${status.dot}`} />
                <span className={`text-[10px] sm:text-xs font-semibold uppercase tracking-widest ${status.color}`}>{status.label} Gas</span>
                <Activity className="w-2.5 h-2.5 sm:w-3 sm:h-3" style={{ color: t.textMuted }} />
              </div>

              {/* Gas number — FIX: clamp keeps it from overflowing on any screen */}
              <div
                className={`gas-number leading-none mb-2 transition-colors duration-300 ${pulse ? 'number-pop' : ''}`}
                style={{
                  color: t.gasColor,
                  fontSize: 'clamp(2.5rem, 15vw, 8rem)',
                  wordBreak: 'break-all',
                }}
              >
                {gasPrice}
              </div>
              <div className="text-xs sm:text-sm tracking-[0.3em] sm:tracking-[0.4em] uppercase mb-6 sm:mb-8" style={{ color: t.textMuted }}>Gwei</div>

              {/* Refresh row */}
              <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3">
                <button onClick={fetchGas} disabled={loading}
                  className="flex items-center gap-2 px-4 sm:px-5 py-2 sm:py-2.5 rounded-full text-xs sm:text-sm font-medium transition-all disabled:opacity-40"
                  style={{ background: t.chipBg, border: `1px solid ${t.border}`, color: t.textMuted }}>
                  <RefreshCw className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${loading ? 'animate-spin' : ''}`} />
                  Refresh
                </button>
                {isCached && (
                  <div className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 sm:py-2.5 rounded-full"
                    style={{ background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)' }}>
                    <span className="w-1.5 h-1.5 bg-blue-400 rounded-full" />
                    <span className="text-[10px] sm:text-xs text-blue-400 font-medium whitespace-nowrap">Cached · {cacheAge}s ago</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Speed tiers — FIX: 3 cols on mobile too, smaller padding */}
        <div className="grid grid-cols-3 gap-2 sm:gap-4 mb-4 sm:mb-6">

          {/* Slow */}
          <div className="card-hover rounded-xl sm:rounded-2xl p-3 sm:p-6 fade-in"
            style={{ background: t.surface, border: `1px solid ${t.border}`, boxShadow: t.shadowCard, animationDelay: '0.1s' }}>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-2 sm:mb-4 gap-1">
              <div className="flex items-center gap-1 sm:gap-2">
                <span className="text-base sm:text-xl">🐢</span>
                <span className="text-[9px] sm:text-xs font-bold uppercase tracking-wider" style={{ color: t.textMuted }}>Slow</span>
              </div>
              <span className="hidden sm:inline text-[10px] px-2 py-0.5 rounded-full font-medium" style={{ background: t.chipBg, color: t.textMuted }}>~5 min</span>
            </div>
            <div className="gas-number text-lg sm:text-3xl mb-0.5 sm:mb-1 truncate" style={{ color: t.text }}>
              {gasPrice !== '...' && gasPrice !== 'Error' && gasPrice !== 'Limit'
                ? (parseFloat(gasPrice) * 0.9).toFixed(2) : '—'}
            </div>
            <div className="text-[9px] sm:text-xs mb-1 sm:mb-3" style={{ color: t.textMuted }}>Gwei</div>
            <div className="text-[10px] sm:text-sm font-bold text-emerald-500 truncate">
              {calculateCost(21000, 0.9) > 0 ? formatCurrency(calculateCost(21000, 0.9)) : '—'}
            </div>
          </div>

          {/* Market */}
          <div className="card-hover relative rounded-xl sm:rounded-2xl p-3 sm:p-6 fade-in"
            style={{
              background: isDark ? 'rgba(59,130,246,0.06)' : 'rgba(59,130,246,0.05)',
              border: `1px solid ${t.borderAccent}`,
              boxShadow: isDark ? '0 8px 32px rgba(59,130,246,0.12)' : '0 8px 32px rgba(59,130,246,0.08)',
              animationDelay: '0.15s',
            }}>
            <div className="hidden sm:block absolute top-3 right-3">
              <span className="text-[9px] bg-blue-500 text-white px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">Recommended</span>
            </div>
            <div className="flex items-center gap-1 sm:gap-2 mb-2 sm:mb-4">
              <span className="text-base sm:text-xl">⚖️</span>
              <span className="text-[9px] sm:text-xs font-bold uppercase tracking-wider text-blue-400">Market</span>
            </div>
            <div className="gas-number text-lg sm:text-3xl text-blue-400 mb-0.5 sm:mb-1 truncate">{gasPrice}</div>
            <div className="text-[9px] sm:text-xs mb-1 sm:mb-3" style={{ color: t.textMuted }}>Gwei</div>
            <div className="text-[10px] sm:text-sm font-bold text-blue-400 truncate">
              {calculateCost(21000, 1.0) > 0 ? formatCurrency(calculateCost(21000, 1.0)) : '—'}
            </div>
          </div>

          {/* Instant */}
          <div className="card-hover rounded-xl sm:rounded-2xl p-3 sm:p-6 fade-in"
            style={{ background: t.surface, border: `1px solid ${t.border}`, boxShadow: t.shadowCard, animationDelay: '0.2s' }}>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-2 sm:mb-4 gap-1">
              <div className="flex items-center gap-1 sm:gap-2">
                <span className="text-base sm:text-xl">⚡</span>
                <span className="text-[9px] sm:text-xs font-bold uppercase tracking-wider" style={{ color: t.textMuted }}>Instant</span>
              </div>
              <span className="hidden sm:inline text-[10px] px-2 py-0.5 rounded-full font-medium" style={{ background: t.chipBg, color: t.textMuted }}>~15s</span>
            </div>
            <div className="gas-number text-lg sm:text-3xl text-amber-400 mb-0.5 sm:mb-1 truncate">
              {gasPrice !== '...' && gasPrice !== 'Error' && gasPrice !== 'Limit'
                ? (parseFloat(gasPrice) * 1.3).toFixed(2) : '—'}
            </div>
            <div className="text-[9px] sm:text-xs mb-1 sm:mb-3" style={{ color: t.textMuted }}>Gwei</div>
            <div className="text-[10px] sm:text-sm font-bold text-amber-400 truncate">
              {calculateCost(21000, 1.3) > 0 ? formatCurrency(calculateCost(21000, 1.3)) : '—'}
            </div>
          </div>

        </div>

        {/* ETH price row on mobile */}
        <div className="flex md:hidden items-center justify-center gap-2 mb-4 text-xs" style={{ color: t.textMuted }}>
          <span>ETH:</span>
          <span className="font-bold" style={{ color: t.text }}>
            {currency === 'IDR'
              ? (ethPrice > 0 ? `Rp ${ethPrice.toLocaleString('id-ID')}` : '—')
              : (ethPriceUSD > 0 ? `$${ethPriceUSD.toLocaleString('en-US', { minimumFractionDigits: 2 })}` : '—')}
          </span>
        </div>

        <div className="text-center text-[10px] sm:text-xs" style={{ color: t.textSubtle }}>
          Prices for standard ETH transfer (21,000 gas units) · Auto-refresh every 30s
        </div>
      </main>

      {/* ── Alert Modal ── */}
      {showAlertModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 modal-backdrop"
          style={{ background: 'rgba(0,0,0,0.5)' }}>
          {/* FIX: on mobile, modal slides up from bottom like a sheet */}
          <div className="rounded-t-2xl sm:rounded-2xl p-5 sm:p-8 w-full sm:max-w-md shadow-2xl max-h-[90vh] overflow-y-auto fade-in"
            style={{ background: t.modalBg, border: `1px solid ${t.border}` }}>

            {/* Drag handle on mobile */}
            <div className="flex justify-center mb-4 sm:hidden">
              <div className="w-10 h-1 rounded-full" style={{ background: t.border }} />
            </div>

            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center"
                  style={{ background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)' }}>
                  <Bell className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-blue-400" />
                </div>
                <div>
                  <h2 className="text-base sm:text-lg font-bold" style={{ color: t.text }}>Gas Alert</h2>
                  <p className="text-xs" style={{ color: t.textMuted }}>Notify when gas drops below threshold</p>
                </div>
              </div>
              <button onClick={() => setShowAlertModal(false)}
                className="w-8 h-8 flex items-center justify-center rounded-full transition-all"
                style={{ background: t.chipBg, color: t.textMuted }}>
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="mb-4 sm:mb-5">
              <label className="block text-xs font-bold uppercase tracking-wider mb-2" style={{ color: t.textMuted }}>
                Threshold (Gwei)
              </label>
              <div className="relative">
                <input
                  type="number"
                  value={alertThreshold}
                  onChange={(e) => setAlertThreshold(parseFloat(e.target.value) || 0)}
                  className="w-full rounded-xl px-4 py-3 text-xl sm:text-2xl gas-number font-bold focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                  style={{ background: t.inputBg, border: `1px solid ${t.border}`, color: t.text }}
                  step="0.1" min="0"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm" style={{ color: t.textMuted }}>Gwei</span>
              </div>
              <p className="text-xs mt-2" style={{ color: t.textMuted }}>
                Current: <span className={`font-semibold ${status.color}`}>{gasPrice} Gwei</span>
              </p>
            </div>

            <div className="mb-4 sm:mb-5">
              <p className="text-xs uppercase tracking-wider font-bold mb-2" style={{ color: t.textMuted }}>Quick presets</p>
              <div className="flex gap-2">
                {[10, 15, 20, 30].map((preset) => (
                  <button key={preset} onClick={() => setAlertThreshold(preset)}
                    className="flex-1 py-2 rounded-lg text-sm font-bold transition-all"
                    style={{
                      background: alertThreshold === preset ? '#3b82f6' : t.chipBg,
                      border: `1px solid ${alertThreshold === preset ? '#3b82f6' : t.border}`,
                      color: alertThreshold === preset ? '#fff' : t.textMuted,
                    }}>
                    {preset}
                  </button>
                ))}
              </div>
            </div>

            <div className="mb-5 space-y-2">
              <p className="text-xs uppercase tracking-wider font-bold mb-3" style={{ color: t.textMuted }}>Notification methods</p>
              {[
                {
                  icon: '🔔', label: 'Browser Push',
                  desc: notifStatus === 'denied' ? '⚠️ Blocked in browser settings' : 'Desktop notification',
                  checked: alertEnabled,
                  onChange: (v: boolean) => v ? enableAlert() : setAlertEnabled(false),
                },
                {
                  icon: '📱', label: 'Telegram Bot',
                  desc: 'Message via Telegram',
                  checked: telegramEnabled,
                  onChange: (v: boolean) => setTelegramEnabled(v),
                },
              ].map((item) => (
                <label key={item.label}
                  className="flex items-center justify-between p-3 sm:p-4 rounded-xl cursor-pointer transition-all"
                  style={{ background: t.inputBg, border: `1px solid ${t.border}` }}>
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg flex items-center justify-center text-base sm:text-lg" style={{ background: t.chipBg }}>
                      {item.icon}
                    </div>
                    <div>
                      <p className="text-sm font-semibold" style={{ color: t.text }}>{item.label}</p>
                      <p className="text-xs" style={{ color: t.textMuted }}>{item.desc}</p>
                    </div>
                  </div>
                  <input type="checkbox" checked={item.checked}
                    onChange={(e) => item.onChange(e.target.checked)}
                    className="w-4 h-4 accent-blue-500" />
                </label>
              ))}
            </div>

            {alertActive ? (
              <div className="space-y-3">
                <div className="flex items-center gap-3 p-3 rounded-xl"
                  style={{ background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.2)' }}>
                  <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse flex-shrink-0" />
                  <span className="text-sm text-emerald-400 font-medium">
                    Alert active
                    {alertEnabled && telegramEnabled && ' · Browser + Telegram'}
                    {alertEnabled && !telegramEnabled && ' · Browser only'}
                    {!alertEnabled && telegramEnabled && ' · Telegram only'}
                  </span>
                </div>
                <button onClick={() => { setAlertEnabled(false); setTelegramEnabled(false); }}
                  className="w-full py-3 rounded-xl text-sm font-bold transition-all"
                  style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171' }}>
                  Disable All Alerts
                </button>
              </div>
            ) : (
              <button onClick={enableAlert}
                className="w-full py-3 rounded-xl bg-blue-500 hover:bg-blue-600 text-white text-sm font-bold transition-all shadow-lg shadow-blue-500/20">
                <Zap className="w-4 h-4 inline mr-2" />
                Enable Alerts
              </button>
            )}

            <p className="text-xs mt-4 text-center" style={{ color: t.textSubtle }}>
              Notified max once every 5 minutes when gas is below threshold
            </p>
          </div>
        </div>
      )}
    </div>
  );
}