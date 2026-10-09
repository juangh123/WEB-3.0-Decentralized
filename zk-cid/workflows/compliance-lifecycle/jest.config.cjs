/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: "node",
  // The CRE simulation test needs the bun runtime (`yarn test:sim`) because it drives the
  // real @chainlink/cre-sdk TestRuntime; jest covers the pure-TS units (poseidon2-lite).
  testPathIgnorePatterns: ["/node_modules/", "/test/compliance-lifecycle.sim.test.ts"],
  transform: {
    "^.+\\.ts$": [
      "ts-jest",
      {
        tsconfig: {
          module: "CommonJS",
          target: "ES2022",
          esModuleInterop: true,
          resolveJsonModule: true,
          types: ["jest", "node"],
        },
      },
    ],
  },
};
