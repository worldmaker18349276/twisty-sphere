function always() { return true; }
function plane(x, y, z, q) {
  return SphericalGeometer.plane([x,y,z], q);
}

function cloneObject3D(obj, copied=obj.clone()) {
  copied.geometry = Geometer.copy(obj.geometry);
  if ( Array.isArray(copied.material) )
    copied.material = obj.material.map(m => m.clone());
  else
    copied.material = obj.material.clone();
  for ( let [target, elem] of zip(copied.children, obj.children) )
    cloneObject3D(target, elem);
  return copied;
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
    face.vertexColors[a] = SphericalGeometer.ncolor(face.vertexNormals[a]);
  }
  geometry.scale(R,R,R);

  var material = new THREE.MeshLambertMaterial({color:0xffffff, vertexColors:THREE.VertexColors});
  return new THREE.Mesh(geometry, [material]);
}
function cube() {
  var geometry = new THREE.BoxGeometry(2,2,2);
  for ( let face of geometry.faces )
    face.color = SphericalGeometer.ncolor(face.normal);
  var material = new THREE.MeshLambertMaterial({color:0xffffff, vertexColors:THREE.FaceColors});
  return new THREE.Mesh(geometry, material);
}

// side
const FRONT = Symbol("FRONT");
const BACK = Symbol("BACK");
const NONE = Symbol("NONE");

class TwistySphereBuilder
{
  constructor(config={}) {
    config = Object.assign({
      R: 1,
      fuzzyTool: defaultFuzzyTool,
    }, config);

    var shape = config.shape !== undefined ? config.shape : cube();
    if ( !Array.isArray(shape.material) ) {
      let n = Math.max(...shape.geometry.faces.map(f => f.materialIndex))+1;
      shape.material = Array(n).fill(shape.material);
    }
    shape.geometry.faces.forEach(f => f.materialIndex++);
    shape.material.unshift(new THREE.MeshLambertMaterial({color:0xffffff}));
    Geometer.fly(shape.geometry);

  	this.shape = shape;
  	this.R = Array.isArray(config.R) ? config.R.slice(0).sort() : [config.R];
    this.fuzzyTool = config.fuzzyTool;
  }

