"use strict";

class SphPuzzle extends THREE.EventDispatcher
{
  constructor(analyzer=new SphAnalyzer()) {
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

    this.elements = [];
    this.add(this.wrap(new SphElem()));

    this.analyzer = analyzer;
  }

  wrap(element) {
    element.name = `SphElem#${this.numbers.next().value}`;
    element.color = this.colors.next().value;
    element.host = this;
    return element;
  }
  add(element) {
    this.elements.push(element);
    this.dispatchEvent({type:"added", element});
  }
  remove(element) {
    let i = this.elements.indexOf(element);
    if ( i == -1 )
      return;
    this.elements.splice(i, 1);
    this.dispatchEvent({type:"removed", element});
  }

  mergeVertex(seg) {
    var element = seg.affiliation;
    this.analyzer.mergePrev(seg);
    this.dispatchEvent({type:"modified", attr:"element", element});
  }
  interpolate(seg, theta) {
    var element = seg.affiliation;
    this.analyzer.interpolate(seg, theta);
    this.dispatchEvent({type:"modified", attr:"element", element});
  }
  mergeEdge(seg1, seg2) {
    var element = seg1.affiliation;
    this.analyzer.glueAdj(this.analyzer.cover(seg1, seg2));
    this.dispatchEvent({type:"modified", attr:"element", element});
  }
  mergeElements(element0, ...elements) {
    element0.merge(...elements);

    for ( let element of elements )
      this.remove(element);
    this.dispatchEvent({type:"modified", attr:"element", element:element0});

    return element0;
  }

  setColor(element, color) {
    element.color = color;
    this.dispatchEvent({type:"modified", attr:"color", element});
  }
  rotate(q) {
    for ( let element of this.elements ) {
      element.rotate(q);
      this.dispatchEvent({type:"modified", attr:"orientation", element});
    }
  }
  slice(center, radius, elements=this.elements.slice()) {
    var circle = new SphCircle({radius, orientation:q_align(center)});
    var new_bd = [];
    for ( let element of elements ) {
      let [in_segs, out_segs, in_bd, out_bd] = this.analyzer.slice(element, circle);
      if ( in_segs.length && out_segs.length ) {
        let [splited] = element.split(out_segs);
        this.add(this.wrap(splited));
        this.dispatchEvent({type:"modified", attr:"element", element});
      }
      new_bd.push(...in_bd, ...out_bd);
    }
    var track;
    if ( new_bd.length )
      if ( !new_bd[0].track )
        track = this.analyzer.buildTrack(new_bd[0]);
    return track;
  }
  twist(track, theta, hold) {
    theta = this.analyzer.mod4(theta);
    var partition = this.analyzer.partitionBy(track.inner, track.outer);
    if ( partition.length == 1 )
      throw new Error("Untwistable!");
    var moved = partition.filter(g => !g.elements.has(hold))
                         .flatMap(g => Array.from(g.elements));

    this.analyzer.twist([[track, theta]], hold);

    for ( let elem of moved )
      this.dispatchEvent({type:"modified", attr:"orientation", element:elem});

    return track;
  }

  clean() {
    // merge untwistable edges
    var elements = this.elements.slice();
    for ( let group of this.analyzer.twistablePartOf(elements) )
      if ( group.length > 1 )
        this.mergeElements(...group);

    var modified = new Set();

    // merge trivial edges
    for ( let element of this.elements ) {
      let zippers = [];
      let nontrivial = new Set(element.boundaries);
      for ( let seg of nontrivial ) {
        let subzippers = this.analyzer.findZippers(seg);
        for ( let [seg1,,,seg2,,] of subzippers ) {
          nontrivial.delete(seg1);
          nontrivial.delete(seg2);
        }
        zippers.push(...subzippers);
      }

      if ( zippers.length ) {
        this.analyzer.glueAdj(zippers);
        modified.add(element);
      }
    }

    // merge trivial vertices
    for ( let element of this.elements ) {
      let trivial = Array.from(element.boundaries)
                         .filter(seg => this.analyzer.isTrivialVertex(seg));
      for ( let seg of trivial )
        if ( seg !== seg.prev ) {
          this.analyzer.mergePrev(seg);
          modified.add(element);
        }
    }

    for ( let element of modified )
      this.dispatchEvent({type:"modified", attr:"element", element});

  }
  check() {
    for ( let element of this.elements )
      for ( let seg of element.boundaries )
        this.analyzer.checkGeometry(seg);
    this.analyzer.checkOrientation(this.elements);
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
      for ( let element of this.puzzle.elements )
        this.drawElement(element);

      this.puzzle.addEventListener("added", event =>
        this.drawElement(event.element));
      this.puzzle.addEventListener("removed", event =>
        this.display.remove(event.element.view, this.root));

      this.puzzle.addEventListener("modified", event => {
        switch ( event.attr ) {
          case "element":
            this.display.remove(event.element.view, this.root);
            this.drawElement(event.element);
            this.refresh = true;
            break;

          case "color":
            for ( let obj of event.element.view.children )
              for ( let sub of obj.children )
                sub.material.color.set(event.element.color);
            break;

          case "orientation":
            for ( let obj of event.element.view.children )
              obj.quaternion.set(...obj.userData.origin.orientation);
            break;
        }
      });
    }

