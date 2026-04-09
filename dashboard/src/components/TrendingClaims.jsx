import React, { useEffect, useState } from 'react'
import { getTrendingClaims } from '../api/client'

const RATING_COLOR = {
    true:          'text-green-600',
    false:         'text-red-500',
    misleading:    'text-amber-500',
    unverified:    'text-slate-400',
    needs_context: 'text-blue-500',
}

export default function TrendingClaims() {
    const [claims, setClaims]   = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError]     = useState(null)

    useEffect(() => {
        let cancelled = false
        async function load() {
            setLoading(true); setError(null)
            try {
                const data = await getTrendingClaims()
                if (!cancelled) setClaims(data)
            } catch (err) {
                if (!cancelled) setError(err.message || 'Failed to load.')
            } finally {
                if (!cancelled) setLoading(false)
            }
        }
        load()
        return () => { cancelled = true }
    }, [])

    if (loading) return <div className="p-10 text-slate-400">Loading trending claims...</div>
    if (error)   return <div className="p-10 text-red-500">Error: {error}</div>
    if (claims.length === 0) return <div className="p-10 text-slate-400">No trending claims yet.</div>

    return (
        <div className="p-10">
            <h2 className="text-2xl font-semibold text-slate-800 mb-6">Trending Claims</h2>
            <div className="space-y-3">
                {claims.map((item, i) => {
                    const color = RATING_COLOR[item.dominant_rating] || 'text-slate-400'
                    return (
                        <article
                            key={`${item.claim}-${item.first_seen}`}
                            className="rounded-xl border border-slate-200 p-4 bg-white shadow-sm flex gap-4"
                        >
                            <span className="text-2xl font-black text-slate-200 w-8 shrink-0 leading-none pt-1">{i + 1}</span>
                            <div className="flex-1 min-w-0">
                                <p className="font-medium text-slate-800 text-sm leading-snug">{item.claim}</p>
                                <div className="mt-1 flex gap-4 text-xs">
                                    <span className="text-slate-400">Checked {item.check_count}×</span>
                                    <span className={`font-semibold ${color}`}>
                                        {item.dominant_rating?.replace('_', ' ').toUpperCase() || 'N/A'}
                                    </span>
                                </div>
                                <div className="mt-1 text-xs text-slate-400">
                                    First seen: {item.first_seen ? new Date(item.first_seen).toLocaleDateString('en-PH') : 'N/A'}
                                    &nbsp;·&nbsp;
                                    Last seen: {item.last_seen ? new Date(item.last_seen).toLocaleDateString('en-PH') : 'N/A'}
                                </div>
                            </div>
                        </article>
                    )
                })}
            </div>
        </div>
    )
}