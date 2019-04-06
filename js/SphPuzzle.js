"use strict";

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
    properties.unshift({type:"button", name:"object", callback:()=>console.log(target)});
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
        if ( event.attr == "element" )
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
        switch ( event.attr ) {
          case "element":
            this.display.remove(event.target.view, this.root);
            this.drawElement(event.target);
            this.refresh = true;
            break;

          case "color":
            for ( let obj of event.target.view.children )
              for ( let sub of obj.children )
                sub.material.color.set(event.target.color);
            break;

          case "orientation":
            for ( let obj of event.target.view.children )
              obj.quaternion.set(...obj.userData.origin.orientation);
            break;
        }
      });
    }

    this.refresh = false;
    this.display.animate(this.hoverRoutine());
  }

  setName(target, name) {
    target.name = name;
    target.host.trigger("modified", target, {attr:"name"});
  }
  setColor(element, color) {
    element.color = color;
    element.host.trigger("modified", element, {attr:"color"});
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
      return target.boundaries;

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
    if ( seg.track )
      detail.push(this.link(seg.track, sel_mode, "track"));
    detail.push(this.link(seg.prev, sel_mode, "prev"));
    detail.push(this.link(seg.next, sel_mode, "next"));

    for ( let [adj_seg, offset] of seg.adj )
      detail.push(this.link(adj_seg, sel_mode, `adj(${offset})`));

    return detail;
  }
  makeTrackProperties(track, sel_mode) {
    var detail = [];

    detail.push({type: "number", min: 0, max: 4, name: "shift", get: () => track.shift});
    var radius = track.inner[0].radius;
    detail.push({type: "number", min: 0, max: 2, name: "radius", get: () => radius});

    for ( let [track_, {center, arc, angle}] of track.latches )
      detail.push(this.link(track_, sel_mode, `latch(${center}, ${arc}, ${angle})`));

    var inner = [];
    for ( let seg of track.inner )
      inner.push(this.link(seg, sel_mode));
    detail.push({type: "folder", name: "inner", properties: inner});

    var outer = [];
    for ( let seg of track.outer )
      detail.push(this.link(seg, sel_mode));
    detail.push({type: "folder", name: "outer", properties: outer});

    return detail;
  }
}

class SphNetworkView
{
  constructor(dom, network, selector) {
    this.dom = dom;
    this.network = network;
    this.selector = selector;

    var nodes = new vis.DataSet(), edges = new vis.DataSet();
    this.nodes = nodes;
    this.edges = edges;
    this.view = new vis.Network(this.dom, {nodes, edges}, {
      physics: true,
      nodes: {chosen:false}, edges: {chosen:false},
      interaction: {multiselect:true, selectConnectedEdges:false}
    });

    this.data = {};
    {
      this.numbers = (function *numbers() {
        var i = 0; while ( true ) if ( yield i++ ) i = -1;
      })();

      for ( let state of network.states )
        this.addNode(state);
      for ( let joint of network.joints ) {
        this.addNode(joint);
        for ( let state of joint.ports.keys() )
          this.addEdge(joint, state);
      }
      for ( let bandage of network.bandages ) {
        this.addNode(bandage);
        for ( let joint of bandage )
          this.addEdge(bandage, joint);
      }
      
      network.on("added", Object, event => {
        this.addNode(event.target);
      });
      network.on("removed", Object, event => {
        this.removeNode(event.target);
      });
      network.on("fused", SphJoint, event => {
        this.addEdge(event.target, event.state);
      });
      network.on("unfused", SphJoint, event => {
        this.removeEdge(event.target, event.state);
      });
      network.on("binded", Set, event => {
        this.addEdge(event.target, event.joint);
      });
      network.on("unbinded", Set, event => {
        this.removeEdge(event.target, event.joint);
      });
    }

    this.view.on("click", event => {
      var id = this.view.getNodeAt(event.pointer.DOM);
      var target = (id !== undefined) && this.data[id];
      target = (target instanceof SphState || target instanceof SphJoint) && target;

      if ( event.event.srcEvent.ctrlKey ) {
        if ( target )
          this.selector.toggle(target);
      } else {
        if ( target )
          this.selector.select(target);
        else
          this.selector.reselect();
      }
    });
    this.refresh = false;
    var updater = this.update();
    var routine = () => (requestAnimationFrame(routine), updater.next());
    requestAnimationFrame(routine);
  }