    this.refresh = false;
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

  nameOf(target) {
    if ( target instanceof SphElem ) {
      return target.name;

    } else if ( target instanceof SphSeg ) {
      let pre = target.affiliation.name;
      let n = Array.from(target.affiliation.boundaries).indexOf(target);
      return `${pre}-bd.${n}`;

    }
  }
  infoOf(target) {
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
      get: () => elem.color,
      set: color => elem.host.setColor(elem, color)
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
      get: () => seg.affiliation.color,
      set: color => seg.affiliation.host.setColor(seg.affiliation, color)
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

    info.push({type: [0, 4], name: "shift", get: () => track.shift});
    var radius = track.inner[0].radius;
    info.push({type: [0, 2], name: "radius", get: () => radius});

    var n = 0;
    for ( let [track_, {center, arc, angle}] of track.latches )
      info.push({type: "link", name: `latch(${center}, ${arc}, ${angle})`, get: () => track_});

    n = 0;
    for ( let seg of track.inner )
      info.push({type: "link", name: `inner.${n++}`, get: () => seg});
    n = 0;
    for ( let seg of track.outer )
      info.push({type: "link", name: `outer.${n++}`, get: () => seg});

    return info;
  }

}


class SphNetwork extends THREE.EventDispatcher
{
  constructor(analyzer=new SphAnalyzer()) {
    super();

    this.analyzer = analyzer;
    this.states = [];
    this.joints = [];
    this.bandages = [];
  }

  addState(state) {
    this.states.push(state);
    this.dispatchEvent({type:"stateadded", state});
  }
  removeState(state) {
    var i = this.states.indexOf(state);
    if ( i == -1 )
      return;
    this.states.splice(i, 1);
    this.dispatchEvent({type:"statemoved", state});
  }
  addJoint(joint) {
    this.joints.push(joint);
    this.dispatchEvent({type:"jointadded", joint});
    for ( let [state, orientation] of joint.ports ) {
      console.assert(this.states.includes(state));
      let index = state.indexOf(joint);
      this.dispatchEvent({type:"fusionadded", joint, state, index});
    }
  }
  removeJoint(joint) {
    var i = this.joints.indexOf(joint);
    if ( i == -1 )
      return;
    this.joints.splice(i, 1);
    for ( let [state, orientation] of joint.ports ) {
      console.assert(this.states.includes(state));
      let index = state.indexOf(joint);
      this.dispatchEvent({type:"fusionremoved", joint, state, index});
    }
    this.dispatchEvent({type:"jointremoved", joint});
  }
  addBandage(bandage) {
    this.bandages.push(bandage);
    this.dispatchEvent({type:"bandageadded", bandage});
    for ( let joint of bandage ) {
      console.assert(this.joints.includes(joint));
      this.dispatchEvent({type:"bondadded", bandage, joint});
    }
  }
  removeBandage(bandage) {
    var i = this.bandages.indexOf(bandage);
    if ( i == -1 )
      return;
    this.bandages.splice(i, 1);
    for ( let joint of bandage ) {
      console.assert(this.joints.includes(joint));
      this.dispatchEvent({type:"bondremoved", bandage, joint});
    }
    this.dispatchEvent({type:"bandageremoved", bandage});
  }

