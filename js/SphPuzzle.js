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
  constructor(id, width, height) {
    var parent = document.getElementById(id);
    this.width = width;
    this.height = height;

    // renderer
    this.renderer = new THREE.WebGLRenderer({antialias:true});
    this.renderer.setSize(width, height);
    this.dom = this.renderer.domElement;
    parent.appendChild(this.dom);

    this.scene = new THREE.Scene();
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.3));
    this.scene.add(new THREE.AxesHelper(20));
    this.scene.add(this.buildBackground());

    // navigation control
    this.rotateSpeed = Math.PI/500;
    this.zoomSpeed = 1/100;
    this.distanceRange = [2, 8];
    this.trackball_lock = new Set();

    this.trackball = new THREE.Group();
    this.camera = new THREE.PerspectiveCamera(40, width/height, 1, 1000);
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
      let click_spot = {};

      this.dom.addEventListener("mousedown", event => {
        if ( !click_spot.object )
          click_spot = this.spotOn(event.offsetX, event.offsetY);
      }, false);
      this.dom.addEventListener("mousemove", event => {
        if ( click_spot.object ) {
          if ( Math.abs(event.movementX) > 1 || Math.abs(event.movementY) > 1 )
            click_spot = {};
        }
      }, false);
      this.dom.addEventListener("mouseup", event => {
        if ( click_spot.object ) {
          click_spot.object.dispatchEvent(event3D("click", event, click_spot));
          click_spot = {};
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
            target3D.dispatchEvent(event3D("dragstart", event, drag_spot));
            dragging = true;
          }

          if ( dragging )
            target3D.dispatchEvent(event3D("drag", event, {}));
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
    target.dispatchEvent({name:"objectadded", target, parent});
    this.hoverable = [];
    this.scene.traverse(e => { if ( e.userData.hoverable ) this.hoverable.push(e); });
  }
  remove(target, parent=this.scene) {
    parent.remove(target);
    target.dispatchEvent({name:"objectremoved", target, parent});
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
    var background_texture = new THREE.TextureLoader().load("background.png");
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
  constructor(id) {
    this.dom = document.getElementById(id);

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
  constructor(panel, selector) {
    this.panel = panel;
    this.prop_builders = [this];

    this.sel_panel = this.panel.ctrls[this.panel.addFolder("selections", true)];
    this.detail_panel = this.panel.ctrls[this.panel.addFolder("detail", true)];
    this._sels_id = [];

    this.initView(selector);
  }
  initView(selector) {
    selector.view = this;
    this.selector = selector;
    selector.on("add", Object, event => {
      this.addSel(event.index, event.target);
      this.setDetail(event.target);
    });
    selector.on("remove", Object, event => {
      this.removeSel(event.index);
      this.clearDetail();
    });
  }
  addPropBuilder(builder) {
    this.prop_builders.unshift(builder);
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
  prop(target, sel_mode) {
    return [];
  }

  addSel(index, target) {
    var property;
    for ( let builder of this.prop_builders )
      if ( property = builder.link(target, "focus") )
        break;
    this._sels_id[index] = this.sel_panel.add(property);
  }
  removeSel(index) {
    this.sel_panel.remove(this._sels_id[index]);
    this._sels_id.splice(index, 1);
  }

  setDetail(target) {
    var properties;
    for ( let builder of this.prop_builders )
      if ( properties = builder.prop(target, "replace") )
        break;
    properties.unshift({
      type: "button",
      name: `console.log(${target.name||"object"})`,
      callback: () => console.log(target)
    });
    this.detail_panel.clear();
    this.detail_panel.add(...properties);
  }
  clearDetail() {
    this.detail_panel.clear();
  }
}


class SphPuzzleView extends Listenable
{
  constructor(display, puzzle, selector) {
    super();

    this.display = display;
    this.selector = selector;

    this.selectOn = "segment";
    this.hover_handler = event => {
      if ( event.type == "mouseenter" ) {
        var seg = event.target.parent.userData.origin;
        switch ( this.selectOn ) {
          case "segment":
            this.selector.preselection = seg;
            break;
          case "element":
            this.selector.preselection = seg.affiliation;
            break;
          case "track":
            this.selector.preselection = seg.track;
            break;
        }
    
      } else { // mouseleave
        this.selector.preselection = undefined;
      }
    };
    this.select_handler = event =>
      event.originalEvent.ctrlKey ? this.selector.toggle() : this.selector.select();

    this.root = new THREE.Object3D();
    this.display.add(this.root);

    // draw ball
    {
      let geo = new THREE.IcosahedronGeometry(0.999, 5);
      let mat = new THREE.MeshLambertMaterial({color:0xffffff});
      this.ball = new THREE.Mesh(geo, mat);

      this.ball.userData.hoverable = true;
      this.ball.addEventListener("click", this.select_handler);

      this.display.add(this.ball, this.root);
    }

    this.initProp(puzzle);
    this.initView(puzzle);

    this.display.animate(this.hoverRoutine());
  }

  // additional properties
  initProp(puzzle) {
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

    puzzle.name = puzzle.name || "SphPuzzle";
    for ( let elem of puzzle.elements ) {
      initElemNameProp(elem);
      initColorProp(elem);
      for ( let seg of elem.boundaries )
        initSegNameProp(seg);
    }
    for ( let track of puzzle.tracks )
      initTrackNameProp(track);

    puzzle.on("added", SphElem, event => {
      this.initElemNameProp(event.target);
      this.initColorProp(event.target);
      for ( let seg of event.target.boundaries )
        this.initSegNameProp(seg);
    });
    puzzle.on("added", SphTrack, event => {
      initTrackNameProp(event.target);
    });
    puzzle.on("modified", SphElem, event => {
      for ( let seg of event.target.boundaries )
        if ( !seg.name )
          initSegNameProp(seg);
    });
  }

  // 3D view
  initView(puzzle) {
    puzzle.view = this;
    this.origin = puzzle;
    for ( let element of puzzle.elements )
      this.drawElement(element);

    puzzle.on("added", SphElem, event => this.drawElement(event.target));
    puzzle.on("removed", SphElem, event => this.eraseElement(event.target));
    puzzle.on("modified", SphElem, event => {
      this.eraseElement(event.target);
      this.drawElement(event.target);
    });
    puzzle.on("rotated", SphElem, event => {
      for ( let seg of event.target.boundaries )
        seg.view.quaternion.set(...seg.orientation);
    });
    puzzle.on("recolored", SphElem, event => {
      for ( let seg of event.target.boundaries )
        for ( let sub of seg.view.children )
          sub.material.color.set(event.target.color);
    });
  }
  buildSegView(seg, color, dq=0.01) {
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
      holder.addEventListener("mouseenter", this.hover_handler);
      holder.addEventListener("mouseleave", this.hover_handler);
      holder.addEventListener("click", this.select_handler);
    }

    var obj = new THREE.Object3D();
    obj.add(arc, dash, ang, holder);
    obj.quaternion.set(...seg.orientation);

    return obj;
  }
  drawElement(element) {
    var obj = new THREE.Object3D();
    for ( let seg of element.boundaries ) {
      let subobj = this.buildSegView(seg, element.color);
      seg.view = subobj;
      subobj.userData.origin = seg;
      obj.add(subobj);
    }

    element.view = obj;
    obj.userData.origin = element;
    this.display.add(element.view, this.root);
    this.trigger("drawn", element.view);
  }
  eraseElement(element) {
    this.display.remove(element.view, this.root);
    delete element.view;
    this.trigger("erased", element.view);
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

  // prop view
  link(target, sel_mode, name=target.name) {
    if ( !(target instanceof SphElem)
         && !(target instanceof SphSeg) && !(target instanceof SphTrack) )
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

    return detail;
  }
}

class SphNetworkView extends Listenable
{
  constructor(graph, network, selector) {
    super();

    this.graph = graph;
    this.selector = selector;

    this.graph.view.on("click", event => {
      if ( network.status == "broken" )
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
      if ( network.status == "broken" )
        return;

      var target = event.target && event.target.origin;
      if ( target instanceof SphKnot || target instanceof SphJoint )
        this.selector.preselection = target;
      else
        this.selector.preselection = undefined;
    });
    this.graph.view.on("blurNode", event => {
      if ( network.status == "broken" )
        return;
      this.selector.preselection = undefined;
    });

    this.initProp(network);
    this.initView(network);

    animate(this.hoverRoutine());
  }

  // additional properties
  initProp(network) {
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

  // network view
  initView(network) {
    network.view = this;
    this.origin = network;
    for ( let knot of network.knots )
      this.drawKnot(knot);
    for ( let joint of network.joints )
      this.drawJoint(joint);
    var bandages = network.joints.map(j => j.bandage).filter(b => b.length > 1);
    for ( let bandage of new Set(bandages) )
      this.groupJoints(bandage);
    
    network.on("statuschanged", SphNetwork, event => {
      if ( this.origin.status == "broken" )
        this.graph.disable();
      else
        this.graph.enable();
    });
    network.on("added", SphKnot, event => {
      if ( this.origin.status == "broken" )
        return;
      this.drawKnot(event.target);
    });
    network.on("added", SphJoint, event => {
      if ( this.origin.status == "broken" )
        return;
      this.drawJoint(event.target);
    });
    network.on("removed", Object, event => {
      if ( this.origin.status == "broken" )
        return;
      this.eraseNode(event.target);
    });
    network.on("modified", SphJoint, event => {
      if ( this.origin.status == "broken" )
        return;
      this.updateJoint(event.target);
    });
    network.on("binded", SphJoint, event => {
      if ( this.origin.status == "broken" )
        return;
      this.groupJoints(event.bandage);
    });
    network.on("unbinded", SphJoint, event => {
      if ( this.origin.status == "broken" )
        return;
      this.ungroupJoint(event.target);
    });
  }
  drawKnot(knot) {
    knot.node_id = this.graph.addNode({size:20, shape:"diamond", origin:knot});
    this.trigger("nodedrawn", this.graph.getNode(knot.node_id));
  }
  drawJoint(joint) {
    joint.node_id = this.graph.addNode({size:5, shape:"dot", origin:joint});
    this.trigger("nodedrawn", this.graph.getNode(joint.node_id));

    for ( let knot of joint.ports.keys() ) {
      let edge_id = this.graph.addEdge(joint.node_id, knot.node_id);
      this.trigger("edgedrawn", this.graph.getEdge(edge_id));
    }
  }
  updateJoint(joint) {
    for ( let edge of this.graph.edgesBetween(joint.node_id, undefined) ) {
      this.graph.removeEdge(edge.id);
      this.trigger("edgeerased", edge);
    }
    for ( let knot of joint.ports.keys() ) {
      let edge_id = this.graph.addEdge(joint.node_id, knot.node_id);
      this.trigger("edgedrawn", this.graph.getEdge(edge_id));
    }
  }
  groupJoints(bandage) {
    var nodes = bandage.map(joint => this.graph.getNode(joint.node_id));

    var bandage_id;
    for ( let node of nodes ) if ( node.bandage ) {
      bandage_id = node.bandage;
      break;
    }
    if ( !bandage_id )
      bandage_id = this.graph.addNode({size:0, shape:"dot"});

    for ( let node of nodes ) if ( !node.bandage ) {
      this.graph.addEdge(bandage_id, node.id, {dashes:true});
      this.graph.updateNode(node.id, {bandage:bandage_id});
    }
  }
  ungroupJoint(joint) {
    for ( let edge of this.graph.edgesBetween(undefined, joint.node_id) ) {
      this.graph.removeEdge(edge.id);
      this.graph.updateNode(joint.node_id, {bandage:undefined});
    }
  }
  eraseNode(target) {
    var node = this.graph.getNode(target.node_id);

    for ( let edge_id of this.graph.edgesBetween(target.node_id, undefined) ) {
      let edge = this.graph.getEdge(edge_id);
      this.graph.removeEdge(edge_id);
      this.trigger("edgeerased", edge);
    }
    for ( let edge_id of this.graph.edgesBetween(undefined, target.node_id) ) {
      let edge = this.graph.getEdge(edge_id);
      this.graph.removeEdge(edge_id);
      this.trigger("edgeerased", edge);
    }

    this.graph.removeNode(target.node_id);
    delete target.node_id;
    this.trigger("nodeerased", node);
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

  // prop view
  link(target, sel_mode, name=target.name) {
    if ( !(target instanceof SphKnot) && !(target instanceof SphJoint) )
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
  prop(target) {
    if ( target instanceof SphKnot )
      return this.makeKnotProperties(target);
    else if ( target instanceof SphJoint )
      return this.makeJointProperties(target);
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

class SphStateView
{
  constructor(container_id, network, selector) {
    this.network = network;
    this.selector = selector;

    document.body.appendChild(css`
      .state-tab {
        display: none;
      }
      .state-tab.show {
        display: block;
      }
      .broken * {
        color: gray;
      }
      .outdated .state-name::after {
        content: "*";
      }
      .emphasized {
        font-weight: bold;
      }
      .highlighted {
        outline: 1px dashed gray;
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
      .dragging {
        opacity: 0.3;
      }
    `);
    this.container = document.getElementById(container_id);

    this.initView(network);

    animate(this.hoverRoutine());
  }

  // tab view
  initView(network) {
    for ( let knot of network.knots )
      this.drawTab(knot);
    network.on("added", SphKnot, event => this.drawTab(event.target));
    network.on("removed", SphKnot, event => this.eraseTab(event.target));
    this.selector.on("add", SphKnot, event => this.showTab(event.target));
    network.on("statuschanged", SphNetwork, event => {
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
    var network = this.network;

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
          if ( network.status == "broken" )
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
          if ( network.status == "broken" )
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
          knot.host.setStatus("outdated", knot);
        });

        item.addEventListener("mouseenter", event => {
          if ( this.network.status == "broken" )
            return;
          var j = Array.from(event.target.parentNode.children).indexOf(event.target);
          this.selector.preselection = knot.jointAt([i,j]) || knot.segmentAt([i,j]).affiliation;
        });
        item.addEventListener("mouseleave", () => this.selector.preselection=undefined);
        item.addEventListener("click", event => {
          if ( this.network.status == "broken" )
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
        });

        list.appendChild(item);
      }

      res.push(list);
    }
    return res;
  }
  drawTab(knot) {
    var tab = document.createElement("div");
    tab.classList.add("state-tab");

    var title = document.createElement("h3");
    title.classList.add("state-name");
    title.textContent = knot.name;
    tab.appendChild(title);

    for ( let list of this.makeParamTable(knot) )
      tab.appendChild(list);
    knot.tab = tab;
    tab.origin = knot;
    this.container.appendChild(tab);

    this.showTab(knot);
  }
  eraseTab(knot) {
    this.container.removeChild(knot.tab);
  }
  showTab(knot) {
    for ( let tab of this.container.querySelectorAll(".state-tab.show") )
      tab.classList.remove("show");
    knot.tab.classList.add("show");
  }

  getItem(knot, [i,j]) {
    return knot.tab.querySelector(`div.list:nth-of-type(${i+1})>div.item:nth-of-type(${j+1})`);
  }
  itemsOf(target) {
    if ( target instanceof SphSeg ) {
      for ( let [knot, index] of this.network.indicesOf(target) )
        return [this.getItem(knot, index)];
      console.assert(false);

    } else if ( target instanceof SphElem ) {
      let res = [];
      for ( let [knot, index] of this.network.indicesOf(target) )
        res.push(this.getItem(knot, index));
      console.assert(res.length);
      return res;

    } else if ( target instanceof SphJoint ) {
      let res = [];
      for ( let [knot, index] of this.network.indicesOf(target) )
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

      if ( this.network.status == "broken" )
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

class SphPuzzleTreeViewPanel
{
  constructor(panel, puzzle, prop_builder) {
    this.panel = panel;
    this.puzzle = puzzle;
    this.prop_builder = prop_builder;

    this.elements = this.panel.ctrls[this.panel.addFolder("elements")];
    this.tracks = this.panel.ctrls[this.panel.addFolder("tracks")];

    this.data = new Map();

    for ( let elem of this.puzzle.elements )
      this.addElem(elem);
    for ( let track of this.puzzle.tracks )
      this.addTrack(track);

    this.puzzle.on("added", SphElem, event => this.addElem(event.target));
    this.puzzle.on("added", SphTrack, event => this.addTrack(event.target));
    this.puzzle.on("removed", SphElem, event => this.removeElem(event.target));
    this.puzzle.on("removed", SphTrack, event => this.removeTrack(event.target));
  }

  addElem(elem) {
    var id = this.elements.add(this.prop_builder.link(elem, "select"));
    this.data.set(elem, id);
  }
  addTrack(track) {
    var id = this.tracks.add(this.prop_builder.link(track, "select"));
    this.data.set(track, id);
  }
  removeElem(elem) {
    var id = this.data.get(elem);
    this.elements.remove(id);
  }
  removeTrack(track) {
    var id = this.data.get(track);
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

    for ( let knot of this.network.knots )
      this.addKnot(knot);
    for ( let joint of this.network.joints )
      this.addJoint(joint);

    this.network.on("added", SphKnot, event => this.addKnot(event.target));
    this.network.on("added", SphJoint, event => this.addJoint(event.target));
    this.network.on("removed", SphKnot, event => this.removeKnot(event.target));
    this.network.on("removed", SphJoint, event => this.removeJoint(event.target));
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
    this.knots.remove(id);
  }
  removeJoint(joint) {
    var id = this.data.get(joint);
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

    // this.addCmd(this.NextOfCmd.bind(this), "", "right");
    // this.addCmd(this.PrevOfCmd.bind(this), "", "left");
    // this.addCmd(this.AdjOfCmd.bind(this), "", "down");
    // this.addCmd(this.AffOfCmd.bind(this), "", "up");
    // this.addCmd(this.TrackOfCmd.bind(this), "", "tab");

    this.addCmd(this.mergeCmd.bind(this), "merge (shift+M)", "shift+M");
    this.addCmd(this.interCmd.bind(this), "inter (shift+I)", "shift+I");
    this.addCmd(this.sliceCmd.bind(this), "slice (shift+S)", "shift+S");
    this.addCmd(this.cleanCmd.bind(this), "clean (shift+C)", "shift+C");
    this.addCmd(this.alignCmd.bind(this), "align (shift+A)", "shift+A");
    this.addCmd(this.twistCmd.bind(this), "twist (shift+T)", "shift+T");
    this.addCmd(this.checkCmd.bind(this), "check");

    this.addCmd(this.structCmd.bind(this), "structurize (shift+X)", "shift+X");
    this.addCmd(this.unbandageCmd.bind(this), "unbandage");
  }

  NextOfCmd(selector) {
    var sel = selector.selections[selector.selections.length-1];
    if ( !sel || !(sel instanceof SphSeg) )
      return;
    selector.replace(sel.next);
  }
  PrevOfCmd(selector) {
    var sel = selector.selections[selector.selections.length-1];
    if ( !sel || !(sel instanceof SphSeg) )
      return;
    selector.replace(sel.prev);
  }
  AdjOfCmd(selector) {
    var sel = selector.selections[selector.selections.length-1];
    if ( !sel || !(sel instanceof SphSeg) )
      return;
    selector.replace(sel.adj.keys().next().value);
  }
  AffOfCmd(selector) {
    var sel = selector.selections[selector.selections.length-1];
    if ( !sel || !(sel instanceof SphSeg) )
      return;
    selector.replace(sel.affiliation);
  }
  TrackOfCmd(selector) {
    var sel = selector.selections[selector.selections.length-1];
    if ( !sel || !(sel instanceof SphSeg) )
      return;
    selector.replace(sel.track);
  }

  mergeCmd(selector) {
    if ( selector.selections.length == 1 ) {
      let knot = selector.selections[0];
      if ( !(knot instanceof SphKnot) ) {
        window.alert("Not knot!");
        return;
      }

      this.selector.reselect();
      this.puzzle.trim(knot);

    } else if ( selector.selections.length == 2 ) {
      var [seg1, seg2] = selector.selections;
      if ( !(seg1 instanceof SphSeg) || !(seg2 instanceof SphSeg) ) {
        window.alert("Not segment!");
        return;
      }

      if ( seg1.affiliation !== seg2.affiliation ) {
        selector.reselect();
        this.puzzle.mergeElements(seg1.affiliation, seg2.affiliation);
        selector.reselect(seg1, seg2);

      } else if ( seg1.adj.has(seg2) ) {
        selector.reselect();
        this.puzzle.mergeEdge(seg1, seg2);

      } else if ( seg1.next === seg2 || seg2.next === seg1 ) {
        if ( seg1.next === seg2 ) seg1 = seg2;
        if ( seg1 === seg1.prev || !this.puzzle.analyzer.isTrivialVertex(seg1) ) {
          window.alert("Cannot merge!");
          return;
        }

        selector.reselect();
        let prev = seg1.prev;
        this.puzzle.mergeVertex(seg1);
        selector.select(prev);

      } else {
        window.alert("merge what?");
      }

    } else {
      window.alert("Please select two segments or one knot!");

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
  checkCmd(selector) {
    this.puzzle.check();
    console.log("check!");
  }
  alignCmd(selector) {
    if ( selector.selections.length != 1 && selector.selections.length != 2 ) {
      window.alert("Please select one or two segments!");
      return;
    }
    var [seg1, seg2] = selector.selections;
    if ( !(seg1 instanceof SphSeg) || seg2 && !(seg2 instanceof SphSeg) ) {
      window.alert("Not segments!");
      return;
    }

    if ( seg2 ) {
      if ( !seg1.track || seg1.track !== seg2.track ) {
        window.alert("Cannot align segmets!");
        return;
      }
      if ( seg1.track.outer.includes(seg1) )
        [seg1, seg2] = [seg2, seg1];
      
      var offset0 = seg1.track.shift;
      var [,, offset1] = seg1.track.indexOf(seg1);
      var [,, offset2] = seg1.track.indexOf(seg2);
      var theta = offset0-offset1-offset2;

    } else {
      if ( !seg1.track ) {
        window.alert("Cannot align segmets!");
        return;
      }

      var theta = eval(window.prompt("angle to twist"));
      if ( typeof theta != "number" && theta instanceof Number ) {
        window.alert("Not a number!");
        return;
      }
      if ( Number.isNaN(theta) ) {
        window.alert("Not a number!");
        return;
      }
    }

    var hold = seg1.adj.keys().next().value.affiliation;
    this.puzzle.twist(seg1.track, theta, hold);
  }
  twistCmd(selector) {
    if ( selector.selections.length != 1 ) {
      window.alert("Please select one track!");
      return;
    }
    var track = selector.selections[0];
    if ( !(track instanceof SphTrack) ) {
      window.alert("Not track!");
      return;
    }

    var passwords = this.puzzle.analyzer.decipher(track);
    var keys = Array.from(passwords.keys()).sort();
    var q = "select shift:\n"
            + keys.map((key, i) => `${i}: ${key}`).join(",\n")
            + `.\n (current: ${track.shift})`;
    var i = parseInt(window.prompt(q));
    if ( typeof i != "number" && i instanceof Number ) {
      window.alert("Not a number!");
      return;
    }
    if ( Number.isNaN(i) ) {
      window.alert("Not a number!");
      return;
    }
    if ( i >= keys.length || i < 0 ) {
      window.alert("Improper index!");
      return;
    }

    var theta = this.puzzle.analyzer.mod4(keys[i]-track.shift);
    var hold = track.outer[0].affiliation;
    this.puzzle.twist(track, theta, hold);
  }

  structCmd(selector) {
    this.puzzle.structurize();
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


class SphPuzzleWorld
{
  constructor(puzzle, id_display, id_network, id_state) {
    this.puzzle = puzzle;
    this.selector = new Selector();


    // 3D view
    var dom = document.getElementById(id_display);
    var display = new Display(id_display, dom.clientWidth, dom.clientHeight);
    new SphPuzzleView(display, this.puzzle, this.selector);

    // network view
    var graph = new Graph(id_network);
    new SphNetworkView(graph, this.puzzle.network, this.selector);

    this.state = new SphStateView(id_state, this.puzzle.network, this.selector);

    // panel
    this.panel = new Panel();

    var cmd_panel = this.panel.ctrls[this.panel.addFolder("commands")];
    this.cmd = new SphPuzzleWorldCmdMenu(cmd_panel, this.selector, this.puzzle);
    
    // var pzl_panel = this.panel.ctrls[this.panel.addFolder("puzzle")];
    // this.pzl_tree = new SphPuzzleTreeViewPanel(pzl_panel, this.puzzle, this.puzzle.view);
    // var net_panel = this.panel.ctrls[this.panel.addFolder("network")];
    // this.net_tree = new SphNetworkTreeViewPanel(net_panel, this.puzzle.network, this.puzzle.network.view);

    var sel_panel = this.panel.ctrls[this.panel.addFolder("select", true)];
    sel_panel.gui.add(this.puzzle.view, "selectOn", ["segment", "element", "track"]).name("select on");
    this.sel = new SelectPanel(sel_panel, this.selector);
    this.sel.addPropBuilder(this.puzzle.view);
    this.sel.addPropBuilder(this.puzzle.network.view);
  }
}
