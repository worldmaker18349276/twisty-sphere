"use strict";

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
function animate(routine) {
  var wrapped = () => (requestAnimationFrame(wrapped), routine.next());
  requestAnimationFrame(wrapped);
}


class Display
{
  constructor(container) {
    // renderer
    this.renderer = new THREE.WebGLRenderer({antialias:true});
    this.width = container.clientWidth;
    this.height = container.clientHeight;
    this.renderer.setSize(this.width, this.height);
    this.dom = this.renderer.domElement;
    container.appendChild(this.dom);

    this.scene = new THREE.Scene();
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.3));
    // this.scene.add(new THREE.AxesHelper(20));
    this.scene.add(this.buildBackground());

    // navigation control
    this.rotateSpeed = Math.PI/500;
    this.zoomSpeed = 1/100;
    this.distanceRange = [2, 8];
    this.trackball_lock = new Set();

    this.trackball = new THREE.Group();
    this.camera = new THREE.PerspectiveCamera(40, this.width/this.height, 1, 1000);
    this.camera.add(new THREE.PointLight(0xffffff, 0.7));
    this.trackball.add(this.camera);
    this.scene.add(this.trackball);
    this.setCamera(1,2,3);

    document.addEventListener("contextmenu", event => {
      if ( event.target === this.dom )
        event.preventDefault();
    });
    this.dom.addEventListener("mousemove", event => {
      if ( this.trackball_lock.size ) return;

      var x = event.movementX, y = -event.movementY;

      switch ( event.buttons ) {
        case 1: // rotate
          let axis = new THREE.Vector3(-y,x,0).normalize();
          let angle = Math.sqrt(x*x+y*y)*this.rotateSpeed;
          this.trackball.rotateOnAxis(axis, -angle);
          event.preventDefault();
          break;

        case 2: // spin
          let theta = x*this.rotateSpeed;
          this.trackball.rotateZ(theta);
          event.preventDefault();
          break;

        case 4: // zoom
          let z = this.camera.position.z - y*this.zoomSpeed;
          if ( this.distanceRange[0] < z && z < this.distanceRange[1] )
            this.camera.position.z = z;
          event.preventDefault();
          break;
      }
    }, false);

    this.dom.addEventListener("wheel", event => {
      let y = -10*Math.sign(event.deltaY);
      let z = this.camera.position.z - y*this.zoomSpeed;
      if ( this.distanceRange[0] < z && z < this.distanceRange[1] )
        this.camera.position.z = z;
      event.preventDefault();
    });

    // animation
    {
      this.animations = [];
      let animation_loop = (t) => {
        requestAnimationFrame(animation_loop);
        for ( let i=0; i<this.animations.length; i++ ) {
          let [coroutine, resolve, reject] = this.animations[i];
          try {
            let result = coroutine.next(t);
            if ( result.done ) {
              resolve();
              this.animations.splice(i, 1);
              i--;
            }
          } catch ( e ) {
            reject(e);
          }
        }
        this.renderer.render(this.scene, this.camera);
      };
      requestAnimationFrame(animation_loop);
    }


    // event system on Object3D
    this.raycaster = new THREE.Raycaster();
    this.raycaster.linePrecision = 0;
    function event3D(name, event, point) {
      return Object.assign({}, point, {type:name, originalEvent:event});
    }
    this.hoverable = [];

    // hover event
    {
      let hover_spot = {};

      this.dom.addEventListener("mousemove", event => {
        var prev_target3D = hover_spot.object;
        hover_spot = this.spotOn(event.offsetX, event.offsetY);
        var target3D = hover_spot.object;

        if ( prev_target3D !== target3D ) {
          if ( prev_target3D )
            prev_target3D.dispatchEvent(event3D("mouseleave", event, hover_spot));
          if ( target3D )
            target3D.dispatchEvent(event3D("mouseenter", event, hover_spot));
        }
        if ( target3D )
          target3D.dispatchEvent(event3D("mouseover", event, hover_spot));
      }, false);
    }
    // {
    //   this.hoverable = [];
    //
    //   let offsetX = 0;
    //   let offsetY = 0;
    //   this.dom.addEventListener("mousemove", event => {
    //     offsetX = event.offsetX;
    //     offsetY = event.offsetY;
    //   }, false);
    //
    //   let hover_routine = (function *hoverRoutine() {
    //     var prev_obj;
    //     while ( true ) {
    //       var spot = this.spotOn(offsetX, offsetY);
    //       this.scene.dispatchEvent(event3D("hover", undefined, spot));
    //
    //       var object = spot.object;
    //       if ( prev_obj !== object ) {
    //         if ( prev_obj )
    //           prev_obj.dispatchEvent(event3D("mouseleave", undefined, spot));
    //         if ( object )
    //           prev_obj.dispatchEvent(event3D("mouseenter", undefined, spot));
    //       }
    //       if ( object )
    //         prev_obj.dispatchEvent(event3D("mouseover", undefined, spot));
    //       prev_obj = object;
    //
    //       yield;
    //     }
    //   }).call(this);
    //   this.animate(hover_routine);
    //
    // }

    // click event
    {
      let click_spot = undefined;

      this.dom.addEventListener("mousedown", event => {
        click_spot = this.spotOn(event.offsetX, event.offsetY);
      }, false);
      this.dom.addEventListener("mousemove", event => {
        if ( click_spot ) {
          if ( Math.abs(event.movementX) > 1 || Math.abs(event.movementY) > 1 )
            click_spot = undefined;
        }
      }, false);
      this.dom.addEventListener("mouseup", event => {
        if ( click_spot ) {
          if ( click_spot.object )
            click_spot.object.dispatchEvent(event3D("click", event, click_spot));
          else
            this.scene.dispatchEvent({type:"click", originalEvent:event});
          click_spot = undefined;
        }
      }, false);
    }

    // drag event
    {
      let dragging = false, drag_spot = {};
      const DRAG_KEY = Symbol("drag");

      this.dom.addEventListener("mousedown", event => {
        if ( event.buttons === 1 && !dragging ) {
          drag_spot = this.spotOn(event.offsetX, event.offsetY);
          if ( drag_spot.object && !drag_spot.object.userData.draggable )
            drag_spot = {};
          if ( drag_spot.object )
            this.lockTrackball(DRAG_KEY);
        }
      }, false);
      this.dom.addEventListener("mousemove", event => {
        if ( event.buttons === 1 ) {
          var target3D = drag_spot.object;

          if ( !dragging && target3D ) {
            let drag_event = event3D("dragstart", event, drag_spot, {drag:false});
            target3D.dispatchEvent(drag_event);
            dragging = drag_event.drag;
          }

          if ( dragging )
            target3D.dispatchEvent(event3D("drag", event, {}));
          else
            this.unlockTrackball(DRAG_KEY);
        }
      }, false);
      this.dom.addEventListener("mouseup", event => {
        if ( dragging ) {
          drag_spot.object.dispatchEvent(event3D("dragend", event, {}));
          this.unlockTrackball(DRAG_KEY);
          drag_spot = {};
          dragging = false;
        }
      }, false);
    }
  }
  add(target, parent=this.scene) {
    parent.add(target);
    this.hoverable = [];
    this.scene.traverse(e => { if ( e.userData.hoverable ) this.hoverable.push(e); });
  }
  remove(target, parent=this.scene) {
    parent.remove(target);
    this.hoverable = [];
    this.scene.traverse(e => { if ( e.userData.hoverable ) this.hoverable.push(e); });
  }

  buildBackground() {
    var background_geometry = new THREE.IcosahedronGeometry(10, 0);
    var background_uv = [new THREE.Vector2(0,0), new THREE.Vector2(0,1), new THREE.Vector2(Math.sqrt(3)/2,0)];
    for ( let i in background_geometry.faceVertexUvs[0] )
      background_geometry.faceVertexUvs[0][i] = background_uv.slice(0);
    var background_material = new THREE.MeshBasicMaterial({color:0xffffff});
    background_material.side = THREE.DoubleSide;
    // broken noise, made by http://bg.siteorigin.com/
    var background_texture = new THREE.TextureLoader().load("/background.png");
    background_texture.wrapS = THREE.RepeatWrapping;
    background_texture.wrapT = THREE.RepeatWrapping;
    background_texture.repeat = new THREE.Vector2(2.5, 2.5);
    background_material.map = background_texture;
    return new THREE.Mesh(background_geometry, background_material);
  }

  spotOn(offsetX, offsetY) {
    var mouse = new THREE.Vector2(
        offsetX/this.width*2 - 1,
        - offsetY/this.height*2 + 1);
    this.raycaster.setFromCamera(mouse, this.camera);

    var [spot={}] = this.raycaster.intersectObjects(this.hoverable, true);
    while ( spot.object && !spot.object.userData.hoverable )
      spot.object = spot.object.parent;

    return spot;
  }
  pointTo(offsetX, offsetY, plane) {
    var mouse = new THREE.Vector2(
        offsetX/this.width*2 - 1,
        - offsetY/this.height*2 + 1);
    this.raycaster.setFromCamera(mouse, this.camera);

    var point = this.raycaster.ray.intersectPlane(plane, new THREE.Vector3());
    var distance = this.raycaster.ray.distanceToPlane(plane);
    return {distance, point};
  }

  setCamera(x, y, z, dis) {
  	var vec = new THREE.Vector3(x, y, z);
    if ( !dis )
      dis = vec.length();
    dis = Math.max(dis, this.distanceRange[0]);
    dis = Math.min(dis, this.distanceRange[1]);

    this.camera.position.z = dis;
    this.trackball.lookAt(vec.normalize());
  }
  lockTrackball(key) {
    this.trackball_lock.add(key);
  }
  unlockTrackball(key) {
    this.trackball_lock.delete(key);
  }

  animate(coroutine) {
    return new Promise((resolve, reject) => {
      this.animations.push([coroutine, resolve, reject]);
    });
  }

  *animatedRotateRoutine(targets, axis, angle, speed) {
    var start_quaternions = targets.map(target => target.quaternion.clone());
    var curr_angle = 0;
    var t0, t;

    t0 = yield;
    while ( curr_angle < angle ) {
      let t = yield;
      curr_angle = Math.min(curr_angle + speed*(t-t0)/1000, angle);
      t0 = t;

      let rot = new THREE.Quaternion().setFromAxisAngle(axis, curr_angle);
      for ( let i in targets )
        targets[i].quaternion.multiplyQuaternions(rot, start_quaternions[i]);
    }
  }
}

