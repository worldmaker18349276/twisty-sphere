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


class ModeledSphPuzzle extends SphPuzzle
{
  constructor(shape=CSG.sphere({resolution:32})) {
    var element = new SphElem();
    element.shape = shape;

    super(new SphAnalyzer(), [element]);

    this.rotated = new Set();
    this.reshaped = new Set();
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
    var mat = new THREE.Matrix4().makeRotationFromQuaternion(new THREE.Quaternion(...q));
    mat = new CSG.Matrix4x4(mat.toArray());
    for ( let elem of target.elements ) {
      for ( let seg of elem.boundaries )
        seg.rotate(q);
      elem.shape = elem.shape.transform(mat);
      this.rotated.add(elem);
    }
    this.changed = true;
  }
  twist(track, theta, hold) {
    var partition = this.analyzer.rotationsOfTwist([[track, theta]], hold);

    super.twist(track, theta, hold);

    for ( let region of partition ) if ( region.rotation[3] != 1 ) {
      let mat = new THREE.Matrix4().makeRotationFromQuaternion(new THREE.Quaternion(...region.rotation));
      mat = new CSG.Matrix4x4(mat.toArray());
      for ( let elem of region.elements ) {
        elem.shape = elem.shape.transform(mat);
        this.rotated.add(elem);
      }
    }
  }

  mergeElements(element0, ...elements) {
    elements = Array.from(new Set(elements)).filter(elem => elem !== element0);
    super.mergeElements(element0, ...elements);
    element0.shape = element0.shape.union(...elements.map(elem => elem.shape));
    this.reshaped.add(element0);
  }
  slice(center, radius, elements=this.elements.slice(), knife) {
    this.network.setStatus("broken");

    var circle = new SphCircle({radius, orientation:q_align(center)});
    if ( !knife ) {
      var plane = new CSG.Plane(new CSG.Vector3D(center).unit(), Math.cos(radius*Q));
      var plane_ = plane.flipped();
    }
    var new_bd = [];

    for ( let element of elements ) {
      let [in_segs, out_segs, in_bd, out_bd] = this.analyzer.slice(element, circle);
      if ( in_segs.length && out_segs.length ) {
        for ( let seg of element.boundaries )
          this.add(seg);
        let [splitted] = element.split(out_segs);
        if ( !knife ) {
          splitted.shape = element.shape.cutByPlane(plane);
          element.shape = element.shape.cutByPlane(plane_);
        } else {
          splitted.shape = element.shape.subtract(knife);
          element.shape = element.shape.intersect(knife);
        }
      
        this.add(splitted);
        this.reshaped.add(element);
      
      } else if ( in_segs.length ) {
        if ( !knife )
          element.shape = element.shape.cutByPlane(plane_);
        else
          element.shape = element.shape.intersect(knife);
        this.reshaped.add(element);
      
      } else if ( out_segs.length ) {
        if ( !knife )
          element.shape = element.shape.cutByPlane(plane);
        else
          element.shape = element.shape.subtract(knife);
        this.reshaped.add(element);
      }

      new_bd.push(...in_bd, ...out_bd);
    }

    var track;
    if ( new_bd.length )
      if ( !new_bd[0].track )
        if ( track = this.analyzer.buildTrack(new_bd[0]) )
          this.add(track);

    this.setStatus("unprepared");
    this.changed = true;

    return track;
  }
  cut(knife, elements=this.elements.slice()) {
    for ( let element of elements ) {
      element.shape = element.shape.intersect(knife);
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
      if ( puzzle.status != "ready" || event.ctrlKey ) {
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
    puzzle.on("reshaped", SphElem, event => (this.eraseElement(event.target), this.drawElement(event.target)));
    puzzle.on("rotated", SphElem, event => (this.eraseElement(event.target), this.drawElement(event.target)));
    puzzle.on("added", SphTrack, event => this.addTwister(event.target));
    puzzle.on("removed", SphTrack, event => this.removeTwister(event.target));
    puzzle.on("statuschanged", puzzle, event => this.updateTwisters());
    puzzle.on("changed", puzzle, event => this.updateTwisters());
  }
  drawElement(element) {
    var geo = toGeometry(element.shape);
    var mat = new THREE.MeshLambertMaterial({color:0xFFFFFF, vertexColors:THREE.FaceColors});
    element.model_view = new THREE.Mesh(geo, mat);
    element.model_view.userData.raw = element;
    element.model_view.material.emissive.set("hsl(60, 100%, 0%)");
    element.model_view.material.emissiveIntensity = 0;

    element.model_view.userData.hoverable = true;
    element.model_view.userData.draggable = true;
    element.model_view.addEventListener("click", this.click_handler);
    element.model_view.addEventListener("dragstart", this.dragstart_handler);
    element.model_view.addEventListener("drag", this.drag_handler);
    element.model_view.addEventListener("dragend", this.dragend_handler);

    this.display.add(element.model_view, this.root);
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

      angle = angle_;
      angle = fzy_mod(angle, 4, this.current_twister.shifts, 0.01);
      angle = fzy_mod(angle, 4, this.current_twister.shifts0, 0.05);
      angle = fzy_mod(angle, 4, [0], 0.05);
      var rot = new THREE.Quaternion().setFromAxisAngle(plane.normal, angle*Q);

      for ( let elem of this.moving )
        elem.model_view.quaternion.multiplyQuaternions(rot, elem.model_view.userData.quaternion0);

      return angle;
    };
    var dragend = event => {
      var angle = drag(event);

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
        track.twister.shifts = Array.from(track.secret.pseudokeys.keys())
            .map(kee => this.raw.analyzer.mod4(track.shift-kee)).sort();
        track.twister.shifts0 = Array.from(track.secret.passwords.keys())
            .map(key => this.raw.analyzer.mod4(track.shift-key)).sort();
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
    new ModeledSphPuzzleView(display, this.puzzle, this.selector);
  }
}
