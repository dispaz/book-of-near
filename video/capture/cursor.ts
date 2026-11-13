/**
 * A visible pointer for the recordings (headless browsers draw none): an ink arrow that follows the
 * mouse, with a ring that pops on every click. Injected with page.addInitScript, so it runs in the page.
 */
export function installCursor(colors: { ink: string; card: string; accent: string }) {
  const add = () => {
    if (document.getElementById("demo-cursor")) return;
    const el = document.createElement("div");
    el.id = "demo-cursor";
    el.innerHTML = `<svg width="34" height="40" viewBox="0 0 34 40"><path d="M3 3 L3 33 L11 26 L17 38 L23 35 L17 23 L28 23 Z" fill="${colors.card}" stroke="${colors.ink}" stroke-width="3" stroke-linejoin="round"/></svg>`;
    Object.assign(el.style, {
      position: "fixed",
      left: "0px",
      top: "0px",
      zIndex: "2147483647",
      pointerEvents: "none",
      transform: "translate(-200px,-200px)",
      transition: "transform 40ms linear",
      filter: `drop-shadow(3px 3px 0 ${colors.ink}55)`,
    });
    document.documentElement.appendChild(el);
    let x = -200;
    let y = -200;
    window.addEventListener(
      "mousemove",
      (e) => {
        x = e.clientX;
        y = e.clientY;
        el.style.transform = `translate(${x - 3}px, ${y - 3}px)`;
      },
      true,
    );
    const ring = (rx: number, ry: number) => {
      const r = document.createElement("div");
      Object.assign(r.style, {
        position: "fixed",
        left: `${rx - 22}px`,
        top: `${ry - 22}px`,
        width: "44px",
        height: "44px",
        borderRadius: "50%",
        border: `5px solid ${colors.accent}`,
        boxShadow: `0 0 0 3px ${colors.ink}`,
        zIndex: "2147483646",
        pointerEvents: "none",
        transition: "transform 380ms ease-out, opacity 380ms ease-out",
        transform: "scale(0.3)",
        opacity: "1",
      });
      document.documentElement.appendChild(r);
      requestAnimationFrame(() => {
        r.style.transform = "scale(1.4)";
        r.style.opacity = "0";
      });
      setTimeout(() => r.remove(), 450);
    };
    window.addEventListener("mousedown", (e) => ring(e.clientX, e.clientY), true);
    // Keyboard picks (3D objects are picked with Enter) get the ring where the pointer is.
    (window as unknown as { __demoRing: () => void }).__demoRing = () => ring(x, y);
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", add);
  else add();
}
