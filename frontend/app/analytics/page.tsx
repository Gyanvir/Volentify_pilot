'use client';

import React from 'react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell,
  LineChart,
  Line
} from 'recharts';
import { LineChart as LineIcon, Activity, Calendar, Download, TrendingUp } from 'lucide-react';

const DISASTER_YEARLY_DATA = [
  { year: '2020', Cyclones: 4, Floods: 12, Wildfires: 8 },
  { year: '2021', Cyclones: 6, Floods: 15, Wildfires: 10 },
  { year: '2022', Cyclones: 5, Floods: 18, Wildfires: 14 },
  { year: '2023', Cyclones: 7, Floods: 22, Wildfires: 11 },
  { year: '2024', Cyclones: 8, Floods: 25, Wildfires: 16 },
  { year: '2025', Cyclones: 9, Floods: 28, Wildfires: 19 },
];

const RESPONSE_TIME_DATA = [
  { month: 'Jan', avgMinutes: 45 },
  { month: 'Feb', avgMinutes: 42 },
  { month: 'Mar', avgMinutes: 38 },
  { month: 'Apr', avgMinutes: 35 },
  { month: 'May', avgMinutes: 28 },
  { month: 'Jun', avgMinutes: 22 },
];

const CATEGORY_PIE_DATA = [
  { name: 'Floods', value: 45, color: '#3b82f6' },
  { name: 'Cyclones', value: 25, color: '#ff6b00' },
  { name: 'Landslides', value: 18, color: '#a855f7' },
  { name: 'Wildfires', value: 12, color: '#ff675e' },
];

export default function AnalyticsPage() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-surface-highest/60 pb-6">
        <div>
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-secondary/30 border border-secondary-bright/40 text-secondary-bright text-xs font-telemetry font-bold">
            <LineIcon className="w-3.5 h-3.5" />
            <span>HISTORICAL DISASTER & RESPONSE ANALYTICS</span>
          </div>
          <h1 className="text-2xl sm:text-4xl font-extrabold text-tactical-text mt-2">
            National Analytics Dashboard
          </h1>
        </div>

        <button
          onClick={() => alert('Exporting CSV analytics data...')}
          className="px-4 py-2 rounded bg-surface-high hover:bg-surface-highest border border-surface-highest text-tactical-text text-xs font-bold font-telemetry flex items-center space-x-2"
        >
          <Download className="w-4 h-4 text-primary" />
          <span>EXPORT DATA CSV</span>
        </button>
      </div>

      {/* Grid: Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Disaster Frequency Bar Chart */}
        <div className="lg:col-span-8 p-6 rounded-2xl glass-panel space-y-4 font-telemetry">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-tactical-text">ANNUAL DISASTER INCIDENCES IN INDIA (2020 - 2025)</h3>
            <span className="text-[10px] text-tactical-muted">SOURCE: NDMA ANNUAL REPORTS</span>
          </div>

          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={DISASTER_YEARLY_DATA}>
                <XAxis dataKey="year" stroke="#8b9ea8" fontSize={11} />
                <YAxis stroke="#8b9ea8" fontSize={11} />
                <Tooltip contentStyle={{ backgroundColor: '#111d23', borderColor: '#2a363d', fontSize: '12px' }} />
                <Bar dataKey="Floods" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Cyclones" fill="#ff6b00" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Wildfires" fill="#ff675e" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Category Breakdown Pie Chart */}
        <div className="lg:col-span-4 p-6 rounded-2xl glass-panel space-y-4 font-telemetry">
          <h3 className="text-sm font-bold text-tactical-text">DISASTER DISTRIBUTION BY TYPE</h3>

          <div className="h-60 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={CATEGORY_PIE_DATA} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                  {CATEGORY_PIE_DATA.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ backgroundColor: '#111d23', borderColor: '#2a363d', fontSize: '12px' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs">
            {CATEGORY_PIE_DATA.map((item) => (
              <div key={item.name} className="flex items-center space-x-2">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }}></span>
                <span className="text-tactical-text">{item.name}: {item.value}%</span>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* Response Speed Line Chart */}
      <div className="p-6 rounded-2xl glass-panel space-y-4 font-telemetry">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-tactical-text">VOLENTIFY AVERAGE DISPATCH RESPONSE TIME (MINUTES)</h3>
          <span className="text-xs text-emerald-400 font-bold flex items-center space-x-1">
            <TrendingUp className="w-3.5 h-3.5" />
            <span>51% FASTER DISPATCH</span>
          </span>
        </div>

        <div className="h-60 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={RESPONSE_TIME_DATA}>
              <XAxis dataKey="month" stroke="#8b9ea8" fontSize={11} />
              <YAxis stroke="#8b9ea8" fontSize={11} />
              <Tooltip contentStyle={{ backgroundColor: '#111d23', borderColor: '#2a363d', fontSize: '12px' }} />
              <Line type="monotone" dataKey="avgMinutes" stroke="#ff6b00" strokeWidth={3} dot={{ fill: '#ff6b00', r: 6 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

    </div>
  );
}
