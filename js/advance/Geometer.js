// #### ######## ######## ########  
//  ##     ##    ##       ##     ## 
//  ##     ##    ##       ##     ## 
//  ##     ##    ######   ########  
//  ##     ##    ##       ##   ##   
//  ##     ##    ##       ##    ##  
// ####    ##    ######## ##     ## 


// iterator tools
function* map(it, mapping=function(v,i){return v;}) {
  var i = 0;
  for ( let v of it )
    yield mapping(v,i++);
}
function* flatmap(it, mapping=function(v,i){return [v];}) {
  var i = 0;
  for ( let v of it )
    yield* mapping(v,i++);
}
function* filter(it, filtering=function(v,i){return true;}) {
  var i = 0;
  for ( let v of it )
    if ( filtering(v,i++) )
      yield v;
}
function reduce(it, callback, initial) {
  if ( initial === undefined ) {
    var original_callback = callback;
    callback = function(acc, value){ callback = original_callback; return value; }
  }
  for ( let v of it )
    initial = callback(initial, v);
  return initial;
}

function* repeat(v) { while ( true ) yield v; }
// zip iterables, where un-iterable transform as infinited repeated iterator
function* zip(...iterables) {
  var iterators = iterables.map(it => {
    if ( it != null && typeof it[Symbol.iterator] === "function" )
      return it[Symbol.iterator]();
    else
      return repeat(it);
  });
  var data = iterators.map(it => it.next());
  while ( data.every(d => !d.done) ) {
    yield data.map(d => d.value);
    data = iterators.map(it => it.next());
  }
}
// comb2([1,2,3]) ==>> [[1,2], [1,3], [2,3]]
function* comb2(list) {
  if ( !Array.isArray(list) )
    list = [...list];
  const length = list.length;
  for ( let i=0; i<length-1; i++ )
    for ( let j=i+1; j<length; j++ )
      yield [list[i], list[j]];
}

// in-place filter array, return false if nothing change
function filterInPlace(arr, condition) {
  var j = 0;
  for ( var i = 0; i < arr.length; i++ )
    if ( condition(arr[i], i, arr) ) arr[j++] = arr[i];
  if ( arr.length === j )
    return true;
  arr.length = j;
  return false;
}


// ######## ##     ## ######## ######## ##    ## 
// ##       ##     ##      ##       ##   ##  ##  
// ##       ##     ##     ##       ##     ####   
// ######   ##     ##    ##       ##       ##    
// ##       ##     ##   ##       ##        ##    
// ##       ##     ##  ##       ##         ##    
// ##        #######  ######## ########    ##    


// fuzzy compare tool
class FuzzyTool
{
  constructor(param) {
    param = Object.assign({
      precision: 5
    }, param);
    this.precision = param.precision;
    this.tolerance = Math.pow(10, -this.precision);
    this.scale = Math.pow(10, this.precision);
  }
  toString(value) {
    return value.toFixed(this.precision);
  }
  round(value) {
    // return parseFloat(value.toFixed(this.precision));
    return Math.round(value * this.scale) / this.scale;
  }
  roundTo(value, pool) {
    res = pool.find(v => this.equals(value, v));
    return res === undefined ? value : res;
  }
  greater_than(v1, v2) {
    return (v1-v2 > -this.tolerance);
  }
  less_than(v1, v2) {
    return (v1-v2 < this.tolerance);
  }
  equals(v1, v2) {
    if ( v1.x !== undefined && v1.y !== undefined && v1.z !== undefined )
      return (Math.abs(v1.x-v2.x) < this.tolerance)
          && (Math.abs(v1.y-v2.y) < this.tolerance)
          && (Math.abs(v1.z-v2.z) < this.tolerance);
    else if ( v1.constant !== undefined && v1.normal !== undefined )
      return this.equals(v1.constant, v2.constant)
          && this.equals(v1.normal, v2.normal);
    else
      return Math.abs(v1-v2) < this.tolerance;
  }
  isZero(value) {
    return Math.abs(value) < this.tolerance;
  }
  sign(value) {
    return (Math.abs(value) < this.tolerance) ? 0 : Math.sign(value);
  }
}
var defaultFuzzyTool = new FuzzyTool();


