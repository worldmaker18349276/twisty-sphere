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
  constructor(gui=new dat.GUI()) {
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

class Diagram
{
  constructor(id) {
    this.dom = document.getElementById(id);

    this.nodes_options = new vis.DataSet();
    this.edges_options = new vis.DataSet();
    this.view = new vis.Network(
      this.dom,
      {nodes:this.nodes_options, edges:this.edges_options},
      {
        physics: true,
        nodes: {chosen:false}, edges: {chosen:false},
        interaction: {selectable:false, selectConnectedEdges:false,
                      hover:true, hoverConnectedEdges:false}
      }
    );

    this.nodes = new Map();
    this.edges = new Map();
    this.numbers = (function *numbers() {
      var i = 0; while ( true ) if ( yield i++ ) i = -1;
    })();

    var make_target = event => { event.target = this.getKeyAt(event.pointer.DOM); };
    this.view.on("click", make_target);
    this.view.on("hoverNode", make_target);
    this.view.on("blurNode", make_target);
  }

  getKeyAt(vec) {
    var id = this.view.getNodeAt(vec);
    if ( id === undefined )
      return;
    return this.getKey(id);
  }
  getNodeOptions(key) {
    var id = this.nodes.get(key);
    if ( id === undefined )
      return;
    return this.nodes_options.get(id);
  }
  getEdgeOptions(key) {
    var id = this.edges.get(key);
    if ( id === undefined )
      return;
    return this.edges_options.get(id);
  }
  addNode(key, options={}) {
    var id = this.nodes.get(key);
    if ( id !== undefined )
      this.removeNode(key);
    else
      id = this.numbers.next().value;

    this.nodes.set(key, id);
    this.nodes_options.add(Object.assign({id}, options));
    return key;
  }
  addEdge(key_from, key_to, key=[key_from, key_to], options={}) {
    var from = this.nodes.get(key_from);
    var to = this.nodes.get(key_to);
    if ( from === undefined || to === undefined )
      throw new Error();

    var id = this.edges.get(key);
    if ( id !== undefined )
      this.removeEdge(key);
    else
      id = this.numbers.next().value;

    this.edges.set(key, id);
    this.edges_options.add(Object.assign({id, from, to}, options));
    return key;
  }
  updateNodeOptions(key, patch={}) {
    var id = this.nodes.get(key);
    if ( id === undefined )
      return;

    var options = this.nodes_options.get(id);
    this.nodes_options.update(Object.assign(options, patch, {id}));
  }
  updateEdgeOptions(key, patch={}) {
    var id = this.edges.get(key);
    if ( id === undefined )
      return;

    var options = this.edges_options.get(id);
    this.edges_options.update(Object.assign(options, patch, {id}));
  }
  removeNode(key) {
    var id = this.nodes.get(key);
    if ( id === undefined )
      return;

    this.nodes.delete(key);
    this.nodes_options.remove(id);
    if ( this.nodes.size == 0 && this.edges.size == 0 )
      this.numbers.next(true);
  }
  removeEdge(key) {
    var id = this.edges.get(key);
    if ( id === undefined )
      return;

    this.edges.delete(key);
    this.edges_options.remove(id);
    if ( this.nodes.size == 0 && this.edges.size == 0 )
      this.numbers.next(true);
  }

  getKey(id) {
    for ( let [key, id_] of this.nodes )
      if ( id == id_ )
        return key;
    for ( let [key, id_] of this.edges )
      if ( id == id_ )
        return key;
  }
  *edgesBetween(key_from, key_to) {
    var from = key_from && this.nodes.get(key_from);
    var to = key_to && this.nodes.get(key_to);
    for ( let [key, id] of this.edges ) {
      let options = this.edges_options.get(id);
      if ( key_from === undefined || options.from == from )
        if ( key_to === undefined || options.to == to )
          yield key;
    }
  }

  emphasizeNode(key) {
    this.updateNodeOptions(key, {color:{background:"#D2E5FF"}});
  }
  unemphasizeNode(key) {
    this.updateNodeOptions(key, {color:{background:"#97C2FC"}});
  }
  highlightNode(key) {
    this.updateNodeOptions(key, {borderWidth:2});
  }
  unhighlightNode(key) {
    this.updateNodeOptions(key, {borderWidth:1});
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
    this.selector = selector;
    this.prop_builders = [this];

    this.sel_panel = this.panel.ctrls[this.panel.addFolder("selections", true)];
    this.detail_panel = this.panel.ctrls[this.panel.addFolder("detail", true)];

    this._sels_id = [];
    this.selector.on("add", Object, event => {
      this.addSel(event.index, event.target);
      this.setDetail(event.target);
    });
    this.selector.on("remove", Object, event => {
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


class SphPuzzleView
{
  constructor(display, puzzle, selector) {
    this.display = display;
    this.puzzle = puzzle;
    this.selector = selector;

    // add additional properties
    {
      let colors = (function *colors() {
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
      let elem_id = (function *numbers() {
        var i = 0; while ( true ) yield `SphElem${i++}`;
      })();
      let seg_id = (function *numbers() {
        var i = 0; while ( true ) yield `SphSeg${i++}`;
      })();
      let track_id = (function *numbers() {
        var i = 0; while ( true ) yield `SphTrack${i++}`;
      })();

      this.puzzle.name = "SphPuzzle";
      for ( let elem of puzzle.elements ) {
        elem.name = elem.name || elem_id.next().value;
        elem.color = elem.color || colors.next().value;
        for ( let seg of elem.boundaries )
          seg.name = seg.name || seg_id.next().value;
      }
      for ( let track of puzzle.tracks )
        track.name = track.name || track_id.next().value;

      this.puzzle.on("added", SphElem, event => {
        event.target.name = event.target.name || elem_id.next().value;
        event.target.color = event.target.color || colors.next().value;
        for ( let seg of event.target.boundaries )
          seg.name = seg.name || seg_id.next().value;
      });
      this.puzzle.on("added", SphTrack, event => {
        event.target.name = event.target.name || track_id.next().value;
      });
      this.puzzle.on("modified", SphElem, event => {
        for ( let seg of event.target.boundaries )
          seg.name = seg.name || seg_id.next().value;
      });
    }

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

    // draw puzzle
    {
      for ( let element of this.puzzle.elements )
        this.drawElement(element);

      this.puzzle.on("added", SphElem, event =>
        this.drawElement(event.target));
      this.puzzle.on("removed", SphElem, event =>
        this.display.remove(event.target.view, this.root));
      this.puzzle.on("modified", SphElem, event => {
        this.display.remove(event.target.view, this.root);
        this.drawElement(event.target);
        this.refresh = true;
      });
      this.puzzle.on("rotated", SphElem, event => {
        for ( let obj of event.target.view.children )
          obj.quaternion.set(...obj.userData.origin.orientation);
      });
      this.puzzle.on("recolored", SphElem, event => {
        for ( let obj of event.target.view.children )
          for ( let sub of obj.children )
            sub.material.color.set(event.target.color);
      });
    }

    this.refresh = false;
    this.display.animate(this.hoverRoutine());
  }

  setName(target, name) {
    target.name = name;
    target.host.trigger("renamed", target);
  }
  setColor(element, color) {
    element.color = color;
    element.host.trigger("recolored", element);
  }

  // 3D view
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
    }

    var obj = new THREE.Object3D();
    obj.add(arc, dash, ang, holder);
    obj.quaternion.set(...seg.orientation);
    obj.userData.origin = seg;

    return obj;
  }
  drawElement(element) {
    element.view = new THREE.Object3D();
    for ( let seg of element.boundaries ) {
      let obj = this.buildSegView(seg, element.color);
      seg.view = obj;

      let holder = obj.children[3];
      holder.userData.hoverable = true;
      holder.addEventListener("mouseenter", this.hover_handler);
      holder.addEventListener("mouseleave", this.hover_handler);
      holder.addEventListener("click", this.select_handler);

      element.view.add(obj);
    }
    this.display.add(element.view, this.root);
  }

  segsOf(target) {
    if ( target instanceof SphSeg ) {
      return [target];

    } else if ( target instanceof SphElem ) {
      return Array.from(target.boundaries);

    } else if ( target instanceof SphTrack ) {
      return [...target.inner, ...target.outer];

    } else if ( target instanceof SphState ) {
      return Array.from(target.mold.items(target.segments)).map(a => a[1]);

    } else if ( target instanceof SphJoint ) {
      return Array.from(target.ports.keys())
                  .map(state => state.get(state.indexOf(target)))
                  .flatMap(seg => Array.from(this.puzzle.analyzer.walk(seg)));

    } else {
      return [];
    }
  }
  emphasize(seg) {
    if ( seg.view ) {
      seg.view.children[0].material.linewidth = 2;
      seg.view.children[1].material.linewidth = 2;
      return true;
    }
  }
  unemphasize(seg) {
    if ( seg.view ) {
      seg.view.children[0].material.linewidth = 1;
      seg.view.children[1].material.linewidth = 1;
      return true;
    }
  }
  highlight(seg) {
    if ( seg.view ) {
      seg.view.children[3].material.opacity = 0.3;
      return true;
    }
  }
  unhighlight(seg) {
    if ( seg.view ) {
      seg.view.children[3].material.opacity = 0;
      return true;
    }
  }
  *hoverRoutine() {
    var preselection = undefined;
    var selections = [];
    while ( true ) {
      yield;

      // emphasize hovered object
      if ( this.refresh || this.selector.preselection !== preselection ) {
        for ( let seg of this.segsOf(preselection) ) if ( seg )
          this.unemphasize(seg);
        for ( let seg of this.segsOf(this.selector.preselection) ) if ( seg )
          this.emphasize(seg);
        preselection = this.selector.preselection;
      }

      // highlight selected objects
      let new_selections = this.selector.selections
        .flatMap(sel => this.segsOf(sel));

      for ( let sel of selections )
        if ( this.refresh || !new_selections.includes(sel) )
          this.unhighlight(sel);
      for ( let sel of new_selections )
        if ( this.refresh || !selections.includes(sel) )
          this.highlight(sel);

      selections = new_selections;
      this.refresh = false;
    }
  }

  // prop view
  link(target, sel_mode, name=target.name) {
    if ( !(target instanceof SphPuzzle) && !(target instanceof SphElem)
         && !(target instanceof SphSeg) && !(target instanceof SphTrack) )
      return;

    var property = {type: "button", name: name};
    if ( !(target instanceof SphPuzzle) ) {
      property.mouseenter = () => this.selector.preselection = target;
      property.mouseleave = () => this.selector.preselection = undefined;
    }

    if ( sel_mode == "replace" )
      property.callback = () => this.selector.replace(target);
    else if ( sel_mode == "focus" )
      property.callback = () => this.selector.focus(target);
    else
      property.callback = () => this.selector.select(target);

    return property;
  }
  prop(target, sel_mode) {
    if ( target instanceof SphPuzzle )
      return this.makePuzzleProperties(target, sel_mode);
    else if ( target instanceof SphElem )
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
      set: color => this.setColor(elem, color)
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
      set: color => this.setColor(seg.affiliation, color)
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

class SphNetworkView
{
  constructor(diagram, network, selector) {
    this.diagram = diagram;
    this.network = network;
    this.selector = selector;

    {
      for ( let state of network.states )
        this.drawState(state);
      for ( let joint of network.joints ) {
        this.drawJoint(joint);
        for ( let state of joint.ports.keys() )
          this.drawFusion(joint, state);
      }
      var bandages = network.joints.map(j => j.bandage).filter(b => b.size > 1);
      for ( let bandage of new Set(bandages) ) {
        let joint0 = bandage.values().next().value;
        let id = this.diagram.nodes.get(joint0);
        for ( let joint of bandage )
          this.diagram.updateNodeOptions(joint, {bandage:id});
      }
      
      network.on("added", Object, event => {
        if ( this.outdated )
          return;
        if ( event.target instanceof SphState )
          this.drawState(event.target);
        else if ( event.target instanceof SphJoint )
          this.drawJoint(event.target);
      });
      network.on("removed", Object, event => {
        if ( this.outdated )
          return;
        this.eraseNode(event.target);
      });
      network.on("fused", SphJoint, event => {
        if ( this.outdated )
          return;
        this.drawFusion(event.target, event.state);
      });
      network.on("unfused", SphJoint, event => {
        if ( this.outdated )
          return;
        this.eraseFusion(event.target, event.state);
      });
      network.on("binded", SphJoint, event => {
        if ( this.outdated )
          return;
        var id = this.diagram.nodes.get(event.target);
        for ( let joint of event.bandage )
          this.diagram.updateNodeOptions(joint, {bandage:id});
      });
      network.on("unbinded", SphJoint, event => {
        if ( this.outdated )
          return;
        this.diagram.updateNodeOptions(event.target, {bandage:undefined});
      });
    }

    this.diagram.view.on("click", event => {
      if ( network.outdated )
        return;
      if ( event.event.srcEvent.ctrlKey ) {
        if ( event.target instanceof SphState || event.target instanceof SphJoint )
          this.selector.toggle(event.target);
      } else {
        if ( event.target instanceof SphState || event.target instanceof SphJoint )
          this.selector.select(event.target);
        else
          this.selector.reselect();
      }
    });
    this.diagram.view.on("hoverNode", event => {
      if ( network.outdated )
        return;
      if ( event.target instanceof SphState || event.target instanceof SphJoint )
        this.selector.preselection = event.target;
      else
        this.selector.preselection = undefined;
    });
    this.diagram.view.on("blurNode", event => {
      if ( network.outdated )
        return;
      this.selector.preselection = undefined;
    });

    var updater = this.update();
    var routine = () => (requestAnimationFrame(routine), updater.next());
    requestAnimationFrame(routine);
  }

  // network view
  drawState(state) {
    this.diagram.addNode(state, {size:20, shape:"diamond"});
    state.name = state.name || `state${this.diagram.nodes.get(state)}`;
  }
  drawJoint(joint) {
    this.diagram.addNode(joint, {size:5, shape:"dot"});
    joint.name = joint.name || `joint${this.diagram.nodes.get(joint)}`;
  }
  eraseNode(target) {
    this.diagram.removeNode(target);
  }
  drawFusion(target1, target2) {
    this.diagram.addEdge(target1, target2);
  }
  eraseFusion(target1, target2) {
    var key = this.diagram.edgesBetween(target1, target2).next().value;
    if ( key === undefined )
      return;
    this.diagram.removeEdge(key);
  }

  nodeOf(target) {
    if ( target instanceof SphState ) {
      return target;

    } else if ( target instanceof SphJoint ) {
      return target;

    } else if ( target instanceof SphElem ) {
      for ( let joint of this.network.joints )
        for ( let state of joint.ports.keys() )
          if ( state.get(state.indexOf(joint)).affiliation === target )
            return joint;
      for ( let state of this.network.states )
        for ( let seg of state.segments.flat(2) )
          if ( seg.affiliation === target )
            return state;

    } else if ( target instanceof SphSeg ) {
      for ( let state of this.network.states )
        if ( state.indexOf(target) )
          return state;

    } else if ( target instanceof SphTrack ) {
      for ( let state of this.network.states )
        if ( state.indexOf(target.inner[0]) )
          return state;
    }
  }
  *update() {
    var preselection = undefined;
    var selections = [];
    while ( true ) {
      yield;

      if ( this.network.outdated )
        continue;

      // emphasize hovered object
      if ( this.selector.preselection !== preselection ) {
        let node;
        if ( node = this.nodeOf(preselection) )
          this.diagram.unemphasizeNode(node);
        if ( node = this.nodeOf(this.selector.preselection) )
          this.diagram.emphasizeNode(node);
        preselection = this.selector.preselection;
      }

      // highlight selected objects
      var new_selections = this.selector.selections
        .map(sel => this.nodeOf(sel)).filter(sel => sel);

      for ( let sel of selections )
        if ( !new_selections.includes(sel) )
          this.diagram.unhighlightNode(sel);
      for ( let sel of new_selections )
        if ( !selections.includes(sel) )
          this.diagram.highlightNode(sel);

      selections = new_selections;
    }
  }

  // prop view
  link(target, sel_mode, name=target.name) {
    if ( !(target instanceof SphState) && !(target instanceof SphJoint) )
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
    if ( target instanceof SphState )
      return this.makeStateProperties(target);
    else if ( target instanceof SphJoint )
      return this.makeJointProperties(target);
  }
  makeStateProperties(state, sel_mode) {
    var detail = [];

    var joints = [];
    for ( let [index, joint] of state.mold.items(state.joints) )
      joints.push(this.link(joint, sel_mode, `${index} → ${joint.name}`));
    detail.push({type:"folder", name:"joints", open:"true", properties:joints});

    return detail;
  }
  makeJointProperties(joint, sel_mode) {
    var detail = [];

    var ports = [];
    for ( let [state, orientation] of joint.ports )
      ports.push(this.link(state, sel_mode, `${state.name} → (${orientation})`));
    detail.push({type:"folder", name:"ports", open:true, properties:ports});

    var bandage = [];
    for ( let joint_ of joint.bandage )
      bandage.push(this.link(joint_, sel_mode));
    detail.push({type:"folder", name:"bandage", properties:bandage});

    return detail;
  }
}

class SphConfigView
{
  constructor(container_id, network, selector) {
    this.container = document.getElementById(container_id);
    this.network = network;
    this.selector = selector;

    document.body.appendChild(css`
      .emphasized {
        font-weight: bold;
      }
      .highlighted {
        outline: 1px solid red;
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

    this.current_tab = undefined;
    for ( let state of network.states )
      this.drawTab(state);
    network.on("added", SphState, event => this.drawTab(event.target));
    network.on("removed", SphState, event => this.eraseTab(event.target));
    selector.on("add", SphState, event => this.showTab(event.target));

    var updater = this.update();
    var routine = () => (requestAnimationFrame(routine), updater.next());
    requestAnimationFrame(routine);
  }

  makeParamTable(state) {
    var res = [];

    for ( let i=0; i<state.mold.shapes.length; i++ ) {
      let list = document.createElement("div");
      list.classList.add("list");

      const L = state.mold.shapes[i].patch.length;
      for ( let j=0; j<state.mold.shapes[i].count; j++ ) {
        let item = document.createElement("div");
        item.classList.add("item");
        item.draggable = true;
        item.tabIndex = 0;
        item.host = state.segments[i][j];
        item.textContent = state.segments[i][j].name;

        item.addEventListener("wheel", function(event) {
          if ( this.parentNode.getAttribute("disabled") )
            return;
          if ( event.deltaY == 0 )
            return;
          var list = Array.from(this.parentNode.children);
          var j = list.indexOf(this);
          console.assert(this.host === state.segments[i][j]);

          if ( event.deltaY > 0 ) {
            for ( let l=0; l<L; l++ )
              state.segments[i][j] = state.segments[i][j].next;
          } else {
            for ( let l=0; l<L; l++ )
              state.segments[i][j] = state.segments[i][j].prev;
          }

          this.host = state.segments[i][j];
          this.textContent = this.host.name;
          event.preventDefault();
        });

        item.addEventListener("dragstart", function(event) {
          if ( this.parentNode.getAttribute("disabled") )
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
          console.assert(this.host === state.segments[i][j]);
          console.assert(target.host === state.segments[i][j0]);

          if ( j < j0 ) {
            this.parentNode.insertBefore(target, this);
            state.segments[i].splice(j, 0, ...state.segments[i].splice(j0, 1));
          } else if ( this.nextElementSibling ) {
            this.parentNode.insertBefore(target, this.nextElementSibling);
            state.segments[i].splice(j, 0, ...state.segments[i].splice(j0, 1));
          } else {
            this.parentNode.appendChild(target);
            state.segments[i].push(...state.segments[i].splice(j0, 1));
          }
        });

        item.addEventListener("mouseenter", event => this.selector.preselection=this.jointsOf(event.target.host)[0]);
        item.addEventListener("mouseleave", () => this.selector.preselection=undefined);
        item.addEventListener("focus", event => this.selector.select(this.jointsOf(event.target.host)[0]));
        item.addEventListener("blur", () => this.selector.select());

        list.appendChild(item);
      }

      res.push(list);
    }
    return res;
  }
  drawTab(state) {
    var tab = document.createElement("div");
    tab.style.setProperty("display", "none");
    tab.classList.add("config-tab");

    for ( let list of this.makeParamTable(state) )
      tab.appendChild(list);
    state.tab = tab;
    tab.host = state;
    this.container.appendChild(tab);

    this.showTab(state);
  }
  eraseTab(state) {
    this.container.removeChild(state.tab);
    if ( this.current_tab === state.tab )
      delete this.current_tab;
  }
  showTab(state) {
    if ( this.current_tab )
      this.current_tab.style.setProperty("display", "none");
    state.tab.style.setProperty("display", "block");
    this.current_tab = state.tab;
  }

  jointsOf(target) {
    if ( target instanceof SphSeg ) {
      let index, joint;
      for ( let state of this.network.states )
        if ( index = state.indexOf(target) )
          return (joint = state.jointAt(index)) ? [joint] : [target.affiliation];
      console.assert(false);

    } else if ( target instanceof SphElem ) {
      let index, joint;
      for ( let state of this.network.states )
        if ( index = state.indexOf(target) )
          return (joint = state.jointAt(index)) ? Array.from(joint.bandage) : [target];
      console.assert(false);

    } else if ( target instanceof SphJoint ) {
      return [target];

    } else {
      return [];
    }
  }
  emphasize(joint) {
    var index;
    for ( let state of this.network.states )
      if ( index = state.indexOf(joint) ) {
        let table = state.tab.querySelectorAll("div.list");
        let elem = table[index[0]].children[index[1]];

        elem.classList.add("emphasized");
      }
  }
  unemphasize(joint) {
    var index;
    for ( let state of this.network.states )
      if ( index = state.indexOf(joint) ) {
        let table = state.tab.querySelectorAll("div.list");
        let elem = table[index[0]].children[index[1]];

        elem.classList.remove("emphasized");
      }
  }
  highlight(joint) {
    var index;
    for ( let state of this.network.states )
      if ( index = state.indexOf(joint) ) {
        let table = state.tab.querySelectorAll("div.list");
        let elem = table[index[0]].children[index[1]];

        elem.classList.add("highlighted");
      }
  }
  unhighlight(joint) {
    var index;
    for ( let state of this.network.states )
      if ( index = state.indexOf(joint) ) {
        let table = state.tab.querySelectorAll("div.list");
        let elem = table[index[0]].children[index[1]];

        elem.classList.remove("highlighted");
      }
  }

  *update() {
    var preselection = undefined;
    var selections = [];
    while ( true ) {
      yield;

      if ( this.network.outdated )
        continue;

      // emphasize hovered object
      if ( this.selector.preselection !== preselection ) {
        for ( let sel of this.jointsOf(preselection) )
          this.unemphasize(sel);
        for ( let sel of this.jointsOf(this.selector.preselection) )
          this.emphasize(sel);
        preselection = this.selector.preselection;
      }

      // highlight selected objects
      let new_selections = this.selector.selections
        .flatMap(sel => this.jointsOf(sel));

      for ( let sel of selections )
        if ( !new_selections.includes(sel) )
          this.unhighlight(sel);
      for ( let sel of new_selections )
        if ( !selections.includes(sel) )
          this.highlight(sel);

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

    this.states = this.panel.ctrls[this.panel.addFolder("states")];
    this.joints = this.panel.ctrls[this.panel.addFolder("joints")];

    this.data = new Map();

    for ( let state of this.network.states )
      this.addState(state);
    for ( let joint of this.network.joints )
      this.addJoint(joint);

    this.network.on("added", SphState, event => this.addState(event.target));
    this.network.on("added", SphJoint, event => this.addJoint(event.target));
    this.network.on("removed", SphState, event => this.removeState(event.target));
    this.network.on("removed", SphJoint, event => this.removeJoint(event.target));
  }

  addState(state) {
    var id = this.states.add(this.prop_builder.link(state, "select"));
    this.data.set(state, id);
  }
  addJoint(joint) {
    var id = this.joints.add(this.prop_builder.link(joint, "select"));
    this.data.set(joint, id);
  }
  removeState(state) {
    var id = this.data.get(state);
    this.states.remove(id);
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
      let state = selector.selections[0];
      if ( !(state instanceof SphState) ) {
        window.alert("Not state!");
        return;
      }

      this.selector.reselect();
      this.puzzle.trim(state);

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
      window.alert("Please select two segments or one state!");

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
  constructor(puzzle, id_display, id_network, id_config) {
    this.puzzle = puzzle;
    this.selector = new Selector();


    // 3D view
    var dom = document.getElementById(id_display);
    var display = new Display(id_display, dom.clientWidth, dom.clientHeight);
    this.view = new SphPuzzleView(display, this.puzzle, this.selector);

    // network view
    var diagram = new Diagram(id_network);
    this.diag = new SphNetworkView(diagram, this.puzzle.network, this.selector);

    this.conf = new SphConfigView(id_config, this.puzzle.network, this.selector);

    // panel
    this.panel = new Panel();

    var panel_style = css`
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
      }`;
    document.body.appendChild(panel_style);


    var cmd_panel = this.panel.ctrls[this.panel.addFolder("commands")];
    this.cmd = new SphPuzzleWorldCmdMenu(cmd_panel, this.selector, this.puzzle);
    
    // var pzl_panel = this.panel.ctrls[this.panel.addFolder("puzzle")];
    // this.pzl_tree = new SphPuzzleTreeViewPanel(pzl_panel, this.puzzle, this.view);
    // var net_panel = this.panel.ctrls[this.panel.addFolder("network")];
    // this.net_tree = new SphNetworkTreeViewPanel(net_panel, this.puzzle.network, this.diag);

    var sel_panel = this.panel.ctrls[this.panel.addFolder("select", true)];
    sel_panel.gui.add(this.view, "selectOn", ["segment", "element", "track"]).name("select on");
    this.sel = new SelectPanel(sel_panel, this.selector);
    this.sel.addPropBuilder(this.view);
    this.sel.addPropBuilder(this.diag);
  }
}
