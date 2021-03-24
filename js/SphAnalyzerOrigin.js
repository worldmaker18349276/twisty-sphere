"use strict";

// fuzzy operation
function fzy_cmp(v1, v2, tol=1e-5) {
  if ( v1 === v2 ) {
    return 0;

  } else if ( (typeof v1 == "string" || v1 instanceof String)
           && (typeof v2 == "string" || v2 instanceof String) ) {
    return ((v1>v2)-(v2>v1))/2;

  } else if ( (typeof v1 == "number" || v1 instanceof Number)
           && (typeof v2 == "number" || v2 instanceof Number) ) {
    return Math.abs(v1-v2) < tol ? 0 : Math.sign(v1-v2);

  } else if ( Array.isArray(v1) && Array.isArray(v2) ) {
    for ( let i=0, len=Math.min(v1.length, v2.length); i<len; i++ ) {
      switch ( fzy_cmp(v1[i], v2[i], tol) ) {
        case  0: continue;
        case +1: return +1;
        case -1: return -1;
      }
    }
    return Math.sign(v1.length-v2.length);

  } else {
    throw new Error("incomparable");
  }
}
function fzy_snap(val, snaps=[], tol=1e-5) {
  for ( let snap of snaps )
    if ( fzy_cmp(val, snap, tol) == 0 )
      return snap;
  return val;
}
function fzy_mod(val, mod, snaps=[], tol=1e-5) {
  if ( val < 0 || val >= mod )
    val = (val % mod + mod) % mod;

  for ( let snap of snaps )
    if ( fzy_cmp(fzy_mod(val-snap+mod/2, mod, [], 0), mod/2, tol) == 0 )
      return snap;

  return val;
}

// vector
function dot([x1, y1, z1], [x2, y2, z2]) {
  return x1*x2 + y1*y2 + z1*z2;
}
function cross([x1, y1, z1], [x2, y2, z2], out=[]) {
  out[0] = y1*z2 - z1*y2;
  out[1] = z1*x2 - x1*z2;
  out[2] = x1*y2 - y1*x2;
  return out;
}
function norm(v) {
  return Math.sqrt(dot(v, v));
}
function normalize([x, y, z], out=[]) {
  var n = norm([x,y,z]);
  out[0] = x/n;
  out[1] = y/n;
  out[2] = z/n;
  return out;
}
function angleTo(a, b, axis) {
  if ( axis === undefined ) {
    let s = norm(cross(a, b));
    let c = dot(a, b);
    return Math.atan2(s, c);

  } else {
    a = normalize(cross(axis, a));
    b = normalize(cross(axis, b));
    let s = dot(axis, cross(a, b));
    let c = dot(a, b);
    return Math.atan2(s, c);
  }
}

// quaternion
function quaternion([x, y, z], angle, out=[]) {
  var s = Math.sin(angle/2);
  var c = Math.cos(angle/2);
  out[0] = x*s;
  out[1] = y*s;
  out[2] = z*s;
  out[3] = c;
  return out;
}
function q_inv([x, y, z, w], out=[]) {
  out[0] = -x;
  out[1] = -y;
  out[2] = -z;
  out[3] =  w;
  return out;
}
function q_mul([x1, y1, z1, w1], [x2, y2, z2, w2], out=[]) {
  // [v1, w1] * [v2, w2] = [w1 * v2 + w2 * v1 + v1 x v2, w1 * w2 - v1 * v2]
  out[0] = w1*x2 + x1*w2 + y1*z2 - z1*y2;
  out[1] = w1*y2 + y1*w2 + z1*x2 - x1*z2;
  out[2] = w1*z2 + z1*w2 + x1*y2 - y1*x2;
  out[3] = w1*w2 - x1*x2 - y1*y2 - z1*z2;
  return out;
}
function rotate([x, y, z, w], q, out=[]) {
  if ( w !== undefined ) {
    q_mul(q, [x,y,z,w], out);
    q_mul(out, q_inv(q), out);
    return out;
  } else {
    var out_ = rotate([x,y,z,0], q);
    out[0] = out_[0];
    out[1] = out_[1];
    out[2] = out_[2];
    return out;
  }
}
function q_align([x, y, z], v_xz, out=[]) {
  var theta = Math.atan2(y, x);
  var phi = Math.atan2(Math.sqrt(x*x+y*y), z);
  var n = [-Math.sin(theta), Math.cos(theta), 0];
  quaternion(n, phi, out);
  if ( v_xz !== undefined ) {
    var [x_, y_] = rotate(v_xz, q_inv(out));
    var theta_ = Math.atan2(y_, x_);
    q_spin(out, theta_, out);
  }
  return out;
}
function q_spin(q, theta, out=[]) {
  return q_mul(q, quaternion([0,0,1], theta), out);
}


/**
 * Quadrant; unit of angle and arc.  One quadrant is one quarter of a circle.
 * The method in {@link SphCircle}, {@link SphSeg}, {@link SphElem} and
 * {@link SphAnalyzer} will use this unit for angle and arc.
 * @const
 * @type {number}
 */
const Q = Math.PI/2;

// cosine rules for spherical triangle: cos a = cos b cos c + sin b sin c cos A
function abcA(a, b, c) {
  var [ca, cb, cc] = [Math.cos(a*Q), Math.cos(b*Q), Math.cos(c*Q)];
  var [sb, sc] = [Math.sin(b*Q), Math.sin(c*Q)];
  var cA = (ca - cb*cc)/(sb*sc);
  return Math.acos(cA)/Q;
}
// cosine rules for spherical triangle: cos a = cos b cos c + sin b sin c cos A
function Abca(A, b, c) {
  var cA = Math.cos(A*Q);
  var [cb, cc] = [Math.cos(b*Q), Math.cos(c*Q)];
  var [sb, sc] = [Math.sin(b*Q), Math.sin(c*Q)];
  var ca = cb*cc + sb*sc*cA;
  return Math.acos(ca)/Q;
}
// cotangent rule for spherical triangle: cos b cos C = cot a sin b - cot A sin C
function abCA(a, b, C) {
  var [ca, sa] = [Math.cos(a*Q), Math.sin(a*Q)];
  var [cb, sb] = [Math.cos(b*Q), Math.sin(b*Q)];
  var [cC, sC] = [Math.cos(C*Q), Math.sin(C*Q)];
  var [cA_, sA_] = [ca*sb-sa*cb*cC, sa*sC];
  if ( sA_ < 0 ) cA_ = -cA_;
  if ( sa < 0 ) sA_ = -sA_;
  return Math.atan2(sA_, cA_)/Q;
}

/**
 * Spherical circle with orientation.
 * The orientation define coordinate of points on the circle.
 *
 * @class
 * @property {number[]} center - Center of spherical circle.
 *   It must be normalized vector.
 * @property {number} radius - Radius of spherical circle, in the range of (0, 2).
 * @property {number[]} orientation - Orientation of spherical circle.
 *   It will rotate `[0,0,1]` to center of this circle, and rotate `[s,0,c]` to
 *   the point on this circle, which is origin of coordinate on the circle.
 */
class SphCircle
{
  constructor({radius, orientation}={}) {
    this.radius = radius;
    this.orientation = orientation.slice(0);
  }
  get center() {
    return rotate([0,0,1], this.orientation);
  }

  shift(theta) {
    q_spin(this.orientation, theta*Q, this.orientation);
    return this;
  }
  complement() {
    this.radius = 2-this.radius;
    q_mul(this.orientation, [1,0,0,0], this.orientation);
    return this;
  }
  rotate(q) {
    q_mul(this.orientation, q, this.orientation);
    return this;
  }

  /**
   * Get position of vector projected onto this circle.
   *
   * @param {number[]} vector - The vector to project.
   * @returns {number} The coordinate of projected vector.
   *   Notice that it may not modulus of 4.
   */
  thetaOf(vector) {
    var [x, y] = rotate(vector, q_inv(this.orientation));
    return Math.atan2(y, x)/Q;
  }
  /**
   * Get vector of on this circle with given coordinate.
   *
   * @param {number} theta - The coordinate of point on this circle.
   * @returns {number[]} The vector on this circle with coordinate `theta`.
   */
  vectorAt(theta) {
    var vec = [
      Math.sin(this.radius*Q)*Math.cos(theta*Q),
      Math.sin(this.radius*Q)*Math.sin(theta*Q),
      Math.cos(this.radius*Q)
    ];
    return rotate(vec, this.orientation);
  }
}

/**
 * Boundary segment (and its starting vertex) of element of spherical twisty puzzle.
 * It is fundamental piece of structure of BREP, and has information about
 * spherical arc, vertex, connection of segments, adjacency, etc.
 *
 * @class
 * @property {number} arc - Spherical arc angle of segment, in the range of (0, 4].
 * @property {number} angle - Angle between this segment and previous segment.
 *   The direction is from this segment to previous segment, in the range of [0, 4].
 * @property {number} radius - Radius of curvature of segment, in the range of (0, 2).
 * @property {number[]} orientation - Orientation of this segment.
 *   It will rotate `[0,0,1]` to center of curvature of this segment, and rotate
 *   `[s,0,c]` to the starting vertex of this segment.
 * @property {number[]} vertex - starting vertex of this segment.
 * @property {SphCircle} circle - circle along this segment with same orientation.
 * @property {SphSeg} next - The next segment.
 * @property {SphSeg} prev - The previous segment.
 * @property {Map<SphSeg,number>} adj - The map of adjacent segments.
 *   where key is adjacent segment, and value is offset between vertices, in the
 *   range of (0, 4].  This map is sorted by offsets.
 * @property {SphElem} affiliation - The affiliation of this segment.
 * @property {SphTrack} track - The track of this segment.
 */
class SphSeg
{
  constructor({arc, angle, radius, orientation}={}) {
    this.arc = arc;
    this.angle = angle;
    this.radius = radius;
    this.orientation = orientation && orientation.slice(0);

    this.next = undefined;
    this.prev = undefined;
    this.adj = new Map();
    this.adj.set = function(k, v) {
      // insert by order of values
      if ( typeof v != "number" )
        throw new Error("value is not a number!");

      this.delete(k);
      var stack = [[k, v]];
      for ( let [k_, v_] of this.entries() )
        if ( v_ >= v ) {
          this.delete(k_);
          stack.push([k_, v_]);
        }

      for ( let [k_, v_] of stack )
        Map.prototype.set.call(this, k_, v_);

      return this;
    };
    this.affiliation = undefined;
    this.track = undefined;
  }
  get vertex() {
    var vec = [Math.sin(this.radius*Q), 0, Math.cos(this.radius*Q)];
    return rotate(vec, this.orientation);
  }
  get circle() {
    var {radius, orientation} = this;
    return new SphCircle({radius, orientation});
  }

  connect(seg) {
    [this.next, seg.prev] = [seg, this];
  }
  adjacent(seg, offset) {
    if ( offset === undefined ) {
      this.adj.delete(seg);
      seg.adj.delete(this);
    } else {
      this.adj.set(seg, offset);
      seg.adj.set(this, offset);
    }
  }

  *walk() {
    var seg = this;
    do {
      yield seg;
      seg = seg.next;

      if ( seg === undefined )
        return false;
    } while ( seg !== this );
    return true;
  }

  rotate(q) {
    q_mul(q, this.orientation, this.orientation);
    return this;
  }
}

/**
 * Element of spherical twisty puzzle.
 * It represent the region defined by boundaries (BREP).  The element without
 * boundary indicate full space of spherical surface.
 *
 * @class
 * @property {Set<SphSeg>} boundaries - Segments of boundaries.
 */
class SphElem
{
  constructor() {
    this.boundaries = new Set();
  }

  accept(...segments) {
    for ( let seg of segments ) {
      this.boundaries.add(seg);
      seg.affiliation = this;
    }
  }
  withdraw(...segments) {
    for ( let seg of segments )
      if ( this.boundaries.delete(seg) )
        seg.affiliation = undefined;
  }
  split(...groups) {
    var elements = [];
    for ( let group of groups ) if ( group.length ) {
      let elem = new SphElem();
      this.withdraw(...group);
      elem.accept(...group);
      elements.push(elem);
    }
    return elements;
  }
  merge(...elements) {
    for ( let element of elements ) if ( element !== this ) {
      this.accept(...element.boundaries);
      element.boundaries.clear();
    }
    return this;
  }

  *fly() {
    var segs = new Set(this.boundaries);
    for ( let seg0 of segs ) {
      for ( let seg of seg0.walk() )
        segs.delete(seg);
      yield seg0;
    }
  }

  rotate(q) {
    for ( let seg of this.boundaries )
      seg.rotate(q);
    return this;
  }
}

/**
 * Track of spherical twisty puzzle.
 * It represent the full circle of gap between elements, which is able to twist.
 * It also contains information to predict meaningful twist angles.
 * By twisting this track, it may form new track intersecting this track, and
 * this possibility is predictable and leave unchanged after twisting disjoint
 * track.  On the other hand, twisting intersected track will break this track,
 * and of course, in this condition such prediction becomes useless.
 * Only such twist angles, which may form new track, may be meaningful, and which
 * can be determined by the shield of this track...
 *
 * @class
 * @property {SphSeg[]} inner - Segments of inner of track.
 * @property {SphSeg[]} outer - Segments of outer of track.
 * @property {number} shift - Offset between the first segments in `inner` and
 *   `outer`.  Notice that it may not modulus of 4.
 * @property {Map<SphTrack,object>} latches - The map from intersected track to
 *   latches.  Latch is object with values `{center, arc, angle}`.
 * @property {SphCircle} circle - Inner circle of track.
 */
class SphTrack
{
  constructor() {
    this.inner = [];
    this.outer = [];
    this.shift = 0;
    this.latches = new Map();
  }
  get circle() {
    return this.inner[0].circle;
  }

  indexOf(track) {
    var s = "inner";
    var i = this.inner.indexOf(track);
    if ( i == -1 ) {
      s = "outer";
      i = this.outer.indexOf(track);
    }
    if ( i == -1 )
      return undefined;
    var offset = this[s].slice(0, i).reduce((acc, seg) => acc+seg.arc, 0);
    return [s, i, offset];
  }
  lay(inner, outer, shift) {
    this.inner = inner.slice(0);
    this.outer = outer.slice(0);
    this.shift = shift;
    for ( let seg of inner )
      seg.track = this;
    for ( let seg of outer )
      seg.track = this;
    return this;
  }
  tearDown() {
    for ( let [track, latch] of this.latches )
      this.unlock(track);
    for ( let seg of this.inner )
      seg.track = undefined;
    for ( let seg of this.outer )
      seg.track = undefined;
    this.inner = [];
    this.outer = [];
    return this;
  }

  insertAfter(seg, seg0) {
    var i = this.inner.indexOf(seg0);
    if ( i != -1 ) {
      this.inner.splice(i+1, 0, seg);
      seg.track = this;
      return;
    }

    i = this.outer.indexOf(seg0);
    if ( i != -1 ) {
      this.outer.splice(i+1, 0, seg);
      seg.track = this;
      return;
    }
  }
  remove(seg) {
    var i = this.inner.indexOf(seg);
    if ( i != -1 ) {
      if ( i == 0 && this.inner[1] ) {
        this.dial(this.inner[1]);
        i = this.inner.length-1;
      }
      this.inner.splice(i, 1);
      seg.track = undefined;
      return;
    }

    i = this.outer.indexOf(seg);
    if ( i != -1 ) {
      if ( i == 0 && this.outer[1] ) {
        this.dial(this.outer[1]);
        i = this.outer.length-1;
      }
      this.outer.splice(i, 1);
      seg.track = undefined;
      return;
    }
  }

  lock(track, latch, latch_) {
    this.latches.set(track, latch);
    track.latches.set(this, latch_);
  }
  unlock(track) {
    this.latches.delete(track);
    track.latches.delete(this);
  }

  dial(seg) {
    if (this.inner.includes(seg) ) {
      while ( this.inner[0] !== seg ) {
        this.shift = this.shift - this.inner[0].arc;
        for ( let [track, latch] of this.latches )
          latch.center = latch.center - this.inner[0].arc;
        this.inner.push(this.inner.shift());
      }

    } else if (this.outer.includes(seg) ) {
      while ( this.outer[0] !== seg ) {
        this.shift = this.shift - this.outer[0].arc;
        this.outer.push(this.outer.shift());
      }

    } else {
      throw new Error("seg is not in this track!");
    }
  }
  flip() {
    [this.inner, this.outer] = [this.outer, this.inner];
    for ( let [track, latch] of this.latches ) {
      let latch_ = track.latches.get(this);
      latch.center = this.shift - latch.center;
      latch.angle = latch_.angle = 2 - latch.angle;
      latch_.arc = 4 - latch_.arc;
      latch_.center = 2 + latch_.center;
    }
  }
}

/**
 * Collection of shapes of loops in a knot.
 * It contains the minimal information about how to make simply-connected elements.
 * It also provide a method to parameterize the states and operations of puzzle.
 *
 * index:
 * Segment of puzzle can be indicated by four indices: index of type, index of
 * elements with this type, index of rotation, and index of segment in the patch.
 * We always write "i,j;k,l" represent such index system.
 *
 * permutation:
 * Using index system, we can express permutation of segments (permutation and
 * rotation of elements) as 2D array `perm` with entries `[j_, dk] = perm[i][j]`,
 * where `j_` is the new position of element, and `dk` means rotation of element:
 * the segment at "i,j;k,l" will be moved to "i,j_;k+dk,l".
 *
 * parameters:
 * We use 2D array to denote additional information about elements.  For example,
 * `colors[i][j]` is color of element at "i,j".  We use 3D array to denote
 * additional information about segments.  For example, `quat[i][j][k*fold+l]`
 * is orientation of segment at "i,j;k,l".  Moreover, the last dimension can be
 * constructed by cyclic linked list.  For example, `segs[i][j]` is the concrete
 * object at "i,j;0,0", and `segs[i][j].next` is the concrete object at "i,j;0,1",
 * and so on.
 *
 * @class
 * @property {Array} shapes - List of shapes of loops in this knot, which
 *   has entries `{count, fold, patch, center}`;
 *   `count` is number of such shape of loop in the knot;
 *   `fold` is size of rotation symmetry of this shape, which equal to 1 for no
 *    symmetry, and equal to 0 for continuos rotation symmetry;
 *   `patch` is unrepeated part of segments of element, which is list of
 *   `[arc, radius, angle]`.
 *   `center` is center of rotation symmetry (if has) when first segment has
 *   orientation `[0,0,0,1]`.
 */
class SphModel
{
  constructor() {
    this.shapes = [];
  }

  add(shape) {
    var i = this.shapes.indexOf(shape);
    if ( i == -1 ) {
      i = this.shapes.length;
      this.shapes.push(shape);
    }
    var j = shape.count++;
    return [i, j];
  }

