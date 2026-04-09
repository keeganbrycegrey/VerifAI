import React, { useEffect, useState } from 'react'
import { getCoverage } from '../api/client'

export default function CoverageMap() {
    const [data, setData]       = useState({})
    const [loading, setLoading] = useState(true)
    const [error, setError]     = useState(null)

    useEffect(() => {
        let cancelled = false
        async function load() {
            setLoading(true); setError(null)
            try {
                const res = await getCoverage()
                if (!cancelled) setData(res.outlet_frequency || {})
            } catch (err) {
                if (!cancelled) setError(err.message || 'Failed to load.')
            } finally {
                if (!cancelled) setLoading(false)
            }
        }
        load()
        return () => { cancelled = true }
    }, [])

    if (loading) return <div className="p-10 text-slate-400">Loading coverage map...</div>
    if (error)   return <div className="p-10 text-red-500">Error: {error}</div>

    const entries = Object.entries(data).sort((a, b) => b[1] - a[1])
    const max     = entries[0]?.[1] || 1

    if (entries.length === 0) {
        return <div className="p-10 text-slate-400">No coverage data yet. Run some checks first.</div>
    }

    return (
        <div className="p-10">
            <h2 className="text-2xl font-semibold text-slate-800 mb-1">Coverage Map</h2>
            <p className="text-sm text-slate-400 mb-6">
                How often each outlet appeared in coverage analysis across all checked claims.
            </p>
            <div className="space-y-4 max-w-xl">
                {entries.map(([outlet, count]) => {
                    const pct = Math.round((count / max) * 100)
                    return (
                        <div key={outlet}>
                            <div className="flex justify-between text-sm mb-1">
                                <span className="font-medium text-slate-700">{outlet}</span>
                                <span className="text-slate-400 text-xs">{count} article{count !== 1 ? 's' : ''}</span>
                            </div>
                            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-slate-700 rounded-full transition-all duration-500"
                                    style={{ width: `${pct}%` }}
                                />
                            </div>
                        </div>
                    )
                })}
            </div>
        </div>
    )
}