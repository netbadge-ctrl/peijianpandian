import React, { useMemo } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend } from 'recharts';
import { InventoryItem } from '../types';

interface InventoryStatsProps {
  items: InventoryItem[];
}

const COLORS = ['#6366f1', '#ec4899', '#8b5cf6', '#10b981', '#f59e0b', '#3b82f6', '#64748b'];

const InventoryStats: React.FC<InventoryStatsProps> = ({ items }) => {
  
  const categoryData = useMemo(() => {
    const counts: Record<string, number> = {};
    items.forEach(item => {
      counts[item.category] = (counts[item.category] || 0) + item.quantity;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [items]);

  const totalItems = items.reduce((acc, item) => acc + item.quantity, 0);

  return (
    <div className="space-y-4 pb-6">
      {/* Stats Grid - 2 Columns for Mobile */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
          <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">总库存数</p>
          <p className="text-3xl font-bold text-slate-900 mt-1">{totalItems}</p>
        </div>
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
          <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">品类总数</p>
          <p className="text-3xl font-bold text-indigo-600 mt-1">{categoryData.length}</p>
        </div>
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
          <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">最近更新</p>
          <p className="text-xl font-bold text-emerald-600 mt-2">{items.length > 0 ? '刚刚' : '-'}</p>
        </div>
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
          <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">低库存</p>
          <p className="text-3xl font-bold text-amber-500 mt-1">
            {items.filter(i => i.quantity < 3).length}
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-4">
        {/* Distribution Chart */}
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
          <h3 className="text-base font-bold text-slate-800 mb-2">库存分类分布</h3>
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={categoryData}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={75}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {categoryData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', fontSize: '12px' }}
                />
                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }}/>
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Quantity Bar Chart */}
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
          <h3 className="text-base font-bold text-slate-800 mb-2">主要组件数量</h3>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={categoryData}
                layout="vertical"
                margin={{ top: 5, right: 10, left: 10, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                <XAxis type="number" hide />
                <YAxis 
                    dataKey="name" 
                    type="category" 
                    tick={{ fontSize: 11, fill: '#64748b' }} 
                    width={45}
                />
                <Tooltip 
                    cursor={{fill: '#f8fafc'}}
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', fontSize: '12px' }}
                />
                <Bar dataKey="value" fill="#6366f1" radius={[0, 4, 4, 0]} barSize={16} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InventoryStats;