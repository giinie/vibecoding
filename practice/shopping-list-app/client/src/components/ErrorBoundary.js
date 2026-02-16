import React from 'react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="app">
          <main className="app-main" style={{ textAlign: 'center', padding: '2rem' }}>
            <h2>오류가 발생했습니다</h2>
            <p>예상치 못한 오류가 발생했습니다. 페이지를 새로고침해 주세요.</p>
            <button onClick={() => window.location.reload()}>
              새로고침
            </button>
          </main>
        </div>
      );
    }

    return this.props.children;
  }
}
