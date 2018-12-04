const { compile, and, or, root, arg0, arg1, setter, splice, ternary, chain, bind } = require('carmi');
const { Provider, carmiReactFnLib } = require('../index');
const { createElement } = require('carmi/jsx');
const renderer = require('react-test-renderer');
const React = require('react');

let renderCounter = 0;
let markRenderCalls = [];

// inside this function React.createElement is used
// outside CARMI model
function getCompsLib({ createElement }) {
  return {
    'div': (props) => {
      renderCounter++;
      return <div {...props}></div>
    },
    'span': (props) => {
      renderCounter++;
      return <span {...props}></span>
    },
    'input': class InputComponent extends React.Component {
      render() {
        renderCounter++;
        return <input {...this.props}></input>
      }
      isMyComp() {
        return `yes:${this.props.value}`
      }
    },
    TodoItem: class TodoItem extends React.Component {
      render() {
        renderCounter++;
        return <span {...props}></span>
      }
    },
    TodoList: class TodoItem extends React.Component {
      render() {
        renderCounter++;
        return <span {...props}></span>
      }
    }
  }
}

const compsLib = getCompsLib(React);

function expectRenders(cnt, compiler) {
  if (compiler === 'optimizing') {
    expect(renderCounter).toEqual(cnt);
  } else {
    expect(renderCounter).toBeGreaterThanOrEqual(cnt);
  }
  renderCounter = 0;
}

beforeEach(() => {
  renderCounter = 0;
  markRenderCalls = [];
});

