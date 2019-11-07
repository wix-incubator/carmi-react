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
    parserOptions: {
        ecmaFeatures: {
            jsx: true,
        },
        ecmaVersion: 2018,
        sourceType: 'module',
    },
    plugins: ['react', 'babel'],
    rules: {
        'object-curly-newline': 0,
        'implicit-arrow-linebreak': 0,
        'arrow-parens': [2, 'as-needed'],
        indent: ['error', 4],
        'max-len': [2, 150],
        'no-prototype-builtins': 0,
        'react/forbid-prop-types': 0,
        'react/jsx-filename-extension': 0,
        'import/prefer-default-export': 0,
    },
};