  make() {
    var elem = new THREE.Object3D();
    elem.name = "element";
    elem.userData = {cuts: []};

    var shape = cloneObject3D(this.shape);
    shape.name = "shape";
    shape.userData.hoverable = true;
    elem.add(shape);

    for ( let r of this.R ) {
      let shell = colorball(r);
      shell.visible = false;
      shell.name = "shell";
      shell.userData.R = r;
      elem.add(shell);
    }
    
    var puzzle = new THREE.Group();
    puzzle.add(elem);
    puzzle.name = "TwistySphere";
    puzzle.userData = {
      builder: `${this.constructor.name}`,
      cuts: []
    };
    return puzzle;
  }
  sideOfShell(shell, cut) {
    var sgn = shell.geometry.vertices.map(v => this.fuzzyTool.sign(cut.distanceToPoint(v)));
    if ( sgn.every(s => s>=0) )
      return FRONT;
    else if ( sgn.every(s => s<=0) )
      return BACK;
    else
      return NONE;
  }
  sliceShell(shell, cut) {
    var sgn = shell.geometry.vertices.map(v => this.fuzzyTool.sign(cut.distanceToPoint(v)));
    if ( sgn.every(s => s>=0) )
      return [shell, null];
    else if ( sgn.every(s => s<=0) )
      return [null, shell];

    var shell_back = shell.clone();
    shell_back.geometry = new THREE.Geometry();
    shell_back.material = shell.material.map(m => m.clone());
    Geometer.slice(shell.geometry, cut, shell_back.geometry, cut, cut.clone().negate());
    return [shell, shell_back];
  }
  sideOfElement(elem, cut) {
  	var x = elem.userData.cuts.findIndex(cut_ => this.fuzzyTool.equals(cut_, cut));
    var anticut = cut.clone().negate();
  	var x_ = elem.userData.cuts.findIndex(cut_ => this.fuzzyTool.equals(cut_, anticut));

    console.assert(x === -1 || x_ === -1);
    if ( x !== -1 )
      return FRONT;
    else if ( x_ !== -1 )
      return BACK;

    var shells = elem.children.filter(e => e.name=="shell");
    var sides = shells.map(shell => this.sideOfShell(shell, cut));
    if ( sides.every(side => side === FRONT) )
      return FRONT;
    else if ( sides.every(side => side === BACK) )
      return BACK;
    else
      return NONE;
  }
  sliceShape(shape, cut, shape_back) {
    function _fill_holes_of_shape(shape, cut) {
      Geometer.fillHoles(shape.geometry, cut.clone().negate());

      shape.remove(...shape.children.filter(e => e.name=="edge"));
      let edge_material = new THREE.LineBasicMaterial({color:0xffffff, linewidth:5});

      let loops = Geometer.boundariesLoopsOf(shape.geometry.faces.filter(f => f.materialIndex !== 0));

      for ( let loop of loops ) {
      	let edge_geometry = new THREE.Geometry();
        loop = loop.map(([f, e]) => shape.geometry.vertices[f[e[0]]]);
        edge_geometry.vertices.push(...loop);

        let edge = new THREE.LineLoop(edge_geometry, edge_material);
        edge.name = "edge";
        shape.add(edge);
      }
    }

    if ( shape_back ) {
      Geometer.slice(shape.geometry, cut, shape_back.geometry);
      _fill_holes_of_shape(shape, cut);
      _fill_holes_of_shape(shape_back, cut.clone().negate());
      Geometer.land(shape.geometry);
      Geometer.land(shape_back.geometry);
    } else {
      Geometer.slice(shape.geometry, cut);
      _fill_holes_of_shape(shape, cut);
      Geometer.land(shape.geometry);
    }
  }
  sliceElement(elem, cut) {
    var shells = elem.children.filter(e => e.name=="shell");
    elem.remove(...shells);
    var res = shells.map(shell => this.sliceShell(shell, cut));
    var shells1 = res.map(([shell1, shell2]) => shell1).filter(shell => shell!==null);
    var shells2 = res.map(([shell1, shell2]) => shell2).filter(shell => shell!==null);

    if ( shells2.length === 0 ) {
      let shape = elem.children.find(e => e.name=="shape");
      this.sliceShape(shape, cut);
      elem.add(...shells1);

    } else if ( shells1.length === 0 ) {
      let shape = elem.children.find(e => e.name=="shape");
      this.sliceShape(shape, cut.clone().negate());
      elem.add(...shells2);

    } else {
      // slice elements `elem` by plane `plane_`
      let shape = elem.children.find(e => e.name=="shape");
      let new_shape = shape.clone();
      new_shape.geometry = new THREE.Geometry();
      new_shape.material = shape.material.map(m => m.clone());
      this.sliceShape(shape, cut, new_shape);

      let new_elem = new THREE.Object3D();
      new_elem.add(new_shape);
      elem.add(...shells1);
      new_elem.add(...shells2);
      puzzle.add(new_elem);

      let cuts1 = new Set();
      for ( let shell1 of shells1 )
        for ( let face of shell1.geometry.faces )
          for ( let edge of EDGES )
            if ( (face.labels || {})[edge] !== undefined )
              cuts1.add((face.labels || {})[edge]);
      elem.userData.cuts = [...cuts1];

      let cuts2 = new Set();
      for ( let shell2 of shells2 )
        for ( let face of shell2.geometry.faces )
          for ( let edge of EDGES )
            if ( (face.labels || {})[edge] !== undefined )
              cuts2.add((face.labels || {})[edge]);
      new_elem.userData.cuts = [...cuts2];
    }

  }
  slice(puzzle, ...cuts) {
    for ( let cut of cuts )
      for ( let elem of puzzle.children.slice(0) )
        this.sliceElement(elem, cut.clone().applyMatrix4(new THREE.Matrix4().getInverse(elem.matrixWorld)));
    return puzzle;
  }

  standardize(op) {
    if ( op.type == "canonical" ) {
      let {x, q, angle} = op;
      let cut = puzzle.userData.cuts[x];
      if ( q !== undefined ) angle = puzzle.userData.angles[x][q];
      if ( angle === undefined ) angle = 0;
      return {type:"standard", cut, angle};

    } else if ( op.type == "standard" ) {
      return op;
    }
  }
  canonicalize(op) {
    if ( op.type == "canonical" ) {
      return op;

    } else if ( op.type == "standard" ) {
      let {cut, angle} = op;
      // ...
    }
  }
  twist(puzzle, op) {
    if ( op.type == "canonical" ) {
      let {x, q, angle} = op;
      let targets = puzzle.userData.sides[x].map((b, i) => b === FRONT && puzzle.children[i]).filter(b => b);
      let axis = puzzle.userData.cuts[x].normal;
      if ( q !== undefined ) angle = puzzle.userData.angles[x][q];
      if ( angle === undefined ) angle = 0;
      let rot = new THREE.Quaternion().setFromAxisAngle(axis, angle*Math.PI/2);
      for ( let target of targets )
        target.quaternion.premultiply(rot);
      return op;

    } else if ( op.type == "standard" ) {
      let {cut, angle} = op;
      // ...
      // return this.canonicalize(op);
    }
  }

