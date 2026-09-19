'use client';

import React, { useState } from 'react';
import { LineChart, BrainCircuit, Sparkles, AlertTriangle, ShieldCheck, Activity, ArrowRight } from 'lucide-react';

const REGION_DATA: Record<string, any> = {
  'ODISHA_COAST': {
    modelId: 'VOLENTIFY-XGBOOST-V4',
    title: 'Cyclone Remal Storm Surge Probability',
    desc: 'XGBoost Classifier predicts 89.2% probability of coastal road breach along NH-316 due to wave overflow between 02:00 IST and 06:00 IST tomorrow.',
    confidence: '94.8% CONFIDENCE',
    h12: '96.2%', h12lbl: 'High Surge Risk',
    h24: '78.4%', h24lbl: 'Heavy Inundation',
    h48: '32.1%', h48lbl: 'Dissipating',
    nlpAcc: '98.1% ACCURACY',
    nlpDesc: 'Analyzed 14,280 local news feeds and social posts across Odia, Assamese, and Malayalam. Automatically extracted 340 verified SOS rescue requests with 94.2% precision.'
  },
  'ASSAM_VALLEY': {
    modelId: 'VOLENTIFY-RNDF-V2',
    title: 'Brahmaputra Flood Risk Forecast',
    desc: 'Random Forest model predicts 91.5% probability of river banks overflowing in the Majuli district within 24 hours due to heavy upstream rainfall.',
    confidence: '92.1% CONFIDENCE',
    h12: '85.5%', h12lbl: 'River Rising',
    h24: '94.2%', h24lbl: 'Severe Flooding',
    h48: '88.0%', h48lbl: 'Water Logging',
    nlpAcc: '96.5% ACCURACY',
    nlpDesc: 'Analyzed 8,500 local news feeds and social posts. Automatically extracted 120 verified rescue requests for boat evacuations with 95% precision.'
  },
  'KERALA_GHATS': {
    modelId: 'VOLENTIFY-LGBM-V3',
    title: 'Wayanad Landslide Susceptibility',
    desc: 'LightGBM model indicates 87.3% chance of soil failure and landslides in Wayanad due to continuous precipitation exceeding 150mm over 48 hours.',
    confidence: '89.5% CONFIDENCE',
    h12: '75.0%', h12lbl: 'High Soil Moisture',
    h24: '88.6%', h24lbl: 'Landslide Trigger',
    h48: '60.4%', h48lbl: 'Stabilizing',
    nlpAcc: '97.2% ACCURACY',
    nlpDesc: 'Processed 5,200 regional reports and WhatsApp forwards. Extracted 85 verified road blockage reports and 40 isolated family alerts.'
  },
  'HIMALAYAN_BELT': {
    modelId: 'VOLENTIFY-SVM-V1',
    title: 'Uttarakhand Forest Fire Probability',
    desc: 'SVM Classifier predicts 93.8% risk of rapid fire spread in Garhwal region driven by dry winds and low humidity (below 20%).',
    confidence: '95.2% CONFIDENCE',
    h12: '90.1%', h12lbl: 'Rapid Spread',
    h24: '85.4%', h24lbl: 'Canopy Fire',
    h48: '50.2%', h48lbl: 'Containment',
    nlpAcc: '94.8% ACCURACY',
    nlpDesc: 'Scanned 3,100 forest department alerts and local tweets. Identified 15 new active fire spots and 3 endangered settlement zones.'
  }
};

export default function PredictionsPage() {
  const [selectedRegion, setSelectedRegion] = useState('ODISHA_COAST');
  const data = REGION_DATA[selectedRegion];

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
                <span className="text-[10px] text-tactical-muted uppercase font-bold block">MODEL ID: {data.modelId}</span>
                <h3 className="text-base font-bold text-tactical-text">{data.title}</h3>
              </div>
              <span className="px-3 py-1 rounded bg-emergency text-white text-xs font-bold animate-pulse">
                {data.confidence}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-4 text-center">
              <div className="p-3 rounded bg-surface-high border border-surface-highest">
                <span className="text-[10px] text-tactical-muted block">NEXT 12 HOURS</span>
                <span className="text-xl font-extrabold text-emergency">{data.h12}</span>
                <span className="text-[9px] text-emergency block">{data.h12lbl}</span>
              </div>
              <div className="p-3 rounded bg-surface-high border border-surface-highest">
                <span className="text-[10px] text-tactical-muted block">NEXT 24 HOURS</span>
                <span className="text-xl font-extrabold text-primary">{data.h24}</span>
                <span className="text-[9px] text-primary-tint block">{data.h24lbl}</span>
              </div>
              <div className="p-3 rounded bg-surface-high border border-surface-highest">
                <span className="text-[10px] text-tactical-muted block">NEXT 48 HOURS</span>
                <span className="text-xl font-extrabold text-emerald-400">{data.h48}</span>
                <span className="text-[9px] text-emerald-400 block">{data.h48lbl}</span>
              </div>
            </div>

            <p className="text-xs text-tactical-muted leading-relaxed">
              {data.desc}
            </p>
          </div>

          <div className="p-6 rounded-2xl glass-panel space-y-4 font-telemetry">
            <div className="flex items-center justify-between border-b border-surface-highest pb-3">
              <div>
                <span className="text-[10px] text-tactical-muted uppercase font-bold block">NLP MODEL: DISTILBERT-SITREP</span>
                <h3 className="text-base font-bold text-tactical-text">Automated Situation Intensity Classifier</h3>
              </div>
              <span className="px-3 py-1 rounded bg-emerald-500/20 text-emerald-400 text-xs font-bold">
                {data.nlpAcc}
              </span>
            </div>

            <p className="text-xs text-tactical-text leading-relaxed">
              {data.nlpDesc}
            </p>
          </div>

        </div>

        {/* Sidebar Controls */}
        <div className="lg:col-span-4 space-y-6">
          <div className="p-6 rounded-2xl glass-panel space-y-4 font-telemetry">
            <h3 className="text-xs font-bold uppercase tracking-wider text-primary">SELECT TARGET REGION</h3>
            
            <div className="space-y-2 text-xs">
              {Object.keys(REGION_DATA).map((reg) => (
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
