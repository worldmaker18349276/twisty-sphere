"use strict";

function fzy_cmp(v1, v2, tol=1e-5) {
  if ( v1 === v2 )
    return 0;

  if ( !Array.isArray(v1) )
    return Math.abs(v1-v2) < tol ? 0 : Math.sign(v1-v2);

  for ( let i=0, len=Math.min(v1.length, v2.length); i<len; i++ ) {
    if ( Math.abs(v1[i]-v2[i]) < tol )
      continue;
    return Math.sign(v1[i]-v2[i]);
  }

  return Math.sign(v1.length-v2.length);
}
function mod4(val, snap) {
  if ( val < 0 || val >= 4 )
    val = (val % 4 + 4) % 4;
  if ( snap == 0 || snap == 4 ) {
    if ( fzy_cmp(val, 0) == 0 || fzy_cmp(val, 4) == 0 )
      val = snap;
  } else {
    if ( fzy_cmp(val, snap) == 0 )
      val = snap;
  }
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
function toSpherical([x, y, z], out=[]) {
  out[0] = norm([x,y,z]); // radius
  out[1] = Math.atan2(y, x); // theta
  out[2] = Math.acos(z/out[0]); // phi
  return out;
}
function toVector([radius, theta, phi], out=[]) {
  out[0] = radius*Math.sin(phi)*Math.cos(theta);
  out[1] = radius*Math.sin(phi)*Math.sin(theta);
  out[2] = radius*Math.cos(phi);
  return out;
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
  q_mul(q, quaternion([0,0,1], theta), out);
  return out;
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
      var a = circle.radius*Q;
      var b = this.radius*Q;
      var c = angleTo(circle.center, this.center);

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

      return [angle, length1, length2, 2];
    }
    else
      throw `unknown case: distance=${distance}, radius1=${this.radius}, radius2=${circle.radius}`;
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
 * @property {number[]} [orientation] - Orientation of this segment.
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
    this.twist = undefined;
  }
  get vertex() {
    var vec = [Math.sin(this.radius*Q), 0, Math.cos(this.radius*Q)];
    return rotate(vec, this.orientation);
  }
  get circle() {
    var {radius, orientation} = this;
    return new SphCircle({radius, orientation});
  }

  *walk() {
    var seg = this;
    do {
      yield seg;
      seg = seg.next;
    } while ( seg !== this );
  }

  insertAfter(seg) {
    var next = this.next;
    [next.prev, seg.next] = [seg, next];
    [this.next, seg.prev] = [seg, this];
    return seg;
  }
  remove() {
    var prev = this.prev, next = this.next;
    [prev.next, next.prev] = [next, prev];
    this.prev = this.next = undefined;
    return this;
  }
  adjacent(seg, offset) {
    this.adj.set(seg, offset);
    seg.adj.set(this, offset);
    return this;
  }
  subjacent(seg) {
    this.adj.delete(seg);
    seg.adj.delete(this);
    return this;
  }

  /**
   * Split this segment into two segments.
   * this segment will be in-place modified as the first part, and create new
   * object as the second part.
   * 
   * @param {number} theta - The position to split.
   *   It must range in (0, `this.length`).
   * @returns {SphSeg} The second part segment after splitting.
   */
  interpolate(theta) {
    console.assert(theta > 0 && this.length - theta > 0);

    // make next segment started from point of interpolation
    var next_seg = new SphSeg({
      length: this.length - theta,
      angle: 2,
      radius: this.radius,
      orientation: q_spin(this.orientation, theta*Q)
    });
    this.length = theta;
    this.insertAfter(next_seg);

    for ( let [adj_seg, offset] of this.adj ) {
      // remove adjacent of this
      if ( offset > this.length + adj_seg.length )
        this.subjacent(adj_seg);

      // add adjacent of next_seg
      let offset_ = mod4(offset - this.length, 4);
      if ( offset_ < next_seg.length + adj_seg.length )
        next_seg.adjacent(adj_seg, offset_);
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
    console.assert(fzy_cmp(this.radius, this.prev.radius) == 0);
    console.assert(fzy_cmp(this.circle.center, this.prev.circle.center) == 0);
    console.assert(this !== this.prev);

    // merge segment
    var merged = this.prev;
    var original_len = merged.length;
    merged.length = merged.length + this.length;
    this.remove();

    // merge adjacent
    for ( let [adj_seg, offset] of this.adj ) if ( !(adj_seg in merged.adj) )
      merged.adjacent(adj_seg, mod4(offset + original_len, 4));

    if ( merged.next === merged ) {
      merged.length = 4;
      merged.angle = 2;
    }

    return this;
  }

  /**
   * Find meet point between this segment and circle.
   * They can meet at start point of segment, but not at end point of segment.
   * 
   * @param {SphCircle} circle - The circle wanted to meet with.
   * @param {string} pre_side - Side of previous segment with respect to `circle`.
   * @yields {Array} Information about meet point, which has values
   *   `[ang, offset, theta, dir, dir_]`.
   *   `ang` is angle between `this` and `circle` at meet point (angle between
   *   two directed tangent vector), with unit of quadrant;
   *   `offset` is offset of meet point along `this.circle`, with unit of quadrant;
   *   `theta` is offset of meet point along `circle`, with unit of quadrant;
   *   `dir` and `dir_` are directions of meet point along this segment and circle,
   *   which have format "[+-0][+-0]": the first is from-side, and the second is
   *   to-side; "+" means inside, "-" means outside, and "0" means on the edge.
   */
  *meetWith(circle, pre_side) {
    // the map from direction of segment to direction of circle,
    // where we assume this.angle < 2
    const dir_map = {
      "++": "--", "+-": "-+", "+0": "-0",
      "-+": "+-", "--": "--", "-0": "0-",
      "0+": "0-", "0-": "-0", "00": "00",
    };
    var seg_circ = this.circle;
    var [ang, len, len_, meeted] = seg_circ.relationTo(circle);

    if ( meeted === undefined ) {
      let theta = circle.thetaOf(this.vertex);

      let dir  = pre_side+"0";
      let dir_ = dir_map[dir];

      yield [ang, 0, theta, dir, dir_];

    } else if ( meeted == 0 ) {
      console.assert(pre_side == (len == 4 ? "+" : "-"));
      return;

    } else if ( meeted == 1 ) {
      let offset = mod4(seg_circ.thetaOf(circle.center)-len/2, 0);
      let theta = mod4(circle.thetaOf(seg_circ.center)+len_/2, 0);
      if ( fzy_cmp(offset, this.length) >= 0 ) return;

      let side = len == 4 ? "+" : "-";
      let dir, dir_;
      console.assert(len_ == 0 ? pre_side == side : true);
      if ( offset > 0 || len_ == 0 ) {
        dir  = len  == 4 ? "++" : "--";
        dir_ = len_ == 4 ? "++" : "--";
      } else if ( pre_side != side ) {
        dir  = pre_side+side;
        dir_ = dir_map[dir];
      } else {
        console.assert(this.angle == 0 || this.angle == 2);
        dir  = pre_side+side;
        dir_ = this.angle == 2 ? "++" : "--";
      }

      yield [ang, offset, theta, dir, dir_];

    } else if ( meeted == 2 ) {
      let offset1 = mod4(seg_circ.thetaOf(circle.center)-len/2, 0);
      let theta1 = mod4(circle.thetaOf(seg_circ.center)+len_/2, 0);
      let dir1 = offset1 == 0 ? pre_side+"+" : "-+";

      let offset2 = mod4(seg_circ.thetaOf(circle.center)+len/2, 0);
      let theta2 = mod4(circle.thetaOf(seg_circ.center)-len_/2, 0);
      let dir2 = offset2 == 0 ? pre_side+"-" : "+-";

      if ( offset2 < offset1 )
        [offset1, theta1, dir1, offset2, theta2, dir2]
        = [offset2, theta2, dir2, offset1, theta1, dir1];
      if ( fzy_cmp(offset1, this.length) < 0 )
        yield [ang, offset1, theta1, dir1, dir_map[dir1]];
      if ( fzy_cmp(offset2, this.length) < 0 )
        yield [ang, offset2, theta2, dir2, dir_map[dir2]];

    }
  }
}

