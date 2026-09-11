'use client';

import { useEffect, useState, FormEvent } from 'react';
import { DashboardShell, PageHeader, StatusBadge } from '@/components/dashboard-shell';
import { api } from '@/lib/api-client';
import { formatNaira } from '@/lib/format';
import { LocationNode, ServiceAreaSummary, LocationType } from '@/lib/types';

const LOCATION_TYPES: LocationType[] = ['COUNTRY', 'STATE', 'CITY', 'UNIVERSITY', 'CAMPUS', 'NEIGHBORHOOD'];

function flattenLocations(nodes: LocationNode[], depth = 0): { node: LocationNode; depth: number }[] {
  return nodes.flatMap((n) => [{ node: n, depth }, ...flattenLocations(n.children, depth + 1)]);
}

export default function LocationsPage() {
  const [tree, setTree] = useState<LocationNode[]>([]);
  const [serviceAreas, setServiceAreas] = useState<ServiceAreaSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [riderRateByArea, setRiderRateByArea] = useState<Record<string, string>>({});

  // New location form state
  const [newLocationName, setNewLocationName] = useState('');
  const [newLocationType, setNewLocationType] = useState<LocationType>('CITY');
  const [newLocationParentId, setNewLocationParentId] = useState('');

  // New service area form state
  const [newAreaLocationId, setNewAreaLocationId] = useState('');
  const [newAreaName, setNewAreaName] = useState('');
  const [newAreaMinOrder, setNewAreaMinOrder] = useState('2000');
  const [newAreaBaseFee, setNewAreaBaseFee] = useState('500');

  // New delivery zone form state, keyed by service area id being edited
  const [zoneNameByArea, setZoneNameByArea] = useState<Record<string, string>>({});

  function load() {
    api
      .get<LocationNode[]>('/api/locations/tree')
      .then(setTree)
      .catch((e) => setError(e.message));
    api
      .get<ServiceAreaSummary[]>('/api/admin/service-areas')
      .then(async (areas) => {
        setServiceAreas(areas);
        const configs = await Promise.all(areas.map(async (area) => [area.id, await api.get<any>(`/api/admin/pricing/service-areas/${area.id}`)] as const));
        setRiderRateByArea(Object.fromEntries(configs.map(([id, config]) => [id, String(config.riderPayoutRatePercent ?? 92)])));
      })
      .catch((e) => setError(e.message));
  }

  useEffect(load, []);

  const flatLocations = flattenLocations(tree);

  async function createLocation(e: FormEvent) {
    e.preventDefault();
    try {
      await api.post('/api/admin/locations', {
        name: newLocationName,
        type: newLocationType,
        parentId: newLocationParentId || undefined,
      });
      setNewLocationName('');
      load();
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function createServiceArea(e: FormEvent) {
    e.preventDefault();
    try {
      await api.post('/api/admin/service-areas', {
        locationId: newAreaLocationId,
        name: newAreaName,
        minimumOrderAmount: Math.round(Number(newAreaMinOrder) * 100),
        baseDeliveryFee: Math.round(Number(newAreaBaseFee) * 100),
      });
      setNewAreaName('');
      load();
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function addZone(serviceAreaId: string) {
    const name = zoneNameByArea[serviceAreaId];
    if (!name) return;
    try {
      await api.post(`/api/admin/service-areas/${serviceAreaId}/delivery-zones`, { name });
      setZoneNameByArea((prev) => ({ ...prev, [serviceAreaId]: '' }));
      load();
    } catch (err: any) {
      setError(err.message);
    }
  }


  async function saveRiderRate(serviceAreaId: string) {
    const value = Number(riderRateByArea[serviceAreaId]);
    if (!Number.isFinite(value) || value < 0 || value > 100) { setError('Rider payout rate must be between 0% and 100%.'); return; }
    try { await api.patch(`/api/admin/pricing/service-areas/${serviceAreaId}`, { riderPayoutRatePercent: value }); setError(null); load(); }
    catch (err: any) { setError(err.message); }
  }

  async function setStatus(serviceAreaId: string, status: string) {
    try {
      await api.patch(`/api/admin/service-areas/${serviceAreaId}/status`, { status });
      load();
    } catch (err: any) {
      setError(err.message);
    }
  }

  return (
    <DashboardShell>
      <PageHeader
        title="Locations"
        description="The generic location tree, plus the service areas and delivery zones customers actually order into (§3, §94)."
      />

      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Location tree */}
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <h2 className="mb-3 text-sm font-semibold text-gray-900">Location tree</h2>
          <ul className="mb-4 space-y-1">
            {flatLocations.map(({ node, depth }) => (
              <li key={node.id} className="flex items-center gap-2 text-sm" style={{ paddingLeft: depth * 16 }}>
                <span className="text-gray-700">{node.name}</span>
                <span className="text-xs text-gray-400">{node.type}</span>
                {!node.isActive && <span className="text-xs text-red-500">(inactive)</span>}
              </li>
            ))}
            {flatLocations.length === 0 && <li className="text-sm text-gray-400">No locations yet.</li>}
          </ul>

          <form onSubmit={createLocation} className="space-y-2 border-t border-gray-100 pt-4">
            <p className="text-xs font-medium text-gray-500">Add a location</p>
            <input
              value={newLocationName}
              onChange={(e) => setNewLocationName(e.target.value)}
              placeholder="Name (e.g. Enugu, UNN, GRA)"
              required
              className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm"
            />
            <div className="flex gap-2">
              <select
                value={newLocationType}
                onChange={(e) => setNewLocationType(e.target.value as LocationType)}
                className="flex-1 rounded-md border border-gray-300 px-3 py-1.5 text-sm"
              >
                {LOCATION_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
              <select
                value={newLocationParentId}
                onChange={(e) => setNewLocationParentId(e.target.value)}
                className="flex-1 rounded-md border border-gray-300 px-3 py-1.5 text-sm"
              >
                <option value="">No parent (top-level)</option>
                {flatLocations.map(({ node }) => (
                  <option key={node.id} value={node.id}>
                    {node.name}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="submit"
              className="w-full rounded-md bg-brand-600 py-1.5 text-sm font-medium text-white hover:bg-brand-700"
            >
              Add location
            </button>
          </form>
        </div>

        {/* Service areas */}
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <h2 className="mb-3 text-sm font-semibold text-gray-900">Service areas</h2>
          <ul className="mb-4 space-y-3">
            {serviceAreas.map((area) => (
              <li key={area.id} className="rounded-lg border border-gray-100 p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-800">{area.name}</p>
                    <p className="text-xs text-gray-400">
                      {area.location.name} · min {formatNaira(area.minimumOrderAmount)} · base delivery{' '}
                      {formatNaira(area.baseDeliveryFee)}
                    </p>
                  </div>
                  <StatusBadge status={area.status} />
                </div>

                <div className="mt-2 text-xs text-gray-500">
                  Zones: {area.deliveryZones.map((z) => z.name).join(', ') || 'none yet'}
                </div>

                <div className="mt-2 flex items-center gap-2">
                  <label className="text-xs text-gray-500">Rider payout %</label>
                  <input type="number" min="0" max="100" step="0.01" value={riderRateByArea[area.id] ?? '92'} onChange={(e) => setRiderRateByArea((prev) => ({ ...prev, [area.id]: e.target.value }))} className="w-20 rounded-md border border-gray-300 px-2 py-1 text-xs" />
                  <button onClick={() => saveRiderRate(area.id)} className="rounded-md bg-gray-100 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-200">Save</button>
                </div>

                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <input
                    value={zoneNameByArea[area.id] || ''}
                    onChange={(e) => setZoneNameByArea((prev) => ({ ...prev, [area.id]: e.target.value }))}
                    placeholder="New zone name"
                    className="rounded-md border border-gray-300 px-2 py-1 text-xs"
                  />
                  <button
                    onClick={() => addZone(area.id)}
                    className="rounded-md bg-gray-100 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-200"
                  >
                    Add zone
                  </button>

                  {area.status !== 'ACTIVE' && (
                    <button
                      onClick={() => setStatus(area.id, 'ACTIVE')}
                      className="rounded-md bg-brand-600 px-2 py-1 text-xs font-medium text-white hover:bg-brand-700"
                    >
                      Activate
                    </button>
                  )}
                  {area.status === 'ACTIVE' && (
                    <button
                      onClick={() => setStatus(area.id, 'PAUSED')}
                      className="rounded-md bg-orange-100 px-2 py-1 text-xs font-medium text-orange-700 hover:bg-orange-200"
                    >
                      Pause
                    </button>
                  )}
                </div>
              </li>
            ))}
            {serviceAreas.length === 0 && <li className="text-sm text-gray-400">No service areas yet.</li>}
          </ul>

          <form onSubmit={createServiceArea} className="space-y-2 border-t border-gray-100 pt-4">
            <p className="text-xs font-medium text-gray-500">Add a service area</p>
            <select
              value={newAreaLocationId}
              onChange={(e) => setNewAreaLocationId(e.target.value)}
              required
              className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm"
            >
              <option value="">Select a location…</option>
              {flatLocations.map(({ node }) => (
                <option key={node.id} value={node.id}>
                  {node.name} ({node.type})
                </option>
              ))}
            </select>
            <input
              value={newAreaName}
              onChange={(e) => setNewAreaName(e.target.value)}
              placeholder="Service area name (e.g. FUTO Campus)"
              required
              className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm"
            />
            <div className="flex gap-2">
              <input
                value={newAreaMinOrder}
                onChange={(e) => setNewAreaMinOrder(e.target.value)}
                type="number"
                placeholder="Min order (₦)"
                className="flex-1 rounded-md border border-gray-300 px-3 py-1.5 text-sm"
              />
              <input
                value={newAreaBaseFee}
                onChange={(e) => setNewAreaBaseFee(e.target.value)}
                type="number"
                placeholder="Base delivery fee (₦)"
                className="flex-1 rounded-md border border-gray-300 px-3 py-1.5 text-sm"
              />
            </div>
            <button
              type="submit"
              className="w-full rounded-md bg-brand-600 py-1.5 text-sm font-medium text-white hover:bg-brand-700"
            >
              Add service area (starts as DRAFT)
            </button>
          </form>
        </div>
      </div>
    </DashboardShell>
  );
}
