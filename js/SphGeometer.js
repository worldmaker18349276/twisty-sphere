const SAMECUT = Symbol("SAMECUT");
const ANTICUT = Symbol("ANTICUT");
const KISSING_INNERCUT = Symbol("KISSING_INNERCUT");
const INNERCUT = Symbol("INNERCUT");
const KISSING_ULTRACUT = Symbol("KISSING_ULTRACUT");
const ULTRACUT = Symbol("ULTRACUT");
const KISSING_OUTERCUT = Symbol("KISSING_OUTERCUT");
const OUTERCUT = Symbol("OUTERCUT");
const KISSING_EXTRACUT = Symbol("KISSING_EXTRACUT");
const EXTRACUT = Symbol("EXTRACUT");
const INTERCUT = Symbol("INTERCUT");

const tolerance = 1e-5;

class SphGeometer
{
  static alignment(center, v0) {
    var {phi, theta} = new THREE.Spherical().setFromVector3(center);
    var rot = new THREE.Quaternion().setFromAxisAngle({x:-Math.cos(theta), y:0, z:Math.sin(theta)}, phi);
    if ( v0 ) {
      var v0_ = new THREE.Vector3().copy(v0).applyQuaternion(rot);
      var {theta:theta0} = new THREE.Spherical().setFromVector3(v0_);
      rot.premultiply(new THREE.Quaternion().setFromAxisAngle({x:0, y:0, z:1}, -theta0));
    }
    return rot;
  }
  static angleTo(center, v0, v1) {
    var rot = this.alignment(center, v0);
    var v1_ = new THREE.Vector3().copy(v1).applyQuaternion(rot);
    var {theta} = new THREE.Spherical().setFromVector3(v1_);
    return theta*2/Math.PI;
  }
  static theta(rot, v1) {
    var v1_ = new THREE.Vector3().copy(v1).applyQuaternion(rot);
    var {theta} = new THREE.Spherical().setFromVector3(v1_);
    return theta*2/Math.PI;
  }
  static q_sub(q, q0) {
    q = ((q-q0) % 4 + 4) % 4;
    return q;
  }
  static q_gt(qa, qb, q0) {
    qa = ((qa-q0) % 4 + 4) % 4;
    qb = ((qb-q0) % 4 + 4) % 4;
    return qa > qb;
  }
  static fzy_eq(v1, v2) {
    if ( Array.isArray(v1) )
      return v1.every((_, i) => this.fzy_eq(v1[i], v2[i]));
    else if ( v1.x !== undefined && v1.y !== undefined && v1.z !== undefined ) // THREE.Vector3
      return ["x", "y", "z"].every(i => this.fzy_eq(v1[i], v2[i]));
    else
      return Math.abs(v1-v2) < tolerance;
  }

  // circle = {center:{x, y, z}, quad:q}
  static copy(circle) {
    return {center:new THREE.Vector3().copy(circle.center), quad:circle.quad};
  }
  static negate(circle) {
    return {center:new THREE.Vector3().copy(circle.center).negate(), quad:2-circle.quad};
  }
  static relation(c1, c2) {
    var phi = c2.center.angleTo(c1.center)*2/Math.PI;
    console.assert(phi >= 0 && phi <= 2);
    console.assert(c2.quad >= 0 && c2.quad <= 2);
    console.assert(c1.quad >= 0 && c1.quad <= 2);

    if ( this.fzy_eq(phi, 0) && this.fzy_eq(c1.quad, c2.quad) )
      return SAMECUT;
    else if ( this.fzy_eq(phi, 2) && this.fzy_eq(c1.quad + c2.quad, 2) )
      return ANTICUT;
    else if ( this.fzy_eq(phi, c1.quad - c2.quad) )
      return KISSING_INNERCUT;
    else if ( phi < c1.quad - c2.quad )
      return INNERCUT;
    else if ( this.fzy_eq(phi, c2.quad - c1.quad) )
      return KISSING_ULTRACUT;
    else if ( phi < c2.quad - c1.quad )
      return ULTRACUT;
    else if ( this.fzy_eq(phi, c2.quad + c1.quad) )
      return KISSING_OUTERCUT;
    else if ( phi > c2.quad + c1.quad )
      return OUTERCUT;
    else if ( this.fzy_eq(4-phi, c2.quad + c1.quad) )
      return KISSING_EXTRACUT;
    else if ( 4-phi < c2.quad + c1.quad )
      return EXTRACUT;
    else if ( phi < c2.quad + c1.quad )
      return INTERCUT;
    else
      throw `unknown case: phi=${phi}, quad1=${c2.quad}, quad2=${c1.quad}`;
  }
  static quadrant(plane, R=1) {
    return 2 - Math.acos(plane.constant/R)*2/Math.PI;
  }
  static plane(center, quad, R=1) {
    if ( Array.isArray(center) )
      center = new THREE.Vector3().fromArray(center).normalize();
    else
      center = new THREE.Vector3().copy(center).normalize();
    var constant = Math.cos((2-quad)*Math.PI/2)*R;
    return new THREE.Plane(center, constant);
  }
  static ncolor(normal) {
    let {phi, theta} = new THREE.Spherical().setFromVector3(normal);
    return new THREE.Color().setHSL(theta/2/Math.PI, 1, phi/Math.PI);
  }
  static qcolor(quad) {
    return new THREE.Color().setHSL(Math.abs(quad-1)*5/6, 1, 0.5);
  }