class Panel
{
  constructor(gui) {
    if ( !gui ) {
      gui = new dat.GUI();
      document.body.appendChild(css`
        div.dg.ac input[type="text"], div.dg.ac select {
          font-size: small;
        }
        div.dg.ac select {
          -moz-appearance: button;
          -webkit-appearance: button;
          width: 100%;
          color: rgb(238, 238, 238);
          background-color: #393838;
          border-radius: 0px;
          border-width: 1px;
          border-color: #575656;
          border-style: solid;
        }
        .property-name {
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .function .property-name {
          width: 100%;
        }`);
    }
    this.gui = gui;
    this.proxy = {};
    this.ctrls = {};

    this.numbers = (function *numbers() {
      var i = 0; while ( true ) if ( yield i++ ) i=-1;
    })();

  }
  open() {
    this.gui.open();
  }
  close() {
    this.gui.close();
  }

  addButton(name, callback, mouseenter, mouseleave) {
    var id = this.numbers.next().value;
    this.proxy[id] = callback;
    this.ctrls[id] = this.gui.add(this.proxy, id).name(name);

    var dom = this.ctrls[id].domElement.parentNode.parentNode;
    if ( mouseenter )
      dom.addEventListener("mouseenter", mouseenter);
    if ( mouseleave )
      dom.addEventListener("mouseleave", mouseleave);

    return id;
  }
  addNumber(name, get, set, min, max, step=0.01) {
    var id = this.numbers.next().value;
    this.proxy[id] = get();
    this.ctrls[id] = this.gui.add(this.proxy, id, min, max, step).name(name);

    if ( set )
      this.ctrls[id].onChange(set);
    this.ctrls[id].onFinishChange(() => {
      this.proxy[id] = get();
      this.ctrls[id].updateDisplay();
    });

    return id;
  }
  addText(name, get, set) {
    var id = this.numbers.next().value;
    this.proxy[id] = get();
    this.ctrls[id] = this.gui.add(this.proxy, id).name(name);

    if ( set )
      this.ctrls[id].onChange(set);
    this.ctrls[id].onFinishChange(() => {
      this.proxy[id] = get();
      this.ctrls[id].updateDisplay();
    });

    return id;
  }
  addColor(name, get, set) {
    var id = this.numbers.next().value;
    this.proxy[id] = get();
    this.ctrls[id] = this.gui.addColor(this.proxy, id).name(name);

    if ( set )
      this.ctrls[id].onChange(set);
    this.ctrls[id].onFinishChange(() => {
      this.proxy[id] = get();
      this.ctrls[id].updateDisplay();
    });

    return id;
  }
  addFolder(name, open) {
    var id = this.numbers.next().value;
    var ctrl = new Panel(this.gui.addFolder(name));
    if ( open ) ctrl.open();
    this.ctrls[id] = ctrl;

    return id;
  }

  remove(id) {
    if ( this.ctrls[id] instanceof Panel )
      this.gui.removeFolder(this.ctrls[id].gui);
    else
      this.gui.remove(this.ctrls[id]);

    delete this.proxy[id];
    delete this.ctrls[id];

    if ( Object.keys(this.ctrls).length == 0 )
      this.numbers.next(true);
  }
  clear() {
    var ids = Object.keys(this.ctrls);
    for ( let id of ids )
      this.remove(id);
  }
  add(...properties) {
    var ids = [];
    for ( let property of properties ) {
      if ( property.type == "folder" ) {
        let {name, properties, open} = property;
        let id = this.addFolder(name, open);
        this.ctrls[id].add(...properties);
        ids.push(id);

      } else if ( property.type == "button" ) {
        let {name, callback, mouseenter, mouseleave} = property;
        let id = this.addButton(name, callback, mouseenter, mouseleave);
        ids.push(id);

      } else if ( property.type == "number" ) {
        let {name, get, set, min, max, step} = property;
        let id = this.addNumber(name, get, set, min, max, step);
        ids.push(id);

      } else if ( property.type == "text" ) {
        let {name, get, set} = property;
        let id = this.addText(name, get, set);
        ids.push(id);

      } else if ( property.type == "color" ) {
        let {name, get, set} = property;
        let id = this.addColor(name, get, set);
        ids.push(id);
      }
    }
    return ids;
  }
}

class Graph
{
  constructor(container) {
    this.dom = container;

    this.nodes = new vis.DataSet();
    this.edges = new vis.DataSet();
    this.view = new vis.Network(
      this.dom,
      {nodes:this.nodes, edges:this.edges},
      {
        physics: true,
        nodes: {chosen:false}, edges: {chosen:false},
        interaction: {selectable:false, selectConnectedEdges:false,
                      hover:true, hoverConnectedEdges:false}
      }
    );

    var make_target = event => {
      var id = this.view.getNodeAt(event.pointer.DOM);
      event.target = id && this.nodes.get(id);
    };
    this.view.on("click", make_target);
    this.view.on("hoverNode", make_target);
    this.view.on("blurNode", make_target);
  }

  disable() {
    this.view.setOptions({
      physics: {enabled:false},
      interaction: {dragNodes:false, dragView:false, zoomView:false}
    });
  }
  enable() {
    this.view.setOptions({
      physics: {enabled:true},
      interaction: {dragNodes:true, dragView:true, zoomView:true}
    });
  }

  addNode(options={}) {
    return this.nodes.add(options)[0];
  }
  addEdge(from, to, options={}) {
    if ( !this.getNode(from) || !this.getNode(to) )
      throw new Error();
    return this.edges.add(Object.assign(options, {from, to}))[0];
  }
  getNode(id) {
    if ( !id )
      return;
    return this.nodes.get(id);
  }
  getEdge(id) {
    if ( !id )
      return;
    return this.edges.get(id);
  }
  updateNode(id, patch={}) {
    var options = this.getNode(id);
    if ( !options )
      return;
    this.nodes.update(Object.assign(options, patch, {id}));
  }
  updateEdge(id, patch={}) {
    var options = this.getEdge(id);
    if ( !options )
      return;
    this.edges.update(Object.assign(options, patch, {id}));
  }
  removeNode(id) {
    if ( !id )
      return;
    this.nodes.remove(id);
  }
  removeEdge(id) {
    if ( !id )
      return;
    this.edges.remove(id);
  }

  *edgesBetween(from, to) {
    for ( let options of this.edges.get() )
      if ( !from || options.from == from )
        if ( !to || options.to == to )
          yield options;
  }
}

class Tabs
{
  constructor(id) {
    document.body.appendChild(css`
      .tab-title-container {
        white-space: nowrap;
        border: 1px solid #ccc;
        background-color: #f1f1f1;
        overflow-x: hidden;
        height: 50px;
        box-sizing: border-box;
      }
      .tab-title-container .tab-title {
        display: inline-block;
        background-color: inherit;
        height: 100%;
        padding: calc(25px - 0.5em) 16px;
        cursor: pointer;
        box-sizing: border-box;
      }
      .tab-title-container .tab-title:hover {
        background-color: #ddd;
      }
      .tab-title-container .tab-title.active {
        background-color: #ccc;
      }
      .tab-content-container {
        height: calc(100% - 50px);
        box-sizing: border-box;
        border: 1px solid #ccc;
      }

      .tab-content {
        display: none;
      }
      .tab-content.active {
        display: block;
      }
    `);
    this.container = document.getElementById(id);
    this.container.classList.add("tab-container");

    this.titles = document.createElement("div");
    this.titles.classList.add("tab-title-container");
    this.container.appendChild(this.titles);

    this.contents = document.createElement("div");
    this.contents.classList.add("tab-content-container");
    this.container.appendChild(this.contents);

    this.titles.addEventListener("click", event => {
      if ( event.target.classList.contains("tab-title") )
        this.active(event.target.tabcontent);
    });
    this.titles.addEventListener("wheel", event => {
      event.preventDefault();
      event.currentTarget.scrollLeft += event.deltaY * 10;
    });
  }

