const React = require('react');

const CarmiContext = React.createContext(null);

const privatesPerInstance = new WeakMap();

function getPrivates(instance) {
  if (!privatesPerInstance.has(instance)) {
    const privates = {
      descriptorToCompsMap: new WeakMap(),
      descriptorToElementsMap: new WeakMap(),
      pendingFlush: new Set(),
      compsLib: {},
      root: null,
      flush: () => {
        privates.root.setState({});
        privates.pendingFlush.forEach(comp => {
          comp.setState({});
        });
        privates.pendingFlush.clear();
      }
    };
    privatesPerInstance.set(instance, privates);
  }
  return privatesPerInstance.get(instance);
}

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
    const privates = getPrivates(this.props.value);
    privates.root = this;
    this.lastChildren = this.props.children();
    this.props.value.$addListener(privates.flush);
  }
  componentDidUpdate() {
    this.lastChildren = this.props.children();
  }
  componentWillUnmount() {
    const privates = getPrivates(this.props.value);
    this.props.value.$removeListener(privates.flush);
  }
}

class CarmiObserver extends React.Component {
  render() {
    let descriptor = this.props.descriptor;
    const type = descriptor[0];
    let props = null;
    if (descriptor[1]) {
      props = { ...descriptor[1] };
      if (props.hasOwnProperty('style')) {
        props.style = { ...descriptor[1].style };
      }
    }
    const children = descriptor.slice(2);
    const privates = getPrivates(this.context);
    const Component = privates.compsLib[type] || type;
    return React.createElement(Component, props, ...children);
  }
  componentDidMount() {
    const privates = getPrivates(this.context);
    if (!privates.descriptorToCompsMap.has(this.props.descriptor)) {
      privates.descriptorToCompsMap.set(this.props.descriptor, new Set());
    }
    privates.descriptorToCompsMap.get(this.props.descriptor).add(this);
  }
  componentDidUpdate() {
    const privates = getPrivates(this.context);
    privates.pendingFlush.delete(this);
  }
  componentWillUnmount() {
    const privates = getPrivates(this.context);
    if (!privates.descriptorToCompsMap.has(this.props.descriptor)) {
      privates.descriptorToCompsMap.set(this.props.descriptor, new Set());
    }
    privates.descriptorToCompsMap.get(this.props.descriptor).delete(this);
  }
}
CarmiObserver.contextType = CarmiContext;

function Provider({ children, value, compsLib = {} }) {
  const privates = getPrivates(value);
  privates.compsLib = compsLib;
  return React.createElement(CarmiRoot, { children, value });
}

function getMaybeKey(props, name) {
  return props && props.hasOwnProperty(name) ? props[name] : null;
}

function createElement(descriptor) {
  const key = getMaybeKey(descriptor[1], 'key');
  const type = descriptor[0];
  const privates = getPrivates(this);
  const prevElement = privates.descriptorToElementsMap.get(descriptor);
  if (prevElement && prevElement.props.type === type && getMaybeKey(prevElement.props, 'origKey') === key) {
    if (privates.root && privates.descriptorToCompsMap.has(descriptor)) {
      privates.descriptorToCompsMap.get(descriptor).forEach(comp => privates.pendingFlush.add(comp));
    }
  } else {
    const props = { descriptor, type };
    if (key !== null) {
      props.origKey = key;
      props.key = key;
    }
    const element = React.createElement(CarmiObserver, props);
    privates.descriptorToElementsMap.set(descriptor, element);
  }
  return privates.descriptorToElementsMap.get(descriptor);
}

module.exports = {
  carmiReactFnLib: { createElement },
  Provider
};