describe.each(['simple', 'optimizing'])('rendering compiler %s', compiler => {
  it('basic rendering using DOM types directly', async () => {
    const todos = root.map((item, idx) => <span key={idx}>{item}</span>);
    const todosList = <div>{todos}</div>;
    const model = {
      todosList,
      setItem: setter(arg0)
    };
    const optCode = eval(await compile(model, { compiler }));
    const initialState = ['first', 'second', 'third'];
    const inst = optCode(initialState, carmiReactFnLib);
    const mounted = renderer.create(React.createElement(Provider, { children: () => inst.todosList, value: inst }));
    expect(mounted.toJSON()).toMatchSnapshot();
    inst.setItem(1, 'changed the second item');
    expect(mounted.toJSON()).toMatchSnapshot();
    inst.setItem(3, 'Added a fourth item');
    expect(mounted.toJSON()).toMatchSnapshot();
  });
  it('basic rendering using functions in compNames map', async () => {
    const todos = root.map((item, idx) => <span key={idx}>{item}</span>);
    const todosList = <div>{todos}</div>;
    const model = {
      todosList,
      setItem: setter(arg0)
    };
    const optCode = eval(await compile(model, { compiler }));
    const initialState = ['first', 'second', 'third'];
    const inst = optCode(initialState, carmiReactFnLib);
    const mounted = renderer.create(
      React.createElement(Provider, {
        children: () => inst.todosList,
        value: inst,
        compsLib
      })
    );
    expectRenders(4, compiler);
    expect(mounted.toJSON()).toMatchSnapshot();
    inst.setItem(1, 'changed the second item');
    expectRenders(1, compiler);
    expect(mounted.toJSON()).toMatchSnapshot();
    inst.setItem(3, 'Added a fourth item');
    expectRenders(2, compiler);
    expect(mounted.toJSON()).toMatchSnapshot();
  });
  it('basic rendering changing root component', async () => {
    const todos = root.map((item, idx) => <span key={idx}>{item}</span>);
    const emptyList = <span>Empty</span>;
    const todosList = ternary(root.size(), <div>{todos}</div>, emptyList);
    const model = {
      todosList,
      splice: splice()
    };
    const optCode = eval(await compile(model, { compiler }));
    const initialState = ['first'];
    const inst = optCode(initialState, carmiReactFnLib);
    const mounted = renderer.create(
      React.createElement(Provider, {
        children: () => inst.todosList,
        value: inst,
        compsLib
      })
    );
    expectRenders(2, compiler);
    expect(mounted.toJSON()).toMatchSnapshot();
    inst.splice(0, 1);
    expectRenders(1, compiler);
    expect(mounted.toJSON()).toMatchSnapshot();
    inst.splice(0, 0, 'Added a new item first item');
    expectRenders(2, compiler);
    expect(mounted.toJSON()).toMatchSnapshot();
  });
  it('multiple children support', async () => {
    const todos = root.map((item, idx) => (
      <span key={idx} onClick={bind('itemClicked', idx)}>
        {item
          .get('clicked')
          .ternary('+ ', '- ')
          .plus(item.get('title'))}
      </span>
    ));
    const todosList = (
      <div>
        {todos}
        <span>
          items not clicked:
          {root.filter(item => item.get('clicked').not()).size()}
        </span>
      </div>
    );
    const model = {
      todosList,
      setItem: setter(arg0, 'clicked')
    };
    const optCode = eval(await compile(model, { compiler }));
    const initialState = [
      { title: 'first', clicked: false },
      { title: 'second', clicked: false },
      { title: 'third', clicked: false }
    ];
    const inst = optCode(initialState, {
      ...carmiReactFnLib,
      itemClicked: function (idx) {
        this.setItem(idx, true);
      }
    });
    const mounted = renderer.create(
      React.createElement(Provider, {
        children: () => inst.todosList,
        value: inst,
        compsLib
      })
    );
    expect(mounted.toJSON()).toMatchSnapshot();
    expectRenders(5, compiler);
    const items = mounted.root.findAllByType('span');
    items[0].props.onClick();
    expectRenders(2, compiler);
    expect(mounted.toJSON()).toMatchSnapshot();
  });
  it('copy props to observer', async () => {
    const elem = <div id={root.get('id')} className={root.get('className')}></div>
    const model = {
      elem,
      setId: setter('id'),
      setClassName: setter('className')
    };
    const optCode = eval(await compile(model, { compiler }));
    const initialState = {id: 'test', className:'visible'};
    const inst = optCode(initialState, {
      ...carmiReactFnLib,
      itemClicked: function (idx) {
        this.setItem(idx, true);
      }
    });
    const mounted = renderer.create(
      React.createElement(Provider, {
        children: () => inst.elem,
        value: inst,
        compsLib
      })
    );
    expect(mounted.toJSON()).toMatchSnapshot();
    expectRenders(1, compiler);
    expect(inst.elem.props.id).toEqual('test');
    inst.setId('changed');
    expectRenders(1, compiler);
    expect(mounted.toJSON()).toMatchSnapshot();
    expect(inst.elem.props.id).toEqual('changed');
  });
  it('refs forwarding should work', async () => {
    const elem = <input ref={bind('refToInput')} value={root.get('value')}></input>
    const model = {
      elem,
      setValue: setter('value')
    };
    const optCode = eval(await compile(model, { compiler }));
    const initialState = {value: 'test'};
    let currentRef = null;
    const inst = optCode(initialState, {
      ...carmiReactFnLib,
      refToInput: function (ref) {
        currentRef = ref;
      }
    });
    const mounted = renderer.create(
      React.createElement(Provider, {
        children: () => inst.elem,
        value: inst,
        compsLib
      })
    );
    expect(mounted.toJSON()).toMatchSnapshot();
    expectRenders(1, compiler);
    expect(currentRef.isMyComp()).toEqual('yes:test');
  });
  describe('on render start/end hooks', async () => {
    it('should invoke on first render and after change', async () => {
      const elem = <div
        className={root.get('className')}
        onRenderStart={bind('markRender', true)}
        onRenderEnd={bind('markRender', false)}
      >Empty</div>;
      const model = {
        elem,
        setClassName: setter('className'),
      };
      const optCode = eval(await compile(model, {compiler}));
      const initialState = {
        className: 'initial'
      };
      const inst = optCode(initialState, {
        ...carmiReactFnLib,
        markRender: function (value) {
          markRenderCalls.push(value);
        }
      });
      const mounted = renderer.create(
        React.createElement(Provider, {
          children: () => inst.elem,
          value: inst,
          compsLib
        })
      );

      //Check first render
      expect(mounted.toJSON()).toMatchSnapshot();
      expectRenders(1, compiler);
      expect(markRenderCalls).toEqual([true, false]);

      // Trigger change
      inst.setClassName('changed');

      // Check re-render
      expectRenders(1, compiler);
      expect(mounted.toJSON()).toMatchSnapshot();
      expect(markRenderCalls).toEqual([true, false, true, false]);
    });

    it('should not pass markRender functions to component', async () => {
      const propsForComponent = {somePropKey: 'somePropValue'};
      const elem = createElement('div', {
        ...propsForComponent,
        onRenderStart: bind('markRender', true),
        onRenderEnd: bind('markRender', false)
      }, 'Empty');
      const model = {
        elem
      };
      const optCode = eval(await compile(model, {compiler}));
      const initialState = {};
      const inst = optCode(initialState, {
        ...carmiReactFnLib,
        markRender: function (value) {
          markRenderCalls.push(value);
        }
      });
      const mounted = renderer.create(
        React.createElement(Provider, {
          children: () => inst.elem,
          value: inst,
          compsLib
        })
      );

      expect(mounted.toJSON()).toMatchSnapshot();
      expect(mounted.toJSON().props).toEqual(propsForComponent);
    });
  });
});
