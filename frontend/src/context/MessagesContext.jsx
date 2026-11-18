import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * Port of django.contrib.messages semantics:
 *  - a message is queued (flash) and stays queued until some page *renders* it;
 *  - once rendered, it disappears on the next navigation.
 * Components that display messages call `useDisplayedMessages()`.
 */
const MessagesContext = createContext(null);
let seq = 0;

export function MessagesProvider({ children }) {
  const [messages, setMessages] = useState([]);
  const location = useLocation();

  const addMessages = useCallback((list) => {
    if (!list || !list.length) return;
    setMessages((prev) => [
      ...prev,
      ...list.map((m) => ({
        id: ++seq,
        level: m.level || m.tags || 'info',
        text: m.text ?? m.message ?? String(m),
        seenAt: null,
      })),
    ]);
  }, []);

  const flash = useCallback((level, text) => addMessages([{ level, text }]), [addMessages]);

  const markSeen = useCallback((ids, key) => {
    setMessages((prev) => prev.map((m) => (ids.includes(m.id) && m.seenAt === null ? { ...m, seenAt: key } : m)));
  }, []);

  // Drop messages that were already shown on a previous page.
  useEffect(() => {
    setMessages((prev) => {
      const next = prev.filter((m) => m.seenAt === null || m.seenAt === location.key);
      return next.length === prev.length ? prev : next;
    });
  }, [location.key]);

  const value = useMemo(() => ({ messages, addMessages, flash, markSeen }), [messages, addMessages, flash, markSeen]);
  return <MessagesContext.Provider value={value}>{children}</MessagesContext.Provider>;
}

export function useMessages() {
  return useContext(MessagesContext);
}

/**
 * Returns the queued messages and marks them as displayed on the current page
 * (equivalent of iterating `{% for message in messages %}` in a template).
 */
export function useDisplayedMessages() {
  const { messages, markSeen } = useContext(MessagesContext);
  const location = useLocation();
  const visible = messages.filter((m) => m.seenAt === null || m.seenAt === location.key);
  const unseenIds = visible.filter((m) => m.seenAt === null).map((m) => m.id);
  const unseenKey = unseenIds.join(',');
  useEffect(() => {
    if (unseenIds.length) markSeen(unseenIds, location.key);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unseenKey, location.key]);
  return visible;
}
