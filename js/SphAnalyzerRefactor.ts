// little patch for better readability
function assert(val: unknown, msg?: string): asserts val {
  if ( !val )
    throw new Error(msg);
}
function bang<T>(val: T | null | undefined, msg?: string): T {
  if ( val === null || val === undefined )
    throw new Error(msg);
  return val;
}
function cmp(v1: unknown, v2: unknown): number {
  if ( Array.isArray(v1) && Array.isArray(v2) ) {
    const len = Math.min(v1.length, v2.length);
    for ( let i=0; i<len; i++ ) {
      let s = cmp(v1[i], v2[i]);
      if ( s !== 0 )
        return s;
    }
    return cmp(v1.length, v2.length);

  } else {
    // return (v1>v2)-(v2>v1);
    if ( v1 > v2 ) {
      return +1;
    } else if ( v2 > v1 ) {
      return -1;
    } else {
      return 0;
    }
  }
}
class It<T> implements Iterator<T, void, undefined>
{
  private _iterator: Iterator<T, unknown, unknown>;
  constructor(iterator: Iterator<T, unknown, unknown>) {
    this._iterator = iterator;
  }
  [Symbol.iterator](): this {
    return this;
  }
  next(): IteratorResult<T, unknown> {
    return this._iterator.next();
  }

  static from<T>(col: Iterable<T>): It<T> {
    return new It(col[Symbol.iterator]());
  }
  static keys<K>(col: Map<K,unknown>): It<K>;
  static keys<K>(col: Set<K>): It<K>;
  static keys(col: Array<unknown>): It<number>;
  static keys<K>(col: Map<K,unknown> | Set<K> | Array<unknown>): It<K> {
    return new It(col.keys() as IterableIterator<K>);
  }
  static values<V>(col: Map<unknown,V>): It<V>;
  static values<V>(col: Set<V>): It<V>;
  static values<V>(col: Array<V>): It<V>;
  static values<V>(col: Map<unknown,V> | Set<V> | Array<V>): It<V> {
    return new It(col.values());
  }
  static entries<K,V>(col: Map<K,V>): It<[K, V]>;
  static entries<V>(col: Set<V>): It<[V, V]>;
  static entries<V>(col: Array<V>): It<[number, V]>;
  static entries<K,V>(col: Map<K,V> | Set<V> | Array<V>): It<[K, V]> {
    return new It(col.entries() as IterableIterator<[K, V]>);
  }

  static count(start: number=0, end: number=Infinity, step: number=1): It<number> {
    return new It(function*() { for ( let i: number=start; i<end; i+=step ) yield i; }());
  }
  static cycle<T>(...items: T[]): It<T> {
    return new It(function*() { while ( true ) yield* items; }());
  }
  static chain<T>(...iters: Iterable<T>[]): It<T> {
    return new It(function*() { for ( let iter of iters ) yield* iter; }());
  }
  static zip<T1,T2>(iter1: Iterable<T1>, iter2: Iterable<T2>): It<[T1,T2]>;
  static zip<T1,T2,T3>(iter1: Iterable<T1>, iter2: Iterable<T2>, iter3: Iterable<T3>): It<[T1,T2,T3]>;
  static zip<T>(...iters: Iterable<T>[]): It<T[]> {
    let iters_ = iters.map(it => it[Symbol.iterator]());
    return new It(function*() {
      let res = iters_.map(iter => iter.next());
      while ( res.every(r => !r.done) ) {
        yield res.map(r => r.value);
        res = iters_.map(iter => iter.next());
      }
    }());
  }

  map<S>(func: (value: T, index: number) => S): It<S> {
    let iterator = this;
    return new It(function*() {
      let i = 0;
      for ( let value of iterator )
        yield func(value, i++);
    }());
  }
  flatMap<S>(func: (value: T, index: number) => Iterable<S>): It<S> {
    let iterator = this;
    return new It(function*() {
      let i = 0;
      for ( let value of iterator )
        yield* func(value, i++);
    }());
  }
  groupBy(eq: (value1: T, value2: T) => boolean): It<T[]> {
    let iterator = this;
    return new It(function*() {
      let group: T[] = [];

      let {value, done} = iterator.next();
      while ( !done ) {
        group.push(value!);

        let prev = value!;
        {value, done} = iterator.next();

        if ( !done && !eq(prev, value!) ) {
          yield group;
          group = [];
        }
      }

      if ( group.length > 0 )
        yield group;
    }());
  }
  filter(func: (value: T, index: number) => boolean): It<T> {
    let iterator = this;
    return new It(function*() {
      let i = 0;
      for ( let value of iterator )
        if ( func(value, i++) )
          yield value;
    }());
  }
  takeWhile(func: (value: T, index: number) => boolean): It<T> {
    let iterator = this;
    return new It(function*() {
      let i = 0;
      for ( let value of iterator ) {
        if ( !func(value, i++) )
          break;
        yield value;
      }
    }());
  }
  reduce<S>(func: (acc: S, value: T, index: number) => S, init: S): S {
    let i = 0;
    if ( init === undefined ) {
      for ( let item of this ) {
        init = item;
        i++;
        break;
      }
    }
    for ( let item of this )
      init = func(init, item, i++);
    return init;
  }
  every(func: (value: T, index: number) => boolean): boolean {
    let i = 0;
    for ( let item of this )
      if ( !func(item, i++) )
        return false;
    return true;
  }
  some(func: (value: T, index: number) => boolean): boolean {
    let i = 0;
    for ( let item of this )
      if ( func(item, i++) )
        return true;
    return false;
  }
  find(func: (value: T, index: number) => boolean): T | undefined;
  find(func: (value: T, index: number) => boolean, otherwise: T): T;
  find(func: (value: T, index: number) => boolean, otherwise?: T): T | undefined {
    let i = 0;
    for ( let item of this )
      if ( func(item, i++) )
        return item;

    return otherwise;
  }
  findIndex(func: (value: T, index: number) => boolean): number {
    let i = 0;
    for ( let item of this )
      if ( func(item, i++) )
        return i-1;
    return -1;
  }
  findLast(func: (value: T, index: number) => boolean): T | undefined;
  findLast(func: (value: T, index: number) => boolean, otherwise: T): T;
  findLast(func: (value: T, index: number) => boolean, otherwise?: T): T | undefined {
    let i = 0;
    let res = otherwise;
    for ( let item of this )
      if ( func(item, i++) )
        res = item;

    return res;
  }
  findLastIndex(func: (value: T, index: number) => boolean): number {
    return this.reduce((res, item, i) => func(item, i) ? i : res, -1);
  }
  first(): T | undefined;
  first(otherwise: T): T;
  first(otherwise?: T): T | undefined {
    for ( let item of this )
      return item;
    return otherwise;
  }
  last(): T | undefined;
  last(otherwise: T): T;
  last(otherwise?: T): T | undefined {
    let res = otherwise;
    for ( let item of this )
      res = item;
    return res;
  }

  toArray(): T[] {
    return Array.from(this);
  }
  toUniqArray(eq?: (a:T, b:T) => boolean): T[] {
    if ( eq === undefined )
      return Array.from(new Set(this));
    let col: T[] = [];
    for ( let item of this )
      if ( col.find(item_ => eq(item_, item)) === undefined )
        col.push(item);
    return col;
  }
  toSet(eq?: (a:T, b:T) => boolean): Set<T> {
    if ( eq === undefined )
      return new Set(this);
    return new Set(this.toUniqArray(eq));
  }
}

