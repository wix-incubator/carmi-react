import React from 'react';
import PropTypes from 'prop-types';
import { createForwardRef, BUILT_IN_PROPS } from './CarmiForwardRef';
import { CarmiContext } from './CarmiRoot';
import { getPrivatesByInstance, getPrivatesByPointer, getPointerToInstance } from './privates';

const getMaybeKey = (props, name) => (props && props.hasOwnProperty(name) ? props[name] : null);

const parseDescriptor = (descriptor) => {
  const type = descriptor[0];
  const props = descriptor[1] || {};
  const children = descriptor.slice(2);
  const childrenList = children && Array.isArray(children[0]) && children.length === 1 ? children[0] : children;
  const { key: rawKey, ...extraProps } = props;
  const key = getMaybeKey(props, 'key');
  return {
    type, props, children, childrenList, rawKey, extraProps, key,
  };
};

const wrapElement = (wrappers, element, children) => wrappers.reduce((wrappedElement, wrapper) => wrapper(wrappedElement, children), element);

function replaceElementProps({ props }, newProps) {
  Object.assign(props, newProps);
  Object.keys(props).forEach((prop) => {
    if (!newProps.hasOwnProperty(prop) && !BUILT_IN_PROPS.hasOwnProperty(prop)) {
      delete props[prop]; // eslint-disable-line no-param-reassign
    }
  });
}

const registerInstance = (comp) => {
  const privates = getPrivatesByPointer(comp.props.token);
  if (!privates.descriptorToCompsMap.has(comp.props.descriptor)) {
    privates.descriptorToCompsMap.set(comp.props.descriptor, new Set());
  }
  privates.descriptorToCompsMap.get(comp.props.descriptor).add(comp);
};

class CarmiObserver extends React.Component {
  componentDidMount() {
    const { dirtyFlag } = this.props;
    registerInstance(this);
    if (dirtyFlag[0]) {
      this.setState({});
    }
  }

  shouldComponentUpdate(nextProps) {
    const { dirtyFlag, overrides } = this.props;
    return (
      nextProps.dirtyFlag !== dirtyFlag
            || nextProps.dirtyFlag[0]
            || nextProps.overrides !== overrides
    );
  }

  componentDidUpdate(prevProps) {
    const { descriptor, dirtyFlag } = this.props;
    if (prevProps.descriptor !== descriptor) {
      registerInstance(this);
    }

    if (dirtyFlag[0]) {
      this.setState({}); // eslint-disable-line react/no-did-update-set-state
    }
  }

  componentWillUnmount() {
    const { token, descriptor } = this.props;
    const privates = getPrivatesByPointer(token);
    privates.pendingFlush.delete(this);
    if (!privates.descriptorToCompsMap.has(descriptor)) {
      privates.descriptorToCompsMap.set(descriptor, new Set());
    }
    privates.descriptorToCompsMap.get(descriptor).delete(this);
  }

  render() {
    const {
      dirtyFlag, descriptor, overrides, token,
    } = this.props;
    dirtyFlag[0] = false;
    const { type, children, props: originalProps } = parseDescriptor(descriptor);
    let props = null;
    if (originalProps || overrides) {
      props = originalProps ? { ...originalProps, ...overrides } : overrides;
      if (props.hasOwnProperty('style')) {
        props.style = { ...props.style };
      }
    }
    const privates = getPrivatesByPointer(token);
    const Component = privates.compsLib[type] || type;
    return React.createElement(Component, props, ...children);
  }
}

CarmiObserver.contextType = CarmiContext;
CarmiObserver.defaultProps = {
  overrides: null,
};

CarmiObserver.propTypes = {
  dirtyFlag: PropTypes.arrayOf(PropTypes.bool).isRequired,
  descriptor: PropTypes.arrayOf(PropTypes.any).isRequired,
  token: PropTypes.any.isRequired,
  overrides: PropTypes.object,
};

const CarmiForwardRef = createForwardRef(CarmiObserver);

function createNewElement(observerProps, originalProps) {
  const { key: rawKey, ...extraProps } = originalProps;
  const compProps = { ...extraProps, ...observerProps, $internal: { originalProps, observerProps } };
  const rawElement = React.createElement(CarmiForwardRef, compProps);
  // sorry about doing it but
  // we short circuit the reconciliation code of React
  // and we need to mutate the props in place
  // so a parent component that is aware of the expected props
  // of a child can access them, even if they changed since the
  // last time React.createElement was triggered
  const element = { ...rawElement };
  element.props = { ...rawElement.props };

  return element;
}

export const createElement = (instance, descriptor, wrappers) => {
  const {
    type, props, childrenList, extraProps, key,
  } = parseDescriptor(descriptor);
  const privates = getPrivatesByInstance(instance);
  const currentElement = privates.descriptorToElementsMap.get(descriptor);
  if (currentElement && currentElement.props.type === type && getMaybeKey(currentElement.props, 'origKey') === key) {
    // Element is mounted
    currentElement.props.dirtyFlag[0] = true;
    if (privates.descriptorToCompsMap.get(descriptor)) {
      privates.descriptorToCompsMap.get(descriptor).forEach((comp) => privates.pendingFlush.add(comp));
    }
    replaceElementProps(currentElement, extraProps);
  } else {
    const dirtyFlag = [true];
    const observerProps = {
      descriptor,
      type,
      dirtyFlag,
      token: getPointerToInstance(instance),
    };
    if (key !== null) {
      observerProps.origKey = key;
      observerProps.key = key;
    }
    const newElement = createNewElement(observerProps, props);
    privates.descriptorToElementsMap.set(descriptor, newElement);
  }
  const element = privates.descriptorToElementsMap.get(descriptor);
  return wrapElement(wrappers, element, childrenList);
};
