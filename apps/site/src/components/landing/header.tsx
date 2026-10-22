/** Star counts read like GitHub's own badge: 1.2k, not 1,234. */
const compact = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });

type Props = {
  /** Left out of the GitHub link when the API couldn't be reached. */
  stars: number | null;
  /** The roadmap section renders only when there are milestones, so its link follows it. */
  showRoadmap: boolean;
};

export function Header({ stars, showRoadmap }: Props) {
  return (
    <header className="sticky top-0 z-10 border-b bg-background/85 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
        <a href="/" className="flex items-center gap-2 font-semibold">
          <img src="/favicon.svg" alt="" width="24" height="24" className="size-6" />
          Snipet
        </a>
        <nav className="flex items-center gap-1 text-sm">
          <a href="/docs/" className="rounded-md px-3 py-1.5 text-muted-foreground hover:text-foreground">
            Docs
          </a>
          {showRoadmap && (
            <a href="#roadmap" className="hidden rounded-md px-3 py-1.5 text-muted-foreground hover:text-foreground sm:block">
              Roadmap
            </a>
          )}
          <a
            href="https://github.com/usesnipet/snipet"
            className="ml-1 flex items-center gap-2 rounded-md border px-3 py-1.5 font-medium transition-colors hover:bg-accent"
          >
            <svg viewBox="0 0 24 24" className="size-4" fill="currentColor" aria-hidden>
              <path d="M12 .5a11.5 11.5 0 0 0-3.64 22.41c.58.1.79-.25.79-.56v-2c-3.2.7-3.88-1.37-3.88-1.37-.52-1.33-1.28-1.69-1.28-1.69-1.05-.71.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.73-1.55-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.29 1.19-3.1-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.17 1.18a11 11 0 0 1 5.77 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.81 1.19 1.84 1.19 3.1 0 4.42-2.7 5.4-5.26 5.68.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.5 11.5 0 0 0 12 .5Z" />
            </svg>
            GitHub
            {stars !== null && (
              <span className="text-muted-foreground" aria-label={`${stars} stars`}>
                {compact.format(stars)}
              </span>
            )}
          </a>
        </nav>
      </div>
    </header>
  );
}
