"use strict";

// fuzzy operation
function fzy_cmp(v1, v2, tol=1e-5) {
  if ( v1 === v2 ) {
    return 0;

  } else if ( (typeof v1 == "string" || v1 instanceof String) &&
              (typeof v2 == "string" || v2 instanceof String) ) {
    return ((v1>v2)-(v2>v1))/2;

  } else if ( (typeof v1 == "number" || v1 instanceof Number) &&
              (typeof v2 == "number" || v2 instanceof Number) ) {
    return Math.abs(v1-v2) <= tol ? 0 : Math.sign(v1-v2);

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
  let n = norm([x,y,z]);
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
  let s = Math.sin(angle/2);
  let c = Math.cos(angle/2);
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
    let out_ = rotate([x,y,z,0], q);
    out[0] = out_[0];
    out[1] = out_[1];
    out[2] = out_[2];
    return out;
  }
}
function q_align([x, y, z], v_xz, out=[]) {
  let theta = Math.atan2(y, x);
  let phi = Math.atan2(Math.sqrt(x*x+y*y), z);
  let n = [-Math.sin(theta), Math.cos(theta), 0];
  quaternion(n, phi, out);
  if ( v_xz !== undefined ) {
    let [x_, y_] = rotate(v_xz, q_inv(out));
    let theta_ = Math.atan2(y_, x_);
    q_spin(out, theta_, out);
  }
  return out;
}
function q_spin(q, theta, out=[]) {
  return q_mul(q, quaternion([0,0,1], theta), out);
}


// cosine rules for spherical triangle: cos a = cos b cos c + sin b sin c cos A
function abcA(a, b, c) {
  let [ca, cb, cc] = [Math.cos(a), Math.cos(b), Math.cos(c)];
  let [sb, sc] = [Math.sin(b), Math.sin(c)];
  let cA = (ca - cb*cc)/(sb*sc);
  return Math.acos(cA);
  // error = (db*cC + dc*cB - da) * sa/(sA*sb*sc)
}
// cosine rules for spherical triangle: cos a = cos b cos c + sin b sin c cos A
function Abca(A, b, c) {
  let cA = Math.cos(A);
  let [cb, cc] = [Math.cos(b), Math.cos(c)];
  let [sb, sc] = [Math.sin(b), Math.sin(c)];
  let ca = cb*cc + sb*sc*cA;
  return Math.acos(ca);
  // error = (dA + db*cotC/sb + dc*cotB/sc) * sA*sb*sc/sa
}
// cotangent rule for spherical triangle: cos b cos C = cot a sin b - cot A sin C
function abCA(a, b, C) {
  let [ca, sa] = [Math.cos(a), Math.sin(a)];
  let [cb, sb] = [Math.cos(b), Math.sin(b)];
  let [cC, sC] = [Math.cos(C), Math.sin(C)];
  let [cA_, sA_] = [ca*sb-sa*cb*cC, sa*sC];
  if ( sA_ < 0 ) cA_ = -cA_;
  if ( sa < 0 ) sA_ = -sA_;
  return Math.atan2(sA_, cA_);
}