  add(name) {
    var title = document.createElement("div");
    title.classList.add("tab-title");
    title.textContent = name;
    this.titles.appendChild(title);

    var content = document.createElement("div");
    content.classList.add("tab-content");
    this.contents.appendChild(content);

    title.tabcontent = content;
    content.tabtitle = title;
    this.active(content);
    return content;
  }
  remove(content) {
    this.contents.removeChild(content);
    this.titles.removeChild(content.tabtitle);
  }
  active(content) {
    for ( let content of this.contents.querySelectorAll(".tab-content.active") )
      content.classList.remove("active");
    for ( let title of this.titles.querySelectorAll(".tab-title.active") )
      title.classList.remove("active");

    content.classList.add("active");
    content.tabtitle.classList.add("active");
  }
}


class Selector extends Listenable
{
  constructor() {
    super();

    this.preselection = undefined;
    this.selections = [];
  }

  select(target=this.preselection) {
    for ( let sel of this.selections.slice().reverse() )
      this.removeSelection(sel);
    if ( target )
      this.addSelection(target);
  }
  deselect(target=this.preselection) {
    this.removeSelection(target);
  }
  toggle(target=this.preselection) {
    if ( target ) {
      if ( !this.removeSelection(target) )
        this.addSelection(target);
    }
  }
  focus(target=this.preselection) {
    if ( target ) {
      this.removeSelection(target);
      this.addSelection(target);
    }
  }
  replace(target=this.preselection) {
    if ( target ) {
      if ( this.selections.length )
        this.removeSelection(this.selections[this.selections.length-1]);
      this.removeSelection(target);
      this.addSelection(target);
    }
  }
  reselect(...targets) {
    for ( let sel of this.selections.slice().reverse() )
      this.removeSelection(sel);
    for ( let target of targets )
      this.addSelection(target);
  }

  addSelection(target) {
    var index = this.selections.indexOf(target);
    if ( index != -1 )
      return false;
    this.selections.push(target);
    index = this.selections.length - 1;
    this.trigger("add", target, {index});
    return true;
  }
  removeSelection(target) {
    var index = this.selections.indexOf(target);
    if ( index == -1 )
      return false;
    this.trigger("remove", target, {index});
    this.selections.splice(index, 1);
    return true;
  }
}

class SelectPanel
{
  constructor(panel, selector, prop_builder=this) {
    this.panel = panel;
    this.selector = selector;
    this.prop_builder = prop_builder;
    this._sels_id = [];

    selector.view = this;
    selector.on("add", Object, event => this.addSel(event.index, event.target));
    selector.on("remove", Object, event => this.removeSel(event.index));
  }
  link(target, sel_mode, name=target.name) {
    var property = {type: "button", name: name};

    if ( sel_mode == "replace" )
      property.callback = () => this.selector.replace(target);
    else if ( sel_mode == "focus" )
      property.callback = () => this.selector.focus(target);
    else
      property.callback = () => this.selector.select(target);

    return property;
  }
  addSel(index, target) {
    var property = this.prop_builder.link(target, "focus") || this.link(target, "focus");
    this._sels_id[index] = this.panel.add(property);
  }
  removeSel(index) {
    this.panel.remove(this._sels_id[index]);
    this._sels_id.splice(index, 1);
  }
}

class DetailPanel
{
  constructor(panel, selector, prop_builder=this) {
    this.panel = panel;
    this.selector = selector;
    this.prop_builder = prop_builder;

    selector.view = this;
    selector.on("add", Object, event => this.setDetail(event.target));
    selector.on("remove", Object, event => this.clearDetail());
  }
  prop(target, sel_mode) {
    return [];
  }
  setDetail(target) {
    var properties = this.prop_builder.prop(target, "replace") || this.prop(target, "replace");
    properties.unshift({
      type: "button",
      name: `console.log(${target.name||"object"})`,
      callback: () => console.log(target)
    });
    this.panel.clear();
    this.panel.add(...properties);
  }
  clearDetail() {
    this.panel.clear();
  }
}


class SphPuzzlePropBuilder
{
  constructor(puzzle, selector) {
    this.puzzle = puzzle;
    this.selector = selector;

    puzzle.brep.initialize(() => this.initBREP(puzzle.brep));
    puzzle.network.initialize(() => this.initNetwork(puzzle.network));
  }

  initBREP(brep) {
    var colors = (function *colors() {
      while ( true ) {
        // ref: https://sashat.me/2017/01/11/list-of-20-simple-distinct-colors/
        yield *["#e6194B", "#3cb44b",
                "#ffe119", "#4363d8",
                "#f58231", "#911eb4",
                "#42d4f4", "#f032e6",
                "#bfef45", "#fabebe",
                "#469990", "#e6beff",
                "#9A6324", "#fffac8",
                "#800000", "#aaffc3",
                "#808000", "#ffd8b1",
                "#000075", "#a9a9a9",
                "#ffffff", "#000000"];
      }
    })();
    var elem_id = (function *numbers() {
      var i = 0; while ( true ) yield `SphElem${i++}`;
    })();
    var seg_id = (function *numbers() {
      var i = 0; while ( true ) yield `SphSeg${i++}`;
    })();
    var track_id = (function *numbers() {
      var i = 0; while ( true ) yield `SphTrack${i++}`;
    })();

    function initElemNameProp(elem) {
      elem._name = elem._name || elem_id.next().value;
      Object.defineProperty(elem, "name", {
        enumerable: true,
        configurable: true,
        get: function() { return this._name; },
        set: function(val) { this._name = val; this.host.trigger("renamed", this); }
      });
    }
    function initSegNameProp(seg) {
      seg._name = seg._name || seg_id.next().value;
      Object.defineProperty(seg, "name", {
        enumerable: true,
        configurable: true,
        get: function() { return this._name; },
        set: function(val) { this._name = val; this.host.trigger("renamed", this); }
      });
    }
    function initTrackNameProp(track) {
      track._name = track._name || track_id.next().value;
      Object.defineProperty(track, "name", {
        enumerable: true,
        configurable: true,
        get: function() { return this._name; },
        set: function(val) { this._name = val; this.host.trigger("renamed", this); }
      });
    }
    function initColorProp(elem) {
      elem._color = elem._color || colors.next().value;
      Object.defineProperty(elem, "color", {
        enumerable: true,
        configurable: true,
        get: function() { return this._color; },
        set: function(val) { this._color = val; this.host.trigger("recolored", this); }
      });
    }

    brep.name = brep.name || "SphBREP";

    for ( let seg of brep.segments )
      initSegNameProp(seg);
    for ( let elem of brep.elements ) {
      initElemNameProp(elem);
      initColorProp(elem);
    }
    for ( let track of brep.tracks )
      initTrackNameProp(track);

    brep.on("added", SphSeg, event => initSegNameProp(event.target));
    brep.on("added", SphElem, event => { initElemNameProp(event.target); initColorProp(event.target); });
    brep.on("added", SphTrack, event => initTrackNameProp(event.target));
  }
  initNetwork(network) {
    var knot_id = (function *numbers() {
      var i = 0; while ( true ) yield `SphKnot${i++}`;
    })();
    var joint_id = (function *numbers() {
      var i = 0; while ( true ) yield `SphJoint${i++}`;
    })();

    function initKnotNameProp(knot) {
      knot._name = knot._name || knot_id.next().value;
      Object.defineProperty(knot, "name", {
        enumerable: true,
        configurable: true,
        get: function() { return this._name; },
        set: function(val) { this._name = val; this.host.trigger("renamed", this); }
      });
    }
    function initJointNameProp(joint) {
      joint._name = joint._name || joint_id.next().value;
      Object.defineProperty(joint, "name", {
        enumerable: true,
        configurable: true,
        get: function() { return this._name; },
        set: function(val) { this._name = val; this.host.trigger("renamed", this); }
      });
    }

    network.name = network.name || "SphNetwork";

    for ( let knot of network.knots )
      initKnotNameProp(knot);
    for ( let joint of network.joints )
      initJointNameProp(joint);

    network.on("added", SphKnot, event => initKnotNameProp(event.target));
    network.on("added", SphJoint, event => initJointNameProp(event.target));
  }

