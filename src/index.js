import React from 'react';
import PropTypes from 'prop-types';
import { createElement } from './CarmiObserver';
import { CarmiRoot } from './CarmiRoot';
import { getPrivatesByInstance } from './privates';

export function Provider({ children, value, compsLib }) {
  const privates = getPrivatesByInstance(value);
  privates.compsLib = compsLib;
  return React.createElement(CarmiRoot, { value }, children);
}

Provider.defaultProps = {
  compsLib: {},
};

Provider.propTypes = {
  children: PropTypes.func.isRequired,
  value: PropTypes.object.isRequired,
  compsLib: PropTypes.object,
};

export function getFunctionsLibrary(customWrappers = []) {
  return {
    createElement(descriptor) {
      return createElement(this, descriptor, customWrappers);
    },
  };
}

export const carmiReactFnLib = getFunctionsLibrary();
