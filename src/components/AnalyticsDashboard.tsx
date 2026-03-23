import { useState, useEffect } from 'react';
import { db, collection, query, orderBy, limit, getDocs, where } from '../firebase';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  BarChart, Bar, PieChart, Pie, Cell, Legend 
} from 'recharts';
import { Loader2, TrendingUp, Users, MousePointer2, Eye } from 'lucide-react';
import { format, subDays, startOfDay, isAfter } from 'date-fns';

const COLORS = ['#4f46e5', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

export function AnalyticsDashboard() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any[]>([]);
  const [stats, setStats] = useState({
    totalViews: 0,
    totalActions: 0,
    uniqueUsers: 0,
  });

  useEffect(() => {
    async function fetchAnalytics() {
      try {
        // Fetch last 7 days of logs
        const sevenDaysAgo = subDays(new Date(), 7);
        const q = query(
          collection(db, 'activity_logs'),
          where('timestamp', '>=', sevenDaysAgo),
          orderBy('timestamp', 'desc')
        );
        
        const snapshot = await getDocs(q);
        const logs = snapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            ...data,
            timestamp: data.timestamp?.toDate() || new Date()
          };
        }) as any[];

        setData(logs);

        // Calculate stats
        const views = logs.filter(l => l.type === 'page_view');
        const actions = logs.filter(l => l.type === 'action');
        const users = new Set(logs.map(l => l.userId).filter(Boolean));

        setStats({
          totalViews: views.length,
          totalActions: actions.length,
          uniqueUsers: users.size,
        });

        setLoading(false);
      } catch (error) {
        console.error('Error fetching analytics:', error);
        setLoading(false);
      }
    }

    fetchAnalytics();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
      </div>
    );
  }

  // Prepare Chart Data
  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const d = subDays(new Date(), i);
    return format(d, 'MM/dd');
  }).reverse();

  const trendData = last7Days.map(day => {
    const dayLogs = data.filter(l => format(l.timestamp, 'MM/dd') === day);
    return {
      name: day,
      views: dayLogs.filter(l => l.type === 'page_view').length,
      actions: dayLogs.filter(l => l.type === 'action').length,
    };
  });

  const pageData = Object.entries(
    data.filter(l => l.type === 'page_view').reduce((acc: any, l) => {
      const path = l.path || '/';
      acc[path] = (acc[path] || 0) + 1;
      return acc;
    }, {})
  ).map(([name, value]) => ({ name, value }))
   .sort((a: any, b: any) => b.value - a.value)
   .slice(0, 5);

  const actionData = Object.entries(
    data.filter(l => l.type === 'action').reduce((acc: any, l) => {
      const action = l.action || 'unknown';
      acc[action] = (acc[action] || 0) + 1;
      return acc;
    }, {})
  ).map(([name, value]) => ({ name, value }));

  return (
    <div className="space-y-8 pb-20">
      <div className="flex items-center gap-4 mb-8">
        <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center shadow-sm">
          <TrendingUp className="w-5 h-5 text-indigo-600" />
        </div>
        <div>
          <h2 className="text-lg font-black text-gray-900">分析ダッシュボード</h2>
          <p className="text-gray-400 text-[10px] font-bold uppercase tracking-widest">多角的なアクセス分析</p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <Eye className="w-4 h-4 text-blue-500" />
            <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">総ページビュー</span>
          </div>
          <div className="text-2xl font-black text-gray-900">{stats.totalViews}</div>
        </div>
        <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <MousePointer2 className="w-4 h-4 text-emerald-500" />
            <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">総アクション数</span>
          </div>
          <div className="text-2xl font-black text-gray-900">{stats.totalActions}</div>
        </div>
        <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <Users className="w-4 h-4 text-amber-500" />
            <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">ユニークユーザー</span>
          </div>
          <div className="text-2xl font-black text-gray-900">{stats.uniqueUsers}</div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Trend Chart */}
        <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
          <h3 className="text-xs font-black uppercase tracking-widest text-gray-400 mb-6">アクセス推移 (直近7日間)</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#9ca3af' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#9ca3af' }} />
                <Tooltip 
                  contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  labelStyle={{ fontWeight: 'bold', marginBottom: '4px' }}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 10, paddingTop: 20 }} />
                <Line type="monotone" dataKey="views" name="ページビュー" stroke="#4f46e5" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                <Line type="monotone" dataKey="actions" name="アクション" stroke="#10b981" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Top Pages Chart */}
        <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
          <h3 className="text-xs font-black uppercase tracking-widest text-gray-400 mb-6">人気ページ (Top 5)</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={pageData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f3f4f6" />
                <XAxis type="number" hide />
                <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#9ca3af' }} width={100} />
                <Tooltip 
                  cursor={{ fill: '#f9fafb' }}
                  contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                />
                <Bar dataKey="value" name="ビュー数" fill="#4f46e5" radius={[0, 4, 4, 0]} barSize={20} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Action Distribution */}
        <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
          <h3 className="text-xs font-black uppercase tracking-widest text-gray-400 mb-6">アクション内訳</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={actionData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {actionData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 10, paddingTop: 20 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Recent Activity List */}
        <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
          <h3 className="text-xs font-black uppercase tracking-widest text-gray-400 mb-6">最近のアクティビティ</h3>
          <div className="space-y-4 max-h-64 overflow-y-auto pr-2 custom-scrollbar">
            {data.slice(0, 10).map((log) => (
              <div key={log.id} className="flex items-start justify-between gap-4 py-2 border-b border-gray-50 last:border-0">
                <div className="flex flex-col">
                  <span className="text-[10px] font-bold text-gray-900">
                    {log.type === 'page_view' ? 'ページ閲覧' : `アクション: ${log.action}`}
                  </span>
                  <span className="text-[9px] text-gray-400 font-mono truncate max-w-[150px]">
                    {log.path || '-'}
                  </span>
                </div>
                <span className="text-[9px] text-gray-400 whitespace-nowrap">
                  {format(log.timestamp, 'HH:mm:ss')}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