  link(target, sel_mode, name=target.name) {
    if ( !(target instanceof SphElem)
         && !(target instanceof SphSeg)
         && !(target instanceof SphTrack)
         && !(target instanceof SphKnot)
         && !(target instanceof SphJoint) )
      return;

    var property = {type: "button", name: name};
    property.mouseenter = () => this.selector.preselection = target;
    property.mouseleave = () => this.selector.preselection = undefined;

    if ( sel_mode == "replace" )
      property.callback = () => this.selector.replace(target);
    else if ( sel_mode == "focus" )
      property.callback = () => this.selector.focus(target);
    else
      property.callback = () => this.selector.select(target);

    return property;
  }
  prop(target, sel_mode) {
    if ( target instanceof SphElem )
      return this.makeElemProperties(target, sel_mode);
    else if ( target instanceof SphSeg )
      return this.makeSegProperties(target, sel_mode);
    else if ( target instanceof SphTrack )
      return this.makeTrackProperties(target, sel_mode);
    else if ( target instanceof SphKnot )
      return this.makeKnotProperties(target, sel_mode);
    else if ( target instanceof SphJoint )
      return this.makeJointProperties(target, sel_mode);
  }
  makeElemProperties(elem, sel_mode) {
    var detail = [];
    detail.push({
      type: "color",
      name: "color",
      get: () => elem.color,
      set: color => elem.color=color
    });

    var boundaries = [];
    for ( let seg of elem.boundaries )
      boundaries.push(this.link(seg, sel_mode));
    detail.push({type: "folder", name: "boundaries", open: true, properties: boundaries});

    if ( this.puzzle.network.status == "up-to-date" ) {
      var joints = Array.from(this.puzzle.network.jointsOf(elem))
                        .map(joint => this.link(joint, sel_mode));
      detail.push({type: "folder", name: "joints", properties: joints});
    }

    return detail;
  }
  makeSegProperties(seg, sel_mode) {
    var detail = [];

    detail.push({
      type: "color",
      name: "color",
      get: () => seg.affiliation.color,
      set: color => seg.affiliation.color=color
    });
    detail.push({type: "number", min: 0, max: 4, name: "arc", get: () => seg.arc});
    detail.push({type: "number", min: 0, max: 2, name: "radius", get: () => seg.radius});
    detail.push({type: "number", min: 0, max: 4, name: "angle", get: () => seg.angle});

    detail.push(this.link(seg.affiliation, sel_mode, "affiliation"));
    detail.push(this.link(seg.prev, sel_mode, "prev"));
    detail.push(this.link(seg.next, sel_mode, "next"));

    detail.push({type: "text", name: "index", get: () => {
      if ( seg.host.host.network.status != "up-to-date" )
        return "undefined";
      var [knot, [i,j,k,l]] = seg.host.host.network.indicesOf(seg).next().value;
      return `${knot.name}[${i},${j};${k},${l}]`;
    }});

    if ( seg.track )
      detail.push(this.link(seg.track, sel_mode, "track"));
    var adj = [];
    for ( let [adj_seg, offset] of seg.adj )
      adj.push(this.link(adj_seg, sel_mode, `${adj_seg.name} → ${offset}`));
    detail.push({type: "folder", name: "adj", open: true, properties: adj});

    return detail;
  }
  makeTrackProperties(track, sel_mode) {
    var detail = [];

    detail.push({type: "number", min: 0, max: 4, name: "shift", get: () => track.shift});
    var radius = track.inner[0].radius;
    detail.push({type: "number", min: 0, max: 2, name: "radius", get: () => radius});

    var latches = [];
    for ( let [track_, {center, arc, angle}] of track.latches )
      latches.push(this.link(track_, sel_mode, `${track_.name} → (${center}, ${arc}, ${angle})`));
    detail.push({type: "folder", name: "latches", open: true, properties: latches});

    var inner = [];
    for ( let seg of track.inner )
      inner.push(this.link(seg, sel_mode));
    detail.push({type: "folder", name: "inner", properties: inner});

    var outer = [];
    for ( let seg of track.outer )
      outer.push(this.link(seg, sel_mode));
    detail.push({type: "folder", name: "outer", properties: outer});

    if ( track.host.status == "ready" && track.secret ) {
      var secret = [];

      var pseudokeys = [];
      for ( let [kee, matches] of track.secret.pseudokeys )
        pseudokeys.push({type: "text", name: `${kee}`,
          get: () => matches.map(([seg1, seg2]) => `${seg1.name}-${seg2.name}`).join()});
      secret.push({type: "folder", name: "pseudokeys", properties: pseudokeys});

      var passwords = [];
      for ( let [key, matches] of track.secret.passwords )
        passwords.push({type: "text", name: `${key}`,
          get: () => matches.map(({center, arc, angle}) => `(${center}, ${arc}, ${angle})`).join()});
      secret.push({type: "folder", name: "passwords", properties: passwords});

      var partition_inner = [];
      for ( let seg of track.secret.partition.inner )
        partition_inner.push(this.link(seg, sel_mode));
      secret.push({type: "folder", name: "partition.inner", properties: partition_inner});

      var partition_outer = [];
      for ( let seg of track.secret.partition.outer )
        partition_outer.push(this.link(seg, sel_mode));
      secret.push({type: "folder", name: "partition.outer", properties: partition_outer});

      detail.push({type: "folder", name: "secret", properties: secret});
    }

    return detail;
  }
  makeKnotProperties(knot, sel_mode) {
    var detail = [];

    var joints = [];
    for ( let [index, joint] of knot.model.items(knot.joints) )
      joints.push(this.link(joint, sel_mode, `${index} → ${joint.name}`));
    detail.push({type:"folder", name:"joints", open:"true", properties:joints});

    return detail;
  }
  makeJointProperties(joint, sel_mode) {
    var detail = [];

    var ports = [];
    for ( let [knot, orientation] of joint.ports )
      ports.push(this.link(knot, sel_mode, `${knot.name} → (${orientation})`));
    detail.push({type:"folder", name:"ports", open:true, properties:ports});

    var bandage = [];
    for ( let joint_ of joint.bandage )
      bandage.push(this.link(joint_, sel_mode));
    detail.push({type:"folder", name:"bandage", properties:bandage});

    return detail;
  }
}

class SphBREPView
{
  constructor(display, brep, selector) {
    this.display = display;
    this.selector = selector;
    this.origin = brep;
    brep.view = this;

    this.root = new THREE.Object3D();
    this.display.add(this.root);

    // draw ball
    {
      let geo = new THREE.IcosahedronGeometry(0.999, 5);
      let mat = new THREE.MeshLambertMaterial({color:0xffffff});
      this.ball = new THREE.Mesh(geo, mat);

      this.ball.userData.hoverable = true;
      this.ball.addEventListener("click", event => {
        var puzzle = this.origin.host;

        if ( puzzle.network.status != "broken" ) {
          var point = event.point.toArray();
          var sel = puzzle.grab(point);
          if ( sel instanceof SphJoint )
            sel = puzzle.network.fly(sel).next().value.affiliation;
          if ( event.originalEvent.ctrlKey )
            this.selector.toggle(sel);
          else
            this.selector.select(sel);

        } else {
          if ( !event.originalEvent.ctrlKey )
            this.selector.reselect();
        }
      });
      this.display.scene.addEventListener("click", event => {
        if ( !event.originalEvent.ctrlKey )
          this.selector.reselect();
      });

      this.display.add(this.ball, this.root);
    }

    brep.initialize(() => this.initView(brep));
    this.display.animate(this.hoverRoutine());
  }

