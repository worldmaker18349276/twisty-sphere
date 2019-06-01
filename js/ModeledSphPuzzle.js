"use strict";

function ncolor(normal) {
  let {phi, theta} = new THREE.Spherical().setFromVector3(normal);
  return new THREE.Color().setHSL(theta/2/Math.PI, 1, phi/Math.PI);
}
function qcolor(q) {
  return new THREE.Color().setHSL(Math.abs(q-1)*5/6, 1, 0.5);
}
function colorball(R=1, N=8) {
  var geometry = new THREE.IcosahedronGeometry(1);
  geometry.faceVertexUvs = [[]];
  for ( let face of geometry.faces )
    face.VertexNormals = [];
  Geometer.fly(geometry);
  Geometer.divideFaces(geometry, N);
  geometry.vertices = geometry.vertices.map(v => v.normalize());

  for ( let face of geometry.faces ) for ( let a of [0,1,2] ) {
    face.vertexNormals[a] = geometry.vertices[face[VERTICES[a]]].clone();
    face.vertexColors[a] = ncolor(face.vertexNormals[a]);
  }
  geometry.scale(R,R,R);

  var inner = new THREE.MeshBasicMaterial({color:0xFFFFFF});
  var sticker = new THREE.MeshLambertMaterial({color:0xFFFFFF, vertexColors:THREE.VertexColors});
  return new THREE.Mesh(geometry, [inner, sticker]);
}
function cube() {
  var geometry = new THREE.BoxGeometry(2,2,2);
  for ( let face of geometry.faces ) {
    face.color = ncolor(face.normal);
    face.materialIndex = 1;
  }
  var inner = new THREE.MeshBasicMaterial({color:0xFFFFFF});
  var sticker = new THREE.MeshLambertMaterial({color:0xFFFFFF, vertexColors:THREE.FaceColors});
  return new THREE.Mesh(geometry, [inner, sticker]);
}


class ModeledSphPuzzle extends SphPuzzle
{
  constructor(shape=colorball()) {
    var element = new SphElem();
    Geometer.fly(shape.geometry);
    element.shape = shape;
    shape.userData.raw = element;

    super(new SphAnalyzer(), [element]);

    this.rotated = new Set();
    this.reshaped = new Set();
  }

  mergeShapes(shape0, ...shapes) {
    for ( let shape of new Set(shapes) ) if ( shape !== shape0 ) {
      let quaternion = shape0.quaternion.clone().conjugate().multiply(shape.quaternion);
      let matrix = new THREE.Matrix4().makeRotationFromQuaternion(quaternion);
      Geometer.merge(shape0.geometry, shape.geometry, matrix);
    }
  }
  sliceShape(shape, plane, splitted_shape) {
    if ( splitted_shape ) {
      splitted_shape.material = shape.material.map(m => m.clone());
      splitted_shape.quaternion.copy(shape.quaternion);

      let res = Geometer.slice(shape.geometry, plane, splitted_shape.geometry);
      if ( res == 0 ) {
        Geometer.fillHoles(shape.geometry, plane.clone().negate());
        Geometer.fillHoles(splitted_shape.geometry, plane);
      } else if ( res < 0 ) {
        [shape.geometry, splitted_shape.geometry] = [splitted_shape.geometry, shape.geometry];
      }
      Geometer.land(shape.geometry);
      Geometer.land(splitted_shape.geometry);

      return res <= 0;

    } else {
      let res = Geometer.slice(shape.geometry, plane);
      if ( res == 0 )
        Geometer.fillHoles(shape.geometry, plane.clone().negate());
      else if ( res < 0 )
        shape.geometry = Geometer.fly(new THREE.Geometry());
      Geometer.land(shape.geometry);

      return res <= 0;
    }
  }

  onchange(modified) {
    super.onchange(modified);

    if ( this.rotated.size > 0 ) {
      for ( let target of this.rotated )
        this.trigger("rotated", target);
      this.rotated.clear();
    }
    if ( this.reshaped.size > 0 ) {
      for ( let target of this.reshaped )
        this.trigger("reshaped", target);
      this.reshaped.clear();
    }
  }