  // pick = {
  //   vertices: [v0, v1, v2, ...],
  //   circles:  [c0, c1, c2, ...],
  //   alignments:[rot0, rot1, rot2, ...],
  //   arcs:     [
  //               [ind_c0, theta_v0, ind_v0, theta_v1, ind_v1], /*arc*/
  //               [ind_c2, theta_v3, ind_v3], /*circle*/
  //               [ind_c1], /*circle*/
  //               ...
  //             ]
  // }
  static pick(circle) { // guitar pick-like piece of shell
    if ( !circle )
      return {vertices:[], circles:[], alignments:[], arcs:[]};
    else
      return {vertices:[], circles:[circle], alignments:[this.alignment(circle)], arcs:[[0]]};
  }
  static kiss(c0, c1, dir=1) {
    if ( c1 ) {
      let n = new THREE.Vector3().crossVectors(c0.center, c1.center).normalize();
      let v = new THREE.Vector3().copy(c0.center).applyAxisAngle(n, dir*c0.quad*Math.PI/2);
      return v;

    } else {
      let {theta} = new THREE.Spherical().setFromVector3(c0.center);
      let n = {x:-Math.cos(theta), y:0, z:Math.sin(theta)};
      let v = new THREE.Vector3().copy(c0.center).applyAxisAngle(n, c0.quad*Math.PI/2);
      return v;
    }
  }
  static meet(c0, c1, rel) {
    if ( !rel ) rel = this.relation(c0, c1);

    if ( [SAMECUT, ULTRACUT, EXTRACUT, ANTICUT, INNERCUT, OUTERCUT].includes(rel) ) {
        return [];

    } else if ( [KISSING_INNERCUT, KISSING_OUTERCUT].includes(rel) ) {
      return [this.kiss(c0, c1, +1)];

    } else if ( [KISSING_ULTRACUT, KISSING_EXTRACUT].includes(rel) ) {
      return [this.kiss(c0, c1, -1)];

    } else if ( rel === INTERCUT ) {
      let a = c0.quad*Math.PI/2;
      let b = c1.quad*Math.PI/2;
      let n = new THREE.Vector3().crossVectors(c0.center, c1.center);
      let c = Math.asin(n.length());
      n.normalize();

      // cosine rules for spherical triangle: cos a = cos b cos c + sin b sin c cos A
      let cosA = (Math.cos(a) - Math.cos(b)*Math.cos(c))/(Math.sin(b)*Math.sin(c));
      let A = Math.acos(cosA);

      // // half-angle formulas for spherical triangle:
      // //                _____________________               _________________
      // //               / sin (s-b) sin (s-c)               / sin s sin (s-a)
      // //   sin A/2 =  / ---------------------  cos A/2 =  / -----------------
      // //            ,/      sin b sin c                 ,/     sin b sin c    
      // let s = (a + b + c)/2;
      // let sinAhalf = Math.sqrt((Math.sin(s-b)*Math.sin(s-c))/(Math.sin(b)*Math.sin(c)));
      // let cosAhalf = Math.sqrt((Math.sin(s)  *Math.sin(s-a))/(Math.sin(b)*Math.sin(c)));
      // let A = Math.atan2(sinAhalf, cosAhalf)*2;

      console.assert(!isNaN(A) && A > 0);
      let v0 = new THREE.Vector3().copy(c0.center).applyAxisAngle(n, a);
      let v1 = new THREE.Vector3().copy(v0.center).applyAxisAngle(c0.center, -A);
      let v2 = new THREE.Vector3().copy(v0.center).applyAxisAngle(c0.center,  A);
      return [v1, v2];

    } else {
      console.assert(false);
    }
  }
  static mask(arc0, arc1) {
    if ( arc0.length > arc1.length )
      [arc0, arc1] = [arc1, arc0];
    var [x, ai, i, aj, j] = arc0;
    var [y, ak, k, al, l] = arc1;
    console.assert(x === y);

    if ( i === undefined && j === undefined ) { // arc0 = [x], arc1 = [...]
      return [arc1];

    } else if ( j === undefined ) {
      // slice circle
      if ( l === undefined ) { // arc0 = [x, ai, i], arc1 = [y, ak, k]
        if ( i !== k ) {
          return [[x, ai, i, ak, k], [x, ak, k, ai, i]];
        } else {
          return [arc1];
        }

      } else { // arc0 = [x, ai, i], arc1 = [y, ak, k, al, l]
        if ( this.q_gt(al, ai, ak) ) {
          return [[x, ak, k, ai, i], [x, ai, i, al, l]];
        } else {
          return [arc1];
        }
      }

    } else { // arc0 = [x, ai, i, aj, j], arc1 = [y, ak, k, al, l]
      // slice arc
      let rk = this.q_gt(aj, ak, ai);
      let rl = this.q_gt(aj, al, ai);
      if ( this.q_gt(al, ak, ai) ) { // al > ak
        if (  rk &&  rl ) {
          return [[x, ak, k, al, l]];

        } else if (  rk && !rl ) {
          return [[x, ak, k, aj, j]];

        } else if ( !rk && !rl ) {
          return [];

        } else {
          console.assert(false);
        }

      } else { // al < ak
        if (  rk &&  rl ) {
          return [[x, ai, i, al, l], [x, ak, k, aj, j]];

        } else if ( !rk &&  rl ) {
          return [[x, ai, i, al, l]];

        } else if ( !rk && !rl ) {
          return [[x, ai, i, aj, j]];

        } else {
          console.assert(false);
        }
      }

    }
  }
  static sliceShell(pick, circle) {
    var relations = pick.circles.map(c0 => this.relation(c0, circle));
    if ( relations.includes(SAMECUT) ) {
      return [pick, this.pick()];
    } else if ( relations.includes(ANTICUT) ) {
      return [this.pick(), pick];
    } else if ( relations.includes(ULTRACUT) || relations.includes(KISSING_ULTRACUT) ) {
      pick.circles.push(circle);
      return [pick, this.pick()];
    } else if ( relations.includes(OUTERCUT) || relations.includes(KISSING_OUTERCUT) ) {
      pick.circles.push(circle);
      return [this.pick(), pick];
    }

    // find intersection points
    var intersections = pick.circles
      .map((c0, x) => this.meet(c0, circle, relations[x]))
      .map((vs, x) => vs.map(v => {
        var i = pick.vertices.findIndex(vertex => this.fzy_eq(vertex, v));
        if ( i === -1 ) i = pick.vertices.push(v)-1;
        return i;
      }));
    var angles = intersections
      .map((vs, x) => vs.map(i => this.theta(pick.alignments[x], pick.vertices[i])));

    // slice old arcs
    var arcs = [];
    var arcs_back = [];
    for ( let arc of pick.arcs ) {
      let [x, ai, i, aj, j] = arc;
      let c0 = pick.circles[x];
      let rel = relations[x];
      let vs = intersections[x];
      let as = angles[x];

      if ( rel === EXTRACUT ) {
        arcs.push(arc);

      } else if ( rel === INNERCUT ) {
        arcs_back.push(arc);

      } else if ( rel === KISSING_EXTRACUT ) {
        arcs.push(...this.mask(arc, [x, as[0], vs[0]]));

      } else if ( rel === KISSING_INNERCUT ) {
        arcs_back.push(...this.mask(arc, [x, as[0], vs[0]]));

      } else if ( rel === INTERCUT ) {
        arcs.push(...this.mask(arc, [x, as[0], vs[0], as[1], vs[1]]));
        arcs_back.push(...this.mask(arc, [x, as[1], vs[1], as[0], vs[0]]));

      } else {
        console.assert(false);
      }
    }

    // make new arcs
    var y = pick.circles.length;
    var rot = this.alignment(circle);
    var circle_back = this.negate(circle);
    var rot_back = this.alignment(circle_back);

    var new_angles = intersections
      .map((vs, x) => vs.map(i => this.theta(rot, pick.vertices[i])));
    var new_angles_back = intersections
      .map((vs, x) => vs.map(i => this.theta(rot_back, pick.vertices[i])));

    var new_arcs = [[y]];
    var new_arcs_back = [[y]];
    for ( let x in pick.circles ) {
      let c0 = pick.circles[x];
      let rel = relations[x];
      let vs = intersections[x];
      let as = new_angles[x];
      let as_back = new_angles_back[x];

      if ( rel === EXTRACUT || rel === INNERCUT ) {
        // nothing changed

      } else if ( rel === KISSING_EXTRACUT || rel === KISSING_INNERCUT ) {
        new_arcs = new_arcs
          .map(arc => this.mask(arc, [y, as[0], vs[0]])).flat();
        new_arcs_back = new_arcs_back
          .map(arc => this.mask(arc, [y, as_back[0], vs[0]])).flat();

      } else if ( rel === INTERCUT ) {
        new_arcs = new_arcs
          .map(arc => this.mask(arc, [y, as[1], vs[1], as[0], vs[0]])).flat();
        new_arcs_back = new_arcs_back
          .map(arc => this.mask(arc, [y, as_back[0], vs[0], as_back[1], vs[1]])).flat();

      } else {
        console.assert(false);
      }
    }

    // build picks
    var pick_back = {
      vertices: pick.vertices.slice(0),
      circles: pick.circles.slice(0),
      alignments: pick.alignments.slice(0),
    };
    pick.circles[y] = circle;
    pick.alignments[y] = rot;
    pick_back.circles[y] = circle_back;
    pick_back.alignments[y] = rot_back;

    pick.arcs = [];
    pick.arcs.push(...arcs);
    pick.arcs.push(...new_arcs);
    pick_back.arcs = [];
    pick_back.arcs.push(...arcs_back);
    pick_back.arcs.push(...new_arcs_back);

    return [pick, pick_back];
  }

  static makeLines(shell, geometry=new THREE.Geometry(), dq=0.05) {
    var mat = new THREE.LineBasicMaterial({color:0xff0000});

    for ( let [x, ai, i, aj, j] of shell.arcs ) {
      let circle = arc.circles[x];
      let sub = new THREE.Geometry();

      let vi, vj, a;
      if ( i === undefined && j === undefined ) {
        vi = this.kiss(circle);
        vj = vi;
        a = 4;
      } else if ( j === undefined ) {
        vi = shell.vertices[i];
        vj = vi;
        a = 4;
      } else {
        vi = shell.vertices[i];
        vj = shell.vertices[j];
        a = this.q_sub(aj, ai);
      }

      let da = dq/Math.cos(circle.quad*Math.PI/2);
      let length = Math.floor(a/da)+1;
      sub.vertices.from({length}, (_, i) => vi.clone().applyAxisAngle(circle.center, i*da*Math.PI/2));
      sub.vertices.push(vj.clone());

      geometry.add(new THREE.Line(sub, mat));
    }
    
    return geometry;
  }
}