  // 3D view
  initView(brep) {
    for ( let segment of brep.segments )
      this.drawSegment(segment);
    for ( let track of brep.tracks )
      this.addTwister(track);
    this.updateTwisters();

    brep.on("added", SphSeg, event => this.drawSegment(event.target));
    brep.on("removed", SphSeg, event => this.eraseSegment(event.target));
    brep.on("modified", SphSeg, event => {
      if ( "arc" in event.record || "radius" in event.record || "angle" in event.record ) {
        this.eraseSegment(event.target);
        this.drawSegment(event.target);
      }
      if ( "orientation" in event.record )
        event.target.view.quaternion.set(...event.target.orientation);
    });

    var recolor = event => {
      for ( let seg of event.target.boundaries )
        if ( seg.view )
          for ( let sub of seg.view.children )
            sub.material.color.set(event.target.color);
    };
    brep.on("added", SphElem, recolor);
    brep.on("modified", SphElem, recolor);
    brep.on("recolored", SphElem, recolor);

    brep.on("added", SphTrack, event => this.addTwister(event.target));
    brep.on("removed", SphTrack, event => this.removeTwister(event.target));
    brep.on("modified", SphTrack, event => {
      if ( "inner" in event.record || "outer" in event.record ) {
        this.removeTwister(event.target);
        this.addTwister(event.target);
      }
    });

    brep.on("statuschanged", brep, event => this.updateTwisters());
    brep.on("changed", brep, event => this.updateTwisters());
  }
  drawSegment(seg) {
    var color = seg.affiliation.color || "black";
    var dq = 0.01;

    // make arc
    {
      let geo = new THREE.Geometry();
      let s = Math.sin(seg.radius*Q), c = Math.cos(seg.radius*Q);
      let da = dq*s;
      let v0 = new THREE.Vector3(s, 0, c);
      let center = new THREE.Vector3(0,0,1);
      let v1 = v0.clone().applyAxisAngle(center, seg.arc*Q);
      geo.vertices = Array.from({length:Math.floor(seg.arc/da)+1},
                                (_, i) => v0.clone().applyAxisAngle(center, i*da*Q));
      geo.vertices.push(v1);

      let mat = new THREE.LineBasicMaterial({color});
      var arc = new THREE.Line(geo, mat);
      arc.name = "arc";
    }

    // make dash
    {
      let geo = new THREE.Geometry();
      let s = Math.sin((seg.radius-dq/2)*Q), c = Math.cos((seg.radius-dq/2)*Q);
      let da = dq*s;
      let v0_ = new THREE.Vector3(s, 0, c);
      let center = new THREE.Vector3(0,0,1);
      let v0 = v0_.clone().applyAxisAngle(center, da*Q);
      let v1 = v0_.clone().applyAxisAngle(center, (seg.arc-da)*Q);
      geo.vertices = Array.from({length:Math.floor(seg.arc/da)-1},
                                (_, i) => v0.clone().applyAxisAngle(center, i*da*Q));
      geo.vertices.push(v1);

      let mat = new THREE.LineDashedMaterial({color, dashSize: dq*Q/2, gapSize: dq*Q/2});
      var dash = new THREE.Line(geo, mat);
      dash.computeLineDistances();
      dash.name = "dash";
    }

    // make angle
    {
      let geo;
      if ( fzy_cmp(seg.angle, 0) != 0 )
        geo = new THREE.CircleGeometry(dq*Q, 10, Q, seg.angle*Q);
      else
        geo = new THREE.CircleGeometry(3*dq*Q, 3, (1-10*dq)*Q, 2*10*dq*Q);
      geo.translate(0, 0, 1);
      geo.rotateY(seg.radius*Q);

      let mat = new THREE.MeshBasicMaterial({color});
      var ang = new THREE.Mesh(geo, mat);
      ang.name = "angle";
    }

    // make holder
    {
      let da = dq*Math.sin(seg.radius*Q);
      let N = Math.floor(seg.arc/da)+1;
      let geo = new THREE.SphereGeometry(1, N, 2, 2*Q, seg.arc*Q,
                                         (seg.radius-2*dq)*Q, dq*2*Q);
      geo.rotateX(Q);

      let mat = new THREE.MeshBasicMaterial({color, transparent:true, opacity:0,
                                             depthWrite:false});
      var holder = new THREE.Mesh(geo, mat);
      holder.name = "holder";

      holder.userData.hoverable = true;
      holder.addEventListener("mouseenter", event =>
        this.selector.preselection = event.target.parent.userData.origin);
      holder.addEventListener("mouseleave", event =>
        this.selector.preselection = undefined);
      holder.addEventListener("click", event =>
        event.originalEvent.ctrlKey ? this.selector.toggle() : this.selector.select());
    }

    var obj = new THREE.Object3D();
    obj.add(arc, dash, ang, holder);
    obj.quaternion.set(...seg.orientation);

    seg.view = obj;
    obj.userData.origin = seg;
    this.display.add(seg.view, this.root);
  }
  eraseSegment(seg) {
    this.display.remove(seg.view, this.root);
    delete seg.view;
  }
  addTwister(track) {
    var circle, plane, angle, moving;

    var dragstart = event => {
      [circle, moving] = track.inner.includes(event.target.parent.userData.origin)
                      ? [track.inner[0].circle, track.secret.regions.inner]
                      : [track.outer[0].circle, track.secret.regions.outer];

      var p = event.point.toArray();
      circle.shift(circle.thetaOf(p));
      plane = new THREE.Plane(new THREE.Vector3(...circle.center), -dot(circle.center, p));

      for ( let elem of moving ) for ( let seg of elem.boundaries )
        seg.view.userData.quaternion0 = seg.view.quaternion.clone();

      event.drag = true;
      angle = 0;
    };
    var drag = event => {
      var {offsetX, offsetY} = event.originalEvent;
      var {point} = this.display.pointTo(offsetX, offsetY, plane);
      if ( !point ) return angle;
      var angle_ = circle.thetaOf(point.toArray());
      if ( Number.isNaN(angle_) )
        return angle;

      angle = angle_;
      angle = fzy_mod(angle, 4, track.twister.shifts, 0.01);
      angle = fzy_mod(angle, 4, track.twister.shifts0, 0.05);
      angle = fzy_mod(angle, 4, [0], 0.05);
      var rot = new THREE.Quaternion().setFromAxisAngle(plane.normal, angle*Q);

      for ( let elem of moving ) for ( let seg of elem.boundaries )
        seg.view.quaternion.multiplyQuaternions(rot, seg.view.userData.quaternion0);

      return angle;
    };
    var dragend = event => {
      var angle = drag(event);
      if ( angle !== 0 ) {
        var hold = this.origin.elements.find(elem => !moving.has(elem));
        this.origin.host.twist(track, angle, hold);
      }
    };

    var targets = [...track.inner, ...track.outer].map(seg => seg.view.children[3]);
    track.twister = {dragstart, drag, dragend, targets, origin:track};
    for ( let holder of targets ) {
      holder.addEventListener("dragstart", dragstart);
      holder.addEventListener("drag", drag);
      holder.addEventListener("dragend", dragend);
    }
  }
  removeTwister(track) {
    var {dragstart, drag, dragend, targets} = track.twister;
    this.display.scene.traverse(holder => {
      if ( targets.includes(holder) ) {
        holder.removeEventListener("dragstart", dragstart);
        holder.removeEventListener("drag", drag);
        holder.removeEventListener("dragend", dragend);
      }
    });
    delete track.twister;
  }
  updateTwisters() {
    for ( let seg of this.origin.segments )
      if ( seg.view )
        seg.view.userData.draggable = false;

    if ( this.origin.status == "ready" ) {
      for ( let track of this.origin.tracks )
        if ( track.twister && track.secret && track.secret.regions ) {
          track.twister.shifts = Array.from(track.secret.pseudokeys.keys())
              .map(kee => this.origin.analyzer.mod4(track.shift-kee)).sort();
          track.twister.shifts0 = Array.from(track.secret.passwords.keys())
              .map(key => this.origin.analyzer.mod4(track.shift-key)).sort();

          for ( let target of track.twister.targets )
            target.userData.draggable = true;
        }
    }
  }

  // hover/select feedback
  objsOf(target) {
    if ( target instanceof SphSeg ) {
      return target.view ? [target.view] : [];

    } else if ( target instanceof SphElem ) {
      return Array.from(target.boundaries)
                  .map(seg => seg.view).filter(view => view);

    } else if ( target instanceof SphTrack ) {
      return [...target.inner, ...target.outer]
                  .map(seg => seg.view).filter(view => view);

    } else if ( target instanceof SphKnot ) {
      return target.segments.flat().flatMap(seg => Array.from(seg.walk()))
                  .map(seg => seg.view).filter(view => view);

    } else if ( target instanceof SphJoint ) {
      return Array.from(target.ports.keys())
                  .map(knot => knot.segmentAt(knot.indexOf(target)))
                  .flatMap(seg => Array.from(seg.walk()))
                  .map(seg => seg.view).filter(view => view);

    } else {
      return [];
    }
  }
  emphasize(obj) {
    obj.children[0].material.linewidth = 2;
    obj.children[1].material.linewidth = 2;
  }
  unemphasize(obj) {
    obj.children[0].material.linewidth = 1;
    obj.children[1].material.linewidth = 1;
  }
  highlight(obj) {
    obj.children[3].material.opacity = 0.3;
  }
  unhighlight(obj) {
    obj.children[3].material.opacity = 0;
  }
  *hoverRoutine() {
    var preselection = undefined;
    var selected_objs = [];
    while ( true ) {
      yield;

      // emphasize hovered object
      if ( this.selector.preselection !== preselection ) {
        for ( let obj of this.objsOf(preselection) )
          this.unemphasize(obj);
        for ( let obj of this.objsOf(this.selector.preselection) )
          this.emphasize(obj);
        preselection = this.selector.preselection;
      }

      // highlight selected objects
      let new_selected_objs = this.selector.selections
        .flatMap(sel => this.objsOf(sel));

      for ( let obj of selected_objs )
        if ( !new_selected_objs.includes(obj) )
          this.unhighlight(obj);
      for ( let obj of new_selected_objs )
        if ( !selected_objs.includes(obj) )
          this.highlight(obj);

      selected_objs = new_selected_objs;
    }
  }
}

class SphNetworkView
{
  constructor(graph, network, selector) {
    this.graph = graph;
    this.selector = selector;
    this.origin = network;
    network.view = this;

    this.graph.view.on("click", event => {
      if ( this.origin.status == "broken" )
        return;

      var target = event.target && event.target.origin;
      if ( event.event.srcEvent.ctrlKey ) {
        if ( target instanceof SphKnot || target instanceof SphJoint )
          this.selector.toggle(target);
      } else {
        if ( target instanceof SphKnot || target instanceof SphJoint )
          this.selector.select(target);
        else
          this.selector.reselect();
      }
    });
    this.graph.view.on("hoverNode", event => {
      if ( this.origin.status == "broken" )
        return;

      var target = event.target && event.target.origin;
      if ( target instanceof SphKnot || target instanceof SphJoint )
        this.selector.preselection = target;
      else
        this.selector.preselection = undefined;
    });
    this.graph.view.on("blurNode", event => {
      if ( this.origin.status == "broken" )
        return;
      this.selector.preselection = undefined;
    });

    network.initialize(() => this.initView(network));
    animate(this.hoverRoutine());
  }

