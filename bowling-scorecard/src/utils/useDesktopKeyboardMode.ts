import { useEffect, useState } from 'react';

const desktopCorrectionQuery = '(min-width: 768px) and (pointer: fine) and (hover: hover)';

const getMatches = () => {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false;
  }
  return window.matchMedia(desktopCorrectionQuery).matches;
};

export const useDesktopKeyboardMode = (): boolean => {
  const [isDesktopKeyboardMode, setIsDesktopKeyboardMode] = useState<boolean>(getMatches);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return undefined;
    }

    const mediaQuery = window.matchMedia(desktopCorrectionQuery);
    const handleChange = () => setIsDesktopKeyboardMode(mediaQuery.matches);

    handleChange();
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  return isDesktopKeyboardMode;
};