  get(param, [i,j,k=0,l=0], defaults) {
    const shape = this.shapes[i];
    const L = shape.fold == 0 ? 1 : shape.fold * shape.patch.length;
    var n = k * shape.patch.length + l;
    n = (n % L + L) % L;

    if ( !Array.isArray(param[i]) || !(j in param[i]) ) {
      return defaults;

    } else if ( param[i][j].next ) { // list-like
      let val = param[i][j];
      for ( let m=0; m<n; m++ )
        val = val.next;
      return val;

    } else if ( Array.isArray(param[i][j]) ) { // array-like
      if ( !(n in param[i][j]) )
        return defaults;
      return param[i][j][n];

    } else {
      console.assert(false);
    }
  }
  set(param, [i,j,k=0,l=0], val) {
    const shape = this.shapes[i];
    const L = shape.fold == 0 ? 1 : shape.fold * shape.patch.length;
    var n = k * shape.patch.length + l;
    n = (n % L + L) % L;

    if ( val === undefined ) { // delete
      if ( !Array.isArray(param[i]) || !(j in param[i]) )
        return;

      if ( param[i][j].next )
        delete param[i][j];
      else
        delete param[i][j][n];

    } else if ( val.next ) { // list-like
      if ( !Array.isArray(param[i]) )
        param[i] = [];

      let n_ = (L - n) % L;
      for ( let m=0; m<n_; m++ )
        val = val.next;
      param[i][j] = val;

    } else { // array-like
      if ( !Array.isArray(param[i]) )
        param[i] = [];
      if ( !(j in param[i]) )
        param[i][j] = [];

      param[i][j][n] = val;
    }
  }
  *items(param) {
    for ( let i=0; i<this.shapes.length; i++ ) if ( Array.isArray(param[i]) ) {
      const shape = this.shapes[i];
      const N = shape.fold == 0 ? 1 : shape.fold;
      const L = shape.patch.length;
      for ( let j=0; j<shape.count; j++ ) if ( j in param[i] ) {
        let loop = param[i][j];

        if ( loop.next ) { // list-like
          for ( let k=0; k<N; k++ )
            for ( let l=0; l<L; l++ ) {
              yield [[i,j,k,l], loop];
              loop = loop.next;
            }
          console.assert(loop === param[i][j]);

        } else if ( Array.isArray(loop) ) { // array-like
          for ( let k=0; k<N; k++ )
            for ( let l=0; l<L; l++ )
              if ( (k*L+l) in loop )
                yield [[i,j,k,l], loop[k*L+l]];

        } else {
          console.assert(false);
        }

      }
    }
  }
  indexOf(param, val) {
    for ( let [index, val_] of this.items(param) )
      if ( val_ === val )
        return index;
  }
  reorder(param, ...perms) {
    var item = this.items(param).next().value;
    if ( item === undefined )
      return param;

    if ( item[1].next ) { // list-like
      for ( let perm of perms ) {
        let param_ = [];
        for ( let [[i,j,k,l], val] of this.items(param) )
          if ( k == 0 && l == 0 ) {
            let [j_, dk] = perm[i][j];
            this.set(param_, [i,j_,dk], val);
          }
        param = param_;
      }

    } else { // array-like
      for ( let perm of perms ) {
        let param_ = [];
        for ( let [[i,j,k,l], val] of this.items(param) ) {
          let [j_, dk] = perm[i][j];
          this.set(param_, [i,j_,k+dk,l], val);
        }
        param = param_;
      }

    }

    return param;
  }

  I() {
    var perm = this.shapes.map(shape => Array(shape.count));
    for ( let i=0; i<this.shapes.length; i++ )
      for ( let j=0; j<this.shapes[i].count; j++ )
        perm[i][j] = [j, 0];
    return perm;
  }
  call(perm, [i,j,k=0,l=0]) {
    const N = this.shapes[i].fold == 0 ? 1 : this.shapes[i].fold;
    var [j_, dk] = perm[i][j];
    var k_ = ((k+dk) % N + N) % N;
    return [i, j_, k_, l];
  }
  followedBy(perm0, ...perms) {
    perm0 = perm0.map(subperm0 => subperm0.slice());
    for ( let i=0; i<perm0.length; i++ )
      for ( let j=0; j<perm0[i].length; j++ ) {
        let [j_, dk] = perm0[i][j];
        const N = this.shapes[i].fold == 0 ? 1 : this.shapes[i].fold;
        for ( let perm of perms ) {
          let [j2_, dk2] = perm[i][j_];
          j_ = j2_;
          dk = dk + dk2;
        }
        dk = (dk % N + N) % N;
        perm0[i][j] = [j_, dk];
      }
    return perm0;
  }
  inverse(perm) {
    var perm_inv = perm.map(subperm => Array(subperm.length));
    for ( let i=0; i<perm.length; i++ )
      for ( let j=0; j<perm[i].length; j++ ) {
        const N = this.shapes[i].fold == 0 ? 1 : this.shapes[i].fold;
        let [j_, dk] = perm[i][j];
        let dk_ = (N - dk % N) % N;
        perm_inv[i][j_] = [j, dk_];
      }
    return perm_inv;
  }
}

/**
 * A node of network structure of puzzle, which represents a set of walkable
 * segments.
 * Puzzle can be decomposed as multiple independent parts (knots), and each of
 * them is linked by multiply-connected pieces (joints) and, if exist,
 * unconnected pieces (bandages); they form a network structure.  This network
 * structure fully determine how to rebuild whole puzzle up to global rotation
 * and permutation of elements.
 *
 * knot:
 * Knot is set of segments connected by properties `next`, `prev` and `adj`.
 * Without any bandages, each knot is independent; the twist of one knot will not
 * effect another knot.
 *
 * joint:
 * Joint represents connected piece, may be multiply-connected, of element, which
 * fuse different loops of bondaries together, and relative orientations of them
 * are fixed.  The loops of joint should belong to different knots.
 *
 * bandage:
 * Bandage represents unconnected element, which bind different connected pieces
 * together, and relative orientations of them are fixed.
 *
 * network:
 * The structure composed by knots, joints and bandages.
 * Knots are linked by multiply-connected joints, which form a tree structure.
 * Joints can be linked by unconnected bandages, which make it a network
 * structure.
 *
 * @class
 * @property {SphJoint[][][]} joints - The joints connected to this knot, which
 *   is on the position of the first segment (`l = 0`) of loop of joint.
 * @property {SphSeg[][]} segments - The concrete objects of segments in this
 *   knot.
 * @property {SphModel} model - The model of loops in this knot.
 * @property {SphConfig} configuration - The configuration of loops in this knot.
 */
class SphKnot
{
  constructor({model}={}) {
    this.model = model;
    this.configuration = new SphConfig({model});
    this.joints = [];
    this.segments = [];
  }

  segmentAt(index) {
    return this.model.get(this.segments, index);
  }
  indexOf(val) {
    if ( val instanceof SphSeg ) {
      for ( let [index, seg] of this.model.items(this.segments) )
        if ( seg === val )
          return index;

    } else if ( val instanceof SphElem ) {
      for ( let [[i,j,k,l], seg] of this.model.items(this.segments) )
        if ( k == 0 && l == 0 )
          if ( seg.affiliation === val )
            return [i, j];

    } else if ( val instanceof SphJoint ) {
      for ( let [index, joint] of this.model.items(this.joints) )
        if ( joint === val )
          return index;
    }
  }

  jointAt([i,j], make_if_absent=false) {
    var joint;
    for ( var [index, joint_] of this.model.items(this.joints) )
      if ( index[0]==i && index[1]==j ) {
        console.assert(index[3]==0);
        joint = joint_;
        break;
      }

    if ( !joint && make_if_absent ) {
      joint = new SphJoint();
      joint.ports.set(this, this.segmentAt([i,j]).orientation.slice());
      this.model.set(this.joints, [i,j], joint);
    }
    return joint;
  }
  disjoint([i,j]) {
    for ( var [index] of this.model.items(this.joints) )
      if ( index[0]==i && index[1]==j ) {
        this.model.set(this.joints, index);
        break;
      }
  }
  align([i,j]) {
    var joint = this.jointAt([i,j]);
    if ( !joint ) throw new Error();
    var seg = this.model.get(this.segments, [i,j]);
    var rot = q_mul(seg.orientation, q_inv(joint.ports.get(this)));
    joint.rotate(rot);
  }

  *travel(from) {
    var stop = yield this;
    if ( stop ) return;

    for ( let joint of this.joints.flat(2) ) if ( joint !== from )
      for ( let knot of joint.ports.keys() ) if ( knot !== this )
        yield *knot.travel(joint);
  }
}

/**
 * A node of network structure of puzzle, which represents a connected piece of
 * element.
 * It is composed by different loops in different knots with relative orientations.
 *
 * @class
 * @property {Map<SphKnot,number[]>} ports - The map from connected knot to relative
 *   orientation of connected loop.
 *   The relative orientations are just quaternions of first segment (`l = 0`)
 *   of each loop after applying some kind of rotation.
 * @property {Set<SphJoint>} bandage - Set of connected pieces of element.
 *   Notice that they should have synchronized relative orientations.
 */
class SphJoint
{
  constructor() {
    this.ports = new Map();
    this.bandage = new Set([this]);
  }

  rotate(q) {
    for ( let [knot, orientation] of this.ports )
      this.ports.set(knot, q_mul(q, orientation));
  }

  fuse(joint) {
    if ( joint === this )
      return;

    this.bind(joint);
    joint.unbind();

    for ( let [knot, orientation] of joint.ports ) {
      this.ports.set(knot, orientation);
      let index = knot.indexOf(joint);
      if ( index )
        knot.model.set(knot.joints, index, this);
    }
  }
  unfuse(knot) {
    if ( this.ports.delete(knot) ) {
      let index = knot.indexOf(this);
      if ( index )
        knot.model.set(knot.joints, index, undefined);
    }
  }

  bind(joint) {
    if ( this.bandage === joint.bandage )
      return;
    for ( let joint_ of joint.bandage ) {
      this.bandage.add(joint_);
      joint_.bandage = this.bandage;
    }
  }
  unbind() {
    if ( this.bandage.size == 1 )
      return;
    this.bandage.delete(this);
    this.bandage = new Set([this]);
  }
}

/**
 * Configuration of knot of puzzle.
 * Configuration contains the minimal information about puzzle, which is
 * rebuildable without fixed global orientation.  Such data is useful to analyze
 * jumbling rule of this state.
 *
 * @class
 * @property {SphModel} model - The model of segments in this network.
 * @property {Array} adjacencies - Table of adjacencies, which has entries
 *   `[index1, index2, offset]`;
 *   `index1` and `index2` are indices of adjacent segments, where `index1` is
 *   less than `index2` in lexical order;
 *   `offset` is offset of adjacency.
 * @property {Array} symmetries - Corresponding invariant permutations.
 */
class SphConfig
{
  constructor({model, adjacencies=[]}={}) {
    this.model = model;
    this.adjacencies = adjacencies;
    this.symmetries = [];
  }
}

class SphTransition
{
  constructor({from, to, permutation=[]}={}) {
    this.from = from;
    this.to = to;
    this.permutation = permutation;
    this.symmetries = [];
    // symmetries = [sym_from, sym_to]

    // this.tracks = [];
    // // tracks = [tracks_from, tracks_to]
    // this.angles = [];
  }
}

class SphBasis
{
  constructor() {
    this.units = [];
    // unit = {radius, passwords}
    // passwords = [shift_offset, center_offset] -> [[gap, arc, angle], ...]
    this.coord = [];
    // coord_i = [[pw_ind, shift_offset], ...]
    this.intersections = intersections;
    // intersection = [index1, index2]
    // index = [unit_ind, latch_ind]
    this.indices = [];
    // index = [inner, outer, shift, center]
    // inner/outer = [seg_ind, ...]

    // partial_perm = unit_ind -> [shift, ...]
  }
}

/**
 * Analyzer for spherical twisty puzzle.
 *
 * @class
 */
class SphAnalyzer
{
  constructor(tol=1e-5) {
    this.tol = tol;
  }

  /**
   * Fuzzy compare two values with tolerance `this.tol`.
   * It will compare array of numbers by lexical order.
   *
   * @param {*} v1 - The first value to compare.
   * @param {*} v2 - The second value to compare.
   * @returns {number} `0` if `v1` is almost equal to `v2`; `+1` if `v1` is
   *   greater than `v2`; `-1` if `v1` is less than `v2`.
   */
  cmp(v1, v2) {
    return fzy_cmp(v1, v2, this.tol);
  }
  /**
   * Snap to some values by fuzzy comparing.
   *
   * @param {number} val - The value to snap.
   * @param {number[]} [snaps=[]] - The values to snap.
   * @returns {number} The closest value in `snaps`, or original value if not
   *   close enough.
   */
  snap(val, snaps=[]) {
    return fzy_snap(val, snaps, this.tol);
  }
  /**
   * Modulo 4 with snapping.
   *
   * @param {number} val - The value to mod.
   * @param {number[]} [snaps=[]] - The values to snap.
   *   Snapping occur when they are roughly congruent modulo 4.
   * @returns {number} Modulus.
   */
  mod4(val, snaps=[]) {
    return fzy_mod(val, 4, snaps, this.tol);
  }

  /**
   * Determine relation between circles.
   * It will return `[ang, arc1, arc2, meeted]`, which represent overlapping
   * region in intersect cases, otherwise those values are determined by
   * limitation from intersect cases.
   * All relations can be classified as: equal, complement, (kissing) include,
   * (kissing) exclude, (kissing) anti-include, (kissing) anti-exclude, and
   * intersect.  Where kissing means two circles touch at one point; anti- means
   * relation to complement of `circle2`.
   * Except for intersect cases, they have certain return values:
   *                    equal: `[0, undefined, undefined, undefined]`
   *               complement: `[2, undefined, undefined, undefined]`
   *        (kissing) include: `[0, 0, 4, 0|1]`
   *        (kissing) exclude: `[2, 0, 0, 0|1]`
   *   (kissing) anti-include: `[2, 4, 4, 0|1]`
   *   (kissing) anti-exclude: `[0, 4, 0, 0|1]`
   *
   * @param {SphCircle} circle1 - The first circle to compare.
   * @param {SphCircle} circle2 - The second circle to compare.
   * @returns {number[]} Information about meet points between circles, which
   *   has values `[ang, arc1, arc2, meeted]`.
   *   `ang` is absolute angle between their directed tangent vectors at meet
   *   point, in the range of [0, 2];
   *   `arc1` is arc of `circle1` under `circle2`, in the range of [0, 4];
   *   `arc2` is arc of `circle2` under `circle1`, in the range of [0, 4].
   *   `meeted` is number of meet points between circles.
   */
  relationTo(circle1, circle2) {
    var radius1 = circle1.radius;
    var radius2 = circle2.radius;
    var distance = angleTo(circle2.center, circle1.center)/Q;
    console.assert(this.cmp(distance, 0) >= 0 && this.cmp(distance, 2) <= 0);
    console.assert(this.cmp(radius1, 0) > 0 && this.cmp(radius1, 2) < 0);
    console.assert(this.cmp(radius2, 0) > 0 && this.cmp(radius2, 2) < 0);

    if ( this.cmp(distance, 0) == 0 && this.cmp(radius1, radius2) == 0 )
      return [0, undefined, undefined, undefined]; // equal
    else if ( this.cmp(distance, 2) == 0 && this.cmp(radius1 + radius2, 2) == 0 )
      return [2, undefined, undefined, undefined]; // complement
    else if ( this.cmp(distance, radius1 - radius2) <  0 )
      return [0, 0, 4, 0]; // include
    else if ( this.cmp(distance, radius1 - radius2) == 0 )
      return [0, 0, 4, 1]; // kissing include
    else if ( this.cmp(distance, radius1 + radius2) >  0 )
      return [2, 0, 0, 0]; // exclude
    else if ( this.cmp(distance, radius1 + radius2) == 0 )
      return [2, 0, 0, 1]; // kissing exclude
    else if ( this.cmp(2-distance, radius1 - (2-radius2)) <  0 )
      return [2, 4, 4, 0]; // anti-include
    else if ( this.cmp(2-distance, radius1 - (2-radius2)) == 0 )
      return [2, 4, 4, 1]; // kissing anti-include
    else if ( this.cmp(2-distance, radius1 + (2-radius2)) >  0 )
      return [0, 4, 0, 0]; // anti-exclude
    else if ( this.cmp(2-distance, radius1 + (2-radius2)) == 0 )
      return [0, 4, 0, 1]; // kissing anti-exclude
    else if ( distance < radius1 + radius2 ) {
      let arc1 = abcA(radius2, radius1, distance)*2;
      let arc2 = abcA(radius1, radius2, distance)*2;
      let angle = abcA(distance, radius1, radius2);
      return [angle, arc1, arc2, 2]; // intersect
    }
    else
      throw new Error(`unknown case: [${radius1}, ${radius2}, ${distance}]`);
  }

  /**
   * All loops passing through segments.
   *
   * @param {SphSeg[]} segs - The segments to loop.
   * @yields {SphSeg[]} The loop of segment includes at least one of `segs`.
   */
  *loops(segs) {
    segs = new Set(segs);
    for ( let seg0 of segs ) {
      let loop = [];
      for ( let seg of seg0.walk() ) {
        segs.delete(seg);
        loop.push(seg);
      }
      if ( loop[loop.length-1].next === loop[0] )
        yield loop;
    }
  }
  /**
   * Jump from a point on the segment to same point on adjacent segment.
   *
   * @param {SphSeg} seg0 - The starting segment.
   * @param {number} theta - Offset of point respect to vertex of `seg0`,
   *   in the range of [0, `seg0.arc`].
   * @param {number} [prefer=1] - The prefer side when jumping to end point of segment.
   *   `+1` (default) means upper limit of offset; `-1` means lower limit of offset.
   * @returns {object[]} Segment and corresponding offset after jump: `[seg, theta]`,
   *   or empty array if no adjacent segment to jump.
   */
  jump(seg0, theta, prefer=+1) {
    for ( let [adj_seg, offset] of seg0.adj ) {
      let theta_ = this.mod4(offset-theta, [0, adj_seg.arc]);
      if ( adj_seg.arc == 4 && theta_ == 0 )
        theta_ = prefer < 0 ? 0 : 4;
      else if ( theta_ == 0 && prefer > 0 )
        continue;
      else if ( theta_ == adj_seg.arc && prefer < 0 )
        continue;
      else if ( theta_ > adj_seg.arc )
        continue;

      return [adj_seg, theta_];
    }
    return [];
  }
  /**
   * Clockwise spinning at a point, which is specified by segment and offset.
   * This generator will yield information when spinning to another segment
   * passing through center.
   * It will stop before returning to the starting segment or has no next segment.
   *
   * @param {SphSeg} seg0 - The segment passing through center.
   * @param {number} [offset=0] - Offset of center respect to vertex of `seg0`,
   *   in the range of [0, `seg0.arc`).
   * @yields {object[]} Information when spinning to segment, which has value
   *   `[angle, seg, offset]`:
   *   `angle` is spinning angle with unit of quadrant, which will snap to 0, 2;
   *   `seg` is segment passing through center;
   *   `offset` is offset of center.
   * @returns {boolean} True if it return to the first segment finally.
   */
  *spin(seg0, offset=0) {
    var angle = 0, seg = seg0;

    do {
      yield [angle, seg, offset];

      [seg, offset] = this.jump(seg, offset, +1);

      if ( seg !== undefined ) {
        if ( seg.arc == offset )
          [angle, seg, offset] = [angle+seg.next.angle, seg.next, 0];
        else
          angle += 2;
        angle = this.snap(angle, [0, 2, 4]);
      }

      if ( seg === undefined )
        return false;
    } while ( seg !== seg0 );
    console.assert(angle == 4);
    return true;
  }
  /**
   * Ski on segments along extended circle.
   *
   * @param {SphSeg} seg0 - The starting segment.
   * @yields {SphSeg} Next segment along extended circle of the first segment.
   * @returns {boolean} True if it return to the starting segment finally.
   */
  *ski(seg0) {
    var seg = seg0;
    do {
      yield seg;

      let [ang1, seg1] = [seg.next.angle, seg.next];
      let ang;
      for ( [ang, seg] of this.spin(seg1) ) {
        let sgn = this.cmp([ang, seg.radius-1], [2-ang1, seg0.radius-1]);
        if ( sgn == 0 ) break;
        if ( sgn >  0 ) return false;
      }
    } while ( seg !== seg0 );
    return true;
  }
  /**
   * Collect all values of generator only when it returns true finally.
   *
   * @param {object} gen - The generator to collect.
   * @returns {Array} Generated values if `gen` return true finally, or `undefined`.
   */
  full(gen) {
    var list = [];
    var res;
    while ( !(res = gen.next()).done )
      list.push(res.value);
    return res.value ? list : undefined;
  }

