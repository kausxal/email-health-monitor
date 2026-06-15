import AccountCard from './AccountCard'

export default function AccountList({ accounts }) {
  if (accounts.length === 0) {
    return (
      <div className="text-center py-12 bg-gray-900 border border-gray-800 rounded-xl">
        <div className="text-3xl mb-3">📭</div>
        <p className="text-gray-500">No accounts match your filter</p>
      </div>
    )
  }

  const sorted = [...accounts].sort((a, b) => a.health_score - b.health_score)

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs text-gray-600 px-1 mb-2">
        <span>{sorted.length} accounts</span>
        <span>Worst health first</span>
      </div>
      {sorted.map(acc => (
        <AccountCard key={acc.email} account={acc} />
      ))}
    </div>
  )
}