  rotate(q) {
    for ( let elem of target.elements ) {
      for ( let seg of elem.boundaries )
        seg.rotate(q);
      elem.shape.quaternion.premultiply(new THREE.Quaternion(...q));
      this.rotated.add(elem);
    }
    this.changed = true;
  }
  twist(track, theta, hold) {
    var partition = this.analyzer.rotationsOfTwist([[track, theta]], hold);

    super.twist(track, theta, hold);

    for ( let region of partition ) if ( region.rotation[3] != 1 )
      for ( let elem of region.elements ) {
        elem.shape.quaternion.premultiply(new THREE.Quaternion(...region.rotation));
        this.rotated.add(elem);
      }
  }

  mergeElements(element0, ...elements) {
    super.mergeElements(element0, ...elements);
    this.mergeShapes(element0.shape, ...elements.map(elem => elem.shape));
    this.reshaped.add(element0);
  }
  slice(center, radius, elements=this.elements.slice()) {
    this.network.setStatus("broken");

    var circle = new SphCircle({radius, orientation:q_align(center)});
    var plane0 = new THREE.Plane(new THREE.Vector3(...center).normalize(), -Math.cos(radius*Q));
    var new_bd = [];

    for ( let element of elements ) {
      let quaternion = element.shape.quaternion.clone().conjugate();
      let matrix = new THREE.Matrix4().makeRotationFromQuaternion(quaternion);
      let plane = plane0.clone().applyMatrix4(matrix);

      let [in_segs, out_segs, in_bd, out_bd] = this.analyzer.slice(element, circle);
      if ( in_segs.length && out_segs.length ) {
        for ( let seg of element.boundaries )
          this.add(seg);
        let [splitted] = element.split(out_segs);
        splitted.shape = new THREE.Mesh(Geometer.fly(new THREE.Geometry()));
        splitted.shape.userData.raw = splitted;
        let is_reshaped = this.sliceShape(element.shape, plane, splitted.shape);
      
        this.add(splitted);
        if ( is_reshaped )
          this.reshaped.add(element);
      
      } else if ( in_segs.length ) {
        let is_reshaped = this.sliceShape(element.shape, plane);
        if ( is_reshaped )
          this.reshaped.add(element);
      
      } else if ( out_segs.length ) {
        let is_reshaped = this.sliceShape(element.shape, plane.negate());
        if ( is_reshaped )
          this.reshaped.add(element);
      }

      new_bd.push(...in_bd, ...out_bd);
    }

    var track;
    if ( new_bd.length )
      if ( !new_bd[0].track )
        if ( track = this.analyzer.buildTrack(new_bd[0]) )
          this.add(track);

    for ( let track of this.tracks )
      delete track.secret;
    this.changed = true;

    return track;
  }
  cut(plane, elements=this.elements.slice()) {
    for ( let element of elements ) {
      let quaternion = element.shape.quaternion.clone().conjugate();
      let matrix = new THREE.Matrix4().makeRotationFromQuaternion(quaternion);
      let plane_ = plane.clone().applyMatrix4(matrix);

      let is_reshaped = this.sliceShape(element.shape, plane_);
      if ( is_reshaped )
        this.reshaped.add(element);
    }
  }
}

class ModeledSphPuzzleView
{
  constructor(display, puzzle, selector) {
    this.display = display;
    this.selector = selector;

    this.root = new THREE.Object3D();
    this.display.add(this.root);
    this.display.scene.addEventListener("click",
      event => event.originalEvent.ctrlKey && this.selector.reselect());

    this.mouseenter_handler = event => this.selector.preselection = event.target.userData.raw;
    this.mouseleave_handler = event => this.selector.preselection = undefined;
    this.click_handler = event => event.originalEvent.ctrlKey && this.selector.toggle();

    this.dragstart_handler = event => {
      if ( this.current_tiwster )
        this.current_tiwster.dragstart(event);
    };
    this.drag_handler = event => this.current_tiwster.drag(event);
    this.dragend_handler = event => {
      this.current_tiwster.dragend(event);
      this.current_tiwster = undefined;
    };

    this.twisters = [];
    this.current_twister = undefined;
    this.moving = undefined;
    this.display.dom.addEventListener("mousemove", event => {
      if ( event.buttons != 0 )
        return;

      if ( puzzle.status != "ready" || event.ctrlKey ) {
        this.current_tiwster = undefined;
        this.moving = undefined;
        return;
      }
      var drag_spot = this.display.spotOn(event.offsetX, event.offsetY);
      if ( !drag_spot.object || !(drag_spot.object.userData.raw instanceof SphElem) ) {
        this.current_tiwster = undefined;
        this.moving = undefined;
        return;
      }

      var p = drag_spot.point.toArray();
      for ( let twister of this.twisters )
        twister.dis = Math.abs(angleTo(twister.circle.center, p) - twister.circle.radius*Q);
      var twister = this.twisters.reduce((tw1, tw2) => tw1.dis<tw2.dis ? tw1 : tw2);

      this.current_tiwster = twister;
      this.moving = twister.raw.secret.regions.inner.has(drag_spot.object.userData.raw)
                  ? twister.raw.secret.regions.inner
                  : twister.raw.secret.regions.outer;
    });

    puzzle.model_view = this;
    this.raw = puzzle;
    puzzle.initialize(() => this.initView(puzzle));
    this.display.animate(this.hoverRoutine());
  }