  /**
   * Split segment into two segments.
   * Splitted segment will be in-place modified as the first part, and create new
   * object as the second part.
   *
   * @param {number} seg - The segment to split.
   * @param {number} theta - The position to split.
   * @returns {SphSeg} The second part segment after splitting.
   */
  interpolate(seg, theta) {
    theta = this.mod4(theta, [4, seg.arc]);
    // if ( theta >= seg.arc )
    //   throw new Error("out of range of interpolation");

    // make next segment started from point of interpolation
    var next_seg = new SphSeg({
      arc: seg.arc - theta,
      angle: 2,
      radius: seg.radius,
      orientation: q_spin(seg.orientation, theta*Q)
    });
    seg.arc = theta;

    // merge loop
    if ( seg.next )
      next_seg.connect(seg.next);
    seg.connect(next_seg);
    if ( seg.affiliation )
      seg.affiliation.accept(next_seg);
    if ( seg.track )
      seg.track.insertAfter(next_seg, seg);

    for ( let [adj_seg, offset] of seg.adj ) {
      // remove adjacent of segment
      if ( this.cmp(offset, seg.arc + adj_seg.arc) >= 0 )
        seg.adjacent(adj_seg);

      // add adjacent of next_seg
      let offset_ = this.mod4(offset - seg.arc, [4, next_seg.arc, adj_seg.arc]);
      if ( this.cmp(offset_, next_seg.arc + adj_seg.arc) < 0 )
        next_seg.adjacent(adj_seg, offset_);
    }

    return next_seg;
  }
  /**
   * Check if vertex is trivial.
   * All trivial vertex can be merged except for full circle case.
   *
   * @param {number} seg - The segment to check.
   * @returns {boolean} True if vertex is trivial.
   */
  isTrivialVertex(seg) {
    return this.cmp(seg.angle, 2) == 0
           && this.cmp(seg.radius, seg.prev.radius) == 0
           && this.cmp(seg.circle.center, seg.prev.circle.center) == 0;
  }
  /**
   * Merge segment with the previous segment, and remove this segment.
   * The radius and center of them must be same, and this segment cannot be
   * self connected.
   *
   * @param {number} seg - The segment to merge.
   * @returns {SphSeg} The removed segment.
   */
  mergePrev(seg) {
    // if ( seg === seg.prev || !this.isTrivialVertex(seg) )
    //   throw new Error("unable to merge segments");

    // merge segment
    var merged = seg.prev;
    var arc0 = merged.arc;
    merged.arc = merged.arc + seg.arc;

    // merge loop
    if ( seg.next )
      seg.prev.connect(seg.next);
    else
      seg.prev.next = undefined;
    if ( seg.affiliation )
      seg.affiliation.withdraw(seg);
    if ( seg.track )
      seg.track.remove(seg);

    // merge adjacent
    for ( let [adj_seg, offset] of seg.adj ) {
      seg.adjacent(adj_seg);
      if ( !merged.adj.has(adj_seg) ) {
        let offset_ = this.mod4(offset + arc0, [4, merged.arc, adj_seg.arc]);
        merged.adjacent(adj_seg, offset_);
      }
    }

    if ( merged.next === merged ) {
      merged.arc = 4;
      merged.angle = 2;
    }

    return seg;
  }

  /**
   * Swap connection of two segments.
   * The vertices of segments must at the same position.
   * It have two cases: exclusive segments become inclusive segments in merge case;
   * inclusive segments become exclusive segments in split case.
   *
   * @param {SphSeg} seg1 - The first segment to swap.
   * @param {SphSeg} seg2 - The second segment to swap.
   * @param {number} ang1 - angle from `seg1` to `seg2`.
   *   It must in the range of [0, 4] for merge case; in the range of [-4, 0]
   *   for split case.
   * @param {number} ang2 - angle from `seg2` to `seg1`.
   *   It must in the range of [0, 4] for merge case; in the range of [-4, 0]
   *   for split case.  And with constraint `ang1+ang2 == 4` for merge case;
   *   with constraint `ang1+ang2 == -4` for split case.
   */
  swap(seg1, seg2, ang1, ang2) {
    var [seg1_prev, seg2_prev] = [seg1.prev, seg2.prev];
    var [seg1_ang, seg2_ang] = [seg1.angle, seg2.angle];

    seg2_prev.connect(seg1);
    seg1_prev.connect(seg2);
    seg1.angle = this.snap(seg2_ang + ang1, [0, 4]);
    seg2.angle = this.snap(seg1_ang + ang2, [0, 4]);
  }
  /**
   * Find cover between two adjacent segments.
   *
   * @param {SphSeg} seg1 - The first segment.
   * @param {SphSeg} seg2 - The second segment.
   * @returns {object[]} array with entries `[seg1, theta1, theta1_, seg2, theta2, theta2_]`:
   *   the part from `theta1` to `theta1_` in `seg1` is adjacent to the part from
   *   `theta2` to `theta2_` in `seg2`.
   */
  cover(seg1, seg2) {
    var offset = seg1.adj.get(seg2);
    if ( offset === undefined )
      return [];
    var brackets = new Map();
    var adj_seg, theta;

    [adj_seg, theta] = this.jump(seg1, 0, +1);
    if ( adj_seg === seg2 ) {
      let key = this.snap([0, +1], brackets.keys());
      if ( !brackets.has(key) )
        brackets.set(key, [0, theta]);
    }

    [adj_seg, theta] = this.jump(seg1, seg1.arc, -1);
    if ( adj_seg === seg2 ) {
      let key = this.snap([seg1.arc, -1], brackets.keys());
      if ( !brackets.has(key) )
        brackets.set(key, [seg1.arc, theta]);
    }

    [adj_seg, theta] = this.jump(seg2, 0, +1);
    if ( adj_seg === seg1 ) {
      let key = this.snap([theta, -1], brackets.keys());
      if ( !brackets.has(key) )
        brackets.set(key, [theta, 0]);
    }

    [adj_seg, theta] = this.jump(seg2, seg2.arc, -1);
    if ( adj_seg === seg1 ) {
      let key = this.snap([theta, +1], brackets.keys());
      if ( !brackets.has(key) )
        brackets.set(key, [theta, seg2.arc]);
    }

    // build covers
    var covers = [];
    var keys = Array.from(brackets.keys()).sort(this.cmp.bind(this));
    console.assert(keys.length%2 == 0);
    for ( let i=0; i<keys.length; i+=2 ) {
      console.assert(keys[i][1] > 0 && keys[i+1][1] < 0);
      let [theta1 , theta2 ] = brackets.get(keys[i]);
      let [theta1_, theta2_] = brackets.get(keys[i+1]);
      covers.push([seg1, theta1, theta1_, seg2, theta2_, theta2]);
    }

    return covers;
  }
  /**
   * Find the segments with same affiliation that are connected by adjacent
   * relation.
   *
   * @param {SphSeg} seg0 - The segment to zip.
   * @returns {object[]} array with entries `[seg1, theta1, theta1_, seg2, theta2, theta2_]`:
   *   the part from `theta1` to `theta1_` in `seg1` is adjacent to the part from
   *   `theta2` to `theta2_` in `seg2`, where `seg1` is at the same side of `seg0`.
   */
  findZippers(seg0) {
    var pairs = [];
    var queue = new Set([seg0]);
    for ( let seg of queue ) for ( let adj_seg of seg.adj.keys() )
      if ( adj_seg.affiliation === seg.affiliation ) {
        pairs.push([seg, adj_seg]);
        for ( let seg_ of adj_seg.adj.keys() )
          if ( seg_.affiliation === seg.affiliation )
            queue.add(seg_);
      }

    var zippers = [];
    for ( let [seg1, seg2] of pairs )
      zippers.push(...this.cover(seg1, seg2));

    return zippers;
  }
  /**
   * Glue adjacent segments with same affiliation.
   *
   * @param {object[]} zippers - The data returned by {@link SphAnalyzer#findZippers}.
   * @returns {Set<SphSeg>} The end points of glued zippers.
   */
  glueAdj(zippers) {
    if ( zippers.length == 0 )
      return;

    for ( let zipper of zippers )
      if ( zipper[0].track )
        zipper[0].track.tearDown();

    // interpolate
    var extrapolate = (seg, theta, prefer) => {
      theta = this.snap(theta, [0, seg.arc]);
      while ( theta >= seg.arc )
        [seg, theta] = [seg.next, this.snap(theta-seg.arc, [0, seg.next.arc])];
      if ( theta > 0 && theta < seg.arc )
        this.interpolate(seg, theta);

      if ( prefer > 0 && theta == seg.arc )
        [seg, theta] = [seg.next, 0];
      if ( prefer < 0 && theta == 0 )
        [seg, theta] = [seg.prev, seg.prev.arc];
      return seg;
    };
    var contacts = [];
    for ( let [seg1, theta1, theta1_, seg2, theta2, theta2_] of zippers ) {
      let seg1_ = extrapolate(seg1, theta1, +1);
      seg1 = extrapolate(seg1, theta1_, -1);
      console.assert(seg1_ === seg1);

      let seg2_ = extrapolate(seg2, theta2, +1);
      seg2 = extrapolate(seg2, theta2_, -1);
      console.assert(seg2_ === seg2);

      contacts.push([seg1, seg2]);
    }

    // zip
    var res = new Set();
    for ( let [seg1, seg2] of contacts ) {
      let seg1_ = seg1.next;
      let seg2_ = seg2.next;
      this.swap(seg1, seg2_, 4-seg2_.angle, seg2_.angle);
      this.swap(seg1_, seg2, seg1_.angle, 4-seg1_.angle);
      seg1.affiliation.withdraw(seg1);
      seg2.affiliation.withdraw(seg2);
      res.add(seg1_);
      res.add(seg2_);
      res.delete(seg1);
      res.delete(seg2);
    }

    return res;
  }

