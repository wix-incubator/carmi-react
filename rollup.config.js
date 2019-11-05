import babel from 'rollup-plugin-babel';

export default {
    input: 'src/index.js',
    output: {
        file: 'dist/index.js',
        format: 'cjs'
    },
    plugins: [
        babel({
            babelrc: false,
            exclude: 'node_modules/**',
            presets: [
                [
                    'env',
                    {
                        modules: false,
                        targets: {
                            ie: '11'
                        }
                    }
                ],
                'react'
            ],
            plugins: [
                'external-helpers',
                'transform-object-rest-spread',
                [
                    'transform-react-jsx',
                    {
                        pragma: 'createElement'
                    }
                ]
            ]
        })
    ]
};
