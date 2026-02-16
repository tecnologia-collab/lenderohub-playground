"use client";

import { useState, useEffect, useCallback } from "react";

const PREFS_KEY = "lenderohub-preferences";

export interface NotificationPreferences {
  inApp: boolean;
  email: boolean;
  deposits: boolean;
  transfers: boolean;
  commissions: boolean;
}

export interface Preferences {
  notifications: NotificationPreferences;
}

const defaults: Preferences = {
  notifications: {
    inApp: true,
    email: true,
    deposits: true,
    transfers: true,
    commissions: true,
  },
};

function loadPreferences(): Preferences {
  if (typeof window === "undefined") return defaults;
  try {
    const stored = localStorage.getItem(PREFS_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return {
        notifications: { ...defaults.notifications, ...parsed.notifications },
      };
    }
  } catch {
    // Ignore parse errors
  }
  return defaults;
}

function savePreferences(prefs: Preferences) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch {
    // Ignore storage errors
  }
}

export function usePreferences() {
  const [preferences, setPreferences] = useState<Preferences>(defaults);
  const [loaded, setLoaded] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    setPreferences(loadPreferences());
    setLoaded(true);
  }, []);

  // Persist to localStorage on change (skip initial load)
  useEffect(() => {
    if (loaded) {
      savePreferences(preferences);
    }
  }, [preferences, loaded]);

  const updateNotification = useCallback(
    (key: keyof NotificationPreferences, value: boolean) => {
      setPreferences((prev) => ({
        ...prev,
        notifications: {
          ...prev.notifications,
          [key]: value,
        },
      }));
    },
    []
  );

  const resetPreferences = useCallback(() => {
    setPreferences(defaults);
  }, []);

  return {
    preferences,
    loaded,
    updateNotification,
    resetPreferences,
  };
}