  /**
   * Find meet point between this loop and circle.
   * They can meet at the start point of segment, but not at the end point of segment.
   *
   * @param {SphSeg} segment0 - The starting segment of loop to meet.
   * @param {SphCircle} circle - The circle to meet with.
   * @yields {object} Information about meet point, which has values
   *   `{angle, segment, offset, theta, type}`.
   *   `angle` is angle from `circle` to `segment` at meet point (angle between
   *   two directed tangent vectors), in the range of [-2, 2].
   *   `segment` is the segment that meets with circle;
   *   `offset` is offset of meet point along `segment`, in the range of
   *   [0, `segment.arc`);
   *   `theta` is offset of meet point along `circle`;
   *   `type` is the string representing type of meet
   *   (see {@link SphAnalyzer#classifyMeets}).
   */
  *meetWith(segment0, circle) {
    const abs4 = ang => Math.min(this.mod4(ang), this.mod4(-ang));
    const snapPos = (meet, val) => {
      if ( fzy_cmp(abs4(meet.offset-val), 0, this.tol*10) )
        console.warn(`calculation error is too large: ${abs4(meet.offset-val)}`);
      meet.offset = val;
    };
    const classifier = (function*() {
      var first_meet, meet, side;
      try {
        first_meet = meet = yield;
        while ( true ) {
          side = this.classifyMeet(meet, side);
          meet = yield meet;
        }
      } finally {
        if ( first_meet )
          this.classifyMeet(first_meet, side);
      }
    }).call(this);
    classifier.next();

    for ( let segment of segment0.walk() ) {
      let circle_ = segment.circle;
      let [angle, arc, arc_, type] = this.relationTo(circle_, circle);
      let offset, theta;
      let start = this.cmp(circle.radius, angleTo(circle.center, segment.vertex)/Q);
      let end = this.cmp(circle.radius, angleTo(circle.center, segment.next.vertex)/Q);

      if ( type === undefined ) {
        console.assert(start == 0 && end == 0);
        theta = this.mod4(circle.thetaOf(segment.vertex));
        offset = 0;

        if ( angle == 0 ) angle = +0;
        if ( angle == 2 ) angle = -2;

        let meet = {angle, segment, offset, theta, type};
        yield classifier.next(meet).value;

      } else if ( type == 0 ) {
        console.assert(start * end > 0);
        // nothing

      } else if ( type == 1 ) {
        theta = this.mod4(circle.thetaOf(circle_.center)+arc_/2);
        offset = this.mod4(circle_.thetaOf(circle.center)-arc/2);
        console.assert(start + end != 0 || segment.arc == 4);

        if ( angle == 0 && arc == 4 ) angle = +0;
        if ( angle == 0 && arc == 0 ) angle = -0;
        if ( angle == 2 && arc == 4 ) angle = +2;
        if ( angle == 2 && arc == 0 ) angle = -2;

        let meet = {angle, segment, offset, theta, type};
        if ( end == 0 )   snapPos(meet, segment.arc);
        if ( start == 0 ) snapPos(meet, 0);

        if ( meet.offset < segment.arc )
          yield classifier.next(meet).value;

      } else if ( type == 2 ) {
        theta = this.mod4(circle.thetaOf(circle_.center)+arc_/2);
        offset = this.mod4(circle_.thetaOf(circle.center)-arc/2);
        let meet1 = {angle, segment, offset, theta, type};

        theta = this.mod4(circle.thetaOf(circle_.center)-arc_/2);
        offset = this.mod4(circle_.thetaOf(circle.center)+arc/2);
        angle = -angle;
        let meet2 = {angle, segment, offset, theta, type};

        if ( end == 0 ) {
          let d1 = abs4(meet1.offset-segment.arc);
          let d2 = abs4(meet2.offset-segment.arc);
          snapPos(d1<d2 ? meet1 : meet2, segment.arc);
        }
        if ( start == 0 ) {
          let d1 = abs4(meet1.offset);
          let d2 = abs4(meet2.offset);
          snapPos(d1<d2 ? meet1 : meet2, 0);
        }

        if ( meet2.offset < meet1.offset )
          [meet1, meet2] = [meet2, meet1];
        if ( meet1.offset < segment.arc )
          yield classifier.next(meet1).value;
        if ( meet2.offset < segment.arc )
          yield classifier.next(meet2).value;

      }
    }

    classifier.return();
  }
  /**
   * Classify type of meet.
   * Before classifying, `meet.type` should be meeted number between extended
   * circle if segment and meet circle, which will help us to classify type of
   * meet.
   * After classifying, the `meet.type` becomes a three-char string: the first
   * and the third char, which should be one of "()[]", represent the side of
   * pre and post edge of meet point; the middle char, which should be one of
   * "|<>", represents the direction of segment.
   * It is easier to understand by mapping:
   *    pre_side  : [+2, +1, -0, -1] => "[(])"
   *    post_side : [+1, +0, -1, -2] => "([)]"
   *    direction : [-1, 0, +1]      => "<|>"
   * The numbers of `pre_side` and `post_side` indicate the angle of edge, and
   * the numbers of `direction` indicate right U-turn, cross through and left
   * U-turn.
   *
   * @param {Object} meet - The meet to classify.
   * @param {number} side - The post side of last meet.  It will not classify
   *   this meet if this parameter is absent.
   * @returns {number} post side of this meet.
   */
  classifyMeet(meet, side) {
    if ( !this.MEET_TYPES )
      this.MEET_TYPES = Object.freeze({  // [pre, dir, post] => string
        [[+2, 0,-2]]:"[|]", [[+2, 0,-1]]:"[|)", [[+1, 0,-2]]:"(|]", [[+1, 0,-1]]:"(|)",
        [[-0, 0,+0]]:"]|[", [[-0, 0,+1]]:"]|(", [[-1, 0,+0]]:")|[", [[-1, 0,+1]]:")|(",
        [[+2,+1,+0]]:"[>[", [[+2,+1,+1]]:"[>(", [[+1,+1,+0]]:"(>[", [[+1,+1,+1]]:"(>(", [[+1,-1,+1]]:"(<(",
        [[-0,+1,-2]]:"]>]", [[-0,+1,-1]]:"]>)", [[-1,+1,-2]]:")>]", [[-1,+1,-1]]:")>)", [[-1,-1,-1]]:")<)"
      });

    var pre, dir, post;
    post = meet.type===undefined ? meet.angle : Math.sign(1/meet.angle);
    if ( side === undefined )
      return post;
    pre = ({[+1]:+1, [+0]:+2, [-1]:-1, [-2]:-0})[side];

    if ( Math.sign(1/pre) != Math.sign(1/post) )
      dir = 0;
    else if ( Math.sign(1/pre) > 0 )
      dir = -Math.sign((meet.offset==0 ? meet.segment.angle : 2) + meet.angle - 3);
    else
      dir = -Math.sign((meet.offset==0 ? meet.segment.angle : 2) + meet.angle - 1);

    meet.type = this.MEET_TYPES[[pre, dir, post]];

    return post;
  }
  /**
   * Sort meets along intersecting circle.
   * If two touch-meets has inclusion relation, properties `submeet`/`supermeet`
   * will be added to meet object.
   * It may add new meets to loops in the cover-meet to simplify the algorithm.
   *
   * @param {object[][]} paths - The meets to sort.
   * @param {SphCircle} circle - The circle of meets.
   * @returns {object[]} Sorted meets.
   */
  sortMeets(paths, circle) {
    // sort meets by `theta`
    var mmeets = [];
    var pos = [];
    for ( let path of paths ) for ( let meet of path ) {
      meet.theta = this.mod4(meet.theta, pos);

      let i, sgn;
      for ( i=0; i<pos.length; i++ ) {
        sgn = Math.sign(meet.theta-pos[i]);
        if ( sgn > 0 ) continue;
        else           break;
      }

      if ( sgn == 0 )
        mmeets[i].push(meet);
      else if ( sgn < 0 )
        mmeets.splice(i, 0, [meet]), pos.splice(i, 0, meet.theta);
      else
        mmeets.push([meet]), pos.push(meet.theta);
    }

    // deal with cover
    const N = mmeets.length;
    for ( let path of paths ) for ( let i=0; i<path.length; i++ )
      if ( ["[", "]"].includes(path[i].type[2]) ) {
        let theta1 = path[i].theta;
        let theta2 = (path[i+1] || path[0]).theta;
        let start = mmeets.findIndex(mmeet => mmeet[0].theta == theta1);
        let end   = mmeets.findIndex(mmeet => mmeet[0].theta == theta2);
        let segment = path[i].segment;

        if ( path[i].type[2] == "[" ) {
          for ( let j=(end-1+N)%N; j!=start; j=(j-1+N)%N ) {
            let theta = mmeets[j][0].theta;
            let offset = this.mod4(theta-theta1);
            let meet = {angle:+0, segment, offset, theta, type:"[>["};
            mmeets[j].push(meet);
            path.splice(i+1, 0, meet);
          }

        } else if ( path[i].type[2] == "]" ) {
          for ( let j=(end+1)%N; j!=start; j=(j+1)%N ) {
            let theta = mmeets[j][0].theta;
            let offset = this.mod4(theta1-theta);
            let meet = {angle:-2, segment, offset, theta, type:"]>]"};
            mmeets[j].push(meet);
            path.splice(i+1, 0, meet);
          }

        }
      }

    // sort meets with same `theta`
    for ( let mmeet of mmeets ) {
      if ( mmeet.length == 0 )
        continue;

      // convert to beams: [side, angle, curvature, pseudo_index]
      var beams = [];
      for ( let i=0; i<mmeet.length; i++ ) {
        let meet = mmeet[i];
        let side, ang, cur;

        // make post beam
        if ( meet.type[2] == "[" ) {
          beams.push([0, 0, 1-circle.radius, +(i+1)]);

        } else if ( meet.type[2] == "]" ) {
          beams.push([-2, -2, circle.radius-1, +(i+1)]);

        } else {
          side = meet.type[2] == "(" ? 1 : -1;
          ang = meet.angle;
          cur = 1-meet.segment.radius;
          beams.push([side, ang, cur, +(i+1)]);
        }

        // make pre beam
        if ( meet.type[0] == "]" ) {
          beams.push([0, 0, 1-circle.radius, -(i+1)]);

        } else if ( meet.type[0] == "[" ) {
          beams.push([2, 2, circle.radius-1, -(i+1)]);

        } else {
          side = meet.type[0] == "(" ? 1 : -1;

          if ( meet.offset == 0 )
            [ang, cur] = [meet.angle+meet.segment.angle, meet.segment.prev.radius-1];
          else
            [ang, cur] = [meet.angle+2, meet.segment.radius-1];

          if ( meet.type[1] == "|" )
            ang = side>0 ? this.mod4(ang+1)-1 : this.mod4(ang+3)-3;
          else if ( meet.type[1] == "<" )
            ang = ang - 4;

          beams.push([side, ang, cur, -(i+1)]);
        }
      }

      // parse structure
      var indices = beams.sort(this.cmp.bind(this)).map(beam => beam[3]);
      const SIGN = [
        "[|]", "[|)", "(|]", "(|)",
        "[>[", "[>(", "(>[", "(>(",
        "]>]", "]>)", ")>]", ")>)"
      ];
      function parseTouch(indices, start, end, meet) {
        meet.submeets = [];

        for ( let i=start+1; i<=end-1; i++ ) {
          let submeet = mmeet[Math.abs(indices[i])-1];
          console.assert(SIGN.includes(submeet.type) == (indices[i]>0));
          console.assert(!meet.type || SIGN.includes(meet.type) != SIGN.includes(submeet.type));

          let j = indices.indexOf(-indices[i]);
          console.assert(j != -1 && j > i && j <= end-1);
          parseTouch(indices, i, j, submeet);
          submeet.supermeet = meet;
          meet.submeets.push(submeet);
          i = j;
        }

        return meet;
      }
      var parsed = parseTouch(indices, -1, indices.length, {});

      // merge parsed
      mmeet.splice(0, mmeet.length);
      function flattenTouch(parsed) {
        var cross = parsed.submeets.filter(meet => meet.type[1] == "|");
        var inner = parsed.submeets.filter(meet => meet.type[1] != "|")
                                   .filter(meet => ["[", "("].includes(meet.type[0]));
        var outer = parsed.submeets.filter(meet => meet.type[1] != "|")
                                   .filter(meet => ["]", ")"].includes(meet.type[0]));
        console.assert(cross.length <= 1);

        mmeet.push(...outer);
        mmeet.push(...inner.reverse());
        mmeet.push(...cross);

        for ( let meet of parsed.submeets )
          delete meet.supermeet;
        delete parsed.submeets;

        if ( cross[0] )
          flattenTouch(cross[0]);
      }
      flattenTouch(parsed);
    }

    mmeets = mmeets.flat();
    var  pre_sides = mmeets.map(meet => ["]|[", "]|(", ")|[", ")|(", "(<(", ")<)"].includes(meet.type));
    var post_sides = mmeets.map(meet => ["[|]", "[|)", "(|]", "(|)", "(<(", ")<)"].includes(meet.type));
    post_sides.unshift(post_sides.pop());
    console.assert(pre_sides.every((s,i) => pre_sides[i] == post_sides[i]));

    return mmeets;
  }
  /**
   * Check if point is inside given region.
   *
   * @param {SphSeg[]} boundaries - The boundaries of the region.
   * @param {number[]} point - The point to check.
   * @returns {boolean} True if point is inside this element, or undefined if it
   *   is at the boundary of element.
   */
  contains(boundaries, point) {
    boundaries = Array.from(boundaries);
    if ( boundaries.length == 0 )
      return true;

    // make a circle passing through this point and a vertex of boundaries
    var vertex = boundaries[0].vertex;
    var orientation = q_mul(q_align(point, vertex), [0.5, 0.5, 0.5, -0.5]);
    var circle = new SphCircle({orientation, radius:1});

    var meets = Array.from(this.loops(boundaries))
                     .map(loop => Array.from(this.meetWith(loop[0], circle)));
    console.assert(meets.some(path => path.length > 0));
    meets = this.sortMeets(meets, circle);

    if ( meets.find(meet => this.mod4(meet.theta, [0]) == 0) )
      return;
    else if ( ["[>(", "[>[", "[|)", "[|]"].includes(meets[0].type) )
      return;
    else if ( [")>]", "]>]", "(|]", "[|]"].includes(meets[0].type) )
      return;
    else
      return ["]|[", "]|(", ")|[", ")|(", "(<(", ")<)"].includes(meets[0].type);
  }
  /**
   * Slice element by circle.
   *
   * @param {SphCircle} elem - The element to slice.
   * @param {SphCircle} circle - The knife for slicing.
   * @returns {SphSeg[][]} Sliced segments of both sides of `circle` and sliced
   *   boundaries of both sides.
   */
  slice(elem, circle) {
    var circle_ = new SphCircle(circle).complement();

    // INTERPOLATE
    // find meet points and sort by `theta`
    var paths = [];
    for ( let seg0 of elem.fly() )
      paths.push(Array.from(this.meetWith(seg0, circle)));
    var meets = this.sortMeets(paths, circle);

    // interpolate
    for ( let path of paths ) for ( let meet of path.slice(0).reverse() )
      if ( meet.type[1] == "|" && meet.offset != 0 ) {
        meet.segment = this.interpolate(meet.segment, meet.offset);
        meet.offset = 0;
      }

    // SLICE
    var in_bd = [], out_bd = [];
    var dash = meets.filter(meet => meet.type[1] == "|");
    if ( dash.length != 0 ) {
      if ( !["(|)", "(|]", "[|)", "[|]"].includes(dash[0].type) ) {
        let meet = dash.shift();
        meet.theta = meet.theta + 4;
        dash.push(meet);
      }

      // draw dash
      for ( let i=0; i<dash.length; i+=2 ) {
        let meet1 = dash[i];
        let meet2 = dash[i+1];

        let arc = this.snap(meet2.theta - meet1.theta, [0, 4]);
        if ( arc == 0 ) {
          // connect two meets
          this.swap(meet2.segment, meet1.segment,
                     meet1.angle-meet2.angle, meet2.angle-meet1.angle-4);

        } else {
          // make segments between two meets
          let in_seg  = new SphSeg({radius:circle.radius,  arc, angle:4});
          let out_seg = new SphSeg({radius:circle_.radius, arc, angle:4});
          in_seg.orientation = q_spin(circle.orientation, meet1.theta*Q);
          out_seg.orientation = q_spin(circle_.orientation, -meet2.theta*Q);
          in_seg.connect(out_seg);
          out_seg.connect(in_seg);
          in_seg.adjacent(out_seg, arc);
          elem.accept(in_seg);
          elem.accept(out_seg);

          this.swap(in_seg, meet1.segment, meet1.angle, -meet1.angle-4);
          this.swap(meet2.segment, out_seg, -2-meet2.angle, -2+meet2.angle);

          in_bd.push(in_seg);
          out_bd.push(out_seg);
        }
      }

    } else {
      // no cross meet
      let inside;
      if ( meets.some(({type}) => type[1] == ">") )
        inside = false;
      else if ( meets.some(({type}) => type[1] == "<") )
        inside = true;
      else
        inside = this.contains(elem.boundaries, circle.vectorAt(0));

      if ( inside ) {
        let in_seg  = new SphSeg({arc:4, angle:2, radius:circle.radius,
                                  orientation:circle.orientation});
        let out_seg = new SphSeg({arc:4, angle:2, radius:circle_.radius,
                                  orientation:circle_.orientation});
        in_seg.connect(in_seg);
        out_seg.connect(out_seg);
        in_seg.adjacent(out_seg, 4);
        elem.accept(in_seg);
        elem.accept(out_seg);

        in_bd.push(in_seg);
        out_bd.push(out_seg);
      }
    }

    // bipartite
    var in_segs = [], out_segs = [];
    for ( let loop of this.loops(elem.boundaries) ) {
      let side, meet;
      if ( in_bd.some(seg => loop.includes(seg)) )
        side = true;
      else if ( out_bd.some(seg => loop.includes(seg)) )
        side = false;
      else if ( meet = paths.flat().find(meet => loop.includes(meet.segment)) )
        side = ["[", "("].includes(meet.type[2]);
      else
        side = this.cmp(circle.radius, angleTo(circle.center, loop[0].vertex)/Q) > 0;

      (side ? in_segs : out_segs).push(...loop);
    }

    return [in_segs, out_segs, in_bd, out_bd];
  }

  /**
   * Check if segment is twistable; element should has no meet with extended
   * circles.
   *
   * @param {SphSeg} seg0 - The segment to test.
   * @param {SphSeg[]} [boundaries] - The boundaries of this element.
   * @returns {boolean} True if `seg0` is twistable.
   */
  isTwistable(seg0, boundaries=seg0.affiliation.boundaries) {
    boundaries = Array.from(boundaries);
    if ( this.cmp(seg0.angle, 2) > 0 )
      return false;
    if ( this.cmp(seg0.next.angle, 2) > 0 )
      return false;
    if ( this.cmp(seg0.angle, 2) == 0 && this.cmp(seg0.radius, seg0.prev.radius) < 0 )
      return false;
    if ( this.cmp(seg0.next.angle, 2) == 0 && this.cmp(seg0.radius, seg0.next.radius) < 0 )
      return false;
    if ( Array.from(seg0.adj.keys()).some(seg => boundaries.includes(seg)) )
      return false;

    var circle = seg0.circle;
    var side = undefined;
    var meets = Array.from(this.loops(boundaries))
                     .map(loop => Array.from(this.meetWith(loop[0], circle)));
    meets = this.sortMeets(meets, circle);

    if ( meets.length == 0 )
      return true;
    if ( meets.some(meet => meet.type[1] != ">" || ["]", ")"].includes(meet.type[0])) )
      return false;

    return true;
  }
  /**
   * Find twistable part of given elements.
   *
   * @param {SphElem[]} elements
   * @param {boolean} [test_twistability=false]
   * @returns {SphElem[][]} Set of twistable Elements.
   */
  twistablePartOf(elements, test_twistability=false) {
    elements = Array.from(elements);
    var segments = elements.flatMap(elem => Array.from(elem.boundaries));
    var untwistable = new Set();

    var i;
    do {
      for ( i=0; i<segments.length; i++ ) if ( !untwistable.has(segments[i]) ) {
        let seg0 = segments[i];
        let fixed = Array.from(seg0.affiliation.boundaries);
        for ( let seg of fixed )
          if ( untwistable.has(seg) )
            for ( let adj_seg of seg.adj.keys() )
              if ( segments.includes(adj_seg) && !fixed.includes(adj_seg) )
                fixed.push(...adj_seg.affiliation.boundaries);

        let test = true;
        if ( this.cmp(seg0.angle, 2) > 0 )
          test = false;
        if ( this.cmp(seg0.next.angle, 2) > 0 )
          test = false;
        if ( this.cmp(seg0.angle, 2) == 0 && this.cmp(seg0.radius, seg0.prev.radius) < 0 )
          test = false;
        if ( this.cmp(seg0.next.angle, 2) == 0 && this.cmp(seg0.radius, seg0.next.radius) < 0 )
          test = false;

        if ( test_twistability )
          test = this.isTwistable(seg0, fixed);

        if ( !test ) {
          let new_untwistable = new Set([seg0]);
          for ( let unseg of new_untwistable )
            for ( let adj_seg of unseg.adj.keys() )
              if ( segments.includes(adj_seg) )
                new_untwistable.add(adj_seg);
          for ( let unseg of new_untwistable )
            untwistable.add(unseg);

          if ( test_twistability )
            break;
        }
      }
    } while ( i != segments.length );

    var res = [];
    var unprocessed = new Set(elements);
    for ( let elem0 of unprocessed ) {
      unprocessed.delete(elem0);
      let comb = [elem0];
      for ( let elem of comb )
        for ( let seg of elem.boundaries )
          if ( untwistable.has(seg) )
            for ( let adj_seg of seg.adj.keys() )
              if ( unprocessed.delete(adj_seg.affiliation) )
                comb.push(adj_seg.affiliation);
      res.push(comb);
    }

    return res;
  }
  /**
   * Find sandglass-shape tips.
   * Sandglass tips are the only case to deal with after fusing untwistable part;
   * others types of tip will be detected by `isTwistable`.
   * Merge them by `this.swap(seg1, seg2, 2, 2)`.
   *
   * @param {SphSeg[]} boundaries
   * @returns {SphSeg[][]} Array of sandglass-shape tips.
   */
  findSandglassTips(boundaries) {
    var res = [];
    var tips = Array.from(boundaries).filter(seg => this.cmp(seg.angle, 0) == 0);
    for ( let i=0; i<tips.length; i++ ) for ( let j=i+1; j<tips.length; j++ ) {
      let seg1 = tips[i];
      let seg2 = tips[j];

      if ( this.cmp(seg1.radius, seg2.prev.radius) != 0 )
        continue;
      if ( this.cmp(seg2.radius, seg1.prev.radius) != 0 )
        continue;
      if ( this.cmp(seg1.vertex, seg2.vertex) != 0 )
        continue;
      if ( this.cmp(seg1.circle.center, seg2.prev.circle.center) != 0 )
        continue;
      if ( this.cmp(seg2.circle.center, seg1.prev.circle.center) != 0 )
        continue;

      res.push([seg1, seg2]);
    }

    return res;
  }
  /**
   * It will swap segments of the track for preventing to form sandglass tips.
   * You should merge elements at inner/outer side first.
   *
   * @param {SphTrack} track
   * @return {Array} The swapped segments and intersected tracks.
   */
  sealTrack(track) {
    var segs = [];
    var tracks = [];
    for ( let fence of [track.inner, track.outer] )
      for ( let i=0; i<fence.length; i++ ) {
        let seg1 = (fence[i-1] || fence[fence.length-1]).next;
        let seg2 = fence[i];
        if ( seg1 === seg2 )
          continue;

        for ( let [angle, seg, offset] of this.spin(seg1) ) {
          if ( seg === seg2 )
            break;
          if ( seg === seg1 && seg1.angle == 0 )
            continue;
          if ( seg === seg2.prev && seg2.angle == 0 )
            continue;
          if ( seg.track ) {
            tracks.push(seg.track);
            seg.track.tearDown();
          }
        }

        let ang1 = seg1.angle+2;
        let ang2 = 4-ang1;
        this.swap(seg1, seg2, ang1, ang2);
        segs.push(seg1, seg2);
      }
    return [segs, tracks];
  }
  /**
   * Check if loops is separable by circle.
   *
   * @param {SphSeg[]} boundaries - The segments of loops to separate.
   * @param {SphCircle} circle - The circle as separator.
   * @returns {boolean}
   */
  isSeparableBy(boundaries, circle) {
    for ( let loop of this.loops(boundaries) ) {
      let meets = Array.from(this.meetWith(loop[0], circle));
      meets = this.sortMeets([meets], circle);
      if ( meets.some(meet => ["|", "<"].includes(meet.type[1])) )
        return false;
    }
    return true;

  }

  /**
   * Build track along extended circle of given segment.
   *
   * @param {SphSeg} seg
   * @returns {SphTrack} The track, or `undefined` if it is illegal.
   */
  buildTrack(seg) {
    var [seg_, shift] = seg.adj.entries().next().value;
    if ( this.cmp(seg.radius, 1) > 0 )
      [seg, seg_] = [seg_, seg];
    var inner = this.full(this.ski(seg));
    if ( !inner ) return;
    var outer = this.full(this.ski(seg_));
    if ( !outer ) return;

    var track = new SphTrack();
    track.lay(inner, outer, shift);
    for ( let seg of track.inner )
      for ( let [angle, inter_seg, offset] of this.spin(seg) )
        if ( angle < 2 && angle > 0 && offset == 0 )
          if ( inter_seg.track && !track.latches.has(inter_seg.track) ) {
            let track_ = inter_seg.track;
            let circle  = track .circle;
            let circle_ = track_.circle;
            let center  = this.mod4(circle .thetaOf(circle_.center));
            let center_ = this.mod4(circle_.thetaOf(circle .center));
            let [ang, arc, arc_, meeted] = this.relationTo(circle, circle_);
            if ( meeted != 2 )
              continue;
            let latch  = {center:center , angle:ang, arc:arc };
            let latch_ = {center:center_, angle:ang, arc:arc_};
            track.lock(track_, latch, latch_);
          }

    return track;
  }
  /**
   * Partition by disjoint boundaries.
   *
   * @param {...SphSeg[]} fences - The boundaries which separate whole space.
   *   Both of boundaries and its dual should be included simultaneously.
   * @returns {Array} All part divided by boundaries, which have entries
   *   `{elements, fences}`.
   *   `elements` is set of elements in this region,
   *   `fences` is set of boundaries of this region.
   */
  partitionBy(...fences) {
    var partition = [];

    var unprocessed = new Set(fences);
    for ( let bd of unprocessed ) {
      let region = {fences: new Set(), elements: new Set()};

      region.fences.add(bd);
      for ( let par_seg of bd )
        region.elements.add(par_seg.affiliation);

      for ( let elem of region.elements ) for ( let seg of elem.boundaries ) {
        bd = fences.find(bd => bd.includes(seg));

        if ( bd === undefined ) {
          for ( let adj_seg of seg.adj.keys() )
            region.elements.add(adj_seg.affiliation);

        } else if ( !region.fences.has(bd) ) {
          unprocessed.delete(bd);
          region.fences.add(bd);
          for ( let par_seg of bd )
            region.elements.add(par_seg.affiliation);
        }
      }
      partition.push(region);
    }
    return partition;
  }
  /**
   * Twist along tracks by given angles.  It only change structure of segments
   * and tracks, will not rotate orientation of elements.
   *
   * @param {Map<SphTrack,number>} op - The map that tell you which track should
   *   twist by what angle.
   * @returns {object[]} Partition of this operation, it has entries
   *   `{elements, fences, rotation}` (see {@link SphAnalyzer#partitionBy}).
   */
  twist(op) {
    op = new Map(op);

    // unlock
    for ( let track of op.keys() )
      for ( let old_track of track.latches.keys() )
        old_track.tearDown();

    for ( let [track, theta] of op )
      track.shift = this.mod4(track.shift - theta);

    // relink adjacent segments
    for ( let track of op.keys() ) {
      for ( let seg of track.inner )
        seg.adj.clear();
      for ( let seg of track.outer )
        seg.adj.clear();
    }

    for ( let track of op.keys() ) {
      let offset1 = 0;
      for ( let seg1 of track.inner ) {
        let offset2 = 0;
        for ( let seg2 of track.outer ) {
          let offset = this.mod4(track.shift-offset1-offset2, [4, seg1.arc, seg2.arc]);
          if ( this.cmp(offset, seg1.arc+seg2.arc) < 0 )
            seg1.adjacent(seg2, offset);
          offset2 += seg2.arc;
        }
        offset1 += seg1.arc;
      }
    }

    // relock
    for ( let track of op.keys() )
      for ( let seg0 of track.inner )
        for ( let [angle, inter_seg, offset] of this.spin(seg0) )
          if ( angle < 2 && angle > 0 && offset == 0 )
            if ( !inter_seg.track )
              this.buildTrack(inter_seg);
  }
  /**
   * Make rotation instruction of twist.
   *
   * @param {Map<SphTrack,number>} op - The map that tell you which track should
   *   twist by what angle.
   * @param {SphElem} [hold] - The element whose orientation should be fixed.
   * @returns {object[]} Partition of this operation (or `undefined` if failed),
   *   it has entries `{elements, fences, rotation}` (see {@link SphAnalyzer#partitionBy}).
   */
  rotationsOfTwist(op, hold) {
    op = new Map(op);

    var tracks = Array.from(op.keys());
    var partition = this.partitionBy(...tracks.flatMap(track => [track.inner, track.outer]));
    var region0 = partition.find(region => region.elements.has(hold)) || partition[0];
    region0.rotation = [0,0,0,1];
    var rotated = new Set([region0]);

    for ( let region of rotated ) for ( let bd of region.fences ) {
      let track = tracks.find(track => track.inner===bd || track.outer===bd);
      let dual_bd = track.inner===bd ? track.outer : track.inner;
      let adj_region = partition.find(region => region.fences.has(dual_bd));

      let theta = op.get(track);
      let rotation = quaternion(bd[0].circle.center, -theta*Q);
      q_mul(region.rotation, rotation, rotation);

      if ( !rotated.has(adj_region) ) {
        adj_region.rotation = rotation;
        rotated.add(adj_region);

      } else {
        if ( this.cmp(adj_region.rotation, rotation) != 0 )
          return;
      }
    }

    return partition;
  }