  findCuts(puzzle) {
    var ind_elem = [...puzzle.children.keys()];
  	var cuts = puzzle.userData.cuts = [];
    var sides = puzzle.userData.sides = [];

    for ( let i of ind_elem )
      for ( let cut of puzzle.children[i].userData.cuts ) {
        cut = cut.clone().applyMatrix4(puzzle.children[i].matrixWorld); // localToWorld

      	let x = cuts.findIndex(cut_ => this.fuzzyTool.equals(cut_, cut));
        let anticut = cut.clone().negate();
      	let x_ = cuts.findIndex(cut_ => this.fuzzyTool.equals(cut_, anticut));

        if ( x !== -1 ) {
          sides[x][i] = FRONT;
        } else if ( x_ !== -1 ) {
          sides[x_][i] = BACK;
        } else if ( x === -1 && x_ === -1 ) {
          let side = FRONT;
        	if ( cut.constant > 0 ) {
            cut = anticut;
            side = BACK;
          }

          cuts.push(cut);
          x = sides.push(new Array(puzzle.children.length))-1;
          sides[x][i] = side;
        }

      }
    
    return puzzle;
  }
  determineSides(puzzle) {
  	var cuts = puzzle.userData.cuts;
    var sides = puzzle.userData.sides;
    var ind_elem = [...puzzle.children.keys()];
    var ind_cut = [...cuts.keys()];

    for ( let x of ind_cut ) for ( let i of ind_elem ) if ( sides[x][i] === undefined )
      sides[x][i] = this.sideOfElement(puzzle.children[i],
        cuts[x].clone().applyMatrix4(new THREE.Matrix4().getInverse(puzzle.children[i].matrixWorld)));
    
    return puzzle;
  }
  computeAnglesMatches(puzzle) {
  	var cuts = puzzle.userData.cuts;
    var sides = puzzle.userData.sides;
    var ind_cut = [...cuts.keys()];

    // find all possible twisting angles for each cut
    var angles = puzzle.userData.angles = new Array(ind_cut.length);
    var matches = puzzle.userData.matches = new Array(ind_cut.length);
    for ( let x of ind_cut ) if ( !sides[x].includes(NONE) ) {
      // find non-trivial cut for matching respect to twisting cut `cuts[x]`
    	let innercutables = new Array(ind_cut.length);
    	let outercutables = new Array(ind_cut.length);
    	let intercuts = new Array(ind_cut.length);
    	for ( let y of ind_cut ) {
      	let cuty_inner = sides[y].filter((_, i) => sides[x][i] === FRONT);
      	let cuty_outer = sides[y].filter((_, i) => sides[x][i] === BACK);

        innercutables[y] = !cuty_inner.includes(NONE);
        outercutables[y] = !cuty_outer.includes(NONE);

        let meet_inner = innercutables[y] ? cuty_inner.includes(FRONT) : true;
        let meet_outer = outercutables[y] ? cuty_outer.includes(FRONT) : true;

        intercuts[y] = meet_inner && meet_outer;
      }

      // align axes of twisting cut to +y
      let {phi, theta} = new THREE.Spherical().setFromVector3(cuts[x].normal);
      let rot = new THREE.Quaternion().setFromAxisAngle({x:-Math.cos(theta), y:0, z:Math.sin(theta)}, phi);
      let axes = cuts.map(p => p.normal)
      	.map(n => n.clone().applyQuaternion(rot))
        .map(n => new THREE.Spherical().setFromVector3(n));

      // match intercuts
      angles[x] = [];
      matches[x] = [];
      for ( let y1 of ind_cut ) if ( intercuts[y1] && innercutables[y1] )
        for ( let y2 of ind_cut ) if ( intercuts[y2] && outercutables[y2] )
        	if ( y1 !== y2 )
      {
        if ( !this.fuzzyTool.equals(SphericalGeometer.quadrant(cuts[y1]), SphericalGeometer.quadrant(cuts[y2])) )
          break;
        if ( !this.fuzzyTool.equals(axes[y1].phi, axes[y2].phi) )
          break;
        
        let theta = (axes[y2].theta - axes[y1].theta)*2/Math.PI;
        theta = ((theta % 4) + 4) % 4;

        let q = angles[x].findIndex(a => this.fuzzyTool.equals(a, theta));
        if ( q === -1 ) {
          q = angles[x].findIndex(a => a > theta);
          if ( q === -1 ) q = angles[x].length;
          angles[x].splice(q,0,theta);
          matches[x].splice(q,0,[]);
        }
        matches[x][q].push([y1,y2]);
      }
    }
    return puzzle;
  }
  analyze(puzzle) {
    this.findCuts(puzzle);
    this.determineSides(puzzle);
    this.computeAnglesMatches(puzzle);
    return puzzle;
  }
  analyzeAfterTwist(puzzle, op) {
    var {x, q, angle} = this.canonicalize(op);
    var elem_twisted = puzzle.userData.sides[x].map(s => s === FRONT);
    var axis = puzzle.userData.cuts[x].normal;
    if ( q !== undefined ) angle = puzzle.userData.angles[x][q];
    if ( angle === undefined ) angle = 0;
    var rot = new THREE.Matrix4().makeRotationAxis(axis, angle*Math.PI/2);

    var old_sides = puzzle.userData.sides;
    var old_cuts_fixed = puzzle.userData.cuts;
    var old_cuts_twisted = puzzle.userData.cuts
      .map(cut => cut.clone().applyMatrix4(rot));

    this.findCuts(puzzle);

    var sides = puzzle.userData.sides;
    var cuts = puzzle.userData.cuts;
    var ind_elem = [...puzzle.children.keys()];

    // determine sides according to the analyzation before twist
    for ( let [cut, sidesy] of zip(cuts, sides) ) {
      let old_y;
      old_y =   old_cuts_fixed.findIndex(old_cut => this.fuzzyTool.equals(old_cut, cut));
      if ( old_y !== -1 ) {
        for ( let i of ind_elem ) if ( !elem_twisted[i] )
          sidesy[i] = old_sides[old_y][i];
      }

      old_y = old_cuts_twisted.findIndex(old_cut => this.fuzzyTool.equals(old_cut, cut));
      if ( old_y !== -1 ) {
        for ( let i of ind_elem ) if (  elem_twisted[i] )
          sidesy[i] = old_sides[old_y][i];
      }
    }

    this.determineSides(puzzle);
    this.computeAnglesMatches(puzzle);
    return puzzle;
  }
}

