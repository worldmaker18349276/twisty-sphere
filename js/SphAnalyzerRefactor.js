"use strict";
// little patch for better readability
function assert(val, msg) {
    if (!val)
        throw new Error(msg);
}
function bang(val, msg) {
    if (val === null || val === undefined)
        throw new Error(msg);
    return val;
}
function cmp(v1, v2) {
    if (Array.isArray(v1) && Array.isArray(v2)) {
        for (let i = 0, len = Math.min(v1.length, v2.length); i < len; i++) {
            let s = cmp(v1[i], v2[i]);
            if (s !== 0)
                return s;
        }
        return cmp(v1.length, v2.length);
    }
    else {
        // return (v1>v2)-(v2>v1);
        if (v1 > v2)
            return +1;
        else if (v2 > v1)
            return -1;
        else
            return 0;
    }
}
class It {
    constructor(iterator) {
        this.origin = iterator;
    }
    [Symbol.iterator]() {
        return this;
    }
    next() {
        return this.origin.next();
    }
    static from(col) {
        return new It(col[Symbol.iterator]());
    }
    static keys(col) {
        return new It(col.keys());
    }
    static values(col) {
        return new It(col.values());
    }
    static entries(col) {
        return new It(col.entries());
    }
    static count(start = 0, end = Infinity, step = 1) {
        return new It(function* () { for (let i = start; i < end; i += step)
            yield i; }());
    }
    static cycle(...items) {
        return new It(function* () { while (true)
            yield* items; }());
    }
    static chain(...iters) {
        return new It(function* () { for (let iter of iters)
            yield* iter; }());
    }
    static zip(...iters) {
        let iters_ = iters.map(it => it[Symbol.iterator]());
        return new It(function* () {
            let res = iters_.map(iter => iter.next());
            while (res.every(r => !r.done)) {
                yield res.map(r => r.value);
                res = iters_.map(iter => iter.next());
            }
        }());
    }
    map(func) {
        let iterator = this;
        return new It(function* () { let i = 0; for (let value of iterator)
            yield func(value, i++); }());
    }
    flatMap(func) {
        let iterator = this;
        return new It(function* () { let i = 0; for (let value of iterator)
            yield* func(value, i++); }());
    }
    filter(func) {
        let iterator = this;
        return new It(function* () { let i = 0; for (let value of iterator)
            if (func(value, i++))
                yield value; }());
    }
    reduce(func, init) {
        let i = 0;
        if (init === undefined)
            init = this.origin.next().value, i++;
        for (let item of this)
            init = func(init, item, i++);
        return init;
    }
    every(func) {
        let i = 0;
        for (let item of this)
            if (!func(item, i++))
                return false;
        return true;
    }
    some(func) {
        let i = 0;
        for (let item of this)
            if (func(item, i++))
                return true;
        return false;
    }
    find(func, otherwise) {
        let i = 0;
        for (let item of this)
            if (func(item, i++))
                return item;
        return otherwise;
    }
    findIndex(func) {
        let i = 0;
        for (let item of this)
            if (func(item, i++))
                return i - 1;
        return -1;
    }
    findLast(func, otherwise) {
        let i = 0;
        let res = otherwise;
        for (let item of this)
            if (func(item, i++))
                res = item;
        return res;
    }
    findLastIndex(func) {
        return this.reduce((res, item, i) => func(item, i) ? i : res, -1);
    }
    first(otherwise) {
        for (let item of this)
            return item;
        return otherwise;
    }
    last(otherwise) {
        let res = otherwise;
        for (let item of this)
            res = item;
        return res;
    }
    toArray() {
        return Array.from(this);
    }
    toUniqArray() {
        return Array.from(new Set(this));
    }
    toSet() {
        return new Set(this);
    }
}
function disL1(v1, v2 = [0, 0, 0]) {
    let [x1, y1, z1] = v1;
    let [x2, y2, z2] = v2;
    return Math.abs(x1 - x2) + Math.abs(y1 - y2) + Math.abs(z1 - z2);
}
function dot(v1, v2) {
    let [x1, y1, z1] = v1;
    let [x2, y2, z2] = v2;
    return x1 * x2 + y1 * y2 + z1 * z2;
}
function cross(v1, v2, out = [0, 0, 0]) {
    let [x1, y1, z1] = v1;
    let [x2, y2, z2] = v2;
    out[0] = y1 * z2 - z1 * y2;
    out[1] = z1 * x2 - x1 * z2;
    out[2] = x1 * y2 - y1 * x2;
    return out;
}
function norm(v) {
    return Math.sqrt(dot(v, v));
}
function normalize(v, out = [0, 0, 0]) {
    let [x, y, z] = v;
    let n = norm([x, y, z]);
    out[0] = x / n;
    out[1] = y / n;
    out[2] = z / n;
    return out;
}
function angleTo(a, b, axis) {
    if (axis === undefined) {
        let s = norm(cross(a, b));
        let c = dot(a, b);
        return Math.atan2(s, c);
    }
    else {
        a = normalize(cross(axis, a));
        b = normalize(cross(axis, b));
        let s = dot(axis, cross(a, b));
        let c = dot(a, b);
        return Math.atan2(s, c);
    }
}
function quaternion(axis, angle, out = [0, 0, 0, 0]) {
    let [x, y, z] = axis;
    let s = Math.sin(angle / 2);
    let c = Math.cos(angle / 2);
    out[0] = x * s;
    out[1] = y * s;
    out[2] = z * s;
    out[3] = c;
    return out;
}
function q_inv(q, out = [0, 0, 0, 0]) {
    let [x, y, z, w] = q;
    out[0] = -x;
    out[1] = -y;
    out[2] = -z;
    out[3] = w;
    return out;
}
function q_mul(q1, q2, out = [0, 0, 0, 0]) {
    // [v1, w1] * [v2, w2] = [w1 * v2 + w2 * v1 + v1 x v2, w1 * w2 - v1 * v2]
    let [x1, y1, z1, w1] = q1;
    let [x2, y2, z2, w2] = q2;
    out[0] = w1 * x2 + x1 * w2 + y1 * z2 - z1 * y2;
    out[1] = w1 * y2 + y1 * w2 + z1 * x2 - x1 * z2;
    out[2] = w1 * z2 + z1 * w2 + x1 * y2 - y1 * x2;
    out[3] = w1 * w2 - x1 * x2 - y1 * y2 - z1 * z2;
    return out;
}
function q_rotate(v, q, out = [0, 0, 0, 0]) {
    let [x, y, z, w] = v;
    q_mul(q, [x, y, z, w], out);
    q_mul(out, q_inv(q), out);
    return out;
}
function rotate(v, q, out = [0, 0, 0]) {
    let [x, y, z] = v;
    let out_ = q_rotate([x, y, z, 0], q);
    out[0] = out_[0];
    out[1] = out_[1];
    out[2] = out_[2];
    return out;
}
function q_align(v, v_xz, out = [0, 0, 0, 0]) {
    let [x, y, z] = v;
    let theta = Math.atan2(y, x);
    let phi = Math.atan2(Math.sqrt(x * x + y * y), z);
    let n = [-Math.sin(theta), Math.cos(theta), 0];
    quaternion(n, phi, out);
    if (v_xz !== undefined) {
        let [x_, y_] = rotate(v_xz, q_inv(out));
        let theta_ = Math.atan2(y_, x_);
        q_spin(out, theta_, out);
    }
    return out;
}
function q_spin(q, theta, out = [0, 0, 0, 0]) {
    return q_mul(q, quaternion([0, 0, 1], theta), out);
}
function abcA(a, b, c) {
    // cosine rules for spherical triangle: cos a = cos b cos c + sin b sin c cos A
    // error = (db*cC + dc*cB - da) * sa/(sA*sb*sc)
    let [ca, cb, cc] = [Math.cos(a), Math.cos(b), Math.cos(c)];
    let [sb, sc] = [Math.sin(b), Math.sin(c)];
    let cA = (ca - cb * cc) / (sb * sc);
    return Math.acos(cA);
}
function Abca(A, b, c) {
    // cosine rules for spherical triangle: cos a = cos b cos c + sin b sin c cos A
    // error = (dA + db*cotC/sb + dc*cotB/sc) * sA*sb*sc/sa
    let cA = Math.cos(A);
    let [cb, cc] = [Math.cos(b), Math.cos(c)];
    let [sb, sc] = [Math.sin(b), Math.sin(c)];
    let ca = cb * cc + sb * sc * cA;
    return Math.acos(ca);
}
function abCA(a, b, C) {
    // cotangent rule for spherical triangle: cos b cos C = cot a sin b - cot A sin C
    let [ca, sa] = [Math.cos(a), Math.sin(a)];
    let [cb, sb] = [Math.cos(b), Math.sin(b)];
    let [cC, sC] = [Math.cos(C), Math.sin(C)];
    let [cA_, sA_] = [ca * sb - sa * cb * cC, sa * sC];
    if (sA_ < 0)
        cA_ = -cA_;
    if (sa < 0)
        sA_ = -sA_;
    return Math.atan2(sA_, cA_);
}
/**
 * Quadrant; unit of angle and arc.  One quadrant is 1/4 of a turn.
 * The method in {@link SphSeg}, {@link SphVertex} and {@link SphAnalyzer} will
 * use this unit for angle and arc.
 * @const
 * @type {number}
 */
