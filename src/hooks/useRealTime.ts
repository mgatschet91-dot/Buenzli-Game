/**
 * useRealTime Hook
 * 
 * Liefert die echte Systemzeit, synchron mit der Uhr.
 * Aktualisiert sich jede Sekunde.
 */

import { useState, useEffect } from 'react';

export interface RealTimeData {
  hour: number;      // 0-23
  minute: number;    // 0-59
  second: number;    // 0-59
  day: number;       // 1-31
  month: number;     // 1-12
  year: number;      // z.B. 2026
  dayOfWeek: number; // 0-6 (Sonntag = 0)
}

export function useRealTime(): RealTimeData {
  const [time, setTime] = useState<RealTimeData>(() => getTimeFromDate(new Date()));

  useEffect(() => {
    // Update jede Sekunde
    const interval = setInterval(() => {
      setTime(getTimeFromDate(new Date()));
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  return time;
}

function getTimeFromDate(date: Date): RealTimeData {
  return {
    hour: date.getHours(),
    minute: date.getMinutes(),
    second: date.getSeconds(),
    day: date.getDate(),
    month: date.getMonth() + 1, // JavaScript months are 0-indexed
    year: date.getFullYear(),
    dayOfWeek: date.getDay(),
  };
}

export default useRealTime;