class BasicController
{
  constructor(param={}) {
    param = Object.assign({
      Na: 360,
      R: 1,
      tolerance: 1e-5,
    }, param);
    this.Na = param.Na;
    this.R = param.R;
    this.tolerance = param.tolerance;
    this.builder = param.builder;
    this.display = param.display;
  }
  makeCutHelper(plane) {
    var radius = Math.sqrt(this.R*this.R - plane.constant*plane.constant);

    var disk = new THREE.CircleGeometry(radius, Math.ceil(this.Na*radius));
    disk.translate(0, 0, -plane.constant);
    disk.lookAt(plane.normal);

    var color = SphericalGeometer.qcolor(SphericalGeometer.quadrant(plane));
    var material = new THREE.MeshBasicMaterial({color:color});
    return new THREE.Mesh(disk, material);
  }
  makeTwistHelper(plane, angle, r=0, dr=0.1) {
    var radius = Math.sqrt(this.R*this.R - plane.constant*plane.constant);

    var ring = new THREE.RingGeometry(radius+r, radius+r+dr, Math.ceil(this.Na*radius*angle/4), 1, 0, angle*Math.PI/2);
    ring.translate(0, 0, -plane.constant);
    ring.lookAt(plane.normal);

    var quad = SphericalGeometer.quadrant(plane);
    var color = new THREE.Color(`hsl(${Math.floor(Math.abs(quad-1)*300) + angle*90}, 100%, 50%)`);
    var material = new THREE.MeshBasicMaterial({color:color});
    return new THREE.Mesh(ring, material);
  }