// ########    ###     ######  ######## 
// ##         ## ##   ##    ## ##       
// ##        ##   ##  ##       ##       
// ######   ##     ## ##       ######   
// ##       ######### ##       ##       
// ##       ##     ## ##    ## ##       
// ##       ##     ##  ######  ######## 


//
//            __Vector3 ---- a
//           / /\ \
//          / /  \ \
//         / /    \ \---- ab
// ca ----/ /      \ \
//       / / Face3  \ \
//      / /          \ \
//      \/____________\/
// c ..-'\___GlueTab__/`-.. b
//             \
//              `-- bc
//

const VERTICES = Object.freeze(["a", "b", "c"]);
const EDGES = Object.freeze(["ca", "ab", "bc"]);
const EDGES_DUAL = Object.freeze({ca:"b",  ab:"c",  bc:"a"});
const EDGES_NEXT = Object.freeze({ca:"ab", ab:"bc", bc:"ca"});
const EDGES_PREV = Object.freeze({ca:"bc", ab:"ca", bc:"ab"});

// linking type of `GlueTab`
const EDGE_TYPE = Object.freeze({
  FLAT: Symbol("EDGE_TYPE.FLAT"),
  CONVAX: Symbol("EDGE_TYPE.CONVAX"),
  CONCAVE: Symbol("EDGE_TYPE.CONCAVE"),
});

class GlueTab // 糊地
{
  // types and labels of dual tab should be same
  // glue tab has no direct linking to its owner
  // to create or modify glue tab, use factory method `make`
  //   and setter `setType`, `setLabel` instead
  constructor(face, edge, type, label) {
    this.face = face;
    this.edge = edge;
    this.type = type;
    this.label = label;
  }
  clone() { return new GlueTab(this.face, this.edge, this.type, this.label); }
  setType(t)  { this.type  = t; if ( this.dual ) this.dual.type  = t; }
  setLabel(l) { this.label = l; if ( this.dual ) this.dual.label = l; }

  // dual glue tab, it always links back to its owner
  get dual() { return this.face[this.edge]; }
  // back-linking tab
  get isEdge() { return this.dual ? this.dual !== this : false }
  // get glue tab linking to `face[edge]`
  static to(face, edge) { return (face[edge] || {}).dual; }
  // return if `face1[edge1]` and `face2[edge2]` are adjacent by checking vertices
  // direction is important
  static areAdjacent(face1, edge1, face2, edge2) {
    return (face1[edge1[0]] === face2[edge2[1]]) && (face1[edge1[1]] === face2[edge2[0]]);
  }

