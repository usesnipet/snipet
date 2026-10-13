export function isGranted(str: string, { allow, deny }: { allow?: string[]; deny?: string[] }): boolean {
  const matches = (glob: string) => globToRegExp(glob).test(str);
  return (!allow?.length || allow.some(matches)) && !deny?.some(matches);
}

// Only "*" is special: any run of characters.
const globToRegExp = (glob: string) =>
  new RegExp(
    `^${glob
      .split("*")
      .map((s) => s.replace(/[.+?^${}()|[\]\\]/g, "\\$&"))
      .join(".*")}$`,
  );
