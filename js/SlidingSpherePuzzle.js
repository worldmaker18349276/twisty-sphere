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

class SphElemBasic extends SphElem
{
  buildView(color, dq=0.01) {
    var obj = new THREE.Object3D();
    obj.userData.data = this;
    this.view = obj;

    for ( let seg of this.boundaries )
      obj.add(...seg.buildView(color, dq));

    return obj;
  }
}
class SphSegBasic extends SphSeg
{
  buildView(color, dq=0.01) {
    // make arc
    {
      let geo = new THREE.Geometry();
      let circle = this.circle;
      let center = new THREE.Vector3(...circle.center);
      let da = dq*Math.sin(circle.radius*Q);
      let v0 = new THREE.Vector3(...circle.vectorAt(0));
      let v1 = new THREE.Vector3(...circle.vectorAt(this.length));
      geo.vertices = Array.from({length:Math.floor(this.length/da)+1},
                                (_, i) => v0.clone().applyAxisAngle(center, i*da*Q));
      geo.vertices.push(v1);

      let mat = new THREE.LineBasicMaterial({color});
      var arc = new THREE.Line(geo, mat);
      arc.name = "arc";
    }

    // make dash
    {
      let geo = new THREE.Geometry();
      let circle = this.circle;
      circle.radius = circle.radius - dq/2;
      let center = new THREE.Vector3(...circle.center);
      let da = dq*Math.sin(circle.radius*Q);
      let v0 = new THREE.Vector3(...circle.vectorAt(da));
      let v1 = new THREE.Vector3(...circle.vectorAt(this.length-da));
      geo.vertices = Array.from({length:Math.floor(this.length/da)-1},
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
      if ( fzy_cmp(this.angle, 0) != 0 )
        geo = new THREE.CircleGeometry(dq*Q, 10, Q, this.angle*Q);
      else
        geo = new THREE.CircleGeometry(3*dq*Q, 3, (1-10*dq)*Q, 2*10*dq*Q);
      geo.translate(0, 0, 1);
      geo.rotateY(this.radius*Q);
      let q = new THREE.Quaternion(...this.orientation);
      geo.applyMatrix(new THREE.Matrix4().makeRotationFromQuaternion(q));

      let mat = new THREE.MeshBasicMaterial({color});
      var ang = new THREE.Mesh(geo, mat);
      ang.name = "angle";
    }

    // make holder and register event listeners
    {
      let N = Math.floor(this.length/(dq*Math.sin(this.radius*Q)))+1;
      let geo = new THREE.CylinderGeometry(
        Math.sin((this.radius-dq)*Q), Math.sin(this.radius*Q), Math.sin(this.radius*Q)*dq,
        N, 1, true, Q, this.length*Q);
      geo.rotateX(Q);
      geo.translate(0, 0, Math.cos((this.radius-dq/2)*Q));
      let q = new THREE.Quaternion(...this.orientation);
      geo.applyMatrix(new THREE.Matrix4().makeRotationFromQuaternion(q));

      let mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0 });
      var holder = new THREE.Mesh(geo, mat);
      holder.name = "holder";
      holder.userData.data = this;

      // holder.userData.hoverable = this.mode == "select";
      // holder.addEventListener("mouseenter", () => this.emphasize());
      // holder.addEventListener("mouseleave", () => this.unemphasize());
      // holder.addEventListener("click", () => this.select(this));
    }

    this.view = [arc, dash, ang, holder];
    return [arc, dash, ang, holder];
  }

  emphasize() {
    this.view[0].material.linewidth = 2;
    this.view[1].material.linewidth = 2;
  }
  unemphasize() {
    this.view[0].material.linewidth = 1;
    this.view[1].material.linewidth = 1;
  }
  highlight() {
    this.view[3].material.opacity = 0.3;
  }
  unhighlight() {
    this.view[3].material.opacity = 0;
  }
}

class SphLockBasic extends SphLock
{
  buildView(color, dq=0.01) {
    var circle = this.circle;
    var da = dq*Math.sin(circle.radius*Q);
    var N = Math.floor(4/da)+1;
    var q = new THREE.Quaternion(...circle.orientation);
    
    // make holder
    {
      let geo = new THREE.SphereGeometry(1, N, 2, 0, 4*Q, (circle.radius-dq*2)*Q, dq*2*Q);
      geo.rotateX(Q);
      geo.applyMatrix(new THREE.Matrix4().makeRotationFromQuaternion(q));
    
      let mat = new THREE.MeshBasicMaterial({color, transparent:true, opacity:0});
      var holder = new THREE.Mesh(geo, mat);
      holder.name = "holder";
    
      // let elems = this.elementsOfSide(+1);
      // holder.userData.hoverable = true;
      // holder.addEventListener("mouseenter", () => {
      //   mat.transparent = false;
      //   for ( let elem of elems )
      //     for ( let seg of elem.boundaries )
      //       this.emphasize(seg);
      // });
      // holder.addEventListener("mouseleave", () => {
      //   mat.transparent = true;
      //   for ( let elem of elems )
      //     for ( let seg of elem.boundaries )
      //       this.unemphasize(seg);
      // });
    }

    var obj = new THREE.Object3D();
    obj.add(holder);
    return obj;
  }
}

