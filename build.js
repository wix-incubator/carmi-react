const { chain } = require('carmi');

function createElement(props, type) {
  return chain({ type, props }).call('createElement');
}

module.exports = createElement;
