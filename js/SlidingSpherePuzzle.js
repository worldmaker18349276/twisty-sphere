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

class SSphPuzzle
{
  constructor(id, width, height) {
    this.display = new Display(id, width, height);
    this.elements = [new SphElem()];
    this.gui = new dat.GUI();

    this.ball = this.buildBallView(0.999);
    this.display.add(this.ball);

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

  emphasize(seg) {
    seg.view[0].material.linewidth = 2;
    seg.view[1].material.linewidth = 2;
  }
  unemphasize(seg) {
    seg.view[0].material.linewidth = 1;
    seg.view[1].material.linewidth = 1;
  }
  highlight(seg) {
    seg.view[3].material.opacity = 0.3;
  }
  unhighlight(seg) {
    seg.view[3].material.opacity = 0;
  }
  select(seg) {
    // remove previous selection
    var prev = this.selection.host;
    this.selection.host = undefined;

    if ( prev ) {
      this.unemphasize(prev);
      this.unhighlight(prev);
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

      this.highlight(seg);

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
    this.selection.links[name] = () => this.select(seg);
    this.sel_ctrl.links[name] = this.sel_gui.add(this.selection.links, name);
    var dom = this.sel_ctrl.links[name].domElement.parentNode.parentNode;
    dom.addEventListener("mouseenter", () => this.emphasize(seg));
    dom.addEventListener("mouseleave", () => this.unemphasize(seg));
  }

  show() {
    this.view = [];
    for ( let elem of this.elements )
      this.view.push(this.buildElemView(elem, cloop.next().value));

    for ( let elem of this.view )
      this.display.add(elem);
  }

  buildBallView(R=1, N=5) {
    var geo = new THREE.IcosahedronGeometry(R, N);
    var mat = new THREE.MeshLambertMaterial({color:0xffffff});

    var ball = new THREE.Mesh(geo, mat);

    ball.userData.hoverable = true;
    ball.addEventListener("click", () => this.select());

    return ball;
  }
  buildElemView(elem, color, dq=0.01) {
    var obj = new THREE.Object3D();
    obj.userData.data = elem;
    elem.view = obj;

    for ( let seg of elem.boundaries )
      obj.add(...this.buildSegView(seg, dq, color));

    return obj;
  }
  buildSegView(seg, dq, color) {
    // make arc
    {
      let geo = new THREE.Geometry();
      let circle = seg.circle;
      let center = new THREE.Vector3(...circle.center);
      let v0 = new THREE.Vector3(...circle.vectorAt(0));
      let da = dq*Math.sin(circle.radius*Q);
      geo.vertices = Array.from({length:Math.floor(seg.length/da)+1},
                                (_, i) => v0.clone().applyAxisAngle(center, i*da*Q));
      geo.vertices.push(new THREE.Vector3(...circle.vectorAt(seg.length)));

      let mat = new THREE.LineBasicMaterial({color});
      var arc = new THREE.Line(geo, mat);
      arc.name = "arc";
    }

    // make dash
    {
      let geo = new THREE.Geometry();
      let circle = new SphCircle({radius:seg.radius-dq/2, orientation:seg.orientation});
      let center = new THREE.Vector3(...circle.center);
      let v0 = new THREE.Vector3(...circle.vectorAt(0));
      let da = dq*Math.sin(circle.radius*Q);
      geo.vertices = Array.from({length:Math.floor(seg.length/da)-1},
                                (_, i) => v0.clone().applyAxisAngle(center, (i+1)*da*Q));

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

    // make holder and register event listeners
    {
      let N = Math.floor(seg.length/(dq*Math.sin(seg.radius*Q)))+1;
      let geo = new THREE.CylinderGeometry(
        Math.sin((seg.radius-dq)*Q), Math.sin(seg.radius*Q), Math.sin(seg.radius*Q)*dq,
        N, 1, true, Q, seg.length*Q);
      geo.rotateX(Q);
      geo.translate(0, 0, Math.cos((seg.radius-dq/2)*Q));
      let q = new THREE.Quaternion(...seg.orientation);
      geo.applyMatrix(new THREE.Matrix4().makeRotationFromQuaternion(q));

      let mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0 });
      var holder = new THREE.Mesh(geo, mat);
      holder.name = "holder";

      holder.userData.hoverable = true;
      holder.addEventListener("mouseenter", () => this.emphasize(seg));
      holder.addEventListener("mouseleave", () => this.unemphasize(seg));
      holder.addEventListener("click", () => this.select(seg));
    }

    seg.view = [arc, dash, ang, holder];
    return [arc, dash, ang, holder];
  }

  slice(center, radius) {
    var circle = new SphCircle({center, radius});
    var new_elems = [];
    for ( let elem of this.elements ) {
      let [in_segs, out_segs] = elem.slice(circle);
      new_elems.push(...elem.split(in_segs, out_segs));
    }
    this.elements = new_elems;
  }
  mergeTrivialVertices() {
    for ( let elem of this.elements ) {
      elem.mergeTrivialVertices();
    }
  }
  build_twist() {
    for ( let elem of this.elements )
      for ( let seg of elem.boundaries )
        SphLock.build(seg);
  }
}
