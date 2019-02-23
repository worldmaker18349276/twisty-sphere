"use strict";

class SphPiece extends THREE.EventDispatcher
{
  constructor(element, name, color) {
    super();

    this.element = element;
    this.name = name;
    this.color = color;
    this.element.host = this;
  }
  setColor(color) {
    this.color = color;
    this.dispatchEvent({type:"modified", attr:"color"});
  }
  setName(name) {
    this.name = name;
    this.dispatchEvent({type:"modified", attr:"name"});
  }
  rotate(q) {
    this.element.rotate(q);
    this.dispatchEvent({type:"modified", attr:"orientation"});
  }
}

class SphPuzzle extends THREE.EventDispatcher
{
  constructor() {
    super();

    this.colors = (function *colors() {
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
    this.numbers = (function *numbers() {
      var i = 0; while ( true ) yield i++;
    })();

    this.pieces = [];
    this.add(this.wrap(new SphElem()));

    this.analyzer = new SphAnalyzer();
  }

  wrap(element) {
    var color = this.colors.next().value;
    var number = this.numbers.next().value;
    return new SphPiece(element, `SphElem#${number}`, color);
  }
  add(piece) {
    this.pieces.push(piece);
    this.dispatchEvent({type:"added", piece});
  }
  remove(piece) {
    let i = this.pieces.indexOf(piece);
    if ( i == -1 )
      return;
    this.pieces.splice(i, 1);
    this.dispatchEvent({type:"removed", piece});
  }

  mergeVertex(seg) {
    var piece = seg.affiliation.host;
    this.analyzer.mergePrev(seg);
    piece.dispatchEvent({type:"modified", attr:"element"});
    return piece;
  }
  interpolate(seg, theta) {
    var piece = seg.affiliation.host;
    this.analyzer.interpolate(seg, theta);
    piece.dispatchEvent({type:"modified", attr:"element"});
    return piece;
  }
  mergeEdge(seg1, seg2) {
    var piece = seg1.affiliation.host;
    this.analyzer.glueAdj(this.analyzer.cover(seg1, seg2));
    piece.dispatchEvent({type:"modified", attr:"element"});
    return piece;
  }
  merge(piece0, ...pieces) {
    var elements = pieces.map(p => p.element);

    piece0.element.merge(...elements);

    for ( let piece of pieces )
      this.remove(piece);
    piece0.dispatchEvent({type:"modified", attr:"element"});

    return piece0;
  }

  rotate(q) {
    for ( let piece of this.pieces )
      piece.rotate(q);
  }
  slice(center, radius, pieces=this.pieces.slice()) {
    var circle = new SphCircle({radius, orientation:q_align(center)});
    var new_bd = [];
    for ( let piece of pieces ) {
      let elem = piece.element;
      let [in_segs, out_segs, in_bd, out_bd] = this.analyzer.slice(elem, circle);
      if ( in_segs.length && out_segs.length ) {
        let splited = elem.split(out_segs);

        for ( let elem of splited )
          this.add(this.wrap(elem));
        piece.dispatchEvent({type:"modified", attr:"element"});
      }
      new_bd.push(...in_bd, ...out_bd);
    }
    var tracks;
    if ( new_bd.length )
      if ( !new_bd[0].track )
        tracks = this.analyzer.buildTrack(new_bd[0]);
    return tracks[0];
  }
  twist(track, theta, hold) {
    theta = this.analyzer.mod4(theta);
    var partition = this.analyzer.partitionBy(track.left, track.right);
    if ( partition.length == 1 )
      throw new Error("Untwistable!");
    var moved = partition.filter(g => !g.elements.has(hold))
                         .flatMap(g => Array.from(g.elements));

    this.analyzer.twist([[track, theta]], hold);

    for ( let elem of moved )
      elem.host.dispatchEvent({type:"modified", attr:"orientation"});

    return track;
  }
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
  pointTo(event, plane) {
    var mouse = new THREE.Vector2(
      event.offsetX/this.width*2 - 1,
      - event.offsetY/this.height*2 + 1);
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

class Selector extends THREE.EventDispatcher
{
  constructor() {
    super();

    this.preselection = undefined;
    this.selections = [];
  }

  deselect() {
    for ( let sel of Array.from(this.selections).reverse() )
      this.removeSelection(sel);
  }
  select(target=this.preselection) {
    for ( let sel of Array.from(this.selections).reverse() )
      this.removeSelection(sel);
    if ( target )
      this.addSelection(target);
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

  addSelection(target) {
    var i = this.selections.indexOf(target);
    if ( i != -1 )
      return false;
    this.selections.push(target);
    i = this.selections.length - 1;
    this.dispatchEvent({type:"add", index:i});
    return true;
  }
  removeSelection(target) {
    var i = this.selections.indexOf(target);
    if ( i == -1 )
      return false;
    this.dispatchEvent({type:"remove", index:i});
    this.selections.splice(i, 1);
    return true;
  }
}

class SelectorPanel
{
  constructor(gui, selector, info_builder) {
    this.gui = gui;
    this.selector = selector;
    this.info_builder = info_builder;

    this.sels_gui = this.gui.addFolder("selections");
    this.sels_gui.open();
    this.sels_ctrl = [];
    this.sel_gui = this.gui.addFolder("detail");
    this.sel_gui.open();
    this.sel_ctrl = [];

    this.selector.addEventListener("add", event => {
      var target = this.selector.selections[event.index];
      this.addSel(target);
      this.setInfo(target);
    });
    this.selector.addEventListener("remove", event => {
      this.removeSel(event.index);
      this.clearInfo();
    });
  }

  addSel(target) {
    var proxy = {};
    var name = target.name || target.constructor.name;
    proxy[name] = () => this.selector.focus(target);
    var link_ctrl = this.sels_gui.add(proxy, name);
    var dom = link_ctrl.domElement.parentNode.parentNode;
    dom.addEventListener("mouseenter", () => this.selector.preselection = target);
    dom.addEventListener("mouseleave", () => this.selector.preselection = undefined);
    this.sels_ctrl.push(link_ctrl);
  }
  removeSel(n) {
    this.sels_ctrl[n].remove();
    this.sels_ctrl.splice(n, 1);
  }
  setInfo(target) {
    this.clearInfo();
    var info = this.info_builder.build(target);

    var proxy = {};
    proxy.object = () => console.log(target);
    this.sel_ctrl.push(this.sel_gui.add(proxy, "object"));

    for ( let {name, type, get, set} of info ) {
      if ( type == "link" ) {
        proxy[name] = () => this.selector.replace(get());
        let link_ctrl = this.sel_gui.add(proxy, name);
        let dom = link_ctrl.domElement.parentNode.parentNode;
        dom.addEventListener("mouseenter", () => this.selector.preselection = get());
        dom.addEventListener("mouseleave", () => this.selector.preselection = undefined);
        this.sel_ctrl.push(link_ctrl);

      } else {
        proxy[name] = get();

        let ctrl;
        if ( Array.isArray(type) ) {
          let [min, max] = type;
          ctrl = this.sel_gui.add(proxy, name, min, max, 0.01);
        } else if ( type == "str" ) {
          ctrl = this.sel_gui.add(proxy, name);
        } else if ( type == "color" ) {
          ctrl = this.sel_gui.addColor(proxy, name);
        }

        if ( set )
          ctrl.onChange(set);
        ctrl.onFinishChange(() => { proxy[name]=get(); ctrl.updateDisplay(); });
        this.sel_ctrl.push(ctrl);

      }
    }
  }
  clearInfo() {
    for ( let ctrl of this.sel_ctrl )
      ctrl.remove();
    this.sel_ctrl = [];
  }
}

class SphPuzzleInfoBuilder
{
  build(target) {
    if ( target instanceof SphElem )
      return this.makeElemInfo(target);
    else if ( target instanceof SphSeg )
      return this.makeSegInfo(target);
    else if ( target instanceof SphTrack )
      return this.makeTrackInfo(target);
  }
  makeElemInfo(elem) {
    var info = [];
    info.push({
      type: "color",
      name: "color",
      get: () => elem.host.color,
      set: color => elem.host.setColor(color)
    });

    var n = 0;
    for ( let seg of elem.boundaries )
      info.push({type: "link", name: `bd.${n++}`, get: () => seg});

    return info;
  }
  makeSegInfo(seg) {
    var info = [];

    info.push({
      type: "color",
      name: "color",
      get: () => seg.affiliation.host.color,
      set: color => seg.affiliation.host.setColor(color)
    });
    info.push({type: [0, 4], name: "arc", get: () => seg.arc});
    info.push({type: [0, 2], name: "radius", get: () => seg.radius});
    info.push({type: [0, 4], name: "angle", get: () => seg.angle});

    info.push({type: "link", name: "aff.", get: () => seg.affiliation});
    if ( seg.track )
      info.push({type: "link", name: "track", get: () => seg.track});
    info.push({type: "link", name: "prev", get: () => seg.prev});
    info.push({type: "link", name: "next", get: () => seg.next});
    for ( let [adj_seg, offset] of seg.adj )
      info.push({type: "link", name: `adj(${offset})`, get: () => adj_seg});

    return info;
  }
  makeTrackInfo(track) {
    var info = [];

    info.push({type: [0, 4], name: "offset", get: () => track.offset});

    var n = 0;
    for ( let seg of track.left )
      info.push({type: "link", name: `left.${n++}`, get: () => seg});
    n = 0;
    for ( let seg of track.right )
      info.push({type: "link", name: `right.${n++}`, get: () => seg});

    return info;
  }
}

class SphPuzzleView
{
  constructor(display, puzzle, selector) {
    this.display = display;
    this.puzzle = puzzle;
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

    // draw puzzle
    {
      let modified_handler = event => {
        switch ( event.attr ) {
          case "element":
            this.display.remove(event.target.view, this.root);
            this.drawPiece(event.target);
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
      };

      for ( let piece of this.puzzle.pieces ) {
        this.drawPiece(piece);
        piece.addEventListener("modified", modified_handler);
      }

      this.puzzle.addEventListener("added", event => {
        this.drawPiece(event.piece);
        event.piece.addEventListener("modified", modified_handler);
      });
      this.puzzle.addEventListener("removed", event => {
        this.display.remove(event.piece.view, this.root);
      });
    }

    this.display.animate(this.hoverRoutine());
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
    }

    var obj = new THREE.Object3D();
    obj.add(arc, dash, ang, holder);
    obj.quaternion.set(...seg.orientation);
    obj.userData.origin = seg;

    return obj;
  }
  drawPiece(piece) {
    piece.view = new THREE.Object3D();
    for ( let seg of piece.element.boundaries ) {
      let obj = this.buildSegView(seg, piece.color);
      seg.view = obj;

      let holder = obj.children[3];
      holder.userData.hoverable = true;
      holder.addEventListener("mouseenter", this.hover_handler);
      holder.addEventListener("mouseleave", this.hover_handler);
      holder.addEventListener("click", this.select_handler);

      piece.view.add(obj);
    }
    this.display.add(piece.view, this.root);
  }

  *hoverRoutine() {
    var preselection = undefined;
    var selections = [];
    function segsOf(target) {
      if ( target instanceof SphSeg )
        return [target];
      else if ( target instanceof SphElem )
        return target.boundaries;
      else if ( target instanceof SphTrack )
        return [...target.left, ...target.right];
      else
        return [];
    }
    while ( true ) {
      yield;

      // emphasize hovered object
      if ( this.selector.preselection !== preselection ) {
        for ( let seg of segsOf(preselection) )
          if ( seg && seg.view ) {
            seg.view.children[0].material.linewidth = 1;
            seg.view.children[1].material.linewidth = 1;
          }
        for ( let seg of segsOf(this.selector.preselection) )
          if ( seg && seg.view ) {
            seg.view.children[0].material.linewidth = 2;
            seg.view.children[1].material.linewidth = 2;
          }
        preselection = this.selector.preselection;
      }

      // highlight selected objects
      if ( selections.some(sel => !this.selector.selections.includes(sel))
           || this.selector.selections.some(sel => !selections.includes(sel)) ) {
        for ( let sel of selections )
          for ( let seg of segsOf(sel) )
            if ( seg && seg.view )
              seg.view.children[3].material.opacity = 0;
        for ( let sel of this.selector.selections )
          for ( let seg of segsOf(sel) )
            if ( seg && seg.view )
              seg.view.children[3].material.opacity = 0.3;
        selections = this.selector.selections.slice();
      }
    }
  }
}

class SphPuzzleWorld
{
  constructor(id, width, height, puzzle) {
    this.puzzle = puzzle;
    this.selector = new Selector();


    // 3D view
    var display = new Display(id, width, height);
    this.view = new SphPuzzleView(display, this.puzzle, this.selector);

    // gui
    this.gui = new dat.GUI();

    var gui_style = document.createElement("style");
    gui_style.innerHTML = `
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
      }`;
    document.body.appendChild(gui_style);


    this.cmd = {
      ["merge"]: () => this.mergeCmd(this.selector),
      ["interpolate"]: () => this.interpolateCmd(this.selector),
      ["align"]: () => this.alignSegCmd(this.selector),
      ["slice"]: () => this.sliceCmd(this.selector),
    };
    var cmd_gui = this.gui.addFolder("commands");
    for ( let name in this.cmd )
      cmd_gui.add(this.cmd, name);

    
    var sel_gui = this.gui.addFolder("select");
    sel_gui.add(this.view, "selectOn", ["segment", "element", "track"]).name("select on");
    var info_builder = new SphPuzzleInfoBuilder();
    this.sel_panel = new SelectorPanel(sel_gui, this.selector, info_builder);
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
      let piece1 = seg1.affiliation.host;
      let piece2 = seg2.affiliation.host;
      let res = this.puzzle.merge(piece1, piece2);
      selector.select(seg1);
      selector.toggle(seg2);

    } else if ( seg1.adj.has(seg2) ) {
      let piece = this.puzzle.mergeEdge(seg1, seg2);
      selector.deselect();

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
  interpolateCmd(selector) {
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
    selector.select(seg);
    selector.toggle(seg.next);
  }
  alignSegCmd(selector) {
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
      if ( seg1.track.right.includes(seg1) )
        [seg1, seg2] = [seg2, seg1];
      if ( !seg1.track.left.includes(seg1) || !seg2.track.right.includes(seg2) ) {
        window.alert("Cannot align segmets!");
        return;
      }
      
      var offset0 = seg1.track.offset;
      var offset1 = 0;
      for ( let seg of seg1.track.left ) {
        if ( seg === seg1 )
          break;
        offset1 += seg.arc;
      }
      var offset2 = 0;
      for ( let seg of seg2.track.right ) {
        if ( seg === seg2 )
          break;
        offset2 += seg.arc;
      }
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
      selector.deselect();
  }
}
