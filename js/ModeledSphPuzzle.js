"use strict";

const {CSG} = require("@jscad/csg");

function toGeometry(csg) {
  var index = 0;
  var vertices = [];
  var indices = [];
  var colors = [];

  for ( let polygon of csg.toTriangles() ) {
    // console.log(polygon);
    for ( let vertex of polygon.vertices ) {
      vertices.push(vertex.pos.x, vertex.pos.y, vertex.pos.z);
      if ( polygon.shared.color )
        colors.push(polygon.shared.color[0], polygon.shared.color[1], polygon.shared.color[2], polygon.shared.color[3] ?? 1);
      else
        colors.push(1, 1, 1, 1);
      indices.push(index);
      index += 1;
    }
  }

  var geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 4));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}
function rotateCSG(csg, q) {
  var mat = new THREE.Matrix4().makeRotationFromQuaternion(new THREE.Quaternion(...q));
  mat = new CSG.Matrix4x4(mat.toArray());
  return csg.transform(mat);
}


class ModeledSphPuzzle extends SphPuzzle
{
  constructor(shape=CSG.sphere({resolution:32}), R=1) {
    var element = new SphElem();
    element.shape = shape;
    element.orientation = [0,0,0,1];

    super(new SphAnalyzer(), [element]);
    this.R = R;
    this.brep.ELEM_PROP.shape = elem => elem.shape;
    this.brep.ELEM_PROP.orientation = elem => Array.from(elem.orientation);
  }

  rotate(q) {
    for ( let elem of this.brep.elements ) {
      for ( let seg of elem.boundaries )
        seg.rotate(q);
      q_mul(quaternion, elem.orientation, elem.orientation);
    }
    this.brep.changed = true;
  }
  twist(track, theta, hold) {
    var partition = this.analyzer.rotationsOfTwist([[track, theta]], hold);

    super.twist(track, theta, hold);
    for ( let region of partition ) if ( region.rotation[3] != 1 )
      for ( let elem of region.elements )
        q_mul(region.rotation, elem.orientation, elem.orientation);
    this.brep.changed = true;
  }

  mergeElements(...elements) {
    elements = Array.from(new Set(elements));
    if ( elements.length <= 1 )
      return;
    super.mergeElements(...elements);
    var q0 = q_inv(elements[0].orientation);
    var shapes = elements.slice(1).map(elem => rotateCSG(elem.shape, q_mul(q0, elem.orientation)));
    elements[0].shape = elements[0].shape.union(...shapes);
    this.brep.changed = true;
  }
  sliceElement(element, circle, knife) {
    var [inner, outer] = super.sliceElement(element, circle);

    if ( !knife ) {
      var plane = new CSG.Plane(new CSG.Vector3D(circle.center).unit(), this.R*Math.cos(circle.radius*Q));
      var plane_ = plane.flipped();
      knife = [plane, plane_];
    }
    if ( Array.isArray(knife) )
      knife = knife.map(plane => rotateCSG(plane, q_inv(element.orientation)));
    else
      knife = rotateCSG(knife, q_inv(element.orientation));

    if ( inner && outer ) {
      if ( Array.isArray(knife) ) {
        outer.shape = element.shape.cutByPlane(knife[0]);
        inner.shape = element.shape.cutByPlane(knife[1]);
        outer.orientation = element.orientation.slice();
      } else {
        outer.shape = element.shape.subtract(knife);
        inner.shape = element.shape.intersect(knife);
        outer.orientation = element.orientation.slice();
      }
      this.brep.changed = true;

    } else if ( inner ) {
      if ( Array.isArray(knife) )
        inner.shape = element.shape.cutByPlane(knife[1]);
      else
        inner.shape = element.shape.intersect(knife);
      this.brep.changed = true;

    } else if ( outer ) {
      if ( Array.isArray(knife) )
        outer.shape = element.shape.cutByPlane(knife[0]);
      else
        outer.shape = element.shape.subtract(knife);
      this.brep.changed = true;

    }

    return [inner, outer];
  }
  slice(center, radius, knife) {
    if ( !knife ) {
      var plane = new CSG.Plane(new CSG.Vector3D(center).unit(), this.R*Math.cos(radius*Q));
      var plane_ = plane.flipped();
      knife = [plane, plane_];
    }

    center = normalize(center);
    var circle = new SphCircle({radius, orientation:q_align(center)});
    for ( let element of this.brep.elements.slice() )
      this.sliceElement(element, circle, knife);

    for ( let seg of this.brep.segments ) {
      if ( this.analyzer.cmp(radius, seg.radius) == 0
           && this.analyzer.cmp(center, seg.circle.center) == 0 ) {
        if ( !seg.track )
          this.brep.add(this.analyzer.buildTrack(seg));
        return seg.track;
      }
    }
  }
  cut(knife, side=+1) {
    for ( let element of this.brep.elements ) {
      let knife_ = rotateCSG(knife, q_inv(element.orientation));
      if ( side > 0 )
        element.shape = element.shape.intersect(knife_);
      else
        element.shape = element.shape.subtract(knife_);
    }
    this.brep.changed = true;
  }

