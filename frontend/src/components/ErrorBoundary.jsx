import React from 'react';
import { FiAlertTriangle } from 'react-icons/fi';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '400px', padding: '40px' }}>
          <FiAlertTriangle size={48} color="#ef4444" />
          <h2 style={{ marginTop: '16px', color: '#1e293b' }}>Something went wrong</h2>
          <p style={{ color: '#64748b', marginTop: '8px' }}>An unexpected error occurred. Please try again.</p>
          <button
            className="btn btn-primary"
            style={{ marginTop: '20px' }}
            onClick={() => this.setState({ hasError: false, error: null })}
          >
            Try Again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