  /**
   * Find untwistable part along given track if this track is untwistable.
   *
   * @param {SphSeg[]} fence - The segments at one side of track.
   * @param {boolean} [test_twistability=false]
   * @returns {SphSeg[]} The segments of untwistable part.
   */
  raiseShield(fence, test_twistability=false) {
    var circle0 = fence[0].circle;

    var untwistable = new Set(fence);
    var shield = Array.from(untwistable).flatMap(seg => Array.from(seg.walk()));

    var i;
    do {
      for ( i=0; i<shield.length; i++ ) if ( !untwistable.has(shield[i]) ) {
        let test = this.relationTo(shield[i].circle, circle0)[3] == 2;
        if ( test_twistability )
          test = test || !this.isTwistable(shield[i], shield);

        if ( test ) {
          let new_untwistable = new Set([shield[i]]);
          for ( let unseg of new_untwistable )
            for ( let adj_seg of unseg.adj.keys() )
              new_untwistable.add(adj_seg);

          for ( let unseg of new_untwistable ) {
            untwistable.add(unseg);
            if ( !shield.includes(unseg) )
              shield.push(...unseg.walk());
          }

          if ( test_twistability )
            break;
        }
      }
    } while ( i != shield.length );

    return shield;
  }
  /**
   * Detect latches by given fence, cracks and shield.
   * Latch is potential to form intersected track at one side of this track.
   *
   * @param {SphSeg[]} fence
   * @param {object[]} [cracks]
   * @param {SphSeg[]} [shield]
   * @returns {object[]} Array of latches, which has entries
   *   `{arc, center, angle}` or `{arc, center}` (free latch):
   *   `arc` is arc of shadow under circle of latch;
   *   `center` is center of latch;
   *   `angle` is angle between latch and this track.
   */
  detectLatches(fence, cracks, shield) {
    const isFree = (subcracks, shield) => {
      var pre = subcracks.filter(crack => crack.angle==0);
      var post = subcracks.filter(crack => crack.angle==2);
      for ( let crack1 of pre ) for ( let crack2 of post )
        if ( this.cmp(2-crack1.segment.radius, crack2.segment.radius) == 0 )
          if ( !shield || !shield.includes(crack2.segment) )
            return true;
      return false;
    };

    var ticks = [];
    var theta0 = 0;
    for ( let i=0; i<fence.length; i++ ) {
      if ( !cracks || isFree(cracks[i], shield) ) {
        let tick = [theta0];
        tick.segment0 = fence[i];
        ticks.push(tick);

      } else {
        for ( let crack of cracks[i] ) if ( crack.angle > 0 && crack.angle < 2 ) {
          let tick = [theta0, crack.angle, crack.segment.radius];
          tick.segment = crack.segment;
          ticks.push(tick);
        }
      }
      theta0 += fence[i].arc;
    }
    console.assert(this.cmp(theta0, 4) == 0);

    var latches = [];
    var centers = new Set();
    for ( let tick of ticks ) {
      if ( tick.length == 1 ) { // find free latches
        for ( let tick_ of ticks ) if ( tick_.length == 1 ) {
          let [theta] = tick;
          let [theta_] = tick_;
          let arc = this.mod4(theta - theta_, [2]);

          if ( arc <= 2 ) {
            let center = this.mod4(theta-arc/2, centers);
            centers.add(center);
            latches.push({arc, center});
          }
        }

      } else { // find fixed latches
        let [theta, angle, radius] = tick;
        let arc = abCA(radius, fence[0].radius, 2-angle)*2;
        let tick0_ = [this.mod4(theta-arc, [0])];
        let tick_ = [tick0_[0], 2-angle, 2-radius];

        if ( this.cmp([arc, radius], [2, 1]) <= 0 ) {
          if ( !ticks.some(tick => this.cmp(tick, tick0_)==0 || this.cmp(tick, tick_)==0) )
            continue;
        } else {
          if ( !ticks.some(tick => this.cmp(tick, tick0_)==0) )
            continue;
          [theta, angle, radius] = tick_;
          arc = 4-arc;
        }

        if ( shield && !this.isSeparableBy(shield, tick.segment.circle) )
          continue;

        let center = this.mod4(theta-arc/2, centers);
        centers.add(center);
        arc = this.snap(arc, [2]);
        latches.push({arc, center, angle});

      }
    }

    return latches;
  }
  /**
   * Detect non-trivial twist angle of track.
   *
   * @param {SphTrack} track
   * @param {object} [shields] - Inner and outer shields of this track.
   * @returns {Map<number,object[]>} Map from shift to matched latches.
   */
  decipher(track, shields={}) {
    var latches = {};
    for ( let side of ["inner", "outer"] ) {
      let fence = track[side];
      let shield = shields[side];

      let cracks = [];
      for ( let i=0; i<fence.length; i++ ) {
        let seg = fence[i-1] || fence[fence.length-1];

        let [ang1, seg1] = [seg.next.angle, seg.next];
        let subcracks = [];
        for ( let [angle, segment, offset] of this.spin(seg1) ) {
          angle = this.snap(angle+ang1, [0, 2, 4]);
          let sgn = this.cmp([angle, segment.radius-1], [2, seg.radius-1]);
          console.assert(sgn <= 0);
          if ( sgn >= 0 ) break;
          subcracks.push({angle, segment});
        }
        cracks.push(subcracks);
      }

      let latches_ = this.detectLatches(fence, cracks, shield);
      latches[side] = latches_;
    }

    // Make circle that intersect given circle
    function intercircle(circle, theta, arc, angle) {
      const ABca = (A, B, c) => 2-abCA(2-A, 2-B, 2-c);
      var dis = ABca(2-angle, arc/2, circle.radius);
      var radius = ABca(arc/2, 2-angle, circle.radius);
      var vec = [
        Math.sin(dis*Q)*Math.cos(theta*Q),
        Math.sin(dis*Q)*Math.sin(theta*Q),
        Math.cos(dis*Q)
      ];
      var center = rotate(vec, circle.orientation);
      var orientation = q_align(center, circle.center);
      return new SphCircle({radius, orientation});
    }

    var passwords = new Map();
    for ( let latch2 of latches.outer ) for ( let latch1 of latches.inner ) {
      if ( this.cmp(latch1.arc, latch2.arc) != 0 )
        continue;

      if ( latch1.angle && latch2.angle ) {
        if ( this.cmp(latch1.angle, 2-latch2.angle) != 0 )
          continue;

      } else if ( latch1.angle && !latch2.angle ) {
        latch2 = Object.assign({angle:2-latch1.angle}, latch2);
        if ( shields.outer ) {
          let {center, arc, angle} = latch2;
          let circle = intercircle(track.outer[0].circle, center, arc, angle);
          if ( !this.isSeparableBy(shields.outer, circle) )
            continue;
        }

      } else if ( !latch1.angle && latch2.angle ) {
        latch1 = Object.assign({angle:2-latch2.angle}, latch1);
        if ( shields.inner ) {
          let {center, arc, angle} = latch1;
          let circle = intercircle(track.inner[0].circle, center, arc, angle);
          if ( this.isSeparableBy(shields.inner, circle) )
            continue;
        }
      }

      let key = this.mod4(latch1.center+latch2.center, passwords.keys());
      if ( !passwords.has(key) )
        passwords.set(key, []);
      passwords.get(key).push(latch1);
    }

    return passwords;
  }
  /**
   * Detect possible twist angle of track just by segments along track.
   *
   * @param {SphTrack} track
   * @returns {Map<number,SphSeg[][]>} Map from shift to matched pairs of segments.
   */
  guessKeys(track) {
    var len1 = 0;
    var inner_ticks = [];
    for ( let seg of track.inner ) {
      inner_ticks.push([seg, len1]);
      len1 += seg.arc;
    }
    console.assert(this.cmp(len1, 4) == 0);
    var len2 = 0
    var outer_ticks = [];
    for ( let seg of track.outer ) {
      outer_ticks.push([seg, len2]);
      len2 += seg.arc;
    }
    console.assert(this.cmp(len2, 4) == 0);

    var keys = new Map();
    for ( let [seg1, offset1] of inner_ticks ) for ( let [seg2, offset2] of outer_ticks ) {
      let key = track.host.analyzer.mod4(offset1+offset2, keys.keys());
      if ( !keys.has(key) )
        keys.set(key, []);
      keys.get(key).push([seg1, seg2]);
    }

    return keys;
  }

  /**
   * Make profile of given segments.
   * Profile are loops of segments that are adjacent to exposed part of given segments.
   *
   * @param {SphSeg[]} segments
   * @returns {SphSeg[]} Profile of segments.
   */
  sketchProfile(segments) {
    var segments = new Set(segments);
    var uncovered = [];
    for ( let seg of segments ) {
      // find end points of covers between segments
      let brackets = new Set();

      let seg_, theta_;
      [seg_, theta_] = this.jump(seg, 0, +1);
      if ( segments.has(seg_) )
        brackets.add([0, +1]);
      [seg_, theta_] = this.jump(seg, seg.arc, -1);
      if ( segments.has(seg_) )
        brackets.add([seg.arc, -1]);

      for ( let [adj_seg, offset] of seg.adj ) if ( segments.has(adj_seg) ) {
        [seg_, theta_] = this.jump(adj_seg, 0, +1);
        if ( seg_ === seg )
          brackets.add(this.snap([theta_, -1], brackets));
        [seg_, theta_] = this.jump(adj_seg, adj_seg.arc, -1);
        if ( seg_ === seg )
          brackets.add(this.snap([theta_, +1], brackets));
      }

      brackets.add([0, -1]);
      brackets.add([seg.arc, +1]);
      brackets = Array.from(brackets).sort(this.cmp.bind(this));

      // find uncovered interval
      console.assert(brackets.length % 2 == 0);
      for ( let i=0; i<brackets.length; i+=2 ) {
        let [th1, s1] = brackets[i];
        let [th2, s2] = brackets[i+1];
        console.assert(s1<0 && s2>0);

        if ( this.cmp(th1, th2) != 0 )
          uncovered.push([seg, th1, th2]);
      }
    }

    // build segments of profile
    for ( let interval of uncovered ) {
      let [seg, th1, th2] = interval;
      let arc = this.snap(th2-th1, [seg.arc]);
      let {radius, orientation} = seg.circle.shift(th2).complement();
      let bd = new SphSeg({radius, arc, orientation});
      bd.adj.set(seg, th2);
      interval.push(bd);
    }

    // connect segments of profile
    for ( let [,,,bd] of uncovered ) {
      let ang_, seg_, th1_;
      for ( let tick of this.spin(bd) ) {
        if ( !segments.has(tick[1]) )
          break;
        [ang_, seg_, th1_] = tick;
      }
      bd.angle = 4-ang_;
      let [,,,bd_] = uncovered.find(([seg, th1]) => seg===seg_ && this.cmp(th1,th1_) == 0);
      bd_.connect(bd);
    }

    return uncovered.map(([,,,bd]) => bd);
  }
  /**
   * Parse reachable segments (by `next`, `prev` and `adj`) and profile of given
   * segments.
   *
   * @param {SphSeg[]} segments
   * @returns {Array} Walkable parts, with entries `{loops, profile}`, where
   *   `loops` and `profile` are arrays of loop.
   */
  parseWalkable(segments) {
    var parks = [];
    var lost = new Set(segments);
    while ( lost.size ) {
      let park = {loops:[], profile:[]};

      let queue = new Set([lost.values().next().value]);
      for ( let seg0 of queue ) {
        let loop = this.full(seg0.walk());
        console.assert(loop);
        park.loops.push(loop);

        for ( let seg of loop ) {
          console.assert(lost.has(seg));
          lost.delete(seg);
          queue.delete(seg);
          for ( let adj_seg of seg.adj.keys() )
            if ( lost.has(adj_seg) )
              queue.add(adj_seg);
        }
      }

      let profile = this.sketchProfile(park.loops.flat());
      park.profile = Array.from(this.loops(profile));

      parks.push(park);
    }

    return parks;
  }
  /**
   * Find joints between park parts by drawing circle between two given points.
   *
   * @param {Array} parks - All parks of puzzle
   *   (see {@link SphAnalyzer#parseWalkable}).
   * @param {number[]} from - The first point the circle passing through.
   * @param {number[]} to - The second point the circle passing through.
   * @yields {Array} The array with information about joint, which has value
   *   `[park1, loop1, park2, loop2, side]`:
   *   `loop1` in `park1` is joint with `loop2` in `park2`.
   *   `side` is `+1` means it is inside joint, and `side` is `-1` means it is
   *   outside joint.
   */
  *flyThrough(parks, from, to) {
    // build great circle pass through `from` and `to`
    var orientation = q_mul(q_align(from, to), [0.5, 0.5, 0.5, -0.5]);
    var circle = new SphCircle({orientation, radius:1});

    // find and sort meets
    var meets = [];
    for ( let park of parks )
      for ( let [loops, side] of [[park.loops, +1], [park.profile, -1]] )
        for ( let loop of loops ) {
          let path = Array.from(this.meetWith(loop[0], circle));
          meets.push(path);
          for ( let meet of path ) {
            meet.park = park;
            meet.loop = loop;
            meet.side = side;
          }
        }
    meets = this.sortMeets(meets, circle);

    // find joints
    for ( let i=0; i<meets.length; i++ )
      if ( ["(|)", "(|]", "[|)", "[|]", "(<(", ")<)"].includes(meets[i].type) ) {
        let meet1 = meets[i];
        let meet2 = meets[i+1] || meets[0];
        console.assert([")|(", "]|(", ")|[", "]|[", "(<(", ")<)"].includes(meet2.type));
        console.assert(meet1.side == meet2.side);

        if ( meet1.park === meet2.park )
          console.assert(meet1.loop === meet2.loop);
        else
          yield [meet1.park, meet1.loop, meet2.park, meet2.loop, meet1.side];
      }
  }

  /**
   * Determine shape of loop of element.
   *
   * @param {SphSeg[]} loop - the loop to determine.
   * @returns {Array} Shape and first referenced segment of given loop.
   *   The shape has value `{fold, patch}` (see {@link SphModel}).
   */
  shapeOf(loop) {
    // check
    for ( let seg of loop ) {
      console.assert(this.cmp(seg.arc, 0) > 0 && this.cmp(seg.arc, 4) <= 0);
      console.assert(this.cmp(seg.radius, 0) > 0 && this.cmp(seg.radius, 2) < 0);
      console.assert(this.cmp(seg.angle, 0) >= 0 && this.cmp(seg.radius, 4) <= 0);
      if ( this.cmp(seg.angle, 0) == 0 )
        console.assert(this.cmp(seg.radius, 2-seg.prev.radius) >  0);
      if ( this.cmp(seg.angle, 4) == 0 )
        console.assert(this.cmp(seg.radius, 2-seg.prev.radius) <= 0);
    }

    var keys = loop.map(({arc, radius, angle}) => [arc, radius, angle]);
    if ( keys.length == 1 )
      return [{fold:0, patch:keys, center:[0,0,1]}, loop[0]];

    // fix rotation
    var keys0 = keys.slice();
    var offsets = [];
    for ( let i=0; i<keys.length; i++ ) {
      let sgn = this.cmp(keys, keys0);
      if ( sgn == 0 )
        offsets.push(i);
      else if ( sgn < 0 )
        keys0 = keys.slice(), offsets = [i];
      keys.push(keys.shift());
    }

    // make patch
    var patch = keys0.slice(0, (offsets[1]-offsets[0]) || keys0.length);
    var fold = keys0.length / patch.length;
    console.assert(Number.isInteger(fold));
    console.assert(offsets.every((i, n) => i == offsets[0]+patch.length*n));

    var shape = {fold, patch};
    if ( fold > 1 )
      shape.center = normalize(q_mul(q_inv(loop[offsets[0]].orientation),
                                     loop[offsets[1]].orientation));

    return [shape, loop[offsets[0]]];
  }
  /**
   * Make loop with given shape.
   *
   * @param {object} shape - The shape of the loop to make.
   * @returns {SphSeg[]} The loop with `shape`.
   */
  shapeBy(shape) {
    var {fold, patch} = shape;
    var N = fold == 0 ? 1 : fold;

    var loop = [];
    var elem = new SphElem();
    for ( let k=0; k<N; k++ ) for ( let l=0; l<patch.length; l++ ) {
      let [arc, radius, angle] = patch[l];
      let seg = new SphSeg({arc, radius, angle});
      loop.push(seg);
      elem.accept(seg);
    }
    loop.reduce((seg1, seg2) => (seg1.connect(seg2), seg2), loop[loop.length-1]);

    return loop;
  }
  /**
   * Analyze network structure and classify shapes of elements (see {@link SphKnot}
   * and {@link SphModel}).
   *
   * @param {SphElem[]} elements
   * @returns {SphKnot[]} The knots in network structure.
   */
  structurize(elements) {
    var segments = Array.from(elements).flatMap(elem => Array.from(elem.boundaries));
    var parks = this.parseWalkable(segments);

    // classify by shapes
    for ( let park of parks ) {
      console.assert(park.profile.length == 0);
      let model = new SphModel();
      park.knot = new SphKnot({model});

      // add shapes
      for ( let loop of park.loops ) {
        let [shape, seg] = this.shapeOf(loop);
        shape.count = 0;
        shape = model.shapes.find(({patch}) => this.cmp(patch, shape.patch) == 0) || shape;
        let index = model.add(shape);
        model.set(park.knot.segments, index, seg);
      }

      // sort shapes
      let keys = model.shapes.map(({patch}, i) => [patch, i])
                             .sort((a, b) => this.cmp(a[0], b[0]))
                             .map(a => a[1]);
      model.shapes = keys.map(i => model.shapes[i]);
      park.knot.segments = keys.map(i => park.knot.segments[i]);
    }

    // make joints
    for ( let park of parks )
      park.vertex = park.loops[0][0].vertex;
    var vertex0 = parks[0].vertex;

    var locals = new Set(parks.slice(1));
    for ( let {vertex} of locals )
      for ( let fusion of this.flyThrough(parks, vertex0, vertex) ) {
        let [park1, loop1, park2, loop2, side] = fusion;
        console.assert(side == 1);
        let index1 = park1.knot.indexOf(loop1[0]);
        let index2 = park2.knot.indexOf(loop2[0]);
        let joint1 = park1.knot.jointAt(index1, true);
        let joint2 = park2.knot.jointAt(index2, true);
        joint1.fuse(joint2);
        locals.delete(park1);
        locals.delete(park2);
      }

    // make bandages
    for ( let elem of new Set(elements) ) {
      let segs = Array.from(elem.fly());
      if ( segs.length == 1 )
        continue;

      segs.map(seg => {
        var park, index;
        for ( park of parks )
          if ( index = park.knot.indexOf(seg) )
            return park.knot.jointAt(index, true);
        console.assert(false);
      }).reduce((joint1, joint2) => (joint1.bind(joint2), joint2));
    }

    return parks.map(park => park.knot);
  }
  /**
   * Make configuration of knot.
   * 
   * @param {SphKnot} knot
   */
  configure(knot) {
    knot.configuration.adjacencies = [];
    for ( let [index1, seg] of knot.model.items(knot.segments) )
      for ( let [adj_seg, offset] of seg.adj ) {
        let index2 = knot.indexOf(adj_seg);
        if ( this.cmp(index1, index2) < 0 )
          knot.configuration.adjacencies.push([index1, index2, offset]);
      }
  }