  // network view
  initView(network) {
    for ( let knot of network.knots )
      this.drawKnot(knot);
    for ( let joint of network.joints ) {
      this.drawJoint(joint);
      this.updateBandage(joint);
    }

    network.on("statuschanged", SphNetwork, event => {
      if ( this.origin.status == "broken" )
        this.graph.disable();
      else
        this.graph.enable();
    });
    network.on("added", Object, event => {
      if ( event.target instanceof SphKnot ) {
        this.drawKnot(event.target);

      } else if ( event.target instanceof SphJoint ) {
        this.drawJoint(event.target);
        this.updateBandage(event.target);
      }
    });
    network.on("removed", Object, event => {
      if ( event.target instanceof SphKnot ) {
        this.eraseKnot(event.target);

      } else if ( event.target instanceof SphJoint ) {
        this.eraseJoint(event.target);
      }
    });
    network.on("modified", SphJoint, event => {
      if ( "ports" in event.record )
        this.updateJoint(event.target);
      if ( "bandage" in event.record )
        this.updateBandage(event.target);
    });
  }
  drawKnot(knot) {
    knot.node_id = this.graph.addNode({size:20, shape:"diamond", origin:knot});
  }
  drawJoint(joint) {
    joint.node_id = this.graph.addNode({size:5, shape:"dot", origin:joint});

    for ( let knot of joint.ports.keys() )
      this.graph.addEdge(joint.node_id, knot.node_id);
  }
  updateJoint(joint) {
    for ( let edge of this.graph.edgesBetween(joint.node_id, undefined) )
      this.graph.removeEdge(edge.id);
    for ( let knot of joint.ports.keys() )
      this.graph.addEdge(joint.node_id, knot.node_id);
  }
  ungroupJoint(joint) {
    var node = this.graph.getNode(joint.node_id);

    let edges = Array.from(this.graph.edgesBetween(node.bandage_id, undefined));

    if ( edges.every(edge => edge.to == joint.node_id) )
      this.graph.removeNode(node.bandage_id);
    else
      for ( let edge of edges ) if ( edge.to == joint.node_id )
        this.graph.removeEdge(edge.id);

    delete node.bandage_id;
  }
  updateBandage(joint) {
    var node = this.graph.getNode(joint.node_id);

    if ( joint.bandage.size == 1 ) {
      if ( node.bandage_id !== undefined )
        this.ungroupJoint(joint);
      return;
    }

    let bandage_id = Array.from(joint.bandage)
                          .map(joint => joint.node_id).filter(id => id)
                          .map(id => this.graph.getNode(id))
                          .map(node => node.bandage_id).find(id => id);
    if ( !bandage_id )
      bandage_id = this.graph.addNode({size:0, shape:"dot", type:"bandage"});

    if ( node.bandage_id !== undefined && node.bandage_id != bandage_id )
      this.ungroupJoint(joint);

    if ( node.bandage_id === undefined ) {
      this.graph.addEdge(bandage_id, node.id, {dashes:true});
      this.graph.updateNode(node.id, {bandage_id});
      node.bandage_id = bandage_id;
    }
  }
  eraseKnot(knot) {
    this.graph.removeNode(knot.node_id);
    delete knot.node_id;
  }
  eraseJoint(joint) {
    if ( this.graph.getNode(joint.node_id).bandage_id )
      this.ungroupJoint(joint);
    this.graph.removeNode(joint.node_id);
    delete joint.node_id;
  }

  // hover/select feedback
  nodeidOf(target) {
    if ( target instanceof SphKnot ) {
      return target.node_id;

    } else if ( target instanceof SphJoint ) {
      return target.node_id;

    } else if ( target instanceof SphElem ) {
      for ( let joint of this.origin.joints )
        for ( let knot of joint.ports.keys() )
          if ( knot.segmentAt(knot.indexOf(joint)).affiliation === target )
            return joint.node_id;
      for ( let knot of this.origin.knots )
        for ( let seg of knot.segments.flat() )
          if ( seg.affiliation === target )
            return knot.node_id;

    } else if ( target instanceof SphSeg ) {
      for ( let knot of this.origin.knots )
        if ( knot.indexOf(target) )
          return knot.node_id;

    } else if ( target instanceof SphTrack ) {
      for ( let knot of this.origin.knots )
        if ( knot.indexOf(target.inner[0]) )
          return knot.node_id;
    }
  }
  emphasize(id) {
    this.graph.updateNode(id, {color:{background:"#D2E5FF"}});
  }
  unemphasize(id) {
    this.graph.updateNode(id, {color:{background:"#97C2FC"}});
  }
  highlight(id) {
    this.graph.updateNode(id, {borderWidth:2});
  }
  unhighlight(id) {
    this.graph.updateNode(id, {borderWidth:1});
  }
  *hoverRoutine() {
    var preselection = undefined;
    var selected_ids = [];
    while ( true ) {
      yield;

      if ( this.origin.status == "broken" ) {
        preselection = undefined;
        selected_ids = [];
        continue;
      }

      // emphasize hovered object
      if ( this.selector.preselection !== preselection ) {
        let id;
        if ( id = this.nodeidOf(preselection) )
          this.unemphasize(id);
        if ( id = this.nodeidOf(this.selector.preselection) )
          this.emphasize(id);
        preselection = this.selector.preselection;
      }

      // highlight selected objects
      var new_selected_ids = this.selector.selections
        .map(sel => this.nodeidOf(sel)).filter(id => id !== undefined);

      for ( let id of selected_ids )
        if ( !new_selected_ids.includes(id) )
          this.unhighlight(id);
      for ( let id of new_selected_ids )
        if ( !selected_ids.includes(id) )
          this.highlight(id);

      selected_ids = new_selected_ids;
    }
  }
}

class SphStateView
{
  constructor(container, network, selector) {
    this.container = container;
    this.selector = selector;
    this.origin = network;
    network.state_view = this;

    document.body.appendChild(css`
      .state-container>div {
        margin: 10px 12px;
      }
      .state-container.broken {
        color: gray;
      }

      .list {
        margin-left: 15px;
        margin-top: 3px;
        margin-bottom: 3px;
        font-family: "Lucida Console", Monaco, monospace;
      }
      .list::before {
        content: '[';
      }
      .list::after {
        content: ']';
      }
      .item {
        display: inline-block;

        -webkit-user-select: none;
        -moz-user-select: none;
        -ms-user-select: none;
        user-select: none;
      }
      .item:not(:last-child)::after {
        content: ', ';
        white-space: pre;
      }
      .item.emphasized {
        font-weight: bold;
      }
      .item.highlighted {
        outline: 1px dashed gray;
      }
      .item.dragging {
        opacity: 0.3;
      }
    `);
    this.container.classList.add("state-container");
    this.container.addEventListener("click", () => this.selector.reselect());

    network.initialize(() => this.initView(network));
    animate(this.hoverRoutine());
  }

  // tab view
  initView(network) {
    for ( let knot of network.knots )
      this.drawTab(knot);

    if ( network.status == "broken" )
      this.container.classList.add("broken");
    else
      this.container.classList.remove("broken");

    if ( network.status == "outdated" )
      this.container.classList.add("outdated");
    else
      this.container.classList.remove("outdated");

    network.on("added", SphKnot, event => this.drawTab(event.target));
    network.on("removed", SphKnot, event => this.eraseTab(event.target));
    network.on("modified", SphKnot, event => this.updateTab(event.target));
    network.on("statuschanged", network, event => {
      if ( event.target.status == "broken" )
        this.container.classList.add("broken");
      else
        this.container.classList.remove("broken");

      if ( event.target.status == "outdated" )
        this.container.classList.add("outdated");
      else
        this.container.classList.remove("outdated");
    });
  }
  makeParamTable(knot) {
    var res = [];
    var origin = this.origin;

    for ( let i=0; i<knot.model.shapes.length; i++ ) {
      let list = document.createElement("div");
      list.classList.add("list");

      const L = knot.model.shapes[i].patch.length;
      for ( let j=0; j<knot.model.shapes[i].count; j++ ) {
        let item = document.createElement("div");
        item.classList.add("item");
        item.draggable = true;
        item.textContent = knot.segments[i][j].name;

        item.addEventListener("wheel", function(event) {
          if ( origin.status == "broken" )
            return;
          if ( event.deltaY == 0 )
            return;
          var j = Array.from(this.parentNode.children).indexOf(this);

          if ( event.deltaY > 0 ) {
            for ( let l=0; l<L; l++ )
              knot.segments[i][j] = knot.segments[i][j].next;
          } else {
            for ( let l=0; l<L; l++ )
              knot.segments[i][j] = knot.segments[i][j].prev;
          }
          knot.host.setStatus("outdated");

          this.textContent = knot.segments[i][j].name;
          event.preventDefault();
        });

        item.addEventListener("dragstart", function(event) {
          if ( origin.status == "broken" )
            return;
          event.dataTransfer.setData("Text", "");
          event.dataTransfer.dropEffect = "move";
          this.classList.add("dragging");
        });
        item.addEventListener("dragend", function(event) {
          this.classList.remove("dragging");
          this.focus();
        });
        item.addEventListener("dragover", function(event) {
          var target = this.parentNode.querySelector(".item.dragging");
          if ( !target )
            return;
          event.preventDefault();
          event.dataTransfer.effectAllowed = "move";
        });
        item.addEventListener("dragenter", function(event) {
          var target = this.parentNode.querySelector(".item.dragging");
          if ( !target || this === target )
            return;

          var list = Array.from(this.parentNode.children);
          var j = list.indexOf(this);
          var j0 = list.indexOf(target);

          if ( j < j0 ) {
            this.parentNode.insertBefore(target, this);
            knot.segments[i].splice(j, 0, ...knot.segments[i].splice(j0, 1));
          } else if ( this.nextElementSibling ) {
            this.parentNode.insertBefore(target, this.nextElementSibling);
            knot.segments[i].splice(j, 0, ...knot.segments[i].splice(j0, 1));
          } else {
            this.parentNode.appendChild(target);
            knot.segments[i].push(...knot.segments[i].splice(j0, 1));
          }
          knot.host.setStatus("outdated");
        });

        item.addEventListener("mouseenter", event => {
          if ( this.origin.status == "broken" )
            return;
          var j = Array.from(event.target.parentNode.children).indexOf(event.target);
          this.selector.preselection = knot.jointAt([i,j]) || knot.segmentAt([i,j]).affiliation;
        });
        item.addEventListener("mouseleave", () => this.selector.preselection=undefined);
        item.addEventListener("click", event => {
          if ( this.origin.status == "broken" )
            return;
          var j = Array.from(event.target.parentNode.children).indexOf(event.target);
          var target = knot.jointAt([i,j]) || knot.segmentAt([i,j]).affiliation;

          if ( event.ctrlKey ) {
            if ( target )
              this.selector.toggle(target);
          } else {
            if ( target )
              this.selector.select(target);
            else
              this.selector.reselect();
          }
          event.stopPropagation();
        });

        list.appendChild(item);
      }

      res.push(list);
    }
    return res;
  }
  drawTab(knot) {
    var tab = document.createElement("div");
    this.container.appendChild(tab);

    var title = document.createElement("h3");
    title.textContent = knot.name;
    tab.appendChild(title);

    for ( let list of this.makeParamTable(knot) )
      tab.appendChild(list);
    tab.addEventListener("click", () => this.selector.reselect());

    knot.tab = tab;
    tab.origin = knot;
  }
  eraseTab(knot) {
    this.container.removeChild(knot.tab);
    delete knot.tab;
  }
  updateTab(knot) {
    for ( let [[i,j,k,l], seg] of knot.model.items(knot.segments) )
      if ( k == 0 && l == 0 ) {
        let item = this.getItem(knot, [i,j]);
        item.textContent = knot.segments[i][j].name;
      }
  }

