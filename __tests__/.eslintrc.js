module.exports = {
    env: {
        browser: true,
        es6: true
    },
    extends: ['airbnb', 'plugin:jest/recommended'],
    globals: {
        Atomics: 'readonly',
        SharedArrayBuffer: 'readonly',
        expect: 'readonly'
    },
    parserOptions: {
        ecmaFeatures: {
            jsx: true
        },
        ecmaVersion: 2018,
        sourceType: 'module'
    },
    plugins: ['react', 'babel', 'jest'],
    rules: {
        'no-plusplus': 0,
        'no-eval': 0,
        'max-classes-per-file': 0,
        'max-len': [2, 150],
        'jsx-a11y/no-static-element-interactions': 0,
        'jsx-a11y/click-events-have-key-events': 0,
        'react/jsx-props-no-spreading': 0,
        'react/prop-types': 0,
        'react/destructuring-assignment': 0,
        'react/jsx-filename-extension': 0,
        'react/no-array-index-key': 0,
        'jest/valid-describe': 0
    }
};