  makeJoint(state, index) {
    console.assert(this.states.includes(state));
    var joint = state.jointAt(index, false);
    if ( !joint ) {
      joint = state.jointAt(index, true);
      this.addJoint(joint);
    }
    return joint;
  }
  fuse(joint, joint_) {
    joint.fuse(joint_);
    this.removeJoint(joint_);
    for ( let [state, ] of joint_.ports ) {
      let index = state.indexOf(joint_);
      this.dispatchEvent({type:"fusionadded", joint, state, index});
    }
  }
  unfuse(joint, state) {
    if ( !joint.ports.has(state) )
      return;
    var index = state.indexOf(joint);
    joint.unfuse(state);
    this.dispatchEvent({type:"fusionremoved", joint, state, index});
    if ( joint.size == 0 )
      this.removeJoint(joint);
  }
  bind(joint1, joint2) {
    var bandage1 = joint1.bandage.size > 1 ? joint1.bandage : undefined;
    var bandage2 = joint2.bandage.size > 1 ? joint2.bandage : undefined;
    joint1.bind(joint2);

    if ( !bandage1 && !bandage2 ) {
      this.addBandage(joint1.bandage);

    } else if ( bandage1 && bandage2 ) {
      this.removeBandage(bandage2);
      for ( let joint of bandage2 )
        this.dispatchEvent({type:"bondadded", bandage:bandage1, joint});

    } else if ( bandage1 && !bandage2 ) {
      this.dispatchEvent({type:"bondadded", bandage:bandage1, joint:joint2});

    } else if ( !bandage1 && bandage2 ) {
      this.dispatchEvent({type:"bondadded", bandage:bandage2, joint:joint1});
    }
  }
  unbind(joint) {
    var bandage = joint.bandage;
    if ( bandage.size == 1 )
      return;
    joint.unbind();
    this.dispatchEvent({type:"bondremoved", bandage, joint});
    if ( bandage.size <= 1 )
      this.removeBandage(bandage);
  }

  clear() {
    for ( let bandage of this.bandages.slice() )
      this.removeBandage(bandage);

    for ( let joint of this.joints.slice() )
      this.removeJoint(joint);

    for ( let state of this.states.slice() )
      this.removeState(state);
  }
  init(puzzle) {
    this.clear();

    var states = this.analyzer.structurize(puzzle.elements);
    for ( let state of states )
      this.addState(state);

    var joints = states.flatMap(state => state.joints.flat(2));
    for ( let joint of new Set(joints) )
      this.addJoint(joint);

    var bandages = joints.map(joint => joint.bandage).filter(b => b.size > 1);
    for ( let bandage of new Set(bandages) )
      this.addBandage(bandage);
  }
  trim(state) {
    var joints = state.joints.flat(2);
    for ( let joint of joints )
      this.unfuse(joint, state);
    this.removeState(state);
    joints.slice(1).forEach(joint => this.fuse(joint, joints[0]));
  }
}

