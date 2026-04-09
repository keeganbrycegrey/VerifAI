import React from 'react'

const OUTLETS = [
    { name: "VERA Files",               bias: "left",       score: 0.90, cls: "highly_reliable",    rss: false },
    { name: "Rappler",                  bias: "left",       score: 0.85, cls: "highly_reliable",    rss: true  },
    { name: "ABS-CBN News",             bias: "center",     score: 0.80, cls: "highly_reliable",    rss: false },
    { name: "GMA News",                 bias: "center",     score: 0.78, cls: "generally_reliable", rss: true  },
    { name: "CNN Philippines",          bias: "center",     score: 0.75, cls: "generally_reliable", rss: false },
    { name: "PhilStar",                 bias: "center",     score: 0.74, cls: "generally_reliable", rss: false },
    { name: "Inquirer",                 bias: "center",     score: 0.76, cls: "generally_reliable", rss: true  },
    { name: "Google News PH",           bias: "aggregator", score: 0.72, cls: "generally_reliable", rss: true  },
    { name: "Business Mirror",          bias: "center",     score: 0.70, cls: "generally_reliable", rss: true  },
    { name: "One News PH",              bias: "center",     score: 0.68, cls: "generally_reliable", rss: false },
    { name: "Manila Bulletin",          bias: "right",      score: 0.55, cls: "needs_context",      rss: false },
    { name: "Manila Standard",          bias: "right",      score: 0.48, cls: "needs_context",      rss: false },
    { name: "Eagle News",               bias: "right",      score: 0.45, cls: "needs_context",      rss: true  },
    { name: "Philippine News Agency",   bias: "state",      score: 0.40, cls: "state_media",        rss: true  },
]

const BIAS_STYLE = {
    left:       { bg: 'bg-blue-100',   text: 'text-blue-700'   },
    center:     { bg: 'bg-slate-100',  text: 'text-slate-600'  },
    right:      { bg: 'bg-red-100',    text: 'text-red-600'    },
    state:      { bg: 'bg-amber-100',  text: 'text-amber-700'  },
    aggregator: { bg: 'bg-purple-100', text: 'text-purple-700' },
}

const CLS_STYLE = {
    highly_reliable:    { color: 'text-green-600',  label: 'Highly Reliable'    },
    generally_reliable: { color: 'text-blue-500',   label: 'Generally Reliable' },
    needs_context:      { color: 'text-amber-500',  label: 'Needs Context'      },
    state_media:        { color: 'text-orange-500', label: 'State Media'        },
    unreliable:         { color: 'text-red-600',    label: 'Unreliable'         },
}

function ScoreBar({ score }) {
    const pct = Math.round(score * 100)
    const color = score >= 0.80 ? 'bg-green-500'
                : score >= 0.60 ? 'bg-blue-400'
                : score >= 0.40 ? 'bg-amber-400'
                : 'bg-red-500'
    return (
        <div className="flex items-center gap-2">
            <div className="w-20 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
            </div>
            <span className="text-xs text-slate-500">{pct}%</span>
        </div>
    )
}

export default function BiasRegistry() {
    return (
        <div className="p-10">
            <h2 className="text-2xl font-semibold text-slate-800 mb-1">Bias Registry</h2>
            <p className="text-sm text-slate-400 mb-6">
                Credibility and bias ratings based on CMFR assessments. Sorted by credibility score.
            </p>
            <div className="rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                <table className="w-full text-sm">
                    <thead className="bg-slate-900 text-white">
                        <tr>
                            <th className="text-left px-4 py-3 font-semibold">Outlet</th>
                            <th className="text-left px-4 py-3 font-semibold">Bias</th>
                            <th className="text-left px-4 py-3 font-semibold">Credibility</th>
                            <th className="text-left px-4 py-3 font-semibold">Score</th>
                            <th className="text-left px-4 py-3 font-semibold">RSS</th>
                        </tr>
                    </thead>
                    <tbody>
                        {OUTLETS.map((o, i) => {
                            const bs  = BIAS_STYLE[o.bias]  || BIAS_STYLE.center
                            const cls = CLS_STYLE[o.cls]    || CLS_STYLE.needs_context
                            return (
                                <tr key={o.name} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                                    <td className="px-4 py-3 font-medium text-slate-800">{o.name}</td>
                                    <td className="px-4 py-3">
                                        <span className={`px-2 py-0.5 rounded text-xs font-semibold ${bs.bg} ${bs.text}`}>
                                            {o.bias}
                                        </span>
                                    </td>
                                    <td className={`px-4 py-3 text-xs font-semibold ${cls.color}`}>{cls.label}</td>
                                    <td className="px-4 py-3"><ScoreBar score={o.score} /></td>
                                    <td className="px-4 py-3 text-xs">
                                        {o.rss
                                            ? <span className="text-green-600 font-bold">✓</span>
                                            : <span className="text-slate-300">—</span>
                                        }
                                    </td>
                                </tr>
                            )
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    )
}