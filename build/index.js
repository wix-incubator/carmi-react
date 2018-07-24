const { chain } = require('carmi');

function createElement(type, props, ...children) {
  if (children.length) {
    return chain({ type, props, children }).call('createElement');
  }
  return chain({ type, props }).call('createElement');
}

module.exports = createElement;
