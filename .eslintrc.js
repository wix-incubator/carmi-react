module.exports = {
  env: {
    browser: true,
    es6: true,
  },
  extends: ['airbnb'],
  globals: {
    Atomics: 'readonly',
    SharedArrayBuffer: 'readonly',
  },
  parser: 'babel-eslint',
  parserOptions: {
    ecmaFeatures: {
      jsx: true,
    },
    ecmaVersion: 2018,
    sourceType: 'module',
  },
  plugins: ['react', 'babel'],
  rules: {
    'max-len': [2, 150],
    'no-prototype-builtins': 0,
    'react/forbid-prop-types': 0,
    'react/jsx-filename-extension': 0,
    'import/prefer-default-export': 0
  },
};