  // network view
  addNode(target) {
    if ( target.id && this.data[target.id] )
      return;

    target.id = target.id || this.numbers.next().value;
    this.data[target.id] = target;

    if ( target instanceof SphState ) {
      target.name = target.name || `state${target.id}`;
      this.nodes.add({id:target.id, type:"state", size:20, shape:"diamond"});
    } else if ( target instanceof SphJoint ) {
      target.name = target.name || `joint${target.id}`;
      this.nodes.add({id:target.id, type:"joint", size:5, shape:"dot"});
    } else if ( target instanceof Set ) {
      target.name = target.name || `bandage${target.id}`;
      this.nodes.add({id:target.id, type:"bandage", size:0, shape:"dot"});
    }
  }
  addEdge(target1, target2) {
    var from = target1.id;
    var to = target2.id;
    if ( target1 instanceof SphJoint )
      this.edges.add({id:`${from}-${to}`, type:"fusion", from, to});
    else if ( target1 instanceof Set )
      this.edges.add({id:`${from}-${to}`, type:"bond", from, to, dashes:true});
  }
  removeNode(target) {
    delete this.data[target.id];
    this.nodes.remove(target.id);
    if ( Object.keys(this.data).length == 0 )
      this.numbers.next(true);
  }
  removeEdge(target1, target2) {
    var from = target1.id;
    var to = target2.id;
    edges.remove(`${from}-${to}`);
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
  highlight(sel) {
    var node = this.view.body.nodes[sel.id];
    node.setOptions({borderWidth:2});
    return true;
  }
  unhighlight(sel) {
    var node = this.view.body.nodes[sel.id];
    node.setOptions({borderWidth:1});
    return true;
  }
  *update() {
    var selections = [];
    while ( true ) {
      yield;

      var new_selections = this.selector.selections
        .map(sel => this.nodeOf(sel)).filter(sel => sel);

      var changed = false;
      for ( let sel of selections )
        if ( this.refresh || !new_selections.includes(sel) )
          changed = this.unhighlight(sel) || changed;
      for ( let sel of new_selections )
        if ( this.refresh || !selections.includes(sel) )
          changed = this.highlight(sel) || changed;
      if ( changed )
        this.view.redraw();

      selections = new_selections;
      this.refresh = false;
    }
  }

  // prop view
  link(target, sel_mode, name=target.name) {
    if ( !(target instanceof SphState) && !(target instanceof SphJoint)
         && !(target instanceof Set) )
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
    else if ( target instanceof Set )
      return this.makeBandageProperties(target);
  }
  makeStateProperties(state, sel_mode) {
    var detail = [];

    for ( let [index, joint] of state.mold.items(state.joints) )
      detail.push(this.link(joint, sel_mode, `${state.name}[${index}]`));

    return detail;
  }
  makeJointProperties(joint, sel_mode) {
    var detail = [];

    if ( joint.bandage.size > 1 )
      detail.push(this.link(joint.bandage, sel_mode));

    for ( let state of Array.from(joint.ports.keys()) )
      detail.push(this.link(state, sel_mode, `${state.name}[${state.indexOf(joint)}]`));

    return detail;
  }
  makeBandageProperties(bandage, sel_mode) {
    var detail = [];

    for ( let joint of bandage )
      detail.push(this.link(joint, sel_mode));

    return detail;
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
    this.bandages = this.panel.ctrls[this.panel.addFolder("bandages")];

    this.data = new Map();

    for ( let state of this.network.states )
      this.addState(state);
    for ( let joint of this.network.joints )
      this.addJoint(joint);
    for ( let bandage of this.network.bandages )
      this.addBandage(bandage);

    this.network.on("added", SphState, event => this.addState(event.target));
    this.network.on("added", SphJoint, event => this.addJoint(event.target));
    this.network.on("added", Set, event => this.addBandage(event.target));
    this.network.on("removed", SphState, event => this.removeState(event.target));
    this.network.on("removed", SphJoint, event => this.removeJoint(event.target));
    this.network.on("removed", Set, event => this.removeBandage(event.target));
  }

  addState(state) {
    var id = this.states.add(this.prop_builder.link(state, "select"));
    this.data.set(state, id);
  }
  addJoint(joint) {
    var id = this.joints.add(this.prop_builder.link(joint, "select"));
    this.data.set(joint, id);
  }
  addBandage(bandage) {
    var id = this.bandages.add(this.prop_builder.link(bandage, "select"));
    this.data.set(bandage, id);
  }
  removeState(state) {
    var id = this.data.get(state);
    this.states.remove(id);
  }
  removeJoint(joint) {
    var id = this.data.get(joint);
    this.joints.remove(id);
  }
  removeBandage(bandage) {
    var id = this.data.get(bandage);
    this.bandages.remove(id);
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
    if ( selector.selections.length != 2 ) {
      window.alert("Please select two segments!");
      return;
    }
    var [seg1, seg2] = selector.selections;
    if ( !(seg1 instanceof SphSeg) || !(seg2 instanceof SphSeg) ) {
      window.alert("Not segment!");
      return;
    }

    if ( seg1.affiliation !== seg2.affiliation ) {
      this.puzzle.mergeElements(seg1.affiliation, seg2.affiliation);
      selector.reselect(seg1, seg2);

    } else if ( seg1.adj.has(seg2) ) {
      this.puzzle.mergeEdge(seg1, seg2);
      selector.reselect();

    } else if ( seg1.next === seg2 || seg2.next === seg1 ) {
      if ( seg1.next === seg2 ) seg1 = seg2;
      if ( seg1 === seg1.prev || !this.puzzle.analyzer.isTrivialVertex(seg1) ) {
        window.alert("Cannot merge!");
        return;
      }

      let prev = seg1.prev;
      this.puzzle.mergeVertex(seg1);
      selector.select(prev);

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
}


class SphPuzzleWorld
{
  constructor(id_display, id_network, puzzle) {
    this.puzzle = puzzle;
    this.network = new SphNetwork();
    this.network.init(this.puzzle);
    this.selector = new Selector();


    // 3D view
    var dom = document.getElementById(id_display);
    var display = new Display(id_display, dom.clientWidth, dom.clientHeight);
    this.view = new SphPuzzleView(display, this.puzzle, this.selector);

    // network view
    var netdom = document.getElementById(id_network);
    this.netview = new SphNetworkView(netdom, this.network, this.selector);

    // panel
    this.panel = new Panel();

    var panel_style = document.createElement("style");
    panel_style.innerHTML = `
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


    var pzl_panel = this.panel.ctrls[this.panel.addFolder("puzzle")];
    this.pzl_tree = new SphPuzzleTreeViewPanel(pzl_panel, this.puzzle, this.view);
    var net_panel = this.panel.ctrls[this.panel.addFolder("network")];
    this.net_tree = new SphNetworkTreeViewPanel(net_panel, this.network, this.netview);

    var cmd_panel = this.panel.ctrls[this.panel.addFolder("commands")];
    this.cmd = new SphPuzzleWorldCmdMenu(cmd_panel, this.selector, this.puzzle);
    
    var sel_panel = this.panel.ctrls[this.panel.addFolder("select", true)];
    sel_panel.gui.add(this.view, "selectOn", ["segment", "element", "track"]).name("select on");
    this.sel = new SelectPanel(sel_panel, this.selector);
    this.sel.addPropBuilder(this.view);
    this.sel.addPropBuilder(this.netview);
  }
}
