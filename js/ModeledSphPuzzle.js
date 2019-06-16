"use strict";

const {CSG} = require("@jscad/csg");

function fromGeometry(geometry) {
  if ( geometry instanceof THREE.BufferGeometry )
    geometry = new THREE.Geometry().fromBufferGeometry(geometry);
  var polygons = [];
  for ( let face of geometry.faces ) {
    let vertices = ["a", "b", "c"].map(a => geometry.vertices[face[a]])
                                  .map(v => new CSG.Vertex(new CSG.Vector3D(v)));
    polygons.push(new CSG.Polygon(vertices));
  }
  return CSG.fromPolygons(polygons);
}
function toGeometry(csg) {
  var geometry = new THREE.Geometry();
  for ( let polygon of csg.toTriangles() ) {
    let vs = polygon.vertices.map(v => geometry.vertices.push(new THREE.Vector3().copy(v.pos))-1);
    let face = new THREE.Face3(...vs, new THREE.Vector3().copy(polygon.plane.normal));
    if ( polygon.shared.color )
      face.color = new THREE.Color(...polygon.shared.color);
    geometry.faces.push(face);
  }
  return geometry;
}
function rotateCSG(csg, q) {
  var mat = new THREE.Matrix4().makeRotationFromQuaternion(new THREE.Quaternion(...q));
  mat = new CSG.Matrix4x4(mat.toArray());
  return csg.transform(mat);
}


class ModeledSphPuzzle extends SphPuzzle
{
  constructor(shape=CSG.sphere({resolution:32})) {
    var element = new SphElem();
    element.shape = shape;
    element.orientation = [0,0,0,1];

    super(new SphAnalyzer(), [element]);
    this.brep.ELEM_PROP.shape = elem => elem.shape;
    this.brep.ELEM_PROP.orientation = elem => Array.from(elem.orientation);
  }

  rotate(q) {
    for ( let elem of target.elements ) {
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
      var plane = new CSG.Plane(new CSG.Vector3D(center).unit(), Math.cos(radius*Q));
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
  cut(knife) {
    for ( let element of this.brep.elements ) {
      let knife_ = rotateCSG(knife, q_inv(element.orientation));
      element.shape = element.shape.intersect(knife_);
    }
    this.brep.changed = true;
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
    var mat = new THREE.MeshLambertMaterial({color:0xFFFFFF, vertexColors:THREE.FaceColors,
                                             transparent:false, opacity:0.4});
    element.model_view = new THREE.Mesh(geo, mat);
    element.model_view.userData.raw = element;
    element.model_view.material.emissive.set("hsl(60, 100%, 0%)");
    element.model_view.material.emissiveIntensity = 0;

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
      let geo = new THREE.IcosahedronGeometry(0.999, 5);
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
        for ( let sub of event.target.view.children )
          sub.material.color.set(event.target.track ? "red" : "black");
    });
  }
  drawSegment(seg) {
    var color = seg.track ? "red" : "black";
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
    obj.children[3].material.opacity = 0.3;
  }
  unhighlight(obj) {
    obj.children[3].material.opacity = 0;
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
}
