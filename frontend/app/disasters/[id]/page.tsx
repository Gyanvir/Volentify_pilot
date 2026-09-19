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

const DISASTER_DATA: Record<string, any> = {
  'ALT-101': {
    title: 'Cyclone Remal (Odisha & WB Coast)',
    levelText: 'CRITICAL EMERGENCY — CATEGORY 3',
    stats: 'LOCATION: 19.8135° N, 85.8312° E | LANDFALL ESTIMATE: 12 HOURS | MAX WIND: 145 KM/H',
    score: '9.4',
    impactLevel: 'HIGH IMPACT ZONE',
    report: 'Severe Cyclonic Storm "Remal" over the Northwest Bay of Bengal has moved north-northwestwards with a speed of 16 kmph during past 6 hours. Heavy to extremely heavy rainfall forecast across Puri, Jagatsinghpur, Kendrapara, and Bhadrak districts. High tidal waves of 3-4 meters above astronomical tide are likely to inundate low-lying coastal regions.',
    timeline: [
      { color: 'bg-emergency', time: 'TODAY, 14:30 IST', event: 'NDRF Deploys 14 Battalions with Inflatable Boats' },
      { color: 'bg-primary', time: 'TODAY, 11:15 IST', event: 'Coastal Evacuation Order Issued for 45 Coastal Villages' },
      { color: 'bg-surface-highest', time: 'YESTERDAY, 22:00 IST', event: 'IMD Upgrades Deep Depression to Cyclone Remal' },
    ],
    districts: [
      { name: 'PURI', pop: '1.7M' },
      { name: 'PARADIP', pop: '890K' },
      { name: 'BHADRAK', pop: '1.5M' },
      { name: 'BALASORE', pop: '2.3M' },
    ],
    hospitals: [
      { name: 'AIIMS Bhubaneswar', details: 'Trauma L1', distance: '45 km' },
      { name: 'SCB Medical College Cuttack', details: 'Burn Unit Active', distance: '62 km' },
    ],
    shelters: [
      { name: 'Paradip Port Shelter #4', details: 'Reinforced concrete shelter', status: 'Open & Stocked' },
    ]
  },
  'ALT-102': {
    title: 'Brahmaputra River Inundation (Assam)',
    levelText: 'CRITICAL EMERGENCY — FLOOD LEVEL 4',
    stats: 'LOCATION: 26.1445° N, 91.7362° E | RIVER LEVEL: 1.8M OVER DANGER | AFFECTED AREA: 50 SQ KM',
    score: '8.8',
    impactLevel: 'SEVERE INUNDATION',
    report: 'Brahmaputra river water level has surpassed the danger mark by 1.8 meters. Continuous heavy rainfall in the catchment areas is exacerbating the situation. Currently, 12 villages in Kamrup and Barpeta districts are completely submerged. Immediate evacuation to higher ground is underway.',
    timeline: [
      { color: 'bg-emergency', time: 'TODAY, 10:00 IST', event: 'SDRF Commences Motorboat Rescue Operations' },
      { color: 'bg-primary', time: 'TODAY, 06:30 IST', event: 'River Breaches Primary Embankment at Majuli' },
      { color: 'bg-surface-highest', time: 'YESTERDAY, 18:00 IST', event: 'Flood Warning Issued for Lower Assam' },
    ],
    districts: [
      { name: 'KAMRUP', pop: '1.2M' },
      { name: 'BARPETA', pop: '1.6M' },
      { name: 'DHUBRI', pop: '1.9M' },
      { name: 'MAJULI', pop: '167K' },
    ],
    hospitals: [
      { name: 'Gauhati Medical College', details: 'Emergency Wards Active', distance: '12 km' },
      { name: 'Barpeta Civil Hospital', details: 'Waterborne Disease Unit', distance: '34 km' },
    ],
    shelters: [
      { name: 'Kamrup High School Relief Camp', details: 'Elevated ground shelter', status: 'Operating at 80% Capacity' },
    ]
  },
  'ALT-103': {
    title: 'Uttarakhand High-Altitude Forest Fires',
    levelText: 'HIGH ALERT — WILDFIRE OUTBREAK',
    stats: 'LOCATION: 30.0668° N, 79.0193° E | SPREAD RATE: 1.2 KM/H | AFFECTED: 45 HECTARES',
    score: '8.1',
    impactLevel: 'ECOLOGICAL EMERGENCY',
    report: 'Dry atmospheric conditions and high-velocity winds have triggered massive forest fires in the Garhwal and Kumaon regions. The fire line currently spans 5 kilometers near Chamoli. Air Force helicopters have been deployed for Bambi bucket water-drop operations to protect nearby settlements.',
    timeline: [
      { color: 'bg-emergency', time: 'TODAY, 13:45 IST', event: 'IAF Mi-17 Helicopters Begin Water Drops' },
      { color: 'bg-primary', time: 'TODAY, 09:00 IST', event: 'Highway 58 Traffic Rerouted due to Smoke' },
      { color: 'bg-surface-highest', time: 'YESTERDAY, 15:30 IST', event: 'Initial Fire Spotted by Satellite Thermal Imaging' },
    ],
    districts: [
      { name: 'CHAMOLI', pop: '390K' },
      { name: 'ALMORA', pop: '622K' },
      { name: 'PAURI', pop: '687K' },
      { name: 'NAINITAL', pop: '954K' },
    ],
    hospitals: [
      { name: 'Sushila Tiwari Hospital, Haldwani', details: 'Burn Unit & Respiratory Care', distance: '85 km' },
      { name: 'District Hospital Chamoli', details: 'Emergency Oxygen Support', distance: '18 km' },
    ],
    shelters: [
      { name: 'Gopeshwar Community Hall', details: 'Safe from smoke drift', status: 'Ready to receive evacuees' },
    ]
  },
  'ALT-104': {
    title: 'Wayanad Slope Instability Warning',
    levelText: 'CRITICAL EMERGENCY — LANDSLIDE RISK',
    stats: 'LOCATION: 11.6854° N, 76.132° E | RAINFALL: 280MM / 24H | SLOPE GRADIENT: >35°',
    score: '9.2',
    impactLevel: 'EXTREME VULNERABILITY',
    report: 'Unprecedented continuous rainfall of 280mm over the last 24 hours has saturated the soil along the tea estate slopes of Meppadi and Chooralmala. Geotechnical sensors indicate imminent slope failure. All traffic along the ghat roads has been suspended.',
    timeline: [
      { color: 'bg-emergency', time: 'TODAY, 08:30 IST', event: 'Soil Displacement Sensors Trigger Red Alarm' },
      { color: 'bg-primary', time: 'TODAY, 06:00 IST', event: 'Mandatory Evacuation of Estate Worker Lines' },
      { color: 'bg-surface-highest', time: 'YESTERDAY, 23:00 IST', event: 'Orange Alert Upgraded to Red Alert for Rainfall' },
    ],
    districts: [
      { name: 'WAYANAD', pop: '817K' },
      { name: 'KOZHIKODE', pop: '3.0M' },
      { name: 'MALAPPURAM', pop: '4.1M' },
    ],
    hospitals: [
      { name: 'WIMS Medical College', details: 'Trauma & Emergency Unit Active', distance: '14 km' },
      { name: 'Kalpetta General Hospital', details: 'Surgical Teams on Standby', distance: '22 km' },
    ],
    shelters: [
      { name: 'Meppadi Panchayat Hall', details: 'Solid foundation structure', status: 'Evacuees arriving' },
    ]
  },
  'ALT-105': {
    title: 'Extreme Heatwave Advisory (Delhi NCR)',
    levelText: 'HIGH ALERT — SEVERE HEATWAVE',
    stats: 'LOCATION: 28.6139° N, 77.2090° E | PEAK TEMP: 47.2°C | HUMIDITY: 18%',
    score: '9.7',
    impactLevel: 'CRITICAL HEALTH RISK',
    report: 'A severe and prolonged heatwave is gripping Northern India, with temperatures in Delhi NCR peaking at 47.2°C. The IMD has issued a Red Alert for the next 5 consecutive days. High risk of heatstroke and dehydration, particularly for outdoor workers and vulnerable populations. Power grid stress is extremely high.',
    timeline: [
      { color: 'bg-emergency', time: 'TODAY, 14:00 IST', event: 'Temperature Breaches 47°C Mark' },
      { color: 'bg-primary', time: 'TODAY, 10:00 IST', event: 'Advisory: Halt All Outdoor Construction Work' },
      { color: 'bg-surface-highest', time: 'YESTERDAY, 17:00 IST', event: 'IMD Issues Red Alert for Consecutive 5 Days' },
    ],
    districts: [
      { name: 'NEW DELHI', pop: '252K' },
      { name: 'GURUGRAM', pop: '1.5M' },
      { name: 'FARIDABAD', pop: '1.8M' },
      { name: 'NOIDA', pop: '642K' },
    ],
    hospitals: [
      { name: 'Safdarjung Hospital', details: 'Dedicated Heatstroke Ward', distance: '8 km' },
      { name: 'AIIMS Delhi', details: 'Emergency Cooling Systems Active', distance: '9 km' },
    ],
    shelters: [
      { name: 'DUSIB Night Shelters (Day Use)', details: 'Cooling centers with ORS stock', status: 'Fully Operational' },
    ]
  }
};

