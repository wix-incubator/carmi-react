const { compile, and, or, root, arg0, arg1, setter, splice, chain } = require('carmi');
const carmiReact = require('../index');
const createElement = require('../build');
const renderer = require('react-test-renderer');

describe('rendering', () => {
  it('basic', async () => {
    const { provider, flush, funcLib } = carmiReact();
    const todos = root.map((item, idx) => createElement({ children: item, key: idx }, 'span'));
    const todosList = createElement({ children: todos }, 'div');
    const model = {
      todosList,
      setItem: setter(arg0)
    };
    const optCode = eval(await compile(model, { compiler: 'optimizing' }));
    const initialState = ['first', 'second', 'third'];
    const inst = optCode(initialState, funcLib);
    inst.$addListener(flush);
    const mounted = renderer.create(provider({ children: inst.todosList, instance: inst }));
    expect(mounted.toJSON()).toMatchSnapshot();
    inst.setItem(1, 'changed the second item');
    expect(mounted.toJSON()).toMatchSnapshot();
    inst.setItem(3, 'Added a fourth item');
    expect(mounted.toJSON()).toMatchSnapshot();
  });
});
