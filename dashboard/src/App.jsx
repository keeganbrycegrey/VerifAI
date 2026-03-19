import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';

// placeholders
const Home = () => (
    <div className="p-10">
        <h1 className="text-3xl font-bold text-slate-800">Global Verification Hub</h1>
        <p className="mt-4 text-slate-600">Checking claims across the Philippines in real-time.</p>
    </div>
);

const VerdictFeed = () => (
    <div className="p-10">
        <h1 className="text-2xl font-bold">Global Cache Feed</h1>
        <p className="text-sm text-gray-500">Recent fact-checks saved to Supabase.</p>
    </div>
);

function App() {
    return (
        <Router>
            <div className="flex min-h-screen bg-white">
                <nav className="w-64 bg-slate-900 text-white p-6 shadow-xl">
                    <div className="text-2xl font-black tracking-tighter mb-10">VerifAI</div>
                    <div className="space-y-4 flex flex-col">
                        <Link to="/" className="text-gray-400 hover:text-white transition">Overview</Link>
                        <Link to="/feed" className="text-gray-400 hover:text-white transition">Global Feed</Link>
                        <Link to="/coverage" className="text-gray-400 hover:text-white transition">Media Bias Map</Link>
                    </div>
                </nav>

                {/* content area */}
                <main className="flex-1 overflow-y-auto">
                    <Routes>
                        <Route path="/" element={<Home />} />
                        <Route path="/feed" element={<VerdictFeed />} />
                        {/* placeholder para sa coverage map ni keegan */}
                        <Route path="/coverage" element={<div className="p-10">Heatmap Loading...</div>} />
                    </Routes>
                </main>
            </div>
        </Router>
    );
}

export default App;
