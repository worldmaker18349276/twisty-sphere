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
 * 
 * @class
 * @property {number[]} center - Center of spherical circle.
 *   It must be normalized vector.
 * @property {number} radius - Radius of spherical circle.
 *   It is under the unit of quadrant, and range in (0, 2).
 * @property {number[]} orientation - Orientation of spherical circle.
 *   It will rotate `[0,0,1]` to center of spherical circle.  The ambiguity will
 *   affect the return value of method `thetaOf` and `vectorAt`.
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
  complement() {
    var center = this.center.map(a => -a);
    var radius = 2-this.radius;
    var orientation = q_mul(this.orientation, [1,0,0,0]);
    return new SphCircle({center, radius, orientation});
  }
  thetaOf(vector) {
    var [x, y] = rotate(vector, q_inv(this.orientation));
    return Math.atan2(y, x)/Q;
  }
  vectorAt(theta) {
    var vec = [
      Math.sin(this.radius*Q)*Math.cos(theta*Q),
      Math.sin(this.radius*Q)*Math.sin(theta*Q),
      Math.cos(this.radius*Q)
    ];
    return rotate(vec, this.orientation);
  }

  /**
   * Check if point is inside this circle.
   *
   * @param {number[]} point - The point to check.
   * @returns {boolean} True if point is in this circle.
   */
  contains(point) {
    var distance = angleTo(this.center, point)/Q;
    return fzy_cmp(this.radius, distance) > 0;
  }

  /**
   * Determine relation between circles.
   * It will return `[ang, len1, len2, meeted]`, which is information about
   * overlapping region for intersect cases, otherwise those values are
   * determined by limitation from intersect cases.
   * All relations can be classified as: equal, complement, (kissing) include,
   * (kissing) exclude, (kissing) anti-include, (kissing) anti-exclude, and
   * intersect.  Where kissing means two circles touch at one point; anti means
   * exchanging roles of two circles.
   * Except for intersect cases, they have certain return values:  
   *                    equal: `[0, undefined, undefined, undefined]`  
   *               complement: `[2, undefined, undefined, undefined]`  
   *        (kissing) include: `[0, 0, 4, 0|1]`                        
   *        (kissing) exclude: `[2, 0, 0, 0|1]`                        
   *   (kissing) anti-include: `[2, 4, 4, 0|1]`                        
   *   (kissing) anti-exclude: `[0, 4, 0, 0|1]`                        
   *
   * @param {SphCircle} circle - The circle to compare
   * @returns {Array} Information about meet points between circles, which has
   *   values `[ang, len1, len2, meeted]`.
   *   `ang` is angle between `this` and `circle` at meet point (angle between
   *   two directed tangent vector), with unit of quadrant;
   *   `len1` is length of `this` under `circle`, with unit of quadrant;
   *   `len2` is length of `circle` under `this`, with unit of quadrant;
   *   `meeted` is number of meet points between circles.
   */
  relationTo(circle) {
    var distance = angleTo(circle.center, this.center)/Q;
    console.assert(distance >= 0 && distance <= 2);
    console.assert(this.radius >= 0 && this.radius <= 2);
    console.assert(circle.radius >= 0 && circle.radius <= 2);

    // return [angle, length1, length2, meeted]
    if ( fzy_cmp(distance, 0) == 0 && fzy_cmp(this.radius, circle.radius) == 0 )
      return [0, undefined, undefined, undefined]; // equal
    else if ( fzy_cmp(distance, 2) == 0 && fzy_cmp(this.radius + circle.radius, 2) == 0 )
      return [2, undefined, undefined, undefined]; // complement
    else if ( fzy_cmp(distance, this.radius - circle.radius) <  0 )
      return [0, 0, 4, 0]; // include
    else if ( fzy_cmp(distance, this.radius - circle.radius) == 0 )
      return [0, 0, 4, 1]; // kissing include
    else if ( fzy_cmp(distance, this.radius + circle.radius) >  0 )
      return [2, 0, 0, 0]; // exclude
    else if ( fzy_cmp(distance, this.radius + circle.radius) == 0 )
      return [2, 0, 0, 1]; // kissing exclude
    else if ( fzy_cmp(4-distance, this.radius + circle.radius) <  0 )
      return [2, 4, 4, 0]; // anti-include
    else if ( fzy_cmp(4-distance, this.radius + circle.radius) == 0 )
      return [2, 4, 4, 1]; // kissing anti-include
    else if ( fzy_cmp(distance, circle.radius - this.radius) <  0 )
      return [0, 4, 0, 0]; // anti-exclude
    else if ( fzy_cmp(distance, circle.radius - this.radius) == 0 )
      return [0, 4, 0, 1]; // kissing anti-exclude
    else if ( distance < this.radius + circle.radius ) {
      // intersect
      var [ang, len1, len2] = SphCircle._intersect(this.radius, circle.radius, distance);
      return [ang, len1, len2, 2];
    }
    else
      throw `unknown case: distance=${distance}, radius1=${this.radius}, radius2=${circle.radius}`;
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
   *   `[ang, len1, len2]`;
   *   `ang` is angle between their directed tangent vectors at meet point,
   *   range in (0, 2), with unit of quadrant;
   *   `len1` is length of the first circle under the second circle, range in
   *   (0, 4), with unit of quadrant;
   *   `len2` is length of the second circle under the first circle, range in
   *   (0, 4), with unit of quadrant.
   */
  static _intersect(radius1, radius2, distance) {
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
   * Given tip angle and radius of edges of leaf shape, compute length of edges.
   * 
   * @param {number} angle - Tip angle of leaf shape, with unit of quadrant.
   * @param {number} radius1 - Radius of left edge of leaf shape, with unit of
   *   quadrant.  Notice that center of curvature is at the right of edge.
   * @param {number} radius2 - Radius of right edge of leaf shape, with unit of
   *   quadrant.  Notice that center of curvature is at the left of edge.
   * @returns {number[]} The lengths of left edge and right edge, which has
   *   values `[len1, len2]`, with unit of quadrant.
   */
  static _leaf(angle, radius1, radius2) {
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
}

/**
 * Spherical segment of element of sliding sphere.
 * 
 * @class
 * @property {number} length - Length of segment with unit of quadrant.
 *   It should range in (0, 4].
 * @property {number} angle - Angle bewteen this segment and previous segment.
 *   It has unit of quadrant, and should range in [0, 2].
 * @property {number} radius - Radius of curvature of segment.
 *   It has unit of quadrant, and should range in (0, 2).
 * @property {number[]} orientation - Orientation of this segment.
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
    this.parent = undefined;
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

  _loop_connect(seg) {
    [this.next, seg.prev] = [seg, this];
  }
  _adj_link(seg, offset) {
    this.adj.set(seg, offset);
    seg.adj.set(this, offset);
    return this;
  }
  _adj_unlink(seg) {
    this.adj.delete(seg);
    seg.adj.delete(this);
    return this;
  }

  *walk(stop) {
    var seg = this;
    do {
      yield seg;
      seg = seg.next;
    } while ( ![undefined, this, stop].includes(seg) );
  }
  *turn(offset=0, region) {
    var seg = this;
    var angle = 0;

    do {
      yield [angle, seg, offset];

      let adj = [...seg.adj.entries()];
      adj = adj.map(([seg_, th]) => [seg_, mod4(th-offset, [4, seg_.length])]);
      [seg, offset] = adj.find(([seg_, th_]) => seg_.length >= th_) || [];

      if ( seg !== undefined ) {
        if ( seg.length > offset )
          angle += 2;
        else if ( seg.length == offset )
          [seg, offset, angle] = [seg.next, 0, angle+seg.angle];
        else
          console.assert(false);
      }

      if ( seg === undefined )
        break;
      if ( region && !region.includes(seg) )
        break;

    } while ( seg !== this );
    console.assert(seg !== this || fzy_cmp(angle, 4) == 0);
  }

  /**
   * Split this segment into two segments.
   * this segment will be in-place modified as the first part, and create new
   * object as the second part.
   * 
   * @param {number} theta - The position to split.
   * @returns {SphSeg} The second part segment after splitting.
   */
  interpolate(theta) {
    theta = mod4(theta);
    if ( theta <= 0 || this.length - theta <= 0 )
      throw new Error("out of range of interpolation");

    // make next segment started from point of interpolation
    var next_seg = new SphSeg({
      length: this.length - theta,
      angle: 2,
      radius: this.radius,
      orientation: q_spin(this.orientation, theta*Q)
    });
    this.length = theta;

    // merge loop
    if ( this.next )
      next_seg._loop_connect(this.next);
    this._loop_connect(next_seg);
    if ( this.parent )
      this.parent._aff_add(next_seg);

    for ( let [adj_seg, offset] of this.adj ) {
      // remove adjacent of this
      if ( fzy_cmp(offset, this.length + adj_seg.length) >= 0 )
        this._adj_unlink(adj_seg);

      // add adjacent of next_seg
      let offset_ = mod4(offset - this.length, [4, next_seg.length, adj_seg.length]);
      if ( fzy_cmp(offset_, next_seg.length + adj_seg.length) < 0 )
        next_seg._adj_link(adj_seg, offset_);
    }

    return next_seg;
  }
  /**
   * Merge this segment with the previous segment, and remove this segment.
   * The radius and center of them must be same, and this segment cannot be
   * self connected.
   * 
   * @returns {SphSeg} The removed segment `this`.
   */
  mergePrev() {
    if ( fzy_cmp(this.angle, 2) != 0
         || fzy_cmp(this.radius, this.prev.radius) != 0
         || fzy_cmp(this.circle.center, this.prev.circle.center) != 0
         || this === this.prev )
      throw new Error("unable to merge segments");

    // merge segment
    var merged = this.prev;
    var original_len = merged.length;
    merged.length = merged.length + this.length;

    // merge loop
    if ( this.next )
      this.prev._loop_connect(this.next);
    else
      this.prev.next = undefined;
    if ( this.parent )
      this.parent._aff_delete(this);

    // merge adjacent
    for ( let [adj_seg, offset] of this.adj ) {
      this._adj_unlink(adj_seg);
      if ( !merged.adj.has(adj_seg) ) {
        let offset_ = mod4(offset + original_len, [4, merged.length, adj_seg.length]);
        merged._adj_link(adj_seg, offset_);
      }
    }

    if ( merged.next === merged ) {
      merged.length = 4;
      merged.angle = 2;
    }

    return this;
  }
  /**
   * Glue adjacent together.
   * 
   * @param {SphSeg} segment - The adjacent segment to glue; they must have same parent.
   */
  glueAdjacent(segment) {
    if ( !this.adj.has(segment) || this.parent !== segment.parent )
      throw new Error("unable to glue segments");

    // find contact points
    var contacts = [];
    var offset = this.adj.get(segment);
    if ( fzy_cmp(offset, segment.length) <= 0 )
      contacts.push([0, offset]);
    if ( fzy_cmp(offset, this.length) <= 0 )
      contacts.push([offset, 0]);
    var offset2 = mod4(offset-segment.length, [0, this.length, offset]);
    if ( offset2 != 0 && offset2 < this.length )
      contacts.push([offset2, segment.length]);
    var offset2_ = mod4(offset-this.length, [0, segment.length, offset]);
    if ( offset2_ != 0 && offset2_ < segment.length )
      contacts.push([this.length, offset2_]);
    contacts.sort();
    console.assert(contacts.length % 2 == 0);

    // interpolate
    var zippers = [];
    for ( let [theta1, theta2] of contacts ) {
      let seg1 = this;
      let ang1 = 0;
      while ( fzy_cmp(theta1, seg1.length) >= 0 ) {
        theta1 = theta1 - seg1.length;
        seg1 = seg1.next;
        if ( fzy_cmp(seg1.angle, 2) != 0 )
          ang1 = ang1 + 2 - seg1.angle;
      }
      if ( fzy_cmp(theta1, 0) > 0 ) {
        seg1 = seg1.interpolate(theta1);
        theta1 = 0;
      }
      console.assert(fzy_cmp(theta1, 0) == 0);
      
      let seg2 = segment;
      let ang2 = 0;
      while ( fzy_cmp(theta2, seg2.length) >= 0 ) {
        theta2 = theta2 - seg2.length;
        seg2 = seg2.next;
        if ( fzy_cmp(seg2.angle, 2) != 0 )
          ang2 = ang2 + 2 - seg2.angle;
      }
      if ( fzy_cmp(theta2, 0) > 0 ) {
        seg2 = seg2.interpolate(theta2);
        theta2 = 0;
      }
      console.assert(fzy_cmp(theta2, 0) == 0);

      zippers.push([seg1, seg2, ang1-ang2+2]);
    }

    // zip
    var parent = this.parent;
    for ( let i=0; i<zippers.length; i++ ) {
      let [seg1, seg2, ang] = zippers[i];
      let [seg1_prev, seg2_prev] = [seg1.prev, seg2.prev];
      let [seg1_ang, seg2_ang] = [seg1.angle, seg2.angle];

      seg2_prev._loop_connect(seg1);
      seg1_prev._loop_connect(seg2);
      seg1.angle = seg2_ang + 4-ang;
      seg2.angle = seg1_ang + ang;

      if ( i % 2 == 1 ) {
        console.assert(seg2.next.next === seg2 && fzy_cmp(seg2.angle, 4) == 0);
        parent._aff_delete(seg2);
        parent._aff_delete(seg2.prev);
      }
    }
  }

  /**
   * Find meet point between this segment and circle.
   * They can meet at the start point of segment, but not at the end point of segment.
   * 
   * @param {SphCircle} circle - The circle wanted to meet with.
   * @yields {object} Information about meet point, which has values
   *   `{angle, segment, offset, circle, theta}`.
   *   `angle` is angle between `this` and `circle` at meet point (angle between
   *   two directed tangent vector), with unit of quadrant;
   *   `segment` is the segment meeting with circle;
   *   `offset` is offset of meet point along `this.circle`, with unit of quadrant;
   *   `theta` is offset of meet point along `circle`, with unit of quadrant.
   */
  *meetWith(circle) {
    var seg_circ = this.circle;
    var [angle, len, len_, meeted] = seg_circ.relationTo(circle);
    var segment = this, offset = 0, theta = 0;

    if ( meeted === undefined ) {
      theta = mod4(circle.thetaOf(this.vertex));

      if ( angle == 0 ) angle = +0;
      if ( angle == 2 ) angle = -2;

      yield {angle, segment, offset, circle, theta};

    } else if ( meeted == 0 ) {
      return;

    } else if ( meeted == 1 ) {
      theta = mod4(circle.thetaOf(seg_circ.center)+len_/2);
      offset = mod4(seg_circ.thetaOf(circle.center)-len/2, [0, this.length]);

      if ( angle == 0 && len == 4 ) angle = +0;
      if ( angle == 0 && len == 0 ) angle = -0;
      if ( angle == 2 && len == 4 ) angle = +2;
      if ( angle == 2 && len == 0 ) angle = -2;

      if ( offset < this.length )
        yield {angle, segment, offset, circle, theta};

    } else if ( meeted == 2 ) {
      theta = mod4(circle.thetaOf(seg_circ.center)+len_/2);
      offset = mod4(seg_circ.thetaOf(circle.center)-len/2, [0, this.length]);
      let meet1 = {angle, segment, offset, circle, theta};

      theta = mod4(circle.thetaOf(seg_circ.center)-len_/2);
      offset = mod4(seg_circ.thetaOf(circle.center)+len/2, [0, this.length]);
      angle = -angle;
      let meet2 = {angle, segment, offset, circle, theta};

      if ( meet2.offset < meet1.offset )
        [meet1, meet2] = [meet2, meet1];
      if ( meet1.offset < this.length )
        yield meet1;
      if ( meet2.offset < this.length )
        yield meet2;

    }
  }
  /**
   * Classify type of meets and sort.
   * This function will add type property to meet.  Type has format "[+-][0+-]".
   * The first character is start side respect to circle: "+" means in circle;
   * "-" means out of circle.  The second character is direction of U-turn: "+"
   * means left U-turn; "-" means right U-turn; "0" means no turn, pass through
   * circle.  Cross-meets have type "[+-]0", and touch-meets have type "[+-][+-]".
   * If two touch-meets has inclusion relation, properties submeet/supermeet
   * will be added to meet object.
   * 
   * @param {object[]} meets - The meets to solve, which are at the same point.
   * @returns {object[]} Sorted meets.
   */
  static solveScattering(meets) {
    if ( !meets.every(({circle, theta}) => circle === meets[0].circle
                                           && mod4(theta-meets[0].theta, [0]) == 0) )
      throw new Error("not scattering at the same position");

    // convert to beams: [angle, curvature, pseudo_index]
    var post_beams = meets.map(({angle, segment, offset}, index) =>
        [              angle,      1-segment.radius, +(index+1)]);
    var  pre_beams = meets.map(({angle, segment, offset}, index) =>
      offset == 0
      ? [segment.angle+angle, segment.prev.radius-1, -(index+1)]
      : [            2+angle,      segment.radius-1, -(index+1)]);
    var post_field = [0, 1-meets[0].circle.radius, +0];
    var  pre_field = [2, meets[0].circle.radius-1, -0];

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
        let submeet = meets[Math.abs(beams[i])-1];

        let j = beams.indexOf(-beams[i]);
        console.assert(j != -1 && j > i && j < end);
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
        let meet = meets[Math.abs(beams[i])-1];
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
    var parsed = [];
    in_parsed.reverse();
    while ( true ) {
      let  in_i =  in_parsed.findIndex(meet => meet.type[1] == "0");
      let out_i = out_parsed.findIndex(meet => meet.type[1] == "0");

      if ( in_i != -1 ) {
        console.assert(in_parsed[in_i] === out_parsed[out_i]);
        parsed.push(...in_parsed.splice(0, in_i));
        parsed.push(...out_parsed.splice(0, out_i));
        let meet = in_parsed.shift();
        out_parsed.shift();
        parsed.push(meet);

      } else {
        console.assert(out_i == -1);
        parsed.push(...in_parsed);
        parsed.push(...out_parsed);
        break;
      }
     }

    return parsed;
  }
}

/**
 * Element of sliding sphere.
 * 
 * @class
 * @property {SphSeg[]} children - Segments of boundaries.
 */
class SphElem
{
  constructor() {
    this.children = [];
  }

  _aff_add(...segments) {
    for ( let seg of segments ) if ( !this.children.includes(seg) ) {
      this.children.push(seg);
      seg.parent = this;
    }
  }
  _aff_delete(...segments) {
    for ( let seg of segments ) if ( this.children.includes(seg) ) {
      this.children.splice(this.children.indexOf(seg), 1);
      seg.parent = undefined;
    }
  }
  split(...groups) {
    var elements = [];
    for ( let group of groups ) if ( group.length ) {
      let elem = new SphElem();
      elements.push(elem);
      for ( let seg of group )
        elem._aff_add(seg);
    }
    return elements;
  }
  merge(...elements) {
    for ( let element of elements ) if ( element !== this )
      this._aff_add(...element.children);
  }

  *loops() {
    var segments = new Set(this.children);
    for ( let seg0 of segments ) {
      let loop = [];
      for ( let seg of seg0.walk() ) {
        segments.delete(seg);
        loop.push(seg);
      }
      yield loop;
    }
  }

  /**
   * Check if point is inside this element.
   * 
   * @param {number[]} point - The point to check.
   * @returns {boolean} True if point is in this element.
   */
  contains(point) {
    if ( this.children.length == 0 )
      return true;

    // make a circle passing through this point and a vertex of element
    var vertex = this.children[0].vertex;
    var radius = angleTo(point, vertex)/2/Q;
    if ( fzy_cmp(radius, 0) == 0 )
      return false;

    var orientation = q_mul(q_align(vertex, point), quaternion([0,1,0], radius*Q));
    var circle = new SphCircle({orientation, radius});

    var min_meets;
    for ( let seg of this.children ) for ( let meet of seg.meetWith(circle) ) {
      let min_theta = min_meets ? min_meets[0].theta : 4;

      meet.theta = mod4(meet.theta, [0, min_theta]);
      if ( meet.theta == 0 )
        return false;
      else if ( meet.theta == min_theta )
        min_meets.push(meet);
      else if ( meet.theta <  min_theta )
        min_meets = [meet];
    }
    min_meets = SphSeg.solveScattering(min_meets, circle);

    var side = ["-0", "+-", "--"].includes(min_meets[0].type);
    return side;
  }
  // find boundaries of this element
  boundaries() {
    var profile = [];
    for ( let seg of this.children ) {
      // find contact points of adjacent segment
      let contacts = [];
      for ( let [adj_seg, offset] of seg.adj ) {
        if ( fzy_cmp(offset, adj_seg.length) <= 0 )
          contacts.push([0, +1]);
        if ( fzy_cmp(offset, seg.length) <= 0 )
          contacts.push([offset, -1]);
        let offset2 = mod4(offset-adj_seg.length, [0, seg.length, offset]);
        if ( offset2 != 0 && offset2 < seg.length )
          contacts.push([offset2, +1]);
        let offset2_ = mod4(offset-seg.length, [0, adj_seg.length, offset]);
        if ( offset2_ != 0 && offset2_ < adj_seg.length )
          contacts.push([seg.length, -1]);
      }
      contacts.unshift([0, -1]);
      contacts.push([seg.length, +1]);
      contacts.sort(fzy_cmp);

      // find uncovered interval
      console.assert(contacts.length % 2 == 0);
      for ( let i=0; i<contacts.length; i+=2 ) {
        let [th1, s1] = contacts[i];
        let [th2, s2] = contacts[i+1];
        console.assert(s1>0 && s2<0);

        if ( fzy_cmp(th1, th2) != 0 )
          profile.push([seg, th1, th2]);
      }
    }

    // build boundaries and connect them
    var loops = [];
    while ( profile.length ) {
      let i = 0, next;
      let seg_, th1_;
      let loop = [];
      do {
        let [[seg, th1, th2]] = profile.splice(i, 1);
        let bd = new SphSeg({radius:2-seg.radius, length:th2-th1});
        bd.adj.set(seg, th2);
        loop.push(bd);
        if ( next ) bd._loop_connect(next);
        next = bd;

        [bd.angle, seg_, th1_] = [...bd.turn(0, this.children)].pop();
        i = profile.findIndex(([seg, th1]) => seg === seg_ && fzy_cmp(th1, th1_) == 0);
      } while ( i != -1 );
      console.assert(fzy_cmp(loop[0].adj.get(seg_)-loop[0].length, th1_) == 0);

      loop[0]._loop_connect(loop[loop.length-1]);
      loops.push(loop);
    }

    return loops;
  }

  /**
   * Merge trivial vertices.
   * 
   * @param {SphSeg[]} exceptions - Exceptions of removing vertices.
   */
  mergeTrivialVertices(exceptions=[]) {
    for ( let seg of new Set(this.children) )
      if ( !exceptions.includes(seg)
           && seg !== seg.prev
           && fzy_cmp(seg.angle, 2) == 0
           && fzy_cmp(seg.radius, seg.prev.radius) == 0 )
        seg.mergePrev();
  }
  mergeTrivialEdges() {
    while ( true ) {
      var adj = [];
      for ( let seg of this.children )
        for ( let adj_seg of seg.adj.keys() )
          if ( adj_seg.parent === this )
            adj.push([seg, adj_seg]);

      if ( adj.length == 0 )
        break;
      else
        adj[0][0].glueAdjacent(adj[0][1]);
    }
  }

  /**
   * Slice element by circle.
   * 
   * @param {SphCircle} circle - The knife for slicing.
   * @returns {SphSeg[]} Sliced segments of both sides of `circle`.
   */
  slice(circle) {
    var circle_ = circle.complement();

    // INTERPOLATE
    // find meet points and sort by `theta`
    var paths = [];
    for ( let loop of this.loops() ) {
      let path = [];
      paths.push(path);
      for ( let seg of loop )
        for ( let meet of seg.meetWith(circle) )
          path.push(meet);
    }

    var meets = [];
    for ( let path of paths ) for ( let meet of path ) {
      let i, sgn;
      for ( i=0; i<meets.length; i++ ) {
        let theta = meets[i][0].theta;
        meet.theta = mod4(meet.theta, [theta]);
        sgn = Math.sign(meet.theta-theta);
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
    meets = meets.flatMap(mmeet => SphSeg.solveScattering(mmeet, circle));

    // interpolate
    for ( let meet of meets ) if ( meet.type[1] == "0" && meet.offset != 0 ) {
      while ( meet.offset > meet.segment.length ) {
        meet.offset = meet.offset - meet.segment.length;
        meet.segment = meet.segment.next;
      }
      meet.segment = meet.segment.interpolate(meet.offset);
      meet.offset = 0;
    }

    // bipartite
    var in_segs = new Set(), out_segs = new Set();
    var lost_children = new Set(this.children);
    for ( let path of paths ) for ( let i=0; i<path.length; i++ ) {
      let meet1 = path[i];
      let meet2 = path[i+1] || path[0];

      let side = ["-0", "++", "+-"].includes(meet1.type);
      console.assert(side == ["+0", "++", "+-"].includes(meet2.type));
      let segs = side ? in_segs : out_segs;

      for ( let seg of meet1.segment.walk(meet2.segment) ) {
        segs.add(seg);
        lost_children.delete(seg);
      }
    }

    for ( let seg0 of lost_children ) {
      let side = circle.contains(seg0.vertex);
      let segs = side ? in_segs : out_segs;

      for ( let seg of seg0.walk() ) {
        segs.add(seg);
        lost_children.delete(seg);
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
          let diff = meet2.angle - meet1.angle;
          let ang1 = meet1.segment.angle;
          let ang2 = meet2.segment.angle;
          meet2.segment.angle = ang1 - diff;
          meet1.segment.angle = ang2 + diff - 4;

          let seg1 = meet1.segment.prev;
          let seg2 = meet2.segment.prev;
          seg1._loop_connect(meet2.segment);
          seg2._loop_connect(meet1.segment);

        } else {
          // make segments between two meets
          let in_seg  = new SphSeg({radius:circle.radius,  length,
                                    orientation:q_spin(circle.orientation, meet1.theta*Q)});
          let out_seg = new SphSeg({radius:circle_.radius, length,
                                    orientation:q_spin(circle_.orientation, -meet2.theta*Q)});

          in_seg.angle = meet1.segment.angle + meet1.angle;
          meet1.segment.angle = - meet1.angle;
          out_seg.angle = meet2.segment.angle + meet2.angle - 2;
          meet2.segment.angle = 2 - meet2.angle;

          meet1.segment.prev._loop_connect(in_seg);
          out_seg._loop_connect(meet1.segment);
          meet2.segment.prev._loop_connect(out_seg);
          in_seg._loop_connect(meet2.segment);

          in_seg._adj_link(out_seg, length);
          this._aff_add(in_seg);
          this._aff_add(out_seg);

          in_segs.add(in_seg);
          out_segs.add(out_seg);

        }
      }

    } else {
      // no cross meet
      if ( meets.find(({type}) => type[1] == "-")
           || this.contains(circle.vectorAt(0)) ) {

        let in_seg  = new SphSeg({length:4, angle:2, radius:circle.radius,
                                  orientation:circle.orientation});
        let out_seg = new SphSeg({length:4, angle:2, radius:circle_.radius,
                                  orientation:circle_.orientation});
        in_seg._loop_connect(in_seg);
        out_seg._loop_connect(out_seg);
        in_seg._adj_link(out_seg, 4);
        this._aff_add(in_seg);
        this._aff_add(out_seg);

        in_segs.add(in_seg);
        out_segs.add(out_seg);
      }
    }

    in_segs = [...in_segs];
    out_segs = [...out_segs];
    return [in_segs, out_segs];
  }
}

class SphLock
{
  constructor() {
    this.left_segments = [];
    this.right_segments = [];
    this.offset = 0;
    this.passwords = [];
  }
  get circle() {
    return this.left_segments[0].circle;
  }

  _lock() {
    for ( let seg of this.left_segments )
      seg.lock = this;
    for ( let seg of this.right_segments )
      seg.lock = this;
  }
  _unlock() {
    for ( let seg of this.left_segments )
      seg.lock = undefined;
    for ( let seg of this.right_segments )
      seg.lock = undefined;
  }

  elementsOfSide(side=+1) {
    var bd = side > 0 ? this.left_segments : this.right_segments;
    var elems = new Set(bd.map(seg => seg.parent));
    for ( let elem of elems ) for ( let seg of elem.children )
      if ( !bd.includes(seg) ) for ( let adj_seg of seg.adj.keys() )
        elems.add(adj_seg.parent);
    return elems;
  }
  twist(theta, side=+1) {
    for ( let segs of [this.left_segments, this.right_segments] )
      for ( let seg0 of segs )
        for ( let [angle, seg, offset] of seg0.turn() )
          if ( offset == 0 && angle != 0 && fzy_cmp(angle, 2) != 0 )
            if ( seg.lock ) seg.lock._unlock();

    var bd = side > 0 ? this.left_segments : this.right_segments;
    var q = quaternion(bd[0].circle.center, theta*Q);
    for ( let elem of this.elementsOfSide(side) )
      for ( let seg of elem.children )
        q_mul(q, seg.orientation, seg.orientation);
    this.offset = mod4(this.offset-theta, [0]);
    this.passwords = this.passwords.map(offset => mod4(offset-theta, [0]));

    for ( let segs of [this.left_segments, this.right_segments] )
      for ( let seg0 of segs )
        seg0.adj.clear();

    var offset1 = 0, offset2 = 0;
    for ( let seg1 of this.left_segments ) {
      offset2 = 0;
      for ( let seg2 of this.right_segments ) {
        let offset = mod4(this.offset-offset1-offset2, [4]);
        if ( fzy_cmp(offset, seg1.length+seg2.length) <= 0 )
          seg1._adj_link(seg2, offset);
        offset2 += seg2.length;
      }
      offset1 += seg1.length;
    }

    for ( let segs of [this.left_segments, this.right_segments] )
      for ( let seg0 of segs )
        for ( let [angle, seg, offset] of seg0.turn() )
          if ( offset == 0 && angle != 0 && fzy_cmp(angle, 2) != 0 )
            if ( !seg.lock ) SphLock.build(seg);
  }

  static makeTick(segment) {
    if ( segment.angle == 2 ) {
      console.assert(fzy_cmp(segment.radius, segment.prev.radius) == 0);
      return {segment, subticks:[], is_free:false, backward:segment.prev};

    } else {
      var subticks = [], pre = [], post = [];

      var backward;
      for ( let [ang, seg] of segment.turn() ) {
        let side = fzy_cmp([ang, 2-seg.radius], [2, segment.radius]);
        if ( side == 0 ) break;
        if ( side >  0 ) return {};

        if ( ang == 0 )
          pre.push(seg);
        else if ( fzy_cmp(ang, 2) == 0 )
          post.push(seg);
        else
          subticks.push({angle:ang, segment:seg});
        backward = seg.prev;
      }

      var is_free = false;
      for ( let seg1 of pre )
        if ( post.find(seg2 => fzy_cmp(2-seg1.radius, seg2.radius) == 0) ) {
          is_free = true;
          subticks = [];
          break;
        }

      return {segment, subticks, is_free, backward};
    }
  }
  static decipher(left_ticks, right_ticks, offset0) {
    var left_latches = [], right_latches = []; // [{length, angle, offset, i, j}, ...]
    for ( let [ticks, latches] of [[ left_ticks,  left_latches],
                                   [right_ticks, right_latches]] ) {
      // find latches (center of possible intercuting circle)
      // find all free latches
      let free_ind = ticks.flatMap(({is_free}, i) => is_free ? [i] : []);
      for ( let i of free_ind ) for ( let j of free_ind ) if ( i < j ) {
        let length = ticks[j].offset - ticks[i].offset;
        let offset = mod4(ticks[i].offset+length/2, [0]);

        switch ( fzy_cmp(length, 2) ) {
          case -1:
            latches.push({length, offset, i, j});
            break;

          case +1:
            length = 4 - length;
            offset = mod4(offset+2, [0]);
            [i, j] = [j, i];
            latches.push({length, offset, i, j});
            break;

          case 0:
            length = 2;
            latches.push({length, offset, i, j});
            offset = mod4(offset+2, [0]);
            [i, j] = [j, i];
            latches.push({length, offset, i, j});
            break;
        }
      }

      // find normal latches
      let normal_ind = ticks.flatMap(({is_free}, i) => is_free ? [] : [i]);
      for ( let i of normal_ind ) {
        while ( ticks[i].subticks.length ) {
          let {angle, segment:{radius}} = ticks[i].subticks.pop();
          let [length] = SphCircle._leaf(angle, ticks[i].segment.radius, 2-radius);
          let offset = mod4(ticks[i].offset+length/2, [0]);

          let j = ticks.findIndex(
            ({offset}) => mod4(ticks[i].offset+length-offset, 0) == [0]);
          if ( j == -1 ) continue;
          if ( !ticks[j].is_free ) {
            let y = ticks[j].subticks.findIndex(
              ({angle:a, segment:{radius:r}}) => fzy_cmp([2-a, 2-r], [angle, radius]) == 0);
            if ( y == -1 ) continue;
            ticks[j].subticks.splice(y, 1);
          }
          
          switch ( fzy_cmp([length, angle], [2, 1]) ) {
            case -1:
              latches.push({length, angle, offset, i, j});
              break;

            case +1:
              length = 4 - length;
              angle = 2 - angle;
              offset = mod4(offset+2, [0]);
              [i, j] = [j, i];
              latches.push({length, angle, offset, i, j});
              break;

            case 0:
              length = 2;
              angle = 1;
              latches.push({length, angle, offset, i, j});
              offset = mod4(offset+2, [0]);
              [i, j] = [j, i];
              latches.push({length, angle, offset, i, j});
              break;
          }
        }
      }
    }

    // match left and right latches
    var passwords = [];
    for ( let latch1 of left_latches ) for ( let latch2 of right_latches )
      if ( fzy_cmp([latch1.length, latch1.angle], [latch2.length, 2-latch2.angle]) == 0 ) {
        let offset = mod4(offset0-latch1.offset-latch2.offset, [0]);
        let offset_ = passwords.find(offset_ => fzy_cmp(offset_, offset) == 0);
        if ( offset_ === undefined )
          passwords.push(offset);
      }
    passwords.sort();

    return passwords;
  }
  static build(segment) {
    var [segment2, offset] = segment.adj.entries().next().value;
    var ticks1 = [], ticks2 = [];
    for ( let [seg0, ticks] of [[segment, ticks1], [segment2, ticks2]] ) {
      let seg = seg0;

      do {
        let {backward, ...tick} = SphLock.makeTick(seg);
        if ( !backward ) return;
        ticks.unshift(tick);
        seg = backward;
      } while ( seg != seg0 );

      ticks.unshift(ticks.pop());
      let full_len = ticks.reduce((acc, tick) => (tick.offset=acc)+tick.segment.length, 0);
      console.assert(fzy_cmp(full_len, 4) == 0);
    }

    var lock = new SphLock();
    lock.offset = offset;
    lock.left_segments = ticks1.map(tick => tick.segment);
    lock.right_segments = ticks2.map(tick => tick.segment);
    lock.passwords = SphLock.decipher(ticks1, ticks2, offset);
    lock._lock();

    return lock;
  }
}
