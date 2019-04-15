function str(strings, ...vars) {
  var res = strings[0];
  for ( let i=1; i<strings.length; i++ )
    res = res + vars[i-1] + strings[i];
  return res;
}
function html(strings, ...vars) {
  var template = document.createElement("template");
  template.innerHTML = str(strings, ...vars);
  return template.content;
}
function css(strings, ...vars) {
  var style = document.createElement("style");
  style.innerHTML = str(strings, ...vars);
  return style;
}
function js(strings, ...vars) {
  var js = document.createElement("script");
  js.innerHTML = str(strings, ...vars);
  return js;
}

const tslist = html`
<style>
:host {
  all: initial;

  position: relative;
  display: inline-block;

  --bkcolor: #4CAF50;
  --emcolor: #64C768;
  --bdcolor: #3C9F30;
  --fmcolor: #2C8F50;
}
:host(:focus), :host(:focus-within) {
  z-index: 2;
}
::slotted(ts-option[slot='placeholder']) {
  display: block;
  box-sizing: border-box;
  border: 1px solid white;
  background-color: white;
  opacity: 0;
}
::slotted(ts-elem) {
  position: absolute;
  box-sizing: border-box;

  width: 100%;
  height: 100%;
  border-left-width: 1px;
  border-left-style: solid;
  border-right-width: 1px;
  border-right-style: solid;
  z-index: 1;

  top: 0;
  left: calc(100% * var(--pos-x, 0));
  transition: left 0.2s;
}
</style>

<div class="placeholder">
  <slot name="placeholder"></slot>
</div>
<div class="list-content">
  <slot></slot>
</div>
`;
const tselem = html`
<style>
:host {
  display: block;
  border-left-color: var(--bdcolor);
  border-right-color: var(--bdcolor);
  background-color: var(--bkcolor);
}

.dropdown-content {
  display: none;
  position: absolute;
  width: 100%;
  z-index: 1;

  top: calc(-100% * var(--pos-y, 0));
  left: 0;
  transition: top 0.3s;
}
:host(:focus) .dropdown-content {
  display: block;
}
:host(.dragging) .dropdown-content {
  display: none;
}
::slotted(ts-option) {
  display: block;
  width: 100%;
  border-top: 1px solid var(--bkcolor);
  border-bottom: 1px solid var(--bkcolor);
  background-color: var(--bkcolor);
}
.dropdown-content ::slotted(ts-option) {
  border-top: 1px solid var(--bdcolor);
  border-bottom: 1px solid var(--bdcolor);
}
::slotted(ts-option:hover) {
  background-color: var(--emcolor);
}
.frame {
  position: absolute;
  top: 0;
  width: 100%;
  height: 100%;
  z-index: 1;
  pointer-events: none;
}
:host(:focus)>.frame,
:host(.highlighted)>.frame {
  box-sizing: border-box;
  outline: 2px solid var(--fmcolor);
  border: 2px solid var(--fmcolor);
}
</style>

<div class="selected">
  <slot name="selected"></slot>
</div>
<div class="dropdown-content">
  <slot></slot>
</div>
<div class="frame"></div>
`;

customElements.define("ts-option", class extends HTMLElement {});

customElements.define("ts-list", class extends HTMLElement {
  constructor() {
    super();
    var shadowRoot = this.attachShadow({mode: "open"});
    shadowRoot.appendChild(tslist.cloneNode(true));
  }

  connectedCallback() {
    if ( this.hasOwnProperty("disabled") ) {
      let value = this.disabled;
      delete this.disabled;
      this.disabled = value;
    }
  }

  set disabled(value) {
    const isDisabled = Boolean(value);
    if ( isDisabled )
      this.setAttribute("disabled", "");
    else
      this.removeAttribute("disabled");
  }
  get disabled() {
    return this.hasAttribute("disabled");
  }

  get placeholder() {
    return this.querySelector("ts-option[slot='placeholder']");
  }
  get elems() {
    var elems = Array.from(this.querySelectorAll("ts-elem"));
    elems.sort((a, b) => a.x-b.x);
    return elems;
  }

  setPlaceholder(content) {
    var TsOption = customElements.get("ts-option");
    var placeholder = new TsOption();
    placeholder.appendChild(content);
    placeholder.setAttribute("slot", "placeholder");
    if ( this.placeholder )
      this.removeChild(this.placeholder);
    this.appendChild(placeholder);
  }
  addElem(...contents) {
    var TsOption = customElements.get("ts-option");
    var TsElem = customElements.get("ts-elem");
    var elem = new TsElem();
    for ( let content of contents ) {
      let option = new TsOption();
      option.appendChild(content);
      elem.appendChild(option);
    }
    this.appendChild(elem);
    return elem;
  }
});

