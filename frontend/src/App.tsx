import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import Save from './pages/Save';
import Tagging from './pages/Tagging';
import TagManagement from './pages/TagManagement';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/save" element={<Save />} />
        <Route path="/tagging" element={<Tagging />} />
        <Route path="/tags" element={<TagManagement />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;