  // link glue this and `tab` each others, then return modified tabs
  glue(tab) {
    if ( this.dual === tab )
      return [];

    var {face, edge} = this.dual;
    var {face:adjFace, edge:adjEdge} = tab.dual;

    this.face = adjFace;
    this.edge = adjEdge;

    tab.face = face;
    tab.edge = edge;

    return [this, tab];
  }
  // link glue tab and its dual to itself, then return modified tabs
  unglue() {
    if ( !this.isEdge )
      return [];

    var dual = this.dual;
    var {face:adjFace, edge:adjEdge} = this;
    var {face, edge} = dual;

    this.face = face;
    this.edge = edge;

    dual.face = adjFace;
    dual.edge = adjEdge;

    return [this, dual];
  }
  // merge tab then return removed tab
  // TODO: merge label of two tabs
  merge(merged) {
    var ret;

    if ( this.isEdge && merged.isEdge ) {
      ret = [this.dual, merged.dual];

      this.glue(merged);

    } else if ( this.isEdge && !merged.isEdge ) {
      ret = [this, this.dual];

      let {face, edge} = this.dual;
      face[edge] = merged;
      this.face = face;
      this.edge = edge;

    } else if ( !this.isEdge && merged.isEdge ) {
      ret = [merged, merged.dual];

      let {face, edge} = merged.dual;
      face[edge] = this;
      this.face = face;
      this.edge = edge;

    } else {
      ret = [this, merged];
    }

    return ret;
  }
  // make glue tab at `face[edge]` and `adjFace[adjEdge]` and gluing each others,
  //   then return new tab at `face[edge]` and `adjFace[adjEdge]`
  // if `adjFace`, `adjEdge` are `undefined`, make back-linking tab at `face[edge]`,
  //   then return new tab at `face[edge]`
  // not in-place modification
  static make(face, edge, adjFace, adjEdge, {type, label}={}) {
    if ( adjFace !== undefined ) {
      face[edge] = new GlueTab(adjFace, adjEdge, type, label);
      adjFace[adjEdge] = new GlueTab(face, edge, type, label);

      return [face[edge], adjFace[adjEdge]];

    } else {
      face[edge] = new GlueTab(face, edge, type, label);

      return face[edge];
    }
  }
  // make and glue each tabs by checking vertices, then return back-linking tabs
  // not in-place modification
  static assemble(faces) {
    // remove old glue tabs
    for ( let face of faces ) for ( let edge of EDGES )
      delete face[edge];

    // link adjacent faces
    for ( let [face1, face2] of comb2(faces) ) for ( let edge1 of EDGES ) for ( let edge2 of EDGES )
      if ( !(edge1 in face1) && !(edge2 in face2) )
        if ( this.areAdjacent(face1, edge1, face2, edge2) )
          this.make(face1, edge1, face2, edge2);

    // make boundary
    var boundary = new Set();
    for ( let face of faces ) for ( let edge of EDGES )
      if ( !(edge in face) )
        boundary.add(this.make(face, edge));

    return boundary;
  }

  // unglue all out-linking tabs in `faces`, then return modified tabs
  static trim(faces) {
    faces = new Set(faces);
    var unglued = [];

    for ( let face of faces ) for ( let edge of EDGES )
      if ( !faces.has(face[edge].face) )
        unglued.push(...face[edge].unglue());

    return unglued;
  }
  // glue all back-linking tabs between `faces1` and `faces2`, then return modified tabs
  static merge(faces1, faces2) {
    var glued = [];
  
    for ( let face1 of faces1 ) for ( let edge1 of EDGES )
      for ( let face2 of faces2 ) for ( let edge2 of EDGES )
        if ( !face1[edge1].isEdge && !face2[edge2].isEdge )
          if ( this.areAdjacent(face1, edge1, face2, edge2) )
            glued.push(...face1[edge1].glue(face2[edge2]));

    return glued;
  }

  static boundariesOf(faces) {
    var boundary = new Set();
    for ( let face of faces ) for ( let edge of EDGES )
      if ( face[edge] && !face[edge].isEdge )
        boundary.add(face[edge]);
    return boundary;
  }
  next_boundary() {
    var bd = this;
    if ( !bd.isEdge ) {
      while ( (bd = bd.face[EDGES_NEXT[bd.edge]]).isEdge );
      return bd;
    }
  }
  prev_boundary() {
    var bd = this;
    if ( !bd.isEdge ) {
      while ( (bd = bd.face[EDGES_PREV[bd.edge]]).isEdge );
      return bd;
    }
  }
}


//  ######   ########  #######  
// ##    ##  ##       ##     ## 
// ##        ##       ##     ## 
// ##   #### ######   ##     ## 
// ##    ##  ##       ##     ## 
// ##    ##  ##       ##     ## 
//  ######   ########  #######  


