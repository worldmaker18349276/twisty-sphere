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
      return Object.assign({type:name, originalEvent:event}, point);
    }

    // hover event
    {
      let hover_spot = {};

      this.dom.addEventListener("mousemove", event => {
        var prev_target3D = hover_spot.object;
        hover_spot = this.pointTo(event, e => e.userData.hoverable);
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

    // click event
    {
      let click_spot = {};

      this.dom.addEventListener("mousedown", event => {
        if ( !click_spot.object ) {
          click_spot = this.pointTo(event, e => e.userData.hoverable);
        }
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
          drag_spot = this.pointTo(event, e => e.userData.hoverable);
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
  }
  remove(target, parent=this.scene) {
    target.dispatchEvent({name:"objectremoved", target, parent});
    parent.remove(target);
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

  pointTo(event, objs) {
    if ( typeof objs == "function" ) {
      let filter = objs;
      objs = [];
      this.scene.traverse(e => { if ( filter(e) ) objs.push(e); });
    }

    var mouse = new THREE.Vector2(
      event.offsetX/this.width*2 - 1,
      - event.offsetY/this.height*2 + 1);
    this.raycaster.setFromCamera(mouse, this.camera);

    if ( Array.isArray(objs) ) {
      var [spot={}] = this.raycaster.intersectObjects(objs, true);
      while ( spot.object && !spot.object.userData.hoverable )
        spot.object = spot.object.parent;
      return spot;

    } else if ( objs.normal !== undefined && objs.constant !== undefined ) {
      var point = this.raycaster.ray.intersectPlane(objs, new THREE.Vector3());
      var distance = this.raycaster.ray.distanceToPlane(objs);
      return {distance, point, objs};

    } else {
      throw "??";
    }
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


function *colors() {
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
}
var cloop = colors();

class SlidingSphereBasic extends SlidingSphere
{
  constructor(id, width, height) {
    super();

    this.display = new Display(id, width, height);
    this.ball = this.buildBallView(0.999);
    this.display.add(this.ball);
    this.view = [];

    this.gui = new dat.GUI();

    // build selection system
    this.preselection = undefined;
    this.selections = [];

    this.selectOn = "segment";
    this.gui.add(this, "selectOn", ["segment", "element", "lock"]);

    this.sels_gui = this.gui.addFolder("selections");
    this.sels_gui.open();
    this.sels_ctrl = [];
    this.sel_gui = this.gui.addFolder("detail");
    this.sel_gui.open();
    this.sel_ctrl = [];

    this.hover_handler = event => {
      if ( event.type == "mouseenter" ) {
        switch ( this.selectOn ) {
          case "segment":
            this.preselection = event.target.userData.host;
            break;
          case "element":
            this.preselection = event.target.userData.host.affiliation;
            break;
          case "lock":
            this.preselection = event.target.userData.host.lock;
            break;
        }

      } else { // mouseleave
        this.preselection = undefined;
      }
    };
    this.select_handler = event => {
      if ( this.preselection === undefined )
        this.select();
      else
        this.select(this.preselection, event.originalEvent.ctrlKey ? "toggle" : "select");
    };
    this.ball.addEventListener("click", this.select_handler);

    this.display.animate(this.hoverRoutine());
  }

  select(target, mode="select") {
    switch ( mode ) {
      case "select":
        for ( let sel of Array.from(this.selections).reverse() )
          this.removeSelection(sel);
        if ( target )
          this.addSelection(target);
        break;

      case "toggle":
        if ( target ) {
          if ( !this.removeSelection(target) )
            this.addSelection(target);
        }
        break;

      case "focus":
        if ( target ) {
          this.removeSelection(target);
          this.addSelection(target);
        }
        break;

      case "replace":
        if ( target ) {
          if ( this.selections.length )
            this.removeSelection(this.selections[this.selections.length-1]);
          this.removeSelection(target);
          this.addSelection(target);
        }
        break;

      default:
        console.assert(false);
    }
  }
  addSelection(target) {
    var i = this.selections.indexOf(target);
    if ( i != -1 )
      return false;
    this.selections.push(target);

    this.makeSelCtrl(target);
    if ( target instanceof SphSeg )
      this.makeSegInfo(target);
    else if ( target instanceof SphElem )
      this.makeElemInfo(target);
    else if ( target instanceof SphLock )
      this.makeLockInfo(target);
    else
      this.removeInfo();

    return true;
  }
  removeSelection(target) {
    var i = this.selections.indexOf(target);
    if ( i == -1 )
      return false;
    this.selections.splice(i, 1);

    this.removeSelCtrl(i);
    this.removeInfo();

    return true;
  }

  makeSelCtrl(target) {
    var proxy = {};
    proxy[target.constructor.name] = () => this.select(target, "focus");
    var link_ctrl = this.sels_gui.add(proxy, target.constructor.name);
    var dom = link_ctrl.domElement.parentNode.parentNode;
    dom.addEventListener("mouseenter", () => this.preselection = target);
    dom.addEventListener("mouseleave", () => this.preselection = undefined);
    this.sels_ctrl.push(link_ctrl);
  }
  removeSelCtrl(n) {
    this.sels_ctrl[n].remove();
    this.sels_ctrl.splice(n, 1);
  }
  makeLink(target, name) {
    var proxy = {};
    proxy[name] = () => this.select(target, "replace");
    var link_ctrl = this.sel_gui.add(proxy, name);
    var dom = link_ctrl.domElement.parentNode.parentNode;
    dom.addEventListener("mouseenter", () => this.preselection = target);
    dom.addEventListener("mouseleave", () => this.preselection = undefined);
    return link_ctrl;
  }
  makeSegInfo(seg) {
    this.removeInfo();

    var proxy = {};
    proxy.object = () => console.log(seg);
    this.sel_ctrl.push(this.sel_gui.add(proxy, "object"));

    proxy.arc = seg.arc;
    proxy.radius = seg.radius;
    proxy.angle = seg.angle;
    var arc_ctrl = this.sel_gui.add(proxy, "arc", 0, 4, 0.01);
    var radius_ctrl = this.sel_gui.add(proxy, "radius", 0, 2, 0.01);
    var angle_ctrl = this.sel_gui.add(proxy, "angle", 0, 4, 0.01);
    arc_ctrl.domElement.style.pointerEvents = "none";
    radius_ctrl.domElement.style.pointerEvents = "none";
    angle_ctrl.domElement.style.pointerEvents = "none";
    this.sel_ctrl.push(arc_ctrl, radius_ctrl, angle_ctrl);

    this.sel_ctrl.push(this.makeLink(seg.affiliation, "aff."));
    if ( seg.lock )
      this.sel_ctrl.push(this.makeLink(seg.lock, "lock"));
    this.sel_ctrl.push(this.makeLink(seg.prev, "prev"));
    this.sel_ctrl.push(this.makeLink(seg.next, "next"));
    for ( let [adj_seg, offset] of seg.adj )
      this.sel_ctrl.push(this.makeLink(adj_seg, `adj(${offset})`));
  }
  makeElemInfo(elem) {
    this.removeInfo();

    var proxy = {};
    proxy.object = () => console.log(elem);
    this.sel_ctrl.push(this.sel_gui.add(proxy, "object"));

    var n = 0;
    for ( let seg of elem.boundaries )
      this.sel_ctrl.push(this.makeLink(seg, `bd.${n++}`));
  }
  makeLockInfo(lock) {
    this.removeInfo();

    var proxy = {};
    proxy.object = () => console.log(lock);
    this.sel_ctrl.push(this.sel_gui.add(proxy, "object"));

    proxy.offset = lock.offset;
    var offset_ctrl = this.sel_gui.add(proxy, "offset", 0, 4, 0.01);
    offset_ctrl.domElement.style.pointerEvents = "none";
    this.sel_ctrl.push(offset_ctrl);

    this.sel_ctrl.push(this.makeLink(lock.dual, "dual"));
    var n = 0;
    for ( let seg of lock.teeth )
      this.sel_ctrl.push(this.makeLink(seg, `tooth.${n++}`));
  }
  removeInfo() {
    for ( let ctrl of this.sel_ctrl )
      ctrl.remove();
    this.sel_ctrl = [];
  }

  buildBallView(R=1, N=5) {
    var geo = new THREE.IcosahedronGeometry(R, N);
    var mat = new THREE.MeshLambertMaterial({color:0xffffff});

    var ball = new THREE.Mesh(geo, mat);

    ball.userData.hoverable = true;
    return ball;
  }
  buildSegView(seg, color, dq=0.01) {
    // make arc
    {
      let geo = new THREE.Geometry();
      let circle = seg.circle;
      let center = new THREE.Vector3(...circle.center);
      let da = dq*Math.sin(circle.radius*Q);
      let v0 = new THREE.Vector3(...circle.vectorAt(0));
      let v1 = new THREE.Vector3(...circle.vectorAt(seg.arc));
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
      let circle = seg.circle;
      circle.radius = circle.radius - dq/2;
      let center = new THREE.Vector3(...circle.center);
      let da = dq*Math.sin(circle.radius*Q);
      let v0 = new THREE.Vector3(...circle.vectorAt(da));
      let v1 = new THREE.Vector3(...circle.vectorAt(seg.arc-da));
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
      let q = new THREE.Quaternion(...seg.orientation);
      geo.applyMatrix(new THREE.Matrix4().makeRotationFromQuaternion(q));

      let mat = new THREE.MeshBasicMaterial({color});
      var ang = new THREE.Mesh(geo, mat);
      ang.name = "angle";
    }

    // make holder
    {
      let circle = seg.circle;
      let da = dq*Math.sin(circle.radius*Q);
      let N = Math.floor(seg.arc/da)+1;
      let q = new THREE.Quaternion(...seg.orientation);
      let geo = new THREE.SphereGeometry(1, N, 2, 2*Q, seg.arc*Q,
                                         (circle.radius-2*dq)*Q, dq*2*Q);
      geo.rotateX(Q);
      geo.applyMatrix(new THREE.Matrix4().makeRotationFromQuaternion(q));
      
      let mat = new THREE.MeshBasicMaterial({color, transparent:true, opacity:0});
      var holder = new THREE.Mesh(geo, mat);
      holder.userData.hoverable = true;
      holder.name = "holder";
      holder.userData.host = seg;
    }

    seg.view = [arc, dash, ang, holder];
    return seg.view;
  }
  draw() {
    for ( let obj of this.view )
      this.display.remove(obj);
    this.view = [];

    for ( let elem of this.elements ) {
      elem.color = cloop.next().value;
      for ( let seg of elem.boundaries ) {
        this.view.push(...this.buildSegView(seg, elem.color));
        let holder = seg.view[3];
        holder.userData.hoverable = true;
        holder.addEventListener("mouseenter", this.hover_handler);
        holder.addEventListener("mouseleave", this.hover_handler);
        holder.addEventListener("click", this.select_handler);
      }
    }

    for ( let obj of this.view )
      this.display.add(obj);
  }

  *hoverRoutine() {
    var preselection = undefined;
    var selections = [];
    function segsOf(target) {
      if ( target instanceof SphSeg )
        return [target];
      else if ( target instanceof SphElem )
        return target.boundaries;
      else if ( target instanceof SphLock )
        return target.teeth;
      else
        return [];
    }
    while ( true ) {
      yield;

      // emphasize hovered object
      if ( this.preselection !== preselection ) {
        for ( let seg of segsOf(preselection) )
          if ( seg && seg.view ) {
            seg.view[0].material.linewidth = 1;
            seg.view[1].material.linewidth = 1;
          }
        for ( let seg of segsOf(this.preselection) )
          if ( seg && seg.view ) {
            seg.view[0].material.linewidth = 2;
            seg.view[1].material.linewidth = 2;
          }
        preselection = this.preselection;
      }

      // highlight selected objects
      if ( selections.some(sel => !this.selections.includes(sel))
           || this.selections.some(sel => !selections.includes(sel)) ) {
        for ( let sel of selections )
          for ( let seg of segsOf(sel) )
            if ( seg && seg.view )
              seg.view[3].material.opacity = 0;
        for ( let sel of this.selections )
          for ( let seg of segsOf(sel) )
            if ( seg && seg.view )
              seg.view[3].material.opacity = 0.3;
        selections = this.selections.slice();
      }
    }
  }
}

function graphView(puzzle) {
  var nodes = new vis.DataSet(), edges = new vis.DataSet();
  for ( let i=0; i<puzzle.elements.length; i++ )
    for ( let seg of puzzle.elements[i].boundaries ) {
      seg.node = {id:nodes.length, group:i};
      nodes.add(seg.node);
    }
  for ( let elem of puzzle.elements ) {
    let loops = [...elem.loops()];
    for ( let loop of loops ) {
      for ( let i=0; i<loop.length; i++ ) {
        let from = loop[i].node.id;
        let to = (loop[i+1] || loop[0]).node.id;
        let edge = {from, to, value:10, length:0.1};
        edges.add(edge);
      }
    }
    if ( loops.length > 1 ) {
      var segs = loops.map(loop => loop[0]);
      for ( let i=0; i<segs.length; i++ ) {
        let from = segs[i].node.id;
        let to = (segs[i+1] || segs[0]).node.id;
        let edge = {from, to, hidden:true, length:0.1};
        edges.add(edge);
      }
    }
  }
  for ( let elem of puzzle.elements )
    for ( let seg of elem.boundaries )
      for ( let [adj_seg, offset] of seg.adj ) {
        let from = seg.node.id;
        let to = adj_seg.node.id;
        if ( from > to ) continue;
        let edge = {from, to, dashes:true};
        edges.add(edge);
      }
  var dom = document.createElement("div");
  dom.style = "position:absolute; bottom:10px; right:10px;"
            + "width:50%; height:50%; background:ivory;";
  document.body.appendChild(dom);
  var network = new vis.Network(dom, {nodes, edges}, {physics:false});

  // for ( let i=0; i<puzzle.elements.length; i++ )
  //   network.cluster({
  //     joinCondition: (node=>node.group==i),
  //     clusterNodeProperties: {
  //       allowSingleNodeCluster: true, id: `group${i}`, group: i,
  //       value: 30, shape: "dot", label: ""
  //     }
  //   });
}
