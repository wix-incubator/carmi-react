// @ts-nocheck
const {
  compile, root, arg0, setter, splice, ternary, bind,
} = require('carmi');
const { createElement } = require('carmi/jsx');
const renderer = require('react-test-renderer');
const React = require('react');
const { Provider, getFunctionsLibrary, carmiReactFnLib } = require('../src/index');

let renderCounter = 0;

// inside this function React.createElement is used
// outside CARMI model
function getCompsLib({ createElement }) { // eslint-disable-line no-unused-vars, no-shadow
  return {
    div: (props) => {
      renderCounter++;
      return <div {...props} />;
    },
    span: (props) => {
      renderCounter++;
      return <span {...props} />;
    },
    input: class InputComponent extends React.Component {
      isMyComp() {
        return `yes:${this.props.value}`;
      }

      render() {
        renderCounter++;
        return <input {...this.props} />;
      }
    },
    RenderCounterComponent: class ShouldComponentUpdateComponent extends React.Component {
      render() {
        this.renderCounter = this.renderCounter ? this.renderCounter + 1 : 1;
        renderCounter++;
        if (this.props.children.length) {
          return <div data-render-counter={this.renderCounter}>{this.props.children}</div>;
        }
        return <span data-render-counter={this.renderCounter}>{this.props.data.label}</span>;
      }
    },
    clone: (props) => <div>{React.cloneElement(props.children, { style: props.childOverrides.style })}</div>,
  };
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
});

