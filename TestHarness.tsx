
import React, { useState, useEffect } from 'react';
import * as storage from './services/storageService';
import { Presentation } from './types';

const TestHarness: React.FC = () => {
  const [logs, setLogs] = useState<string[]>([]);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [storageStats, setStorageStats] = useState({ userPres: 0, settings: '{}' });

  const log = (msg: string) => {
    setLogs(prev => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev.slice(0, 49)]);
  };

  const refreshState = async () => {
    const user = storage.getCurrentUser();
    setCurrentUser(user);
    if (user) {
      const list = await storage.listPresentations();
      const settings = storage.getSettings();
      setStorageStats({
        userPres: list.length,
        settings: JSON.stringify(settings)
      });
    } else {
      setStorageStats({ userPres: 0, settings: '{}' });
    }
  };

  useEffect(() => {
    storage.initializeStorage().then(() => {
      log("Storage initialized.");
      refreshState();
    });
  }, []);

  const runSignupTest = () => {
    const email = `test_${Math.floor(Math.random() * 1000)}@example.com`;
    const result = storage.signup(email, "password123", "Test User");
    if (result.success) {
      log(`Signup Success: ${email}`);
      refreshState();
    } else {
      log(`Signup Failed: ${result.error}`);
    }
  };

  const runLoginTest = (email: string) => {
    const result = storage.login(email, "password123");
    if (result.success) {
      log(`Login Success: ${email}`);
      refreshState();
    } else {
      log(`Login Failed: ${result.error}`);
    }
  };

  const runLogoutTest = () => {
    storage.logout();
    log("Logged out.");
    refreshState();
  };

  const runPersistenceTest = async () => {
    const user = storage.getCurrentUser();
    if (!user) {
      log("Error: Login required for persistence test.");
      return;
    }
    const testPres: Presentation = {
      id: storage.generateId(),
      title: `Deck for ${user.displayName}`,
      slides: [],
      userId: user.id
    };
    await storage.savePresentation(testPres);
    log(`Saved presentation for ${user.email}`);
    await storage.saveCurrentSession(testPres, 0);
    log("Saved current session state.");
    refreshState();
  };

  const runSettingsTest = () => {
    const user = storage.getCurrentUser();
    if (!user) return log("Error: Login required.");
    const newDelay = Math.floor(Math.random() * 5000);
    storage.updateSettings({ autoplayDelay: newDelay });
    log(`Updated delay to ${newDelay}ms for ${user.email}`);
    refreshState();
  };

  const runDeleteTest = async () => {
    const list = await storage.listPresentations();
    if (list.length === 0) return log("No presentations to delete.");
    const targetId = list[0].id;
    await storage.deletePresentation(targetId);
    log(`Deleted presentation ${targetId}`);
    refreshState();
  };

  return (
    <div className="p-8 bg-slate-900 text-slate-100 min-h-screen font-mono text-sm">
      <div className="max-w-6xl mx-auto">
        <header className="mb-8 border-b border-slate-700 pb-6 flex justify-between items-end">
          <div>
            <h1 className="text-3xl font-black text-indigo-400 tracking-tighter">STORAGE LAB</h1>
            <p className="text-slate-500 mt-1">Diagnostic Interface: Data Persistence & Multi-User Isolation</p>
          </div>
          <div className="flex space-x-4">
            <div className="text-right">
              <div className="text-[10px] text-slate-500 uppercase font-bold mb-1">User</div>
              <div className="text-xs font-bold text-white bg-slate-800 px-3 py-1 rounded-lg">
                {currentUser ? currentUser.email : 'NONE'}
              </div>
            </div>
            <div className="text-right">
              <div className="text-[10px] text-slate-500 uppercase font-bold mb-1">Items</div>
              <div className="text-xs font-bold text-indigo-400 bg-slate-800 px-3 py-1 rounded-lg">
                {storageStats.userPres}
              </div>
            </div>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Action Column */}
          <div className="lg:col-span-4 space-y-6">
            <section className="bg-slate-800/50 p-6 rounded-2xl border border-slate-700">
              <h2 className="text-xs font-black uppercase tracking-widest text-indigo-300 mb-4">Auth Lifecycle</h2>
              <div className="grid grid-cols-1 gap-2">
                <button onClick={runSignupTest} className="w-full text-left px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors">Random Signup</button>
                <button onClick={() => runLoginTest('user_a@test.com')} className="w-full text-left px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors">Login User A</button>
                <button onClick={() => runLoginTest('user_b@test.com')} className="w-full text-left px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors">Login User B</button>
                <button onClick={runLogoutTest} className="w-full text-left px-4 py-2 bg-red-900/20 text-red-400 hover:bg-red-900/30 rounded-lg transition-colors">Logout</button>
              </div>
            </section>

            <section className="bg-slate-800/50 p-6 rounded-2xl border border-slate-700">
              <h2 className="text-xs font-black uppercase tracking-widest text-emerald-300 mb-4">Data Persistence</h2>
              <div className="grid grid-cols-1 gap-2">
                <button onClick={runPersistenceTest} className="w-full text-left px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors">Create User Data</button>
                <button onClick={runSettingsTest} className="w-full text-left px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors">Modify User Settings</button>
                <button onClick={runDeleteTest} className="w-full text-left px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors">Delete Owned Item</button>
              </div>
            </section>
          </div>

          {/* Visualization Column */}
          <div className="lg:col-span-8 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
               <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800">
                 <h3 className="text-[10px] font-black text-slate-500 uppercase mb-3">Live Settings Snapshot</h3>
                 <pre className="text-[10px] text-emerald-400 bg-black/30 p-3 rounded-lg overflow-x-auto whitespace-pre-wrap">
                   {storageStats.settings}
                 </pre>
               </div>
               <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800">
                 <h3 className="text-[10px] font-black text-slate-500 uppercase mb-3">Test Scenarios</h3>
                 <ul className="text-[10px] text-slate-400 space-y-2 list-disc ml-4">
                   <li>Login A, create data, logout. Login B: Verify isolation (items=0).</li>
                   <li>Login A, modify settings. Login B: Verify settings isolation.</li>
                   <li>Verify "Owned Item" deletion only affects current user.</li>
                 </ul>
               </div>
            </div>

            <div className="bg-slate-950 rounded-2xl border border-slate-800 flex flex-col overflow-hidden h-96 shadow-inner">
              <div className="p-4 border-b border-slate-800 bg-slate-900/50 flex justify-between items-center">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Operation Logs</span>
                <button onClick={() => setLogs([])} className="text-[10px] text-indigo-400 hover:text-indigo-300 font-bold">CLEAR</button>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-1.5 font-mono text-[11px]">
                {logs.map((l, i) => (
                  <div key={i} className={`p-1 ${l.includes('Failed') || l.includes('Error') ? 'text-red-400' : l.includes('Success') ? 'text-green-400' : 'text-slate-500'}`}>
                    {l}
                  </div>
                ))}
                {logs.length === 0 && <div className="text-slate-800 italic">Waiting for diagnostics...</div>}
              </div>
            </div>
          </div>
        </div>

        <footer className="mt-8 pt-6 border-t border-slate-800 flex justify-center space-x-4">
          <button onClick={() => window.location.reload()} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-[10px] font-bold">Refresh Lab</button>
          <button onClick={() => { localStorage.clear(); indexedDB.deleteDatabase('PresentifyDB'); window.location.reload(); }} className="px-4 py-2 border border-red-900/30 text-red-500 hover:bg-red-900/10 rounded-lg text-[10px] font-bold">Factory Reset Storage</button>
        </footer>
      </div>
    </div>
  );
};

export default TestHarness;