const Q = Math.PI / 2;
/**
 * Modulo 4 with offset.
 *
 * @param {number} val - The value to mod.
 * @param {number} [offset=0] - The offset of range of mod.
 * @returns {number} Modulus.
 */
function mod4(val, offset = 0) {
    if (val < offset || val >= 4 + offset)
        val = ((val - offset) % 4 + 4) % 4 + offset;
    return val;
}
/**
 * Absolute value with modulus 4.
 *
 * @param {number} val - The value to abs.
 * @returns {number} Absolute value of `val`.
 */
function abs4(val) {
    return Math.min(mod4(val), mod4(-val));
}
/**
 * Boundary segment (and its starting vertex) of element of spherical twisty puzzle.
 * It is fundamental piece of structure of BREP, and has information about
 * arc, vertex, connection, adjacency, alignment and affiliation.
 *
 * Element of spherical twisty puzzle can be described by its boundaries.  The
 * element without boundary indicate full space of spherical surface.  There
 * is no additional class to represent the concept of element; we directly use
 * a set of segment to indicate an element, which is also described by segment's
 * property `siblings`.
 *
 * fixable: widthless bridge, sandglass bridge, bad alignment.
 * handleable: trivial vertices, self-adjacent edges, unconnected components.
 * analyzable: all clear.
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
 * @property {Vector} center - Center of curvature of segment.
 * @property {Quaternion} orientation - Orientation of this segment.
 *   It will rotate `[0,0,1]` to center of curvature of this segment, and rotate
 *   `[s,0,c]` to the start point of this segment.
 * @property {SphVertex} start - The vertex of start point of this segment.
 * @property {SphVertex} end - The vertex of end point of this segment.
 * @property {boolean} right_aligned - True if the start point of the last adjacent
 *   segment is equal to the end point of this segment.
 * @property {boolean} left_aligned - True if the end point of the last adjacent
 *   segment is equal to the start point of this segment.
 * @property {SphSeg} [next] - The next segment.
 * @property {SphSeg} [prev] - The previous segment.
 * @property {SphSeg} [forward] - The forward segment.
 * @property {SphSeg} [backward] - The backward segment.
 * @property {Map<number,SphSeg>} adj - The map of adjacenct relations, which
 *   map `offset` to `seg`: `seg` is adjacent segment with `offset` between
 *   vertices.  `offset` should be less than `this.arc + seg.arc`.
 *   Each entry describe an contact region, which is interval from
 *   `Math.max(0, offset-seg.arc)` to `Math.min(this.arc, offset)`.
 *   adjacent segment has same adjacency relation with same offset.  This map
 *   is sorted by offsets.
 *   Notice that it doesn't guarantee that `offset` should equal to `this.arc`\
 *   `seg.arc` if it is right/left-aligned.
 * @property {Set<SphSeg>} siblings - The siblings of this segment.  The region
 *   surrounding by those segments describes an element of puzzle.
 */
