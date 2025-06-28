import { describe, test, expect } from 'vitest';
import {
  generateModule,
  generateGasStation,
  generateFungible,
  fillTemplatePlaceholders
} from './index';
import type {
  ModuleContext,
  GasStationContext,
  FungibleContext
} from './index';

describe('@pact-toolbox/fabricator', () => {
  describe('fillTemplatePlaceholders', () => {
    test('replaces simple placeholders', () => {
      const template = 'Hello {{name}}, welcome to {{place}}!';
      const context = { name: 'Alice', place: 'Wonderland' };

      const result = fillTemplatePlaceholders(template, context);

      expect(result).toBe('Hello Alice, welcome to Wonderland!');
    });

    test('handles multiple occurrences of same placeholder', () => {
      const template = '{{name}} is great! I love {{name}}. {{name}} rocks!';
      const context = { name: 'Kadena' };

      const result = fillTemplatePlaceholders(template, context);

      expect(result).toBe('Kadena is great! I love Kadena. Kadena rocks!');
    });

    test('throws on missing placeholder', () => {
      const template = 'Hello {{name}}, your age is {{age}}';
      const context = { name: 'Bob' };

      expect(() => fillTemplatePlaceholders(template, context))
        .toThrow('Missing required context values for keys: age');
    });

    test('handles empty context', () => {
      const template = 'No placeholders here!';
      const context = {};

      const result = fillTemplatePlaceholders(template, context);

      expect(result).toBe('No placeholders here!');
    });

    test('handles special characters in values', () => {
      const template = 'Module {{name}} with keyset {{keyset}}';
      const context = { 
        name: 'my-module-v2',
        keyset: '"admin-keyset"'
      };

      const result = fillTemplatePlaceholders(template, context);

      expect(result).toBe('Module my-module-v2 with keyset "admin-keyset"');
    });

    test('preserves whitespace and formatting', () => {
      const template = `(namespace "{{namespace}}")

(module {{name}} {{adminKeyset}}
  (defcap GOVERNANCE ()
    (enforce-keyset {{adminKeyset}}))
)`;
      const context = {
        namespace: 'free',
        name: 'test',
        adminKeyset: 'admin'
      };

      const result = fillTemplatePlaceholders(template, context);

      expect(result).toContain('(namespace "free")');
      expect(result).toContain('(module test admin');
      expect(result).toContain('(enforce-keyset admin)');
    });
  });

  describe('generateModule', () => {
    test('generates module with default values', () => {
      const context: ModuleContext = {
        name: 'my-token'
      };

      const result = generateModule(context);

      expect(result).toContain('(namespace "free")');
      expect(result).toContain('(module my-token admin-keyset');
      expect(result).toContain('(defcap GOVERNANCE ()');
      expect(result).toContain('(enforce-keyset admin-keyset)');
      expect(result).toContain('(defun upgrade ()');
    });

    test('generates module with custom namespace', () => {
      const context: ModuleContext = {
        name: 'my-token',
        namespace: 'my-namespace'
      };

      const result = generateModule(context);

      expect(result).toContain('(namespace "my-namespace")');
    });

    test('generates module with custom admin keyset', () => {
      const context: ModuleContext = {
        name: 'my-token',
        adminKeyset: 'token-admin'
      };

      const result = generateModule(context);

      expect(result).toContain('(module my-token token-admin');
      expect(result).toContain('(enforce-keyset token-admin)');
    });

    test('generates valid Pact module structure', () => {
      const context: ModuleContext = {
        name: 'test-module',
        namespace: 'test',
        adminKeyset: 'test-admin'
      };

      const result = generateModule(context);

      // Check structure
      expect(result).toMatch(/^\(namespace "test"\)/);
      expect(result).toMatch(/\(module test-module test-admin/);
      expect(result).toMatch(/\(defcap GOVERNANCE \(\)/);
      expect(result).toMatch(/\(defun upgrade \(\)/);
      expect(result).toMatch(/\(defun my-function \(\)/);
      
      // Check proper parentheses matching
      const openParens = (result.match(/\(/g) || []).length;
      const closeParens = (result.match(/\)/g) || []).length;
      expect(openParens).toBe(closeParens);
    });
  });

  describe('generateGasStation', () => {
    test('generates gas station with required fields', () => {
      const context: GasStationContext = {
        name: 'my-gas-station',
        account: 'k:1234567890abcdef',
        module: 'my-token'
      };

      const result = generateGasStation(context);

      expect(result).toContain('(module my-gas-station admin-keyset');
      expect(result).toContain('(implements gas-payer-v1)');
      expect(result).toContain('my-token'); // Reference to subsidized module
    });

    test('generates gas station with custom namespace', () => {
      const context: GasStationContext = {
        name: 'token-gas',
        namespace: 'defi',
        account: 'k:abc123',
        module: 'defi-token'
      };

      const result = generateGasStation(context);

      expect(result).toContain('(namespace "defi")');
    });

    test('generates gas station with custom admin keyset', () => {
      const context: GasStationContext = {
        name: 'gas-payer',
        adminKeyset: 'gas-admin',
        account: 'k:def456',
        module: 'coin'
      };

      const result = generateGasStation(context);

      expect(result).toContain('(module gas-payer gas-admin');
      expect(result).toContain('(enforce-keyset gas-admin)');
    });

    test('includes gas payer interface implementation', () => {
      const context: GasStationContext = {
        name: 'test-gas',
        account: 'k:test123',
        module: 'test-module'
      };

      const result = generateGasStation(context);

      // Check for gas-payer-v1 interface requirements
      expect(result).toContain('(implements gas-payer-v1)');
      expect(result).toContain('(defcap GAS_PAYER');
      expect(result).toContain('enforce-below-or-at-gas-price');
      expect(result).toContain('0.000001'); // Max gas price
    });

    test('validates k:account format', () => {
      const validContext: GasStationContext = {
        name: 'gas',
        account: 'k:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
        module: 'token'
      };

      const result = generateGasStation(validContext);
      expect(result).toContain(validContext.account);
    });

    test('generates create-gas-payer-guard function', () => {
      const context: GasStationContext = {
        name: 'gas-station',
        account: 'k:abc',
        module: 'my-module'
      };

      const result = generateGasStation(context);

      expect(result).toContain('(defun create-gas-payer-guard');
      expect(result).toContain('ACCOUNT_GUARD');
    });
  });

  describe('generateFungible', () => {
    test('generates fungible token module', () => {
      const context: FungibleContext = {
        name: 'my-fungible-token'
      };

      const result = generateFungible(context);

      expect(result).toContain('(module my-fungible-token');
      expect(result).toBeDefined();
    });

    test('uses default values when not provided', () => {
      const context: FungibleContext = {
        name: 'token'
      };

      const result = generateFungible(context);

      expect(result).toContain('(namespace "free")');
      expect(result).toContain('admin-keyset');
    });

    test('applies custom configuration', () => {
      const context: FungibleContext = {
        name: 'custom-token',
        namespace: 'tokens',
        adminKeyset: 'token-governance'
      };

      const result = generateFungible(context);

      expect(result).toContain('(namespace "tokens")');
      expect(result).toContain('token-governance');
    });
  });

  describe('Complex Templates', () => {
    test('generates module with complex name', () => {
      const context: ModuleContext = {
        name: 'my-complex-module-v2',
        namespace: 'org-namespace',
        adminKeyset: '"org.admin-keyset"'
      };

      const result = generateModule(context);

      expect(result).toContain('my-complex-module-v2');
      expect(result).toContain('"org.admin-keyset"');
    });

    test('handles special characters in context values', () => {
      const context: GasStationContext = {
        name: 'gas_station-2',
        namespace: 'ns-with-dash',
        adminKeyset: '"keyset-with.dot"',
        account: 'k:1234567890abcdef',
        module: 'module.with.dots'
      };

      const result = generateGasStation(context);

      expect(result).toContain('gas_station-2');
      expect(result).toContain('ns-with-dash');
      expect(result).toContain('"keyset-with.dot"');
      expect(result).toContain('module.with.dots');
    });
  });

  describe('Template Validation', () => {
    test('all module placeholders are replaced', () => {
      const context: ModuleContext = {
        name: 'test',
        namespace: 'test-ns',
        adminKeyset: 'test-ks'
      };

      const result = generateModule(context);

      // No placeholders should remain
      expect(result).not.toMatch(/\{\{[^}]+\}\}/);
    });

    test('all gas station placeholders are replaced', () => {
      const context: GasStationContext = {
        name: 'test-gas',
        namespace: 'test-ns',
        adminKeyset: 'test-ks',
        account: 'k:test',
        module: 'test-mod'
      };

      const result = generateGasStation(context);

      // No placeholders should remain
      expect(result).not.toMatch(/\{\{[^}]+\}\}/);
    });
  });

  describe('Use Cases', () => {
    test('generates DeFi module', () => {
      const defiModule = generateModule({
        name: 'defi-swap',
        namespace: 'defi',
        adminKeyset: 'defi-governance'
      });

      expect(defiModule).toContain('(namespace "defi")');
      expect(defiModule).toContain('(module defi-swap defi-governance');
      expect(defiModule).toContain('(defcap GOVERNANCE ()');
    });

    test('generates NFT marketplace gas station', () => {
      const nftGasStation = generateGasStation({
        name: 'nft-gas-station',
        namespace: 'marmalade',
        adminKeyset: 'marketplace-admin',
        account: 'k:9876543210fedcba9876543210fedcba9876543210fedcba9876543210fedcba',
        module: 'marmalade.ledger'
      });

      expect(nftGasStation).toContain('(namespace "marmalade")');
      expect(nftGasStation).toContain('nft-gas-station');
      expect(nftGasStation).toContain('marketplace-admin');
      expect(nftGasStation).toContain('marmalade.ledger');
    });

    test('generates token with custom governance', () => {
      const tokenModule = generateModule({
        name: 'dao-token',
        namespace: 'dao',
        adminKeyset: '"dao.multi-sig-keyset"'
      });

      expect(tokenModule).toContain('dao-token');
      expect(tokenModule).toContain('"dao.multi-sig-keyset"');
    });
  });

  describe('Error Cases', () => {
    test('fillTemplatePlaceholders handles undefined values', () => {
      const template = 'Hello {{name}}';
      const context = { name: undefined as any };

      // fillTemplatePlaceholders doesn't throw for undefined, it just outputs undefined
      const result = fillTemplatePlaceholders(template, context);
      expect(result).toBe('Hello undefined');
    });

    test('fillTemplatePlaceholders handles null values', () => {
      const template = 'Hello {{name}}';
      const context = { name: null as any };

      // fillTemplatePlaceholders doesn't throw for null, it just outputs null
      const result = fillTemplatePlaceholders(template, context);
      expect(result).toBe('Hello null');
    });

    test('fillTemplatePlaceholders handles nested placeholders', () => {
      const template = 'Hello {{outer{{inner}}}}';
      const context = { outer: 'value', inner: 'key' };

      // Should not process nested placeholders correctly and throw error
      expect(() => fillTemplatePlaceholders(template, context))
        .toThrow('Missing required context values for keys: outer{{inner');
    });
  });
});