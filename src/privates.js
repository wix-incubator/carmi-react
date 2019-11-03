const privatesByPointer = new WeakMap();
const pointerByInstance = new WeakMap();

export function getPrivatesByPointer(pointer) {
    if (!privatesByPointer.has(pointer)) {
        const privates = {
            descriptorToCompsMap: new WeakMap(),
            descriptorToElementsMap: new WeakMap(),
            pendingFlush: new Set(),
            compsLib: {},
            root: null,
            flush: () => {
                if (privates.root.lastChildren !== privates.root.props.children()) {
                    privates.root.setState({});
                }
                privates.pendingFlush.forEach(comp => {
                    comp.setState({});
                });
                privates.pendingFlush.clear();
            }
        };
        privatesByPointer.set(pointer, privates);
    }
    return privatesByPointer.get(pointer);
}

function createPointerToInstanceIfNeeded(instance) {
    if (!pointerByInstance.has(instance)) {
        pointerByInstance.set(instance, {});
    }
}

export function getPrivatesByInstance(instance) {
    createPointerToInstanceIfNeeded(instance);
    return getPrivatesByPointer(pointerByInstance.get(instance));
}

export function getPointerToInstance(instance) {
    createPointerToInstanceIfNeeded(instance);
    return pointerByInstance.get(instance);
}