class SphSeg {
    constructor(obj) {
        let { arc, angle, radius, orientation = [0, 0, 0, 1] } = obj;
        this.radius = radius;
        this.orientation = orientation.slice();
        this.center = rotate([0, 0, 1], this.orientation);
        this.arc = arc;
        this.angle = angle;
        this.next = undefined;
        this.prev = undefined;
        this.forward = undefined;
        this.backward = undefined;
        this.adj = new Map();
        this.adj.set = function (k, v) {
            // insert by order of values
            if (typeof k !== "number")
                throw new Error("value is not a number!");
            this.delete(k);
            let stack = [[k, v]];
            for (let [k_, v_] of this.entries())
                if (k_ >= k) {
                    this.delete(k_);
                    stack.push([k_, v_]);
                }
            for (let [k_, v_] of stack)
                Map.prototype.set.call(this, k_, v_);
            return this;
        };
        this.siblings = new Set([this]);
    }
    static makeCircle(obj) {
        let { radius, center, orientation = q_align(bang(center)) } = obj;
        let circle = new SphSeg({ arc: 4, angle: 2, radius, orientation });
        circle.connect(circle);
        circle.lineup(circle);
        return circle;
    }
    get start() {
        return new SphVertex({ segment: this, offset: 0, prefer: +1 });
    }
    get end() {
        return new SphVertex({ segment: this, offset: this.arc, prefer: -1 });
    }
    get left_aligned() {
        let [adj_offset, adj_seg] = It.entries(this.adj).first();
        let [offset, seg] = It.entries(adj_seg).last();
        return offset === adj_offset;
    }
    get right_aligned() {
        let [adj_offset, adj_seg] = It.entries(this.adj).last();
        let [offset, seg] = It.entries(adj_seg).first();
        return offset === adj_offset;
    }
    connect(seg) {
        [this.next, seg.prev] = [seg, this];
    }
    lineup(seg) {
        [this.forward, seg.backward] = [seg, this];
    }
    adjacent(offset, seg) {
        if (seg === undefined) {
            seg = this.adj.get(offset);
            this.adj.delete(offset);
            if (seg)
                seg.adj.delete(offset);
        }
        else {
            this.adj.set(offset, seg);
            seg.adj.set(offset, this);
        }
    }
    merge(...segments) {
        for (let segment of segments)
            if (segment.siblings !== this.siblings)
                for (let seg of segment.siblings)
                    (seg.siblings = this.siblings).add(seg);
        return this;
    }
    split(...groups) {
        let elements = groups.map(group => new Set(group))
            .filter(group => group.size);
        for (let element of elements)
            for (let segment of element)
                this.siblings.delete(segment), segment.siblings = element;
        return elements;
    }
    *walk() {
        let seg = this;
        do {
            yield seg;
            if (seg.next === undefined)
                return false;
            seg = seg.next;
        } while (seg !== this);
        return true;
    }
    *ski(dir = +1) {
        let seg = this;
        if (dir > 0) {
            do {
                yield seg;
                if (seg.forward === undefined)
                    return false;
                seg = seg.forward;
            } while (seg !== this);
        }
        else {
            do {
                yield seg;
                if (seg.backward === undefined)
                    return false;
                seg = seg.backward;
            } while (seg !== this);
        }
        return true;
    }
    *fly() {
        let segs = new Set(this.siblings);
        for (let seg0 of segs) {
            for (let seg of seg0.walk())
                segs.delete(seg);
            yield seg0;
        }
    }
    /**
     * Get position of vector projected onto this circle.
     *
     * @param {Vector} vector - The vector to project.
     * @returns {number} The coordinate of projected vector.
     *   Notice that it may not modulus of 4.
     */
    thetaOf(vector) {
        let [x, y] = rotate(vector, q_inv(this.orientation));
        return Math.atan2(y, x) / Q;
    }
    /**
     * Get vector of on this circle with given coordinate.
     *
     * @param {number} theta - The coordinate of point on this circle.
     * @returns {Vector} The vector on this circle with coordinate `theta`.
     */
    vectorAt(theta) {
        let vec = [
            Math.sin(this.radius * Q) * Math.cos(theta * Q),
            Math.sin(this.radius * Q) * Math.sin(theta * Q),
            Math.cos(this.radius * Q)
        ];
        return rotate(vec, this.orientation);
    }
    shift(theta) {
        q_spin(this.orientation, theta * Q, this.orientation);
        return this;
    }
    flip() {
        this.radius = 2 - this.radius;
        q_mul(this.orientation, [1, 0, 0, 0], this.orientation);
        return this;
    }
    rotate(q) {
        q_mul(q, this.orientation, this.orientation);
        return this;
    }
}
/**
 * Oriented point on a segment.
 *
 * The position of this point is `segment.vectorAt(offset)`, and `prefer` is
 * the sign represents the orientation of the point, which can be thought of as
 * the perturbation of rotation: `quaternion(segment.center, prefer * tol)`.
 *
 * @class
 * @property {SphSeg} segment - The host segment of this point.
 * @property {number} offset - Offset of this point respect to `segment`.  It
 *   should be in the range of [0, `segment.arc`], and snapping to `0`,
 *   `segment.arc` and keys of `segment.adj`.
 * @property {1 | -1} prefer - The prefer side of this point respect to `segment`.
 *   `+1` means upper limit of offset; `-1` means lower limit of offset.
 * @property {number} angle - The angle of this vertex.
 * @property {Vector} position - The position vector of this point.
 * @property {Vector} tangent - The tangent vector of this point.
 */
