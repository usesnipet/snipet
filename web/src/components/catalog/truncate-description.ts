const DESCRIPTION_MAX_LENGTH = 200;

export function truncateDescription(description: string): string {
  if (description.length <= DESCRIPTION_MAX_LENGTH) {
    return description;
  }
  return `${description.slice(0, DESCRIPTION_MAX_LENGTH)}…`;
}
