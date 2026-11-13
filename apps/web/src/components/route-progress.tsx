/**
 * Thin gold bar sweeping across the top of the content area while a page's
 * code downloads. Shown after 150 ms so quick navigations don't flash it; the
 * page's own skeletons take over once its header renders. With reduced motion
 * the bar sits still across the full width.
 */
export function RouteProgress() {
  return (
    <div
      role="status"
      className="animate-in fade-in fill-mode-backwards relative h-0.5 w-full shrink-0 overflow-hidden delay-150 duration-300"
    >
      <span className="sr-only">Loading page</span>
      <div className="bg-primary absolute inset-y-0 left-0 w-1/3 animate-[route-progress_1.1s_ease-in-out_infinite] motion-reduce:w-full motion-reduce:animate-none motion-reduce:opacity-60" />
    </div>
  );
}