/**
 * Element of sliding sphere
 * 
 * @class
 * @property {SphSeg[]} segments - Segments of this element.
 */
class SphElem
{
  constructor() {
    this.segments = [];
  }

  add(...segments) {
    for ( let seg of segments ) if ( !this.segments.includes(seg) ) {
      this.segments.push(seg);
      seg.parent = this;
    }
  }
  delete(...segments) {
    for ( let seg of segments ) if ( this.segments.includes(seg) ) {
      this.segments.splice(this.segments.indexOf(seg), 1);
      seg.parent = undefined;
    }
  }

  *loops() {
    var segments = new Set(this.segments);
    for ( let seg0 of segments ) {
      yield seg0;
      for ( let seg of seg0.walk() )
        segments.delete(seg);
    }
  }
  sort() {
    var segments = new Set(this.segments);
    this.segments = [];
    this._loops = [];
    for ( let seg0 of segments ) {
      this._loops.push(this.segments.length);
      for ( let seg of seg0.walk() ) {
        segments.delete(seg);
        this.segments.push(seg);
      }
    }
  }

  /**
   * Check if this element is connected intersection of spherical circles.
   * @memberof SphElem#
   */
  validate() {
    this.sort();

    const TOUCH_DIR_ = ["--", "0-", "-0", "00"];
    for ( let seg of this.segments )
      for ( let meet of this.meetWith(seg.circle) )
        console.assert(TOUCH_DIR_.includes(meet[5]));

    for ( let i in this._loops ) {
      let n = this._loops[i];
      let n_ = this._loops[i+1] || this._loops.length;
      let elem = new SphElem();
      elem.segments = [...this.segments].splice(n, n_-n);
      console.assert(elem.contains(this.segments[n].vertex));
    }
  }
  mergeTrivialVertex(exceptions=[]) {
    for ( let seg of this.segments )
      if ( !exceptions.includes(seg)
           && seg !== seg.prev
           && fzy_cmp(seg.angle, 2) == 0
           && fzy_cmp(seg.radius, seg.prev.radius) == 0 )
        this.delete(seg.mergePrev());
  }
  /**
   * Find meet point between this element and circle.
   * 
   * @memberof SphElem#
   * @param {SphCircle} circle - The circle wanted to meet with.
   * @yields {Array} Information about meet point, which has values
   *   `[ang, seg, offset, theta, dir, dir_]`.
   *   `ang` is angle between segment and circle, with unit of quadrant;
   *   `seg` is the segment meeting with circle;
   *   `offset` is offset of meet point along `seg.circle`, with unit of quadrant;
   *   `theta` is offset of meet point along `circle`, with unit of quadrant;
   *   `dir` and `dir_` are directions of meet point along this segment and circle,
   *   which have format "[+-0][+-0]": the first is from-side, and the second is
   *   to-side; "+" means inside, "-" means outside, and "0" means on the edge.
   */
  *meetWith(circle) {
    for ( let seg0 of this.loops() ) {
      // compute pre_side
      let pre_side;

      let pre_circ = seg0.prev.circle;
      let [, len,, meeted] = pre_circ.relationTo(circle);

      if ( meeted === undefined ) {
        pre_side = "0";
      } else if ( meeted < 1 ) {
        pre_side = len == 4 ? "+" : "-";
      } else {
        // offset of first meet point along `pre_circ` with respect to `seg0.vertex`
        let pre_offset = mod4(pre_circ.thetaOf(circle.center)-len/2-seg0.prev.length, 0);
        pre_side = fzy_cmp(pre_offset+len, 4) >= 0 ? "+" : "-";
      }

      for ( let seg of seg0.walk() ) {
        for ( let [ang, offset, theta, dir, dir_] of seg.meetWith(circle, pre_side) ) {
          pre_side = dir[1];
          yield [ang, seg, offset, theta, dir, dir_];
        }
      }
    }
  }
  /**
   * Check if point is inside this element
   *
   * @memberof SphElem#
   * @param {number[]} point - The point to check.
   * @returns {boolean} True if point is in this element.
   */
  contains(point) {
    if ( this.segments.length == 0 )
      return true;

    // make a circle passing through this point and a vertex of element
    var vertex = this.segments[0].vertex;
    var q = q_align(point, vertex);
    var radius = angleTo(point, vertex)/2/Q;
    var center = rotate([Math.sin(radius*Q), 0, Math.cos(radius*Q)], q);
    var circle = new SphCircle({center, radius});
    var theta0 = circle.thetaOf(point);

    var meets = [...this.meetWith(circle)].map(([,,, th,, dir_]) => [th, dir_]);
    // sorting meet points with `theta`
    // direction compare only occurs when meeting at widthless bridge,
    // so we only need to know "--" == "--", "-+" > "+-"
    meets.sort(([th1,dir1], [th2,dir2]) => fzy_cmp(th1, th2) || ((dir1>dir2)-(dir2>dir1)));
    // find the meet point which is just next of `point` along circle
    var [th1, dir1] = meets.find(([th, dir]) => th>theta0) || meets[0];

    return dir1[0] == "+";
  }
  /**
   * Slice element by circle.
   * 
   * @memberof SphElem#
   * @param {SphCircle} circle - The knife for slicing.
   * @returns {SphElem[][]} Sliced elements of both sides of `circle`, have
   *    values `[[inside_elem, ...], [outside_elem, ...]]`.
   */
  slice(circle) {
    var circle_ = circle.complement();

    // INTERPOLATE
    // find meet points and classify them
    var meets = [];
    var touchs = [];
    const TOUCH_DIR_ = ["--", "0-", "-0", "00"];
    for ( let meet of this.meetWith(circle) ) {
      if ( TOUCH_DIR_.includes(meet[5]) )
        touchs.push(meet);
      else
        meets.push(meet);
    }
    console.assert(touchs.some(meet => meet[5][0]=="0") ? meets.length==0 : true);

    // interpolate meet points
    meets.reverse(); // to deal with double interpolation at one segment
    for ( let meet of meets ) if ( meet[2] != 0 ) { // offset != 0
      let seg = meet[1], offset = meet[2];
      meet[1] = seg.interpolate(offset);
      meet[2] = 0;
      this.add(meet[1]);
    }

    // SLICE
    var in_dash = [], out_dash = [];
    if ( meets.length != 0 ) {
      // sort meet points with `theta`
      // direction comparing only occurs when meeting at widthless bridge,
      // so we only need to know "--" == "--", "-+" > "+-"
      meets.sort(([,,,th1,,d1], [,,,th2,,d2]) => fzy_cmp(th1, th2) || ((d1>d2)-(d2>d1)));

      // draw dash
      for ( let i in meets ) if ( meets[i][5] != "-+" ) { // dir2_ != "-+"
        let [ang1, seg1,, theta1, dir1,] = meets[i-1] || meets[meets.length-1];
        let [ang2, seg2,, theta2, dir2,] = meets[i];

        // make segments between `seg1.vertex` and `seg2.vertex`
        let length = mod4(theta2-theta1, 4);
        let in_seg  = new SphSeg({radius:circle.radius,  length,
                                  orientation:q_spin(circle.orientation, theta1*Q)});
        let out_seg = new SphSeg({radius:circle_.radius, length,
                                  orientation:q_spin(circle_.orientation, (4-theta2)*Q)});
        in_seg.adjacent(out_seg, length);
        in_dash.push(in_seg);
        out_dash.unshift(out_seg);

        // link to `seg1`, `seg2` singly
        switch ( dir1 ) {
          case "+-":
            in_seg.prev = seg1.prev;
            in_seg.angle = seg1.angle-ang1;
            out_seg.next = seg1;
            break;

          case "++":
            in_seg.prev = seg1.prev;
            in_seg.angle = 0;
            break;

          case "--":
            out_seg.next = seg1;
            break;

          default:
            console.assert(false);
        }
        switch ( dir2 ) {
          case "-+":
            in_seg.next = seg2;
            out_seg.prev = seg2.prev;
            out_seg.angle = seg2.angle-(2-ang2);
            break;

          case "++":
            in_seg.next = seg2;
            break;

          case "--":
            out_seg.prev = seg2.prev;
            out_seg.angle = 0;
            break;

          default:
            console.assert(false);
        }
      }

      // link dash
      for ( let dash of [in_dash, out_dash] ) {
        for ( let i=0; i<dash.length; i++ ) {
          let seg1 = dash[i-1] || dash[dash.length-1];
          let seg2 = dash[i];

          if ( seg2.prev === undefined ) { // connect two dash
            console.assert(seg1.next === undefined);

            seg2.prev = seg1;
            seg1.next = seg2;
            seg2.angle = 2;

          } else if ( seg2.prev.next !== seg2 ) { // complete double link
            if ( seg2.prev.next === seg1.next ) {
              // kissing cut case
              console.assert(seg2.angle == 0);
              seg2.prev.next = seg2;
              seg1.next.prev = seg1;
              seg1.next.angle = 0;

            } else {
              // intercut case
              let [seg3, offset] = [...seg2.adj].find(e => seg2.prev.next===e[0].next) || [];
              console.assert(seg3 !== undefined && fzy_cmp(offset, seg3.length) == 0);

              seg2.prev.next = seg2;
              seg3.next.prev = seg3;
              seg3.next.angle = seg3.next.angle - seg2.angle;
            }
          }
        }
      }

    } else if ( touchs.length != 0 ) {
      // only touch: no slice

    } else {
      // no meet

      let v0 = circle.vectorAt(0);
      if ( this.contains(v0) ) {
        let in_seg  = new SphSeg({radius:circle.radius,  length:4, angle:2,
                                  orientation:circle.orientation});
        let out_seg = new SphSeg({radius:circle_.radius, length:4, angle:2,
                                  orientation:circle_.orientation});
        in_seg.adjacent(out_seg, 4);
        in_seg.next = in_seg.prev = in_seg;
        out_seg.next = out_seg.prev = out_seg;
        in_dash.push(in_seg);
        out_dash.unshift(out_seg);
      }

    }

    // BIPARTITE
    if ( in_dash.length == 0 ) { // no dash => one side cases
      console.assert(out_dash.length == 0);
      const INSIDE_DIR  = ["++", "0+", "+0"];
      const OUTSIDE_DIR = ["--", "0-", "-0"];

      let side;
      if ( touchs.some(meet => INSIDE_DIR.includes(meet[4])) ) { // have inside touch
        console.assert(touchs.every(meet => INSIDE_DIR.includes(meet[4]) || meet[4]=="00"));
        side = true;

      } else if ( touchs.some(meet => OUTSIDE_DIR.includes(meet[4])) ) { // have outside touch
        console.assert(touchs.every(meet => OUTSIDE_DIR.includes(meet[4]) || meet[4]=="00"));
        side = false;

      } else if ( touchs.length != 0 ) { // have full circle touch
        console.assert(touchs.every(meet => meet[4]=="00"));
        side = circle.relationTo(touchs[0][1].circle)[0] == 2;

      } else { // no touch
        side = circle.contains(this.segments[0].vertex);

      }

      return side ? [[this], []] : [[], [this]];

    } else { // two side cases
      let in_elems = [];
      let out_elems = [];

      in_dash = new Set(in_dash);
      for ( let seg0 of in_dash ) {
        let elem = new SphElem();
        in_elems.push(elem);

        for ( let seg of seg0.walk() ) {
          this.delete(seg);
          in_dash.delete(seg);
          elem.add(seg);
        }
      }

      out_dash = new Set(out_dash);
      for ( let seg0 of out_dash ) {
        let elem = new SphElem();
        out_elems.push(elem);

        for ( let seg of seg0.walk() ) {
          this.delete(seg);
          out_dash.delete(seg);
          elem.add(seg);
        }
      }

      for ( let seg0 of this.segments ) {
        let elem;
        for ( elem of [...in_elems, ...out_elems] )
          if ( elem.contains(seg0.vertex) )
            break;

        for ( let seg of seg0.walk() ) {
          this.delete(seg);
          elem.add(seg);
        }
      }

      // merge trivial vertex
      for ( let elem of [...in_elems, ...out_elems] )
        elem.mergeTrivialVertex();

      return [in_elems, out_elems];
    }

  }
}