  makeCut(puzzle, x) {
    var cut = this.makeCutHelper(puzzle.userData.cuts[x]);
    cut.material.transparent = true;
    cut.material.opacity = 0.3;

    cut.userData.hoverable = true;
    cut.userData.x = x;
    cut.userData.elems = puzzle.children.filter((elem, i) => puzzle.userData.sides[x][i] === FRONT);

    var enter_handler = event => {
      event.target.material.opacity = 0.7;
      for ( let elem of event.target.userData.elems )
        this.display.highlight(elem.children.find(e => e.name=="shape"));
    };
    var leave_handler = event => {
      event.target.material.opacity = 0.3;
      for ( let elem of event.target.userData.elems )
        this.display.unhighlight(elem.children.find(e => e.name=="shape"));
    };
    cut.addEventListener("mouseenter", enter_handler);
    cut.addEventListener("mouseleave", leave_handler);

    var finalize = self => {
      for ( let elem in self.userData.elems )
        this.display.unhighlight(elem.children.find(e => e.name=="shape"));
    };
    cut.userData.finalize = [finalize];

    return cut;
  }
  makeDraggableCut(puzzle, x) {
    var cut = this.makeCut(puzzle, x);
    cut.userData.draggable = true;
    cut.userData.angle = 0;

    var dragstart_handler = event => {
      var normal = new THREE.Vector3().copy(puzzle.userData.cuts[event.target.userData.x].normal);
      var constant = -normal.dot(event.point);
      var plane = new THREE.Plane(normal, constant);
      cut.userData.plane = plane;

      var {phi, theta} = new THREE.Spherical().setFromVector3(normal);
      var rot0 = new THREE.Quaternion().setFromAxisAngle({x:-Math.cos(theta), y:0, z:Math.sin(theta)}, phi);
      var {theta:theta0} = new THREE.Spherical().setFromVector3(event.point.clone().applyQuaternion(rot0));
      rot0.premultiply(new THREE.Quaternion().setFromAxisAngle({x:0, y:1, z:0}, -theta0));
      cut.userData.rot0 = rot0;

      cut.userData.quats0 = cut.userData.elems.map(e => e.quaternion.clone());
    };
    var drag_handler = event => {
      var {point} = this.display.pointer(event.originalEvent, cut.userData.plane);
      if ( !point )
        return;
      var {theta} = new THREE.Spherical().setFromVector3(point.clone().applyQuaternion(cut.userData.rot0));
      var angle = ((theta*2/Math.PI) % 4 + 4) % 4;
      var rot = new THREE.Quaternion().setFromAxisAngle(cut.userData.plane.normal, angle*Math.PI/2);
      for ( let [elem, quat0] of zip(cut.userData.elems, cut.userData.quats0) )
        elem.quaternion.multiplyQuaternions(rot, quat0);
    };
    var dragend_handler = event => {
      var {point} = this.display.pointer(event.originalEvent, cut.userData.plane);
      if ( !point )
        return;
      var {theta} = new THREE.Spherical().setFromVector3(point.clone().applyQuaternion(cut.userData.rot0));
      var angle = ((theta*2/Math.PI) % 4 + 4) % 4;
      cut.userData.angle += angle;
      var rot = new THREE.Quaternion().setFromAxisAngle(cut.userData.plane.normal, angle*Math.PI/2);
      for ( let [elem, quat0] of zip(cut.userData.elems, cut.userData.quats0) )
        elem.quaternion.multiplyQuaternions(rot, quat0);
    };
    cut.addEventListener("dragstart", dragstart_handler);
    cut.addEventListener("drag", drag_handler);
    cut.addEventListener("dragend", dragend_handler);

    var finalize = self => {
      self.removeEventListener("dragstart", dragstart_handler);
      self.removeEventListener("drag", drag_handler);
      self.removeEventListener("dragend", dragend_handler);
    };
    cut.userData.finalize.push(finalize);

    return cut;
  }

  selectElement(puzzle, filter=always) {
    return new Promise((resolve, reject) => {
      var shapes = puzzle.children.map((elem, i) => filter(elem, i) ? elem.children.find(e => e.name=="shape") : null);

      var enter_handler = event => { this.display.highlight(event.target); };
      var leave_handler = event => { this.display.unhighlight(event.target); };
      var click_handler = event => { remove(); resolve([event.target.parent, shapes.indexOf(event.target)]); };
      var esc_handler = event => { if ( event.which === 27 ) { remove(); reject("esc"); } };

      var remove = () => {
        for ( let shape of shapes ) if ( shape )
          this.display.unhighlight(shape);
        for ( let shape of shapes ) if ( shape ) {
          shape.removeEventListener("mouseenter", enter_handler);
          shape.removeEventListener("mouseleave", leave_handler);
          shape.removeEventListener("click", click_handler);
        }
        document.removeEventListener("keydown", esc_handler);
      }

      for ( let shape of shapes ) if ( shape ) {
        shape.addEventListener("mouseenter", enter_handler);
        shape.addEventListener("mouseleave", leave_handler);
        shape.addEventListener("click", click_handler);
      }
      document.addEventListener("keydown", esc_handler);
    });
  }
  selectCut(puzzle, filter=always) {
    return new Promise((resolve, reject) => {
      var cuts = puzzle.userData.cuts.map((c, i) => filter(c, i) ? this.makeCutHelper(c) : null);
      for ( let c of cuts ) if ( c ) {
        c.material.transparent = true;
        c.material.opacity = 0.3;
      }

      var enter_handler = event => {
        event.target.material.opacity = 0.7;
        var x = cuts.indexOf(event.target);
        for ( let i in puzzle.userData.sides[x] )
          if ( puzzle.userData.sides[x][i] === FRONT )
            this.display.highlight(puzzle.children[i].children.find(e => e.name=="shape"));
      };
      var leave_handler = event => {
        event.target.material.opacity = 0.3;
        var x = cuts.indexOf(event.target);
        for ( let i in puzzle.userData.sides[x] )
          if ( puzzle.userData.sides[x][i] === FRONT )
            this.display.unhighlight(puzzle.children[i].children.find(e => e.name=="shape"));
      };
      var click_handler = event => {
        remove();
        var x = cuts.indexOf(event.target);
        var cutx = puzzle.userData.cuts[x];
        resolve([cutx, x]);
      };
      var esc_handler = event => { if ( event.which === 27 ) { remove(); reject("esc"); } };

      var remove = () => {
        for ( let elem of puzzle.children )
          this.display.unhighlight(elem.children.find(e => e.name=="shape"));
        this.display.remove(...cuts.filter(c => c));
        document.removeEventListener("keydown", esc_handler);
      };

      this.display.add(...cuts.filter(c => c));
      for ( let c of cuts ) if ( c ) {
        c.userData.hoverable = true;
        c.addEventListener("mouseenter", enter_handler);
        c.addEventListener("mouseleave", leave_handler);
        c.addEventListener("click", click_handler);
      }
      document.addEventListener("keydown", esc_handler);
    });
  }
  selectTwist(puzzle, x, filter=always) {
    return new Promise((resolve, reject) => {
      var cut = puzzle.userData.cuts[x];
      var angles = puzzle.userData.angles[x].map((a, i) => filter(a, i) ? a : null);

      var r = angles.filter(a => a).length - 0.8;
      var rings = angles.map(angle => angle && this.makeTwistHelper(cut, angle, (r--)/10, 0.08));

      for ( let r of rings ) {
        r.material.transparent = true;
        r.material.opacity = 0.3;
      }
      for ( let i in puzzle.userData.sides[x] )
        if ( puzzle.userData.sides[x][i] === FRONT )
          this.display.highlight(puzzle.children[i].children.find(e => e.name=="shape"));

      var enter_handler = event => { event.target.material.opacity = 0.7; };
      var leave_handler = event => { event.target.material.opacity = 0.3; };
      var click_handler = event => {
        remove();
        var i = rings.indexOf(event.target);
        var angle = i!==-1 ? puzzle.userData.angles[x][i] : 0;
        resolve([cut, angle, x, i]);
      };
      var esc_handler = event => { if ( event.which === 27 ) { remove(); reject("esc"); } };

      var remove = () => {
        this.display.remove(...rings.filter(r => r));
        document.removeEventListener("keydown", esc_handler);
      }

      this.display.add(...rings.filter(r => r));
      for ( let r of rings ) {
        r.userData.hoverable = true;
        r.addEventListener("mouseenter", enter_handler);
        r.addEventListener("mouseleave", leave_handler);
        r.addEventListener("click", click_handler);
      }
      document.addEventListener("keydown", esc_handler);
    });
  }
  animatedTwist(puzzle, x, q) {
    var targets = puzzle.userData.sides[x].map((b, i) => b === FRONT && puzzle.children[i]).filter(b => b);
    var axis = puzzle.userData.cuts[x].normal;
    var angle = puzzle.userData.angles[x][q] || 0;
    return this.display.animatedRotate(targets, axis, angle, 1.5);
  }

