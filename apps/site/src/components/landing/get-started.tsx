import { useEffect, useState } from "react";

import { CopyButton } from "./copy-button";

/** Fetches the compose file from the repo and starts the app with Postgres. */
const selfHostCommand = `curl -O https://raw.githubusercontent.com/usesnipet/snipet/main/docker-compose.yml
docker compose up -d`;

/** The two ways to run Snipet, side by side: self-host today or join the Cloud waitlist. */
export function GetStarted() {
  // Set after hydration: `location` doesn't exist during server rendering.
  const [redirect, setRedirect] = useState("");
  useEffect(() => setRedirect(`${location.origin}/waitlist/`), []);

  return (
    <section id="cloud" className="scroll-mt-14 border-t">
      <div className="mx-auto grid max-w-6xl gap-12 px-4 py-20 lg:grid-cols-2 lg:gap-16">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Run it on your servers</h2>
          <p className="mt-3 text-muted-foreground">
            Snipet is open source and needs only Postgres. Your keys, your data, your infrastructure.
          </p>
          <div className="mt-6 overflow-hidden rounded-xl bg-[#24292e]">
            <div className="flex items-center justify-between border-b border-white/10 py-1.5 pr-2 pl-4 text-sm text-white/60">
              Terminal
              <CopyButton code={selfHostCommand} className="text-white/60 hover:bg-white/10 hover:text-white" />
            </div>
            <pre className="overflow-x-auto p-4 text-sm text-white">
              <code>{selfHostCommand}</code>
            </pre>
          </div>
          <p className="mt-3 text-sm text-muted-foreground">
            Then open localhost:8852. Prefer to build from source?{" "}
            <a href="/docs/get-started/install/" className="text-foreground underline underline-offset-4">
              Follow the setup guide
            </a>
            .
          </p>
        </div>

        <div className="lg:border-l lg:pl-16">
          <h2 className="text-3xl font-bold tracking-tight">Or let us host it</h2>
          <p className="mt-3 text-muted-foreground">
            Snipet Cloud is coming. Join the waitlist and we'll email you when it opens.
          </p>
          <form action="https://api.web3forms.com/submit" method="POST" className="mt-6 flex flex-col gap-3 sm:flex-row">
            <input type="hidden" name="access_key" value="deea7df5-158e-4655-a8d7-56f405258874" />
            <input type="hidden" name="subject" value="Snipet Cloud waitlist" />
            {/* Web3Forms needs an absolute URL; without JS it falls back to its own success page. */}
            <input type="hidden" name="redirect" value={redirect} />
            {/* Web3Forms honeypot: bots fill it, the submission is dropped. */}
            <input type="checkbox" name="botcheck" className="hidden" tabIndex={-1} autoComplete="off" />
            <label htmlFor="waitlist-email" className="sr-only">
              Email
            </label>
            <input
              id="waitlist-email"
              type="email"
              name="email"
              required
              placeholder="you@company.com"
              className="flex-1 rounded-lg border border-input bg-background px-4 py-2.5"
            />
            <button type="submit" className="rounded-lg bg-primary px-5 py-2.5 font-medium text-primary-foreground">
              Join waitlist
            </button>
          </form>
        </div>
      </div>
    </section>
  );
}
