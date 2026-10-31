const assert = require('node:assert/strict');
const path = require('node:path');
const test = require('node:test');

const swaggerRoot = path.dirname(require.resolve('@nestjs/swagger/package.json'));
const { replaceImportPath } = require(
  path.join(swaggerRoot, 'dist/plugin/utils/plugin-utils.js'),
);

for (const folder of ['plain-project', 'Khoá Luận', '项目']) {
  test(`Swagger emits relative DTO imports in ${folder}`, () => {
    const root = `D:/projects/${folder}/api`;
    const options = { rootDir: `${root}/src`, outDir: `${root}/dist` };
    const target = `${root}/src/dto/item.dto`;
    // TypeScript's typeToString escapes non-ASCII characters in import paths.
    const literal = JSON.stringify(target).replace(/[^\x00-\x7f]/g, (char) =>
      `\\u${char.charCodeAt(0).toString(16).padStart(4, '0')}`,
    );
    const reference = `import(${literal}).ItemDto`;

    const sameFile = replaceImportPath(reference, `${target}.ts`, options);
    assert.equal(sameFile.typeReference, 'require("./item.dto").ItemDto');

    const otherFile = replaceImportPath(
      reference,
      `${root}/src/requests/create.dto.ts`,
      options,
    );
    assert.equal(otherFile.typeReference, 'require("../dto/item.dto").ItemDto');
  });
}
