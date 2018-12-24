const React = require('react');

const CarmiContext = React.createContext(null);

const privatesPerInstance = new WeakMap();
const instanceByPointer = new WeakMap();

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

function getPrivatesByPointer(pointer) {
  return getPrivates(instanceByPointer.get(pointer));
}

class CarmiRoot extends React.Component {
  constructor(props) {
    super(props);
    this.lastChildren = null;
    this.token = {};
    instanceByPointer.set(this.token, props.value);
  }
  shouldComponentUpdate(newProps) {
    return newProps.children() !== this.lastChildren;
  }
  render() {
    return React.createElement(CarmiContext.Provider, {
      value: this.token,
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

const BUILT_IN_PROPS = {
  origKey: true,
  key: true,
  ref: true,
  descriptor: true,
  type: true
}

class CarmiObserver extends React.Component {
  render() {
    let descriptor = this.props.descriptor;
    const type = descriptor[0];
    let props = null;
    if (descriptor[1] || this.props.overrides) {
      props = descriptor[1] ? { ...descriptor[1], ...this.props.overrides } : this.props.overrides;
      if (props.hasOwnProperty('style')) {
        props.style = { ...props.style };
      }
    }
    const children = descriptor.slice(2);
    const privates = getPrivatesByPointer(this.context);
    const Component = privates.compsLib[type] || type;
    return React.createElement(Component, props, ...children);
  }
  componentDidMount() {
    const privates = getPrivatesByPointer(this.context);
    if (!privates.descriptorToCompsMap.has(this.props.descriptor)) {
      privates.descriptorToCompsMap.set(this.props.descriptor, new Set());
    }
    privates.descriptorToCompsMap.get(this.props.descriptor).add(this);
  }
  componentDidUpdate() {
    const privates = getPrivatesByPointer(this.context);
    privates.pendingFlush.delete(this);
  }
  componentWillUnmount() {
    const privates = getPrivatesByPointer(this.context);
    privates.pendingFlush.delete(this);
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
  const type = descriptor[0];
  const childProps = descriptor[1] || {};
  const { key: rawKey, ...childExtraProps } = childProps;
  const key = getMaybeKey(childProps, 'key');
  const privates = getPrivates(this);
  const prevElement = privates.descriptorToElementsMap.get(descriptor);
  if (prevElement && prevElement.props.type === type && getMaybeKey(prevElement.props, 'origKey') === key) {
    if (privates.root && privates.descriptorToCompsMap.has(descriptor)) {
      privates.descriptorToCompsMap.get(descriptor).forEach(comp => privates.pendingFlush.add(comp));
    }
    Object.assign(prevElement.props, childExtraProps);
    Object.keys(prevElement.props).forEach(prop => {
      if (!childExtraProps.hasOwnProperty(prop) && !BUILT_IN_PROPS.hasOwnProperty(prop)) {
        delete prevElement.props[prop];
      }
    });
  } else {
    const props = { descriptor, type };
    if (key !== null) {
      props.origKey = key;
      props.key = key;
    }
    const rawElement = React.createElement(React.forwardRef((forwardProps, forwardedRef) => {
      let overrides = null;
      Object.keys(forwardProps).forEach(prop => {
        if (!BUILT_IN_PROPS.hasOwnProperty(prop) && forwardProps[prop] !== childProps[prop]) {
          overrides = overrides || {};
          overrides[prop] = forwardProps[prop];
        }
      })
      return React.createElement( CarmiObserver, {...props,overrides, forwardedRef})
    }), { ...props, ...childExtraProps });
    // sorry about doing it but 
    // we short circuit the reconcilation code of React
    // and we need to mutate the props in place
    // so a parent component that is aware of the expected props
    // of a child can access them, even if they changed since the
    // last time React.createElement was triggered
    const element = { ...rawElement }
    element.props = { ...rawElement.props };
    privates.descriptorToElementsMap.set(descriptor, element);
  }
  return privates.descriptorToElementsMap.get(descriptor);
}

module.exports = {
  carmiReactFnLib: { createElement },
  Provider
};
