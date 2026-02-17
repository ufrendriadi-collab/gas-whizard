'use client';

import React, { useState, useEffect } from 'react';
import { Fuel, RefreshCw } from 'lucide-react';

export default function GasWizard() {
  const [gasPrice, setGasPrice] = useState<string>('...');
  const [ethPrice, setEthPrice] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [isCached, setIsCached] = useState(false);
  const [cacheAge, setCacheAge] = useState(0);

  const fetchEthPrice = async () => {
    try {
      const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=idr');
      const data = await response.json();
      if (data.ethereum?.idr) setEthPrice(data.ethereum.idr);
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
      
      console.log('📊 API Response:', data);
      
      if (data.result) {
        const weiValue = parseInt(data.result, 16);
        const gweiValue = weiValue / 1e9;
        
        console.log('Wei:', weiValue);
        console.log('Gwei:', gweiValue);
        
        setGasPrice(gweiValue.toFixed(3));
        setIsCached(data.cached || false);
        setCacheAge(data.cacheAge || 0);
      } else {
        setGasPrice('Error');
      }
    } catch (e) { 
      console.error('Fetch error:', e);
      setGasPrice('Error'); 
    }
    setLoading(false);
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
    if (isNaN(currentGas) || currentGas === 0 || ethPrice === 0) return 0;
    const costInEth = (currentGas * multiplier * gasUnits) / 1e9;
    return costInEth * ethPrice;
  };

  const lowSpeedCost = calculateCost(21000, 0.9);
  const standardCost = calculateCost(21000, 1.0);
  const fastCost = calculateCost(21000, 1.3);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-slate-950 text-slate-200">
      
      {/* ✅ HEADER - 2 baris di mobile, 1 baris di desktop */}
      <header className="flex flex-col sm:flex-row items-center justify-between px-4 sm:px-8 py-4 sm:py-6 border-b border-slate-800 backdrop-blur-md sticky top-0 z-10 gap-3">
        {/* Logo */}
        <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-start">
          <div className="flex items-center gap-3">
            <div className="bg-blue-600 p-2 rounded-lg shadow-lg shadow-blue-500/20">
              <Fuel className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-2xl font-black italic tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-white to-blue-400">
              GASWIZARD
            </h1>
          </div>
          
          {/* Connect Wallet - tampil di samping logo saat mobile */}
          <button className="sm:hidden bg-white text-slate-950 px-4 py-2 rounded-full font-bold text-xs hover:scale-105 active:scale-95 transition-all shadow-lg">
            Connect Wallet
          </button>
        </div>

        {/* ETH Price + Connect Wallet - baris 2 di mobile, samping di desktop */}
        <div className="flex items-center gap-4 w-full sm:w-auto justify-center sm:justify-end">
          <div className="text-center sm:text-right">
            <div className="text-[10px] text-slate-500 uppercase tracking-[0.2em]">Live ETH Price</div>
            <div className="text-sm font-bold text-blue-400">
              Rp {ethPrice > 0 ? ethPrice.toLocaleString('id-ID') : 'Loading...'}
            </div>
          </div>
          {/* Connect Wallet - hanya tampil di desktop */}
          <button className="hidden sm:block bg-white text-slate-950 px-5 py-2 rounded-full font-bold text-sm hover:scale-105 active:scale-95 transition-all shadow-lg">
            Connect Wallet
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-6 py-12 max-w-5xl">
        {/* Card Utama */}
        <div className="relative group mb-16">
          <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 to-cyan-500 rounded-[2.5rem] blur opacity-20 group-hover:opacity-40 transition duration-1000"></div>
          <div className="relative bg-slate-900/40 backdrop-blur-2xl rounded-[2rem] p-8 sm:p-12 border border-slate-800 shadow-2xl overflow-hidden">
            <div className="text-center relative z-10">
              
              {/* ✅ ANGKA - responsive font size */}
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
          {/* Low Speed */}
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
              Rp {lowSpeedCost > 0 ? lowSpeedCost.toLocaleString('id-ID', { maximumFractionDigits: 0 }) : '0'}
            </div>
          </div>

          {/* Standard */}
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
              Rp {standardCost > 0 ? standardCost.toLocaleString('id-ID', { maximumFractionDigits: 0 }) : '0'}
            </div>
          </div>

          {/* Fast Pass */}
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
              Rp {fastCost > 0 ? fastCost.toLocaleString('id-ID', { maximumFractionDigits: 0 }) : '0'}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}