  // 3D view
  initView(puzzle) {
    for ( let element of puzzle.elements )
      this.drawElement(element);
    for ( let track of puzzle.tracks )
      this.addTwister(track);
    this.updateTwisters();

    puzzle.on("added", SphElem, event => this.drawElement(event.target));
    puzzle.on("removed", SphElem, event => this.eraseElement(event.target));
    puzzle.on("added", SphTrack, event => this.addTwister(event.target));
    puzzle.on("removed", SphTrack, event => this.removeTwister(event.target));
    puzzle.on("statuschanged", puzzle, event => this.updateTwisters());
    puzzle.on("changed", puzzle, event => this.updateTwisters());
  }
  drawElement(element) {
    element.shape.userData.hoverable = true;
    element.shape.userData.draggable = true;
    element.shape.addEventListener("mouseenter", this.mouseenter_handler);
    element.shape.addEventListener("mouseleave", this.mouseleave_handler);
    element.shape.addEventListener("click", this.click_handler);
    element.shape.addEventListener("dragstart", this.dragstart_handler);
    element.shape.addEventListener("drag", this.drag_handler);
    element.shape.addEventListener("dragend", this.dragend_handler);
    element.shape.userData.current_tiwster = undefined;
    element.shape.material[1].emissive.set("hsl(60, 100%, 0%)");
    element.shape.material[1].emissiveIntensity = 0;

    this.display.add(element.shape, this.root);
  }
  eraseElement(element) {
    this.display.remove(element.shape, this.root);

    element.shape.removeEventListener("mouseenter", this.mouseenter_handler);
    element.shape.removeEventListener("mouseleave", this.mouseleave_handler);
    element.shape.removeEventListener("click", this.click_handler);
    element.shape.removeEventListener("dragstart", this.dragstart_handler);
    element.shape.removeEventListener("drag", this.drag_handler);
    element.shape.removeEventListener("dragend", this.dragend_handler);
  }
  addTwister(track) {
    // drag
    var plane, angle;

    var dragstart = event => {
      var p = event.point.toArray();

      track.twister.circle = track.circle;
      if ( track.secret.regions.outer === this.moving )
        track.twister.circle.complement();
      track.twister.circle.shift(track.twister.circle.thetaOf(p));

      var center = track.twister.circle.center;
      plane = new THREE.Plane(new THREE.Vector3(...center), -dot(center, p));

      for ( let elem of this.moving )
        elem.shape.userData.quaternion0 = elem.shape.quaternion.clone();

      event.drag = true;
      angle = 0;
    };
    var drag = event => {
      var {offsetX, offsetY} = event.originalEvent;
      var {point} = this.display.pointTo(offsetX, offsetY, plane);
      if ( !point ) return angle;
      var angle_ = track.twister.circle.thetaOf(point.toArray());
      if ( Number.isNaN(angle_) )
        return angle;

      angle = angle_;
      angle = fzy_mod(angle, 4, track.twister.shifts, 0.01);
      angle = fzy_mod(angle, 4, track.twister.shifts0, 0.05);
      angle = fzy_mod(angle, 4, [0], 0.05);
      var rot = new THREE.Quaternion().setFromAxisAngle(plane.normal, angle*Q);

      for ( let elem of this.moving )
        elem.shape.quaternion.multiplyQuaternions(rot, elem.shape.userData.quaternion0);

      return angle;
    };
    var dragend = event => {
      var angle = drag(event);

      for ( let elem of this.moving ) {
        elem.shape.quaternion.copy(elem.shape.userData.quaternion0);
        delete elem.shape.userData.quaternion0;
      }

      if ( angle !== 0 ) {
        var hold = this.raw.elements.find(elem => !this.moving.has(elem));
        this.raw.twist(track, angle, hold);
      }
    };

    track.twister = {dragstart, drag, dragend, raw:track};
  }
  removeTwister(track) {
    delete track.twister;
  }
  updateTwisters() {
    this.twisters = [];
    if ( this.raw.status == "ready" ) {
      for ( let track of this.raw.tracks ) if ( track.secret.regions ) {
        track.twister.circle = track.circle;
        track.twister.shifts = Array.from(track.secret.pseudokeys.keys())
            .map(kee => this.raw.analyzer.mod4(track.shift-kee)).sort();
        track.twister.shifts0 = Array.from(track.secret.passwords.keys())
            .map(key => this.raw.analyzer.mod4(track.shift-key)).sort();
        this.twisters.push(track.twister);
      }
    }
  }

