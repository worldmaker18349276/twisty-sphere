function always() {
  return true;
}

// side
const FRONT = 1;
const BACK = 2;
const NONE = 3;

function cloneObject3D(obj) {
  var copied = obj.clone();
  copied.geometry = obj.geometry.clone();
  copied.material = obj.material.clone();
  while ( copied.children.length ) copied.remove(copied.children[0]);
  for ( let elem of obj.children )
    copied.add(cloneObject3D(elem));
  return copied;
}

class TwistySphereBuilder
{
  constructor(shape, config={}) {
    config = Object.assign({
      fuzzyTool: defaultFuzzyTool
    }, config);
  	this.shape = shape;
    this.fuzzyTool = config.fuzzyTool;
  }
  getBoundingRadius() {
    if ( !this.shape.geometry.boundingSphere )
      this.shape.geometry.computeBoundingSphere();
    return this.shape.geometry.boundingSphere.radius;
  }

  make() {
    var elem = cloneObject3D(this.shape);
    elem.userData = {
    	type: "element",
      cuts: [],
      hoverable: true
    };
    
    var puzzle = new THREE.Group();
    puzzle.add(elem);
    puzzle.userData = {
      type: "twistySphere",
      builder: `${this.constructor.name}`
    };
    return puzzle;
  }
  cutElement(elem, cut) {
    return cutConvexPolyhedron(elem.geometry, cut, true);
  }
  split(puzzle, ...planes) {
    if ( planes.length !== 1 )
      return planes.reduce((puzzle, plane) => this.split(puzzle, plane), puzzle);
    var plane = planes[0];

  	for ( let elem of puzzle.children.slice(0) ) {
    	// worldToLocal
      let plane_ = new THREE.Plane().copy(plane);
      plane_.applyMatrix4(new THREE.Matrix4().getInverse(elem.matrixWorld));

      // check sides of element respect to cut `plane_`
      let dis = elem.geometry.vertices.map(v => plane_.distanceToPoint(v));
      if ( dis.every(d => this.fuzzyTool.greater_than(d, 0)) ) {
        elem.userData.cuts.push(plane_);

      } else if ( dis.every(d => this.fuzzyTool.greater_than(-d, 0)) ) {
        elem.userData.cuts.push(plane_.negate());

      } else {
        let new_elem = cloneObject3D(elem);
        puzzle.add(new_elem);

        // cut elements `elem` by plane `plane_`
        this.cutElement(elem, plane_);
        elem.userData.cuts.push(plane_);

        // cut elements `elem` by plane `antiplane_`
        let antiplane_ = plane_.clone().negate();
        this.cutElement(new_elem, antiplane_);
        new_elem.userData.cuts.push(antiplane_);
      }

    }
    
    return puzzle;
  }
  analyze(puzzle) {
    var ind_elem = [...puzzle.children.keys()];

    // find all possible cuts
  	var cuts = puzzle.userData.cuts = [];
    var sides = puzzle.userData.sides = [];
    for ( let i of ind_elem ) for ( let cut of puzzle.children[i].userData.cuts ) {
      // localToWorld
    	cut = new THREE.Plane().copy(cut)
        .applyMatrix4(puzzle.children[i].matrixWorld);

      let side = FRONT;
    	if ( cut.constant > 0 ) {
        cut = cut.negate();
        side = BACK;
      }
      
    	let x = cuts.findIndex(cut_ => this.fuzzyTool.equals(cut_, cut));
      if ( x === -1 ) {
        cuts.push(cut);
        x = sides.push(new Array(puzzle.children.length))-1;
      }
      sides[x][i] = side;
    }
    
    // find sides of elements respect to cuts
    var ind_cut = [...cuts.keys()];
    for ( let x of ind_cut ) for ( let i of ind_elem ) if ( sides[x][i] === undefined ) {
      // worldToLocal
      let elemi = puzzle.children[i];
      let cutx = new THREE.Plane().copy(cuts[x])
        .applyMatrix4(new THREE.Matrix4().getInverse(elemi.matrixWorld));

    	let dis = elemi.geometry.vertices.map(v => cutx.distanceToPoint(v));
      if ( dis.every(d => this.fuzzyTool.greater_than(d, 0)) )
      	sides[x][i] = FRONT;
      else if ( dis.every(d => this.fuzzyTool.less_than(d, 0)) )
      	sides[x][i] = BACK;
      else
      	sides[x][i] = NONE;
    }
    
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
        if ( !this.fuzzyTool.equals(sphidius(cuts[y1]), sphidius(cuts[y2])) )
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
}

function colorBall(shape) {
  shape.geometry.computeFlatVertexNormals();
  for ( let face of shape.geometry.faces ) {
    let {phi, theta} = new THREE.Spherical().setFromVector3(face.normal);
    face.color = new THREE.Color().setHSL(theta/2/Math.PI, 1, phi/Math.PI);
  }
  shape.material.vertexColors = THREE.FaceColors;
}

class TwistyBallBuilder extends TwistySphereBuilder
{
  constructor(config={}) {
    var color = config.color || 0xffffff;
    var edgeColor = config.edgeColor || 0xff0000;
    var N = config.N || 4;

  	// var shell_geometry = new THREE.IcosahedronGeometry(1, N);
  	var shell_geometry = new THREE.OctahedronGeometry(1, N);
    var shell_material = new THREE.MeshLambertMaterial({color:color});
    var shape = new THREE.Mesh(shell_geometry, shell_material);
    
  	var edge_geometry = new THREE.Geometry();
    var edge_material = new THREE.LineBasicMaterial({color:edgeColor, linewidth:3});
    var edge = new THREE.LineLoop(edge_geometry, edge_material);
    shape.add(edge);

    super(shape, config);
  }
  make() {
    var puzzle = super.make();
    puzzle.userData.type = "twistyBall";
    return puzzle;
  }
  cutElement(elem, cut) {
    cutConvexPolyhedron(elem.geometry, cut, false);
    let edge = findOpenEdge(elem.geometry)[0];
    if ( edge )
      elem.children[0].geometry.vertices = edge.map(i => elem.geometry.vertices[i]);
    else 
      elem.children[0].geometry.vertices = [];
    return elem;
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

    var color = new THREE.Color(`hsl(${Math.abs(sphidius(plane)-1)*300}, 100%, 50%)`);
    var material = new THREE.MeshBasicMaterial({color:color});
    return new THREE.Mesh(disk, material);
  }
  makeTwistHelper(plane, angle, r=0, dr=0.1) {
    var radius = Math.sqrt(this.R*this.R - plane.constant*plane.constant);

    var ring = new THREE.RingGeometry(radius+r, radius+r+dr, Math.ceil(this.Na*radius*angle/4), 1, 0, angle*Math.PI/2);
    ring.translate(0, 0, -plane.constant);
    ring.lookAt(plane.normal);

    var color = new THREE.Color(`hsl(${Math.abs(sphidius(plane)-1)*300 + angle*90}, 100%, 50%)`);
    var material = new THREE.MeshBasicMaterial({color:color});
    return new THREE.Mesh(ring, material);
  }

