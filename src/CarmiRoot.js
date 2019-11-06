import React from 'react';
import PropTypes from 'prop-types';
import { getPrivatesByInstance } from './privates';

export const CarmiContext = React.createContext(null);

export class CarmiRoot extends React.Component {
  constructor(props) {
    super(props);
    this.lastChildren = null;
  }

  componentDidMount() {
    const { value, children } = this.props;
    const privates = getPrivatesByInstance(value);
    privates.root = this;
    this.lastChildren = children();
    value.$addListener(privates.flush);
  }

  shouldComponentUpdate(newProps) {
    return newProps.children() !== this.lastChildren;
  }

  componentDidUpdate() {
    const { children } = this.props;
    this.lastChildren = children();
  }

  componentWillUnmount() {
    const { value } = this.props;
    const privates = getPrivatesByInstance(value);
    value.$removeListener(privates.flush);
  }

  render() {
    const { value, children } = this.props;
    return React.createElement(CarmiContext.Provider, { value }, children());
  }
}

CarmiRoot.propTypes = {
  children: PropTypes.func.isRequired,
  value: PropTypes.object.isRequired,
};
