import React from 'react';
import { Ribbon } from './components/UI/Ribbon';
import { useShallow } from 'zustand/react/shallow';
import { AutoPlacementSidebar } from './components/UI/Sidebar/AutoPlacementSidebar';
import { ExportSidebar } from './components/UI/Sidebar/ExportSidebar';
import { BOMModal } from './components/UI/Modals/BOMModal';
import { HelpSidebar } from './components/UI/Sidebar/HelpSidebar';
import { CableSidebar } from './components/UI/Sidebar/CableSidebar';
import { WallPropertiesToolbar } from './components/UI/Overlays/WallPropertiesToolbar';

import { HubPropertiesToolbar } from './components/UI/Overlays/HubPropertiesToolbar';
import { CablePropertiesToolbar } from './components/UI/Overlays/CablePropertiesToolbar';
import { HubSettingsModal } from './components/UI/Modals/HubSettingsModal';
import { MainStage } from './components/Canvas/MainStage';

import { useProjectStore } from './store/useProjectStore';


// QA Tool Flag - Set to false to disable in production
// const SHOW_QA_TOOLS = true; // MOVED TO STORE

import type { ProjectState } from './store/useProjectStore';

function App() {
  const { theme } = useProjectStore(useShallow((state: ProjectState) => ({ theme: state.theme })));

  // Global Key Handler for Escape
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        const state = useProjectStore.getState();

        // 1. Unselect Objects (Highest Priority)
        if (state.selectedIds.length > 0) {
          state.setSelection([]);
          return;
        }

        // 2. Reset Tool to Select
        if (state.activeTool !== 'select') {
          state.setTool('select');
          return;
        }

        // 3. Close Global Sidebars/Modals (LIFO or logic order)
        if (state.isHelpOpen) { state.setIsHelpOpen(false); return; }
        if (state.isBOMOpen) { state.setIsBOMOpen(false); return; }
        if (state.isExportSidebarOpen) { state.setIsExportSidebarOpen(false); return; }
        if (state.isCableSidebarOpen) { state.setIsCableSidebarOpen(false); return; }
        if (state.isAutoPlacementOpen) { state.setIsAutoPlacementOpen(false); return; }
        if (state.isHubSettingsOpen) { state.setIsHubSettingsOpen(false); return; }
        if (state.isSettingsOpen) { state.setIsSettingsOpen(false); return; }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Sync Theme with HTML Class for Tailwind
  React.useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  return (
    <div className={`flex flex-col h-screen w-screen bg-[var(--bg-canvas)] ${theme === 'light' ? 'theme-light' : ''}`}>
      <Ribbon />
      <BOMModal />
      <AutoPlacementSidebar />
      <ExportSidebar />
      <CableSidebar />
      <HelpSidebar />
      <WallPropertiesToolbar />
      <HubPropertiesToolbar />
      <CablePropertiesToolbar />
      <HubSettingsModal />
      <div className="flex-1 w-full h-full">
        <MainStage />
      </div>
    </div>
  );
}

export default App;
