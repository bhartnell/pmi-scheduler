'use client';

import { useState, useEffect } from 'react';
import {
  Package,
  ChevronDown,
  RotateCcw,
  AlertTriangle,
  HelpCircle,
  X,
  Plus,
} from 'lucide-react';
import type { EquipmentItem, Station } from './types';

interface EquipmentSectionProps {
  labDayId: string;
  stations: Station[];
}

export default function EquipmentSection({ labDayId, stations }: EquipmentSectionProps) {
  const [equipmentItems, setEquipmentItems] = useState<EquipmentItem[]>([]);
  const [equipmentCollapsed, setEquipmentCollapsed] = useState(false);
  const [equipmentLoading, setEquipmentLoading] = useState(false);
  const [newEquipmentName, setNewEquipmentName] = useState('');
  const [newEquipmentQty, setNewEquipmentQty] = useState(1);
  const [newEquipmentStation, setNewEquipmentStation] = useState('');
  const [addingEquipment, setAddingEquipment] = useState(false);

  useEffect(() => {
    fetchEquipmentItems();
  }, [labDayId]);

  const fetchEquipmentItems = async () => {
    setEquipmentLoading(true);
    try { const res = await fetch(`/api/lab-management/lab-days/${labDayId}/equipment`); const data = await res.json(); if (data.success) setEquipmentItems(data.items || []); }
    catch (error) { console.error('Error:', error); }
    setEquipmentLoading(false);
  };

  const handleAddEquipmentItem = async () => {
    if (!newEquipmentName.trim()) return; setAddingEquipment(true);
    try { const res = await fetch(`/api/lab-management/lab-days/${labDayId}/equipment`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: newEquipmentName.trim(), quantity: newEquipmentQty, station_id: newEquipmentStation || null }) }); const data = await res.json(); if (data.success) { setEquipmentItems(prev => [...prev, data.item]); setNewEquipmentName(''); setNewEquipmentQty(1); setNewEquipmentStation(''); } else alert('Failed: ' + (data.error || 'Unknown')); }
    catch (error) { console.error('Error:', error); alert('Failed to add equipment'); }
    setAddingEquipment(false);
  };

  const handleUpdateEquipmentStatus = async (item: EquipmentItem, newStatus: EquipmentItem['status']) => {
    setEquipmentItems(prev => prev.map(i => i.id === item.id ? { ...i, status: newStatus } : i));
    try { const res = await fetch(`/api/lab-management/lab-days/${labDayId}/equipment`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ item_id: item.id, status: newStatus }) }); const data = await res.json(); if (data.success) setEquipmentItems(prev => prev.map(i => i.id === item.id ? data.item : i)); else setEquipmentItems(prev => prev.map(i => i.id === item.id ? { ...i, status: item.status } : i)); }
    catch { setEquipmentItems(prev => prev.map(i => i.id === item.id ? { ...i, status: item.status } : i)); }
  };

  const handleDeleteEquipmentItem = async (itemId: string) => {
    setEquipmentItems(prev => prev.filter(i => i.id !== itemId));
    try { const res = await fetch(`/api/lab-management/lab-days/${labDayId}/equipment?itemId=${itemId}`, { method: 'DELETE' }); const data = await res.json(); if (!data.success) await fetchEquipmentItems(); }
    catch { await fetchEquipmentItems(); }
  };

  return (
    <div className="mt-6 bg-white dark:bg-gray-800 rounded-lg shadow print:shadow-none print:border print:border-gray-300">
      {/* Equipment Header */}
      <div className="flex items-center justify-between p-4 border-b dark:border-gray-700">
        <button
          onClick={() => setEquipmentCollapsed(prev => !prev)}
          className="print-include flex items-center gap-2 text-left flex-1 min-w-0"
        >
          <Package className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0" />
          <h3 className="font-semibold text-gray-900 dark:text-white">Equipment &amp; Supplies</h3>
          {equipmentItems.length > 0 && (
            <span className="ml-2 text-sm text-gray-500 dark:text-gray-400 shrink-0">
              {equipmentItems.filter(i => i.status === 'checked_out').length} out,{' '}
              {equipmentItems.filter(i => i.status === 'returned').length} returned
              {equipmentItems.filter(i => i.status === 'damaged' || i.status === 'missing').length > 0 && (
                <span className="text-red-600 dark:text-red-400">
                  , {equipmentItems.filter(i => i.status === 'damaged' || i.status === 'missing').length} issues
                </span>
              )}
            </span>
          )}
          <ChevronDown className={`w-4 h-4 text-gray-400 shrink-0 transition-transform duration-200 ${equipmentCollapsed ? '-rotate-90' : ''}`} />
        </button>
      </div>

      {/* Equipment Body */}
      {!equipmentCollapsed && (
        <div className="p-4">
          {equipmentLoading ? (
            <div className="flex items-center justify-center py-6">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-amber-500"></div>
            </div>
          ) : (
            <>
              {/* Summary badges */}
              {equipmentItems.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-4 print:hidden">
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300">
                    {equipmentItems.filter(i => i.status === 'checked_out').length} Checked Out
                  </span>
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">
                    {equipmentItems.filter(i => i.status === 'returned').length} Returned
                  </span>
                  {equipmentItems.filter(i => i.status === 'damaged').length > 0 && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300">
                      {equipmentItems.filter(i => i.status === 'damaged').length} Damaged
                    </span>
                  )}
                  {equipmentItems.filter(i => i.status === 'missing').length > 0 && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300">
                      {equipmentItems.filter(i => i.status === 'missing').length} Missing
                    </span>
                  )}
                </div>
              )}

              {/* Items list */}
              {equipmentItems.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
                  No equipment tracked yet. Add items below to track checked-out supplies.
                </p>
              ) : (
                <div className="mb-4 overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider border-b dark:border-gray-700">
                        <th className="pb-2 pr-4">Item</th>
                        <th className="pb-2 pr-4">Qty</th>
                        <th className="pb-2 pr-4">Station</th>
                        <th className="pb-2 pr-4">Status</th>
                        <th className="pb-2 print:hidden">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                      {equipmentItems.map(item => (
                        <tr key={item.id} className="group">
                          <td className="py-2 pr-4">
                            <div className="font-medium text-gray-900 dark:text-white">{item.name}</div>
                            {item.notes && (
                              <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{item.notes}</div>
                            )}
                          </td>
                          <td className="py-2 pr-4 text-gray-700 dark:text-gray-300">{item.quantity}</td>
                          <td className="py-2 pr-4 text-gray-500 dark:text-gray-400">
                            {item.station
                              ? `Stn ${item.station.station_number}${item.station.custom_title ? ': ' + item.station.custom_title : ''}`
                              : <span className="text-gray-300 dark:text-gray-600">&mdash;</span>
                            }
                          </td>
                          <td className="py-2 pr-4">
                            {item.status === 'checked_out' && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300">
                                Checked Out
                              </span>
                            )}
                            {item.status === 'returned' && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">
                                Returned
                              </span>
                            )}
                            {item.status === 'damaged' && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300">
                                Damaged
                              </span>
                            )}
                            {item.status === 'missing' && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300">
                                Missing
                              </span>
                            )}
                          </td>
                          <td className="py-2 print:hidden">
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              {item.status !== 'returned' && (
                                <button
                                  onClick={() => handleUpdateEquipmentStatus(item, 'returned')}
                                  title="Mark Returned"
                                  className="p-1 text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 rounded"
                                >
                                  <RotateCcw className="w-3.5 h-3.5" />
                                </button>
                              )}
                              {item.status !== 'damaged' && (
                                <button
                                  onClick={() => handleUpdateEquipmentStatus(item, 'damaged')}
                                  title="Mark Damaged"
                                  className="p-1 text-orange-600 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-900/20 rounded"
                                >
                                  <AlertTriangle className="w-3.5 h-3.5" />
                                </button>
                              )}
                              {item.status !== 'missing' && (
                                <button
                                  onClick={() => handleUpdateEquipmentStatus(item, 'missing')}
                                  title="Mark Missing"
                                  className="p-1 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                                >
                                  <HelpCircle className="w-3.5 h-3.5" />
                                </button>
                              )}
                              {item.status !== 'checked_out' && (
                                <button
                                  onClick={() => handleUpdateEquipmentStatus(item, 'checked_out')}
                                  title="Mark Checked Out"
                                  className="p-1 text-yellow-600 dark:text-yellow-400 hover:bg-yellow-50 dark:hover:bg-yellow-900/20 rounded"
                                >
                                  <Package className="w-3.5 h-3.5" />
                                </button>
                              )}
                              <button
                                onClick={() => handleDeleteEquipmentItem(item.id)}
                                title="Remove item"
                                className="p-1 text-gray-300 dark:text-gray-600 hover:text-red-500 dark:hover:text-red-400 rounded ml-1"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Add item form */}
              <div className="flex flex-wrap gap-2 print:hidden">
                <input
                  type="text"
                  value={newEquipmentName}
                  onChange={e => setNewEquipmentName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleAddEquipmentItem(); }}
                  placeholder="Item name (e.g. BVM, AED trainer)"
                  className="flex-1 min-w-[180px] px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-amber-500 dark:focus:ring-amber-400"
                />
                <input
                  type="number"
                  min={1}
                  value={newEquipmentQty}
                  onChange={e => setNewEquipmentQty(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-16 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-amber-500 dark:focus:ring-amber-400"
                  title="Quantity"
                />
                <select
                  value={newEquipmentStation}
                  onChange={e => setNewEquipmentStation(e.target.value)}
                  className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-amber-500 dark:focus:ring-amber-400"
                >
                  <option value="">No station</option>
                  {stations?.map(station => (
                    <option key={station.id} value={station.id}>
                      Stn {station.station_number}{station.custom_title ? ': ' + station.custom_title : station.scenario ? ': ' + station.scenario.title : ''}
                    </option>
                  ))}
                </select>
                <button
                  onClick={handleAddEquipmentItem}
                  disabled={addingEquipment || !newEquipmentName.trim()}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-sm bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Plus className="w-4 h-4" />
                  Add
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