customElements.define("ts-elem", class extends HTMLElement {
  constructor() {
    super();
    var shadowRoot = this.attachShadow({mode: "open"});
    shadowRoot.appendChild(tselem.cloneNode(true));
  }
  connectedCallback() {
    // init attr
    if (!this.hasAttribute("draggable"))
      this.setAttribute("draggable", true);
    if (!this.hasAttribute("tabindex"))
      this.setAttribute("tabindex", 0);

    // init properties
    this.x = this.x;
    this.y = this.y;

    // init selected
    if ( !this.selected ) {
      let selected = this.options[this.y].cloneNode(true);
      selected.setAttribute("slot", "selected");
      this.appendChild(selected);
    }

    // init handler
    this.addEventListener("wheel", this._wheel_handler);
    this.addEventListener("click", this._click_handler);
    this.addEventListener("dragstart", this._dragstart_handler);
    this.addEventListener("dragend", this._dragend_handler);
    this.addEventListener("dragenter", this._dragenter_handler);
    this.addEventListener("dragover", this._dragover_handler);
    this.addEventListener("transitionend", this._transitionend_handler);
  }
  disconnectedCallback() {
    this.removeEventListener("wheel", this._wheel_handler);
    this.removeEventListener("click", this._click_handler);
    this.removeEventListener("dragstart", this._dragstart_handler);
    this.removeEventListener("dragend", this._dragend_handler);
    this.removeEventListener("dragenter", this._dragenter_handler);
    this.removeEventListener("dragover", this._dragover_handler);
    this.removeEventListener("transitionend", this._transitionend_handler);
  }

  get selected() {
    return this.querySelector("ts-option[slot='selected']");
  }
  get options() {
    return Array.from(this.querySelectorAll("ts-option:not([slot='selected'])"));
  }

  get x() {
    var x = parseInt(this.style.getPropertyValue("--pos-x"));
    if ( !Number.isNaN(x) )
      return x;
    else
      return Array.from(this.parentNode.querySelectorAll("ts-elem")).indexOf(this);
  }
  set x(x) {
    x = Number(x);
    if ( Number.isNaN(x) )
      throw new TypeError();

    if ( Number.isNaN(parseInt(this.style.getPropertyValue("--pos-x"))) )
      this.style.setProperty("--pos-x", x);
    else
      this.moveX(x);
  }
  get y() {
    var y = parseInt(this.style.getPropertyValue("--pos-y"));
    if ( !Number.isNaN(y) )
      return y;
    else
      return 0;
  }
  set y(y) {
    y = Number(y);
    if ( Number.isNaN(y) )
      throw new TypeError();

    if ( Number.isNaN(parseInt(this.style.getPropertyValue("--pos-y"))) )
      this.style.setProperty("--pos-y", y);
    else
      this.moveY(y);
  }

  moveX(x, pushback=true) {
    var moving = [];

    var x0 = this.x;
    if ( x == x0 )
      return;

    if ( pushback ) {
      var dir = Math.sign(x0-x);

      for ( let sibling of this.parentNode.querySelectorAll("ts-elem") ) {
        let x_ = sibling.x;
        if ( (x0-x_)*(x-dir-x_) >= 0 )
          continue;
        sibling.style.setProperty("--pos-x", x_+dir);
        moving.push(sibling);
      }
    }

    this.style.setProperty("--pos-x", x);
    moving.push(this);

    for ( let elem of moving )
      elem.classList.add("moving");
  }
  moveY(y) {
    var next = this.options[y];
    if ( !next )
      return;
    next = next.cloneNode(true);
    next.setAttribute("slot", "selected");

    var prev = this.selected;
    if ( prev )
      this.removeChild(prev);

    this.appendChild(next);
    this.style.setProperty("--pos-y", y);
  }

  highlight() {
    this.classList.add("highlighted");
  }
  unhighlight() {
    this.classList.remove("highlighted");
  }

  _transitionend_handler(event) {
    this.classList.remove("moving");
  }

  _wheel_handler(event) {
    if ( this.parentNode.disabled )
      return;
    if ( event.deltaY == 0 )
      return;
    this.moveY(this.y+Math.sign(event.deltaY));
    event.preventDefault();
  }
  _click_handler(event) {
    if ( this.parentNode.disabled )
      return;
    var target = event.target;
    if ( target.nodeType == Node.TEXT_NODE )
      target = event.parentNode;
    target = target.closest("ts-option");
    if ( !target )
      return;

    this.moveY(this.options.indexOf(target));
  }

  _dragstart_handler(event) {
    if ( this.parentNode.disabled )
      return;
    event.dataTransfer.setData("Text", "");
    event.dataTransfer.dropEffect = "move";
    this.classList.add("dragging");
  }
  _dragend_handler(event) {
    this.classList.remove("dragging");
  }
  _dragenter_handler(event) {
    var target = this.parentNode.querySelector("ts-elem.dragging");
    if ( !target )
      return;
    if ( this === target )
      return;
    if ( this.parentNode !== target.parentNode )
      return;
    if ( this.classList.contains("moving") )
      return;

    target.moveX(this.x);
  }
  _dragover_handler(event) {
    var target = this.parentNode.querySelector("ts-elem.dragging");
    if ( !target )
      return;
    if ( this.parentNode !== target.parentNode )
      return;
    event.preventDefault();
    event.dataTransfer.effectAllowed = "move";
  }
});
