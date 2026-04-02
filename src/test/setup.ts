import '@testing-library/jest-dom'
import { vi } from 'vitest'

/**
 * Global mock for auth module (v1.3 Multi-User Foundation).
 * Makes withAuth a passthrough that injects a test userId,
 * so all existing API route tests continue working without
 * needing to mock auth individually.
 */
vi.mock('@/lib/auth', () => ({
  getAuthUserId: vi.fn().mockResolvedValue('test-user-id'),
  withAuth: vi.fn((handler: Function) => {
    return async (req: any, routeCtx?: any) => {
      const params = routeCtx?.params ? await routeCtx.params : undefined;
      return handler(req, { userId: 'test-user-id', params });
    };
  }),
}))
