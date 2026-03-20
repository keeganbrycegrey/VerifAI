import React, { useEffect, useState } from 'react';
import { getTrendingClaims } from '../api/client';

export default function TrendingClaims() {
    const [claims, setClaims] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        let cancelled = false;

        async function loadTrending() {
            setLoading(true);
            setError(null);
            try {
                const data = await getTrendingClaims();
                if (!cancelled) setClaims(data);
            } catch (err) {
                if (!cancelled) setError(err.message || 'Failed to load trending claims');
            } finally {
                if (!cancelled) setLoading(false);
            }
        }

        loadTrending();
        return () => {
            cancelled = true;
        };
    }, []);

    if (loading) {
        return <div className="p-10 text-slate-600">Loading trending claims…</div>;
    }

    if (error) {
        return <div className="p-10 text-red-600">Error loading trending claims: {error}</div>;
    }

    if (claims.length === 0) {
        return <div className="p-10 text-slate-600">No trending claims yet.</div>;
    }

    return (
        <div className="p-10">
            <h2 className="text-2xl font-semibold text-slate-800 mb-4">Most-Checked Claims</h2>
            <div className="space-y-4">
                {claims.map((item) => {
                    const validity = item.validity_index ?? (item.check_count ? Math.min(1, item.check_count / 20) : 0.4);
                    const explanation = item.explanation || 'No explanation available yet.';

                    return (
                        <article
                            key={`${item.claim}-${item.first_seen}`}
                            className="rounded-xl border border-slate-200 p-4 bg-white shadow-sm"
                        >
                            <h3 className="font-semibold text-slate-800">{item.claim}</h3>
                            <div className="mt-1 text-xs text-slate-500">
                                Checked {item.check_count} times · Verdict: {item.dominant_rating?.toUpperCase() || 'N/A'}
                            </div>
                            <div className="mt-2 text-sm text-slate-700">Validity index: {(validity * 100).toFixed(0)}%</div>
                            <div className="mt-2 text-sm text-slate-600">{explanation}</div>
                            <div className="mt-2 text-xs text-slate-400">First seen: {item.first_seen ? new Date(item.first_seen).toLocaleDateString() : 'N/A'} · Last seen: {item.last_seen ? new Date(item.last_seen).toLocaleDateString() : 'N/A'}</div>
                        </article>
                    );
                })}
            </div>
        </div>
    );
}

