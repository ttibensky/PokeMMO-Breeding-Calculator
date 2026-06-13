import type { StateCreator } from 'zustand';
import type { BreedingProject, BreedStepResult, BreedingGoal, ProjectStatus } from './types';

export interface ProjectsSlice {
  projects: BreedingProject[];
  addProject: (input: { name: string; goal: BreedingGoal; status?: ProjectStatus }) => string;
  updateProject: (id: string, patch: Partial<BreedingProject>) => void;
  removeProject: (id: string) => void;
  setProjectStatus: (id: string, status: ProjectStatus) => void;
  addBreedStepResult: (
    projectId: string,
    result: Omit<BreedStepResult, 'id' | 'reportedAt'>
  ) => string;
  getProjectById: (id: string) => BreedingProject | undefined;
}

export const createProjectsSlice: StateCreator<ProjectsSlice> = (set, get) => ({
  projects: [],

  addProject: ({ name, goal, status = 'planning' }) => {
    const id = crypto.randomUUID();
    const createdAt = new Date().toISOString();
    const project: BreedingProject = { id, name, goal, status, progress: [], createdAt };
    set((state) => ({ projects: [...state.projects, project] }));
    return id;
  },

  updateProject: (id, patch) => {
    set((state) => ({
      projects: state.projects.map((p) => (p.id === id ? { ...p, ...patch } : p)),
    }));
  },

  removeProject: (id) => {
    set((state) => ({ projects: state.projects.filter((p) => p.id !== id) }));
  },

  setProjectStatus: (id, status) => {
    set((state) => ({
      projects: state.projects.map((p) => (p.id === id ? { ...p, status } : p)),
    }));
  },

  addBreedStepResult: (projectId, result) => {
    const id = crypto.randomUUID();
    const reportedAt = new Date().toISOString();
    const step: BreedStepResult = { ...result, id, reportedAt };
    set((state) => ({
      projects: state.projects.map((p) =>
        p.id === projectId ? { ...p, progress: [...p.progress, step] } : p
      ),
    }));
    return id;
  },

  getProjectById: (id) => {
    return get().projects.find((p) => p.id === id);
  },
});
