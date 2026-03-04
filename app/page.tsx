'use client';

import React, { useState, useEffect } from 'react';
import { Fuel, RefreshCw, Bell, X } from 'lucide-react';

export default function GasWizard() {
  const [gasPrice, setGasPrice] = useState<string>('...');
  const [ethPrice, setEthPrice] = useState<number>(0);
  const [ethPriceUSD, setEthPriceUSD] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [isCached, setIsCached] = useState(false);
  const [cacheAge, setCacheAge] = useState(0);
  const [currency, setCurrency] = useState<'IDR' | 'USD'>('IDR');
  
  // Alert states
  const [showAlertModal, setShowAlertModal] = useState(false);
  const [alertThreshold, setAlertThreshold] = useState<number>(15);
  const [alertEnabled, setAlertEnabled] = useState(false);
  const [telegramEnabled, setTelegramEnabled] = useState(false);
  const [lastAlertTime, setLastAlertTime] = useState<number>(0);

  // Load preferences
  useEffect(() => {
    const savedCurrency = localStorage.getItem('currency') as 'IDR' | 'USD' | null;
    if (savedCurrency) setCurrency(savedCurrency);
    
    const savedThreshold = localStorage.getItem('alertThreshold');
    const savedAlertEnabled = localStorage.getItem('alertEnabled');
    const savedTelegramEnabled = localStorage.getItem('telegramEnabled');
    
    if (savedThreshold) setAlertThreshold(parseFloat(savedThreshold));
    if (savedAlertEnabled) setAlertEnabled(savedAlertEnabled === 'true');
    if (savedTelegramEnabled) setTelegramEnabled(savedTelegramEnabled === 'true');
  }, []);

  // Save preferences
  useEffect(() => {
    localStorage.setItem('currency', currency);
  }, [currency]);

  useEffect(() => {
    localStorage.setItem('alertThreshold', alertThreshold.toString());
    localStorage.setItem('alertEnabled', alertEnabled.toString());
    localStorage.setItem('telegramEnabled', telegramEnabled.toString());
  }, [alertThreshold, alertEnabled, telegramEnabled]);

  const fetchEthPrice = async () => {
    try {
      const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=idr,usd');
      const data = await response.json();
      if (data.ethereum?.idr) setEthPrice(data.ethereum.idr);
      if (data.ethereum?.usd) setEthPriceUSD(data.ethereum.usd);
    } catch (e) { 
      console.error("API Price Error", e); 
    }
  };

  const fetchGas = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/gas');
      
      if (response.status === 429) {
        const data = await response.json();
        setGasPrice('Limit');
        setTimeout(fetchGas, (data.retryAfter || 60) * 1000);
        setLoading(false);
        return;
      }
      
      const data = await response.json();
      
      if (data.result) {
        const weiValue = parseInt(data.result, 16);
        const gweiValue = weiValue / 1e9;
        
        setGasPrice(gweiValue.toFixed(3));
        setIsCached(data.cached || false);
        setCacheAge(data.cacheAge || 0);
        
        checkAlert(gweiValue);
      } else {
        setGasPrice('Error');
      }
    } catch (e) { 
      console.error('Fetch error:', e);
      setGasPrice('Error'); 
    }
    setLoading(false);
  };

  const checkAlert = async (currentGwei: number) => {
    if (!alertEnabled && !telegramEnabled) return;
    
    const now = Date.now();
    if (now - lastAlertTime < 5 * 60 * 1000) return;
    
    if (currentGwei <= alertThreshold) {
      setLastAlertTime(now);
      
      // Browser notification
      if (alertEnabled && 'Notification' in window && Notification.permission === 'granted') {
        new Notification('🎉 Gas Alert!', {
          body: `Gas price dropped to ${currentGwei.toFixed(2)} Gwei!`,
          icon: '/favicon.ico',
          tag: 'gas-alert'
        });
      }
      
      // Telegram notification
      if (telegramEnabled) {
        try {
          await fetch('/api/telegram', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              gasPrice: currentGwei.toFixed(2),
              threshold: alertThreshold
            })
          });
          console.log('📱 Telegram notification sent!');
        } catch (error) {
          console.error('Failed to send Telegram notification:', error);
        }
      }
      
      console.log('🔔 ALERT: Gas is cheap!');
    }
  };

  const enableAlert = async () => {
    if ('Notification' in window) {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        setAlertEnabled(true);
        setShowAlertModal(false);
      } else {
        alert('Please enable notifications to use Gas Alert feature');
      }
    }
  };

  useEffect(() => {
    fetchGas();
    fetchEthPrice();
    const gasInterval = setInterval(fetchGas, 30000);
    const ethInterval = setInterval(fetchEthPrice, 60000);
    return () => { clearInterval(gasInterval); clearInterval(ethInterval); };
  }, []);

  const calculateCost = (gasUnits: number, multiplier: number = 1) => {
    const currentGas = parseFloat(gasPrice);
    const currentEthPrice = currency === 'IDR' ? ethPrice : ethPriceUSD;
    if (isNaN(currentGas) || currentGas === 0 || currentEthPrice === 0) return 0;
    const costInEth = (currentGas * multiplier * gasUnits) / 1e9;
    return costInEth * currentEthPrice;
  };

  const lowSpeedCost = calculateCost(21000, 0.9);
  const standardCost = calculateCost(21000, 1.0);
  const fastCost = calculateCost(21000, 1.3);

  const formatCurrency = (amount: number) => {
    if (currency === 'IDR') {
      return `Rp ${amount.toLocaleString('id-ID', { maximumFractionDigits: 0 })}`;
    } else {
      return `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-slate-950 text-slate-200">
      
      {/* Header */}
      <header className="flex flex-col sm:flex-row items-center justify-between px-4 sm:px-8 py-4 sm:py-6 border-b border-slate-800 backdrop-blur-md sticky top-0 z-10 gap-3">
        <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-start">
          <div className="flex items-center gap-3">
            <div className="bg-blue-600 p-2 rounded-lg shadow-lg shadow-blue-500/20">
              <Fuel className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-2xl font-black italic tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-white to-blue-400">
              GASWIZARD
            </h1>
          </div>
          
          <button 
            onClick={() => setShowAlertModal(true)}
            className="sm:hidden bg-white text-slate-950 px-4 py-2 rounded-full font-bold text-xs hover:scale-105 active:scale-95 transition-all shadow-lg flex items-center gap-2"
          >
            <Bell className="w-3 h-3" />
            {(alertEnabled || telegramEnabled) && <span className="w-2 h-2 bg-green-500 rounded-full"></span>}
          </button>
        </div>

        <div className="flex items-center gap-4 w-full sm:w-auto justify-center sm:justify-end">
          <div className="flex items-center gap-2 bg-slate-800/50 rounded-full p-1">
            <button
              onClick={() => setCurrency('IDR')}
              className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${
                currency === 'IDR' ? 'bg-blue-500 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              IDR
            </button>
            <button
              onClick={() => setCurrency('USD')}
              className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${
                currency === 'USD' ? 'bg-blue-500 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              USD
            </button>
          </div>

          <div className="text-center sm:text-right">
            <div className="text-[10px] text-slate-500 uppercase tracking-[0.2em]">Live ETH Price</div>
            <div className="text-sm font-bold text-blue-400">
              {currency === 'IDR' 
                ? (ethPrice > 0 ? `Rp ${ethPrice.toLocaleString('id-ID')}` : 'Loading...') 
                : (ethPriceUSD > 0 ? `$${ethPriceUSD.toLocaleString('en-US', { minimumFractionDigits: 2 })}` : 'Loading...')
              }
            </div>
          </div>

          <button 
            onClick={() => setShowAlertModal(true)}
            className="hidden sm:flex items-center gap-2 bg-white text-slate-950 px-5 py-2 rounded-full font-bold text-sm hover:scale-105 active:scale-95 transition-all shadow-lg"
          >
            <Bell className="w-4 h-4" />
            Set Gas Alert
            {(alertEnabled || telegramEnabled) && <span className="w-2 h-2 bg-green-500 rounded-full"></span>}
          </button>
        </div>
      </header>

      {/* Alert Modal - FIXED SCROLLABLE */}
      {showAlertModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 max-w-md w-full shadow-2xl my-8 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                <Bell className="w-6 h-6 text-blue-400" />
                Gas Alert
              </h2>
              <button 
                onClick={() => setShowAlertModal(false)}
                className="text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <p className="text-slate-400 mb-6">
              Get notified when gas price drops below your threshold
            </p>

            <div className="mb-6">
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Alert Threshold (Gwei)
              </label>
              <input
                type="number"
                value={alertThreshold}
                onChange={(e) => setAlertThreshold(parseFloat(e.target.value) || 0)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white text-lg font-bold focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="15"
                step="0.1"
                min="0"
              />
              <p className="text-xs text-slate-500 mt-2">
                Current gas: {gasPrice} Gwei
              </p>
            </div>

            {/* Quick Presets */}
            <div className="mb-6">
              <p className="text-sm text-slate-400 mb-2">Quick presets:</p>
              <div className="flex gap-2">
                {[10, 15, 20, 30].map((preset) => (
                  <button
                    key={preset}
                    onClick={() => setAlertThreshold(preset)}
                    className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                      alertThreshold === preset
                        ? 'bg-blue-500 text-white'
                        : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                    }`}
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </div>

            {/* Notification Methods */}
            <div className="mb-6 space-y-3">
              <p className="text-sm font-medium text-slate-300">Notification methods:</p>
              
              {/* Browser Notification */}
              <label className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg cursor-pointer hover:bg-slate-800 transition-colors">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">🔔</span>
                  <div>
                    <p className="text-sm font-medium text-white">Browser Notification</p>
                    <p className="text-xs text-slate-400">Desktop push notification</p>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={alertEnabled}
                  onChange={(e) => setAlertEnabled(e.target.checked)}
                  className="w-5 h-5 rounded accent-blue-500"
                />
              </label>

              {/* Telegram Notification */}
              <label className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg cursor-pointer hover:bg-slate-800 transition-colors">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">📱</span>
                  <div>
                    <p className="text-sm font-medium text-white">Telegram Bot</p>
                    <p className="text-xs text-slate-400">Message to your Telegram</p>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={telegramEnabled}
                  onChange={(e) => setTelegramEnabled(e.target.checked)}
                  className="w-5 h-5 rounded accent-blue-500"
                />
              </label>
            </div>

            {(alertEnabled || telegramEnabled) ? (
              <div className="space-y-3">
                <div className="flex items-center gap-3 p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
                  <span className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></span>
                  <span className="text-sm text-green-400 font-medium">
                    Alert is active
                    {alertEnabled && telegramEnabled && ' (Browser + Telegram)'}
                    {alertEnabled && !telegramEnabled && ' (Browser only)'}
                    {!alertEnabled && telegramEnabled && ' (Telegram only)'}
                  </span>
                </div>
                <button
                  onClick={() => {
                    setAlertEnabled(false);
                    setTelegramEnabled(false);
                  }}
                  className="w-full bg-red-500/10 border border-red-500/20 text-red-400 px-6 py-3 rounded-lg font-bold hover:bg-red-500/20 transition-all"
                >
                  Disable All Alerts
                </button>
              </div>
            ) : (
              <button
                onClick={enableAlert}
                className="w-full bg-blue-500 hover:bg-blue-600 text-white px-6 py-3 rounded-lg font-bold transition-all shadow-lg"
              >
                Enable Alerts
              </button>
            )}

            <p className="text-xs text-slate-500 mt-4 text-center">
              You'll be notified once every 5 minutes when gas drops below threshold
            </p>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="container mx-auto px-6 py-12 max-w-5xl">
        <div className="relative group mb-16">
          <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 to-cyan-500 rounded-[2.5rem] blur opacity-20 group-hover:opacity-40 transition duration-1000"></div>
          <div className="relative bg-slate-900/40 backdrop-blur-2xl rounded-[2rem] p-8 sm:p-12 border border-slate-800 shadow-2xl overflow-hidden">
            <div className="text-center relative z-10">
              <div className="text-[4rem] sm:text-[7rem] md:text-[10rem] font-black leading-none tracking-tighter text-white mb-2 drop-shadow-2xl">
                {gasPrice}
              </div>
              <div className="text-blue-400 text-sm tracking-[0.5em] uppercase font-medium mb-10">
                Gwei Standard
              </div>
              
              <div className="flex flex-col items-center gap-4">
                <button 
                  onClick={fetchGas}
                  disabled={loading}
                  className="bg-slate-800/80 hover:bg-slate-700 p-5 rounded-full border border-slate-700 transition-all disabled:opacity-50 hover:rotate-180 duration-500"
                >
                  <RefreshCw className={`w-6 h-6 text-white ${loading ? 'animate-spin' : ''}`} />
                </button>
                
                {isCached && (
                  <div className="px-4 py-1.5 bg-blue-500/10 border border-blue-500/20 rounded-full">
                    <span className="text-xs text-blue-400 font-medium tracking-wide">
                      📦 Data Cached ({cacheAge}s ago)
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Speed Options */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-slate-900/40 backdrop-blur-xl rounded-2xl p-8 border border-slate-800 hover:border-slate-700 transition-all">
            <div className="flex items-center justify-between mb-6">
              <span className="text-3xl">🐢</span>
              <span className="text-[10px] bg-slate-800 text-slate-400 px-2 py-1 rounded font-bold uppercase tracking-widest">Slow</span>
            </div>
            <div className="text-5xl font-bold text-white mb-2">
              {gasPrice !== '...' && gasPrice !== 'Error' && gasPrice !== 'Limit'
                ? (parseFloat(gasPrice) * 0.9).toFixed(3) 
                : '...'
              }
              <span className="text-sm text-slate-500 ml-2 font-normal italic">Gwei</span>
            </div>
            <div className="text-lg text-green-400 font-bold">
              {lowSpeedCost > 0 ? formatCurrency(lowSpeedCost) : formatCurrency(0)}
            </div>
          </div>

          <div className="bg-blue-600/10 backdrop-blur-xl rounded-2xl p-8 border border-blue-500/50 relative transform scale-105 shadow-xl shadow-blue-500/5">
            <div className="flex items-center justify-between mb-6">
              <span className="text-3xl">⚖️</span>
              <span className="text-[10px] bg-blue-500 text-white px-2 py-1 rounded font-bold uppercase tracking-widest">Market</span>
            </div>
            <div className="text-5xl font-bold text-blue-400 mb-2">
              {gasPrice}
              <span className="text-sm text-slate-500 ml-2 font-normal italic">Gwei</span>
            </div>
            <div className="text-lg text-blue-400 font-bold">
              {standardCost > 0 ? formatCurrency(standardCost) : formatCurrency(0)}
            </div>
          </div>

          <div className="bg-slate-900/40 backdrop-blur-xl rounded-2xl p-8 border border-slate-800 hover:border-slate-700 transition-all">
            <div className="flex items-center justify-between mb-6">
              <span className="text-3xl">🚀</span>
              <span className="text-[10px] bg-slate-800 text-slate-400 px-2 py-1 rounded font-bold uppercase tracking-widest">Instant</span>
            </div>
            <div className="text-5xl font-bold text-orange-400 mb-2">
              {gasPrice !== '...' && gasPrice !== 'Error' && gasPrice !== 'Limit'
                ? (parseFloat(gasPrice) * 1.3).toFixed(3) 
                : '...'
              }
              <span className="text-sm text-slate-500 ml-2 font-normal italic">Gwei</span>
            </div>
            <div className="text-lg text-orange-400 font-bold">
              {fastCost > 0 ? formatCurrency(fastCost) : formatCurrency(0)}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}