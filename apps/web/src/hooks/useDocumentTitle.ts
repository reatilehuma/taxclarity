import { useEffect } from "react";
import { copy } from "../content/strings.ts";

/** Sets the browser tab title; pass the full title or a page name to suffix with the product name. */
export function useDocumentTitle(title: string, { full = false }: { full?: boolean } = {}) {
  useEffect(() => {
    document.title = full ? title : `${title} · ${copy.meta.titleSuffix}`;
  }, [title, full]);
}
