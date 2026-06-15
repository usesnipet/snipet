import { useEffect } from "react";
import { useLocation } from "react-router-dom";

export const useDocumentTitle = (
  getTitle: () => string,
  dependencies: React.DependencyList
) => {
  const location = useLocation();

  useEffect(() => {
    document.title = getTitle();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- caller owns dependency list
  }, [location, ...dependencies]);
};
