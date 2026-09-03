import { useState } from "react";

export const useLocalStorage = <T>(key: string, defaultValue: T): [T, (value: T) => void] => {
  const [value, _setValue] = useState<T>(() => {
    const storedValue = localStorage.getItem(key);
    if (storedValue) return JSON.parse(storedValue);
    localStorage.setItem(key, JSON.stringify(defaultValue));
    return defaultValue as T;
  });

  const setValue = (value: T) => {
    _setValue(value);
    localStorage.setItem(key, JSON.stringify(value));
  }

  return [value, setValue];
};