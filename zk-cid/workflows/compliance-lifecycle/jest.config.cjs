/** @type {import('jest').Config} */
module.exports = {
  // The CRE simulation test runs under bun (`yarn test:sim`), not jest.
  // jest has no tests in this workspace; keep it green and out of the way.
  testPathIgnorePatterns: ["/node_modules/", "/test/compliance-lifecycle.sim.test.ts"],
  passWithNoTests: true,
};