  // hover/select feedback
  shapesOf(target) {
    if ( target instanceof SphElem ) {
      return target.shape ? [target.shape] : [];

    } else {
      return [];
    }
  }
  glow(shape) {
    if ( shape.userData.highlighted )
      shape.material[1].emissive.set("hsl(60, 100%, 50%)");
    else
      shape.material[1].emissive.set("hsl(60, 100%, 100%)");

    if ( shape.userData.emphasized && shape.userData.highlighted )
      shape.material[1].emissiveIntensity = 0.5;
    else if ( shape.userData.emphasized )
      shape.material[1].emissiveIntensity = 0.1;
    else if ( shape.userData.highlighted )
      shape.material[1].emissiveIntensity = 0.4;
    else
      shape.material[1].emissiveIntensity = 0;
  }
  emphasize(shape) {
    shape.userData.emphasized = true;
    this.glow(shape);
  }
  unemphasize(shape) {
    shape.userData.emphasized = false;
    this.glow(shape);
  }
  highlight(shape) {
    shape.userData.highlighted = true;
    this.glow(shape);
  }
  unhighlight(shape) {
    shape.userData.highlighted = false;
    this.glow(shape);
  }
  *hoverRoutine() {
    var preselection = undefined;
    var moving = [];
    var selected_shapes = [];
    while ( true ) {
      yield;

      // emphasize moving shapes
      if ( this.moving !== moving ) {
        for ( let shape of this.shapesOf(preselection) )
          this.unemphasize(shape);
        preselection = undefined;

        if ( moving ) for ( let elem of moving ) if ( elem.shape )
          this.unemphasize(elem.shape);
        if ( this.moving ) for ( let elem of this.moving ) if ( elem.shape )
          this.emphasize(elem.shape);
        moving = this.moving;
      }

      // emphasize hovered shape
      if ( this.moving === undefined && this.selector.preselection !== preselection ) {
        for ( let shape of this.shapesOf(preselection) )
          this.unemphasize(shape);
        for ( let shape of this.shapesOf(this.selector.preselection) )
          this.emphasize(shape);
        preselection = this.selector.preselection;
      }

      // highlight selected shapes
      let new_selected_shapes = this.selector.selections
        .flatMap(sel => this.shapesOf(sel));

      for ( let shape of selected_shapes )
        if ( !new_selected_shapes.includes(shape) )
          this.unhighlight(shape);
      for ( let shape of new_selected_shapes )
        if ( !selected_shapes.includes(shape) )
          this.highlight(shape);

      selected_shapes = new_selected_shapes;
    }
  }
}

class ModeledSphPuzzleWorld
{
  constructor(puzzle, id_display) {
    this.puzzle = puzzle;
    this.selector = new Selector();

    var dom = document.getElementById(id_display);
    var display = new Display(dom, dom.clientWidth, dom.clientHeight);
    new ModeledSphPuzzleView(display, this.puzzle, this.selector);
  }
}
