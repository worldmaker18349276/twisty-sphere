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

    proxy.length = seg.length;
    proxy.radius = seg.radius;
    proxy.angle = seg.angle;
    var length_ctrl = this.sel_gui.add(proxy, "length", 0, 4, 0.01);
    var radius_ctrl = this.sel_gui.add(proxy, "radius", 0, 2, 0.01);
    var angle_ctrl = this.sel_gui.add(proxy, "angle", 0, 4, 0.01);
    length_ctrl.domElement.style.pointerEvents = "none";
    radius_ctrl.domElement.style.pointerEvents = "none";
    angle_ctrl.domElement.style.pointerEvents = "none";
    this.sel_ctrl.push(length_ctrl, radius_ctrl, angle_ctrl);

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
      let v1 = new THREE.Vector3(...circle.vectorAt(seg.length));
      geo.vertices = Array.from({length:Math.floor(seg.length/da)+1},
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
      let v1 = new THREE.Vector3(...circle.vectorAt(seg.length-da));
      geo.vertices = Array.from({length:Math.floor(seg.length/da)-1},
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
      let N = Math.floor(seg.length/da)+1;
      let q = new THREE.Quaternion(...seg.orientation);
      let geo = new THREE.SphereGeometry(1, N, 2, 2*Q, seg.length*Q,
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