  // hover/select feedback
  getItem(knot, [i,j]) {
    return knot.tab.querySelector(`div.list:nth-of-type(${i+1})>div.item:nth-of-type(${j+1})`);
  }
  itemsOf(target) {
    if ( this.origin.status == "broken" )
      return [];

    if ( target instanceof SphSeg ) {
      for ( let [knot, index] of this.origin.indicesOf(target) )
        return [this.getItem(knot, index)];
      console.assert(false);

    } else if ( target instanceof SphElem ) {
      let res = [];
      for ( let [knot, index] of this.origin.indicesOf(target) )
        res.push(this.getItem(knot, index));
      console.assert(res.length);
      return res;

    } else if ( target instanceof SphJoint ) {
      let res = [];
      for ( let [knot, index] of this.origin.indicesOf(target) )
        res.push(this.getItem(knot, index));
      console.assert(res.length);
      return res;

    } else {
      return [];
    }
  }
  emphasize(item) {
    item.classList.add("emphasized");
  }
  unemphasize(item) {
    item.classList.remove("emphasized");
  }
  highlight(item) {
    item.classList.add("highlighted");
  }
  unhighlight(item) {
    item.classList.remove("highlighted");
  }
  *hoverRoutine() {
    var preselection = undefined;
    var selections = [];
    while ( true ) {
      yield;

      if ( this.origin.status == "broken" )
        continue;

      // emphasize hovered object
      if ( this.selector.preselection !== preselection ) {
        for ( let item of this.itemsOf(preselection) )
          this.unemphasize(item);
        for ( let item of this.itemsOf(this.selector.preselection) )
          this.emphasize(item);
        preselection = this.selector.preselection;
      }

      // highlight selected objects
      let new_selections = this.selector.selections
        .flatMap(sel => this.itemsOf(sel));

      for ( let item of selections )
        if ( !new_selections.includes(item) )
          this.unhighlight(item);
      for ( let item of new_selections )
        if ( !selections.includes(item) )
          this.highlight(item);

      selections = new_selections;
    }
  }
}


class SphBREPTreeViewPanel
{
  constructor(panel, brep, prop_builder) {
    this.panel = panel;
    this.brep = brep;
    this.prop_builder = prop_builder;

    this.segments = this.panel.ctrls[this.panel.addFolder("segments")];
    this.elements = this.panel.ctrls[this.panel.addFolder("elements")];
    this.tracks = this.panel.ctrls[this.panel.addFolder("tracks")];

    this.data = new Map();
    brep.initialize(() => this.initTree(brep));
  }

  initTree(brep) {
    for ( let seg of brep.segments )
      this.addSeg(seg);
    for ( let elem of brep.elements )
      this.addElem(elem);
    for ( let track of brep.tracks )
      this.addTrack(track);

    brep.on("added", SphSeg, event => this.addSeg(event.target));
    brep.on("added", SphElem, event => this.addElem(event.target));
    brep.on("added", SphTrack, event => this.addTrack(event.target));
    brep.on("removed", SphSeg, event => this.removeSeg(event.target));
    brep.on("removed", SphElem, event => this.removeElem(event.target));
    brep.on("removed", SphTrack, event => this.removeTrack(event.target));
  }

  addSeg(seg) {
    var id = this.segments.add(this.prop_builder.link(seg, "select"));
    this.data.set(seg, id);
  }
  addElem(elem) {
    var id = this.elements.add(this.prop_builder.link(elem, "select"));
    this.data.set(elem, id);
  }
  addTrack(track) {
    var id = this.tracks.add(this.prop_builder.link(track, "select"));
    this.data.set(track, id);
  }
  removeSeg(seg) {
    var id = this.data.get(seg);
    this.data.delete(seg);
    this.segments.remove(id);
  }
  removeElem(elem) {
    var id = this.data.get(elem);
    this.data.delete(elem);
    this.elements.remove(id);
  }
  removeTrack(track) {
    var id = this.data.get(track);
    this.data.delete(track);
    this.tracks.remove(id);
  }
}

class SphNetworkTreeViewPanel
{
  constructor(panel, network, prop_builder) {
    this.panel = panel;
    this.network = network;
    this.prop_builder = prop_builder;

    this.knots = this.panel.ctrls[this.panel.addFolder("knots")];
    this.joints = this.panel.ctrls[this.panel.addFolder("joints")];

    this.data = new Map();
    network.initialize(() => this.initTree(network));
  }

  initTree(network) {
    for ( let knot of network.knots )
      this.addKnot(knot);
    for ( let joint of network.joints )
      this.addJoint(joint);

    network.on("added", SphKnot, event => this.addKnot(event.target));
    network.on("added", SphJoint, event => this.addJoint(event.target));
    network.on("removed", SphKnot, event => this.removeKnot(event.target));
    network.on("removed", SphJoint, event => this.removeJoint(event.target));
  }

  addKnot(knot) {
    var id = this.knots.add(this.prop_builder.link(knot, "select"));
    this.data.set(knot, id);
  }
  addJoint(joint) {
    var id = this.joints.add(this.prop_builder.link(joint, "select"));
    this.data.set(joint, id);
  }
  removeKnot(knot) {
    var id = this.data.get(knot);
    this.data.delete(knot);
    this.knots.remove(id);
  }
  removeJoint(joint) {
    var id = this.data.get(joint);
    this.data.delete(joint);
    this.joints.remove(id);
  }
}


const KEYNAME = "\
        backspace tab   clear enter   shift ctrl alt pause caps\
       esc     space pageup pagedown end home left up right down  print\
   insert delete  0 1 2 3 4 5 6 7 8 9  ;  =\
    a b c d e f g h i j k l m n o p q r s t u v w x y z\
                      f1 f2 f3 f4 f5 f6 f7 f8 f9 f10 f11 f12\
                     num scroll                            -\
             ; = , - . / `                           [ \\ ] '  meta".split(" ");
const MODKEYS = "meta alt shift ctrl".split(" ");
const EDITKEYS = "backspace delete space tab enter ; = , -  . / ` [ \\ ] '\
 0 1 2 3 4 5 6 7 8 9 a b c d e f g h i j k l m n o p q r s t u v w x y z".split(" ");
class CmdMenu
{
  constructor(panel, selector) {
    this.panel = panel;
    this.selector = selector;
  }
  makeShortcut(arg) {
    if ( typeof arg == "string" ) { // make shortcut from string
      var keys = arg.toLowerCase().split("+");
      if ( keys.some(k => KEYNAME.indexOf(k) == -1) )
        return "";
      keys.sort((a,b) => MODKEYS.indexOf(a)-MODKEYS.indexOf(b)).reverse();
      return keys.join("+");

    } else { // make shortcut from event
      var main = KEYNAME[arg.which || arg.keyCode || 0];
      if ( MODKEYS.indexOf(main) != -1 ) return "";

      var keys = [];
      if ( arg.ctrlKey )  keys.push("ctrl");
      if ( arg.shiftKey ) keys.push("shift");
      if ( arg.altKey )   keys.push("alt");
      if ( arg.metaKey )  keys.push("meta");
      keys.push(main);
      return keys.join("+") || "";
    }
  }
  addCmd(func, name, shortcut) {
    if ( name )
      this.panel.add({type: "button", name, callback: () => func(this.selector)});

    if ( shortcut ) {
      shortcut = this.makeShortcut(shortcut);
      window.addEventListener("keydown", event => {
        if ( this.makeShortcut(event) == shortcut ) {
          func(this.selector);
          event.preventDefault();
        }
      });
    }
  }
}

