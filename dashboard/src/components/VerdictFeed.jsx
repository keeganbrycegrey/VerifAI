import React, { useEffect, useState } from 'react';
import { getDashboardFeed } from '../api/client';

export default function VerdictFeed() {
    const [feed, setFeed] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        let cancelled = false;

        async function loadFeed() {
            setLoading(true);
            setError(null);
            try {
                const data = await getDashboardFeed();
                if (!cancelled) setFeed(data);
            } catch (err) {
                if (!cancelled) setError(err.message || 'Failed to load verdict feed.');
            } finally {
                if (!cancelled) setLoading(false);
            }
        }

        loadFeed();
        return () => {
            cancelled = true;
        };
    }, []);

    if (loading) {
        return <div className="p-10 text-slate-600">Loading verdict history...</div>;
    }

    if (error) {
        return <div className="p-10 text-red-600">Error: {error}</div>;
    }

    const recent = feed?.recent_verdicts ?? [];

    if (recent.length === 0) {
        return <div className="p-10 text-slate-600">No historical verdicts yet.</div>;
    }

    return (
        <div className="p-10">
            <h2 className="text-2xl font-semibold text-slate-800 mb-4">Verdict History</h2>
            <div className="space-y-4">
                {recent.map((item) => (
                    <article
                        key={`${item.claim}-${item.timestamp}`}
                        className="rounded-xl border border-slate-200 p-4 bg-white shadow-sm"
                    >
                        <header className="flex justify-between items-start">
                            <h3 className="font-semibold text-slate-800">{item.claim}</h3>
                            <span className="text-xs text-slate-500">{new Date(item.timestamp).toLocaleString()}</span>
                        </header>
                        <div className="mt-2 flex justify-between items-center">
                            <div className="text-sm">Verdict: <strong>{item.rating.toUpperCase()}</strong></div>
                            <div className="text-sm">Validity: <strong>{Math.round(item.confidence * 100)}%</strong></div>
                        </div>
                        <div className="mt-2 text-sm text-slate-600">Source: {item.source_surface || 'Unknown'}</div>
                        <div className="mt-2 text-sm text-slate-700">
                            Explanation: {item.explanation_en || 'No explanation saved.'}
                        </div>
                    </article>
                ))}
            </div>
        </div>
    );
}