class SphNetworkView
{
  constructor(id, network, selector) {
    this.numbers = (function *numbers() {
      var i = 0; while ( true ) yield i++;
    })();

    this.dom = document.getElementById(id);
    var nodes = new vis.DataSet(), edges = new vis.DataSet();
    var options = {
      physics: true,
      nodes: {chosen:false}, edges: {chosen:false},
      interaction: {multiselect:true, selectConnectedEdges:false,
                    hover:true, hoverConnectedEdges:false}
    };
    this.view = new vis.Network(this.dom, {nodes, edges}, options);

    this.network = network;
    this.data = [];
    // event listeners
    {
      network.addEventListener("stateadded", event => {
        var id = this.numbers.next().value;
        this.data[id] = event.state;
        nodes.add({id, type:"state", size:20, shape:"diamond"});
      });
      network.addEventListener("stateremoved", event => {
        var id = this.data.indexOf(event.state);
        if ( id != -1 ) {
          delete this.data[id];
          nodes.remove(id);
        }
      });
      network.addEventListener("jointadded", event => {
        var id = this.numbers.next().value;
        this.data[id] = event.joint;
        nodes.add({id, type:"joint", size:5, shape:"dot"});
      });
      network.addEventListener("jointremoved", event => {
        var id = this.data.indexOf(event.joint);
        if ( id != -1 ) {
          delete this.data[id];
          nodes.remove(id);
        }
      });
      network.addEventListener("bandageadded", event => {
        var id = this.numbers.next().value;
        this.data[id] = event.bandage;
        nodes.add({id, type:"bandage", size:0, shape:"dot"});
      });
      network.addEventListener("bandageremoved", event => {
        var id = this.data.indexOf(event.bandage);
        if ( id != -1 ) {
          delete this.data[id];
          nodes.remove(id);
        }
      });
      network.addEventListener("fusionadded", event => {
        var from = this.data.indexOf(event.joint);
        var to = this.data.indexOf(event.state);
        edges.add({id:`${from}-${to}`, type:"fusion", from, to});
      });
      network.addEventListener("fusionremoved", event => {
        var from = this.data.indexOf(event.joint);
        var to = this.data.indexOf(event.state);
        edges.remove(`${from}-${to}`);
      });
      network.addEventListener("bondadded", event => {
        var from = this.data.indexOf(event.bandage);
        var to = this.data.indexOf(event.joint);
        edges.add({id:`${from}-${to}`, type:"bond", from, to, dashes:true});
      });
      network.addEventListener("bondremoved", event => {
        var from = this.data.indexOf(event.bandage);
        var to = this.data.indexOf(event.joint);
        edges.remove(`${from}-${to}`);
      });
    }

    this.selector = selector;
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
    var id = this.data.indexOf(sel);
    if ( id == -1 )
      return false;
    var node = this.view.body.nodes[id];
    node.setOptions({borderWidth:2});
    return true;
  }
  unhighlight(sel) {
    var id = this.data.indexOf(sel);
    if ( id == -1 )
      return false;
    var node = this.view.body.nodes[id];
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

  nameOf(target) {
    return target.constructor.name;
  }
  infoOf(target) {
    if ( target instanceof SphState )
      return this.makeStateInfo(target);
    else if ( target instanceof SphJoint )
      return this.makeJointInfo(target);
  }
  makeJointInfo(joint) {
    var info = [];

    var states = Array.from(joint.ports.keys());
    var n = 0;
    for ( let state of states )
      info.push({type: "link", name: `port.${n++}`, get: () => state});
    for ( let state of states ) {
      let index = state.indexOf(joint);
      let seg = state.get(index);
      info.push({type: "link", name: `${this.nameOf(state)}[${index}]`, get: () => seg});
    }

    return info;
  }
  makeStateInfo(state) {
    var info = [];
    var n = 0;
    for ( let [index, joint] of state.mold.items(state.joints) )
      info.push({type: "link", name: `joint.${n++}`, get: () => joint});

    return info;
  }
}


class Selector extends THREE.EventDispatcher
{
  constructor() {
    super();

    this.preselection = undefined;
    this.selections = [];
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
  deselect(target=this.preselection) {
    this.removeSelection(target);
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
    for ( let sel of Array.from(this.selections).reverse() )
      this.removeSelection(sel);
    for ( let target of targets )
      this.addSelection(target);
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
  constructor(gui, selector) {
    this.gui = gui;
    this.selector = selector;
    this.info_builders = [new InfoBuilder()];

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
    var name = this.info_builders.reduce((res, b) => res || b.nameOf(target), undefined);
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
    var info = this.info_builders.reduce((res, b) => res || b.infoOf(target), undefined);

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

class InfoBuilder
{
  infoOf(target) {
    return [];
  }
  nameOf(target) {
    return target.constructor.name;
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
  constructor(gui, selector) {
    this.gui = gui;
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
    if ( name ) {
      var proxy = {};
      proxy[name] = () => func(this.selector);
      this.gui.add(proxy, name);
    }

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
  constructor(gui, selector, puzzle) {
    super(gui, selector);
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
  constructor(id, puzzle) {
    this.puzzle = puzzle;
    this.selector = new Selector();


    // 3D view
    var dom = document.getElementById(id);
    var display = new Display(id, dom.clientWidth, dom.clientHeight);
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
      }
      .property-name {
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .function .property-name {
        width: 100%;
      }`;
    document.body.appendChild(gui_style);


    var cmd_gui = this.gui.addFolder("commands");
    this.cmd = new SphPuzzleWorldCmdMenu(cmd_gui, this.selector, this.puzzle);
    
    var sel_gui = this.gui.addFolder("select");
    sel_gui.add(this.view, "selectOn", ["segment", "element", "track"]).name("select on");
    this.sel_panel = new SelectorPanel(sel_gui, this.selector);
    this.sel_panel.info_builders.unshift(this.view);
    // this.sel_panel.info_builders.push(new SphNetworkInfoBuilder());
  }
}
