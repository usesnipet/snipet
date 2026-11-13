/** The repo the landing reads its catalog and roadmap from. */
const REPO = "https://api.github.com/repos/usesnipet/snipet";

/** Closed milestones shown before the open ones. */
const SHIPPED_COUNT = 2;

/** Catalog entry as read from the API's plugin and LLM manifests. */
export type Manifest = { key: string; name: string; icon: string; description: string; tags?: string[] };

/** GitHub milestone fields the roadmap uses. */
export type Milestone = { title: string; description: string[]; state: "open" | "closed"; due_on: string | null };

/**
 * How often each resource is fetched, successful or not. Failed pages skip the route cache, so without this every
 * request while GitHub is failing spends more of its 60 calls/h per IP and the limit never recovers.
 */
const REFRESH_MS = 15 * 60 * 1000;

/** Wraps `load` to run at most once per REFRESH_MS, sharing in-flight calls and keeping the last good value on failure. */
function remember<T>(load: () => Promise<T | null>): () => Promise<T | null> {
  let last: T | null = null;
  let current: Promise<T | null> | undefined;
  let expires = 0;
  return () => {
    if (!current || Date.now() >= expires) {
      expires = Date.now() + REFRESH_MS;
      current = load()
        .catch(() => null)
        .then((value) => (last = value ?? last));
    }
    return current;
  };
}

/** The API's manifests in `dir` on the default branch, or null when GitHub can't be reached. */
async function fetchManifests(dir: "llm" | "plugin"): Promise<Manifest[] | null> {
  try {
    const res = await fetch(`${REPO}/contents/apps/api/src/drivers/${dir}/manifests`);
    if (!res.ok) throw new Error(`status ${res.status}`);
    const files = (await res.json()) as { name: string; download_url: string }[];
    return await Promise.all(
      files
        .filter((f) => f.name.endsWith(".json"))
        .map(async (f) => (await fetch(f.download_url)).json() as Promise<Manifest>),
    );
  } catch (error) {
    console.warn(`Loading ${dir} manifests from GitHub failed:`, error);
    return null;
  }
}

/** One remembered loader per manifest directory, so each keeps its own last good value. */
const manifests = {
  llm: remember(() => fetchManifests("llm")),
  plugin: remember(() => fetchManifests("plugin")),
};

/** The manifests in `dir`, refreshed from GitHub at most once per REFRESH_MS. */
export const loadManifests = (dir: "llm" | "plugin"): Promise<Manifest[] | null> => manifests[dir]();

/** The repo's star count, or null when GitHub can't be reached; the header just leaves it out. */
export const loadStars = remember(async (): Promise<number | null> => {
  const res = await fetch(REPO).catch(() => null);
  if (!res?.ok) return null;
  return ((await res.json()) as { stargazers_count: number }).stargazers_count;
});

/** The latest shipped milestones followed by the open ones, by due date, or null when GitHub can't be reached. */
export const loadRoadmap = remember(async (): Promise<Milestone[] | null> => {
  const res = await fetch(`${REPO}/milestones?state=all&per_page=100`).catch(() => null);
  if (!res?.ok) {
    console.warn(`Loading milestones from GitHub failed: ${res?.status ?? "unreachable"}`);
    return null;
  }
  const all = ((await res.json()) as Milestone[])
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .map(
      (m: any) =>
        ({
          title: m.title,
          description: m.description?.split("\n") ?? [],
          state: m.state,
          due_on: m.due_on,
        }) as Milestone,
    )
    // Patch releases (x.y.1+) are fixes, too small for the roadmap.
    .filter((m) => !/^\d+\.\d+\.[1-9]/.test(m.title))
    .sort((a, b) => (a.due_on ?? "").localeCompare(b.due_on ?? ""));
  const closed = all.filter((m) => m.state === "closed").slice(-SHIPPED_COUNT);
  return [...closed, ...all.filter((m) => m.state === "open")];
});
