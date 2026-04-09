import React, { useEffect, useState } from 'react'
import { getDashboardFeed } from '../api/client'

const RATING_COLOR = {
    true:          'text-green-600',
    false:         'text-red-500',
    misleading:    'text-amber-500',
    unverified:    'text-slate-400',
    needs_context: 'text-blue-500',
}

const RATING_EMOJI = {
    true: '✅', false: '❌', misleading: '⚠️',
    unverified: '🔍', needs_context: 'ℹ️',
}

export default function VerdictFeed() {
    const [feed, setFeed]       = useState(null)
    const [loading, setLoading] = useState(true)
    const [error, setError]     = useState(null)

    useEffect(() => {
        let cancelled = false
        async function load() {
            setLoading(true); setError(null)
            try {
                const data = await getDashboardFeed()
                if (!cancelled) setFeed(data)
            } catch (err) {
                if (!cancelled) setError(err.message || 'Failed to load.')
            } finally {
                if (!cancelled) setLoading(false)
            }
        }
        load()
        return () => { cancelled = true }
    }, [])

    if (loading) return <div className="p-10 text-slate-400">Loading verdict feed...</div>
    if (error)   return <div className="p-10 text-red-500">Error: {error}</div>

    const recent = feed?.recent_verdicts ?? []
    if (recent.length === 0) return <div className="p-10 text-slate-400">No verdicts yet.</div>

    return (
        <div className="p-10">
            <h2 className="text-2xl font-semibold text-slate-800 mb-1">Verdict Feed</h2>
            <p className="text-sm text-slate-400 mb-6">
                {feed?.total_checks_today ?? 0} checks today · {feed?.total_checks_all_time ?? 0} total
            </p>
            <div className="space-y-3">
                {recent.map((item) => {
                    const emoji = RATING_EMOJI[item.rating] || '🔍'
                    const color = RATING_COLOR[item.rating] || 'text-slate-400'
                    const pct   = Math.round(item.confidence * 100)
                    const time  = new Date(item.timestamp).toLocaleString('en-PH')
                    return (
                        <article
                            key={`${item.claim}-${item.timestamp}`}
                            className="rounded-xl border border-slate-200 p-4 bg-white shadow-sm"
                        >
                            <div className="flex justify-between items-start gap-4">
                                <p className="font-medium text-slate-800 text-sm leading-snug">{item.claim}</p>
                                <span className="text-xs text-slate-400 whitespace-nowrap shrink-0">{time}</span>
                            </div>
                            <div className="mt-2 flex justify-between items-center">
                                <span className={`text-sm font-bold ${color}`}>{emoji} {item.rating.replace('_', ' ').toUpperCase()}</span>
                                <span className="text-sm text-slate-400">{pct}% confidence</span>
                            </div>
                            <div className="mt-1 text-xs text-slate-400">via {item.source_surface}</div>
                        </article>
                    )
                })}
            </div>
        </div>
    )
}