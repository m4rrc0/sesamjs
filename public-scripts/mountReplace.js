import { detach, insert, noop } from "/web_modules/svelte/internal.js";

// From https://github.com/sveltejs/svelte/issues/2588#issuecomment-488343541
function createSlots(slots) {
  const svelteSlots = {};

  for (const slotName in slots) {
    svelteSlots[slotName] = [createSlotFn(slots[slotName])];
  }

  function createSlotFn(element) {
    return function () {
      return {
        c: noop,

        m: function mount(target, anchor) {
          insert(target, element, anchor);
        },

        d: function destroy(detaching) {
          if (detaching) {
            detach(element);
          }
        },

        l: noop,
      };
    };
  }
  return svelteSlots;
}

// From https://github.com/sveltejs/svelte/issues/1549#issuecomment-397819063
function mountReplace(Component, options) {
  const { target, props, slots, ...rest } = options;

  const frag = document.createDocumentFragment();
  // const component = new Component({ target: frag, props, ...rest });
  const component = new Component({
    target: frag,
    props: {
      ...(slots && { $$slots: createSlots(slots), $$scope: {} }),
      ...props,
    },
    ...rest,
  });

  target.parentNode.replaceChild(frag, target);

  return component;
}

export default mountReplace;
