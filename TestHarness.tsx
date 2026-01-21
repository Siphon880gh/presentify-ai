
import React from 'react';

const TestHarness: React.FC = () => {
  return (
    <div className="p-8 bg-slate-900 text-white min-h-screen font-mono">
      <div className="max-w-4xl mx-auto">
        <header className="mb-10 border-b border-slate-700 pb-6">
          <h1 className="text-4xl font-black text-indigo-400">Presentify AI - Test Harness</h1>
          <p className="text-slate-400 mt-2">Diagnostic environment active via <code>config.testMode</code></p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <section className="bg-slate-800 p-6 rounded-2xl border border-slate-700 shadow-xl">
            <h2 className="text-xl font-bold mb-4 flex items-center">
              <span className="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
              Environment
            </h2>
            <ul className="space-y-3 text-sm">
              <li className="flex justify-between border-b border-slate-700/50 pb-2">
                <span className="text-slate-500 uppercase text-[10px] font-bold">API Key</span>
                <span className={process.env.API_KEY ? "text-green-400" : "text-red-400"}>
                  {process.env.API_KEY ? 'LOADED' : 'MISSING'}
                </span>
              </li>
              <li className="flex justify-between border-b border-slate-700/50 pb-2">
                <span className="text-slate-500 uppercase text-[10px] font-bold">Mode</span>
                <span className="text-indigo-300">Development</span>
              </li>
            </ul>
          </section>

          <section className="bg-slate-800 p-6 rounded-2xl border border-slate-700 shadow-xl">
            <h2 className="text-xl font-bold mb-4 flex items-center">
              <span className="w-2 h-2 bg-indigo-500 rounded-full mr-2"></span>
              Tests
            </h2>
            <div className="space-y-2">
              <button 
                onClick={() => alert('Storage Initialization Test')}
                className="w-full text-left px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-xs font-bold transition-colors"
              >
                Test Storage Init
              </button>
              <button 
                onClick={() => alert('Gemini Connectivity Test')}
                className="w-full text-left px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-xs font-bold transition-colors"
              >
                Test AI Connectivity
              </button>
            </div>
          </section>
        </div>

        <footer className="mt-12 pt-6 border-t border-slate-700 text-center">
          <button 
            onClick={() => window.location.reload()}
            className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 rounded-xl font-bold transition-all shadow-lg shadow-indigo-500/20"
          >
            Refresh Diagnostics
          </button>
        </footer>
      </div>
    </div>
  );
};

export default TestHarness;
