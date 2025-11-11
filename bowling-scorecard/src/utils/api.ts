export const resolveApiBaseUrl = () => {
  if (process.env.REACT_APP_API_BASE_URL) {
    return process.env.REACT_APP_API_BASE_URL.replace(/\/$/u, '');
  }

  if (typeof window !== 'undefined') {
    const { origin, hostname, protocol, port } = window.location;

    if (hostname === 'localhost' || hostname === '127.0.0.1' || port === '3000') {
      const overridePort = process.env.REACT_APP_API_PORT ?? '4000';
      return `${protocol}//${hostname}:${overridePort}`;
    }

    return origin.replace(/\/$/u, '');
  }

  return 'http://localhost:4000';
};
