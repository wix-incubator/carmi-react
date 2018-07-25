const React = require('react');

const CarmiContext = React.createContext(null);

class CarmiRoot extends React.Component {
  constructor(props) {
    super(props);
  }
  render() {
    return React.createElement(CarmiContext.Provider, {
      value: this.props.value,
      children: this.props.children()
    });
  }
  componentDidMount() {
    this.props.value.root = this;
    this.props.value.instance.$addListener(this.props.value.flush);
  }
  componentWillUnmount() {
    this.props.value.instance.$removeListener(this.props.value.flush);
  }
}

class CarmiObserver extends React.Component {
  constructor(props) {
    super(props);
  }
  render() {
    return React.createElement(CarmiContext.Consumer, {
      children: context => {
        context.descriptorToCompsMap.set(this.props.descriptor, this);
        const { type, props, children } = this.props.descriptor;
        if (!context.extraFuncLib.hasOwnProperty(type)) {
          return React.createElement.apply(React, [type, props].concat(children || []));
        } else {
          const cls = context.extraFuncLib[type];
          if (cls.prototype && cls.prototype.render) {
            return React.createElement.apply(React, [cls, props].concat(children || []));
          } else {
            return cls.apply(context.instance, [props].concat(children || []));
          }
        }
      }
    });
  }
}

function init(extraFuncLib) {
  extraFuncLib = extraFuncLib || {};
  const descriptorToCompsMap = new WeakMap();
  const descriptorToElementsMap = new WeakMap();
  const bindArrToFunctions = new WeakMap();
  const pendingFlush = new Set();

  const context = {
    descriptorToCompsMap,
    descriptorToElementsMap,
    extraFuncLib,
    pendingFlush,
    bindArrToFunctions,
    root: null
  };

  function createElement(descriptor) {
    const { props } = descriptor;
    const key = props && props.key;
    if (context.root && context.descriptorToCompsMap.has(descriptor)) {
      pendingFlush.add(descriptor);
    }
    if (!context.descriptorToElementsMap.has(descriptor)) {
      const element = React.createElement(CarmiObserver, { descriptor, key });
      context.descriptorToElementsMap.set(descriptor, element);
    }
    return context.descriptorToElementsMap.get(descriptor);
  }

  function bind(args) {
    if (!context.bindArrToFunctions.has(args)) {
      context.bindArrToFunctions.set(args, function() {
        extraFuncLib[args[0]].apply(null, [context.instance].concat(args.slice(1)));
      });
    }
    return context.bindArrToFunctions.get(args);
  }

  function flush(val) {
    pendingFlush.forEach(element => {
      if (context.root) {
        const comp = descriptorToCompsMap.get(element);
        if (comp) {
          comp.forceUpdate(() => {});
        }
        context.root.forceUpdate(() => {});
      }
    });
    pendingFlush.clear();
    return val;
  }

  const funcLib = {
    createElement,
    bind
  };

  function Provider({ children, instance }) {
    context.instance = instance;
    context.flush = flush;
    return React.createElement(CarmiRoot, { children, value: context });
  }

  return {
    funcLib,
    Provider
  };
}

module.exports = init;
