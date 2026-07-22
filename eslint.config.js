// 最小 ESLint 扁平配置(ESLint 9 + typescript-eslint)。
// TypeScript 语义类型检查交给 `pnpm typecheck`(tsc);ESLint 只管代码质量规则。
import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['**/dist/**', '**/node_modules/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      // 以 `_` 开头的绑定视为有意未用(如 parse.ts 里的类型层自检别名 _Assert*)。
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
);
