import React from 'react'
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom'
import VerdictFeed    from './components/VerdictFeed'
import TrendingClaims from './components/TrendingClaims'
import CoverageMap    from './components/CoverageMap'
import BiasRegistry   from './components/BiasRegistry'

function NavLink({ to, children }) {
    const location = useLocation()
    const active   = location.pathname === to
    return (
        <Link
            to={to}
            className={`text-sm transition ${active ? 'text-white font-semibold' : 'text-gray-400 hover:text-white'}`}
        >
            {children}
        </Link>
    )
}

function App() {
    return (
        <Router>
            <div className="flex min-h-screen bg-white">
                <nav className="w-56 bg-slate-900 text-white p-6 shadow-xl flex flex-col">
                    <div className="text-2xl font-black tracking-tighter mb-2">VerifAI</div>
                    <div className="text-xs text-gray-500 mb-8 uppercase tracking-widest">Dashboard</div>
                    <div className="space-y-5 flex flex-col">
                        <NavLink to="/">Overview</NavLink>
                        <NavLink to="/feed">Verdict Feed</NavLink>
                        <NavLink to="/trending">Trending Claims</NavLink>
                        <NavLink to="/coverage">Coverage Map</NavLink>
                        <NavLink to="/bias">Bias Registry</NavLink>
                    </div>
                </nav>

                <main className="flex-1 overflow-y-auto bg-gray-50">
                    <Routes>
                        <Route path="/" element={
                            <div className="p-10">
                                <h1 className="text-3xl font-bold text-slate-800">VerifAI</h1>
                                <p className="mt-2 text-slate-500">Philippine Multimodal AI-powered fact checking hub.</p>
                                <div className="mt-8 grid grid-cols-2 gap-4 max-w-lg">
                                    <Link to="/feed"     className="p-4 rounded-xl border border-slate-200 bg-white shadow-sm hover:shadow-md transition">
                                        <div className="font-semibold text-slate-800">Verdict Feed</div>
                                        <div className="text-xs text-slate-400 mt-1">Recent fact-checks</div>
                                    </Link>
                                    <Link to="/trending" className="p-4 rounded-xl border border-slate-200 bg-white shadow-sm hover:shadow-md transition">
                                        <div className="font-semibold text-slate-800">Trending</div>
                                        <div className="text-xs text-slate-400 mt-1">Most-checked claims</div>
                                    </Link>
                                    <Link to="/coverage" className="p-4 rounded-xl border border-slate-200 bg-white shadow-sm hover:shadow-md transition">
                                        <div className="font-semibold text-slate-800">Coverage Map</div>
                                        <div className="text-xs text-slate-400 mt-1">Outlet frequency</div>
                                    </Link>
                                    <Link to="/bias"     className="p-4 rounded-xl border border-slate-200 bg-white shadow-sm hover:shadow-md transition">
                                        <div className="font-semibold text-slate-800">Bias Registry</div>
                                        <div className="text-xs text-slate-400 mt-1">News outlet ratings</div>
                                    </Link>
                                </div>
                            </div>
                        }/>
                        <Route path="/feed"     element={<VerdictFeed />} />
                        <Route path="/trending" element={<TrendingClaims />} />
                        <Route path="/coverage" element={<CoverageMap />} />
                        <Route path="/bias"     element={<BiasRegistry />} />
                    </Routes>
                </main>
            </div>
        </Router>
    )
}

export default App