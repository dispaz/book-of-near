// The app's three fonts (docs/palette.md rule 5), bundled so renders never depend on the network.
import "@fontsource/newsreader/500.css";
import "@fontsource/newsreader/700.css";
import "@fontsource/caveat/600.css";
import "@fontsource/dm-sans/500.css";
import "@fontsource/dm-sans/700.css";
import { continueRender, delayRender } from "remotion";

// Hold the first frame until the fonts are in, so no frame renders in a fallback face.
const handle = delayRender("fonts");
Promise.all(
  ["700 40px Newsreader", "600 40px Caveat", "500 40px 'DM Sans'", "700 40px 'DM Sans'"].map((f) =>
    document.fonts.load(f),
  ),
)
  .catch(() => undefined)
  .then(() => continueRender(handle));