class Geometer
{
  // modify structure of Face3 faster computing
  static fly(geometry) {
    var uvs = geometry.faceVertexUvs;
    geometry.nlayer = geometry.faceVertexUvs.length;
    geometry.faceVertexUvs = [[]];

    for ( let x in geometry.faces ) {
      let face = geometry.faces[x];

      // face.vertexNormals = [a,b,c]  =>  face.normals = {a,b,c}
      let ns = face.vertexNormals;
      if ( ns.length ) {
        face.normals = {a:ns[0], b:ns[1], c:ns[2]};
        face.vertexNormals = [];
      }

      // face.vertexColors = [a,b,c]  =>  face.colors = {a,b,c}
      let cs = face.vertexColors;
      if ( cs.length ) {
        face.colors = {a:cs[0], b:cs[1], c:cs[2]};
        face.vertexColors = [];
      }

      // faceVertexUvs[x] = [[a,b,c], ...]  =>  face.uvs = [{a,b,c}, ...]
      face.uvs = [];
      for ( let l=0; l<uvs.length; l++ ) {
        let uv = uvs[l][x];
        if ( uv && uv.length )
          face.uvs[l] = {a:uv[0], b:uv[1], c:uv[2]};
      }
    }

    geometry.boundaries = GlueTab.assemble(geometry.faces);
  }
  static land(geometry) {
    var uvs = geometry.faceVertexUvs = [[]];
    for ( let l=0; l<geometry.nlayer; l++ )
      uvs[l] = [];

    for ( let x in geometry.faces ) {
      let face = geometry.faces[x];

      if ( face.normals )
        face.vertexNormals = [face.normals.a, face.normals.b, face.normals.c];
      delete face.normals;

      if ( face.colors )
        face.vertexColors = [face.colors.a, face.colors.b, face.colors.c];
      delete face.colors;

      if ( face.uvs ) for ( let l in face.uvs )
          uvs[l][x] = [face.uvs[l].a, face.uvs[l].b, face.uvs[l].c];
      delete face.uvs;

      for ( let edge of EDGES )
        delete face[edge];
    }

    delete geometry.boundaries;
  }

  // copy flying face
  // shallow copy flying data `face.label`, `face.normals`, `face.colors`, `face.uvs`
  static copyFace(face, copied=new THREE.Face3().copy(face)) {
    copied.label = face.label;

    if ( face.normals )
      copied.normals = {
        a: face.normals.a,
        b: face.normals.b,
        c: face.normals.c,
      };

    if ( face.colors )
      copied.colors = {
        a: face.colors.a,
        b: face.colors.b,
        c: face.colors.c,
      };

    copied.uvs = [];
    if ( face.uvs ) for ( let l in face.uvs ) {
      copied.uvs[l] = {
        a: face.uvs[l].a,
        b: face.uvs[l].b,
        c: face.uvs[l].c,
      };
    }

    return copied;
  }
  // copy flying faces with linking relations
  static copyFaces(faces, copied_faces=faces.map(face=>new THREE.Face3().copy(face))) {
    for ( let [face, copied_face] of zip(faces, copied_faces) ) {
      this.copyFace(face, copied_face);

      // transfer link
      for ( let edge of EDGES ) {
        let {face:adjFace, edge:adjEdge, type, label} = face[edge];
        if ( adjFace === face )
          adjFace = copied_face;
        else
          adjFace = copied_faces[faces.indexOf(adjFace)];
        copied_face[edge] = new GlueTab(adjFace, adjEdge, type, label);
      }
    }
  }
  // copy flying geometry
  static copy(geometry, copied=geometry.clone()) {
    copied.nlayer = geometry.nlayer;
    this.copyFaces(geometry.faces, copied.faces);
    copied.boundaries = GlueTab.boundariesOf(geometry.faces);
    return copied;
  }
  static computeEdgeType(geometry, only_check_flat=false) {
    if ( only_check_flat ) {
      for ( let face of geometry.faces ) for ( let edge of EDGES )
        if ( face[edge].isEdge && face[edge].type === undefined ) {
          let adj = face[edge];

          let n_left = face.normal;
          let n_right = adj.face.normal;
          let is_flat = defaultFuzzyTool.equals(n_left.angleTo(n_right), 0);
          if ( is_flat ) adj.setType(EDGE_TYPE.FLAT);
        }

    } else {
      var vertices = geometry.vertices;
      for ( let face of geometry.faces ) for ( let edge of EDGES )
        if ( face[edge].isEdge && face[edge].type === undefined ) {
          let adj = face[edge];

          let va = vertices[face[edge[0]]];
          let vb = vertices[face[edge[1]]];
          let vab = new THREE.Vector3().subVectors(vb, va).normalize();

          let n_left = face.normal;
          let n_right = adj.face.normal;
          let nx = new THREE.Vector3().crossVectors(n_left, n_right);

          let sgn = defaultFuzzyTool.sign(vab.dot(nx));
          adj.setType({[0]:EDGE_TYPE.FLAT, [1]:EDGE_TYPE.CONVAX, [-1]:EDGE_TYPE.CONCAVE}[sgn]);
        }
    }
  }

