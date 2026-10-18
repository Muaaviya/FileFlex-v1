import { Component } from "react";
import type { ReactNode } from "react";
import { AlertIcon } from "../icons";
import { Button } from "./Button";

interface ErrorBoundaryState {
  error: Error | null;
}

/** Keeps a crashed page from blanking the whole app: shows the error and a retry. */
export class ErrorBoundary extends Component<
  { children: ReactNode },
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="flex h-full items-center justify-center p-8">
        <div className="max-w-md rounded-lg border border-bad-300 bg-bad-50 p-5">
          <div className="flex items-center gap-2 text-sm font-semibold text-bad-700">
            <AlertIcon className="h-4 w-4" /> This page hit an error
          </div>
          <div className="mt-2 break-all font-mono text-xs text-bad-700/80">
            {this.state.error.message}
          </div>
          <Button
            className="mt-3"
            onClick={() => this.setState({ error: null })}
          >
            Try again
          </Button>
        </div>
      </div>
    );
  }
}