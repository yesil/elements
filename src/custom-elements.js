
const originalDefine = customElements.define;
export const definedCustomElements = [];

customElements.define = function(name, constructor, options) {
  originalDefine.call(this, name, constructor, options);
  definedCustomElements.push(name);
};

Object.defineProperty(customElements, 'all', {
  get() {
    return definedCustomElements;
  }
});