  bounds() {
    return Math.max(...this.brep.elements
                       .map(elem => elem.shape.getBounds())
                       .map(([v1, v2]) => v1.abs().max(v2.abs())).length());
  }
  sliceByPlane(direction, distance) {
    var center = normalize(direction);
    var radius = Math.acos(distance/this.R)/Q;
    if ( Number.isNaN(radius) )
      return [];
    return this.slice(center, radius);
  }
  sliceBySphere(center, radius, resolution=32) {
    var center_ = normalize(center);
    var dis = norm(center);
    var radius_ = Math.acos((dis*dis + this.R*this.R - radius*radius)/(2*dis*this.R))/Q;
    if ( Number.isNaN(radius_) )
      return [];

    var sphere = CSG.sphere({center, radius, resolution});
    return this.slice(center_, radius_, sphere);
  }
  cutByPlane(direction, distance, color) {
    var r = this.bounds();
    if ( distance > r || distance < -r )
      return;

    var q = q_align(direction);
    var axis = normalize(q);
    var angle = Math.atan2(norm(q), q[3])*2/Q*90;
    var knife = CSG.cube({center: [0, 0, distance-r-0.1], radius: [r+0.1, r+0.1, r+0.1]})
                   .rotate([0,0,0], axis, angle);
    if ( color )
      knife.setColor(color);

    this.cut(knife);
  }
  cutBySphere(center, radius, resolution=32, color) {
    var knife;
    if ( radius < 0 )
      knife = CSG.sphere({center, radius:-radius, resolution});
    else
      knife = CSG.sphere({center, radius, resolution});
    if ( color )
      knife.setColor(color);

    this.cut(knife, Math.sign(radius));
  }
}

class ModeledSimpleTwister
{
  constructor(display, track, side="inner") {
    // drag
    this.display = display;
    this.raw = track;
    this.side = side;

    this.update();
  }

  update() {
    if ( this.raw.host.status!="ready" || !this.raw.secret || !this.raw.secret.regions ) {
      this.shifts = undefined;
      this.shifts0 = undefined;
      this.circle = undefined;
      this.center = undefined;
      this.region = undefined;

      this.plane = undefined;
      this.angle = undefined;
      this.sticked = undefined;
      this.twistable = false;

      return;
    }

    this.shifts = Array.from(this.raw.secret.pseudokeys.keys())
        .map(kee => this.raw.host.analyzer.mod4(this.raw.shift-kee, [0])).sort();

    this.shifts0 = Array.from(this.raw.secret.passwords.keys())
        .map(key => this.raw.host.analyzer.mod4(this.raw.shift-key, [0])).sort();

    if ( this.side == "inner" ) {
      this.circle = this.raw.circle;
      this.center = this.circle.center;
      this.region = this.raw.secret.regions.inner;
    } else {
      this.circle = this.raw.circle.complement();
      this.center = this.circle.center;
      this.region = this.raw.secret.regions.outer;
    }

    this.plane = undefined;
    this.angle = undefined;
    this.sticked = undefined;
    this.twistable = true;
  }
  get targets() {
    return Array.from(this.region).map(elem => elem.model_view);
  }
  snap(ang, angle0, sticked) {
    if ( Number.isNaN(ang) )
      return angle0;

    ang = fzy_mod(ang, 4, this.shifts, 0.01);
    ang = fzy_mod(ang, 4, this.shifts0, 0.05);
    if ( sticked )
      ang = fzy_mod(ang, 4, [angle0], 0.05);

    return ang;
  }
  twist(angle) {
    return new Promise((resolve, reject) => {
      requestAnimationFrame(() => {
        try {
          var hold = this.raw.host.elements.find(elem => !this.region.has(elem));
          this.raw.host.host.twist(this.raw, angle, hold);
          this.raw.host.once("changed", this.raw.host, event => resolve());

        } catch ( err ) {
          reject(err);
        }
      });
    });
  }
  async twistAnimated(angle) {
    this.angle = angle;
    var axis = new THREE.Vector3(...this.center);
    var routine = this.display.animatedRotateRoutine(this.targets, axis, this.angle*Q, 10);
    await this.display.animate(routine);
    await this.twist(this.angle);
  }

