import { applyPathParams } from "@/lib/http";
import { useParams } from "react-router";

export function usePathBuilder() {
  const params = useParams();

  return (path: string) => {
    const pathParams = Object.fromEntries(
      Object.entries(params).filter((entry): entry is [string, string] => entry[1] != null),
    );
    return applyPathParams(path, pathParams);
  }
}