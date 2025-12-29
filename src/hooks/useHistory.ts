import { useState, useCallback } from "react";

interface HistoryState<T> {
  past: T[];
  present: T;
  future: T[];
}

export function useHistory<T>(initialPresent: T) {
  const [state, setState] = useState<HistoryState<T>>({
    past: [],
    present: initialPresent,
    future: [],
  });

  const canUndo = state.past.length > 0;
  const canRedo = state.future.length > 0;

  // Undo: Move present to future, pop past to present
  const undo = useCallback(() => {
    setState((currentState) => {
      const { past, present, future } = currentState;
      if (past.length === 0) return currentState;

      const previous = past[past.length - 1];
      const newPast = past.slice(0, past.length - 1);

      return {
        past: newPast,
        present: previous,
        future: [present, ...future],
      };
    });
  }, []);

  // Redo: Move present to past, pop future to present
  const redo = useCallback(() => {
    setState((currentState) => {
      const { past, present, future } = currentState;
      if (future.length === 0) return currentState;

      const next = future[0];
      const newFuture = future.slice(1);

      return {
        past: [...past, present],
        present: next,
        future: newFuture,
      };
    });
  }, []);

  // Set: Update present. Optionally save the *previous* present to history.
  // We use a deep copy helper to ensure we don't store references.
  const set = useCallback((newPresent: T, saveToHistory: boolean = false) => {
    setState((currentState) => {
      const { past, present } = currentState;

      if (saveToHistory) {
        // Deep copy the previous state to break references
        const safePresent = JSON.parse(JSON.stringify(present));
        return {
          past: [...past, safePresent],
          present: newPresent,
          future: [], // New action clears the future
        };
      }

      return {
        ...currentState,
        present: newPresent,
      };
    });
  }, []);

  // Helper: Manually push the *current* state to history without changing it.
  // Useful before performing a destructive action (like drag and drop).
  const saveSnapshot = useCallback(() => {
    setState((currentState) => {
      const safePresent = JSON.parse(JSON.stringify(currentState.present));
      return {
        ...currentState,
        past: [...currentState.past, safePresent],
        future: [],
      };
    });
  }, []);

  return {
    state: state.present,
    set,
    undo,
    redo,
    saveSnapshot,
    canUndo,
    canRedo,
  };
}