  dragstart(event) {
    this.circle.shift(this.circle.thetaOf(event.point.toArray()));
    this.plane = new THREE.Plane(new THREE.Vector3(...this.center),
                                 -dot(this.center, event.point.toArray()));
    for ( let obj of this.targets )
      obj.userData.quaternion0 = obj.quaternion.clone();
    event.drag = true;
    this.angle = 0;
    this.sticked = true;
  }
  drag(event) {
    var {offsetX, offsetY} = event.originalEvent;
    var {point} = this.display.pointTo(offsetX, offsetY, this.plane);
    if ( !point ) return;
    this.angle = this.snap(this.circle.thetaOf(point.toArray()), this.angle, this.sticked);
    if ( this.angle != 0 )
      this.sticked = false;

    var rot = new THREE.Quaternion().setFromAxisAngle(this.plane.normal, this.angle*Q);

    for ( let obj of this.targets )
      obj.quaternion.multiplyQuaternions(rot, obj.userData.quaternion0);
  }
  async dragend(event) {
    if ( this.angle !== 0 )
      await this.twist(this.angle);
  }
  async click(event) {
    if ( event.originalEvent.button == 0 )
      this.angle = this.raw.host.analyzer.mod4(this.shifts0.find(ang => ang != 0));
    else
      this.angle = -this.raw.host.analyzer.mod4(-this.shifts0.slice().reverse().find(ang => ang != 0));
    if ( this.angle === undefined || Number.isNaN(this.angle) )
      return;

    var axis = new THREE.Vector3(...this.center);
    var routine = this.display.animatedRotateRoutine(this.targets, axis, this.angle*Q, 10);
    await this.display.animate(routine);
    await this.twist(this.angle);
  }
}

class ModeledSphPuzzleView
{
  constructor(display, brep, selector) {
    this.display = display;
    this.selector = selector;
    this.raw = brep;
    brep.model_view = this;

    this.root = new THREE.Group();
    this.display.add(this.root);

    this.status = "explore";
    this.twisters = [];
    this.current_twister = undefined;

    // hover
    this.mouseleave_handler = event => this.selector.preselection = undefined;
    this.mouseover_handler = event => {
      if ( event.originalEvent.buttons != 0 || this.status != "explore" )
        return;

      var target = event.target.userData.raw;
      if ( event.originalEvent.ctrlKey ) {
        this.selector.preselection = target;
        return;
      }

      if ( this.raw.status != "ready" )
        return;

      var p = event.point.toArray();
      var dis0 = Infinity;
      for ( let twister of this.twisters ) if ( twister.region.has(target) ) {
        var dis = angleTo(twister.center, p);
        if ( dis < dis0 ) {
          dis0 = dis;
          this.selector.preselection = twister;
        }
      }
    };

    // select
    this.display.scene.addEventListener("click",
      event => event.originalEvent.ctrlKey && this.status=="explore" && this.selector.reselect());
    this.click_handler = event => {
      if ( this.status != "explore" )
        return;

      if ( event.originalEvent.ctrlKey ) {
        this.selector.toggle();

      } else if ( this.selector.preselection instanceof ModeledSimpleTwister ) {
        if ( ![0, 2].includes(event.originalEvent.button) )
          return;

        this.status = "twist";
        this.current_twister = this.selector.preselection;
        this.current_twister.click(event).then(() => {
          this.status = "explore";
          this.current_twister = undefined;
        });
      }
    };

    // drag
    this.dragstart_handler = event => {
      if ( this.status != "explore" )
        return;

      if ( this.selector.preselection instanceof ModeledSimpleTwister ) {
        this.status = "drag";
        this.current_twister = this.selector.preselection;
        this.current_twister.dragstart(event);
      }
    };
    this.drag_handler = event => {
      if ( this.status != "drag" )
        throw new Error();

      this.current_twister.drag(event);
    };
    this.dragend_handler = event => {
      if ( this.status != "drag" )
        throw new Error();

      this.current_twister.dragend(event).then(() => {
        this.status = "explore";
        this.current_twister = undefined;
      });
    };

    brep.initialize(() => this.initView(brep));
    this.display.animate(this.hoverRoutine());
  }

