export const MATERIAL_SEARCH_DEBOUNCE_MS = 400;

type Timer = ReturnType<typeof setTimeout>;

export function createDebouncedSearch(
  apply: (search: string) => void,
) {
  let timer: Timer | null = null;

  const cancel = () => {
    if (timer === null) return;
    clearTimeout(timer);
    timer = null;
  };

  return {
    schedule(search: string) {
      cancel();
      timer = setTimeout(() => {
        timer = null;
        apply(search);
      }, MATERIAL_SEARCH_DEBOUNCE_MS);
    },
    flush(search: string) {
      cancel();
      apply(search);
    },
    cancel,
  };
}
