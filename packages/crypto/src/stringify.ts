/**
 * @fileoverview Deterministic JSON Serialization
 *
 * This module provides deterministic JSON serialization that produces consistent
 * output regardless of property insertion order. This is critical for cryptographic
 * operations where the serialized representation must be identical across different
 * JavaScript engines and execution contexts.
 *
 * The implementation sorts object keys and handles special values like BigInt,
 * functions, and undefined values in a consistent manner.
 */

/** Reference to Object.prototype.toString for type checking */
const objToString = Object.prototype.toString;

/** Fallback implementation for Object.keys for older environments */
const objKeys =
  Object.keys ||
  function (obj) {
    const keys = [];
    for (const name in obj) {
      keys.push(name);
    }
    return keys;
  };

/**
 * Internal recursive function that performs deterministic stringification.
 *
 * This function handles various JavaScript types and ensures consistent output:
 * - Objects: Properties are sorted by key name
 * - Arrays: Elements are processed in order
 * - Functions/undefined: Handled differently in arrays vs objects
 * - BigInt: Serialized with 'n' suffix
 * - Numbers: Non-finite numbers become null
 *
 * @param val - The value to stringify
 * @param isArrayProp - Whether this value is an array element (affects undefined/function handling)
 * @returns The stringified representation or undefined
 */
function stringify(val: unknown, isArrayProp: boolean) {
  let i, max, str, keys, key, propVal, toStr;
  if (val === true) {
    return "true";
  }
  if (val === false) {
    return "false";
  }
  switch (typeof val) {
    case "object":
      if (val === null) {
        return null;
      } else if ("toJSON" in val && typeof val.toJSON === "function") {
        // Handle objects with custom toJSON methods (like Date)
        return stringify(val.toJSON(), isArrayProp);
      } else {
        toStr = objToString.call(val);
        if (toStr === "[object Array]") {
          // Handle arrays
          str = "[";
          max = (val as unknown[]).length - 1;
          for (i = 0; i < max; i++) {
            str += stringify((val as unknown[])[i], true) + ",";
          }
          if (max > -1) {
            str += stringify((val as unknown[])[i], true);
          }
          return str + "]";
        } else if (toStr === "[object Object]") {
          // Handle plain objects - sort keys for deterministic output
          keys = objKeys(val).sort();
          max = keys.length;
          str = "";
          i = 0;
          while (i < max) {
            key = keys[i];
            //@ts-expect-error - We know val is an object at this point
            propVal = stringify((val as Record<typeof key, unknown>)[key], false);
            if (propVal !== undefined) {
              if (str) {
                str += ",";
              }
              str += JSON.stringify(key) + ":" + propVal;
            }
            i++;
          }
          return "{" + str + "}";
        } else {
          // Handle other object types (RegExp, Date without toJSON, etc.)
          return JSON.stringify(val);
        }
      }
    case "function":
    case "undefined":
      // In arrays, undefined/functions become null; in objects, they're omitted
      return isArrayProp ? null : undefined;
    case "bigint":
      // BigInt serialization with 'n' suffix
      return `${val.toString()}n`;
    case "string":
      return JSON.stringify(val);
    default:
      // Handle numbers - non-finite numbers become null
      return isFinite(val as number) ? val : null;
  }
}

/**
 * Performs fast, stable, deterministic JSON stringification.
 *
 * This function provides deterministic JSON serialization that:
 * - Sorts object keys alphabetically for consistent output
 * - Handles BigInt values with 'n' suffix
 * - Processes undefined and function values consistently
 * - Respects toJSON methods on objects
 * - Ensures identical output across different JavaScript engines
 *
 * This is essential for cryptographic operations where the serialized
 * representation must be identical for operations like hashing and signing.
 *
 * @param val - Function or undefined (returns undefined)
 * @returns undefined for functions and undefined values
 *
 * @example
 * ```typescript
 * const result = fastStableStringify(undefined); // undefined
 * const result2 = fastStableStringify(() => {}); // undefined
 * ```
 */
export function fastStableStringify(
  val:
    | Function // eslint-disable-line @typescript-eslint/no-unsafe-function-type
    | undefined,
): undefined;

/**
 * Performs fast, stable, deterministic JSON stringification.
 *
 * @param val - Any serializable value
 * @returns Deterministic JSON string representation
 *
 * @example
 * ```typescript
 * const obj = { b: 2, a: 1 };
 * const result = fastStableStringify(obj); // '{"a":1,"b":2}'
 *
 * const bigintVal = { num: 123n };
 * const result2 = fastStableStringify(bigintVal); // '{"num":"123n"}'
 * ```
 */
export function fastStableStringify(val: unknown): string;

/**
 * Implementation of fast, stable, deterministic JSON stringification.
 *
 * @param val - The value to stringify
 * @returns String representation or undefined
 */
export function fastStableStringify(val: unknown): string | undefined {
  const returnVal = stringify(val, false);
  if (returnVal !== undefined) {
    return "" + returnVal;
  }
  return undefined;
}
