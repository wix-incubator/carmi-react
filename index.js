const React = require('react');

const CarmiContext = React.createContext(null);

const privatesByPointer = new WeakMap();
const pointerByInstance = new WeakMap();

function getPrivatesByPointer(pointer) {
  if (!privatesByPointer.has(pointer)) {
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
    privatesByPointer.set(pointer, privates);
  }
  return privatesByPointer.get(pointer);
}

function getPrivatesByInstance(instance) {
  if (!pointerByInstance.has(instance)) {
    pointerByInstance.set(instance, {});
  }
  return getPrivatesByPointer(pointerByInstance.get(instance));
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
      children: this.props.children()
    });
  }
  componentDidMount() {
    const privates = getPrivatesByInstance(this.props.value);
    privates.root = this;
    this.lastChildren = this.props.children();
    this.props.value.$addListener(privates.flush);
  }
  componentDidUpdate() {
    this.lastChildren = this.props.children();
  }
  componentWillUnmount() {
    const privates = getPrivatesByInstance(this.props.value);
    this.props.value.$removeListener(privates.flush);
  }
}

const BUILT_IN_PROPS = {
  origKey: true,
  key: true,
  ref: true,
  descriptor: true,
  type: true,
  dirtyFlag: true,
  token: true
}

class CarmiObserver extends React.Component {
  render() {
    this.props.dirtyFlag[0] = false;
    const descriptor = this.props.descriptor;
    const {type, children, props: originalProps} = parseDescriptor(descriptor);
    let props = null;
    if (originalProps || this.props.overrides) {
      props = originalProps ? { ...originalProps, ...this.props.overrides } : this.props.overrides;
      if (props.hasOwnProperty('style')) {
        props.style = { ...props.style };
      }
    }
    const privates = getPrivatesByPointer(this.props.token);
    const Component = privates.compsLib[type] || type;
    return React.createElement(Component, props, ...children);
  }
  componentDidMount() {
    const privates = getPrivatesByPointer(this.props.token);
    if (!privates.descriptorToCompsMap.has(this.props.descriptor)) {
      privates.descriptorToCompsMap.set(this.props.descriptor, new Set());
    }
    privates.descriptorToCompsMap.get(this.props.descriptor).add(this);
    if (this.props.dirtyFlag[0]) {
      this.setState({});
    }
  }
  componentDidUpdate() {
    const privates = getPrivatesByPointer(this.props.token);
    privates.pendingFlush.delete(this);
  }
  componentWillUnmount() {
    const privates = getPrivatesByPointer(this.props.token);
    privates.pendingFlush.delete(this);
    if (!privates.descriptorToCompsMap.has(this.props.descriptor)) {
      privates.descriptorToCompsMap.set(this.props.descriptor, new Set());
    }
    privates.descriptorToCompsMap.get(this.props.descriptor).delete(this);
  }
}
CarmiObserver.contextType = CarmiContext;

function Provider({ children, value, compsLib = {} }) {
  const privates = getPrivatesByInstance(value);
  privates.compsLib = compsLib;
  return React.createElement(CarmiRoot, { children, value });
}

function getMaybeKey(props, name) {
  return props && props.hasOwnProperty(name) ? props[name] : null;
}

function replaceElementProps(element, newProps) {
  Object.assign(element.props, newProps);
  Object.keys(element.props).forEach(prop => {
    if (!newProps.hasOwnProperty(prop) && !BUILT_IN_PROPS.hasOwnProperty(prop)) {
      delete element.props[prop];
    }
  });
}

function parseDescriptor(descriptor) {
  const type = descriptor[0];
  const props = descriptor[1] || {};
  const children = descriptor.slice(2);
  const childrenList = children && Array.isArray(children[0]) && children.length === 1 ? children[0] : children;
  const { key: rawKey, ...extraProps } = props;
  const key = getMaybeKey(props, 'key');
  return {type, props, children, childrenList, rawKey, extraProps, key};
}

const wrapElement = (wrappers, element, children) => wrappers.reduce((wrappedElement, wrapper) => wrapper(wrappedElement, children), element)

function createElement(wrappers, descriptor) {
  const {type, props, childrenList, extraProps, key} = parseDescriptor(descriptor);
  const privates = getPrivatesByInstance(this);
  const currentElement = privates.descriptorToElementsMap.get(descriptor);
  if (currentElement && currentElement.props.type === type && getMaybeKey(currentElement.props, 'origKey') === key) {
    // Element is mounted
    if (privates.root && privates.descriptorToCompsMap.has(descriptor)) {
      privates.descriptorToCompsMap.get(descriptor).forEach(comp => privates.pendingFlush.add(comp));
    } else {
      currentElement.props.dirtyFlag[0] = true;
    }
    replaceElementProps(currentElement, extraProps);
  } else {
    const dirtyFlag = [true];
    const observerProps = {descriptor, type, dirtyFlag, token: pointerByInstance.get(this)};
    if (key !== null) {
      observerProps.origKey = key;
      observerProps.key = key;
    }
    const newElement = createNewElement(observerProps, props);
    privates.descriptorToElementsMap.set(descriptor, newElement);
  }
  const element = privates.descriptorToElementsMap.get(descriptor);
  return wrapElement(wrappers, element, childrenList);
}

function getOverrides(originalProps, props) {
  let overrides = null;
  Object.keys(props).forEach(prop => {
    if (!BUILT_IN_PROPS.hasOwnProperty(prop) && originalProps[prop] !== props[prop]) {
      overrides = overrides || {};
      overrides[prop] = props[prop];
    }
  })
  return overrides;
}

function createNewElement(observerProps, props) {
  const {key: rawKey, ...extraProps} = props;
  const type = React.forwardRef((forwardProps, forwardedRef) => {
    let overrides = getOverrides(props, forwardProps);
    return React.createElement(CarmiObserver, {...observerProps, overrides, forwardedRef});
  })
  const compProps = {...observerProps, ...extraProps};
  const rawElement = React.createElement(type, compProps);
  // sorry about doing it but
  // we short circuit the reconciliation code of React
  // and we need to mutate the props in place
  // so a parent component that is aware of the expected props
  // of a child can access them, even if they changed since the
  // last time React.createElement was triggered
  const element = {...rawElement};
  element.props = {...rawElement.props};

  return element;
}

function getFunctionsLibrary(customWrappers = []) {
    return {
        createElement: function(descriptor) {
            return createElement.call(this, customWrappers, descriptor);
        }
    };
}

module.exports = {
  carmiReactFnLib: getFunctionsLibrary(),
  getFunctionsLibrary,
  Provider
};
