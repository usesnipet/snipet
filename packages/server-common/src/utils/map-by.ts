export function mapBy<T extends { [key: string]: any }>(data: T[], key: keyof T): Map<string, T> {
  const map = new Map<string, T>();
  for (const item of data) {
    map.set(String(item[key]), item);
  }
  return map;
}
