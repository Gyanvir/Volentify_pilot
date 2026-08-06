'use client';

import React, { useState } from 'react';
import { LineChart, BrainCircuit, Sparkles, AlertTriangle, ShieldCheck, Activity, ArrowRight } from 'lucide-react';

export default function PredictionsPage() {
  const [selectedRegion, setSelectedRegion] = useState('ODISHA_COAST');

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      
      {/* Header */}
      <div className="border-b border-surface-highest/60 pb-6 space-y-2">
        <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 text-xs font-telemetry font-bold">
          <BrainCircuit className="w-3.5 h-3.5" />
          <span>MACHINE LEARNING RISK FORECASTING (XGBOOST & DISTILBERT)</span>
        </div>
        <h1 className="text-2xl sm:text-4xl font-extrabold text-tactical-text">
          Hazard Probability & Risk Forecast
        </h1>
        <p className="text-xs sm:text-sm text-tactical-muted">
          Predictive machine learning models trained on 50+ years of Indian historical disaster data, meteorological telemetry, and terrain elevation.
        </p>
      </div>

      {/* Main ML Forecast Matrix */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* ML Model Risk Output Cards */}
        <div className="lg:col-span-8 space-y-6">
          
          <div className="p-6 rounded-2xl glass-panel space-y-4 font-telemetry">
            <div className="flex items-center justify-between border-b border-surface-highest pb-3">
              <div>
                <span className="text-[10px] text-tactical-muted uppercase font-bold block">MODEL ID: VOLENTIFY-XGBOOST-V4</span>
                <h3 className="text-base font-bold text-tactical-text">Cyclone Remal Storm Surge Probability</h3>
              </div>
              <span className="px-3 py-1 rounded bg-emergency text-white text-xs font-bold animate-pulse">
                94.8% CONFIDENCE
              </span>
            </div>

            <div className="grid grid-cols-3 gap-4 text-center">
              <div className="p-3 rounded bg-surface-high border border-surface-highest">
                <span className="text-[10px] text-tactical-muted block">NEXT 12 HOURS</span>
                <span className="text-xl font-extrabold text-emergency">96.2%</span>
                <span className="text-[9px] text-emergency block">High Surge Risk</span>
              </div>
              <div className="p-3 rounded bg-surface-high border border-surface-highest">
                <span className="text-[10px] text-tactical-muted block">NEXT 24 HOURS</span>
                <span className="text-xl font-extrabold text-primary">78.4%</span>
                <span className="text-[9px] text-primary-tint block">Heavy Inundation</span>
              </div>
              <div className="p-3 rounded bg-surface-high border border-surface-highest">
                <span className="text-[10px] text-tactical-muted block">NEXT 48 HOURS</span>
                <span className="text-xl font-extrabold text-emerald-400">32.1%</span>
                <span className="text-[9px] text-emerald-400 block">Dissipating</span>
              </div>
            </div>

            <p className="text-xs text-tactical-muted leading-relaxed">
              XGBoost Classifier predicts 89.2% probability of coastal road breach along NH-316 due to wave overflow between 02:00 IST and 06:00 IST tomorrow.
            </p>
          </div>

          <div className="p-6 rounded-2xl glass-panel space-y-4 font-telemetry">
            <div className="flex items-center justify-between border-b border-surface-highest pb-3">
              <div>
                <span className="text-[10px] text-tactical-muted uppercase font-bold block">NLP MODEL: DISTILBERT-SITREP</span>
                <h3 className="text-base font-bold text-tactical-text">Automated Situation Intensity Classifier</h3>
              </div>
              <span className="px-3 py-1 rounded bg-emerald-500/20 text-emerald-400 text-xs font-bold">
                98.1% ACCURACY
              </span>
            </div>

            <p className="text-xs text-tactical-text leading-relaxed">
              Analyzed 14,280 local news feeds and social posts across Odia, Assamese, and Malayalam. Automatically extracted 340 verified SOS rescue requests with 94.2% precision.
            </p>
          </div>

        </div>

        {/* Sidebar Controls */}
        <div className="lg:col-span-4 space-y-6">
          <div className="p-6 rounded-2xl glass-panel space-y-4 font-telemetry">
            <h3 className="text-xs font-bold uppercase tracking-wider text-primary">SELECT TARGET REGION</h3>
            
            <div className="space-y-2 text-xs">
              {['ODISHA_COAST', 'ASSAM_VALLEY', 'KERALA_GHATS', 'HIMALAYAN_BELT'].map((reg) => (
                <button
                  key={reg}
                  onClick={() => setSelectedRegion(reg)}
                  className={`w-full p-2.5 rounded text-left font-bold transition-all ${
                    selectedRegion === reg
                      ? 'bg-primary text-surface-lowest'
                      : 'bg-surface-high hover:bg-surface-highest text-tactical-text'
                  }`}
                >
                  {reg.replace('_', ' ')}
                </button>
              ))}
            </div>
          </div>
        </div>

      </div>

    </div>
  );
}
