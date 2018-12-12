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

function invoke(fn) {
  if (typeof fn === 'function') {
    fn();
  }
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

class CarmiObserver extends React.Component {
  constructor(props) {
    super(props);
    this.state = {};
  }

  render() {
    let descriptor = this.props.descriptor;
    const type = descriptor[0];
    let props = null;
    if (descriptor[1]) {
      const {onRenderStart, onRenderEnd, ...compProps} = {...descriptor[1]};
      props = compProps;
      if (props.hasOwnProperty('style')) {
        props.style = {...descriptor[1].style};
      }
    }
    const children = descriptor.slice(2);
    const privates = getPrivatesByPointer(this.context);
    const Component = privates.compsLib[type] || type;
    return React.createElement(Component, props, ...children);
  }

  static getDerivedStateFromProps(props) {
    invoke(props.onRenderStart);
    return null;
  }

  componentDidMount() {
    const privates = getPrivatesByPointer(this.context);
    if (!privates.descriptorToCompsMap.has(this.props.descriptor)) {
      privates.descriptorToCompsMap.set(this.props.descriptor, new Set());
    }
    privates.descriptorToCompsMap.get(this.props.descriptor).add(this);
    invoke(this.props.onRenderEnd);
  }
  componentDidUpdate() {
    const privates = getPrivatesByPointer(this.context);
    privates.pendingFlush.delete(this);
    invoke(this.props.onRenderEnd);
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
  const { ref: rawRef, key: rawKey, ...childExtraProps } = childProps;
  const ref = getMaybeKey(childProps, 'ref');
  const key = getMaybeKey(childProps, 'key');
  const privates = getPrivates(this);
  const prevElement = privates.descriptorToElementsMap.get(descriptor);
  if (prevElement && prevElement.props.type === type && getMaybeKey(prevElement.props, 'origKey') === key) {
    if (privates.root && privates.descriptorToCompsMap.has(descriptor)) {
      privates.descriptorToCompsMap.get(descriptor).forEach(comp => privates.pendingFlush.add(comp));
    }
    Object.assign(prevElement.props, childExtraProps);
  } else {
    const props = { descriptor, type };
    if (key !== null) {
      props.origKey = key;
      props.key = key;
    }
    const rawElement = React.createElement(React.forwardRef((forwardProps, forwardedRef) => React.createElement( CarmiObserver, {...forwardProps, forwardedRef})), { ...props, ...childExtraProps });
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