  // trim trivial vertices
  static trimVertices(geometry) {
    // find non-trivial vertices, which must be refered by face
    var nontriviality = []; // index of vertex -> if vertex is non-trivial
    var nontrivial_vertices = []; // non-trivial vertices
    var nontrivial_vertices_map = {}; // index of merged vertex -> index of non-trivial vertex
  
    for ( let face of geometry.faces ) for ( let a of VERTICES ) {
      let i = face[a];
      if ( !nontriviality[i] ) {
        nontriviality[i] = true;
        nontrivial_vertices_map[i] = nontrivial_vertices.push(geometry.vertices[i])-1;
      }
    }
  
    // re-index vertices of faces
    for ( let face of geometry.faces ) {
      face.a = nontrivial_vertices_map[face.a];
      face.b = nontrivial_vertices_map[face.b];
      face.c = nontrivial_vertices_map[face.c];
    }
  
    geometry.vertices = nontrivial_vertices;
  }

  // split face at edge with interpolation alpha `t` and vertex index `k`
  // the splited tab link to same place or itself
  // return the new face splited out of `face`
  static _split_face(face, edge, t, k) {
    // split face
    const ab = edge;
    const bc = EDGES_NEXT[ab];
    const ca = EDGES_PREV[ab];

    var splited_face = this.copyFace(face);
    face[ab[0]] = splited_face[ab[1]] = k;

    // split tabs
    splited_face[ca] = face[ca];
    if ( !face[ca].isEdge )
      splited_face[ca].face = splited_face;

    splited_face[ab] = face[ab].clone();
    if ( !face[ab].isEdge )
      splited_face[ab].face = splited_face;

    GlueTab.make(face, ca, splited_face, bc, {type:EDGE_TYPE.FLAT});

    // interpolate normal
    if ( face.normals ) {
      let ni = face.normals[ab[0]];
      let nj = face.normals[ab[1]];
      let nk = ni.clone().lerp(nj, t);
      face.normals[ab[0]] = splited_face.normals[ab[1]] = nk;
    }

    // interpolate color
    if ( face.colors ) {
      let ci = face.colors[ab[0]];
      let cj = face.colors[ab[1]];
      let ck = ci.clone().lerp(cj, t);
      face.colors[ab[0]] = splited_face.colors[ab[1]] = ck;
    }

    // interpolate uv
    if ( face.uvs ) for ( let l=0; l<face.uvs.length; l++ ) if ( face.uvs[l] ) {
      var uvli = face.uvs[l][ab[0]];
      var uvlj = face.uvs[l][ab[1]];
      var uvlk = uvli.clone().lerp(uvlj, t);
      face.uvs[l][ab[0]] = splited_face.uvs[l][ab[1]] = uvlk;
    }

    return splited_face;
  }
  // interpolate geometry at edge `face[edge]`
  // new face will be insert after splited faces
  // return the new face splited out of `face` and its dual
  static interpolateAtEdge(geometry, face, edge, t, k) {
    var tab = face[edge];
    var {face:adjFace, edge:adjEdge} = tab;

    // interpolation
    if ( k === undefined ) {
      let i = face[edge[0]];
      let j = face[edge[1]];
      let vi = geometry.vertices[i];
      let vj = geometry.vertices[j];
      let vk = vi.clone().lerp(vj, t);
      k = geometry.vertices.push(vk)-1;
    }

    // split face
    var splited_face = this._split_face(face, edge, t, k);
    geometry.faces.splice(geometry.faces.indexOf(face)+1, 0, splited_face);

    if ( !tab.isEdge ) {
      splited_face[edge].face = splited_face;
      geometry.boundaries.add(splited_face[edge]);
      return [splited_face];
    }

    // split adjacent face
    var splited_adjFace = this._split_face(adjFace, adjEdge, t, k);
    geometry.faces.splice(geometry.faces.indexOf(adjFace)+1, 0, splited_adjFace);

    face[edge].glue(adjFace[adjEdge]);
    splited_face[edge].glue(splited_adjFace[adjEdge]);

    return [splited_face, splited_adjFace];
  }
  // split geometry by plane into two
  // in-place modify `geometry` as positive side, and return `splited` as negative side
  static split(geometry, plane) {
    plane = new THREE.Plane().copy(plane);

    var vertices = geometry.vertices;
    var faces = geometry.faces;
    var boundaries = geometry.boundaries;

    var dis = vertices.map(v => plane.distanceToPoint(v));
    var sgn = dis.map(d => defaultFuzzyTool.sign(d));

    // split edge
    // `geometry.faces` increase in method `interpolateAtEdge`
    for ( let x=0; x<faces.length; x++ ) for ( let edge of EDGES ) {
      let face = faces[x];
      let i = face[edge[0]];
      let j = face[edge[1]];

      if ( sgn[i] * sgn[j] < 0 ) {
        // interpolation
        let t = dis[i]/(dis[i]-dis[j]);
        let vi = vertices[i];
        let vj = vertices[j];
        let vk = vi.clone().lerp(vj, t);
        let k = vertices.push(vk)-1;
        dis.push(0);
        sgn.push(0);

        this.interpolateAtEdge(geometry, face, edge, t, k);
      }
    }

    // determine side of faces respect to cut plane
    const SIDE = Symbol("SIDE");
    const FRONT = Symbol("SIDE.FRONT");
    const BACK = Symbol("SIDE.BACK");

    for ( let face of faces ) {
      if ( VERTICES.some(a => sgn[face[a]] !== 0) ) {
        if ( VERTICES.every(a => sgn[face[a]] >= 0) )
          face[SIDE] = FRONT;
        else if ( VERTICES.every(a => sgn[face[a]] <= 0) )
          face[SIDE] = BACK;
        else
          console.assert(false);

      } else {
        if ( plane.normal.dot(face.normal) < 0 )
          face[SIDE] = FRONT;
        else
          face[SIDE] = BACK;
      }
    }

    // split geometry into `geometry` and `splited`
    geometry.faces = [];
    geometry.boundaries = new Set();
    var splited = this.copy(geometry);

    geometry.faces = faces.filter(face => face[SIDE] === FRONT);
    splited.faces = faces.filter(face => face[SIDE] === BACK);

    // unlink edge between two sides
    for ( let face of faces ) if ( face[SIDE] === FRONT ) for ( let edge of EDGES ) {
      if ( face[SIDE] !== face[edge].face[SIDE] )
        face[edge].unglue();
    }

    geometry.boundaries = GlueTab.boundariesOf(geometry.faces);
    splited.boundaries = GlueTab.boundariesOf(splited.faces);

    this.trimVertices(geometry);
    this.trimVertices(splited);

    for ( let face of faces )
      delete face[SIDE];

    return splited;
  }
}
