/** The repo the landing reads its catalog and roadmap from. */
const REPO = "https://api.github.com/repos/usesnipet/snipet";

/** Closed milestones shown before the open ones. */
const SHIPPED_COUNT = 4;

/** Catalog entry as read from the API's plugin and LLM manifests. */
export type Manifest = { key: string; name: string; icon: string; description: string };

/** GitHub milestone fields the roadmap uses. */
export type Milestone = { title: string; description: string | null; state: "open" | "closed"; due_on: string | null };

/** The API's manifests in `dir` on the default branch. */
export async function loadManifests(dir: "llm" | "plugin"): Promise<Manifest[]> {
  const res = await fetch(`${REPO}/contents/apps/api/src/${dir}/manifests`);
  if (!res.ok) throw new Error(`Listing ${dir} manifests on GitHub failed: ${res.status}`);
  const files = (await res.json()) as { name: string; download_url: string }[];
  return Promise.all(
    files.filter((f) => f.name.endsWith(".json")).map(async (f) => (await fetch(f.download_url)).json() as Promise<Manifest>),
  );
}

/** The latest shipped milestones followed by the open ones, by due date. */
export async function loadRoadmap(): Promise<Milestone[]> {
  const res = await fetch(`${REPO}/milestones?state=all&per_page=100`);
  if (!res.ok) throw new Error(`Loading milestones from GitHub failed: ${res.status}`);
  const all = ((await res.json()) as Milestone[])
    // Patch releases (x.y.1+) are fixes, too small for the roadmap.
    .filter((m) => !/^\d+\.\d+\.[1-9]/.test(m.title))
    .sort((a, b) => (a.due_on ?? "").localeCompare(b.due_on ?? ""));
  const closed = all.filter((m) => m.state === "closed").slice(-SHIPPED_COUNT);
  return [...closed, ...all.filter((m) => m.state === "open")];
}
