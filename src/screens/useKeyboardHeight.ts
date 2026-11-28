import { useEffect, useState } from 'react';
import { Keyboard } from 'react-native';

/** Altezza della tastiera quando è aperta (0 quando è chiusa): serve a non farle coprire i campi. */
export function useKeyboardHeight(): number {
  const [h, setH] = useState(0);
  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', (e) => setH(e.endCoordinates.height));
    const hide = Keyboard.addListener('keyboardDidHide', () => setH(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  return h;
}
