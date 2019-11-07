const node = {node: 'current'}
const browser = {ie: '11'}
const targets = process.env.npm_lifecycle_event === 'test' ? node : browser

module.exports = {
  presets: [
    [
      '@babel/preset-env',
      {targets},
    ],
  ],
  plugins: [
    '@babel/plugin-proposal-object-rest-spread',
    '@babel/plugin-proposal-class-properties',
    [
      '@babel/plugin-transform-react-jsx',
      {
        pragma: 'createElement',
      },
    ],
  ],
};
