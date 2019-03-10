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
 * Boundary segment (and its starting vertex) of element of sliding sphere.
 * It is fundamental piece of structure of BREP, and has information about
 * spherical arc, vertex, connection of segments, adjacency, etc.
 * 
 * @class
 * @property {number} arc - Spherical arc angle of segment, in the range of (0, 4].
 * @property {number} angle - Angle bewteen this segment and previous segment.
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
 *   range of (0, 4].
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

  rotate(q) {
    q_mul(q, this.orientation, this.orientation);
    return this;
  }
}

/**
 * Element of sliding sphere.
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

  rotate(q) {
    for ( let seg of this.boundaries )
      seg.rotate(q);
    return this;
  }
}

/**
 * Track of sliding sphere.
 * It represent the full circle of gap between elements, which is able to twist.
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
      this.inner.splice(i, 1);
      seg.track = undefined;
      if ( i == 0 )
        this.shift = this.shift - seg.arc;
      return;
    }

    i = this.outer.indexOf(seg);
    if ( i != -1 ) {
      this.outer.splice(i, 1);
      seg.track = undefined;
      if ( i == 0 )
        this.shift = this.shift - seg.arc;
      return;
    }
  }

  lock(track, latch, latch_) {
    this.latches.set(track, latch);
    track.latches.set(this, latch_);
  }
  unlock(track) {
    return this.latches.delete(track) || track.latches.delete(this);
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
   * @param {number[]} snaps - The values to snap.
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
   * @param {number[]} snaps - The values to snap.
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
    else if ( distance < radius1 + radius2 )
      return [...this.intersect(radius1, radius2, distance), 2]; // intersect
    else
      throw new Error(`unknown case: [${radius1}, ${radius2}, ${distance}]`);
  }
  /**
   * Compute intersection between two circles.
   * 
   * @param {number} radius1 - Radius of the first circle to intersect.
   * @param {number} radius2 - Radius of the second circle to intersect.
   * @param {number} distance - Distance between centers of two circles.
   * @returns {number[]} Information about intersection, which has values
   *   `[ang, arc1, arc2]` (see method {@link SphAnalyzer#relationTo}).
   */
  intersect(radius1, radius2, distance) {
    var a = radius2*Q;
    var b = radius1*Q;
    var c = distance*Q;

    // cosine rules for spherical triangle: cos a = cos b cos c + sin b sin c cos A
    var [ca, cb, cc] = [Math.cos(a), Math.cos(b), Math.cos(c)];
    var [sa, sb, sc] = [Math.sin(a), Math.sin(b), Math.sin(c)];
    var cA = (ca - cb*cc)/(sb*sc);
    var cB = (cb - cc*ca)/(sc*sa);
    var cC = (cc - ca*cb)/(sa*sb);

    var angle = Math.acos(cC)/Q;
    var arc1 = Math.acos(cA)*2/Q;
    var arc2 = Math.acos(cB)*2/Q;
    console.assert(!Number.isNaN(arc1) && arc1 > 0);
    console.assert(!Number.isNaN(arc2) && arc2 > 0);
    console.assert(!Number.isNaN(angle) && angle > 0);

    return [angle, arc1, arc2];
  }
  /**
   * Compute arc of leaf shape.
   * Given tip angle and radius of edges, compute spherical arc angle of edges.
   * 
   * @param {number} angle - Tip angle of leaf shape.
   * @param {number} radius1 - Radius of left edge of leaf shape.
   *   Center of curvature is at the right of edge.
   * @param {number} radius2 - Radius of right edge of leaf shape.
   *   Center of curvature is at the left of edge.
   * @returns {number[]} The arcs of left edge and right edge, which has values
   *   `[arc1, arc2]`.
   */
  leaf(angle, radius1, radius2) {
    var a = radius1*Q;
    var b = radius2*Q;
    var C = (2-angle)*Q;
  
    // cotangent rule for spherical triangle: cos b cos C = cot a sin b - cot A sin C
    var [ca, sa] = [Math.cos(a), Math.sin(a)];
    var [cb, sb] = [Math.cos(b), Math.sin(b)];
    var [cC, sC] = [Math.cos(C), Math.sin(C)];
    var [cA_, sA_] = [ca*sb-sa*cb*cC, sa*sC];
    var [cB_, sB_] = [cb*sa-sb*ca*cC, sb*sC];
  
    var arc2 = Math.atan2(sA_, cA_)*2/Q;
    var arc1 = Math.atan2(sB_, cB_)*2/Q;
    console.assert(!Number.isNaN(arc1) && arc1 > 0);
    console.assert(!Number.isNaN(arc2) && arc2 > 0);
  
    return [arc1, arc2];
  }
  /**
   * Find circle passing through three points.
   * The circle will pass through `v1, v2, v3` by order, and `v1` is located at
   * 0 with respect to orientation of circle.  If two are same, the smallest
   * circle passing through those points are returned.  Further, if they are
   * (nearly) opposite points or same points, the result may be broken.
   * 
   * @param {number[]} v1 - The first point.
   * @param {number[]} v2 - The second point. 
   * @param {number[]} v3 - The third point.
   * @returns {SphCircle} The circle passing through those points.
   */
  heart(v1, v2, v3) {
    var center;
    if ( this.cmp(angleTo(v1, v2)/Q, 0) == 0 ) {
      center = v1.map((x,i) => x+v3[i]);

    } else if ( this.cmp(angleTo(v2, v3)/Q, 0) == 0 ) {
      center = v1.map((x,i) => x+v2[i]);

    } else if ( this.cmp(angleTo(v3, v1)/Q, 0) == 0 ) {
      center = v1.map((x,i) => x+v2[i]);

    } else {
      let c1 = rotate([1,0,0], q_align(v1.map((x,i) => x+v2[i]), v2));
      let c2 = rotate([1,0,0], q_align(v3.map((x,i) => x+v2[i]), v2));
      let dis = angleTo(c1, c2)/Q;
      let [,arc,] = this.intersect(1, 1, dis);
      center = rotate([Math.cos(arc*Q/2), -Math.sin(arc*Q/2), 0], q_align(c1, c2));

    }

    var radius = angleTo(center, v1)/Q;
    var orientation = q_align(center, v1);
    console.assert(this.cmp(angleTo(center, v1)/Q, radius) == 0);
    console.assert(this.cmp(angleTo(center, v2)/Q, radius) == 0);
    console.assert(this.cmp(angleTo(center, v3)/Q, radius) == 0);
    return new SphCircle({radius, orientation});
  }

  /**
   * Walk through segment along boundaries of element.
   * It will stop before returning to the starting segment or has no next segment.
   * 
   * @param {SphSeg} seg0 - The starting segment.
   * @param {Array<number>=} compass - The orientation of starting segment, and
   *   as a buffer for derived orientation of segment after walking.
   * @yields {SphSeg} The segment walked through.  Its derived orientation will
   *   be set to buffer `compass`.
   * @returns {boolean} True if it return to the starting segment finally.
   */
  *walk(seg0, compass) {
    var seg = seg0;
    do {
      yield seg;
      seg = seg.next;

      if ( seg === undefined )
        return false;

      if ( compass ) {
        q_spin(compass, seg.prev.arc*Q, compass);
        let vertex = [Math.sin(seg.prev.radius*Q), 0, Math.cos(seg.prev.radius*Q)];
        rotate(vertex, compass, vertex);
        let phi = (seg.prev.radius-seg.radius)*Q;
        q_mul(compass, quaternion([0,1,0], phi), compass);
        let ang = (2-seg.angle)*Q;
        q_mul(quaternion(vertex, ang), compass, compass);
      }
    } while ( seg !== seg0 );
    return true;
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
      for ( let seg of this.walk(seg0) ) {
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
   * @param {number=} prefer - The prefer side when jumping to end point of segment.
   *   `+1` (default) means upper limit of offset; `-1` means lower limit of offset.
   * @param {Array<number>=} compass - The orientation of starting segment, and
   *   as a buffer for derived orientation of segment after jumping.
   * @returns {object[]} Segment and corresponding offset after jump: `[seg, theta]`,
   *   or empty array if no adjacent segment to jump.  The derived orientation
   *   of `seg` will be set to buffer `compass`.
   */
  jump(seg0, theta, prefer=+1, compass) {
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

      if ( compass ) {
        q_spin(compass, offset*Q, compass);
        q_mul(compass, [1,0,0,0], compass);
      }
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
   * @param {number=} offset - Offset of center respect to vertex of `seg0`,
   *   in the range of [0, `seg0.arc`).
   * @param {Array<number>=} compass - The orientation of starting segment, and
   *   as a buffer for derived orientation of segment after spinning.
   * @yields {object[]} Information when spinning to segment, which has value
   *   `[angle, seg, offset]`:
   *   `angle` is spinning angle with unit of quadrant, which will snap to 0, 2;
   *   `seg` is segment passing through center;
   *   `offset` is offset of center.
   *   The orientation of `seg` will be set to buffer `compass`.
   * @returns {boolean} True if it return to the first segment finally.
   */
  *spin(seg0, offset=0, compass) {
    var angle = 0, seg = seg0;
    if ( compass ) {
      var compass0 = compass.slice();
      var vertex0 = [Math.sin(seg0.radius*Q), 0, Math.cos(seg0.radius*Q)];
      rotate(vertex0, compass, vertex0);
    }

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

      if ( compass ) {
        let phi = (seg0.radius-seg.radius)*Q;
        q_mul(compass0, quaternion([0,1,0], phi), compass);
        q_mul(quaternion(vertex0, -angle*Q), compass, compass);
      }
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
   * @returns {Array=} Generated values if `gen` return true finally, or `undefined`.
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
   * splited segment will be in-place modified as the first part, and create new
   * object as the second part.
   * 
   * @param {number} seg - The segment to split.
   * @param {number} theta - The position to split.
   * @returns {SphSeg} The second part segment after splitting.
   */
  interpolate(seg, theta) {
    theta = this.mod4(theta, [4, seg.arc]);
    if ( theta >= seg.arc )
      throw new Error("out of range of interpolation");

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
    if ( seg === seg.prev || !this.isTrivialVertex(seg) )
      throw new Error("unable to merge segments");

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
    seg1.angle = seg2_ang + ang1;
    seg2.angle = seg1_ang + ang2;
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
    for ( let [seg1, seg2] of contacts ) {
      let seg1_ = seg1.next;
      let seg2_ = seg2.next;
      this.swap(seg1, seg2_, 4-seg2_.angle, seg2_.angle);
      this.swap(seg1_, seg2, seg1_.angle, 4-seg1_.angle);
      seg1.affiliation.withdraw(seg1);
      seg2.affiliation.withdraw(seg2);
    }
  }

  /**
   * Find meet point between this segment and circle.
   * They can meet at the start point of segment, but not at the end point of segment.
   * 
   * @param {SphSeg} segment - The segment to meet.
   * @param {SphCircle} circle - The circle to meet with.
   * @yields {object} Information about meet point, which has values
   *   `{angle, segment, offset, circle, theta}`.
   *   `angle` is angle from `circle` to `segment` at meet point (angle between
   *   two directed tangent vector), in the range of [-2, 2].
   *   `segment` is the segment that meets with circle;
   *   `offset` is offset of meet point along `segment`, in the range of
   *   [0, `segment.arc`);
   *   `circle` is the circle that segment meets with;
   *   `theta` is offset of meet point along `circle`.
   */
  *meetWith(segment, circle) {
    var circle_ = segment.circle;
    var [angle, arc, arc_, meeted] = this.relationTo(circle_, circle);
    var offset = 0, theta = 0;

    if ( meeted === undefined ) {
      theta = this.mod4(circle.thetaOf(segment.vertex));

      if ( angle == 0 ) angle = +0;
      if ( angle == 2 ) angle = -2;

      yield {angle, segment, offset, circle, theta};

    } else if ( meeted == 0 ) {
      return;

    } else if ( meeted == 1 ) {
      theta = this.mod4(circle.thetaOf(circle_.center)+arc_/2);
      offset = this.mod4(circle_.thetaOf(circle.center)-arc/2, [0, segment.arc]);

      if ( angle == 0 && arc == 4 ) angle = +0;
      if ( angle == 0 && arc == 0 ) angle = -0;
      if ( angle == 2 && arc == 4 ) angle = +2;
      if ( angle == 2 && arc == 0 ) angle = -2;

      if ( offset < segment.arc )
        yield {angle, segment, offset, circle, theta};

    } else if ( meeted == 2 ) {
      theta = this.mod4(circle.thetaOf(circle_.center)+arc_/2);
      offset = this.mod4(circle_.thetaOf(circle.center)-arc/2, [0, segment.arc]);
      let meet1 = {angle, segment, offset, circle, theta};

      theta = this.mod4(circle.thetaOf(circle_.center)-arc_/2);
      offset = this.mod4(circle_.thetaOf(circle.center)+arc/2, [0, segment.arc]);
      angle = -angle;
      let meet2 = {angle, segment, offset, circle, theta};

      if ( meet2.offset < meet1.offset )
        [meet1, meet2] = [meet2, meet1];
      if ( meet1.offset < segment.arc )
        yield meet1;
      if ( meet2.offset < segment.arc )
        yield meet2;

    }
  }
  /**
   * Sort and classify type of meets.
   * This function will add property `type` to meet.  Type has format "[+-][0+-]".
   * The first character is start side respect to circle: "+" means in circle;
   * "-" means out of circle.  The second character is direction of U-turn: "+"
   * means left U-turn; "-" means right U-turn; "0" means passing through circle.
   * Cross-meets have type "[+-]0", and touch-meets have type "[+-][+-]".
   * If two touch-meets has inclusion relation, properties `submeet`/`supermeet`
   * will be added to meet object.
   * 
   * @param {object[]} meets - The meets to sort.
   * @returns {object[]} Sorted meets.
   */
  sortMeets(meets) {
    // sort meets by `theta`
    var mmeets = [];
    var pos = [];
    for ( let meet of meets ) {
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

    // sort meets with same `theta`
    meets.splice(0, meets.length);
    for ( let mmeet of mmeets ) {
      // convert to beams: [angle, curvature, pseudo_index]
      var post_beams = mmeet.map(({angle, segment, offset}, index) =>
          [              angle,      1-segment.radius, +(index+1)]);
      var  pre_beams = mmeet.map(({angle, segment, offset}, index) =>
        offset == 0
        ? [segment.angle+angle, segment.prev.radius-1, -(index+1)]
        : [            2+angle,      segment.radius-1, -(index+1)]);
      var post_field = [0, 1-mmeet[0].circle.radius, +0];
      var  pre_field = [2, mmeet[0].circle.radius-1, -0];

      // mod angle into range [-2, 2] and deal with boundary case
      post_beams = post_beams.map(([ang, cur, i]) =>
        this.cmp([this.mod4(ang), cur, i], pre_field) <= 0
        ? [+this.mod4(+ang), cur, i] : [-this.mod4(-ang), cur, i]);
      pre_beams = pre_beams.map(([ang, cur, i]) =>
        this.cmp([this.mod4(ang), cur, i], pre_field) <= 0
        ? [+this.mod4(+ang), cur, i] : [-this.mod4(-ang), cur, i]);

      // separate as in and out of field
      var in_beams = [], out_beams = [];
      for ( let beams of [pre_beams, post_beams] ) for ( let beam of beams ) {
        if ( this.cmp(beam, post_field) >= 0 )
          in_beams.push(beam);
        else
          out_beams.push(beam);
      }
      in_beams.sort(this.cmp.bind(this));
      out_beams.sort(this.cmp.bind(this));
      in_beams = in_beams.map(e => e[2]);
      out_beams = out_beams.map(e => e[2]);

      // parse structure
      const types = {
        [[+1,-1]]: "+-", [[+1,0]]: "+0", [[+1,+1]]: "++",
        [[-1,-1]]: "--", [[-1,0]]: "-0", [[-1,+1]]: "-+"
      };
      function parseTouch(beams, start, end, meet, side, side_) {
        meet.type = types[[side_, side]];
        meet.submeets = [];

        var subside = -side;
        for ( let i=start+1; i<=end-1; i++ ) {
          console.assert(Math.sign(beams[i]) == subside);
          let submeet = mmeet[Math.abs(beams[i])-1];

          let j = beams.indexOf(-beams[i]);
          console.assert(j != -1 && j > i && j <= end-1);
          parseTouch(beams, i, j, submeet, subside, side_);
          submeet.supermeet = meet;
          meet.submeets.push(submeet);
          i = j;
        }
      }

      var in_parsed = [], out_parsed = [];
      for ( let [beams, parsed, side_] of [[ in_beams,  in_parsed, +1],
                                           [out_beams, out_parsed, -1]] ) {
        let side = Math.sign(beams[0]);
        for ( let i=0; i<beams.length; i++ ) {
          console.assert(Math.sign(beams[i]) == side);
          let meet = mmeet[Math.abs(beams[i])-1];
          let j = beams.indexOf(-beams[i]);

          if ( j == -1 ) {
            console.assert(!meet.type || meet.type == types[[-side*side_,0]]);
            meet.type = types[[-side*side_,0]];
            parsed.push(meet);
            side = -side;

          } else {
            console.assert(j > i);
            parseTouch(beams, i, j, meet, side, side_);
            parsed.push(meet);
            i = j;
          }
        }
      }

      // merge parsed
      in_parsed.reverse();
      while ( true ) {
        let  in_i =  in_parsed.findIndex(meet => meet.type[1] == "0");
        let out_i = out_parsed.findIndex(meet => meet.type[1] == "0");

        if ( in_i != -1 ) {
          console.assert(in_parsed[in_i] === out_parsed[out_i]);
          meets.push(...in_parsed.splice(0, in_i));
          meets.push(...out_parsed.splice(0, out_i));
          let meet = in_parsed.shift();
          out_parsed.shift();
          meets.push(meet);

        } else {
          console.assert(out_i == -1);
          meets.push(...in_parsed);
          meets.push(...out_parsed);
          break;
        }
      }
    }

    return meets;
  }
  /**
   * Check if point is inside given region (not including boundaries).
   * 
   * @param {SphSeg[]} boundaries - The boundaries of the region.
   * @param {number[]} point - The point to check.
   * @returns {boolean} True if point is in this element.
   */
  contains(boundaries, point) {
    if ( boundaries.size == 0 )
      return true;

    // make a circle passing through this point and a vertex of element
    var vertex = boundaries.values().next().value.vertex;
    var radius = angleTo(point, vertex)/2/Q;
    if ( this.cmp(radius, 0) == 0 )
      return false;

    var orientation = q_mul(q_align(vertex, point), quaternion([0,1,0], radius*Q));
    var circle = new SphCircle({orientation, radius});

    var meets = Array.from(boundaries)
                     .flatMap(seg => Array.from(this.meetWith(seg, circle)));
    console.assert(meets.length > 0);
    meets = this.sortMeets(meets);
    if ( meets.find(meet => this.mod4(meet.theta, [0]) == 0) )
      return false;
    else
      return ["-0", "+-", "--"].includes(meets[0].type);
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
    for ( let loop of this.loops(elem.boundaries) )
      paths.push(loop.flatMap(seg => Array.from(this.meetWith(seg, circle))));
    var meets = this.sortMeets(paths.flatMap(path => path));

    // interpolate
    for ( let path of paths ) for ( let meet of path.slice(0).reverse() )
      if ( meet.type[1] == "0" && meet.offset != 0 ) {
        meet.segment = this.interpolate(meet.segment, meet.offset);
        meet.offset = 0;
      }

    // bipartite
    var in_segs = new Set(), out_segs = new Set();
    var lost = new Set(elem.boundaries);
    for ( let path of paths ) for ( let i=0; i<path.length; i++ ) {
      let meet1 = path[i];
      let meet2 = path[i+1] || path[0];

      let side = ["-0", "++", "+-"].includes(meet1.type);
      console.assert(side == ["+0", "++", "+-"].includes(meet2.type));
      let segs = side ? in_segs : out_segs;

      for ( let seg of this.walk(meet1.segment) ) {
        if ( seg === meet2.segment )
          break;
        segs.add(seg);
        lost.delete(seg);
      }
    }

    for ( let seg0 of lost ) {
      let side = this.cmp(circle.radius, angleTo(circle.center, seg0.vertex)/Q) > 0;
      let segs = side ? in_segs : out_segs;

      for ( let seg of this.walk(seg0) ) {
        segs.add(seg);
        lost.delete(seg);
      }
    }

    // SLICE
    var in_bd = [], out_bd = [];
    var dash = meets.filter(meet => meet.type[1] == "0");
    if ( dash.length != 0 ) {
      if ( dash[0].type != "+0" ) {
        let meet = dash.shift();
        meet.theta = meet.theta + 4;
        dash.push(meet);
      }
      console.assert(dash.length % 2 == 0
        && dash.every(({type},i) => i%2==0 ? type[0]=="+" : type[0]=="-"));

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
          in_segs.add(in_seg);
          out_segs.add(out_seg);
        }
      }

    } else {
      // no cross meet
      let inside;
      if ( meets.find(({type}) => type[1] == "+") )
        inside = false;
      if ( inside === undefined && meets.find(({type}) => type[1] == "-") )
        inside = true;
      if ( inside === undefined )
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
        in_segs.add(in_seg);
        out_segs.add(out_seg);
      }
    }

    in_segs = Array.from(in_segs);
    out_segs = Array.from(out_segs);
    return [in_segs, out_segs, in_bd, out_bd];
  }

  /**
   * Check geometry of segment, include arc, angle, radius.
   * 
   * @param {SphSeg} seg - The segment to check.
   */
  checkGeometry(seg) {
    console.assert(this.cmp(seg.arc, 0) > 0 && this.cmp(seg.arc, 4) <= 0);
    console.assert(this.cmp(seg.radius, 0) > 0 && this.cmp(seg.radius, 2) < 0);
    console.assert(this.cmp(seg.angle, 0) >= 0 && this.cmp(seg.radius, 4) <= 0);
    if ( this.cmp(seg.angle, 0) == 0 )
      console.assert(this.cmp(seg.radius, 2-seg.prev.radius) >  0);
    if ( this.cmp(seg.angle, 4) == 0 )
      console.assert(this.cmp(seg.radius, 2-seg.prev.radius) <= 0);
  }
  /**
   * Check orientation of connected segments in puzzle.
   * 
   * @param {SphElem[]} elements - The elements to check.
   */
  checkOrientation(elements) {
    for ( let elem of elements ) for ( let loop of this.loops(elem.boundaries) ) {
      var compass = loop[0].orientation.slice();
      for ( let seg of this.walk(loop[0], compass) ) {
        console.assert(this.cmp(compass, seg.orientation) == 0
                       || this.cmp(compass, seg.orientation.map(x => -x)) == 0);

        for ( let [adj_seg, offset] of seg.adj ) {
          let adj_compass = seg.orientation.slice();
          this.jump(seg, offset, -1, adj_compass);
          console.assert(this.cmp(adj_compass, adj_seg.orientation) == 0
                         || this.cmp(adj_compass, adj_seg.orientation.map(x => -x)) == 0);
        }
      }
      console.assert(this.cmp(compass, loop[0].orientation) == 0
                     || this.cmp(compass, loop[0].orientation.map(x => -x)) == 0);
    }
  }
  /**
   * Check if segment is twistable; element should has no meet with extended
   * circles.
   * 
   * @param {SphSeg} seg0 - The segment to test.
   * @param {SphSeg[]} fixed - The fixed segments.
   * @returns {boolean} True if `seg0` is twistable.
   */
  isTwistable(seg0, fixed=seg0.affiliation.boundaries) {
    if ( this.cmp(seg0.angle, 2) > 0 )
      return false;
    if ( this.cmp(seg0.next.angle, 2) > 0 )
      return false;
    if ( this.cmp(seg0.angle, 2) == 0 && this.cmp(seg0.radius, seg0.prev.radius) < 0 )
      return false;
    if ( this.cmp(seg0.next.angle, 2) == 0 && this.cmp(seg0.radius, seg0.next.radius) < 0 )
      return false;
    if ( Array.from(seg0.adj.keys()).some(seg => seg.affiliation === seg0.affiliation) )
      return false;
  
    var circle = seg0.circle;
    var side = undefined;
    for ( let loop of this.loops(fixed) ) {
      let meets = Array.from(loop).flatMap(seg => Array.from(this.meetWith(seg, circle)));
      meets = this.sortMeets(meets);
      if ( meets.length == 0 )
        continue;
    
      if ( meets.find(({type}) => type[1] == "0" || type[1] == "-") )
        return false;

      let side_ = meets[0].type[0];
      console.assert(meets.every(({type}) => type[0] == side_));
      if ( side_ != (side || (side = side_)) )
        return false;
    }

    return true;
  }
  /**
   * Find twistable part of given elements.
   * 
   * @param {SphElem[]} elements
   * @returns {SphElem[][]} Set of twistable Elements.
   */
  twistablePartOf(elements) {
    elements = Array.from(elements);
    var segments = elements.flatMap(elem => Array.from(elem.boundaries));
    var untwistable = new Set();

    var i = 0;
    do {
      for ( i=0; i<segments.length; i++ ) {
        if ( untwistable.has(segments[i]) )
          continue;

        let fixed = new Set(segments[i].affiliation.boundaries);
        for ( let seg of fixed )
          if ( untwistable.has(seg) )
            for ( let adj_seg of seg.adj.keys() )
              if ( elements.includes(adj_seg.affiliation) )
                for ( let seg_ of adj_seg.affiliation.boundaries )
                  fixed.add(seg_);

        if ( !this.isTwistable(segments[i], fixed) ) {
          let new_untwistable = new Set([segments[i]]);
          for ( let unseg of new_untwistable )
            for ( let adj_seg of unseg.adj.keys() )
              if ( elements.includes(adj_seg.affiliation) )
                new_untwistable.add(adj_seg);
          for ( let unseg of new_untwistable )
            untwistable.add(unseg);
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
   * Find profile of given segments.
   * Profile are loops of segments that are adjacent to exposed part of given segments.
   * 
   * @param {SphSeg[]} segments
   * @returns {SphSeg[]} Profile of segments.
   */
  findProfile(segments) {
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
   * Parse structure of connected network and joint elements of given segments.
   * ```
   * network = {
   *   loops: [loop, ...],
   *   profile: [loop, ...],
   *   joints: [joint, ...],
   * },
   * joint = {
   *   networks: [network, ...],
   *   loops: [loop, ...],
   *   side: +1/-1,
   * },
   * ```
   * 
   * @param {SphSeg[]} segments
   * @returns {object} Networks.
   */
  parseNetworks(segments) {
  
    // find all connected networks
    var networks = [];
    var lost = new Set(segments);
    while ( lost.size ) {
      let network = {loops:[], profile:[], joints:[]};
  
      let queue = new Set([lost.values().next().value]);
      for ( let seg0 of queue ) {
        let loop = this.full(this.walk(seg0));
        console.assert(loop);
        network.loops.push(loop);
  
        for ( let seg of loop ) {
          console.assert(lost.has(seg));
          lost.delete(seg);
          queue.delete(seg);
          for ( let adj_seg of seg.adj.keys() )
            if ( lost.has(adj_seg) )
              queue.add(adj_seg);
        }
      }
  
      let profile = this.findProfile(network.loops.flatMap(loop => loop));
      network.profile = Array.from(this.loops(profile));
  
      networks.push(network);
    }
  
    // determine relation between networks
    var vertex0 = networks[0].loops[0][0].vertex;
    var locals = new Set(networks.slice(1));
    for ( let network of locals ) {
      // build circle pass through multiple networks
      // (start from the vertex0 in first network)
      let vertex = network.loops[0][0].vertex;
      let radius = 1;
      let orientation = q_mul(q_align(vertex0, vertex), [-0.5, -0.5, -0.5, 0.5]);
      let circle = new SphCircle({orientation, radius});
  
      // find and sort meets
      let meets = [];
      for ( let network of networks )
        for ( let [loops, side] of [[network.loops, +1], [network.profile, -1]] )
          for ( let loop of loops ) for ( let seg of loop )
            for ( let meet of this.meetWith(seg, circle) ) {
              meet.network = network;
              meet.loop = loop;
              meet.side = side;
              meets.push(meet);
            }
      meets = this.sortMeets(meets);
      while ( meets[0].network !== networks[0] )
        meets.push(meets.shift());
  
      // build joints
      for ( let i=0; i<meets.length; i++ )
        if ( ["+0", "+-", "--"].includes(meets[i].type) ) {
          let meet1 = meets[i];
          let meet2 = meets[i+1] || meets[0];
          console.assert(["-0", "+-", "--"].includes(meet2.type));
          console.assert(meet1.side == meet2.side);
          if ( meet1.network === meet2.network ) {
            console.assert(meet1.loop === meet2.loop);
            continue;
          }
  
          // connect networks
          let joint1 = meet1.network.joints.find(joint => joint.loops.includes(meet1.loop));
          let joint2 = meet2.network.joints.find(joint => joint.loops.includes(meet2.loop));
          console.assert(joint1&&joint2 ? joint1===joint2 : true);
  
          let joint = joint1 || joint2 || {networks:[], loops:[], side:meet1.side};
          if ( !joint.loops.includes(meet1.loop) ) {
            joint.networks.push(meet1.network);
            joint.loops.push(meet1.loop);
            locals.delete(meet1.network);
          }
          if ( !joint.loops.includes(meet2.loop) ) {
            joint.networks.push(meet2.network);
            joint.loops.push(meet2.loop);
            locals.delete(meet2.network);
          }
          if ( !meet1.network.joints.includes(joint) )
            meet1.network.joints.push(joint);
          if ( !meet2.network.joints.includes(joint) )
            meet2.network.joints.push(joint);
        }
    }
  
    return networks;
  }
  /**
   * find joint part of given segments.
   * 
   * @param {SphSeg[]} segments
   * @returns {SphSeg[][]} Set of joint Segments.
   */
  jointPartOf(segments) {
    var networks = this.parseNetworks(segments);
  
    // separate connected part
    var joints = new Set(networks.flatMap(network => network.joints)
                                 .filter(joint => joint.side > 0));
    var loops = new Set(networks.flatMap(network => network.loops));
    for ( let joint of joints ) for ( let loop of joint.loops )
      loops.delete(loop);
    var res = [];
    for ( let joint of joints )
      res.push(joint.loops.flatMap(loop => loop));
    for ( let loop of loops )
      res.push(loop);
    return res;
  }

  /**
   * Lock tracks.
   * 
   * @param {SphTrack} track - The first track to lock.
   * @param {SphTrack} track_ - The second track to lock.
   */
  lock(track, track_) {
    var circle = track.circle;
    var circle_ = track_.circle;
    var center = this.mod4(circle.thetaOf(circle_.center));
    var center_ = this.mod4(circle_.thetaOf(circle.center));
    var [ang, arc, arc_, meeted] = this.relationTo(circle, circle_);
    if ( meeted != 2 )
      return;
    var latch = {center:center, angle:ang, arc:arc};
    var latch_ = {center:center_, angle:ang, arc:arc_};
    track.lock(track_, latch, latch_);
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
          if ( inter_seg.track && !track.latches.has(inter_seg.track) )
            this.lock(track, inter_seg.track);

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
   * Twist along tracks by given angles.
   * 
   * @param {Map<SphTrack,number>} op - The map that tell you which track should
   *   twist by what angle.
   * @param {SphElem=} hold - The element whose orientation should be fixed.
   */
  twist(op, hold) {
    op = new Map(op);

    // unlock
    for ( let track of op.keys() )
      for ( let track_ of track.latches.keys() )
        track_.tearDown();

    // twist
    var tracks = Array.from(op.keys());
    var partition = this.partitionBy(...tracks.flatMap(track => [track.inner, track.outer]));
    var region0 = partition.find(g => g.elements.has(hold)) || partition[0];
    region0.rotation = [0,0,0,1];
    var rotated = new Set([region0]);

    for ( let region of rotated ) for ( let bd of region.fences ) {
      let track = tracks.find(track => track.inner===bd || track.outer===bd);
      let dual_bd = track.inner===bd ? track.outer : track.inner;
      let adj_region = partition.find(g => g.fences.has(dual_bd));

      let theta = op.get(track);
      let rotation = quaternion(bd[0].circle.center, -theta*Q);
      q_mul(region.rotation, rotation, rotation);

      if ( !rotated.has(adj_region) ) {
        adj_region.rotation = rotation;
        rotated.add(adj_region);
      }
      console.assert(this.cmp(adj_region.rotation, rotation) == 0);
    }

    for ( let region of partition )
      for ( let elem of region.elements )
        elem.rotate(region.rotation);
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
            if ( !inter_seg.track ) this.buildTrack(inter_seg);
  }

  /**
   * Make tick at end point of segment.
   * Tick is diverged segments at end point of segment, which may form another
   * intersected track.
   * 
   * @param {SphSeg} prev_seg
   * @returns {object} Tick at `prev_seg.next.vertex`, which has value
   *   `{segment, subticks, is_free}`, and `subticks = [{angle, segment}, ...]`:
   *   `segment` is next segment along extending circle of this segment;
   *   `subtick.angle` is rolling angle;
   *   `subtick.segment` is segment of subtick, which has vertex at tick center;
   *   `is_free` indicate subticks are free or not.
   */
  makeTick(prev_seg) {
    var [ang1, seg1] = [prev_seg.next.angle, prev_seg.next];
    var subticks = [], pre = [], post = [];
    var angle, segment, offset;
    for ( [angle, segment, offset] of this.spin(seg1) ) {
      angle = this.snap(angle+ang1, [0, 2, 4]);
      let sgn = this.cmp([angle, segment.radius-1], [2, prev_seg.radius-1]);
      if ( sgn == 0 ) break;
      if ( sgn >  0 ) return {};
  
      if ( angle == 0 )
        pre.push(segment);
      else if ( angle == 2 )
        post.push(segment);
      else
        subticks.push({angle, segment});
    }
  
    var is_free = false;
    for ( let seg1 of pre )
      if ( post.find(seg2 => this.cmp(2-seg1.radius, seg2.radius) == 0) ) {
        is_free = true;
        break;
      }
  
    return {segment, subticks, is_free};
  }
  /**
   * Detect latches by given ticks.
   * Latch is potential to form intersected track at one side of this track.
   * 
   * @param {object[]} ticks
   * @returns {object[]} Array of latches, which has entries
   *   `{arc, center, angle}` or `{arc, center}` (free latch):
   *   `arc` is arc of shadow under circle of latch;
   *   `center` is center of latch;
   *   `angle` is angle between latch and this track.
   */
  detectLatches(ticks) {
    var latches = [];
  
    var radius0 = ticks[0].segment.radius;
    var full_arc = ticks.reduce((acc, tick) => (tick.theta=acc)+tick.segment.arc, 0);
    console.assert(this.cmp(full_arc, 4) == 0);

    var centers = new Set();

    for ( let tick of ticks ) {
      if ( tick.is_free ) { // find free latches
        for ( let tick_ of ticks ) if ( tick_.is_free ) {
          let arc = this.mod4(tick.theta - tick_.theta, [2]);

          if ( arc <= 2 ) {
            let center = this.mod4(tick_.theta+arc/2, centers);
            centers.add(center);
            latches.push({arc, center});
          }
        }

      } else { // find fixed latches
        for ( let sub of tick.subticks ) {
          let [arc] = this.leaf(sub.angle, radius0, sub.segment.radius);

          if ( this.cmp([arc, sub.segment.radius], [2, 1]) <= 0 ) {
            let tick_ = ticks.find(({theta}) => this.mod4(tick.theta-theta, [arc])==arc);
            if ( !tick_ )
              continue;
            let is_dual = sub_ => this.cmp([sub_.angle, sub_.segment.radius],
                                           [2-sub.angle, 2-sub.segment.radius]) == 0;
            if ( !tick_.is_free && !tick_.subticks.find(is_dual) )
              continue;

            let center = this.mod4(tick_.theta+arc/2, centers);
            centers.add(center);
            arc = this.snap(arc, [2]);
            let angle = sub.angle;
            latches.push({arc, center, angle});
          }
        }

      }
    }
  
    return latches;
  }
  /**
   * Detect non-trivial twist angle of track.
   * 
   * @param {SphTrack} track
   * @returns {Map<number,object[]>} Map from shift to matched latches.
   */
  decipher(track) {
    var ticks1 = [], ticks2 = [];
    for ( let [segs, ticks] of [[track.inner, ticks1], [track.outer, ticks2]] ) {
      for ( let i=0; i<segs.length; i++ ) {
        let seg = segs[i-1] || segs[segs.length-1];
        let tick = this.makeTick(seg);
        console.assert(tick && tick.segment === segs[i]);
        ticks.push(tick);
      }
    }
  
    var latches1 = this.detectLatches(ticks1);
    var latches2 = this.detectLatches(ticks2);
  
    var passwords = new Map();
    for ( let latch2 of latches2 ) for ( let latch1 of latches1 ) {
      if ( this.cmp(latch1.arc, latch2.arc) != 0 )
        continue;
      if ( latch1.angle && latch2.angle )
        if ( this.cmp(latch1.angle, 2-latch2.angle) != 0 )
          continue;

      let key = this.mod4(latch1.center+latch2.center, passwords.keys());
      if ( !passwords.has(key) )
        passwords.set(key, []);

      if ( !latch1.angle && latch2.angle )
        latch1 = Object.assign({angle:2-latch2.angle}, latch1);
      passwords.get(key).push(latch1);
    }
  
    return passwords;
  }

  /**
   * Determine configuration of sliding sphere.
   * 
   * @param {SphSeg[][]} loops - Loops of segments which form a connected network.
   * @returns {Array} Configuration and parameters of given state.
   */
  configOf(loops) {
    var config = new SphConfig();
    var param = [];

    // build types
    for ( let loop of loops ) {
      let keys = loop.map(({arc, radius, angle}) => [arc, radius, angle]);
      // fix rotation
      let keys0 = keys.slice();
      let offsets = [];
      for ( let i=0,len=keys.length; i<len; i++ ) {
        switch ( this.cmp(keys, keys0) ) {
          case 0:
            offsets.push(i);
            break;

          case -1:
            keys0 = keys.slice();
            offsets = [i];
            break;
        }
        keys.push(keys.shift());
      }

      // make patch
      let patch = keys0.slice(0, (offsets[1]-offsets[0]) || keys0.length);
      let fold = keys0.length == 1 ? 0 : keys0.length / patch.length;
      console.assert(Number.isInteger(fold));
      console.assert(offsets.every((i, n) => i == offsets[0]+patch.length*n));

      // determine type
      let ind_type, sgn = -1;
      for ( ind_type=0; ind_type<config.types.length; ind_type++ ) {
        sgn = this.cmp(config.types[ind_type].patch, patch);
        if ( sgn == 0 || sgn > 0 )
          break;
      }
      let type, ind_loop;
      if ( sgn == 0 ) {
        type = config.types[ind_type];
        ind_loop = type.count;
        type.count++;
      } else {
        ind_loop = 0;
        type = {count:1, fold, patch};
        if ( fold == 0 )
          type.center = rotate([0,0,1], loop[offsets[0]].orientation);
        else if ( fold > 1 )
          type.center = normalize(q_mul(loop[offsets[1]].orientation,
                                        q_inv(loop[offsets[0]].orientation)));
        config.types.splice(ind_type, 0, type);
        param.splice(ind_type, 0, []);
      }

      param[ind_type].push(loop[offsets[0]]);
    }

    // determine indices of segments
    const INDEX = Symbol("index");
    for ( let ind_type=0; ind_type<param.length; ind_type++ )
      for ( let ind_loop=0; ind_loop<param[ind_type].length; ind_loop++ ) {
        if ( config.types[ind_type].fold == 0 ) {
          param[ind_type][ind_loop][INDEX] = [ind_type, ind_loop, 0, 0];

        } else {
          let len = config.types[ind_type].patch.length;
          let n = 0;
          for ( let seg of this.walk(param[ind_type][ind_loop]) ) {
            let ind_num = n % len;
            let ind_rot = (n - ind_num) / len;
            seg[INDEX] = [ind_type, ind_loop, ind_rot, ind_num];
            n++;
          }
          console.assert(n == len*config.types[ind_type].fold);

        }
      }

    // build adjacencies
    for ( let loop of loops )
      for ( let seg1 of loop )
        for ( let [seg2, offset] of seg1.adj )
          if ( seg2[INDEX] && this.cmp(seg1[INDEX], seg2[INDEX]) < 0 )
            config.adjacencies.push([seg1[INDEX], seg2[INDEX], offset]);

    for ( let loop of loops )
      for ( let seg of loop )
        delete seg[INDEX];

    return [config, param];
  }
  /**
   * Rebuild segments from given configuration.
   * 
   * @param {SphConfig} config - The draft for build.
   * @param {number[]} index0 - The index of fixed segment.
   * @param {number[]} orientation0 - The fixed orientation.
   * @returns {SphSeg[][]} Parameters of building with respect to `config`.
   */
  assemble(config, index0=[0,0], orientation0=[0,0,0,1]) {
    // build segments
    var param = config.types.map(() => []);
    for ( let i=0; i<config.types.length; i++ ) {
      let {count, fold, patch} = config.types[i];
      let N = fold == 0 ? 1 : fold;

      for ( let j=0; j<count; j++ ) {
        let loop;
        let elem = new SphElem();
        for ( let k=0; k<N; k++ ) for ( let l=0; l<patch.length; l++ ) {
          let [arc, radius, angle] = patch[l];
          let seg = new SphSeg({arc, radius, angle});
          loop.push(seg);
          elem.accept(seg);
        }
        loop.reduce((seg1, seg2) => (seg1.connect(seg2), seg2), loop[loop.length-1]);

        param[i][j] = loop[0];
      }
    }

    // set adjacencies
    for ( let [index1, index2, offset] of config.adjacencies ) {
      let seg1 = config.get(param, index1);
      let seg2 = config.get(param, index2);
      seg1.adjacent(seg2, offset);
    }

    // fix orientation
    var seg0 = config.get(param, index0);
    seg0.orientation = orientation0;
    var located = new Set([seg0]);

    for ( let seg of located ) {
      let compass = seg.orientation.slice();
      let walker = this.walk(seg, compass);
      walker.next(); walker.next();

      if ( !seg.next.orientation )
        seg.next.orientation = compass;
      console.assert(this.cmp(seg.next.orientation, compass) == 0
                     || this.cmp(seg.next.orientation, compass.map(x=>-x)) == 0);
      located.add(seg.next);

      for ( let [adj_seg, offset] of seg.adj ) {
        let compass = seg.orientation.slice();
        this.jump(seg, offset, -1, compass);

        if ( !adj_seg.orientation )
          adj_seg.orientation = compass;
        console.assert(this.cmp(adj_seg.orientation, compass) == 0
                       || this.cmp(adj_seg.orientation, compass.map(x=>-x)) == 0);
        located.add(adj_seg);
      }
    }

    return param;
  }
  /**
   * Explore whole elements from specified element and direction, and reorder
   * them in passing.
   * This function give same result for equivalent configuration, even if orders
   * of configurations are different.
   * It will sort elements by order of encountering, and yields adjacent relation
   * when passing through.
   * 
   * @param {SphConfig} config - The configuration to explore.
   * @param {number[]} index0 - The index (specified type, loop, rot) of starting
   *   element.
   * @yields {Array} The adjacency just passed through.
   * @returns {Array} The permutation of sorted configuration.
   */
  *crawl(config, index0) {
    var perm = config.types.map(() => []);
    var adjacencies = new Set(config.adjacencies);
    var P = Array(config.types.length).fill(0);
    var path = [];

    // first
    var [i0, j0, k0] = index0;
    if ( config.types[i0].fold != 0 ) {
      const N0 = config.types[i0].fold;
      perm[i0][j0] = [P[i0]++, (N0-k0)%N0];
      path.push(index0);

    } else {
      perm[i0][j0] = [P[i0]++, 0];
      path.push(index0);
    }

    for ( let [i, j, k] of path ) {
      // find adjacent segment
      let adj = [];
      for ( let adjacency of adjacencies ) {
        let [index1, index2, offset] = adjacency;

        if ( index1[0] != i || index1[1] != j )
          [index2, index1] = [index1, index2];
        if ( index1[0] != i || index1[1] != j )
          continue;

        // determine index1 in sorted config
        let index1_ = config.apply(perm, index1);
        if ( config.types[i].fold == 0 )
          offset = this.mod4(offset-k*4, [4]);
        adj.push([index1_, offset, index2]);
        adjacencies.delete(adjacency);
      }
      adj.sort(this.cmp.bind(this));

      for ( let [index1_, offset, index2] of adj ) {
        // determine index2 in sorted config
        let [i2, j2, k2] = index2;
        if ( perm[i2][j2] === undefined ) {
          if ( config.types[i2].fold != 0 ) {
            const N2 = config.types[i2].fold;
            perm[i2][j2] = [P[i2]++, (N2-k2)%N2];
            path.push(index2);
          } else {
            perm[i2][j2] = [P[i2]++, 0];
            path.push([i2, j2, offset/4]);
          }
        }

        // build new adjacency table
        let index2_ = config.apply(perm, index2);
        if ( this.cmp(index1_, index2_) > 0 )
          [index2_, index1_] = [index1_, index2_];
        yield [index1_, index2_, offset];
      }
    }
    console.assert(P.every((n, i) => n == config.types[i].count));

    return perm;
  }
  /**
   * Sort configuration and return possible permutations.
   * The multiple permutations means geometric symmetry of this configuration.
   * 
   * @param {SphConfig} config - The configuration to sort.
   * @param {SphConfig[]} known - Sorted list of known sorted configurations.
   * @returns {Array} Sorted configuration and possible permutations.
   */
  sortConfig(config, known=[]) {
    const type = config.types[0];
    const length = config.adjacencies.length;
    if ( type.fold == 0 )
      throw new Error("too trivial");

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
    for ( let ind_loop=0; ind_loop<type.count; ind_loop++ )
      for ( let ind_rot=0; ind_rot<type.fold; ind_rot++ ) {
        let buffer_ = [], crawler_ = this.crawl(config, [0, ind_loop, ind_rot]);

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
            let sgn = cmp(buffer_, crawler_, config_.adjacencies);
            if ( sgn == 0 ) {
              let res = crawler.next();
              console.assert(res.done);
              permutations = config_.symmetries
                .map(perm => config_.followedBy(res.value, perm));
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

    config = new SphConfig({types:config.types, adjacencies:buffer});
    var perm0 = config.inverse(res.value);
    config.symmetries = permutations.map(perm => config.followedBy(perm0, perm))
                                    .sort(this.cmp.bind(this));

    return [config, permutations];
  }
}

/**
 * Configuration of connected network of puzzle.
 * Configuration contain the minimal information about puzzle, which is
 * rebuildable without fixed global orientation.  Such data is useful to analyze
 * jumbling rule of this state.
 * 
 * index:
 * Segment of puzzle can be indicated by four indices: index of type, index of
 * elements with this type, index of rotation, and index of segment in the patch.
 * We always write "i,j;k,l" represent such index system.
 * 
 * permutation:
 * Using index system, we can express permutation of segments (permutation and
 * rotation of elements) as 2D array `perm`: the segment at `i,j;k,l` will be
 * moved to `i,j_;k+dk,l`.  Where we set `[j_, dk] = perm[i][j]`: `j_` is the
 * new position of element, and `dk` means rotation of element.
 * 
 * parameters:
 * We use 2D array to denote additional information about elements.  For example,
 * `colors[i][j]` is color of element at `[i, j]`.  We use 3D array to denote
 * additional information about segments.  For example, `quat[i][j][k*fold+l]`
 * is orientation of segment at `[i, j, k, l]`.  Moreover, the last dimension
 * can be constructed by cyclic linked list.  For example, `segs[i][j]` denote
 * the concrete object at `[i, j, 0, 0]`, and `segs[i][j].next` denote the
 * concrete object at `[i, j, 0, 1]`, and so on.
 * 
 * @class
 * @property {Array} types - List of type of elements in this network, which has
 *   entries `{count, fold, patch}`;
 *   `count` is number of such type of elements in the network;
 *   `fold` is size of rotation symmetry of this type of element, which equal to
 *   1 for no symmetry, and equal to 0 for continuos rotation symmetry;
 *   `patch` is unrepeated part of segments of element, which is list of
 *   `[arc, radius, angle]`.
 * @property {Array} adjacencies - Table of adjacencies, which has entries
 *   `[index1, index2, offset]`;
 *   `index1` and `index2` are indices of adjacent segments, where `index1` is
 *   less than `index2` in lexical order;
 *   `offset` is offset of adjacency.
 */
class SphConfig
{
  constructor({types=[], adjacencies=[]}={}) {
    this.types = types;
    // type = {count, fold, patch: [[arc, radius, angle], ...]}
    this.adjacencies = adjacencies;
    // adjacency = [index1, index2, offset]
    this.symmetries = undefined;
    // symmetry = perm
  }

  get(param, [i,j,k=0,l=0]) {
    const type = this.types[i];
    const L = type.fold == 0 ? 1 : type.fold * type.patch.length;

    var n = k * type.patch.length + l;
    n = (n % L + L) % L;

    var obj = param[i][j];
    if ( obj.next ) { // list-like
      for ( var m=0; m<n; m-- )
        obj = obj.next;
      return obj;

    } else if ( Array.isArray(obj) ) { // array-like
      var res = Array(L);
      for ( let m=0; m<L; m++ )
        if ( m in obj )
          res[(m-n+L)%L] = obj[m];
      return res;

    } else { // no orientation data
      return obj;
    }
  }
  apply(perm, [i,j,k=0,l=0]) {
    const N = this.types[i].fold == 0 ? 1 : this.types[i].fold;
    var [j_, dk] = perm[i][j];
    var k_ = ((k+dk) % N + N) % N;
    return [i, j_, k_, l];
  }
  map(param, ...perms) {
    for ( let perm of perms ) {
      let param_ = param.map(() => []);
      for ( let i=0; i<param_.length; i++ )
        for ( let j=0; j<param_[i].length; j++ ) {
          let [j_, dk] = perm[i][j];
          param_[i][j_] = this.get(param[i][j], [i, j, -dk, 0]);
        }
      param = param_;
    }
    return param;
  }

  followedBy(perm0, ...perms) {
    perm0 = perm0.map(subperm0 => subperm0.slice());
    for ( let i=0; i<perm0.length; i++ )
      for ( let j=0; j<perm0[i].length; j++ ) {
        let [j_, dk] = perm0[i][j];
        const N = this.types[i].fold == 0 ? 1 : this.types[i].fold;
        for ( let perm of perms ) {
          let dk_;
          [j_, dk_] = perm[i][j_];
          dk = dk + dk_;
        }
        dk = (dk % N + N) % N;
        perm0[i][j] = [j_, dk];
      }
    return perm_;
  }
  inverse(perm) {
    var perm_inv = perm.map(() => []);
    for ( let i=0; i<perm.length; i++ )
      for ( let j=0; j<perm[i].length; j++ ) {
        const N = this.types[i].fold == 0 ? 1 : this.types[i].fold;
        let [j_, dk] = perm[i][j];
        let dk_ = (N - dk % N) % N;
        perm_inv[i][j_] = [j, dk_];
      }
    return perm_inv;
  }

  reorder(perm) {
    for ( let adjacency of this.adjacencies ) {
      adjacency[0] = this.apply(perm, adjacency[0]);
      adjacency[1] = this.apply(perm, adjacency[1]);
    }
  }
}
