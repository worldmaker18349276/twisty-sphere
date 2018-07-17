// ########  #######   #######  ##       
//    ##    ##     ## ##     ## ##       
//    ##    ##     ## ##     ## ##       
//    ##    ##     ## ##     ## ##       
//    ##    ##     ## ##     ## ##       
//    ##    ##     ## ##     ## ##       
//    ##     #######   #######  ######## 

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


//  ######   ########  #######  
// ##    ##  ##       ##     ## 
// ##        ##       ##     ## 
// ##   #### ######   ##     ## 
// ##    ##  ##       ##     ## 
// ##    ##  ##       ##     ## 
//  ######   ########  #######  


const VERTICES = ["a", "b", "c"];
const EDGES = ["ca", "ab", "bc"];
const EDGES_DUAL = {ca:"b", ab:"c", bc:"a"};
const EDGES_NEXT = {ca:"ab", ab:"bc", bc:"ca"};
const EDGES_PREV = {ca:"bc", ab:"ca", bc:"ab"};

const LINK = Object.freeze({
  BOUNDARY: Symbol("LINK.BOUNDARY"),
  EDGE: Symbol("LINK.EDGE"), // flat, convax or concave
  FLAT: Symbol("LINK.FLAT"),
  CONVAX: Symbol("LINK.CONVAX"),
  CONCAVE: Symbol("LINK.CONCAVE"),
});

class LinkedFaces
{
  // link = {face, edge, type, label}
  // types and labels of dual links should be same.

  // make link `face[edge]` and `adjFace[adjEdge]` with type and set label
  // not in-place modification of link
  // return new links `face[edge]` and `adjFace[adjEdge]`
  static link(face, edge, adjFace, adjEdge, {type, label}={}) {
    if ( type === undefined ) {
      if ( adjFace !== undefined )
        type = LINK.EDGE;
      else
        type = LINK.BOUNDARY;
    }

    if ( type !== LINK.BOUNDARY ) {
      face[edge] = {face:adjFace, edge:adjEdge, type, label};
      adjFace[adjEdge] = {face:face, edge:edge, type, label};

      return [adjFace[adjEdge], face[edge]];

    } else if ( adjFace !== undefined ) {
      face[edge] = {face:face, edge:edge, type, label};
      adjFace[adjEdge] = {face:adjFace, edge:adjEdge, type, label};

      return [face[edge], adjFace[adjEdge]];

    } else {
      face[edge] = {face:face, edge:edge, type, label};

      return [face[edge]];
    }
  }
  // make link `face[edge]` and its adjacent link with type=LINK.BOUNDARY and set (or inherent) label
  // if `face[edge]` is boundary link, this method also work
  // not in-place modification of link
  // return new links `face[edge]` and `adjFace[adjEdge]`
  static unlink(face, edge, {label}={}) {
    if ( face[edge] ) {
      var {face:adjFace, edge:adjEdge, label:adjLabel=label} = face[edge];
      face[edge] = {face:face, edge:edge, type:LINK.BOUNDARY, label:adjLabel};
      adjFace[adjEdge] = {face:adjFace, edge:adjEdge, type:LINK.BOUNDARY, label:adjLabel};
      return [face[edge], adjFace[adjEdge]];

    } else {
      face[edge] = {face:face, edge:edge, type:LINK.BOUNDARY, label};
      return [face[edge]];
    }
  }
  // link each edge by checking vertices, and return boundaries
  static buildLinks(faces) {
    for ( let face of faces ) for ( let edge of EDGES )
      delete face[edge];

    // link adjacent faces
    for ( let [face1, face2] of comb2(faces) ) for ( let [edge1, edge2] of zip(EDGES, EDGES) ) {
      let v1a = face1[edge1[0]];
      let v1b = face1[edge1[1]];
      let v2a = face2[edge2[0]];
      let v2b = face2[edge2[1]];
      if ( v1a === v2b && v1b === v2a )
        this.link(face1, edge1, face2, edge2);
    }

    // make boundary link
    var boundary = new Set();
    for ( let face of faces ) for ( let edge of EDGES )
      if ( !(edge in face) ) {
        boundary.add(LinkedFaces.unlink(face, edge)[0]);
      }

    return boundary;
  }

