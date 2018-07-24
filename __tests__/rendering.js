const { compile, and, or, root, arg0, arg1, setter, splice, chain } = require('carmi');
const carmiReact = require('../index');
const createElement = require('../build');
const renderer = require('react-test-renderer');
const React = require('react');

let renderCounter = 0;
function renderEcho(type, props, ...children) {
  renderCounter++;
  return React.createElement.apply(React, [type, props].concat(children));
}

function expectRenders(cnt) {
  expect(cnt).toEqual(renderCounter);
  renderCounter = 0;
}

beforeEach(() => {
  renderCounter = 0;
});

describe('rendering', () => {
  it('basic rendering using DOM types directly', async () => {
    const { Provider, funcLib } = carmiReact();
    const todos = root.map((item, idx) => <span key={idx}>{item}</span>);
    const todosList = <div>{todos}</div>;
    const model = {
      todosList,
      setItem: setter(arg0)
    };
    const optCode = eval(await compile(model, { compiler: 'optimizing' }));
    const initialState = ['first', 'second', 'third'];
    const inst = optCode(initialState, funcLib);
    const mounted = renderer.create(Provider({ children: () => inst.todosList, instance: inst }));
    expect(mounted.toJSON()).toMatchSnapshot();
    inst.setItem(1, 'changed the second item');
    expect(mounted.toJSON()).toMatchSnapshot();
    inst.setItem(3, 'Added a fourth item');
    expect(mounted.toJSON()).toMatchSnapshot();
  });
  it('basic rendering using functions in compNames map', async () => {
    const { Provider, funcLib } = carmiReact({
      span: renderEcho.bind(null, 'span'),
      div: renderEcho.bind(null, 'div')
    });
    const todos = root.map((item, idx) => <span key={idx}>{item}</span>);
    const todosList = <div>{todos}</div>;
    const model = {
      todosList,
      setItem: setter(arg0)
    };
    const optCode = eval(await compile(model, { compiler: 'optimizing' }));
    const initialState = ['first', 'second', 'third'];
    const inst = optCode(initialState, funcLib);
    const mounted = renderer.create(Provider({ children: () => inst.todosList, instance: inst }));
    expectRenders(4);
    expect(mounted.toJSON()).toMatchSnapshot();
    inst.setItem(1, 'changed the second item');
    expectRenders(1);
    expect(mounted.toJSON()).toMatchSnapshot();
    inst.setItem(3, 'Added a fourth item');
    expectRenders(2);
    expect(mounted.toJSON()).toMatchSnapshot();
  });
  it('basic rendering using functions in compNames map wire events to instance', async () => {
    const { Provider, funcLib } = carmiReact({
      todo: function({ idx }, ...children) {
        return renderEcho('span', {
          children,
          onClick: () => {
            this.setItem(idx, this.$model[idx] + '!');
          }
        });
      },
      div: renderEcho.bind(null, 'div'),
      span: renderEcho.bind(null, 'span')
    });
    const todos = root.map((item, idx) => (
      <todo idx={idx} key={idx}>
        {item}
      </todo>
    ));
    const todosList = <div>{todos}</div>;
    const model = {
      todosList,
      setItem: setter(arg0)
    };
    const optCode = eval(await compile(model, { compiler: 'optimizing' }));
    const initialState = ['first', 'second', 'third'];
    const inst = optCode(initialState, funcLib);
    const mounted = renderer.create(Provider({ children: () => inst.todosList, instance: inst }));
    expect(mounted.toJSON()).toMatchSnapshot();
    expectRenders(4);
    const items = mounted.root.findAllByType('span');
    items[0].props.onClick();
    expectRenders(1);
    expect(mounted.toJSON()).toMatchSnapshot();
  });
  it('multiple children support', async () => {
    const { Provider, funcLib } = carmiReact({
      todo: function({ idx }, ...children) {
        return renderEcho('span', {
          children,
          onClick: () => {
            this.setItem(idx, true);
          }
        });
      },
      div: renderEcho.bind(null, 'div')
    });
    const todos = root.map((item, idx) => (
      <todo idx={idx} key={idx}>
        {item
          .get('clicked')
          .ternary('+ ', '- ')
          .plus(item.get('title'))}
      </todo>
    ));
    const todosList = (
      <div>
        {todos}
        <span>items not clicked:{root.filter(item => item.get('clicked').not()).size()}</span>
      </div>
    );
    const model = {
      todosList,
      setItem: setter(arg0, 'clicked')
    };
    const optCode = eval(await compile(model, { compiler: 'optimizing' }));
    const initialState = [
      { title: 'first', clicked: false },
      { title: 'second', clicked: false },
      { title: 'third', clicked: false }
    ];
    const inst = optCode(initialState, funcLib);
    const mounted = renderer.create(Provider({ children: () => inst.todosList, instance: inst }));
    expect(mounted.toJSON()).toMatchSnapshot();
    expectRenders(4);
    const items = mounted.root.findAllByType('span');
    items[0].props.onClick();
    expectRenders(1);
    expect(mounted.toJSON()).toMatchSnapshot();
  });
});