  /**
   * Assemble segments according to the given structure.
   * It will rebuild absent elements, and reconstruct (or check) adjacent
   * relationships and tracks.
   *
   * @param {SphKnot[]} knots - The knots in network structure.
   * @param {boolean} [forced=true] - Re-assemble all given segments if true,
   *   otherwise check consistency.
   */
  assemble(knots, forced=true) {
    for ( let knot of knots ) {
      if ( knot.segments.length == 0 ) {
        // build elements
        for ( let i=0; i<knot.model.shapes.length; i++ )
          for ( let j=0; j<knot.model.shapes[i].count; j++ )
            knot.model.set(knot.segments, [i,j], this.shapeBy(knot.model.shapes[i])[0]);

      } else {
        if ( forced ) {
          for ( let seg0 of knot.segments.flat() )
            for ( let seg of seg0.walk() ) {
              seg.adj.clear();
              if ( seg.track ) seg.track.tearDown();
            }
        }
      }

      // set adjacencies
      for ( let [index1, index2, offset] of knot.configuration.adjacencies ) {
        let seg1 = knot.segmentAt(index1);
        let seg2 = knot.segmentAt(index2);
        if ( !seg1.adj.has(seg2) )
          seg1.adjacent(seg2, offset);
        console.assert(this.cmp(seg1.adj.get(seg2), offset) == 0);
        console.assert(this.cmp(seg2.adj.get(seg1), offset) == 0);
      }

      // make tracks
      for ( let seg0 of knot.segments.flat() )
        for ( let seg of seg0.walk() )
          if ( !seg.track ) this.buildTrack(seg);
    }
  }
  /**
   * Orient segments according to the given structure.
   * It will compute (or check) orientations of segments.
   *
   * @param {SphKnot} knot0 - The fixed knot.
   * @param {number[]} [index0=[0,0,0,0]] - The index of fixed segment.
   * @param {number[]} [orientation0=[0,0,0,1]] - The orientation of fixed segment.
   * @param {boolean} [forced=true] - Re-compute all given segments if true,
   *   otherwise check consistency.
   */
  orient(knot0, index0=[0,0,0,0], orientation0=[0,0,0,1], forced=true) {
    if ( forced ) {
      for ( let knot of knot0.travel() )
        for ( let seg0 of knot.segments.flat() )
          for ( let seg of seg0.walk() )
            seg.orientation = undefined;
    }

    var seg0 = knot0.segmentAt(index0);
    if ( !seg0.orientation )
      seg0.orientation = orientation0;

    var align = (seg, orientation) => {
      if ( !seg.orientation )
        seg.orientation = orientation.slice();
      else
        console.assert(this.cmp(seg.orientation, orientation) == 0
                       || this.cmp(seg.orientation, orientation.map(x=>-x)) == 0);
    };

    var compass = [0,0,0,1];
    var route = [[knot0, seg0]];
    for ( let [knot, seg0] of route ) {
      var path = Array.from(seg0.walk());
      for ( let seg of path ) {
        // next
        {
          q_spin(seg.orientation, seg.arc*Q, compass);
          let vertex = [Math.sin(seg.radius*Q), 0, Math.cos(seg.radius*Q)];
          rotate(vertex, compass, vertex);
          let phi = (seg.radius-seg.next.radius)*Q;
          q_mul(compass, quaternion([0,1,0], phi), compass);
          let ang = (2-seg.next.angle)*Q;
          q_mul(quaternion(vertex, ang), compass, compass);
          align(seg.next, compass);
        }

        // adj
        for ( let [adj_seg, offset] of seg.adj ) {
          q_spin(seg.orientation, offset*Q, compass);
          q_mul(compass, [1,0,0,0], compass);
          align(adj_seg, compass);

          if ( !path.includes(adj_seg) ) path.push(...adj_seg.walk());
        }
      }

      // fly
      for ( let [index, joint] of knot.model.items(knot.joints) ) {
        let seg = knot.segmentAt(index);
        let alignment = q_mul(seg.orientation, q_inv(joint.ports.get(knot)));

        for ( let [knot_, orientation_] of joint.ports ) if ( knot_ !== knot ) {
          let seg_ = knot_.segmentAt(knot_.indexOf(joint));

          q_mul(alignment, orientation_, compass);
          align(seg_, compass);

          if ( route.every(([knot]) => knot!==knot_) )
            route.push([knot_, seg_]);
        }

        for ( let joint_ of joint.bandage ) if ( joint_ !== joint )
          for ( let [knot_, orientation_] of joint_.ports ) {
            let seg_ = knot_.segmentAt(knot_.indexOf(joint_));
            if ( seg_.orientation )
              continue;

            q_mul(alignment, orientation_, compass);
            align(seg_, compass);
          }
      }
    }
  }

  /**
   * Explore whole elements from given segment, and reorder them in passing.
   * This function give same result for equivalent configuration.
   * It will sort elements by order of encountering, and yields adjacent relation
   * when passing through.
   *
   * @param {SphModel} model - The model of puzzle to explore.
   * @param {SphSeg} seg0 - The first segment to explore.
   * @param {Symbol} INDEX - The symbol to access index of segment.
   * @yields {Array} The adjacency just passed through.
   * @returns {Array} The permutation of sorted configuration.
   */
  *crawl(model, seg0, INDEX) {
    var perm = model.shapes.map(() => []);
    var P = Array(model.shapes.length).fill(0);
    var path = [];

    var add = seg => {
      var [i, j, k] = seg[INDEX];
      if ( perm[i][j] === undefined ) {
        let N = model.shapes[i].fold == 0 ? 1 : model.shapes[i].fold;
        perm[i][j] = [P[i]++, (N-k)%N];
        path.push(...seg.walk());
      }
    };

    add(seg0);

    var explored = new Set();
    for ( let seg of path ) {
      // find adjacent segment
      for ( let [seg_, offset] of seg.adj ) if ( !explored.has(seg_) ) {
        add(seg_);

        let index  = model.call(perm, seg [INDEX]);
        let index_ = model.call(perm, seg_[INDEX]);
        if ( this.cmp(index, index_) > 0 )
          [index_, index] = [index, index_];
        yield [index, index_, offset];
      }

      explored.add(seg);
    }
    console.assert(P.every((n, i) => n == model.shapes[i].count));

    return perm;
  }
  /**
   * Standardize configuration of this state.
   * It will build adjacency table and symmetries of configuration and return
   * possible permutations.
   * The multiple permutations means geometric symmetry of this configuration.
   *
   * @param {SphModel} model - The model of puzzle to build.
   * @param {SphSeg[][]} param - The segments of puzzle to analyze.
   * @param {SphConfig[]} [known=[]] - Sorted list of known standardized
   *   configurations.
   * @returns {Array} Standardized configuration and possible permutations.
   */
  standardizeConfig(model, param, known=[]) {
    const shape = model.shapes[0];

    if ( shape.fold == 0 ) {
      console.assert(model.shapes.length <= 2 && model.shapes[model.shapes.length-1].fold == 0);

      let seg1 = param[0][0];
      let buffer = [];
      for ( let [seg2, offset] of seg1.adj ) {
        let index1 = model.indexOf(param, seg1);
        let index2 = model.indexOf(param, seg2);
        buffer.push([index1, index2, offset]);
      }

      let config = known.find(config => this.cmp(buffer, config.adjacencies) == 0);
      if ( config === undefined ) {
        config = new SphConfig({model});
        config.adjacencies = buffer;
      }

      return [config, [model.I()]];
    }

    // determine indices of segments and compute length of adjacency table
    const INDEX = Symbol("index");
    var length = 0;
    for ( let [index, seg] of model.items(param) ) {
      seg[INDEX] = index;
      length += seg.adj.size;
    }
    length = length/2;
    console.assert(Number.isInteger(length));

    // compare adjacency table
    var cmp = (arr, gen, arr_, gen_) => {
      var sgn;
      for ( let t=0; t<length; t++ ) {
        let val  = arr [t] || (arr [t] = gen .next().value);
        let val_ = arr_[t] || (arr_[t] = gen_.next().value);
        sgn = this.cmp(val, val_);
        if ( sgn != 0 )
          break;
      }
      return sgn;
    };

    var buffer = [[[1]]], crawler;
    var permutations = [];

    // find the smallest adjacency table
    for ( let j=0; j<shape.count; j++ )
      for ( let k=0; k<shape.fold; k++ ) {
        let seg0 = model.get(param, [0, j, k]);
        let buffer_ = [], crawler_ = this.crawl(model, seg0, INDEX);

        // find minimal lazy array (lexical order)
        let sgn = cmp(buffer_, crawler_, buffer, crawler);
        if ( sgn == 0 ) {
          let res = crawler_.next();
          console.assert(res.done);
          permutations.push(res.value);

        } else if ( sgn < 0 ) {
          [buffer, crawler] = [buffer_, crawler_];
          permutations = [];

          // shortcut to known configurations
          for ( let config_ of known ) {
            let sgn = cmp(buffer, crawler, config_.adjacencies);
            if ( sgn == 0 ) {
              let res = crawler.next();
              console.assert(res.done);
              permutations = config_.symmetries
                .map(perm => model.followedBy(res.value, perm));
              return [config_, permutations];

            } else if ( sgn < 0 ) {
              break;
            }
          }

        }
      }

    for ( let t=0; t<length; t++ )
      if ( !buffer[t] ) buffer[t] = crawler.next().value;
    var res = crawler.next();
    console.assert(res.done);
    permutations.unshift(res.value);

    // structure of config
    var config = new SphConfig({model});
    config.adjacencies = buffer;
    var perm0 = model.inverse(res.value);
    config.symmetries = permutations.map(perm => model.followedBy(perm0, perm))
                                    .sort(this.cmp.bind(this));

    // clear INDEX
    for ( let [index, seg] of model.items(param) )
      delete seg[INDEX];

    return [config, permutations];
  }
  /**
   * Find the joint contains given point.
   *
   * @param {SphKnot} knot
   * @param {number[]} point
   * @returns {object} Joint, or element if it is simply connected.
   */
  grab(knot, point) {
    var joint;
    var not_here = new Set();

    while ( true ) {
      // find the loop containing `point`
      let index;
      for ( let [[i,j,k,l], seg] of knot.model.items(knot.segments) ) if ( k==0 && l==0 ) {
        let res = this.contains(Array.from(seg.walk()), point);
        if ( res === undefined || res == true ) {
          index = [i,j];
          break;
        }
      }
      console.assert(index !== undefined);

      // find joint of loop
      let joint_ = knot.jointAt(index);
      if ( joint_ === undefined )
        return knot.segmentAt(index).affiliation;
      joint = joint_;
      not_here.add(knot);

      // next knot to check
      knot = Array.from(joint.ports.keys()).find(knot => !not_here.has(knot));
      if ( !knot )
        return joint;
    }
  }

  /**
   * Standarize (in-place) transition between configuration and returns symmetries.
   *
   * @param {object[][]} perm
   * @param {Array} sym_from
   * @param {Array} sym_to
   * @param {SphTransition[]} [known=[]] - Sorted list of known standarized
   *   transitions.
   * @returns {Array} Standardized transition and possible transformations.
   * @returns {object[][]} The list of symmetries of this operation, with entries
   *   `[perm_from, perm_to]`:
   *   `perm_from` is permutation of symmetry of start configuration;
   *   `perm_to` is permutation of symmetry of final configuration,
   *   and they obey `perm == perm_from**-1 * perm * perm_to`.
   */
  standardizeTransition(perm, sym_from, sym_to, known=[]) {
    var min_perm = [[[config_from.types[0].count]]];
    var sym = [];

    if ( config_from === config_to ) {
      for ( perm_from of config_from.symmetries ) {
        let _perm = config_from.followedBy(config_from.inverse(perm_from), perm);
        let _perm_ = config_to.followedBy(_perm, perm_from);
        let sgn = this.cmp(_perm_, min_perm);

        if ( sgn < 0 ) {
          min_perm = _perm_;
          sym = [[perm_from, perm_from]];
        } else if ( sgn == 0 ) {
          sym.push([perm_from, perm_from]);
        }
      }

    } else {
      for ( perm_from of config_from.symmetries ) {
        let _perm = config_from.followedBy(config_from.inverse(perm_from), perm);
        for ( perm_to of config_to.symmetries ) {
          let _perm_ = config_to.followedBy(_perm, perm_to);
          let sgn = this.cmp(_perm_, min_perm);

          if ( sgn < 0 ) {
            min_perm = _perm_;
            sym = [[perm_from, perm_to]];
          } else if ( sgn == 0 ) {
            sym.push([perm_from, perm_to]);
          }
        }
      }

    }

    for ( let i=0; i<perm.length; i++ )
      for ( let j=0; j<perm[i].length; j++ )
        perm[i][j] = min_perm[i][j];

    return sym;
  }

  sortPasswords(passwords) {
    passwords = Array.from(passwords);

    // sort latches
    for ( let match of passwords ) {
      let latches = match[1];
      latches = latches.map(e => e.angle ? [e.center, e.arc, e.angle] : [e.center, e.arc]);

      // center => gap
      latches.sort(this.cmp.bind(this));
      let centers = latches.map(e => e[0]);
      for ( let i=0; i<latches.length; i++ )
        latches[i][0] = (i+1<latches.length ? centers[i+1] : center[0]+4) - centers[i];

      // cyclic sort latches
      let latches0 = latches.slice();
      let centers0 = [];
      for ( let i=0; i<latches.length; i++ ) {
        let sgn = this.cmp(latches, latches0);
        if ( sgn == 0 )
          centers0.push(centers[i]);
        if ( sgn == -1 )
          [latches0, centers0] = [latches.slice(), [centers[i]]];

        latches.push(latches.shift());
      }

      match[1] = latches0;
      match.push(centers0);
    }

    // sort matches
    // shift => shift_offset
    passwords.sort((m1, m2) => m1[0]-m2[0]);
    var shifts = passwords.map(e => e[0]);
    for ( let i=0; i<passwords.length; i++ )
      passwords[i][0] = (i+1<passwords.length ? shifts[i+1] : shift[0]+4) - shifts[i];

    // center => center_offset

    // cyclic sort matches
    var passwords0 = passwords.slice();
    var shifts0 = [];
    for ( let i=0; i<passwords.length; i++ ) {
      let sgn = this.cmp(passwords, passwords0);
      if ( sgn == 0 )
        shifts0.push(shifts[i]);
      if ( sgn == -1 )
        [passwords0, shifts0] = [passwords.slice(), [shifts[i]]];

      passwords.push(passwords.shift());
    }

    return passwords;

    this.units = [];
    // unit = {radius, passwords}
    // passwords = [shift_offset, center_offset] -> [[gap, arc, angle], ...]
    this.coord = [];
    // coord_i = [[pw_ind, shift_offset], ...]
    this.intersections = intersections;
    // intersection = [index1, index2]
    // index = [unit_ind, latch_ind]
    this.indices = [];
    // index = [inner, outer, shift, center]
    // inner/outer = [seg_ind, ...]
    
    // partial_perm = unit_ind -> [shift, ...]
  }
  basisOf(loops) {
    // build tracks
    var tracks = [];
    for ( let loop of loops ) for ( let seg of loop )
      if ( seg.track && !tracks.includes(seg.track) ) {
        let track = {};
        track.inner = seg.track.inner.map(seg => seg.index);
        track.outer = seg.track.outer.map(seg => seg.index);
        track.shift = seg.track.shift;

        track.passwords = [];
        for ( let [ang, matches] of seg.track.passwords )
          track.passwords.push([ang, matches.map(([seg, arc]) => [seg.index, arc])]);

        tracks.push(track);
      }
  }
  subtypeOf(config, perm, subtypes) {
    const gcd = (a,b) => (!b)?a:gcd(b,a%b);

    if ( !subtypes ) {
      subtypes = [];
      for ( let i=0; i<config.types.length; i++ ) {
        subtypes[i] = [];
        for ( let j=0; j<config.types[i].count; j++ )
          subtypes[i][j] = {dk:config.types[i].fold, indices:[[j, 0]]};
      }
    }

    for ( let i=0; i<config.types.length; i++ ) {
      let type = config.types[i];
      for ( let j=0; j<config.types[i].count; j++ ) {
        let [j_, dk] = perm[i][j];
        let subtype1 = subtypes[i][j];
        let subtype2 = subtypes[i][j_];

        if ( subtype1 === subtype2 ) {
          subtype1.dk = gcd(subtype1.dk, dk);

        } else {
          subtype1.dk = gcd(subtype1.dk, subtype2.dk);
          let [, k1] = subtype1.indices.find(([j1,k1]) => j1==j);
          let [, k2] = subtype2.indices.find(([j2,k2]) => j2==j_);
          let dk_ = k1+dk-k2;
          let indices_ = subtype2.indices.map(([j2,k2]) => [j2, k2+dk_]);
          subtype1.indices.push(...indices_);
          for ( let [j2, k2] of subtype2.indices )
            subtypes[i][j2] = subtype1;
        }
      }

      for ( let {dk, indices} of new Set(subtypes[i]) )
        for ( let index of indices )
          index[1] = (index[1] % dk + dk) % dk;
    }

    return subtypes;
  }
}