  static * walk(faces, filter=function(f){return true;}) {
    var mark = Symbol("DFS");
    var fork = faces.slice(0);

    while ( fork.length ) {
      let face = fork.pop();

      if ( face[mark] || !filter(face) )
        continue;

      yield face;
      face[mark] = true;
      for ( let edge of EDGES )
        if ( !face[edge].face[mark] )
          stack.push(face[edge].face);
    }
  }
  static clean_footprints(faces) {
    for ( let face of faces )
      for ( let sym of Object.getOwnPropertySymbols(face) )
        if ( sym.toString() == "Symbol(DFS)" )
          delete face[sym];
  }

  static boundaryOf(faces) {
    var boundary = new Set();
    for ( let face of faces ) for ( let edge of EDGES ) if ( face[edge].type === LINK.BOUNDARY )
      boundary.add(face[edge]);
    return boundary;
  }
  static next_boundary(bd) {
    while ( (bd = bd.face[EDGES_NEXT[bd.edge]]).type !== LINK.BOUNDARY );
    return bd;
  }
  static prev_boundary(bd) {
    while ( (bd = bd.face[EDGES_PREV[bd.edge]]).type !== LINK.BOUNDARY );
    return bd;
  }

  static trim(faces) {
    faces = new Set(faces);
    var openingEdges = [];

    for ( let face of faces ) for ( let edge of EDGES ) {
      let {face:adjFace, edge:adjEdge} = face[edge];
      if ( !faces.has(adjFace) )
        openingEdges.push(this.unlink(face, edge));
    }

    return openingEdges;
  }
  static merge(faces1, faces2) {
    var closingEdges = [];
  
    for ( let face1 of faces1 ) for ( let edge1 of EDGES )
      for ( let face2 of faces2 ) for ( let edge2 of EDGES )
        if ( face1[edge1].type === LINK.BOUNDARY && face2[edge2].type === LINK.BOUNDARY ) {
          let v1a = face1[edge1[0]];
          let v1b = face1[edge1[1]];
          let v2a = face2[edge2[0]];
          let v2b = face2[edge2[1]];
          if ( v1a === v2b && v1b === v2a )
            closingEdges.push(this.link(face1, edge1, face2, edge2));
        }
  
    return closingEdges;
  }
}

class Geometer
{
  // modify structure of Face3 for convenience
  static fly(geometry) {
    var uvs = geometry.faceVertexUvs;
    geometry.nlayer = geometry.faceVertexUvs.length;

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

    geometry.faceVertexUvs = [[]];

    geometry.boundary = LinkedFaces.buildLinks(geometry.faces);
  }
  static land(geometry) {
    var uvs = geometry.faceVertexUvs = [];
    for ( let l=0; l<geometry.nlayer; l++ )
      uvs[l] = [];

    for ( let x in geometry.faces ) {
      let face = geometry.faces[x];

      for ( let edge of EDGES )
        delete face[edge];

      if ( face.normals )
        face.vertexNormals = [face.normals.a, face.normals.b, face.normals.c];
      delete face.normals;

      if ( face.colors )
        face.vertexColors = [face.colors.a, face.colors.b, face.colors.c];
      delete face.colors;

      if ( face.uvs ) for ( let l=0; l<geometry.nlayer; l++ ) {
        let uv = face.uvs[l];
        if ( uv && uv.length )
          uvs[l][x] = {a:uv[0], b:uv[1], c:uv[2]};
      }
      delete face.uvs;
    }
  }

  // shallow copy modified structure {normals, colors, uvs}
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
    if ( face.uvs ) for ( let l=0; l<face.uvs.length; l++ ) if ( face.uvs[l] ) {
      copied.uvs[l] = {
        a: face.uvs[l].a,
        b: face.uvs[l].b,
        c: face.uvs[l].c,
      };
    }

