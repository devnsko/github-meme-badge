/**
 * `server-only` throws on import unless the bundler sets the `react-server`
 * condition, which Vitest does not. Aliased in vitest.config.mts so the
 * storage layer can be unit-tested.
 */
export {};
