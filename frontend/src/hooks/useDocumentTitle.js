import { useEffect } from 'react';

/** Equivalent of `{% block title %}` – sets document.title while the page is mounted. */
export default function useDocumentTitle(title) {
  useEffect(() => {
    if (title) document.title = title;
  }, [title]);
}
