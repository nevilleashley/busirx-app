import React from 'react';

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      message: error.message || 'An unexpected error occurred.',
    };
  }

  override render() {
    if (this.state.hasError) {
      let friendly = this.state.message;
      try {
        const parsed = JSON.parse(this.state.message) as { error?: string; operationType?: string; path?: string };
        if (parsed.error) {
          friendly = `${parsed.error} (${parsed.operationType || 'operation'} on ${parsed.path || 'resource'})`;
        }
      } catch {
        // Keep plain message
      }
      return (
        <div className="min-h-screen bg-[#F8F7FB] flex items-center justify-center p-6">
          <div className="max-w-lg w-full bg-white border border-[#E6E2F0] rounded-xl p-8">
            <p className="text-xs font-medium text-[#4C1D95] mb-2">Busi Rx</p>
            <h1 className="text-xl font-semibold text-[#1C1B22] mb-2">
              Something interrupted this workspace view
            </h1>
            <p className="text-sm text-[#4A4756] leading-relaxed mb-6 break-words">{friendly}</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="px-4 py-2 text-sm font-medium bg-[#4C1D95] text-white rounded-lg hover:bg-[#3B1478] transition-colors"
            >
              Reload Busi Rx
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