class SphPuzzleWorldCmdMenu extends CmdMenu
{
  constructor(panel, selector, puzzle) {
    super(panel, selector);
    this.puzzle = puzzle;

    this.addCmd(this.mergeCmd.bind(this), "merge (shift+M)", "shift+M");
    this.addCmd(this.interCmd.bind(this), "interpolate");
    this.addCmd(this.sliceCmd.bind(this), "slice (shift+S)", "shift+S");
    this.addCmd(this.cleanCmd.bind(this), "clean (shift+C)", "shift+C");
    this.addCmd(this.prepareCmd.bind(this), "prepare (shift+V)", "shift+V");
    this.addCmd(this.checkCmd.bind(this), "check");

    this.addCmd(this.structCmd.bind(this), "structurize (shift+X)", "shift+X");
    this.addCmd(this.assembleCmd.bind(this), "assemble (shift+Z)", "shift+Z");
    this.addCmd(this.unbandageCmd.bind(this), "unbandage");
  }

  mergeCmd(selector) {
    var len = selector.selections.length;
    var [sel1, sel2] = selector.selections;
    
    if ( len == 1 && sel1 instanceof SphKnot ) {
      this.selector.reselect();
      this.puzzle.trim(sel1);

    } else if ( len == 2 && sel1 instanceof SphElem && sel2 instanceof SphElem ) {
      selector.reselect();
      this.puzzle.mergeElements(sel1, sel2);
      selector.reselect(sel1);

    } else if ( len == 2 && sel1 instanceof SphSeg && sel2 instanceof SphSeg && sel1.adj.has(sel2) ) {
      selector.reselect();
      this.puzzle.mergeEdge(sel1, sel2);

    } else if ( len == 2 && sel1 instanceof SphSeg && sel2 instanceof SphSeg && sel1.prev === sel2 ) {
      if ( !this.puzzle.analyzer.isTrivialVertex(sel1) ) {
        window.alert("Cannot merge segments!");
        return;
      }

      selector.reselect();
      this.puzzle.mergeVertex(sel1);
      selector.select(sel2);

    } else if ( len == 2 && sel1 instanceof SphSeg && sel2 instanceof SphSeg && sel2.prev === sel1 ) {
      if ( !this.puzzle.analyzer.isTrivialVertex(sel2) ) {
        window.alert("Cannot merge segments!");
        return;
      }

      selector.reselect();
      this.puzzle.mergeVertex(sel2);
      selector.select(sel1);

    } else {
      window.alert("merge what?");
    }
  }
  interCmd(selector) {
    if ( selector.selections.length != 1 ) {
      window.alert("Please select one segment!");
      return;
    }
    var seg = selector.selections[0];
    if ( !(seg instanceof SphSeg) ) {
      window.alert("Not segment!");
      return;
    }

    var theta = eval(window.prompt("angle to interpolate:"));
    if ( typeof theta != "number" && theta instanceof Number ) {
      window.alert("Not a number!");
      return;
    }
    if ( Number.isNaN(theta) ) {
      window.alert("Not a number!");
      return;
    }
    if ( theta > seg.length || theta < 0 ) {
      window.alert("Improper number!");
      return;
    }

    this.puzzle.interpolate(seg, theta);
    selector.reselect(seg, seg.next);
  }
  sliceCmd(selector) {
    if ( selector.selections.length > 1 ) {
      window.alert("Please select one segment or nothing!");
      return;
    }
    var seg = selector.selections[0];
    if ( seg !== undefined && !(seg instanceof SphSeg) ) {
      window.alert("Not segment!");
      return;
    }

    if ( seg ) {
      var circle = seg.circle;
      var center = circle.center;
      var radius = circle.radius;

    } else {
      var center = eval(window.prompt("center:"));
      if ( !Array.isArray(center) || center.length != 3 ) {
        window.alert("Not a vector!");
        return;
      }
      for ( let x of center ) {
        if ( typeof x != "number" && !(x instanceof Number) ) {
          window.alert("Not a number!");
          return;
        }
        if ( Number.isNaN(x) ) {
          window.alert("Not a number!");
          return;
        }
      }

      var radius = eval(window.prompt("radius:"));
      if ( typeof radius != "number" && !(radius instanceof Number) ) {
        window.alert("Not a number!");
        return;
      }
      if ( Number.isNaN(radius) ) {
        window.alert("Not a number!");
        return;
      }
    }

    var track = this.puzzle.slice(center, radius);
    if ( track )
      selector.select(track);
    else
      selector.reselect();
  }
  cleanCmd(selector) {
    selector.reselect();
    this.puzzle.clean();
    window.alert("finish!");
  }
  prepareCmd(selector) {
    this.puzzle.prepare();
    window.alert("finish!");
  }
  checkCmd(selector) {
    this.puzzle.check();
    console.log("check!");
  }

  structCmd(selector) {
    this.puzzle.structurize();
    this.puzzle.recognize();
  }
  assembleCmd(selector) {
    this.puzzle.assemble(selector.selections[0]);
  }
  unbandageCmd(selector) {
    if ( selector.selections.length != 1 ) {
      window.alert("Please select one joint!");
      return;
    }
    var joint = selector.selections[0];
    if ( !(joint instanceof SphJoint) ) {
      window.alert("Not joint!");
      return;
    }
    if ( joint.bandage.size == 1 ) {
      window.alert("No need to unbandage!");
      return;
    }

    var elem = this.puzzle.unbandage(joint);
    this.selector.select(elem);
  }
}

class SphPuzzleViewExplorer
{
  constructor(selector, puzzle) {
    this.selector = selector;
    this.puzzle = puzzle;

    function *subselector(it) {
      var arr = Array.from(it);
      const N = arr.length;
      if ( N == 0 ) return;

      var step;
      for ( let i=0; true; i=(i+step+N)%N ) {
        let sel = arr[i];
        selector.preselection = sel;
        step = yield;
        if ( step == 0 )
          return selector.replace(sel);
      }
    }

    var sel;
    selector.on("add", Object, event => sel = event.target);
    selector.on("remove", Object, event => sel = undefined);

    var options;
    window.addEventListener("keydown", event => {
      if ( !sel || event.repeat )
        return;

      if ( sel instanceof SphSeg ) {
        if ( event.key == "ArrowLeft" && !options ) {
          selector.preselection = sel.prev;
          options = undefined;
          event.preventDefault();

        } else if ( event.key == "ArrowRight" && !options ) {
          selector.preselection = sel.next;
          options = undefined;
          event.preventDefault();

        } else if ( event.key == "ArrowDown" ) {
          options = subselector(sel.adj.keys());
          options.next();
          event.preventDefault();

        } else if ( event.key == "ArrowUp" ) {
          options = subselector(sel.affiliation.fly());
          options.next();
          event.preventDefault();

        } else if ( event.key == "ArrowLeft" && options ) {
          options.next(-1);
          event.preventDefault();

        } else if ( event.key == "ArrowRight" && options ) {
          options.next(1);
          event.preventDefault();

        } else {
          options = undefined;
        }
      }

    });
    window.addEventListener("keyup", event => {
      if ( !sel )
        return;

      if ( sel instanceof SphSeg ) {
        if ( event.key == "ArrowLeft" && !options ) {
          selector.replace(sel.prev);
          event.preventDefault();

        } else if ( event.key == "ArrowRight" && !options ) {
          selector.replace(sel.next);
          event.preventDefault();

        } else if ( event.key == "ArrowDown" && options ) {
          options.next(0);
          options = undefined;
          event.preventDefault();

        } else if ( event.key == "ArrowUp" && options ) {
          options.next(0);
          options = undefined;
          event.preventDefault();
        }
      }
    });
  }
}


class SphPuzzleWorld
{
  constructor(puzzle, id_display, id_network, id_state) {
    this.puzzle = puzzle;
    this.selector = new Selector();

    // prop builder
    this.prop = new SphPuzzlePropBuilder(this.puzzle, this.selector);

    // panel
    this.panel = new Panel();

    var cmd_panel = this.panel.ctrls[this.panel.addFolder("commands")];
    this.cmd = new SphPuzzleWorldCmdMenu(cmd_panel, this.selector, this.puzzle);

    this.explorer = new SphPuzzleViewExplorer(this.selector, this.puzzle);

    // tree view
    var brep_panel = this.panel.ctrls[this.panel.addFolder("brep")];
    this.brep_tree = new SphBREPTreeViewPanel(brep_panel, this.puzzle.brep, this.prop);
    var net_panel = this.panel.ctrls[this.panel.addFolder("network")];
    this.net_tree = new SphNetworkTreeViewPanel(net_panel, this.puzzle.network, this.prop);

    var sel_panel = this.panel.ctrls[this.panel.addFolder("selections", false)];
    this.sel = new SelectPanel(sel_panel, this.selector, this.prop);
    var detail_panel = this.panel.ctrls[this.panel.addFolder("detail", true)];
    this.detail = new DetailPanel(detail_panel, this.selector, this.prop);

    // 3D view
    var dom_3D = document.getElementById(id_display);
    if ( dom_3D ) {
      this.display = new Display(dom_3D);
      this.brep_view = new SphBREPView(this.display, this.puzzle.brep, this.selector);
    }

    // network view
    var dom_net = document.getElementById(id_network);
    if ( dom_net ) {
      this.graph = new Graph(dom_net);
      this.network_view = new SphNetworkView(this.graph, this.puzzle.network, this.selector);
    }

    // state view
    var dom_state = document.getElementById(id_state);
    if ( dom_state ) {
      this.state_view = new SphStateView(dom_state, this.puzzle.network, this.selector);
    }
  }
}
