import React from 'react';
import PropTypes from 'prop-types';
import {getPrivatesByInstance} from './privates';

export const CarmiContext = React.createContext(null);

export class CarmiRoot extends React.Component {
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
