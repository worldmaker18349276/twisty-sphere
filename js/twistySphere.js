function always() {
  return true;
}

class TwistySphereBuilder
{
  constructor(param={}) {
    param = Object.assign({
      color: 0xffffff,
      edge_color: 0xff0000,
      inner_part: false,
      fuzzyTool: defaultFuzzyTool,
    }, param);
  	this.shape = param.shape;
    this.color = param.color;
    this.edge_color = param.edge_color;
    this.inner_part = param.inner_part;
    this.fuzzyTool = param.fuzzyTool;
  }
  getBoundingRadius() {
    if ( !this.shape.boundingSphere )
      this.shape.computeBoundingSphere();
    return this.shape.boundingSphere.radius;
  }

  make() {
    var elem_data = {
    	type: "element",
      color: this.color,
      edge_color: this.edge_color,
      planes: [],
      hoverable: true
    };

    var material = new THREE.MeshLambertMaterial({color:elem_data.color});
    var shell = new THREE.Mesh(this.shape.clone(), material);

    var elem = new THREE.Object3D();
    elem.add(shell);
    elem.userData = elem_data;
    
    var puzzle = new THREE.Group();
    puzzle.add(elem);
    puzzle.userData = {
      builder: `${this.constructor.name}`
    };
    return puzzle;
  }
  split(puzzle, ...planes) {
    if ( planes.length !== 1 )
      return planes.reduce((puzzle, plane) => this.split(puzzle, plane), puzzle);
    var plane = planes[0];

    var new_elements = [];
  	for ( let elem of puzzle.children ) {
    	let plane_ = planeWorldToLocal(elem, plane);

      // check sides of element respect to cut plane `plane_`
      let dis = elem.children[0].geometry.vertices.map(v => plane_.distanceToPoint(v));
      let setups;
      if ( dis.every(d => this.fuzzyTool.greater_than(d, 0)) ) {
        setups = [[elem, plane_, false]];

      } else if ( dis.every(d => this.fuzzyTool.greater_than(-d, 0)) ) {
        setups = [[elem, plane_.negate(), false]];

      } else {
        let new_elem = elem.clone();
        for ( let subelem of new_elem.children ) {
          subelem.material = subelem.material.clone();
          subelem.geometry = subelem.geometry.clone();
        }
        new_elements.push(new_elem);
        setups = [[elem, plane_, true], [new_elem, plane_.clone().negate(), true]];
      }

      // cut elements `elem` by plane `new_plane`
      for ( let [elem, new_plane, cuttable] of setups ) {
        let shell = elem.children[0];
        let edges = elem.children.slice(1);

        // shell part
        if ( cuttable )
          cutConvexPolyhedron(shell.geometry, new_plane, this.inner_part);

        // edges part
        if ( this.inner_part ? cuttable : true ) {
          // original edges
          for ( let edge of edges )
            cutPolygon(edge.geometry, new_plane);

          // new edge induced by cut plane `new_plane`
          let [new_edge=null] = makeCrossSection(this.shape, new_plane);
          if ( new_edge )
            for ( let plane of elem.userData.planes )
              cutPolygon(new_edge, plane);
          else
            new_edge = new THREE.Geometry();

          let material;
          if ( edges.length === 0 )
            material = new THREE.LineBasicMaterial({color:elem.userData.edge_color, linewidth:3});
          else
            material = edges[0].material;
          elem.add(new THREE.LineLoop(new_edge, material));
          elem.userData.planes.push(new_plane);
        }
      }

    }
    
    for ( let new_element of new_elements )
      puzzle.add(new_element);
    return puzzle;
  }
  analyze(puzzle) {
    // find all possible cut planes
    var ind_elem = [...puzzle.children.keys()];

  	var planes = puzzle.userData.planes = [];
    var sides = puzzle.userData.sides = [];
    for ( let i of ind_elem ) for ( let plane of puzzle.children[i].userData.planes ) {
    	plane = planeLocalToWorld(puzzle.children[i], plane);
    	let side = plane.constant < 0;
    	if ( !side ) plane = plane.negate();
      
    	var x = planes.findIndex(plane_ => this.fuzzyTool.equals(plane_, plane));
      if ( x === -1 ) {
        planes.push(plane);
        x = sides.push(new Array(puzzle.children.length))-1;
      }
      sides[x][i] = side;
    }
    
    // find sides of elements respect to cut planes
    var ind_cut = [...planes.keys()];
    for ( let x of ind_cut ) for ( let i of ind_elem ) if ( sides[x][i] === undefined ) {
      let xplane = planeWorldToLocal(puzzle.children[i], planes[x]);
    	let dis = puzzle.children[i].children[0].geometry.vertices.map(v => xplane.distanceToPoint(v));
      if ( dis.every(d => this.fuzzyTool.greater_than(d, 0)) )
      	sides[x][i] = true;
      else if ( dis.every(d => this.fuzzyTool.greater_than(-d, 0)) )
      	sides[x][i] = false;
      else
      	sides[x][i] = null;
    }
    
    // find all possible twisting angles for each cut planes
    var angles = puzzle.userData.angles = new Array(ind_cut.length);
    var matches = puzzle.userData.matches = new Array(ind_cut.length);
    for ( let x of ind_cut ) if ( !sides[x].includes(null) ) {
      // find non-trivial cut planes for matching respect to twisting cut planes `planes[x]`
    	let innercutables = new Array(ind_cut.length);
    	let outercutables = new Array(ind_cut.length);
    	let intercuts = new Array(ind_cut.length);
    	for ( let y of ind_cut ) {
      	let ycut_inner = sides[y].filter((_, i) =>  sides[x][i]);
      	let ycut_outer = sides[y].filter((_, i) => !sides[x][i]);

        innercutables[y] = !ycut_inner.includes(null);
        outercutables[y] = !ycut_outer.includes(null);

        let meet_inner = innercutables[y] ? ycut_inner.some(b => b) : true;
        let meet_outer = outercutables[y] ? ycut_outer.some(b => b) : true;

        intercuts[y] = meet_inner && meet_outer;
      }

      // align axes of cut planes to +y
      let {phi, theta} = new THREE.Spherical().setFromVector3(planes[x].normal);
      let rot = new THREE.Quaternion().setFromAxisAngle({x:-Math.cos(theta), y:0, z:Math.sin(theta)}, phi);
      let normals = planes.map(p => p.normal)
      	.map(n => n.clone().applyQuaternion(rot))
        .map(n => new THREE.Spherical().setFromVector3(n));

      // match intercuts
      angles[x] = [];
      matches[x] = [];
      for ( let y1 of ind_cut ) if ( intercuts[y1] && innercutables[y1] )
        for ( let y2 of ind_cut ) if ( intercuts[y2] && outercutables[y2] )
        	if ( y1 !== y2 )
      {
        if ( !this.fuzzyTool.equals(sphidius(planes[y2]), sphidius(planes[y1])) )
          break;
        if ( !this.fuzzyTool.equals(normals[y2].phi, normals[y1].phi) )
          break;
        
        let theta = (normals[y2].theta - normals[y1].theta)*2/pi;
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

  highlight(element) {
    element.children[0].material.color.setHex(0xffff88);
  }
  unhighlight(element) {
    element.children[0].material.color.setHex(element.userData.color);
  }
}

class TwistyBallBuilder extends TwistySphereBuilder
{
  constructor(param={}) {
    param.shape = new THREE.IcosahedronGeometry(1, 3);
    TwistyBallBuilder.computeVertexNormals(param.shape);
    super(param);
  }
  static computeVertexNormals(geometry) {
    const ind = ['a', 'b', 'c'];
    for ( let f of geometry.faces )
      for ( let i=0; i<3; i++ )
        f.vertexNormals[i].copy(geometry.vertices[f[ind[i]]]).normalize();
  }
  static makeCircle(plane) {
    var radius = Math.sqrt(1 - plane.constant*plane.constant);

    var circle = new THREE.CircleGeometry(radius, Math.ceil(360*radius));
    circle.vertices.shift();
    circle.faces.length = 0;
    circle.translate(0, 0, -plane.constant);
    circle.lookAt(plane.normal);
    return circle;
  }

  split(puzzle, ...planes) {
    if ( planes.length !== 1 )
      return planes.reduce((puzzle, plane) => this.split(puzzle, plane), puzzle);
    var plane = planes[0];
  
    var new_elements = [];
  	for ( let elem of puzzle.children ) {
    	let plane_ = planeWorldToLocal(elem, plane);
  
      // check sides of element respect to cut plane `plane_`
      let dis = elem.children[0].geometry.vertices.map(v => plane_.distanceToPoint(v));
      let setups;
      if ( dis.every(d => this.fuzzyTool.greater_than(d, 0)) ) {
        setups = [[elem, plane_, false]];
  
      } else if ( dis.every(d => this.fuzzyTool.greater_than(-d, 0)) ) {
        setups = [[elem, plane_.negate(), false]];
  
      } else {
        let new_elem = elem.clone();
        for ( let subelem of new_elem.children ) {
          subelem.material = subelem.material.clone();
          subelem.geometry = subelem.geometry.clone();
        }
        new_elements.push(new_elem);
        setups = [[elem, plane_, true], [new_elem, plane_.clone().negate(), true]];
      }
  
      // cut elements `elem` by plane `new_plane`
      for ( let [elem, new_plane, cuttable] of setups ) {
        let shell = elem.children[0];
        let edges = elem.children.slice(1);
  
        // shell part
        if ( cuttable )
          cutConvexPolyhedron(shell.geometry, new_plane, this.inner_part);
          TwistyBallBuilder.computeVertexNormals(shell.geometry);
  
        // edges part
        if ( this.inner_part ? cuttable : true ) {
          // original edges
          for ( let edge of edges )
            cutPolygon(edge.geometry, new_plane);
  
          // new edge induced by cut plane `new_plane`
          let new_edge = TwistyBallBuilder.makeCircle(new_plane);
          if ( new_edge )
            for ( let plane of elem.userData.planes )
              cutPolygon(new_edge, plane);
          else
            new_edge = new THREE.Geometry();
  
          let material;
          if ( edges.length === 0 )
            material = new THREE.LineBasicMaterial({color:elem.userData.edge_color, linewidth:3});
          else
            material = edges[0].material;
          elem.add(new THREE.LineLoop(new_edge, material));
          elem.userData.planes.push(new_plane);
        }
      }
  
    }
  
    for ( let new_element of new_elements )
      puzzle.add(new_element);
    return puzzle;
  }
}

class TwistController
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

      var enter_handler = event => { this.builder.highlight(event.target); };
      var leave_handler = event => { this.builder.unhighlight(event.target); };
      var click_handler = event => { remove(); resolve([event.target, elements.indexOf(event.target)]); };
      var esc_handler = event => { if ( event.which === 27 ) { remove(); reject("esc"); } };

      var remove = () => {
        for ( let elem of elements ) if ( elem )
          this.builder.unhighlight(elem);
        for ( let elem of elements ) if ( elem ) {
          elem.removeEventListener("mouseenter", enter_handler);
          elem.removeEventListener("mouseleave", leave_handler);
          elem.removeEventListener("click", click_handler);
          document.removeEventListener("keydown", esc_handler);
        }
      }

      for ( let elem of elements ) if ( elem ) {
        elem.addEventListener("mouseenter", enter_handler);
        elem.addEventListener("mouseleave", leave_handler);
        elem.addEventListener("click", click_handler);
        document.addEventListener("keydown", esc_handler);
      }
    });
  }
  selectCut(puzzle, filter=always) {
    return new Promise((resolve, reject) => {
      var cuts = puzzle.userData.planes.map((p, i) => filter(p, i) ? this.makeCutHelper(p) : null);
      for ( let c of cuts ) if ( c ) {
        c.material.transparent = true;
        c.material.opacity = 0.3;
      }

      var enter_handler = event => {
        event.target.material.opacity = 0.7;
        var x = cuts.indexOf(event.target);
        for ( let i in puzzle.userData.sides[x] )
          if ( puzzle.userData.sides[x][i] )
            this.builder.highlight(puzzle.children[i]);
      };
      var leave_handler = event => {
        event.target.material.opacity = 0.3;
        var x = cuts.indexOf(event.target);
        for ( let i in puzzle.userData.sides[x] )
          if ( puzzle.userData.sides[x][i] )
            this.builder.unhighlight(puzzle.children[i]);
      };
      var click_handler = event => {
        remove();
        var x = cuts.indexOf(event.target);
        var plane = puzzle.userData.planes[x];
        resolve([plane, x]);
      };
      var esc_handler = event => { if ( event.which === 27 ) { remove(); reject("esc"); } };

      var remove = () => {
        for ( let elem of puzzle.children )
          this.builder.unhighlight(elem);
        this.display.remove(...cuts.filter(c => c));
        document.removeEventListener("keydown", esc_handler);
      }

      this.display.add(...cuts.filter(c => c));
      for ( let c of cuts ) if ( c ) {
        c.userData.hoverable = true;
        c.addEventListener("mouseenter", enter_handler);
        c.addEventListener("mouseleave", leave_handler);
        c.addEventListener("click", click_handler);
        document.addEventListener("keydown", esc_handler);
      }
    });
  }
  selectTwist(puzzle, x, filter=always) {
    return new Promise((resolve, reject) => {
      var plane = puzzle.userData.planes[x];
      var angles = puzzle.userData.angles[x].map((a, i) => filter(a, i) ? a : null);

      var r = angles.filter(a => a).length - 0.8;
      var rings = angles.map(angle => angle && this.makeTwistHelper(plane, angle, (r--)/10, 0.08));

      for ( let r of rings ) {
        r.material.transparent = true;
        r.material.opacity = 0.3;
      }
      for ( let i in puzzle.userData.sides[x] )
        if ( puzzle.userData.sides[x][i] )
          this.builder.highlight(puzzle.children[i]);

      var enter_handler = event => { event.target.material.opacity = 0.7; };
      var leave_handler = event => { event.target.material.opacity = 0.3; };
      var click_handler = event => {
        remove();
        var i = rings.indexOf(event.target);
        var angle = i!==-1 ? puzzle.userData.angles[x][i] : 0;
        resolve([plane, angle, x, i]);
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
        document.addEventListener("keydown", esc_handler);
      }
    });
  }
  animatedTwist(puzzle, x, q) {
    var targets = puzzle.userData.sides[x].map((b, i) => b && puzzle.children[i]).filter(b => b);
    var axis = puzzle.userData.planes[x].normal;
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
  twistLoopHandler() {
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
    this.rotateSpeed = pi/500;
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

    // raycaster
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

    var click_flag = false;
    this.dom.addEventListener("mousedown", event => { click_flag = true; }, false);
    this.dom.addEventListener("mousemove", event => { click_flag = false; }, false);
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

