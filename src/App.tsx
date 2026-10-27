/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext.js';
import { Navbar } from './components/Navbar.js';
import { Footer } from './components/Footer.js';
import { AuthModal } from './components/AuthModal.js';
import { LandingPage } from './pages/LandingPage.js';
import { OptimizerPage } from './pages/OptimizerPage.js';
import { HistoryPage } from './pages/HistoryPage.js';
import { PointsPage } from './pages/PointsPage.js';
import { ShopPage } from './pages/ShopPage.js';
import { SettingsPage } from './pages/SettingsPage.js';
import { HelpAIPage } from './pages/HelpAIPage.js';

function MainApp() {
  const { user } = useAuth();
  // Default to optimizer if logged in, or landing page if guest
  const [currentTab, setCurrentTab] = useState<string>('landing');

  return (
    <div className="min-h-screen bg-white flex flex-col text-neutral-900 selection:bg-neutral-900 selection:text-white">
      <Navbar currentTab={currentTab} onSelectTab={setCurrentTab} />

      <main className="flex-1">
        {currentTab === 'landing' && (
          <LandingPage
            onStartOptimizing={() => setCurrentTab('optimizer')}
            onOpenShop={() => setCurrentTab('shop')}
          />
        )}

        {currentTab === 'optimizer' && (
          <OptimizerPage
            onOpenShop={() => setCurrentTab('shop')}
            onOpenPoints={() => setCurrentTab('points')}
            onOpenHelp={() => setCurrentTab('help')}
          />
        )}

        {currentTab === 'history' && (
          <HistoryPage onOpenOptimizer={() => setCurrentTab('optimizer')} />
        )}

        {currentTab === 'points' && (
          <PointsPage onOpenShop={() => setCurrentTab('shop')} />
        )}

        {currentTab === 'shop' && (
          <ShopPage
            onOpenOptimizer={() => setCurrentTab('optimizer')}
            onOpenPoints={() => setCurrentTab('points')}
          />
        )}

        {currentTab === 'settings' && <SettingsPage />}

        {currentTab === 'help' && (
          <HelpAIPage
            onOpenOptimizer={() => setCurrentTab('optimizer')}
            onOpenShop={() => setCurrentTab('shop')}
            onOpenPoints={() => setCurrentTab('points')}
            onOpenSettings={() => setCurrentTab('settings')}
          />
        )}
      </main>

      <Footer onSelectTab={setCurrentTab} />
      <AuthModal />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  );
}