  // 3D view
  initView(brep) {
    for ( let element of brep.elements )
      this.drawElement(element);
    for ( let track of brep.tracks )
      this.addTwister(track);
    this.updateTwisters();

    brep.on("added", SphElem, event => this.drawElement(event.target));
    brep.on("removed", SphElem, event => this.eraseElement(event.target));
    brep.on("modified", SphElem, event => {
      if ( "shape" in event.record ) {
        this.eraseElement(event.target);
        this.drawElement(event.target);
      }
      if ( "orientation" in event.record ) {
        this.rotateElement(event.target);
      }
    });
    brep.on("added", SphTrack, event => this.addTwister(event.target));
    brep.on("removed", SphTrack, event => this.removeTwister(event.target));
    brep.on("statuschanged", brep, event => this.updateTwisters());
    brep.on("changed", brep, event => this.updateTwisters());
  }
  drawElement(element) {
    var geo = toGeometry(element.shape);
    var mat = new THREE.MeshLambertMaterial({color:0xFFFFFF, vertexColors:true, transparent:false, opacity:0.4});
    mat.emissive.set("hsl(60, 100%, 0%)");
    mat.emissiveIntensity = 0.0;
    element.model_view = new THREE.Mesh(geo, mat);
    element.model_view.userData.raw = element;

    element.model_view.quaternion.set(...element.orientation);
    element.model_view.userData.hoverable = true;
    element.model_view.userData.draggable = true;
    element.model_view.addEventListener("click", this.click_handler);
    element.model_view.addEventListener("mouseover", this.mouseover_handler);
    element.model_view.addEventListener("mouseleave", this.mouseleave_handler);
    element.model_view.addEventListener("dragstart", this.dragstart_handler);
    element.model_view.addEventListener("drag", this.drag_handler);
    element.model_view.addEventListener("dragend", this.dragend_handler);

    this.display.add(element.model_view, this.root);
  }
  rotateElement(element) {
    element.model_view.quaternion.set(...element.orientation);
  }
  eraseElement(element) {
    this.display.remove(element.model_view, this.root);

    element.model_view.removeEventListener("click", this.click_handler);
    element.model_view.removeEventListener("dragstart", this.dragstart_handler);
    element.model_view.removeEventListener("drag", this.drag_handler);
    element.model_view.removeEventListener("dragend", this.dragend_handler);
  }
  addTwister(track) {
    track.twisters = [];
    track.twisters.push(new ModeledSimpleTwister(this.display, track, "inner"));
    track.twisters[0].name = `${track.name || "<SphTrack>"}.twisters[0]`;
    if ( track.circle.radius == 1 ) {
      track.twisters.push(new ModeledSimpleTwister(this.display, track, "outer"));
      track.twisters[1].name = `${track.name || "<SphTrack>"}.twisters[1]`;
    }
  }
  removeTwister(track) {
    delete track.twisters;
  }
  updateTwisters() {
    this.twisters = [];
    for ( let track of this.raw.tracks )
      for ( let twister of track.twisters ) {
        twister.update();
        if ( twister.twistable )
          this.twisters.push(twister);
      }
  }

