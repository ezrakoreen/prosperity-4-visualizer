import { MantineColorScheme } from '@mantine/core';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Algorithm } from './models.ts';

let nextLoadedAlgorithmId = 0;

export interface LoadedAlgorithm {
  id: string;
  label: string;
  algorithm: Algorithm;
}

function createLoadedAlgorithm(algorithm: Algorithm, label: string): LoadedAlgorithm {
  return {
    id: `loaded-algorithm-${nextLoadedAlgorithmId++}`,
    label,
    algorithm,
  };
}

export interface State {
  colorScheme: MantineColorScheme;

  idToken: string;
  round: string;

  algorithm: Algorithm | null;
  loadedAlgorithms: LoadedAlgorithm[];
  activeAlgorithmId: string | null;

  setColorScheme: (colorScheme: MantineColorScheme) => void;
  setIdToken: (idToken: string) => void;
  setRound: (round: string) => void;
  setAlgorithm: (algorithm: Algorithm | null, label?: string) => void;
  addAlgorithm: (algorithm: Algorithm, label: string) => void;
  setActiveAlgorithm: (id: string | null) => void;
}

export const useStore = create<State>()(
  persist(
    set => ({
      colorScheme: 'auto',

      idToken: '',
      round: 'ROUND0',

      algorithm: null,
      loadedAlgorithms: [],
      activeAlgorithmId: null,

      setColorScheme: colorScheme => set({ colorScheme }),
      setIdToken: idToken => set({ idToken }),
      setRound: round => set({ round }),
      setAlgorithm: (algorithm, label = 'Loaded log') =>
        set(() => {
          if (algorithm === null) {
            return {
              algorithm: null,
              loadedAlgorithms: [],
              activeAlgorithmId: null,
            };
          }

          const loadedAlgorithm = createLoadedAlgorithm(algorithm, label);

          return {
            algorithm,
            loadedAlgorithms: [loadedAlgorithm],
            activeAlgorithmId: loadedAlgorithm.id,
          };
        }),
      addAlgorithm: (algorithm, label) =>
        set(state => {
          const loadedAlgorithm = createLoadedAlgorithm(algorithm, label);

          return {
            algorithm,
            loadedAlgorithms: [...state.loadedAlgorithms, loadedAlgorithm],
            activeAlgorithmId: loadedAlgorithm.id,
          };
        }),
      setActiveAlgorithm: id =>
        set(state => {
          if (id === null) {
            return {
              algorithm: null,
              activeAlgorithmId: null,
            };
          }

          const loadedAlgorithm = state.loadedAlgorithms.find(algorithm => algorithm.id === id);
          if (loadedAlgorithm === undefined) {
            return {};
          }

          return {
            algorithm: loadedAlgorithm.algorithm,
            activeAlgorithmId: loadedAlgorithm.id,
          };
        }),
    }),
    {
      name: 'imc-prosperity-4-visualizer',
      partialize: state => ({
        colorScheme: state.colorScheme,
        idToken: state.idToken,
        round: state.round,
      }),
    },
  ),
);
