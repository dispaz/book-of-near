import { Component, type ReactNode } from "react";

interface Props {
  fallback: ReactNode;
  children: ReactNode;
}

/** Shows the text fallback when a scene throws, so a broken scene never blanks the lesson. */
export class SceneBoundary extends Component<Props, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: unknown) {
    console.warn("Scene failed, showing the text version instead.", error);
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}