/**
 * Proxy of event system for javascript object.
 *
 * @class
 */
class Listenable
{
  constructor() {
    this._listeners = {};
  }
  on(type, target=Object, listener) {
    var i = (this._listeners[type] || []).findIndex(([c,f]) => c===target && f===listener);
    if ( i != -1 )
      return false;
    this._listeners[type] = this._listeners[type] || [];
    this._listeners[type].push([target, listener]);
    return true;
  }
  off(type, target=Object, listener) {
    var i = (this._listeners[type] || []).findIndex(([c,f]) => c===target && f===listener);
    if ( i == -1 )
      return false;
    this._listeners[type].splice(i, 1);
    return true;
  }
  once(type, target=Object, listener) {
    var remover = () => {
      this.off(type, target, listener);
      this.off(type, target, remover);
    };
    this.on(type, target, listener);
    this.on(type, target, remover);
  }
  trigger(type, target, event={}) {
    event.type = type;
    event.target = target;
    event.currentTarget = this;

    for ( let [clz, listener] of Array.from(this._listeners[type] || []) ) {
      if ( typeof clz == "function" ) {
        if ( target instanceof clz )
          listener.call(this, event);

      } else {
        if ( target === clz )
          listener.call(this, event);

      }
    }
  }
}

/**
 * Proxy of observer system for javascript object.
 *
 * @class
 */
class Observable extends Listenable
{
  constructor() {
    super();
    this.changed = false;

    this.routine = this.recordRoutine();
    var wrapped = () => (requestAnimationFrame(wrapped), this.onchange(this.takeRecords()));
    requestAnimationFrame(wrapped);
  }
  get observed() {
    return new Map();
  }
  *recordRoutine() {
    var records = new Map();
    var new_records = new Map();

    while ( true ) {
      let modified = new Map();

      if ( this.changed ) {
        for ( let [target, properties] of this.observed )
          new_records.set(target, this.record(target, properties));

        for ( let [target, record] of records ) if ( new_records.has(target) )
          modified.set(target, this.differ(record, new_records.get(target)));
        for ( let target of records.keys() ) if ( !new_records.has(target) )
          modified.set(target, "removed");
        for ( let target of new_records.keys() ) if ( !records.has(target) )
          modified.set(target, "added");

        [records, new_records] = [new_records, records];
        new_records.clear();
        this.changed = false;
      }

      yield modified;
    }
  }
  takeRecords() {
    return this.routine.next().value;
  }
  onchange(modified) {
    if ( modified.size == 0 )
      return;
    for ( let [target, record] of modified )
      if ( record == "removed" )
        this.trigger("removed", target);
    for ( let [target, record] of modified )
      if ( record == "added" )
        this.trigger("added", target);
    for ( let [target, record] of modified )
      if ( typeof record == "object" )
        this.trigger("modified", target, {record});
    this.trigger("changed", this);
  }
  initialize(callback) {
    if ( this.changed )
      this.once("changed", this, callback);
    else
      callback();
  }

  record(target, properties) {
    var record = {};
    for ( let [property, getter] of Object.entries(properties) )
      record[property] = getter(target);
    return record;
  }
  differ(old_record, new_record) {
    var diff_record = {};
    for ( let property of Object.keys(old_record) )
      if ( !this.compare(old_record[property], new_record[property]) )
        diff_record[property] = old_record[property];
    return diff_record;
  }
  merge(record, new_record) {
    return Object.assign(new_record, record);
  }

  compare(old_value, new_value) {
    if ( !Array.isArray(old_value) || !Array.isArray(new_value) )
      return old_value === new_value;

    if ( old_value.length != new_value.length )
      return false;

    for ( let i=0; i<old_value.length; i++ )
      if ( !this.compare(old_value[i], new_value[i]) )
        return false;
    return true;
  }
}

/**
 * Fully functional spherical twisty puzzle.
 * It provide easy-to-use methods to edit, play and analyze this puzzle.  All
 * crucial algorithms should be implemented by analyzer, and management of objects
 * should be implemented by this class.
 * The management is composed by three parts: BREP, network and rule.  Each part
 * equips with event/observer system for maintaining objects, which is useful
 * for making GUI.
 *
 * "BREP" is implemented by `SphSeg`, `SphElem` and `SphTrack`, maintained by
 * `SphBREP`.  `SphElem` and `SphSeg` represent the shape of elements based on
 * boundaries, and it contains the information about adjacent relations.
 * `SphTrack` describes where is able to twist, and what angle is non-trivial.
 * This kind of representation is easy to manipulate, reshape and control
 * calculation error.
 *
 * "Network" is implemented by `SphKnot` and `SphJoint`, maintained by `SphNetwork`.
 * `SphKnot` describes a group of adjacent elements, and they are connected by
 * `SphJoint`, which describes a connected region.  They represent network structure
 * of this puzzle, and the properties `segments`, `joints` are parameters of
 * this puzzle, which depend on property `configuration`.  With aid of network
 * structure, more algorithms are available to manipulate this puzzle.
 *
 * "Rule" is implemented by `SphConfig` and `SphTransition`, maintained by
 * `SphRule`.  `SphConfig` records possible configuration of network with a
 * standard, unambiguous form, and `SphTransition` describes transitions between
 * those configurations.  They also contains the information about symmetries of
 * configurations and transitions, and provide a way to parameterize state of puzzle.
 *
 * @class
 * @property {SphAnalyzer} analyzer - All algorithms of this puzzle.
 * @property {SphBREP} brep - BREP of this puzzle.
 * @property {SphNetwork} network - network structure of this puzzle.
 * @property {SphRule} rule - rule of this puzzle.
 */
class SphPuzzle
{
  constructor(analyzer=new SphAnalyzer(), elements=[new SphElem()]) {
    this.status = "unprepared";
    this.analyzer = analyzer;

    this.brep = new SphBREP(analyzer);
    this.network = new SphNetwork(analyzer);
    this.rule = new SphRule(analyzer);
    this.brep.host = this.network.host = this.rule.host = this;

    this.brep.init(elements);
  }

  // adjust
  mergeVertex(seg) {
    if ( seg === seg.prev || !this.analyzer.isTrivialVertex(seg) )
      throw new Error("unable to merge segments");

    this.analyzer.mergePrev(seg);
    this.brep.remove(seg);

    this.brep.changed = true;
    this.brep.setStatus("unprepared");
    this.network.setStatus("broken");
    this.rule.setStatus("broken");
  }
  interpolate(seg, theta) {
    if ( this.analyzer.mod4(theta, [4, seg.arc]) >= seg.arc )
      throw new Error("out of range of interpolation");

    this.analyzer.interpolate(seg, theta);
    this.brep.add(seg.next);

    this.brep.changed = true;
    this.brep.setStatus("unprepared");
    this.network.setStatus("broken");
    this.rule.setStatus("broken");
  }
  mergeEdge(seg1, seg2) {
    if ( seg1.affiliation !== seg2.affiliation || !seg1.adj.has(seg2) )
      throw new Error("Unable to merge non-trivial edges!");

    var elem = seg1.affiliation;
    if ( seg1.track )
      this.brep.remove(seg1.track);
    var cover = this.analyzer.cover(seg1, seg2);
    console.assert(cover.length > 0);

    var old_boundaries = new Set(elem.boundaries);
    this.analyzer.glueAdj(cover);
    for ( let seg of old_boundaries ) if ( !elem.boundaries.has(seg) )
      this.brep.remove(seg);
    for ( let seg of elem.boundaries ) if ( !old_boundaries.has(seg) )
      this.brep.add(seg);

    this.brep.changed = true;
    this.brep.setStatus("unprepared");
    this.network.setStatus("broken");
    this.rule.setStatus("broken");
  }
  clean(level=2) {
    this.network.setStatus("broken");
    this.rule.setStatus("broken");

    if ( level >= 1 ) {
      // merge always-locking tracks
      for ( let track of this.brep.tracks.slice() ) if ( this.brep.tracks.includes(track) ) {
        let shields = {};
        shields.inner = this.analyzer.raiseShield(track.inner, level>=2);
        shields.outer = this.analyzer.raiseShield(track.outer, level>=2);
        let elements1 = Array.from(new Set(shields.inner.map(seg => seg.affiliation)));
        let elements2 = Array.from(new Set(shields.outer.map(seg => seg.affiliation)));

        let passwords = this.analyzer.decipher(track, shields);
        if ( passwords.size == 0 ) {
          this.mergeElements(...elements1);
          this.mergeElements(...elements2);

          let [segments, tracks] = this.analyzer.sealTrack(track);
          for ( let track of tracks )
            this.remove(track);
        }
      }

      // merge untwistable edges
      for ( let group of this.analyzer.twistablePartOf(this.brep.elements, level>=2) )
        if ( group.length > 1 )
          this.mergeElements(...group);

      // // merge sandglass tips
      // for ( let elem of this.brep.elements ) {
      //   let tips = this.analyzer.findSandglassTips(elem.boundaries);
      //   for ( let [seg1, seg2] of tips )
      //     this.analyzer.swap(seg1, seg2, 2, 2);
      // }
    }

    // merge trivial edges
    for ( let element of this.brep.elements ) {
      let zippers = [];
      let nontrivial = new Set(element.boundaries);
      for ( let seg of nontrivial ) {
        let subzippers = this.analyzer.findZippers(seg);
        for ( let [seg1,,,seg2,,] of subzippers ) {
          nontrivial.delete(seg1);
          nontrivial.delete(seg2);
          if ( seg1.track )
            this.brep.remove(seg1.track);
        }
        zippers.push(...subzippers);
      }

      if ( zippers.length ) {
        var old_boundaries = new Set(element.boundaries);
        this.analyzer.glueAdj(zippers);
        for ( let seg of old_boundaries ) if ( !element.boundaries.has(seg) )
          this.brep.remove(seg);
        for ( let seg of element.boundaries ) if ( !old_boundaries.has(seg) )
          this.brep.add(seg);
      }
    }

    // merge trivial vertices
    for ( let element of this.brep.elements )
      for ( let seg of element.boundaries )
        if ( seg !== seg.prev && this.analyzer.isTrivialVertex(seg) )
          this.mergeVertex(seg);

    this.brep.changed = true;
    this.brep.setStatus("unprepared");
  }

  // edit
  mergeElements(element0, ...elements) {
    if ( this.network.status != "broken" ) {
      let joint0 = this.network.jointsOf(element0, true).next().value;
      let joints = elements.map(elem => this.network.jointsOf(elem, true).next().value);

      this.alignJoint(joint0);
      for ( let joint of joints ) {
        this.alignJoint(joint);
        joint0.bind(joint);
      }
      this.network.changed = true;
    }

    element0.merge(...elements);
    for ( let element of elements )
      this.brep.remove(element);

    this.brep.changed = true;
    this.brep.setStatus("unprepared");
    this.rule.setStatus("broken");

    return element0;
  }
  unbandage(joint) {
    if ( this.network.status == "broken" )
      throw new Error("Unable to unbandage without network structure!");

    if ( joint.bandage.size == 1 )
      return;
    joint.unbind();

    var segs = Array.from(this.network.fly(joint))
                    .flatMap(seg => Array.from(seg.walk()));
    var elem = segs[0].affiliation;
    var [elem0] = elem.split(segs);
    this.brep.add(elem0);

    this.network.changed = true;
    this.brep.changed = true;
    this.brep.setStatus("unprepared");
    this.rule.setStatus("broken");

    return elem0;
  }
  trim(knot) {
    if ( this.network.status == "broken" )
      throw new Error("Unable to trim knot without network structure!");

    var joints = knot.joints.flat(2);
    if ( joints.length > 1 ) {
      // bind
      knot.align(knot.indexOf(joints[0]));
      for ( let joint of joints.slice(1) ) {
        knot.align(knot.indexOf(joint));
        joints[0].bind(joint);
      }

      // unfuse
      let fusible = [];
      for ( let joint of joints ) {
        joint.unfuse(knot);
        if ( joint.ports.size == 0 ) {
          joint.unbind();
          this.network.remove(joint);
        } else {
          fusible.push(joint);
        }
      }

      // fuse
      if ( fusible.length > 1 ) {
        for ( let joint of fusible.slice(1) ) {
          fusible[0].fuse(joint);
          this.network.remove(joint);
        }
      }
    }
    this.network.remove(knot);

    var elems = knot.segments.flat().map(seg => seg.affiliation);
    var segs = knot.segments.flat().flatMap(seg => Array.from(seg.walk()));
    var tracks = segs.map(seg => seg.track).filter(track => track);

    for ( let track of new Set(tracks) )
      this.brep.remove(track);

    // merge
    elems[0].merge(...elems.slice(1));
    for ( let elem of elems.slice(1) )
      this.brep.remove(elem);

    // withdraw
    elems[0].withdraw(...segs);
    for ( let seg of segs )
      this.brep.remove(seg);

    this.network.changed = true;
    this.brep.changed = true;
    this.brep.setStatus("unprepared");
    this.rule.setStatus("broken");
  }
  sliceElement(element, circle) {
    var [in_segs, out_segs, in_bd, out_bd] = this.analyzer.slice(element, circle);
    if ( in_segs.length && out_segs.length ) {
      this.network.setStatus("broken");
      this.rule.setStatus("broken");

      for ( let seg of element.boundaries )
        this.brep.add(seg);

      let [splitted] = element.split(out_segs);
      this.brep.add(splitted);

      let track;
      if ( in_bd[0] && !in_bd[0].track )
        if ( track = this.analyzer.buildTrack(in_bd[0]) )
          this.brep.add(track);

      this.brep.changed = true;
      this.brep.setStatus("unprepared");

      return [element, splitted];

    } else if ( in_segs.length ) {
      return [element, undefined];

    } else if ( out_segs.length ) {
      return [undefined, element];

    } else {
      throw new Error("unknown case");
    }
  }
  slice(center, radius) {
    center = normalize(center);
    var circle = new SphCircle({radius, orientation:q_align(center)});
    for ( let element of this.brep.elements.slice() )
      this.sliceElement(element, circle);

    for ( let seg of this.brep.segments ) {
      if ( this.analyzer.cmp(radius, seg.radius) == 0
           && this.analyzer.cmp(center, seg.circle.center) == 0 ) {
        if ( !seg.track )
          this.brep.add(this.analyzer.buildTrack(seg));
        return seg.track;
      }
    }
  }
  grab(point) {
    if ( this.network.status == "broken" )
      throw new Error("Unable to grab element of puzzle without network structure!");

    return this.analyzer.grab(this.network.knots[0], point);
  }

  // twist
  rotate(q) {
    for ( let elem of this.brep.elements )
      for ( let seg of elem.boundaries )
        seg.rotate(q);
    this.brep.changed = true;
  }
  twist(track, theta, hold) {
    var partition = this.analyzer.rotationsOfTwist([[track, theta]], hold);
    if ( !partition )
      throw new Error("Untwistable!");

    if ( this.network.status == "up-to-date" )
      this.network.setStatus("outdated");

    for ( let track_ of track.latches.keys() )
      this.brep.remove(track_);
    this.analyzer.twist([[track, theta]]);
    for ( let track_ of track.latches.keys() )
      this.brep.add(track_);

    for ( let region of partition ) if ( region.rotation[3] != 1 )
      for ( let elem of region.elements )
        for ( let seg of elem.boundaries )
          seg.rotate(region.rotation);

    for ( let track_ of track.latches.keys() )
      this.decipher(track_);

    this.brep.changed = true;

    return track;
  }
  decipher(track, level=1) {
    track.secret = {};

    var shields = {};
    shields.inner = this.analyzer.raiseShield(track.inner, level>=2);
    shields.outer = this.analyzer.raiseShield(track.outer, level>=2);
    track.secret.passwords = this.analyzer.decipher(track, shields);
    track.secret.passwords = new Map(Array.from(track.secret.passwords).sort((a,b) => a[0]-b[0]));
    track.secret.pseudokeys = this.analyzer.guessKeys(track);
    track.secret.pseudokeys = new Map(Array.from(track.secret.pseudokeys).sort((a,b) => a[0]-b[0]));

    track.secret.partition = {};
    track.secret.partition.inner = new Set(track.inner);
    for ( let seg0 of track.secret.partition.inner ) {
      for ( let seg of seg0.walk() )
        track.secret.partition.inner.add(seg);
      if ( !track.inner.includes(seg0) )
        for ( let seg of seg0.adj.keys() )
          track.secret.partition.inner.add(seg);
    }
    track.secret.partition.outer = new Set(track.outer);
    for ( let seg0 of track.secret.partition.outer ) {
      for ( let seg of seg0.walk() )
        track.secret.partition.outer.add(seg);
      if ( !track.outer.includes(seg0) )
        for ( let seg of seg0.adj.keys() )
          track.secret.partition.outer.add(seg);
    }

    var partition = this.analyzer.partitionBy(track.inner, track.outer);
    if ( partition.length == 2 ) {
      track.secret.regions = {};
      track.secret.regions.inner = partition.find(region => region.fences.has(track.inner)).elements;
      track.secret.regions.outer = partition.find(region => region.fences.has(track.outer)).elements;
    }

    return track.secret;
  }
  prepare() {
    for ( let track of this.brep.tracks )
      this.decipher(track);

    this.brep.setStatus("ready");
    this.brep.statuschanged = true;
  }

  // network
  alignJoint(joint) {
    var knot = joint.ports.keys().next().value;
    knot.align(knot.indexOf(joint));
    this.network.changed = true;
  }

  structurize() {
    if ( this.network.status != "broken" )
      return;
    var knots = this.analyzer.structurize(this.brep.elements);

    this.network.setStatus("outdated");
    this.network.init(knots);
  }
  recognize(make_trans=true) {
    if ( this.network.status == "broken" )
      throw new Error("Unable to recognize configuration without network structure!");

    if ( this.rule.status == "broken" )
      this.rule.clear();
    for ( let knot of this.network.knots ) {
      let configs = this.rule.configurations.get(knot) || [];
      let [config, perms] = this.analyzer.standardizeConfig(knot.model, knot.segments, configs);
      if ( make_trans && configs.includes(knot.configuration) )
        this.rule.add(knot, new SphTransition({from:knot.configuration, to:config, permutation:perms[0]}));
      this.network.transit(knot, perms[0], config);
      this.rule.add(knot, config);
    }
    this.network.setStatus("up-to-date");
    this.rule.setStatus("tracking");
  }
  assemble(seg0) {
    if ( this.network.status == "broken" )
      throw new Error("Unable to assemble puzzle without network structure!");

    seg0 = seg0 || this.network.knots[0].segments[0][0];
    var [knot0, index0] = this.network.indicesOf(seg0).next().value;
    var orientation0 = seg0.orientation.slice();

    for ( let track of this.brep.tracks.slice().reverse() )
      this.brep.remove(track);

    this.network.setStatus("up-to-date");
    this.analyzer.assemble(this.network.knots);
    this.analyzer.orient(knot0, index0, orientation0);

    for ( let seg of this.brep.segments )
      if ( seg.track )
        this.brep.add(seg.track);
    if ( this.brep.status == "ready" ) {
      for ( let track of this.brep.tracks )
        this.decipher(track);
    }

    this.brep.changed = true;
  }
  check() {
    console.assert(this.network.status == "up-to-date");

    var seg0 = this.network.knots[0].segments[0][0];
    var [knot0, index0] = this.network.indicesOf(seg0).next().value;
    var orientation0 = seg0.orientation.slice();

    this.analyzer.assemble(this.network.knots, false);
    this.analyzer.orient(knot0, index0, orientation0, false);
  }
  transit(knot, transition) {
    if ( this.network.status == "broken" )
      throw new Error("Unable to transit configuration without network structure!");
    if ( this.rule.status == "broken" )
      throw new Error("Unable to transit configuration without rule!");
    if ( transition.from !== knot.configuration )
      throw new Error("Wrong transition!");

    this.network.transit(knot, transition.permutation, transition.to);
    this.network.setStatus("up-to-date");
    this.rule.setStatus("tracking");
  }
}

