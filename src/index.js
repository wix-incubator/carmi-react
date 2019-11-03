import {createElement} from './CarmiObserver';
import {CarmiRoot} from './CarmiRoot';
import React from 'react';
import {getPrivatesByInstance} from './privates';

export function Provider({children, value, compsLib = {}}) {
    const privates = getPrivatesByInstance(value);
    privates.compsLib = compsLib;
    return React.createElement(CarmiRoot, {children, value});
}

export function getFunctionsLibrary(customWrappers = []) {
    return {
        createElement: function(descriptor) {
            return createElement.call(this, customWrappers, descriptor);
        }
    };
}

export const carmiReactFnLib = getFunctionsLibrary();