class SphVertex {
    constructor(obj) {
        let { segment, offset = 0, prefer = +1 } = obj;
        this.segment = segment;
        this.offset = offset;
        this.prefer = Math.sign(prefer);
    }
    get angle() {
        let { segment, offset, prefer } = this;
        let angle;
        if (prefer > 0)
            angle = offset === 0 ? segment.angle : 2;
        else if (offset !== segment.arc)
            angle = 2;
        else if (segment.next !== undefined)
            angle = segment.next.angle;
        else
            throw new Error();
        return angle;
    }
    get position() {
        if (this._position === undefined) {
            let { segment, offset } = this;
            let vec = [
                Math.sin(segment.radius * Q) * Math.cos(offset * Q),
                Math.sin(segment.radius * Q) * Math.sin(offset * Q),
                Math.cos(segment.radius * Q)
            ];
            this._position = rotate(vec, segment.orientation);
        }
        return this._position;
    }
    get tangent() {
        let { segment, offset, prefer } = this;
        let vec = [Math.cos((offset + prefer) * Q), Math.sin((offset + prefer) * Q), 0];
        rotate(vec, segment.orientation, vec);
        return vec;
    }
    angleTo(vertex, side, aligned = false) {
        let angle = angleTo(vertex.tangent, this.tangent) / Q;
        if (aligned)
            return (abs4(angle) < 1 ? 0 : 2) * Math.sign(side);
        else if (side === undefined)
            return mod4(angle, -2);
        else if (side > 0)
            return mod4(angle, -1); // almost in [0, 2]
        else
            return mod4(angle, -3); // almost in [-2, 0]
    }
    /**
     * Turn to another direction of this vertex.
     *
     * @returns {SphVertex} Against vertex.
     */
    turn() {
        let { segment, offset, prefer } = this;
        if (prefer > 0 && offset === 0) {
            assert(segment.prev);
            [segment, offset] = [segment.prev, segment.prev.arc];
        }
        else if (prefer < 0 && offset === segment.arc) {
            assert(segment.next);
            [segment, offset] = [segment.next, 0];
        }
        prefer = -prefer;
        return new SphVertex({ segment, offset, prefer });
    }
    /**
     * Jump from this vertex to the vertex on the adjacent segment.
     *
     * @returns {SphVertex} Adjacent vertex.
     */
    jump() {
        let { segment, offset, prefer } = this;
        let adj_seg;
        if (offset === 0 && prefer > 0) {
            [adj_offset, adj_seg] = bang(It.entries(segment.adj).first());
            if (segment.left_aligned)
                adj_offset = adj_seg.arc;
        }
        else if (offset === segment.arc && prefer < 0) {
            [adj_offset, adj_seg] = bang(It.entries(segment.adj).last());
            adj_offset = It.keys(adj_seg.adj).findLast(offset_ => offset_ < adj_offset, 0);
            assert(segment.right_aligned ? adj_offset === 0 : true);
        }
        else if (segment.adj.has(offset)) {
            adj_seg = bang(segment.adj.get(offset));
            if (prefer < 0) {
                adj_offset = 0;
            }
            else {
                assert(adj_seg.backward);
                [adj_seg, adj_offset] = [adj_seg.backward, adj_seg.backward.arc];
            }
        }
        else {
            let offset_;
            [offset_, adj_seg] = bang(It.entries(segment.adj).find(([offset_]) => offset_ > adj_offset));
            adj_offset = offset_ - adj_offset;
        }
        prefer = -prefer;
        return new SphVertex({ segment: adj_seg, offset: adj_offset, prefer });
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
    *spin(dir = +1) {
        let angle = 0;
        let vertex = this;
        do {
            yield [angle, new SphVertex(vertex)];
            if (vertex.prefer * dir < 0) {
                vertex = vertex.jump();
            }
            else if (dir < 0) {
                vertex = vertex.turn();
                angle = angle - vertex.angle;
            }
            else {
                vertex = vertex.turn();
                angle = angle + vertex.angle;
            }
        } while (!this.equal(vertex));
        return true;
    }
    equal(vertex) {
        return this.segment === vertex.segment && this.offset === vertex.offset && this.prefer === vertex.prefer;
    }
}
var REL;
(function (REL) {
    REL[REL["INSIDE"] = 1] = "INSIDE";
    REL[REL["OUTSIDE"] = 2] = "OUTSIDE";
    REL[REL["INLINE"] = 3] = "INLINE";
    REL[REL["OUTLINE"] = 4] = "OUTLINE";
    REL[REL["BOTHSIDE"] = 5] = "BOTHSIDE";
})(REL || (REL = {}));
;
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
class SphAnalyzer {
    constructor(tol = 1e-5) {
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
    fzy_cmp(v1, v2) {
        if (v1 === v2) {
            return 0;
        }
        else if (typeof v1 === "string" && typeof v2 === "string") {
            return cmp(v1, v2);
        }
        else if (typeof v1 === "number" && typeof v2 === "number") {
            return Math.abs(v1 - v2) <= this.tol ? 0 : cmp(v1, v2);
        }
        else if (Array.isArray(v1) && Array.isArray(v2)) {
            for (let i = 0, len = Math.min(v1.length, v2.length); i < len; i++) {
                let s = this.fzy_cmp(v1[i], v2[i]);
                if (s !== 0)
                    return s;
            }
            return cmp(v1.length, v2.length);
        }
        else {
            throw new Error("incomparable");
        }
    }
    fzy_snap(val, snaps = []) {
        for (let snap of snaps)
            if (this.fzy_cmp(val, snap) === 0)
                return snap;
        return val;
    }
    fzy_mod4(val, offset = 0, snaps = []) {
        val = mod4(val, offset);
        for (let snap of snaps)
            if (this.fzy_cmp(mod4(val - snap, 2), 2) === 0)
                return snap;
        return val;
    }
    /**
     * All loops passing through segments.
     *
     * @param {Iterable<SphSeg>} segs - The segments to loop.
     * @yields {SphSeg[]} The loop of segment includes at least one of `segs`.
     */
    *loops(segs) {
        let segs_col = new Set(segs);
        for (let seg0 of segs_col) {
            let loop = [];
            for (let seg of seg0.walk()) {
                segs_col.delete(seg);
                loop.push(seg);
            }
            if (loop[loop.length - 1].next === loop[0])
                yield loop;
        }
    }
    /**
     * Split segment into two segments.
     * Splitted segment will be in-place modified as the first part, and create new
     * object as the second part.
     *
     * @param {SphSeg} seg - The segment to split.
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
            orientation: q_spin(seg.orientation, theta * Q)
        });
        seg.arc = theta;
        // merge loop
        seg.merge(splitted);
        if (seg.next)
            splitted.connect(seg.next);
        seg.connect(splitted);
        if (seg.forward)
            splitted.lineup(seg.forward);
        seg.lineup(splitted);
        let offset_ = -theta;
        for (let [offset, adj_seg] of seg.adj) {
            if (offset_ >= 0)
                seg.adjacent(offset);
            offset_ = offset - theta;
            if (offset_ > 0)
                splitted.adjacent(offset_, adj_seg);
        }
        return splitted;
    }
    /**
     * Merge segment with the previous segment, and remove this segment.
     * The radius and center of them must be same, and this segment cannot be
     * self connected.
     *
     * @param {SphSeg} seg - The segment to merge.
     * @returns {SphSeg} The removed segment.
     */
    mergePrev(seg) {
        // if ( seg === seg.prev || !this.isTrivialVertex(seg) )
        //   throw new Error("unable to merge segments");
        // merge segment
        let merged = bang(seg.prev);
        let theta = merged.arc;
        merged.arc = merged.arc + seg.arc;
        // merge loop
        merged.next = undefined;
        if (seg.next)
            merged.connect(seg.next);
        merged.forward = undefined;
        if (seg.forward)
            merged.lineup(seg.forward);
        merged.split([seg]);
        // merge adjacent
        let adj = Array.from(seg.adj);
        if (adj[0][0] !== It.keys(adj[0][1].adj).last())
            adj.shift();
        for (let [offset,] of seg.adj)
            seg.adjacent(offset);
        for (let [offset, adj_seg] of adj)
            merged.adjacent(offset + theta, adj_seg);
        return seg;
    }
    /**
     * Swap connection of two segments.
     * The vertices of segments must at the same position.
     * It have two modes: exclusive segments become inclusive segments in merge mode;
     * inclusive segments become exclusive segments in split mode.
     *
     * @param {1 | -1} mode - The swap mode, `1` means merge mode, `-1` means split
     *   mode.
     * @param {[number, SphVertex][][]} requests - The array of requests,
     *   and each entry is a list of tuple `[angle, vertex]` to swap.
     * @returns {Map<SphVertex, SphSeg>} The map from vertices to splitted segments.
     */
    swap(mode, ...requests) {
        assert(requests.flat().every(([, v]) => v.prefer > 0) && requests.every(spin => spin.length >= 2));
        // interpolation
        let splitted = new Map();
        let vertices = It.from(requests).flat().map(([, v]) => v)
            .filter(v => v.offset !== 0).toUniqArray();
        let segments = It.from(vertices).map(v.segment).toUniqArray();
        for (let seg of segments) {
            let children = vertices.filter(v => v.segment === seg).sort((a, b) => a.offset - b.offset);
            for (let vertex of children.reverse()) {
                let sliced = this.interpolate(vertex.segment, vertex.offset);
                splitted.set(vertex, sliced);
            }
        }
        // swap
        for (let spin of requests) {
            let spin_ = spin.map(([angle, vertex]) => [angle, vertex.offset === 0 ? vertex.segment : splitted.get(vertex)]);
            if (mode > 0) {
                let [angle1, seg1] = spin_.shift();
                for (let [angle2, seg2] of spin_) {
                    let angle = angle2 - angle1;
                    let [ang1, ang2] = [angle2 - angle1, angle1 - angle2 + 4];
                    let [seg1_prev, seg2_prev] = [bang(seg1.prev), bang(seg2.prev)];
                    let [seg1_ang, seg2_ang] = [seg1.angle, seg2.angle];
                    seg2_prev.connect(seg1);
                    seg1_prev.connect(seg2);
                    seg1.angle = seg2_ang + angle;
                    seg2.angle = seg1_ang - angle + 4;
                }
            }
            else {
                let [angle1, seg1] = spin_.shift();
                for (let [angle2, seg2] of spin_) {
                    let angle = angle2 - angle1;
                    let [seg1_prev, seg2_prev] = [bang(seg1.prev), bang(seg2.prev)];
                    let [seg1_ang, seg2_ang] = [seg1.angle, seg2.angle];
                    seg2_prev.connect(seg1);
                    seg1_prev.connect(seg2);
                    seg1.angle = seg2_ang + angle - 4;
                    seg2.angle = seg1_ang - angle;
                    [angle1, seg1] = [angle2, seg2];
                }
            }
        }
        return splitted;
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
    meetWithPoint(knife, point) {
        let sgn = this.fzy_cmp(knife.radius, angleTo(knife.center, point) / Q);
        if (sgn > 0)
            return REL.INSIDE;
        else if (sgn < 0)
            return REL.OUTSIDE;
        else
            return REL.BOTHSIDE;
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
    meetWithCircle(knife, circle) {
        let radius1 = knife.radius;
        let radius2 = circle.radius;
        let distance = angleTo(knife.center, circle.center) / Q;
        assert(this.fzy_cmp(distance, 0) >= 0 && this.fzy_cmp(distance, 2) <= 0);
        assert(this.fzy_cmp(radius1, 0) > 0 && this.fzy_cmp(radius1, 2) < 0);
        assert(this.fzy_cmp(radius2, 0) > 0 && this.fzy_cmp(radius2, 2) < 0);
        let rel, offset, num;
        if (this.fzy_cmp(distance, 0) === 0 && this.fzy_cmp(radius1, radius2) === 0)
            [rel, offset, num] = [REL.INLINE, 0, Infinity]; // equal
        else if (this.fzy_cmp(distance, 2) === 0 && this.fzy_cmp(radius1 + radius2, 2) === 0)
            [rel, offset, num] = [REL.OUTLINE, 0, Infinity]; // complement
        else if (this.fzy_cmp(radius1, abs4(distance + radius2)) > 0)
            [rel, offset, num] = [REL.INSIDE, 2, 0]; // include, anti-exclude
        else if (this.fzy_cmp(radius1, abs4(distance + radius2)) === 0)
            [rel, offset, num] = [REL.INSIDE, 2, 1]; // kissing include, kissing anti-exclude
        else if (this.fzy_cmp(radius1, abs4(distance - radius2)) < 0)
            [rel, offset, num] = [REL.OUTSIDE, 0, 0]; // exclude, anti-include
        else if (this.fzy_cmp(radius1, abs4(distance - radius2)) === 0)
            [rel, offset, num] = [REL.OUTSIDE, 0, 1]; // kissing exclude, kissing anti-include
        else if (distance < radius1 + radius2)
            [rel, offset, num] = [REL.BOTHSIDE, abcA(radius1, radius2, distance), 2]; // intersect
        else
            throw new Error(`unknown case: [${radius1}, ${radius2}, ${distance}]`);
        let meets = [];
        if (num === 2) {
            let theta0 = circle.thetaOf(knife.center);
            meets.push(circle.vectorAt(theta0 - offset)); // in
            meets.push(circle.vectorAt(theta0 + offset)); // out
        }
        else if (num === 1) {
            let theta0 = circle.thetaOf(knife.center);
            meets.push(circle.vectorAt(theta0 - offset));
        }
        else {
            // no meet
        }
        return [rel, meets];
    }
    /**
     * Determine relation between circle and boundaries of elements.
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
     * @param {SphSeg[]} boundaries - The boundaries to compare.
     * @returns {[SphVertex[][], Map<SphVertex,REL>, Map<SphSeg,REL>]} Vertices and
     *   relations of vertices/segments.
     */
    meetWithBoundaries(knife, boundaries) {
        // meet with points
        let vrels = new Map();
        let vertices = [];
        {
            // find all vertices on the boundaries
            let vs = new Set();
            for (let segment of boundaries) {
                let offsets = [0];
                offsets.push(...segment.adj.keys());
                offsets.pop();
                for (let offset of offsets) {
                    let v = new SphVertex({ segment, offset, prefer: +1 });
                    vs.add(v);
                    vs.add(v.turn());
                }
            }
            // group vertices by their position
            for (let v0 of vs) {
                let vgroup = [];
                for (let [, v] of v0.spin())
                    if (boundaries.includes(v.segment)) {
                        let v_ = It.from(vs).find(v_ => v.equal(v_));
                        assert(v_);
                        vs.delete(v_);
                        vgroup.push(v_);
                    }
                // only collect the vertices on the edge of segments and the self-intersected points.
                if (v0.offset === 0 || vgroup.length > 2)
                    vertices.push(vgroup);
            }
            // determine relation between vertices and `knife`
            for (let vgroup of vertices) {
                let v0 = vgroup[0];
                let rel = this.meetWithPoint(knife, v0.position);
                for (let v of vgroup) {
                    assert(rel === this.meetWithPoint(knife, v.position));
                    vrels.set(v, rel);
                }
            }
        }
        // meet with circles
        let crels = new Map();
        for (let segment of boundaries) {
            let children = It.keys(vrels).filter(v => v.segment === segment).toArray();
            let [rel, meets] = this.meetWithCircle(knife, segment);
            crels.set(segment, rel);
            if (rel === REL.INLINE || rel === REL.OUTLINE) { // overlap
                assert(children.every(v => vrels.get(v) === REL.BOTHSIDE));
                for (let v of children)
                    vrels.set(v, rel);
            }
            else if (meets.length === 0) { // no meet
                assert(children.every(v => vrels.get(v) === rel));
            }
            else { // intersected at some points
                // snap meet points to known vertices on the knife
                let snapped1 = [];
                let snapped2 = [];
                for (let v of children)
                    if (vrels.get(v) === REL.BOTHSIDE) {
                        let [meet, dis] = meets.map(m => [m, disL1(m, v.position)])
                            .sort((a, b) => a[1] - b[1]).shift();
                        assert(fzy_cmp(dis, 0, this.tol * 10), `calculation error is too large: ${dis}`);
                        let snapped = v.prefer > 0 ? snapped1 : snapped2;
                        assert(!snapped.includes(meet));
                        snapped.push(meet);
                        // determine the side of vertices
                        if (rel !== REL.BOTHSIDE) {
                            vrels.set(v, rel);
                        }
                        else {
                            let s = meets[0] === meet ? v.prefer : -v.prefer;
                            vrels.set(v, s > 0 ? REL.INLINE : REL.OUTLINE);
                        }
                    }
                meets = meets.filter(m => !snapped1.includes(m) && !snapped2.includes(m));
                // make vertices for remaining meet points
                for (let meet of meets) {
                    let offset = mod4(segment.thetaOf(meet));
                    if (offset >= segment.arc)
                        continue;
                    // the vertices around this meet point
                    let v0 = new SphVertex({ segment, offset, prefer: +1 });
                    let vgroup = It.from(v0.spin()).map(a => a[1])
                        .filter(v => boundaries.includes(v.segment)).toArray();
                    vertices.push(vgroup);
                    for (let v of vgroup) {
                        assert(v.segment === segment || !crels.has(v.segment));
                        assert(It.keys(vrels).every(v_ => !v.equal(v_)));
                        assert(REL.BOTHSIDE === this.meetWithPoint(knife, v.position));
                        // determine the side of vertices
                        if (v.segment !== segment || v.offset !== offset) {
                            vrels.set(v, REL.BOTHSIDE);
                        }
                        else if (rel !== REL.BOTHSIDE) {
                            vrels.set(v, rel);
                        }
                        else {
                            let s = meets[0] === meet ? v.prefer : -v.prefer;
                            vrels.set(v, s > 0 ? REL.INLINE : REL.OUTLINE);
                        }
                    }
                }
            }
        }
        return [vertices, vrels, crels];
    }
    /**
     * Determine relation between circle and elements.
     *
     * @param {SphSeg} knife - The circle to compare.
     * @param {Iterable<Set<SphSeg>>} elements - The elements to compare.
     * @returns {[Zipper[], Map<SphVertex, [number, SphVertex, Set<SphSeg>]>, Set<SphSeg>, Set<SphSeg>]}
     *   The zipper of dash and their turns and inner/outer part of segments.
     */
    meetWithElements(knife, elements) {
        let elements_col = Array.from(elements);
        let boundaries = elements_col.flatMap(elem => Array.from(elem));
        let [vertices, vrels, crels] = this.meetWithBoundaries(knife, boundaries);
        /**
         * The keys of the map have the form `{theta, side, prefer, crossed}`,
         * which describe vertices along `knife`.
         * Togther with `vertex` in the corresponding value `[angle, vertex, element]`,
         * they form an angle `angle`, and `element` is the element enclosed by it.
         */
        let turns_ = new Map();
        {
            let vmeets = vertices.filter(([v]) => vrels.get(v) === REL.INLINE || vrels.get(v) === REL.OUTLINE);
            // make vertices for cross meets and scoop meets
            for (let vgroup of vmeets) {
                let theta = mod4(knife.thetaOf(vgroup[0].position));
                let v0 = new SphVertex({ segment: knife, offset: theta, prefer: +1 });
                // classify type of meet by angle
                for (let i = 0; i < vgroup.length; i += 2) {
                    let prev = vgroup[i + 1];
                    let next = vgroup[i];
                    let sgn1 = vrels.get(prev) === REL.INLINE ? +1 : -1;
                    let sgn2 = vrels.get(next) === REL.INLINE ? +1 : -1;
                    let ang1 = v0.angleTo(prev, sgn1, crels.get(prev.segment) !== REL.BOTHSIDE);
                    let ang2 = v0.angleTo(next, sgn2, crels.get(next.segment) !== REL.BOTHSIDE);
                    assert(prev.prefer === -1 && next.prefer === +1);
                    assert(prev.turn().equal(next));
                    let element = bang(elements_col.find(elem => elem.has(prev.segment)));
                    assert(element === elements_col.find(elem => elem.has(next.segment)));
                    if (sgn1 > 0 && sgn2 < 0) {
                        // cross meet
                        turns_.set({ theta, side: +1, prefer: +1, crossed: true }, [+ang1, prev, element]);
                        turns_.set({ theta, side: -1, prefer: -1, crossed: true }, [-ang2, next, element]);
                    }
                    else if (sgn1 < 0 && sgn2 > 0) {
                        // cross meet
                        turns_.set({ theta, side: -1, prefer: +1, crossed: true }, [2 + ang1, prev, element]);
                        turns_.set({ theta, side: +1, prefer: -1, crossed: true }, [2 - ang2, next, element]);
                    }
                    else if (sgn1 > 0 && ang2 + next.angle > 3) {
                        // scoop meet
                        turns_.set({ theta, side: +1, prefer: +1, crossed: false }, [+ang1, prev, element]);
                        turns_.set({ theta, side: +1, prefer: -1, crossed: false }, [2 - ang2, next, element]);
                    }
                    else if (sgn1 < 0 && ang2 + next.angle > 1) {
                        // scoop meet
                        turns_.set({ theta, side: -1, prefer: +1, crossed: false }, [2 + ang1, prev, element]);
                        turns_.set({ theta, side: -1, prefer: -1, crossed: false }, [-ang2, next, element]);
                    }
                    else {
                        // touch meet
                    }
                }
            }
            // special cases: no meet with the knife
            let blood = It.keys(turns_).map(e => e.side).toSet().size;
            if (blood === 1) {
                // only one side has no meet
                let [{ theta, side }, [, vertex0,]] = It.entries(turns_).first();
                let element = elements_col.find(elem => elem.has(vertex0.segment));
                let next = { theta, side: -side, prefer: +1, crossed: false };
                let prev = { theta, side: -side, prefer: -1, crossed: false };
                turns_.set(next, [2, prev, element]);
                turns_.set(prev, [2, next, element]);
            }
            else if (blood === 0 && vmeets.length === 0) {
                // no meet with both sides of the knife
                let element = this.grab(knife.vectorAt(0), elements_col);
                assert(!(element instanceof SphVertex));
                if (element instanceof Set) {
                    let in_next = { theta: 2, side: +1, prefer: +1, crossed: false };
                    let in_prev = { theta: 2, side: +1, prefer: -1, crossed: false };
                    let out_next = { theta: 2, side: -1, prefer: +1, crossed: false };
                    let out_prev = { theta: 2, side: -1, prefer: -1, crossed: false };
                    turns_.set(in_next, [2, in_prev, element]);
                    turns_.set(in_prev, [2, in_next, element]);
                    turns_.set(out_next, [2, out_prev, element]);
                    turns_.set(out_prev, [2, out_next, element]);
                }
                // REMARK: `vmeets.length !== 0` => only have touch meets => `grab` always fail
            }
        }
        // determine intersected segments along knife
        let inner_dashes = new Map();
        let outer_dashes = new Map();
        for (let side of [+1, -1]) {
            let dashes = side > 0 ? inner_dashes : outer_dashes;
            let emeets = It.keys(turns_).filter(e => e.side === side).toArray()
                .sort((e1, e2) => side * (e1.theta - e2.theta) || e1.prefer - e2.prefer);
            assert(emeets.length % 2 === 0);
            // make dashes
            for (let i = 0; i < emeets.length; i++)
                if (emeets[i].prefer === +1) {
                    let start = emeets[i];
                    let end = emeets[i + 1] || emeets[0];
                    assert(start.prefer === +1 && end.prefer === -1);
                    assert(turns_.get(start)[2] === turns_.get(end)[2]);
                    let arc = side * (end.theta - start.theta);
                    if (i + 1 >= emeets.length)
                        arc += 4;
                    let dash = new SphSeg({ arc, angle: 2, radius: knife.radius, orientation: knife.orientation });
                    dash = dash.shift(start.theta);
                    if (side < 0)
                        dash = dash.flip();
                    start.segment = dash;
                    end.segment = dash;
                    dashes.set(dash, [start, end]);
                }
            // align dashes
            for (let i = 0; i < emeets.length; i++)
                if (emeets[i].prefer === -1) {
                    let end = emeets[i];
                    let start = emeets[i + 1] || emeets[0];
                    assert(end.prefer === -1 && start.prefer === +1);
                    let dash1 = end.segment;
                    let dash2 = start.segment;
                    if (end.theta === start.theta) {
                        dash1.lineup(dash2);
                    }
                    else {
                        const [, dash1_turn,] = turns_.get(end);
                        const [, dash2_turn,] = turns_.get(start);
                        assert(dash1_turn instanceof SphVertex && dash2_turn instanceof SphVertex);
                        let vs1 = vertices.find(vs => vs.includes(dash1_turn));
                        const rel1 = side > 0 ? REL.INLINE : REL.OUTLINE;
                        let v1 = vs1.find(v => v.prefer > 0 && crels.get(v.segment) === rel1);
                        if (v1 !== undefined)
                            dash1.forward = v1.segment;
                        let vs2 = vertices.find(vs => vs.includes(dash2_turn));
                        const rel2 = side > 0 ? REL.OUTLINE : REL.INLINE;
                        let v2 = vs2.find(v => v.prefer < 0 && crels.get(v.segment) === rel2);
                        if (v2 !== undefined)
                            dash2.backward = v2.segment;
                    }
                }
        }
        // make zippers
        let zippers;
        {
            let thetas = It.keys(turns_).map(e => e.theta).toUniqArray().sort();
            const N = thetas.length;
            let total_zipper = thetas.map(() => [, , 0]);
            for (let [dash, [start, end]] of inner_dashes) {
                let i = thetas.indexOf(start.theta);
                do {
                    total_zipper[i % N][0] = dash;
                    total_zipper[i % N][2] += start.theta;
                    if (i >= N)
                        total_zipper[i % N][2] += 4;
                    i++;
                } while (thetas[i % N] !== end.theta);
            }
            for (let [dash, [start, end]] of outer_dashes) {
                let i = thetas.indexOf(start.theta);
                do {
                    i--;
                    total_zipper[(i + N) % N][1] = dash;
                    total_zipper[(i + N) % N][2] -= start.theta;
                    if (i < 0)
                        total_zipper[(i + N) % N][2] += 4;
                } while (thetas[(i + N) % N] !== end.theta);
            }
            assert(total_zipper.every(([d1, d2]) => !!d1 === !!d2));
            total_zipper = total_zipper.filter(([d1, d2]) => d1 && d2);
            // link dashes
            for (let [dash1, dash2, offset] of total_zipper) {
                dash1.merge(dash2);
                dash1.adjacent(offset, dash2);
            }
            for (let [dash1, dash2, offset] of total_zipper) {
                let [, end1] = inner_dashes.get(dash1);
                let [, end2] = outer_dashes.get(dash2);
                if (!end1.crossed) {
                    assert(dash1.forward !== undefined && dash1.siblings.has(dash1.forward));
                    dash1.connect(dash1.forward);
                }
                else {
                    dash1.connect(dash2);
                    dash2.angle = 4;
                }
                if (!end2.crossed) {
                    assert(dash2.forward !== undefined && dash2.siblings.has(dash2.forward));
                    dash2.connect(dash2.forward);
                }
                else {
                    dash2.connect(dash1);
                    dash1.angle = 4;
                }
            }
            // zippers = this.divideZipper(total_zipper);
            let i = total_zipper.findIndex(([dash1, ,]) => inner_dashes.get(dash1)[0].crossed);
            if (i !== -1)
                total_zipper.push(...total_zipper.splice(0, i));
            while (total_zipper.length > 0) {
                let zipper = [];
                let sib = total_zipper[0][0].siblings;
                for (let [dash1, dash2, offset] of total_zipper)
                    if (sib.has(dash1))
                        zipper.push([dash1, dash2, offset]);
                total_zipper = total_zipper.filter(([d]) => !sib.has(d));
                zippers.push(zipper);
            }
        }
        // make turns
        let turns = new Map();
        for (let [v1_, [ang, v2_, elem]] of turns_) {
            let v1 = v1_.prefer > 0 ? v1_.segment.start : v1_.segment.end;
            let v2 = v2_ instanceof SphVertex ? v2_
                : v2_.prefer > 0 ? v2_.segment.start : v2_.segment.end;
            turns.set(v1, [ang, v2, elem]);
        }
        // separate inner/outer part
        let inner = new Set();
        let outer = new Set();
        for (let vs of vertices)
            for (let v of vs) {
                let rel = vrels.get(v);
                if (rel === REL.INLINE || rel === REL.INSIDE)
                    inner.add(v.segment);
                if (rel === REL.OUTLINE || rel === REL.OUTSIDE)
                    outer.add(v.segment);
            }
        return [zippers, turns, inner, outer];
    }
    /**
     * Find the element contains given point.
     *
     * @param {Vector} point
     * @param {Iterable<Set<SphSeg>>} elements
     * @returns {SphVertex | Set<SphSeg> | null} Vertex or element or null.
     */
    grab(point, elements) {
        let elements_col = Array.from(elements);
        let boundaries = elements_col.flatMap(elem => Array.from(elem));
        // grab edge
        for (let segment of boundaries)
            if (this.meetWithPoint(segment, point) === 0) {
                let offsets = [0, segment.arc, ...segment.adj.keys()].slice(0, -1);
                let offset = It.from(offsets).find(offset => this.fzy_cmp(point, segment.vectorAt(offset)) === 0, mod4(segment.thetaOf(point)));
                if (offset < segment.arc)
                    return new SphVertex({ segment, offset, prefer: +1 });
            }
        // grab element
        let orientation = q_mul(q_align(point, boundaries[0].vectorAt(0)), [0.5, 0.5, 0.5, -0.5]);
        let knife = SphSeg.makeCircle({ orientation, radius: 1 });
        let [vertices, vrels, crels] = this.meetWithBoundaries(knife, boundaries);
        // determine meeted angles
        let [vgroup, theta] = vertices.filter(([v]) => vrels.get(v) === REL.INLINE || vrels.get(v) === REL.OUTLINE)
            .map(vs => [vs, mod4(knife.thetaOf(vs[0].position))])
            .sort((a, b) => a[1] - b[1]).shift();
        // classify type of meet by angle
        for (let i = 0; i < vgroup.length; i += 2) {
            let prev = vgroup[i + 1];
            let next = vgroup[i];
            let sgn1 = vrels.get(prev) === REL.INLINE ? +1 : -1;
            let sgn2 = vrels.get(next) === REL.INLINE ? +1 : -1;
            let ang2 = v0.angleTo(next, sgn2, crels.get(next.segment) !== REL.BOTHSIDE);
            assert(prev.prefer === -1 && next.prefer === +1);
            assert(prev.turn().equal(next));
            let element = bang(elements_col.find(elem => elem.has(prev.segment)));
            assert(element === elements_col.find(elem => elem.has(next.segment)));
            if (sgn1 > 0 && sgn2 < 0) {
                // cross meet
            }
            else if (sgn1 < 0 && sgn2 > 0) {
                // cross meet
                return element;
            }
            else if (sgn1 > 0 && ang2 + next.angle > 3) {
                // scoop meet
                return element;
            }
            else if (sgn1 < 0 && ang2 + next.angle > 1) {
                // scoop meet
                return element;
            }
            else {
                // touch meet
            }
        }
        // grab nothing
        return null;
    }
    /**
     * Find the maximal zippers between given segments, in which all sublists of
     * maximal zippers that preserving order are valid zippers.
     * Zipper is an ordered list of contacts, and contact is adjacent relation that
     * describe the overlapping between the segments: `[seg1, seg2, offset]`, where
     * `seg1.adj.get(offset) === seg2`.  Those contacts should place along the
     * extended circle until the end vertices of `seg1` and `seg2` overlap.
     *
     * @param {Iterable<SphSeg>} segments - The segments to zip.
     * @returns {Zipper[]} The zippers.
     */
    findZippers(segments) {
        let zippers = [];
        let segments_col = new Set(segments);
        for (let seg0 of segments_col) {
            // find segments along `seg0` linked by `forward` and `backward`
            let track = [];
            for (let seg of seg0.ski(+1)) { // search forward
                track.push(seg);
                if (seg.right_aligned) {
                    track.shift();
                    for (let seg of seg0.ski(-1)) { // search backward
                        track.unshift(seg);
                        if (seg.left_aligned)
                            break;
                    }
                    break;
                }
            }
            // make zipper
            let zipper = [];
            for (let seg1 of track)
                if (segments_col.has(seg1))
                    for (let [offset, seg2] of seg1.adj)
                        if (segments_col.has(seg2))
                            zipper.push([seg1, seg2, offset]);
            if (zipper.length > 0)
                zippers.push(zipper);
            for (let [seg1, seg2] of zipper) {
                segments_col.delete(seg1);
                segments_col.delete(seg2);
            }
        }
        return zippers;
    }
    divideZipper(zipper) {
    }
    /**
     * Glue zipper.  The glued segments should be siblings each others.
     *
     * @param {Zipper<SphSeg>} zipper - The contacts to glue.
     * @returns {SphSeg[]} The end points of glued subzipper.
     */
    glueAlongZipper(zipper) {
        // cyclic sort zipper based on inner segments (prepare for interpolation)
        let inner_zipper = zipper.slice();
        if (inner_zipper[0][0] === inner_zipper[inner_zipper.length - 1][0]) {
            let i = inner_zipper.findIndex(contact => contact[0] !== inner_zipper[0][0]);
            if (i !== -1)
                inner_zipper.push(...inner_zipper.splice(0, i));
            else
                inner_zipper.sort((a, b) => a[2] - b[2]);
        }
        // interpolate inner segments
        for (let i = inner_zipper.length - 1; i >= 0; i--) {
            let [seg, adj_seg, offset] = inner_zipper[i];
            if (It.keys(seg.adj).last() !== offset) {
                let [seg_, adj_seg_] = inner_zipper[i + 1] || [];
                assert(inner_zipper[i + 1] && seg === seg_ ? adj_seg.backward === adj_seg_ : true);
                if (inner_zipper[i + 1] && seg === seg_ && adj_seg.backward === adj_seg_)
                    continue;
                this.interpolate(seg, offset);
            }
            if (It.keys(seg.adj).first() !== offset) {
                let [seg_, adj_seg_] = inner_zipper[i - 1] || [];
                if (inner_zipper[i - 1] && seg === seg_ && adj_seg.forward === adj_seg_)
                    continue;
                let offset_ = It.keys(seg.adj).filter(offset_ => offset_ < offset).last();
                seg = this.interpolate(seg, offset_);
                offset = It.keys(seg.adj).first();
                inner_zipper[i][0] = seg;
                inner_zipper[i][2] = offset;
            }
        }
        let outer_zipper = zipper.reverse();
        // cyclic sort zipper based on outer segments (prepare for interpolation)
        if (outer_zipper[0][1] === outer_zipper[outer_zipper.length - 1][1]) {
            let i_ = outer_zipper.findIndex(contact => contact[1] !== outer_zipper[0][1]);
            if (i_ !== -1)
                outer_zipper.push(...outer_zipper.splice(0, i_));
            else
                outer_zipper.sort((a, b) => a[2] - b[2]);
        }
        // interpolate outer segments
        for (let i = outer_zipper.length - 1; i >= 0; i--) {
            let [seg, adj_seg, offset] = outer_zipper[i];
            if (It.keys(adj_seg.adj).last() !== offset) {
                let [seg_, adj_seg_] = outer_zipper[i + 1] || [];
                assert(outer_zipper[i + 1] && adj_seg === adj_seg_ ? seg.backward === seg_ : true);
                if (outer_zipper[i + 1] && adj_seg === adj_seg_ && seg.backward === seg_)
                    continue;
                this.interpolate(adj_seg, offset);
            }
            if (It.keys(adj_seg.adj).first() !== offset) {
                let [seg_, adj_seg_] = outer_zipper[i - 1] || [];
                if (outer_zipper[i - 1] && adj_seg === adj_seg_ && seg.forward === seg_)
                    continue;
                let offset_ = It.keys(adj_seg.adj).filter(offset_ => offset_ < offset).last();
                adj_seg = this.interpolate(adj_seg, offset_);
                offset = It.keys(adj_seg.adj).first();
                outer_zipper[i][1] = adj_seg;
                outer_zipper[i][2] = offset;
            }
        }
        outer_zipper = outer_zipper.map(([seg, adj_seg, offset]) => [adj_seg, seg, offset]);
        // zip
        let res = [];
        for (let zipper_ of [inner_zipper, outer_zipper])
            for (let i = 0; i < zipper_.length; i++) {
                let [seg1, adj_seg1, offset] = zipper_[i];
                let [seg2, ,] = zipper_[i + 1] || zipper_[0];
                if (seg1.arc < offset && seg1.next !== seg2) {
                    assert(seg1.next);
                    this.swap(seg1.next, seg2, 2 + seg1.next.angle, 2 - seg1.next.angle);
                }
                else if (seg1.arc === offset && seg1.next !== adj_seg1) {
                    assert(seg1.next);
                    res.push(seg1.next);
                    this.swap(adj_seg1, seg1.next, 4 - seg1.next.angle, seg1.next.angle);
                    if (adj_seg1.backward)
                        adj_seg1.backward.forward = undefined;
                    if (seg1.forward)
                        seg1.forward.backward = undefined;
                }
                else if (adj_seg1.arc === offset && adj_seg1.next !== seg1) {
                    assert(adj_seg1.next);
                    res.push(adj_seg1.next);
                    this.swap(seg1, adj_seg1.next, 4 - adj_seg1.next.angle, adj_seg1.next.angle);
                    if (seg1.backward)
                        seg1.backward.forward = undefined;
                    if (adj_seg1.forward)
                        adj_seg1.forward.backward = undefined;
                }
            }
        let dashes = It.from(zipper).flatMap(([seg1, seg2]) => [seg1, seg2]).toUniqArray();
        for (let seg of dashes) {
            let dashes_ = dashes.filter(seg_ => seg.siblings.has(seg_));
            if (dashes_.length > 0)
                seg.split(dashes_);
        }
        return res;
    }
    cutAlongZipper(knife, zipper) {
        // cyclic sort zipper based on inner segments (prepare for interpolation)
        let inner_zipper = zipper.slice();
        if (inner_zipper[0][0] === inner_zipper[inner_zipper.length - 1][0]) {
            let i = inner_zipper.findIndex(contact => contact[0] !== inner_zipper[0][0]);
            if (i !== -1)
                inner_zipper.push(...inner_zipper.splice(0, i));
            else
                inner_zipper.sort((a, b) => a[2] - b[2]);
        }
        // interpolate inner segments
        for (let i = inner_zipper.length - 1; i >= 0; i--) {
            let [seg, adj_seg, offset] = inner_zipper[i];
            if (It.keys(seg.adj).last() !== offset) {
                let [seg_, adj_seg_] = inner_zipper[i + 1] || [];
                assert(inner_zipper[i + 1] && seg === seg_ ? adj_seg.backward === adj_seg_ : true);
                if (inner_zipper[i + 1] && seg === seg_ && adj_seg.backward === adj_seg_)
                    continue;
                this.interpolate(seg, offset);
            }
            if (It.keys(seg.adj).first() !== offset) {
                let [seg_, adj_seg_] = inner_zipper[i - 1] || [];
                if (inner_zipper[i - 1] && seg === seg_ && adj_seg.forward === adj_seg_)
                    continue;
                let offset_ = It.keys(seg.adj).filter(offset_ => offset_ < offset).last();
                seg = this.interpolate(seg, offset_);
                offset = It.keys(seg.adj).first();
                inner_zipper[i][0] = seg;
                inner_zipper[i][2] = offset;
            }
        }
        let outer_zipper = zipper.reverse();
        // cyclic sort zipper based on outer segments (prepare for interpolation)
        if (outer_zipper[0][1] === outer_zipper[outer_zipper.length - 1][1]) {
            let i_ = outer_zipper.findIndex(contact => contact[1] !== outer_zipper[0][1]);
            if (i_ !== -1)
                outer_zipper.push(...outer_zipper.splice(0, i_));
            else
                outer_zipper.sort((a, b) => a[2] - b[2]);
        }
        // interpolate outer segments
        for (let i = outer_zipper.length - 1; i >= 0; i--) {
            let [seg, adj_seg, offset] = outer_zipper[i];
            if (It.keys(adj_seg.adj).last() !== offset) {
                let [seg_, adj_seg_] = outer_zipper[i + 1] || [];
                assert(outer_zipper[i + 1] && adj_seg === adj_seg_ ? seg.backward === seg_ : true);
                if (outer_zipper[i + 1] && adj_seg === adj_seg_ && seg.backward === seg_)
                    continue;
                this.interpolate(adj_seg, offset);
            }
            if (It.keys(adj_seg.adj).first() !== offset) {
                let [seg_, adj_seg_] = outer_zipper[i - 1] || [];
                if (outer_zipper[i - 1] && adj_seg === adj_seg_ && seg.forward === seg_)
                    continue;
                let offset_ = It.keys(adj_seg.adj).filter(offset_ => offset_ < offset).last();
                adj_seg = this.interpolate(adj_seg, offset_);
                offset = It.keys(adj_seg.adj).first();
                outer_zipper[i][1] = adj_seg;
                outer_zipper[i][2] = offset;
            }
        }
        outer_zipper = outer_zipper.map(([seg, adj_seg, offset]) => [adj_seg, seg, offset]);
    }
}