describe.each(['simple', 'optimizing'])('rendering compiler %s', (compiler) => {
  it('basic rendering using DOM types directly', async () => {
    const todos = root.map((item) => <span key={item}>{item}</span>);
    const todosList = <div>{todos}</div>;
    const model = {
      todosList,
      setItem: setter(arg0),
    };
    const optCode = eval(await compile(model, { compiler }));
    const initialState = ['first', 'second', 'third'];
    const inst = optCode(initialState, carmiReactFnLib);
    const mounted = renderer.create(React.createElement(Provider, { value: inst }, () => inst.todosList));
    expect(mounted.toJSON()).toMatchSnapshot();
    inst.setItem(1, 'changed the second item');
    expect(mounted.toJSON()).toMatchSnapshot();
    inst.setItem(3, 'Added a fourth item');
    expect(mounted.toJSON()).toMatchSnapshot();
  });
  it('basic rendering should not unmount component on creating new descriptor instance', async () => {
    const data = root.get('data');
    const comps = root.get('structure').recursiveMapValues((loop, structure, id) => {
      const children = structure.get('components').map((childId, idx, _loop) => childId.recur(_loop), loop);
      return createElement('RenderCounterComponent', { key: id, data: data.get(id) }, children);
    });
    const allComps = <div>{comps.get('parent')}</div>;

    const model = {
      allComps,
      setComponentLabel: setter('data', arg0, 'label'),
      setStructure: setter('structure', arg0),
    };
    const buildOutput = eval(await compile(model, { compiler }));

    const initialState = {
      data: {
        comp2: { label: 'initialLabel' },
      },
      structure: {
        parent: {
          id: 'parent',
          components: ['comp2'],
        },
        comp2: {
          id: 'comp2',
          components: [],
        },
      },
    };
    const instance = buildOutput(initialState, carmiReactFnLib);
    const mounted = renderer.create(
      React.createElement(Provider, {
        value: instance,
        compsLib,
      }, () => instance.allComps),
    );

    const comp = mounted.root.findByType('span');
    expect(comp.children).toEqual(['initialLabel']);

    instance.$runInBatch(() => {
      instance.setStructure('comp2');
      instance.setStructure('comp2', {
        id: 'comp2',
        components: [],
      });
      instance.setComponentLabel('comp2', 'dynamic');
    });

    expect(comp.children).toEqual(['dynamic']);
  });
  it('basic rendering using functions in compNames map', async () => {
    const todos = root.map((item, idx) => <span key={idx}>{item}</span>);
    const todosList = <div>{todos}</div>;
    const model = {
      todosList,
      setItem: setter(arg0),
    };
    const optCode = eval(await compile(model, { compiler }));
    const initialState = ['first', 'second', 'third'];
    const inst = optCode(initialState, carmiReactFnLib);
    const mounted = renderer.create(
      React.createElement(Provider, {
        value: inst,
        compsLib,
      }, () => inst.todosList),
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
      splice: splice(),
    };
    const optCode = eval(await compile(model, { compiler }));
    const initialState = ['first'];
    const inst = optCode(initialState, carmiReactFnLib);
    const mounted = renderer.create(
      React.createElement(Provider, {
        value: inst,
        compsLib,
      }, () => inst.todosList),
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
          {root.filter((item) => item.get('clicked').not()).size()}
        </span>
      </div>
    );
    const model = {
      todosList,
      setItem: setter(arg0, 'clicked'),
    };
    const optCode = eval(await compile(model, { compiler }));
    const initialState = [
      { title: 'first', clicked: false },
      { title: 'second', clicked: false },
      { title: 'third', clicked: false },
    ];
    const inst = optCode(initialState, {
      ...carmiReactFnLib,
      itemClicked(idx) {
        this.setItem(idx, true);
      },
    });
    const mounted = renderer.create(
      React.createElement(Provider, {
        value: inst,
        compsLib,
      }, () => inst.todosList),
    );
    expect(mounted.toJSON()).toMatchSnapshot();
    expectRenders(5, compiler);
    const items = mounted.root.findAllByType('span');
    items[0].props.onClick();
    expectRenders(2, compiler);
    expect(mounted.toJSON()).toMatchSnapshot();
  });
  it('copy props to observer', async () => {
    const elem = <div id={root.get('id')} className={root.get('className')} />;
    const model = {
      elem,
      setId: setter('id'),
      setClassName: setter('className'),
    };
    const optCode = eval(await compile(model, { compiler }));
    const initialState = { id: 'test', className: 'visible' };
    const inst = optCode(initialState, {
      ...carmiReactFnLib,
      itemClicked(idx) {
        this.setItem(idx, true);
      },
    });
    const mounted = renderer.create(
      React.createElement(Provider, {
        value: inst,
        compsLib,
      }, () => inst.elem),
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
    const elem = <input ref={bind('refToInput')} value={root.get('value')} />;
    const model = {
      elem,
      setValue: setter('value'),
    };
    const optCode = eval(await compile(model, { compiler }));
    const initialState = { value: 'test' };
    let currentRef = null;
    const inst = optCode(initialState, {
      ...carmiReactFnLib,
      refToInput(ref) {
        currentRef = ref;
      },
    });
    const mounted = renderer.create(
      React.createElement(Provider, {
        value: inst,
        compsLib,
      }, () => inst.elem),
    );
    expect(mounted.toJSON()).toMatchSnapshot();
    expectRenders(1, compiler);
    expect(currentRef.isMyComp()).toEqual('yes:test');
  });
  it('clone', async () => {
    const elem = (
      <clone childOverrides={{ style: { background: root.get('background') } }}>
        <span>{root.get('title')}</span>
      </clone>
    );
    const model = {
      elem,
      setBackground: setter('background'),
      setTitle: setter('title'),
    };
    const optCode = eval(await compile(model, { compiler }));
    const initialState = { title: 'hello', background: 'red' };
    const inst = optCode(initialState, {
      ...carmiReactFnLib,
    });
    const mounted = renderer.create(
      React.createElement(Provider, {
        value: inst,
        compsLib,
      }, () => inst.elem),
    );
    expect(mounted.toJSON()).toMatchSnapshot();
    expectRenders(1, compiler);
    inst.setBackground('blue');
    expect(mounted.toJSON()).toMatchSnapshot();
    expectRenders(1, compiler);
  });
  it('plugins', async () => {
    const todos = root.get('items').map((item, idx) => <span key={idx}>{item}</span>);
    const todosList = <div key="root">{todos}</div>;
    const model = {
      todosList,
      setItem: setter(arg0),
    };
    const wrapElement = (element) => React.createElement('span', { key: element.key, data: 'auto-generated' }, [element]);
    const optCode = eval(await compile(model, { compiler }));
    const initialState = { items: ['first', 'second'] };
    const inst = optCode(initialState, getFunctionsLibrary([wrapElement]));
    const mounted = renderer.create(
      React.createElement(Provider, { compsLib, value: inst }, () => inst.todosList),
    );
    expect(mounted.toJSON()).toMatchSnapshot();
  });
});
