import AccountCard from './AccountCard'

export default function AccountList({ accounts }) {
  if (accounts.length === 0) {
    return (
      <div className="chrome-surface text-center py-10 md:py-12">
        <p className="text-[var(--tx-muted)] text-sm" style={{ fontFamily: "'Bebas Neue', sans-serif", letterSpacing: '0.06em' }}>NO MATCHES</p>
        <p className="text-[var(--tx-dim)] text-xs mt-1">no accounts match your filter</p>
      </div>
    )
  }

  const sorted = [...accounts].sort((a, b) => a.health_score - b.health_score)

  return (
    <div className="space-y-px">
      <div className="flex items-center justify-between text-[10px] text-[var(--tx-muted)] px-1 mb-2 tracking-wider">
        <span>{sorted.length} ACCOUNTS</span>
        <span>WORST FIRST</span>
      </div>
      {sorted.map(acc => (
        <AccountCard key={acc.email} account={acc} />
      ))}
    </div>
  )
}