  selectElementLoopHandler(puzzle) {
    this.selectElement(puzzle)
      .then(([e, i]) => console.log(e)).then(() => this.selectElementLoopHandler(puzzle))
      .catch(e => {if ( typeof e == "string" ) console.log(e); else throw e; });
  }
  showCutsLoopHandler(puzzle, cuts) {
    cuts = cuts || [];
    return this.selectElement(puzzle)
      .then(([e, i]) => {
        this.display.remove(...cuts);
        cuts = e.userData.cuts
          .map(c => c.applyMatrix4(e.matrixWorld))
          .map((c, i) => this.makeCutHelper(c));
        cuts.forEach(c => { c.material.transparent = true; c.material.opacity = 0.3; c.material.side=THREE.DoubleSide; });
        this.display.add(...cuts);
      })
      .then(() => this.showCutsLoopHandler(puzzle, cuts))
      .catch(e => { this.display.remove(...cuts); cuts = []; throw e; })
      .catch(e => { if ( typeof e == "string" ) console.log(e); else throw e; });
  }
  selectCutLoopHandler(puzzle) {
    this.builder.analyze(puzzle);
    var sel_cut_loop_ = () => {
      this.selectCut(puzzle)
        .then(([p, i]) => console.log(p)).then(sel_cut_loop_)
        .catch(e => {if ( typeof e == "string" ) console.log(e); else throw e; });
    };
    sel_cut_loop_();
  }
  twistLoopHandler(puzzle) {
    this.builder.analyze(puzzle);
    var sel_twist_loop_ = () => {
      this.selectCut(puzzle, (_, x) => puzzle.userData.angles[x])
        .catch(e => {if ( e == "esc" ) { throw "cancel twist"; } throw e; })
        .then(([_, x]) => this.selectTwist(puzzle, x))
        .catch(e => {if ( e == "esc" ) { sel_twist_loop_(); throw "re-select twist"; } throw e; })
        .then(([_, __, x, q]) => this.animatedTwist(puzzle, x, q)
          .then(() => { this.builder.analyzeAfterTwist(puzzle, {type:"canonical", x, q}); }))
        .then(sel_twist_loop_)
        .catch(e => {if ( typeof e == "string" ) console.log(e); else throw e; });
    }
    sel_twist_loop_();
  }
  explodeHandler(puzzle) {
    var shapes = puzzle.children.map(elem => elem.children.find(e => e.name=="shape"));

    for ( let shape of shapes ) {
      if ( shape.geometry.vertices.length ) {
        let number = shape.geometry.vertices.length;
        let center = shape.geometry.vertices.reduce((a, v) => a.add(v), new THREE.Vector3()).divideScalar(number);
        let dis = center.length();
        shape.userData.center = [center.normalize(), dis];
        shape.userData.oldPosition = shape.position.clone();
      } else {
        shape.userData.center = [new THREE.Vector3(0,0,0), 0];
        shape.userData.oldPosition = shape.position.clone();
      }
    }

    var wheel_handler = event => {
      for ( let shape of shapes )
        shape.translateOnAxis(shape.userData.center[0], -shape.userData.center[1]*event.deltaY/100);
    };
    var esc_handler = event => { if ( event.which === 27 ) remove(); };

    var remove = () => {
      for ( let shape of shapes ) {
        shape.position.copy(shape.userData.oldPosition);
        delete shape.userData.center;
        delete shape.userData.oldPosition;
      }
      document.removeEventListener("wheel", wheel_handler);
      document.removeEventListener("keydown", esc_handler);
    }

    document.addEventListener("wheel", wheel_handler);
    document.addEventListener("keydown", esc_handler);
  }
}