/**
 * Quadrant; unit of angle and arc.  One quadrant is one quarter of a circle.
 * The method in {@link SphCircle}, {@link SphSeg} and {@link SphAnalyzer} will
 * use this unit for angle and arc.
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
    let [x, y] = rotate(vector, q_inv(this.orientation));
    return Math.atan2(y, x)/Q;
  }
  /**
   * Get vector of on this circle with given coordinate.
   *
   * @param {number} theta - The coordinate of point on this circle.
   * @returns {number[]} The vector on this circle with coordinate `theta`.
   */
  vectorAt(theta) {
    let vec = [
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
 * Element of spherical twisty puzzle can be described by its boundaries.  The
 * element without boundary indicate full space of spherical surface.
 * fixable: widthless bridge, sandglass bridge, bad alignment.
 * handleable: trivial vertices, self-adjacent edges, unconnected components.
 * analyzable: all clear.
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
 * @property {SphSeg} next - The next segment.
 * @property {SphSeg} prev - The previous segment.
 * @property {SphSeg} forward - The forward segment.
 * @property {SphSeg} backward - The backward segment.
 * @property {Map<number,SphSeg>} adj - The map of adjacenct relations, which
 *   map `offset` to `seg`: `seg` is adjacent segment, and `offset` is offset
 *   between vertices.  `offset` should be less than `this.arc + seg.arc`.
 *   Each entry describe an contact region, which is interval from
 *   `Math.max(0, offset-seg.arc)` to `Math.min(this.arc, offset)`.
 *   adjacent segment has same adjacency relation with same offset.  This map
 *   is sorted by offsets.
 * @property {Set<SphSeg>} affiliation - The affiliation of this segment.
 */
class SphSeg extends SphCircle
{
  constructor({arc, angle, radius, orientation=[0,0,0,1]}={}) {
    super({radius, orientation});
    this.arc = arc;
    this.angle = angle;

    this.next = undefined;
    this.prev = undefined;
    this.forward = undefined;
    this.backward = undefined;
    this.adj = new Map();
    this.adj.set = function(k, v) {
      // insert by order of values
      if ( typeof k != "number" )
        throw new Error("value is not a number!");

      this.delete(k);
      let stack = [[k, v]];
      for ( let [k_, v_] of this.entries() )
        if ( k_ >= k ) {
          this.delete(k_);
          stack.push([k_, v_]);
        }

      for ( let [k_, v_] of stack )
        Map.prototype.set.call(this, k_, v_);

      return this;
    };
    this.affiliation = new Set([this]);
  }
  get vertex() {
    let vec = [Math.sin(this.radius*Q), 0, Math.cos(this.radius*Q)];
    return rotate(vec, this.orientation);
  }
  get circle() {
    let {radius, orientation} = this;
    return new SphCircle({radius, orientation});
  }

  merge(...segments) {
    for ( let segment of segments )
      if ( segment.affiliation !== this.affiliation )
        for ( let seg of segment.affiliation )
          (seg.affiliation = this.affiliation).add(seg);
    return this;
  }
  split(...groups) {
    let elements = groups.map(group => new Set(group))
                         .filter(group => group.size);
    let aff = this.affiliation;
    for ( let element of elements )
      for ( let segment of element )
        aff.delete(segment), segment.affiliation = element;
    return elements;
  }
  connect(seg) {
    [this.next, seg.prev] = [seg, this];
  }
  align(seg) {
    [this.forward, seg.backward] = [seg, this];
  }
  adjacent(offset, seg) {
    if ( seg === undefined ) {
      seg = this.adj.get(offset);
      this.adj.delete(offset);
      if ( seg )
        seg.adj.delete(offset);
    } else {
      this.adj.set(offset, seg);
      seg.adj.set(offset, this);
    }
  }

  *walk() {
    let seg = this;
    do {
      yield seg;
      seg = seg.next;

      if ( seg === undefined )
        return false;
    } while ( seg !== this );
    return true;
  }
  *ski(dir=+1) {
    let seg = this;
    do {
      yield seg;
      seg = dir > 0 ? seg.forward : seg.backward;

      if ( seg === undefined )
        return false;
    } while ( seg !== this );
    return true;
  }
  *fly() {
    let segs = new Set(this.affiliation);
    for ( let seg0 of segs ) {
      for ( let seg of seg0.walk() )
        segs.delete(seg);
      yield seg0;
    }
  }

  rotate(q) {
    q_mul(q, this.orientation, this.orientation);
    return this;
  }
}

/**
 * Analyzer for spherical twisty puzzle.
 *
 * It provide algorithms to manipulate and manage BREP of spherical twisty puzzle.
 * We implement affiliation algorithms and structural algorithms separately, in
 * order to manage extensions of twisty puzzle.  We also provide algorithms to
 * generate instruction and execute instruction separately, which make the
 * manipulation of detail possible, such as multi-selections mode.
 * We try to implement algorithms without any calculation error, otherwise we
 * will carefully deal with it.
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
  abs4(val) {
    return Math.min(this.mod4(val), this.mod4(-val));
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
   * @param {number} theta - Offset of point respect to vertex of `seg0`.  It
   *   should be in the range of [0, `seg0.arc`], and snapping to `0`, `seg0.arc`
   *   and keys of `seg0.adj`.
   * @param {number} [prefer=1] - The prefer side when jumping to end point of segment.
   *   `+1` (default) means upper limit of offset; `-1` means lower limit of offset.
   * @returns {object[]} Segment and corresponding offset after jump: `[seg, theta]`.
   */
  jump(seg0, theta, prefer=+1) {
    if ( theta == 0 && prefer > 0 ) {
      let [[offset, adj_seg]] = seg0.adj;
      return [adj_seg, offset];

    } else if ( theta == seg0.arc && prefer < 0 ) {
      let [offset, adj_seg];
      for ( [offset, adj_seg] of seg0.adj );
      offset = Array.from(adj_seg.adj.keys()).filter(offset_ => offset_<offset).pop() || 0;
      return [adj_seg, offset];

    } else if ( seg0.adj.has(theta) ) {
      let adj_seg = seg0.adj.get(theta);
      if ( prefer < 0 )
        return [adj_seg, 0];
      else
        return [adj_seg.backward, adj_seg.backward.arc];

    } else {
      let [offset, adj_seg] = Array.from(seg0.adj).find(([offset]) => offset > theta);
      return [adj_seg, offset-theta];
    }
  }
  /**
   * Spinning at a point, which is specified by segment and offset.
   * This generator will yield information when spinning to another segment
   * passing through center.
   * It will stop before returning to the starting segment or has no next segment.
   *
   * @param {SphSeg} seg - The segment passing through center.
   * @param {number} [offset=0] - Offset of center respect to vertex of `seg`,
   *   It should be in the range of [0, `seg.arc`], and snapping to `0`, `seg.arc`
   *   and keys of `seg.adj`.
   * @param {number} [prefer=+1] - The prefer side of segment respect to center
   *   point.
   * @param {number} [dir=+1] - Direction of spin: `+1` means counterclockwise.
   * @yields {object[]} Information when spinning to segment, which has value
   *   `[angle, seg, offset, prefer]`:
   *   `angle` is spinning angle with unit of quadrant;
   *   `seg` is segment passing through center;
   *   `offset` is offset of center;
   *   `prefer` is prefer side of segment.
   * @returns {boolean} True if it return to the first segment finally.
   */
  *spin(seg, offset=0, prefer=+1, dir=+1) {
    let angle = 0;
    const seg0 = seg;
    const prefer0 = prefer;

    do {
      yield [angle, seg, offset, prefer];

      if ( prefer * dir < 0 ) {
        [seg, offset] = this.jump(seg, offset, prefer);

      } else if ( dir < 0 ) {
        if ( offset == seg.arc )
          [angle, seg, offset] = [angle-seg.next.angle, seg.next, 0];
        else
          angle -= 2;

      } else {
        if ( offset == 0 )
          [angle, seg, offset] = [angle+seg.angle, seg.prev, seg.prev.arc];
        else
          angle += 2;
      }

      prefer = -prefer;

    } while ( seg !== seg0 || prefer !== prefer0 );
    return true;
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
    let [seg1_prev, seg2_prev] = [seg1.prev, seg2.prev];
    let [seg1_ang, seg2_ang] = [seg1.angle, seg2.angle];

    seg2_prev.connect(seg1);
    seg1_prev.connect(seg2);
    seg1.angle = this.snap(seg2_ang + ang1, [0, 4]);
    seg2.angle = this.snap(seg1_ang + ang2, [0, 4]);
  }
  /**
   * Split segment into two segments.
   * Splitted segment will be in-place modified as the first part, and create new
   * object as the second part.
   *
   * @param {number} seg - The segment to split.
   * @param {number} theta - The position to split.  It should be in the range of
   *   (0, `seg.arc`), and snapping to keys of `seg.adj`.
   * @returns {SphSeg} The second part segment after splitting.
   */
  interpolate(seg, theta) {
    // if ( theta >= seg.arc )
    //   throw new Error("out of range of interpolation");

    // make next segment started from point of interpolation
    let splitted = new SphSeg({
      arc: seg.arc - theta,
      angle: 2,
      radius: seg.radius,
      orientation: q_spin(seg.orientation, theta*Q)
    });
    seg.arc = theta;

    // merge loop
    seg.merge(splitted);
    if ( seg.next )
      splitted.connect(seg.next);
    seg.connect(splitted);
    if ( seg.forward )
      splitted.align(seg.forward);
    seg.align(splitted);

    let offset_ = -theta;
    for ( let [offset, adj_seg] of seg.adj ) {
      if ( offset_ >= 0 )
        seg.adjacent(offset);
      offset_ = offset - theta;
      if ( offset_ > 0 )
        splitted.adjacent(offset_, adj_seg);
    }

    return splitted;
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
    let merged = seg.prev;
    let theta = merged.arc;
    merged.arc = merged.arc + seg.arc;

    // merge loop
    merged.next = undefined;
    if ( seg.next )
      merged.connect(seg.next);
    merged.forward = undefined;
    if ( seg.forward )
      merged.align(seg.forward);
    merged.split([seg]);

    // merge adjacent
    let adj = Array.from(seg.adj);
    if ( adj[0][0] != Array.from(adj[0][1].adj.keys()).pop() )
      adj.shift();
    for ( let [offset, adj_seg] of seg.adj )
      seg.adjacent(offset);
    for ( let [offset, adj_seg] of adj )
      merged.adjacent(offset+theta, adj_seg);

    return seg;
  }

  /**
   * Determine relation between circle and circle.
   * The relation to point will be represented as sign: `+1` means inside the
   * circle, `-1` means outside the circle, and `0` means on the edge of the circle.
   *
   * @param {SphCircle} circle - The circle to compare.
   * @param {number[]} point - The point to compare.
   * @returns {number} the sign representing their relation.
   */
  relationToPoint(circle, point) {
    let {radius, center} = circle;
    return this.cmp(radius, angleTo(center, point)/Q);
  }
  /**
   * Determine relation between circles.
   * The relation to circle will be represented as `[ang, arc1, arc2, meeted]`,
   * which describe overlapping region in intersect cases, otherwise those values
   * are determined by limitation from intersect cases.
   * All relations can be classified as: equal, complement, (kissing) include,
   * (kissing) exclude, (kissing) anti-include, (kissing) anti-exclude, and
   * intersect.  Where kissing means two circles touch at one point; anti- means
   * relation between their complements.
   * Except for intersect cases, it has certain return value:
   *                    equal: `[0, null, null, null]`
   *               complement: `[2, null, null, null]`
   *        (kissing) include: `[0, 0, 4, 0|1]`
   *        (kissing) exclude: `[2, 0, 0, 0|1]`
   *   (kissing) anti-include: `[0, 4, 0, 0|1]`
   *   (kissing) anti-exclude: `[2, 4, 4, 0|1]`
   *
   * @param {SphCircle} circle1 - The first circle to compare.
   * @param {SphCircle} circle2 - The second circle to compare.
   * @returns {number[]} Information about meet points between circles, which
   *   has values `[ang, arc1, arc2, meeted]`.
   *   `ang` is absolute angle between their directed tangent vectors at meetpoint,
   *   in the range of [-2, 2];
   *   `arc1` is arc of `circle1` under `circle2`, in the range of [0, 4];
   *   `arc2` is arc of `circle2` under `circle1`, in the range of [0, 4].
   *   `meeted` is number of meet points between circles.
   */
  relationToCircle(circle1, circle2) {
    let radius1 = circle1.radius;
    let radius2 = circle2.radius;
    let distance = angleTo(circle1.center, circle2.center)/Q;
    console.assert(this.cmp(distance, 0) >= 0 && this.cmp(distance, 2) <= 0);
    console.assert(this.cmp(radius1, 0) > 0 && this.cmp(radius1, 2) < 0);
    console.assert(this.cmp(radius2, 0) > 0 && this.cmp(radius2, 2) < 0);

    if ( this.cmp(distance, 0) == 0 && this.cmp(radius1, radius2) == 0 )
      return [0, null, null, null]; // equal
    else if ( this.cmp(distance, 2) == 0 && this.cmp(radius1 + radius2, 2) == 0 )
      return [2, null, null, null]; // complement
    else if ( this.cmp(distance, radius1 - radius2) <  0 )
      return [0, 0, 4, 0]; // include
    else if ( this.cmp(distance, radius1 - radius2) == 0 )
      return [0, 0, 4, 1]; // kissing include
    else if ( this.cmp(distance, radius1 + radius2) >  0 )
      return [2, 0, 0, 0]; // exclude
    else if ( this.cmp(distance, radius1 + radius2) == 0 )
      return [2, 0, 0, 1]; // kissing exclude
    else if ( this.cmp(distance, (2-radius1) - (2-radius2)) <  0 )
      return [0, 4, 0, 0]; // anti-include
    else if ( this.cmp(distance, (2-radius1) - (2-radius2)) == 0 )
      return [0, 4, 0, 1]; // kissing anti-include
    else if ( this.cmp(distance, (2-radius1) + (2-radius2)) >  0 )
      return [2, 4, 4, 0]; // anti-exclude
    else if ( this.cmp(distance, (2-radius1) + (2-radius2)) == 0 )
      return [2, 4, 4, 1]; // kissing anti-exclude
    else if ( distance < radius1 + radius2 )
      return [abcA(distance*Q, radius1*Q, radius2*Q)/Q,
              abcA(radius2*Q, radius1*Q, distance*Q)/Q*2,
              abcA(radius1*Q, radius2*Q, distance*Q)/Q*2, 2]; // intersect
    else
      throw new Error(`unknown case: [${radius1}, ${radius2}, ${distance}]`);
  }
  /**
   * Find directed meet points between circle and segment.
   * The meet point between circle and segment will be separated as two directed
   * points except for endpoints of the segment, in which snapping is necessary.
   * The direction of meet point also has chirality, which is same as meeted segment.
   * Those properties give a way to distinguish the side of circle: just trict
   * they as small perturbation of point.
   *
   * @param {SphCircle} circle - The circle to meet with.
   * @param {SphSeg} segment - The segment to meet.
   * @returns {object[]} The array of meets, which has entries
   *   `{segment, offset, prefer, side, angle, type}`:
   *   `segment` is the segment that meets with given circle;
   *   `offset` is offset of meet point along `segment`, in the range of
   *   [0, `segment.arc`];
   *   `prefer` is direction of meet point along `segment`;
   *   `side` is side of meet point relative to `circle`;
   *   `angle` is angle from `circle` to direction of meet point (angle between
   *   two directed tangent vectors), in the range of [-2, 2];
   *   `type` represents the relation between circles
   *   (see {@link SphAnalyzer#relationToCircle}).
   */
  meetWithSegment(circle, segment) {
    let meets = [];

    // meet with given segment
    let [angle,, arc, type] = this.relationToCircle(circle, segment);
    let offset;
    if ( type === null ) {
      if ( angle == 0 ) {
        meets.push({segment, offset:0,           prefer:+1, side:+1, angle:+0, type});
        meets.push({segment, offset:segment.arc, prefer:-1, side:+1, angle:+2, type});

      } else if ( angle == 2 ) {
        meets.push({segment, offset:0,           prefer:+1, side:-1, angle:-2, type});
        meets.push({segment, offset:segment.arc, prefer:-1, side:-1, angle:-0, type});
      }

    } else if ( type == 0 ) {
      // nothing

    } else if ( type == 1 ) {
      offset = this.mod4(segment.thetaOf(circle.center)-arc/2);

      if ( arc == 4 ) {
        meets.push({segment, offset, prefer:+1, side:+1, angle:+angle, type});
        meets.push({segment, offset, prefer:-1, side:+1, angle:+(2-angle), type});

      } else if ( arc == 0 ) {
        meets.push({segment, offset, prefer:+1, side:-1, angle:-angle, type});
        meets.push({segment, offset, prefer:-1, side:-1, angle:-(2-angle), type});
      }

    } else if ( type == 2 ) {
      offset = this.mod4(segment.thetaOf(circle.center)-arc/2);
      meets.push({segment, offset, prefer:+1, side:+1, angle:angle, type});
      meets.push({segment, offset, prefer:-1, side:-1, angle:angle-2, type});

      offset = this.mod4(segment.thetaOf(circle.center)+arc/2);
      meets.push({segment, offset, prefer:+1, side:-1, angle:-angle, type});
      meets.push({segment, offset, prefer:-1, side:+1, angle:-angle+2, type});
    }

    // snap and sort positions of meets
    let snaps = [];
    snaps.push([segment, 0, -1], [segment, 0, +1]);
    if ( segment.forward !== segment )
      snaps.push([segment, segment.arc, -1], [segment, segment.arc, +1]);
    this.snapMeets(circle, meets, snaps);

    meets = meets.filter(meet => (meet.offset || meet.prefer) > 0)
                 .filter(meet => ((meet.offset - segment.arc) || meet.prefer) < 0)
                 .sort((a, b) => (a.offset - b.offset) || (a.prefer - b.prefer));
    return meets;
  }
  /**
   * Snap offsets of meets to given points.
   *
   * @param {SphCircle} circle - The meeted circle.
   * @param {object[]} meets - The meets to snap.
   * @param {object[]} snaps - The points to snap, should have entries
   *   `[segment, offset, prefer]`.
   * @returns {object[]} The snapped meets.
   */
  snapMeets(circle, meets, snaps=[]) {
    meets = Array.from(meets);
    snaps = Array.from(snaps);
    let ticks = snaps.filter(([seg, offset]) => this.relationToPoint(circle, seg.vectorAt(offset)) == 0);

    let snapped = [];
    for ( let [segment, offset, prefer] of ticks ) {
        if ( meets.some(meet => meet.segment === segment && meet.type === null) )
          continue;

        let [meet, dis] = meets.filter(meet => meet.segment === segment && meet.prefer === prefer)
                               .map(meet => [meet, this.abs4(meet.offset-offset)])
                               .sort((a, b) => a[1]-b[1]).shift() || [];
        console.assert(meet);
        if ( fzy_cmp(dis, 0, this.tol*10) )
          console.warn(`calculation error is too large: ${dis}`);
        meet.offset = offset;

        snapped.push(meet);
      }

    return snapped;
  }
  /**
   * Find directed meet points between circle and boundaries of some regions.
   * It will check consistency of snapping to endpoints of segment, and snap
   * (also check consistency) to adjacent point of segment if needed.
   * It will also group the meets by points and classify the type of meet, and
   * add additional properties to meets: `theta`, `prev`, `next`, `forward`,
   * `backward`: ...
   *
   * @param {SphCircle} circle - The circle to meet with.
   * @param {SphSeg[]} boundaries - The segments of boundaries to meet.
   * @return {Map<number,object>} The map from `theta` to `{inner, outer}`:
   *   `theta` is the position of meet point relative to circle, in the range of
   *   [0, 4);
   *   `inner`/`outer` is array with following values: the first entry is backward
   *   inner/outer meet or empty if absence, the second entry is array of inner/outer
   *   touched meets, the third entry is forward inner/outer meet or empty if absence.
   */
  meetWithBoundaries(circle, boundaries) {
    boundaries = Array.from(boundaries);
    let meets = [];

    for ( let loop of this.loops(boundaries) ) {
      let meets_ = loop.flatMap(seg => this.meetWithSegment(circle, seg));
      meets.push(...meets_);

      for ( let i=0; i<meets_.length; i++ ) {
        let meet1 = meets_[i];
        let meet2 = meets_[i+1] || meets_[0];

        console.assert(meet1.prefer * meet2.prefer < 0);
        if ( meet1.prefer < 0 ) {
          console.assert(meet1.offset === meet2.offset
                         || meet1.offset === meet1.segment.arc
                         && meet2.offset === 0
                         && meet1.segment.next === meet2.segment);
          meet1.next = meet2;
          meet2.prev = meet1;
        }
      }
    }

    let flowers = new Map();
    let unprocessed = new Set();
    for ( let meet of meets ) if ( meet.offset === 0 ) unprocessed.add(meet);
    for ( let meet of meets ) if ( meet.offset !== 0 ) unprocessed.add(meet);

    for ( let {segment, offset, prefer, angle, type} of unprocessed ) if ( prefer > 0 ) {
      let inner1 = [], inner2 = [], inner = [];
      let outer1 = [], outer2 = [], outer = [];

      // sort meets around meet points
      for ( let [ang, seg, th, p] of this.spin(segment, offset) ) if ( boundaries.includes(seg) ) {
        // find and snap adjacent meets
        let meet;
        if ( th == 0 || th == seg.arc ) {
          meet = meets.find(meet => meet.segment === seg && meet.offset == th);

        } else if ( meets.some(meet => meet.segment === seg && meet.type === null) ) {
          if ( p > 0 ) {
            let pre_meet, post_meet;
            if ( angle + ang < 1 ) {
              pre_meet  = {segment:seg, offset:th, prefer:-1, side:+1, angle:+2, type:null};
              post_meet = {segment:seg, offset:th, prefer:+1, side:+1, angle:+0, type:null};
            } else {
              pre_meet  = {segment:seg, offset:th, prefer:-1, side:-1, angle:-0, type:null};
              post_meet = {segment:seg, offset:th, prefer:+1, side:-1, angle:-2, type:null};
            }
            pre_meet.next = post_meet;
            post_meet.prev = pre_meet;
            unprocessed.add(pre_meet);
            unprocessed.add(post_meet);
          }

          meet = Array.from(unprocessed)
                      .find(meet => meet.segment === seg && meet.offset === th && meet.prefer == p);

        } else {
          [meet] = this.snapMeets(circle, meets, [[seg, th, p]]);
        }

        console.assert(meet !== undefined);
        if ( this.mod4(angle+ang-meet.angle, [0]) != 0 )
          console.warn(`calculation error is too large: ${angle+ang-meet.angle}`);

        // classify meets
        unprocessed.delete(meet);
        if ( meet.side > 0 )
          (angle+ang < 3 ? inner1 : inner2).push(meet);
        else
          (angle+ang < 1 ? outer1 : outer2).push(meet);
      }

      // make leaves
      for ( let [meets, leaves] of [[[...inner2, ...inner1].reverse(), inner],
                                    [[...outer2, ...outer1].reverse(), outer]] ) {
        if ( meets.length > 0 && meets[0].prefer > 0 )
          leaves[0] = meets.shift();
        if ( meets.length > 0 && meets[meets.length-1].prefer < 0 )
          leaves[2] = meets.pop();
        if ( meets.length > 0 )
          leaves[1] = meets;

        if ( leaves[0] && leaves[2] )
          [leaves[0].forward, leaves[2].backward] = [leaves[2], leaves[0]];
      }

      // wrap up as flower
      let theta = this.mod4(circle.thetaOf(segment.vectorAt(offset)));
      for ( let meets of [inner1, inner2, outer1, outer2] )
        for ( let meet of meets )
          meet.theta = theta;
      flowers.set(theta, {inner, outer});
    }

    return flowers;
  }
  /**
   * Find directed meet segments between circle and given disjoint regions.
   *
   * @param {SphCircle} circle - The circle to meet with.
   * @param {...SphSeg[]} elements - The elements to meet.
   * @returns {object[]} The array of dashes, which has entries
   *   `{circle, arc, direction, start, end, affiliation}`:
   *   `circle` is the circle of dash;
   *   `arc` is arc length of dash, in the range of (0, 4];
   *   `direction` is direction of dash;
   *   `start`/`end` is starting/ending meet of dash, or empty if absence;
   *   `affiliation` is the element containing this dash.
   */
  meetWithRegions(circle, ...elements) {
    let boundaries = elements.map(elem => Array.from(elem));
    let flowers = this.meetWithBoundaries(circle, boundaries.flat());
    flowers = new Map(Array.from(flowers.keys()).sort()
                           .map(theta => [theta, flowers.get(theta)]));

    let inner_crosses = Array.from(flowers.values())
                             .flatMap(({inner}) => inner.filter(meet => meet.segment));
    let outer_crosses = Array.from(flowers.values()).reverse()
                             .flatMap(({outer}) => outer.filter(meet => meet.segment));
    console.assert(inner_crosses.length % 2 == 0);
    console.assert(outer_crosses.length % 2 == 0);

    // draw dashes
    let inner_dashes = [], outer_dashes = [];
    if ( flowers.size > 0 ) {
      // determine dashes by meets with the boundaries

      for ( let [crosses, dashes, dir] of [[inner_crosses, inner_dashes, +1],
                                           [outer_crosses, outer_dashes, -1]] ) {
        if ( crosses.length > 0 ) {
          for ( let i=(crosses[0].next?0:1); i<crosses.length; i+=2 ) {
            let start = crosses[i];
            let end = crosses[i+1] || crosses[0];
            console.assert(start.next !== undefined);
            console.assert(end.prev !== undefined);

            let arc = dir*(end.theta - start.theta);
            if ( i+1 >= crosses.length )
              arc += 4;

            let ind_aff1 = boundaries.findIndex(bd => bd.includes(start.segment));
            let ind_aff2 = boundaries.findIndex(bd => bd.includes(end.segment));
            console.assert(ind_aff1 === ind_aff2);
            dashes.push({circle, arc, direction:dir, start, end, affiliation:elements[ind_aff1]});
          }

        } else if ( inner_crosses.length !== 0 || outer_crosses.length !== 0 ) {
          let segment = (inner_crosses[0] || outer_crosses[0]).segment;
          let ind_aff = boundaries.findIndex(bd => bd.includes(segment));
          dashes.push({circle, arc:4, direction:dir, affiliation:elements[ind_aff]});

        } else {
          // no dash
        }
      }

    } else {
      // no meet with the boundaries => determine dashes by different way

      let [elem] = this.grab(circle.vectorAt(0), ...elements);
      if ( elem ) {
        inner_dashes.push({circle, arc:4, direction:+1, affiliation:elem});
        outer_dashes.push({circle, arc:4, direction:-1, affiliation:elem});
      }
    }

    return [inner_dashes, outer_dashes];
  }
  /**
   * Find the elements contain given point.
   *
   * @param {number[]} point
   * @param {...SphSeg[]} elements
   * @returns {Set<SphSeg[]>}
   */
  grab(point, ...elements) {
    let boundaries = elements.map(elem => Array.from(elem));
    if ( elements.length === 0 )
      return;
    if ( elements.length === 1 && boundaries[0].length === 0 )
      return elements[0];
    console.assert(boundaries.every(bd => bd.length > 0));

    let orientation = q_mul(q_align(point, boundaries[0][0].vertex), [0.5, 0.5, 0.5, -0.5]);
    let circle = new SphCircle({orientation, radius:1});

    let flowers = this.meetWithBoundaries(circle, boundaries.flat());
    console.assert(flowers.size > 0);
    let theta = Array.from(flowers.keys()).map(theta => this.mod4(theta, [0])).sort().shift();
    let {inner, outer} = flowers.get(theta);

    if ( theta === 0 )
      return new Set([...inner, ...outer].flat().map(meet => meet.affiliation));
    else if ( inner[0] || outer[2] )
      return new Set([(inner[0] || outer[2]).affiliation]);
    else
      return new Set();
  }

  // ADVANCE
  // classify `segment.vertex` into inner/outer part
  meetWithSegmentADV(circle, segment, inner, outer) {}
  // check inner/outer division
  snapMeetsADV(circle, meets, snaps=[], inner, outer) {}
  // sort into given map `flowers`, and classify side of `segment.vertex`
  meetWithBoundariesADV(circle, boundaries, flowers=new Map(), inner, outer) {}
  // classify side of `segment.vertex`
  // jumping shortcut, especially for full partition elements
  meetWithRegionsADV(circle, ...elements, inner, outer) {}
  // jumping shortcut, especially for full partition elements
  grabADV(point, ...elements) {
    let boundaries = elements.map(elem => Array.from(elem));
    if ( elements.length === 0 )
      return;
    if ( elements.length === 1 && boundaries[0].length === 0 )
      return elements[0];
    console.assert(boundaries.every(bd => bd.length > 0));

    let orientation = q_mul(q_align(point, boundaries[0][0].vertex), [0.5, 0.5, 0.5, -0.5]);
    let circle = new SphCircle({orientation, radius:1});

    let unprocessed = elements.slice();
    while ( unprocessed.length > 0 ) {
      let elem = unprocessed.pop();
      let flowers = this.meetWithBoundaries(circle, Array.from(elem));
      if ( flowers.size === 0 )
        continue;

      let [{inner, outer}] = flowers.values();
      let meet0 = inner[0] || outer[2];
      if ( Array.from(flowers.keys()).some(theta => this.mod4(theta, [0]) === 0) ) {
        return elem;

      } else if ( meet0 !== undefined ) {
        return elem;

      } else {
        for ( let [ang, seg, th, p] of this.spin(meet0.segment, meet0.offset, meet0.prefer) )
          if ( boundaries.some(bd => bd.includes(seg)) ) {
            if ( meet.side > 0 )
              (meet0.angle+ang < 3 ? inner1 : inner2).push(meet);
            else
              (meet0.angle+ang < 1 ? outer1 : outer2).push(meet);
          }

      }
    }
  }

  // fuse:
  //   merge (aff)
  //     merge all given elements
  //     or group adjacent elements
  //     or group locally untwistable parts
  //     or nothing
  //   glue (struct)
  //     find zippers => zippers
  //     manipulate zipper
  //     glue along zipper

  // slice:
  //   cut (struct)
  //     draw dashes by given circle => inner/outer, dashes
  //     manipulate dash
  //     cut along dash => inner/outer
  //   split (aff)
  //     split inner and outer parts (if cut out full dashes along the circle)
  //     or split unconnected components
  //     or nothing

  groupAdjacentElements(elems) {}
  groupLocallyUntwistableParts(elems) {}
  // merge(elems) {}
  separateUnconnectedComponents(elems) {}
  // split(elems) {}

  /**
   * Find the maximal zippers between given segments, in which all sublists of
   * maximal zippers that preserving order are valid zippers.
   * Zipper is ordered list of contacts, and contact is adjacent relation that
   * describe the overlapping between the segments: `[seg1, seg2, offset]`, where
   * `seg1.adj.get(offset) === seg2`.  Those contacts should place along the
   * extended circle until the end vertices of `seg1` and `seg2` overlap.
   * 
   * @param {SphSeg[]} segments - The segments to zip.
   * @returns {object[]} The zippers.
   */
  findZippers(segments) {
    let zippers = [];
    segments = new Set(segments);

    for ( let seg0 of segments ) {
      // find segments along `seg0` linked by `forward` and `backward`
      let track = [];
      // search forward
      for ( let seg of seg0.ski(+1) ) {
        track.push(seg);

        // check if end vertex of `seg` overlap with start vertex of adjacent segment
        let [offset, adj_seg] = Array.from(seg.adj).pop();
        let [offset_, seg_] = Array.from(adj_seg.adj).shift();
        if ( offset == offset_ ) {
          track.shift();
          // search backward
          for ( let seg of seg0.ski(-1) ) {
            track.unshift(seg);

            // check if start vertex of `seg` overlap with end vertex of adjacent segment
            let [offset, adj_seg] = Array.from(seg.adj).shift();
            let [offset_, seg_] = Array.from(adj_seg.adj).pop();
            if ( offset == offset_ )
              break;
          }
          break;
        }
      }

      // make zipper
      let zipper = [];
      for ( let seg1 of track ) if ( segments.has(seg1) )
        for ( let [offset, seg2] of seg1.adj ) if ( segments.has(seg2) )
          zipper.push([seg1, seg2, offset]);

      if ( zipper.length > 0 )
        zippers.push(zipper);

      for ( let [seg1, seg2] of zipper ) {
        segments.delete(seg1);
        segments.delete(seg2);
      }
    }
    
    return zippers;
  }
  /**
   * Glue zipper.  The glued segments should belong to same affiliation.
   *
   * @param {object[]} zipper - The contacts to glue.
   * @returns {SphSeg[]} The end points of glued subzipper.
   */
  glueAlongZipper(zipper) {
    zipper = Array.from(zipper);
    // cyclic sort zipper based on inner segments (prepare for interpolation)
    if ( zipper[0][0] === zipper[zipper.length-1][0] ) {
      let i = zipper.findIndex(contact => contact[0] !== zipper[0][0]);
      if ( i != -1 )
        zipper.push(...zipper.splice(0, i));
    }

    let zipper_ = zipper.reverse();
    // cyclic sort zipper based on outer segments (prepare for interpolation)
    if ( zipper_[0][1] === zipper_[zipper_.length-1][1] ) {
      let i_ = zipper_.findIndex(contact => contact[1] !== zipper_[0][1]);
      if ( i_ != -1 )
        zipper_.push(...zipper_.splice(0, i_));
    }

    // interpolate inner segments
    for ( let i=zipper.length-1; i>=0; i-- ) {
      let [seg, adj_seg, offset] = zipper[i];

      if ( Array.from(seg.adj.keys()).some(offset_ => offset_ > offset) ) {
        let [seg_, adj_seg_] = zipper[i+1] || [];
        if ( zipper[i+1] && seg === seg_ ) {
          console.assert(adj_seg.backward === adj_seg_);
          continue;
        }
        this.interpolate(seg, offset);
      }

      if ( Array.from(seg.adj.keys()).some(offset_ => offset_ < offset) ) {
        let [seg_, adj_seg_] = zipper[i-1] || [];
        if ( zipper[i-1] && seg === seg_ && adj_seg.forward === adj_seg_ )
          continue;
        let offset_ = Array.from(seg.adj.keys()).filter(offset_ => offset_ < offset).pop();
        seg = this.interpolate(seg, offset_);
        [offset] = seg.adj.keys();
        zipper[i][0] = seg;
        zipper[i][2] = offset;
      }
    }

    // interpolate outer segments
    for ( let i=zipper_.length-1; i>=0; i-- ) {
      let [seg, adj_seg, offset] = zipper_[i];

      if ( Array.from(adj_seg.adj.keys()).some(offset_ => offset_ > offset) ) {
        let [seg_, adj_seg_] = zipper_[i+1] || [];
        if ( zipper_[i+1] && adj_seg === adj_seg_ ) {
          console.assert(seg.backward === seg_);
          continue;
        }
        this.interpolate(adj_seg, offset);
      }

      if ( Array.from(adj_seg.adj.keys()).some(offset_ => offset_ < offset) ) {
        let [seg_, adj_seg_] = zipper_[i-1] || [];
        if ( zipper_[i-1] && adj_seg === adj_seg_ && seg.forward === seg_ )
          continue;
        let offset_ = Array.from(adj_seg.adj.keys()).filter(offset_ => offset_ < offset).pop();
        adj_seg = this.interpolate(adj_seg, offset_);
        [offset] = adj_seg.adj.keys();
        zipper_[i][1] = adj_seg;
        zipper_[i][2] = offset;
      }
    }

    // zip
    let res = [];
    i = zipper.findIndex(([seg1,, offset]) => seg1.adj.keys().next().value == offset);
    if ( i != -1 ) {
      // linear zipper
      zipper.push(...zipper.splice(0, i));
      while ( zipper.length ) {
        let j = zipper.findIndex(([,seg2, offset]) => seg2.adj.keys().next().value == offset);
        let subzipper = zipper.splice(0, j+1);

        // swap inner/outer vertices
        let inner = subzipper.map(contact => contact[0]);
        let outer = subzipper.map(contact => contact[1]).reverse();
        for ( let segs of [inner, outer] )
          for ( let i=0; i<segs.length-1; i++ ) {
            let seg1 = segs[i];
            let seg2 = segs[i+1];
            if ( seg1 !== seg2 && seg1.next !== seg2 )
              this.swap(seg1.next, seg2, 2+seg1.next.angle, 2-seg1.next.angle);
          }

        // swap left/right vertices
        let left = [subzipper[0][0], subzipper[0][1]];
        let right = [subzipper[subzipper.length-1][1], subzipper[subzipper.length-1][0]];
        for ( let [seg1, seg2] of [left, right] ) if ( seg1 !== seg2 ) {
          res.push(seg2.next);
          this.swap(seg1, seg2.next, 4-seg2.next.angle, seg2.next.angle);
          if ( seg1.backward )
            seg1.backward.forward = undefined;
          if ( seg1.prev.forward )
            seg1.prev.forward.backward = undefined;
        }

        seg1.split([...inner, ...outer]);
      }

    } else {
      // cyclic zipper
      let inner = zipper.map(contact => contact[0]);
      let outer = zipper.map(contact => contact[1]).reverse();
      for ( let segs of [inner, outer] )
        for ( let i=0; i<segs.length; i++ ) {
          let seg1 = segs[i];
          let seg2 = segs[i+1] || segs[0];
          if ( seg1 !== seg2 && seg1.next !== seg2 )
            this.swap(seg1.next, seg2, 2+seg1.next.angle, 2-seg1.next.angle);
        }

      seg1.split([...inner, ...outer]);
    }

    return res;
  }
  // fuse(segs) {
  //   for ( let zipper of this.findZippers(segs) ) {
  //     for ( [seg1, seg2] of zipper )
  //       seg1.merge(seg2);
  //     this.glueAlongZipper(zipper);
  //   }
  // }

  /**
   * Find the maximal zippers between dashes along given circle, in which all
   * sublists of maximal zippers that preserving order are valid zippers.
   * It is just replace segments by dashes, which are objects that indicate where
   * to slice (see {@link SphAnalyzer#meetWithRegions}).
   * All dashes will be added new properties `next`, `prev`, `forward`, `backward`
   * and `adj`, just like `SphSeg`.
   *
   * @param {object[]} elements - The elements to slice.
   * @param {SphCircle} circle - The line to draw.
   * @returns {object[]} The zipper of dashes along given circle and the sets of
   *   vertices inside/outside the circle.
   */
  drawZipper(elements, circle) {
    elements = Array.from(elements);
    let segments = elements.flatMap(elem => Array.from(elem));

    // compute meets
    let meets = [], inner = [], outer = [];
    for ( let element of elements ) for ( let [seg0] of this.loops(element) ) {
      let [meets_, inner_, outer_] = this.meetWith(seg0, circle);
      meets.push(...meets_);
      inner.push(...inner_);
      outer.push(...outer_);
    }
    let sorted = this.sortMeets(meets, circle, segments)
                     .flatMap(flower => [flower.forward  || flower.intra || flower.outra,
                                         flower.backward || flower.intra || flower.outra])
                     .filter(m => m);

    // draw dashes
    if ( sorted.length > 0 ) {
      console.assert(sorted.length % 2 == 0);
      let dashes = [];
      let i = ["(|)", "[|)", "(|]", "[|]"].includes(sorted[0].type) ? 0 : 1;
      for ( ; i<sorted.length; i+=2 ) {
        let meet1 = sorted[i];
        let meet2 = sorted[i+1] || sorted[0];
        let theta = meet2.theta - meet1.theta;
        if ( sorted[i+1] === undefined )
          theta += 4;
        dashes.push([meet1, meet2, theta]);

        console.assert(["(|)", "[|)", "(|]", "[|]", ")<)", "(<("].includes(meet1.type));
        console.assert([")|(", ")|[", "]|(", "]|[", ")<)", "(<("].includes(meet2.type));
        console.assert(meet1.segment.affiliation === meet2.segment.affiliation);
        console.assert(meet1 !== meet2 || theta == 4);
      }

      return [dashes, inner, outer];

    } else if ( meets.length > 0 ) {
      return [[], inner, outer];

    } else {
      let point = circle.vectorAt(0);
      let inclusions = elements.map(element => this.contains(element, point));
      console.assert(inclusions.reduce((a, b) => a+b) <= 1);
      let dashes = [];
      let i = inclusions.findIndex(r => r);
      if ( i != -1 ) {
        let nomeet = {element:elements[i], circle, theta:0};
        nomeet.forward = nomeet;
        nomeet.backward = nomeet;
        dashes.push([nomeet, nomeet, 4]);
      }
      return [dashes, inner, outer];
    }
  }
  cutAlongZipper(dashes) {
    dashes = Array.from(dashes);

    // interpolation
    let unprocessed = new Set(dashes.flatMap(([meet1, meet2]) => [meet1, meet2]));
    for ( let meet of unprocessed ) if ( meet.segment && meet.offset != 0 ) {
      if ( meet.next.segment === meet.segment && meet.next.offset > meet.offset && unprocessed.has(meet.next) ) {
        unprocessed.delete(meet);
        unprocessed.add(meet);
        continue;
      }

      meet.segment = this.interpolate(meet.segment, meet.offset);
      meet.offset = 0;
    }

    // cut dashes
    if ( dashes.length == 1 && dashes[0][0].element ) {
      // just a circle
      let [meet1, meet2, arc] = dashes[0];
      let circle = meet1.circle;
      let circle_ = new SphCircle(circle).complement();
      let in_seg  = new SphSeg({radius:circle.radius,  arc:4, angle:2});
      let out_seg = new SphSeg({radius:circle_.radius, arc:4, angle:2});
      in_seg.orientation  = q_spin(circle.orientation,   meet1.theta*Q);
      out_seg.orientation = q_spin(circle_.orientation, -meet2.theta*Q);

      let [seg0] = meet1.element;
      seg0.merge(in_seg, out_seg);

      in_seg.align(in_seg);
      out_seg.align(out_seg);
      in_seg.connect(in_seg);
      out_seg.connect(out_seg);
      in_seg.adjacent(4, out_seg);

      return [[in_seg], [out_seg]];

    } else {


    }
  }
  // slice(elems, circle) {
  //   let paths = Array.from(seg0.fly())
  //                    .map(([seg0]) => Array.from(this.meetWith(seg0, circle)));
  //   let meets = this.sortMeets(paths, circle);
  // 
  //   let dashes = this.dashesOf(meets);
  //   for ( let dash of dashes )
  //     this.sliceAlong(seg0, dash, circle);
  //   if ( !is_proper )
  //     this.alignVertices(dashes.flat().map(meet => meet.segment));
  //   else
  //     ...;
  // 
  //   if ( dashes.length == 0 )
  //     return [seg0.affiliation];
  //   else
  //     return this.splitByConectivity(segs);
  // }

  /**
   * Make profile of given segments.
   * Profile are loops of segments that are adjacent to exposed part of given segments.
   *
   * @param {SphSeg[]} segments
   * @returns {SphSeg[]} Profile of segments.
   */
  sketchProfile(segments) {
    let segments = new Set(segments);
    let uncovered = [];
    for ( let seg of segments )
      for ( let [offset, seg_] of this.adj )
        if ( !segments.has(seg_) )
          uncovered.push([seg, seg_, offset]);

    // build segments of profile
    for ( let contact of uncovered ) {
      let [seg, th1, th2] = contact;
      let arc = this.snap(th2-th1, [seg.arc]);
      let {radius, orientation} = seg.circle.shift(th2).complement();
      let bd = new SphSeg({radius, arc, orientation});
      bd.adj.set(seg, th2);
      contact.push(bd);
    }

    // connect segments of profile
    for ( let [seg, th1, th2,,,, bd] of uncovered ) {
      let ang_, seg_, th1_;
      for ( let tick of this.spin(seg, th2, -1, -1) ) {
        if ( !segments.has(tick[1]) )
          break;
        [ang_, seg_, th1_] = tick;
      }
      let [,,,bd_] = uncovered.find(([seg, th1]) => seg===seg_ && this.cmp(th1,th1_) == 0);
      bd.angle = 4+ang_;
      bd_.merge(bd);
      bd_.connect(bd);
    }

    return uncovered.map(([,,,bd]) => bd);
  }

  /**
   * Align segments around given point.
   *
   * @param {object[]} beams - The values generated by {@link SphAnalyzer#spin}.
   * @param {number} offset - The offset of point.
   * @param {number} prefer - The prefer of point.
   * @param {Map<number,SphSeg[][]>} The map from angle to pairs of aligned segments.
   */
  alignSegments(beams) {
    let beams = Array.from(beams);
    let res = new Map();
    for ( let [ang2, seg2, offset2, prefer2] of beams ) if ( prefer2 == +1 )
      for ( let [ang1, seg1, offset1, prefer1] of beams ) if ( prefer1 == -1 )
        if ( seg1.radius == seg2.radius && this.mod4(ang2-ang1, [2]) == 2 ) {
          console.assert((offset2==0 && offset1==seg1.arc) || (offset1==offset2 && seg1===seg2));

          ang2 = this.mod4(ang2, res.keys());
          if ( !res.has(ang2) )
            res.set(ang2, []);

          if ( offset2 == 0 )
            res.get(ang2).push([seg1, seg2]);
          else
            res.get(ang2).push([seg2]);
        }

    return res;
  }
  alignVertices(segs, forced=true) {
    let aligned = [];

    segs = new Set(segs);
    for ( let seg0 of segs ) {
      let beams = this.spin(seg0);
      for ( let [, seg, offset] of beams )
        if ( offset == 0 )
          segs.delete(seg);

      for ( let [ang, pairs] of this.alignSegments(beams) )
        for ( let [seg1, seg2] of pairs ) if ( seg2 !== undefined ) {
          if ( forced || seg1.forward === undefined )
            seg1.align(seg2);
          console.assert(seg1.forward === seg2 && seg2.backward === seg1);
          aligned.push([seg1, seg2]);
        }
    }
    return aligned;
  }

  /**
   * Slice element by circle.
   *
   * @param {object[]} meets
   * @param {SphCircle} circle - The knife for slicing.
   * @returns {SphSeg[][]} Sliced segments of both sides of `circle` and sliced
   *   boundaries of both sides.
   */
  slice(meets, circle) {
    // interpolate
    for ( let path of paths ) for ( let meet of path.slice(0).reverse() )
      if ( meet.type[1] == "|" && meet.offset != 0 ) {
        meet.segment = this.interpolate(meet.segment, meet.offset);
        meet.offset = 0;
      }

    // SLICE
    let in_bd = [], out_bd = [];
    let dash = meets.filter(meet => meet.type[1] == "|");
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
        in_seg.align(in_seg);
        out_seg.align(out_seg);
        in_seg.adjacent(out_seg, 4);
        elem.accept(in_seg);
        elem.accept(out_seg);

        in_bd.push(in_seg);
        out_bd.push(out_seg);
      }
    }

    // bipartite
    let in_segs = [], out_segs = [];
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
  /*
   // * Slice element by circle.
   // *
   // * @param {SphCircle} elem - The element to slice.
   // * @param {SphCircle} circle - The knife for slicing.
   // * @returns {SphSeg[][]} Sliced segments of both sides of `circle` and sliced
   // *   boundaries of both sides.
  slice(elem, circle) {
    let circle_ = new SphCircle(circle).complement();

    // INTERPOLATE
    // find meet points and sort by `theta`
    let paths = [];
    for ( let seg0 of elem.fly() )
      paths.push(Array.from(this.meetWith(seg0, circle)));
    let meets = this.sortMeets(paths, circle);

    // interpolate
    for ( let path of paths ) for ( let meet of path.slice(0).reverse() )
      if ( meet.type[1] == "|" && meet.offset != 0 ) {
        meet.segment = this.interpolate(meet.segment, meet.offset);
        meet.offset = 0;
      }

    // SLICE
    let in_bd = [], out_bd = [];
    let dash = meets.filter(meet => meet.type[1] == "|");
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
        in_seg.align(in_seg);
        out_seg.align(out_seg);
        in_seg.adjacent(out_seg, 4);
        elem.accept(in_seg);
        elem.accept(out_seg);

        in_bd.push(in_seg);
        out_bd.push(out_seg);
      }
    }

    // bipartite
    let in_segs = [], out_segs = [];
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
   */


  twistAdjacenciesAlong(seg0, angle) {
    let inner = full(seg0.ski());
    let [[seg0_, shift]] = seg0.adj;
    let outer = full(seg0_.ski());
    if ( !inner || !outer )
      throw new Error("invalid twist!");

    for ( let seg of inner )
      seg.adj.clear();
    for ( let seg of outer )
      seg.adj.clear();

    let offset1 = 0;
    for ( let seg1 of inner ) {
      let offset2 = 0;
      for ( let seg2 of outer ) {
        let offset = this.mod4(shift-offset1-offset2, [4, seg1.arc, seg2.arc]);
        if ( this.cmp(offset, seg1.arc+seg2.arc) < 0 )
          seg1.adjacent(seg2, offset);
        offset2 += seg2.arc;
      }
      offset1 += seg1.arc;
    }
  }
  /**
   * Make rotation instruction of twist.
   *
   * @param {Map<SphSeg,number>} op - The map that tell you which track should
   *   twist by what angle.
   * @param {SphElem} [hold] - The element whose orientation should be fixed.
   * @returns {object[]} Partition of this operation (or `undefined` if failed),
   *   it has entries `{elements, fences, rotation}` (see {@link SphAnalyzer#partitionByBoundaries}).
   */
  rotationsOfTwist(op, hold) {
    op = new Map(op);

    let tracks = Array.from(op.keys()).map(seg0 => [seg0, seg0.adj.keys().next().value])
      .map(([seg1, seg2]) => [full(seg1.ski()), full(seg2.ski())]);
    console.assert(tracks.every(([inner, outer]) => inner && outer));
    let partition = this.partitionByBoundaries(...tracks.flat());
    let region0 = partition.find(region => region.elements.has(hold)) || partition[0];
    region0.rotation = [0,0,0,1];
    let rotated = new Set([region0]);

    for ( let region of rotated ) for ( let bd of region.fences ) {
      let [inner, outer] = tracks.find(([inner, outer]) => inner===bd || outer===bd);
      let dual_bd = inner===bd ? outer : inner;
      let adj_region = partition.find(region => region.fences.has(dual_bd));

      let theta = op.get(inner[0]);
      let rotation = quaternion(bd[0].center, -theta*Q);
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
   * Twist along tracks by given angles.  It only change structure of segments
   * and tracks, will not rotate orientation of elements.
   *
   * @param {Map<SphTrack,number>} op - The map that tell you which track should
   *   twist by what angle.
   * @returns {object[]} Partition of this operation, it has entries
   *   `{elements, fences, rotation}` (see {@link SphAnalyzer#partitionByBoundaries}).
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
   *   it has entries `{elements, fences, rotation}` (see {@link SphAnalyzer#partitionByBoundaries}).
  */
  rotationsOfTwist(op, hold) {
    op = new Map(op);

    let tracks = Array.from(op.keys());
    let partition = this.partitionByBoundaries(...tracks.flatMap(track => [track.inner, track.outer]));
    let region0 = partition.find(region => region.elements.has(hold)) || partition[0];
    region0.rotation = [0,0,0,1];
    let rotated = new Set([region0]);

    for ( let region of rotated ) for ( let bd of region.fences ) {
      let track = tracks.find(track => track.inner===bd || track.outer===bd);
      let dual_bd = track.inner===bd ? track.outer : track.inner;
      let adj_region = partition.find(region => region.fences.has(dual_bd));

      let theta = op.get(track);
      let rotation = quaternion(bd[0].center, -theta*Q);
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
   * Check if given point of segment is locally twistable.
   *
   * @param {SphSeg} segment - The segment to test.
   * @param {number} offset - The point to test.
   * @param {SphSeg[]} [boundaries] - The boundaries of this element.
   * @returns {boolean} True if `seg0` is locally twistable.
   */
  isLocallyTwistable(segment, offset, boundaries=seg.affiliation.boundaries) {
    boundaries = Array.from(boundaries);

    if ( offset == 0 ) {
      if ( this.cmp([segment.angle, segment.prev.radius], [2, segment.radius]) > 0 )
        return false;

      for ( let [ang, seg,, prefer] of this.spin(segment, offset, +1, +1) )
        if ( prefer == -1 && boundaries.includes(seg) )
          if ( this.cmp([ang, seg.radius], [2, segment.radius]) > 0 )
            return false;

      return true;

    } else if ( offset == segment.arc ) {
      if ( this.cmp([segment.next.angle, segment.next.radius], [2, segment.radius]) > 0 )
        return false;

      for ( let [ang, seg,, prefer] of this.spin(segment, offset, -1, -1) )
        if ( prefer == +1 && boundaries.includes(seg) )
          if ( this.cmp([-ang, seg.radius], [2, segment.radius]) > 0 )
            return false;

      return true;

    } else {
      for ( let [, seg] of this.spin(segment, offset, +1, -1) )
        if ( seg !== segment && boundaries.includes(seg) )
          return false;

      return true;
    }
  }
  /**
   * Check if segment is twistable; element should has no meet with extended
   * circles.
   *
   * @param {SphSeg} segment - The segment to test.
   * @param {SphSeg[]} [boundaries] - The boundaries of this element.
   * @param {boolean} [global_test=false]
   * @returns {boolean} True if `seg0` is twistable.
   */
  isTwistable(segment, boundaries=segment.affiliation.boundaries, global_test=false) {
    boundaries = Array.from(boundaries);
    if ( Array.from(segment.adj.keys()).some(seg => boundaries.includes(seg)) )
      return false;
    if ( !this.isLocallyTwistable(segment, 0, boundaries) )
      return false;
    if ( !this.isLocallyTwistable(segment, segment.arc, boundaries) )
      return false;
    for ( let offset of segment.adj.values() ) if ( offset < segment.arc )
      if ( !this.isLocallyTwistable(segment, offset, boundaries) )
        return false;

    if ( global_test ) {
      let meets = Array.from(this.loops(boundaries))
                       .map(loop => Array.from(this.meetWith(loop[0], segment)));
      if ( meets.some(meet => meet.type[1] != ">" || ["]", ")"].includes(meet.type[0])) )
        return false;
    }

    return true;
  }
  /**
   * Find twistable part of given elements.
   *
   * @param {SphElem[]} elements
   * @param {boolean} [global_test=false]
   * @returns {SphElem[][]} Set of twistable Elements.
   */
  partitionByTwistability(elements, global_test=false) {
    elements = Array.from(elements);
    let segments = elements.flatMap(elem => Array.from(elem.boundaries));
    let untwistable = new Set();

    let i;
    do {
      for ( i=0; i<segments.length; i++ ) if ( !untwistable.has(segments[i]) ) {
        let seg0 = segments[i];
        let fixed = Array.from(seg0.affiliation.boundaries);
        for ( let seg of fixed )
          if ( untwistable.has(seg) )
            for ( let adj_seg of seg.adj.keys() )
              if ( segments.includes(adj_seg) && !fixed.includes(adj_seg) )
                fixed.push(...adj_seg.affiliation.boundaries);

        if ( !this.isTwistable(seg0, fixed, global_test) ) {
          let new_untwistable = new Set([seg0]);
          for ( let unseg of new_untwistable ) {
            // shortcut
            for ( let adj_seg of unseg.adj.keys() )
              if ( segments.includes(adj_seg) )
                new_untwistable.add(adj_seg);

            // special case
            for ( let [ang, seg,, prefer] of this.spin(unseg, 0, +1, +1) )
              if ( prefer == -1 && this.cmp(ang, 2) == 0 )
                if ( segments.includes(seg) && this.cmp(unseg.radius, seg.radius) > 0 )
                  new_untwistable.add(seg);

            for ( let [ang, seg,, prefer] of this.spin(unseg, unseg.arc, -1, -1) )
              if ( prefer == +1 && this.cmp(-ang, 2) == 0 )
                if ( segments.includes(seg) && this.cmp(unseg.radius, seg.radius) > 0 )
                  new_untwistable.add(seg);
          }

          for ( let unseg of new_untwistable )
            untwistable.add(unseg);

          if ( global_test )
            break;
        }
      }
    } while ( i != segments.length );

    let res = [];
    let unprocessed = new Set(elements);
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

  /*
   // * Find sandglass-shape tips.
   // * Sandglass tips are the only case to deal with after fusing untwistable part;
   // * others types of tip will be detected by `isTwistable`.
   // * Merge them by `this.swap(seg1, seg2, 2, 2)`.
   // *
   // * @param {SphSeg[]} boundaries
   // * @returns {SphSeg[][]} Array of sandglass-shape tips.
  findSandglassTips(boundaries) {
    let res = [];
    let tips = Array.from(boundaries).filter(seg => this.cmp(seg.angle, 0) == 0);
    for ( let i=0; i<tips.length; i++ ) for ( let j=i+1; j<tips.length; j++ ) {
      let seg1 = tips[i];
      let seg2 = tips[j];

      if ( this.cmp(seg1.radius, seg2.prev.radius) != 0 )
        continue;
      if ( this.cmp(seg2.radius, seg1.prev.radius) != 0 )
        continue;
      if ( this.cmp(seg1.vertex, seg2.vertex) != 0 )
        continue;
      if ( this.cmp(seg1.center, seg2.prev.center) != 0 )
        continue;
      if ( this.cmp(seg2.center, seg1.prev.center) != 0 )
        continue;

      res.push([seg1, seg2]);
    }

    return res;
  }
   */
  /*
   // * It will swap segments of the track for preventing to form sandglass tips.
   // * You should merge elements at inner/outer side first.
   // *
   // * @param {SphTrack} track
   // * @return {Array} The swapped segments and intersected tracks.
  sealTrack(track) {
    let segs = [];
    let tracks = [];
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
   */

  /**
   * Build track along extended circle of given segment.
   *
   * @param {SphSeg} seg
   * @returns {SphTrack} The track, or `undefined` if it is illegal.
   */
  buildTrack(seg) {
    let [seg_, shift] = seg.adj.entries().next().value;
    if ( this.cmp(seg.radius, 1) > 0 )
      [seg, seg_] = [seg_, seg];
    let inner = full(this.ski(seg));
    if ( !inner ) return;
    let outer = full(this.ski(seg_));
    if ( !outer ) return;

    let track = new SphTrack();
    track.lay(inner, outer, shift);
    for ( let seg of track.inner )
      for ( let [angle, inter_seg, offset] of this.spin(seg) )
        if ( angle < 2 && angle > 0 && offset == 0 )
          if ( inter_seg.track && !track.latches.has(inter_seg.track) ) {
            let track_ = inter_seg.track;
            let center  = this.mod4(track .thetaOf(circle_.center));
            let center_ = this.mod4(track_.thetaOf(circle .center));
            let [ang, arc, arc_, meeted] = this.relationToCircle(track, track_);
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
  partitionByBoundaries(...fences) {
    let partition = [];

    let unprocessed = new Set(fences);
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
   * Find untwistable part along given track if this track is untwistable.
   *
   * @param {SphSeg[]} fence - The segments at one side of track.
   * @param {boolean} [global_test=false]
   * @returns {SphSeg[]} The segments of untwistable part.
   */
  raiseShield(fence, global_test=false) {
    let circle0 = fence[0].circle;

    let untwistable = new Set(fence);
    let shield = Array.from(untwistable).flatMap(seg => Array.from(seg.walk()));

    let i;
    do {
      for ( i=0; i<shield.length; i++ ) if ( !untwistable.has(shield[i]) ) {
        let test = this.relationToCircle(shield[i].circle, circle0)[3] == 2;
        if ( global_test )
          test = test || !this.isTwistable(shield[i], shield, global_test);

        if ( test ) {
          let new_untwistable = new Set([shield[i]]);
          for ( let unseg of new_untwistable ) {
            // shortcut
            for ( let adj_seg of unseg.adj.keys() )
              new_untwistable.add(adj_seg);

            // special case
            for ( let [ang, seg,, prefer] of this.spin(unseg, 0, +1, +1) )
              if ( prefer == -1 && this.cmp(ang, 2) == 0 )
                if ( segments.includes(seg) && this.cmp(unseg.radius, seg.radius) > 0 )
                  new_untwistable.add(seg);

            for ( let [ang, seg,, prefer] of this.spin(unseg, unseg.arc, -1, -1) )
              if ( prefer == +1 && this.cmp(-ang, 2) == 0 )
                if ( segments.includes(seg) && this.cmp(unseg.radius, seg.radius) > 0 )
                  new_untwistable.add(seg);
          }

          for ( let unseg of new_untwistable ) {
            untwistable.add(unseg);
            if ( !shield.includes(unseg) )
              shield.push(...unseg.walk());
          }

          if ( global_test )
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
      let pre = subcracks.filter(crack => crack.angle==0);
      let post = subcracks.filter(crack => crack.angle==2);
      for ( let crack1 of pre ) for ( let crack2 of post )
        if ( this.cmp(2-crack1.segment.radius, crack2.segment.radius) == 0 )
          if ( !shield || !shield.includes(crack2.segment) )
            return true;
      return false;
    };

    let ticks = [];
    let theta0 = 0;
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

    let latches = [];
    let centers = new Set();
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
        let arc = abCA(radius*Q, fence[0].radius*Q, (2-angle)*Q)/Q*2;
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

        if ( shield && !this.isSeparableBy(shield, tick.segment) )
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
    let latches = {};
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
      const ABca = (A, B, c) => 2-abCA((2-A)*Q, (2-B)*Q, (2-c)*Q)/Q;
      let dis = ABca(2-angle, arc/2, circle.radius);
      let radius = ABca(arc/2, 2-angle, circle.radius);
      let vec = [
        Math.sin(dis*Q)*Math.cos(theta*Q),
        Math.sin(dis*Q)*Math.sin(theta*Q),
        Math.cos(dis*Q)
      ];
      let center = rotate(vec, circle.orientation);
      let orientation = q_align(center, circle.center);
      return new SphCircle({radius, orientation});
    }

    let passwords = new Map();
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
          let circle = intercircle(track.outer[0], center, arc, angle);
          if ( !this.isSeparableBy(shields.outer, circle) )
            continue;
        }

      } else if ( !latch1.angle && latch2.angle ) {
        latch1 = Object.assign({angle:2-latch2.angle}, latch1);
        if ( shields.inner ) {
          let {center, arc, angle} = latch1;
          let circle = intercircle(track.inner[0], center, arc, angle);
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
    let len1 = 0;
    let inner_ticks = [];
    for ( let seg of track.inner ) {
      inner_ticks.push([seg, len1]);
      len1 += seg.arc;
    }
    console.assert(this.cmp(len1, 4) == 0);
    let len2 = 0
    let outer_ticks = [];
    for ( let seg of track.outer ) {
      outer_ticks.push([seg, len2]);
      len2 += seg.arc;
    }
    console.assert(this.cmp(len2, 4) == 0);

    let keys = new Map();
    for ( let [seg1, offset1] of inner_ticks ) for ( let [seg2, offset2] of outer_ticks ) {
      let key = track.host.analyzer.mod4(offset1+offset2, keys.keys());
      if ( !keys.has(key) )
        keys.set(key, []);
      keys.get(key).push([seg1, seg2]);
    }

    return keys;
  }

  // snapTracks() {}
  // tracksThrough(knot1, index1, knot2, index2) {}

  /**
   * Parse reachable segments (by `next`, `prev` and `adj`) and profile of given
   * segments.
   *
   * @param {SphSeg[]} segments
   * @returns {Array} Walkable parts, with entries `{loops, profile}`, where
   *   `loops` and `profile` are arrays of loop.
   */
  parseWalkable(segments) {
    let parks = [];
    let lost = new Set(segments);
    while ( lost.size ) {
      let park = {loops:[], profile:[]};

      let queue = new Set([lost.values().next().value]);
      for ( let seg0 of queue ) {
        let loop = full(seg0.walk());
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
    let orientation = q_mul(q_align(from, to), [0.5, 0.5, 0.5, -0.5]);
    let circle = new SphCircle({orientation, radius:1});

    // find and sort meets
    let meets = [];
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

    let keys = loop.map(({arc, radius, angle}) => [arc, radius, angle]);
    if ( keys.length == 1 )
      return [{fold:0, patch:keys, center:[0,0,1]}, loop[0]];

    // fix rotation
    let keys0 = keys.slice();
    let offsets = [];
    for ( let i=0; i<keys.length; i++ ) {
      let sgn = this.cmp(keys, keys0);
      if ( sgn == 0 )
        offsets.push(i);
      else if ( sgn < 0 )
        keys0 = keys.slice(), offsets = [i];
      keys.push(keys.shift());
    }

    // make patch
    let patch = keys0.slice(0, (offsets[1]-offsets[0]) || keys0.length);
    let fold = keys0.length / patch.length;
    console.assert(Number.isInteger(fold));
    console.assert(offsets.every((i, n) => i == offsets[0]+patch.length*n));

    let shape = {fold, patch};
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
    let {fold, patch} = shape;
    let N = fold == 0 ? 1 : fold;

    let loop = [];
    let elem = new SphElem();
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
    let segments = Array.from(elements).flatMap(elem => Array.from(elem.boundaries));
    let parks = this.parseWalkable(segments);

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
    let vertex0 = parks[0].vertex;

    let locals = new Set(parks.slice(1));
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
        let park, index;
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

    let seg0 = knot0.segmentAt(index0);
    if ( !seg0.orientation )
      seg0.orientation = orientation0;

    let align = (seg, orientation) => {
      if ( !seg.orientation )
        seg.orientation = orientation.slice();
      else
        console.assert(this.cmp(seg.orientation, orientation) == 0
                       || this.cmp(seg.orientation, orientation.map(x=>-x)) == 0);
    };

    let compass = [0,0,0,1];
    let route = [[knot0, seg0]];
    for ( let [knot, seg0] of route ) {
      let path = Array.from(seg0.walk());
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
    let perm = model.shapes.map(() => []);
    let P = Array(model.shapes.length).fill(0);
    let path = [];

    let add = seg => {
      let [i, j, k] = seg[INDEX];
      if ( perm[i][j] === undefined ) {
        let N = model.shapes[i].fold == 0 ? 1 : model.shapes[i].fold;
        perm[i][j] = [P[i]++, (N-k)%N];
        path.push(...seg.walk());
      }
    };

    add(seg0);

    let explored = new Set();
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
    let length = 0;
    for ( let [index, seg] of model.items(param) ) {
      seg[INDEX] = index;
      length += seg.adj.size;
    }
    length = length/2;
    console.assert(Number.isInteger(length));

    // compare adjacency table
    let cmp = (arr, gen, arr_, gen_) => {
      let sgn;
      for ( let t=0; t<length; t++ ) {
        let val  = arr [t] || (arr [t] = gen .next().value);
        let val_ = arr_[t] || (arr_[t] = gen_.next().value);
        sgn = this.cmp(val, val_);
        if ( sgn != 0 )
          break;
      }
      return sgn;
    };

    let buffer = [[[1]]], crawler;
    let permutations = [];

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
    let res = crawler.next();
    console.assert(res.done);
    permutations.unshift(res.value);

    // structure of config
    let config = new SphConfig({model});
    config.adjacencies = buffer;
    let perm0 = model.inverse(res.value);
    config.symmetries = permutations.map(perm => model.followedBy(perm0, perm))
                                    .sort(this.cmp.bind(this));

    // clear INDEX
    for ( let [index, seg] of model.items(param) )
      delete seg[INDEX];

    return [config, permutations];
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
    let min_perm = [[[config_from.types[0].count]]];
    let sym = [];

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
    let shifts = passwords.map(e => e[0]);
    for ( let i=0; i<passwords.length; i++ )
      passwords[i][0] = (i+1<passwords.length ? shifts[i+1] : shift[0]+4) - shifts[i];

    // center => center_offset

    // cyclic sort matches
    let passwords0 = passwords.slice();
    let shifts0 = [];
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
    let tracks = [];
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