/**
 * BREP of spherical twisty puzzle.
 * It contains information about elements in boundary representation, adjacent
 * relations between elements, and possible twistable parts of this puzzle.  The
 * adjacent relations help us to find possible twistable parts, which is used
 * for simulating this puzzle; that is advantage of BREP.
 *
 * Initially, the status is "unprepared", means this puzzle isn't ready to simulate
 * twist operations.  The status "ready" means the twist operations of this state
 * is fully analyzed.  In this status of "unprepared", all elements of this puzzle
 * should be contained in the property `elements`, and all boundaries of them
 * should be contained in the property `segments`.  Also, all possible tracks of
 * segments should be created and contained in the property `tracks`, and all
 * tracks should be decrypted in status "ready".
 *
 * The available events are:
 * `{ type:"statuschanged", target:this }`, triggered when puzzle is ready or
 * unprepared.
 * `{ type:"added"|"removed", target:SphSeg|SphElem|SphTrack }`, triggered after
 * adding/removing segment/element/track.
 * `{ type:"modified", target:SphSeg|SphElem|SphTrack, record:object }`,
 * triggered after modifying properties of segment/element/track.  `record` is
 * object of copies of old properties before modifying; only modified properties
 * will be recorded.
 * `{ type:"changed", target:this }`, triggered when something changed (after
 * triggering all others events).
 *
 * @class
 * @property {string} status - Status of puzzle:
 *   "ready" means it is ready to simulate twisting of puzzle;
 *   "unprepared" means there are broken secrets of tracks.
 * @property {SphAnalyzer} analyzer - All algorithms of this puzzle.
 * @property {SphSeg[]} segments - All segments of this puzzle.
 * @property {SphElem[]} elements - All elements of this puzzle.
 * @property {SphTrack[]} tracks - All tracks of this puzzle.
 */
class SphBREP extends Observable
{
  constructor(analyzer) {
    super();

    this.status = "unprepared";
    this.analyzer = analyzer;
    this.elements = [];
    this.segments = [];
    this.tracks = [];

    this.statuschanged = false;
    this.changed = false;

    this.SEG_PROP = {
      arc: seg => seg.arc,
      radius: seg => seg.radius,
      angle: seg => seg.angle,
      prev: seg => seg.prev,
      next: seg => seg.next,
      adj: seg => Array.from(seg.adj),
      track: seg => seg.track,
      affiliation: seg => seg.affiliation,
      orientation: seg => seg.orientation.slice()
    };
    this.ELEM_PROP = {
      boundaries: elem => Array.from(elem.boundaries)
    };
    this.TRACK_PROP = {
      shift: track => track.shift,
      inner: track => track.inner.slice(),
      outer: track => track.outer.slice(),
      latches: track => Array.from(track.latches)
        .map(([track_, latch]) => [track_, latch.center, latch.arc, latch.angle])
    };
  }

  setStatus(status) {
    if ( !["ready", "unprepared"].includes(status) )
      throw new Error("Wrong status!");
    if ( this.status != status ) {
      this.statuschanged = true;
      this.status = status;
    }
  }
  add(target) {
    if ( target instanceof SphElem ) {
      if ( this.elements.includes(target) )
        return;
      target.host = this;
      this.elements.push(target);
      this.changed = true;

    } else if ( target instanceof SphSeg ) {
      if ( this.segments.includes(target) )
        return;
      target.host = this;
      this.segments.push(target);
      this.changed = true;

    } else if ( target instanceof SphTrack ) {
      if ( this.tracks.includes(target) )
        return;
      target.host = this;
      this.tracks.push(target);
      this.changed = true;

    } else {
      throw new Error();
    }
  }
  remove(target) {
    if ( target instanceof SphElem ) {
      let i = this.elements.indexOf(target);
      if ( i == -1 )
        return;
      this.elements.splice(i, 1);
      this.changed = true;

    } else if ( target instanceof SphSeg ) {
      let i = this.segments.indexOf(target);
      if ( i == -1 )
        return;
      this.segments.splice(i, 1);
      this.changed = true;

    } else if ( target instanceof SphTrack ) {
      let i = this.tracks.indexOf(target);
      if ( i == -1 )
        return;
      this.tracks.splice(i, 1);
      this.changed = true;

    } else {
      throw new Error();
    }
  }
  clear() {
    for ( let element of this.elements.slice().reverse() )
      this.remove(element);
    for ( let track of this.tracks.slice().reverse() )
      this.remove(track);
    for ( let segment of this.segments.slice().reverse() )
      this.remove(segment);
  }
  init(elements) {
    this.clear();
    for ( let element of elements )
      for ( let segment of element.boundaries )
        this.add(segment);
    for ( let element of elements ) {
      this.add(element);
      for ( let seg of element.boundaries )
        if ( seg.track && !this.tracks.includes(seg.track) )
          this.add(seg.track);
    }
  }

  get observed() {
    var observed = new Map();
    for ( let target of this.segments )
      observed.set(target, this.SEG_PROP);
    for ( let target of this.elements )
      observed.set(target, this.ELEM_PROP);
    for ( let target of this.tracks )
      observed.set(target, this.TRACK_PROP);
    return observed;
  }
  onchange(modified) {
    if ( this.statuschanged ) {
      this.trigger("statuschanged", this);
      this.statuschanged = false;
    }

    if ( modified.size == 0 )
      return;
    for ( let [target, record] of modified )
      if ( target instanceof SphSeg && record == "removed" )
        this.trigger("removed", target);
    for ( let [target, record] of modified )
      if ( target instanceof SphSeg && record == "added" )
        this.trigger("added", target);
    for ( let [target, record] of modified )
      if ( target instanceof SphSeg && typeof record == "object" )
        this.trigger("modified", target, {record});

    for ( let [target, record] of modified )
      if ( target instanceof SphElem && record == "removed" )
        this.trigger("removed", target);
    for ( let [target, record] of modified )
      if ( target instanceof SphElem && record == "added" )
        this.trigger("added", target);
    for ( let [target, record] of modified )
      if ( target instanceof SphElem && typeof record == "object" )
        this.trigger("modified", target, {record});

    for ( let [target, record] of modified )
      if ( target instanceof SphTrack && record == "removed" )
        this.trigger("removed", target);
    for ( let [target, record] of modified )
      if ( target instanceof SphTrack && record == "added" )
        this.trigger("added", target);
    for ( let [target, record] of modified )
      if ( target instanceof SphTrack && typeof record == "object" )
        this.trigger("modified", target, {record});

    this.trigger("changed", this);
  }
}

/**
 * Network structure of puzzle.
 * It contains information about network structure, configuration and parameters
 * of segments; they are strongly correlated and hard to separate.  Network
 * structure describes the division of puzzle, which won't be changed after
 * twisting; configuration give a draft to construct sub-puzzle, but one still
 * need to know network to build whole puzzle; parameters of segments make bridge
 * between concrete objects and network structure, but it only makes sense under
 * a given configuration.
 *
 * Initially, the status is "broken", means network structure is different from
 * the objects `segments`.  In the status of "outdated" and "up-to-date", the
 * network structure of this puzzle should be analyzed and maintained in the
 * properties `knots` and `joints`. `joints` may contains trivial joint.  In the
 * status of "up-to-date", the configuration in all `knots` (described by
 * properties `segments` and `configuration`) should be consistent with adjacent
 * relations between objects `segments`, and `configuration` should in the
 * standard form.
 *
 * The available events are:
 * `{ type:"statuschanged", target:this }`, triggered when network structure is
 * broken, up-to-date or outdated.
 * `{ type:"added"|"removed", target:SphKnot|SphJoint }`, triggered after
 * adding/removing knot/joint.
 * `{ type:"modified", target:SphKnot|SphJoint, record:object }`, triggered after
 * modifying properties of knot/joint.  `record` is object of copies of old
 * properties before modifying; only modified properties will be recorded.
 * `{ type:"changed", target:this }`, triggered when something changed (after
 * triggering all others events).
 *
 * @class
 * @property {string} status - Status of network structure and configuration:
 *   "up-to-date" means network structure and configuration are up-to-date;
 *   "outdated" means configuration is outdated, but network structure is still
 *   valid; "broken" means network structure is outdated.
 * @property {SphAnalyzer} analyzer - All algorithms of this puzzle.
 * @property {SphKnot[]} knots - All knots of this network.
 * @property {SphJoint[]} joints - All joints of this network.
 */
class SphNetwork extends Observable
{
  constructor(analyzer) {
    super();

    this.status = "broken";
    this.analyzer = analyzer;
    this.knots = [];
    this.joints = [];

    this.statuschanged = false;
    this.changed = false;

    this.KNOT_PROP = {
      segments: knot => knot.segments.map(a => a.slice()),
      joints: knot => knot.joints.map(a => a.map(b => b.slice())),
      configuration: knot => knot.configuration
    };
    this.JOINT_PROP = {
      ports: joint => Array.from(joint.ports).map(([knot, q]) => [knot, q.slice()]),
      bandage: joint => Array.from(joint.bandage)
    };
  }

  setStatus(status) {
    if ( !["up-to-date", "outdated", "broken"].includes(status) )
      throw new Error("Wrong status!");
    if ( this.status != status ) {
      this.statuschanged = true;
      this.status = status;
    }
  }
  add(target) {
    if ( target instanceof SphKnot ) {
      if ( this.knots.includes(target) )
        return;
      target.host = this;
      this.knots.push(target);
      this.changed = true;

    } else if ( target instanceof SphJoint ) {
      if ( this.joints.includes(target) )
        return;
      target.host = this;
      this.joints.push(target);
      this.changed = true;

    } else {
      throw new Error();
    }
  }
  remove(target) {
    if ( target instanceof SphKnot ) {
      let i = this.knots.indexOf(target);
      if ( i == -1 )
        return;
      this.knots.splice(i, 1);
      this.changed = true;

    } else if ( target instanceof SphJoint ) {
      let i = this.joints.indexOf(target);
      if ( i == -1 )
        return;
      this.joints.splice(i, 1);
      this.changed = true;

    } else {
      throw new Error();
    }
  }
  clear() {
    for ( let joint of this.joints.slice().reverse() )
      this.remove(joint);

    for ( let knot of this.knots.slice().reverse() )
      this.remove(knot);
  }
  init(knots) {
    this.clear();
    for ( let knot of knots )
      this.add(knot);
    for ( let knot of knots )
      for ( let joint of knot.joints.flat(2) )
        if ( !this.joints.includes(joint) )
          this.add(joint);
  }

  get observed() {
    var observed = new Map();
    for ( let target of this.knots )
      observed.set(target, this.KNOT_PROP);
    for ( let target of this.joints )
      observed.set(target, this.JOINT_PROP);
    return observed;
  }
  onchange(modified) {
    if ( this.statuschanged ) {
      this.trigger("statuschanged", this);
      this.statuschanged = false;
    }

    if ( modified.size == 0 )
      return;
    for ( let [target, record] of modified )
      if ( target instanceof SphKnot && record == "removed" )
        this.trigger("removed", target);
    for ( let [target, record] of modified )
      if ( target instanceof SphKnot && record == "added" )
        this.trigger("added", target);
    for ( let [target, record] of modified )
      if ( target instanceof SphKnot && typeof record == "object" )
        this.trigger("modified", target, {record});

    for ( let [target, record] of modified )
      if ( target instanceof SphJoint && record == "removed" )
        this.trigger("removed", target);
    for ( let [target, record] of modified )
      if ( target instanceof SphJoint && record == "added" )
        this.trigger("added", target);
    for ( let [target, record] of modified )
      if ( target instanceof SphJoint && typeof record == "object" )
        this.trigger("modified", target, {record});

    this.trigger("changed", this);
  }

  *indicesOf(target) {
    var index;
    if ( target instanceof SphSeg ) {
      for ( let knot of this.knots )
        if ( index = knot.indexOf(target) ) {
          yield [knot, index];
          break;
        }

    } else if ( target instanceof SphJoint ) {
      for ( let knot of this.knots )
        if ( index = knot.indexOf(target) )
          yield [knot, index];

    } else if ( target instanceof SphElem ) {
      for ( let knot of this.knots )
        for ( let [[i,j,k,l], seg] of knot.model.items(knot.segments) )
          if ( k == 0 && l == 0 && seg.affiliation === target )
            yield [knot, [i, j]];

    } else if ( target instanceof SphTrack ) {
      for ( let knot of this.knots )
        for ( let seg0 of knot.segments.flat() )
          for ( let seg of seg0.walk() )
            if ( seg.track === target ) {
              yield [knot];
              return;
            }

    }
  }
  *jointsOf(target, make_if_absent=false) {
    if ( target instanceof SphSeg ) {
      let [knot, index] = this.indicesOf(target).next().value;

      let joint = knot.jointAt(index, false);
      if ( !joint && make_if_absent ) {
        joint = knot.jointAt(index, true);
        this.add(joint);
      }

      if ( joint )
        yield joint;

    } else if ( target instanceof SphElem ) {
      let joints = new Set();
      for ( let [knot, index] of this.indicesOf(target) ) {
        let joint = knot.jointAt(index, false);
        if ( !joint && make_if_absent ) {
          joint = knot.jointAt(index, true);
          this.add(joint);
        }

        if ( !joint || joints.has(joint) )
          continue;
        joints.add(joint);
        yield joint;
      }

    }
  }
  *fly(joint) {
    for ( let knot of joint.ports.keys() )
      yield knot.segmentAt(knot.indexOf(joint));
  }

  transit(knot, perm, config) {
    knot.joints = knot.model.reorder(knot.joints, perm);
    knot.segments = knot.model.reorder(knot.segments, perm);
    if ( config ) knot.configuration = config;
    this.changed = true;
  }
}

/**
 * Rule of simple spherical twisty puzzle.
 *
 * @class
 * @property {string} status - Status of rule of twisty puzzle:
 *   "tracking" means it is tracking the configurations of puzzle;
 *   "broken" means network structure is changed.
 * @property {SphAnalyzer} analyzer - All algorithms of this puzzle.
 * @property {Map<SphKnot,SphConfig[]>} configurations - All configurations of this
 *   network.
 * @property {Map<SphKnot,SphTransition[]>} transitions - All transitions of
 *   this network.
 */
class SphRule extends Observable
{
  constructor(analyzer) {
    super();

    this.status = "broken";
    this.analyzer = analyzer;
    this.configurations = new Map();
    this.transitions = new Map();

    this.statuschanged = false;
    this.changed = false;
  }

  setStatus(status) {
    if ( !["tracking", "broken"].includes(status) )
      throw new Error("Wrong status!");
    if ( this.status != status ) {
      this.statuschanged = true;
      this.status = status;
    }
  }
  add(knot, target) {
    if ( target instanceof SphConfig ) {
      if ( !this.configurations.has(knot) )
        this.configurations.set(knot, []);
      let configs = this.configurations.get(knot);
      if ( configs.includes(target) )
        return;

      for ( let i=0; i<configs.length; i++ ) {
        let sgn = this.analyzer.cmp(configs[i].adjacencies, target.adjacencies);
        if ( sgn > 0 ) {
          target.host = this;
          configs.splice(i, 0, target);
          this.changed = true;
          return;

        } else if ( sgn == 0 ) {
          throw new Error();
        }
      }

      target.host = this;
      configs.push(target);
      this.changed = true;

    } else if ( target instanceof SphTransition ) {
      if ( !this.transitions.has(knot) )
        this.transitions.set(knot, []);
      let transitions = this.transitions.get(knot);
      if ( transitions.includes(target) )
        return;

      target.host = this;
      transitions.push(target);
      this.changed = true;

    } else {
      throw new Error();
    }
  }
  remove(target) {
    if ( target instanceof SphConfig ) {
      let knot, config, i;
      for ( [knot, configs] of this.configurations )
        if ( (i = configs.indexOf(target)) != -1 )
          break;
      if ( i == -1 )
        return;
      configs.splice(i, 1);
      if ( configs.length == 0 )
        this.configurations.delete(knot);
      this.changed = true;

    } else if ( target instanceof SphTransition ) {
      let knot, transitions, i;
      for ( [knot, transitions] of this.transitions )
        if ( (i = transitions.indexOf(target)) != -1 )
          break;
      if ( i == -1 )
        return;
      transitions.splice(i, 1);
      if ( transitions.length == 0 )
        this.transitions.delete(knot);
      this.changed = true;

    } else {
      throw new Error();
    }
  }
  clear() {
    for ( let transitions of this.transitions.values() )
      for ( let transition of transitions.slice().reverse() )
        this.remove(transition);

    for ( let configs of this.configurations.values() )
      for ( let config of configs.slice().reverse() )
        this.remove(config);
  }
  init(knot, configs, transitions) {
    this.clear();
    for ( let config of configs )
      this.add(knot, config);
    for ( let transition of transitions )
      this.add(knot, transition);
  }

  get observed() {
    var observed = new Map();
    for ( let targets of this.configurations.values() )
      for ( let target of targets )
        observed.set(target, {});
    for ( let targets of this.transitions.values() )
      for ( let target of targets )
        observed.set(target, {});
    return observed;
  }
  onchange(modified) {
    if ( this.statuschanged ) {
      this.trigger("statuschanged", this);
      this.statuschanged = false;
    }

    if ( modified.size == 0 )
      return;
    for ( let [target, record] of modified )
      if ( target instanceof SphConfig && record == "removed" )
        this.trigger("removed", target);
    for ( let [target, record] of modified )
      if ( target instanceof SphConfig && record == "added" )
        this.trigger("added", target);
    for ( let [target, record] of modified )
      if ( target instanceof SphConfig && typeof record == "object" )
        this.trigger("modified", target, {record});

    for ( let [target, record] of modified )
      if ( target instanceof SphTransition && record == "removed" )
        this.trigger("removed", target);
    for ( let [target, record] of modified )
      if ( target instanceof SphTransition && record == "added" )
        this.trigger("added", target);
    for ( let [target, record] of modified )
      if ( target instanceof SphTransition && typeof record == "object" )
        this.trigger("modified", target, {record});

    this.trigger("changed", this);
  }

  knotOf(target) {
    if ( target instanceof SphConfig ) {
      for ( let [knot, configs] of this.configurations )
        if ( configs.includes(target) )
          return knot;

    } else if ( target instanceof SphTransition ) {
      for ( let [knot, transitions] of this.transitions )
        if ( transitions.includes(target) )
          return knot;

    }
  }
}
