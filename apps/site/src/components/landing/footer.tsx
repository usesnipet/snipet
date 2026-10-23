export function Footer() {
  return (
    <footer className="mx-auto flex max-w-6xl flex-wrap justify-between gap-4 px-4 py-8 text-sm text-muted-foreground">
      <span>Snipet</span>
      <nav className="flex gap-4">
        <a href="/docs/">Docs</a>
        <a href="https://github.com/usesnipet/snipet">GitHub</a>
      </nav>
    </footer>
  );
}
