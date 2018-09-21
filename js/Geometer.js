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
function removeFirst(arr, filter) {
  var i = arr.findIndex(filter);
  if ( i === -1 )
    return false;
  arr.splice(i, 1);
  return true;
}
function findMax(arr, key=arr) {
  let j = 0;
  for ( let i=0; i < arr.length; i++ )
    if ( key[i] > key[j] )
      j = i;
  return j;
}

// iterate uv values along z-curve order by order
function* ziter() {
  var queue = [1/2, 1/2, 1, 1];
  while ( true ) {
    let u = queue.shift();
    let v = queue.shift();
    let w = queue.shift();
    let h = queue.shift();
    yield [u, v];
    queue.push(u-w/4, v-h/4, w/2, h/2,
               u+w/4, v-h/4, w/2, h/2,
               u-w/4, v+h/4, w/2, h/2,
               u+w/4, v+h/4, w/2, h/2);
  }
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
    var val = value.toFixed(this.precision);
    if ( val === "-"+(0).toFixed(this.precision) )
      val = (0).toFixed(this.precision);
    return val;
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
  inrange(v, v1, v2) {
    return this.greater_than(v, v1) && this.less_than(v, v2);
  }
  equals(v1, v2) {
    if ( v1.fuzzyKeys !== undefined && v2.fuzzyKeys !== undefined )
      return this.equals(v1.fuzzyKeys(), v2.fuzzyKeys());
    else if ( v1.x !== undefined && v1.y !== undefined && v1.z !== undefined ) // THREE.Vector3
      return (Math.abs(v1.x-v2.x) < this.tolerance)
          && (Math.abs(v1.y-v2.y) < this.tolerance)
          && (Math.abs(v1.z-v2.z) < this.tolerance);
    else if ( v1.constant !== undefined && v1.normal !== undefined ) // THREE.Plane
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
  collect(it) {
    var res = [];
    for ( let value of it )
      if ( !res.find(v => this.equals(v, value)) )
        res.push(value);
    return res;
  }
}
var defaultFuzzyTool = new FuzzyTool();


//  ######   ########  #######  
// ##    ##  ##       ##     ## 
// ##        ##       ##     ## 
// ##   #### ######   ##     ## 
// ##    ##  ##       ##     ## 
// ##    ##  ##       ##     ## 
//  ######   ########  #######  


const VERTICES = Object.freeze(["a", "b", "c"]);
const VERTICES_IND = Object.freeze({a:0,  b:1,  c:2});
const EDGES = Object.freeze(["ca", "ab", "bc"]);
const EDGES_DUAL = Object.freeze({ca:"b",  ab:"c",  bc:"a"});
const EDGES_NEXT = Object.freeze({ca:"ab", ab:"bc", bc:"ca"});
const EDGES_PREV = Object.freeze({ca:"bc", ab:"ca", bc:"ab"});

class Geometer
{
  // doubly linked faces structure:
  // we use `(face,edge)` to denote the edge of face
  // if it is link to `(adjFace,adjEdge)`, then we have
  // >  [ adjFace, adjEdge ] = [ face[edge], face.adj[edge] ]
  // >  [ face, edge ] = [ adjFace[adjEdge], adjFace.adj[adjEdge] ]

  // if `(face1,edge1)` and `(face2,edge2)` are adjacent (share same vertices)
  static areAdjacent(face1, edge1, face2, edge2) {
    return (face1[edge1[0]] === face2[edge2[1]]) && (face1[edge1[1]] === face2[edge2[0]]);
  }
  // connect `(face,edge)` and `(adjFace,adjEdge)`,
  //   then return connected links: `[ [face,edge], [adjFace,adjEdge] ]`
  // or disconnect `(face,edge)` if `adjFace` is undefined,
  //   then return connected links: `[ [face,edge] ]`
  static connect(face, edge, adjFace, adjEdge) {
    if ( adjFace ) {
      if ( !face.adj ) face.adj = {};
      if ( !adjFace.adj ) adjFace.adj = {};

      [face[edge], face.adj[edge]] = [adjFace, adjEdge];
      [adjFace[adjEdge], adjFace.adj[adjEdge]] = [face, edge];
      return [[face, edge], [adjFace, adjEdge]];

    } else {
      if ( !face.adj ) face.adj = {};

      delete face[edge];
      delete face.adj[edge];
      return [[face, edge]];
    }
  }
  // find all boundaries (`face[edge] === undefined`) in `faces`
  static boundariesIn(geometry) {
    var boundaries = [];
    for ( let face of geometry.faces ) for ( let edge of EDGES )
      if ( !face[edge] )
        boundaries.push([face, edge]);
    return boundaries;
  }

  // modify structure of Face3 to faster computing
  static fly(geometry) {
    if ( geometry.flying )
      return;
    var uvs = geometry.faceVertexUvs;
    const nlayer = geometry.nlayer = geometry.faceVertexUvs.length;

    for ( let x=0,len=geometry.faces.length; x<len; x++ ) {
      let face = geometry.faces[x];

      face.labels = {};

      face.vertexUvs = [];
      for ( let l=0; l<nlayer; l++ )
        if ( uvs[l][x] && uvs[l][x].length )
          face.vertexUvs[l] = uvs[l][x];

      // adjacent edges
      face.adj = {};
    }

    // link adjacent faces
    for ( let [face1, face2] of comb2(geometry.faces) )
      for ( let edge1 of EDGES ) for ( let edge2 of EDGES )
        if ( !face1[edge1] && !face2[edge2] )
          if ( this.areAdjacent(face1, edge1, face2, edge2) )
            this.connect(face1, edge1, face2, edge2);

    // find boundaries of faces
    geometry.boundaries = this.boundariesIn(geometry);
    geometry.flying = true;
  }
  static land(geometry) {
    var uvs = geometry.faceVertexUvs = [[]];
    const nlayer = geometry.nlayer;
    for ( let l=0; l<nlayer; l++ )
      uvs[l] = [];

    for ( let x in geometry.faces ) {
      let face = geometry.faces[x];

      if ( face.vertexUvs ) {
        for ( let l=0; l<nlayer; l++ ) {
          if ( face.vertexUvs[l] && face.vertexUvs[l].length )
            uvs[l][x] = face.vertexUvs[l];
          else
            uvs[l][x] = [new THREE.Vector2(0,0),new THREE.Vector2(0,0),new THREE.Vector2(0,0)];
        }
      } else {
        for ( let l=0; l<nlayer; l++ )
          uvs[l][x] = [new THREE.Vector2(0,0),new THREE.Vector2(0,0),new THREE.Vector2(0,0)];
      }
    }
  }
  static check(geometry) {
    console.assert(geometry.flying);
    console.assert(geometry.nlayer >= geometry.faceVertexUvs.length);
    for ( let face of geometry.faces )
      console.assert(face.labels && face.adj);

    for ( let [face1, face2] of comb2(geometry.faces) )
      for ( let edge1 of EDGES ) for ( let edge2 of EDGES )
        if ( this.areAdjacent(face1, edge1, face2, edge2) ) {
          console.assert(face1[edge1] === face2 && face1.adj[edge1] === edge2);
          console.assert(face2[edge2] === face1 && face2.adj[edge2] === edge1);
        }

    for ( let [face, edge] of geometry.boundaries )
      console.assert(face[edge] === undefined && face.adj[edge] === undefined);

    for ( let face of geometry.faces ) for ( let edge of EDGES ) {
      if ( face[edge] )
        console.assert(this.areAdjacent(face, edge, face[edge], face.adj[edge]));
      else
        console.assert(geometry.boundaries.find(([f,e]) => f===face && e==edge));
    }
  }

  // copy flying face
  // shallow copy flying data `face.labels`, `face.vertexUvs`,
  //   but no link `face.ca`, `face.ab`, `face.bc` and `face.adj`
  static copyFace(face, copied=new THREE.Face3().copy(face)) {
    copied.labels = Object.assign({}, face.labels);

    copied.vertexUvs = [];
    if ( face.vertexUvs )
      for ( let l in face.vertexUvs )
        if ( face.vertexUvs[l].length )
          copied.vertexUvs[l] = face.vertexUvs[l].slice(0);

    copied.adj = {};

    return copied;
  }
  // copy flying faces with adjacent links
  static copyFaces(faces, copied_faces=faces.map(face=>new THREE.Face3().copy(face))) {
    for ( let [face, copied_face] of zip(faces, copied_faces) ) {
      this.copyFace(face, copied_face);

      // transfer link
      for ( let edge of EDGES ) {
        if ( !face.adj )
          break;
        let [adjFace, adjEdge] = [face[edge], face.adj[edge]];
        if ( adjFace !== undefined ) {
          adjFace = copied_faces[faces.indexOf(adjFace)];
          [copied_face[edge], copied_face.adj[edge]] = [adjFace, adjEdge];
        }
      }
    }
  }
  // copy flying geometry
  static copy(geometry, copied=geometry.clone()) {
    copied.nlayer = geometry.nlayer;
    this.copyFaces(geometry.faces, copied.faces);
    copied.boundaries = this.boundariesIn(copied);
    copied.flying = true;
    return copied;
  }

  static reverse(geometry) {
    const EDGES_REV = {ca:"ca", ab:"bc", bc:"ab"};

    for ( let face of geometry.faces ) {
      [face.a, face.b, face.c] = [face.c, face.b, face.a];

      if ( face.vertexNormals.length )
        face.vertexNormals.reverse();
      if ( face.vertexColors.length )
        face.vertexColors.reverse();
      if ( face.vertexUvs )
        for ( let uvs of face.vertexUvs ) uvs.reverse();

      face.normal.negate();

      var old_adj = Object.assign({}, face.adj);
      for ( let edge of EDGES )
        face.adj[EDGES_REV[edge]] = EDGES_REV[old_adj[edge]];
      var old_labels = Object.assign({}, face.labels);
      for ( let edge of EDGES )
        face.labels[EDGES_REV[edge]] = EDGES_REV[old_labels[edge]];
    }

    for ( let bd of geometry.boundaries )
      bd[1] = EDGES_REV[bd[1]];

    return geometry;
  }

  // trim trivial vertices
  static trimVertices(geometry) {
    // find non-trivial vertices, which must be refered by face
    var nontriviality = []; // index of vertex -> if vertex is non-trivial
    var nontrivial_vertices = []; // non-trivial vertices
    var nontrivial_vertices_map = {}; // original vertex index -> vertex index in `nontrivial_vertices`
  
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

  // split `face` at `edge` with interpolation alpha `t` and vertex index `k`
  // return the splited face `[face_A, face_B]`
  //
  //          c                            c          
  //         / \                          /|\         
  //        /   \                        / | \        
  //       /     \                      /  |  \       
  //      /       \                    /   |   \      
  //     /  face   \       ===>       /    |    \     
  //    /           \               A-side | B-side   
  //   /             \              /face  |  face\   
  //  /_______________\            /_______|_______\  
  // a        |        b          a       b a       b 
  //    split edge `ab`
  static _split_face(face, edge, t, k) {
    const ab = edge;
    const bc = EDGES_NEXT[ab];
    const ca = EDGES_PREV[ab];
    const a_ind = VERTICES_IND[ab[0]];
    const b_ind = VERTICES_IND[ab[1]];

    // split face
    var face_A = this.copyFace(face);
    var face_B = this.copyFace(face);
    face_B[ab[0]] = face_A[ab[1]] = k;

    [face_A[ab], face_A.adj[ab]] = [face[ab], face.adj[ab]];
    [face_B[ab], face_B.adj[ab]] = [face[ab], face.adj[ab]];
    this.connect(face_A, ca, face[ca], face.adj[ca]);
    this.connect(face_B, bc, face[bc], face.adj[bc]);
    this.connect(face_A, bc, face_B, ca);
    delete face_A.labels.bc;
    delete face_B.labels.ca;

    // interpolate normal
    if ( face.vertexNormals.length ) {
      let ni = face.vertexNormals[a_ind];
      let nj = face.vertexNormals[b_ind];
      let nk = ni.clone().lerp(nj, t);
      face_B.vertexNormals[a_ind] = face_A.vertexNormals[b_ind] = nk;
    }

    // interpolate color
    if ( face.vertexColors.length ) {
      let ci = face.vertexColors[a_ind];
      let cj = face.vertexColors[b_ind];
      let ck = ci.clone().lerp(cj, t);
      face_B.vertexColors[a_ind] = face_A.vertexColors[b_ind] = ck;
    }

    // interpolate uv
    if ( face.vertexUvs )
      for ( let l=0; l<face.vertexUvs.length; l++ )
        if ( face.vertexUvs[l] && face.vertexUvs[l].length ) {
          let uvli = face.vertexUvs[l][a_ind];
          let uvlj = face.vertexUvs[l][b_ind];
          let uvlk = uvli.clone().lerp(uvlj, t);
          face_B.vertexUvs[l][a_ind] = face_A.vertexUvs[l][b_ind] = uvlk;
        }

    return [face_A, face_B];
  }
  // interpolate `geometry` at edge `(face,edge)`
  // new faces will be insert after splited faces
  // return the new faces splited out of `face` and its dual
  static interpolateAtEdge(geometry, face, edge, t, k) {
    var [adjFace, adjEdge] = [face[edge], face.adj[edge]];

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
    var [face_A, face_B] = this._split_face(face, edge, t, k);
    geometry.faces.splice(geometry.faces.indexOf(face), 1, face_A, face_B);

    for ( let i=0; i<geometry.boundaries.length; i++ )
      if ( geometry.boundaries[i][0] === face ) {
        if ( geometry.boundaries[i][1] == edge )
          geometry.boundaries.splice(i, 1, [face_A, edge], [face_B, edge]);
        else if ( geometry.boundaries[i][1] == EDGES_NEXT[edge] )
          geometry.boundaries.splice(i, 1, [face_B, EDGES_NEXT[edge]]);
        else if ( geometry.boundaries[i][1] == EDGES_PREV[edge] )
          geometry.boundaries.splice(i, 1, [face_A, EDGES_PREV[edge]]);
        else
          console.assert(false);
      }

    if ( !adjFace )
      return [face_A, face_B];

    // split adjacent face
    var [adjFace_A, adjFace_B] = this._split_face(adjFace, adjEdge, 1-t, k);
    geometry.faces.splice(geometry.faces.indexOf(adjFace), 1, adjFace_A, adjFace_B);
    this.connect(face_A, edge, adjFace_B, adjEdge);
    this.connect(face_B, edge, adjFace_A, adjEdge);

    for ( let i=0; i<geometry.boundaries.length; i++ )
      if ( geometry.boundaries[i][0] === adjFace ) {
        if ( geometry.boundaries[i][1] == adjEdge )
          geometry.boundaries.splice(i, 1, [adjFace_A, adjEdge], [adjFace_B, adjEdge]);
        else if ( geometry.boundaries[i][1] == EDGES_NEXT[adjEdge] )
          geometry.boundaries.splice(i, 1, [adjFace_B, EDGES_NEXT[adjEdge]]);
        else if ( geometry.boundaries[i][1] == EDGES_PREV[adjEdge] )
          geometry.boundaries.splice(i, 1, [adjFace_A, EDGES_PREV[adjEdge]]);
        else
          console.assert(false);
      }

    return [face_A, face_B, adjFace_A, adjFace_B];
  }
  // slice `geometry` by `plane`
  // in-place modify `geometry` as positive side, and modify `geometry_back` as negative side
  static slice(geometry, plane, geometry_back, label, label_back=label) {
    plane = new THREE.Plane().copy(plane);

    var dis = geometry.vertices.map(v => plane.distanceToPoint(v));
    var sgn = dis.map(d => defaultFuzzyTool.sign(d));

    // split edge
    // notice: `geometry.faces` will be modified in method `interpolateAtEdge`,
    //   but it's easy to prove that processed edges are no need to process agian
    for ( let n=0; n<geometry.faces.length; n++ ) for ( let edge of EDGES ) {
      let face = geometry.faces[n];
      let i = face[edge[0]];
      let j = face[edge[1]];

      if ( sgn[i] * sgn[j] < 0 ) {
        // interpolation
        let t = dis[i]/(dis[i]-dis[j]);
        let vi = geometry.vertices[i];
        let vj = geometry.vertices[j];
        let vk = vi.clone().lerp(vj, t);
        let k = geometry.vertices.push(vk)-1;
        dis.push(0);
        sgn.push(0);

        this.interpolateAtEdge(geometry, face, edge, t, k);
      }
    }

    // determine side of faces respect to cut plane
    const SIDE = Symbol("SIDE");
    const FRONT = Symbol("SIDE.FRONT");
    const BACK = Symbol("SIDE.BACK");
    
    for ( let face of geometry.faces ) {
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
    
    // unlink edge between two sides
    var front_bd = [];
    var back_bd  = [];

    for ( let face of geometry.faces ) if ( face[SIDE] === FRONT ) for ( let edge of EDGES ) {
      if ( face[edge] && face[SIDE] !== face[edge][SIDE] ) {
        let adjFace = face[edge];
        let adjEdge = face.adj[edge];
        this.connect(face, edge);
        this.connect(adjFace, adjEdge);
        front_bd.push([face, edge]);
        back_bd.push([adjFace, adjEdge]);
        if ( label !== undefined ) {
          face.labels[edge] = label;
          adjFace.labels[adjEdge] = label_back;
        }
      }
    }

    var vertices = geometry.vertices.slice(0);
    var front_faces = geometry.faces.filter(face => face[SIDE] === FRONT);
    var back_faces  = geometry.faces.filter(face => face[SIDE] === BACK );
    front_bd.push(...geometry.boundaries.filter(([face, edge]) => face[SIDE] === FRONT));
    back_bd.push( ...geometry.boundaries.filter(([face, edge]) => face[SIDE] === BACK ));

    for ( let face of geometry.faces )
      delete face[SIDE];
    
    // split geometry into `geometry` and `geometry_back`
    geometry.vertices = vertices;
    geometry.faces = front_faces;
    geometry.boundaries = front_bd;
    this.trimVertices(geometry);

    if ( geometry_back !== undefined ) {
      geometry_back.name = geometry.name;
      geometry_back.nlayer = geometry.nlayer;

      geometry_back.vertices = vertices;
      geometry_back.faces = back_faces;
      geometry_back.boundaries = back_bd;
      this.trimVertices(geometry_back);

      geometry_back.flying = true;
    }
  }
  static walkAlongBoundaries(geometry) {
    var loops = [];
    var boundaries = geometry.boundaries.slice(0);

    while ( boundaries.length > 0 ) {
      let loop = [];

      let [face, edge] = boundaries[0];
      while ( removeFirst(boundaries, ([f,e]) => f===face && e==edge) ) {
        loop.push([face, edge]);
        while ( face[EDGES_NEXT[edge]] !== undefined )
          [face, edge] = [face[EDGES_NEXT[edge]], face.adj[EDGES_NEXT[edge]]];
        edge = EDGES_NEXT[edge];
      }
      loops.push(loop);
    }
    return loops;
  }
  static boundariesLoopsOf(faces) {
    var boundaries = [];
    for ( let face of faces ) for ( let edge of EDGES )
      if ( !face[edge] || !faces.includes(face[edge]) )
        boundaries.push([face, edge]);

    var loops = [];
    while ( boundaries.length > 0 ) {
      let loop = [];

      let [face, edge] = boundaries[0];
      while ( removeFirst(boundaries, ([f,e]) => f===face && e==edge) ) {
        loop.push([face, edge]);
        while ( faces.includes(face[EDGES_NEXT[edge]]) )
          [face, edge] = [face[EDGES_NEXT[edge]], face.adj[EDGES_NEXT[edge]]];
        edge = EDGES_NEXT[edge];
      }
      loops.push(loop);
    }
    return loops;
  }
  static fillHoles(geometry, plane, labels) {
    // offset and rotation to plane
    var offset = plane.normal.clone().multiplyScalar(-plane.constant);
    var {phi, theta} = new THREE.Spherical().setFromVector3(plane.normal);
    var rot = new THREE.Quaternion().setFromAxisAngle({x:-Math.cos(theta), y:0, z:Math.sin(theta)}, phi);

    // project vertices onto the plane
    var points = {};
    for ( let [face, edge] of geometry.boundaries )
      for ( let i of [face[edge[0]], face[edge[1]]] )
        if ( points[i] === undefined ) {
          let v = geometry.vertices[i].clone();
          v.sub(offset).applyQuaternion(rot);
          points[i] = new THREE.Vector2(v.z, v.x);
        }

    // fill holes
    var loops = this.walkAlongBoundaries(geometry);
    geometry.boundaries = [];
    var normal = plane.normal.clone();

    // only valid for convex holes
    for ( let loop of loops ) {
      // make face to fill the hole
      while ( loop.length >= 3 ) {
        let [face_cb, bd_cb] = loop.shift();
        let [face_ba, bd_ba] = loop.shift();

        let i = face_ba[bd_ba[1]];
        let j = face_cb[bd_cb[1]];
        let k = face_cb[bd_cb[0]];

        let face_ca = new THREE.Face3(i, j, k, normal);
        face_ca.labels = {};
        face_ca.vertexUvs = [];
        face_ca.adj = {};

        Object.assign(face_ca.labels, labels);
        let bd_ca = "ca";
        this.connect(face_ca, "ab", face_ba, bd_ba);
        this.connect(face_ca, "bc", face_cb, bd_cb);
        geometry.faces.push(face_ca);
    
        // remains.unshift([face_ca, bd_ca]); // fan-like filling
        loop.push([face_ca, bd_ca]); // rose-like filling
      }

      if ( loop.length === 2 ) {
        this.connect(...loop[0], ...loop[1]);
      } else {
        throw "???";
      }
    }
    
    // for ( let loop of loops ) {
    //   // make face to fill the hole
    //   for ( let count=loop.length*(loop.length-1)/2; loop.length>=3 && count>0; count-- ) {
    //     let [[face_cb, bd_cb], [face_ba, bd_ba], ...remains] = loop;
    // 
    //     let i = face_ba[bd_ba[1]];
    //     let j = face_cb[bd_cb[1]];
    //     let k = face_cb[bd_cb[0]];
    // 
    //     // angle ijk
    //     let angle_ji = points[i].clone().sub(points[j]).angle()*2/Math.PI;
    //     let angle_jk = points[k].clone().sub(points[j]).angle()*2/Math.PI;
    //     let angle_ijk = ((angle_ji - angle_jk) % 4 + 4) % 4;
    //     if ( defaultFuzzyTool.greater_than(angle_ijk, 2) ) {
    //       loop.push(loop.shift());
    //       continue;
    //     }
    // 
    //     let face_ca = new THREE.Face3(i, j, k, normal);
    //     face_ca.labels = {};
    //     face_ca.vertexUvs = [];
    //     face_ca.adj = {};
    //     Object.assign(face_ca.labels, labels);
    //     let bd_ca = "ca";
    //     this.connect(face_ca, "ab", face_ba, bd_ba);
    //     this.connect(face_ca, "bc", face_cb, bd_cb);
    //     geometry.faces.push(face_ca);
    // 
    //     // remains.unshift([face_ca, bd_ca]); // fan-like filling
    //     remains.push([face_ca, bd_ca]); // rose-like filling
    //     loop = remains;
    //   }
    // 
    //   if ( loop.length >= 3 ) {
    //     console.log(loop.map(([f,e]) => geometry.vertices[f[e[0]]]));
    //     throw "unterminated loop";
    //   } else if ( loop.length === 2 ) {
    //     this.connect(...loop[0], ...loop[1]);
    //   } else {
    //     throw "???";
    //   }
    // }
  }

  // merge two geometries
  static merge(geometry, merged, matrix, materialIndexOffset) {
    const origin_len = geometry.faces.length;
    geometry.merge(merged, matrix, materialIndexOffset);
  
    var origin_faces = geometry.faces.slice(0, origin_len);
    var merged_faces = geometry.faces.slice(origin_len);
    var merged_boundary = this.copyFaces(origin_faces, merged_faces);
  
    geometry.boundaries = this.boundariesIn(geometry);
  
    // this.reduceVertices(geometry);
    // this.reduceFaces(geometry);
    // this.regularization(geometry);
    // this.trimVertices(geometry);
  }
  // merge duplicated (or similar) vertices and sew boundaries caused by merging
  static reduceVertices(geometry, snap=true, sew=true) {
    var vec_hash = snap
                 ? v => v.toArray().map(x => defaultFuzzyTool.toString(x)).join()
                 : v => geometry.vertices.indexOf(v);
    var vertices_hashmap = {}; // hash of vertex -> index of merged vertex
    var merged_vertices = [];
    var merged_vertices_map = {}; // original index of vertex -> index of merged vertex
    var duplicated = {}; // index of merged vertex -> if vertex is duplicated
    var sewable = [];

    // merge duplicated vertices
    for ( let i=0, len=geometry.vertices.length; i<len; i++ ) {
      let hash = vec_hash(geometry.vertices[i]);
      let new_index = vertices_hashmap[hash];

      if ( new_index === undefined ) {
        new_index = merged_vertices.push(geometry.vertices[i])-1;
        vertices_hashmap[hash] = new_index;
        merged_vertices_map[i] = new_index;
  
      } else {
        merged_vertices_map[i] = new_index;
        duplicated[new_index] = true;
      }
    }

    // merge vertices of faces
    for ( let face of geometry.faces ) {
      face.a = merged_vertices_map[face.a];
      face.b = merged_vertices_map[face.b];
      face.c = merged_vertices_map[face.c];
    }

    if ( sew ) {
      // find sewable boundaries, which are non-trivial boundaries containing duplicated vertex
      for ( let face of geometry.faces )
        for ( let edge of EDGES ) if ( !face[edge] )
          if ( face[edge[0]] !== face[edge[1]] )
            if ( duplicated[face[edge[0]]] || duplicated[face[edge[1]]] )
              sewable.push([face, edge]);
  
      // sew edges of duplicated vertices
      for ( let [[face1, edge1], [face2, edge2]] of comb2(sewable) )
        if ( !face1[edge1] && !face2[edge2] )
          if ( this.areAdjacent(face1, edge1, face2, edge2) ) {
            removeFirst(geometry.boundaries, ([f,e]) => f===face1 && e==edge1);
            removeFirst(geometry.boundaries, ([f,e]) => f===face2 && e==edge2);
            this.connect(face1, edge1, face2, edge2);
          }
    }
  
    geometry.vertices = merged_vertices;
  }
  // merge trivial edges and trivial faces
  static reduceFaces(geometry) {
    var merged_faces = [];
  
    for ( let face of geometry.faces ) {
      if ( EDGES.every(edge => face[edge[0]] !== face[edge[1]]) ) {
        // non-trivial face
        merged_faces.push(face);
  
      } else if ( EDGES.every(edge => face[edge[0]] === face[edge[1]]) ) {
        // trivial face with three trivial edges
        for ( let edge of EDGES ) {
          if ( !face[edge] )
            removeFirst(geometry.boundaries, ([f,e]) => f===face && e==edge);
        }
  
      } else {
        // trivial face with one trivial edge
        for ( let edge of EDGES ) if ( face[edge[0]] === face[edge[1]] ) { // find trivial edge
          var [face_next, edge_next] = [face[EDGES_NEXT[edge]], face.adj[EDGES_NEXT[edge]]];
          var [face_prev, edge_prev] = [face[EDGES_PREV[edge]], face.adj[EDGES_PREV[edge]]];

          if ( face_next && face_prev )
            this.connect(face_next, edge_next, face_prev, edge_prev);
          else if ( face_next )
            geometry.boundaries.push(...this.connect(face_next, edge_next));
          else if ( face_prev )
            geometry.boundaries.push(...this.connect(face_prev, edge_prev));

          for ( let edge_ of EDGES ) if ( !face[edge_] )
            removeFirst(geometry.boundaries, ([f,e]) => f===face && e==edge_);

          break;
        }
      }
    }
  
    geometry.faces = merged_faces;
  }
  // // merge gapless pairs of faces and separate gapless edges
  // static regularization(geometry) {
  //   var face_hashmap = {}; // hash of vertices of face -> [face, sorted_edges, parity]
  //   function face_hash(face) {
  //     var edges = EDGES.slice(0);
  //     edges.sort((e1, e2) => face[EDGES_DUAL[e1]] - face[EDGES_DUAL[e2]]);
  //     var parity = edges[0][1] == edges[1][0] ? 0 : 1; // parity of permutation
  //     return [edges.map(e => face[EDGES_DUAL[e]]).join(), edges, parity];
  //   }
  // 
  //   // remove gapless pair of faces
  //   for ( let face of geometry.faces ) {
  //     let [hash, edges, parity] = face_hash(face);
  //     if ( face_hashmap[hash] === undefined ) {
  //       face_hashmap[hash] = [face, edges, parity];
  // 
  //     } else {
  //       let [anti_face, anti_edges, anti_parity] = face_hashmap[hash];
  //       console.assert(anti_parity !== parity);
  // 
  //       // merge links
  //       for ( let [edge, anti_edge] of zip(edges, anti_edges) )
  //         if ( face[edge].dual !== anti_face[anti_edge] )
  //           face[edge].merge(anti_face[anti_edge]);
  // 
  //       delete face_hashmap[hash];
  //     }
  //   }
  // 
  //   geometry.faces = [...face_hashmap.values()];
  // 
  //   var tab_hashmap = {}; // hash of vertices of edge -> set of tabs
  //   function tab_hash(tab) {
  //     var a = tab.face[tab.edge[0]];
  //     var b = tab.face[tab.edge[1]];
  //     if ( a > b )
  //       return tab_hash(tab.face[tab.edge]);
  //     else
  //       return [a+","+b, tab];
  //   }
  // 
  //   // find meeting edges
  //   for ( let face of geometry.faces ) for ( let edge of EDGES ) if ( face[edge].isEdge ) {
  //     let [hash, tab] = tab_hash(face[edge]);
  //     if ( tab_hashmap[hash] === undefined )
  //       tab_hashmap[hash] = new Set([]);
  //     tab_hashmap[hash].add(tab);
  //   }
  // 
  //   // separate gapless edges
  //   const LEFT = Symbol("LEFT");
  //   const RIGHT = Symbol("RIGHT");
  // 
  //   for ( let tabs of tab_hashmap ) if ( tabs.size() > 1 ) {
  //     let tab0 = tabs.values().next().value;
  // 
  //     // rotate to align edge "ab" to axis +y
  //     let i = tab0.face[tab0.edge[0]];
  //     let j = tab0.face[tab0.edge[1]];
  //     let dir = new THREE.Vector3().subVectors(geometry.vertices[j], geometry.vertices[i]);
  //     let {phi, theta} = new THREE.Spherical().setFromVector3(dir);
  //     let rot = new THREE.Quaternion().setFromAxisAngle({x:-Math.cos(theta), y:0, z:Math.sin(theta)}, phi);
  // 
  //     let tabs_ = []; // list of tabs and its metadata: {tab, theta, side}
  //     for ( let tab of tabs ) {
  //       let normal = tab.face.normal.clone().applyQuaternion(rot);
  //       let theta = new THREE.Spherical().setFromVector3(normal).theta;
  //       tabs_.push({tab, theta, side:LEFT});
  // 
  //       let tab = tab.dual;
  //       normal = tab.face.normal.clone().negate().applyQuaternion(rot);
  //       theta = new THREE.Spherical().setFromVector3(normal).theta;
  //       tabs_.push({tab, theta, side:RIGHT});
  //     }
  // 
  //     tabs_.sort((a, b) => a.theta-b.theta);
  //     let prev_side = tabs_[tabs_.length-1].side;
  //     console.assert(tabs_.every(a => prev_side !== (prev_side = a.side)));
  // 
  //     if ( tabs_[0].side === LEFT )
  //         tabs_.push(tabs_.shift());
  //     for ( let i=0; i+1<tabs_.length; i+=2 )
  //       tabs_[i].tab.glue(tabs_[i+1].tab);
  //   }
  // }

  // divide faces triangly
  //   c
  //   |\
  //   |_\
  //   |\ |\
  //   |_\|_\
  //   |\ |\ |\
  //   |_\|_\|_\
  //  a         b
  static divideFaces(geometry, N=1) {
    // divide vertices
    var _cache = {};
    function _interpolate_vertices(i, j, t) {
      if ( i > j ) [i, j, t] = [j, i, N-t];
      if ( t === 0 ) return i;
      if ( t === N ) return j;
      if ( _cache[i+","+j+":"+t] !== undefined )
        return _cache[i+","+j+":"+t];

      var vi = geometry.vertices[i];
      var vj = geometry.vertices[j];
      var vk = vi.clone().lerp(vj, t/N);
      var k = geometry.vertices.push(vk)-1;
      _cache[i+","+j+":"+t] = k;
      return k;
    }
    function _divide_vertices(a, b, c) {
      var divided = Array.from({length: N+1}, (v, i) => new Array(N-i));
      for ( let nx=0; nx<=N; nx++ ) for ( let ny=0; ny<=N-nx; ny++ ) {
        if ( ny === 0 )
          divided[nx][ny] = _interpolate_vertices(a, b, nx);
        else if ( nx === 0 )
          divided[nx][ny] = _interpolate_vertices(a, c, ny);
        else if ( nx + ny === N )
          divided[nx][ny] = _interpolate_vertices(b, c, ny);
        else {
          let dx = geometry.vertices[b].clone().sub(geometry.vertices[a]).multiplyScalar(nx/N);
          let dy = geometry.vertices[c].clone().sub(geometry.vertices[a]).multiplyScalar(ny/N);
          let v = geometry.vertices[a].clone().add(dx).add(dy);
          divided[nx][ny] = geometry.vertices.push(v)-1;
        }
      }
      return divided;
    }
    function _divide_triangly(a, b, c) {
      var divided = Array.from({length: N+1}, (v, i) => new Array(N-i));
      for ( let nx=0; nx<=N; nx++ ) for ( let ny=0; ny<=N-nx; ny++ ) {
        if ( nx === 0 && ny === 0 )
          divided[nx][ny] = a;
        else if ( nx === N && ny === 0 )
          divided[nx][ny] = b;
        else if ( nx === 0 && ny === N )
          divided[nx][ny] = c;
        else {
          let dx = b.clone().sub(a).multiplyScalar(nx/N);
          let dy = c.clone().sub(a).multiplyScalar(ny/N);
          divided[nx][ny] = a.clone().add(dx).add(dy);
        }
      }
      return divided;
    }

    var faces = geometry.faces;
    geometry.faces = [];

    for ( let face of faces ) {
      // interpolate vertices, normals, colors and uvs
      var divided_vertices = _divide_vertices(face.a,
                                              face.b,
                                              face.c);
      if ( face.vertexNormals.length )
        var divided_normals = _divide_triangly(face.vertexNormals[0],
                                               face.vertexNormals[1],
                                               face.vertexNormals[2]);
      if ( face.vertexColors.length )
        var divided_colors = _divide_triangly(face.vertexColors[0],
                                              face.vertexColors[1],
                                              face.vertexColors[2]);
      var divided_vertexUvs = [];
      if ( face.vertexUvs )
        for ( let l=0; l<face.vertexUvs.length; l++ )
          if ( face.vertexUvs[l] && face.vertexUvs[l].length )
            divided_vertexUvs[l] = _divide_triangly(face.vertexUvs[l][0],
                                                    face.vertexUvs[l][1],
                                                    face.vertexUvs[l][2]);

      // build faces and connect them
      let divided_faces = Array.from({length: N}, (v, i) => new Array(N-i));
      for ( let nx=0; nx<N; nx++ ) for ( let ny=0; ny<N-nx; ny++ ) {
        divided_faces[nx][ny] = [];

        // build face abc
        let face1 = face.clone();
        face1.labels = {};
        face1.vertexUvs = [];
        face1.adj = {};
        [face1.a, face1.b, face1.c] = [divided_vertices[nx][ny],
                                       divided_vertices[nx+1][ny],
                                       divided_vertices[nx][ny+1]];
        if ( divided_normals )
          face1.vertexNormals = [divided_normals[nx][ny].clone(),
                                 divided_normals[nx+1][ny].clone(),
                                 divided_normals[nx][ny+1].clone()];
        if ( divided_colors )
          face1.vertexColors = [divided_colors[nx][ny].clone(),
                                divided_colors[nx+1][ny].clone(),
                                divided_colors[nx][ny+1].clone()];
        face1.vertexUvs = [];
        for ( let l=0; l<divided_vertexUvs.length; l++ )
          if ( divided_vertexUvs[l] && divided_vertexUvs[l].length )
            face1.vertexUvs[l] = [divided_vertexUvs[l][nx][ny].clone(),
                                  divided_vertexUvs[l][nx+1][ny].clone(),
                                  divided_vertexUvs[l][nx][ny+1].clone()];
        divided_faces[nx][ny].push(face1);
        geometry.faces.push(face1);

        // build face dcb
        let face2;
        if ( nx + ny < N-1 ) {
          face2 = face.clone();
          face2.labels = {};
          face2.vertexUvs = [];
          face2.adj = {};
          [face2.a, face2.b, face2.c] = [divided_vertices[nx+1][ny+1],
                                         divided_vertices[nx][ny+1],
                                         divided_vertices[nx+1][ny]];
          if ( divided_normals )
            face2.vertexNormals = [divided_normals[nx+1][ny+1].clone(),
                                   divided_normals[nx][ny+1].clone(),
                                   divided_normals[nx+1][ny].clone()];
          if ( divided_colors )
            face2.vertexColors = [divided_colors[nx+1][ny+1].clone(),
                                  divided_colors[nx][ny+1].clone(),
                                  divided_colors[nx+1][ny].clone()];
          face2.vertexUvs = [];
          for ( let l=0; l<divided_vertexUvs.length; l++ )
            if ( divided_vertexUvs[l] && divided_vertexUvs[l].length )
              face2.vertexUvs[l] = [divided_vertexUvs[l][nx+1][ny+1].clone(),
                                    divided_vertexUvs[l][nx][ny+1].clone(),
                                    divided_vertexUvs[l][nx+1][ny].clone()];
          divided_faces[nx][ny].push(face2);
          geometry.faces.push(face2);
        }

        // connect adjacent faces
        if ( nx + ny < N-1 )
          this.connect(face1, "bc", face2, "bc");
        if ( nx > 0 )
          this.connect(face1, "ca", divided_faces[nx-1][ny][1], "ca");
        if ( ny > 0 )
          this.connect(face1, "ab", divided_faces[nx][ny-1][1], "ab");
      }

      face.divided = {
        ca: Array.from({length: N}, (v, i) => divided_faces[0][N-1-i][0]),
        ab: Array.from({length: N}, (v, i) => divided_faces[i][0][0]),
        bc: Array.from({length: N}, (v, i) => divided_faces[N-1-i][i][0]),
      };
    }

    // reconnect divided faces
    geometry.boundaries = [];

    for ( let face of faces ) for ( let edge of EDGES ) {
      let adjFace = face[edge];
      let adjEdge = face.adj[edge];

      if ( adjFace ) {
        if ( face.divided[edge] ) {
          for ( let z=0; z<N; z++ ) {
            let facez = face.divided[edge][z];
            let adjFacez = adjFace.divided[adjEdge][N-1-z];
            this.connect(facez, edge, adjFacez, adjEdge);
          }
          delete face.divided[edge];
          delete adjFace.divided[adjEdge];
        }

      } else {
        for ( let z=0; z<N; z++ ) {
          let facez = face.divided[edge][z];
          geometry.boundaries.push([facez, edge]);
        }
        delete face.divided[edge];
      }
    }
  }

  static makeEdgeHelper(geometry, face, edge) {
    var v1 = geometry.vertices[face[edge[0]]];
    var v2 = geometry.vertices[face[edge[1]]];
    var dir = new THREE.Vector3().subVectors(v2, v1);
    var len = dir.length();
    var head = 0.05<0.4*len ? 0.05 : 0.4*len;
    var arrow = new THREE.ArrowHelper(dir.normalize(), v1, len, 0xff0000, head);
    return arrow;
  }
}

