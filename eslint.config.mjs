import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['**/dist/**', '**/.next/**', '**/node_modules/**', '**/*.d.ts'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-explicit-any': 'error',
      /*
       * `D-075`. Mot dau phay doi trong mang tham so SQL (`a,,b`) tao mot LO THUA: mang dai them
       * mot phan tu `undefined` va MOI tham so phia sau bi day lech mot o.
       *
       * Do dung la loi da xay ra that o `processing_receipts.create`, va no im lang tuyet doi:
       * typecheck xanh, lint xanh, va 806 phep kiem xanh — vi moi test cham toi bien nhan deu chay
       * tren ban trong bo nho. Chi lan chay THAT tren PostgreSQL moi lo ra.
       */
      'no-sparse-arrays': 'error',
    },
  },
);