// vector
type Vector = [number, number, number];
function disL1(v1: Vector, v2: Vector=[0,0,0]): number {
  let [x1, y1, z1] = v1;
  let [x2, y2, z2] = v2;
  return Math.abs(x1-x2) + Math.abs(y1-y2) + Math.abs(z1-z2);
}
function dot(v1: Vector, v2: Vector): number {
  let [x1, y1, z1] = v1;
  let [x2, y2, z2] = v2;
  return x1*x2 + y1*y2 + z1*z2;
}
function cross(v1: Vector, v2: Vector, out: Vector=[0,0,0]): Vector {
  let [x1, y1, z1] = v1;
  let [x2, y2, z2] = v2;
  out[0] = y1*z2 - z1*y2;
  out[1] = z1*x2 - x1*z2;
  out[2] = x1*y2 - y1*x2;
  return out;
}
function norm(v: Vector): number {
  return Math.sqrt(dot(v, v));
}
function normalize(v: Vector, out: Vector=[0,0,0]): Vector {
  let [x, y, z] = v;
  let n = norm([x,y,z]);
  out[0] = x/n;
  out[1] = y/n;
  out[2] = z/n;
  return out;
}
function angleBetween(a: Vector, b: Vector, axis?: Vector): number {
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
type Quaternion = [number, number, number, number];
function quaternion(axis: Vector, angle: number, out: Quaternion=[0,0,0,0]): Quaternion {
  let [x, y, z] = axis;
  let s = Math.sin(angle/2);
  let c = Math.cos(angle/2);
  out[0] = x*s;
  out[1] = y*s;
  out[2] = z*s;
  out[3] = c;
  return out;
}
function q_inv(q: Quaternion, out: Quaternion=[0,0,0,0]): Quaternion {
  let [x, y, z, w] = q;
  out[0] = -x;
  out[1] = -y;
  out[2] = -z;
  out[3] =  w;
  return out;
}
function q_mul(q1: Quaternion, q2: Quaternion, out: Quaternion=[0,0,0,0]): Quaternion {
  // [v1, w1] * [v2, w2] = [w1 * v2 + w2 * v1 + v1 x v2, w1 * w2 - v1 * v2]
  let [x1, y1, z1, w1] = q1;
  let [x2, y2, z2, w2] = q2;
  out[0] = w1*x2 + x1*w2 + y1*z2 - z1*y2;
  out[1] = w1*y2 + y1*w2 + z1*x2 - x1*z2;
  out[2] = w1*z2 + z1*w2 + x1*y2 - y1*x2;
  out[3] = w1*w2 - x1*x2 - y1*y2 - z1*z2;
  return out;
}
function q_rotate(v: Quaternion, q: Quaternion, out: Quaternion=[0,0,0,0]): Quaternion {
  return q_mul(q_mul(q, v), q_inv(q), out);
}
function rotate(v: Vector, q: Quaternion, out: Vector=[0,0,0]): Vector {
  let [x, y, z] = v;
  [x, y, z] = q_rotate([x,y,z,0], q);
  out[0] = x;
  out[1] = y;
  out[2] = z;
  return out;
}
function q_align(v: Vector, v_xz?: Vector, out: Quaternion=[0,0,0,0]): Quaternion {
  let [x, y, z] = v;
  let theta = Math.atan2(y, x);
  let phi = Math.atan2(Math.sqrt(x*x+y*y), z);
  let n: Vector = [-Math.sin(theta), Math.cos(theta), 0];
  quaternion(n, phi, out);
  if ( v_xz !== undefined ) {
    let [x_, y_] = rotate(v_xz, q_inv(out));
    let theta_ = Math.atan2(y_, x_);
    q_spin(out, theta_, out);
  }
  return out;
}
function q_spin(q: Quaternion, theta: number, out: Quaternion=[0,0,0,0]): Quaternion {
  return q_mul(q, quaternion([0,0,1], theta), out);
}


function abcA(a: number, b: number, c: number): number {
  // cosine rules for spherical triangle: cos a = cos b cos c + sin b sin c cos A
  // error = (db*cC + dc*cB - da) * sa/(sA*sb*sc)
  let [ca, cb, cc] = [Math.cos(a), Math.cos(b), Math.cos(c)];
  let [sb, sc] = [Math.sin(b), Math.sin(c)];
  let cA = (ca - cb*cc)/(sb*sc);
  return Math.acos(cA);
}
function Abca(A: number, b: number, c: number): number {
  // cosine rules for spherical triangle: cos a = cos b cos c + sin b sin c cos A
  // error = (dA + db*cotC/sb + dc*cotB/sc) * sA*sb*sc/sa
  let cA = Math.cos(A);
  let [cb, cc] = [Math.cos(b), Math.cos(c)];
  let [sb, sc] = [Math.sin(b), Math.sin(c)];
  let ca = cb*cc + sb*sc*cA;
  return Math.acos(ca);
}
function abCA(a: number, b: number, C: number): number {
  // cotangent rule for spherical triangle: cos b cos C = cot a sin b - cot A sin C
  let [ca, sa] = [Math.cos(a), Math.sin(a)];
  let [cb, sb] = [Math.cos(b), Math.sin(b)];
  let [cC, sC] = [Math.cos(C), Math.sin(C)];
  let [cA_, sA_] = [ca*sb-sa*cb*cC, sa*sC];
  if ( sA_ < 0 ) cA_ = -cA_;
  if ( sa < 0 ) sA_ = -sA_;
  return Math.atan2(sA_, cA_);
}

/**
 * Quadrant; unit of angle and arc.  One quadrant is 1/4 of a turn.
 * The method in {@link SphSeg}, {@link SphVertex} and {@link SphAnalyzer} will
 * use this unit for angle and arc.
 * @const
 * @type {number}
 */
const Q: number = Math.PI/2;
/**
 * Modulo 4 with offset.
 *
 * @param {number} val - The value to mod.
 * @param {number} [offset=0] - The offset of range of mod.
 * @returns {number} Modulus.
 */
function mod4(val: number, offset: number=0): number {
  if ( val < offset || val >= 4+offset )
    val = ((val - offset) % 4 + 4) % 4 + offset;
  return val;
}
/**
 * Absolute value with modulus 4.
 *
 * @param {number} val - The value to abs.
 * @returns {number} Absolute value of `val`.
 */
function abs4(val: number): number {
  return Math.min(mod4(val), mod4(-val));
}


enum BREP_DEFECTS {
 TV="trivial_vertices",
 SA="self_adjacent_edges",
 UC="unconnected_components",
 SB="sandglass_bridges",
 BA="bad_alignments"
};

class SphBREP
{
  segments: Set<SphSeg>;
  defects: Record<BREP_DEFECTS, boolean>;

  private segs_observers: Set<SphSeg>[];
  private defects_observers: Record<BREP_DEFECTS, boolean>[];

  constructor(obj: {segments: Iterable<SphSeg>, defects: Record<BREP_DEFECTS, boolean>}={}) {
    let {segments=[], defects={}} = obj;
    this.segments = new Set(segments);
    this.defects = defects;

    this.segs_observers = [];
    this.defects_observers = [];
  }

  add(...segments: SphSeg[]): void {
    for ( let seg of segments ) if ( !this.segments.has(seg) ) {
      for ( let observer of segs_observers )
        observer.add(seg);
      this.segments.add(seg);
    }
  }
  delete(...segments: SphSeg[]): void {
    for ( let seg of segments ) if ( this.segments.has(seg) ) {
      for ( let observer of segs_observers )
        observer.add(seg);
      this.segments.delete(seg);
    }
  }
  set(defect: BREP_DEFECTS, value: boolean): void {
    if ( this.defects.defects[defect] !== value ) {
      this.defects_observers[defect] = true;
      this.defects.defects[defect] = value;
    }
  }
}

/**
 * Boundary segment of element of spherical twisty puzzle.  It is fundamental
 * piece of structure of BREP, and has informations about shape, orientation,
 * incidence relations and connectivity.
 *
 * It is hard to keep representation flawless, especially for connectivity.
 * So we should be able to manipulate puzzle with imprefect BREP, which allows
 * three kinds of fixable defects: trivial vertices, self-adjacent edges,
 * unconnected components.  Those defects make process easier and faster, but
 * isn't good for analyzation, so eventually it should back to prefect BREP to
 * see deeper structure.  There are two kinds of fixable defects we should
 * prevent to produce: sandglass bridge, bad alignment; with them the processes
 * become harder and have more calculation error.
 *
 * @class
 * @property {number} arc - Spherical arc angle of segment, in the range of (0, 4].
 *   Notice that it doesn't guarantee that arc should equal to 4 if it form a full
 *   circle, which can be determined by `this.forward === this`.
 * @property {number} angle - Angle between this segment and previous segment.
 *   The direction is from this segment to previous segment, in the range of [0, 4].
 *   Notice that it doesn't guarantee that angle should equal to 2 or 4 if previous
 *   segment is aligned with/adjacent to this segment.
 * @property {number} radius - Radius of curvature of segment, in the range of (0, 2).
 * @property {Quaternion} orientation - Orientation of this segment.
 *   It will rotate `[0,0,1]` to center of curvature of this segment, and rotate
 *   `[s,0,c]` to the start point of this segment.
 * @property {SphSeg} [next] - The next segment.
 * @property {SphSeg} [prev] - The previous segment.
 * @property {SphSeg} [forward] - The forward segment.
 * @property {SphSeg} [backward] - The backward segment.
 * @property {Map<number, SphSeg>} adj - The map of adjacenct relations, which
 *   map `offset` to `seg`: `seg` is adjacent segment with `offset` between
 *   vertices.  `offset` should be less than `this.arc + seg.arc`.
 *   Each entry describe an contact region, which is interval from
 *   `Math.max(0, offset-seg.arc)` to `Math.min(this.arc, offset)`.
 *   adjacent segment has same adjacency relation with same offset.  This map
 *   is sorted by offsets.
 *   Notice that it doesn't guarantee that `offset` should equal to `this.arc`\
 *   `seg.arc` if it is right/left-aligned.
 * @property {Set<SphSeg>} siblings - The segments that are reachable from the
 *   interior of enclosed region.  The region surrounding by those segments
 *   should be connected.  Notice that it cannot be represented as an element
 *   of spherical twisty puzzle, which may be composed by multiple connected
 *   components.
 */
class SphSeg
{
  arc: number;
  angle: number;
  radius: number;
  orientation: Quaternion;
  next?: SphSeg;
  prev?: SphSeg;
  forward?: SphSeg;
  backward?: SphSeg;
  adj: Map<number, SphSeg>;
  siblings: Set<SphSeg>;

  private attr_observers: Record<"arc"|"angle"|"radius"|"orientation", boolean>[];
  private link_observers: Record<"next"|"prev"|"forward"|"backward"|"siblings", boolean>[];
  private adj_observers: Set<number>[];

  constructor(obj: {arc: number, angle: number, radius: number, orientation?: Quaternion}) {
    let {arc, angle, radius, orientation=[0,0,0,1]} = obj;
    this.radius = radius;
    this.orientation = orientation.slice() as Quaternion;

    this.arc = arc;
    this.angle = angle;

    this.next = undefined;
    this.prev = undefined;
    this.forward = undefined;
    this.backward = undefined;
    this.adj = new Map();
    this.siblings = new Set([this]);

    this.attr_observers = [];
    this.link_observers = [];
    this.adj_observers = [];
  }
  static makeCircle(obj: {radius: number, center?: Vector, orientation?: Quaternion}): SphSeg {
    let {radius, center, orientation=q_align(bang(center))} = obj;
    let circle = new SphSeg({arc:4, angle:2, radius, orientation});
    let circle_ = new SphSeg({arc:4, angle:2, radius:2-radius, orientation:q_mul(orientation, [1,0,0,0])});

    circle.join(circle_);
    circle.connect(circle);
    circle_.connect(circle_);
    circle.lineup(circle);
    circle_.lineup(circle_);
    circle.adjacent(4, circle_);
    return circle;
  }
  static makeArc(obj: {arc: number, radius: number, orientation: Quaternion}): SphSeg {
    let {arc, radius, orientation} = obj;
    let seg = new SphSeg({arc, angle:4, radius, orientation});
    let seg_ = new SphSeg({arc, angle:4, radius:2-radius, orientation:q_mul(q_spin(orientation, arc), [1,0,0,0])});

    seg.join(seg_);
    seg.connect(seg_);
    if ( arc === 4 ) {
      seg.lineup(seg);
      seg_.lineup(seg_);
    }
    seg.adjacent(arc, seg_);
    return seg;
  }

  getCenter(): Vector {
    return rotate([0,0,1], this.orientation);
  }
  isLeftAligned(): boolean {
    let [adj_offset, adj_seg] = It.entries(this.adj).first()!;
    let [offset, seg] = It.entries(adj_seg).last()!;
    return offset === adj_offset;
  }
  isRightAligned(): boolean {
    let [adj_offset, adj_seg] = It.entries(this.adj).last()!;
    let [offset, seg] = It.entries(adj_seg).first()!;
    return offset === adj_offset;
  }

  *walk(): Generator<SphSeg,boolean,unknown> {
    let seg: SphSeg = this;
    do {
      yield seg;
      if ( seg.next === undefined )
        return false;
      seg = seg.next;
    } while ( seg !== this );
    return true;
  }
  *ski(dir: number=+1): Generator<SphSeg,boolean,unknown> {
    let seg: SphSeg = this;
    if ( dir > 0 ) {
      do {
        yield seg;
        if ( seg.forward === undefined )
          return false;
        seg = seg.forward;
      } while ( seg !== this );
    } else {
      do {
        yield seg;
        if ( seg.backward === undefined )
          return false;
        seg = seg.backward;
      } while ( seg !== this );
    }
    return true;
  }
  *fly(): Generator<SphSeg,void,unknown> {
    let segs = new Set(this.siblings);
    for ( let seg0 of segs ) {
      for ( let seg of seg0.walk() )
        segs.delete(seg);
      yield seg0;
    }
  }
  links(): Set<SphSeg> {
    let res = new Set<SphSeg>();
    res.add(this);
    if ( this.next !== undefined )
      res.add(this.next);
    if ( this.prev !== undefined )
      res.add(this.prev);
    for ( let seg of this.siblings )
      res.add(seg);
    for ( let seg of this.adj.values() )
      res.add(seg);
    if ( this.forward !== undefined )
      res.add(this.forward);
    if ( this.backward !== undefined )
      res.add(this.backward);
    return res;
  }

  /**
   * Get position of vector projected onto this circle.
   *
   * @param {Vector} vector - The vector to project.
   * @returns {number} The coordinate of projected vector.
   *   Notice that it may not modulus of 4.
   */
  thetaOf(vector: Vector): number {
    let [x, y] = rotate(vector, q_inv(this.orientation));
    return Math.atan2(y, x)/Q;
  }
  /**
   * Get vector of on this circle with given coordinate.
   *
   * @param {number} theta - The coordinate of point on this circle.
   * @returns {Vector} The vector on this circle with coordinate `theta`.
   */
  vectorAt(theta: number): Vector {
    let vec: Vector = [
      Math.sin(this.radius*Q)*Math.cos(theta*Q),
      Math.sin(this.radius*Q)*Math.sin(theta*Q),
      Math.cos(this.radius*Q)
    ];
    return rotate(vec, this.orientation);
  }

  connect(seg?: SphSeg, angle?: number): void {
    if ( seg === undefined ) {
      if ( this.next !== undefined ) {
        for ( let observer of this.link_observers )
          observer["next"] = true;
        for ( let observer of this.next.link_observers )
          observer["prev"] = true;
        this.next.prev = undefined;
        this.next = undefined;
      }

    } else {
      if ( seg.prev !== undefined )
        seg.prev.connect();
      if ( this.next !== undefined )
        this.connect();
      for ( let observer of this.link_observers )
        observer["next"] = true;
      for ( let observer of seg.link_observers )
        observer["prev"] = true;
      [this.next, seg.prev] = [seg, this];

      if ( angle !== undefined ) {
        for ( let observer of seg.attr_observers )
          observer["angle"] = true;
        seg.angle = angle;
      }
    }
  }
  lineup(seg?: SphSeg): void {
    if ( seg === undefined ) {
      if ( this.forward !== undefined ) {
        for ( let observer of this.link_observers )
          observer["forward"] = true;
        for ( let observer of this.forward.link_observers )
          observer["backward"] = true;
        this.forward.backward = undefined;
        this.forward = undefined;
      }

    } else {
      if ( seg.backward !== undefined )
        seg.backward.lineup();
      if ( this.forward !== undefined )
        this.lineup();
      for ( let observer of this.link_observers )
        observer["forward"] = true;
      for ( let observer of seg.link_observers )
        observer["backward"] = true;
      [this.forward, seg.backward] = [seg, this];
    }
  }
  adjacent(offset: number, seg?: SphSeg): void {
    if ( seg === undefined ) {
      seg = this.adj.get(offset);
      if ( seg !== undefined ) {
        for ( let observer of this.adj_observers )
          observer.add(offset);
        for ( let observer of seg.adj_observers )
          observer.add(offset);
        seg.adj.delete(offset);
        this.adj.delete(offset);
      }

    } else {
      if ( this.adj.has(offset) )
        this.adjacent(offset);
      if ( seg.adj.has(offset) )
        seg.adjacent(offset);

      for ( let observer of this.adj_observers )
        observer.add(offset);
      for ( let observer of seg.adj_observers )
        observer.add(offset);
      this.adj.set(offset, seg);
      for ( let [offset_, adj_seg] of this.adj.entries() )
        if ( offset_ > offset ) {
          this.adj.delete(offset_);
          this.adj.set(offset_, adj_seg);
        }
      seg.adj.set(offset, this);
      for ( let [offset_, adj_seg] of seg.adj.entries() )
        if ( offset_ > offset ) {
          seg.adj.delete(offset_);
          seg.adj.set(offset_, adj_seg);
        }
    }
  }
  join(...segments: SphSeg[]): this {
    for ( let segment of segments )
      if ( segment.siblings !== this.siblings )
        for ( let seg of segment.siblings ) {
          for ( let observer of this.link_observers )
            observer["siblings"] = true;
          for ( let observer of seg.link_observers )
            observer["siblings"] = true;
          (seg.siblings = this.siblings).add(seg);
        }
    return this;
  }
  split(...groups: Iterable<SphSeg>[]): Set<SphSeg>[] {
    let components = groups.map(group => new Set(group))
                           .filter(group => group.size);
    for ( let component of components )
      for ( let seg of component ) {
        for ( let observer of this.link_observers )
          observer["siblings"] = true;
        for ( let observer of seg.link_observers )
          observer["siblings"] = true;
        this.siblings.delete(seg);
        seg.siblings = component;
      }
    return components;
  }

  rotate(q: Quaternion): this {
    for ( let observer of this.attr_observers )
      observer["orientation"] = true;
    q_mul(q, this.orientation, this.orientation);
    return this;
  }
  shift(theta: number): this {
    for ( let observer of this.attr_observers )
      observer["orientation"] = true;
    q_spin(this.orientation, theta*Q, this.orientation);
    return this;
  }
  setArc(arc: number): this {
    for ( let observer of this.attr_observers )
      observer["arc"] = true;
    this.arc = arc;
    return this;
  }
}

/**
 * Oriented point on a segment.  This class is to make algorithms easier and
 * more clear; it is not part of BREP.
 *
 * The position of this point is `segment.vectorAt(offset)`, and `prefer` is
 * the sign represents the orientation of the point, which can be thought of as
 * the perturbation of rotation: `quaternion(segment.getCenter(), prefer * tol)`.
 *
 * @class
 * @property {SphSeg} segment - The host segment of this point.
 * @property {number} offset - Offset of this point respect to `segment`.  It
 *   should be in the range of [0, `segment.arc`].
 * @property {number} prefer - The prefer side of this point respect to `segment`.
 *   `+1` means upper limit of offset; `-1` means lower limit of offset.
 * @property {boolean} aligned - The alignment of this point to the end point.
 */
class SphVertex
{
  segment: SphSeg;
  offset: number;
  prefer: number;
  aligned: boolean;

  constructor(obj: {segment: SphSeg, offset: number, prefer?: number, aligned?: boolean}) {
    let {segment, offset, prefer=+1, aligned=false} = obj;
    this.segment = segment;
    this.offset = offset;
    this.prefer = Math.sign(prefer);
    this.aligned = aligned;
  }
  static startOf(seg: SphSeg): SphVertex {
    return new SphVertex({segment:seg, offset:0, prefer:+1, aligned:true});
  }
  static endOf(seg: SphSeg): SphVertex {
    return new SphVertex({segment:seg, offset:seg.arc, prefer:-1, aligned:true});
  }

  getPosition(): Vector {
    let {segment, offset} = this;
    let vec: Vector = [
      Math.sin(segment.radius*Q)*Math.cos(offset*Q),
      Math.sin(segment.radius*Q)*Math.sin(offset*Q),
      Math.cos(segment.radius*Q)
    ];
    rotate(vec, segment.orientation, vec);
    return vec;
  }
  getTangent(): Vector {
    let {segment, offset, prefer} = this;
    let vec: Vector = [Math.cos((offset+prefer)*Q), Math.sin((offset+prefer)*Q), 0];
    rotate(vec, segment.orientation, vec);
    return vec;
  }
  getTurnAngle(): number {
    let {segment, offset, prefer, aligned} = this;

    let angle;
    if ( prefer === +1 ) {
      angle = aligned ? segment.angle : 2;
    } else {
      angle = aligned ? segment.next!.angle : 2;
    }

    return angle;
  }
  angleTo(vertex: SphVertex, side?: number, aligned: boolean=false): number {
    let angle = angleBetween(vertex.getTangent(), this.getTangent())/Q;
    if ( aligned ) {
      return (abs4(angle) < 1 ? 0 : 2) * Math.sign(side!);
    } else if ( side === undefined ) {
      return mod4(angle, -2);
    } else if ( side > 0 ) {
      return mod4(angle, -1); // almost in [0, 2]
    } else {
      return mod4(angle, -3); // almost in [-2, 0]
    }
  }

  /**
   * Turn to another edge of this vertex.
   *
   * @returns {this}
   */
  turn(): this {
    let {segment, offset, prefer, aligned} = this;

    if ( prefer === +1 && aligned ) {
      assert(segment.prev);
      [segment, offset] = [segment.prev, segment.prev.arc];
    } else if ( prefer === -1 && aligned ) {
      assert(segment.next);
      [segment, offset] = [segment.next, 0];
    }

    this.segment = segment;
    this.ofset = ofset;
    this.prefer = -prefer;
    return this;
  }
  /**
   * Turn to opposite direction of this vertex.
   *
   * @returns {this}
   */
  back(): this {
    let {segment, offset, prefer, aligned} = this;

    if ( prefer === +1 && aligned ) {
      assert(segment.backward);
      [segment, offset] = [segment.backward, segment.backward.arc];
    } else if ( prefer === -1 && aligned ) {
      assert(segment.forward);
      [segment, offset] = [segment.forward, 0];
    }

    this.segment = segment;
    this.ofset = ofset;
    this.prefer = -prefer;
    return this;
  }
  /**
   * Jump to the vertex on the adjacent segment.
   *
   * @returns {this}
   */
  jump(): this {
    let {segment, offset, prefer, aligned} = this;
    let adj_seg: SphSeg, adj_offset: number, adj_aligned: boolean;

    if ( prefer === +1 && aligned ) {
      [adj_offset, adj_seg] = bang(It.entries(segment.adj).first());
      adj_aligned = segment.isLeftAligned();

    } else if ( prefer === -1 && aligned ) {
      [adj_offset, adj_seg] = bang(It.entries(segment.adj).last());
      adj_offset = It.keys(adj_seg.adj).findLast(offset_ => offset_ < adj_offset, 0);
      adj_aligned = segment.isRightAligned();

    } else if ( segment.adj.has(offset) ) {
      adj_seg = bang(segment.adj.get(offset));
      if ( prefer === -1 ) {
        adj_offset = 0;
      } else {
        assert(adj_seg.backward);
        [adj_seg, adj_offset] = [adj_seg.backward, adj_seg.backward.arc];
      }
      adj_aligned = true;

    } else {
      let offset_;
      [offset_, adj_seg] = bang(It.entries(segment.adj).find(([offset_]) => offset_ > adj_offset));
      adj_offset = offset_ - adj_offset;
      adj_aligned = false;
    }

    this.segment = adj_seg;
    this.offset = adj_offset;
    this.prefer = -prefer;
    this.aligned = adj_aligned;
    return this;
  }
  /**
   * Spinning around this vertex.
   * This generator will go through all vertices around this point, and stop
   * before returning to the starting vertex or has no next vertex.
   *
   * @param {number} [dir=+1] - Direction of spin: `+1` means counterclockwise.
   * @yields {[number, SphVertex]} Spinning angle and corresponding vertex.
   * @returns {boolean} True if it return to the first vertex finally.
   */
  *spin(dir: number=+1): Generator<[number, SphVertex], boolean, undefined> {
    let angle = 0;
    let vertex = new SphVertex(this);

    do {
      yield [angle, new SphVertex(vertex)];

      if ( vertex.prefer * dir < 0 ) {
        vertex = vertex.jump();
      } else if ( dir < 0 ) {
        vertex = vertex.turn();
        angle = angle - vertex.getTurnAngle();
      } else {
        vertex = vertex.turn();
        angle = angle + vertex.getTurnAngle();
      }

    } while ( !this.equal(vertex) );

    return true;
  }

  equal(vertex: SphVertex): boolean {
    return this.segment === vertex.segment && this.prefer === vertex.prefer
        && this.aligned === vertex.aligned && (this.aligned || this.offset === vertex.offset);
  }
}

type Angle = {right: SphVertex, left: SphVertex, angle: number};
type Contact = {start: SphVertex, end: SphVertex};
type Dash = {start: SphVertex, end: SphVertex, siblings: Set<SphSeg>};
type Align = {backward: SphVertex, forward: SphVertex};

enum REL {
  INSIDE=1,
  OUTSIDE=2,
  INLINE=3,
  OUTLINE=4,
  BOTHSIDE=5
};


/**
 * Analyzer for spherical twisty puzzle.
 *
 * It provide algorithms to manipulate and manage spherical twisty puzzle.  We
 * provide algorithms to generate instruction and execute instruction separately,
 * which make the manipulation of detail possible, such as instruction previewing/
 * recording, multi-selections mode, etc.  We try to implement algorithms without
 * any calculation error, otherwise we will carefully deal with it; sometimes it
 * will cause inconsistent results.
 *
 * instruction => macro: relative coordinate, partial dependency
 * algorithms for relative coordinate
 * dirty algorithms
 *
 * @class
 */
class SphAnalyzer
{
  tol: number;
  constructor(tol: number=1e-5) {
    this.tol = tol;
  }
  /**
   * Fuzzy compare two values with tolerance `this.tol`.
   * It will compare array of numbers by lexical order.
   *
   * @param {unknown} v1 - The first value to compare.
   * @param {unknown} v2 - The second value to compare.
   * @returns {number} `0` if `v1` is almost equal to `v2`; `+1` if `v1` is
   *   greater than `v2`; `-1` if `v1` is less than `v2`.
   */
  fzy_cmp(v1: unknown, v2: unknown): number {
    if ( v1 === v2 ) {
      return 0;

    } else if ( typeof v1 === "string" && typeof v2 === "string" ) {
      return cmp(v1, v2);

    } else if ( typeof v1 === "number" && typeof v2 === "number" ) {
      return Math.abs(v1-v2) <= this.tol ? 0 : cmp(v1, v2);

    } else if ( Array.isArray(v1) && Array.isArray(v2) ) {
      for ( let i=0, len=Math.min(v1.length, v2.length); i<len; i++ ) {
        let s = this.fzy_cmp(v1[i], v2[i]);
        if ( s !== 0 )
          return s;
      }
      return cmp(v1.length, v2.length);

    } else {
      throw new Error("incomparable");
    }
  }
  fzy_snap<T>(val: T, snaps: Iterable<T>=[]): T {
    for ( let snap of snaps )
      if ( this.fzy_cmp(val, snap) === 0 )
        return snap;
    return val;
  }
  fzy_mod4(val: number, offset: number=0, snaps: Iterable<number>=[]): number {
    val = mod4(val, offset);

    for ( let snap of snaps )
      if ( this.fzy_cmp(mod4(val-snap, 2), 2) === 0 )
        return snap;

    return val;
  }

  /**
   * Determine relation between circle and point.
   *
   * @param {SphSeg} knife - The circle to compare.
   * @param {Vector} point - The point to compare.
   * @returns {REL} The value representing their relation: `REL.INSIDE`
   *   /`REL.OUTSIDE` means the point is inside/outside the circle, and
   *   `REL.BOTHSIDE` means the point is on the edge of the circle.
   */
  meetWithPoint(knife: SphSeg, point: Vector): REL {
    let sgn = this.fzy_cmp(knife.radius, angleBetween(knife.getCenter(), point)/Q);
    if ( sgn > 0 ) {
      return REL.INSIDE;
    } else if ( sgn < 0 ) {
      return REL.OUTSIDE;
    } else {
      return REL.BOTHSIDE;
    }
  }
  /**
   * Determine relation between circles.
   * All relations can be classified as: equal, complement, (kissing) include,
   * (kissing) exclude, (kissing) anti-include, (kissing) anti-exclude, and
   * intersect.  Where kissing means two circles touch at one point; anti- means
   * relation between their complements.
   *
   * @param {SphSeg} knife - The first circle to compare.
   * @param {SphSeg} circle - The second circle to compare.
   * @returns {[REL, Vector[]]} The relation and a list of meet points.
   *   The value represents the relation between circles:
   *   `REL.OUTSIDE`/`REL.INSIDE` means all points on the edge of `circle` are
   *   inside/outside `knife` (ignoring the kissing point);
   *   `REL.INLINE`/`REL.OUTLINE` means `circle` and `knife` are equal
   *   /complement;
   *   `REL.BOTHSIDE` means they intersect.
   *   The list of points are meet points between two edge of circles, note that
   *   if they are equal or complement, this list is empty; if they meet at two
   *   points, the first/second point in the list will run into/out of the
   *   `knife` along the orientation of `circle`.
   */
  meetWithCircle(knife: SphSeg, circle: SphSeg): [REL, Vector[]] {
    let radius1 = knife.radius;
    let radius2 = circle.radius;
    let distance = angleBetween(knife.getCenter(), circle.getCenter())/Q;
    assert(this.fzy_cmp(distance, 0) >= 0 && this.fzy_cmp(distance, 2) <= 0);
    assert(this.fzy_cmp(radius1, 0) > 0 && this.fzy_cmp(radius1, 2) < 0);
    assert(this.fzy_cmp(radius2, 0) > 0 && this.fzy_cmp(radius2, 2) < 0);

    let rel, offset, num;
    if ( this.fzy_cmp(distance, 0) === 0 && this.fzy_cmp(radius1, radius2) === 0 ) {
      [rel, offset, num] = [REL.INLINE,  0, Infinity]; // equal
    } else if ( this.fzy_cmp(distance, 2) === 0 && this.fzy_cmp(radius1 + radius2, 2) === 0 ) {
      [rel, offset, num] = [REL.OUTLINE, 0, Infinity]; // complement
    } else if ( this.fzy_cmp(radius1, abs4(distance + radius2)) >  0 ) {
      [rel, offset, num] = [REL.INSIDE,  2, 0]; // include, anti-exclude
    } else if ( this.fzy_cmp(radius1, abs4(distance + radius2)) === 0 ) {
      [rel, offset, num] = [REL.INSIDE,  2, 1]; // kissing include, kissing anti-exclude
    } else if ( this.fzy_cmp(radius1, abs4(distance - radius2)) <  0 ) {
      [rel, offset, num] = [REL.OUTSIDE, 0, 0]; // exclude, anti-include
    } else if ( this.fzy_cmp(radius1, abs4(distance - radius2)) === 0 ) {
      [rel, offset, num] = [REL.OUTSIDE, 0, 1]; // kissing exclude, kissing anti-include
    } else if ( distance < radius1 + radius2 ) {
      [rel, offset, num] = [REL.BOTHSIDE, abcA(radius1, radius2, distance), 2]; // intersect
    } else {
      throw new Error(`unknown case: [${radius1}, ${radius2}, ${distance}]`);
    }

    let meets: Vector[] = [];
    if ( num === 2 ) {
      let theta0 = circle.thetaOf(knife.getCenter());
      meets.push(circle.vectorAt(theta0-offset)); // in
      meets.push(circle.vectorAt(theta0+offset)); // out

    } else if ( num === 1 ) {
      let theta0 = circle.thetaOf(knife.getCenter());
      meets.push(circle.vectorAt(theta0-offset));

    } else {
      // no meet
    }

    return [rel, meets];
  }

  check(seg: SphSeg): void {
    // check incidence relations by absolute coordinate
    if ( seg.prev ) {
      let p1 = seg.prev.vectorAt(seg.prev.arc);
      let p2 = seg.vectorAt(0);
      assert(this.fzy_cmp(disL1(p1, p2), 0) === 0);
    }
    if ( seg.next ) {
      let p1 = seg.next.vectorAt(0);
      let p2 = seg.vectorAt(seg.arc);
      assert(this.fzy_cmp(disL1(p1, p2), 0) === 0);
    }
    if ( seg.backward ) {
      let p1 = seg.backward.vectorAt(seg.backward.arc);
      let p2 = seg.vectorAt(0);
      assert(this.fzy_cmp(disL1(p1, p2), 0) === 0);
      assert(this.meetWithCircle(seg.backward, seg)[0] === REL.INLINE);
    }
    if ( seg.forward ) {
      let p1 = seg.forward.vectorAt(0);
      let p2 = seg.vectorAt(seg.arc);
      assert(this.fzy_cmp(disL1(p1, p2), 0) === 0);
      assert(this.meetWithCircle(seg.forward, seg)[0] === REL.INLINE);
    }
    for ( let [offset, adj_seg] of seg.adj ) {
      assert(this.meetWithCircle(adj_seg, seg)[0] === REL.OUTLINE);
    }
    if ( seg.isLeftAligned() ) {
      let seg_left = It.values(seg.adj).first()!;
      let p1 = seg_left.vectorAt(seg_left.arc);
      let p2 = seg.vectorAt(0);
      assert(this.fzy_cmp(disL1(p1, p2), 0) === 0);
    }
    if ( seg.isRightAligned() ) {
      let seg_right = It.values(seg.adj).last()!;
      let p1 = seg_right.vectorAt(0);
      let p2 = seg.vectorAt(seg.arc);
      assert(this.fzy_cmp(disL1(p1, p2), 0) === 0);
    }

    // check incidence relations by relative coordinate
    if ( seg.backward ) {
      let [ang, v] = It.from(SphVertex.startOf(seg).spin(+1)).find(([ang, v]) => v.prefer === -1 && v.segment === seg.backward);
      assert(this.fzy_cmp([2, seg.radius], [ang, v.segment.radius]) === 0);
    }
    if ( seg.forward ) {
      let [ang, v] = It.from(SphVertex.endOf(seg).spin(-1)).find(([ang, v]) => v.prefer === +1 && v.segment === seg.forward);
      assert(this.fzy_cmp([-2, seg.radius], [ang, v.segment.radius]) === 0);
    }
    if ( seg.isLeftAligned() ) {
      let [offset, seg_left] = It.from(seg.adj).first()!;
      assert(this.fzy_cmp(offset, seg_left.arc) === 0);
    }
    if ( seg.isRightAligned() ) {
      let offset = It.keys(seg.adj).last()!;
      assert(this.fzy_cmp(offset, seg.arc) === 0);
    }
  }

  /**
   * Split a segment into two segments.
   * This segment will be in-place modified as the first part, and create new
   * object as the second part.
   *
   * @param {SphSeg} seg - The segment to split.
   * @param {number} offset - The position to split.  It should be in the range
   *   of (0, `seg.arc`), and snapping to keys of `seg.adj`.
   * @returns {SphSeg} The second part segment after splitting.
   */
  interpolate(seg: SphSeg, offset: number): SphSeg {
    // make next segment started from point of interpolation
    let splitted = new SphSeg(segment);
    splitted.shift(offset);
    splitted.setArc(segment.arc - offset);
    segment.setArc(offset);

    // merge loop
    segment.join(splitted);
    splitted.connect(segment.next);
    segment.connect(splitted, 2);
    splitted.lineup(segment.forward);
    segment.lineup(splitted);

    // split adjacent
    let offset_ = -offset;
    for ( let [offset, adj_seg] of Array.from(segment.adj) ) {
      if ( offset_ >= 0 )
        segment.adjacent(offset);
      offset_ = offset - offset;
      if ( offset_ > 0 )
        splitted.adjacent(offset_, adj_seg);
    }

    return splitted;
  }
  /**
   * Merge a segment with the previous segment, which also must be backward
   * segment, and remove this segment from `siblings`.
   * The radius and center of them should be same, and this segment cannot be
   * self connected.
   *
   * @param {SphSeg} seg - The segment to merge.
   * @returns {SphSeg} The previus segment.
   */
  mergePrev(seg: SphSeg): SphSeg {
    // merge segment
    let merged = bang(seg.prev);
    let theta = merged.arc;
    merged.setArc(merged.arc + seg.arc);

    // merge loop
    merged.connect(seg.next);
    merged.lineup(seg.forward);
    merged.split([seg]);

    // merge adjacent
    let adj = Array.from(seg.adj);
    if ( !seg.isLeftAligned() )
      adj.shift();
    for ( let [offset, ] of seg.adj )
      seg.adjacent(offset);
    for ( let [offset, adj_seg] of adj )
      merged.adjacent(offset+theta, adj_seg);

    return merged;
  }

  splitSeg(...vertices: SphVertex[]): Map<SphVertex, SphSeg> {
    assert(vertices.every(v => v.prefer === +1));

    let segments = new Map<SphSeg, SphVertex[]>();
    for ( let vertex of vertices ) {
      if ( !segments.has(vertex.segment) )
        segments.set(vertex.segment, []);
      segments.get(vertex.segment)!.push(vertex);
    }

    let splitted = new Map<SphVertex, SphSeg>();
    for ( let [seg, children] of segments ) {
      children.sort((a, b) => -(a.offset-b.offset));
      let seg_: SphSeg;
      for ( let vertex of children ) {
        if ( vertex.aligned ) {
          splitted.set(vertex, vertex.segment);
        } else {
          if ( vertex.offset !== seg.arc )
            seg_ = this.interpolate(vertex.segment, vertex.offset);
          splitted.set(vertex, bang(seg_));
        }
      }
    }

    return splitted;
  }
  /**
   * Swap connection of two segments.
   * The vertices of segments must be at the same position, and segments should
   * be siblings.  It have two modes: exclusive segments become inclusive segments
   * in merge mode; inclusive segments become exclusive segments in split mode.
   *
   * @param {1 | -1} mode - The swap type: `1` is merge mode, `-1` is split mode.
   * @param {...Object[]} turns - The array of requests.
   *   Each entry represents an angle between two segment `{right, left, angle}`.
   * @returns {Map<SphVertex, SphSeg>} The map from vertices to splitted segments.
   */
  swapSeg(mode: 1|-1, ...turns: {left:SphSeg, right:SphSeg, angle:number}[]): Map<SphVertex, SphSeg> {
    // make swappers
    let swappers = new Map<SphSeg, {left:SphSeg, right:SphSeg, angle:number}[]>();
    for ( let {left, right, angle} of turns ) {
      let left_swapper = swappers.get(left) || [];
      let right_swapper = swappers.get(right) || [];
      assert(left_swapper.length === 0 || left_swapper[left_swapper.length-1].right === left);
      assert(right_swapper.length === 0 || right_swapper[0].left === right);

      if ( right_swapper === left_swapper ) // circular swapper => drop one turn
        continue;

      let swapper = [...left_swapper, {right, left, angle}, ...right_swapper];
      swappers.delete(right);
      swappers.delete(left);
      swappers.set(swapper[swapper.length-1].right, swapper);
      swappers.set(swapper[0].left, swapper);
    }

    // swap
    for ( let swapper of It.values(swappers).toSet() ) {
      if ( mode < 0 )
        swapper.reverse();
      for ( {left, right, angle} of swapper ) {
        let [left_prev, right_prev] = [bang(left.prev), bang(right.prev)];
        let [left_ang, right_ang] = [left.angle, right.angle];

        assert(left.siblings === right.siblings);
        if ( mode > 0 ) {
          left_prev.connect(right, left_ang + angle);
          right_prev.connect(left, right_ang - angle + 4);
        } else {
          left_prev.connect(right, left_ang + angle - 4);
          right_prev.connect(left, right_ang - angle);
        }
      }
    }

    return splitted;
  }

  /**
   * Find the contacts between given segments.
   * Contact is pair of vertices that describe left/right bound of the overlapping
   * interval between two segments.
   *
   * @param {Iterable<SphSeg>} segments - The segments to zip.
   * @returns {Contact[]} The contacts.
   */
  findContacts(segments: Iterable<SphSeg>): Contact[] {
    let segments_col = new Set(segments);
    let contacts: Contact[] = [];

    for ( let seg of segments_col ) {
      segments_col.delete(seg);
      for ( let [adj_seg, offset] of seg.adj )
        if ( segments_col.has(adj_seg) ) {
          let offset1 = It.keys(seg.adj).findLast(offset1 => offset1 < offset);
          let start = offset1 !== undefined ? new SphVertex({segment:seg, offset:offset1}) : SphVertex.startOf(seg);
          let offset2 = It.keys(adj_seg.adj).findLast(offset2 => offset2 < offset);
          let end = offset2 !== undefined ? new SphVertex({segment:adj_seg, offset:offset2}) : SphVertex.startOf(adj_seg);
          contacts.push({start, end});
        }
    }

    return contacts;
  }
  /**
   * Glue contacts.  The glued segments should be siblings.
   *
   * @param {Iterable<Contact>} contacts - The contacts to glue.
   * @returns {Set<SphSeg>} The end points of glued contacts.
   */
  glueContacts(contacts: Iterable<Contact>): Set<SphSeg> {
    let contacts_col = Array.from(contacts);

    // find turns
    let turns = new Set<Angle>();
    for ( let {start, end} of contacts_col ) for ( left of [start, end] ) {
      let right = new SphVertex(left).jump().turn();
      if ( !left.equal(right) )
        continue;
      let angle = right.getTurnAngle();
      turns.add({left, right, angle});
    }

    // merge turns
    for ( let turn of turns ) if ( turn.left.aligned && !turn.right.aligned ) {
      let turn_ = turns.find(({left}) => left.equal(turn.right));
      if ( turn_ === undefined )
        continue;

      turns.delete(turn);
      turns.delete(turn_);
      turns.add({left: turn.left, right: turn_.right, angle: turn.angle+turn_.angle});
    }

    // split and swap segments
    let vertices = Array.from(turns).flatMap(({left, right}) => [left, right]);
    let splitted = this.splitSeg(...vertices);
    let swappers = Array.from(turns).map(({left, right, angle}) => {left: splitted.get(left)!, right: splitted.get(right)!, angle});
    this.swapSeg(+1, ...swappers);

    // remove dashes
    let dashes = It.from(swappers).map(({left}) => left).toSet();
    for ( let seg of dashes ) {
      if ( seg.backward !== undefined )
        seg.backward.lineup();
      if ( seg.forward !== undefined )
        seg.lineup();
      seg.split([seg]);
    }

    return It.from(swappers).map(({right}) => right).filter(seg => !dashes.has(seg)).toSet();
  }

  /**
   * Determine relation between circle and boundaries of connected components.
   *
   * The relation between vertices and knife is described by a map from vertices
   * to corresponding relations.  The relation is almost same as the return
   * value of function {@link SphAnalyzer#meetWithPoint}:
   * `REL.INSIDE`/`REL.OUTSIDE` means the vertex is inside/outside the knife;
   * `REL.INLINE`/`REL.OUTLINE` means the vertex is on the edge of knife, but
   * more closed to inside/outside (determined by `vertex.prefer`);
   * `REL.BOTHSIDE` means the vertex is on the edge of knife, but unable to
   * classify the side now; it should be dealt with later.
   *
   * The relation between extended circle of segment and knife is described by
   * a map from segments to corresponding relations.  The relation is same as
   * the return value of function {@link SphAnalyzer#meetWithCircle}.
   *
   * @param {SphSeg} knife - The circle to compare.
   * @param {Iterable<SphSeg>} boundaries - The boundaries to compare.
   * @returns {[SphVertex[][], Map<SphVertex,REL>, Map<SphSeg,REL>]} Vertices and
   *   relations of vertices/segments.
   */
  meetWithBoundaries(knife: SphSeg, boundaries: Iterable<SphSeg>): [SphVertex[][], Map<SphVertex,REL>, Map<SphSeg,REL>] {
    // meet with points
    let boundaries_col = Array.from(boundaries);
    let vrels = new Map<SphVertex, REL>();
    let vertices: SphVertex[][] = [];
    {
      // find all vertices on the boundaries
      let offsets = new Map<SphSeg, Set<number|false>>();
      for ( let segment of boundaries_col )
        offsets.set(segment, new Set([false, ...Array.from(segment.adj.keys()).slice(0, -1)]));

      // group vertices by their position
      for ( let segment of boundaries_col ) for ( let offset of offsets.get(segment)! ) {
        let v0 = offset === false ? SphVertex.startOf(segment) : new SphVertex({segment, offset});

        let vgroup: SphVertex[] = [];
        for ( let [, v] of v0.spin() ) if ( boundaries_col.includes(v.segment) ) {
          if ( v.prefer > 0 )
            offsets.get(v.segment)!.delete(v.aligned ? false : v.offset);
          vgroup.push(v);
        }

        vertices.push(vgroup);
      }

      // determine relation between vertices and `knife`
      for ( let vgroup of vertices ) {
        let v0 = vgroup[0];
        let rel = this.meetWithPoint(knife, v0.getPosition());
        for ( let v of vgroup ) {
          assert(rel === this.meetWithPoint(knife, v.getPosition()));
          vrels.set(v, rel);
        }
      }
    }

    // meet with circles
    let crels = new Map<SphSeg, REL>();
    for ( let segment of boundaries_col ) {
      let children = It.keys(vrels).filter(v => v.segment === segment).toArray();
      let [rel, meets] = this.meetWithCircle(knife, segment);
      crels.set(segment, rel);

      if ( rel === REL.INLINE || rel === REL.OUTLINE ) { // overlap
        assert(children.every(v => vrels.get(v) === REL.BOTHSIDE));
        for ( let v of children ) vrels.set(v, rel);

      } else if ( meets.length === 0 ) { // no meet
        assert(children.every(v => vrels.get(v) === rel));

      } else { // intersected at some points
        // snap meet points to known vertices on the knife
        let snapped1: Vector[] = [];
        let snapped2: Vector[] = [];
        for ( let v of children ) if ( vrels.get(v) === REL.BOTHSIDE ) {
          let [meet, dis] = meets.map(m => [m, disL1(m, v.getPosition())] as [Vector, number])
                                 .sort((a, b) => a[1]-b[1]).shift()!;
          assert(this.fzy_cmp(dis/10, 0) === 0, `calculation error is too large: ${dis}`);

          let snapped = v.prefer > 0 ? snapped1 : snapped2;
          assert(!snapped.includes(meet));
          snapped.push(meet);

          // determine the side of vertices
          if ( rel !== REL.BOTHSIDE ) {
            vrels.set(v, rel);
          } else {
            let s = meets[0] === meet ? v.prefer : -v.prefer;
            vrels.set(v, s > 0 ? REL.INLINE : REL.OUTLINE);
          }
        }
        meets = meets.filter(m => !snapped1.includes(m) && !snapped2.includes(m));

        // make vertices for remaining meet points
        for ( let meet of meets ) {
          let offset = mod4(segment.thetaOf(meet));
          if ( offset >= segment.arc )
            continue;

          // the vertices around this meet point
          let v0 = new SphVertex({segment, offset, prefer:+1});
          let vgroup = It.from(v0.spin()).map(a => a[1])
                         .filter(v => boundaries_col.includes(v.segment)).toArray();
          vertices.push(vgroup);

          for ( let v of vgroup ) {
            assert(v.segment === segment || !crels.has(v.segment));
            assert(It.keys(vrels).every(v_ => !v.equal(v_)));
            assert(REL.BOTHSIDE === this.meetWithPoint(knife, v.getPosition()));

            // determine the side of vertices
            if ( v.segment !== segment || v.offset !== offset ) {
              vrels.set(v, REL.BOTHSIDE);
            } else if ( rel !== REL.BOTHSIDE ) {
              vrels.set(v, rel);
            } else {
              let s = meets[0] === meet ? v.prefer : -v.prefer;
              vrels.set(v, s > 0 ? REL.INLINE : REL.OUTLINE);
            }
          }
        }

      }
    }

    assert(It.values(vrels).every(rel => rel !== REL.BOTHSIDE));

    return [vertices, vrels, crels];
  }
  /**
   * Draw dashes along circle on given components.
   *
   * @param {SphSeg} knife - The circle to line up.
   * @param {Iterable<SphSeg>} boundaries - The boundaries of components to cut.
   * @returns {[[Dash[], Angle[], Align[]], Set<SphSeg>, Set<SphSeg>]} The
   *   information about intersections (see {@link SphAnalyzer#cutDashes}) and
   *   inner/outer part of segments.
   */
  drawDashes(knife: SphSeg, boundaries: Iterable<SphSeg>): [[Dash[], Angle[], Align[]], Set<SphSeg>, Set<SphSeg>] {
    boundaries = Array.from(boundaries);

    let [vertices, vrels, crels] = this.meetWithBoundaries(knife, boundaries);


    // separate inner/outer part
    let inner = new Set<SphSeg>();
    let outer = new Set<SphSeg>();
    for ( let vgroup of vertices ) for ( let v of vgroup ) {
      let rel = vrels.get(v)!;
      if ( rel === REL.INLINE || rel === REL.INSIDE )
        inner.add(v.segment);
      if ( rel === REL.OUTLINE || rel === REL.OUTSIDE )
        outer.add(v.segment);
    }


    // determine meeted angles
    let angles: Angle[] = [];
    let aligns: Align[] = [];
    let vmeets = vertices.filter(vgroup => vrels.get(vgroup[0]) === REL.INLINE || vrels.get(vgroup[0]) === REL.OUTLINE);
    for ( let vgroup of vmeets ) {
      let offset = mod4(knife.thetaOf(vgroup[0].getPosition()));
      let forward  = new SphVertex({segment:knife, offset, prefer:+1, aligned:false});
      let backward = new SphVertex(forward).back().jump();
      aligns.push({backward, forward});

      // classify type of meet by angle
      for ( let i=0; i<vgroup.length; i+=2 ) {
        let prev = vgroup[i+1];
        let next = vgroup[i];
        let sgn1 = vrels.get(prev) === REL.INLINE ? +1 : -1;
        let sgn2 = vrels.get(next) === REL.INLINE ? +1 : -1;
        let ang2 = forward.angleTo(next, sgn2);
        assert(prev.prefer === -1 && next.prefer === +1);
        assert(new SphVertex(prev).turn().equal(next));

        if ( sgn1 === +1 && sgn2 === -1 ) {
          // cross meet
          angles.push({right:next, left:forward, angle:next.angleTo(forward, +1)});

        } else if ( sgn1 === -1 && sgn2 === +1 ) {
          // cross meet
          angles.push({right:next, left:backward, angle:next.angleTo(backward, +1)});

        } else if ( sgn1 === +1 && ang2 + next.angle > 3 ) {
          // scoop meet
          angles.push({right:forward, left:next, angle:forward.angleTo(next, +1)});
          angles.push({right:next, left:backward, angle:next.angleTo(backward, +1)});

        } else if ( sgn1 === -1 && ang2 + next.angle > 1 ) {
          // scoop meet
          angles.push({right:backward, left:next, angle:backward.angleTo(next, +1)});
          angles.push({right:next, left:forward, angle:next.angleTo(forward, +1)});

        } else {
          // touch meet
        }
      }
    }

    // special cases: no meet with the knife
    if ( angles.length === 0 && vmeets.length === 0 ) {
      let siblings = this.grab(knife.vectorAt(0), boundaries);
      assert(!(siblings instanceof SphVertex));

      if ( siblings === null ) {
        return [[[], [], []], inner, outer];

      } else {
        let forward = SphVertex.startOf(knife);
        let backward = SphVertex.startOf(knife).back().jump();
        return [[[{forward, backward, siblings}], [], [{backward, forward}]], inner, outer];
      }

      // REMARK: `vmeets.length !== 0` => only have touch meets => `grab` always fail
    }


    // make dashes
    aligns = aligns.sort((a, b) => a.backward.offset-b.backward.offset);
    let dashes: Dash[] = [];
    for ( let i=0; i<aligns.length; i++ ) {
      let start = aligns[i].forward;
      let end = (aligns[i+1] || aligns[0]).backward;

      let turn = angles.find(({right, left}) => right === start || left === start);
      assert((turn!==undefined) === angles.some(({right, left}) => right === end || left === end));
      if ( turn !== undefined ) {
        let siblings = (turn.left !== start ? turn.left : turn.right).segment.siblings;
        dashes.push({start, end, siblings});
      }
    }

    return [[dashes, angles, aligns], inner, outer];
  }
  cutDashes_dirty(dashes: Iterable<Dash>, angles: Iterable<Angle>, aligns: Iterable<Align>): [SphSeg[], SphSeg[]] {
    let dashes_col = Array.from(dashes);
    let angles_col = Array.from(angles);
    let aligns_col = Array.from(aligns);
    let vertices = dashes.flatMap(({start, end}) => [start, end]);

    if ( dashes.length === 0 )
      return [[], []];
    let knife = dashes[0].start.segment;
    let efink = dashes[0].end.segment;

    // merge
    let mergers: Angle[] = [];
    for ( let {backward, forward} of aligns_col ) {
      if ( !vertices.includes(backward) && !vertices.includes(forward) )
        continue;

      if ( backward.segment !== efink )
        backward = forward.back().jump();
      if ( forward.segment !== knife  )
        forward = backward.back().jump();
      mergers.push({right:forward, left:backward, angle:2});
    }
    let merged = this.swap(+1, ...mergers);

    // join
    let inner: SphSeg[] = [];
    let outer: SphSeg[] = [];
    for ( let {start, end, siblings} of dashes_col ) {
      let seg1 = merged.get(start)!;
      let seg2 = merged.get(end)!;

      inner.push(...It.from(seg1.walk()).takeWhile(seg => seg !== seg2));
      outer.push(...It.from(seg2.walk()).takeWhile(seg => seg !== seg1));

      let segs = [...seg1.walk()];
      start.segment.split(segs);
      It.from(siblings).first()!.join(...segs);
    }

    // split
    let splitters: Angle[] = [];
    for ( let {right, left, angle} of angles_col ) {
      if ( !vertices.includes(right) && !vertices.includes(left) )
        continue;
      if ( vertices.includes(right) )
        right = SphVertex.startOf(merged.get(right)!);
      if ( vertices.includes(left) )
        left = SphVertex.startOf(merged.get(left)!);
        splitters.push([right, left, angle]);
    }
    this.swap(-1, ...splitters);

    // line up
    for ( let {backward, forward} of aligns_col ) {
      if ( vertices.includes(backward) && !vertices.includes(forward) ) {
        forward.jump().segment.lineup(merged.get(backward)!);
        merged.get(backward)!.prev.lineup(forward.segment);
      }
      if ( !vertices.includes(backward) && vertices.includes(forward) ) {
        merged.get(forward)!.prev.lineup(backward.segment);
        backward.jump().segment.lineup(merged.get(forward)!);
      }
    }

    return [inner, outer];
  }
  /**
   * Cut elements along dashes.
   * The alignment relations will be calculated in this method.
   *
   * @param {Iterable<Dash>} dashes - List of contacts of circle (see
   *   {@link SphAnalyzer#findContacts}), which represent the lines to cut off.
   * @param {Iterable<Angle>} angles - List of convex angles between dsahes and
   *   boundaries.
   * @param {Iterable<Align>} aligns - List of aligned vertices of dashes.
   * @returns {[SphSeg[], SphSeg[]]} Inner/outer segments of cutted lines along dashes.
   */
  cutDashes(dashes: Iterable<Dash>, angles: Iterable<Angle>, aligns: Iterable<Align>): [SphSeg[], SphSeg[]] {
    let dashes_col = Array.from(dashes);
    let angles_col = Array.from(angles);
    let aligns_col = Array.from(aligns);

    // connect inner/outer dashes as lines
    let inner = new Map<SphVertex, Dash[]>();
    let outer = new Map<SphVertex, Dash[]>();
    for ( let dash of dashes_col ) {
      let inner_line = [dash];
      inner.set(dash.start, inner_line);
      inner.set(dash.end, inner_line);
      let outer_line = [dash];
      outer.set(dash.start, outer_line);
      outer.set(dash.end, outer_line);
    }

    let is_inner_circle = false;
    let is_outer_circle = false;
    for ( let {backward, forward} of aligns_col ) {
      if ( outer.has(backward) && outer.has(forward) && angles_col.some(({right}) => right === backward) ) {
        assert(inner.has(backward) && inner.has(forward) && !angles_col.some(({right}) => right === forward));
        let line1 = inner.get(backward)!;
        let line2 = inner.get(forward)!;
        assert(line1[0].siblings === line2[0].siblings);
        if ( line1 === line2 ) {
          is_inner_circle = true;
          assert(inner.size === 2);
          break;
        }

        let line12 = [...line1, ...line2];
        inner.delete(backward);
        inner.delete(forward);
        inner.set(line12[0].start, line12);
        inner.set(line12[line12.length-1].end, line12);

      } else if ( inner.has(backward) && inner.has(forward) && angles_col.some(({right}) => right === forward) ) {
        assert(outer.has(backward) && outer.has(forward) && !angles_col.some(({right}) => right === backward));
        let line1 = outer.get(backward)!;
        let line2 = outer.get(forward)!;
        assert(line1[0].siblings === line2[0].siblings);
        if ( line1 === line2 ) {
          is_outer_circle = true;
          assert(outer.size === 2);
          break;
        }

        let line12 = [...line1, ...line2];
        outer.delete(backward);
        outer.delete(forward);
        outer.set(line12[0].start, line12);
        outer.set(line12[line12.length-1].end, line12);
      }
    }

    if ( is_inner_circle && is_outer_circle ) {
    } else if ( is_inner_circle ) {
    } else if ( is_outer_circle ) {
    }


    // // connect dashes as lines
    // let lines = new Map<SphVertex, Dash[]>();
    // for ( let dash of dashes_col ) {
    //   let line = [dash];
    //   lines.set(dash[0], line);
    //   lines.set(dash[1], line);
    // }
    // 
    // let is_circle = false;
    // for ( let [v1, v2] of aligns_col )
    //   if ( lines.has(v1) && lines.has(v2) && angles_col.some(([v,]) => v === v1 || v === v2) ) {
    //     let line1 = lines.get(v1)!;
    //     let line2 = lines.get(v2)!;
    //     assert(line1[2] === line2[2]);
    //     if ( line1 === line2 ) {
    //       is_circle = true;
    //       assert(lines.size === 2);
    //       break;
    //     }
    // 
    //     let line12 = [...line1, ...line2];
    //     lines.delete(v1);
    //     lines.delete(v2);
    //     lines.set(line12[0][0], line12);
    //     lines.set(line12[line12.length-1][1], line12);
    //   }

    // make segments and replace vertices
    let vertices = new Map<SphVertex, SphVertex>();
    for ( let line of new Set(lines.values()) ) {
      let start = line[0][0];
      let end = line[line.length-1][1];
      let forward = bang(aligns_map.get(end));
      assert(forward.segment === start.segment);

      let arc = forward === start ? 4 : mod4(forward.offset-start.offset);
      let orientation = q_spin(start.segment.orientation, start.offset);
      let seg = is_circle ? SphSeg.makeCircle({radius:start.segment.radius, orientation})
                          : SphSeg.makeArc({arc, radius:start.segment.radius, orientation});

      vertices.set(start, SphVertex.startOf(seg));
      vertices.set(end, SphVertex.endOf(seg).jump());
      for ( let i=0; i<line.length-1; i++ ) {
        let v1 = line[i][1];
        let v2 = line[i+1][0];
        let v2_ = new SphVertex({segment:seg, offset:mod4(v2.offset-start.offset), prefer:+1});
        let v1_ = new SphVertex(v2_).back().jump();
        vertices.set(v1, v1_);
        vertices.set(v2, v2_);
      }
    }

    // swap
    let angles_: [SphVertex, SphVertex][] = [];
    let inner: SphSeg[] = [];
    let outer: SphSeg[] = [];
    for ( let line of new Set(lines.values()) ) {
      let start = line[0][0];
      let end = line[line.length-1][1];
      let seg = vertices.get(start)!.segment;

      let a: [SphVertex, SphVertex] | undefined;
      for ( let i=0; i<line.length-1; i++ ) {
        let v1 = line[i][1];
        let v2 = line[i+1][0];

        if ( a = angles_col.find(([v,]) => v === v1) ) {
          a[1].segment.join(seg);
          angle_.push([vertices.get(a[0])!, a[1]]);
          outer.push(v1);
        } else if ( a = angles_col.find(([v,]) => v === v2) ) {
          a[1].segment.join(seg);
          angle_.push([vertices.get(a[0])!, a[1]]);
          inner.push(v2);
        }
      }

      if ( a = angles_col.find(([v,]) => v === start) ) {
        a[1].segment.join(seg);
        angles_.push([vertices.get(a[0])!, a[1]]);
        inner.push(start);
      } else if ( !is_circle ) {
        a = bang(angles_col.find(([,v]) => v === start));
        a[0].segment.join(seg);
        angles_.push([a[0], vertices.get(a[1])!]);
        inner.push(start);
      }

      if ( a = angles_col.find(([v,]) => v === end) ) {
        a[1].segment.join(seg);
        angles_.push([vertices.get(a[0])!, a[1]]);
        outer.push(end);
      } else if ( !is_circle ) {
        a = bang(angles_col.find(([,v]) => v === end));
        a[0].segment.join(seg);
        angles_.push([a[0], vertices.get(a[1])!]);
        outer.push(end);
      }
    }
    let splitted = this.swap(-1, ...angles_.map(([v1, v2]) => [v1, v2, v1.angleTo(v2, +1)]));

    // align
    for ( let v of vertices.values() ) if ( v.aligned )
      for ( let [ang, v_] of v.spin() ) if ( v_.aligned && this.fzy_cmp(ang, 2) === 0 ) {
        if ( v_.prefer === -1 && this.fzy_cmp(v_.segment.radius, v.segment.radius) === 0 ) {
          v_.segment.lineup(v.segment);
        } else if ( v_.prefer === +1 && this.fzy_cmp(2-v_.segment.radius, v.segment.radius) === 0 ) {
          v.jump().segment.lineup(v_.segment);
        }
      }

    inner = inner.map(v => vertices.get(v)!).map(v => (splitted.get(v) || v).segment);
    outer = outer.map(v => vertices.get(v)!).map(v => (splitted.get(v) || v).segment);
    return [inner, outer];
  }
  /**
   * Find the component contains given point.
   *
   * @param {Vector} point
   * @param {Iterable<SphSeg>} boundaries
   * @returns {SphVertex | Set<SphSeg> | null} Vertex or component or null.
   */
  grab(point: Vector, boundaries: Iterable<SphSeg>): SphVertex | Set<SphSeg> | null {
    let boundaries_col = Array.from(boundaries);

    // grab edge
    for ( let segment of boundaries_col )
      if ( this.meetWithPoint(segment, point) === REL.BOTHSIDE ) {
        if ( this.fzy_cmp(disL1(point, segment.vectorAt(0)), 0) === 0 )
          return SphVertex.startOf(segment);

        if ( this.fzy_cmp(disL1(point, segment.vectorAt(segment.arc)), 0) === 0 )
          return SphVertex.endOf(segment);

        let offsets = Array.from(segment.adj.keys()).slice(0, -1);
        for ( let offset of offsets )
          if ( this.fzy_cmp(disL1(point, segment.vectorAt(offset)), 0) === 0 )
            return new SphVertex({segment, offset, prefer:+1, aligned:false});

        let offset = mod4(segment.thetaOf(point));
        if ( offset < segment.arc )
          return new SphVertex({segment, offset, prefer:+1, aligned:false});
      }


    // grab component
    let orientation = q_mul(q_align(point, boundaries_col[0].vectorAt(0)), [.5,.5,.5,-.5]);
    let knife = SphSeg.makeCircle({orientation, radius:1});

    let [vertices, vrels, crels] = this.meetWithBoundaries(knife, boundaries_col);

    // determine meeted angles
    let [vgroup, theta] = vertices.filter(vs => vrels.get(vs[0]) === REL.INLINE || vrels.get(vs[0]) === REL.OUTLINE)
                                  .map(vs => [vs, mod4(knife.thetaOf(vs[0].getPosition()))] as [SphVertex[], number])
                                  .sort((a,b) => a[1]-b[1]).shift()!;

    // classify type of meet by angle
    const v0 = new SphVertex({segment:knife, offset:theta, prefer:+1, aligned:false});
    for ( let i=0; i<vgroup.length; i+=2 ) {
      let prev = vgroup[i+1];
      let next = vgroup[i];
      let sgn1 = vrels.get(prev) === REL.INLINE ? +1 : -1;
      let sgn2 = vrels.get(next) === REL.INLINE ? +1 : -1;
      let ang2 = v0.angleTo(next, sgn2, crels.get(next.segment)!==REL.BOTHSIDE);
      assert(prev.prefer === -1 && next.prefer === +1);
      assert(new SphVertex(prev).turn().equal(next));

      let component = prev.segment.siblings;
      assert(component === next.segment.siblings);
      if ( sgn1 === +1 && sgn2 === -1 ) {
        // cross meet

      } else if ( sgn1 === -1 && sgn2 === +1 ) {
        // cross meet
        return component;

      } else if ( sgn1 === +1 && ang2 + next.angle > 3 ) {
        // scoop meet
        return component;

      } else if ( sgn1 === -1 && ang2 + next.angle > 1 ) {
        // scoop meet
        return component;

      } else {
        // touch meet
      }
    }


    // grab nothing
    return null;
  }


  mergeSegment(brep: SphBREP, seg: SphSeg): SphSeg {
    if ( brep.defects[BREP_DEFECTS.BA] )
      throw new Error("bad representation");

    if ( seg.prev !== seg.backward || seg.prev === seg )
      throw new Error("unable to merge segments");

    assert(brep.defects[BREP_DEFECTS.TV]);
    let res = this.mergePrev(seg);
    brep.delete(seg);
    return res;
  }
  sliceSegment(brep: SphBREP, seg: SphSeg, theta: number): SphSeg {
    if ( this.fzy_cmp(theta, seg.arc) >= 0 || this.fzy_cmp(theta, 0) <= 0 )
      throw new Error("out of range of interpolation");

    let next = this.interpolate(seg, theta);
    brep.add(next);

    brep.set(BREP_DEFECTS.TV, true);

    return next;
  }
  mergeEdge(brep: SphBREP, seg1: SphSeg, seg2: SphSeg): void {
    if ( brep.defects[BREP_DEFECTS.SB] || brep.defects[BREP_DEFECTS.BA] )
      throw new Error("bad representation");

    if ( seg1.siblings !== seg2.siblings || It.values(seg1.adj).every(adj_seg => adj_seg !== seg2) )
      throw new Error("Unable to merge non-trivial edges!");

    assert(brep.defects[BREP_DEFECTS.SA]);
    let old_segs = new Set(seg1.siblings);
    let new_segs = seg1.siblings;

    let contacts = this.findContacts([seg1, seg2]);
    assert(contacts.length > 0);
    this.glueContacts(contacts);

    for ( let seg of old_segs )
      if ( !new_segs.has(seg) )
        brep.delete(seg);
    for ( let seg of new_segs )
      if ( !old_segs.has(seg) )
        brep.add(seg);

    brep.set(BREP_DEFECTS.TV, true);
    brep.set(BREP_DEFECTS.UC, true);
  }
  mergeComponents(brep: SphBREP, ...comps: Set<SphSeg>[]): void {
    if ( comps.length <= 1 )
      return;

    let seg0 = It.from(comps[comps.length-1]).first()!;
    seg0.join(...comps.slice(-1).map(comp => It.from(comp).first()!));

    brep.set(BREP_DEFECTS.SA, true);
    brep.set(BREP_DEFECTS.UC, true);
  }
  slice(brep: SphBREP, center: Vector, radius: number): void {
    if ( brep.defects[BREP_DEFECTS.SB] || brep.defects[BREP_DEFECTS.BA] )
      throw new Error("bad representation");

    if ( this.fzy_cmp(radius, 2) >= 0 || this.fzy_cmp(radius, 0) <= 0 )
      throw new Error("invalid radius");

    center = normalize(center);
    let circle = SphSeg.makeCircle({center, radius});
    this.drawDashes(circle, brep.segments);

  }
}










type Json = null | boolean | number | string | Json[] | {[k: string]: Json};
type Diff = null | {__old?: Json, __new?: Json} | Diff[] | {[k: string]: Diff};
function differ(obj1: Json | undefined, obj2: Json | undefined): Diff {
  if ( obj1 === null && obj2 === null ) {
    return null;

  } else if ( typeof obj1 === "boolean" && typeof obj2 === "boolean"
           || typeof obj1 === "number"  && typeof obj2 === "number"
           || typeof obj1 === "string"  && typeof obj2 === "string" ) {
    return obj1 === obj2 ? null : {__old: obj1, __new: obj2};

  } else if ( Array.isArray(obj1) && Array.isArray(obj2) ) {
    let res: Diff[] = [], changed = false;
    let keys = new Set([...obj1.keys(), ...obj2.keys()]);
    for ( let key of keys ) {
      let res_ = differ(obj1[key], obj2[key]);
      if ( res_ ) {
        res[key] = res_;
        changed = true;
      }
    }
    return changed ? res : null;

  } else if ( typeof obj1 === "object" && !Array.isArray(obj1) && obj1 !== null
           && typeof obj2 === "object" && !Array.isArray(obj2) && obj2 !== null ) {
    let res: {[k: string]: Diff} = {}, changed = false;
    let keys = new Set([...Object.keys(obj1), ...Object.keys(obj2)]);
    for ( let key of keys ) {
      let res_ = differ(obj1[key], obj2[key]);
      if ( res_ ) {
        res[key] = res_;
        changed = true;
      }
    }
    return changed ? res : null;

  } else if ( obj1 === undefined && obj2 !== undefined ) {
    return {__new: obj2};

  } else if ( obj1 !== undefined && obj2 === undefined ) {
    return {__old: obj1};

  } else if ( obj1 === undefined && obj2 === undefined ) {
    return null

  } else {
    return {__old: obj1, __new: obj2};
  }
}

type Serializer<T> = (target: T, id: (obj:object)=>number) => Json;
class RecordedSet<T> extends Set<T>
{
  serializer: Serializer<T>;
  changed: Set<T>;
  records: Map<T, Json>;
  private id: (obj: object) => number;

  constructor(it: Iterable<T>, serializer: Serializer<T>=(a=>a as Json)) {
    super();
    this.serializer = serializer;
    this.changed = new Set<T>();
    this.records = new Map<T, Json>();

    let _id = new WeakMap<object, number>();
    let _counter = 0;
    this.id = (obj: object) => {
      if ( !_id.has(obj) )
        _id.set(obj, _counter++);
      return _id.get(obj)!;
    };

    for ( let target of it )
      this.add(target);
  }

  record(): Map<T, Diff> {
    if ( this.changed.size === 0 )
      return new Map<T, Diff>();

    let diffs = new Map<T, Diff>();
    for ( let target of this.changed ) {
      let old_record = this.records.get(target);
      let new_record = this.has(target) ? this.serializer(target, this.id) : undefined;
      let diff = differ(old_record, new_record);
      if ( diff !== null )
        diffs.set(target, diff);

      if ( new_record !== undefined ) {
        this.records.set(target, new_record);
      } else {
        this.records.delete(target);
      }
    }

    this.changed.clear();
    return diffs;
  }

  add(target: T): this {
    let res = super.add(target);
    this.changed.add(target);
    return res;
  }
  delete(target: T): boolean {
    let res = super.delete(target);
    if ( res )
      this.changed.add(target);
    return res;
  }
  modify(target: T): void {
    this.changed.add(target);
  }
  clear(): void {
    for ( let target of this )
      this.delete(target);
  }
}
