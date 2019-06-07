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

    var circle = new SphCircle({radius, orientation:q_align(center)});
    for ( let element of this.brep.elements.slice() )
      this.sliceElement(element, circle, knife);

    for ( let track of this.brep.tracks.slice().reverse() ) {
      let circle = track.circle;

      if ( this.analyzer.cmp(radius, circle.radius) == 0
           && this.analyzer.cmp(center, circle.center) == 0 )
        return track;

      if ( this.analyzer.cmp(radius, 2-circle.radius) == 0
           && this.analyzer.cmp(center, circle.center.map(x => -x)) == 0 )
        return track;
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

class ModeledSphPuzzleView
{
  constructor(display, brep, selector) {
    this.display = display;
    this.selector = selector;
    this.raw = brep;
    brep.model_view = this;

    this.root = new THREE.Object3D();
    this.display.add(this.root);

    // select
    this.display.scene.addEventListener("click",
      event => event.originalEvent.ctrlKey && this.selector.reselect());
    this.click_handler = event => event.originalEvent.ctrlKey && this.selector.toggle();

    // drag
    this.dragstart_handler = event => {
      if ( this.current_twister )
        this.current_twister.dragstart(event);
    };
    this.drag_handler = event => this.current_twister.drag(event);
    this.dragend_handler = event => {
      this.current_twister.dragend(event);
      this.current_twister = undefined;
      this.moving = undefined;
    };

    // hover
    this.twisters = [];
    this.current_twister = undefined;
    this.moving = undefined;
    this.twist_center = undefined;
    this.display.dom.addEventListener("mousemove", event => {
      if ( event.buttons != 0 )
        return;

      var drag_spot = this.display.spotOn(event.offsetX, event.offsetY);
      if ( !drag_spot.object || !(drag_spot.object.userData.raw instanceof SphElem) ) {
        this.selector.preselection = undefined;
        this.current_twister = undefined;
        this.moving = undefined;
        this.twist_center = undefined;
        return;
      }

      var target = drag_spot.object.userData.raw;
      if ( brep.status != "ready" || event.ctrlKey ) {
        this.selector.preselection = target;
        this.current_twister = undefined;
        this.moving = undefined;
        this.twist_center = undefined;
        return;
      }

      var p = drag_spot.point.toArray();
      var dis0 = Infinity;
      this.current_twister = undefined;
      this.moving = undefined;
      this.twist_center = undefined;

      for ( let [twister, center, region] of this.twisters )
        if ( region.has(target) ) {
          var dis = angleTo(center, p);
          if ( dis < dis0 ) {
            dis0 = dis;
            this.current_twister = twister;
            this.moving = region;
            this.twist_center = center;
          }
        }
    });

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
    var mat = new THREE.MeshLambertMaterial({color:0xFFFFFF, vertexColors:THREE.FaceColors});
    element.model_view = new THREE.Mesh(geo, mat);
    element.model_view.userData.raw = element;
    element.model_view.material.emissive.set("hsl(60, 100%, 0%)");
    element.model_view.material.emissiveIntensity = 0;

    element.model_view.quaternion.set(...element.orientation);
    element.model_view.userData.hoverable = true;
    element.model_view.userData.draggable = true;
    element.model_view.addEventListener("click", this.click_handler);
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
    // drag
    var circle, plane, angle;

    var dragstart = event => {
      var p = event.point.toArray();
      circle = this.current_twister.raw.circle;
      circle.shift(circle.thetaOf(p));
      plane = new THREE.Plane(new THREE.Vector3(...this.twist_center),
                              -dot(this.twist_center, p));

      for ( let elem of this.moving )
        elem.model_view.userData.quaternion0 = elem.model_view.quaternion.clone();

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

      angle = angle + fzy_mod(angle_-angle+2, 4) - 2;
      angle = fzy_mod(angle, 8, this.current_twister.shifts, 0.01);
      angle = fzy_mod(angle, 8, this.current_twister.shifts0, 0.05);
      angle = fzy_mod(angle, 8, [0, 4], 0.05);
      var rot = new THREE.Quaternion().setFromAxisAngle(plane.normal, angle*Q);

      for ( let elem of this.moving )
        elem.model_view.quaternion.multiplyQuaternions(rot, elem.model_view.userData.quaternion0);

      return angle;
    };
    var dragend = event => {
      var angle = drag(event);

      if ( angle !== 0 ) {
        var hold = this.raw.elements.find(elem => !this.moving.has(elem));
        this.raw.host.twist(track, angle, hold);
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
        track.twister.shifts = Array.from(track.secret.pseudokeys.keys())
            .map(kee => this.raw.analyzer.mod4(track.shift-kee)).sort();
        track.twister.shifts.push(...track.twister.shifts.map(kee => kee+4));
        track.twister.shifts0 = Array.from(track.secret.passwords.keys())
            .map(key => this.raw.analyzer.mod4(track.shift-key)).sort();
        track.twister.shifts0.push(...track.twister.shifts0.map(kee => kee+4));
        track.twister.circle = track.circle;

        this.twisters.push([track.twister, track.circle.center, track.secret.regions.inner]);
        if ( track.circle.radius == 1 )
          this.twisters.push([track.twister, track.circle.center.map(x => -x), track.secret.regions.outer]);
      }
    }
  }

  // hover/select feedback
  viewsOf(target) {
    if ( target instanceof SphElem ) {
      return target.model_view ? [target.model_view] : [];

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
    var moving = [];
    var selected_views = [];
    while ( true ) {
      yield;

      // emphasize moving views
      if ( this.moving !== moving ) {
        for ( let view of this.viewsOf(preselection) )
          this.unemphasize(view);
        preselection = undefined;

        if ( moving ) for ( let elem of moving ) if ( elem.model_view )
          this.unemphasize(elem.model_view);
        if ( this.moving ) for ( let elem of this.moving ) if ( elem.model_view )
          this.emphasize(elem.model_view);
        moving = this.moving;
      }

      // emphasize hovered view
      if ( this.moving === undefined && this.selector.preselection !== preselection ) {
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

class ModeledSphPuzzleWorld
{
  constructor(puzzle, id_display) {
    this.puzzle = puzzle;
    this.selector = new Selector();

    var dom = document.getElementById(id_display);
    var display = new Display(dom);
    this.model_view = new ModeledSphPuzzleView(display, this.puzzle.brep, this.selector);
  }
}
