import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AppLayout } from './components/AppLayout';
import { OwnedPage } from './features/owned/OwnedPage';
import { ProjectsPage } from './features/projects/ProjectsPage';
import { ProjectDetailPage } from './features/projects/ProjectDetailPage';
import { SettingsPage } from './features/settings/SettingsPage';
import { NotFound } from './features/NotFound';

export function AppRouter() {
  return (
    <HashRouter>
      <Routes>
        <Route element={<AppLayout />}>
          <Route index element={<Navigate to="/owned" replace />} />
          <Route path="/owned" element={<OwnedPage />} />
          <Route path="/projects" element={<ProjectsPage />} />
          <Route path="/projects/:id" element={<ProjectDetailPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </HashRouter>
  );
}
