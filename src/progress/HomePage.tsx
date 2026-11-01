import { Navigate } from "react-router";
import { useProgress } from ".";
import { ContentsPage } from "../ui/ContentsPage";

/** "/": a new visitor (no route yet) goes to the opening quiz, everyone else sees the contents. */
export function HomePage() {
  const { route } = useProgress();
  return route ? <ContentsPage /> : <Navigate to="/start" replace />;
}
