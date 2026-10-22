import { useEffect, useState } from "react";

export function Waitlist() {
  // Set after hydration: `location` doesn't exist during server rendering.
  const [redirect, setRedirect] = useState("");
  useEffect(() => setRedirect(`${location.origin}/waitlist/`), []);

  return (
    <section className="border-t bg-gray-900 text-white">
      <div className="mx-auto max-w-xl px-4 py-20 text-center">
        <h2 className="text-3xl font-bold tracking-tight">Snipet Cloud is coming</h2>
        <p className="mt-3 text-gray-300">Don't want to host it yourself? Join the waitlist and we'll let you know.</p>
        <form action="https://api.web3forms.com/submit" method="POST" className="mt-8 flex flex-col gap-3 sm:flex-row">
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
            className="flex-1 rounded-lg bg-white px-4 py-2.5 text-gray-900"
          />
          <button type="submit" className="rounded-lg bg-white px-5 py-2.5 font-medium text-gray-900">
            Join waitlist
          </button>
        </form>
      </div>
    </section>
  );
}
