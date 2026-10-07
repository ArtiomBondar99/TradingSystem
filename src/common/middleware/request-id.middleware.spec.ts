import { jest } from '@jest/globals';
import type { NextFunction, Request, Response } from 'express';
import {
  REQUEST_ID_HEADER,
  RequestIdMiddleware,
} from './request-id.middleware.js';

describe('RequestIdMiddleware', () => {
  const middleware = new RequestIdMiddleware();

  function run(headers: Record<string, string> = {}) {
    const req = { headers } as unknown as Request;
    const setHeader = jest.fn();
    const res = { setHeader } as unknown as Response;
    const next = jest.fn() as unknown as NextFunction;

    middleware.use(req, res, next);

    return { req, setHeader, next };
  }

  it('generates a new ID when the client sends none', () => {
    const { req, setHeader, next } = run();

    const id = req.headers[REQUEST_ID_HEADER];
    expect(id).toMatch(/^[0-9a-f-]{36}$/);
    expect(setHeader).toHaveBeenCalledWith(REQUEST_ID_HEADER, id);
    expect(next).toHaveBeenCalled();
  });

  it('reuses a valid ID sent by the client', () => {
    const { req } = run({ [REQUEST_ID_HEADER]: 'client-abc-123' });

    expect(req.headers[REQUEST_ID_HEADER]).toBe('client-abc-123');
  });

  it('replaces an unsafe ID sent by the client', () => {
    const { req } = run({ [REQUEST_ID_HEADER]: 'bad id\nINJECTED LOG LINE' });

    expect(req.headers[REQUEST_ID_HEADER]).not.toContain('INJECTED');
  });
});
