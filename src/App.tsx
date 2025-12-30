import { Ribbon } from './components/UI/Ribbon';
import { MainStage } from './components/Canvas/MainStage';

import { useProjectStore } from './store/useProjectStore';

function App() {
  const theme = useProjectStore((state) => state.theme);

  return (
    <div className={`flex flex-col h-screen w-screen bg-[var(--bg-canvas)] ${theme === 'light' ? 'theme-light' : ''}`}>
      <Ribbon />
      <div className="flex-1 w-full h-full">
        <MainStage />
      </div>
    </div>
  );
}

export default App;
