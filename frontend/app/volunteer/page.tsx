'use client';

import React, { useState } from 'react';
import { Users, CheckCircle2, MapPin, ShieldCheck, Award, Heart, Radio, Activity } from 'lucide-react';

export default function VolunteerPage() {
  const [registered, setRegistered] = useState(false);
  const [selectedSkill, setSelectedSkill] = useState('Rescue & Search');

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    setRegistered(true);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      
      {/* Header */}
      <div className="border-b border-surface-highest/60 pb-6 space-y-2">
        <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-primary/20 border border-primary/40 text-primary text-xs font-telemetry font-bold">
          <Users className="w-3.5 h-3.5" />
          <span>VOLENTIFY FIELD VOLUNTEER CORPS</span>
        </div>
        <h1 className="text-2xl sm:text-4xl font-extrabold text-tactical-text">
          Volunteer Operation Portal
        </h1>
        <p className="text-xs sm:text-sm text-tactical-muted">
          Register your skills, access geo-targeted emergency dispatch assignments, download offline crisis maps, and join India's largest volunteer network.
        </p>
      </div>

      {/* Grid: Dispatch Task Board + Registration */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Column: Active Volunteer Assignments */}
        <div className="lg:col-span-7 space-y-6 font-telemetry">
          <h3 className="text-sm font-bold uppercase tracking-wider text-primary">
            ACTIVE FIELD DISPATCH MISSIONS (NEARBY)
          </h3>

          <div className="space-y-4">
            
            <div className="p-5 rounded-2xl glass-panel space-y-3 border-l-4 border-emergency">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-emergency uppercase bg-emergency/20 px-2 py-0.5 rounded">
                  URGENT DISPATCH
                </span>
                <span className="text-xs text-tactical-muted">DISTANCE: 4.2 KM</span>
              </div>
              <h4 className="text-base font-bold text-tactical-text">
                Puri Coastal Evacuation Assistance & Food Distribution
              </h4>
              <p className="text-xs text-tactical-muted">
                Assist NDRF teams in guiding residents from low-lying coastal huts to Relief Shelter #4.
              </p>
              <div className="flex items-center justify-between pt-2">
                <span className="text-xs text-primary font-bold">REQ: 25 Volunteers (14 Joined)</span>
                <button
                  onClick={() => alert('Mission accepted! Coordinates routed to Volentify Mobile App.')}
                  className="px-4 py-1.5 rounded bg-primary text-surface-lowest text-xs font-bold hover:bg-primary-tint transition-colors"
                >
                  ACCEPT MISSION
                </button>
              </div>
            </div>

            <div className="p-5 rounded-2xl glass-panel space-y-3 border-l-4 border-blue-500">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-blue-400 uppercase bg-blue-500/20 px-2 py-0.5 rounded">
                  MEDICAL SUPPORT
                </span>
                <span className="text-xs text-tactical-muted">DISTANCE: 12.8 KM</span>
              </div>
              <h4 className="text-base font-bold text-tactical-text">
                AIIMS Blood Donation & Emergency Triage Camp
              </h4>
              <p className="text-xs text-tactical-muted">
                Volunteers with O-negative and AB-positive blood required for cyclone trauma victims.
              </p>
              <div className="flex items-center justify-between pt-2">
                <span className="text-xs text-blue-400 font-bold">REQ: Medical Certification</span>
                <button
                  onClick={() => alert('Medical volunteer verification initiated.')}
                  className="px-4 py-1.5 rounded bg-blue-500 text-white text-xs font-bold hover:bg-blue-600 transition-colors"
                >
                  VOLUNTEER BLOOD
                </button>
              </div>
            </div>

          </div>
        </div>

        {/* Right Column: Registration / Profile Status */}
        <div className="lg:col-span-5 space-y-6 font-telemetry">
          <div className="p-6 rounded-2xl glass-panel space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-primary">
              VOLUNTEER CERTIFICATION & REGISTRATION
            </h3>

            {registered ? (
              <div className="p-4 rounded-xl bg-emerald-500/20 border border-emerald-500 text-center space-y-2">
                <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
                <h4 className="text-sm font-bold text-emerald-300">VOLUNTEER PROFILE VERIFIED</h4>
                <p className="text-xs text-tactical-muted">
                  ID: VOL-IND-84920 | Status: Active Field Ready
                </p>
              </div>
            ) : (
              <form onSubmit={handleRegister} className="space-y-3 text-xs">
                <div>
                  <label className="text-tactical-muted block mb-1">FULL NAME</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Rahul Sharma"
                    className="w-full p-2.5 rounded bg-surface-lowest border border-surface-highest text-tactical-text"
                  />
                </div>
                <div>
                  <label className="text-tactical-muted block mb-1">PRIMARY SKILL CATEGORY</label>
                  <select
                    value={selectedSkill}
                    onChange={(e) => setSelectedSkill(e.target.value)}
                    className="w-full p-2.5 rounded bg-surface-lowest border border-surface-highest text-tactical-text"
                  >
                    <option>Rescue & Search</option>
                    <option>Medical & First Aid</option>
                    <option>Food & Shelter Logistics</option>
                    <option>Transport & Driving</option>
                    <option>Blood Donor</option>
                  </select>
                </div>
                <div>
                  <label className="text-tactical-muted block mb-1">DISTRICT & STATE</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Puri, Odisha"
                    className="w-full p-2.5 rounded bg-surface-lowest border border-surface-highest text-tactical-text"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full py-3 rounded bg-primary text-surface-lowest font-bold text-xs hover:bg-primary-tint transition-colors shadow-tactical"
                >
                  REGISTER VOLUNTEER CORPS
                </button>
              </form>
            )}
          </div>
        </div>

      </div>

    </div>
  );
}
