import { describe, it, expect, beforeEach } from 'vitest';
import { Container, createToken, createProvider } from './container';

describe('Container', () => {
  let container: Container;

  beforeEach(() => {
    container = new Container();
  });

  it('should register and resolve a simple value', () => {
    const token = createToken<string>('test');
    container.register(token, 'hello');
    
    expect(container.resolve(token)).toBe('hello');
  });

  it('should register and resolve a factory', () => {
    const token = createToken<{ value: number }>('test');
    let callCount = 0;
    
    container.register(token, () => {
      callCount++;
      return { value: 42 };
    });
    
    const result1 = container.resolve(token);
    const result2 = container.resolve(token);
    
    expect(result1.value).toBe(42);
    expect(result1).toBe(result2); // Same instance (singleton)
    expect(callCount).toBe(1); // Called only once
  });

  it('should support transient services', () => {
    const token = createToken<{ id: number }>('test');
    let id = 0;
    
    container.register(
      token, 
      () => ({ id: ++id }),
      { singleton: false }
    );
    
    const result1 = container.resolve(token);
    const result2 = container.resolve(token);
    
    expect(result1.id).toBe(1);
    expect(result2.id).toBe(2);
    expect(result1).not.toBe(result2);
  });

  it('should detect circular dependencies', () => {
    const tokenA = createToken<any>('A');
    const tokenB = createToken<any>('B');
    
    container.register(tokenA, () => container.resolve(tokenB));
    container.register(tokenB, () => container.resolve(tokenA));
    
    expect(() => container.resolve(tokenA)).toThrow('Circular dependency detected');
  });

  it('should support dependency injection', () => {
    const configToken = createToken<{ apiUrl: string }>('config');
    const clientToken = createToken<{ url: string }>('client');
    
    container.register(configToken, { apiUrl: 'https://api.example.com' });
    container.register(
      clientToken,
      createProvider([configToken], (config) => ({
        url: config.apiUrl
      }))
    );
    
    const client = container.resolve(clientToken);
    expect(client.url).toBe('https://api.example.com');
  });

  it('should support async resolution', async () => {
    const token = createToken<{ data: string }>('async');
    
    container.register(token, async () => {
      await new Promise(resolve => setTimeout(resolve, 10));
      return { data: 'async result' };
    });
    
    const result = await container.resolveAsync(token);
    expect(result.data).toBe('async result');
  });

  it('should create isolated scopes', () => {
    const token = createToken<string>('test');
    
    container.register(token, 'parent');
    const scope = container.createScope();
    
    expect(scope.resolve(token)).toBe('parent');
    
    scope.register(token, 'child', { override: true });
    expect(scope.resolve(token)).toBe('child');
    expect(container.resolve(token)).toBe('parent'); // Parent unchanged
  });
});