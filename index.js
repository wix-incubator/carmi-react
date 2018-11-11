const React = require('react');

const CarmiContext = React.createContext(null);

class CarmiRoot extends React.Component {
  constructor(props) {
    super(props);
    this.lastChildren = null;
  }
  shouldComponentUpdate(newProps) {
    return newProps.children() !== this.lastChildren;
  }
  render() {
    return React.createElement(CarmiContext.Provider, {
      value: this.props.value,
      children: this.props.children()
    });
  }
  componentDidMount() {
    this.props.value.root = this;
    this.lastChildren = this.props.children();
    this.props.value.instance.$addListener(this.props.value.flush);
  }
  componentDidUpdate() {
    this.lastChildren = this.props.children();
  }
  componentWillUnmount() {
    this.props.value.instance.$removeListener(this.props.value.flush);
  }
}

class CarmiObserver extends React.Component {
  constructor(props) {
    super(props);
    this.context = null;
  }
  render() {
    return React.createElement(CarmiContext.Consumer, {
      children: context => {
        this.context = context;
        let descriptor = this.props.descriptor;
        const type = descriptor[0];
        const props = descriptor[1] || {};
        if (props.hasOwnProperty('style')) {
          props.style = { ...props.style };
        }
        const children = descriptor.slice(2);
        if (!context.compsLib.hasOwnProperty(type)) {
          return React.createElement.apply(React, [type, props].concat(children || []));
        } else {
          const cls = context.compsLib[type];
          if (cls.prototype && cls.prototype.render) {
            return React.createElement.apply(React, [cls, props].concat(children || []));
          } else {
            return cls.apply(context.instance, [props].concat(children || []));
          }
        }
      }
    });
  }
  componentDidMount() {
    const context = this.context;
    if (!context.descriptorToCompsMap.has(this.props.descriptor)) {
      context.descriptorToCompsMap.set(this.props.descriptor, new Set());
    }
    context.descriptorToCompsMap.get(this.props.descriptor).add(this);
  }
  componentDidUpdate() {
    const context = this.context;
    context.pendingFlush.delete(this);
  }
  componentWillUnmount() {
    const context = this.context;
    if (!context.descriptorToCompsMap.has(this.props.descriptor)) {
      context.descriptorToCompsMap.set(this.props.descriptor, new Set());
    }
    context.descriptorToCompsMap.get(this.props.descriptor).delete(this);
  }
}

function init(compsLib) {
  compsLib = compsLib || {};
  const descriptorToCompsMap = new WeakMap();
  const descriptorToElementsMap = new WeakMap();
  const pendingFlush = new Set();

  const context = {
    descriptorToCompsMap,
    descriptorToElementsMap,
    compsLib,
    pendingFlush,
    root: null
  };

  function getMaybeKey(props, name) {
    return props && props.hasOwnProperty(name) ? props[name] : null;
  }

  function createElement(descriptor) {
    const key = getMaybeKey(descriptor[1], 'key');
    const type = descriptor[0];
    if (context.root && context.descriptorToCompsMap.has(descriptor)) {
      context.descriptorToCompsMap.get(descriptor).forEach(comp => pendingFlush.add(comp));
    }
    const prevElement = context.descriptorToElementsMap.get(descriptor);
    if (prevElement && prevElement.props.type === type && getMaybeKey(prevElement.props, 'origKey') === key) {
      if (context.root && context.descriptorToCompsMap.has(descriptor)) {
        context.descriptorToCompsMap.get(descriptor).forEach(comp => pendingFlush.add(comp));
      }
    } else {
      const props = { descriptor, type };
      if (key !== null) {
        props.origKey = key;
      }
      const element = React.createElement(CarmiObserver, props);
      context.descriptorToElementsMap.set(descriptor, element);
    }
    return context.descriptorToElementsMap.get(descriptor);
  }

  function flush() {
    context.root.setState({});
    pendingFlush.forEach(comp => {
      comp.setState({});
    });
    pendingFlush.clear();
  }

  const funcLib = {
    createElement
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
