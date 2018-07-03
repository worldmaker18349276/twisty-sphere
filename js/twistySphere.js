class TwistySphereBuilder
{
  constructor(param) {
    param = Object.assign({
      R: 10,
      tolerance: 1e-5,
      color: 0xffffff,
      edge_color: 0xff0000,
      twisting_rate: 0.03,
      inner_part: false
    }, param);
    if ( param.shape === undefined ) {
      param.shape = new THREE.IcosahedronGeometry(param.R, 3);
      param.shape.computeFlatVertexNormals();
    }
  	this.shape = param.shape;
  	this.R = param.R;
    this.tolerance = param.tolerance;
    this.color = param.color;
    this.edge_color = param.edge_color;
    this.twisting_rate = param.twisting_rate;
    this.inner_part = param.inner_part;
  }
  plane(x, y, z, r) {
    var normal = new THREE.Vector3(x,y,z).normalize();
    var constant = this.R * Math.cos((2-r)*Math.PI/2);
    return new THREE.Plane(normal, constant);
  }
  sphidius(plane) {
    return 2 - Math.acos(plane.constant/this.R)*2/Math.PI;
  }
  plane_equals(p1, p2) {
    return (Math.abs(this.sphidius(p1) - this.sphidius(p2)) < this.tolerance)
        && (Math.abs(p1.normal.x-p2.normal.x) < this.tolerance)
        && (Math.abs(p1.normal.y-p2.normal.y) < this.tolerance)
        && (Math.abs(p1.normal.z-p2.normal.z) < this.tolerance);
  }
  makeSphericleHelper(plane, radius) {
    const Na = 50;
    if ( !radius ) {
      if ( !this.shape.boundingSphere )
        this.shape.computeBoundingSphere();
      radius = this.shape.boundingSphere.radius;
    }
    var circle = new THREE.CircleGeometry(radius, Math.ceil(Na*radius/this.R));
    circle.vertices.shift();
    circle.faces.length = 0;
    circle.translate(0, 0, -plane.constant);
    circle.lookAt(plane.normal);

    var color = new THREE.Color(`hsl(${Math.abs(this.sphidius(plane)-1)*300}, 100%, 50%)`);
    var material = new THREE.LineDashedMaterial({color:color, linewidth:3});
    return new THREE.LineSegments(circle, material);
  }
  makeDiskHelper(plane, opacity=1, radius) {
    const Na = 50;
    if ( !radius ) {
      if ( !this.shape.boundingSphere )
        this.shape.computeBoundingSphere();
      radius = this.shape.boundingSphere.radius;
    }
    var disk = new THREE.CircleGeometry(radius, Math.ceil(Na*radius/this.R));
    disk.translate(0, 0, -plane.constant);
    disk.lookAt(plane.normal);

    var color = new THREE.Color(`hsl(${Math.abs(this.sphidius(plane)-1)*300}, 100%, 50%)`);
    var material = new THREE.MeshBasicMaterial({
      color:color, transparent:true, opacity:opacity,
      side: THREE.DoubleSide
    });
    return new THREE.Mesh(disk, material);
  }

  make() {
    var elem_data = {
    	type: "element",
      color: this.color,
      edge_color: this.edge_color,
      planes: []
    };

    var material = new THREE.MeshLambertMaterial({color:elem_data.color});
    var shell = new THREE.Mesh(this.shape.clone(), material);

    var elem = new THREE.Object3D();
    elem.add(shell);
    elem.userData = elem_data;
    
    var puzzle = new THREE.Group();
    puzzle.add(elem);
    return puzzle;
  }
  planeToLocal(obj, plane) {
    plane = new THREE.Plane().copy(plane);
    plane.normal.applyQuaternion(obj.quaternion.clone().conjugate());
    return plane;
  }
  planeToWorld(obj, plane) {
    plane = new THREE.Plane().copy(plane);
    plane.normal.applyQuaternion(obj.quaternion);
    return plane;
  }
  split(puzzle, ...planes) {
    if ( planes.length !== 1 )
      return planes.reduce((puzzle, plane) => this.split(puzzle, plane), puzzle);
    var plane = planes[0];

    var new_elements = [];
  	for ( let elem of puzzle.children ) {
    	let plane_ = this.planeToLocal(elem, plane);

      // check sides of element respect to cut plane `plane_`
      let dis = elem.children[0].geometry.vertices.map(v => plane_.distanceToPoint(v));
      let setups;
      if ( dis.every(d => d > -this.tolerance) ) {
        setups = [[elem, plane_, false]];

      } else if ( dis.every(d => d < this.tolerance) ) {
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
  	var planes = puzzle.userData.planes = [];
    var sides = puzzle.userData.sides = [];
    for ( let i in puzzle.children ) for ( let plane of puzzle.children[i].userData.planes ) {
    	plane = this.planeToWorld(puzzle.children[i], plane);
    	let side = plane.constant < 0;
    	if ( !side ) plane = plane.negate();
      
    	var x = planes.findIndex(plane_ => this.plane_equals(plane_, plane));
      if ( x === -1 ) {
        planes.push(plane);
        x = sides.push(new Array(puzzle.children.length))-1;
      }
      sides[x][i] = side;
    }
    
    // find sides of elements respect to cut planes
    for ( let x in sides ) for ( let i in puzzle.children ) if ( !(i in sides[x]) ) {
      let planex = this.planeToLocal(puzzle.children[i], planes[x]);
    	let dis = puzzle.children[i].children[0].geometry.vertices.map(v => planex.distanceToPoint(v));
      if ( dis.every(d => d>-this.tolerance) )
      	sides[x][i] = true;
      else if ( dis.every(d => d<this.tolerance) )
      	sides[x][i] = false;
      else
      	sides[x][i] = null;
    }
    
    // find all possible twisting angles for each cut planes
    var angles = puzzle.userData.angles = new Array(sides.length);
    var matches = puzzle.userData.matches = new Array(sides.length);
    for ( let x in sides ) if ( !sides[x].includes(null) ) {
      let sidesx = sides[x];

      // find non-trivial cut planes for matching respect to twisting cut planes `planes[x]`
    	let intercuts1 = [];
    	let intercuts2 = [];
    	for ( let sidesy of sides ) {
      	let sidesy_inner = sidesy.filter((_, i) =>  sidesx[i]);
      	let sidesy_outer = sidesy.filter((_, i) => !sidesx[i]);
        let cuttable1 = !sidesy_inner.includes(null);
        let cuttable2 = !sidesy_outer.includes(null);
        
        let innercut = sidesy.every((b, i) =>  b ?  sidesx[i] : true);
        let outercut = sidesy.every((b, i) =>  b ? !sidesx[i] : true);
        let ultracut = sidesy.every((b, i) => !b ? !sidesx[i] : true);
        intercuts1.push(cuttable1 && !innercut && !outercut && !ultracut);
        intercuts2.push(cuttable2 && !innercut && !outercut && !ultracut);
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
      for ( let y1 in intercuts1 ) if ( intercuts1[y1] )
        for ( let y2 in intercuts2 ) if ( intercuts2[y2] )
        	if ( y1 !== y2 )
      {
        if ( Math.abs(planes[y2].constant - planes[y1].constant) > this.tolerance )
          break;
        if ( Math.abs(normals[y2].phi - normals[y1].phi) > this.tolerance )
          break;
        
        let theta = (normals[y2].theta - normals[y1].theta)*2/pi;
        theta = ((theta % 4) + 4) % 4;

        let q = angles[x].findIndex(a => Math.abs(a-theta) < this.tolerance);
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
  twist(puzzle, x, q, display, callback=function(){}) {
    var targets = puzzle.userData.sides[x].map((b, i) => b && puzzle.children[i]).filter(b => b);
    var axis = puzzle.userData.planes[x].normal;
    var angle = puzzle.userData.angles[x][q];
    var rot = new THREE.Quaternion().setFromAxisAngle(axis, angle*Math.PI/2);

    var startQuaternions = targets.map(e => e.quaternion.clone());
    var endQuaternions = startQuaternions.map(q => rot.clone().multiply(q));
    var span = 0;
    display.animations.push(() => {
      for ( let i in targets )
        THREE.Quaternion.slerp(startQuaternions[i], endQuaternions[i], targets[i].quaternion, span/angle);
      if ( span === angle ) {
        callback();
        return true;
      }
      span += this.twisting_rate;
      if ( span > angle ) span = angle;
    });
  }

  selectElement(puzzle, display, callback=function(){}) {
    var targets = puzzle.children.map(e => e.children[0]);
    display.addHoverHandler(
      targets,
      undefined,
      (event, hovering) => {
        for ( let elem of puzzle.children )
          elem.children[0].material.color.setHex(elem.userData.color);
        if ( hovering.object )
          hovering.object.material.color.setHex(0xffff88);
      },
      (event, hovering) => {
        if ( hovering.object ) {
          for ( let elem of puzzle.children )
            elem.children[0].material.color.setHex(elem.userData.color);
          callback(hovering.object.parent, puzzle.children.indexOf(hovering.object.parent));
          return true;
        }
      }
    );
  }
  selectPlane(puzzle, display, filter=function(){return true;}, callback=function(){}) {
    var sphericles = puzzle.userData.planes.filter(filter)
      .map(p => this.makeDiskHelper(p, 0.3));
    var xs = [...puzzle.userData.planes.keys()].filter(filter);
    for ( let sphericle of sphericles ) {
      display.scene.add(sphericle);
    }
    display.addHoverHandler(
      sphericles,
      undefined,
      (event, hovering) => {
        for ( let sphericle of sphericles )
          sphericle.material.opacity = 0.3;
        for ( let elem of puzzle.children )
          elem.children[0].material.color.setHex(elem.userData.color);

        if ( hovering.object ) {
          hovering.object.material.opacity = 0.7;
          let x = xs[sphericles.indexOf(hovering.object)];
          for ( let i in puzzle.userData.sides[x] )
            if ( puzzle.userData.sides[x][i] )
              puzzle.children[i].children[0].material.color.setHex(0xffff88);
        }

      },
      (event, hovering) => {
        if ( hovering.object ) {
          for ( let sphericle of sphericles )
            display.scene.remove(sphericle);
          var x = xs[sphericles.indexOf(hovering.object)];
          var plane = puzzle.userData.planes[x];
          callback(plane, x);
          return true;
        }
      }
    );
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
    this.zoomSpeed = 1/10;
    this.distanceRange = [20, 80];

    this.trackball = new THREE.Group();
    this.trackball.add(this.camera);
    this.scene.add(this.trackball);
    this.setCamera(10,20,30);

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

    // selector
    this.hoverable = [];
    this.hovering = {};

    var mouse = new THREE.Vector2();
    this.raycaster = new THREE.Raycaster();
    this.dom.addEventListener("mousemove", event => {
      mouse.set((event.clientX/window.innerWidth)*2 - 1,
                - (event.clientY/window.innerHeight)*2 + 1);
      this.raycaster.setFromCamera(mouse, this.camera);
      [this.hovering = {}] = this.raycaster.intersectObjects(this.hoverable);
    }, false);

    this.animations = [];
    var animate = () => {
      requestAnimationFrame(animate);
      this.animations = this.animations.filter(ani => !ani());
      this.renderer.render(this.scene, this.camera);
    };
    animate();
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
  addHoverHandler(targets, onmousedown=function(){}, onhover=function(){}, onclick=function(){}) {
    for ( let target of targets )
      display.hoverable.push(target);

    var flag = false;
    function remove_handler() {
      for ( let target of targets )
        display.hoverable.splice(display.hoverable.indexOf(target), 1);
      display.dom.removeEventListener("mousemove", hover_handler, false);
      display.dom.removeEventListener("mousedown", down_handler, false);
      display.dom.removeEventListener("mouseup", click_handler, false);
    }
    function down_handler(event) {
      flag = true;
      var hovering = targets.includes(display.hovering.object) ? display.hovering : {};
      if ( onmousedown(event, hovering) )
        remove_handler();
    }
    function hover_handler(event) {
      flag = false;
      var hovering = targets.includes(display.hovering.object) ? display.hovering : {};
      if ( onhover(event, hovering) )
        remove_handler();
    }
    function click_handler(event) {
      if ( flag ) {
        flag = false;
        var hovering = targets.includes(display.hovering.object) ? display.hovering : {};
        if ( onclick(event, hovering) )
          remove_handler();
      }
    }
    display.dom.addEventListener("mousedown", down_handler, false);
    display.dom.addEventListener("mousemove", hover_handler, false);
    display.dom.addEventListener("mouseup", click_handler, false);
  }
}

