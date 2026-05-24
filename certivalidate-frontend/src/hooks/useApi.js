import { useState, useCallback } from 'react';

/**
 * Generic hook for async API calls with loading, error and data state.
 * Usage: const { data, loading, error, execute } = useApi(someServiceFn);
 * Then call: execute(arg1, arg2, ...);
 */
export const useApi = (apiFn) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const execute = useCallback(async (...args) => {
    setLoading(true);
    setError(null);
    try {
      const result = await apiFn(...args);
      setData(result.data !== undefined ? result.data : result);
      return result;
    } catch (err) {
      setError(err.message || 'Error desconocido');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [apiFn]);

  const reset = useCallback(() => {
    setData(null);
    setError(null);
    setLoading(false);
  }, []);

  return { data, loading, error, execute, reset };
};
