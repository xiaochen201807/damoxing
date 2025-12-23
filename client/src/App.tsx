// src/App.tsx
import { BrowserRouter } from 'react-router-dom';
import AppRoutes from './routes';

// 应用基础路径（从环境变量读取，去掉末尾的 /）
const BASE_PATH = (import.meta.env.VITE_BASE_PATH || '/').replace(/\/$/, '');

function App() {
  return (
    <BrowserRouter basename={BASE_PATH}>
      <div className="App">
        <AppRoutes />
      </div>
    </BrowserRouter>
  );
}

export default App;