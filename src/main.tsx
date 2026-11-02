import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createBrowserRouter, createHashRouter, RouterProvider } from "react-router";
import "@fontsource/newsreader/500.css";
import "@fontsource/newsreader/700.css";
import "@fontsource/newsreader/500-italic.css";
import "@fontsource/caveat/600.css";
import "@fontsource/dm-sans/500.css";
import "@fontsource/dm-sans/700.css";
import "./ui/ink.css";
import { ContentsPage } from "./ui/ContentsPage";
import { LessonPage } from "./ui/LessonPage";
import { HomePage } from "./progress/HomePage";
import { OpeningQuiz } from "./progress/OpeningQuiz";
import { TestOut } from "./progress/TestOut";
import { ChainProvider } from "./chain/ChainContext";

// The claude.ai review copy (`npm run build:artifact`) is served as one page, so it routes on the hash.
const createRouter = import.meta.env.MODE === "artifact" ? createHashRouter : createBrowserRouter;

const router = createRouter([
  { path: "/", element: <HomePage /> },
  { path: "/start", element: <OpeningQuiz /> },
  { path: "/test-out", element: <TestOut /> },
  { path: "/lesson/:id", element: <LessonPage /> },
  { path: "*", element: <ContentsPage /> },
]);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ChainProvider>
      <RouterProvider router={router} />
    </ChainProvider>
  </StrictMode>,
);