    return copied;
  }
  static copyFaces(faces, copied_faces=faces.map(face=>new THREE.Face3().copy(face))) {
    var boundary = new Set();

    for ( let [face, copied_face] of zip(faces, copied_faces) ) {
      this.copyFace(face, copied_face);

      // transfer link
      for ( let edge of EDGES ) {
        let {face:adjFace, edge:adjEdge, type, label} = face[edge];
        adjFace = copied.faces[geometry.faces.indexOf(adjFace)];
        copied_face[edge] = {face:adjFace, edge:adjEdge, type, label};

        // rebuild boundary
        if ( type === LINK.BOUNDARY )
          copied.boundary.add(face[edge]);
      }
    }

    return boundary;
  }
  static copy(geometry, copied=geometry.clone()) {
    copied.nlayer = geometry.nlayer;
    copied.boundary = copyFaces(geometry.faces, copied.faces);
    return copied;
  }
  static computeEdgeType(geometry) {
    var vertices = geometry.vertices;
    for ( let face of geometry.faces ) for ( let edge of EDGES ) if ( face[edge].type === LINK.EDGE ) {
      let adj = face[edge];
      let v1 = new THREE.Vector3().subVectors(vertices[face[edge[0]]], vertices[face[edge[1]]]).normalize();
      let v2 = new THREE.Vector3().crossVectors(face.normal, adj.face.normal).normalize();
      let sgn = Math.sign(v1.dot(v2));
      adj.type = adj.face[adj.edge].type = {[0]:LINK.FLAT, [1]:LINK.CONVAX, [-1]:LINK.CONCAVE}[sgn];
    }
  }


  // merge two geometries
  static merge(geometry, merged, matrix, materialIndexOffset) {
    const origin_len = geometry.faces.length;
    geometry.merge(merged, matrix, materialIndexOffset);

    var origin_faces = geometry.faces.slice(0, origin_len);
    var merged_faces = geometry.faces.slice(origin_len);
    var merged_boundary = copyFaces(origin_faces, merged_faces);

    for ( let bd of merged_boundary )
      geometry.boundary.add(bd);

    this.reduceVertices(geometry);
    this.reduceFaces(geometry);
    this.regularization(geometry);
    this.trimVertices(geometry);
  }
  // merge duplicated (or similar) vertices and sew edges caused by merging
  static reduceVertices(geometry, snap=true, sew_edges=true) {
    var vec_hash = snap
                 ? v => v.toArray().map(x => defaultFuzzyTool.toString(x)).join()
                 : v => geometry.vertices.indexOf(v);
    var vertices_hashmap = {}; // hash of vertex -> index of merged vertex
    var merged_vertices = [];
    var merged_vertices_map = {}; // original index of vertex -> index of merged vertex
    var duplicated = {}; // index of merged vertex -> if vertex is duplicated
    var sewable_edges = [];

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
    // find sewable edges by pass, which is non-trivial boundary containing duplicated vertex
    for ( let face of geometry.faces ) {
      face.a = merged_vertices_map[face.a];
      face.b = merged_vertices_map[face.b];
      face.c = merged_vertices_map[face.c];

      if ( sew_edges )
        for ( let edge of EDGES ) if ( face[edge].type === LINK.BOUNDARY )
          if ( face[edge[0]] !== face[edge[1]] )
            if ( duplicated[face[edge[0]]] || duplicated[face[edge[1]]] )
              sewable_edges.push([face, edge]);
    }

    // sew edges of duplicated vertices
    if ( sew_edges )
      for ( let [[face1, edge1], [face2, edge2]] of comb2(sewable_edges) )
        if ( face1[edge1].type === LINK.BOUNDARY && face2[edge2].type === LINK.BOUNDARY ) {
          let v1a = face1[edge1[0]];
          let v1b = face1[edge1[1]];
          let v2a = face2[edge2[0]];
          let v2b = face2[edge2[1]];

          if ( v1a === v2b && v1b === v2a ) {
            geometry.boundary.delete(face1[edge1]);
            geometry.boundary.delete(face2[edge2]);
            LinkedFaces.link(face1, edge1, face2, edge2);
          }
        }

    geometry.vertices = merged_vertices;
  }
  // merge two link induced by merging faces
  // TODO: merge label of two edges
  static _mergeLink(link1, link2) {
    if ( link1.type !== LINK.BOUNDARY && link2.type !== LINK.BOUNDARY ) {
      LinkedFaces.link(link1.face, link1.edge, link2.face, link2.edge);

    } else if ( link1.type === LINK.BOUNDARY && link2.type !== LINK.BOUNDARY ) {
      let bd = LinkedFaces.unlink(link2.face, link2.edge);
      geometry.boundary.delete(link1);
      geometry.boundary.add(bd);

    } else if ( link1.type !== LINK.BOUNDARY && link2.type === LINK.BOUNDARY ) {
      let bd = LinkedFaces.unlink(link1.face, link1.edge);
      geometry.boundary.delete(link2);
      geometry.boundary.add(bd);

    } else {
      geometry.boundary.delete(link1);
      geometry.boundary.delete(link2);
    }
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
        for ( let edge of EDGES )
          if ( face[edge].type === LINK.BOUNDARY )
            geometry.boundary.delete(face[edge]);

      } else {
        // trivial face with one trivial edge
        for ( let edge of EDGES ) if ( face[edge[0]] === face[edge[1]] ) { // find trivial edge
          if ( face[edge].type === LINK.BOUNDARY )
            geometry.boundary.delete(face[edge]);
          this._mergeLink(face[EDGES_NEXT[edge]], face[EDGES_PREV[edge]]);
          break;
        }
      }
    }

    geometry.faces = merged_faces;
  }
  // merge gapless pairs of faces and gapless edges
  static regularization(geometry) {
    var face_hashmap = {}; // hash of vertices of face -> [face, sorted_edges, parity]
    function face_hash(face) {
      var edges = EDGES.slice(0);
      edges.sort((e1, e2) => face[EDGES_DUAL[e1]] - face[EDGES_DUAL[e2]]);
      var parity = edges[0][1] == edges[1][0] ? 0 : 1; // parity of permutation
      return [edges.map(e => face[EDGES_DUAL[e]]).join(), edges, parity];
    }

    // remove gapless pair of faces
    for ( let face of geometry.faces ) {
      let [hash, edges, parity] = face_hash(face);
      if ( face_hashmap[hash] === undefined ) {
        face_hashmap[hash] = [face, edges, parity];

      } else {
        let [anti_face, anti_edges, anti_parity] = face_hashmap[hash];
        assert(anti_parity !== parity);

        // merge links
        for ( let [edge, anti_edge] of zip(edges, anti_edges) )
          if ( face[edge].face !== anti_face )
            this._mergeLink(face[edge], anti_face[anti_edge]);

        delete face_hashmap[hash];
      }
    }

    geometry.faces = [...face_hashmap.values()];

    var link_hashmap = {}; // hash of vertices of edge -> set of link
    function link_hash(link) {
      var a = link.face[link.edge[0]];
      var b = link.face[link.edge[1]];
      if ( a > b )
        return link_hash(link.face[link.edge]);
      else
        return [a+","+b, link];
    }

    // find meeting edges
    for ( let face of geometry.faces ) for ( let edge of EDGES ) if ( face[edge].type !== LINK.BOUNDARY ) {
      let [hash, link] = link_hash(face[edge]);
      if ( link_hashmap[hash] === undefined )
        link_hashmap[hash] = new Set([]);
      link_hashmap[hash].add(link);
    }

    // merge gapless edges
    const LEFT = Symbol("LEFT");
    const RIGHT = Symbol("RIGHT");

    for ( let links of link_hashmap ) of ( links.size() > 1 ) {
      let link0 = links.values().next().value;
      let i = link0.face[link0.edge[0]];
      let j = link0.face[link0.edge[1]];
      let dir = new THREE.Vector3().subVectors(geometry.vertices[j], geometry.vertices[i]).normalize();
      let {phi, theta} = new THREE.Spherical().setFromVector3(dir);
      let rot = new THREE.Quaternion().setFromAxisAngle({x:-Math.cos(theta), y:0, z:Math.sin(theta)}, phi);

      let links_ = [];
      for ( let link of links ) {
        let normal = link.face.normal.clone().applyQuaternion(rot);
        let {theta} = new THREE.Spherical().setFromVector3(normal);
        links_.push({link, theta, side:LEFT});

        let link = link.face[link.edge];
        normal = link.face.normal.clone().negate().applyQuaternion(rot);
        {theta} = new THREE.Spherical().setFromVector3(normal);
        links_.push({link, theta, side:RIGHT});
      }

      links_.sort((a, b) => a.theta-b.theta);
      let prev_side = links_[links_.length-1].side;
      console.assert(links_.every(a => prev_side !== (prev_side = a.side)));

      if ( links_[0].side === RIGHT )
          links_.push(links_.shift());
      for ( let i=0; i+1<links_.length; i+=2 ) {
        let {face:face1, edge:edge1} = links_[i];
        let {face:face2, edge:edge2} = links_[i+1];
        LinkedFaces.link(face1, edge1, face2, edge2, links_[i]);
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

  // split edge `face[edge]` with interpolation alpha `t` and vertex index `k`
  static _split_edge_onesided(face, edge, t, k) {
    // split face
    var splited_face = this.copyFace(face);
    face[edge[0]] = splited_face[edge[1]] = k;

    const next_edge = EDGES_NEXT[edge];
    const prev_edge = EDGES_PREV[edge];
    if ( face[prev_edge].type !== LINK.BOUNDARY ) {
      let adj = face[prev_edge];
      this.link(splited_face, prev_edge, adj.face, adj.edge, adj);
    }
    this.link(face, prev_edge, splited_face, next_edge, {type:LINK.FLAT});

    // interpolate normal
    if ( face.normals ) {
      let ni = face.normals[edge[0]];
      let nj = face.normals[edge[1]];
      let nk = ni.clone().lerp(nj, t);
      face.normals[edge[0]] = splited_face.normals[edge[1]] = nk;
    }

    // interpolate color
    if ( face.colors ) {
      let ci = face.colors[edge[0]];
      let cj = face.colors[edge[1]];
      let ck = ci.clone().lerp(cj, t);
      face.colors[edge[0]] = splited_face.colors[edge[1]] = ck;
    }

    // interpolate uv
    if ( face.uvs ) for ( let l=0; l<face.uvs.length; l++ ) if ( face.uvs[l] ) {
      var uvli = face.uvs[l][edge[0]];
      var uvlj = face.uvs[l][edge[1]];
      var uvlk = uvli.clone().lerp(uvlj, t);
      face.uvs[l][edge[0]] = splited_face.uvs[l][edge[1]] = uvlk;
    }

    return splited_face;
  }
  // split edge `face[edge]` and its dual
  static split_edge(geometry, face, edge, t, k) {
    // split face
    var splited_face = this._split_edge_onesided(face, edge, t, k);

    geometry.faces.splice(geometry.faces.indexOf(face)+1, 0, splited_face);

    var adj = face[edge];
    if ( adj.type === LINK.BOUNDARY ) {
      geometry.boundary.add(LinkedFaces.unlink(splited_face, edge, adj)[0]);
      return [splited_face];
    }

    // split adjacent face
    var splited_adjFace = this._split_edge_onesided(adj.face, adj.edge, t, k);
    this.link(face, edge, splited_adjFace, adj.edge, adj);
    this.link(splited_face, edge, adj.face, adj.edge, adj);

    geometry.faces.splice(geometry.faces.indexOf(adj.face)+1, 0, splited_adjFace);
    return [splited_face, splited_adjFace];
  }
  // split geometry by plane into two
  // in-place modify `geometry` as positive side, and return `splited` as negative side
  static split(geometry, plane) {
    plane = new THREE.Vector3().copy(plane);

    var vertices = geometry.vertices;
    var faces = geometry.faces;
    var boundary = geometry.boundary;

    var dis = vertices.map(v => plane.distanceToPoint(v));
    var sgn = dis.map(d => defaultFuzzyTool.sign(d));

    // split edge
    for ( let x=0; x<faces.length; x++ ) for ( let edge of EDGES ) {
      let face = faces[x]; // face may change during spliting
      let i = face[edge[0]];
      let j = face[edge[1]];

      if ( sgn[i] * sgn[j] < 0 ) {
        // interpolate vertex
        let t = dis[i]/(dis[i]-dis[j]);
        let vi = vertices[i];
        let vj = vertices[j];
        let vk = vi.clone().lerp(vj, t);
        let k = vertices.push(vk)-1;
        dis.push(0);
        sgn.push(0);

        this.split_edge(geometry, face, edge, t, k);
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
    geometry.boundary = new Set();
    var splited = this.copy(geometry);

    geometry.faces = faces.filter(face => face[SIDE] === FRONT);
    splited.faces = faces.filter(face => face[SIDE] === BACK);

    // unlink edge between two sides
    for ( let face of faces ) if ( face[SIDE] === FRONT ) for ( let edge of EDGES ) {
      if ( face[SIDE] !== face[edge].face[SIDE] )
        LinkedFaces.unlink(face, edge);
    }

    geometry.boundary = LinkedFaces.boundaryOf(geometry.faces);
    splited.boundary = LinkedFaces.boundaryOf(splited.faces);

    this.trimVertices(geometry);
    this.trimVertices(splited);

    for ( let face of faces )
      delete face[SIDE];

    return splited;
  }
  static fillBoundaryOnPlane(geometry, boundary, plane) {
    // offset and rotation to plane
    var offset = plane.normal.clone().multiplyScalar(-plane.constant);
    var {phi, theta} = new THREE.Spherical().setFromVector3(plane.normal);
    var rot = new THREE.Quaternion().setFromAxisAngle({x:-Math.cos(theta), y:0, z:Math.sin(theta)}, phi);

    // find loop of edges
    boundary = new Set(boundary);
    var loops = [];

    while ( boundary.size() > 0 ) {
      let loop = [];

      let bd = boundary.values().next().value;
      while ( boundary.delete(bd) ) {
        let v0 = geometry.vertices[bd.face[bd.edge[0]]].clone();
        v0.sub(offset);
        v0.applyQuaternion(rot);

        loop.push([bd, new THREE.Vector2(v0.z, v0.x)]);
        bd = LinkedFaces.next_boundary(bd);
      }
      loops.push(loop);
    }

    // classify loop
    var loopsType = [];
    const POS = Symbol("POS");
    const NEG = Symbol("NEG");

    for ( for loop of loops ) {
      let vs = loop.map(([bd, v]) => v.clone().sub(loop[0][1]));
      vs = vs.filter(v => v.y !== 0);
      let prev_sgn = Math.sign(vs[vs.length-1]);
      vs = vs.filter(v => prev_sgn !== (prev_sgn = Math.sign(v.y)));
      if ( vs.length === 0 ) {
        // heart-shape

      } else {
        //       ____
        //      /    \
        // ----|------|----
        //      \____/
        let vs_ = vs.slice();
        vs_.sort((v1, v2) => v1.x-v2.x);
        let v_left = vs_[0], v_right = vs_[vs_.length-1];

        if ( v_left.y < 0 && v_right.y > 0 )
          loopsType.push(POS);
        else if ( v_left.y > 0 && v_right.y < 0 )
          loopsType.push(NEG);
        else
          console.assert(false);
      }
    }

    // determine position of loop

    // // fill boundary
    // let normal = plane.normal.clone();
    // let boundary = new Set(geometry.boundary);
    // geometry.boundary = new Set();
    // 
    // for ( let loop of loops ) {
    //   // make face to fill the hole
    //   while ( loop.length >= 3 ) {
    //     let [link_cb, link_ba, ...remains] = loop;
    // 
    //     if ( link_cb.face[EDGES_NEXT[link_cb.edge]].type === LINK.CONCAVE ) {
    //       loop.push(loop.shift());
    //       continue;
    //     }
    // 
    //     let c = link_ab.face[link_cb.edge[0]];
    //     let b = link_ab.face[link_cb.edge[1]];
    //     let a = link_ab.face[link_ba.edge[1]];
    // 
    //     let face = new THREE.Face3(a, b, c, normal);
    //     geometry.faces.push(face);
    // 
    //     LinkedFaces.link(face, "ab", link_ba.face, link_ba.edge);
    //     LinkedFaces.link(face, "bc", link_cb.face, link_cb.edge);
    //     let [link_ca] = LinkedFaces.unlink(face, "ca");
    // 
    //     // remains.unshift(link_ca); // fan-like filling
    //     remains.push(link_ca); // rose-like filling
    //     loop = remains;
    //   }
    // 
    //   LinkedFaces.link(loop[0].face, loop[0].edge, loop[1].face, loop[1].edge);
    // }
  }
  static sewBoundary(geometry, boundary1, boundary2) {}

  static buildConvaxHull(points) {}
}

