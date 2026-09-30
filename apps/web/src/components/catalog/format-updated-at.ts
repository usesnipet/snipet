import moment from "moment";

export function formatUpdatedAt(updatedAt: string) {
  return moment(updatedAt).format("MMM D, YYYY h:mm A");
}
