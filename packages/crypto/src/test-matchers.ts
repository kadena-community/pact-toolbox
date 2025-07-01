import "vitest";
import { expect } from "vitest";

expect.extend({
  toBeFrozenObject(actual: object) {
    return {
      message: () => `Expected object ${this.isNot ? "not " : ""}to be frozen`,
      pass: Object.isFrozen(actual),
    };
  },
});
expect.extend({
  toEqualArrayBuffer(received: ArrayBuffer, expected: ArrayBuffer) {
    if (!(received instanceof ArrayBuffer) || !(expected instanceof ArrayBuffer)) {
      return {
        message: () => "Expected to compare two `ArrayBuffers`",
        pass: false,
      };
    }
    let pass = false;
    if (received.byteLength === expected.byteLength) {
      const receivedView = new Uint8Array(received);
      const expectedView = new Uint8Array(expected);
      pass = expectedView.every((b, ii) => b === receivedView[ii]);
    }
    return {
      message: () =>
        this.isNot ? "Expected `ArrayBuffers` to differ" : `${this.utils.diff(expected, received, { expand: true })}`,
      pass,
    };
  },
});

interface CustomMatchers<R> {
  toBeFrozenObject(): R;
  toEqualArrayBuffer(expected: ArrayBuffer): R;
}
declare module "vitest" {
  interface Matchers<T = any> extends CustomMatchers<T> {}
}