  // hover/select feedback
  viewsOf(target) {
    if ( target instanceof SphElem ) {
      return target.model_view ? [target.model_view] : [];

    } else if ( target instanceof ModeledSimpleTwister ) {
      return target.targets || [];

    } else {
      return [];
    }
  }
  glow(view) {
    if ( view.userData.highlighted )
      view.material.emissive.set("hsl(60, 100%, 50%)");
    else
      view.material.emissive.set("hsl(60, 100%, 100%)");

    if ( view.userData.emphasized && view.userData.highlighted )
      view.material.emissiveIntensity = 0.5;
    else if ( view.userData.emphasized )
      view.material.emissiveIntensity = 0.1;
    else if ( view.userData.highlighted )
      view.material.emissiveIntensity = 0.4;
    else
      view.material.emissiveIntensity = 0;
  }
  emphasize(view) {
    view.userData.emphasized = true;
    this.glow(view);
  }
  unemphasize(view) {
    view.userData.emphasized = false;
    this.glow(view);
  }
  highlight(view) {
    view.userData.highlighted = true;
    this.glow(view);
  }
  unhighlight(view) {
    view.userData.highlighted = false;
    this.glow(view);
  }
  *hoverRoutine() {
    var preselection = undefined;
    var selected_views = [];
    while ( true ) {
      yield;

      // emphasize hovered view
      if ( this.selector.preselection !== preselection ) {
        for ( let view of this.viewsOf(preselection) )
          this.unemphasize(view);
        for ( let view of this.viewsOf(this.selector.preselection) )
          this.emphasize(view);
        preselection = this.selector.preselection;
      }

      // highlight selected views
      let new_selected_views = this.selector.selections
        .flatMap(sel => this.viewsOf(sel));

      for ( let view of selected_views )
        if ( !new_selected_views.includes(view) )
          this.unhighlight(view);
      for ( let view of new_selected_views )
        if ( !selected_views.includes(view) )
          this.highlight(view);

      selected_views = new_selected_views;
    }
  }
}

class ModeledSphBREPView
{
  constructor(display, brep, selector) {
    this.display = display;
    this.selector = selector;
    this.origin = brep;
    brep.view = this;

    // BREP view
    this.root = new THREE.Group();
    this.display.add(this.root);

    {
      let geo = new THREE.IcosahedronGeometry(this.origin.host.R*0.999, 5);
      let mat = new THREE.MeshLambertMaterial({color:0xffffff});
      this.ball = new THREE.Mesh(geo, mat);
      this.display.add(this.ball, this.root);
    }

    brep.initialize(() => this.initView(brep));
    this.display.animate(this.hoverRoutine());
  }

  // 3D view
  initView(brep) {
    for ( let segment of brep.segments )
      this.drawSegment(segment);

    brep.on("added", SphSeg, event => this.drawSegment(event.target));
    brep.on("removed", SphSeg, event => this.eraseSegment(event.target));
    brep.on("modified", SphSeg, event => {
      if ( "arc" in event.record || "radius" in event.record || "angle" in event.record ) {
        this.eraseSegment(event.target);
        this.drawSegment(event.target);
      }
      if ( "orientation" in event.record )
        event.target.view.quaternion.set(...event.target.orientation);
      if ( "track" in event.record )
        event.target.view.children[0].material.color.set(event.target.track ? "red" : "black");
    });
  }
  drawSegment(seg) {
    var dq = 0.01;

    // make arc
    {
      let s = Math.sin(seg.radius*Q), c = Math.cos(seg.radius*Q);
      let da = dq*s;
      let v0 = new THREE.Vector3(s, 0, c);
      let center = new THREE.Vector3(0,0,1);
      let v1 = v0.clone().applyAxisAngle(center, seg.arc*Q);
      let points = Array.from(
        {length:Math.floor(seg.arc/da)+1},
        (_, i) => v0.clone().applyAxisAngle(center, i*da*Q));
      points.push(v1);

      let geo = new THREE.BufferGeometry().setFromPoints(points);
      let mat = new THREE.LineBasicMaterial({color: (seg.track ? "red" : "black")});
      var arc = new THREE.Line(geo, mat);
      arc.name = "arc";
    }

    // make dash
    {
      let s = Math.sin((seg.radius-dq)*Q), c = Math.cos((seg.radius-dq)*Q);
      let da = dq*s;
      let v0_ = new THREE.Vector3(s, 0, c);
      let center = new THREE.Vector3(0,0,1);
      let v0 = v0_.clone().applyAxisAngle(center, dq*Q);
      let v1 = v0_.clone().applyAxisAngle(center, (seg.arc-dq)*Q);
      let points = Array.from(
        {length:Math.floor((seg.arc-2*dq)/da)+1},
        (_, i) => v0.clone().applyAxisAngle(center, i*da*Q));
      points.push(v1);

      let geo = new THREE.BufferGeometry().setFromPoints(points);
      let mat = new THREE.LineDashedMaterial({color: "blue", dashSize: dq*Q/2, gapSize: dq*Q/2});
      var dash = new THREE.Line(geo, mat);
      dash.computeLineDistances();
      dash.name = "dash";
      dash.visible = false;
    }

    var obj = new THREE.Object3D();
    obj.add(arc, dash);
    obj.scale.set(this.origin.host.R, this.origin.host.R, this.origin.host.R);
    obj.quaternion.set(...seg.orientation);

    seg.view = obj;
    obj.userData.origin = seg;
    this.display.add(seg.view, this.root);
  }
  eraseSegment(seg) {
    this.display.remove(seg.view, this.root);
    delete seg.view;
  }

