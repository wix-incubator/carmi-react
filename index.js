const React = require('react');

const { Provider, Consumer } = React.createContext(null);

class CarmiRoot extends React.Component {
  constructor(props) {
    super(props);
  }
  render() {
    return React.createElement(Provider, {
      value: this.props.value,
      children: this.props.children
    });
  }
  componentDidMount() {
    this.props.value.root = this;
  }
}

class CarmiObserver extends React.Component {
  constructor(props) {
    super(props);
  }
  render() {
    return React.createElement(Consumer, {
      children: context => {
        context.descriptorToCompsMap.set(this.props.descriptor, this);
        const { type, props } = this.props.descriptor;
        if (!context.componentFromName.hasOwnProperty(type)) {
          return React.createElement(type, props);
        } else {
          const cls = context.componentFromName[type];
          if (cls.prototype && cls.prototype.render) {
            return React.createElement(cls, props);
          } else {
            return cls(props, context.instance);
          }
        }
      }
    });
  }
}

function init(componentFromName) {
  componentFromName = componentFromName || {};
  const descriptorToCompsMap = new WeakMap();
  const descriptorToElementsMap = new WeakMap();
  const pendingFlush = new Set();

  const context = {
    descriptorToCompsMap,
    descriptorToElementsMap,
    componentFromName,
    pendingFlush,
    root: null
  };

  function createElement(descriptor) {
    const { props } = descriptor;
    const key = props.key;
    if (context.root && context.descriptorToCompsMap.has(descriptor)) {
      pendingFlush.add(descriptor);
    }
    if (!context.descriptorToElementsMap.has(descriptor)) {
      const element = React.createElement(CarmiObserver, { descriptor, key });
      context.descriptorToElementsMap.set(descriptor, element);
    }
    return context.descriptorToElementsMap.get(descriptor);
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
    createElement
  };

  function provider({ children, instance }) {
    context.instance = instance;
    return React.createElement(CarmiRoot, { children, value: context });
  }

  return {
    funcLib,
    flush,
    provider
  };
}

module.exports = init;
