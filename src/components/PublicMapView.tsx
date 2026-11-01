import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { getClusters, fetchLiveClusters } from '../services/api';
import { Cluster } from '../types';
import { MapPin, Layers, Filter, AlertTriangle } from 'lucide-react';

export const PublicMapView: React.FC = () => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const [clusters, setClusters] = useState<Cluster[]>(getClusters());
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  useEffect(() => {
    fetchLiveClusters().then((fresh) => {
      if (fresh && fresh.length > 0) {
        setClusters(fresh);
      }
    });
  }, []);

  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      // Default centered on New Delhi / Central Region
      const map = L.map(mapContainerRef.current).setView([28.6139, 77.2090], 12);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
        maxZoom: 19,
      }).addTo(map);

      mapInstanceRef.current = map;
    }

    const map = mapInstanceRef.current;

    // Clear existing markers
    map.eachLayer((layer) => {
      if (layer instanceof L.CircleMarker || layer instanceof L.Marker) {
        map.removeLayer(layer);
      }
    });

    const filtered = selectedCategory === 'all' 
      ? clusters 
      : clusters.filter((c) => c.category === selectedCategory);

    // Color mapper based on severity level
    const getPinColor = (sev: number) => {
      if (sev === 5) return '#ef4444'; // Red
      if (sev === 4) return '#f97316'; // Orange
      if (sev === 3) return '#f59e0b'; // Amber
      if (sev === 2) return '#3b82f6'; // Blue
      return '#94a3b8'; // Slate
    };

    filtered.forEach((c) => {
      const color = getPinColor(c.severity_current);

      const marker = L.circleMarker([c.center_lat, c.center_lng], {
        radius: 10 + Math.min(10, c.flag_count * 2),
        fillColor: color,
        color: '#ffffff',
        weight: 2,
        opacity: 1,
        fillOpacity: 0.85,
      }).addTo(map);

      const popupHtml = `
        <div style="font-family: system-ui, sans-serif; min-width: 180px; color: #0f172a;">
          <div style="font-weight: bold; font-size: 13px; text-transform: uppercase; color: ${color};">
            Level ${c.severity_current} • ${c.category.replace('_', ' ')}
          </div>
          <div style="font-size: 12px; font-weight: 600; margin-top: 4px;">${c.address}</div>
          <div style="font-size: 11px; color: #64748b; margin-top: 2px;">
            ${c.flag_count} Citizen ${c.flag_count === 1 ? 'Report' : 'Reports'}
          </div>
          <div style="font-size: 11px; margin-top: 4px; padding: 2px 6px; background: #e2e8f0; border-radius: 4px; display: inline-block;">
            Status: ${c.status.toUpperCase()}
          </div>
        </div>
      `;

      marker.bindPopup(popupHtml);
    });

    return () => {};
  }, [clusters, selectedCategory]);

  const openCount = clusters.filter((c) => c.status !== 'closed' && c.status !== 'rejected').length;
  const closedCount = clusters.filter((c) => c.status === 'closed').length;
  const criticalCount = clusters.filter((c) => c.severity_current === 5 && c.status !== 'closed').length;
  const localities = Array.from(new Set(clusters.map((c) => c.locality).filter(Boolean))).slice(0, 2).join(', ') || 'No active sectors';

  return (
    <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8 space-y-6">
      {/* Top Real-time Municipal Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg">
          <span className="text-xs text-slate-400 font-semibold block">Active Grievances</span>
          <span className="text-2xl font-extrabold text-white mt-1 block">{openCount}</span>
          <span className="text-[11px] text-emerald-400">Live PostGIS Clusters</span>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg">
          <span className="text-xs text-slate-400 font-semibold block">Critical SLA (L5)</span>
          <span className="text-2xl font-extrabold text-red-400 mt-1 block">{criticalCount}</span>
          <span className="text-[11px] text-red-400/80">6-Hour Escalation Window</span>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg">
          <span className="text-xs text-slate-400 font-semibold block">Resolved Issues</span>
          <span className="text-2xl font-extrabold text-emerald-400 mt-1 block">{closedCount}</span>
          <span className="text-[11px] text-slate-400">With Field Proof Photo</span>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg">
          <span className="text-xs text-slate-400 font-semibold block">Active Localities</span>
          <span className="text-sm font-bold text-slate-200 mt-1 block line-clamp-1">{localities}</span>
          <span className="text-[11px] text-slate-500">Auto-deduplicated</span>
        </div>
      </div>

      {/* Map Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-6 shadow-xl">
        <div className="flex flex-col sm:flex-row justify-between sm:items-center pb-4 mb-4 border-b border-slate-800 gap-3">
          <div className="flex items-center space-x-2">
            <MapPin className="w-5 h-5 text-emerald-400" />
            <h3 className="text-lg font-bold text-white">Live Civic Incident Heatmap</h3>
          </div>

          {/* Filter Pills */}
          <div className="flex items-center space-x-2 text-xs overflow-x-auto pb-1 sm:pb-0">
            <span className="text-slate-400 flex items-center space-x-1">
              <Filter className="w-3.5 h-3.5" />
              <span>Category:</span>
            </span>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1 text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            >
              <option value="all">All Categories</option>
              <option value="pothole">Potholes</option>
              <option value="garbage">Garbage</option>
              <option value="water_leak">Water Leaks</option>
              <option value="sewage_drain">Sewage / Manhole</option>
              <option value="electrical_hazard">Electrical Hazards</option>
            </select>
          </div>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400 mb-3 bg-slate-800/40 p-2.5 rounded-xl border border-slate-750">
          <span className="font-semibold text-slate-300">Severity Legend:</span>
          <div className="flex items-center space-x-1">
            <span className="w-3 h-3 rounded-full bg-red-500 inline-block" />
            <span>L5 Critical (6h)</span>
          </div>
          <div className="flex items-center space-x-1">
            <span className="w-3 h-3 rounded-full bg-orange-500 inline-block" />
            <span>L4 High (24h)</span>
          </div>
          <div className="flex items-center space-x-1">
            <span className="w-3 h-3 rounded-full bg-amber-500 inline-block" />
            <span>L3 Medium (72h)</span>
          </div>
          <div className="flex items-center space-x-1">
            <span className="w-3 h-3 rounded-full bg-blue-500 inline-block" />
            <span>L2 Low (5d)</span>
          </div>
        </div>

        {/* Leaflet Container */}
        <div className="h-[480px] w-full rounded-xl overflow-hidden border border-slate-800">
          <div ref={mapContainerRef} className="w-full h-full" />
        </div>
      </div>
    </div>
  );
};
