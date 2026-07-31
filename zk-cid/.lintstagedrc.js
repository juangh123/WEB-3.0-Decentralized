const path = require("path");

const buildNextEslintCommand = (filenames) =>
  `yarn workspace @se-2/nextjs eslint --fix ${filenames
    .map((f) => path.relative(path.join("packages", "nextjs"), f))
    .join(" ")}`;

const checkTypesNextCommand = () => "yarn next:check-types";

const buildHardhatEslintCommand = (filenames) =>
  `yarn hardhat:lint-staged --fix ${filenames
    .map((f) => path.relative(path.join("packages", "hardhat"), f))
    .join(" ")}`;

// prettier(含 prettier-plugin-solidity)安装在 @se-2/hardhat workspace,
// mock-api / workflows 复用该二进制;.prettierrc 按被格式化文件所在目录解析。
const buildPrettierCommand = (filenames) =>
  `yarn workspace @se-2/hardhat prettier --write ${filenames
    .map((f) => path.relative(path.join("packages", "hardhat"), f))
    .join(" ")}`;

module.exports = {
  "packages/nextjs/**/*.{ts,tsx}": [
    buildNextEslintCommand,
    checkTypesNextCommand,
  ],
  "packages/hardhat/**/*.{ts,tsx}": [buildHardhatEslintCommand],
  "packages/hardhat/**/*.sol": [buildPrettierCommand],
  "{mock-api,workflows}/**/*.{ts,js}": [buildPrettierCommand],
};
