import { Ribbon } from './components/UI/Ribbon';
import { useShallow } from 'zustand/react/shallow';
import { AutoPlacementSidebar } from './components/UI/Sidebar/AutoPlacementSidebar';
import { ExportSidebar } from './components/UI/Sidebar/ExportSidebar';
import { BOMModal } from './components/UI/Modals/BOMModal';
import { HelpSidebar } from './components/UI/Sidebar/HelpSidebar';
import { CableSidebar } from './components/UI/Sidebar/CableSidebar';
import { MainStage } from './components/Canvas/MainStage';

import { useProjectStore } from './store/useProjectStore';


// QA Tool Flag - Set to false to disable in production
// const SHOW_QA_TOOLS = true; // MOVED TO STORE

import type { ProjectState } from './store/useProjectStore';

function App() {
  const { theme } = useProjectStore(useShallow((state: ProjectState) => ({ theme: state.theme })));

  return (
    <div className={`flex flex-col h-screen w-screen bg-[var(--bg-canvas)] ${theme === 'light' ? 'theme-light' : ''}`}>
      <Ribbon />
      <BOMModal />
      <AutoPlacementSidebar />
      <ExportSidebar />
      <CableSidebar />
      <HelpSidebar />
      <div className="flex-1 w-full h-full">
        <MainStage />
      </div>
    </div>
  );
}

export default App;
