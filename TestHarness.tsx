
import React, { useState, useEffect } from 'react';
import * as storage from './services/storageService';
import { Presentation } from './types';

const TestHarness: React.FC = () => {
  const [logs, setLogs] = useState<string[]>([]);
  const [currentUser, setCurrentUser] = useState<any>(null);

  const log = (msg: string) => {
    setLogs(prev => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev.slice(0, 49)]);
  };

  const refreshUser = () => {
    const user = storage.getCurrentUser();
    setCurrentUser(user);
    log(user ? `Current User: ${user.displayName} (${user.email})` : "No user logged in.");
  };

  useEffect(() => {
    storage.initializeStorage().then(() => {
      log("Storage initialized.");
      refreshUser();
    });
  }, []);

  const runSignupTest = () => {
    const email = `test_${Math.floor(Math.random() * 1000)}@example.com`;
    const result = storage.signup(email, "password123", "Test User");
    if (result.success) {
      log(`Signup Success: ${email}`);
      refreshUser();
    } else {
      log(`Signup Failed: ${result.error}`);
    }
  };

  const runLoginTest = (email: string) => {
    const result = storage.login(email, "password123");
    if (result.success) {
      log(`Login Success: ${email}`);
      refreshUser();
    } else {
      log(`Login Failed: ${result.error}`);
    }
  };

  const runLogoutTest = () => {
    storage.logout();
    log("Logged out.");
    refreshUser();
  };

  const runPersistenceTest = async () => {
    const user = storage.getCurrentUser();
    if (!user) {
      log("Persistence Test Error: Must be logged in first.");
      return;
    }

    log(`Testing persistence for ${user.email}...`);
    const testPres: Presentation = {
      id: storage.generateId(),
      title: `Persisted Deck - ${user.displayName}`,
      slides: [],
      userId: user.id
    };

    await storage.savePresentation(testPres);
    log("Presentation saved to user library.");
    
    const list = await storage.listPresentations();
    log(`Library count for this user: ${list.length}`);
    
    const sessionSuccess = await storage.saveCurrentSession(testPres, 0);
    log(`Current session saved: ${sessionSuccess ? 'Success' : 'Failed'}`);
  };

  const verifyLibraryIsolation = async () => {
    const list = await storage.listPresentations();
    log(`VERIFY: Found ${list.length} presentations in library.`);
    const session = await storage.loadCurrentSession();
    log(`VERIFY: Current session title: ${session.presentation?.title || 'None'}`);
  };

  return (
    <div className="p-8 bg-slate-900 text-slate-100 min-h-screen font-mono text-sm">
      <div className="max-w-6xl mx-auto">
        <header className="mb-8 border-b border-slate-700 pb-6 flex justify-between items-end">
          <div>
            <h1 className="text-3xl font-black text-indigo-400">Presentify Storage Lab</h1>
            <p className="text-slate-500 mt-1">Diagnostic environment for Auth & Persistence</p>
          </div>
          <div className="text-right">
            <div className="text-[10px] text-slate-500 uppercase font-bold mb-1">Current State</div>
            <div className={`px-3 py-1 rounded-full text-xs font-bold ${currentUser ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
              {currentUser ? `Authenticated as ${currentUser.displayName}` : 'Anonymous'}
            </div>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Controls Column 1 */}
          <div className="space-y-6">
            <section className="bg-slate-800 p-6 rounded-2xl border border-slate-700 shadow-xl">
              <h2 className="text-sm font-black uppercase tracking-widest text-indigo-300 mb-4 flex items-center">
                <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full mr-2"></span>
                Auth Lifecycle
              </h2>
              <div className="space-y-2">
                <button onClick={runSignupTest} className="w-full text-left px-4 py-3 bg-slate-700 hover:bg-slate-600 rounded-xl transition-colors flex justify-between items-center group">
                  <span>Random Signup</span>
                  <span className="text-indigo-400 opacity-0 group-hover:opacity-100">RUN</span>
                </button>
                <button onClick={runLogoutTest} className="w-full text-left px-4 py-3 bg-slate-700 hover:bg-red-900/30 hover:text-red-400 rounded-xl transition-colors flex justify-between items-center group">
                  <span>Logout Current</span>
                  <span className="opacity-0 group-hover:opacity-100">RUN</span>
                </button>
              </div>
            </section>

            <section className="bg-slate-800 p-6 rounded-2xl border border-slate-700 shadow-xl">
              <h2 className="text-sm font-black uppercase tracking-widest text-emerald-300 mb-4 flex items-center">
                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full mr-2"></span>
                Fixed Accounts
              </h2>
              <div className="grid grid-cols-1 gap-2">
                <button onClick={() => runLoginTest('user_a@test.com')} className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-xs text-left">Login User A (user_a@test.com)</button>
                <button onClick={() => runLoginTest('user_b@test.com')} className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-xs text-left">Login User B (user_b@test.com)</button>
              </div>
              <p className="mt-3 text-[10px] text-slate-500 italic">Note: Use random signup first to ensure accounts exist if testing fresh storage.</p>
            </section>
          </div>

          {/* Controls Column 2 */}
          <div className="space-y-6">
            <section className="bg-slate-800 p-6 rounded-2xl border border-slate-700 shadow-xl">
              <h2 className="text-sm font-black uppercase tracking-widest text-amber-300 mb-4 flex items-center">
                <span className="w-1.5 h-1.5 bg-amber-500 rounded-full mr-2"></span>
                Persistence Tests
              </h2>
              <div className="space-y-2">
                <button onClick={runPersistenceTest} className="w-full text-left px-4 py-3 bg-slate-700 hover:bg-slate-600 rounded-xl transition-colors flex justify-between items-center group">
                  <span>Create User Data</span>
                  <span className="text-amber-400 opacity-0 group-hover:opacity-100">RUN</span>
                </button>
                <button onClick={verifyLibraryIsolation} className="w-full text-left px-4 py-3 bg-slate-700 hover:bg-slate-600 rounded-xl transition-colors flex justify-between items-center group">
                  <span>Verify Current Isolation</span>
                  <span className="text-amber-400 opacity-0 group-hover:opacity-100">RUN</span>
                </button>
              </div>
            </section>

            <div className="bg-indigo-500/10 border border-indigo-500/20 p-4 rounded-2xl">
              <h3 className="text-xs font-bold text-indigo-300 mb-2">Test Scenario Instructions:</h3>
              <ol className="text-[10px] text-slate-400 space-y-2 list-decimal ml-4">
                <li>Signup or Login as <strong>User A</strong>.</li>
                <li>Run <strong>Create User Data</strong>.</li>
                <li><strong>Logout</strong>.</li>
                <li>Login as <strong>User B</strong> (or signup new).</li>
                <li>Run <strong>Verify Current Isolation</strong>. Result should be 0 slides for B.</li>
                <li>Switch back to <strong>User A</strong> and verify data is still there.</li>
              </ol>
            </div>
          </div>

          {/* Logs Column */}
          <div className="bg-slate-950 rounded-2xl border border-slate-800 flex flex-col overflow-hidden h-[600px] shadow-2xl">
            <div className="p-4 border-b border-slate-800 bg-slate-900/50 flex justify-between items-center">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Operation Logs</span>
              <button onClick={() => setLogs([])} className="text-[10px] text-indigo-400 hover:text-indigo-300 font-bold">CLEAR</button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-2 font-mono text-[11px]">
              {logs.map((l, i) => (
                <div key={i} className={`pb-2 border-b border-slate-900 last:border-0 ${l.includes('Failed') || l.includes('Error') ? 'text-red-400' : l.includes('Success') ? 'text-green-400' : 'text-slate-400'}`}>
                  {l}
                </div>
              ))}
              {logs.length === 0 && <div className="text-slate-700 italic">Waiting for operations...</div>}
            </div>
          </div>
        </div>

        <footer className="mt-12 pt-6 border-t border-slate-800 text-center flex justify-center space-x-4">
          <button 
            onClick={() => window.location.reload()}
            className="px-6 py-2 bg-slate-800 hover:bg-slate-700 rounded-xl text-xs font-bold transition-all"
          >
            Soft Reset
          </button>
          <button 
            onClick={() => { localStorage.clear(); indexedDB.deleteDatabase('PresentifyDB'); window.location.reload(); }}
            className="px-6 py-2 bg-red-900/20 text-red-400 hover:bg-red-900/40 rounded-xl text-xs font-bold transition-all border border-red-900/30"
          >
            Nuke Local Storage
          </button>
        </footer>
      </div>
    </div>
  );
};

export default TestHarness;
