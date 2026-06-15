export default function StatsBar({ stats }) {
  const items = [
    { label: 'Total Accounts', value: stats.total, color: 'text-gray-200' },
    { label: 'Healthy', value: stats.byLabel?.healthy || 0, color: 'text-green-400' },
    { label: 'Warning', value: stats.byLabel?.warning || 0, color: 'text-yellow-400' },
    { label: 'Poor', value: stats.byLabel?.poor || 0, color: 'text-orange-400' },
    { label: 'Critical', value: stats.byLabel?.critical || 0, color: 'text-red-400' },
    { label: 'Avg Health', value: `${stats.avgHealth}%`, color: stats.avgHealth >= 90 ? 'text-green-400' : stats.avgHealth >= 70 ? 'text-yellow-400' : 'text-red-400' },
  ]

  return (
    <div className="grid grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
      {items.map(item => (
        <div key={item.label} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <p className="text-xs text-gray-500 mb-1">{item.label}</p>
          <p className={`text-2xl font-bold ${item.color}`}>{item.value}</p>
        </div>
      ))}
    </div>
  )
}
