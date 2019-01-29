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
  var phi = Math.acos(z);
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
 * {@link SlidingSphere} will use this unit for angle and arc.
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
  constructor({radius, orientation}) {
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
 * @property {number} length - Length of segment, in the range of (0, 4].
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
 * @property {SphLock} lock - The lock of this segment.
 */
class SphSeg
{
  constructor({length, angle, radius, orientation}) {
    this.length = length;
    this.angle = angle;
    this.radius = radius;
    this.orientation = orientation.slice(0);

    this.next = undefined;
    this.prev = undefined;
    this.adj = new Map();
    this.affiliation = undefined;
    this.lock = undefined;
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
 * Lock of sliding sphere.
 * It represent the full circle of gap between elements, which is able to twist.
 * 
 * @class
 * @property {SphSeg[]} dash - Segments of boundaries.
 * @property {number} offset - Offset between the first segments in `dash`.
 *   Notice that it may not modulus of 4.
 * @property {SphCircle} circle - Circle of lock.
 */
class SphLock
{
  constructor() {
    this.teeth = [];
    this.dual = undefined;
    this.offset = 0;
  }
  get circle() {
    return this.teeth[0].circle;
  }

  lock(segs) {
    this.teeth = segs.slice(0);
    for ( let seg of segs )
      seg.lock = this;
    return this;
  }
  unlock() {
    for ( let seg of this.teeth )
      seg.lock = undefined;
    return this;
  }
  pairWith(lock, offset) {
    this.dual = lock;
    lock.dual = this;
    this.offset = lock.offset = offset;
  }
  insertAfter(seg, seg0) {
    let i = this.teeth.indexOf(seg0);
    if ( i == -1 )
      return;
    this.teeth.splice(i+1, 0, seg);
    seg.lock = this;
  }
  remove(seg) {
    let i = this.teeth.indexOf(seg);
    if ( i == -1 )
      return;
    this.teeth.splice(i, 1);
    seg.lock = undefined;
    if ( i == 0 )
      this.offset = this.dual.offset = this.offset - seg.length;
  }
}

/**
 * Sliding sphere.
 * 
 * @class
 */
class SlidingSphere
{
  constructor(tol=1e-5) {
    this.tol = tol;
    this.elements = new Set([new SphElem()]);
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
  _cmp(v1, v2) {
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
  _snap(val, snaps=[]) {
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
  _mod4(val, snaps=[]) {
    return fzy_mod(val, 4, snaps, this.tol);
  }

  /**
   * Determine relation between circles.
   * It will return `[ang, len1, len2, meeted]`, which represent overlapping
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
   *   has values `[ang, len1, len2, meeted]`.
   *   `ang` is absolute angle between their directed tangent vectors at meet
   *   point, in the range of [0, 2];
   *   `len1` is length of `circle1` under `circle2`, in the range of [0, 4];
   *   `len2` is length of `circle2` under `circle1`, in the range of [0, 4].
   *   `meeted` is number of meet points between circles.
   */
  _relationTo(circle1, circle2) {
    var radius1 = circle1.radius;
    var radius2 = circle2.radius;
    var distance = angleTo(circle2.center, circle1.center)/Q;
    console.assert(this._cmp(distance, 0) >= 0 && this._cmp(distance, 2) <= 0);
    console.assert(this._cmp(radius1, 0) > 0 && this._cmp(radius1, 2) < 0);
    console.assert(this._cmp(radius2, 0) > 0 && this._cmp(radius2, 2) < 0);

    if ( this._cmp(distance, 0) == 0 && this._cmp(radius1, radius2) == 0 )
      return [0, undefined, undefined, undefined]; // equal
    else if ( this._cmp(distance, 2) == 0 && this._cmp(radius1 + radius2, 2) == 0 )
      return [2, undefined, undefined, undefined]; // complement
    else if ( this._cmp(distance, radius1 - radius2) <  0 )
      return [0, 0, 4, 0]; // include
    else if ( this._cmp(distance, radius1 - radius2) == 0 )
      return [0, 0, 4, 1]; // kissing include
    else if ( this._cmp(distance, radius1 + radius2) >  0 )
      return [2, 0, 0, 0]; // exclude
    else if ( this._cmp(distance, radius1 + radius2) == 0 )
      return [2, 0, 0, 1]; // kissing exclude
    else if ( this._cmp(2-distance, radius1 - (2-radius2)) <  0 )
      return [2, 4, 4, 0]; // anti-include
    else if ( this._cmp(2-distance, radius1 - (2-radius2)) == 0 )
      return [2, 4, 4, 1]; // kissing anti-include
    else if ( this._cmp(2-distance, radius1 + (2-radius2)) >  0 )
      return [0, 4, 0, 0]; // anti-exclude
    else if ( this._cmp(2-distance, radius1 + (2-radius2)) == 0 )
      return [0, 4, 0, 1]; // kissing anti-exclude
    else if ( distance < radius1 + radius2 )
      return [...this._intersect(radius1, radius2, distance), 2]; // intersect
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
   *   `[ang, len1, len2]` (see method {@link SlidingSphere#_relationTo}).
   */
  _intersect(radius1, radius2, distance) {
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
    var length1 = Math.acos(cA)*2/Q;
    var length2 = Math.acos(cB)*2/Q;
    console.assert(!Number.isNaN(length1) && length1 > 0);
    console.assert(!Number.isNaN(length2) && length2 > 0);
    console.assert(!Number.isNaN(angle) && angle > 0);

    return [angle, length1, length2];
  }
  /**
   * Compute length of leaf shape.
   * Given tip angle and radius of edges, compute length of edges.
   * 
   * @param {number} angle - Tip angle of leaf shape.
   * @param {number} radius1 - Radius of left edge of leaf shape.
   *   Center of curvature is at the right of edge.
   * @param {number} radius2 - Radius of right edge of leaf shape.
   *   Center of curvature is at the left of edge.
   * @returns {number[]} The lengths of left edge and right edge, which has
   *   values `[len1, len2]`.
   */
  _leaf(angle, radius1, radius2) {
    var a = radius1*Q;
    var b = radius2*Q;
    var C = (2-angle)*Q;
  
    // cotangent rule for spherical triangle: cos b cos C = cot a sin b - cot A sin C
    var [ca, sa] = [Math.cos(a), Math.sin(a)];
    var [cb, sb] = [Math.cos(b), Math.sin(b)];
    var [cC, sC] = [Math.cos(C), Math.sin(C)];
    var [cA_, sA_] = [ca*sb-sa*cb*cC, sa*sC];
    var [cB_, sB_] = [cb*sa-sb*ca*cC, sb*sC];
  
    var length2 = Math.atan2(sA_, cA_)*2/Q;
    var length1 = Math.atan2(sB_, cB_)*2/Q;
    console.assert(!Number.isNaN(length1) && length1 > 0);
    console.assert(!Number.isNaN(length2) && length2 > 0);
  
    return [length1, length2];
  }

  /**
   * Walk through segment along boundaries of element.
   * It will stop before returning to the starting segment or has no next segment.
   * 
   * @param {SphSeg} seg0 - The starting segment.
   * @param {number[]=} compass - The orientation of starting segment, and as a
   *   buffer for derived orientation of segment after walking.
   * @yields {SphSeg} The segment walked through.  Its derived orientation will
   *   be set to buffer `compass`.
   * @returns {boolean} True if it return to the starting segment finally.
   */
  *_walk(seg0, compass) {
    var seg = seg0;
    do {
      yield seg;
      seg = seg.next;

      if ( seg === undefined )
        return false;

      if ( compass ) {
        q_spin(compass, seg.prev.length*Q, compass);
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
  *_loops(segs) {
    segs = new Set(segs);
    for ( let seg0 of segs ) {
      let loop = [];
      for ( let seg of this._walk(seg0) ) {
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
   * @param {number} offset - Offset of point respect to vertex of `seg0`,
   *   in the range of [0, `seg0.length`].
   * @param {number=} prefer - The prefer side when jumping to end point of segment.
   *   `+1` (default) means upper limit of offset; `-1` means lower limit of offset.
   * @param {number[]=} compass - The orientation of starting segment, and as a
   *   buffer for derived orientation of segment after jumping.
   * @returns {object[]} Segment and corresponding offset after jump: `[seg, offset]`,
   *   or empty array if no adjacent segment to jump.  The derived orientation
   *   of `seg` will be set to buffer `compass`.
   */
  _jump(seg0, offset, prefer=+1, compass) {
    for ( let [adj_seg, theta] of seg0.adj ) {
      let offset_ = this._mod4(theta-offset, [0, adj_seg.length]);
      if ( adj_seg.length == 4 && offset_ == 0 )
        offset_ = prefer < 0 ? 0 : 4;
      else if ( offset_ == 0 && prefer > 0 )
        continue;
      else if ( offset_ == adj_seg.length && prefer < 0 )
        continue;
      else if ( offset_ > adj_seg.length )
        continue;

      if ( compass ) {
        q_spin(compass, theta*Q, compass);
        q_mul(compass, [1,0,0,0], compass);
      }
      return [adj_seg, offset_];
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
   *   in the range of [0, `seg0.length`).
   * @param {number[]=} compass - The orientation of starting segment, and as a
   *   buffer for derived orientation of segment after spinning.
   * @yields {object[]} Information when spinning to segment, which has value
   *   `[angle, seg, offset]`:
   *   `angle` is spinning angle with unit of quadrant, which will snap to 0, 2;
   *   `seg` is segment passing through center;
   *   `offset` is offset of center.
   *   The orientation of `seg` will be set to buffer `compass`.
   * @returns {boolean} True if it return to the first segment finally.
   */
  *_spin(seg0, offset=0, compass) {
    var angle = 0, seg = seg0;
    if ( compass ) {
      var compass0 = compass.slice();
      var vertex0 = [Math.sin(seg0.radius*Q), 0, Math.cos(seg0.radius*Q)];
      rotate(vertex0, compass, vertex0);
    }

    do {
      yield [angle, seg, offset];

      [seg, offset] = this._jump(seg, offset, +1);

      if ( seg !== undefined ) {
        if ( seg.length == offset )
          [angle, seg, offset] = [angle+seg.next.angle, seg.next, 0];
        else
          angle += 2;
        angle = this._snap(angle, [0, 2, 4]);
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
  *_ski(seg0) {
    var seg = seg0;
    do {
      yield seg;
      
      let [ang1, seg1] = [seg.next.angle, seg.next];
      let ang;
      for ( [ang, seg] of this._spin(seg1) ) {
        let sgn = this._cmp([ang, seg.radius-1], [2-ang1, seg0.radius-1]);
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
  _full(gen) {
    var list = [];
    var res;
    while ( !(res = gen.next()).done )
      list.push(res.value);
    return res.value ? list : undefined;
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
  _swap(seg1, seg2, ang1, ang2) {
    var [seg1_prev, seg2_prev] = [seg1.prev, seg2.prev];
    var [seg1_ang, seg2_ang] = [seg1.angle, seg2.angle];

    seg2_prev.connect(seg1);
    seg1_prev.connect(seg2);
    seg1.angle = seg2_ang + ang1;
    seg2.angle = seg1_ang + ang2;
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
  _interpolate(seg, theta) {
    theta = this._mod4(theta, [4, seg.length]);
    if ( theta >= seg.length )
      throw new Error("out of range of interpolation");

    // make next segment started from point of interpolation
    var next_seg = new SphSeg({
      length: seg.length - theta,
      angle: 2,
      radius: seg.radius,
      orientation: q_spin(seg.orientation, theta*Q)
    });
    seg.length = theta;

    // merge loop
    if ( seg.next )
      next_seg.connect(seg.next);
    seg.connect(next_seg);
    if ( seg.affiliation )
      seg.affiliation.accept(next_seg);
    if ( seg.lock )
      seg.lock.insertAfter(next_seg, seg);

    for ( let [adj_seg, offset] of seg.adj ) {
      // remove adjacent of segment
      if ( this._cmp(offset, seg.length + adj_seg.length) >= 0 )
        seg.adjacent(adj_seg);

      // add adjacent of next_seg
      let offset_ = this._mod4(offset - seg.length, [4, next_seg.length, adj_seg.length]);
      if ( this._cmp(offset_, next_seg.length + adj_seg.length) < 0 )
        next_seg.adjacent(adj_seg, offset_);
    }

    return next_seg;
  }
  /**
   * Merge segment with the previous segment, and remove this segment.
   * The radius and center of them must be same, and this segment cannot be
   * self connected.
   * 
   * @param {number} seg - The segment to merge.
   * @returns {SphSeg} The removed segment.
   */
  _mergePrev(seg) {
    if ( seg === seg.prev
         || this._cmp(seg.angle, 2) != 0
         || this._cmp(seg.radius, seg.prev.radius) != 0
         || this._cmp(seg.circle.center, seg.prev.circle.center) != 0 )
      throw new Error("unable to merge segments");

    // merge segment
    var merged = seg.prev;
    var original_len = merged.length;
    merged.length = merged.length + seg.length;

    // merge loop
    if ( seg.next )
      seg.prev.connect(seg.next);
    else
      seg.prev.next = undefined;
    if ( seg.affiliation )
      seg.affiliation.withdraw(seg);
    if ( seg.lock )
      seg.lock.remove(seg);

    // merge adjacent
    for ( let [adj_seg, offset] of seg.adj ) {
      seg.adjacent(adj_seg);
      if ( !merged.adj.has(adj_seg) ) {
        let offset_ = this._mod4(offset + original_len, [4, merged.length, adj_seg.length]);
        merged.adjacent(adj_seg, offset_);
      }
    }

    if ( merged.next === merged ) {
      merged.length = 4;
      merged.angle = 2;
    }

    return seg;
  }
  /**
   * Glue two adjacent segments.
   * They must have same affiliation.
   * 
   * @param {SphSeg} segment1 - The first segment to glue.
   * @param {SphSeg} segment2 - The second segment to glue.
   */
  _glueAdj(segment1, segment2) {
    var offset = segment1.adj.get(segment2);
    var affiliation = segment1.affiliation;
    if (offset === undefined || segment2.affiliation !== affiliation)
      throw new Error("unable to glue segments");
  
    if ( segment1.lock )
      segment1.lock.unlock();
    if ( segment2.lock )
      segment2.lock.unlock();

    // find end points of covers between segments
    var brackets = [];

    var offset1 = this._mod4(offset, [4, segment1.length]);
    if ( offset1 <= segment1.length )
      brackets.push([offset1, 0, -1]);
    var offset2 = this._mod4(offset, [4, segment2.length]);
    if ( offset2 <= segment2.length )
      brackets.push([0, offset2, +1]);
    var offset1_ = this._mod4(offset-segment2.length, [0, segment1.length, offset1]);
    if ( offset1_ != 0 && offset1_ < segment1.length )
      brackets.push([offset1_, segment2.length, +1]);
    var offset2_ = this._mod4(offset-segment1.length, [0, segment2.length, offset2]);
    if ( offset2_ != 0 && offset2_ < segment2.length )
      brackets.push([segment1.length, offset2_, -1]);
    brackets.sort();
    console.assert(brackets.length%2==0 && brackets.every((c,i) => c[2]==(-1)**i));

    // interpolate
    var offsets1 = new Set(brackets.map(([th1, th2]) => th1));
    var offsets2 = new Set(brackets.map(([th1, th2]) => th2));
    var contacts1 = new Map();
    var contacts2 = new Map();
    for ( let [contacts, segment, offsets] of [[contacts1, segment1, offsets1],
                                               [contacts2, segment2, offsets2]] )
      for ( let theta of Array.from(offsets).sort().reverse() ) {
        if ( theta == segment.length )
          contacts.set(theta, [segment.next, 2-segment.next.angle]);
        else if ( theta == 0 )
          contacts.set(theta, [segment, 0]);
        else if ( theta > 0 && theta < segment.length )
          contacts.set(theta, [this._interpolate(segment, theta), 0]);
        else
          console.assert(false);
      }

    // zip
    for ( let i=0; i<brackets.length; i++ ) {
      let [theta1, theta2] = brackets[i];
      let [seg1, ang1] = contacts1.get(theta1);
      let [seg2, ang2] = contacts2.get(theta2);
      if ( seg1 !== seg2 )
        this._swap(seg1, seg2, 2-ang1+ang2, 2-ang2+ang1);

      if ( i % 2 == 1 ) {
        console.assert(seg2.next.next === seg2 && this._cmp(seg2.angle, 4) == 0);
        affiliation.withdraw(seg2);
        affiliation.withdraw(seg2.prev);
      }
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
   *   `offset` is offset of meet point along `segment`,in the range of
   *   [0, `segment.length`);
   *   `circle` is the circle that segment meets with;
   *   `theta` is offset of meet point along `circle`.
   */
  *_meetWith(segment, circle) {
    var circle_ = segment.circle;
    var [angle, len, len_, meeted] = this._relationTo(circle_, circle);
    var offset = 0, theta = 0;

    if ( meeted === undefined ) {
      theta = this._mod4(circle.thetaOf(segment.vertex));

      if ( angle == 0 ) angle = +0;
      if ( angle == 2 ) angle = -2;

      yield {angle, segment, offset, circle, theta};

    } else if ( meeted == 0 ) {
      return;

    } else if ( meeted == 1 ) {
      theta = this._mod4(circle.thetaOf(circle_.center)+len_/2);
      offset = this._mod4(circle_.thetaOf(circle.center)-len/2, [0, segment.length]);

      if ( angle == 0 && len == 4 ) angle = +0;
      if ( angle == 0 && len == 0 ) angle = -0;
      if ( angle == 2 && len == 4 ) angle = +2;
      if ( angle == 2 && len == 0 ) angle = -2;

      if ( offset < segment.length )
        yield {angle, segment, offset, circle, theta};

    } else if ( meeted == 2 ) {
      theta = this._mod4(circle.thetaOf(circle_.center)+len_/2);
      offset = this._mod4(circle_.thetaOf(circle.center)-len/2, [0, segment.length]);
      let meet1 = {angle, segment, offset, circle, theta};

      theta = this._mod4(circle.thetaOf(circle_.center)-len_/2);
      offset = this._mod4(circle_.thetaOf(circle.center)+len/2, [0, segment.length]);
      angle = -angle;
      let meet2 = {angle, segment, offset, circle, theta};

      if ( meet2.offset < meet1.offset )
        [meet1, meet2] = [meet2, meet1];
      if ( meet1.offset < segment.length )
        yield meet1;
      if ( meet2.offset < segment.length )
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
  _sortMeets(meets) {
    // sort meets by `theta`
    var mmeets = [];
    var pos = [];
    for ( let meet of meets ) {
      meet.theta = this._mod4(meet.theta, pos);

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
        this._cmp([this._mod4(ang), cur, i], pre_field) <= 0
        ? [+this._mod4(+ang), cur, i] : [-this._mod4(-ang), cur, i]);
      pre_beams = pre_beams.map(([ang, cur, i]) =>
        this._cmp([this._mod4(ang), cur, i], pre_field) <= 0
        ? [+this._mod4(+ang), cur, i] : [-this._mod4(-ang), cur, i]);

      // separate as in and out of field
      var in_beams = [], out_beams = [];
      for ( let beams of [pre_beams, post_beams] ) for ( let beam of beams ) {
        if ( this._cmp(beam, post_field) >= 0 )
          in_beams.push(beam);
        else
          out_beams.push(beam);
      }
      in_beams.sort(this._cmp.bind(this));
      out_beams.sort(this._cmp.bind(this));
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
  _contains(boundaries, point) {
    if ( boundaries.size == 0 )
      return true;

    // make a circle passing through this point and a vertex of element
    var vertex = boundaries.values().next().value.vertex;
    var radius = angleTo(point, vertex)/2/Q;
    if ( this._cmp(radius, 0) == 0 )
      return false;

    var orientation = q_mul(q_align(vertex, point), quaternion([0,1,0], radius*Q));
    var circle = new SphCircle({orientation, radius});

    var meets = Array.from(boundaries)
                     .flatMap(seg => Array.from(this._meetWith(seg, circle)));
    console.assert(meets.length > 0);
    meets = this._sortMeets(meets);
    if ( meets.find(meet => this._mod4(meet.theta, [0]) == 0) )
      return false;
    else
      return ["-0", "+-", "--"].includes(meets[0].type);
  }
  /**
   * Slice element by circle.
   * 
   * @param {SphCircle} elem - The element to slice.
   * @param {SphCircle} circle - The knife for slicing.
   * @returns {SphSeg[]} Sliced segments of both sides of `circle` and sliced
   *   boundaries of both sides.
   */
  _slice(elem, circle) {
    var circle_ = new SphCircle(circle).complement();

    // INTERPOLATE
    // find meet points and sort by `theta`
    var paths = [];
    for ( let loop of this._loops(elem.boundaries) )
      paths.push(loop.flatMap(seg => Array.from(this._meetWith(seg, circle))));
    var meets = this._sortMeets(paths.flatMap(path => path));

    // interpolate
    for ( let path of paths ) for ( let meet of path.slice(0).reverse() )
      if ( meet.type[1] == "0" && meet.offset != 0 ) {
        meet.segment = this._interpolate(meet.segment, meet.offset);
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

      for ( let seg of this._walk(meet1.segment) ) {
        if ( seg === meet2.segment )
          break;
        segs.add(seg);
        lost.delete(seg);
      }
    }

    for ( let seg0 of lost ) {
      let side = this._cmp(circle.radius, angleTo(circle.center, seg0.vertex)/Q) > 0;
      let segs = side ? in_segs : out_segs;

      for ( let seg of this._walk(seg0) ) {
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

        let length = this._snap(meet2.theta - meet1.theta, [0, 4]);
        if ( length == 0 ) {
          // connect two meets
          this._swap(meet2.segment, meet1.segment, meet1.angle-meet2.angle, meet2.angle-meet1.angle-4);

        } else {
          // make segments between two meets
          let in_seg  = new SphSeg({radius:circle.radius,  length, angle:4,
                                    orientation:q_spin(circle.orientation, meet1.theta*Q)});
          let out_seg = new SphSeg({radius:circle_.radius, length, angle:4,
                                    orientation:q_spin(circle_.orientation, -meet2.theta*Q)});
          in_seg.connect(out_seg);
          out_seg.connect(in_seg);
          in_seg.adjacent(out_seg, length);
          elem.accept(in_seg);
          elem.accept(out_seg);

          this._swap(in_seg, meet1.segment, meet1.angle, -meet1.angle-4);
          this._swap(meet2.segment, out_seg, -2-meet2.angle, -2+meet2.angle);

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
        inside = this._contains(elem.boundaries, circle.vectorAt(0));

      if ( inside ) {

        let in_seg  = new SphSeg({length:4, angle:2, radius:circle.radius,
                                  orientation:circle.orientation});
        let out_seg = new SphSeg({length:4, angle:2, radius:circle_.radius,
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
   * Check geometry of segment, include length, angle, radius.
   * 
   * @param {SphSeg} seg - The segment to check.
   */
  _checkGeometry(seg) {
    console.assert(this._cmp(seg.length, 0) > 0 && this._cmp(seg.length, 4) <= 0);
    console.assert(this._cmp(seg.radius, 0) > 0 && this._cmp(seg.radius, 2) < 0);
    console.assert(this._cmp(seg.angle, 0) >= 0 && this._cmp(seg.radius, 4) <= 0);
    if ( this._cmp(seg.angle, 0) == 0 )
      console.assert(this._cmp(seg.radius, 2-seg.prev.radius) >  0);
    if ( this._cmp(seg.angle, 4) == 0 )
      console.assert(this._cmp(seg.radius, 2-seg.prev.radius) <= 0);
  }
  /**
   * Check orientation of connected segments in this puzzle.
   */
  _checkOrientation() {
    for ( let elem of this.elements ) for ( let loop of this._loops(elem.boundaries) ) {
      var compass = loop[0].orientation.slice();
      for ( let seg of this._walk(loop[0], compass) ) {
        console.assert(this._cmp(compass, seg.orientation) == 0
                       || this._cmp(compass, seg.orientation.map(x => -x)) == 0);

        for ( let [adj_seg, offset] of seg.adj ) {
          let adj_compass = seg.orientation.slice();
          this._jump(seg, offset, -1, adj_compass);
          console.assert(this._cmp(adj_compass, adj_seg.orientation) == 0
                         || this._cmp(adj_compass, adj_seg.orientation.map(x => -x)) == 0);
        }
      }
      console.assert(this._cmp(compass, loop[0].orientation) == 0
                     || this._cmp(compass, loop[0].orientation.map(x => -x)) == 0);
    }
  }
  /**
   * Check if segment is twistable; element should be intersection of circles.
   * 
   * @param {SphSeg} seg0 - The segment to test.
   * @returns {boolean} True if `seg0` is twistable.
   */
  _isTwistable(seg0) {
    if ( this._cmp(seg0.angle, 2) > 0 )
      return false;
    if ( this._cmp(seg0.next.angle, 2) > 0 )
      return false;
    if ( this._cmp(seg0.angle, 2) == 0 && this._cmp(seg0.radius, seg0.prev.radius) < 0 )
      return false;
    if ( this._cmp(seg0.next.angle, 2) == 0 && this._cmp(seg0.next.radius, seg0.radius) < 0 )
      return false;
    if ( Array.from(seg0.adj.keys()).some(seg => seg.affiliation === seg0.affiliation) )
      return false;
  
    var circle = seg0.circle;
    var meets = Array.from(seg0.affiliation.boundaries)
                     .flatMap(seg => Array.from(this._meetWith(seg, circle)));
    meets = this._sortMeets(meets);
    var types = meets.map(meet => meet.type);
  
    if ( types.find(type => type[1] == "0") )
      return false;
    console.assert(types.every(type => type[0] == "+"));
    if ( types.find(type => type[0] == "+") && types.find(type => type[0] == "-") )
      return false;
    return true;
  }
  
  /**
   * Find profile of given segments.
   * Profile are loops of segments that are adjacent to exposed part of given segments.
   * 
   * @param {SphSeg[]} segments
   * @returns {SphSeg[]} Profile of segments.
   */
  _findProfile(segments) {
    var segments = new Set(segments);
    var uncovered = [];
    for ( let seg of segments ) {
      // find end points of covers between segments
      let brackets = [];
      for ( let [adj_seg, offset] of seg.adj ) if ( segments.has(adj_seg) ) {
        let [segment1, segment2] = [seg, adj_seg];
  
        let offset1 = this._mod4(offset, [4, segment1.length]);
        if ( offset1 <= segment1.length )
          brackets.push([offset1, -1]);
        let offset2 = this._mod4(offset, [4, segment2.length]);
        if ( offset2 <= segment2.length )
          brackets.push([0, +1]);
        let offset1_ = this._mod4(offset-segment2.length, [0, segment1.length, offset1]);
        if ( offset1_ != 0 && offset1_ < segment1.length )
          brackets.push([offset1_, +1]);
        let offset2_ = this._mod4(offset-segment1.length, [0, segment2.length, offset2]);
        if ( offset2_ != 0 && offset2_ < segment2.length )
          brackets.push([segment1.length, -1]);
      }
      brackets.unshift([0, -1]);
      brackets.push([seg.length, +1]);
      brackets.sort(this._cmp.bind(this));
  
      // find uncovered interval
      console.assert(brackets.length % 2 == 0);
      for ( let i=0; i<brackets.length; i+=2 ) {
        let [th1, s1] = brackets[i];
        let [th2, s2] = brackets[i+1];
        console.assert(s1<0 && s2>0);
  
        if ( this._cmp(th1, th2) != 0 )
          uncovered.push([seg, th1, th2]);
      }
    }
  
    // build segments of profile
    for ( let interval of uncovered ) {
      let [seg, th1, th2] = interval;
      let length = this._snap(th2-th1, [seg.length]);
      let {radius, orientation} = seg.circle.shift(th2).complement();
      let bd = new SphSeg({radius, length, orientation});
      bd.adj.set(seg, th2);
      interval.push(bd);
    }
  
    // connect segments of profile
    for ( let [,,,bd] of uncovered ) {
      let ang_, seg_, th1_;
      for ( let tick of this._spin(bd) ) {
        if ( !segments.has(tick[1]) )
          break;
        [ang_, seg_, th1_] = tick;
      }
      bd.angle = 4-ang_;
      let [,,,bd_] = uncovered.find(([seg, th1]) => seg===seg_ && this._cmp(th1,th1_) == 0);
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
  _parseNetworks(segments) {
  
    // find all connected networks
    var networks = [];
    var lost = new Set(segments);
    while ( lost.size ) {
      let network = {loops:[], profile:[], joints:[]};
  
      let queue = new Set([lost.values().next().value]);
      for ( let seg0 of queue ) {
        let loop = this._full(this._walk(seg0));
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
  
      let profile = this._findProfile(network.loops.flatMap(loop => loop));
      network.profile = Array.from(this._loops(profile));
  
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
            for ( let meet of this._meetWith(seg, circle) ) {
              meet.network = network;
              meet.loop = loop;
              meet.side = side;
              meets.push(meet);
            }
      meets = this._sortMeets(meets);
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
   * separate joint part of given segments.
   * 
   * @param {SphSeg[]} segments
   * @returns {SphSeg[][]} Set of joint Segments.
   */
  _separateJointPart(segments) {
    var networks = this._parseNetworks(segments);
  
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
   * Partition by disjoint locks.
   * 
   * @param {...SphLock} locks - The locks which separate whole space.
   *   Both of lock and its dual lock should be included simultaneously.
   * @returns {Array} All part divided by locks, which have entries `{elements, locks}`.
   *   `elements` is set of elements in this part,
   *   `locks` is set of locks of boundaries of this part.
   */
  _partitionBy(...locks) {
    var bd = locks.flatMap(lock => lock.teeth);
    locks = new Set(locks);
    var partition = [];

    while ( locks.size ) {
      let group = {locks: new Set(), elements: new Set()};

      let lock = locks.values().next().value;
      locks.delete(lock);
      group.locks.add(lock);
      for ( let seg of lock.teeth )
        group.elements.add(seg.affiliation);

      for ( let elem of group.elements ) for ( let seg of elem.boundaries ) {
        if ( !bd.includes(seg) ) {
          for ( let adj_seg of seg.adj.keys() )
            group.elements.add(adj_seg.affiliation);

        } else if ( !group.locks.has(seg.lock) ) {
          locks.delete(seg.lock);
          group.locks.add(seg.lock);
          for ( let par_seg of seg.lock.teeth )
            group.elements.add(par_seg.affiliation);
        }
      }
      partition.push(group);
    }
    return partition;
  }
  /**
   * Build Lock along extended circle of given segment.
   * 
   * @param {SphSeg} seg
   * @returns {SphLock[]} The locks, or `undefined` if it is unlockable.
   */
  _buildLock(seg) {
    var [seg_, offset] = seg.adj.entries().next().value;
    var left = this._full(this._ski(seg));
    if ( !left ) return;
    var right = this._full(this._ski(seg_));
    if ( !right ) return;

    var left_lock = new SphLock();
    var right_lock = new SphLock();
    left_lock.lock(left);
    right_lock.lock(right);
    left_lock.pairWith(right_lock, offset);
    return [left_lock, right_lock];
  }
  /**
   * Twist locks with given angles.
   * 
   * @param {Map<SphLock,number>} op - The map that tell you which lock should
   *   twist by what angle.
   * @param {SphElem=} hold - The element whose orientation should fix.
   */
  _twist(op, hold) {
    op = new Map(op);
    for ( let [lock, theta] of op ) {
      if ( !op.has(lock.dual) )
        op.set(lock.dual, theta);
      else
        console.assert(this._cmp(op.get(lock.dual), theta) == 0);
    }

    // unlock
    var bd = Array.from(op.keys()).flatMap(lock => lock.teeth);
    for ( let seg0 of bd )
      for ( let [angle, seg, offset] of this._spin(seg0) )
        if ( offset == 0 && angle != 0 && angle != 2 )
          if ( seg.lock ) seg.lock.unlock();

    // twist
    var partition = this._partitionBy(...op.keys());
    var group0 = partition.find(g => g.elements.has(hold)) || partition[0];
    group0.rotation = [0,0,0,1];
    var processed = new Set([group0]);

    for ( let group of processed ) for ( let lock of group.locks ) {
      let adj_group = partition.find(g => g.locks.has(lock.dual));

      let theta = op.get(lock.dual);
      let rotation = quaternion(lock.dual.circle.center, theta*Q);
      q_mul(rotation, group.rotation, rotation);

      if ( !processed.has(adj_group) ) {
        lock.offset = lock.dual.offset = this._mod4(lock.offset - theta);

        adj_group.rotation = rotation;
        for ( let elem of adj_group.elements )
          elem.rotate(rotation);
        processed.add(adj_group);

      } else {
        console.assert(this._cmp(adj_group.rotation, rotation) == 0);
      }
    }

    // relink adjacent segments
    for ( let seg of bd )
      seg.adj.clear();

    var offset1 = 0, offset2 = 0;
    for ( let lock of op.keys() )
      for ( let seg1 of lock.teeth ) {
        offset2 = 0;
        for ( let seg2 of lock.dual.teeth ) {
          let offset = this._mod4(lock.offset-offset1-offset2, [4, seg1.length, seg2.length]);
          if ( this._cmp(offset, seg1.length+seg2.length) < 0 )
            seg1.adjacent(seg2, offset);
          offset2 += seg2.length;
        }
        offset1 += seg1.length;
      }

    // lock
    for ( let seg0 of bd )
      for ( let [angle, seg, offset] of this._spin(seg0) )
        if ( offset == 0 && angle != 0 && angle != 2 )
          if ( !seg.lock ) this._buildLock(seg);
  }
  /**
   * Make tick at end point of segment.
   * 
   * @param {SphSeg} prev_seg
   * @returns {object} Tick at `prev_seg.next.vertex`, which have value
   *   `{segment, subticks, is_free}`, and `subticks = [{angle, segment}, ...]`:
   *   `segment` is next segment along extending circle of this segment;
   *   `subtick.angle` is rolling angle, with unit of quadrant, range in (0, 2);
   *   `subtick.segment` is segment of subtick, which has vertex at tick center;
   *   `is_free` indicate subticks are free or not.
   */
  _makeTick(prev_seg) {
    var [ang1, seg1] = [prev_seg.next.angle, prev_seg.next];
    var subticks = [], pre = [], post = [];
    var angle, segment, offset;
    for ( [angle, segment, offset] of this._spin(seg1) ) {
      angle = this._snap(angle+ang1, [0, 2, 4]);
      let sgn = this._cmp([angle, segment.radius-1], [2, prev_seg.radius-1]);
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
      if ( post.find(seg2 => this._cmp(2-seg1.radius, seg2.radius) == 0) ) {
        is_free = true;
        break;
      }
  
    return {segment, subticks, is_free};
  }
  /**
   * Detect latches by given ticks; Latch has information about twistable circle.
   * 
   * @param {object[]} ticks
   * @returns {object[]} Array of latches, which has entries `{length, center, segment}`
   *   or `{length, center, segment0}` (free latch):
   *   `length` is length of shadow under twistable circle;
   *   `center` is center of twistable circle;
   *   `segment` is locked segment;
   *   `segment0` is segment in which `segment0.next.vertex` is point of twistable
   *   circle.
   */
  _detectLatches(ticks) {
    var latches = [];
  
    var radius0 = ticks[0].segment.radius;
    var full_len = ticks.reduce((acc, tick) => (tick.theta=acc)+tick.segment.length, 0);
    console.assert(this._cmp(full_len, 4) == 0);
    for ( let tick of ticks ) for ( let sub of tick.subticks )
      [sub.length] = this._leaf(sub.angle, radius0, sub.segment.radius);
  
    // find latches (center of possible intercuting circle)
    // find all free latches
    var free_ind = ticks.flatMap(({is_free}, i) => is_free ? [i] : []);
    for ( let i of free_ind ) for ( let j of free_ind ) if ( i < j ) {
      let length = ticks[j].theta - ticks[i].theta;
      let center = this._mod4(ticks[i].theta+length/2);
      let segment0  = (ticks[j-1] || ticks[ticks.length-1]).segment;
      let segment0_ = (ticks[i-1] || ticks[ticks.length-1]).segment;
  
      switch ( this._cmp(length, 2) ) {
        case -1:
          latches.push({length, center, segment0});
          break;
  
        case +1:
          length = 4 - length;
          center = this._mod4(center+2);
          segment0 = segment0_;
          latches.push({length, center, segment0});
          break;
  
        case 0:
          length = 2;
          latches.push({length, center, segment0});
          center = this._mod4(center+2);
          segment0 = segment0_;
          latches.push({length, center, segment0});
          break;
      }
    }
  
    // find normal latches
    var normal_ind = ticks.flatMap(({is_free}, i) => is_free ? [] : [i]);
    for ( let i of normal_ind ) for ( let j of normal_ind ) if ( i < j ) {
      let lenj = this._mod4(ticks[j].theta - ticks[i].theta);
      let leni = this._mod4(ticks[i].theta - ticks[j].theta);
      for ( let subi of ticks[i].subticks ) if ( this._cmp(subi.length, leni) == 0 )
        for ( let subj of ticks[j].subticks ) if ( this._cmp(subj.length, lenj) == 0 )
          if ( this._cmp(subi.segment.radius+subj.segment.radius, 2) == 0 ) {
            let center = this._mod4(ticks[j].theta-lenj/2);
            let length = lenj;
            let segment = subj.segment;
  
            switch ( this._cmp([length, segment.radius], [2, 1]) ) {
              case -1:
                latches.push({length, center, segment});
                break;
  
              case +1:
                length = leni;
                center = this._mod4(center+2);
                segment = subi.segment;
                latches.push({length, center, segment});
                break;
  
              case 0:
                length = 2;
                latches.push({length, center, segment});
                center = this._mod4(center+2);
                segment = subi.segment;
                latches.push({length, center, segment});
                break;
            }
          }
    }
  
    for ( let j of normal_ind ) for ( let i of free_ind ) {
      let length = this._mod4(ticks[j].theta - ticks[i].theta);
      for ( let subj of ticks[j].subticks ) if ( this._cmp(subj.length, length) == 0 ) {
        let center = this._mod4(ticks[j].theta-length/2);
        let segment = subj.segment;
  
        switch ( this._cmp([length, segment.radius], [2, 1]) ) {
          case -1:
            latches.push({length, center, segment});
            break;
  
          case +1:
            length = 4-length;
            center = this._mod4(center+2);
            [segment] = this._jump(segment, 0, +1);
            latches.push({length, center, segment});
            break;
  
          case 0:
            length = 2;
            latches.push({length, center, segment});
            center = this._mod4(center+2);
            [segment] = this._jump(segment, 0, +1);
            latches.push({length, center, segment});
            break;
        }
      }
    }
  
    return latches;
  }
  /**
   * Detect non-trivial twist angle of lock.
   * 
   * @param {SphLock} lock
   * @returns {Map<number,number[]>} Map from twist angle to unlockable segment,
   *   has entries `[ang, [seg, len]]` or `[ang, [seg0, 0]]` (masker key):
   *   `ang` is twist angle that may unlock intersecting circle;
   *   `seg` is segment that may become unlockable;
   *   `len` is length of shadow under unlockable circle;
   *   `seg0` is segment in which `seg0.next.vertex` is point of unlockable circle.
   */
  _decipher(lock) {
    var ticks1 = [], ticks2 = [];
    for ( let [segs, ticks] of [[lock.teeth, ticks1], [lock.dual.teeth, ticks2]] ) {
      for ( let i=0; i<segs.length; i++ ) {
        let seg = segs[i-1] || segs[segs.length-1];
        let tick = this._makeTick(seg);
        console.assert(tick && tick.segment === segs[i]);
        ticks.push(tick);
      }
    }
  
    var latches1 = this._detectLatches(ticks1);
    var latches2 = this._detectLatches(ticks2);
  
    var passwords = new Map(); // theta => [segment, 0] or [segment0, length]
    var keys = new Set([]);
    for ( let latch1 of latches1 ) for ( let latch2 of latches2 ) {
      let test;
      if ( latch1.segment && latch2.segment )
        test = this._cmp([latch1.length, latch1.segment.radius],
                       [latch2.length, latch2.segment.radius]) == 0;
      else
        test = this._cmp(latch1.length, latch2.length) == 0;
  
  
      if ( test ) {
        let key = this._mod4(lock.offset-latch1.center-latch2.center, keys);
        keys.add(key);
        if ( !passwords.has(key) )
          passwords.set(key, []);
  
        let segment = latch1.segment || latch2.segment;
        if ( segment )
          passwords.get(key).push([segment, 0]);
        else
          passwords.get(key).push([latch1.segment0, latch1.length]);
      }
    }
  
    return passwords;
  }

  merge(element0, ...elements) {
    console.assert(this.elements.has(element0));
    for ( let elem of elements ) if ( elem !== element0 ) {
      console.assert(this.elements.has(elem));
      this.elements.delete(elem);
    }
    element0.merge(...elements);
  }
  split(element0, ...groups) {
    console.assert(this.elements.has(element0));
    this.elements.delete(element0);
    var splited = element0.split(...groups);
    for ( let elem of splited )
      this.elements.add(elem);
  }
  rotate(q) {
    for ( let elem of this.elements )
      elem.rotate(q);
    return this;
  }
  slice(center, radius) {
    var circle = new SphCircle({radius, orientation:q_align(center)});
    var new_bd = [];
    var elements = new Set(this.elements);
    for ( let elem of elements ) {
      let [in_segs, out_segs, in_bd, out_bd] = this._slice(elem, circle);
      this.split(elem, in_segs, out_segs);
      new_bd.push(...in_bd, ...out_bd);
    }
    if ( new_bd.length )
      if ( !new_bd[0].lock ) this._buildLock(new_bd[0]);
  }
  mergeTrivialVertices() {
    for ( let elem of this.elements )
      for ( let loop of this._loops(elem.boundaries) )
        for ( let seg of loop )
          if ( seg !== seg.prev
               && this._cmp(seg.angle, 2) == 0
               && this._cmp(seg.radius, seg.prev.radius) == 0
               && this._cmp(seg.circle.center, seg.prev.circle.center) == 0 )
            this._mergePrev(seg);
  }
  mergeUntwistableEdges() {
    for ( let elem of this.elements ) {
      while ( true ) {
        let seg = Array.from(elem.boundaries)
                       .find(seg => !this._isTwistable(seg)
                                    && Array.from(seg.adj.keys())
                                            .some(seg_ => seg_.affiliation!==elem));
        if ( !seg )
          break;
        this.merge(elem, ...seg.adj.keys());
      }
    }
  }
  mergeTrivialEdges() {
    for ( let elem of this.elements ) {
      while ( true ) {
        let bd = Array.from(elem.boundaries);
        let seg1, seg2;
        for ( seg1 of bd )
          if ( seg2 = bd.find(seg2 => seg2.adj.has(seg1)) )
            break;

        if ( seg2 )
          this._glueAdj(seg1, seg2);
        else
          break;
      }
    }
  }
  twist(lock, theta) {
    this._twist([[lock, theta]], lock.dual.teeth[0].affiliation);
  }
}
