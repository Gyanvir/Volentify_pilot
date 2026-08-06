'use client';

import React from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { 
  ShieldAlert, 
  Map, 
  Clock, 
  Download, 
  Share2, 
  Hospital, 
  Home, 
  Users, 
  FileText, 
  AlertTriangle,
  ArrowLeft,
  Navigation,
  Wind,
  Waves
} from 'lucide-react';

export default function DisasterDetailsPage() {
  const params = useParams();
  const disasterId = params?.id || 'node-1';

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      
      {/* Back Button & Top Action Controls */}
      <div className="flex items-center justify-between border-b border-surface-highest/60 pb-4">
        <Link
          href="/map"
          className="inline-flex items-center space-x-2 text-xs font-telemetry font-bold text-tactical-muted hover:text-primary transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>BACK TO LIVE GIS MAP</span>
        </Link>

        <div className="flex items-center space-x-3">
          <button
            onClick={() => alert('Generating official NDMA situation report PDF...')}
            className="px-4 py-2 rounded bg-surface-high hover:bg-surface-highest border border-surface-highest text-tactical-text text-xs font-bold font-telemetry flex items-center space-x-1.5 transition-colors"
          >
            <Download className="w-3.5 h-3.5 text-primary" />
            <span>EXPORT PDF REPORT</span>
          </button>
          <button
            onClick={() => alert('Sharing emergency alert link...')}
            className="px-4 py-2 rounded bg-primary text-surface-lowest text-xs font-bold font-telemetry flex items-center space-x-1.5 hover:bg-primary-tint transition-colors"
          >
            <Share2 className="w-3.5 h-3.5" />
            <span>SHARE ALERT</span>
          </button>
        </div>
      </div>

      {/* Main Header Banner */}
      <div className="p-6 sm:p-8 rounded-2xl bg-surface-low border border-emergency/50 relative overflow-hidden space-y-4">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center space-x-3">
              <span className="px-3 py-1 rounded bg-emergency text-white font-telemetry text-xs font-bold animate-pulse">
                CRITICAL EMERGENCY — CATEGORY 3
              </span>
              <span className="text-xs font-telemetry text-tactical-muted">
                EVENT ID: {disasterId.toString().toUpperCase()}
              </span>
            </div>
            <h1 className="text-2xl sm:text-4xl font-extrabold text-tactical-text">
              Cyclone Remal (Odisha & WB Coast)
            </h1>
            <p className="text-xs sm:text-sm text-tactical-muted font-telemetry">
              LOCATION: 19.8135° N, 85.8312° E | LANDFALL ESTIMATE: 12 HOURS | MAX WIND: 145 KM/H
            </p>
          </div>

          <div className="p-4 rounded-xl bg-surface-lowest border border-surface-highest text-center font-telemetry min-w-48">
            <span className="text-[10px] text-tactical-muted uppercase font-bold block">SEVERITY RISK SCORE</span>
            <span className="text-3xl font-extrabold text-emergency">9.4 / 10</span>
            <span className="text-[10px] text-emerald-400 block mt-1">HIGH IMPACT ZONE</span>
          </div>
        </div>
      </div>

      {/* Grid Content */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Column: Intelligence, Timeline & Advisories */}
        <div className="lg:col-span-8 space-y-6">
          
          {/* Situation Report */}
          <div className="p-6 rounded-2xl glass-panel space-y-3">
            <h3 className="text-sm font-bold uppercase tracking-wider text-primary font-telemetry flex items-center space-x-2">
              <FileText className="w-4 h-4" />
              <span>OFFICIAL SITUATION REPORT (NDMA / IMD)</span>
            </h3>
            <p className="text-xs text-tactical-text leading-relaxed">
              Severe Cyclonic Storm "Remal" over the Northwest Bay of Bengal has moved north-northwestwards with a speed of 16 kmph during past 6 hours. Heavy to extremely heavy rainfall forecast across Puri, Jagatsinghpur, Kendrapara, and Bhadrak districts. High tidal waves of 3-4 meters above astronomical tide are likely to inundate low-lying coastal regions.
            </p>
          </div>

          {/* Incident Timeline */}
          <div className="p-6 rounded-2xl glass-panel space-y-4">
            <h3 className="text-sm font-bold uppercase tracking-wider text-primary font-telemetry flex items-center space-x-2">
              <Clock className="w-4 h-4" />
              <span>CHRONOLOGICAL INCIDENT TIMELINE</span>
            </h3>
            
            <div className="space-y-3 border-l-2 border-primary/40 pl-4 text-xs font-telemetry">
              <div className="relative">
                <span className="absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full bg-emergency"></span>
                <div className="text-tactical-muted text-[10px]">TODAY, 14:30 IST</div>
                <div className="font-bold text-tactical-text">NDRF Deploys 14 Battalions with Inflatable Boats</div>
              </div>
              <div className="relative">
                <span className="absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full bg-primary"></span>
                <div className="text-tactical-muted text-[10px]">TODAY, 11:15 IST</div>
                <div className="font-bold text-tactical-text">Coastal Evacuation Order Issued for 45 Coastal Villages</div>
              </div>
              <div className="relative">
                <span className="absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full bg-surface-highest"></span>
                <div className="text-tactical-muted text-[10px]">YESTERDAY, 22:00 IST</div>
                <div className="font-bold text-tactical-text">IMD Upgrades Deep Depression to Cyclone Remal</div>
              </div>
            </div>
          </div>

          {/* Affected Districts */}
          <div className="p-6 rounded-2xl glass-panel space-y-3 font-telemetry">
            <h3 className="text-sm font-bold uppercase tracking-wider text-primary">
              AFFECTED DISTRICTS & POPULATION AT RISK
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="p-3 rounded bg-surface-high border border-surface-highest">
                <div className="font-bold text-tactical-text">PURI</div>
                <div className="text-[10px] text-tactical-muted">Est. Pop: 1.7M</div>
              </div>
              <div className="p-3 rounded bg-surface-high border border-surface-highest">
                <div className="font-bold text-tactical-text">PARADIP</div>
                <div className="text-[10px] text-tactical-muted">Est. Pop: 890K</div>
              </div>
              <div className="p-3 rounded bg-surface-high border border-surface-highest">
                <div className="font-bold text-tactical-text">BHADRAK</div>
                <div className="text-[10px] text-tactical-muted">Est. Pop: 1.5M</div>
              </div>
              <div className="p-3 rounded bg-surface-high border border-surface-highest">
                <div className="font-bold text-tactical-text">BALASORE</div>
                <div className="text-[10px] text-tactical-muted">Est. Pop: 2.3M</div>
              </div>
            </div>
          </div>

        </div>

        {/* Right Column: Nearby Hospitals, Shelters & Dispatch */}
        <div className="lg:col-span-4 space-y-6">
          
          {/* Nearby Medical Resources */}
          <div className="p-6 rounded-2xl glass-panel space-y-4 font-telemetry">
            <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center space-x-2">
              <Hospital className="w-4 h-4" />
              <span>NEARBY EMERGENCY HOSPITALS</span>
            </h3>

            <div className="space-y-3 text-xs">
              <div className="p-3 rounded bg-surface-container border border-surface-highest">
                <div className="font-bold text-tactical-text">AIIMS Bhubaneswar</div>
                <div className="text-[10px] text-tactical-muted">142 ICU Beds Available | Trauma L1</div>
                <div className="text-emerald-400 font-semibold mt-1">Distance: 45 km</div>
              </div>
              <div className="p-3 rounded bg-surface-container border border-surface-highest">
                <div className="font-bold text-tactical-text">SCB Medical College Cuttack</div>
                <div className="text-[10px] text-tactical-muted">98 Beds Available | Burn Unit Active</div>
                <div className="text-emerald-400 font-semibold mt-1">Distance: 62 km</div>
              </div>
            </div>
          </div>

          {/* Nearby Relief Shelters */}
          <div className="p-6 rounded-2xl glass-panel space-y-4 font-telemetry">
            <h3 className="text-xs font-bold uppercase tracking-wider text-blue-400 flex items-center space-x-2">
              <Home className="w-4 h-4" />
              <span>CYCLONE RELIEF SHELTERS</span>
            </h3>

            <div className="space-y-3 text-xs">
              <div className="p-3 rounded bg-surface-container border border-surface-highest">
                <div className="font-bold text-tactical-text">Paradip Port Shelter #4</div>
                <div className="text-[10px] text-tactical-muted">Capacity: 850 / Occupancy: 320</div>
                <div className="text-blue-400 font-semibold mt-1">Status: Open & Stocked</div>
              </div>
            </div>
          </div>

          {/* Rapid Volunteer Request Button */}
          <div className="p-6 rounded-2xl bg-gradient-to-br from-primary/20 to-surface-low border border-primary/40 text-center space-y-3">
            <h4 className="text-sm font-bold text-tactical-text">
              Need Field Volunteers at this Hazard Location?
            </h4>
            <Link
              href="/volunteer"
              className="w-full py-2.5 rounded bg-primary text-surface-lowest font-bold text-xs block hover:bg-primary-tint transition-colors"
            >
              DISPATCH VOLENTIFY FIELD UNIT
            </Link>
          </div>

        </div>

      </div>

    </div>
  );
}