  // hover/select feedback
  objsOf(target) {
    if ( target instanceof SphElem ) {
      return Array.from(target.boundaries)
                  .map(seg => seg.view).filter(view => view);

    } else {
      return [];
    }
  }
  highlight(obj) {
    obj.children[1].visible = true;
  }
  unhighlight(obj) {
    obj.children[1].visible = false;
  }
  *hoverRoutine() {
    var selected_objs = [];
    while ( true ) {
      yield;

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

class ModeledSphPuzzleWorld
{
  constructor(puzzle, id_display) {
    this.puzzle = puzzle;
    this.selector = new Selector();

    var dom = document.getElementById(id_display);
    this.display = new Display(dom);
    this.model_view = new ModeledSphPuzzleView(this.display, this.puzzle.brep, this.selector);
    this.brep_view = new ModeledSphBREPView(this.display, this.puzzle.brep, this.selector);
    this.brep_view.root.visible = false;
    window.addEventListener("keydown", event => {
      if ( event.key == " " ) {
        if ( this.brep_view.root.visible ) {
          this.brep_view.root.visible = false;
          for ( let elem of puzzle.brep.elements )
            elem.model_view.material.transparent = false;

        } else {
          this.brep_view.root.visible = true;
          for ( let elem of puzzle.brep.elements )
            elem.model_view.material.transparent = true;

        }
      }
    });
  }

  async twistAnimated(axis, angle, snap = true) {
    var dis0 = 0.05;
    var selected_twister = undefined;
    for ( let twister of this.model_view.twisters ) {
      var dis = angleTo(twister.center, axis);
      if ( dis < dis0 ) {
        dis0 = dis;
        selected_twister = twister;
      }
    }
    if ( selected_twister === undefined ) {
      throw new Error(`fail to twist axis=[${axis}]`);
    }
    if ( snap ) {
      // snap but preserving turn
      let turn = angle / 4;
      angle = angle - turn * 4;
      if ( angle < 0 ) {
        turn -= 1;
        angle += 4;
      }
      angle = selected_twister.snap(angle, angle, false);
      if ( !selected_twister.shifts0.includes(angle) && !selected_twister.shifts.includes(angle) ) {
        throw new Error(`fail to twist axis=[${axis}] with angle ${angle}`);
      }
      angle += turn * 4;
    }
    await selected_twister.twistAnimated(angle);
  }

  async rotateAnimated(axis, angle) {
    function *rotateTrackball(trackball, axis, angle, speed) {
      axis = new THREE.Vector3(...axis).normalize();
      var prev_angle = 0;
      var curr_angle = 0;
      var t0, t;
      if ( angle < 0 ) {
        angle = -angle;
        axis = axis.clone().negate();
      }

      t0 = yield;
      while ( curr_angle < angle ) {
        let t = yield;
        curr_angle = Math.min(curr_angle + speed*(t-t0)/1000, angle);
        t0 = t;

        trackball.rotateOnAxis(axis, -(curr_angle - prev_angle));
        prev_angle = curr_angle;
      }
    }
    axis = rotate(axis, q_inv(this.display.trackball.quaternion.toArray()));
    var routine = rotateTrackball(this.display.trackball, axis, angle*Q, 10);
    await this.display.animate(routine);
  }
}
