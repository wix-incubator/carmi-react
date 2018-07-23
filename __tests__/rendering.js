const { compile, and, or, root, arg0, arg1, setter, splice, chain } = require('carmi');
const carmiReact = require('../index');
const createElement = require('../build');
const renderer = require('react-test-renderer');
const React = require('react');

let renderCounter = 0;
function renderEcho(type, props) {
  renderCounter++;
  return React.createElement(type, props);
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
    const todos = root.map((item, idx) => createElement({ children: item, key: idx }, 'span'));
    const todosList = createElement({ children: todos }, 'div');
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
    const todos = root.map((item, idx) => createElement({ children: item, key: idx }, 'span'));
    const todosList = createElement({ children: todos }, 'div');
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
      Todo: ({ children, idx }, instance) =>
        renderEcho('span', {
          children,
          onClick: () => {
            instance.setItem(idx, instance.$model[idx] + '!');
          }
        }),
      div: renderEcho.bind(null, 'div')
    });
    const todos = root.map((item, idx) => createElement({ children: item, key: idx, idx }, 'Todo'));
    const todosList = createElement({ children: todos }, 'div');
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
});