class SlidingSphereBasic extends SlidingSphere
{
  constructor(id, width, height) {
    super();

    this.display = new Display(id, width, height);
    this.ball = this.buildBallView(0.999);
    this.display.add(this.ball);

    this.gui = new dat.GUI();
    this.mode = "navigate";

    // build selection system
    var sel_gui = this.sel_gui = this.gui.addFolder("selected segment");
    sel_gui.open();

    this.selection = {length:0, radius:0, angle:0, host:undefined};
    this.sel_ctrl = {};

    this.selection.object = () => console.log(this.selection.host);
    this.sel_ctrl.object = sel_gui.add(this.selection, "object");

    this.sel_ctrl.length = sel_gui.add(this.selection, "length", 0, 4, 0.01);
    this.sel_ctrl.radius = sel_gui.add(this.selection, "radius", 0, 2, 0.01);
    this.sel_ctrl.angle = sel_gui.add(this.selection, "angle", 0, 4, 0.01);
    this.sel_ctrl.length.domElement.style.pointerEvents = "none";
    this.sel_ctrl.radius.domElement.style.pointerEvents = "none";
    this.sel_ctrl.angle.domElement.style.pointerEvents = "none";

    this.selection.links = {};
    this.sel_ctrl.links = {};

    this.select();
  }
  setMode(mode) {
    if ( mode != "select" ) {
      for ( let elem of this.elements )
        for ( let seg of elem.boundaries )
          seg.view[3].userData.hoverable = false;
      this.select();
    }

    if ( mode == "select" ) {
      this.mode = "select";
      for ( let elem of this.elements )
        for ( let seg of elem.boundaries )
          seg.view[3].userData.hoverable = true;

    } else {
      this.mode = "navigate";

    }
  }

  createSeg(...args) {
    return new SphSegBasic(...args);
  }
  createElem(...args) {
    return new SphElemBasic(...args);
  }
  createLock(...args) {
    return new SphLockBasic(...args);
  }

  select(seg) {
    // remove previous selection
    var prev = this.selection.host;
    this.selection.host = undefined;

    if ( prev ) {
      prev.unemphasize();
      prev.unhighlight();
    }

    this.selection.length = NaN;
    this.selection.radius = NaN;
    this.selection.angle = NaN;

    for ( let name in this.sel_ctrl.links )
      this.sel_ctrl.links[name].remove();
    this.selection.links = {};
    this.sel_ctrl.links = {};

    // set present selection
    if ( seg ) {
      this.selection.host = seg;

      seg.highlight();

      this.selection.length = seg.length;
      this.selection.radius = seg.radius;
      this.selection.angle = seg.angle;

      for ( let name of ["prev", "next"] )
        this.makeLink(name, seg[name]);
      for ( let [adj_seg, offset] of seg.adj )
        this.makeLink(`adj(${offset})`, adj_seg);
    }

    this.sel_ctrl.length.updateDisplay();
    this.sel_ctrl.radius.updateDisplay();
    this.sel_ctrl.angle.updateDisplay();
  }
  makeLink(name, seg) {
    this.selection.links[name] = () => this.mode=="select" && this.select(seg);
    this.sel_ctrl.links[name] = this.sel_gui.add(this.selection.links, name);
    var dom = this.sel_ctrl.links[name].domElement.parentNode.parentNode;
    dom.addEventListener("mouseenter", () => seg.emphasize());
    dom.addEventListener("mouseleave", () => seg.unemphasize());
  }

  show() {
    this.view = [];
    for ( let elem of this.elements )
      this.view.push(elem.buildView(cloop.next().value));

    for ( let obj of this.view )
      this.display.add(obj);
  }
  buildBallView(R=1, N=5) {
    var geo = new THREE.IcosahedronGeometry(R, N);
    var mat = new THREE.MeshLambertMaterial({color:0xffffff});

    var ball = new THREE.Mesh(geo, mat);

    ball.userData.hoverable = true;
    ball.addEventListener("click", () => this.mode=="select" && this.select());

    return ball;
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