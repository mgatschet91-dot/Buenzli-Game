'use client';

import { useState, useEffect } from 'react';
import { isMobile, isTablet, isMobileOnly } from 'react-device-detect';

interface UseMobileReturn {
  isMobileDevice: boolean;
  isTabletDevice: boolean;
  isMobileOnly: boolean;
  isSmallScreen: boolean;
  isTouchDevice: boolean;
  screenWidth: number;
  screenHeight: number;
  orientation: 'portrait' | 'landscape';
}

const IS_ELECTRON = process.env.NEXT_PUBLIC_PLATFORM === 'electron';

// In Electron immer Desktop — kein Mobile-UI
const ELECTRON_DESKTOP: UseMobileReturn = {
  isMobileDevice: false,
  isTabletDevice: false,
  isMobileOnly: false,
  isSmallScreen: false,
  isTouchDevice: false,
  screenWidth: typeof window !== 'undefined' ? window.innerWidth : 1440,
  screenHeight: typeof window !== 'undefined' ? window.innerHeight : 900,
  orientation: 'landscape',
};

export function useMobile(): UseMobileReturn {
  if (IS_ELECTRON) return ELECTRON_DESKTOP;

  const [screenWidth, setScreenWidth] = useState(0);
  const [screenHeight, setScreenHeight] = useState(0);
  const [isSmallScreen, setIsSmallScreen] = useState(false);
  const [isTouchDevice, setIsTouchDevice] = useState(false);
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>('portrait');

  useEffect(() => {
    const updateDimensions = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      setScreenWidth(width);
      setScreenHeight(height);
      setIsSmallScreen(width < 768);
      setOrientation(width > height ? 'landscape' : 'portrait');
    };

    const checkTouch = () => {
      setIsTouchDevice(
        'ontouchstart' in window ||
        navigator.maxTouchPoints > 0 ||
        // @ts-expect-error - msMaxTouchPoints is a legacy property
        navigator.msMaxTouchPoints > 0
      );
    };

    updateDimensions();
    checkTouch();

    window.addEventListener('resize', updateDimensions);
    window.addEventListener('orientationchange', updateDimensions);

    return () => {
      window.removeEventListener('resize', updateDimensions);
      window.removeEventListener('orientationchange', updateDimensions);
    };
  }, []);

  return {
    isMobileDevice: isMobile || isSmallScreen,
    isTabletDevice: isTablet,
    isMobileOnly: isMobileOnly,
    isSmallScreen,
    isTouchDevice,
    screenWidth,
    screenHeight,
    orientation,
  };
}

// Simple context-free check for SSR
export function getIsMobileSSR(): boolean {
  if (typeof window === 'undefined') return false;
  if (IS_ELECTRON) return false;
  return window.innerWidth < 768 || isMobile;
}
