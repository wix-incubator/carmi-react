import React from 'react';
import PropTypes from 'prop-types';

export const BUILT_IN_PROPS = {
    origKey: true,
    key: true,
    ref: true,
    descriptor: true,
    type: true,
    dirtyFlag: true,
    token: true,
    $internal: true
};

function getOverrides(originalProps, props) {
    let overrides = null;
    Object.keys(props).forEach(prop => {
        if (!BUILT_IN_PROPS.hasOwnProperty(prop) && originalProps[prop] !== props[prop]) {
            overrides = overrides || {};
            overrides[prop] = props[prop];
        }
    });
    return overrides;
}

export const createForwardRef = CarmiObserver => {
    const Component = (props, forwardedRef) => {
        const {
            $internal: {observerProps, originalProps},
            ...forwardProps
        } = props;
        let overrides = getOverrides(originalProps, forwardProps);
        return React.createElement(CarmiObserver, {...observerProps, overrides, forwardedRef});
    };

    const forwardRef = React.forwardRef(Component);
    forwardRef.displayName = 'CarmiForwardRef';
    forwardRef.propTypes = {
        $internal: PropTypes.shape({
            observerProps: PropTypes.object,
            originalProps: PropTypes.object
        }).isRequired
    };

    return forwardRef;
};