export default function DisasterDetailsPage() {
  const params = useParams();
  const disasterId = params?.id || 'ALT-101';
  const data = DISASTER_DATA[disasterId.toString()] || DISASTER_DATA['ALT-101'];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      
      {/* Back Button & Top Action Controls */}
      <div className="flex items-center justify-between border-b border-surface-highest/60 pb-4">
        <Link
          href="/alerts"
          className="inline-flex items-center space-x-2 text-xs font-telemetry font-bold text-tactical-muted hover:text-primary transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>BACK TO ALERTS</span>
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
              <span className={`px-3 py-1 rounded text-white font-telemetry text-xs font-bold ${data.levelText.includes('CRITICAL') ? 'bg-emergency animate-pulse' : 'bg-primary'}`}>
                {data.levelText}
              </span>
              <span className="text-xs font-telemetry text-tactical-muted">
                EVENT ID: {disasterId.toString().toUpperCase()}
              </span>
            </div>
            <h1 className="text-2xl sm:text-4xl font-extrabold text-tactical-text">
              {data.title}
            </h1>
            <p className="text-xs sm:text-sm text-tactical-muted font-telemetry">
              {data.stats}
            </p>
          </div>

          <div className="p-4 rounded-xl bg-surface-lowest border border-surface-highest text-center font-telemetry min-w-48">
            <span className="text-[10px] text-tactical-muted uppercase font-bold block">SEVERITY RISK SCORE</span>
            <span className="text-3xl font-extrabold text-emergency">{data.score} / 10</span>
            <span className="text-[10px] text-emerald-400 block mt-1">{data.impactLevel}</span>
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
              {data.report}
            </p>
          </div>

          {/* Incident Timeline */}
          <div className="p-6 rounded-2xl glass-panel space-y-4">
            <h3 className="text-sm font-bold uppercase tracking-wider text-primary font-telemetry flex items-center space-x-2">
              <Clock className="w-4 h-4" />
              <span>CHRONOLOGICAL INCIDENT TIMELINE</span>
            </h3>
            
            <div className="space-y-3 border-l-2 border-primary/40 pl-4 text-xs font-telemetry">
              {data.timeline.map((item: any, idx: number) => (
                <div className="relative" key={idx}>
                  <span className={`absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full ${item.color}`}></span>
                  <div className="text-tactical-muted text-[10px]">{item.time}</div>
                  <div className="font-bold text-tactical-text">{item.event}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Affected Districts */}
          <div className="p-6 rounded-2xl glass-panel space-y-3 font-telemetry">
            <h3 className="text-sm font-bold uppercase tracking-wider text-primary">
              AFFECTED DISTRICTS & POPULATION AT RISK
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              {data.districts.map((district: any, idx: number) => (
                <div className="p-3 rounded bg-surface-high border border-surface-highest" key={idx}>
                  <div className="font-bold text-tactical-text">{district.name}</div>
                  <div className="text-[10px] text-tactical-muted">Est. Pop: {district.pop}</div>
                </div>
              ))}
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
              {data.hospitals.map((hospital: any, idx: number) => (
                <div className="p-3 rounded bg-surface-container border border-surface-highest" key={idx}>
                  <div className="font-bold text-tactical-text">{hospital.name}</div>
                  <div className="text-[10px] text-tactical-muted">{hospital.details}</div>
                  <div className="text-emerald-400 font-semibold mt-1">Distance: {hospital.distance}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Nearby Relief Shelters */}
          <div className="p-6 rounded-2xl glass-panel space-y-4 font-telemetry">
            <h3 className="text-xs font-bold uppercase tracking-wider text-blue-400 flex items-center space-x-2">
              <Home className="w-4 h-4" />
              <span>EMERGENCY RELIEF SHELTERS</span>
            </h3>

            <div className="space-y-3 text-xs">
              {data.shelters.map((shelter: any, idx: number) => (
                <div className="p-3 rounded bg-surface-container border border-surface-highest" key={idx}>
                  <div className="font-bold text-tactical-text">{shelter.name}</div>
                  <div className="text-[10px] text-tactical-muted">{shelter.details}</div>
                  <div className="text-blue-400 font-semibold mt-1">Status: {shelter.status}</div>
                </div>
              ))}
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