  selectElement(puzzle, filter=always) {
    return new Promise((resolve, reject) => {
      var elements = puzzle.children.map((elem, i) => filter(elem, i) ? elem : null);

      var enter_handler = event => { this.display.highlight(event.target); };
      var leave_handler = event => { this.display.unhighlight(event.target); };
      var click_handler = event => { remove(); resolve([event.target, elements.indexOf(event.target)]); };
      var esc_handler = event => { if ( event.which === 27 ) { remove(); reject("esc"); } };

      var remove = () => {
        for ( let elem of elements ) if ( elem )
          this.display.unhighlight(elem);
        for ( let elem of elements ) if ( elem ) {
          elem.removeEventListener("mouseenter", enter_handler);
          elem.removeEventListener("mouseleave", leave_handler);
          elem.removeEventListener("click", click_handler);
        }
        document.removeEventListener("keydown", esc_handler);
      }

      for ( let elem of elements ) if ( elem ) {
        elem.addEventListener("mouseenter", enter_handler);
        elem.addEventListener("mouseleave", leave_handler);
        elem.addEventListener("click", click_handler);
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
            this.display.highlight(puzzle.children[i]);
      };
      var leave_handler = event => {
        event.target.material.opacity = 0.3;
        var x = cuts.indexOf(event.target);
        for ( let i in puzzle.userData.sides[x] )
          if ( puzzle.userData.sides[x][i] === FRONT )
            this.display.unhighlight(puzzle.children[i]);
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
          this.display.unhighlight(elem);
        this.display.remove(...cuts.filter(c => c));
        document.removeEventListener("keydown", esc_handler);
      }

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
          this.display.highlight(puzzle.children[i]);

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
        .then(([_, __, x, i]) => this.animatedTwist(puzzle, x, i))
        .then(() => { this.builder.analyze(puzzle); return sel_twist_loop_(); })
        .catch(e => {if ( typeof e == "string" ) console.log(e); else throw e; });
    }
    sel_twist_loop_();
  }
  explodeHandler(puzzle) {
    var elements = puzzle.children.slice(0);

    for ( let elem of elements ) {
      if ( elem.geometry.vertices.length ) {
        let number = elem.geometry.vertices.length;
        let center = elem.geometry.vertices.reduce((a, v) => a.add(v), new THREE.Vector3()).divideScalar(number);
        let dis = center.length();
        elem.userData.center = [center.normalize(), dis];
        elem.userData.oldPosition = elem.position.clone();
      }
    }

    var wheel_handler = event => {
      for ( let elem of elements )
        elem.translateOnAxis(elem.userData.center[0], -elem.userData.center[1]*event.deltaY/100);
    };
    var esc_handler = event => { if ( event.which === 27 ) remove(); };

    var remove = () => {
      for ( let elem of elements ) {
        elem.position.copy(elem.userData.oldPosition);
        delete elem.userData.oldPosition;
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
      this.camera.aspect = window.innerWidth/window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    }, false);

    // controls
    this.rotateSpeed = Math.PI/500;
    this.zoomSpeed = 1/100;
    this.distanceRange = [2, 8];

    this.trackball = new THREE.Group();
    this.trackball.add(this.camera);
    this.scene.add(this.trackball);
    this.setCamera(1,2,3);

    document.addEventListener("contextmenu", event => event.preventDefault());
    this.dom.addEventListener("mousemove", event => {
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

    // event system on Object3D, implemented by raycaster
    this.raycaster = new THREE.Raycaster();
    this.raycaster.linePrecision = 0;
    var mouse = new THREE.Vector2();
    var target = null, ray_event = {};

    this.dom.addEventListener("mousemove", event => {
      mouse.set((event.clientX/window.innerWidth)*2 - 1,
                - (event.clientY/window.innerHeight)*2 + 1);
      this.raycaster.setFromCamera(mouse, this.camera);
      
      var hoverable_objects = [];
      this.scene.traverse(e => { if ( e.userData.hoverable ) hoverable_objects.push(e); });
      [ray_event = {}] = this.raycaster.intersectObjects(hoverable_objects, true);

      var pre_target = target;
      target = ray_event.object;
      while ( target && !target.userData.hoverable ) target = target.parent;

      if ( pre_target !== target ) {
        if ( pre_target )
          pre_target.dispatchEvent(Object.assign({type:"mouseleave"}, ray_event));
        if ( target )
          target.dispatchEvent(Object.assign({type:"mouseenter"}, ray_event));
      }
      if ( target )
        target.dispatchEvent(Object.assign({type:"mouseover"}, ray_event));
    }, false);

    // click control
    var click_flag = false;
    this.dom.addEventListener("mousedown", event => { click_flag = true; }, false);
    this.dom.addEventListener("mousemove", event => {
      if ( Math.abs(event.movementX) > 1 || Math.abs(event.movementY) > 1 )
        click_flag = false;
    }, false);
    this.dom.addEventListener("mouseup", event => {
      if ( click_flag ) {
        click_flag = false;
        if ( target ) target.dispatchEvent(Object.assign({type:"click"}, ray_event));
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
  }
  remove(...objs) {
    if ( objs.length === 0 )
      return;
    this.scene.remove(...objs);
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

  highlight(...targets) {
    for ( let target of targets ) {
      if ( target.userData.oldColor === undefined ) {
        target.userData.oldColor = target.material.color.getHex();
        target.material.color.offsetHSL(0,0,-0.5);
      }
    }
  }
  unhighlight(...targets) {
    for ( let target of targets ) {
      if ( target.userData.oldColor !== undefined ) {
        target.material.color.setHex(target.userData.oldColor);
        delete target.userData.oldColor;
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

