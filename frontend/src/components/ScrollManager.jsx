import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * A full page load in Django always starts at the top (or at #hash).
 * Reproduce that on every client-side navigation.
 */
export default function ScrollManager() {
  const location = useLocation();
  useEffect(() => {
    if (location.hash) {
      const id = decodeURIComponent(location.hash.slice(1));
      let tries = 0;
      const tryScroll = () => {
        const el = document.getElementById(id) || document.getElementsByName(id)[0];
        if (el) el.scrollIntoView({ behavior: 'smooth' });
        else if (tries++ < 20) setTimeout(tryScroll, 100);
      };
      tryScroll();
    } else {
      window.scrollTo(0, 0);
    }
  }, [location.key, location.hash]);
  return null;
}
