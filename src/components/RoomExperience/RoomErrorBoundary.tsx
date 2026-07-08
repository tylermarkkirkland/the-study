"use client";

import { Component, type ReactNode } from "react";

type Props = {
  children: ReactNode;
  /** Rendered when the 3D room throws (WebGL init / GLB parse failure). */
  fallback: ReactNode;
};

type State = { hasError: boolean };

/**
 * Catches errors thrown while rendering the live 3D room (e.g. WebGL context
 * creation failing, or office.glb failing to parse) and degrades to the flat
 * CSS room instead of white-screening. Error boundaries must be class
 * components; kept as a tiny local one to avoid adding a dependency.
 */
export default class RoomErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    console.error("3D room failed to render; falling back to CSS room.", error);
  }

  render() {
    return this.state.hasError ? this.props.fallback : this.props.children;
  }
}
