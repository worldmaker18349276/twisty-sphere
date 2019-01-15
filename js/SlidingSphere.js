"use strict";

/**
 * Fuzzy compare two values.
 * It will compare array of numbers by lexical order.
 * 
 * @param {*} v1 - The first value to compare.
 * @param {*} v2 - The second value to compare.
 * @param {number} tol - Tolerance of comparing.
 * @returns {number} `0` if `v1` is almost equal to `v2`; `+1` if `v1` is
 *   greater than `v2`; `-1` if `v1` is less than `v2`.
 */
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
function fzy_snap(val, snaps=[], tol) {
  for ( let snap of snaps )
    if ( fzy_cmp(val, snap, tol) == 0 )
      return snap;
  return val;
}
/**
 * Modulo 4 with snapping.
 * 
 * @param {number} val - The value to mod.
 * @param {number[]} snaps - The values to snap.  Snapping occur when they are
 *   roughly congruent modulo 4.
 * @param {number} tol - Tolerance of snapping.
 * @returns {number} Modulus.
 */
function mod4(val, snaps=[], tol) {
  if ( val < 0 || val >= 4 )
    val = (val % 4 + 4) % 4;

  for ( let snap of snaps )
    if ( fzy_cmp(mod4(val-snap+2), 2, tol) == 0 )
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
 * @property {number} radius - Radius of spherical circle.
 *   It is under the unit of quadrant, and range in (0, 2).
 * @property {number[]} orientation - Orientation of spherical circle.
 *   It will rotate `[0,0,1]` to center of this circle, and rotate `[s,0,c]` to
 *   the point on this circle, which is origin of coordinate on the circle.
 */
class SphCircle
{
  constructor({center, radius, orientation}) {
    if ( orientation === undefined )
      orientation = q_align(center);
    if ( center === undefined )
      center = rotate([0,0,1], orientation);

    this.center = center;
    this.radius = radius;
    this.orientation = orientation;
  }

  shift(theta) {
    q_spin(this.orientation, theta*Q, this.orientation);
  }
  complement() {
    this.center = this.center.map(a => -a);
    this.radius = 2-this.radius;
    q_mul(this.orientation, [1,0,0,0], this.orientation);
  }
  rotate(q) {
    q_mul(this.orientation, q, this.orientation);
  }

  /**
   * Get position of vector projected onto this circle.
   * 
   * @param {number[]} vector - The vector to project.
   * @returns {number} The coordinate of projected vector.
   *   It has unit of quadrant (not modulus).
   */
  thetaOf(vector) {
    var [x, y] = rotate(vector, q_inv(this.orientation));
    return Math.atan2(y, x)/Q;
  }
  /**
   * Get vector of on this circle with given coordinate.
   * 
   * @param {number} theta - The coordinate of point on this circle.
   *   It should have unit of quadrant.
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
 * @property {number} length - Length of segment.
 *   It has unit of quadrant, and should range in (0, 4].
 * @property {number} angle - Angle bewteen this segment and previous segment.
 *   The direction is from this segment to previous segment.
 *   It has unit of quadrant, and should range in [0, 4].
 * @property {number} radius - Radius of curvature of segment.
 *   It has unit of quadrant, and should range in (0, 2).
 * @property {number[]} orientation - Orientation of this segment.
 *   It will rotate `[0,0,1]` to center of curvature of this segment, and rotate
 *   `[s,0,c]` to the starting vertex of this segment.
 * @property {number[]} vertex - starting vertex of this segment.
 * @property {SphCircle} circle - circle along this segment with same orientation.
 * @property {SphSeg} next - The next segment.
 * @property {SphSeg} prev - The previous segment.
 * @property {Map<SphSeg,number>} adj - The map of adjacent segments.
 *  where key is adjacent segment, and value is offset between vertices, range
 *  in (0, 4].
 * @property {SphElem} affiliation - The affiliation of this segment.
 * @property {SphLock} lock - The lock of this segment.
 */
class SphSeg
{
  constructor({length, angle, radius, orientation}) {
    this.length = length;
    this.angle = angle;
    this.radius = radius;
    this.orientation = orientation;

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
    return this;
  }

  rotate(q) {
    q_mul(q, this.orientation, this.orientation);
  }
}

/**
 * Element of sliding sphere.
 * It represent the region defined by boundaries (BREP).  The element without
 * boundary indicate full space of spherical surface.
 * 
 * @class
 * @property {SphSeg[]} boundaries - Segments of boundaries.
 */
class SphElem
{
  constructor() {
    this.boundaries = [];
  }

  accept(...segments) {
    for ( let seg of segments ) if ( !this.boundaries.includes(seg) ) {
      this.boundaries.push(seg);
      seg.affiliation = this;
    }
  }
  withdraw(...segments) {
    for ( let seg of segments ) if ( this.boundaries.includes(seg) ) {
      this.boundaries.splice(this.boundaries.indexOf(seg), 1);
      seg.affiliation = undefined;
    }
  }
  split(...groups) {
    var elements = [];
    for ( let group of groups ) if ( group.length ) {
      let elem = new SphElem();
      elem.accept(...group);
      elements.push(elem);
    }
    return elements;
  }
  merge(...elements) {
    for ( let element of elements ) if ( element !== this ) {
      element.boundaries.splice(0, element.boundaries.length);
      this.accept(...element.boundaries);
    }
  }

  rotate(q) {
    for ( let seg of this.boundaries )
      seg.rotate(q);
  }
}

/**
 * Lock of sliding sphere.
 * It represent the full circle of gap between elements, which is able to twist.
 * 
 * @class
 * @property {SphSeg[]} dash - Segments of boundaries.
 * @property {number} offset - Offset between the first segments in `dash`.
 * @property {SphCircle} circle - Circle of lock (left is inside).
 * @property {Map<number,object[]>} passwords - Possible nontrivial twist angle
 *   with possible matches.
 *   Where key is twist angle, value is corresponding matches.
 */
class SphLock
{
  constructor(dash=[]) {
    this.dash = dash;
    this.dual = undefined;
    this.offset = 0;
    this.passwords = undefined;
  }
  get circle() {
    return this.dash[0].circle;
  }

  pair(lock, offset) {
    this.dual = lock;
    lock.dual = this;
    this.offset = lock.offset = offset;
  }
  lock() {
    for ( let seg of this.dash )
      seg.lock = this;
    for ( let seg of this.dual.dash )
      seg.lock = this.dual;
  }
  unlock() {
    for ( let seg of this.dash )
      seg.lock = undefined;
    for ( let seg of this.dual.dash )
      seg.lock = undefined;
  }
}

/**
 * Sliding sphere.
 * 
 * @class
 */
class SlidingSphere
{
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
   *   point, range in [0, 2], with unit of quadrant;
   *   `len1` is length of `circle1` under `circle2`, range in [0, 4], with unit
   *   of quadrant;
   *   `len2` is length of `circle2` under `circle1`, range in [0, 4], with unit
   *   of quadrant.
   *   `meeted` is number of meet points between circles.
   */
  _relationTo(circle1, circle2) {
    var radius1 = circle1.radius;
    var radius2 = circle2.radius;
    var distance = angleTo(circle2.center, circle1.center)/Q;
    console.assert(fzy_cmp(distance, 0) >= 0 && fzy_cmp(distance, 2) <= 0);
    console.assert(fzy_cmp(radius1, 0) > 0 && fzy_cmp(radius1, 2) < 0);
    console.assert(fzy_cmp(radius2, 0) > 0 && fzy_cmp(radius2, 2) < 0);

    if ( fzy_cmp(distance, 0) == 0 && fzy_cmp(radius1, radius2) == 0 )
      return [0, undefined, undefined, undefined]; // equal
    else if ( fzy_cmp(distance, 2) == 0 && fzy_cmp(radius1 + radius2, 2) == 0 )
      return [2, undefined, undefined, undefined]; // complement
    else if ( fzy_cmp(distance, radius1 - radius2) <  0 )
      return [0, 0, 4, 0]; // include
    else if ( fzy_cmp(distance, radius1 - radius2) == 0 )
      return [0, 0, 4, 1]; // kissing include
    else if ( fzy_cmp(distance, radius1 + radius2) >  0 )
      return [2, 0, 0, 0]; // exclude
    else if ( fzy_cmp(distance, radius1 + radius2) == 0 )
      return [2, 0, 0, 1]; // kissing exclude
    else if ( fzy_cmp(4-distance, radius1 + radius2) <  0 )
      return [2, 4, 4, 0]; // anti-include
    else if ( fzy_cmp(4-distance, radius1 + radius2) == 0 )
      return [2, 4, 4, 1]; // kissing anti-include
    else if ( fzy_cmp(distance, radius2 - radius1) <  0 )
      return [0, 4, 0, 0]; // anti-exclude
    else if ( fzy_cmp(distance, radius2 - radius1) == 0 )
      return [0, 4, 0, 1]; // kissing anti-exclude
    else if ( distance < radius1 + radius2 )
      return [...this._intersect(radius1, radius2, distance), 2]; // intersect
    else
      throw new Error(`unknown case: [${radius1}, ${radius2}, ${distance}]`);
  }
  /**
   * Compute intersection between two circles.
   * 
   * @param {number} radius1 - Radius of the first circle to intersect, with
   *   unit of quadrant.
   * @param {number} radius2 - Radius of the second circle to intersect, with
   *   unit of quadrant.
   * @param {number} distance - Distance between centers of two circles, with
   *   unit of quadrant.
   * @returns {number[]} Information about intersection, which has values
   *   `[ang, len1, len2]` (see method `_relationTo`).
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
   * @param {number} angle - Tip angle of leaf shape, with unit of quadrant.
   * @param {number} radius1 - Radius of left edge of leaf shape, with unit of
   *   quadrant.  Center of curvature is at the right of edge.
   * @param {number} radius2 - Radius of right edge of leaf shape, with unit of
   *   quadrant.  Center of curvature is at the left of edge.
   * @returns {number[]} The lengths of left edge and right edge, which has
   *   values `[len1, len2]`, with unit of quadrant.
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
   * It will stop when return same segment or no next segment.
   * 
   * @param {SphSeg} seg0 - Start segment.
   * @yields {SphSeg} The segment walked through.
   * @returns {boolean} True if it return same segment.
   */
  *_walk(seg0) {
    var seg = seg0;
    do {
      yield seg;
      seg = seg.next;

      if ( seg === undefined )
        return false;
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
      for ( let seg of seg0._walk() ) {
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
   * @param {number} offset - Offset of point respect to vertex of `seg0`, with
   *   unit of quadrant, range in [0, `seg0.length`].
   * @param {number=} prefer - The prefer side when jumping to end point of segment.
   *   `+1` (default) means upper limit of offset; `-1` means lower limit of offset.
   * @returns {object[]} Segment and corresponding offset after jump, or empty
   *   array if no adjacent segment to jump.
   */
  _jump(seg0, offset, prefer=+1) {
    for ( let [adj_seg, theta] of seg0.adj ) {
      let offset_ = mod4(theta-offset, [0, adj_seg.length]);
      if ( adj_seg.length == 4 && offset_ == 0 )
        return prefer < 0 ? [adj_seg, 0] : [adj_seg, 4];
      if ( offset_ == 0 && prefer > 0 )
        continue;
      if ( offset_ == adj_seg.length && prefer < 0 )
        continue;
      if ( offset_ <= adj_seg.length )
        return [adj_seg, offset_];
    }
    return [];
  }
  /**
   * Clockwise spinning at a point, which is specified by segment and offset.
   * This generator will yield information when spining to another segment
   * passing through center.
   * It will stop when return same segment or no next segment.
   * 
   * @param {SphSeg} seg0 - The segment passing through center.
   * @param {number=} offset - Offset of center respect to vertex of `seg0`,
   *   with unit of quadrant, range in [0, `seg0.length`).
   * @yields {object[]} Information when spinning to segment, which has value
   *   `[angle, seg, offset]`:
   *   `angle` is spinning angle with unit of quadrant, which will snap to 0, 2;
   *   `seg` is segment passing through center;
   *   `offset` is offset of center.
   * @returns {boolean} True if it return same segment.
   */
  *_spin(seg0, offset=0) {
    var angle = 0, seg = seg0;

    do {
      yield [angle, seg, offset];

      [seg, offset] = this._jump(seg, offset, +1);

      if ( seg !== undefined ) {
        if ( seg.length == offset )
          [angle, seg, offset] = [angle+seg.next.angle, seg.next, 0];
        else
          angle += 2;
        angle = fzy_snap(angle, [0, 2, 4]);
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
   * @param {SphSeg} seg0 - The first segment starting ski.
   * @yields {SphSeg} Next segment along extended circle of the first segment.
   * @returns {boolean} True if it return same segment.
   */
  *_ski(seg0) {
    var seg = seg0;
    do {
      yield seg;
      
      let [adj_seg, adj_th] = this._jump(seg, seg.length, -1);
      let ang;
      for ( [ang, seg] of this._spin(adj_seg, adj_th) ) {
        let sgn = fzy_cmp([ang, seg.radius-1], [2, 1-adj_seg.radius]);
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
   * It have two cases: exclusive segments becomes inclusive segments in merge
   * case; inclusive segments becomes exclusive segments in split case.
   * 
   * @param {SphSeg} seg1 - The first segment to swap.
   * @param {SphSeg} seg2 - The second segment to swap.
   * @param {number} ang - angle from `seg1` to `seg2`, with unit of quadrant.
   *   It range in [0, 4] for merge case, and range in [-4, 0] for split case.
   */
  _swap(seg1, seg2, ang) {
    var [seg1_prev, seg2_prev] = [seg1.prev, seg2.prev];
    var [seg1_ang, seg2_ang] = [seg1.angle, seg2.angle];

    seg2_prev.connect(seg1);
    seg1_prev.connect(seg2);
    seg1.angle = seg2_ang + ang;
    seg2.angle = seg1_ang + 4-ang;
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
    theta = mod4(theta, [4, seg.length]);
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

    if ( seg.lock ) {
      let i = seg.lock.left.indexOf(seg);
      if ( i != -1 ) {
        seg.lock.left.splice(i, 0, next_seg);
        next_seg.lock = seg.lock;
      } else {
        i = seg.lock.right.indexOf(seg);
        console.assert(i != -1);
        seg.lock.right.splice(i, 0, next_seg);
        next_seg.lock = seg.lock;
      }
    }

    for ( let [adj_seg, offset] of seg.adj ) {
      // remove adjacent of segment
      if ( fzy_cmp(offset, seg.length + adj_seg.length) >= 0 )
        seg.adjacent(adj_seg);

      // add adjacent of next_seg
      let offset_ = mod4(offset - seg.length, [4, next_seg.length, adj_seg.length]);
      if ( fzy_cmp(offset_, next_seg.length + adj_seg.length) < 0 )
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
         || fzy_cmp(seg.angle, 2) != 0
         || fzy_cmp(seg.radius, seg.prev.radius) != 0
         || fzy_cmp(seg.circle.center, seg.prev.circle.center) != 0 )
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

    if ( seg.lock ) {
      let i = seg.lock.left.indexOf(seg);
      if ( i != -1 ) {
        seg.lock.left.splice(i, 1);
        if ( i == 0 ) {
          seg.lock.left.unshift(seg.lock.left.pop());
          seg.lock.offset += original_len;
        }
      } else {
        i = seg.lock.right.indexOf(seg);
        console.assert(i != -1);
        seg.lock.right.splice(i, 1);
        if ( i == 0 ) {
          seg.lock.right.unshift(seg.lock.right.pop());
          seg.lock.offset += original_len;
        }
      }
    }

    // merge adjacent
    for ( let [adj_seg, offset] of seg.adj ) {
      seg.adjacent(adj_seg);
      if ( !merged.adj.has(adj_seg) ) {
        let offset_ = mod4(offset + original_len, [4, merged.length, adj_seg.length]);
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

    // find end points of covers between segments
    var brackets = [];

    var offset1 = mod4(offset, [4, segment1.length]);
    if ( offset1 <= segment1.length )
      brackets.push([offset1, 0, -1]);
    var offset2 = mod4(offset, [4, segment2.length]);
    if ( offset2 <= segment2.length )
      brackets.push([0, offset2, +1]);
    var offset1_ = mod4(offset-segment2.length, [0, segment1.length, offset1]);
    if ( offset1_ != 0 && offset1_ < segment1.length )
      brackets.push([offset1_, segment2.length, +1]);
    var offset2_ = mod4(offset-segment1.length, [0, segment2.length, offset2]);
    if ( offset2_ != 0 && offset2_ < segment2.length )
      brackets.push([segment1.length, offset2_, -1]);
    brackets.sort(fzy_cmp);
    console.assert(brackets.length%2==0 && brackets.every((c,i) => c[2]==(-1)**i));

    // interpolate
    var offsets1 = new Set(brackets.map(([th1, th2]) => th1));
    var offsets2 = new Set(brackets.map(([th1, th2]) => th2));
    var contacts1 = new Map();
    var contacts2 = new Map();
    for ( let [contacts, segment, offsets] of [[contacts1, segment1, offsets1],
                                               [contacts2, segment2, offsets2]] )
      for ( let theta of [...offsets].sort().reverse() ) {
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
        this._swap(seg1, seg2, 2-ang1+ang2);

      if ( i % 2 == 1 ) {
        console.assert(seg2.next.next === seg2 && fzy_cmp(seg2.angle, 4) == 0);
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
   *   two directed tangent vector), with unit of quadrant, range in [-2, 2].
   *   `segment` is the segment that meets with circle;
   *   `offset` is offset of meet point along `segment`, with unit of quadrant,
   *   range in [0, `segment.length`);
   *   `circle` is the circle that segment meets with;
   *   `theta` is offset of meet point along `circle`, with unit of quadrant.
   */
  *_meetWith(segment, circle) {
    var circle_ = segment.circle;
    var [angle, len, len_, meeted] = circle_._relationTo(circle);
    var offset = 0, theta = 0;

    if ( meeted === undefined ) {
      theta = mod4(circle.thetaOf(segment.vertex));

      if ( angle == 0 ) angle = +0;
      if ( angle == 2 ) angle = -2;

      yield {angle, segment, offset, circle, theta};

    } else if ( meeted == 0 ) {
      return;

    } else if ( meeted == 1 ) {
      theta = mod4(circle.thetaOf(circle_.center)+len_/2);
      offset = mod4(circle_.thetaOf(circle.center)-len/2, [0, segment.length]);

      if ( angle == 0 && len == 4 ) angle = +0;
      if ( angle == 0 && len == 0 ) angle = -0;
      if ( angle == 2 && len == 4 ) angle = +2;
      if ( angle == 2 && len == 0 ) angle = -2;

      if ( offset < segment.length )
        yield {angle, segment, offset, circle, theta};

    } else if ( meeted == 2 ) {
      theta = mod4(circle.thetaOf(circle_.center)+len_/2);
      offset = mod4(circle_.thetaOf(circle.center)-len/2, [0, segment.length]);
      let meet1 = {angle, segment, offset, circle, theta};

      theta = mod4(circle.thetaOf(circle_.center)-len_/2);
      offset = mod4(circle_.thetaOf(circle.center)+len/2, [0, segment.length]);
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
      meet.theta = mod4(meet.theta, pos);

      let i, sgn;
      for ( i=0; i<pos.length; i++ ) {
        sgn = Math.sign(meet.theta-pos[i].theta);
        if ( sgn > 0 ) continue;
        else           break;
      }

      if ( sgn == 0 )
        mmeets[i].push(meet);
      else if ( sgn < 0 )
        mmeets.splice(i, 0, [meet]), pos[i] = meet.theta;
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
        fzy_cmp([mod4(ang), cur, i], pre_field) <= 0
        ? [+mod4(+ang), cur, i] : [-mod4(-ang), cur, i]);
      pre_beams = pre_beams.map(([ang, cur, i]) =>
        fzy_cmp([mod4(ang), cur, i], pre_field) <= 0
        ? [+mod4(+ang), cur, i] : [-mod4(-ang), cur, i]);

      // separate as in and out of field
      var in_beams = [], out_beams = [];
      for ( let beams of [pre_beams, post_beams] ) for ( let beam of beams ) {
        if ( fzy_cmp(beam, post_field) >= 0 )
          in_beams.push(beam);
        else
          out_beams.push(beam);
      }
      in_beams.sort(fzy_cmp);
      out_beams.sort(fzy_cmp);
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
          console.assert(j != -1 && j > i && j < end-1);
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
   * Check if point is inside the element, not including boundaries.
   * 
   * @param {number[]} point - The point to check.
   * @returns {boolean} True if point is in this element.
   */
  _contains(elem, point) {
    if ( elem.boundaries.length == 0 )
      return true;

    // make a circle passing through this point and a vertex of element
    var vertex = elem.boundaries[0].vertex;
    var radius = angleTo(point, vertex)/2/Q;
    if ( fzy_cmp(radius, 0) == 0 )
      return false;

    var orientation = q_mul(q_align(vertex, point), quaternion([0,1,0], radius*Q));
    var circle = new SphCircle({orientation, radius});

    var meets = elem.boundaries.flatMap(seg => this._meetWith(seg, circle));
    console.assert(meets.length > 0);
    meets = this._sortMeets(meets);
    if ( meets.find(meet => mod4(meet.theta, [0]) == 0) )
      return false;
    else
      return ["-0", "+-", "--"].includes(meets[0].type);
  }
  /**
   * Slice element by circle.
   * 
   * @param {SphCircle} elem - The element to slice.
   * @param {SphCircle} circle - The knife for slicing.
   * @returns {SphSeg[]} Sliced segments of both sides of `circle`.
   */
  _slice(elem, circle) {
    var circle_ = new SphCircle(circle).complement();

    // INTERPOLATE
    // find meet points and sort by `theta`
    var paths = [];
    for ( let loop of this._loops(elem.boundaries) )
      paths.push(loop.flatMap(seg => this._meetWith(seg, circle)));
    var meets = this._sortMeets(paths.flatMap(path => path));

    // interpolate
    for ( let path of paths ) for ( let meet of [...path].reverse() )
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
      let side = fzy_cmp(circle.radius, angleTo(circle.center, seg0.vertex)/Q) > 0;
      let segs = side ? in_segs : out_segs;

      for ( let seg of this._walk(seg0) ) {
        segs.add(seg);
        lost.delete(seg);
      }
    }

    // SLICE
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

        let length = fzy_snap(meet2.theta - meet1.theta, [0, 4]);
        if ( length == 0 ) {
          // connect two meets
          this._swap(meet2.segment, meet1.segment, meet1.angle-meet2.angle);

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

          this._swap(in_seg, meet1.segment, meet1.angle);
          this._swap(out_seg, meet2.segment, meet2.angle-2);

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
        inside = this._contains(elem, circle.vectorAt(0));

      if ( inside ) {

        let in_seg  = new SphSeg({length:4, angle:2, radius:circle.radius,
                                  orientation:circle.orientation});
        let out_seg = new SphSeg({length:4, angle:2, radius:circle_.radius,
                                  orientation:circle_.orientation});
        in_seg.connect(in_seg);
        out_seg.connect(out_seg);
        in_seg.adjacent(out_seg, 4);
        this.accept(in_seg);
        this.accept(out_seg);

        in_segs.add(in_seg);
        out_segs.add(out_seg);
      }
    }

    in_segs = [...in_segs];
    out_segs = [...out_segs];
    return [in_segs, out_segs];
  }

  /**
   * Find part of elements in a region separated by given boundaries.
   * 
   * @param {SphSeg[]} bd - the boundaries that separate region.
   * @param {SphElem[]=} region - The elements to pick, or all reachable
   *   elements by default.
   * @returns {Set<SphElem>} All elements divided by given boundaries, or
   *   `undefined` if given boundaries don't separate region as two parts.
   */
  _sideOf(bd, region) {
    var elems = new Set();
    for ( let seg of bd )
      if ( !region || region.includes(seg.affiliation) )
        elems.add(seg.affiliation);

    for ( let elem of elems ) for ( let seg of elem.boundaries )
      if ( !bd.includes(seg) ) for ( let adj_seg of seg.adj.keys() ) {
        if ( bd.includes(adj_seg) ) return;
        if ( !region || region.includes(adj_seg.affiliation) )
          elems.add(adj_seg.affiliation);
      }
    return elems;
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

    var left_lock = new SphLock(left);
    left_lock.lock();
    var right_lock = new SphLock(right);
    right_lock.lock();
    left_lock.pair(right_lock, offset);
    return [left_lock, right_lock];
  }
  /**
   * Twist lock with given angle.
   * 
   * @param {SphLock} lock - The lock to twist.
   * @param {number} theta - Twist angle.
   * @param {number=} side - side of lock to twist, "+1" means left side; "-1"
   *   means right side.
   */
  _twist(left_locks, right_locks, theta) {
    var bd = [...left_locks, ...right_locks].flatMap(lock => lock.dash);
    var elems = this._sideOf(bd);
    if ( elems === undefined )
      return false;

    // unlock
    for ( let seg0 of bd )
      for ( let [angle, seg, offset] of this._spin(seg0) )
        if ( offset == 0 && angle != 0 && angle != 2 )
          if ( seg.lock ) seg.lock.unlock();

    // twist
    var q = quaternion(left_locks[0].circle.center, theta*Q);
    for ( let elem of elems )
      elem.rotate(q);
    for ( let lock of left_locks )
      lock.offset = lock.dual.offset = mod4(lock.offset-theta);
    for ( let lock of right_locks )
      lock.offset = lock.dual.offset = mod4(lock.offset+theta);

    // relink adjacent segments
    for ( let seg of bd )
      seg.adj.clear();

    var offset1 = 0, offset2 = 0;
    for ( let lock of [...left_locks, ...right_locks] )
      for ( let seg1 of lock.dash ) {
        offset2 = 0;
        for ( let seg2 of lock.dual.dash ) {
          let offset = mod4(lock.offset-offset1-offset2, [4, seg1.length, seg2.length]);
          if ( fzy_cmp(offset, seg1.length+seg2.length) < 0 )
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

}

class SlidingSphereAnalyzer
{
  _elementsOfSide(lock, side=+1) {
    var bd = side > 0 ? lock.left : lock.right;
    var elems = new Set(bd.map(seg => seg.affiliation));
    for ( let elem of elems ) for ( let seg of elem.boundaries )
      if ( !bd.includes(seg) ) for ( let adj_seg of seg.adj.keys() )
        elems.add(adj_seg.affiliation);
    return elems;
  }
  _twist(lock, theta, side=+1) {
    theta = mod4(theta, lock.passwords.keys());
    var matches = lock.passwords.get(theta);

    // unlock
    for ( let seg0 of lock.left )
      for ( let [angle, seg, offset] of this._spin(seg0) )
        if ( offset == 0 && angle != 0 && angle != 2 )
          if ( seg.lock ) seg.lock.unlock();

    // twist and shift passwords
    var q = quaternion(lock.circle.center, Math.sign(side)*theta*Q);
    for ( let elem of this._elementsOfSide(lock, side) )
      for ( let seg of elem.boundaries )
        q_mul(q, seg.orientation, seg.orientation);
    lock.offset = mod4(lock.offset-theta);
    var new_passwords = new Map();
    for ( let [key, matches] of lock.passwords )
      new_passwords.set(mod4(key-theta, [0]), matches);
    lock.passwords = new_passwords;

    // relink adjacent segments
    for ( let segs of [lock.left, lock.right] )
      for ( let seg0 of segs )
        seg0.adj.clear();

    var offset1 = 0, offset2 = 0;
    for ( let seg1 of lock.left ) {
      offset2 = 0;
      for ( let seg2 of lock.right ) {
        let offset = mod4(lock.offset-offset1-offset2, [4]);
        if ( fzy_cmp(offset, seg1.length+seg2.length) < 0 )
          seg1.adjacent(seg2, offset);
        offset2 += seg2.length;
      }
      offset1 += seg1.length;
    }

    // lock
    if ( matches ) {
      for ( let [latch1, latch2] of matches ) {
        let segment = latch1.segment || latch2.segment;
        if ( segment ) {
          if ( !segment.lock ) this._buildLock(segment);
        } else {
          let seg0 = lock.left[latch1.j-1] || lock.left[lock.left.length-1];
          for ( let [angle, seg, offset] of this._spin(seg0) )
            if ( offset == 0 && angle != 0 && angle != 2 )
              if ( !seg.lock ) this._buildLock.unlock(seg);
        }
      }
    }
  }

  /**
   * Find profile of segments.
   * Profile are loops of segments that are adjacent to boundaries of
   * non-self-adjacent part.
   * 
   * @param {SphSeg[]} segments
   * @returns {SphSeg[][]} Profile of segments.
   */
  _findProfile(segments) {
    var uncovered = [];
    for ( let seg of segments ) {
      // find end points of covers between segments
      let brackets = [];
      for ( let [adj_seg, offset] of seg.adj ) if ( segments.includes(adj_seg) ) {
        let [segment1, segment2] = [seg, adj_seg];

        let offset1 = mod4(offset, [4, segment1.length]);
        if ( offset1 <= segment1.length )
          brackets.push([offset1, -1]);
        let offset2 = mod4(offset, [4, segment2.length]);
        if ( offset2 <= segment2.length )
          brackets.push([0, +1]);
        let offset1_ = mod4(offset-segment2.length, [0, segment1.length, offset1]);
        if ( offset1_ != 0 && offset1_ < segment1.length )
          brackets.push([offset1_, +1]);
        let offset2_ = mod4(offset-segment1.length, [0, segment2.length, offset2]);
        if ( offset2_ != 0 && offset2_ < segment2.length )
          brackets.push([segment1.length, -1]);
      }
      brackets.unshift([0, -1]);
      brackets.push([seg.length, +1]);
      brackets.sort(fzy_cmp);

      // find uncovered interval
      console.assert(brackets.length % 2 == 0);
      for ( let i=0; i<brackets.length; i+=2 ) {
        let [th1, s1] = brackets[i];
        let [th2, s2] = brackets[i+1];
        console.assert(s1<0 && s2>0);

        if ( fzy_cmp(th1, th2) != 0 )
          uncovered.push([seg, th1, th2]);
      }
    }

    // build segments of profile and connect them
    var profile = [];
    while ( uncovered.length ) {
      let i = 0;
      let ang_, seg_, th1_;
      let loop = [];
      do {
        let [[seg, th1, th2]] = uncovered.splice(i, 1);
        let length = fzy_cmp(th2-th1, seg.length);
        let {radius, orientation} = seg.circle.shift(th2).complement();
        let bd = new SphSeg({radius, length, orientation});
        bd.adj.set(seg, th2);
        loop.push(bd);

        for ( let tick of this._spin(bd) ) {
          if ( !segments.includes(tick[1]) )
            break;
          [ang_, seg_, th1_] = tick;
        }
        bd.angle = 4-ang_;
        i = uncovered.findIndex(([seg, th1]) => seg === seg_ && fzy_cmp(th1, th1_) == 0);
      } while ( i != -1 );
      console.assert(fzy_cmp(loop[0].adj.get(seg_)-loop[0].length, th1_) == 0);

      for ( let j=0; j<loop.length; j++ )
        loop[j].connect(loop[j-1] || loop[loop.length-1]);
      profile.push(loop);
    }

    return profile;
  }
  _parseNetworks(segments) {
    // network = {
    //   loops: [loop, ...],
    //   profile: [loop, ...],
    //   joints: [joint, ...],
    // },
    // joint = {
    //   networks: [network, ...],
    //   loops: [loop, ...],
    //   side: +1/-1,
    // },

    // find all connected networks
    var networks = [];
    var lost = new Set(segments);
    while ( lost.size ) {
      let seg0 = lost.values().next().value;
      let network = {loops:[], profile:[], joints:[]};

      let queue = new Set([seg0]);
      while ( queue.size ) {
        let seg0 = queue.values().next().value;
        let loop = [];
        for ( let seg of this._walk(seg0) ) {
          lost.delete(seg);
          queue.delete(seg);
          loop.push(seg);

          for ( let adj_seg of seg.adj.keys() )
            if ( lost.has(adj_seg) )
              queue.add(adj_seg);
        }

        network.loops.push(loop);
      }

      networks.push(network);
    }

    // find profile of networks
    for ( let network of networks ) {
      network.profile = this._findProfile(network.loops.flatMap(loop => loop));
    }

    // determine relation between networks
    var vertex0 = networks[0].loops[0][0].vertex;
    var locals = new Set(networks.slice(1));
    while ( locals.size ) {
      // build circle pass through multiple networks (start from the first network)
      let network = locals.values().next().value;
      let vertex = network.loops[0][0].vertex;
      let radius = 1;
      let orientation = q_mul(q_align(vertex0, vertex), [-0.5, -0.5, -0.5, 0.5]);
      let circle = new SphCircle({orientation, radius});

      // find and sort meets
      let meets = [];
      for ( let network of networks ) for ( let loops of [network.loops, network.profile] )
        for ( let loop of loops ) for ( let seg of loop )
          for ( let meet of this._meetWith(seg, circle) ) {
            meet.theta = mod4(meet.theta, meets.map(mmeet => mmeet[0].theta));

            let i, sgn;
            for ( i=0; i<meets.length; i++ ) {
              sgn = Math.sign(meet.theta-meets[i][0].theta);
              if ( sgn > 0 ) continue;
              else           break;
            }

            if ( sgn == 0 )
              meets[i].push(meet);
            else if ( sgn < 0 )
              meets.splice(i, 0, [meet]);
            else
              meets.push([meet]);
          }
      meets = meets.flatMap(mmeet => this.solveScattering(mmeet));
      // make sure meeting starts from the first network
      while ( meets[0].segment !== networks[0].loops[0][0] )
        meets.push(meets.shift());

      // build joints
      for ( let i=0; i<meets.length; i++ )
        if ( ["+0", "+-", "--"].includes(meets[i].type) ) {
          let meet1 = meets[i];
          let meet2 = meets[i+1] || meets[0];
          console.assert(["-0", "+-", "--"].includes(meet2.type));

          // find joint loops
          let subjoint1, subjoint2;
          for ( let network of networks ) {
            let loop = network.loops.find(loop => loop.includes(meet1.segment));
            if ( loop ) {
              subjoint1 = [network, loop, +1];
              break;
            }
            loop = network.profile.find(loop => loop.includes(meet1.segment));
            if ( loop ) {
              subjoint1 = [network, loop, -1];
              break;
            }
          }
          for ( let network of networks ) {
            let loop = network.loops.find(loop => loop.includes(meet2.segment));
            if ( loop ) {
              subjoint2 = [network, loop, +1];
              break;
            }
            loop = network.profile.find(loop => loop.includes(meet2.segment));
            if ( loop ) {
              subjoint2 = [network, loop, -1];
              break;
            }
          }
          console.assert(subjoint1 && subjoint2 && subjoint1[2]==subjoint2[2]);

          if ( subjoint1[0] === subjoint2[0] ) {
            console.assert(subjoint1[1] === subjoint2[1]);
            continue;
          }

          // connect networks
          let joint1 = subjoint1[0].joints.find(joint => joint.loops.includes(subjoint1[1]));
          let joint2 = subjoint2[0].joints.find(joint => joint.loops.includes(subjoint2[1]));
          console.assert(joint1&&joint2 ? joint1===joint2 : true);

          let joint = joint1 || joint2 || {networks:[], loops:[], side:subjoint1[2]};
          if ( !joint.loops.includes(subjoint1[1]) ) {
            joint.networks.push(subjoint1[0]);
            joint.loops.push(subjoint1[1]);
            locals.delete(subjoint1[0]);
          }
          if ( !joint.loops.includes(subjoint2[1]) ) {
            joint.networks.push(subjoint2[0]);
            joint.loops.push(subjoint2[1]);
            locals.delete(subjoint2[0]);
          }
          if ( !subjoint1[0].joints.includes(joint) )
            subjoint1[0].joints.push(joint);
          if ( !subjoint2[0].joints.includes(joint) )
            subjoint2[0].joints.push(joint);
        }
    }
  }
  _separateConnectedPart(segments) {
    // ...
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
    var [segment0, offset0] = this._jump(prev_seg, prev_seg.length, -1);

    var subticks = [], pre = [], post = [];
    var angle, segment, offset;
    for ( [angle, segment, offset] of this._spin(segment0, offset0) ) {
      let side = fzy_cmp([angle, segment.radius-1], [2, 1-segment0.radius]);
      if ( side == 0 ) break;
      if ( side >  0 ) return;

      if ( angle == 0 )
        pre.push(segment);
      else if ( angle == 2 )
        post.push(segment);
      else
        subticks.push({angle, segment});
    }

    var is_free = false;
    for ( let seg1 of pre )
      if ( post.find(seg2 => fzy_cmp(2-seg1.radius, seg2.radius) == 0) ) {
        is_free = true;
        break;
      }

    return {segment, subticks, is_free};
  }
  _detectLatches(ticks) {
    var latches = []; // [{length, center, segment, i, j}, ...]

    // find latches (center of possible intercuting circle)
    // find all free latches
    var free_ind = ticks.flatMap(({is_free}, i) => is_free ? [i] : []);
    for ( let i of free_ind ) for ( let j of free_ind ) if ( i < j ) {
      let length = ticks[j].theta - ticks[i].theta;
      let center = mod4(ticks[i].theta+length/2);

      switch ( fzy_cmp(length, 2) ) {
        case -1:
          latches.push({length, center, i, j});
          break;

        case +1:
          length = 4 - length;
          center = mod4(center+2);
          [i, j] = [j, i];
          latches.push({length, center, i, j});
          break;

        case 0:
          length = 2;
          latches.push({length, center, i, j});
          center = mod4(center+2);
          [i, j] = [j, i];
          latches.push({length, center, i, j});
          break;
      }
    }

    // find normal latches
    var normal_ind = ticks.flatMap(({is_free}, i) => is_free ? [] : [i]);
    for ( let j of normal_ind ) {
      let radius0 = ticks[j].segment.radius;

      while ( ticks[j].subticks.length ) {
        let subtickj = ticks[j].subticks.pop();
        let [length] = this._leaf(subtickj.angle, radius0, subtickj.segment.radius);
        let center = mod4(ticks[j].theta-length/2);

        let i = ticks.findIndex(tick => mod4(ticks[j].theta-tick.theta, [length]) == length);
        if ( i == -1 ) continue;
        if ( !ticks[i].is_free ) {
          let x = ticks[i].subticks
            .findIndex(subticki => fzy_cmp([2-subticki.angle, 2-subticki.segment.radius],
                                           [  subtickj.angle,   subtickj.segment.radius]) == 0);
          if ( x == -1 ) continue;
          ticks[i].subticks.splice(x, 1);
        }

        let segment = subtickj.segment;
        switch ( fzy_cmp([length, segment.radius], [2, 1]) ) {
          case -1:
            latches.push({length, center, segment, i, j});
            break;

          case +1:
            length = 4 - length;
            center = mod4(center+2);
            [segment] = this._jump(segment, 0, +1);
            [i, j] = [j, i];
            latches.push({length, center, segment, i, j});
            break;

          case 0:
            length = 2;
            latches.push({length, center, segment, i, j});
            center = mod4(center+2);
            [segment] = this._jump(segment, 0, +1);
            [i, j] = [j, i];
            latches.push({length, center, segment, i, j});
            break;
        }
      }
    }

    return latches;
  }
  _buildLock(segment) {
    var [segment2, offset] = segment.adj.entries().next().value;
    var ticks1 = [], ticks2 = [];
    for ( let [seg0, ticks] of [[segment, ticks1], [segment2, ticks2]] ) {

      let seg = seg0;
      do {
        let tick = this._makeTick(seg);
        if ( !tick ) return;
        ticks.push(tick);
        seg = tick.segment;
      } while ( seg != seg0 );
      ticks.unshift(ticks.pop());

      let full_len = ticks.reduce((acc, tick) => (tick.theta=acc)+tick.segment.length, 0);
      console.assert(fzy_cmp(full_len, 4) == 0);
    }

    var lock = new SphLock();
    lock.offset = offset;
    lock.left = ticks1.map(tick => tick.segment);
    lock.right = ticks2.map(tick => tick.segment);
    var latches1 = this._detectLatches(ticks1);
    var latches2 = this._detectLatches(ticks2);

    lock.passwords = new Map();
    var keys = new Set([0]);
    for ( let latch1 of latches1 ) for ( let latch2 of latches2 )
      if ( fzy_cmp([latch1.length, latch1.segment.radius],
                   [latch2.length, latch2.segment.radius]) == 0 ) {
        let key = mod4(offset-latch1.center-latch2.center, keys);
        keys.add(key);
        if ( !lock.passwords.has(key) )
          lock.passwords.set(key, []);
        lock.passwords.get(key).push([latch1, latch2]);
      }

    lock.lock();

    return lock;
  }
  _decipher(lock) {
    var ticks1 = [], ticks2 = [];
    for ( let [segs, ticks] of [[lock.left, ticks1], [lock.right, ticks2]] ) {

      for ( let i=0; i<segs.length; i++ ) {
        let seg = segs[i-1] || segs[segs.length-1];
        let tick = this._makeTick(seg);
        console.assert(tick && tick.segment === segs[i]);
        ticks.push(tick);
      }

      let full_len = ticks.reduce((acc, tick) => (tick.theta=acc)+tick.segment.length, 0);
      console.assert(fzy_cmp(full_len, 4) == 0);
    }

    var latches1 = this._detectLatches(ticks1);
    var latches2 = this._detectLatches(ticks2);

    lock.passwords = new Map();
    var keys = new Set([0]);
    for ( let latch1 of latches1 ) for ( let latch2 of latches2 ) {
      let test;
      if ( latch1.segment.radius !== undefined && latch2.segment.radius !== undefined )
        test = fzy_cmp([latch1.length, latch1.segment.radius],
                       [latch2.length, latch2.segment.radius]) == 0;
      else
        test = fzy_cmp(latch1.length, latch2.length) == 0;

      if ( test ) {
        let key = mod4(lock.offset-latch1.center-latch2.center, keys);
        keys.add(key);
        if ( !lock.passwords.has(key) )
          lock.passwords.set(key, []);
        lock.passwords.get(key).push([latch1, latch2]);
      }
    }
  }
}
