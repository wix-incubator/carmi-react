import React from 'react';
import {createForwardRef, BUILT_IN_PROPS} from './CarmiForwardRef';
import {CarmiContext} from './CarmiRoot';
import {getPrivatesByInstance, getPrivatesByPointer, getPointerToInstance} from './privates';

const getMaybeKey = (props, name) => (props && props.hasOwnProperty(name) ? props[name] : null);

const parseDescriptor = descriptor => {
    const type = descriptor[0];
    const props = descriptor[1] || {};
    const children = descriptor.slice(2);
    const childrenList = children && Array.isArray(children[0]) && children.length === 1 ? children[0] : children;
    const {key: rawKey, ...extraProps} = props;
    const key = getMaybeKey(props, 'key');
    return {type, props, children, childrenList, rawKey, extraProps, key};
};

const wrapElement = (wrappers, element, children) =>
    wrappers.reduce((wrappedElement, wrapper) => wrapper(wrappedElement, children), element);

function replaceElementProps(element, newProps) {
    Object.assign(element.props, newProps);
    Object.keys(element.props).forEach(prop => {
        if (!newProps.hasOwnProperty(prop) && !BUILT_IN_PROPS.hasOwnProperty(prop)) {
            delete element.props[prop];
        }
    });
}

const registerInstance = comp => {
    const privates = getPrivatesByPointer(comp.props.token);
    if (!privates.descriptorToCompsMap.has(comp.props.descriptor)) {
        privates.descriptorToCompsMap.set(comp.props.descriptor, new Set());
    }
    privates.descriptorToCompsMap.get(comp.props.descriptor).add(comp);
}

class CarmiObserver extends React.Component {
    render() {
        this.props.dirtyFlag[0] = false;
        const descriptor = this.props.descriptor;
        const {type, children, props: originalProps} = parseDescriptor(descriptor);
        let props = null;
        if (originalProps || this.props.overrides) {
            props = originalProps ? {...originalProps, ...this.props.overrides} : this.props.overrides;
            if (props.hasOwnProperty('style')) {
                props.style = {...props.style};
            }
        }
        const privates = getPrivatesByPointer(this.props.token);
        const Component = privates.compsLib[type] || type;
        return React.createElement(Component, props, ...children);
    }
    componentDidMount() {
        registerInstance(this);
        if (this.props.dirtyFlag[0]) {
            this.setState({});
        }
    }
    shouldComponentUpdate(nextProps) {
        return (
            nextProps.dirtyFlag !== this.props.dirtyFlag ||
            nextProps.dirtyFlag[0] ||
            nextProps.overrides !== this.props.overrides
        );
    }
    componentDidUpdate({descriptor}) {
        if (descriptor !== this.props.descriptor) {
            registerInstance(this)
        }

        if (this.props.dirtyFlag[0]) {
            this.setState({});
        }
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

const CarmiForwardRef = createForwardRef(CarmiObserver);

function createNewElement(observerProps, originalProps) {
    const {key: rawKey, ...extraProps} = originalProps;
    const compProps = {...extraProps, ...observerProps, $internal: {originalProps, observerProps}};
    const rawElement = React.createElement(CarmiForwardRef, compProps);
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

export function createElement(wrappers, descriptor) {
    const {type, props, childrenList, extraProps, key} = parseDescriptor(descriptor);
    const privates = getPrivatesByInstance(this);
    const currentElement = privates.descriptorToElementsMap.get(descriptor);
    if (currentElement && currentElement.props.type === type && getMaybeKey(currentElement.props, 'origKey') === key) {
        // Element is mounted
        currentElement.props.dirtyFlag[0] = true;
        if (privates.descriptorToCompsMap.get(descriptor)) {
            privates.descriptorToCompsMap.get(descriptor).forEach(comp => privates.pendingFlush.add(comp));
        }
        replaceElementProps(currentElement, extraProps);
    } else {
        const dirtyFlag = [true];
        const observerProps = {
            descriptor,
            type,
            dirtyFlag,
            token: getPointerToInstance(this)
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
}