class Display
{
  constructor() {
    // renderer
    this.renderer = new THREE.WebGLRenderer({antialias:true});
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.dom = this.renderer.domElement;
    document.body.appendChild(this.dom);
    document.body.style.margin = "0";
    document.body.style.overflow = "hidden";

    this.scene = new THREE.Scene();
    // this.scene.add(new THREE.AxesHelper(20));
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.3));

    this.camera = new THREE.PerspectiveCamera(40, window.innerWidth/window.innerHeight, 1, 1000);
    this.camera.add(new THREE.PointLight(0xffffff, 0.7));

    window.addEventListener("resize", () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    }, false);

    // background
    var background_geometry = new THREE.IcosahedronGeometry(10, 0);
    var background_uv = [new THREE.Vector2(0,0), new THREE.Vector2(0,1), new THREE.Vector2(Math.sqrt(3)/2,0)];
    for ( let i in background_geometry.faceVertexUvs[0] )
      background_geometry.faceVertexUvs[0][i] = background_uv.slice(0);
    var background_material = new THREE.MeshBasicMaterial({color:0xffffff});
    background_material.side = THREE.DoubleSide;
    var background_texture = new THREE.TextureLoader().load("background.png"); // broken noise, made by http://bg.siteorigin.com/
    background_texture.wrapS = THREE.RepeatWrapping;
    background_texture.wrapT = THREE.RepeatWrapping;
    background_texture.repeat = new THREE.Vector2(2.5, 2.5);
    background_material.map = background_texture;
    var background_shape = new THREE.Mesh(background_geometry, background_material);
    this.scene.add(background_shape);

    // navigation control
    this.rotateSpeed = Math.PI/500;
    this.zoomSpeed = 1/100;
    this.distanceRange = [2, 8];

    this.trackball = new THREE.Group();
    this.trackball.add(this.camera);
    this.scene.add(this.trackball);
    this.setCamera(1,2,3);

    document.addEventListener("contextmenu", event => event.preventDefault());
    this.trackball_lock = new Set();
    this.dom.addEventListener("mousemove", event => {
      if ( this.trackball_lock.size ) return;

      var x = event.movementX, y = -event.movementY;

      if ( event.buttons === 1 ) { // rotate
        let axis = new THREE.Vector3(-y,x,0);
        let angle = axis.length()*this.rotateSpeed;
        this.trackball.rotateOnAxis(axis.normalize(), -angle);
        event.preventDefault();

      } else if ( event.buttons === 2 ) { // spin
        let angle = x*this.rotateSpeed;
        this.trackball.rotateZ(angle);
        event.preventDefault();

      } else if ( event.buttons === 4 ) { // zoom
        let z = this.camera.position.z - y*this.zoomSpeed;
        if ( this.distanceRange[0] < z && z < this.distanceRange[1] )
          this.camera.position.z = z;
        event.preventDefault();

      }
    }, false);


    // event system on Object3D
    this.raycaster = new THREE.Raycaster();
    this.raycaster.linePrecision = 0;

    // hover event
    var hover_event = {};

    this.dom.addEventListener("mousemove", event => {
      var pre_target = hover_event.object;
      hover_event = this.pointer(event, e => e.userData.hoverable);

      if ( pre_target !== hover_event.object ) {
        if ( pre_target )
          pre_target.dispatchEvent(Object.assign({type:"mouseleave", originalEvent:event}, hover_event));
        if ( hover_event.object )
          hover_event.object.dispatchEvent(Object.assign({type:"mouseenter", originalEvent:event}, hover_event));
      }
      if ( hover_event.object )
        hover_event.object.dispatchEvent(Object.assign({type:"mouseover", originalEvent:event}, hover_event));
    }, false);

    // click event
    var click_event = {};

    this.dom.addEventListener("mousedown", event => {
      if ( !click_event.object ) {
        click_event = this.pointer(event, e => e.userData.hoverable);
      }
    }, false);
    this.dom.addEventListener("mousemove", event => {
      if ( click_event.object ) {
        if ( Math.abs(event.movementX) > 1 || Math.abs(event.movementY) > 1 )
          click_event = {};
      }
    }, false);
    this.dom.addEventListener("mouseup", event => {
      if ( click_event.object ) {
        click_event.object.dispatchEvent(Object.assign({type:"click", originalEvent:event}, click_event));
        click_event = {};
      }
    }, false);

    // drag event
    var dragging = false, dragstart_event = {};
    const DRAG_KEY = Symbol("drag");

    this.dom.addEventListener("mousedown", event => {
      if ( event.buttons === 1 && !dragging ) {
        dragstart_event = this.pointer(event, e => e.userData.hoverable);
        if ( dragstart_event.object && !dragstart_event.object.userData.draggable )
          dragstart_event = {};
        if ( dragstart_event.object )
          this.lockTrackball(DRAG_KEY);
      }
    }, false);
    this.dom.addEventListener("mousemove", event => {
      if ( event.buttons === 1 ) {
        if ( !dragging && dragstart_event.object ) {
          dragstart_event.object.dispatchEvent(Object.assign({type:"dragstart", originalEvent:event}, dragstart_event));
          dragging = true;
        }

        if ( dragging )
          dragstart_event.object.dispatchEvent(Object.assign({type:"drag", originalEvent:event}));
      }
    }, false);
    this.dom.addEventListener("mouseup", event => {
      if ( dragging ) {
        dragstart_event.object.dispatchEvent({type:"dragend", originalEvent:event});
        this.unlockTrackball(DRAG_KEY);
        dragstart_event = {};
        dragging = false;
      }
    }, false);

    // animation
    this.animations = [];
    var animate = (t) => {
      requestAnimationFrame(animate);
      filterInPlace(this.animations, ani => !ani(t));
      this.renderer.render(this.scene, this.camera);
    };
    animate();
  }

  add(...objs) {
    if ( objs.length === 0 )
      return;
    this.scene.add(...objs);
    for ( let obj of objs )
      if ( obj.userData.initialize )
        for ( let func of obj.userData.initialize )
          func(obj);
  }
  remove(...objs) {
    if ( objs.length === 0 )
      return;
    this.scene.remove(...objs);
    for ( let obj of objs )
      if ( obj.userData.finalize )
        for ( let func of obj.userData.finalize )
          func(obj);
  }

  pointer(event, objs) {
    if ( typeof objs == "function" ) {
      let filter = objs;
      objs = [];
      this.scene.traverse(e => { if ( filter(e) ) objs.push(e); });
    }

    var mouse = new THREE.Vector2(
      event.clientX/window.innerWidth*2 - 1,
      - event.clientY/window.innerHeight*2 + 1);
    this.raycaster.setFromCamera(mouse, this.camera);

    if ( Array.isArray(objs) ) {
      var [ray_event={}] = this.raycaster.intersectObjects(objs, true);
      while ( ray_event.object && !ray_event.object.userData.hoverable )
        ray_event.object = ray_event.object.parent;
      return ray_event;

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

  highlight(...targets) {
    for ( let target of targets ) {
      if ( target.userData.oldColors === undefined ) {
        target.userData.oldColors = [];
        for ( let i in target.material ) {
          target.userData.oldColors[i] = target.material[i].color.getHex();
          target.material[i].color.offsetHSL(0,0,-0.5);
        }
      }
    }
  }
  unhighlight(...targets) {
    for ( let target of targets ) {
      if ( target.userData.oldColors !== undefined ) {
        for ( let i in target.material ) {
          target.material[i].color.setHex(target.userData.oldColors[i]);
        }
        delete target.userData.oldColors;
      }
    }
  }

  animatedRotate(targets, axis, angle, speed) {
    return new Promise((resolve, reject) => {
      var start_quaternions = targets.map(target => target.quaternion.clone());

      var curr = 0;
      var t0;
      this.animations.push((t) => {
        if ( !t0 ) t0 = t;
        var dt = (t - t0)/1000;
        t0 = t;

        var rot = new THREE.Quaternion().setFromAxisAngle(axis, curr*Math.PI/2);
        for ( let i in targets )
          targets[i].quaternion.multiplyQuaternions(rot, start_quaternions[i]);
        if ( curr === angle ) {
          resolve();
          return true;
        }
        curr += speed*dt;
        if ( curr > angle ) curr = angle;
      });
    });
  }
}

